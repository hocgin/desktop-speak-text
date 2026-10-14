import { Control } from './control.js'
import logo from '@/renderer/assets/icon.png'
import { UpdateButton } from '@/renderer/components/update/UpdateButton.js'

const isMac =
  typeof window !== 'undefined' && (window as any).process?.platform === 'darwin'

/** 顶部栏：整条可拖拽，交互元素自行设置 no-drag */
export function Toolbar({ style }: any) {
  return (
    <header
      className="flex h-10 w-full shrink-0 items-center justify-between gap-3 border-b bg-card/80 pr-0 pl-3 backdrop-blur [-webkit-app-region:drag]"
      style={style}
    >
      <div className="flex min-w-0 items-center gap-3">
        {isMac && <Control />}
        <div className="flex items-center gap-2 select-none">
          <img src={logo} alt="logo" className="size-5 rounded-[5px]" draggable={false} />
          <span className="text-[13px] font-semibold tracking-tight">Speak Text</span>
        </div>
      </div>

      <div className="flex h-full items-center gap-2">
        <div className="[-webkit-app-region:no-drag]">
          <UpdateButton />
        </div>
        {!isMac && <Control />}
      </div>
    </header>
  )
}
