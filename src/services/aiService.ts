'use client'

import { PDFPage, NotePage, Message } from '@/types'
import { generateId } from '@/lib/utils'

const SYSTEM_PROMPT_DETAILED = `あなたは日本の大学の講義ノート作成アシスタントです。

【絶対ルール】
1. 内容の完全性を最優先し、PPTの情報を絶対に省略しないでください
2. 各ページごとに整理し、ページ番号を明記してください
3. 日本語を主体とし、難しい専門用語には必要に応じて短い中国語注釈を付けてください
4. 読み仮名（ふりがな）は難読語、学術用語、固有名詞、特に珍しい言葉にだけ付けてください
5. チャートや表がある場合は、文字で説明してください。「図の通り」は禁止です
6. 授業を受けていない人でも理解できるように整理してください
7. 内容が判読しにくい場合は「判読が難しい」と明記し、できるだけ文脈から補完してください

【出力フォーマット】
# 第{ページ番号}ページ：{タイトル}
・{内容1}
・{内容2}
（必要に応じて中国語注釈）

【注意】
- 大幅な要約は禁止し、できるだけ元の内容を保持してください
- 各ページを独立して整理し、全体を一つの文章にまとめないでください`

const SYSTEM_PROMPT_EXAM = `あなたは日本の大学の講義ノート作成アシスタントです。

【絶対ルール】
1. 試験勉強用に、核心的な内容をコンパクトに整理してください
2. ただし、重要な情報は絶対に省略しないでください
3. 各ページごとに整理し、ページ番号を明記してください
4. 日本語を主体としてください

【出力フォーマット】
# 第{ページ番号}ページ
・{重要ポイント1}
・{重要ポイント2}`

const QA_SYSTEM_PROMPT = `あなたは日本の大学の講義内容について答えるアシスタントです。

【ルール】
1. 提供されたPPT/ノートの内容だけに基づいて回答してください
2. 回答は日本語を主体とし、必要に応じて短い中国語注釈を付けてください
3. できるだけ「第Xページ」や「どの部分」を引用して回答してください
4. 資料内に情報がない場合は、明確に「この資料内では確認できません」と答えてください
5. 回答は簡潔かつ分かりやすく、学生が理解しやすい言葉で説明してください
6. 長すぎる回答は避け、的確に答えてください`

export function generateNotesLocal(pages: PDFPage[], mode: 'detailed' | 'exam' = 'detailed'): NotePage[] {
  const notePages: NotePage[] = []

  pages.forEach((page) => {
    let noteContent = ''
    
    if (page.text === '判読が難しい' || page.text.trim() === '') {
      noteContent = `# 第${page.pageNumber}ページ\n\n判読が難しい`
    } else {
      const lines = page.text.split('\n').filter(l => l.trim())
      const title = lines.length > 0 ? lines[0].trim() : 'タイトルなし'
      
      noteContent = `# 第${page.pageNumber}ページ：${title}\n\n`
      
      if (mode === 'detailed') {
        lines.slice(1).forEach(line => {
          if (line.trim()) {
            noteContent += `・${line.trim()}\n`
          }
        })
      } else {
        const importantLines = lines.slice(1).filter(l => 
          l.includes('：') || l.includes('＝') || l.includes('→') || 
          l.includes('重要') || l.includes('ポイント') || l.length > 10
        )
        importantLines.slice(0, 8).forEach(line => {
          if (line.trim()) {
            noteContent += `・${line.trim()}\n`
          }
        })
      }
    }

    notePages.push({
      pageNumber: page.pageNumber,
      originalContent: page.text,
      noteContent
    })
  })

  return notePages
}

export function generateQAResponseLocal(
  userQuestion: string,
  pdfPages: PDFPage[],
  notePages: NotePage[],
  currentPage: number
): string {
  const question = userQuestion.toLowerCase()
  
  let relevantContent = ''
  let referencedPages: number[] = []

  if (question.includes('このページ') || question.includes('ここ')) {
    const page = notePages.find(p => p.pageNumber === currentPage)
    if (page) {
      relevantContent = page.noteContent
      referencedPages = [currentPage]
    }
  } else {
    notePages.forEach(page => {
      const content = (page.originalContent + page.noteContent).toLowerCase()
      const keywords = question.split(/\s+/).filter(k => k.length > 1)
      const matches = keywords.filter(k => content.includes(k))
      
      if (matches.length > 0) {
        relevantContent += `\n--- 第${page.pageNumber}ページ ---\n${page.noteContent}\n`
        referencedPages.push(page.pageNumber)
      }
    })

    if (relevantContent === '') {
      referencedPages = Array.from({ length: Math.min(5, notePages.length) }, (_, i) => i + 1)
      notePages.slice(0, 5).forEach(page => {
        relevantContent += `\n--- 第${page.pageNumber}ページ ---\n${page.noteContent}\n`
      })
    }
  }

  let response = ''
  
  if (question.includes('何ページ') || question.includes('どこ')) {
    response = `この内容については、第${referencedPages.join('、')}ページを参照してください。`
  } else if (question.includes('まとめ') || question.includes('重要')) {
    response = `この講義の主なポイントは以下の通りです：\n\n${relevantContent.slice(0, 500)}...\n\n詳細は第${referencedPages.slice(0, 3).join('、')}ページを参照してください。`
  } else if (question.includes('意味') || question.includes('何ですか')) {
    response = `ご質問ありがとうございます。\n\nこの資料の第${referencedPages.join('、')}ページに関連情報があります。\n\n${relevantContent.slice(0, 300)}...\n\n（注：AI機能をフルに活用するには.envファイルでAPIキーを設定してください）`
  } else {
    response = `ご質問ありがとうございます。\n\n関連するページ：第${referencedPages.join('、')}ページ\n\n${relevantContent.slice(0, 400)}...\n\n（AI機能をフルに活用するにはAPIキーを設定してください）`
  }

  return response
}

export function createMessage(role: 'user' | 'assistant', content: string): Message {
  return {
    id: generateId(),
    role,
    content,
    timestamp: new Date()
  }
}
