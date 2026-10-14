# GitHub Actions Release 修复设计

## 背景

`v1.0.2` 的三平台发布工作流在构建成功后失败。失败步骤为
`softprops/action-gh-release`，GitHub API 返回 `403 Resource not accessible by
integration`。当前工作流未声明 `contents: write` 权限，并由三个矩阵 Job
并发操作同一个 Draft Release。

现有递归发布规则 `dist/**/*.yml` 还会匹配 macOS 应用包内部的
`app-update.yml`，将运行时文件误当成发布资产。

## 目标

- 允许工作流使用内置 `GITHUB_TOKEN` 创建 Draft Release 和上传资产。
- 保持 Linux、macOS、Windows 并行构建。
- 只由一个 Job 写入 GitHub Release，避免并发创建和同名资产竞争。
- 仅发布顶层安装包、更新元数据和 blockmap 文件。
- 任一平台构建失败时，不创建不完整的 Draft Release。
- 安装包版本与触发工作流的 `v*.*.*` 标签一致。

## 方案

工作流分为两个阶段：

1. `build` 矩阵 Job 在三个操作系统上安装依赖，将标签去掉 `v` 前缀后写入
   runner 工作区的 `package.json` 作为构建版本，再构建对应安装包，并使用
   `actions/upload-artifact` 上传 `dist` 顶层的发布文件。artifact 名称包含
   runner OS，确保三平台互相隔离。
2. `release` Job 通过 `needs: build` 等待全部平台成功，下载并合并三个
   artifact，然后使用 `softprops/action-gh-release` 一次性创建 Draft Release
   和上传资产。

`build` Job 声明 `contents: read`，`release` Job 单独声明 `contents: write`。
构建 Job 不直接调用 Releases API；Release Job 使用 GitHub 自动提供的
`GITHUB_TOKEN`，不依赖自定义 `ACCESS_TOKEN` secret。

`actions/download-artifact` 使用 `pattern: release-*`、固定目标目录 `dist` 和
`merge-multiple: true`，使三个 artifact 的文件都位于 Release glob 所指向的
顶层目录。

工作流使用以仓库和标签为键的 `concurrency` 分组，并设置
`cancel-in-progress: false`。同一标签的重跑或重推按顺序执行，避免同时修改
同一个 Draft Release。

发布文件匹配限制在 `dist` 顶层，包括：

- Windows: `*.exe`
- macOS: `*.dmg`, `*.zip`
- Linux: `*.AppImage`, `*.deb`, `*.rpm`, `*.snap`, `*.tar.gz`
- 自动更新: `latest*.yml`, `*.blockmap`

`if-no-files-found: error` 和 `fail_on_unmatched_files: false` 配合使用：每个平台
必须至少产生发布 artifact，但不要求每个平台生成所有格式。

## 错误处理

- 矩阵保留默认 fail-fast 行为；任一构建失败会阻止 `release` Job。
- artifact 上传找不到任何文件时立即失败，避免产生空发布。
- Release 上传失败可能留下部分填充的 Draft Release；构建 artifact 仍会保留，
  重新运行时通过 `overwrite_files: true` 覆盖同名资产并补齐缺失资产。

## 验证

- 解析工作流 YAML，确认结构有效。
- 本地运行 `pnpm run build`，验证应用编译不受工作流调整影响。
- 检查工作流 diff，确认 Release 写操作只有一个 Job。
- 推送新的语义版本标签后，确认三平台构建成功且 Draft Release 只包含预期资产。

