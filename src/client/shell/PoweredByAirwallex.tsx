import Image from 'next/image'
import { publicAsset } from '@/lib/assets'

export const AIRWALLEX_SITE_URL = 'https://www.airwallex.com'

function AirwallexLockup() {
  return (
    <>
      <Image
        src={publicAsset.airwallexLight}
        alt=""
        width={1405}
        height={281}
        className="h-4 w-auto dark:hidden"
        unoptimized
      />
      <Image
        src={publicAsset.airwallexDark}
        alt=""
        width={1405}
        height={281}
        className="hidden h-4 w-auto dark:inline"
        unoptimized
      />
    </>
  )
}

export function PoweredByAirwallex() {
  return (
    <a
      href={AIRWALLEX_SITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Powered by Airwallex (opens in a new tab)"
      className="absolute top-full left-1/2 -mt-px flex -translate-x-1/2 items-center gap-2 rounded-b-md border border-t-0 border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-[var(--shadow-glass)]"
    >
      Powered by
      <AirwallexLockup />
    </a>
  )
}
