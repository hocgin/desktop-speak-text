import styles from './index.module.css'
import { CircleUser } from 'lucide-react'
import { mainProtocol } from '@/lib/deeplink/config.js'
import { useUserinfo } from '@/lib/user/renderer.js'

export function UserInfo() {
  let { data } = useUserinfo()
  return (
    <button
      className={styles.avatar}
      onClick={() => {
        if (data) return
        let url = `https://sso.hocgin.com/?redirectUrl=${mainProtocol}://login`
        window.electron.ipcRenderer.send('openExternal', url)
      }}
    >
      {data?.image ? (
        <img src={data.image} alt="avatar" className="size-6 rounded-full" />
      ) : (
        <CircleUser size={24} />
      )}
    </button>
  )
}
