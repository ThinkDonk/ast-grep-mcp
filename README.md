# ast-grep-mcp

[![CI](https://github.com/ThinkDonk/ast-grep-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/ThinkDonk/ast-grep-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ast-grep-mcp.svg)](https://www.npmjs.com/package/ast-grep-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[中文文档](./README.zh-CN.md)

Standalone MCP server wrapping [ast-grep](https://ast-grep.github.io/) for AI-optimized AST code search and replace across 26 languages.

Extracted from [oh-my-opencode](https://github.com/code-yeongyu/oh-my-openagent).

## Features

- **AI-optimized tool descriptions**: Explicitly warns LLMs that ast-grep is NOT regex
- **Pattern hints on empty results**: Detects regex misuse and language-specific mistakes (Python, JS/TS/TSX, Go, Rust, C#)
- **Workspace sandboxing**: Prevents path traversal, argument injection, and null byte injection
- **Output truncation**: 500 match / 1 MB / 5 min caps with JSON repair on truncated output
- **Safe replace**: Dry-run by default, two-pass write (search preview then --update-all)
- **Bun/Node compatibility**: Spawn shim handles both runtimes

## Installation

```bash
npm install
npm run build
```

## Usage

### As MCP Server (stdio)

```bash
node dist/cli.js
```

### Configure in OpenCode

Add to your `opencode.json`:

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

No `AST_GREP_WORKSPACE` needed — it defaults to the current working directory (i.e., whichever project you open in OpenCode).

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AST_GREP_WORKSPACE` | `process.cwd()` | Override workspace directory for all path operations |
| `AST_GREP_DISABLED_TOOLS` | (none) | Comma-separated list of tools to disable (e.g. `search` or `replace`) |

## Tools

### search

Search code by AST structure. Parameters:
- `pattern` (required): AST pattern using `$VAR` and `$$$` wildcards
- `lang` (required): Target language
- `paths` (optional): Paths to search
- `globs` (optional): Include/exclude globs
- `context` (optional): Context lines around matches

Empty results automatically trigger pattern-hint diagnostics (regex misuse / language-specific mistakes).

### replace

Rewrite code by AST pattern. Dry-run by default. Parameters:
- `pattern` (required): AST pattern to match
- `rewrite` (required): Replacement pattern
- `lang` (required): Target language
- `paths` (optional): Paths to search
- `globs` (optional): Include/exclude globs
- `dryRun` (optional): Preview without applying (default: true)

## Supported Languages

bash, c, cpp, csharp, css, elixir, go, haskell, hcl, html, java, javascript, json, kotlin, lua, nix, php, python, ruby, rust, scala, solidity, swift, typescript, tsx, yaml

## Architecture

- **MCP protocol**: From-scratch JSON-RPC 2.0 implementation (no SDK dependency). Handles initialize, tools/list, tools/call, ping.
- **Two-pass replace**: First pass runs search+preview, second pass runs `--update-all` for actual file writes.
- **Workspace sandbox**: All paths resolved via realpath, must stay inside workspace. Three-layer protection: path traversal (`../`), argument injection (leading `-`), null byte injection (`\0`).
- **Output truncation**: Matches capped at 500, output at 1 MB, timeout at 5 min. Truncated JSON gets repaired by finding last valid `},` boundary.
- **sg binary detection**: Three-level probe: `@ast-grep/cli` npm package → platform-specific package → Homebrew.
- **Bun/Node compat**: `bun-spawn-shim.ts` detects runtime and provides unified ReadableStream interface.

## Known Issues

- **No integration tests**: Unit tests cover MCP handler and pattern hints, but no end-to-end test with actual `sg` binary execution.
- **process-output-timeout.ts uses Response API**: Requires Node 18+. Node 16 is EOL and not supported.
- **.gitignore pattern overlap**: `*.d.ts` and `*.js.map` exclusions apply globally including `src/`, but this is intentional — only `dist/` should contain emitted files.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # esbuild bundle to dist/cli.js
npm test            # vitest run
npm run start       # node dist/cli.js
```

## License

MIT
