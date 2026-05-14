import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `あなたはプロフェッショナルなノート作成アシスタントです。アップロードされた資料から、中国人留学生向けの学習用ノートを生成してください。

【絶対禁止事項】
- テーブル（表）は使用しないでください。すべて箇条書き（-）と見出し（#、##）で構成
- 資料に書かれていない情報を捏造しない
- 不明な点は「記載なし」とする
- 1行を途中で切らず、論理的に完結した一文として出力
- 参考文献、引用文献、出典リストは絶対に出力しないでください
- 元テキスト、原文、参考資料の丸写しセクションは出力しないでください
- ページ番号や「Xページ目」といった言及は一切しないでください

【数字・データの強調ルール】
- 本文中の重要な数値（統計、割合、金額、年号、数量など）は必ず **太字** で強調してください
- 例：「GDP成長率は **3.5%** に達した」「参加者は **1,200人** であった」
- ただし、見出し内の数字や単なるページ番号は強調不要です

【読み方と注釈のルール】
- 難読漢字（日常的でない難しい熟語）には、初出時のみ「漢字（よみがな）」の形式でふりがなを付けてください。常用漢字には不要です
- 専門用語やカタカナ語で日本語と中国語で意味が大きく異なるものには、初出時のみ「用語（中文：中文含义）」の形式で中国語注釈を付けてください。過剰に付けないこと

【出力構成】
1. 資料のタイトルと基本情報（ページ数、文字数）
2. 資料の全体構成（目次）
3. セクションごとの重要ポイント（見出し + 箇条書き）
4. 重要キーワード一覧（用語 + 簡潔な説明 + 難読漢字の読み方 + 必要に応じて中文注釈）
5. 自己テスト問題（3問、各問に模範解答も付ける）`

async function callDeepSeek(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 8192
    })
  })

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content.trim()
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
    })
  })

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates[0].content.parts[0].text.trim()
}

function truncateText(text: string, maxTokens: number = 6000): string {
  const maxChars = maxTokens * 3
  if (text.length <= maxChars) return text

  const sentences = text.split(/(?<=[。！？.!?])\s+/)
  let truncated = ''
  for (const s of sentences) {
    if (truncated.length + s.length > maxChars) break
    truncated += s + ' '
  }
  return truncated.trim()
}

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json({ error: '内容が空です' }, { status: 400 })
    }

    const deepseekKey = process.env.DEEPSEEK_API_KEY || ''
    const geminiKey = process.env.GEMINI_API_KEY || ''

    if (!deepseekKey && !geminiKey) {
      return NextResponse.json({ error: 'AI APIキーが設定されていません' }, { status: 400 })
    }

    const cleaned = content.trim()
    const truncated = truncateText(cleaned, 32000)

    const prompt = `以下の資料テキストを解析し、学習ノートを生成してください：

${truncated}`

    let result = ''

    if (geminiKey) {
      try {
        result = await callGemini(prompt, geminiKey)
      } catch (e) {
        console.error('Gemini error:', e)
      }
    }

    if (!result && deepseekKey) {
      try {
        result = await callDeepSeek(prompt, deepseekKey)
      } catch (e) {
        console.error('DeepSeek error:', e)
      }
    }

    if (!result) {
      return NextResponse.json({ error: 'AI生成に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ notes: result })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
