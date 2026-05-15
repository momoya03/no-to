const STORAGE_KEY = 'quota-backup'
const DAILY_LIMIT = 2000

export interface QuotaData {
  date: string
  count: number
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function getQuota(): Promise<QuotaData> {
  try {
    const res = await fetch('/api/quota')
    if (res.ok) {
      const data = await res.json()
      return { date: data.date, count: data.count }
    }
  } catch {}

  // API unreachable — load local backup
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data: QuotaData = JSON.parse(raw)
      if (data.date === getToday()) return data
    }
  } catch {}
  return { date: getToday(), count: 0 }
}

export async function incrementQuota(): Promise<QuotaData> {
  const today = getToday()

  try {
    const res = await fetch('/api/quota', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      const result = { date: today, count: data.count }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
      return result
    }
  } catch {}

  // Fallback — increment local only
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const local: QuotaData = raw ? JSON.parse(raw) : { date: today, count: 0 }
    const result = { date: today, count: local.date === today ? local.count + 1 : 1 }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
    return result
  } catch {}
  return { date: today, count: 1 }
}
