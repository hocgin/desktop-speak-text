import * as React from 'react'
import { Tooltip as P } from 'radix-ui'
import { cn } from '@/renderer/lib/utils.js'

const TooltipProvider = ({ delayDuration = 200, ...props }: React.ComponentProps<typeof P.Provider>) => (
  <P.Provider delayDuration={delayDuration} {...props} />
)

/** 简易封装：包裹触发元素并提供提示文案 */
function Tooltip({ title, children }: { title: React.ReactNode; children: React.ReactElement }) {
  return (
    <P.Root>
      <P.Trigger asChild>{children}</P.Trigger>
      <P.Portal>
        <P.Content
          sideOffset={6}
          className={cn(
            'z-50 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0'
          )}
        >
          {title}
        </P.Content>
      </P.Portal>
    </P.Root>
  )
}
export { Tooltip, TooltipProvider }
