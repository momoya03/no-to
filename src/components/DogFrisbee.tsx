'use client'

import React, { useRef, useEffect } from 'react'

/* ── Dog built from solid pixel blocks ──
   Grid: 24×16, rendered at 3x → 72×48 px on screen.
   Every part is a filled rectangle — guaranteed to connect.
   Dog faces RIGHT.                                            */

type Part = { x: number; y: number; w: number; h: number }

interface Pose {
  body: Part       // main torso
  head: Part       // skull
  snout: Part      // muzzle
  ear: Part        // floppy ear, hangs from head
  neck: Part       // connects head to body
  tail: Part       // at rear of body, overlaps body
  tailTip: Part    // tip pixel
  legFB: Part      // far back
  legFF: Part      // far front
  legNB: Part      // near back
  legNF: Part      // near front
  eye: [number, number]
  nose: [number, number]
}

const GRID_W = 24, GRID_H = 16
const PX = 3 // pixel scale → 72×48 on screen

/* ── Pose definitions (grid coords, facing right) ── */

// head+ear overlap: head.x = ear.x+ear.w-1
// tail+body overlap: tail.x+tail.w-1 = body.x
// neck bridges head bottom to body top
const IDLE: Pose = {
  body:   { x:6,  y:7,  w:13, h:5 },
  head:   { x:13, y:1,  w:7,  h:5 },
  snout:  { x:19, y:2,  w:4,  h:3 },
  ear:    { x:10, y:2,  w:4,  h:9 },
  neck:   { x:13, y:5,  w:5,  h:3 },
  tail:   { x:1,  y:5,  w:6,  h:3 },
  tailTip:{ x:0,  y:3,  w:2,  h:2 },
  legFB:  { x:8,  y:12, w:2,  h:4 },
  legFF:  { x:16, y:12, w:2,  h:4 },
  legNB:  { x:7,  y:12, w:2,  h:4 },
  legNF:  { x:15, y:12, w:2,  h:4 },
  eye:    [15, 3],
  nose:   [22, 2],
}

const CROUCH: Pose = {
  body:   { x:6,  y:8,  w:13, h:5 },
  head:   { x:13, y:4,  w:7,  h:5 },
  snout:  { x:19, y:5,  w:4,  h:3 },
  ear:    { x:10, y:5,  w:4,  h:8 },
  neck:   { x:13, y:8,  w:5,  h:2 },
  tail:   { x:1,  y:6,  w:6,  h:3 },
  tailTip:{ x:0,  y:4,  w:2,  h:2 },
  legFB:  { x:8,  y:13, w:2,  h:3 },
  legFF:  { x:16, y:13, w:2,  h:3 },
  legNB:  { x:7,  y:13, w:2,  h:3 },
  legNF:  { x:15, y:13, w:2,  h:3 },
  eye:    [15, 6],
  nose:   [22, 5],
}

const RUN1: Pose = {
  body:   { x:6,  y:6,  w:14, h:5 },
  head:   { x:14, y:1,  w:7,  h:5 },
  snout:  { x:20, y:2,  w:4,  h:3 },
  ear:    { x:11, y:2,  w:4,  h:9 },
  neck:   { x:14, y:5,  w:5,  h:3 },
  tail:   { x:1,  y:4,  w:6,  h:3 },
  tailTip:{ x:0,  y:2,  w:2,  h:2 },
  legFB:  { x:8,  y:11, w:2,  h:4 },
  legFF:  { x:17, y:11, w:2,  h:4 },
  legNB:  { x:5,  y:11, w:2,  h:5 },
  legNF:  { x:14, y:11, w:2,  h:5 },
  eye:    [16, 3],
  nose:   [23, 2],
}

