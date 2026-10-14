# Windows 平台修复总结

## 已修复的问题

### 1. ✅ 数据库表不存在 (no such table: speak_records)

**问题**: 打包后 data.db 为 0kb，表未创建

**修复**:
- 调整初始化顺序：在注册 IPC handler 前完成数据库迁移
- 优化迁移文件路径解析，支持 asar/asarUnpack
- 添加回退方案：迁移失败时直接执行 SQL 创建表
- 详细的错误日志和验证

**文件**: `src/main/db.ts`, `src/main/index.ts`

---

### 2. ✅ 日志文件写入失败 (ENOENT: app.log)

**问题**: 试图在 asar 包内写入日志文件，asar 是只读的

**错误路径**:
```
D:\test_00\SpeakText\resources\app.asar\out\main\app.log
```

**修复**:
- 将日志文件移动到用户数据目录
- 添加完整的错误处理（try-catch）
- 确保目录存在

**新路径**:
```
%APPDATA%\desktop-speak-text\shell.log
```

**文件**: `src/lib/shell/main.ts`

---

### 3. ✅ 原生模块架构不匹配

**问题**: better-sqlite3 在 Windows 上架构错误

**修复**:
- electron-builder.yml: `npmRebuild: true`
- package.json: 添加 `better-sqlite3` 到 `onlyBuiltDependencies`
- 使用 `electron-rebuild` 为每个架构重新编译

---

## 构建和测试

### 在 macOS 上构建 Windows 版本

```bash
# 方式 1: 使用构建脚本（推荐）
./build-win.sh

# 方式 2: 手动执行
pnpm run build
pnpm run build:win
```

### 在 Windows 上测试

1. **安装应用**
   ```powershell
   # 运行安装程序
   .\SpeakText-1.0.0-ia32.exe  # 32位
   # 或
   .\SpeakText-1.0.0-x64.exe   # 64位
   ```

2. **检查日志输出**
   - 启动应用后，控制台应该显示：
     ```
     [DB] 数据库路径: C:\Users\{用户名}\AppData\Roaming\desktop-speak-text\data.db
     [DB] 数据库连接成功
     [DB] 开始数据库迁移
     [DB] 数据库迁移成功
     [Shell] 日志路径: C:\Users\{用户名}\AppData\Roaming\desktop-speak-text\shell.log
     ```

3. **验证数据库文件**
   ```powershell
   # 检查数据库文件是否创建且大小正常
   dir "%APPDATA%\desktop-speak-text\data.db"

   # 应该显示非零大小（例如 24KB）
   ```

4. **测试功能**
   - 测试生成语音功能
   - 应该不再出现 "no such table" 错误
   - 日志功能正常工作

---

## 修复前后对比

| 问题 | 修复前 | 修复后 |
|------|--------|--------|
| 数据库表 | ❌ 不存在 | ✅ 自动创建 |
| 数据库大小 | ❌ 0 KB | ✅ ~24 KB |
| 日志文件 | ❌ asar 内部（只读） | ✅ 用户数据目录（可写） |
| 原生模块 | ❌ 架构不匹配 | ✅ 自动为各架构编译 |
| 错误处理 | ❌ Promise 未捕获 | ✅ 完整的 try-catch |

---

## 关键修复代码

### 1. 数据库迁移顺序 (src/main/index.ts)

```typescript
app.whenReady().then(async () => {
  // ✅ 先执行数据库迁移
  await runMigrate()

  // ✅ 再注册数据库相关的 IPC handler
  ipcMain.handle('db:execute', execute)
})
```

### 2. 日志文件路径 (src/lib/shell/main.ts)

```typescript
// ❌ 修复前：在 asar 内部（只读）
const logPath = path.join(__dirname, 'app.log')

// ✅ 修复后：用户数据目录（可写）
const logPath = path.join(app.getPath('userData'), 'shell.log')
```

### 3. 错误处理 (src/lib/shell/main.ts)

```typescript
export function initShellMain(mainWindow) {
  try {
    // 确保目录存在
    const logDir = path.dirname(logPath)
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    // 所有文件操作都添加错误处理
    fs.watch(logPath, { encoding: 'utf-8' }, () => {
      try {
        const data = fs.readFileSync(logPath, 'utf-8')
        mainWindow.webContents.send('shell:log-update', data)
      } catch (error) {
        console.error('[Shell] 读取日志文件失败:', error)
      }
    })
  } catch (error) {
    console.error('[Shell] 初始化失败:', error)
  }
}
```

---

## 故障排查

### 如果数据库表仍然不存在

1. 检查日志输出中的 `[DB]` 标签
2. 确认迁移文件是否正确打包：
   ```powershell
   dir "{安装目录}\resources\app.asar.unpacked\drizzle"
   ```
3. 手动检查数据库：
   ```powershell
   sqlite3 "%APPDATA%\desktop-speak-text\data.db" ".tables"
   ```

### 如果仍然出现权限错误

1. 以管理员身份运行应用
2. 检查 `%APPDATA%\desktop-speak-text` 目录的权限
3. 确保应用有写入权限

---

## 版本信息

- Electron: v35.3.0
- better-sqlite3: v11.10.0
- Node.js: v18+ (Electron 内置)
- 支持平台: Windows (ia32, x64), macOS, Linux
