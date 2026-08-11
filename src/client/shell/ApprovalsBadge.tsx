export function ApprovalsBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      aria-label={`${count} pending approvals`}
      style={{
        background: '#111',
        color: '#fff',
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 12,
      }}
    >
      {count}
    </span>
  )
}
