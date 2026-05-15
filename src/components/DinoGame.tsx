'use client'

import React, { useRef, useEffect, useCallback, useState } from 'react'

// Pixel-art dinosaur: 10 columns x 10 rows, each cell = 4x4px = 40x40 total
const DINO_PIXELS = [
  [0,0,0,0,0,0,0,1,1,1],
  [0,0,0,0,0,0,1,1,1,1],
  [0,0,0,0,0,1,1,1,1,1],
  [0,0,0,0,1,1,1,1,1,0],
  [0,0,0,1,1,1,1,1,0,0],
  [1,0,1,1,1,1,1,0,0,0],
  [1,1,1,1,1,1,0,0,0,0],
  [1,1,1,1,1,1,1,0,0,0],
  [1,0,1,1,0,0,1,0,0,0],
  [0,0,0,1,1,0,1,0,0,0],
]

interface Obstacle {
  x: number
  type: 'cactus' | 'bird'
  y: number
  w: number
  h: number
}

export default function DinoGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [started, setStarted] = useState(false)

  const stateRef = useRef({
    dinoY: 0,
    dinoVY: 0,
    jumping: false,
    obstacles: [] as Obstacle[],
    groundOff: 0,
    score: 0,
    speed: 5,
    frame: 0,
    gameOver: false,
    started: false,
  })

  const W = 640
  const H = 220
  const GROUND = 180
  const CELL = 4
  const DINO_W = 10 * CELL
  const DINO_H = 10 * CELL
  const DINO_X = 60
  const GRAVITY = 0.65
  const JUMP_V = -10.5

  const trigger = useCallback(() => {
    const s = stateRef.current
    if (s.gameOver) {
      s.dinoY = 0; s.dinoVY = 0; s.jumping = false
      s.obstacles = []; s.speed = 5; s.score = 0
      s.frame = 0; s.gameOver = false; s.started = true
      setGameOver(false); setScore(0); setStarted(true)
      return
    }
    if (!s.started) {
      s.started = true
      setStarted(true)
      return
    }
    if (!s.jumping) {
      s.dinoVY = JUMP_V
      s.jumping = true
    }
  }, [])

  // Auto-focus container on mount so keyboard works immediately
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let lastSpawn = 0

    // Draw pixel-art dino at jump height y
    const drawDino = (y: number) => {
      const baseY = GROUND - DINO_H - y
      const legAlt = stateRef.current.frame % 16 < 8
      for (let row = 0; row < DINO_PIXELS.length; row++) {
        for (let col = 0; col < DINO_PIXELS[row].length; col++) {
          if (!DINO_PIXELS[row][col]) continue

          // running legs: alternate
          if (row === 8 && col === 1 && legAlt && !stateRef.current.jumping) continue
          if (row === 9 && col === 3 && !legAlt && !stateRef.current.jumping) continue

          const px = DINO_X + col * CELL + 2
          const py = baseY + row * CELL + 2
          ctx.fillStyle = '#000'
          ctx.fillRect(px, py, CELL, CELL)
        }
      }
      // eye (white dot)
      const eyeX = DINO_X + 8 * CELL + 2
      const eyeY = baseY + 1 * CELL + 2
      ctx.fillStyle = '#fff'
      ctx.fillRect(eyeX, eyeY, CELL, CELL)
    }

    const drawCactus = (ox: number) => {
      ctx.fillStyle = '#000'
      // main trunk
      ctx.fillRect(ox + 6, GROUND - 36, 10, 36)
      // left arm
      ctx.fillRect(ox, GROUND - 24, 6, 4)
      ctx.fillRect(ox, GROUND - 36, 4, 16)
      // right arm
      ctx.fillRect(ox + 16, GROUND - 18, 6, 4)
      ctx.fillRect(ox + 18, GROUND - 30, 4, 14)
      // spikes
      ctx.fillRect(ox + 6, GROUND - 38, 2, 4)
      ctx.fillRect(ox + 14, GROUND - 40, 2, 6)
    }

    const drawBird = (ox: number, oy: number) => {
      const wingFlap = stateRef.current.frame % 14 < 7
      ctx.fillStyle = '#000'
      // body
      ctx.fillRect(ox + 6, oy + 4, 14, 8)
      // head
      ctx.fillRect(ox + 16, oy, 10, 8)
      // beak
      ctx.fillRect(ox + 24, oy + 2, 6, 3)
      // wings
      if (wingFlap) {
        ctx.fillRect(ox + 4, oy - 4, 8, 4)
        ctx.fillRect(ox + 4, oy + 12, 8, 4)
      } else {
        ctx.fillRect(ox + 2, oy + 4, 6, 4)
        ctx.fillRect(ox + 10, oy + 8, 4, 6)
      }
    }

    const drawGround = () => {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, GROUND, W, 2)
      const off = stateRef.current.groundOff
      for (let i = -off * 3; i < W + 100; i += 16) {
        ctx.fillRect(i % W, GROUND + 4, 4, 1)
      }
    }

    const render = () => {
      const s = stateRef.current
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)

      // cloud
      const cx = 500 - (s.groundOff * 5) % 700
      ctx.fillStyle = '#ddd'
      ctx.fillRect(cx, 36, 28, 4)
      ctx.fillRect(cx + 4, 30, 18, 6)

      drawGround()
      drawDino(s.dinoY)

      for (const o of s.obstacles) {
        if (o.type === 'cactus') drawCactus(o.x)
        else drawBird(o.x, o.y)
      }

      // score
      ctx.fillStyle = '#000'
      ctx.font = 'bold 16px monospace'
      ctx.fillText(`${Math.floor(s.score)}`, W - 70, 32)

      if (s.gameOver) {
        ctx.fillStyle = '#000'
        ctx.font = 'bold 14px monospace'
        ctx.fillText('GAME OVER', W / 2 - 40, H / 2 - 10)
      }
    }

    const update = () => {
      const s = stateRef.current
      if (!s.started || s.gameOver) return

      s.frame++
      s.groundOff = (s.groundOff + s.speed * 0.3) % 40
      s.score += s.speed * 0.12
      s.speed = 5 + Math.floor(s.score / 200) * 0.7

      if (s.jumping) {
        s.dinoY += s.dinoVY
        s.dinoVY += GRAVITY
        if (s.dinoY <= 0) { s.dinoY = 0; s.dinoVY = 0; s.jumping = false }
      }

      lastSpawn += s.speed
      const gap = Math.max(70, 180 - s.speed * 5)
      if (lastSpawn > gap) {
        lastSpawn = 0
        const kind: 'cactus' | 'bird' = Math.random() < 0.65 ? 'cactus' : 'bird'
        if (kind === 'cactus') {
          s.obstacles.push({ x: W, type: 'cactus', y: 0, w: 24, h: 40 })
        } else {
          const by = GROUND - DINO_H + 6 - Math.random() * 36
          s.obstacles.push({ x: W, type: 'bird', y: by, w: 32, h: 16 })
        }
      }

      for (const o of s.obstacles) o.x -= s.speed
      s.obstacles = s.obstacles.filter(o => o.x > -60)

      // collision
      const dl = DINO_X + 4
      const dr = DINO_X + DINO_W - 6
      const dt = GROUND - DINO_H - s.dinoY + 4
      const db = GROUND - s.dinoY - 4

      for (const o of s.obstacles) {
        const ol = o.x + 3
        const or = o.x + o.w - 3
        const ot = o.type === 'cactus' ? GROUND - o.h : o.y + 2
        const ob = o.type === 'cactus' ? GROUND : o.y + o.h - 2

        if (dr > ol && dl < or && db > ot && dt < ob) {
          s.gameOver = true
          setGameOver(true)
          break
        }
      }

      setScore(Math.floor(s.score))
    }

    const loop = () => {
      update()
      render()
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="outline-none select-none"
      onKeyDown={(e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
          e.preventDefault()
          trigger()
        }
      }}
    >
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full max-w-[640px] rounded-lg border border-black bg-white cursor-pointer mx-auto block"
        onClick={trigger}
        onTouchStart={(e) => { e.preventDefault(); trigger() }}
      />
      {!started && !gameOver && (
        <p className="text-center text-xs text-muted-foreground mt-2">
          スペースキー / 上矢印 または画面タップでスタート
        </p>
      )}
      {gameOver && (
        <p className="text-center text-xs text-muted-foreground mt-2">
          ゲームオーバー — スペースキー / タップでリトライ
        </p>
      )}
    </div>
  )
}
