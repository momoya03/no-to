import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `あなたはプロのノート作成アシスタントです。資料を読み込み、大学生が試験前に使える詳細な学習ノートを作ってください。

最重要ルール：
- キーワード一覧、用語集、単語リストは絶対に作らない
- 自己テスト問題も作らない
- 資料の内容を、完結した文章で、できるだけ多くノートに残す
- 1行1行を最後まで論理的に書き切る
- 簡潔すぎるまとめ方はしない。資料の情報を惜しみなく使う
- 見出しの下には必ず複数行の説明を入れる

禁止：
- 表（テーブル）
- 捏造
- 参考文献・出典リスト
- 原文の丸写し（自分の言葉で）
- ページ番号言及
- 締めの挨拶文

書式：
- 重要な数値は **太字**
- 難読漢字には初出時のみ（よみがな）を付与
- 見出しは # と ## のみ使用
- 本文は箇条書き（-）で

出力構成：
# 資料タイトル
# 概要（資料全体の要約、3-5文）
# 各章・各セクションの内容（見出し＋詳しい説明＋重要ポイントの箇条書き）`

async function callGroq(prompt: string, apiKey: string): Promise<{ text: string; rateLimited: boolean }> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      temperature: 0.7, max_tokens: 4096
    })
  })

  if (response.status === 429) {
    return { text: '', rateLimited: true }
  }
  if (!response.ok) {
    throw new Error(`Groq ${response.status}`)
  }
  const data = await response.json()
  return { text: data.choices[0].message.content.trim(), rateLimited: false }
}

async function callDeepSeek(prompt: string, apiKey: string): Promise<{ text: string; rateLimited: boolean }> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      temperature: 0.7, max_tokens: 4096
    })
  })
  if (response.status === 429 || response.status === 402) {
    return { text: '', rateLimited: true }
  }
  if (!response.ok) {
    throw new Error(`DeepSeek ${response.status}`)
  }
  const data = await response.json()
  return { text: data.choices[0].message.content.trim(), rateLimited: false }
}

async function callGemini(prompt: string, apiKey: string): Promise<{ text: string; rateLimited: boolean }> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 9000)
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
        }),
        signal: controller.signal
      }
    )
    if (response.status === 429) return { text: '', rateLimited: true }
    if (!response.ok) throw new Error(`Gemini ${response.status}`)
    const data = await response.json()
    return { text: data.candidates[0].content.parts[0].text.trim(), rateLimited: false }
  } finally { clearTimeout(t) }
}

function truncateText(text: string, maxTokens = 7000): string {
  const maxChars = maxTokens * 3
  if (text.length <= maxChars) return text
  const sentences = text.split(/(?<=[。！？.!?])\s+/)
  let result = ''
  for (const s of sentences) {
    if (result.length + s.length > maxChars) break
    result += s + ' '
  }
  return result.trim()
}

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json()
    if (!content?.trim()) {
      return NextResponse.json({ error: 'empty' }, { status: 400 })
    }

    const truncated = truncateText(content.trim(), 7000)
    const prompt = `以下の資料を解析し学習ノートを作成してください：\n\n${truncated}`

    // Priority: DeepSeek > Gemini > Groq (ranked by output quality)
    const deepseekKey = process.env.DEEPSEEK_API_KEY || ''
    const geminiKey = process.env.GEMINI_API_KEY || ''
    const groqKeys = [
      process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
    ].filter(Boolean) as string[]

    let result = ''

    // 1st: DeepSeek — best CJK quality
    if (deepseekKey) {
      try { const r = await callDeepSeek(prompt, deepseekKey); if (r.text) result = r.text } catch {}
    }

    // 2nd: Gemini
    if (!result && geminiKey) {
      try { const r = await callGemini(prompt, geminiKey); if (r.text) result = r.text } catch {}
    }

    // 3rd: Groq keys (rotate on 429)
    if (!result) {
      for (const key of groqKeys) {
        try { const r = await callGroq(prompt, key); if (r.text) { result = r.text; break } } catch {}
      }
    }

    if (!result) {
      return NextResponse.json({ error: 'all providers exhausted' }, { status: 500 })
    }

    return NextResponse.json({ notes: result })
  } catch {
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
