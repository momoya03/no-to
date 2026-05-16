import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const DAILY_LIMIT = 200

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
    // Get current count — if this is a new day (key didn't exist), start from 0
    const current = (await redis.get<number>(key)) || 0
    const count = current + 1
    // Set with expiry: 25 hours to safely span midnight
    await redis.set(key, count, { ex: 90000 })
    return Response.json({ count, remaining: DAILY_LIMIT - count })
  } catch {
    return Response.json({ count: 0, remaining: DAILY_LIMIT }, { status: 500 })
  }
}
