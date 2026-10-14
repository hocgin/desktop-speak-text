import { ipcRenderer } from 'electron'

export function initShellPreload(obj: any = {}) {
  let shell = {
    exec(cmd: string) {
      console.log(`initShellPreload.exec = ${cmd}`)
      return ipcRenderer.send('shell:exec', cmd)
    },
    getLog(){
      ipcRenderer.send('shell:get-log')
    },
    onUpdate: cb => ipcRenderer.on('shell:log-update', (_, data) => cb(data))
  }
  return Object.assign(obj, { shell })
}