const RUN2: Pose = {
  body:   { x:6,  y:6,  w:14, h:5 },
  head:   { x:14, y:1,  w:7,  h:5 },
  snout:  { x:20, y:2,  w:4,  h:3 },
  ear:    { x:11, y:2,  w:4,  h:9 },
  neck:   { x:14, y:5,  w:5,  h:3 },
  tail:   { x:1,  y:4,  w:6,  h:3 },
  tailTip:{ x:0,  y:2,  w:2,  h:2 },
  legFB:  { x:8,  y:11, w:2,  h:5 },
  legFF:  { x:17, y:11, w:2,  h:5 },
  legNB:  { x:10, y:11, w:2,  h:4 },
  legNF:  { x:15, y:11, w:2,  h:4 },
  eye:    [16, 3],
  nose:   [23, 2],
}

const JUMP: Pose = {
  body:   { x:6,  y:3,  w:13, h:5 },
  head:   { x:13, y:-1, w:7,  h:5 },
  snout:  { x:19, y:0,  w:4,  h:3 },
  ear:    { x:10, y:0,  w:4,  h:9 },
  neck:   { x:13, y:3,  w:5,  h:2 },
  tail:   { x:1,  y:2,  w:6,  h:3 },
  tailTip:{ x:0,  y:0,  w:2,  h:2 },
  legFB:  { x:8,  y:8,  w:2,  h:3 },
  legFF:  { x:17, y:8,  w:2,  h:3 },
  legNB:  { x:7,  y:8,  w:2,  h:4 },
  legNF:  { x:16, y:8,  w:2,  h:3 },
  eye:    [15, 1],
  nose:   [22, 0],
}

const POSES: Record<string, Pose> = { idle: IDLE, crouch: CROUCH, run1: RUN1, run2: RUN2, jump: JUMP }
type PoseKey = keyof typeof POSES

// ── Render pose to offscreen canvas ──
function renderPose(offCtx: CanvasRenderingContext2D, pose: Pose, hasFrisbee: boolean) {
  offCtx.clearRect(0, 0, GRID_W * PX, GRID_H * PX)

  const fill = (p: Part, color: string) => {
    offCtx.fillStyle = color
    offCtx.fillRect(p.x * PX, p.y * PX, p.w * PX, p.h * PX)
  }

  // Far legs (gray)
  fill(pose.legFB, '#666')
  fill(pose.legFF, '#666')

  // Tail
  fill(pose.tail, '#000')
  fill(pose.tailTip, '#000')

  // Body
  fill(pose.body, '#000')

  // Ear
  fill(pose.ear, '#000')

  // Neck
  fill(pose.neck, '#000')

  // Near legs
  fill(pose.legNB, '#000')
  fill(pose.legNF, '#000')

  // Head
  fill(pose.head, '#000')

  // Snout
  fill(pose.snout, '#000')

  // Frisbee in mouth
  if (hasFrisbee) {
    const fx = (pose.snout.x + pose.snout.w) * PX
    const fy = (pose.snout.y + 1) * PX
    offCtx.fillStyle = '#000'
    offCtx.fillRect(fx, fy, 7 * PX / 4, 3 * PX / 2)
    offCtx.fillRect(fx + 1 * PX / 4, fy - 1 * PX / 4, 5 * PX / 4, 5 * PX / 4)
    offCtx.fillStyle = '#fff'
    offCtx.fillRect(fx + 1 * PX / 2, fy + 1 * PX / 2, 3 * PX / 4, 2 * PX / 2)
  }

  // Eye (white)
  offCtx.fillStyle = '#fff'
  offCtx.fillRect(pose.eye[0] * PX, pose.eye[1] * PX, PX, PX)

  // Nose (white)
  offCtx.fillStyle = '#fff'
  offCtx.fillRect(pose.nose[0] * PX, pose.nose[1] * PX, PX, PX)
}

const SW = GRID_W * PX  // 72
const SH = GRID_H * PX  // 48

