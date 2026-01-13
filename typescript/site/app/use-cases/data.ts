/**
 * Use Cases Data for t402
 */

export interface UseCase {
  id: string;
  title: string;
  category: UseCaseCategory;
  description: string;
  longDescription: string;
  icon: string;
  color: string;
  benefits: string[];
  industries: string[];
  features: string[];
  example: {
    title: string;
    description: string;
  };
  codeSnippet?: string;
}

export type UseCaseCategory = "api" | "content" | "ai" | "commerce" | "services";

export const categories: { id: UseCaseCategory; name: string; description: string }[] = [
  {
    id: "api",
    name: "API Monetization",
    description: "Charge per API call or subscription for developer services",
  },
  {
    id: "content",
    name: "Content Access",
    description: "Paywall articles, videos, downloads, and premium content",
  },
  {
    id: "ai",
    name: "AI & Agents",
    description: "Enable AI agents to pay for resources autonomously",
  },
  {
    id: "commerce",
    name: "E-Commerce",
    description: "Accept stablecoin payments for products and services",
  },
  {
    id: "services",
    name: "Digital Services",
    description: "SaaS subscriptions, cloud services, and digital goods",
  },
];

export const useCases: UseCase[] = [
  // API Monetization
  {
    id: "api-monetization",
    title: "Pay-Per-Call APIs",
    category: "api",
    description: "Monetize your APIs with per-request pricing. No subscriptions, no rate limits - just pure usage-based billing.",
    longDescription:
      "Transform any API into a revenue stream with HTTP 402 payments. Users pay exactly for what they use, eliminating the friction of subscription tiers and complex pricing models. Perfect for data providers, ML inference, and specialized services.",
    icon: "api",
    color: "#3B82F6",
    benefits: [
      "Zero-friction monetization",
      "No subscription management",
      "Instant global payments",
      "Built-in rate limiting via price",
    ],
    industries: ["Data Providers", "ML/AI Services", "Financial APIs", "Weather Services"],
    features: ["Per-request pricing", "Gasless payments", "Multi-chain support", "Real-time settlement"],
    example: {
      title: "Weather Data API",
      description: "Charge $0.001 per weather forecast request. Users pay only when they call, no monthly fees.",
    },
    codeSnippet: `app.use(paymentMiddleware({
  "GET /api/weather/:city": {
    price: "$0.001",
    network: "base",
    resource: "Weather forecast data",
  },
}));`,
  },
  {
    id: "data-feeds",
    title: "Premium Data Feeds",
    category: "api",
    description: "Sell real-time market data, analytics, or proprietary datasets with instant micropayments.",
    longDescription:
      "Monetize valuable data streams without complex licensing agreements. Whether it's financial market data, blockchain analytics, or research datasets, t402 enables instant access with pay-per-query pricing.",
    icon: "chart",
    color: "#10B981",
    benefits: [
      "Micropayment-friendly pricing",
      "No licensing complexity",
      "Global accessibility",
      "Automatic access control",
    ],
    industries: ["Financial Data", "Research", "Analytics", "Blockchain Data"],
    features: ["Real-time data access", "Query-based pricing", "API key optional", "Usage analytics"],
    example: {
      title: "Crypto Price Oracle",
      description: "Access real-time price feeds for $0.0001 per query. Pay only for the data you need.",
    },
  },

  // Content Access
  {
    id: "article-paywall",
    title: "Article Paywalls",
    category: "content",
    description: "Let readers pay per article instead of forcing monthly subscriptions they won't use.",
    longDescription:
      "Revolutionary content monetization that respects reader choice. Visitors pay a small fee to read individual articles, removing the barrier of expensive subscriptions while ensuring fair compensation for creators.",
    icon: "article",
    color: "#8B5CF6",
    benefits: [
      "Higher conversion rates",
      "Reader-friendly pricing",
      "No subscription fatigue",
      "Instant content access",
    ],
    industries: ["News Media", "Blogs", "Research Papers", "Magazines"],
    features: ["Per-article pricing", "Seamless UX", "No registration required", "Creator-friendly fees"],
    example: {
      title: "Premium News Article",
      description: "Read this investigative report for $0.25. No subscription needed, instant access.",
    },
  },
  {
    id: "video-streaming",
    title: "Pay-Per-View Video",
    category: "content",
    description: "Stream premium video content with per-view or per-minute pricing models.",
    longDescription:
      "Monetize video content without relying on ads or subscriptions. Viewers pay for what they watch, whether it's educational courses, live streams, or exclusive content. Perfect for creators who want direct revenue.",
    icon: "video",
    color: "#EC4899",
    benefits: [
      "Direct creator revenue",
      "No ad interruptions",
      "Flexible pricing models",
      "Global audience reach",
    ],
    industries: ["Education", "Entertainment", "Live Streaming", "Courses"],
    features: ["Per-view pricing", "Time-based billing", "HD/4K support", "Live stream payments"],
    example: {
      title: "Coding Tutorial",
      description: "Watch this advanced React tutorial for $2.00. Own it forever, no subscription.",
    },
  },
  {
    id: "digital-downloads",
    title: "Digital Downloads",
    category: "content",
    description: "Sell ebooks, music, software, templates, and digital assets with instant delivery.",
    longDescription:
      "Simple, direct sales of digital goods. No marketplace fees, no platform restrictions. Upload your content, set your price, and start selling globally with instant crypto payments and automatic file delivery.",
    icon: "download",
    color: "#F59E0B",
    benefits: [
      "Instant delivery",
      "No platform fees",
      "Global reach",
      "Full price control",
    ],
    industries: ["Music", "Ebooks", "Software", "Digital Art"],
    features: ["Automatic delivery", "Download limits", "License management", "Multi-format support"],
    example: {
      title: "Icon Pack",
      description: "Download 500 premium icons for $15. Instant access, commercial license included.",
    },
  },

  // AI & Agents
  {
    id: "ai-inference",
    title: "AI Model Inference",
    category: "ai",
    description: "Charge for AI model inference - image generation, text completion, embeddings, and more.",
    longDescription:
      "Monetize your AI models with per-inference pricing. Whether you're running open-source LLMs, custom fine-tuned models, or specialized ML services, t402 makes it simple to charge for each API call.",
    icon: "brain",
    color: "#6366F1",
    benefits: [
      "Per-inference billing",
      "No API key management",
      "Automatic rate limiting",
      "Cost transparency",
    ],
    industries: ["AI Startups", "Research Labs", "ML Platforms", "AI Tools"],
    features: ["Token-based pricing", "Model versioning", "Usage quotas", "Real-time billing"],
    example: {
      title: "Image Generation API",
      description: "Generate images with Stable Diffusion for $0.02 per image. Pay as you go.",
    },
    codeSnippet: `app.use(paymentMiddleware({
  "POST /api/generate": {
    price: "$0.02",
    network: "base",
    resource: "AI image generation",
  },
}));`,
  },
  {
    id: "agent-payments",
    title: "Autonomous Agent Payments",
    category: "ai",
    description: "Enable AI agents to pay for resources, APIs, and services without human intervention.",
    longDescription:
      "The future of AI is autonomous. With MCP integration, your AI agents can make payments for the resources they need - data access, compute, storage, or other agent services. Set budgets, define policies, and let agents operate independently.",
    icon: "robot",
    color: "#14B8A6",
    benefits: [
      "True autonomy",
      "Budget controls",
      "Audit trails",
      "Multi-agent support",
    ],
    industries: ["AI Research", "Automation", "DevOps", "Trading Bots"],
    features: ["MCP integration", "Spending limits", "Policy engine", "Transaction logging"],
    example: {
      title: "Research Agent",
      description: "Agent autonomously purchases access to research papers and datasets within $50/day budget.",
    },
  },
  {
    id: "agent-to-agent",
    title: "Agent-to-Agent Commerce",
    category: "ai",
    description: "Create marketplaces where AI agents buy and sell services from each other.",
    longDescription:
      "Build the infrastructure for agent economies. Agents can offer services (data processing, analysis, content generation) and purchase from other agents. t402 handles the payment layer for this emerging market.",
    icon: "network",
    color: "#0EA5E9",
    benefits: [
      "Emerging market opportunity",
      "Automated settlements",
      "Service discovery",
      "Trust minimization",
    ],
    industries: ["AI Platforms", "Multi-Agent Systems", "Automation", "DAOs"],
    features: ["Service registry", "Automated matching", "Escrow support", "Reputation systems"],
    example: {
      title: "Data Processing Network",
      description: "Agents specialize in tasks and hire other agents for subtasks, paying in real-time.",
    },
  },

  // E-Commerce
  {
    id: "ecommerce-checkout",
    title: "Stablecoin Checkout",
    category: "commerce",
    description: "Accept USDT/USDC payments for physical and digital products with instant settlement.",
    longDescription:
      "Add crypto checkout to your store without the volatility risk. Customers pay in stablecoins, you receive stablecoins. No conversion fees, no waiting periods, no chargebacks. Works with any e-commerce platform.",
    icon: "cart",
    color: "#22C55E",
    benefits: [
      "No volatility risk",
      "Instant settlement",
      "No chargebacks",
      "Lower fees than cards",
    ],
    industries: ["E-Commerce", "Marketplaces", "Retail", "Luxury Goods"],
    features: ["Multi-chain payments", "Gasless checkout", "Invoice generation", "Refund support"],
    example: {
      title: "Online Store",
      description: "Customer pays $99.99 in USDC for premium headphones. Instant confirmation, same-day shipping.",
    },
  },
  {
    id: "subscriptions",
    title: "Crypto Subscriptions",
    category: "commerce",
    description: "Recurring payments in stablecoins for SaaS, memberships, and subscription boxes.",
    longDescription:
      "Subscription billing with crypto stability. Set up recurring payments in USDT or USDC - predictable revenue for you, no currency conversion for global customers. Automatic renewals with wallet signatures.",
    icon: "repeat",
    color: "#A855F7",
    benefits: [
      "Predictable revenue",
      "Global customers",
      "No currency conversion",
      "Automatic renewals",
    ],
    industries: ["SaaS", "Memberships", "Newsletters", "Gaming"],
    features: ["Recurring billing", "Trial periods", "Usage-based tiers", "Cancellation handling"],
    example: {
      title: "Premium Newsletter",
      description: "$10 USDC/month for exclusive market insights. Auto-renews, cancel anytime.",
    },
  },
  {
    id: "cross-border",
    title: "Cross-Border Payments",
    category: "commerce",
    description: "Accept payments from anywhere in the world without currency conversion fees.",
    longDescription:
      "Eliminate the complexity of international payments. Whether your customers are in the US, Europe, Asia, or Africa, they can pay in USDT/USDC. No bank delays, no forex fees, no payment failures.",
    icon: "globe",
    color: "#F97316",
    benefits: [
      "No forex fees",
      "Instant settlement",
      "Global accessibility",
      "Bank-free transactions",
    ],
    industries: ["International Trade", "Freelancers", "Remote Services", "Export Business"],
    features: ["Multi-currency display", "Local payment UX", "Compliance tools", "Tax reporting"],
    example: {
      title: "Freelance Services",
      description: "Designer in Vietnam receives $500 USDC from US client. Settles in seconds, no bank fees.",
    },
  },

  // Digital Services
  {
    id: "cloud-compute",
    title: "Cloud Compute Credits",
    category: "services",
    description: "Pay for cloud computing, GPU time, and infrastructure with crypto.",
    longDescription:
      "Democratize access to cloud resources. Users can spin up instances, run GPU workloads, or deploy applications by paying in stablecoins. No credit cards required, no geographic restrictions.",
    icon: "cloud",
    color: "#06B6D4",
    benefits: [
      "No credit card needed",
      "Pay-as-you-go",
      "Global access",
      "Instant provisioning",
    ],
    industries: ["Cloud Providers", "GPU Compute", "Hosting", "Infrastructure"],
    features: ["Usage metering", "Auto top-up", "Resource quotas", "Cost alerts"],
    example: {
      title: "GPU Rental",
      description: "Rent an A100 GPU for $2.50/hour in USDC. Start training immediately.",
    },
  },
  {
    id: "domain-hosting",
    title: "Domain & Hosting",
    category: "services",
    description: "Register domains and pay for web hosting with stablecoin payments.",
    longDescription:
      "Crypto-native domain registration and hosting services. Pay for your domains, SSL certificates, and hosting plans in USDT/USDC. Perfect for Web3 projects that want to stay on-chain.",
    icon: "server",
    color: "#84CC16",
    benefits: [
      "Crypto-native billing",
      "No bank account needed",
      "Privacy-preserving",
      "Global availability",
    ],
    industries: ["Web3 Projects", "Startups", "Developers", "Agencies"],
    features: ["Domain registration", "SSL certificates", "DNS management", "Hosting plans"],
    example: {
      title: "Annual Hosting",
      description: "Pay $120 USDC for a year of premium hosting. Includes SSL and daily backups.",
    },
  },
  {
    id: "developer-tools",
    title: "Developer Tool Licensing",
    category: "services",
    description: "License developer tools, SDKs, and premium features with crypto payments.",
    longDescription:
      "Monetize your developer tools without the overhead of payment processing. Sell licenses for IDEs, libraries, plugins, and premium features. Instant license delivery upon payment.",
    icon: "code",
    color: "#EF4444",
    benefits: [
      "Instant license delivery",
      "Global developer reach",
      "No payment processor fees",
      "Flexible pricing models",
    ],
    industries: ["Dev Tools", "IDEs", "Libraries", "Plugins"],
    features: ["License keys", "Team licenses", "Floating licenses", "Version upgrades"],
    example: {
      title: "Pro IDE License",
      description: "Unlock all pro features for $49 USDC. Perpetual license, free updates for 1 year.",
    },
  },
];

export function getUseCasesByCategory(category: UseCaseCategory): UseCase[] {
  return useCases.filter((uc) => uc.category === category);
}

export function getUseCaseById(id: string): UseCase | undefined {
  return useCases.find((uc) => uc.id === id);
}

export function getAllCategories(): typeof categories {
  return categories;
}
