import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `あなたはプロのノート作成アシスタントです。「このノートさえ読めば授業に出なくても内容を完全に理解できる」レベルの詳細な学習ノートを作ってください。

最重要：
- 資料の内容を徹底的に網羅する。情報を落とさない
- 論理的な流れを保ち、完結した文章で書く
- 各セクションに十分な説明をつける
- 重要な数値は **太字**
- 難読漢字に初出時のみ（よみがな）
- 表禁止、捏造禁止、参考文献禁止、挨拶文禁止

出力形式：以下のJSON形式で厳密に出力してください。JSON以外のテキストは一切出力しないこと。コードブロック(\`\`\`)も不要です。

{
  "title": "資料タイトル",
  "sections": [
    {
      "heading": "セクションの見出し",
      "bullets": ["要点1", "要点2", "要点3"]
    }
  ]
}

各セクションは必ず1つの見出しと3〜8個の箇条書き要点を持つこと。セクション数は内容に応じて適切な数（通常5〜15個）とすること。`

async function callGroq(prompt: string, apiKey: string): Promise<{ text: string; rateLimited: boolean; error?: string }> {
  try {
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
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      return { text: '', rateLimited: false, error: `Groq ${r.status}: ${body.slice(0, 300)}` }
    }
    const d = await r.json()
    return { text: d.choices[0].message.content.trim(), rateLimited: false }
  } catch (e) {
    return { text: '', rateLimited: false, error: `Groq exception: ${e}` }
  }
}

async function callDeepSeek(prompt: string, apiKey: string): Promise<{ text: string; rateLimited: boolean; error?: string }> {
  try {
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
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      return { text: '', rateLimited: false, error: `DeepSeek ${r.status}: ${body.slice(0, 300)}` }
    }
    const d = await r.json()
    return { text: d.choices[0].message.content.trim(), rateLimited: false }
  } catch (e) {
    return { text: '', rateLimited: false, error: `DeepSeek exception: ${e}` }
  }
}

async function callGemini(prompt: string, apiKey: string): Promise<{ text: string; rateLimited: boolean; error?: string }> {
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
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      return { text: '', rateLimited: false, error: `Gemini ${r.status}: ${body.slice(0, 300)}` }
    }
    const d = await r.json()
    return { text: d.candidates[0].content.parts[0].text.trim(), rateLimited: false }
  } catch (e) {
    return { text: '', rateLimited: false, error: `Gemini exception: ${e}` }
  } finally { clearTimeout(t) }
}

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json()
    if (!content?.trim()) return NextResponse.json({ error: 'empty' }, { status: 400 })

    const prompt = content.trim()
    const errors: string[] = []

    const ds = process.env.DEEPSEEK_API_KEY || ''
    const gm = process.env.GEMINI_API_KEY || ''
    const groqKeys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3].filter(Boolean) as string[]

    let result = ''

    if (ds) {
      const r = await callDeepSeek(prompt, ds)
      if (r.text) result = r.text
      else if (r.error) errors.push(r.error)
    }
    if (!result && gm) {
      const r = await callGemini(prompt, gm)
      if (r.text) result = r.text
      else if (r.error) errors.push(r.error)
    }
    if (!result) {
      for (const k of groqKeys) {
        const r = await callGroq(prompt, k)
        if (r.text) { result = r.text; break }
        else if (r.error) errors.push(r.error)
      }
    }

    if (!result) {
      return NextResponse.json({
        error: 'all providers exhausted',
        details: errors.length > 0 ? errors : ['No API keys configured'],
        keysFound: { deepseek: !!ds, gemini: !!gm, groq: groqKeys.length }
      }, { status: 500 })
    }
    return NextResponse.json({ notes: result })
  } catch (e) {
    return NextResponse.json({ error: 'server error', details: [String(e)] }, { status: 500 })
  }
}
