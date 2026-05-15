'use client'

import React, { useRef, useEffect } from 'react'

/* ── Pixel-art dog sprites ──
   22 columns × 18 rows,  '.'=empty  '#'=body  'o'=eye(white)  '~'=frisbee
   All sprites face right.
────────────────────────────────────────── */

const IDLE = [
  '......................',
  '..........####........',
  '.........##oo##.......',
  '........##....##......',
  '.......##.#####......',
  '.......########......',
  '.......########......',
  '......##########.....',
  '.....###########.....',
  '.....###########.....',
  '.....###########.....',
  '......#########......',
  '......##...###.......',
  '......##...##........',
  '......##...##........',
  '......##...##........',
  '......##...##........',
  '......##...##........',
]

const CROUCH = [
  '......................',
  '......................',
  '..........####........',
  '.........##oo##.......',
  '........##....##......',
  '.......##.#####......',
  '.......########......',
  '......##########.....',
  '.....###########.....',
  '....#############....',
  '....#############....',
  '.....###########.....',
  '......##...###.......',
  '......##....##.......',
  '......##....##.......',
  '......##....##.......',
  '......##....##.......',
  '......##....##.......',
]

const RUN1 = [
  '......................',
  '..........####........',
  '.........##oo##.......',
  '........##....##......',
  '.......##.#####......',
  '.......########......',
  '......##########.....',
  '.....###########.....',
  '....#############....',
  '....#############....',
  '.....###########.....',
  '......#########......',
  '.......##.##.........',
  '.......##..##........',
  '......##....##.......',
  '......##.....##......',
  '.......##....##......',
  '........##..##.......',
]

const RUN2 = [
  '......................',
  '..........####........',
  '.........##oo##.......',
  '........##....##......',
  '.......##.#####......',
  '.......########......',
  '......##########.....',
  '.....###########.....',
  '....#############....',
  '....#############....',
  '.....###########.....',
  '......#########......',
  '.....##..##..........',
  '....##...##..........',
  '....##....##.........',
  '....##.....##........',
  '....##......##.......',
  '....##.......##......',
]

const JUMP = [
  '......................',
  '......................',
  '..........####........',
  '.........##oo##.......',
  '........##....##......',
  '.......##.#####......',
  '.......########......',
  '......##########.....',
  '.....###########.....',
  '....#############....',
  '....#############....',
  '.....###########.....',
  '......##########.....',
  '.......##...##.......',
  '........##.##........',
  '........##.##........',
  '.........#####.......',
  '..........###........',
]

// Parse sprite → array of {x,y} for filled pixels
function parseSprite(lines: string[]): { filled: [number,number][], eye: [number,number] } {
  const filled: [number,number][] = []
  let eye: [number,number] = [0,0]
  for (let row = 0; row < lines.length; row++) {
    for (let col = 0; col < lines[row].length; col++) {
      const ch = lines[row][col]
      if (ch === '#' || ch === '~') filled.push([col, row])
      if (ch === 'o') eye = [col, row]
    }
  }
  return { filled, eye }
}

const P = 4 // pixel scale
const SW = 22 // sprite width in cells
const SH = 18 // sprite height in cells
const PW = SW * P // pixel width on canvas
const PH = SH * P // pixel height on canvas

const sprites = {
  idle: parseSprite(IDLE),
  crouch: parseSprite(CROUCH),
  run1: parseSprite(RUN1),
  run2: parseSprite(RUN2),
  jump: parseSprite(JUMP),
}

type PoseKey = keyof typeof sprites

