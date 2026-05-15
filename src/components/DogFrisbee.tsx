'use client'

import React, { useRef, useEffect } from 'react'

// ── Pose definitions (grid coords, facing right) ──
type Part = { x: number; y: number; w: number; h: number }
interface Pose {
  body: Part; head: Part; snout: Part; ear: Part; neck: Part
  tail: Part; tailTip: Part
  legFB: Part; legFF: Part; legNB: Part; legNF: Part
  eye: [number, number]; nose: [number, number]
}

const IDLE: Pose = {
  body:{x:6,y:7,w:13,h:5}, head:{x:13,y:1,w:7,h:5}, snout:{x:19,y:2,w:4,h:3},
  ear:{x:10,y:2,w:4,h:9}, neck:{x:13,y:5,w:5,h:3},
  tail:{x:1,y:5,w:6,h:3}, tailTip:{x:0,y:3,w:2,h:2},
  legFB:{x:8,y:12,w:2,h:4}, legFF:{x:16,y:12,w:2,h:4},
  legNB:{x:7,y:12,w:2,h:4}, legNF:{x:15,y:12,w:2,h:4},
  eye:[15,3], nose:[22,2],
}
const CROUCH: Pose = {
  body:{x:6,y:8,w:13,h:5}, head:{x:13,y:4,w:7,h:5}, snout:{x:19,y:5,w:4,h:3},
  ear:{x:10,y:5,w:4,h:8}, neck:{x:13,y:8,w:5,h:2},
  tail:{x:1,y:6,w:6,h:3}, tailTip:{x:0,y:4,w:2,h:2},
  legFB:{x:8,y:13,w:2,h:3}, legFF:{x:16,y:13,w:2,h:3},
  legNB:{x:7,y:13,w:2,h:3}, legNF:{x:15,y:13,w:2,h:3},
  eye:[15,6], nose:[22,5],
}
const RUN1: Pose = {
  body:{x:6,y:6,w:14,h:5}, head:{x:14,y:1,w:7,h:5}, snout:{x:20,y:2,w:4,h:3},
  ear:{x:11,y:2,w:4,h:9}, neck:{x:14,y:5,w:5,h:3},
  tail:{x:1,y:4,w:6,h:3}, tailTip:{x:0,y:2,w:2,h:2},
  legFB:{x:8,y:11,w:2,h:4}, legFF:{x:17,y:11,w:2,h:4},
  legNB:{x:5,y:11,w:2,h:5}, legNF:{x:14,y:11,w:2,h:5},
  eye:[16,3], nose:[23,2],
}
const RUN2: Pose = {
  body:{x:6,y:6,w:14,h:5}, head:{x:14,y:1,w:7,h:5}, snout:{x:20,y:2,w:4,h:3},
  ear:{x:11,y:2,w:4,h:9}, neck:{x:14,y:5,w:5,h:3},
  tail:{x:1,y:4,w:6,h:3}, tailTip:{x:0,y:2,w:2,h:2},
  legFB:{x:8,y:11,w:2,h:5}, legFF:{x:17,y:11,w:2,h:5},
  legNB:{x:10,y:11,w:2,h:4}, legNF:{x:15,y:11,w:2,h:4},
  eye:[16,3], nose:[23,2],
}
const JUMP: Pose = {
  body:{x:6,y:3,w:13,h:5}, head:{x:13,y:-1,w:7,h:5}, snout:{x:19,y:0,w:4,h:3},
  ear:{x:10,y:0,w:4,h:9}, neck:{x:13,y:3,w:5,h:2},
  tail:{x:1,y:2,w:6,h:3}, tailTip:{x:0,y:0,w:2,h:2},
  legFB:{x:8,y:8,w:2,h:3}, legFF:{x:17,y:8,w:2,h:3},
  legNB:{x:7,y:8,w:2,h:4}, legNF:{x:16,y:8,w:2,h:3},
  eye:[15,1], nose:[22,0],
}

const POSES: Record<string, Pose> = { idle: IDLE, crouch: CROUCH, run1: RUN1, run2: RUN2, jump: JUMP }
type PoseKey = keyof typeof POSES

