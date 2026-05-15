'use client'

import React, { useRef, useEffect } from 'react'

export default function DogFrisbee() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 600, H = 220
    const GROUND = 190
    let frame = 0
    let animId: number

    let groundScroll = 0

    const drawDog = (
      x: number, y: number,
      facingRight: boolean,
      running: boolean,
      crouching: boolean,
      hasFrisbee: boolean,
    ) => {
      ctx.save()
      const dir = facingRight ? 1 : -1

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      ctx.beginPath()
      ctx.ellipse(x, GROUND, 22, 4, 0, 0, Math.PI * 2)
      ctx.fill()

      // Tail — wags when idle, streams back when running
      const tailPhase = frame * 0.45
      let tailX1 = x - 14 * dir
      let tailY1 = y - 12
      let tailX2 = tailX1 - 8 * dir
      let tailY2 = tailY1 - 10

      if (running) {
        tailX2 = tailX1 - 18 * dir
        tailY2 = tailY1 - 6 + Math.sin(tailPhase * 0.6) * 6
      } else {
        tailX2 = tailX1 - 6 * dir + Math.sin(tailPhase) * 12
        tailY2 = tailY1 - 12 - Math.abs(Math.cos(tailPhase)) * 10
      }

      ctx.strokeStyle = '#000'
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(tailX1, tailY1)
      ctx.quadraticCurveTo(tailX1 - 4 * dir, tailY1 - 8, tailX2, tailY2)
      ctx.stroke()

      // Back legs
      const stride = running ? Math.sin(frame * 0.55) * 14 : 0
      const crouchOff = crouching ? 6 : 0

      // Far legs (lighter = gray)
      ctx.fillStyle = '#555'
      // far back
      ctx.fillRect(x - 6 * dir - 3, y - 2 + crouchOff, 7, GROUND - y + 2 - crouchOff)
      ctx.fillRect(x - 6 * dir - 3 + stride * 0.5, GROUND - 4, 7, 8)
      // far front
      ctx.fillRect(x + 8 * dir - 3, y - 2 + crouchOff, 7, GROUND - y + 2 - crouchOff)
      ctx.fillRect(x + 8 * dir - 3 - stride * 0.5, GROUND - 4, 7, 8)

      // Body
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(x, y - 14, 28, 16, 0, 0, Math.PI * 2)
      ctx.fill()

      // Near legs (black)
      ctx.fillStyle = '#000'
      // near back
      ctx.fillRect(x - 6 * dir, y - 2 + crouchOff, 7, GROUND - y + 2 - crouchOff)
      ctx.fillRect(x - 6 * dir - stride * 0.5, GROUND - 4, 7, 9)
      // near front
      ctx.fillRect(x + 8 * dir, y - 2 + crouchOff, 7, GROUND - y + 2 - crouchOff)
      ctx.fillRect(x + 8 * dir + stride * 0.5, GROUND - 4, 7, 9)

      // Neck — angles forward more when crouching
      const neckAngle = crouching ? -0.3 * dir : 0.5 * dir
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(x + 20 * dir, y - 22, 11, 9, neckAngle, 0, Math.PI * 2)
      ctx.fill()

      // Head
      const headCX = x + 28 * dir + (crouching ? -4 * dir : 0)
      const headCY = y - 28 - (crouching ? 4 : 0)
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.arc(headCX, headCY, 12, 0, Math.PI * 2)
      ctx.fill()

      // Snout
      const snoutLen = hasFrisbee ? 14 : 12
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(headCX + (snoutLen * 0.6) * dir, headCY + 2, snoutLen, 7, 0.15 * dir, 0, Math.PI * 2)
      ctx.fill()

      // Nose
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(headCX + snoutLen * dir, headCY + 1, 3.5, 0, Math.PI * 2)
      ctx.fill()

      // Eye — happy squint when running
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      if (running) {
        ctx.arc(headCX + 6 * dir, headCY - 5, 2.5, 0, Math.PI)
      } else {
        ctx.arc(headCX + 6 * dir, headCY - 5, 2.5, 0, Math.PI * 2)
      }
      ctx.fill()

      // Ear — floppy, lifts slightly when jumping
      ctx.fillStyle = '#000'
      ctx.beginPath()
      const earBaseX = headCX - 2 * dir
      const earBaseY = headCY - 2
      ctx.ellipse(earBaseX, earBaseY + 6, 7, 14, 0.3 * dir, 0, Math.PI * 2)
      ctx.fill()

      // Frisbee in mouth (held at snout tip)
      if (hasFrisbee) {
        const fx = headCX + (snoutLen + 2) * dir
        const fy = headCY
        ctx.save()
        ctx.translate(fx, fy)
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, 10, 3, 0.5 * dir, 0, Math.PI * 2)
        ctx.stroke()
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(0, 0, 5, 1.5, 0.5 * dir, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      ctx.restore()
    }

    const drawFrisbee = (fx: number, fy: number, angle: number) => {
      ctx.save()
      ctx.translate(fx, fy)
      ctx.rotate(angle)
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(0, 0, 6, 2, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Easing helpers
    const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

    const render = () => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)

      // Ground line
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, GROUND)
      ctx.lineTo(W, GROUND)
      ctx.stroke()
      // Ground dashes (scroll when running)
      groundScroll += 1.5
      for (let i = -((groundScroll % 24) | 0); i < W + 24; i += 24) {
        ctx.fillRect(i, GROUND + 2, 10, 1)
      }

      const T = 300 // total frames per loop (~5 sec)
      const ph = frame % T

      let dogX = 130, dogY = GROUND - 12
      let frisbeeX = 0, frisbeeY = 0, frisbeeAngle = 0
      let hasFrisbee = false
      let running = false, crouching = false
      let facingRight = true
      let frisbeeVisible = false

      // ── Phase 1: TOSS (0 – 40) ──
      if (ph < 40) {
        const pt = ph / 40
        hasFrisbee = ph < 25
        crouching = ph >= 10 && ph < 25
        frisbeeVisible = ph >= 25
        dogX = 130
        dogY = GROUND - 12

        if (ph >= 25) {
          // Frisbee released, flies up-right
          const ft = (ph - 25) / 15
          const et = easeOut(ft)
          frisbeeX = 160 + et * 180
          frisbeeY = GROUND - 40 - et * 100
          frisbeeAngle = ft * 3
        }
      }

      // ── Phase 2: ANTICIPATE (40 – 55) ──
      else if (ph < 55) {
        const pt = (ph - 40) / 15
        crouching = true
        dogX = 130
        dogY = GROUND - 12
        frisbeeVisible = true
        // Frisbee keeps flying, slowing slightly
        frisbeeX = 340 + pt * 60
        frisbeeY = GROUND - 140 - pt * 30
        frisbeeAngle = 3 + pt * 1.5
      }

      // ── Phase 3: SPRINT (55 – 150) ──
      else if (ph < 150) {
        const pt = (ph - 55) / 95
        const et = easeInOut(pt)
        running = true
        dogX = 130 + et * 280  // 130 → 410
        dogY = GROUND - 12
        frisbeeVisible = true
        // Frisbee arcs ahead of dog, then starts descending
        const arc = Math.sin(pt * Math.PI)
        frisbeeX = 400 + (1 - pt) * 120
        frisbeeY = GROUND - 150 - arc * 110 + pt * 30
        frisbeeAngle = 4 + pt * 2
      }

      // ── Phase 4: JUMP (150 – 175) ──
      else if (ph < 175) {
        const pt = (ph - 150) / 25
        running = false
        frisbeeVisible = pt < 0.7
        const jumpArc = Math.sin(pt * Math.PI)
        dogX = 410 - pt * 10
        dogY = GROUND - 12 - jumpArc * 70
        frisbeeX = 480 - pt * 30
        frisbeeY = GROUND - 60 - jumpArc * 60
        frisbeeAngle = 5
      }

      // ── Phase 5: LAND (175 – 195) ──
      else if (ph < 195) {
        const pt = (ph - 175) / 20
        hasFrisbee = pt > 0.3
        dogX = 400 + pt * 20
        const landBounce = Math.abs(Math.sin(pt * Math.PI * 1.5)) * (1 - pt) * 8
        dogY = GROUND - 12 - landBounce
        frisbeeVisible = !hasFrisbee
      }

      // ── Phase 6: TROT BACK (195 – 270) ──
      else if (ph < 270) {
        const pt = (ph - 195) / 75
        running = true
        hasFrisbee = true
        facingRight = false
        dogX = 420 - pt * 290  // 420 → 130
        dogY = GROUND - 12
        frisbeeVisible = false
      }

      // ── Phase 7: IDLE (270 – 300) ──
      else {
        hasFrisbee = true
        facingRight = true
        dogX = 130
        dogY = GROUND - 12
        frisbeeVisible = false
      }

      if (frisbeeVisible) drawFrisbee(frisbeeX, frisbeeY, frisbeeAngle)
      drawDog(dogX, dogY, facingRight, running, crouching, hasFrisbee)
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
      height={220}
      className="w-full max-w-[600px] rounded-lg border border-black bg-white mx-auto block"
    />
  )
}
