import { useEffect, useState } from 'react'
import { useUpdate, useUpdateEffect } from 'ahooks'

export function useStore() {
  return {
    get(name: string) {
      return window.electron.store.get(name)
    },
    set(name: string, value: any) {
      return window.electron.store.set(name, value)
    }
  } as const
}

export function useStoreName(name: string) {
  const [data, setData] = useState(() => window.electron.store.get(name))
  const refresh = (...args) => {
    let userinfo = window.electron.store.get(name)
    console.log('update', { userinfo, args })
    setData(userinfo)
  }

  useEffect(() => {
    window.electron.ipcRenderer.on(`store:${name}:update`, refresh)
  }, [])

  return {
    data,
    set: (data) => {
      setData(data)
      window.electron.store.set(name, data)
    }
  }
}