const GRID_W = 24, GRID_H = 16, PX = 3
const SW = GRID_W * PX, SH = GRID_H * PX

function renderPose(octx: CanvasRenderingContext2D, pose: Pose, hasFrisbee: boolean) {
  octx.clearRect(0, 0, SW, SH)
  const f = (p: Part, c: string) => { octx.fillStyle = c; octx.fillRect(p.x*PX, p.y*PX, p.w*PX, p.h*PX) }
  f(pose.legFB, '#666'); f(pose.legFF, '#666')
  f(pose.tail, '#000'); f(pose.tailTip, '#000')
  f(pose.body, '#000'); f(pose.ear, '#000'); f(pose.neck, '#000')
  f(pose.legNB, '#000'); f(pose.legNF, '#000')
  f(pose.head, '#000'); f(pose.snout, '#000')

  if (hasFrisbee) {
    const fx = (pose.snout.x + pose.snout.w) * PX
    const fy = (pose.snout.y + 1) * PX
    octx.fillStyle = '#000'
    octx.fillRect(fx, fy, 5, 5); octx.fillRect(fx+1, fy-1, 4, 5)
    octx.fillStyle = '#fff'; octx.fillRect(fx+1, fy+1, 3, 2)
  }
  octx.fillStyle = '#fff'
  octx.fillRect(pose.eye[0]*PX, pose.eye[1]*PX, PX, PX)
  octx.fillRect(pose.nose[0]*PX, pose.nose[1]*PX, PX, PX)
}

// Smoothstep easing
function ease(t: number): number {
  return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2
}

