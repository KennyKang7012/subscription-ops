/**
 * 測試環境沒有瀏覽器，但 store 的 persist 與「匯入前快照」都需要 localStorage。
 * 這裡補一個記憶體版實作，讓這些行為可以在 node 下被測到。
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>()

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value))
  }
}

// 無條件覆蓋：Node 22+ 的 localStorage 是「未啟用就拋錯」的 getter，
// 用 typeof 檢查反而會讓 zustand 拿不到可用的 storage。
Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
})

// zustand v5 的 persist 預設讀 window.localStorage，node 底下沒有 window，
// 少了這行會讓 store 的持久化在測試中靜默失效（連 migrate 都測不到）。
if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    configurable: true,
    writable: true,
  })
}
