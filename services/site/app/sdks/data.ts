export interface SDK {
  id: string;
  name: string;
  language: string;
  description: string;
  icon: string;
  installCommand: string;
  version: string;
  docsUrl: string;
  githubUrl: string;
  color: string;
}

export const sdks: SDK[] = [
  {
    id: "typescript",
    name: "TypeScript",
    language: "TypeScript / JavaScript",
    description:
      "Full-featured SDK for Node.js and browser environments. Server middleware, client utilities, framework integrations for 12 chain families.",
    icon: "typescript",
    installCommand: "pnpm add @t402/core",
    version: "2.9.0",
    docsUrl: "https://docs.t402.io/sdks/typescript",
    githubUrl: "https://github.com/t402-io/t402/tree/main/sdks/typescript",
    color: "#3178C6",
  },
  {
    id: "python",
    name: "Python",
    language: "Python 3.10+",
    description:
      "Async server-side SDK. Flask / FastAPI / Django middleware. 12 chain mechanisms.",
    icon: "python",
    installCommand: "pip install t402",
    version: "1.13.1",
    docsUrl: "https://docs.t402.io/sdks/python",
    githubUrl: "https://github.com/t402-io/t402/tree/main/sdks/python",
    color: "#3776AB",
  },
  {
    id: "go",
    name: "Go",
    language: "Go 1.24+",
    description:
      "High-performance Go SDK. net/http compatible, 12 chain mechanisms, powers the reference facilitator.",
    icon: "go",
    installCommand: "go get github.com/t402-io/t402/sdks/go",
    version: "1.13.1",
    docsUrl: "https://docs.t402.io/sdks/go",
    githubUrl: "https://github.com/t402-io/t402/tree/main/sdks/go",
    color: "#00ADD8",
  },
  {
    id: "java",
    name: "Java",
    language: "Java 21+",
    description:
      "Enterprise Java / Spring Boot SDK. Maintenance mode: security updates and bug fixes only.",
    icon: "java",
    installCommand: "io.t402:t402:1.13.1",
    version: "1.13.1",
    docsUrl: "https://docs.t402.io/sdks/java",
    githubUrl: "https://github.com/t402-io/t402/tree/main/sdks/java",
    color: "#ED8B00",
  },
];
