import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/renderer/lib/utils.js'

const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-emerald-100 text-emerald-700',
        info: 'border-transparent bg-sky-100 text-sky-700',
        destructive: 'border-transparent bg-red-100 text-red-700'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { Badge }
