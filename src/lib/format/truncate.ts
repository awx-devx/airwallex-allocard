export type TruncateResult = {
  text: string
  truncated: boolean
  title: string
}

export function truncate(text: string, maxLen: number): TruncateResult {
  if (text.length <= maxLen) {
    return { text, truncated: false, title: text }
  }
  return {
    text: `${text.slice(0, maxLen - 1)}…`,
    truncated: true,
    title: text,
  }
}
