'use client'

import React, { useRef, useEffect } from 'react'

/*
  Pixel-art dog built from body-part blocks.
  Each part = { x, y, w, h } in a 28×22 grid.
  Rendered at P=3 → 84×66 px on screen.
  Dog faces RIGHT.
*/

const P = 3
const GW = 28 // grid columns
const GH = 22 // grid rows

type Part = { x: number; y: number; w: number; h: number; gray?: boolean }

interface Pose {
  head: Part
  snout: Part
  ear: Part
  neck: Part
  body: Part
  hindFar: Part
  hindNear: Part
  frontFar: Part
  frontNear: Part
  tail: Part
  eye: { x: number; y: number }
}

// ── Pose definitions (grid coords) ──

const IDLE: Pose = {
  head:    { x:16, y:2,  w:6, h:5 },
  snout:   { x:21, y:4,  w:5, h:3 },
  ear:     { x:13, y:2,  w:3, h:9 },
  neck:    { x:14, y:6,  w:4, h:3 },
  body:    { x:5,  y:8,  w:14,h:6 },
  hindFar: { x:7,  y:13, w:2, h:8, gray:true },
  hindNear:{ x:6,  y:13, w:2, h:9 },
  frontFar:{ x:15, y:13, w:2, h:8, gray:true },
  frontNear:{x:14, y:13, w:2, h:9 },
  tail:    { x:0,  y:3,  w:5, h:2 },
  eye:     { x:18, y:4 },
}

const CROUCH: Pose = {
  head:    { x:16, y:4,  w:6, h:5 },
  snout:   { x:21, y:6,  w:5, h:3 },
  ear:     { x:13, y:4,  w:3, h:9 },
  neck:    { x:14, y:8,  w:4, h:2 },
  body:    { x:5,  y:9,  w:14,h:7 },
  hindFar: { x:7,  y:15, w:2, h:6, gray:true },
  hindNear:{ x:6,  y:15, w:2, h:7 },
  frontFar:{ x:15, y:15, w:2, h:6, gray:true },
  frontNear:{x:14, y:15, w:2, h:7 },
  tail:    { x:0,  y:5,  w:5, h:2 },
  eye:     { x:18, y:6 },
}

const RUN1: Pose = {
  head:    { x:16, y:2,  w:6, h:5 },
  snout:   { x:21, y:4,  w:5, h:3 },
  ear:     { x:13, y:2,  w:3, h:9 },
  neck:    { x:14, y:6,  w:4, h:3 },
  body:    { x:5,  y:8,  w:14,h:6 },
  hindFar: { x:7,  y:13, w:2, h:6, gray:true },
  hindNear:{ x:5,  y:13, w:2, h:8 },
  frontFar:{ x:17, y:13, w:2, h:4, gray:true },
  frontNear:{x:13, y:13, w:2, h:7 },
  tail:    { x:0,  y:3,  w:5, h:2 },
  eye:     { x:18, y:4 },
}

const RUN2: Pose = {
  head:    { x:16, y:2,  w:6, h:5 },
  snout:   { x:21, y:4,  w:5, h:3 },
  ear:     { x:13, y:2,  w:3, h:9 },
  neck:    { x:14, y:6,  w:4, h:3 },
  body:    { x:5,  y:8,  w:14,h:6 },
  hindFar: { x:7,  y:13, w:2, h:4, gray:true },
  hindNear:{ x:8,  y:13, w:2, h:7 },
  frontFar:{ x:13, y:13, w:2, h:6, gray:true },
  frontNear:{x:15, y:13, w:2, h:8 },
  tail:    { x:0,  y:3,  w:5, h:2 },
  eye:     { x:18, y:4 },
}

const JUMP: Pose = {
  head:    { x:16, y:1,  w:6, h:5 },
  snout:   { x:21, y:3,  w:5, h:3 },
  ear:     { x:13, y:1,  w:3, h:9 },
  neck:    { x:14, y:5,  w:4, h:3 },
  body:    { x:5,  y:7,  w:14,h:6 },
  hindFar: { x:7,  y:8,  w:2, h:4, gray:true },
  hindNear:{ x:6,  y:8,  w:2, h:5 },
  frontFar:{ x:15, y:8,  w:2, h:4, gray:true },
  frontNear:{x:14, y:8,  w:2, h:5 },
  tail:    { x:0,  y:2,  w:5, h:2 },
  eye:     { x:18, y:3 },
}

const poses: Record<string, Pose> = { idle: IDLE, crouch: CROUCH, run1: RUN1, run2: RUN2, jump: JUMP }
type PoseKey = keyof typeof poses

// Expand pose → array of pixel coords
function poseToPixels(pose: Pose, flip: boolean): { filled: [number,number][], eye: [number,number] } {
  const filled: [number,number][] = []

  const add = (p: Part) => {
    for (let dy = 0; dy < p.h; dy++) {
      for (let dx = 0; dx < p.w; dx++) {
        let cx = p.x + dx
        if (flip) cx = GW - 1 - cx
        filled.push([cx, p.y + dy])
      }
    }
  }

  // Tail (further detail: draw as two segments)
  const t = pose.tail
  for (let dy = 0; dy < t.h; dy++) {
    for (let dx = 0; dx < t.w; dx++) {
      let cx = t.x + dx
      if (flip) cx = GW - 1 - cx
      filled.push([cx, t.y + dy])
    }
  }
  // tail tip (one extra pixel up)
  const tipX = flip ? GW - 1 - (t.x + 1) : t.x + 1
  filled.push([tipX, t.y - 1])

  add(pose.hindFar)
  add(pose.hindNear)
  add(pose.frontFar)
  add(pose.frontNear)
  add(pose.body)
  add(pose.neck)
  add(pose.ear)
  add(pose.head)
  add(pose.snout)

  let ex = pose.eye.x, ey = pose.eye.y
  if (flip) ex = GW - 1 - ex
  return { filled, eye: [ex, ey] }
}

