import { kv } from '@vercel/kv'

const DAILY_LIMIT = 1500

function getTodayKey(): string {
  return `quota:${new Date().toISOString().slice(0, 10)}`
}

export async function GET() {
  try {
    const key = getTodayKey()
    const count = (await kv.get<number>(key)) || 0
    return Response.json({ date: key, count, remaining: DAILY_LIMIT - count })
  } catch {
    return Response.json({ date: getTodayKey(), count: 0, remaining: DAILY_LIMIT })
  }
}

export async function POST() {
  try {
    const key = getTodayKey()
    const count = await kv.incr(key)
    // Auto-expire at end of day (UTC+9 JST: ~15h from midnight UTC)
    const now = new Date()
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
    const ttl = Math.ceil((tomorrow.getTime() - now.getTime()) / 1000)
    await kv.expire(key, ttl)
    return Response.json({ date: key, count, remaining: DAILY_LIMIT - count })
  } catch {
    return Response.json({ date: getTodayKey(), count: 0, remaining: DAILY_LIMIT }, { status: 500 })
  }
}
