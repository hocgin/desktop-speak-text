import { useEffect } from 'react'
import { Channel } from './constant.js'
import { toast } from 'sonner'

export function UIProvider({ children }: { children?: any }) {
  useEffect(() => {
    window.electron.ipcRenderer.on(Channel.TOAST_ERROR, (_, args) => {
      toast.error(`Error occurred: ${args}`)
    })
    return () => {
      window.electron.ipcRenderer.removeAllListeners(Channel.TOAST_ERROR)
    }
  }, [])

  return <>{children}</>
}
