import { StructuredNote, NoteSection } from '@/types'

const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''

const LANG_OPTIONS: Record<string, string> = {
  ja: '日本語', zh: '中文', en: 'English', ko: '한국어',
}

// ========== Validation types ==========

interface ValidationIssue {
  severity: 'fatal' | 'error' | 'warn'
  field: string
  message: string
}

// ========== 1. JSON Prompt Builder ==========

function buildJSONPrompt(pdfLang: string, noteLang: string): string {
  const labels: Record<string, { title: string; dir: string; rules: string; schema: string }> = {
    ja: {
      title: 'あなたはプロのノート作成アシスタントです。',
      dir: '授業に出なかった学生がこのノートを読めば内容を理解できるように整理してください。',
      rules: `【ルール】
- 表禁止、捏造禁止、参考文献禁止、ページ番号禁止
- 原文の丸写し禁止。自分の言葉で再構成する
- 重要な数字・日付・キーワードは **太字** で強調
- 難読漢字や専門用語には（注：説明）を付ける。必要なものだけ、控えめに

【メリハリをつける】
- 重要な部分・複雑な概念 → 詳しく、要点を多めに
- 背景説明・補足情報 → 簡潔に、要点は少なく
- セクションごとの情報量は内容の重要度に応じて変える

【構成】
- 最初のセクションは「目次」として、全セクションの見出し一覧を書く
- 最後のセクションは「まとめ」として、授業全体の要点を3〜5個にまとめる`,
      schema: `【出力形式】以下のJSON形式で厳密に出力。JSON以外のテキストは一切出さないこと。

{
  "title": "資料タイトル",
  "sections": [
    {
      "heading": "端的な見出し",
      "bullets": ["要点を自分の言葉で書く", "次の要点"]
    }
  ]
}`,
    },
    zh: {
      title: '你是一名专业笔记助手。',
      dir: '没上课的学生读完这份笔记应能理解课堂内容。请用自己的话重新组织。',
      rules: `【规则】
- 禁止表格、捏造、参考文献、页码
- 禁止照抄原文——用自己的话改写
- 重要数字、日期、关键词用 **加粗**
- 难读汉字、专业术语加（注：说明），只加必要的

【有主有次】
- 重要内容、复杂概念 → 详细写，要点多一些
- 背景说明、补充信息 → 简洁写，要点少一些
- 每个 section 的信息量根据内容重要性灵活调整

【结构】
- 第一个 section 是「目录」，列出所有 section 的标题
- 最后一个 section 是「总结」，用3-5条要点概括整节课`,
      schema: `【输出格式】严格输出以下JSON，不要输出JSON以外的文字。

{
  "title": "资料标题",
  "sections": [
    {
      "heading": "精炼标题",
      "bullets": ["用自己的话写要点", "下一个要点"]
    }
  ]
}`,
    },
    en: {
      title: 'You are a professional note-taking assistant.',
      dir: 'A student who missed class should understand the material from these notes. Restate in your own words.',
      rules: `【Rules】
- No tables, no fabrication, no references, no page numbers
- Do not copy verbatim — always restate
- Bold important numbers, dates, keywords with **...**
- Add (注：note) for difficult terms — sparingly

【Adapt to content importance】
- Core concepts, complex ideas → more detail, more bullet points
- Background info, supplementary notes → concise, fewer bullets
- Vary section length based on importance, not a fixed quota

【Structure】
- First section: "Outline" listing all section headings
- Last section: "Summary" with 3-5 key takeaways from the entire lecture`,
      schema: `【Output Format】Strictly JSON only.

{
  "title": "Document Title",
  "sections": [
    {
      "heading": "Concise heading",
      "bullets": ["Key point in your own words", "Next point"]
    }
  ]
}`,
    },
    ko: {
      title: '당신은 전문 노트 작성 어시스턴트입니다.',
      dir: '수업에 빠진 학생이 이 노트로 내용을 이해할 수 있도록, 자신의 말로 재구성하세요.',
      rules: `【규칙】
- 표 금지, 날조 금지, 참고문헌 금지, 페이지 번호 금지
- 원문 그대로 복사 금지. 자신의 말로 재구성
- 중요한 숫자·날짜·키워드는 **굵게**
- 난독 한자·전문 용어에 (注：설명) 추가, 필요한 것만

【완급 조절】
- 중요한 내용·복잡한 개념 → 상세히, 요점 많이
- 배경 설명·보충 정보 → 간결하게, 요점 적게
- 섹션별 정보량은 내용의 중요도에 따라 유연하게

【구성】
- 첫 섹션은 「목차」로, 전체 섹션 제목을 나열
- 마지막 섹션은 「요약」으로, 수업 전체의 핵심을 3-5개로 정리`,
      schema: `【출력 형식】다음 JSON 형식으로만 출력.

{
  "title": "자료 제목",
  "sections": [
    {
      "heading": "간결한 제목",
      "bullets": ["자신의 말로 요점 작성", "다음 요점"]
    }
  ]
}`,
    },
  }

  const l = labels[noteLang] || labels.ja
  const srcLang = LANG_OPTIONS[pdfLang] || '日本語'
  const outLang = LANG_OPTIONS[noteLang] || '日本語'

  return `${l.title} 元の資料は${srcLang}で書かれています。${l.dir}

${l.rules}

${l.schema}

【出力言語】必ず${outLang}で出力してください。`
}

