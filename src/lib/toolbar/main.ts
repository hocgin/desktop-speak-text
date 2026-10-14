import { BrowserWindow, ipcMain } from 'electron'

export function registerToolbarControl(): void {
  ipcMain.on(`window-control:minimize`, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.minimize()
  })
  ipcMain.on(`window-control:maximize`, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })
  ipcMain.on(`window-control:close`, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.close()
  })
}
