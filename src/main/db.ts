import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../lib/schema.js'
import fs from 'fs'
import { app } from 'electron'
import path from 'path'

let isDev = import.meta.env.DEV
const dbPath = isDev
  ? path.resolve(__dirname, '../../sqlite.db') // 假设开发环境数据库文件放在项目根目录
  : path.join(app.getPath('userData'), 'data.db')

const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
  console.log('[DB] 创建数据库目录:', dbDir)
}

const sqlite = new Database(dbPath)
console.log('[DB] 数据库路径:', dbPath)

export const db = drizzle(sqlite, { schema })

function toDrizzleResult(row: Record<string, any>)
function toDrizzleResult(rows: Record<string, any> | Array<Record<string, any>>) {
  if (!rows) {
    return []
  }
  if (Array.isArray(rows)) {
    return rows.map((row) => {
      return Object.keys(row).map((key) => row[key])
    })
  } else {
    return Object.keys(rows).map((key) => rows[key])
  }
}

export const execute = async (_e, sqlstr, params, method) => {
  const result = sqlite.prepare(sqlstr)
  const ret = result[method](...params)
  return toDrizzleResult(ret)
}

let migrationResolve: () => void
let migrationReject: (error: unknown) => void
const migrationReady = new Promise<void>((resolve, reject) => {
  migrationResolve = resolve
  migrationReject = reject
})
void migrationReady.catch(() => {})
export const ensureDatabaseReady = () => migrationReady
export const runMigrate = async () => {
  try {
    const migrationsFolder = path.join(__dirname, '../../drizzle')
    console.log('[DB] 开始数据库迁移, 迁移文件夹:', migrationsFolder)
    console.log('[DB] 迁移文件夹是否存在:', fs.existsSync(migrationsFolder))

    // 检查迁移文件夹中的文件
    if (fs.existsSync(migrationsFolder)) {
      const files = fs.readdirSync(migrationsFolder)
      console.log('[DB] 迁移文件夹内容:', files)

      // 检查 meta 文件夹
      const metaPath = path.join(migrationsFolder, 'meta')
      if (fs.existsSync(metaPath)) {
        const metaFiles = fs.readdirSync(metaPath)
        console.log('[DB] meta 文件夹内容:', metaFiles)
      }
    } else {
      console.error('[DB] 迁移文件夹不存在:', migrationsFolder)
      throw new Error(`迁移文件夹不存在: ${migrationsFolder}`)
    }

    await migrate(db, { migrationsFolder })
    migrationResolve()
    console.log('[DB] 数据库迁移成功')
  } catch (error) {
    migrationReject(error)
    console.error('[DB] 数据库迁移失败:', error)
    throw error
  }
}
