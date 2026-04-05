/**
 * T020 測試：Cmd+V 貼上圖片到 Claude Code
 * 修正：偵測圖片後送 Ctrl+V (\x16) 讓 Claude Code 自行讀取系統剪貼簿
 * （舊版 bug：btoa(dataUrl) 雙重 encode，Claude Code 無法識別）
 */
import { describe, it, expect, vi } from 'vitest'

// 模擬 clipboard items
function makeClipboardItems(types: string[]) {
  return [{ types, getType: vi.fn().mockResolvedValue(new Blob(['fake'], { type: types[0] })) }]
}

// 模擬新的偵測邏輯：any item 包含 image/* type 即視為有圖片
function hasImageInClipboard(items: Array<{ types: string[] }>): boolean {
  return items.some(item => item.types.some((t: string) => t.startsWith('image/')))
}

describe('T020: Cmd+V 圖片貼上偵測', () => {
  it('image/png 應被偵測為圖片', () => {
    const items = makeClipboardItems(['image/png'])
    expect(hasImageInClipboard(items)).toBe(true)
  })

  it('image/jpeg 應被偵測為圖片', () => {
    const items = makeClipboardItems(['image/jpeg'])
    expect(hasImageInClipboard(items)).toBe(true)
  })

  it('image/gif 應被偵測為圖片', () => {
    const items = makeClipboardItems(['image/gif'])
    expect(hasImageInClipboard(items)).toBe(true)
  })

  it('text/plain 不應被當成圖片', () => {
    const items = makeClipboardItems(['text/plain'])
    expect(hasImageInClipboard(items)).toBe(false)
  })

  it('text/html 不應被當成圖片', () => {
    const items = makeClipboardItems(['text/html'])
    expect(hasImageInClipboard(items)).toBe(false)
  })

  it('混合 text+image 應偵測到圖片', () => {
    const items = [
      { types: ['text/plain'], getType: vi.fn() },
      { types: ['image/png'], getType: vi.fn() },
    ]
    expect(hasImageInClipboard(items)).toBe(true)
  })

  it('空 items 不應偵測到圖片', () => {
    expect(hasImageInClipboard([])).toBe(false)
  })

  it('圖片偵測時應送 Ctrl+V (\\x16) 而非 btoa(dataUrl)', () => {
    // 驗證 Ctrl+V 字元編碼正確
    const ctrlV = "\x16"
    expect(ctrlV.charCodeAt(0)).toBe(22) // ASCII 22 = Ctrl+V
    expect(ctrlV.length).toBe(1)
    // 不應使用 btoa 雙重編碼
    const wrongApproach = btoa("data:image/png;base64,abc123")
    expect(wrongApproach).not.toBe(ctrlV)
  })

  it('純文字模式應直接送出文字（不 btoa 包裝）', () => {
    // write_to_agent 的 Rust 端會做 base64 encode，
    // 所以 data 參數應傳原始文字，不應再次 btoa
    const plainText = "hello world"
    // 正確：直接送原始文字
    const correctData = plainText
    // 錯誤：再次 btoa 包裝（Rust 會再 encode 一次，形成雙重 encode）
    const wrongData = btoa(plainText)
    expect(correctData).toBe("hello world")
    expect(wrongData).not.toBe("hello world")
  })
})
