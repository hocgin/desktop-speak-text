import { ipcMain, app } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

// 日志文件放在用户数据目录，避免 asar 只读问题
const logPath = path.join(app.getPath('userData'), 'shell.log')
console.log('[Shell] 日志路径:', logPath)

let subprocess
export function initShellMain(mainWindow) {
  try {
    // 确保日志文件存在
    const logDir = path.dirname(logPath)
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '')
    }

    // 监听日志文件变化
    fs.watch(logPath, { encoding: 'utf-8' }, () => {
      if (mainWindow) {
        try {
          const data = fs.readFileSync(logPath, 'utf-8')
          mainWindow.webContents.send('shell:log-update', data)
        } catch (error) {
          console.error('[Shell] 读取日志文件失败:', error)
        }
      }
    })

    // IPC listener
    ipcMain.on('shell:get-log', async () => {
      if (mainWindow) {
        try {
          const data = fs.readFileSync(logPath, 'utf-8')
          mainWindow.webContents.send('shell:log-update', data)
        } catch (error) {
          console.error('[Shell] 获取日志失败:', error)
        }
      }
    })

    ipcMain.on('shell:exec', async (_, cmd) => {
      try {
        fs.appendFileSync(logPath, `\n${cmd}`)
        if (subprocess) {
          subprocess.kill()
        }
        subprocess = spawn(cmd, { shell: true, env: process.env });

        subprocess.stdout.on('data', data => {
          fs.appendFileSync(logPath, data.toString())
        })

        subprocess.stderr.on('data', data => {
          fs.appendFileSync(logPath, data.toString())
        })

        subprocess.on('close', data => {
          fs.appendFileSync(logPath, data.toString())
        })
      } catch (error) {
        console.error('[Shell] 执行命令失败:', error)
        fs.appendFileSync(logPath, `\n错误: ${error}\n`)
      }
    })
  } catch (error) {
    console.error('[Shell] 初始化失败:', error)
  }
}
