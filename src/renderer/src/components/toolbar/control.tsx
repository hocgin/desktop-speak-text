import { Minus, Square, X } from 'lucide-react'
import { cn } from '@/renderer/lib/utils.js'

const isMac = typeof window !== 'undefined' && (window as any).process?.platform === 'darwin'

const send = (action: 'close' | 'minimize' | 'maximize') =>
  window.electron.ipcRenderer.send(`window-control:${action}`)

const noDrag = '[-webkit-app-region:no-drag]'

// macOS 红黄绿圆点，悬停整组时显示图标
function MacOSControl() {
  const dots = [
    { type: 'close', color: 'bg-[#ff5f57] border-[#e0443e]', icon: <X strokeWidth={3} /> },
    { type: 'minimize', color: 'bg-[#ffbd2e] border-[#dea123]', icon: <Minus strokeWidth={3} /> },
    { type: 'maximize', color: 'bg-[#28c940] border-[#1aab29]', icon: <Square strokeWidth={3} /> }
  ] as const
  return (
    <div className={cn('group flex items-center gap-2', noDrag)}>
      {dots.map((d) => (
        <button
          key={d.type}
          aria-label={d.type}
          onClick={() => send(d.type)}
          className={cn(
            'flex size-3 items-center justify-center rounded-full border-[0.5px] text-black/60 [&_svg]:size-2 [&_svg]:opacity-0 group-hover:[&_svg]:opacity-100',
            d.color
          )}
        >
          {d.icon}
        </button>
      ))}
    </div>
  )
}

// Windows / Linux：右侧矩形按钮
function WindowsControl() {
  const base =
    'flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
  return (
    <div className={cn('flex h-full', noDrag)}>
      <button aria-label="minimize" className={base} onClick={() => send('minimize')}>
        <Minus size={14} />
      </button>
      <button aria-label="maximize" className={base} onClick={() => send('maximize')}>
        <Square size={11} />
      </button>
      <button
        aria-label="close"
        className={cn(base, 'hover:bg-[#e81123] hover:text-white')}
        onClick={() => send('close')}
      >
        <X size={15} />
      </button>
    </div>
  )
}

export function Control() {
  return isMac ? <MacOSControl /> : <WindowsControl />
}
