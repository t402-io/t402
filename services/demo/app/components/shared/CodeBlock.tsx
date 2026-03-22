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
  plain: "#D4D4D4",
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
    <div
      className={`overflow-hidden rounded-2xl flex flex-col ${className}`}
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {showHeader && (
        <div
          className="flex items-center justify-between px-3 sm:px-4 py-2 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          {label && (
            <span className="text-[10px] sm:text-xs font-medium truncate mr-2" style={{ color: labelColor || "var(--color-text-tertiary)" }}>
              {label}
            </span>
          )}
          {!label && <span />}
          {showCopyButton && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] sm:text-xs hover:text-white transition-colors shrink-0"
              style={{ color: "var(--color-muted)" }}
              aria-label={copied ? "Copied to clipboard" : "Copy code"}
            >
              {copied ? <Check size={12} style={{ color: "var(--color-success)" }} /> : <Copy size={12} />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
            </button>
          )}
        </div>
      )}
      <pre
        className="flex-1 overflow-auto p-3 sm:p-4 text-[11px] sm:text-sm leading-relaxed"
        style={{ maxHeight: maxHeight || undefined, color: "var(--color-code-text)" }}
      >
        <code>
          {lines.map((lineTokens, lineIdx) => (
            <span key={lineIdx} className="block">
              {showLineNumbers && (
                <span className="inline-block w-8 text-right mr-4 select-none opacity-50 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
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