export default function DogFrisbee() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const off = document.createElement('canvas'); off.width = SW; off.height = SH
    const octx = off.getContext('2d')!

    const W = 640, H = 200, GROUND = 180
    const CYCLE = 540 // 9 sec at 60fps
    let frame = 0, animId = 0

    // Phases (frames within cycle)
    const P_IDLE1 = 70    // idle with frisbee  (1.2s)
    const P_TOSS  = 95    // toss frisbee       (0.4s)
    const P_WATCH = 145   // watch it fly       (0.8s)
    const P_CHASE = 365   // sprint after it    (3.7s)
    const P_CATCH = 395   // leap + catch       (0.5s)
    const P_RETURN= 500   // trot back          (1.8s)
    // 500-540 = idle again (0.7s)

    const render = () => {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#000'; ctx.fillRect(0, GROUND, W, 1)
      const scroll = (frame * 2.5) % 40
      for (let i = -scroll; i < W + 40; i += 40) {
        ctx.fillRect(i, GROUND+3, 6, 1); ctx.fillRect(i+16, GROUND+3, 3, 1)
      }

      const ph = frame % CYCLE

      // ── Dog position ──
      let dogX = 110, dogY = GROUND
      let poseKey: PoseKey = 'idle'
      let flip = false
      let frisbeeInMouth = false
      let frisbeeFX = 0, frisbeeFY = 0, frisbeeAng = 0
      let frisbeeFlying = false

      // Helper: get snout position in screen coordinates
      const snoutScreenX = (px: Pose) => dogX + (-SW/2 + (px.snout.x + px.snout.w/2)*PX) * (flip ? -1 : 1)
      const snoutScreenY = (px: Pose) => dogY - SH + (px.snout.y + 1)*PX

      if (ph < P_IDLE1) {
        poseKey = 'idle'; frisbeeInMouth = true
      } else if (ph < P_TOSS) {
        // Toss: frisbee transitions smoothly from mouth to flight
        const pt = (ph - P_IDLE1) / (P_TOSS - P_IDLE1)
        poseKey = 'crouch'

        // Frisbee leaves mouth at pt=0.3, rises forward
        const releaseT = 0.3
        if (pt < releaseT) {
          frisbeeInMouth = true
        } else {
          frisbeeFlying = true
          const ft = (pt - releaseT) / (1 - releaseT) // 0→1 after release
          const et = ease(ft)
          // Start from mouth position at release moment
          const mouthX = dogX + (-SW/2 + (CROUCH.snout.x + CROUCH.snout.w)*PX)
          const mouthY = GROUND - SH + (CROUCH.snout.y + 1)*PX
          frisbeeFX = mouthX + et * 60
          frisbeeFY = mouthY - et * 60
          frisbeeAng = ft * 3
        }
      } else if (ph < P_WATCH) {
        // Watch frisbee arc upward
        const pt = (ph - P_TOSS) / (P_WATCH - P_TOSS)
        poseKey = 'crouch'; frisbeeFlying = true
        const startX = dogX + (-SW/2 + (CROUCH.snout.x + CROUCH.snout.w)*PX) + 60
        const startY = GROUND - SH + (CROUCH.snout.y + 1)*PX - 60
        frisbeeFX = startX + pt * 220
        frisbeeFY = startY - Math.sin(pt * Math.PI * 0.5) * 100
        frisbeeAng = 3 + pt * 3
      } else if (ph < P_CHASE) {
        // Sprint chase
        const dur = P_CHASE - P_WATCH
        const pt = (ph - P_WATCH) / dur
        dogX = 110 + ease(pt) * 300 // 110→410
        poseKey = (Math.floor(ph / 6) % 2 === 0 ? 'run1' : 'run2') as PoseKey
        frisbeeFlying = true
        // Frisbee arcs — dog chases underneath
        const fx = 260 + pt * 280 // frisbee starts ahead, dog catches up
        frisbeeFX = fx
        frisbeeFY = GROUND - 60 - Math.sin(pt * Math.PI) * 120
        frisbeeAng = 5 + pt * 4
      } else if (ph < P_CATCH) {
        // Leap + catch
        const pt = (ph - P_CHASE) / (P_CATCH - P_CHASE)
        const jh = Math.sin(pt * Math.PI) * 65
        dogX = 410 - pt * 5
        dogY = GROUND - jh
        poseKey = 'jump'

        if (pt < 0.45) {
          // Frisbee still flying, dog jumping toward it
          frisbeeFlying = true
          const fx = 460 + (1-pt) * 50
          frisbeeFX = fx
          frisbeeFY = GROUND - 40 - jh * 0.5 - (1-pt) * 20
          frisbeeAng = 8
        } else {
          // Caught! Frisbee now in mouth
          frisbeeInMouth = true
        }
      } else if (ph < P_RETURN) {
        // Trot back with frisbee
        const pt = (ph - P_CATCH) / (P_RETURN - P_CATCH)
        dogX = 405 - pt * 295 // 405→110
        poseKey = (Math.floor(ph / 6) % 2 === 0 ? 'run1' : 'run2') as PoseKey
        flip = true; frisbeeInMouth = true
      } else {
        // Idle with frisbee
        poseKey = 'idle'; frisbeeInMouth = true
      }

      // ── Draw frisbee (flying) ──
      if (frisbeeFlying) {
        ctx.save()
        ctx.translate(frisbeeFX, frisbeeFY)
        ctx.rotate(frisbeeAng)
        ctx.fillStyle = '#000'
        ctx.fillRect(-10, -3, 20, 6)
        ctx.fillStyle = '#fff'
        ctx.fillRect(-6, -1, 12, 2)
        ctx.restore()
      }

      // ── Draw dog ──
      renderPose(octx, POSES[poseKey], frisbeeInMouth)

      ctx.save()
      ctx.imageSmoothingEnabled = false
      if (flip) {
        ctx.translate(dogX + SW/2, dogY - SH)
        ctx.scale(-1, 1)
        ctx.drawImage(off, 0, 0)
      } else {
        ctx.drawImage(off, dogX - SW/2, dogY - SH)
      }
      ctx.restore()

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.beginPath()
      ctx.ellipse(dogX, GROUND, 18, 4, 0, 0, Math.PI*2)
      ctx.fill()
    }

    const loop = () => { frame++; render(); animId = requestAnimationFrame(loop) }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return <canvas ref={canvasRef} width={640} height={200}
    className="w-full max-w-[640px] rounded-lg border border-black bg-white mx-auto block" />
}
