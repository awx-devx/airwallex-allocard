function titleCaseAllCapsToken(token: string): string {
  if (token.length <= 3) {
    return token
  }
  if (token === token.toUpperCase() && /[A-Z]/.test(token)) {
    return token.charAt(0) + token.slice(1).toLowerCase()
  }
  return token
}

/** Trim, collapse whitespace, and title-case ALL-CAPS tokens longer than 3 chars. */
export function normaliseMerchantName(name: string): string {
  const collapsed = name.trim().replace(/\s+/g, ' ')
  return collapsed
    .split(' ')
    .map((token) => titleCaseAllCapsToken(token))
    .join(' ')
}
