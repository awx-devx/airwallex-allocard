'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { isApiError } from '@/client/api/errors'
import { useAttributes, useCreateAttribute, useUpdateAttribute } from '@/client/hooks/useRules'
import { useMe, usePermissions } from '@/client/hooks/useSession'
import { activeOrgRole } from '@/client/lib/projects'
import {
  attributeListHref,
  BUILTIN_ATTRIBUTE_KEYS,
  CAMPAIGN_ANALYTICS_CONNECTOR_ID,
  editControlsDenialMessage,
  holdsControlEdit,
  parseAttributeListSearchParams,
  parseCommaList,
  parseIntInput,
  webhookSecretWriteOnlyMessage,
} from '@/client/lib/rules'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { AttributeValueSheet } from '@/app/(app)/settings/attributes/AttributeValueSheet'
import { DataTable } from '@/components/patterns/DataTable'
import { ErrorState } from '@/components/patterns/ErrorState'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import type { DataTableColumn } from '@/components/patterns/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AttributeScope } from '@/shared/enums/attributeScope'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeType } from '@/shared/enums/attributeType'
import { ErrorCode } from '@/shared/enums/errors'
import type { AttributeDefinition } from '@/shared/types/attribute'

const ALL = '__all__'
const CREATE_SOURCES = [
  AttributeSource.MANUAL,
  AttributeSource.WEBHOOK,
  AttributeSource.CONNECTOR,
] as const

