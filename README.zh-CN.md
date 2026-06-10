# ast-grep-mcp

[![CI](https://github.com/ThinkDonk/ast-grep-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/ThinkDonk/ast-grep-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@chousyn/ast-grep-mcp.svg)](https://www.npmjs.com/package/@chousyn/ast-grep-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

独立 MCP 服务器，封装 [ast-grep](https://ast-grep.github.io/) 实现 AI 优化的 AST 代码搜索与替换，支持 26 种语言。

提取自 [oh-my-opencode](https://github.com/code-yeongyu/oh-my-openagent)。

[English](./README.md)

## 特性

- **AI 优化的工具描述**：明确提醒 LLM ast-grep 不是正则表达式
- **空结果模式提示**：自动检测正则误用和语言特定错误（Python、JS/TS/TSX、Go、Rust、C#）
- **工作区沙箱**：防止路径遍历、参数注入和空字节注入
- **输出截断保护**：500 条匹配 / 1 MB / 5 分钟上限，截断时自动修复 JSON
- **安全替换**：默认 dry-run 预览，两遍写入（先搜索预览，再 --update-all 实际修改）
- **Bun/Node 兼容**：spawn shim 同时支持两种运行时

## 安装

```bash
npm install
npm run build
```

## 使用

### 作为 MCP 服务器（stdio）

```bash
node dist/cli.js
```

### 在 OpenCode 中配置

添加到 `opencode.json`：

```json
{
  "mcp": {
    "ast-grep": {
      "type": "local",
      "command": ["node", "path/to/ast-grep-mcp/dist/cli.js"],
      "enabled": true
    }
  }
}
```

无需设置 `AST_GREP_WORKSPACE` — 默认使用当前工作目录（即你在 OpenCode 中打开的项目）。

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `AST_GREP_WORKSPACE` | `process.cwd()` | 覆盖工作区目录 |
| `AST_GREP_DISABLED_TOOLS` | （无） | 逗号分隔的禁用工具列表（如 `search` 或 `replace`） |

## 工具

### search

按 AST 结构搜索代码。参数：
- `pattern`（必填）：使用 `$VAR` 和 `$$$` 通配符的 AST 模式
- `lang`（必填）：目标语言
- `paths`（可选）：搜索路径
- `globs`（可选）：包含/排除的 glob 模式
- `context`（可选）：每个匹配周围的上下文行数

空结果时自动触发模式提示诊断（正则误用 / 语言特定错误）。

### replace

按 AST 模式替换代码。默认 dry-run。参数：
- `pattern`（必填）：要匹配的 AST 模式
- `rewrite`（必填）：替换模式
- `lang`（必填）：目标语言
- `paths`（可选）：搜索路径
- `globs`（可选）：包含/排除的 glob 模式
- `dryRun`（可选）：预览不实际修改（默认：true）

## 支持的语言

bash, c, cpp, csharp, css, elixir, go, haskell, hcl, html, java, javascript, json, kotlin, lua, nix, php, python, ruby, rust, scala, solidity, swift, typescript, tsx, yaml

## 架构

- **MCP 协议**：从零实现 JSON-RPC 2.0（无 SDK 依赖），支持 initialize、tools/list、tools/call、ping
- **两遍替换**：第一遍搜索预览，第二遍 `--update-all` 实际写入文件
- **工作区沙箱**：所有路径经 realpath 解析，必须位于工作区内。三层防护：路径遍历（`../`）、参数注入（以 `-` 开头）、空字节注入（`\0`）
- **输出截断**：匹配数上限 500 条、输出上限 1 MB、超时上限 5 分钟。截断的 JSON 通过找到最后一个有效 `},` 边界进行修复
- **sg 二进制探测**：三级查找：`@ast-grep/cli` npm 包 → 平台特定包 → Homebrew
- **Bun/Node 兼容**：`bun-spawn-shim.ts` 检测运行时，提供统一的 ReadableStream 接口

## 已知问题

- **无集成测试**：单元测试覆盖 MCP 处理器和模式提示，但无 sg 二进制执行的端到端测试
- **process-output-timeout.ts 使用 Response API**：需要 Node 18+，Node 16 已 EOL 不再支持
- **.gitignore 模式重叠**：`*.d.ts` 和 `*.js.map` 排除规则全局生效（包括 `src/`），但这是预期行为 — 只有 `dist/` 应包含构建产物

## 开发

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # esbuild 打包到 dist/cli.js
npm test            # vitest run
npm run start       # node dist/cli.js
```

## 许可证

MIT
