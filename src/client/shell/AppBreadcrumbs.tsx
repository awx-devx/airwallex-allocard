'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'
import { crumbsForPathname } from '@/client/shell/navCrumbs'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export type AppBreadcrumbsProps = {
  projectName?: string
}

export function AppBreadcrumbs({ projectName }: AppBreadcrumbsProps) {
  const pathname = usePathname()
  const crumbs = crumbsForPathname(pathname, projectName ? { projectName } : {})
  if (crumbs.length === 0) return null

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="gap-1.5 md:gap-2.5">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          return (
            <Fragment key={crumb.href}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem className="min-w-0">
                {last ? (
                  <BreadcrumbPage className="truncate font-medium" title={crumb.label}>
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="truncate" title={crumb.label}>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
