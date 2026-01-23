export type TokenType =
  | "keyword"
  | "string"
  | "number"
  | "function"
  | "variable"
  | "type"
  | "comment"
  | "property"
  | "punctuation"
  | "plain";

export type Language = "json" | "typescript" | "python" | "go" | "java" | "http";

export interface Token {
  text: string;
  type: TokenType;
}

interface Rule {
  pattern: RegExp;
  type: TokenType;
}

const JSON_RULES: Rule[] = [
  { pattern: /^"(?:[^"\\]|\\.)*"\s*(?=:)/, type: "property" },
  { pattern: /^"(?:[^"\\]|\\.)*"/, type: "string" },
  { pattern: /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, type: "number" },
  { pattern: /^(?:true|false|null)\b/, type: "keyword" },
  { pattern: /^[{}[\],:]/, type: "punctuation" },
];

const TYPESCRIPT_RULES: Rule[] = [
  { pattern: /^\/\/.*/, type: "comment" },
  { pattern: /^\/\*[\s\S]*?\*\//, type: "comment" },
  { pattern: /^(?:import|from|export|const|let|var|new|await|async|return|function|if|else|type|interface|class|extends|typeof|throw|try|catch|finally)\b/, type: "keyword" },
  { pattern: /^`(?:[^`\\]|\\.)*`/, type: "string" },
  { pattern: /^"(?:[^"\\]|\\.)*"/, type: "string" },
  { pattern: /^'(?:[^'\\]|\\.)*'/, type: "string" },
  { pattern: /^@\w+/, type: "type" },
  { pattern: /^[A-Z][a-zA-Z0-9]*(?=\s*[<({])/, type: "type" },
  { pattern: /^[A-Z][a-zA-Z0-9]*/, type: "type" },
  { pattern: /^\w+(?=\s*\()/, type: "function" },
  { pattern: /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?n?/, type: "number" },
  { pattern: /^(?:=>|\.{3}|[{}[\]();:,.<>+=!&|?])/, type: "punctuation" },
  { pattern: /^\.\w+/, type: "property" },
];

const PYTHON_RULES: Rule[] = [
  { pattern: /^#.*/, type: "comment" },
  { pattern: /^(?:from|import|def|async|await|return|class|if|else|elif|with|as|for|in|while|try|except|finally|raise|pass|yield|lambda|not|and|or|is)\b/, type: "keyword" },
  { pattern: /^f"(?:[^"\\]|\\.)*"/, type: "string" },
  { pattern: /^f'(?:[^'\\]|\\.)*'/, type: "string" },
  { pattern: /^"""[\s\S]*?"""/, type: "string" },
  { pattern: /^'''[\s\S]*?'''/, type: "string" },
  { pattern: /^"(?:[^"\\]|\\.)*"/, type: "string" },
  { pattern: /^'(?:[^'\\]|\\.)*'/, type: "string" },
  { pattern: /^@\w+/, type: "type" },
  { pattern: /^[A-Z][a-zA-Z0-9]*/, type: "type" },
  { pattern: /^\w+(?=\s*\()/, type: "function" },
  { pattern: /^-?\d+(?:\.\d+)?/, type: "number" },
  { pattern: /^[{}[\]();:,.<>+=!]/, type: "punctuation" },
  { pattern: /^\.\w+/, type: "property" },
];

const GO_RULES: Rule[] = [
  { pattern: /^\/\/.*/, type: "comment" },
  { pattern: /^\/\*[\s\S]*?\*\//, type: "comment" },
  { pattern: /^(?:package|import|func|return|if|else|type|struct|var|for|range|defer|go|chan|select|case|default|break|continue|map|interface|nil)\b/, type: "keyword" },
  { pattern: /^`[^`]*`/, type: "string" },
  { pattern: /^"(?:[^"\\]|\\.)*"/, type: "string" },
  { pattern: /^[A-Z][a-zA-Z0-9]*/, type: "type" },
  { pattern: /^\w+(?=\s*\()/, type: "function" },
  { pattern: /^-?\d+(?:\.\d+)?/, type: "number" },
  { pattern: /^(?::=|\.{3}|[{}[\]();:,.<>+=!&|])/, type: "punctuation" },
  { pattern: /^\.\w+/, type: "property" },
];

const JAVA_RULES: Rule[] = [
  { pattern: /^\/\/.*/, type: "comment" },
  { pattern: /^\/\*[\s\S]*?\*\//, type: "comment" },
  { pattern: /^(?:public|private|protected|class|import|return|new|void|static|final|extends|implements|abstract|interface|package|throw|throws|try|catch|finally)\b/, type: "keyword" },
  { pattern: /^"(?:[^"\\]|\\.)*"/, type: "string" },
  { pattern: /^@\w+/, type: "type" },
  { pattern: /^[A-Z][a-zA-Z0-9]*(?:<[^>]*>)?/, type: "type" },
  { pattern: /^\w+(?=\s*\()/, type: "function" },
  { pattern: /^-?\d+(?:\.\d+)?[fFdDlL]?/, type: "number" },
  { pattern: /^[{}[\]();:,.<>+=!&|?]/, type: "punctuation" },
  { pattern: /^\.\w+/, type: "property" },
];

const HTTP_RULES: Rule[] = [
  { pattern: /^(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/, type: "keyword" },
  { pattern: /^HTTP\/[\d.]+/, type: "keyword" },
  { pattern: /^\d{3}\b/, type: "number" },
  { pattern: /^[A-Z][a-zA-Z0-9-]*(?=:)/, type: "property" },
  { pattern: /^"(?:[^"\\]|\\.)*"/, type: "string" },
  { pattern: /^https?:\/\/\S+/, type: "string" },
  { pattern: /^[{}[\]:,]/, type: "punctuation" },
];

const RULES: Record<Language, Rule[]> = {
  json: JSON_RULES,
  typescript: TYPESCRIPT_RULES,
  python: PYTHON_RULES,
  go: GO_RULES,
  java: JAVA_RULES,
  http: HTTP_RULES,
};

export function tokenize(code: string, language: Language): Token[] {
  const rules = RULES[language] || TYPESCRIPT_RULES;
  const tokens: Token[] = [];
  let remaining = code;
  let plain = "";

  while (remaining.length > 0) {
    // Try whitespace first
    const wsMatch = remaining.match(/^[ \t]+/);
    if (wsMatch) {
      plain += wsMatch[0];
      remaining = remaining.slice(wsMatch[0].length);
      continue;
    }

    // Try newline
    if (remaining[0] === "\n" || remaining[0] === "\r") {
      plain += remaining[0];
      remaining = remaining.slice(1);
      continue;
    }

    // Try each rule
    let matched = false;
    for (const rule of rules) {
      const match = remaining.match(rule.pattern);
      if (match) {
        if (plain) {
          tokens.push({ text: plain, type: "plain" });
          plain = "";
        }
        tokens.push({ text: match[0], type: rule.type });
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Try identifier
      const idMatch = remaining.match(/^\w+/);
      if (idMatch) {
        plain += idMatch[0];
        remaining = remaining.slice(idMatch[0].length);
      } else {
        plain += remaining[0];
        remaining = remaining.slice(1);
      }
    }
  }

  if (plain) {
    tokens.push({ text: plain, type: "plain" });
  }

  return tokens;
}
