import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `あなたはプロのノート作成アシスタントです。授業に出なかった学生がこのノートで内容を理解できるように、自分の言葉で整理してください。

ルール：
- 表禁止、捏造禁止、参考文献禁止、挨拶文禁止
- 原文の丸写し禁止。自分の言葉で再構成する
- 重要な数字・キーワードは **太字** で強調
- 難読漢字や専門用語には（注：説明）を付ける。必要なものだけ控えめに

メリハリ：
- 重要な部分・複雑な概念 → 詳しく、要点を多めに
- 背景説明・補足情報 → 簡潔に、要点は少なく

構成：
- sections配列の最初の要素は「目次」として全見出し一覧
- 配列の最後の要素は必ず「まとめ」とし、本文セクションより後に置く

出力形式：以下のJSONのみ。JSON以外のテキストは一切出さないこと。

{
  "title": "資料タイトル",
  "sections": [
    { "heading": "目次", "bullets": ["見出し1", "見出し2", "..."] },
    { "heading": "端的な見出し", "bullets": ["要点を自分の言葉で", "..."] },
    { "heading": "まとめ", "bullets": ["要点1", "要点2", "要点3"] }
  ]
}`

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
    if (r.status === 429) return { text: '', rateLimited: true, error: 'Groq rate limited (429)' }
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
    if (r.status === 429 || r.status === 402) return { text: '', rateLimited: true, error: `DeepSeek rate limited (${r.status})` }
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
    if (r.status === 429) return { text: '', rateLimited: true, error: 'Gemini rate limited (429)' }
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

    const gm = process.env.GEMINI_API_KEY || ''
    const groqKeys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3].filter(Boolean) as string[]
    const dsKeys = [process.env.DEEPSEEK_API_KEY, process.env.DEEPSEEK_API_KEY_2, process.env.DEEPSEEK_API_KEY_3].filter(Boolean) as string[]

    let result = ''

    // Priority: Gemini → Groq → DeepSeek (paid key last)
    if (gm) {
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
      for (const k of dsKeys) {
        const r = await callDeepSeek(prompt, k)
        if (r.text) { result = r.text; break }
        else if (r.error) errors.push(r.error)
      }
    }

    if (!result) {
      return NextResponse.json({
        error: 'all providers exhausted',
        details: errors.length > 0 ? errors : ['all providers returned empty (rate limited or no keys)'],
        keysFound: { gemini: !!gm, groq: groqKeys.length, deepseek: dsKeys.length }
      }, { status: 500 })
    }
    return NextResponse.json({ notes: result })
  } catch (e) {
    return NextResponse.json({ error: 'server error', details: [String(e)] }, { status: 500 })
  }
}
