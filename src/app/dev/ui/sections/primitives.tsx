'use client'

import { useEffect, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'

import { tableProjects } from '@/app/dev/ui/fixtures'
import { ApiError } from '@/client/api/errors'
import { applyServerErrorsFromApiError } from '@/client/lib/forms/applyServerErrors'
import { useZodForm } from '@/client/lib/forms/useZodForm'
import { toastStore } from '@/client/providers/toastStore'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { DatePicker } from '@/components/ui/date-picker'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ErrorCode } from '@/shared/enums/errors'
import { createProjectInput } from '@/shared/schemas/project'

const PROJECT_OPTIONS = tableProjects.map((row) => ({ value: row.id, label: row.name }))

const BADGE_VARIANTS = [
  'default',
  'secondary',
  'destructive',
  'outline',
  'neutral',
  'info',
  'success',
  'warning',
  'danger',
] as const

function ValidFormFieldDemo() {
  const form = useZodForm(createProjectInput, {
    defaultValues: { name: 'Q3 Brand Campaign', code: 'Q3-BRAND' },
  })

  return (
    <Form {...form}>
      <form className="max-w-sm space-y-3" onSubmit={(event) => event.preventDefault()}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>Shown on cards and reports.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}

function InvalidFormFieldDemo() {
  const form = useZodForm(createProjectInput, {
    defaultValues: { name: 'Tokyo Vendor Pilot', code: 'TYO' },
  })

  useEffect(() => {
    applyServerErrorsFromApiError(
      form as unknown as UseFormReturn<FieldValues>,
      new ApiError(ErrorCode.VALIDATION_FAILED, 'Validation failed', 422, {
        fieldErrors: { code: ['Code must be unique in this organisation'] },
      }),
    )
  }, [form])

  return (
    <Form {...form}>
      <form className="max-w-sm space-y-3" onSubmit={(event) => event.preventDefault()}>
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project code</FormLabel>
              <FormControl>
                <Input {...field} aria-invalid />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}

function InteractivePrimitives() {
  const [projectId, setProjectId] = useState<string | null>(tableProjects[0]?.id ?? null)
  const [orgId, setOrgId] = useState('org_seed')
  const [startDate, setStartDate] = useState<string | null>('2026-07-01T00:00:00.000Z')
  const [range, setRange] = useState<{ from: string | null; to: string | null }>({
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-09-30T00:00:00.000Z',
  })

  return (
    <>
      <section id="select" className="space-y-2">
        <h3 className="font-medium">Select</h3>
        <Select value={orgId} onValueChange={setOrgId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Organisation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="org_seed">Seed Org</SelectItem>
            <SelectItem value="org_demo">Demo Org</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <section id="combobox" className="space-y-2">
        <h3 className="font-medium">Combobox</h3>
        <div className="max-w-sm">
          <Combobox
            options={[...PROJECT_OPTIONS]}
            value={projectId}
            onChange={setProjectId}
            placeholder="Select a project"
            emptyText="No matching project"
            searchPlaceholder="Search projects"
          />
        </div>
      </section>

      <section id="date-picker" className="space-y-2">
        <h3 className="font-medium">DatePicker</h3>
        <div className="max-w-sm">
          <DatePicker value={startDate} onChange={setStartDate} placeholder="Project start" />
        </div>
      </section>

      <section id="date-range-picker" className="space-y-2">
        <h3 className="font-medium">DateRangePicker</h3>
        <div className="max-w-sm">
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>
      </section>
    </>
  )
}

export function PrimitiveGallery() {
  return (
    <>
      <section id="button" className="space-y-3">
        <h3 className="font-medium">Button</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button">Create project</Button>
          <Button type="button" disabled>
            Create project
          </Button>
          <Button type="button" loading>
            Saving
          </Button>
          <Button type="button" variant="destructive">
            Close card
          </Button>
          <Button type="button" size="icon" aria-label="Add member">
            <PlusIcon />
          </Button>
        </div>
      </section>

      <section id="spinner" className="space-y-2">
        <h3 className="font-medium">Spinner</h3>
        <Spinner />
      </section>

      <section id="badge" className="space-y-2">
        <h3 className="font-medium">Badge</h3>
        <div className="flex flex-wrap gap-2">
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </section>

      <section id="skeleton" className="space-y-2">
        <h3 className="font-medium">Skeleton</h3>
        <div className="max-w-sm space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </section>

      <section id="progress" className="max-w-sm space-y-3">
        <h3 className="font-medium">Progress</h3>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Utilisation 0%</p>
          <Progress value={0} />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Utilisation 50%</p>
          <Progress value={50} />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Utilisation 100%</p>
          <Progress value={100} />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Utilisation 125%</p>
          <Progress value={125} />
        </div>
      </section>

      <section id="separator" className="space-y-2">
        <h3 className="font-medium">Separator</h3>
        <Separator />
      </section>

      <section id="input" className="max-w-sm space-y-3">
        <h3 className="font-medium">Input</h3>
        <Input defaultValue="Q3 Brand Campaign" aria-label="Project name" />
        <Input defaultValue="Q3 Brand Campaign" disabled aria-label="Project name disabled" />
        <Input defaultValue="TYO" aria-invalid aria-label="Project code invalid" />
      </section>

      <section id="textarea" className="max-w-sm space-y-2">
        <h3 className="font-medium">Textarea</h3>
        <Textarea defaultValue="Shared vendor cards for the Tokyo pilot. Freeze when utilisation crosses below 10%." />
      </section>

      <section id="label" className="space-y-2">
        <h3 className="font-medium">Label</h3>
        <div className="flex max-w-sm flex-col gap-1">
          <Label htmlFor="cost-centre">Cost centre</Label>
          <Input id="cost-centre" defaultValue="MKT-APAC" />
        </div>
      </section>

      <section id="checkbox" className="space-y-2">
        <h3 className="font-medium">Checkbox</h3>
        <div className="flex items-center gap-2">
          <Checkbox id="shared-cards" defaultChecked />
          <Label htmlFor="shared-cards">Shared cards</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="per-member" disabled />
          <Label htmlFor="per-member">Per-member cards</Label>
        </div>
      </section>

      <section id="radio" className="space-y-2">
        <h3 className="font-medium">Radio</h3>
        <RadioGroup defaultValue="shared" className="gap-2">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="shared" id="purpose-shared" />
            <Label htmlFor="purpose-shared">Shared</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="vendor" id="purpose-vendor" />
            <Label htmlFor="purpose-vendor">Vendor</Label>
          </div>
        </RadioGroup>
      </section>

      <section id="switch" className="space-y-2">
        <h3 className="font-medium">Switch</h3>
        <div className="flex items-center gap-2">
          <Switch id="notify-approvals" defaultChecked />
          <Label htmlFor="notify-approvals">Notify on approvals</Label>
        </div>
      </section>

      <section id="form-field" className="space-y-4">
        <h3 className="font-medium">FormField</h3>
        <ValidFormFieldDemo />
        <InvalidFormFieldDemo />
      </section>

      <InteractivePrimitives />

      <section id="command" className="space-y-2">
        <h3 className="font-medium">Command</h3>
        <Command className="max-w-sm rounded-md border">
          <CommandInput placeholder="Search projects" />
          <CommandList>
            <CommandEmpty>No matching project</CommandEmpty>
            <CommandGroup heading="Projects">
              {tableProjects.map((row) => (
                <CommandItem key={row.id}>{row.name}</CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </section>

      <section id="dialog" className="space-y-2">
        <h3 className="font-medium">Dialog</h3>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">
              Open freeze dialog
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Freeze AWS — Q3 infra</DialogTitle>
              <DialogDescription>
                Authorisations stop immediately. Pending captures can still settle.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton>
              <Button type="button">Freeze card</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section id="sheet" className="space-y-2">
        <h3 className="font-medium">Sheet</h3>
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline">
              Open project sheet
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Q3 Brand Campaign</SheetTitle>
              <SheetDescription>Q3-BRAND · ACTIVE</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </section>

      <section id="popover" className="space-y-2">
        <h3 className="font-medium">Popover</h3>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline">
              Budget hint
            </Button>
          </PopoverTrigger>
          <PopoverContent>Approved $50,000. Remaining is derived, not typed.</PopoverContent>
        </Popover>
      </section>

      <section id="tooltip" className="space-y-2">
        <h3 className="font-medium">Tooltip</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline">
                Reveal PAN
              </Button>
            </TooltipTrigger>
            <TooltipContent>Opens the Airwallex-hosted iframe</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button type="button" disabled>
                  Freeze card
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Requires card.freeze</TooltipContent>
          </Tooltip>
        </div>
      </section>

      <section id="dropdown-menu" className="space-y-2">
        <h3 className="font-medium">DropdownMenu</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline">
              Card actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>AWS — Q3 infra</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Freeze</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Close</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </section>

      <section id="tabs" className="space-y-2">
        <h3 className="font-medium">Tabs</h3>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <p className="text-sm text-muted-foreground">APAC Launch is ACTIVE.</p>
          </TabsContent>
          <TabsContent value="people">
            <p className="text-sm text-muted-foreground">12 members on this project.</p>
          </TabsContent>
          <TabsContent value="budget">
            <p className="text-sm text-muted-foreground">Utilisation 81% of approved.</p>
          </TabsContent>
        </Tabs>
      </section>

      <section id="table" className="space-y-2">
        <h3 className="font-medium">Table</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableProjects.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.code}</TableCell>
                <TableCell>{row.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section id="scroll-area" className="space-y-2">
        <h3 className="font-medium">ScrollArea</h3>
        <ScrollArea className="h-32 max-w-sm rounded-md border">
          <ul className="space-y-2 p-3 text-sm">
            {tableProjects.map((row) => (
              <li key={row.id}>
                {row.name} · {row.code}
              </li>
            ))}
            <li>AWS — Q3 infra · ************4242</li>
            <li>Maya Chen approved $4,023.50</li>
          </ul>
        </ScrollArea>
      </section>

      <section id="breadcrumb" className="space-y-2">
        <h3 className="font-medium">Breadcrumb</h3>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Q3 Brand Campaign</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </section>

      <section id="pagination" className="space-y-2">
        <h3 className="font-medium">Pagination</h3>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#pagination" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#pagination" isActive>
                1
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#pagination">2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#pagination" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </section>

      <section id="avatar" className="space-y-2">
        <h3 className="font-medium">Avatar</h3>
        <div className="flex items-center gap-3">
          <Avatar alt="Ada Lovelace" name="Ada Lovelace" />
          <Avatar alt="Maya Chen" name="Maya Chen" size="lg" />
        </div>
      </section>

      <section id="card" className="space-y-2">
        <h3 className="font-medium">Card</h3>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Q3 Brand Campaign</CardTitle>
            <CardDescription>Q3-BRAND · approved $50,000</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Utilisation 81%. Remaining is derived.</p>
          </CardContent>
        </Card>
      </section>

      <section id="alert" className="space-y-3">
        <h3 className="font-medium">Alert</h3>
        <Alert>
          <AlertTitle>Draft project</AlertTitle>
          <AlertDescription>Launch requires owner, dates, and a budget formula.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTitle>Card close is irreversible</AlertTitle>
          <AlertDescription>Pending transactions at Airwallex will still clear.</AlertDescription>
        </Alert>
        <Alert variant="info">
          <AlertTitle>3 pending approvals</AlertTitle>
          <AlertDescription>Ada Lovelace has items waiting in the queue.</AlertDescription>
        </Alert>
        <Alert variant="success">
          <AlertTitle>Budget saved</AlertTitle>
          <AlertDescription>Q3 Brand Campaign formula is live.</AlertDescription>
        </Alert>
        <Alert variant="warning">
          <AlertTitle>Over committed</AlertTitle>
          <AlertDescription>Committed plus actual exceeds approved remaining.</AlertDescription>
        </Alert>
      </section>

      <section id="toast" className="space-y-2">
        <h3 className="font-medium">Toast</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => toastStore.success('Budget saved')}
          >
            Success
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => toastStore.error('Upstream error from Airwallex')}
          >
            Error
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => toastStore.info('3 pending approvals')}
          >
            Info
          </Button>
        </div>
      </section>
    </>
  )
}
