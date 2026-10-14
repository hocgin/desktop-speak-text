import * as React from 'react'
import { Slider as SliderPrimitive } from 'radix-ui'
import { cn } from '@/renderer/lib/utils.js'

function Slider({
  className,
  value,
  defaultValue,
  ...props
}: Omit<React.ComponentProps<typeof SliderPrimitive.Root>, 'value' | 'defaultValue'> & {
  value?: number
  defaultValue?: number
}) {
  return (
    <SliderPrimitive.Root
      value={value === undefined ? undefined : [value]}
      defaultValue={defaultValue === undefined ? undefined : [defaultValue]}
      className={cn(
        'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 h-5',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm outline-none transition-[box-shadow] hover:ring-4 hover:ring-ring/30 focus-visible:ring-4 focus-visible:ring-ring/40" />
    </SliderPrimitive.Root>
  )
}
export { Slider }
