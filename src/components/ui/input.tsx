/**
 * Money inputs must be `type="text"` + `parseMoneyInput` from `@/lib/money`.
 * `type="number"` is forbidden for money — never `parseFloat` an amount.
 */
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-md border-0 bg-card/70 px-3 py-1 text-base shadow-[var(--shadow-inset-field),0_0_0_1px_hsl(var(--border)/0.7)] transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/40',
        'focus-visible:shadow-[var(--shadow-inset-field),0_0_0_1px_hsl(var(--laser)/0.4)]',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
