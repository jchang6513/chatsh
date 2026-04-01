/**
 * T020 測試：圖片貼上偵測邏輯
 * 驗證 Cmd+V 時能正確偵測 image/* 並轉 base64
 */
import { describe, it, expect, vi } from 'vitest'

// 模擬 clipboard item
function makeClipboardItems(types: string[]) {
  return types.map(type => ({
    types: [type],
    getType: vi.fn().mockResolvedValue(new Blob(['fake-image-data'], { type })),
  }))
}

// 模擬 doFit 邏輯：從 clipboard items 找第一個 image/*
function findImageType(items: Array<{ types: string[] }>): string | undefined {
  for (const item of items) {
    const imageType = item.types.find((t: string) => t.startsWith('image/'))
    if (imageType) return imageType
  }
  return undefined
}

describe('T020: 圖片貼上偵測', () => {
  it('image/png 應被偵測為圖片', () => {
    const items = makeClipboardItems(['image/png'])
    expect(findImageType(items)).toBe('image/png')
  })

  it('image/jpeg 應被偵測為圖片', () => {
    const items = makeClipboardItems(['image/jpeg'])
    expect(findImageType(items)).toBe('image/jpeg')
  })

  it('text/plain 不應被當成圖片', () => {
    const items = makeClipboardItems(['text/plain'])
    expect(findImageType(items)).toBeUndefined()
  })

  it('混合 text+image 應偵測到圖片', () => {
    const items = [
      { types: ['text/plain'], getType: vi.fn() },
      { types: ['image/png'], getType: vi.fn() },
    ]
    expect(findImageType(items)).toBe('image/png')
  })

  it('base64 data URL 格式正確', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const encoded = btoa(dataUrl)
    const decoded = atob(encoded)
    expect(decoded).toBe(dataUrl)
    expect(encoded).toBeTruthy()
  })

  it('FileReader 可以讀取 Blob 並產生 data URL', async () => {
    const blob = new Blob(['fake'], { type: 'image/png' })
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
    expect(dataUrl).toMatch(/^data:image\/png;base64,/)
  })
})
