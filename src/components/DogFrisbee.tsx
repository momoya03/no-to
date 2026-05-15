'use client'

import React, { useRef, useEffect } from 'react'

export default function DogFrisbee() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 640, H = 220
    const GROUND = 190
    const CYCLE = 390
    let frame = 0
    let animId: number

    // little bounce helper
    const bounce = (t: number) => Math.sin(t * Math.PI)

    const render = () => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)

      // Ground
      ctx.fillStyle = '#ddd'
      ctx.fillRect(0, GROUND, W, 2)
      const scroll = (frame * 3) % 40
      ctx.fillStyle = '#ccc'
      for (let i = -scroll; i < W + 40; i += 40) {
        ctx.fillRect(i, GROUND + 4, 12, 1)
        ctx.fillRect(i + 20, GROUND + 4, 6, 1)
      }

      const ph = frame % CYCLE
      const dogSize = 52
      const frisbeeSize = 28

      let dogX = 120, dogY = GROUND
      let frisbeeX = 0, frisbeeY = 0
      let showFrisbee = false
      let hasFrisbee = false

      // ── Timeline ──
      if (ph < 40) {
        // idle with frisbee
        hasFrisbee = true
      } else if (ph < 58) {
        // toss
        const pt = (ph - 40) / 18
        hasFrisbee = pt < 0.35
        if (!hasFrisbee) {
          showFrisbee = true
          const ft = (pt - 0.35) / 0.65
          frisbeeX = 165 + ft * 100
          frisbeeY = GROUND - 50 - ft * 60
        }
      } else if (ph < 90) {
        // watch frisbee
        const pt = (ph - 58) / 32
        showFrisbee = true
        frisbeeX = 265 + pt * 200
        frisbeeY = GROUND - 110 + pt * 20
        // slight crouch
        dogY = GROUND + 6
      } else if (ph < 235) {
        // chase
        const dur = 145
        const pt = (ph - 90) / dur
        const et = pt < 0.5 ? 2*pt*pt : 1 - Math.pow(-2*pt+2,2)/2
        dogX = 120 + et * 310
        dogY = GROUND + Math.abs(Math.sin(ph * 0.35)) * 4 // run bob
        showFrisbee = true
        const fp = pt
        frisbeeX = 465 + (1-fp) * 160
        frisbeeY = GROUND - 90 - bounce(fp) * 110
      } else if (ph < 265) {
        // jump catch
        const pt = (ph - 235) / 30
        const jh = bounce(pt) * 65
        dogX = 430 - pt * 15
        dogY = GROUND - jh
        hasFrisbee = pt > 0.45
        if (!hasFrisbee) {
          showFrisbee = true
          frisbeeX = 490 - pt * 60
          frisbeeY = GROUND - 45 - jh * 0.6
        }
      } else if (ph < 360) {
        // trot back
        const pt = (ph - 265) / 95
        dogX = 415 - pt * 295
        dogY = GROUND + Math.abs(Math.sin(ph * 0.35)) * 4
        hasFrisbee = true
      } else {
        hasFrisbee = true
      }

      // ── Draw frisbee ──
      if (showFrisbee) {
        ctx.font = `${frisbeeSize}px serif`
        ctx.textAlign = 'center'
        ctx.fillText('🥏', frisbeeX, frisbeeY)
      }

      // ── Draw dog ──
      ctx.font = `${dogSize}px serif`
      ctx.textAlign = 'center'

      // Flip when facing left (trot back)
      if (ph >= 265 && ph < 360) {
        ctx.save()
        ctx.translate(dogX, dogY - 3)
        ctx.scale(-1, 1)
        ctx.fillText('🐕', 0, 0)
        ctx.restore()
      } else {
        ctx.fillText('🐕', dogX, dogY - 3)
      }

      // Frisbee in mouth overlay
      if (hasFrisbee && !showFrisbee) {
        ctx.font = `${frisbeeSize}px serif`
        const fx = (ph >= 265 && ph < 360) ? dogX - 28 : dogX + 28
        ctx.fillText('🥏', fx, dogY - 20)
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.beginPath()
      ctx.ellipse(dogX, GROUND, 18, 4, 0, 0, Math.PI*2)
      ctx.fill()
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
      height={220}
      className="w-full max-w-[640px] rounded-lg border border-gray-200 bg-white mx-auto block"
    />
  )
}
