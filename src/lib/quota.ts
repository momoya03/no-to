const STORAGE_KEY = 'gemini-quota'
const DAILY_LIMIT = 1500

export interface QuotaData {
  date: string
  count: number
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function readLocal(): QuotaData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data: QuotaData = JSON.parse(raw)
      if (data.date === getToday()) return data
    }
  } catch {}
  return null
}

function writeLocal(data: QuotaData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

export async function getQuota(): Promise<QuotaData> {
  const local = readLocal()

  try {
    const res = await fetch('/api/quota')
    if (res.ok) {
      const server: QuotaData & { remaining: number } = await res.json()
      // Take the larger count between server and local
      const count = Math.max(server.count, local?.count || 0)
      const data = { date: server.date, count }
      writeLocal(data)
      return data
    }
  } catch {}

  return local || { date: getToday(), count: 0 }
}

export async function incrementQuota(): Promise<QuotaData> {
  const today = getToday()

  try {
    const res = await fetch('/api/quota', { method: 'POST' })
    if (res.ok) {
      const server: QuotaData = await res.json()
      const local = readLocal()
      const count = Math.max(server.count, (local?.count || 0) + 1)
      const data = { date: today, count }
      writeLocal(data)
      return data
    }
  } catch {}

  // Fallback to localStorage only
  const local = readLocal()
  const data: QuotaData = {
    date: today,
    count: local && local.date === today ? local.count + 1 : 1
  }
  writeLocal(data)
  return data
}
