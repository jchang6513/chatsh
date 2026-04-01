/**
 * T021 測試：settings 即時寫入
 * 驗證 patchImmediate() 確實呼叫 writeJsonFileImmediate（不用 debounce）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// mock @tauri-apps/api/core 和 path
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/path', () => ({
  homeDir: vi.fn().mockResolvedValue('/mock/home'),
  appDataDir: vi.fn().mockResolvedValue('/mock/appdata'),
}))

describe('T021: settingsStore.patchImmediate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('patchImmediate 呼叫 invoke write_file（即時，不等 debounce）', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    // 動態 import 確保 mock 生效
    const { settingsStore } = await import('../storage/settingsStore')

    await settingsStore.patchImmediate({ uiScale: 1.35 })

    expect(invoke).toHaveBeenCalledWith(
      'write_file',
      expect.objectContaining({
        content: expect.stringContaining('"uiScale": 1.35'),
      })
    )
  })

  it('patchImmediate 更新後 get() 回傳新值', async () => {
    const { settingsStore } = await import('../storage/settingsStore')
    const before = settingsStore.get().uiScale

    await settingsStore.patchImmediate({ uiScale: 1.5 })

    expect(settingsStore.get().uiScale).toBe(1.5)
    // 還原
    await settingsStore.patchImmediate({ uiScale: before ?? 1.0 })
  })

  it('patchImmediate 與 patch 不同：patch 用 debounce，patchImmediate 立即寫入', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { settingsStore } = await import('../storage/settingsStore')

    // patch 有 debounce，呼叫後不立即觸發 invoke
    settingsStore.patch({ uiScale: 1.1 })
    const callCountAfterPatch = (invoke as ReturnType<typeof vi.fn>).mock.calls.length

    // patchImmediate 立即觸發 invoke
    await settingsStore.patchImmediate({ uiScale: 1.2 })
    const callCountAfterImmediate = (invoke as ReturnType<typeof vi.fn>).mock.calls.length

    expect(callCountAfterImmediate).toBeGreaterThan(callCountAfterPatch)
  })
})
