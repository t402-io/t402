"use client";

import { useState, useMemo } from "react";
import { Copy, Check } from "lucide-react";
import { tokenize, type Language, type Token } from "@/lib/syntax-highlighter";

interface CodeBlockProps {
  code: string;
  language?: Language;
  showLineNumbers?: boolean;
  showCopyButton?: boolean;
  label?: string;
  labelColor?: string;
  maxHeight?: string;
  className?: string;
}

const TOKEN_CSS_VAR: Record<string, string> = {
  keyword: "var(--syn-keyword)",
  string: "var(--syn-string)",
  number: "var(--syn-number)",
  function: "var(--syn-function)",
  variable: "var(--syn-variable)",
  type: "var(--syn-type)",
  comment: "var(--syn-comment)",
  property: "var(--syn-property)",
  punctuation: "var(--syn-punctuation)",
  plain: "var(--color-code-text)",
};

export function CodeBlock({
  code,
  language = "typescript",
  showLineNumbers = false,
  showCopyButton = true,
  label,
  labelColor,
  maxHeight,
  className = "",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const tokens = useMemo(() => tokenize(code, language), [code, language]);

  const lines = useMemo(() => {
    const result: Token[][] = [[]];
    for (const token of tokens) {
      const parts = token.text.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) result.push([]);
        if (parts[i]) {
          result[result.length - 1].push({ text: parts[i], type: token.type });
        }
      }
    }
    return result;
  }, [tokens]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const showHeader = label || showCopyButton;

  return (
    <div className={`overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-code-bg)] flex flex-col ${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2 shrink-0">
          {label && (
            <span className="text-xs font-medium" style={{ color: labelColor || "var(--color-muted)" }}>
              {label}
            </span>
          )}
          {!label && <span />}
          {showCopyButton && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-white transition-colors"
            >
              {copied ? <Check size={12} className="text-[var(--color-success)]" /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      )}
      <pre
        className="flex-1 overflow-auto p-4 text-[var(--text-code)] leading-relaxed"
        style={{ maxHeight: maxHeight || undefined }}
      >
        <code>
          {lines.map((lineTokens, lineIdx) => (
            <span key={lineIdx} className="block">
              {showLineNumbers && (
                <span className="inline-block w-8 text-right mr-4 text-[var(--color-muted)] select-none opacity-50 text-xs">
                  {lineIdx + 1}
                </span>
              )}
              {lineTokens.length === 0 ? (
                "\n"
              ) : (
                lineTokens.map((token, tokenIdx) => (
                  <span key={tokenIdx} style={{ color: TOKEN_CSS_VAR[token.type] }}>
                    {token.text}
                  </span>
                ))
              )}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
