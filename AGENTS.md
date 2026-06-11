# AGENTS.md — ast-grep-mcp

## Project Overview

Standalone MCP server for AI-optimized AST code search and replace. Wraps the `sg` CLI binary from `@ast-grep/cli`. Implements JSON-RPC 2.0 from scratch (no MCP SDK).

## File Structure

```
src/
  cli.ts            — Entry point, starts MCP stdio server
  mcp.ts            — JSON-RPC 2.0 handler (initialize, tools/list, tools/call, ping)
  runner.ts         — sg binary execution: builds CLI args, spawns process, parses JSON output
  types.ts          — CliLanguage (26-language union), Position, Range, CliMatch, SgResult
  language-support.ts — CLI_LANGUAGES array, DEFAULT_TIMEOUT/MAX_OUTPUT/MAX_MATCHES constants
  tool-descriptions.ts — AI-friendly tool description text (warns against regex misuse)
  pattern-hints.ts  — Regex misuse detection + language-specific mistake hints (Python/JS/TS/TSX/Go/Rust/C#)
  result-formatter.ts — Formats SgResult into human-readable text
  sg-compact-json-output.ts — Parses sg --json=compact output, handles truncation + JSON repair
  sg-cli-path.ts    — sg binary path probe: npm package → platform package → Homebrew
  cli-binary-path-resolution.ts — Async binary resolution with caching + background init
  bun-spawn-shim.ts — Bun/Node dual-runtime spawn compatibility (ReadableStream interface)
  process-output-timeout.ts — Process output collection with 5-min timeout
  workspace-paths.ts — Workspace sandbox: path traversal, argument injection, null byte protection
  constants.ts      — Barrel re-export of language-support + sg-cli-path
  index.ts          — Library barrel export
```

## Key Design Decisions

- **No MCP SDK**: JSON-RPC 2.0 implemented from scratch to avoid dependency on `@modelcontextprotocol/sdk`
- **NodeNext modules**: All relative imports use `.js` suffix (required by NodeNext moduleResolution)
- **esbuild bundle**: Single-file ESM output for simple distribution
- **Two-pass replace**: Search preview first, then `--update-all` for actual writes
- **Mock-friendly**: `AstGrepMcpOptions.runSg` allows injecting mock runner for tests

## Development Rules

- **Do not use `ast-grep_replace` on files containing `$` variable literals** (e.g. `pattern-hints.ts`, `tool-descriptions.ts`). The `$VAR`/`$$$` in string literals will be interpreted as AST meta-variables and silently stripped. Use the Edit tool or ds-executor subagent instead.

## Build & Test

```bash
npm run typecheck   # tsc --noEmit
npm run build       # esbuild → dist/cli.js
npm test            # vitest run
```

## File Dependency Graph

```
cli.ts → mcp.ts → runner.ts → types.ts, language-support.ts, sg-compact-json-output.ts,
                            bun-spawn-shim.ts, cli-binary-path-resolution.ts, process-output-timeout.ts
         mcp.ts → tool-descriptions.ts, pattern-hints.ts, result-formatter.ts, workspace-paths.ts, constants.ts
```
