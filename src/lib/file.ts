import type { AppData } from '../types'
import { todayISO } from './date'

export function downloadJSON(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ai-tools-subscription-${todayISO()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function isAppData(v: unknown): v is AppData {
  if (!v || typeof v !== 'object') return false
  const o = v as Partial<AppData>
  return (
    Array.isArray(o.subscriptions) &&
    Array.isArray(o.charges) &&
    Array.isArray(o.fxRates) &&
    !!o.settings &&
    typeof o.settings.defaultRate === 'number'
  )
}

export function readJSONFile(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result))
        if (!isAppData(parsed)) {
          reject(new Error('檔案格式不符：缺少 subscriptions / charges / fxRates / settings'))
          return
        }
        resolve(parsed)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('無法解析 JSON'))
      }
    }
    reader.onerror = () => reject(new Error('讀取檔案失敗'))
    reader.readAsText(file)
  })
}
