import type { CliLanguage } from "./types.js"

export function detectRegexMisuse(pattern: string): string | null {
  const src = pattern.trim()

  if (/\\[wWdDsSbB]/.test(src)) {
    return 'Hint: "\\w", "\\d", "\\s", "\\b" are regex escapes. ast-grep matches AST nodes, not text - use $VAR for identifiers, $$$ for node lists, or switch to grep for text search.'
  }

  if (/\[[a-zA-Z0-9]-[a-zA-Z0-9]\]/.test(src)) {
    return 'Hint: "[a-z]" and similar character classes are regex, not AST. Use $VAR to match any identifier, or switch to grep for text search.'
  }

  if (!src.includes("$") && /\w\.[*+]/.test(src)) {
    return 'Hint: ".*" and ".+" are regex wildcards. In ast-grep use $$$ for multiple AST nodes and $VAR for a single node. For text patterns, switch to grep.'
  }

  if (/^[-\w.*]+\|[-\w.*|]+$/.test(src)) {
    return 'Hint: "|" is regex alternation and does NOT work in ast-grep patterns. Options: (a) fire one ast_grep_search per alternative, or (b) switch to grep with a regex pattern like "foo|bar".'
  }

  return null
}

export function detectLanguageSpecificMistake(
  pattern: string,
  lang: CliLanguage,
): string | null {
  const src = pattern.trim()

  if (lang === "python") {
    // Python decorators and functions are sibling AST nodes — combining them fails
    if (/^@\w+.*\n\s*(def |async def |class )/s.test(src)) {
      return 'Hint: Python decorators and functions are sibling AST nodes — a single pattern cannot match both. Search for the decorator and function separately, or use grep for text search.'
    }
    if (src.startsWith("class ") && src.endsWith(":")) {
      return `Hint: Remove trailing colon. Try: "${src.slice(0, -1)}"`
    }
    if ((src.startsWith("def ") || src.startsWith("async def ")) && src.endsWith(":")) {
      return `Hint: Remove trailing colon. Try: "${src.slice(0, -1)}"`
    }
  }

  if (["javascript", "typescript", "tsx"].includes(lang)) {
    if (/^(export\s+)?(async\s+)?function\s+\$[A-Z_]+\s*$/i.test(src)) {
      return 'Hint: Function patterns need params and body. Try "function $NAME($$$) { $$$ }"'
    }
  }

  if (lang === "go") {
    if (/^func\s+\$[A-Z_]+\s*$/i.test(src)) {
      return 'Hint: Go function patterns need params and body. Try "func $NAME($$$) { $$$ }"'
    }
  }

  if (lang === "rust") {
    // Rust attributes and items are sibling AST nodes — combining them fails
    if (/^#\[.*\]\s*\n\s*(fn |struct |enum |mod |trait |impl |type |const |static )/s.test(src)) {
      return 'Hint: Rust attributes and items are sibling AST nodes — a single pattern cannot match both. Search for the attribute and item separately, or use grep for text search.'
    }
    if (/^fn\s+\$[A-Z_]+\s*$/i.test(src)) {
      return 'Hint: Rust fn patterns need params and body. Try "fn $NAME($$$) { $$$ }"'
    }
  }

  if (lang === "csharp") {
    // C# tree-sitter parses attributes and methods as sibling nodes, and
    // standalone patterns are parsed out of class context, producing wrong
    // node types (e.g. "local_function_statement" instead of "method_declaration",
    // or "bracketed_argument_list" instead of "attribute_list").
    // Detect these cases and suggest embedding the pattern in class context.

    // Multi-node pattern: attribute + method/property (sibling nodes)
    if (/^\[.*\]\s*\n/s.test(src) || /^\[.*\]\s+(public|private|protected|internal)/i.test(src)) {
      return 'Hint: C# attributes and methods are sibling AST nodes — a single pattern cannot match both. Use "class $C { [$ATTR] void $M() { $$$ } }" to embed in class context, or use grep for text search.'
    }

    if (/^class\s+\$[A-Z_]+\s*$/i.test(src)) {
      return 'Hint: C# class patterns need a body. Try "class $NAME { $$$ }"'
    }

    // Standalone method signature without body (out of class context → wrong node type)
    if (/^(public|private|protected|internal)?\s*(static\s+)?(async\s+)?(override\s+)?(virtual\s+)?(void|Task|Task<\$[A-Z_]+>|int|string|bool|var)\s+(\$[A-Z_]+|[A-Z_]\w*)\s*\([^)]*\)\s*$/i.test(src)) {
      return 'Hint: C# method patterns are parsed as "local_function_statement" out of class context. Add a body and embed in class context: "class $C { void $NAME($$$) { $$$ } }"'
    }

    // Standalone attribute (out of class context → parsed as array indexer, not attribute_list)
    if (/^\[.*\]\s*$/s.test(src)) {
      return 'Hint: C# attributes are parsed as "bracketed_argument_list" out of class context. Embed in class context: "class $C { [$ATTR] void $M() { $$$ } }"'
    }

    // Standalone property (out of class context → wrong node type)
    if (/^(public|private|protected|internal)?\s*(static\s+)?(readonly\s+)?(int|string|bool|var|\$[A-Z_]+)\s+(\$[A-Z_]+|[A-Z_]\w*)\s*\{\s*(get;\s*set;|get;)\s*\}\s*$/i.test(src)) {
      return 'Hint: C# property patterns need class context. Try "class $C { $TYPE $NAME { get; set; } }"'
    }
  }

  return null
}

export function getPatternHint(pattern: string, lang: CliLanguage): string | null {
  return detectRegexMisuse(pattern) ?? detectLanguageSpecificMistake(pattern, lang)
}

const META_VAR_RE = /\$[A-Z_][A-Z0-9_]*/g
const MULTI_VAR_RE = /\$\$\$([A-Z_][A-Z0-9_]*)?/g

function extractMetaVars(src: string): Set<string> {
  const vars = new Set<string>()
  for (const m of src.matchAll(META_VAR_RE)) vars.add(m[0])
  for (const m of src.matchAll(MULTI_VAR_RE)) vars.add(m[0])
  return vars
}

export function detectRewriteVariableMismatch(pattern: string, rewrite: string): string | null {
  const patternVars = extractMetaVars(pattern)
  const rewriteVars = extractMetaVars(rewrite)
  const unmatched: string[] = []
  for (const v of rewriteVars) {
    if (!patternVars.has(v)) unmatched.push(v)
  }
  if (unmatched.length === 0) return null
  return `Warning: rewrite references meta-variable(s) ${unmatched.map(v => `"${v}"`).join(", ")} not captured in pattern. They will be replaced with empty strings. Ensure all $VAR/$$$ in rewrite exist in pattern.`
}