const PW = GW * P
const PH = GH * P

export default function DogFrisbee() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 640, H = 250
    const GROUND = 222
    const CYCLE = 420
    let frame = 0
    let animId: number

    const drawPixel = (x: number, y: number, s: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(x, y, s, s)
    }

    const drawDog = (cx: number, cy: number, key: PoseKey, flip: boolean) => {
      const { filled, eye } = poseToPixels(poses[key], flip)
      const ox = cx - PW/2
      const oy = cy - PH

      for (const [gx, gy] of filled) {
        drawPixel(ox + gx * P, oy + gy * P, P, '#000')
      }
      // eye — white pixel
      drawPixel(ox + eye[0] * P, oy + eye[1] * P, P, '#fff')
    }

    const drawFrisbee = (fx: number, fy: number) => {
      // simple pixel-art disc
      const hw = 10, hh = 3
      ctx.fillStyle = '#000'
      for (let dx = -hw; dx <= hw; dx += 2) {
        ctx.fillRect(fx + dx, fy - hh, 2, 2)
      }
      for (let dx = -hw; dx <= hw; dx += 2) {
        ctx.fillRect(fx + dx, fy + hh - 2, 2, 2)
      }
      ctx.fillRect(fx - hw, fy, hw * 2, 2)
    }

    const render = () => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)

      // Ground
      ctx.fillStyle = '#000'
      ctx.fillRect(0, GROUND, W, 1)
      const scroll = (frame * 2.5) % 36
      for (let i = -scroll; i < W + 36; i += 36) {
        ctx.fillRect(i, GROUND + 3, 8, 1)
        ctx.fillRect(i + 18, GROUND + 3, 4, 1)
      }

      const ph = frame % CYCLE

      let dogX = 130, dogY = GROUND
      let pose: PoseKey = 'idle'
      let flip = false
      let hasFrisbee = false
      let frisbeeX = 0, frisbeeY = 0
      let showFrisbee = false

      // ── Timeline ──
      if (ph < 40) {
        // IDLE — dog stands with frisbee in mouth
        pose = 'idle'; hasFrisbee = true
      } else if (ph < 60) {
        // THROW — crouch, toss frisbee
        const pt = (ph - 40) / 20
        pose = 'crouch'
        hasFrisbee = pt < 0.35
        if (!hasFrisbee) {
          showFrisbee = true
          const ft = (pt - 0.35) / 0.65
          frisbeeX = 180 + ft * 100
          frisbeeY = GROUND - 70 - ft * 90
        }
      } else if (ph < 95) {
        // WATCH — crouch, frisbee flies away
        const pt = (ph - 60) / 35
        pose = 'crouch'; hasFrisbee = false; showFrisbee = true
        frisbeeX = 280 + pt * 220
        frisbeeY = GROUND - 160 + pt * 35
      } else if (ph < 250) {
        // CHASE — sprinting
        const dur = 155
        const pt = (ph - 95) / dur
        const et = pt < 0.5 ? 2*pt*pt : 1 - Math.pow(-2*pt+2,2)/2
        dogX = 130 + et * 330
        pose = (Math.floor(ph / 7) % 2 === 0 ? 'run1' : 'run2') as PoseKey
        hasFrisbee = false; showFrisbee = true
        const fp = pt
        frisbeeX = 500 + (1-fp) * 190
        frisbeeY = GROUND - 130 - Math.sin(fp * Math.PI) * 140
      } else if (ph < 280) {
        // JUMP + CATCH
        const pt = (ph - 250) / 30
        pose = 'jump'
        const jh = Math.sin(pt * Math.PI) * 75
        dogY = GROUND - jh
        dogX = 460 - pt * 15
        hasFrisbee = pt > 0.45
        if (!hasFrisbee) {
          showFrisbee = true
          frisbeeX = 520 - pt * 50
          frisbeeY = GROUND - 65 - jh * 0.7
        }
      } else if (ph < 380) {
        // TROT BACK
        const pt = (ph - 280) / 100
        dogX = 445 - pt * 315
        pose = (Math.floor(ph / 7) % 2 === 0 ? 'run1' : 'run2') as PoseKey
        flip = true; hasFrisbee = true
      } else {
        // IDLE rest
        pose = 'idle'; hasFrisbee = true
      }

      if (showFrisbee) drawFrisbee(frisbeeX, frisbeeY)
      drawDog(dogX, dogY, pose, flip)

      // Frisbee in mouth overlay
      if (hasFrisbee && !showFrisbee) {
        const fx = flip ? dogX - PW/2 + 2*P : dogX + PW/2 + 2*P
        const fy = dogY - PH + 6*P
        drawFrisbee(fx, fy)
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
      width={640}
      height={250}
      className="w-full max-w-[640px] rounded-lg border border-black bg-white mx-auto block"
    />
  )
}
