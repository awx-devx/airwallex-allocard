'use client'

export type UserMenuProps = {
  user: { name: string; email: string; image?: string }
  onSignOut: () => void
}

export function UserMenu({ user, onSignOut }: UserMenuProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ textAlign: 'right', fontSize: 14 }}>
        <div>{user.name}</div>
        <div style={{ color: '#666' }}>{user.email}</div>
      </div>
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  )
}
