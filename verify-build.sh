#!/bin/bash
# 验证构建和预览是否正常工作

echo "=== 清理旧的构建输出 ==="
rm -rf out/

echo ""
echo "=== 开始构建 ==="
pnpm build

echo ""
echo "=== 检查构建输出 ==="
if [ -f "out/renderer/index.html" ]; then
    echo "✓ out/renderer/index.html 存在"
else
    echo "✗ out/renderer/index.html 不存在"
    exit 1
fi

if [ -f "out/main/index.js" ]; then
    echo "✓ out/main/index.js 存在"
else
    echo "✗ out/main/index.js 不存在"
    exit 1
fi

if [ -f "out/preload/index.mjs" ]; then
    echo "✓ out/preload/index.mjs 存在"
else
    echo "✗ out/preload/index.mjs 不存在"
    exit 1
fi

echo ""
echo "=== 检查环境变量配置 ==="
echo "开发环境 (pnpm dev): NODE_ENV=development"
echo "生产预览 (pnpm start): NODE_ENV=production"

echo ""
echo "=== 验证完成 ==="
echo "现在可以运行以下命令测试："
echo "  - 开发模式: pnpm dev"
echo "  - 生产预览: pnpm start"
