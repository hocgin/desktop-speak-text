import * as React from 'react'
import { AlertDialog as P } from 'radix-ui'
import { cn } from '@/renderer/lib/utils.js'
import { buttonVariants } from './button.js'

const AlertDialog = P.Root
const AlertDialogTrigger = P.Trigger

function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <P.Content
        className={cn(
          'fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border bg-card p-6 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-md',
          className
        )}
        {...props}
      />
    </P.Portal>
  )
}
function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 text-left', className)} {...props} />
}
function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
}
function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof P.Title>) {
  return <P.Title className={cn('text-lg font-semibold', className)} {...props} />
}
function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof P.Description>) {
  return <P.Description className={cn('text-sm text-muted-foreground', className)} {...props} />
}
function AlertDialogAction({
  className,
  destructive,
  ...props
}: React.ComponentProps<typeof P.Action> & { destructive?: boolean }) {
  return (
    <P.Action
      className={cn(buttonVariants({ variant: destructive ? 'destructive' : 'default' }), className)}
      {...props}
    />
  )
}
function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof P.Cancel>) {
  return <P.Cancel className={cn(buttonVariants({ variant: 'outline' }), className)} {...props} />
}
export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
}
