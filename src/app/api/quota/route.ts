import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const DAILY_LIMIT = 1500

function getTodayKey(): string {
  return `quota:${new Date().toISOString().slice(0, 10)}`
}

export async function GET() {
  try {
    const key = getTodayKey()
    const count = (await redis.get<number>(key)) || 0
    return Response.json({ count, remaining: DAILY_LIMIT - count })
  } catch {
    return Response.json({ count: 0, remaining: DAILY_LIMIT }, { status: 500 })
  }
}

export async function POST() {
  try {
    const key = getTodayKey()
    const count = await redis.incr(key)
    // Expire at next midnight UTC
    const now = new Date()
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
    await redis.expire(key, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000))
    return Response.json({ count, remaining: DAILY_LIMIT - count })
  } catch {
    return Response.json({ count: 0, remaining: DAILY_LIMIT }, { status: 500 })
  }
}
