import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, getNetwork, getAsset, PAY_TO, DEMO_AMOUNT } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";

// Agent definitions
interface Agent {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
}

const AGENTS: Record<string, Agent> = {
  orchestrator: {
    id: "agent-orchestrator",
    name: "Orchestrator Agent",
    role: "coordinator",
    capabilities: ["task-delegation", "workflow-management", "result-aggregation"],
  },
  researcher: {
    id: "agent-researcher",
    name: "Research Agent",
    role: "specialist",
    capabilities: ["web-search", "data-analysis", "report-generation"],
  },
  analyst: {
    id: "agent-analyst",
    name: "Analysis Agent",
    role: "specialist",
    capabilities: ["market-analysis", "trend-detection", "forecasting"],
  },
  writer: {
    id: "agent-writer",
    name: "Writer Agent",
    role: "specialist",
    capabilities: ["content-creation", "summarization", "translation"],
  },
};

// Task types and their costs
const TASK_DEFINITIONS: Record<string, { cost: string; agents: string[]; description: string }> = {
  research: {
    cost: DEMO_AMOUNT,
    agents: ["orchestrator", "researcher"],
    description: "Market research on cryptocurrency trends",
  },
  analysis: {
    cost: "2000", // 0.002 USDT
    agents: ["orchestrator", "researcher", "analyst"],
    description: "Deep market analysis with forecasting",
  },
  report: {
    cost: "3000", // 0.003 USDT
    agents: ["orchestrator", "researcher", "analyst", "writer"],
    description: "Full market report with executive summary",
  },
};

// Task results by type
const TASK_RESULTS: Record<string, { summary: string; details: string[] }> = {
  research: {
    summary: "Bitcoin adoption has grown 40% YoY among institutional investors.",
    details: [
      "ETF approvals driving mainstream adoption",
      "Corporate treasury adoption increasing",
      "USDT remains dominant trading pair (70% market share)",
      "T402 micropayments emerging in DeFi protocols",
    ],
  },
  analysis: {
    summary: "Bullish momentum continues with strong support at $95,200.",
    details: [
      "RSI at 68, indicating strong but not overbought conditions",
      "MACD crossing up, confirming bullish trend",
      "Volume analysis shows accumulation pattern",
      "Target: $105,000 by end of quarter",
      "Risk level: Moderate (support break at $92,000)",
    ],
  },
  report: {
    summary: "DeFi TVL reached $180B in 2025, driven by RWA tokenization.",
    details: [
      "Cross-chain interoperability protocols gaining traction",
      "T402-enabled micropayments as key primitive for agent commerce",
      "Regulatory clarity improving in major markets",
      "Institutional DeFi participation up 85%",
      "Recommendation: Increase allocation to RWA-focused protocols",
    ],
  },
};

function createPaymentRequired(taskType: string, request: NextRequest) {
  const chain = getPreferredChain(request);
  const task = TASK_DEFINITIONS[taskType] || TASK_DEFINITIONS.research;

  return {
    t402Version: 2,
    error: "Payment required",
    resource: {
      url: "/api/demo/a2a-task",
      description: `Agent-to-Agent Task: ${task.description}`,
      mimeType: "application/json",
    },
    accepts: getAcceptsForChain(chain, task.cost),
  };
}

function generateConversation(taskType: string, agents: string[], result: { summary: string; details: string[] }) {
  const taskDef = TASK_DEFINITIONS[taskType] || TASK_DEFINITIONS.research;
  const messages: Array<{ agent: string; role: string; message: string; timestamp: string }> = [];
  const baseTime = Date.now();

  // Orchestrator initiates
  messages.push({
    agent: AGENTS.orchestrator.name,
    role: "coordinator",
    message: `Initiating task: "${taskDef.description}". Delegating to specialist agents.`,
    timestamp: new Date(baseTime).toISOString(),
  });

  // Each specialist acknowledges and reports
  agents.slice(1).forEach((agentId, index) => {
    const agent = AGENTS[agentId];
    if (!agent) return;

    messages.push({
      agent: agent.name,
      role: agent.role,
      message: `Task received. Processing using ${agent.capabilities[0]}...`,
      timestamp: new Date(baseTime + (index + 1) * 200).toISOString(),
    });
  });

  // Results from each agent
  agents.slice(1).forEach((agentId, index) => {
    const agent = AGENTS[agentId];
    if (!agent) return;

    const detailIndex = Math.min(index, result.details.length - 1);
    messages.push({
      agent: agent.name,
      role: agent.role,
      message: `Completed. Finding: ${result.details[detailIndex] || "Analysis complete."}`,
      timestamp: new Date(baseTime + 500 + (index + 1) * 300).toISOString(),
    });
  });

  // Orchestrator summarizes
  messages.push({
    agent: AGENTS.orchestrator.name,
    role: "coordinator",
    message: `Task completed. Summary: ${result.summary}`,
    timestamp: new Date(baseTime + 1500).toISOString(),
  });

  return messages;
}