// ========== 2. JSON Extraction ==========

function extractJSON(raw: string): StructuredNote | null {
  if (!raw?.trim()) return null

  // Strategy 1: direct parse
  try { return validateStructure(JSON.parse(raw)) } catch {}

  // Strategy 2: extract from ```json ... ``` or ``` ... ``` fence
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) {
    try { return validateStructure(JSON.parse(fenceMatch[1].trim())) } catch {}
  }

  // Strategy 3: find JSON object by matching braces
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = raw.slice(firstBrace, lastBrace + 1)
    // Fix common AI JSON mistakes: trailing commas
    const cleaned = candidate.replace(/,(\s*[}\]])/g, '$1')
    try { return validateStructure(JSON.parse(cleaned)) } catch {}
    try { return validateStructure(JSON.parse(candidate)) } catch {}
  }

  // Strategy 4: try each { position individually
  let pos = 0
  while ((pos = raw.indexOf('{"title"', pos)) !== -1) {
    // Find matching closing brace
    let depth = 0, end = -1
    for (let i = pos; i < raw.length; i++) {
      if (raw[i] === '{') depth++
      if (raw[i] === '}') depth--
      if (depth === 0) { end = i; break }
    }
    if (end > pos) {
      try { return validateStructure(JSON.parse(raw.slice(pos, end + 1))) } catch {}
    }
    pos++
  }

  return null
}

function validateStructure(obj: unknown): StructuredNote | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (typeof o.title !== 'string') return null
  if (!Array.isArray(o.sections)) return null
  const sections: NoteSection[] = []
  for (let i = 0; i < o.sections.length; i++) {
    const s = o.sections[i] as Record<string, unknown>
    if (typeof s.heading !== 'string') continue
    if (!Array.isArray(s.bullets)) continue
    const bullets = s.bullets.filter((b: unknown): b is string => typeof b === 'string' && b.trim().length > 0)
    if (bullets.length === 0) continue
    sections.push({ id: `s${i + 1}`, heading: s.heading, bullets })
  }
  if (sections.length === 0) return null
  return { title: o.title, sections }
}

// ========== 3. Validation ==========

