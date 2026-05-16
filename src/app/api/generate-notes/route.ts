import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `あなたはプロのノート作成アシスタントです。「このノートさえ読めば授業に出なくても内容を完全に理解できる」レベルの詳細な学習ノートを作ってください。

最重要：
- 資料の内容を徹底的に網羅する。情報を落とさない
- 論理的な流れを保ち、完結した文章で書く
- 各セクションに十分な説明をつける
- 重要な数値は **太字**
- 難読漢字に初出時のみ（よみがな）
- 箇条書き（-）と見出し（#、##）で構成
- 表禁止、捏造禁止、参考文献禁止、挨拶文禁止

出力形式：
# 資料タイトル
# 概要（4-6文で全体像）
# 全体のアウトライン（主要セクションを階層で整理）
# 各セクションの詳細（見出し＋詳しい説明＋重要ポイント箇条書き。要点間に空行を入れる）`

async function callGroq(prompt: string, apiKey: string): Promise<{ text: string; rateLimited: boolean }> {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      temperature: 0.7, max_tokens: 8192
    })
  })
  if (r.status === 429) return { text: '', rateLimited: true }
  if (!r.ok) throw new Error(`Groq ${r.status}`)
  const d = await r.json()
  return { text: d.choices[0].message.content.trim(), rateLimited: false }
}

async function callDeepSeek(prompt: string, apiKey: string): Promise<{ text: string; rateLimited: boolean }> {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      temperature: 0.7, max_tokens: 8192
    })
  })
  if (r.status === 429 || r.status === 402) return { text: '', rateLimited: true }
  if (!r.ok) throw new Error(`DeepSeek ${r.status}`)
  const d = await r.json()
  return { text: d.choices[0].message.content.trim(), rateLimited: false }
}

async function callGemini(prompt: string, apiKey: string): Promise<{ text: string; rateLimited: boolean }> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 9000)
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
      }), signal: c.signal
    })
    if (r.status === 429) return { text: '', rateLimited: true }
    if (!r.ok) throw new Error(`Gemini ${r.status}`)
    const d = await r.json()
    return { text: d.candidates[0].content.parts[0].text.trim(), rateLimited: false }
  } finally { clearTimeout(t) }
}

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json()
    if (!content?.trim()) return NextResponse.json({ error: 'empty' }, { status: 400 })

    const prompt = content.trim()

    // Priority: DeepSeek > Gemini > Groq keys
    const ds = process.env.DEEPSEEK_API_KEY || ''
    const gm = process.env.GEMINI_API_KEY || ''
    const groqKeys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3].filter(Boolean) as string[]

    let result = ''

    if (ds) { try { const r = await callDeepSeek(prompt, ds); if (r.text) result = r.text } catch {} }
    if (!result && gm) { try { const r = await callGemini(prompt, gm); if (r.text) result = r.text } catch {} }
    if (!result) {
      for (const k of groqKeys) {
        try { const r = await callGroq(prompt, k); if (r.text) { result = r.text; break } } catch {}
      }
    }

    if (!result) return NextResponse.json({ error: 'all providers exhausted' }, { status: 500 })
    return NextResponse.json({ notes: result })
  } catch {
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