export default function DogFrisbee() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 600, H = 240
    const GROUND = 210
    const CYCLE = 420 // ~7 sec at 60fps
    let frame = 0
    let animId: number

    const drawSprite = (cx: number, cy: number, pose: PoseKey, flip: boolean) => {
      const { filled, eye } = sprites[pose]
      const ox = cx - PW / 2
      const oy = cy - PH + P // bottom-align

      for (const [col, row] of filled) {
        let sx = col
        if (flip) sx = SW - 1 - col
        ctx.fillStyle = '#000'
        ctx.fillRect(ox + sx * P, oy + row * P, P, P)
      }

      // Eye (white pixel)
      let ex = eye[0]
      if (flip) ex = SW - 1 - eye[0]
      ctx.fillStyle = '#fff'
      ctx.fillRect(ox + ex * P, oy + eye[1] * P, P, P)
    }

    const drawFrisbee = (fx: number, fy: number, ang: number) => {
      // Pixel-art frisbee: a small horizontal line with spin
      const pw = 16, ph = 6
      ctx.save()
      ctx.translate(fx, fy)
      ctx.rotate(ang)
      ctx.fillStyle = '#000'
      // frisbee body — two rows of pixels
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(i * 2 - pw/2, -ph/2, 2, 2)
      }
      for (let i = 1; i < 7; i++) {
        ctx.fillRect(i * 2 - pw/2, ph/2 - 2, 2, 2)
      }
      ctx.fillRect(0 - pw/2, 0, pw, 2) // center spine
      ctx.restore()
    }

    const easeInOut = (t: number) => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2
    const easeOut = (t: number) => 1 - Math.pow(1-t, 2)

    const render = () => {
      // Clear
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)

      // Ground
      const scroll = (frame * 2) % 32
      ctx.fillStyle = '#000'
      for (let i = -scroll; i < W + 32; i += 32) {
        ctx.fillRect(i, GROUND + 3, 6, 1)
        ctx.fillRect(i + 14, GROUND + 3, 3, 1)
      }
      ctx.fillRect(0, GROUND, W, 1)

      const ph = frame % CYCLE

      // ── Animation state ──
      let dogX: number, dogY: number
      let pose: PoseKey
      let flip: boolean
      let hasFrisbee: boolean
      let frisbeeX = 0, frisbeeY = 0, frisbeeAng = 0
      let showFrisbee = false

      // ── Phase timeline ──
      const T_IDLE1 = 40    // idle with frisbee
      const T_THROW = 60    // crouch + throw
      const T_WATCH = 90    // watch frisbee fly
      const T_CHASE = 240   // sprint chase
      const T_JUMP = 270    // leap + catch
      const T_RETURN = 370  // trot back
      // 370-420 = idle

      if (ph < T_IDLE1) {
        // Idle, frisbee in mouth
        dogX = 120; dogY = GROUND
        pose = 'idle'; flip = false; hasFrisbee = true
      } else if (ph < T_THROW) {
        // Crouch and toss frisbee
        const pt = (ph - T_IDLE1) / (T_THROW - T_IDLE1)
        dogX = 120; dogY = GROUND
        pose = 'crouch'; flip = false
        hasFrisbee = pt < 0.4

        if (!hasFrisbee) {
          showFrisbee = true
          const ft = (pt - 0.4) / 0.6
          frisbeeX = 160 + ft * 90
          frisbeeY = GROUND - 60 - ft * 90
          frisbeeAng = ft * 4
        }
      } else if (ph < T_WATCH) {
        // Crouch, watch frisbee fly away
        const pt = (ph - T_THROW) / (T_WATCH - T_THROW)
        dogX = 120; dogY = GROUND
        pose = 'crouch'; flip = false; hasFrisbee = false
        showFrisbee = true
        frisbeeX = 250 + pt * 200
        frisbeeY = GROUND - 150 + pt * 30
        frisbeeAng = 4 + pt * 4
      } else if (ph < T_CHASE) {
        // Sprint after frisbee
        const dur = T_CHASE - T_WATCH
        const pt = (ph - T_WATCH) / dur
        const et = easeInOut(pt)
        dogX = 120 + et * 310  // 120 → 430
        dogY = GROUND
        const runFrame = Math.floor(ph / 8) % 2
        pose = (runFrame === 0 ? 'run1' : 'run2') as PoseKey
        flip = false; hasFrisbee = false
        showFrisbee = true

        // Frisbee: high smooth arc, dog chasing underneath
        const fp = pt
        frisbeeX = 450 + (1-fp) * 180
        frisbeeY = GROUND - 120 - Math.sin(fp * Math.PI) * 130
        frisbeeAng = 7 + fp * 5
      } else if (ph < T_JUMP) {
        // Jump up and catch
        const dur = T_JUMP - T_CHASE
        const pt = (ph - T_CHASE) / dur
        const jumpH = Math.sin(pt * Math.PI) * 70
        dogX = 430 - pt * 10
        dogY = GROUND - jumpH
        pose = 'jump'; flip = false
        hasFrisbee = pt > 0.5
        if (!hasFrisbee) {
          showFrisbee = true
          frisbeeX = 500 - pt * 50
          frisbeeY = GROUND - 60 - jumpH * 0.8
          frisbeeAng = 9
        }
      } else if (ph < T_RETURN) {
        // Trot back with frisbee
        const dur = T_RETURN - T_JUMP
        const pt = (ph - T_JUMP) / dur
        dogX = 420 - pt * 300  // → 120
        dogY = GROUND
        const runFrame = Math.floor(ph / 8) % 2
        pose = (runFrame === 0 ? 'run1' : 'run2') as PoseKey
        flip = true; hasFrisbee = true
      } else {
        // Idle with frisbee, rest
        dogX = 120; dogY = GROUND
        pose = 'idle'; flip = false; hasFrisbee = true
      }

      // Draw
      if (showFrisbee) drawFrisbee(frisbeeX, frisbeeY, frisbeeAng)
      drawSprite(dogX, dogY, pose, flip)

      // Frisbee in mouth (overlay on sprite)
      if (hasFrisbee && !showFrisbee) {
        const fx = flip ? dogX - PW/2 + P : dogX + PW/2 + P
        const fy = dogY - PH + 6*P
        drawFrisbee(fx, fy, flip ? 0.3 : -0.3)
      }
    }

    const loop = () => {
      frame++
      render()
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={240}
      className="w-full max-w-[600px] rounded-lg border border-black bg-white mx-auto block"
    />
  )
}
