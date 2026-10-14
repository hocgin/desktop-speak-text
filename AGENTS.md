# Desktop Speak Text - Agents 使用指南

本文档说明了如何使用 Claude Code Agents 来开发和维护 Desktop Speak Text 项目。

## 项目概述

**Desktop Speak Text** 是一个基于 Electron 的桌面文本转语音应用，支持多种语音合成引擎和 AI 模型集成。

### 技术架构

- **架构模式**: Electron 三层架构 (Main Process / Preload / Renderer)
- **前端框架**: React 19 + TypeScript
- **UI 组件库**: shadcn/ui (Radix UI + Tailwind CSS v4，组件位于 src/renderer/src/components/ui)
- **路由**: React Router DOM + electron-router-dom
- **数据持久化**: Drizzle ORM + SQLite
- **语音合成**: edge-tts-universal
- **状态管理**: electron-store
- **国际化**: i18next + i18next-electron-fs-backend

### 目录结构

```
src/
├── main/           # 主进程 (Electron Main Process)
├── preload/        # 预加载脚本 (Preload Scripts)
├── renderer/       # 渲染进程 (React UI)
└── lib/           # 共享库模块
    ├── deeplink/  # 深度链接处理
    ├── i18n/      # 国际化
    ├── shell/     # Shell 命令执行
    ├── store/     # 持久化存储
    ├── toolbar/   # 工具栏控制
    ├── uikit/     # UI 组件库
    └── user/      # 用户认证 (JWT)
```

## 可用 Agents

### 1. Planner Agent (规划 Agent)

**用途**: 复杂功能实现规划、架构重构设计

**适用场景**:
- 实现新的语音合成引擎集成
- 设计多窗口状态同步机制
- 规划 AI 模型管理功能
- 设计离线/在线语音切换策略

**示例**:
```
请使用 planner agent 规划如何实现一个新的语音引擎集成功能
```

### 2. TDD Guide Agent (测试驱动开发 Agent)

**用途**: 新功能测试先行、Bug 修复测试

**适用场景**:
- 添加新的语音合成 API 测试
- 测试用户登录流程
- 测试数据库迁移脚本
- 测试 IPC 通信

**测试类型**:
- **单元测试**: 工具函数、数据转换逻辑
- **集成测试**: IPC 通信、数据库操作
- **E2E 测试**: 关键用户流程 (使用 Playwright)

**示例**:
```
请使用 tdd-guide agent 为文本转语音功能编写测试
```

### 3. Code Reviewer Agent (代码审查 Agent)

**用途**: 代码质量审查、最佳实践检查

**适用场景**:
- 提交代码前自动审查
- 检查 TypeScript 类型安全
- 验证错误处理完整性
- 检查 React 组件性能

**审查重点**:
- IPC 通信安全性
- SQLite 查询性能
- React 组件渲染优化
- 内存泄漏风险

**示例**:
```
请使用 code-reviewer agent 审查最近的代码变更
```

### 4. Security Reviewer Agent (安全审查 Agent)

**用途**: 安全漏洞检查、敏感数据处理

**适用场景**:
- 审查用户认证实现
- 检查 IPC 通信安全
- 验证存储的敏感数据加密
- 检查 Deep Link 处理安全性

**安全检查清单**:
- [ ] JWT Token 安全存储
- [ ] IPC 通信参数验证
- [ ] SQL 注入防护 (Drizzle ORM 已防护)
- [ ] Deep Link 参数验证
- [ ] 用户输入清理

**示例**:
```
请使用 security-reviewer agent 审查登录功能的安全性
```

### 5. Build Error Resolver Agent (构建错误解决 Agent)

**用途**: 构建失败诊断、依赖问题解决

**适用场景**:
- electron-vite 构建失败
- TypeScript 类型错误
- 依赖冲突解决
- 打包错误 (electron-builder)

**常见问题**:
- Node native 模块编译 (better-sqlite3)
- Electron 版本兼容性
- Preload 脚本类型定义
- Renderer 进程 Node.js 集成

**示例**:
```
请使用 build-error-resolver agent 解决构建错误
```

### 6. E2E Runner Agent (端到端测试 Agent)

**用途**: 关键用户流程测试

**适用场景**:
- 测试完整登录流程
- 测试文本转语音工作流
- 测试窗口切换 (主窗口/菜单栏)
- 测试配置持久化

