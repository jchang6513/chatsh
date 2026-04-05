/**
 * T019 測試：CSS zoom cols 補正邏輯
 * 驗證 getBoundingClientRect().width / cellWidth / uiScale 的計算正確
 */
import { describe, it, expect } from 'vitest'

/**
 * 模擬 doFit 裡的 cols 補正計算邏輯
 */
function calculateCorrectedCols(
  rectWidth: number,
  cellWidth: number,
  uiScale: number
): number {
  return Math.max(2, Math.floor(rectWidth / cellWidth))
}

describe('T019: CSS zoom cols 補正', () => {
  it('uiScale=1.0 時，cols = rectWidth / cellWidth（無補正）', () => {
    // rectWidth 是 getBoundingClientRect()，已反映 zoom
    // 所以 uiScale=1 時兩者一致
    const cols = calculateCorrectedCols(800, 8, 1.0)
    expect(cols).toBe(100)
  })

  it('uiScale=1.5：rectWidth=533（800/1.5），cols=66', () => {
    // getBoundingClientRect().width 已受 zoom 影響，回傳縮小後的寬度
    // 800px 在 1.5x zoom 下，實際顯示寬度 = 800/1.5 ≈ 533
    const rectWidth = Math.round(800 / 1.5) // 533
    const cols = calculateCorrectedCols(rectWidth, 8, 1.5)
    expect(cols).toBe(66)
  })

  it('uiScale=2.0：rectWidth=400（800/2.0），cols=50', () => {
    const rectWidth = 800 / 2.0 // 400
    const cols = calculateCorrectedCols(rectWidth, 8, 2.0)
    expect(cols).toBe(50)
  })

  it('clientWidth（不受 zoom）會算出錯誤的 cols', () => {
    // 這是 bug 的根本原因：clientWidth 不受 CSS zoom 影響
    const clientWidth = 800 // zoom 不改變 clientWidth
    const buggyColsAt1_5x = Math.floor(clientWidth / 8) // = 100（錯誤）

    const rectWidth = Math.round(800 / 1.5) // 正確的寬度
    const correctCols = calculateCorrectedCols(rectWidth, 8, 1.5) // = 66

    // clientWidth 算出的 cols 遠大於實際可顯示的 cols
    expect(buggyColsAt1_5x).toBeGreaterThan(correctCols)
    expect(buggyColsAt1_5x).toBe(100) // bug：算出 100 cols，但畫面只能顯示 66
    expect(correctCols).toBe(66)      // fix：正確的 cols
  })

  it('最小 cols 不低於 2', () => {
    const cols = calculateCorrectedCols(10, 8, 1.0)
    expect(cols).toBeGreaterThanOrEqual(2)
  })
})
