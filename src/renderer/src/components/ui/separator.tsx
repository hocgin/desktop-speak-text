import * as React from 'react'
import { Separator as P } from 'radix-ui'
import { cn } from '@/renderer/lib/utils.js'

function Separator({ className, orientation = 'horizontal', ...props }: React.ComponentProps<typeof P.Root>) {
  return (
    <P.Root
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className
      )}
      {...props}
    />
  )
}
export { Separator }