**关键测试流程**:
1. 用户登录 → 验证 → 保存 Token
2. 输入文本 → 选择语音 → 播放
3. 修改配置 → 重启应用 → 验证配置
4. Deep Link 唤起 → 处理登录回调

**示例**:
```
请使用 e2e-runner agent 测试登录和文本转语音流程
```

### 7. Refactor Cleaner Agent (重构清理 Agent)

**用途**: 死代码清理、架构优化

**适用场景**:
- 移除未使用的依赖
- 清理重复代码
- 优化文件结构
- 统一代码风格

**重构建议**:
- 将 lib/ 目录模块化为独立包
- 统一 IPC 通信模式
- 提取共享类型定义
- 优化渲染性能

**示例**:
```
请使用 refactor-cleaner agent 清理未使用的代码
```

### 8. Doc Updater Agent (文档更新 Agent)

**用途**: 更新项目文档、API 文档

**适用场景**:
- 更新 README.md
- 生成 API 文档
- 更新架构文档
- 编写贡献指南

**示例**:
```
请使用 doc-updater agent 更新项目文档
```

## 核心模块 Agent 使用建议

### Main Process (主进程)

**关键文件**:
- `src/main/index.ts` - 应用入口
- `src/main/db.ts` - 数据库连接
- `src/main/factories.ts` - 窗口工厂

**推荐 Agents**:
- **security-reviewer**: 审查 IPC 通信安全
- **code-reviewer**: 检查异步错误处理
- **tdd-guide**: 测试数据库迁移

### Preload (预加载)

**关键文件**:
- `src/preload/index.ts` - 预加载入口

**推荐 Agents**:
- **security-reviewer**: 检查 API 暴露安全性
- **code-reviewer**: 验证 contextBridge 使用正确性

### Renderer (渲染进程)

**关键文件**:
- `src/renderer/src/index.tsx` - React 入口
- `src/renderer/src/router.config.tsx` - 路由配置
- `src/renderer/src/pages/` - 页面组件

**推荐 Agents**:
- **code-reviewer**: 检查 React 性能优化
- **e2e-runner**: 测试用户交互流程
- **tdd-guide**: 组件单元测试

### Lib Modules (共享库)

#### i18n (国际化)
- **tdd-guide**: 测试语言切换逻辑
- **refactor-cleaner**: 清理未使用的翻译

#### shell (Shell 执行)
- **security-reviewer**: 命令注入安全检查
- **tdd-guide**: 测试命令执行和日志

#### store (存储)
- **code-reviewer**: 检查存储访问性能
- **tdd-guide**: 测试存储持久化

#### user (用户认证)
- **security-reviewer**: JWT 安全审计
- **tdd-guide**: 测试 Token 解析和验证

## 典型工作流程

### 新功能开发

```
1. planner agent - 规划实现方案
2. tdd-guide agent - 编写测试
3. [实现功能]
4. code-reviewer agent - 审查代码
5. security-reviewer agent - 安全检查
6. e2e-runner agent - E2E 测试
7. [提交代码]
```

### Bug 修复

```
1. [定位问题]
2. tdd-guide agent - 编写失败测试
3. [修复 Bug]
4. tdd-guide agent - 验证测试通过
5. code-reviewer agent - 检查修复质量
```

### 架构重构

```
1. planner agent - 设计重构方案
2. [实施重构]
3. refactor-cleaner agent - 清理死代码
4. code-reviewer agent - 验证架构改进
5. e2e-runner agent - 回归测试
```

## Agent 组合使用

### 并行执行

对于独立任务，使用并行 Agent 提高效率:

```
同时启动 3 个 agents:
1. security-reviewer - 审查认证模块
2. code-reviewer - 审查 UI 组件
3. tdd-guide - 为新功能编写测试
```

### 顺序执行

对于依赖性任务，按顺序使用:

```
planner → 实现 → tdd-guide → code-reviewer → security-reviewer → e2e-runner
```

## 注意事项

1. **IPC 通信安全**: 始终验证来自 Renderer 的参数
2. **数据库性能**: 使用 prepared statements (Drizzle ORM 自动处理)
3. **内存管理**: 及时清理不再使用的监听器
4. **类型安全**: 充分利用 TypeScript 类型系统
5. **测试覆盖**: 保持 80% 以上的测试覆盖率

## 扩展阅读

- [Electron 安全最佳实践](https://www.electronjs.org/docs/latest/tutorial/security)
- [React 性能优化](https://react.dev/learn/render-and-commit)
- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [i18next Electron 集成](https://github.com/i18next/i18next-electron-fs-backend)
