import * as React from 'react'
import { Checkbox as P } from 'radix-ui'
import { Check } from 'lucide-react'
import { cn } from '@/renderer/lib/utils.js'

function Checkbox({ className, ...props }: React.ComponentProps<typeof P.Root>) {
  return (
    <P.Root
      className={cn(
        'peer size-4 shrink-0 rounded-[4px] border border-input bg-card shadow-xs outline-none transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        className
      )}
      {...props}
    >
      <P.Indicator className="flex items-center justify-center">
        <Check className="size-3.5" />
      </P.Indicator>
    </P.Root>
  )
}
export { Checkbox }
