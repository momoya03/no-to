'use client'

import React, { useRef, useEffect } from 'react'

/*
  Offscreen pixel-art approach:
  1. Draw dog on a tiny 48×32 canvas using proper shapes
  2. Blit to display canvas at 4x with imageSmoothingEnabled=false
  Result: clean pixel art from well-proportioned vector shapes.
*/

type PoseName = 'idle' | 'crouch' | 'run1' | 'run2' | 'jump'

interface Pose {
  bodyX: number; bodyY: number; bodyW: number; bodyH: number
  headX: number; headY: number; headR: number
  snoutX: number; snoutY: number; snoutW: number; snoutH: number
  earX: number; earY: number; earW: number; earH: number
  tailX: number; tailY: number; tailW: number; tailH: number; tailAngle: number
  legBackX: number; legBackY: number
  legFrontX: number; legFrontY: number
  legFarBackX: number; legFarBackY: number
  legFarFrontX: number; legFarFrontY: number
  legW: number; legH: number
}

const SPRITE_W = 48
const SPRITE_H = 32
const SCALE = 4

// ── Pose data (coordinates in 48×32 sprite space) ──
const POSES: Record<PoseName, Pose> = {
  idle: {
    bodyX:20, bodyY:16, bodyW:22, bodyH:10,
    headX:34, headY:10, headR:6,
    snoutX:37, snoutY:9, snoutW:8, snoutH:5,
    earX:28, earY:8, earW:4, earH:11,
    tailX:6, tailY:10, tailW:6, tailH:3, tailAngle:-0.4,
    legBackX:13, legBackY:20,
    legFrontX:25, legFrontY:20,
    legFarBackX:15, legFarBackY:20,
    legFarFrontX:27, legFarFrontY:20,
    legW:4, legH:10,
  },
  crouch: {
    bodyX:20, bodyY:18, bodyW:22, bodyH:11,
    headX:33, headY:13, headR:6,
    snoutX:36, snoutY:12, snoutW:8, snoutH:5,
    earX:27, earY:11, earW:4, earH:11,
    tailX:6, tailY:12, tailW:6, tailH:3, tailAngle:-0.3,
    legBackX:13, legBackY:23,
    legFrontX:25, legFrontY:23,
    legFarBackX:15, legFarBackY:23,
    legFarFrontX:27, legFarFrontY:23,
    legW:4, legH:7,
  },
  run1: {
    bodyX:20, bodyY:15, bodyW:24, bodyH:10,
    headX:34, headY:9, headR:6,
    snoutX:38, snoutY:8, snoutW:9, snoutH:5,
    earX:28, earY:7, earW:4, earH:11,
    tailX:4, tailY:9, tailW:6, tailH:3, tailAngle:-0.3,
    legBackX:10, legBackY:20,
    legFrontX:29, legFrontY:19,
    legFarBackX:12, legFarBackY:20,
    legFarFrontX:31, legFarFrontY:19,
    legW:4, legH:8,
  },
  run2: {
    bodyX:20, bodyY:15, bodyW:24, bodyH:10,
    headX:34, headY:9, headR:6,
    snoutX:38, snoutY:8, snoutW:9, snoutH:5,
    earX:28, earY:7, earW:4, earH:11,
    tailX:4, tailY:9, tailW:6, tailH:3, tailAngle:-0.3,
    legBackX:15, legBackY:19,
    legFrontX:24, legFrontY:20,
    legFarBackX:13, legFarBackY:19,
    legFarFrontX:22, legFarFrontY:20,
    legW:4, legH:8,
  },
  jump: {
    bodyX:20, bodyY:11, bodyW:22, bodyH:10,
    headX:33, headY:4, headR:6,
    snoutX:37, snoutY:3, snoutW:9, snoutH:5,
    earX:28, earY:2, earW:4, earH:11,
    tailX:6, tailY:6, tailW:6, tailH:3, tailAngle:-0.6,
    legBackX:13, legBackY:14,
    legFrontX:27, legFrontY:14,
    legFarBackX:15, legFarBackY:15,
    legFarFrontX:29, legFarFrontY:15,
    legW:4, legH:5,
  },
}