export default function DogFrisbee() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Offscreen canvas for sprite rendering
    const off = document.createElement('canvas')
    off.width = SW
    off.height = SH
    const octx = off.getContext('2d')!

    const W = 640, H = 200
    const GROUND = 180
    const CYCLE = 400
    let frame = 0
    let animId: number

    const drawFrisbee = (fx: number, fy: number, ang: number) => {
      ctx.save()
      ctx.translate(fx, fy)
      ctx.rotate(ang)
      ctx.fillStyle = '#000'
      ctx.fillRect(-9, -2, 18, 4)
      ctx.fillStyle = '#fff'
      ctx.fillRect(-5, -1, 10, 2)
      ctx.restore()
    }

    const render = () => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)

      // Ground
      ctx.fillStyle = '#000'
      ctx.fillRect(0, GROUND, W, 1)
      const scroll = (frame * 2.5) % 40
      for (let i = -scroll; i < W + 40; i += 40) {
        ctx.fillRect(i, GROUND + 3, 6, 1)
        ctx.fillRect(i + 16, GROUND + 3, 3, 1)
        ctx.fillRect(i + 28, GROUND + 3, 4, 1)
      }

      const ph = frame % CYCLE

      let dogX = 100, dogY = GROUND
      let poseKey: PoseKey = 'idle'
      let flip = false
      let hasFrisbee = false
      let frisbeeX = 0, frisbeeY = 0, frisbeeAng = 0
      let showFrisbee = false

      // ── Timeline ──
      if (ph < 40) {
        poseKey = 'idle'; hasFrisbee = true
      } else if (ph < 60) {
        const pt = (ph - 40) / 20
        poseKey = 'crouch'
        hasFrisbee = pt < 0.4
        if (!hasFrisbee) {
          showFrisbee = true
          const ft = (pt - 0.4) / 0.6
          frisbeeX = 155 + ft * 100
          frisbeeY = GROUND - 65 - ft * 55
          frisbeeAng = ft * 2.5
        }
      } else if (ph < 95) {
        const pt = (ph - 60) / 35
        poseKey = 'crouch'; showFrisbee = true
        frisbeeX = 255 + pt * 200
        frisbeeY = GROUND - 120 + pt * 25
        frisbeeAng = 2.5 + pt * 2.5
      } else if (ph < 255) {
        const dur = 160
        const pt = (ph - 95) / dur
        const et = pt < 0.5 ? 2*pt*pt : 1 - Math.pow(-2*pt+2,2)/2
        dogX = 100 + et * 310
        poseKey = (Math.floor(ph / 6) % 2 === 0 ? 'run1' : 'run2') as PoseKey
        showFrisbee = true
        const fp = pt
        frisbeeX = 455 + (1-fp) * 160
        frisbeeY = GROUND - 105 - Math.sin(fp * Math.PI) * 115
        frisbeeAng = 5 + fp * 4
      } else if (ph < 285) {
        const pt = (ph - 255) / 30
        const jh = Math.sin(pt * Math.PI) * 65
        dogX = 410 - pt * 10
        dogY = GROUND - jh
        poseKey = 'jump'
        hasFrisbee = pt > 0.5
        if (!hasFrisbee) {
          showFrisbee = true
          frisbeeX = 480 - pt * 70
          frisbeeY = GROUND - 50 - jh * 0.6
          frisbeeAng = 6
        }
      } else if (ph < 370) {
        const pt = (ph - 285) / 85
        dogX = 400 - pt * 300
        poseKey = (Math.floor(ph / 6) % 2 === 0 ? 'run1' : 'run2') as PoseKey
        flip = true; hasFrisbee = true
      } else {
        poseKey = 'idle'; hasFrisbee = true
      }

      // ── Draw ──
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.beginPath()
      ctx.ellipse(dogX, GROUND, 16, 3, 0, 0, Math.PI*2)
      ctx.fill()

      // Frisbee
      if (showFrisbee) drawFrisbee(frisbeeX, frisbeeY, frisbeeAng)

      // Dog sprite
      renderPose(octx, POSES[poseKey], hasFrisbee && !showFrisbee)
      ctx.imageSmoothingEnabled = false

      if (flip) {
        ctx.save()
        ctx.translate(dogX + SW/2, dogY - SH)
        ctx.scale(-1, 1)
        ctx.drawImage(off, 0, 0)
        ctx.restore()
      } else {
        ctx.drawImage(off, dogX - SW/2, dogY - SH)
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
      height={200}
      className="w-full max-w-[640px] rounded-lg border border-black bg-white mx-auto block"
    />
  )
}
