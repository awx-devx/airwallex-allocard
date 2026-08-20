import Image from 'next/image'
import { publicAsset } from '@/lib/assets'

export const AIRWALLEX_SITE_URL = 'https://www.airwallex.com'

function AirwallexLockup() {
  return (
    <span className="relative inline-block h-20 w-4 shrink-0">
      <Image
        src={publicAsset.airwallexLight}
        alt=""
        width={1405}
        height={281}
        className="absolute left-1/2 top-1/2 h-4 w-auto max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 dark:hidden"
        unoptimized
      />
      <Image
        src={publicAsset.airwallexDark}
        alt=""
        width={1405}
        height={281}
        className="absolute left-1/2 top-1/2 hidden h-4 w-auto max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 dark:inline"
        unoptimized
      />
    </span>
  )
}

export function PoweredByAirwallex() {
  return (
    <a
      href={AIRWALLEX_SITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Powered by Airwallex (opens in a new tab)"
      className="fixed right-0 top-1/2 z-30 -translate-y-1/2 translate-x-[calc(100%-0.75rem)] rounded-l-md border border-r-0 border-border bg-card shadow-[var(--shadow-glass)] transition-transform duration-200 hover:translate-x-0 focus-visible:translate-x-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground [writing-mode:vertical-rl] [text-orientation:sideways]">
        Powered by
        <AirwallexLockup />
      </span>
    </a>
  )
}
