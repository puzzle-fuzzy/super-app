/** 分 → 元 转换，保留 2 位小数 */
export function centsToYuan(cents: number): number {
  return Math.round(cents * 100) / 10000
}
