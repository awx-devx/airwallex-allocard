/** Built-in attribute labels from RULES-ENGINE §2. */
const BUILTIN_ATTRIBUTE_LABELS: Record<string, string> = {
  'org.baseCurrency': 'base currency',
  'project.status': 'project status',
  'project.startDate': 'project start date',
  'project.endDate': 'project end date',
  'project.approvalStatus': 'project approval status',
  'project.budget.approved': 'approved budget',
  'project.budget.committed': 'committed budget',
  'project.budget.actual': 'actual spend',
  'project.budget.remaining': 'remaining budget',
  'project.budget.utilisationPct': 'budget utilisation',
  'project.headcount': 'project headcount',
  'project.daysRemaining': 'days remaining',
  'member.role': 'member role',
  'member.scope.level': 'member scope level',
  'member.seniority': 'member seniority',
  'member.location': 'member location',
  'member.spend.mtd': 'member spend MTD',
  'card.purpose': 'card purpose',
  'card.status': 'card status',
  'campaign.roas': 'campaign ROAS',
  'inventory.skuCount': 'SKU count',
  'revenue.mrr': 'MRR',
  'vendor.riskTier': 'vendor risk tier',
  'site.region': 'site region',
}

function prettifySegment(segment: string): string {
  if (segment.length === 0) {
    return segment
  }
  return segment
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
}

function labelDynamicKey(key: string): string {
  if (key.startsWith('project.category.') && key.endsWith('.remaining')) {
    return 'category remaining budget'
  }
  if (key.startsWith('card.remaining.')) {
    const interval = key.slice('card.remaining.'.length)
    return `card remaining (${interval})`
  }
  const last = key.split('.').pop() ?? key
  return prettifySegment(last)
}

export function attributeLabel(key: string): string {
  const direct = BUILTIN_ATTRIBUTE_LABELS[key]
  if (direct) {
    return direct
  }
  return labelDynamicKey(key)
}
