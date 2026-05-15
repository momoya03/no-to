'use client'

import React, { useRef, useEffect, useState } from 'react'

const RESOURCES = [
  '書類フォルダの整理',
  'インク残量の確認',
  'コーヒーマシンの準備',
  '文房具の点検',
  'メモ帳の補充',
  'ネット回線の接続',
  'データベースの同期',
  'フォントの読み込み',
  'テンプレートの適用',
  '最終チェック',
]

interface BoxSlot {
  x: number
  y: number
  placed: boolean
}

interface Props {
  started: boolean
  complete: boolean
  onAllDone?: () => void
}

type Phase = 'idle' | 'carry' | 'return'

export default function MoleLoading({ started, complete, onAllDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [checkedItems, setCheckedItems] = useState<number[]>([])
  const [boxCount, setBoxCount] = useState(0)
  const [allDone, setAllDone] = useState(false)

  const stateRef = useRef({
    moleX: 180,
    boxOnHead: false,
    boxes: [] as BoxSlot[],
    checked: [] as number[],
    phase: 'idle' as Phase,
    frame: 0,
    count: 0,
    loaded: 0,
    // timer for next resource
    nextReady: 0,
    timerStarted: false,
    complete: false,
  })

  const W = 600
  const H = 280
  const GROUND = 230
  const HOME_X = 180
  const DROP_X = 400

  // init box slot positions (5 cols x 2 rows)
  const boxSlots: BoxSlot[] = (() => {
    const slots: BoxSlot[] = []
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 5; col++) {
        slots.push({ x: 470 + col * 26, y: GROUND - 28 - row * 26, placed: false })
      }
    }
    return slots
  })()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const s = stateRef.current

    const drawMole = (x: number, y: number): void => {
      const bob = s.phase === 'idle' ? Math.sin(s.frame * 0.08) * 2 : Math.abs(Math.sin(s.frame * 0.25) * 4)
      const my = y + bob

      ctx.save()
      ctx.translate(x, my)

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      ctx.beginPath()
      ctx.ellipse(0, 14, 18, 4, 0, 0, Math.PI * 2)
      ctx.fill()

      // feet
      const footAlt = s.phase !== 'idle' ? Math.sin(s.frame * 0.4) * 3 : 0
      ctx.fillStyle = '#5C3D0E'
      ctx.beginPath()
      ctx.ellipse(-5, 12 + footAlt, 7, 3.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(5, 12 - footAlt, 7, 3.5, 0, 0, Math.PI * 2)
      ctx.fill()

      // body
      ctx.fillStyle = '#7B5B3A'
      ctx.beginPath()
      ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2)
      ctx.fill()

      // belly
      ctx.fillStyle = '#A0845C'
      ctx.beginPath()
      ctx.ellipse(0, 3, 10, 7, 0, 0, Math.PI * 2)
      ctx.fill()

      // head
      ctx.fillStyle = '#7B5B3A'
      ctx.beginPath()
      ctx.arc(8, -8, 9, 0, Math.PI * 2)
      ctx.fill()

      // ears
      ctx.beginPath()
      ctx.arc(2, -17, 5, 0, Math.PI * 2)
      ctx.fill()

      // snout
      ctx.fillStyle = '#C4A87C'
      ctx.beginPath()
      ctx.ellipse(14, -4, 7, 4.5, -0.2, 0, Math.PI * 2)
      ctx.fill()

      // nose
      ctx.fillStyle = '#E8916A'
      ctx.beginPath()
      ctx.arc(18, -5, 3, 0, Math.PI * 2)
      ctx.fill()

      // eye
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.arc(10, -10, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(10.5, -10.5, 0.7, 0, Math.PI * 2)
      ctx.fill()

      // box on head
      if (s.boxOnHead) {
        ctx.fillStyle = '#D4A853'
        ctx.fillRect(-8, -22, 16, 12)
        ctx.fillStyle = '#B8923E'
        ctx.fillRect(-8, -22, 16, 2)
        ctx.strokeStyle = '#8B6914'
        ctx.lineWidth = 1
        ctx.strokeRect(-8, -22, 16, 12)
      }

      ctx.restore()
    }

    const drawBox = (bx: number, by: number): void => {
      ctx.fillStyle = '#D4A853'
      ctx.fillRect(bx, by, 22, 22)
      ctx.fillStyle = '#B8923E'
      ctx.fillRect(bx, by, 22, 3)
      ctx.strokeStyle = '#8B6914'
      ctx.lineWidth = 1
      ctx.strokeRect(bx, by, 22, 22)
      // cross tape
      ctx.strokeStyle = '#C4A050'
      ctx.beginPath()
      ctx.moveTo(bx + 11, by)
      ctx.lineTo(bx + 11, by + 22)
      ctx.moveTo(bx, by + 11)
      ctx.lineTo(bx + 22, by + 11)
      ctx.stroke()
    }

    const drawScene = () => {
      // bg
      ctx.fillStyle = '#FAF7F2'
      ctx.fillRect(0, 0, W, H)

      // underground gradient
      const grad = ctx.createLinearGradient(0, GROUND, 0, H)
      grad.addColorStop(0, '#D4C5A0')
      grad.addColorStop(0.15, '#C4B590')
      grad.addColorStop(1, '#B0A080')
      ctx.fillStyle = grad
      ctx.fillRect(0, GROUND, W, H - GROUND)

      // ground line
      ctx.fillStyle = '#5C4A2E'
      ctx.fillRect(0, GROUND, W, 2)
      // grass tufts
      ctx.fillStyle = '#7B9B3A'
      for (let i = 10; i < W; i += 50) {
        ctx.fillRect(i, GROUND - 4, 2, 4)
        ctx.fillRect(i + 4, GROUND - 6, 2, 6)
        ctx.fillRect(i + 8, GROUND - 3, 2, 3)
      }

      // dirt path
      ctx.fillStyle = '#C4B090'
      ctx.fillRect(160, GROUND + 2, 280, 14)

      // placed boxes
      for (const slot of boxSlots) {
        if (slot.placed) drawBox(slot.x, slot.y)
      }

      // mole
      const s = stateRef.current
      drawMole(s.moleX, GROUND - 12)

      // label for box area
      ctx.fillStyle = '#8B7B6B'
      ctx.font = '10px sans-serif'
      ctx.fillText('荷物置き場', 480, GROUND - 80)
    }

    const update = () => {
      s.frame++
      if (!started) return

      // timer-based resource loading
      if (s.checked.length < RESOURCES.length) {
        if (!s.timerStarted) {
          s.timerStarted = true
          s.nextReady = s.frame + 60  // first one after 1s
        }

        if (s.frame >= s.nextReady && s.phase === 'idle') {
          // trigger next resource
          s.boxOnHead = true
          s.phase = 'carry'
        }
      }

      // walking right
      if (s.phase === 'carry') {
        s.moleX += 2.5
        if (s.moleX >= DROP_X) {
          s.moleX = DROP_X
          // drop box
          s.boxOnHead = false
          const slot = boxSlots[s.checked.length]
          slot.placed = true
          s.checked.push(s.checked.length)
          s.count++
          setCheckedItems([...s.checked])
          setBoxCount(s.count)
          // set next timer
          s.nextReady = s.frame + 45 + Math.floor(Math.random() * 90) // 0.75-2.25s
          s.phase = 'return'
        }
      }

      // walking left
      if (s.phase === 'return') {
        s.moleX -= 2
        if (s.moleX <= HOME_X) {
          s.moleX = HOME_X
          s.phase = 'idle'
        }
      }

      // check if all loaded
      if (s.checked.length === RESOURCES.length && !s.complete) {
        s.complete = true
        if (complete) {
          setAllDone(true)
          onAllDone?.()
        }
      }

      // if parent signals complete and we're all loaded
      if (complete && s.checked.length === RESOURCES.length && !s.complete) {
        s.complete = true
        setAllDone(true)
        onAllDone?.()
      }
    }

    const loop = () => {
      update()
      drawScene()
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(animId)
  }, [started, complete])

  return (
    <div className="relative w-full max-w-[600px] mx-auto">
      {/* Checklist overlay — left side */}
      <div className="absolute top-2 left-1 z-10 pointer-events-none">
        <div className="text-xs font-bold text-gray-600 mb-1">📋 読み込み中...</div>
        <ul className="space-y-0.5">
          {RESOURCES.map((name, i) => {
            const done = checkedItems.includes(i)
            return (
              <li key={i} className="flex items-center gap-1.5 text-xs">
                <span className={done ? 'text-green-600 font-bold' : 'text-gray-400'}>
                  {done ? '✓' : '○'}
                </span>
                <span className={done ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}>
                  {name}
                </span>
              </li>
            )
          })}
        </ul>
        {allDone && (
          <div className="mt-2 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-full inline-block animate-bounce">
            完了！
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-[#FAF7F2] block"
      />

      {allDone && (
        <p className="text-center text-sm text-muted-foreground mt-2 animate-pulse">
          ノート生成が完了しました。まもなく遷移します...
        </p>
      )}
    </div>
  )
}
