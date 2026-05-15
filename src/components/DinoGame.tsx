'use client'

import React, { useRef, useEffect, useCallback, useState } from 'react'

interface Obstacle {
  x: number
  type: 'cactus' | 'bird'
  y: number
  width: number
  height: number
}

export default function DinoGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [started, setStarted] = useState(false)
  const stateRef = useRef({
    dinoY: 0,
    dinoVY: 0,
    isJumping: false,
    obstacles: [] as Obstacle[],
    groundOffset: 0,
    score: 0,
    speed: 4,
    frame: 0,
    gameOver: false,
    started: false,
  })

  const CANVAS_W = 640
  const CANVAS_H = 240
  const GROUND_Y = 200
  const DINO_X = 60
  const DINO_W = 32
  const DINO_H = 40
  const GRAVITY = 0.7
  const JUMP_VEL = -11

  const jump = useCallback(() => {
    const s = stateRef.current
    if (s.gameOver) {
      // restart
      s.dinoY = 0
      s.dinoVY = 0
      s.isJumping = false
      s.obstacles = []
      s.speed = 4
      s.score = 0
      s.frame = 0
      s.gameOver = false
      s.started = true
      setGameOver(false)
      setScore(0)
      setStarted(true)
      return
    }
    if (!s.started) {
      s.started = true
      setStarted(true)
      return
    }
    if (!s.isJumping) {
      s.dinoVY = JUMP_VEL
      s.isJumping = true
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let lastSpawn = 0

    const drawDino = (y: number) => {
      const x = DINO_X
      const gy = GROUND_Y - DINO_H - y
      // body
      ctx.fillStyle = '#374151'
      ctx.fillRect(x + 4, gy + 4, 24, 28)
      // head
      ctx.fillRect(x + 16, gy, 16, 12)
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(x + 24, gy, 8, 8)
      // eye
      ctx.fillStyle = '#fff'
      ctx.fillRect(x + 26, gy + 2, 3, 3)
      // legs
      const legPhase = stateRef.current.frame % 20 < 10
      ctx.fillStyle = '#374151'
      ctx.fillRect(x + 6, gy + 32, 8, 8)
      ctx.fillRect(x + 18, gy + 32, 8, legPhase ? 12 : 8)
      // tail
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(x, gy + 16, 6, 6)
    }

    const drawCactus = (ox: number) => {
      const y = GROUND_Y - 30
      ctx.fillStyle = '#16a34a'
      // trunk
      ctx.fillRect(ox + 5, y + 6, 8, 24)
      // left arm
      ctx.fillRect(ox, y + 12, 6, 6)
      ctx.fillRect(ox, y, 6, 12)
      // right arm
      ctx.fillRect(ox + 11, y + 6, 6, 6)
      ctx.fillRect(ox + 11, y + 2, 6, 10)
    }

    const drawBird = (ox: number, oy: number) => {
      const wingUp = stateRef.current.frame % 20 < 10
      ctx.fillStyle = '#dc2626'
      // body
      ctx.fillRect(ox + 4, oy + 4, 16, 10)
      // head
      ctx.fillRect(ox + 16, oy, 10, 8)
      ctx.fillStyle = '#fff'
      ctx.fillRect(ox + 20, oy + 2, 3, 3)
      // beak
      ctx.fillStyle = '#fbbf24'
      ctx.fillRect(ox + 24, oy + 2, 5, 3)
      // wings
      ctx.fillStyle = '#dc2626'
      ctx.fillRect(ox + 2, oy + (wingUp ? 0 : 10), 14, 6)
    }

    const drawGround = () => {
      const off = stateRef.current.groundOffset
      ctx.fillStyle = '#9ca3af'
      ctx.fillRect(0, GROUND_Y, CANVAS_W, 2)
      // ground texture
      ctx.fillStyle = '#6b7280'
      for (let i = -off; i < CANVAS_W + off; i += 20) {
        ctx.fillRect(i, GROUND_Y + 4, 6, 1)
      }
    }

    const render = () => {
      const s = stateRef.current
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

      // sky bg
      ctx.fillStyle = '#f3f4f6'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      // clouds
      ctx.fillStyle = '#e5e7eb'
      ctx.beginPath()
      ctx.arc(120 - (s.groundOffset * 0.3) % 500, 40, 18, 0, Math.PI * 2)
      ctx.arc(140 - (s.groundOffset * 0.3) % 500, 32, 14, 0, Math.PI * 2)
      ctx.arc(100 - (s.groundOffset * 0.3) % 500, 34, 12, 0, Math.PI * 2)
      ctx.fill()

      drawGround()
      drawDino(s.dinoY)

      for (const obs of s.obstacles) {
        if (obs.type === 'cactus') drawCactus(obs.x)
        else drawBird(obs.x, obs.y)
      }

      // score
      ctx.fillStyle = '#374151'
      ctx.font = 'bold 18px monospace'
      ctx.fillText(`${Math.floor(s.score)}`, CANVAS_W - 80, 36)
    }

    const update = () => {
      const s = stateRef.current
      if (s.gameOver || !s.started) return

      s.frame++
      s.groundOffset = (s.groundOffset + s.speed) % 40
      s.score += s.speed * 0.15
      s.speed = 4 + Math.floor(s.score / 200) * 0.8

      // dino physics
      if (s.isJumping) {
        s.dinoY += s.dinoVY
        s.dinoVY += GRAVITY
        if (s.dinoY <= 0) {
          s.dinoY = 0
          s.dinoVY = 0
          s.isJumping = false
        }
      }

      // spawn obstacles
      lastSpawn += s.speed
      const spawnGap = Math.max(60, 160 - s.speed * 4)
      if (lastSpawn > spawnGap) {
        lastSpawn = 0
        const type: 'cactus' | 'bird' = Math.random() < 0.7 ? 'cactus' : 'bird'
        if (type === 'cactus') {
          s.obstacles.push({ x: CANVAS_W, type: 'cactus', y: 0, width: 20, height: 30 })
        } else {
          const birdY = GROUND_Y - DINO_H - 10 - Math.random() * 40
          s.obstacles.push({ x: CANVAS_W, type: 'bird', y: birdY, width: 30, height: 14 })
        }
      }

      // move obstacles
      for (const obs of s.obstacles) {
        obs.x -= s.speed
      }
      s.obstacles = s.obstacles.filter(o => o.x > -60)

      // collision detection
      const dinoLeft = DINO_X + 4
      const dinoRight = DINO_X + DINO_W - 4
      const dinoTop = GROUND_Y - DINO_H - s.dinoY
      const dinoBottom = GROUND_Y - s.dinoY

      for (const obs of s.obstacles) {
        const oLeft = obs.x
        const oRight = obs.x + obs.width
        const oTop = obs.type === 'cactus' ? GROUND_Y - obs.height : obs.y
        const oBottom = obs.type === 'cactus' ? GROUND_Y : obs.y + obs.height

        if (
          dinoRight > oLeft + 4 &&
          dinoLeft < oRight - 4 &&
          dinoBottom > oTop + 4 &&
          dinoTop < oBottom - 4
        ) {
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

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        jump()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [jump])

  return (
    <div className="select-none">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full max-w-[640px] rounded-lg border border-border bg-gray-100 dark:bg-gray-800 cursor-pointer mx-auto block"
        onClick={jump}
        onTouchStart={(e) => { e.preventDefault(); jump() }}
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
