'use client'

import React, { useRef, useEffect } from 'react'

export default function DogFrisbee() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 600, H = 240
    const GROUND = 200
    const CYCLE = 320 // frames (~5.3s at 60fps)
    let frame = 0
    let animId: number

    // ── Draw Golden Retriever silhouette using bezier paths ──
    const drawDog = (
      x: number, y: number,
      facingRight: boolean,
      phase: 'idle' | 'crouch' | 'run' | 'jump',
      hasFrisbee: boolean,
    ) => {
      ctx.save()
      const dir = facingRight ? 1 : -1

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      ctx.beginPath()
      ctx.ellipse(x, GROUND, 20, 4, 0, 0, Math.PI * 2)
      ctx.fill()

      const runStride = phase === 'run' ? Math.sin(frame * 0.5) * 12 : 0
      const crouchSink = phase === 'crouch' ? 5 : 0
      const jumpRise = phase === 'jump' ? Math.sin((frame % CYCLE) * 0.06) * 3 : 0

      const py = y - crouchSink + jumpRise

      // ── Tail ── thick at base, feathery, curved up
      const tailBaseX = x - 18 * dir
      const tailBaseY = py - 10
      const wagPhase = frame * 0.4
      const wag = phase === 'run'
        ? Math.sin(wagPhase * 0.5) * 8
        : Math.sin(wagPhase) * 14

      ctx.strokeStyle = '#000'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(tailBaseX, tailBaseY)
      ctx.quadraticCurveTo(
        tailBaseX - 10 * dir, tailBaseY - 14,
        tailBaseX - 14 * dir + wag, tailBaseY - 28,
      )
      ctx.stroke()
      // tail feathering
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(tailBaseX - 5 * dir, tailBaseY - 8)
      ctx.quadraticCurveTo(
        tailBaseX - 8 * dir, tailBaseY - 20,
        tailBaseX - 8 * dir + wag * 0.7, tailBaseY - 24,
      )
      ctx.stroke()

      // ── Far legs ──
      const drawLeg = (lx: number, offY: number, gray: boolean) => {
        const kneeY = py + 4 + offY
        const footX = gray ? lx + runStride * 0.4 : lx - runStride * 0.4
        ctx.fillStyle = gray ? '#666' : '#000'
        // upper leg
        ctx.beginPath()
        ctx.roundRect(lx - 5, py - 2 + offY, 10, GROUND - py + 2 - offY, 4)
        ctx.fill()
        // paw
        ctx.beginPath()
        ctx.ellipse(footX, GROUND, 7, 5, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      drawLeg(x - 6 * dir, crouchSink - jumpRise, true)   // far back
      drawLeg(x + 8 * dir, crouchSink - jumpRise, true)   // far front

      // ── Body ── a sturdy rectangle with rounded ends
      ctx.fillStyle = '#000'
      ctx.beginPath()
      const bodyL = x - 20 * dir
      const bodyR = x + 20 * dir
      const bodyT = py - 24
      const bodyB = py - 4
      ctx.moveTo(bodyL + 8 * dir, bodyT)
      ctx.lineTo(bodyR - 4 * dir, bodyT)
      ctx.quadraticCurveTo(bodyR, bodyT, bodyR, bodyT + 8)
      ctx.lineTo(bodyR, bodyB - 4)
      ctx.quadraticCurveTo(bodyR, bodyB, bodyR - 4 * dir, bodyB)
      ctx.lineTo(bodyL + 8 * dir, bodyB)
      ctx.quadraticCurveTo(bodyL, bodyB, bodyL, bodyB - 4)
      ctx.lineTo(bodyL, bodyT + 8)
      ctx.quadraticCurveTo(bodyL, bodyT, bodyL + 8 * dir, bodyT)
      ctx.fill()

      // ── Chest (deeper) ──
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(x + 16 * dir, py - 12, 11, 14, 0.2 * dir, 0, Math.PI * 2)
      ctx.fill()

      // ── Near legs ──
      drawLeg(x - 6 * dir, crouchSink - jumpRise, false)  // near back
      drawLeg(x + 8 * dir, crouchSink - jumpRise, false)  // near front

      // ── Neck ── thicker, flows into head
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(x + 18 * dir, py - 24, 14, 13, 0.9 * dir, 0, Math.PI * 2)
      ctx.fill()

      // ── Head ── broad skull, distinct stop
      const headX = x + 28 * dir
      const headY = py - 30
      ctx.fillStyle = '#000'
      ctx.beginPath()
      // skull - broad dome
      ctx.arc(headX, headY - 2, 14, 0, Math.PI * 2)
      ctx.fill()

      // ── Muzzle ── rectangular but rounded, distinct from skull
      const muzzleW = 22
      const muzzleH = 14
      const muzzleX = headX + 8 * dir
      const muzzleY = headY
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.roundRect(muzzleX - muzzleW/2, muzzleY - muzzleH/2, muzzleW, muzzleH, 6)
      ctx.fill()

      // ── Nose ── prominent, at end of muzzle
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(muzzleX + muzzleW/2 * dir - 2 * dir, muzzleY - 1, 4, 0, Math.PI * 2)
      ctx.fill()

      // ── Eye ── almond-shaped
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.ellipse(headX + 8 * dir, headY - 6, 3, 2.5, 0, 0, Math.PI * 2)
      ctx.fill()

      // ── Ear ── the key golden retriever feature: long, hanging, soft
      const earBaseX = headX - 4 * dir
      const earBaseY = headY - 2
      ctx.fillStyle = '#000'
      ctx.beginPath()
      // ear hangs down alongside the head
      ctx.ellipse(earBaseX - 3 * dir, earBaseY + 8, 7, 16, 0.35 * dir, 0, Math.PI * 2)
      ctx.fill()
      // slight wave in the ear
      ctx.beginPath()
      ctx.ellipse(earBaseX - 2 * dir, earBaseY + 14, 5, 8, 0.2 * dir, 0, Math.PI * 2)
      ctx.fill()

      // ── Frisbee in mouth ──
      if (hasFrisbee) {
        const fx = muzzleX + muzzleW/2 * dir + 1 * dir
        const fy = muzzleY - 2
        ctx.save()
        ctx.translate(fx, fy)
        ctx.rotate(-0.4 * dir)
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      ctx.restore()
    }

    // ── Draw frisbee in flight ──
    const drawFrisbee = (fx: number, fy: number, angle: number) => {
      ctx.save()
      ctx.translate(fx, fy)
      ctx.rotate(angle)
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    const render = () => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)

      // Ground
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, GROUND)
      ctx.lineTo(W, GROUND)
      ctx.stroke()

      // Scrolling ground dots
      const scroll = (frame * 2) % 28
      for (let i = -scroll; i < W + 28; i += 28) {
        ctx.fillRect(i, GROUND + 3, 6, 1)
        ctx.fillRect(i + 14, GROUND + 3, 3, 1)
      }

      const ph = frame % CYCLE

      // ── Continuous frisbee trajectory ──
      // The frisbee is either: in dog's mouth, being thrown, flying, caught
      const throwStart = 18    // frame when throw begins
      const throwEnd = 28      // frisbee leaves mouth
      const catchStart = 175   // dog jumps, frisbee near mouth
      const catchEnd = 188     // frisbee in mouth

      let dogX: number, dogY: number
      let phase: 'idle' | 'crouch' | 'run' | 'jump'
      let hasFrisbee: boolean
      let facingRight: boolean
      let frisbeeFree = false
      let frisbeeFX = 0, frisbeeFY = 0, frisbeeAng = 0

      // ── STATE MACHINE ──

      if (ph < throwStart) {
        // IDLE — dog stands with frisbee
        dogX = 140; dogY = GROUND - 8
        phase = 'idle'; hasFrisbee = true; facingRight = true
      } else if (ph < throwEnd) {
        // THROW — dog crouches and tosses head
        const pt = (ph - throwStart) / (throwEnd - throwStart)
        dogX = 140; dogY = GROUND - 8
        phase = 'crouch'; hasFrisbee = pt < 0.5; facingRight = true
        if (!hasFrisbee) {
          frisbeeFree = true
          // frisbee starts from dog's mouth and arcs forward-up
          const ft = (pt - 0.5) * 2
          frisbeeFX = 176 + ft * 60
          frisbeeFY = GROUND - 48 - ft * 100
          frisbeeAng = ft * 4
        }
      } else if (ph < 60) {
        // ANTICIPATE — dog crouches, watches frisbee
        const pt = (ph - throwEnd) / (60 - throwEnd)
        dogX = 140; dogY = GROUND - 8
        phase = 'crouch'; hasFrisbee = false; facingRight = true
        frisbeeFree = true
        frisbeeFX = 236 + pt * 150
        frisbeeFY = GROUND - 148 + pt * 20
        frisbeeAng = 4 + pt * 3
      } else if (ph < catchStart) {
        // RUN — dog sprints after frisbee
        const runLen = catchStart - 60
        const pt = (ph - 60) / runLen
        const et = pt < 0.5
          ? 2 * pt * pt
          : 1 - Math.pow(-2 * pt + 2, 2) / 2 // easeInOut
        phase = 'run'; hasFrisbee = false; facingRight = true
        dogX = 140 + et * 280  // 140 → 420
        dogY = GROUND - 8

        // Frisbee: single smooth parabola ahead of dog
        frisbeeFree = true
        const fp = pt  // 0→1 progress of frisbee arc
        frisbeeFX = 386 + fp * 130 - fp * fp * 80  // rises then falls slightly
        frisbeeFY = GROUND - 148 - Math.sin(fp * Math.PI) * 130
        frisbeeAng = 5 + fp * 4
      } else if (ph < catchEnd) {
        // JUMP & CATCH
        const pt = (ph - catchStart) / (catchEnd - catchStart)
        phase = 'jump'; hasFrisbee = pt > 0.55; facingRight = true
        const jumpArc = Math.sin(pt * Math.PI)
        dogX = 420 - pt * 15
        dogY = GROUND - 8 - jumpArc * 65

        if (!hasFrisbee) {
          frisbeeFree = true
          frisbeeFX = 476 - pt * 30
          frisbeeFY = GROUND - 52 - jumpArc * 48
          frisbeeAng = 7
        }
      } else if (ph < 260) {
        // TROT BACK — proudly carrying frisbee
        const pt = (ph - catchEnd) / (260 - catchEnd)
        phase = 'run'; hasFrisbee = true; facingRight = false
        dogX = 405 - pt * 265  // 405 → 140
        dogY = GROUND - 8
      } else {
        // IDLE — rest before next cycle
        dogX = 140; dogY = GROUND - 8
        phase = 'idle'; hasFrisbee = true; facingRight = true
      }

      if (frisbeeFree) drawFrisbee(frisbeeFX, frisbeeFY, frisbeeAng)
      drawDog(dogX, dogY, facingRight, phase, hasFrisbee)
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
