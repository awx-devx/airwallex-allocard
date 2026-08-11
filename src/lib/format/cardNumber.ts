/**
 * Display helper for `card.maskedNumber` only — never a full PAN.
 * Pass-through with trim; no synthetic digit padding.
 */
export function formatMaskedCard(maskedNumber: string): string {
  return maskedNumber.trim()
}
