const DAILY_LIMIT = 1500

// In-memory storage shared across requests within the same instance
const quotaStore: Map<string, number> = new Map()

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function GET() {
  const key = getTodayKey()
  const count = quotaStore.get(key) || 0
  return Response.json({ date: key, count, remaining: DAILY_LIMIT - count })
}

export async function POST() {
  const key = getTodayKey()
  const current = quotaStore.get(key) || 0
  // Clean old entries
  for (const [k] of quotaStore) {
    if (k !== key) quotaStore.delete(k)
  }
  const count = current + 1
  quotaStore.set(key, count)
  return Response.json({ date: key, count, remaining: DAILY_LIMIT - count })
}
