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
      title: 'あなたはプロフェッショナルなノート作成アシスタントです。',
      dir: '学習用ノートを生成してください。',
      rules: `【絶対禁止】
- 表（テーブル）禁止
- 捏造禁止、不明点は「記載なし」
- 参考文献・引用文献・出典リストは絶対に出力しない
- 元テキスト・原文の丸写しセクション禁止
- ページ番号言及禁止

【重要強調】重要なポイントや数値は **太字** で強調

【難解用語】特に難しい専門用語や特殊な読み方の漢字には、直後に（注：簡潔な説明or読み方）を付けてください。多用せず、本当に難しいものだけに。`,
      schema: `【出力形式】以下のJSON形式で厳密に出力してください。JSON以外のテキストは一切出力しないこと。コードブロック(\`\`\`)も不要、純粋なJSONオブジェクトのみを返すこと。

{
  "title": "資料タイトル",
  "sections": [
    {
      "heading": "セクションの見出し",
      "bullets": ["要点1", "要点2", "要点3"]
    }
  ]
}

各セクションは必ず1つの見出しと3〜8個の箇条書き要点を持つこと。セクション数は内容に応じて適切な数（通常5〜15個）とすること。`,
    },
    zh: {
      title: '你是一名专业的笔记制作助手。',
      dir: '请生成学习笔记。',
      rules: `【绝对禁止】
- 禁止表格
- 禁止捏造，不明确处标注「未记载」
- 绝对不要输出参考文献、引用文献、出处列表
- 禁止原文照抄段落
- 禁止提及页码

【重点强调】重要内容和数字用 **加粗** 强调

【难解术语】特别难的专业术语或罕见汉字，在其后添加（注：简要说明）。不要多用，仅在真正难解处。`,
      schema: `【输出格式】严格按以下JSON格式输出。不要输出JSON以外的任何文字，不要用代码块(\`\`\`)包裹，只返回纯JSON对象。

{
  "title": "资料标题",
  "sections": [
    {
      "heading": "章节标题",
      "bullets": ["要点1", "要点2", "要点3"]
    }
  ]
}

每个章节必须有1个标题和3-8条要点。章节数量根据内容适当调整（通常5-15个）。`,
    },
    en: {
      title: 'You are a professional note-taking assistant.',
      dir: 'Generate study notes.',
      rules: `【Strictly Forbidden】
- No tables
- No fabrication — mark unclear items as "Not documented"
- Never output references, citations, or source lists
- No verbatim copying of the original text
- No page number mentions

【Highlighting】Important points and figures must be **bold**

【Difficult Terms】For particularly difficult technical terms or rare readings, add (注：brief explanation) right after. Use sparingly.`,
      schema: `【Output Format】Output STRICTLY as JSON. No other text, no code fences, just the raw JSON object.

{
  "title": "Document Title",
  "sections": [
    {
      "heading": "Section Heading",
      "bullets": ["Key point 1", "Key point 2", "Key point 3"]
    }
  ]
}

Each section must have 1 heading and 3-8 bullet points. Produce an appropriate number of sections (typically 5-15).`,
    },
    ko: {
      title: '당신은 전문적인 노트 작성 어시스턴트입니다.',
      dir: '학습 노트를 생성해 주세요.',
      rules: `【절대 금지】
- 표 금지
- 날조 금지, 불명확한 사항은 「기재 없음」으로 표시
- 참고문헌·인용문헌·출처 목록 절대 출력 금지
- 원문 그대로 복사 금지
- 페이지 번호 언급 금지

【중요 강조】중요한 포인트와 수치는 **굵게**

【어려운 용어】특히 어려운 전문 용어나 특수 읽기의 한자에는 바로 뒤에 (注：간결한 설명이나 읽기)를 붙여 주세요.`,
      schema: `【출력 형식】다음 JSON 형식으로 엄격하게 출력하세요. JSON 외 텍스트는 일체 출력 금지. 코드 블록(\`\`\`)도 불필요, 순수 JSON 객체만 반환.

{
  "title": "자료 제목",
  "sections": [
    {
      "heading": "섹션 제목",
      "bullets": ["요점 1", "요점 2", "요점 3"]
    }
  ]
}

각 섹션은 반드시 1개의 제목과 3-8개의 요점을 가질 것. 섹션 수는 내용에 따라 적절히 (보통 5-15개).`,
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

  // Strategy 2: extract from ```json ... ``` fence
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) {
    try { return validateStructure(JSON.parse(fenceMatch[1].trim())) } catch {}
  }

  // Strategy 3: find first { to last }
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const candidate = raw.slice(firstBrace, lastBrace + 1)
      return validateStructure(JSON.parse(candidate))
    } catch {}
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
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2000))
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
  const chunks = chunkText(fullText, 1500)

  const structuredChunks: StructuredNote[] = []

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
        console.warn(`[noteGen] chunk ${i + 1}/${chunks.length}: validation fatal, issues:`, issues)
      } else {
        console.warn(`[noteGen] chunk ${i + 1}/${chunks.length}: JSON extraction failed`)
      }
    } else {
      console.warn(`[noteGen] chunk ${i + 1}/${chunks.length}: no AI response`)
    }

    // Retry once with simplified prompt for this chunk
    await new Promise(r => setTimeout(r, 2000))
    raw = await callServerAPI(chunkPrompt)
    if (raw) {
      const parsed = extractJSON(raw)
      if (parsed) {
        const { issues } = validateNote(parsed)
        const repaired = issues.length > 0 ? repairNote(parsed, issues) : parsed
        structuredChunks.push(repaired)
        console.log(`[noteGen] chunk ${i + 1}/${chunks.length} retry OK: ${repaired.sections.length} sections`)
        if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 3000))
        continue
      }
    }

    console.warn(`[noteGen] chunk ${i + 1}/${chunks.length} failed completely`)
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 3000))
  }

  if (structuredChunks.length === 0) {
    console.warn('[noteGen] all chunks failed, returning empty — caller should use local fallback')
    return { note: { title: '', sections: [] }, usedAI: false }
  }

  const merged = mergeStructuredNotes(structuredChunks)

  // Final validation pass
  const { valid, issues } = validateNote(merged)
  const final = valid && issues.length === 0 ? merged : repairNote(merged, issues)

  console.log(`[noteGen] final: ${final.sections.length} sections, title: "${final.title}"`)
  return { note: final, usedAI: true }
}
