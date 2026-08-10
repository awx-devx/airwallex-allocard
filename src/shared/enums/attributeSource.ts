/**
 * How an attribute value is populated (ARCHITECTURE §5 flat enum).
 * COMPUTED = built-in resolvers; MANUAL / WEBHOOK / CONNECTOR = custom registry.
 */
export const AttributeSource = {
  COMPUTED: 'COMPUTED',
  MANUAL: 'MANUAL',
  WEBHOOK: 'WEBHOOK',
  CONNECTOR: 'CONNECTOR',
} as const

export type AttributeSource = (typeof AttributeSource)[keyof typeof AttributeSource]