export async function POST(request: NextRequest) {
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const paymentHeader = request.headers.get("payment-signature");

  let taskType = "research";
  let query = "";
  try {
    const body = await request.json();
    if (body.task) taskType = body.task;
    if (body.query) query = body.query;
  } catch {
    // Use defaults
  }

  // Validate task type
  if (!TASK_DEFINITIONS[taskType]) {
    taskType = "research";
  }

  const taskDef = TASK_DEFINITIONS[taskType];

  // No payment - return 402
  if (!paymentHeader) {
    const paymentRequired = createPaymentRequired(taskType, request);
    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Get result data
  const result = TASK_RESULTS[taskType] || TASK_RESULTS.research;
  const conversation = generateConversation(taskType, taskDef.agents, result);

  const taskResult = {
    id: "task-" + Date.now().toString(36),
    type: taskType,
    status: "completed",
    agents: taskDef.agents.map((id) => AGENTS[id]).filter(Boolean),
    conversation,
    result: {
      summary: result.summary,
      details: result.details,
    },
    cost: {
      amount: taskDef.cost,
      formatted: `${(parseInt(taskDef.cost) / 1000000).toFixed(4)} USDT`,
      breakdown: taskDef.agents.map((id) => ({
        agent: AGENTS[id]?.name || id,
        share: `${(100 / taskDef.agents.length).toFixed(0)}%`,
      })),
    },
    metadata: {
      query: query || null,
      startedAt: new Date(Date.now() - 2000).toISOString(),
      completedAt: new Date().toISOString(),
      duration: "1.8s",
    },
  };

  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 1000)); // Simulate agent processing
    const chain = getPreferredChain(request);
    const settleResponse = createMockSettleResponse(chain);
    const response = NextResponse.json(taskResult);
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Live mode: verify and settle
  const paymentPayload = decodeHeader(paymentHeader);
  const requirements = {
    scheme: "exact",
    network: getNetwork(),
    amount: taskDef.cost,
    asset: getAsset(),
    payTo: PAY_TO,
    maxTimeoutSeconds: 60,
    extra: { name: "USDT", version: "2" },
  };

  try {
    const verifyResult = await verifyPayment(paymentPayload, requirements);
    if (!verifyResult.isValid) {
      return NextResponse.json(
        { error: "Payment verification failed", reason: verifyResult.invalidReason },
        { status: 402 }
      );
    }

    const settleResult = await settlePayment(paymentPayload, requirements);
    if (!settleResult.success) {
      return NextResponse.json(
        { error: "Settlement failed", reason: settleResult.errorReason },
        { status: 500 }
      );
    }

    const response = NextResponse.json(taskResult);
    response.headers.set("Payment-Response", encodeHeader(settleResult));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Facilitator error", message: String(error) },
      { status: 502 }
    );
  }
}

/**
 * GET /api/demo/a2a-task - Get available tasks and agents
 */
export async function GET() {
  return NextResponse.json({
    protocol: "A2A",
    version: "2024-01-01",
    agents: Object.values(AGENTS),
    tasks: Object.entries(TASK_DEFINITIONS).map(([id, def]) => ({
      id,
      description: def.description,
      cost: def.cost,
      costFormatted: `${(parseInt(def.cost) / 1000000).toFixed(4)} USDT`,
      involvedAgents: def.agents.map((agentId) => AGENTS[agentId]?.name || agentId),
    })),
  });
}

/**
 * Support CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Payment-Signature, X-Demo-Mode, X-Preferred-Chain",
      "Access-Control-Expose-Headers": "Payment-Required, Payment-Response",
    },
  });
}