function validateNote(note: StructuredNote): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []

  if (!note.title?.trim()) {
    issues.push({ severity: 'fatal', field: 'title', message: 'title is empty' })
  }
  if (!note.sections || note.sections.length === 0) {
    issues.push({ severity: 'fatal', field: 'sections', message: 'sections array is empty' })
    return { valid: false, issues }
  }

  const seenHeadings = new Map<string, number>()
  note.sections.forEach((s, i) => {
    if (!s.heading?.trim()) {
      issues.push({ severity: 'error', field: `sections[${i}].heading`, message: 'empty heading' })
    }
    if (!s.bullets || s.bullets.length === 0) {
      issues.push({ severity: 'error', field: `sections[${i}].bullets`, message: 'empty bullets' })
    } else if (s.bullets.every(b => !b.trim())) {
      issues.push({ severity: 'error', field: `sections[${i}].bullets`, message: 'all bullets blank' })
    }
    if (s.bullets && s.bullets.length < 2) {
      issues.push({ severity: 'warn', field: `sections[${i}].bullets`, message: 'only 1 bullet, section may be too short' })
    }
    if (s.heading?.trim()) {
      const key = s.heading.trim().toLowerCase()
      const count = seenHeadings.get(key) || 0
      seenHeadings.set(key, count + 1)
      if (count >= 1) {
        issues.push({ severity: 'warn', field: `sections[${i}].heading`, message: `duplicate heading: "${s.heading}"` })
      }
    }
  })

  const fatalCount = issues.filter(i => i.severity === 'fatal').length
  return { valid: fatalCount === 0, issues }
}

// ========== 4. Repair ==========

function repairNote(note: StructuredNote, issues: ValidationIssue[]): StructuredNote {
  let { title, sections } = structuredClone(note)
  const dupCounters = new Map<string, number>()

  for (const issue of issues) {
    if (issue.severity === 'fatal') {
      if (issue.field === 'title' && !title?.trim() && sections[0]?.heading) {
        title = sections[0].heading
      }
      continue
    }

    const idxMatch = issue.field.match(/sections\[(\d+)\]/)
    if (!idxMatch) continue
    const idx = parseInt(idxMatch[1])
    if (!sections[idx]) continue

    if (issue.field.endsWith('.heading')) {
      if (!sections[idx].heading?.trim()) {
        sections[idx] = { ...sections[idx], heading: `セクション ${idx + 1}` }
      }
      // Dedup: append counter
      const key = sections[idx].heading.trim().toLowerCase()
      const count = dupCounters.get(key) || 0
      if (count > 0) {
        sections[idx] = { ...sections[idx], heading: `${sections[idx].heading} (${count + 1})` }
      }
      dupCounters.set(key, count + 1)
    }

    if (issue.field.endsWith('.bullets')) {
      if (!sections[idx].bullets || sections[idx].bullets.length === 0) {
        sections[idx] = { ...sections[idx], bullets: ['記載なし'] }
      }
    }
  }

  // Remove sections that are still broken after repair
  sections = sections.filter(s => s.heading?.trim() && s.bullets?.length > 0)

  if (sections.length === 0) {
    sections = [{ id: 's1', heading: title || 'ノート', bullets: ['記載なし'] }]
  }

  return { title: title?.trim() || '無題ノート', sections }
}

// ========== 5. Markdown Conversion ==========

export function noteToMarkdown(note: StructuredNote): string {
  let md = `# ${note.title}\n\n`
  for (const s of note.sections) {
    md += `## ${s.heading}\n`
    for (const b of s.bullets) {
      md += `- ${b}\n`
    }
    md += '\n'
  }
  return md.trim()
}

// ========== 6. Chunk Merging ==========

function mergeStructuredNotes(notes: StructuredNote[]): StructuredNote {
  if (notes.length === 0) {
    return { title: '無題ノート', sections: [{ id: 's1', heading: '内容', bullets: ['記載なし'] }] }
  }
  if (notes.length === 1) return notes[0]

  const title = notes[0].title || notes.find(n => n.title)?.title || '無題ノート'
  const allSections: NoteSection[] = []
  const seenHeadings = new Set<string>()

  for (const note of notes) {
    for (const s of note.sections) {
      const key = s.heading.trim().toLowerCase()
      if (!seenHeadings.has(key)) {
        seenHeadings.add(key)
        allSections.push({ ...s, id: `s${allSections.length + 1}` })
      }
    }
  }

  return { title, sections: allSections }
}

// ========== 7. AI Call Helpers ==========

async function callClientGemini(prompt: string, systemPrompt: string): Promise<string> {
  if (!GEMINI_KEY) { console.warn('[clientGemini] no GEMINI_KEY'); return '' }
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
      }
    )
    if (!r.ok) {
      const errText = await r.text().catch(() => '')
      console.error(`[clientGemini] ${r.status}: ${errText.slice(0, 300)}`)
      return ''
    }
    const d = await r.json()
    return d.candidates?.[0]?.content?.parts?.[0]?.text || ''
  } catch (e) {
    console.error('[clientGemini] exception:', e)
    return ''
  }
}

