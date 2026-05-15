'use client'

import React, { useRef, useEffect } from 'react'

export default function DogFrisbee() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 560, H = 200
    const GROUND = 170
    let frame = 0
    let animId: number

    const drawDog = (x: number, y: number, facingRight: boolean, running: boolean, jumping: boolean) => {
      ctx.save()
      const dir = facingRight ? 1 : -1

      // tail — wagging
      const tailWag = Math.sin(frame * 0.5) * 15
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x - 18 * dir, y - 14)
      ctx.quadraticCurveTo(x - 28 * dir, y - 26, x - 28 * dir + tailWag, y - 42)
      ctx.stroke()

      // back leg (far)
      const legSwing = running ? Math.sin(frame * 0.8) * 10 : 0
      ctx.fillStyle = '#555'
      ctx.fillRect(x - 8 * dir - 3, y - 2, 7, GROUND - y + 2)
      ctx.fillRect(x - 8 * dir - 3, GROUND - 4, 7, 6 + (running ? Math.abs(legSwing) : 0))

      // front leg (far)
      ctx.fillStyle = '#555'
      ctx.fillRect(x + 6 * dir - 3, y - 2, 7, GROUND - y + 2)
      ctx.fillRect(x + 6 * dir - 3, GROUND - 4, 7, 6 + (running ? Math.abs(-legSwing) : 0))

      // body
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(x, y - 14, 26, 15, 0, 0, Math.PI * 2)
      ctx.fill()

      // chest fluff
      ctx.fillStyle = '#222'
      ctx.beginPath()
      ctx.ellipse(x + 14 * dir, y - 8, 10, 12, 0.3 * dir, 0, Math.PI * 2)
      ctx.fill()

      // back leg (near)
      ctx.fillStyle = '#000'
      ctx.fillRect(x - 8 * dir, y - 2, 7, GROUND - y + 2)
      ctx.fillRect(x - 8 * dir, GROUND - 4, 7, 8 + (running ? Math.abs(-legSwing) : 0))

      // front leg (near)
      ctx.fillStyle = '#000'
      ctx.fillRect(x + 6 * dir, y - 2, 7, GROUND - y + 2)
      ctx.fillRect(x + 6 * dir, GROUND - 4, 7, 8 + (running ? Math.abs(legSwing) : 0))

      // neck
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(x + 18 * dir, y - 20, 12, 10, 0.5 * dir, 0, Math.PI * 2)
      ctx.fill()

      // head
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.arc(x + 22 * dir, y - 26, 12, 0, Math.PI * 2)
      ctx.fill()

      // snout
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(x + 30 * dir, y - 24, 10, 6, 0.1 * dir, 0, Math.PI * 2)
      ctx.fill()

      // nose
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(x + 36 * dir, y - 24, 3, 0, Math.PI * 2)
      ctx.fill()

      // eye
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(x + 24 * dir, y - 28, 2.5, 0, Math.PI * 2)
      ctx.fill()

      // ear (floppy)
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(x + 18 * dir, y - 20, 7, 12, 0.4 * dir, 0, Math.PI * 2)
      ctx.fill()

      // mouth (happy panting when running)
      if (running || jumping) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(x + 32 * dir, y - 20, 4, 0.2, Math.PI - 0.2)
        ctx.stroke()
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
      // inner ring
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(0, 0, 6, 2, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    const render = () => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)

      // ground line
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, GROUND)
      ctx.lineTo(W, GROUND)
      ctx.stroke()
      // dash
      for (let i = 0; i < W; i += 20) {
        ctx.fillRect(i, GROUND + 2, 8, 1)
      }

      const total = 160 // frames per loop (~2.7s at 60fps)
      const phase = frame % total
      const t = phase / total

      let dogX: number, dogY: number, frisbeeX: number, frisbeeY: number, frisbeeAngle: number
      let running = false, jumping = false
      let facingRight = true

      if (phase < 15) {
        // idle, frisbee incoming
        dogX = 130; dogY = GROUND - 12
        frisbeeX = 500; frisbeeY = 90
        frisbeeAngle = 0.3
      } else if (phase < 65) {
        // dog runs right
        const pt = (phase - 15) / 50
        running = true
        dogX = 130 + pt * 220  // 130 → 350
        dogY = GROUND - 12
        // frisbee arcs ahead
        frisbeeX = 500 - pt * 340  // 500 → 160
        frisbeeY = 90 - Math.sin(pt * Math.PI) * 80
        frisbeeAngle = pt * 1.5
      } else if (phase < 80) {
        // dog jumps up to catch
        const pt = (phase - 65) / 15
        jumping = true
        dogX = 350
        dogY = GROUND - 12 - Math.sin(pt * Math.PI) * 60
        frisbeeX = 340 - pt * 30
        frisbeeY = dogY - 30 + pt * 20
        frisbeeAngle = 0.7
      } else if (phase < 95) {
        // dog lands with frisbee in mouth
        const pt = (phase - 80) / 15
        dogX = 350
        dogY = GROUND - 12
        frisbeeX = 360
        frisbeeY = GROUND - 36
        frisbeeAngle = 0
      } else {
        // dog walks back left, frisbee in mouth
        running = true
        const pt = (phase - 95) / 65
        dogX = 350 - pt * 220  // 350 → 130
        dogY = GROUND - 12
        frisbeeX = dogX + 12
        frisbeeY = GROUND - 36
        frisbeeAngle = 0
        facingRight = false
      }

      drawFrisbee(frisbeeX, frisbeeY, frisbeeAngle)
      drawDog(dogX, dogY, facingRight, running, jumping)
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
      width={560}
      height={200}
      className="w-full max-w-[560px] rounded-lg border border-black bg-white mx-auto block"
    />
  )
}
