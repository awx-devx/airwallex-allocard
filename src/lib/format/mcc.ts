/** Curated MCC labels for demo/seed codes. Unknown codes fall back to `MCC ${code}`. */
const MCC_LABELS: Record<string, string> = {
  '5411': 'Grocery stores, supermarkets',
  '5812': 'Eating places, restaurants',
  '7995': 'Betting, casino gambling',
  '4111': 'Local and suburban commuter transport',
  '3000': 'Airlines',
}

export function mccLabel(code: string): string {
  return MCC_LABELS[code] ?? `MCC ${code}`
}
