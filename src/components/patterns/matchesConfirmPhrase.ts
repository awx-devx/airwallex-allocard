export function matchesConfirmPhrase(input: string, phrase: string): boolean {
  return input.trim() === phrase.trim()
}