export default function DogFrisbee() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Offscreen sprite canvas (low-res)
    const off = document.createElement('canvas')
    off.width = SPRITE_W
    off.height = SPRITE_H
    const octx = off.getContext('2d')!

    const W = 640, H = 230
    const GROUND = 200
    const CYCLE = 400
    let frame = 0
    let animId: number

    const drawPose = (pose: Pose, hasFrisbee: boolean) => {
      octx.clearRect(0, 0, SPRITE_W, SPRITE_H)
      const g = octx

      // far legs (gray)
      g.fillStyle = '#555'
      g.fillRect(pose.legFarBackX, pose.legFarBackY, pose.legW, pose.legH)
      g.fillRect(pose.legFarFrontX, pose.legFarFrontY, pose.legW, pose.legH)

      // tail
      g.fillStyle = '#000'
      g.save()
      g.translate(pose.tailX, pose.tailY)
      g.rotate(pose.tailAngle)
      g.fillRect(-pose.tailW/2, -pose.tailH/2, pose.tailW, pose.tailH)
      g.restore()
      // tail tip
      g.fillRect(pose.tailX - pose.tailW/2 - 2, pose.tailY - pose.tailH/2 - 2, 3, 3)

      // body
      g.fillStyle = '#000'
      g.beginPath()
      g.ellipse(pose.bodyX, pose.bodyY, pose.bodyW/2, pose.bodyH/2, 0, 0, Math.PI*2)
      g.fill()

      // near legs
      g.fillStyle = '#000'
      g.fillRect(pose.legBackX, pose.legBackY, pose.legW, pose.legH)
      g.fillRect(pose.legFrontX, pose.legFrontY, pose.legW, pose.legH)
      // paws
      g.fillRect(pose.legBackX - 1, pose.legBackY + pose.legH - 2, pose.legW + 2, 3)
      g.fillRect(pose.legFrontX - 1, pose.legFrontY + pose.legH - 2, pose.legW + 2, 3)

      // neck
      g.fillStyle = '#000'
      g.beginPath()
      g.ellipse(pose.bodyX + 10, pose.bodyY - 4, 7, 8, 0.3, 0, Math.PI*2)
      g.fill()

      // ear
      g.fillStyle = '#000'
      g.fillRect(pose.earX, pose.earY, pose.earW, pose.earH)
      // ear rounded bottom
      g.beginPath()
      g.arc(pose.earX + pose.earW/2, pose.earY + pose.earH, pose.earW/2, 0, Math.PI*2)
      g.fill()

      // head
      g.fillStyle = '#000'
      g.beginPath()
      g.arc(pose.headX, pose.headY, pose.headR, 0, Math.PI*2)
      g.fill()

      // snout
      g.fillStyle = '#000'
      g.beginPath()
      g.roundRect(pose.snoutX, pose.snoutY, pose.snoutW, pose.snoutH, 3)
      g.fill()

      // nose
      g.fillStyle = '#fff'
      g.beginPath()
      g.arc(pose.snoutX + pose.snoutW - 2, pose.snoutY + pose.snoutH/2, 2, 0, Math.PI*2)
      g.fill()

      // eye
      g.fillStyle = '#fff'
      g.beginPath()
      g.arc(pose.headX + 2, pose.headY - 1, 2, 0, Math.PI*2)
      g.fill()

      // frisbee in mouth
      if (hasFrisbee) {
        g.fillStyle = '#000'
        const fx = pose.snoutX + pose.snoutW + 2
        const fy = pose.snoutY + pose.snoutH/2 - 1
        g.fillRect(fx, fy, 7, 3)
        g.fillRect(fx + 1, fy - 1, 5, 5)
        g.fillStyle = '#fff'
        g.fillRect(fx + 2, fy, 3, 3)
      }
    }

    const drawFrisbee = (fx: number, fy: number, ang: number) => {
      ctx.save()
      ctx.translate(fx, fy)
      ctx.rotate(ang)
      ctx.fillStyle = '#000'
      ctx.fillRect(-10, -3, 20, 6)
      ctx.fillStyle = '#fff'
      ctx.fillRect(-6, -1, 12, 2)
      ctx.restore()
    }

    const render = () => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)

      // Ground
      ctx.fillStyle = '#000'
      ctx.fillRect(0, GROUND, W, 1)
      const scroll = (frame * 3) % 48
      for (let i = -scroll; i < W + 48; i += 48) {
        ctx.fillRect(i, GROUND + 3, 8, 1)
        ctx.fillRect(i + 20, GROUND + 3, 4, 1)
        ctx.fillRect(i + 32, GROUND + 3, 4, 1)
      }

      const ph = frame % CYCLE
      const spriteW = SPRITE_W * SCALE  // 192
      const spriteH = SPRITE_H * SCALE  // 128

      let dogX = 120, dogY = GROUND
      let poseKey: PoseName = 'idle'
      let flip = false
      let hasFrisbee = false
      let frisbeeX = 0, frisbeeY = 0, frisbeeAng = 0
      let showFrisbee = false

      // ── Animation Phases ──
      if (ph < 45) {
        poseKey = 'idle'; hasFrisbee = true
      } else if (ph < 65) {
        const pt = (ph - 45) / 20
        poseKey = 'crouch'
        hasFrisbee = pt < 0.35
        if (!hasFrisbee) {
          showFrisbee = true
          const ft = (pt - 0.35) / 0.65
          frisbeeX = 170 + ft * 110
          frisbeeY = GROUND - 70 - ft * 70
          frisbeeAng = ft * 3
        }
      } else if (ph < 100) {
        const pt = (ph - 65) / 35
        poseKey = 'crouch'; showFrisbee = true
        frisbeeX = 280 + pt * 210
        frisbeeY = GROUND - 140 + pt * 30
        frisbeeAng = 3 + pt * 3
      } else if (ph < 260) {
        const dur = 160
        const pt = (ph - 100) / dur
        const et = pt < 0.5 ? 2*pt*pt : 1 - Math.pow(-2*pt+2, 2)/2
        dogX = 120 + et * 300
        poseKey = (Math.floor(ph / 6) % 2 === 0 ? 'run1' : 'run2') as PoseName
        showFrisbee = true
        const fp = pt
        frisbeeX = 490 + (1-fp) * 180
        frisbeeY = GROUND - 120 - Math.sin(fp * Math.PI) * 130
        frisbeeAng = 5 + fp * 4
      } else if (ph < 290) {
        const pt = (ph - 260) / 30
        const jh = Math.sin(pt * Math.PI) * 70
        dogX = 420 - pt * 10
        dogY = GROUND - jh
        poseKey = 'jump'
        hasFrisbee = pt > 0.45
        if (!hasFrisbee) {
          showFrisbee = true
          frisbeeX = 490 - pt * 70
          frisbeeY = GROUND - 50 - jh * 0.7
          frisbeeAng = 7
        }
      } else if (ph < 370) {
        const pt = (ph - 290) / 80
        dogX = 410 - pt * 290
        poseKey = (Math.floor(ph / 6) % 2 === 0 ? 'run1' : 'run2') as PoseName
        flip = true; hasFrisbee = true
      } else {
        poseKey = 'idle'; hasFrisbee = true
      }

      // ── Render ──
      if (showFrisbee) drawFrisbee(frisbeeX, frisbeeY, frisbeeAng)

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.beginPath()
      ctx.ellipse(dogX, GROUND, 24, 5, 0, 0, Math.PI*2)
      ctx.fill()

      // Draw dog sprite
      drawPose(POSES[poseKey], hasFrisbee && !showFrisbee)

      ctx.save()
      const sx = dogX - spriteW/2
      const sy = dogY - spriteH
      if (flip) {
        ctx.translate(dogX + spriteW/2, sy)
        ctx.scale(-1, 1)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(off, 0, 0, SPRITE_W, SPRITE_H, 0, 0, spriteW, spriteH)
      } else {
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(off, 0, 0, SPRITE_W, SPRITE_H, sx, sy, spriteW, spriteH)
      }
      ctx.restore()
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
      height={230}
      className="w-full max-w-[640px] rounded-lg border border-black bg-white mx-auto block"
    />
  )
}