export function AttributeRegistry() {
  const router = useRouter()
  const params = useSearchParams()
  const { orgId } = useActiveOrg()
  const me = useMe()
  const permissions = usePermissions()
  const filter = parseAttributeListSearchParams({
    scope: params.get('scope') ?? undefined,
    source: params.get('source') ?? undefined,
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? undefined,
  })
  const query = useAttributes(filter)
  const createAttribute = useCreateAttribute()
  const updateAttribute = useUpdateAttribute()
  const [createOpen, setCreateOpen] = useState(false)
  const [valuesFor, setValuesFor] = useState<AttributeDefinition | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [rotateSecret, setRotateSecret] = useState<Record<string, string>>({})
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const allowed =
    me.isPending || permissions.isPending || holdsControlEdit(orgRole, permissions.data?.projects)

  function pushFilter(next: typeof filter) {
    router.push(attributeListHref(next))
  }

  if (query.error) {
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load attributes'}
      />
    )
  }

  const columns: DataTableColumn<AttributeDefinition>[] = [
    { id: 'key', header: 'Key', cell: (row) => row.key },
    { id: 'label', header: 'Label', cell: (row) => row.label },
    { id: 'type', header: 'Type', cell: (row) => row.type },
    { id: 'source', header: 'Source', cell: (row) => row.source },
    {
      id: 'hasWebhookSecret',
      header: 'Webhook secret',
      cell: (row) => (row.hasWebhookSecret ? 'Yes' : 'No'),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setValuesFor(row)}>
            Values
          </Button>
          {row.source === AttributeSource.WEBHOOK ? (
            <div className="flex flex-wrap gap-2">
              <Input
                type="password"
                value={rotateSecret[row.key] ?? ''}
                onChange={(event) =>
                  setRotateSecret((prev) => ({ ...prev, [row.key]: event.target.value }))
                }
                placeholder="Rotate secret"
              />
              <Button
                type="button"
                size="sm"
                disabled={!allowed || (rotateSecret[row.key] ?? '').length < 16}
                onClick={() => {
                  const webhookSecret = rotateSecret[row.key] ?? ''
                  void updateAttribute
                    .mutateAsync({ key: row.key, input: { webhookSecret } })
                    .then(() => setRotateSecret((prev) => ({ ...prev, [row.key]: '' })))
                    .catch((error: unknown) => {
                      setAlertMessage(isApiError(error) ? error.message : 'Unable to rotate secret')
                    })
                }}
              >
                Rotate
              </Button>
            </div>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      <section className="flex min-w-0 flex-col gap-2">
        <h2 className="text-sm font-medium">Built-in attributes</h2>
        <ul className="flex min-w-0 flex-col gap-1">
          {BUILTIN_ATTRIBUTE_KEYS.map((item) => (
            <li key={item.key} className="min-w-0 text-sm">
              {item.key} — {item.label} ({item.scope})
            </li>
          ))}
        </ul>
      </section>
      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-sm font-medium">Custom attributes</h2>
        <div className="flex flex-wrap gap-2">
          <Select
            value={filter.scope ?? ALL}
            onValueChange={(value) =>
              pushFilter({
                ...filter,
                scope: value === ALL ? undefined : (value as AttributeScope),
                page: 1,
              })
            }
          >
            <SelectTrigger aria-label="Scope" size="sm">
              <SelectValue placeholder="All scopes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {Object.values(AttributeScope).map((scope) => (
                <SelectItem key={scope} value={scope}>
                  {scope}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filter.source ?? ALL}
            onValueChange={(value) =>
              pushFilter({
                ...filter,
                source: value === ALL ? undefined : (value as AttributeSource),
                page: 1,
              })
            }
          >
            <SelectTrigger aria-label="Source" size="sm">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {Object.values(AttributeSource).map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PermissionGateView allowed={allowed} denialMessage={editControlsDenialMessage()}>
            <Button type="button" disabled={!allowed} onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4 shrink-0" aria-hidden />
              Create attribute
            </Button>
          </PermissionGateView>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          getRowId={(row) => row.id}
          pagination={{
            mode: 'page',
            page: query.data?.page ?? filter.page,
            pageSize: query.data?.pageSize ?? filter.pageSize,
            total: query.data?.total ?? 0,
            onPageChange: (page) => pushFilter({ ...filter, page }),
          }}
          loading={query.isPending}
          empty={{
            title: 'No custom attributes',
            description: 'Create a MANUAL, WEBHOOK, or CONNECTOR attribute.',
          }}
        />
      </section>
      <CreateAttributeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        allowed={allowed}
        pending={createAttribute.isPending}
        onCreate={async (input) => {
          setAlertMessage(null)
          try {
            await createAttribute.mutateAsync(input)
            setCreateOpen(false)
          } catch (error) {
            setAlertMessage(isApiError(error) ? error.message : 'Unable to create attribute')
            if (isApiError(error) && error.code === ErrorCode.CONFLICT) {
              return
            }
          }
        }}
      />
      <AttributeValueSheet
        definition={valuesFor}
        open={valuesFor !== null}
        onOpenChange={(open) => !open && setValuesFor(null)}
      />
    </div>
  )
}

function CreateAttributeDialog({
  open,
  onOpenChange,
  allowed,
  pending,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  allowed: boolean
  pending: boolean
  onCreate: (input: {
    key: string
    label: string
    type: AttributeType
    scope: AttributeScope
    source: (typeof CREATE_SOURCES)[number]
    enumValues?: string[]
    webhookSecret?: string
    connectorId?: string
    refreshIntervalSec?: number
  }) => Promise<void>
}) {
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<AttributeType>(AttributeType.STRING)
  const [scope, setScope] = useState<AttributeScope>(AttributeScope.PROJECT)
  const [source, setSource] = useState<(typeof CREATE_SOURCES)[number]>(AttributeSource.MANUAL)
  const [enumRaw, setEnumRaw] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [refreshRaw, setRefreshRaw] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create attribute</DialogTitle>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-3">
          <Label htmlFor="attr-key">Key</Label>
          <Input
            id="attr-key"
            maxLength={120}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="campaign.roas"
          />
          <Label htmlFor="attr-label">Label</Label>
          <Input
            id="attr-label"
            maxLength={120}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Select value={type} onValueChange={(value) => setType(value as AttributeType)}>
            <SelectTrigger aria-label="Type" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(AttributeType).map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={scope} onValueChange={(value) => setScope(value as AttributeScope)}>
            <SelectTrigger aria-label="Scope" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(AttributeScope).map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={source}
            onValueChange={(value) => setSource(value as (typeof CREATE_SOURCES)[number])}
          >
            <SelectTrigger aria-label="Source" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CREATE_SOURCES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {type === AttributeType.ENUM ? (
            <>
              <Label htmlFor="attr-enum">Enum values</Label>
              <Input
                id="attr-enum"
                value={enumRaw}
                onChange={(event) => setEnumRaw(event.target.value)}
              />
            </>
          ) : null}
          {source === AttributeSource.WEBHOOK ? (
            <>
              <Label htmlFor="attr-secret">Webhook secret</Label>
              <Input
                id="attr-secret"
                type="password"
                minLength={16}
                value={webhookSecret}
                onChange={(event) => setWebhookSecret(event.target.value)}
              />
              <p className="text-sm text-muted-foreground">{webhookSecretWriteOnlyMessage()}</p>
            </>
          ) : null}
          {source === AttributeSource.CONNECTOR ? (
            <>
              <Select value={CAMPAIGN_ANALYTICS_CONNECTOR_ID}>
                <SelectTrigger aria-label="Connector" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CAMPAIGN_ANALYTICS_CONNECTOR_ID}>
                    Campaign Analytics
                  </SelectItem>
                </SelectContent>
              </Select>
              <Label htmlFor="attr-refresh">Refresh interval seconds</Label>
              <Input
                id="attr-refresh"
                value={refreshRaw}
                onChange={(event) => setRefreshRaw(event.target.value)}
              />
            </>
          ) : null}
        </div>
        <DialogFooter>
          <PermissionGateView allowed={allowed} denialMessage={editControlsDenialMessage()}>
            <Button
              type="button"
              disabled={!allowed || key.length < 1 || label.length < 1}
              loading={pending}
              onClick={() =>
                void onCreate({
                  key,
                  label,
                  type,
                  scope,
                  source,
                  enumValues:
                    type === AttributeType.ENUM
                      ? (parseCommaList(enumRaw) ?? undefined)
                      : undefined,
                  webhookSecret: source === AttributeSource.WEBHOOK ? webhookSecret : undefined,
                  connectorId:
                    source === AttributeSource.CONNECTOR
                      ? CAMPAIGN_ANALYTICS_CONNECTOR_ID
                      : undefined,
                  refreshIntervalSec:
                    source === AttributeSource.CONNECTOR ? parseIntInput(refreshRaw) : undefined,
                })
              }
            >
              Create attribute
            </Button>
          </PermissionGateView>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
