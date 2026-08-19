import type { ReactNode } from 'react'

export function SettingsChrome({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full min-w-0 flex-col">{children}</div>
}
