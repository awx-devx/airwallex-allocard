export function LoadingState({ label = 'Loading', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div aria-busy="true" aria-label={label} style={{ minHeight: 120 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            height: 16,
            marginBottom: 8,
            background: '#eee',
            borderRadius: 4,
            maxWidth: i === rows - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  )
}
