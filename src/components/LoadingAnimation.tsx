'use client'

import React, { useRef, useEffect } from 'react'

export default function LoadingAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = 400, H = 160, P = 3 // P = pixel size
    let frame = 0, animId = 0

    const render = () => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)

      const total = 150 // ~2.5s at 60fps
      const ph = frame % total

      // ── Document (main element) ──
      const docX = 80, docY = 30, docW = 120, docH = 100
      const margin = 12

      // Document outline
      ctx.fillStyle = '#000'
      for (let x = docX; x < docX + docW; x += P) {
        ctx.fillRect(x, docY, P, P)
        ctx.fillRect(x, docY + docH - P, P, P)
      }
      for (let y = docY; y < docY + docH; y += P) {
        ctx.fillRect(docX, y, P, P)
        ctx.fillRect(docX + docW - P, y, P, P)
      }

      // Scan line + revealed text
      const scanDuration = 80
      const scanPh = Math.min(ph, scanDuration)
      const scanPt = scanPh / scanDuration
      const scanY = docY + margin + scanPt * (docH - margin * 2)

      // Revealed text lines (above scan line)
      ctx.fillStyle = '#000'
      const lines = [
        { x: docX + 12, w: docW - 30 },
        { x: docX + 16, w: docW - 36 },
        { x: docX + 10, w: docW - 24 },
        { x: docX + 14, w: docW - 32 },
        { x: docX + 12, w: docW - 28 },
      ]

      for (let i = 0; i < lines.length; i++) {
        const lineY = docY + margin + 8 + i * 16
        if (lineY < scanY - 2) {
          const lw = Math.min(lines[i].w, (scanY - lineY) * 3)
          if (lw > 4) {
            for (let px = lines[i].x; px < lines[i].x + lw - 2; px += P) {
              ctx.fillRect(px, lineY, P * 2, P)
            }
          }
        }
      }

      // Scan line
      if (ph < scanDuration + 10) {
        ctx.fillStyle = '#000'
        for (let x = docX + 4; x < docX + docW - 4; x += P * 2) {
          ctx.fillRect(x, scanY, P, P)
        }
      }

      // ── Note cards (auxiliary element) ──
      const cardStart = 85
      const cardFadeIn = scanDuration
      const cardX = 230, cardY = 35
      const cardW = 130

      if (ph > cardFadeIn) {
        const pt = Math.min((ph - cardFadeIn) / 60, 1)
        const ease = pt < 0.5 ? 2 * pt * pt : 1 - Math.pow(-2 * pt + 2, 2) / 2

        // Card 1
        const c1y = cardY + (1 - ease) * 20
        const c1a = Math.min(ease * 2, 1)
        ctx.globalAlpha = c1a
        ctx.fillStyle = '#000'
        // Card outline
        for (let x = cardX; x < cardX + cardW; x += P) {
          ctx.fillRect(x, c1y, P, P)
          ctx.fillRect(x, c1y + 50, P, P)
        }
        for (let y = c1y; y < c1y + 50; y += P) {
          ctx.fillRect(cardX, y, P, P)
          ctx.fillRect(cardX + cardW - P, y, P, P)
        }
        // Card text lines
        if (pt > 0.2) {
          const tp = (pt - 0.2) / 0.8
          for (let i = 0; i < 4; i++) {
            const tlw = Math.min(cardW - 24, tp * (70 - i * 5) + 10)
            for (let px = cardX + 12; px < cardX + 12 + tlw; px += P) {
              ctx.fillRect(px, c1y + 10 + i * 12, P * 2, P)
            }
          }
        }
        ctx.globalAlpha = 1

        // Card 2 (smaller, offset)
        if (pt > 0.3) {
          const tp2 = Math.min((pt - 0.3) / 0.7, 1)
          const c2y = cardY + 60
          const c2a = Math.min(tp2 * 1.5, 1)
          ctx.globalAlpha = c2a * 0.6
          for (let x = cardX + 8; x < cardX + cardW - 8; x += P) {
            ctx.fillRect(x, c2y, P, P)
            ctx.fillRect(x, c2y + 30, P, P)
          }
          for (let y = c2y; y < c2y + 30; y += P) {
            ctx.fillRect(cardX + 8, y, P, P)
            ctx.fillRect(cardX + cardW - 8 - P, y, P, P)
          }
          if (tp2 > 0.3) {
            for (let i = 0; i < 2; i++) {
              const tlw = (tp2 - 0.3) / 0.7 * (cardW - 30)
              for (let px = cardX + 16; px < cardX + 16 + tlw; px += P) {
                ctx.fillRect(px, c2y + 8 + i * 10, P * 2, P)
              }
            }
          }
          ctx.globalAlpha = 1
        }
      }

      // ── Arrow connection ──
      if (ph > cardFadeIn && ph < cardFadeIn + 60) {
        const pt = (ph - cardFadeIn) / 60
        ctx.globalAlpha = pt < 0.5 ? pt * 2 : 1
        const ax = docX + docW + 8, ay = docY + docH / 2
        for (let x = ax; x < cardX - 4; x += P) {
          ctx.fillRect(x, ay, P, P)
        }
        ctx.globalAlpha = 1
      }
    }

    const loop = () => { frame++; render(); animId = requestAnimationFrame(loop) }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return <canvas ref={canvasRef} width={400} height={160}
    className="w-full max-w-[400px] mx-auto block" />
}