async function callServerAPI(prompt: string): Promise<string> {
  try {
    const r = await fetch('/api/generate-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: prompt }),
    })
    if (r.ok) {
      const d = await r.json()
      return d.notes || ''
    }
    const errBody = await r.text().catch(() => '')
    console.error(`[api] ${r.status}: ${errBody.slice(0, 500)}`)
  } catch (e) {
    console.error('[api] fetch exception:', e)
  }
  return ''
}

// ========== 8. Text Chunking ==========

function chunkText(text: string, maxLen: number): string[] {
  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []

  for (const p of paragraphs) {
    if (p.length <= maxLen) {
      chunks.push(p.trim())
    } else {
      const sentences = p.split(/(?<=[。！？.!?])\s*/)
      let current = ''
      for (const s of sentences) {
        if (current.length + s.length > maxLen && current.length > 0) {
          chunks.push(current.trim())
          current = s
        } else {
          current += s
        }
      }
      if (current.trim()) chunks.push(current.trim())
    }
  }
  return chunks.length > 0 ? chunks : [text]
}

// ========== 9. Main Orchestrator ==========

export async function generateStructuredNotes(
  fullText: string,
  pdfLang: string,
  noteLang: string,
  onProgress: (msg: string, pct: number) => void
): Promise<{ note: StructuredNote; usedAI: boolean }> {
  const systemPrompt = buildJSONPrompt(pdfLang, noteLang)
  const chunks = chunkText(fullText, 2500)

  const structuredChunks: StructuredNote[] = []
  let allChunksSucceeded = true

  for (let i = 0; i < chunks.length; i++) {
    onProgress(`AI生成中 (${i + 1}/${chunks.length})...`, Math.round((i / chunks.length) * 80))

    const chunkPrompt = chunks.length === 1
      ? `以下の資料を解析し学習ノートを作成してください：\n\n${chunks[i]}`
      : `以下の資料のパート${i + 1}/${chunks.length}を解析し学習ノートを作成してください：\n\n${chunks[i]}`

    let raw = ''

    // Try client-side Gemini first
    raw = await callClientGemini(chunkPrompt, systemPrompt)

    // Fall back to server API
    if (!raw) {
      raw = await callServerAPI(chunkPrompt)
    }

    // Parse JSON from response
    if (raw) {
      const parsed = extractJSON(raw)
      if (parsed) {
        const { valid, issues } = validateNote(parsed)
        if (valid || issues.every(i => i.severity !== 'fatal')) {
          const repaired = issues.length > 0 ? repairNote(parsed, issues) : parsed
          structuredChunks.push(repaired)
          console.log(`[noteGen] chunk ${i + 1}/${chunks.length}: ${repaired.sections.length} sections (issues: ${issues.length})`)
          if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 3000))
          continue
        }
        console.warn(`[noteGen] chunk ${i + 1}/${chunks.length}: validation fatal`)
      } else {
        console.warn(`[noteGen] chunk ${i + 1}/${chunks.length}: JSON extraction failed`)
      }
    } else {
      console.warn(`[noteGen] chunk ${i + 1}/${chunks.length}: no AI response`)
    }

    allChunksSucceeded = false
    console.warn(`[noteGen] chunk ${i + 1}/${chunks.length} failed`)
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 1000))
  }

  if (structuredChunks.length === 0) {
    console.warn('[noteGen] all chunks failed, returning empty — caller should use local fallback')
    return { note: { title: '', sections: [] }, usedAI: false }
  }

  if (!allChunksSucceeded) {
    console.warn(`[noteGen] ${structuredChunks.length}/${chunks.length} chunks succeeded — merging partial AI result`)
  }

  const merged = mergeStructuredNotes(structuredChunks)

  // Final validation pass
  const { valid, issues } = validateNote(merged)
  const final = valid && issues.length === 0 ? merged : repairNote(merged, issues)

  console.log(`[noteGen] final: ${final.sections.length} sections, title: "${final.title}"`)
  return { note: final, usedAI: true }
}
