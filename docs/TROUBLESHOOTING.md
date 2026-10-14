# 故障排除指南

## ERR_FILE_NOT_FOUND 错误

### 错误信息
```
Failed to load URL: file:///Users/hocgin/Projects/desktop-speak-text/out/renderer/index.html#/main with error: ERR_FILE_NOT_FOUND
```

### 原因
这个错误通常发生在以下情况：
1. 项目没有正确构建（`out/renderer/` 目录不存在）
2. 路由配置错误（尝试使用开发服务器端口但服务器未运行）

### 解决方案

#### 1. 重新构建项目

```bash
# 清理旧构建
rm -rf out/

# 重新构建
pnpm build

# 验证构建输出
ls -la out/renderer/
```

应该看到：
```
index.html
assets/
  └── index-*.js
  └── index-*.css
```

#### 2. 检查路由配置

确认 `src/lib/electron-router-dom.ts` 配置正确：

```typescript
const isDev = process.env.NODE_ENV === 'development'

export const { Router, registerRoute, settings } = createElectronRouter({
  port: isDev ? 5173 : undefined,  // 关键：生产环境不设置端口
  types: {
    ids: ['main', 'menubar']
  }
})
```

#### 3. 使用正确的命令运行

**开发环境**（日常开发）：
```bash
pnpm dev
```
- NODE_ENV=development
- 使用开发服务器（localhost:5173）
- 支持热更新
- 自动打开开发者工具

**生产环境预览**（测试构建）：
```bash
pnpm start
```
- NODE_ENV=production
- 使用 file:// 协议
- 不需要开发服务器
- 模拟生产环境

#### 4. 验证环境变量

创建一个测试脚本检查环境变量：

```javascript
// test-env.js
console.log('NODE_ENV:', process.env.NODE_ENV)
console.log('Is Dev:', process.env.NODE_ENV === 'development')
```

在主进程中添加：
```typescript
console.log('[Main] NODE_ENV:', process.env.NODE_ENV)
console.log('[Main] Is Dev:', process.env.NODE_ENV === 'development')
```

## 常见问题

### Q: 修改代码后需要重新构建吗？
A:
- **开发环境**（`pnpm dev`）：不需要，支持热更新
- **生产预览**（`pnpm start`）：需要，运行 `pnpm build`

### Q: 如何知道当前使用的是什么模式？
A: 查看控制台日志：
- 开发模式：会显示 "localhost:5173" 相关日志
- 生产模式：会显示 "file://" 相关日志

### Q: 跨平台兼容性
A: 使用 `cross-env` 确保跨平台环境变量设置：
```json
{
  "scripts": {
    "start": "cross-env NODE_ENV=production electron-vite preview",
    "dev": "cross-env NODE_ENV=development electron-vite dev"
  }
}
```

## 快速检查清单

- [ ] 运行了 `pnpm build`
- [ ] `out/renderer/index.html` 存在
- [ ] 路由配置中 `port` 在生产环境为 `undefined`
- [ ] 使用正确的命令（dev 或 start）
- [ ] 检查控制台日志确认环境变量正确
