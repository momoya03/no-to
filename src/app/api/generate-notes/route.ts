import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `あなたはプロフェッショナルなノート作成アシスタントです。大学生向けの詳細な学習ノートを作成してください。

【最重要：詳細さ】
- 各セクションで最低5行以上の詳しい説明を書く
- 簡潔にまとめすぎない。資料の内容をできるだけ多くノートに反映する
- 見出しの下には必ず複数の箇条書き項目を入れる
- 出力は最低2000文字以上

【絶対禁止】
- テーブル（表）禁止。箇条書き（-）と見出し（#、##）のみ
- 資料にない情報の捏造禁止。不明点は「記載なし」
- 参考文献・引用文献・出典リストの出力禁止
- 原文の丸写し禁止。自分の言葉で要約
- ページ番号言及禁止
- 「以上です」「ご参考までに」などの挨拶・締め文禁止

【強調ルール】
- 重要な数値・統計・年号は **太字** で強調
- 例：「GDP成長率は **3.5%**」「参加者 **1,200人**」

【読み方と注釈】
- 難読漢字の初出時に「漢字（よみがな）」を付与（常用漢字は不要）
- 専門カタカナ語に初出時のみ「用語（中文：中国語訳）」を付与

【出力構成（厳守）】
# 資料タイトル
基本情報（分野・概要）

# 全体構成
目次形式で各章・セクションのタイトルを列挙

# セクション別 重要ポイント
各セクションについて：
- 概要（2-3文）
- 重要ポイント（最低3項目の箇条書き、各項目は1-2文で詳しく）
- 補足・気づき（該当があれば）

# 重要キーワード
各キーワードに「用語 — 意味（中文訳）」の形式で、最低5語以上

# 自己テスト
3問（各問に選択肢4つ＋模範解答＋解説付き）`

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 8192
    })
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Groq API error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content.trim()
}

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
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 9000)

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`Gemini API error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    return data.candidates[0].content.parts[0].text.trim()
  } finally {
    clearTimeout(timeout)
  }
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
    const groqKey = process.env.GROQ_API_KEY || ''
    const geminiKey = process.env.GEMINI_API_KEY || ''

    if (!deepseekKey && !groqKey && !geminiKey) {
      return NextResponse.json({ error: 'AI APIキーが設定されていません' }, { status: 400 })
    }

    const cleaned = content.trim()
    const truncated = truncateText(cleaned, 10000)

    const prompt = `以下の資料テキストを解析し、学習ノートを生成してください：

${truncated}`

    let result = ''
    const errors: string[] = []

    // Groq first (free, no quota issues)
    if (groqKey) {
      try {
        result = await callGroq(prompt, groqKey)
      } catch (e: any) {
        errors.push('Groq: ' + (e.message || String(e)))
      }
    }

    // DeepSeek second (best CJK quality)
    if (!result && deepseekKey) {
      try {
        result = await callDeepSeek(prompt, deepseekKey)
      } catch (e: any) {
        errors.push('DeepSeek: ' + (e.message || String(e)))
      }
    }

    // Gemini last
    if (!result && geminiKey) {
      try {
        result = await callGemini(prompt, geminiKey)
      } catch (e: any) {
        errors.push('Gemini: ' + (e.message || String(e)))
      }
    }

    if (!result) {
      return NextResponse.json({
        error: 'AI生成に失敗しました',
        debug: { errors: errors.join(' | ') || 'no keys configured' }
      }, { status: 500 })
    }

    return NextResponse.json({ notes: result })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
