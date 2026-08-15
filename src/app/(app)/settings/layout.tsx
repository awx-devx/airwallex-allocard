import { SettingsChrome } from '@/app/(app)/settings/SettingsChrome'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsChrome>{children}</SettingsChrome>
}
