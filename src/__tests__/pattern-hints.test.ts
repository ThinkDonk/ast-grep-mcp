import { describe, it, expect } from "vitest";
import { detectRegexMisuse, detectLanguageSpecificMistake, detectRewriteVariableMismatch } from "../pattern-hints.js";

describe("detectRegexMisuse", () => {
  it("detects \\w escape", () => {
    expect(detectRegexMisuse("\\w+")).not.toBeNull();
  });

  it("detects character class [a-z]", () => {
    expect(detectRegexMisuse("[a-z]")).not.toBeNull();
  });

  it("detects .* wildcard", () => {
    expect(detectRegexMisuse("foo.*bar")).not.toBeNull();
  });

  it("detects | alternation", () => {
    expect(detectRegexMisuse("foo|bar")).not.toBeNull();
  });

  it("returns null for valid ast-grep pattern", () => {
    expect(detectRegexMisuse("console.log($$$)")).toBeNull();
  });
});

describe("detectLanguageSpecificMistake", () => {
  it("detects Python trailing colon in class", () => {
    expect(detectLanguageSpecificMistake("class Foo:", "python")).not.toBeNull();
  });

  it("detects Python trailing colon in def", () => {
    expect(detectLanguageSpecificMistake("def foo():", "python")).not.toBeNull();
  });

  it("detects Python decorator + function sibling pattern", () => {
    expect(detectLanguageSpecificMistake("@decorator\ndef foo():", "python")).not.toBeNull();
  });

  it("detects Python decorator + class sibling pattern", () => {
    expect(detectLanguageSpecificMistake("@dataclass\nclass Foo:", "python")).not.toBeNull();
  });

  it("does not flag Python decorator alone", () => {
    expect(detectLanguageSpecificMistake("@decorator", "python")).toBeNull();
  });

  it("detects JS function without body", () => {
    expect(detectLanguageSpecificMistake("function $NAME", "javascript")).not.toBeNull();
  });

  it("detects Go func without body", () => {
    expect(detectLanguageSpecificMistake("func $NAME", "go")).not.toBeNull();
  });

  it("detects Rust fn without body", () => {
    expect(detectLanguageSpecificMistake("fn $NAME", "rust")).not.toBeNull();
  });

  it("detects Rust attribute + struct sibling pattern", () => {
    expect(detectLanguageSpecificMistake("#[derive(Debug)]\nstruct Point", "rust")).not.toBeNull();
  });

  it("detects Rust attribute + fn sibling pattern", () => {
    expect(detectLanguageSpecificMistake("#[test]\nfn test_foo()", "rust")).not.toBeNull();
  });

  it("does not flag Rust attribute alone", () => {
    expect(detectLanguageSpecificMistake("#[derive(Debug)]", "rust")).toBeNull();
  });

  it("detects C# class without body", () => {
    expect(detectLanguageSpecificMistake("class $NAME", "csharp")).not.toBeNull();
  });

  it("detects C# attribute + method sibling pattern (with newline)", () => {
    expect(detectLanguageSpecificMistake("[HttpGet]\npublic void Configure()", "csharp")).not.toBeNull();
  });

  it("detects C# attribute + method sibling pattern (same line)", () => {
    expect(detectLanguageSpecificMistake("[HttpGet] public void Configure()", "csharp")).not.toBeNull();
  });

  it("detects C# standalone method signature (no body, no class context)", () => {
    expect(detectLanguageSpecificMistake("public void Configure()", "csharp")).not.toBeNull();
  });

  it("detects C# standalone static async method signature", () => {
    expect(detectLanguageSpecificMistake("public static async Task RunAsync()", "csharp")).not.toBeNull();
  });

  it("detects C# standalone attribute (parsed as array indexer)", () => {
    expect(detectLanguageSpecificMistake("[HttpGet]", "csharp")).not.toBeNull();
  });

  it("detects C# standalone property", () => {
    expect(detectLanguageSpecificMistake("public int Count { get; set; }", "csharp")).not.toBeNull();
  });

  it("detects C# standalone property with readonly type", () => {
    expect(detectLanguageSpecificMistake("public readonly string Name { get; }", "csharp")).not.toBeNull();
  });

  it("returns null for valid C# pattern with class context", () => {
    expect(detectLanguageSpecificMistake("class $C { void $NAME($$$) { $$$ } }", "csharp")).toBeNull();
  });

  it("returns null for valid pattern", () => {
    expect(detectLanguageSpecificMistake("function $NAME($$$) { $$$ }", "javascript")).toBeNull();
  });
});

describe("detectRewriteVariableMismatch", () => {
  it("returns null when rewrite variables are all captured in pattern", () => {
    expect(detectRewriteVariableMismatch("console.log($MSG)", "logger.info($MSG)")).toBeNull();
  });

  it("detects single unmatched variable in rewrite", () => {
    const result = detectRewriteVariableMismatch("console.log($MSG)", "logger.info($MSG, $EXTRA)");
    expect(result).not.toBeNull();
    expect(result).toContain('"$EXTRA"');
  });

  it("detects multiple unmatched variables in rewrite", () => {
    const result = detectRewriteVariableMismatch("foo($A)", "bar($B, $C)");
    expect(result).not.toBeNull();
    expect(result).toContain('"$B"');
    expect(result).toContain('"$C"');
  });

  it("detects unmatched $$$ variable in rewrite", () => {
    const result = detectRewriteVariableMismatch("console.log($MSG)", "logger.info($$$ARGS)");
    expect(result).not.toBeNull();
    expect(result).toContain('"$$$ARGS"');
  });

  it("returns null when both pattern and rewrite have $$$", () => {
    expect(detectRewriteVariableMismatch("console.log($$$ARGS)", "logger.info($$$ARGS)")).toBeNull();
  });

  it("returns null when rewrite has no variables", () => {
    expect(detectRewriteVariableMismatch("console.log($$$)", "hardcoded()")).toBeNull();
  });

  it("detects mismatch with $$$ in rewrite but not pattern", () => {
    const result = detectRewriteVariableMismatch("foo($X)", "bar($$$)");
    expect(result).not.toBeNull();
    expect(result).toContain('"$$$"');
  });
});
