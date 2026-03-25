import Anthropic from "@anthropic-ai/sdk";

interface ConversationMessage {
  agent: string;
  role: string;
  message: string;
  timestamp: string;
}

interface AgentTaskResult {
  conversation: ConversationMessage[];
  result: { summary: string; details: string[] };
}

// Agent system prompts — each agent gets a distinct persona
const AGENT_PROMPTS: Record<string, string> = {
  orchestrator:
    "You are an AI orchestrator agent in a multi-agent pipeline. Your job is to break down a task into sub-tasks for specialist agents. Be concise (2-3 sentences). State what needs to be done and which specialists should handle it.",
  researcher:
    "You are a research agent specializing in crypto, blockchain, and DeFi markets. Provide factual, data-driven findings based on your knowledge. Be concise (2-3 sentences). Focus on concrete data points and trends.",
  analyst:
    "You are a market analyst agent. Analyze data and identify actionable trends. Respond with exactly 3-4 concise bullet points, each on its own line starting with '- '.",
  writer:
    "You are a writer agent that synthesizes research and analysis into executive summaries. You MUST respond with valid JSON only, no other text. Format: {\"summary\": \"one sentence executive summary\", \"takeaways\": [\"point 1\", \"point 2\", \"point 3\"]}. Include 3-5 takeaways.",
};

const AGENT_NAMES: Record<string, string> = {
  orchestrator: "Orchestrator Agent",
  researcher: "Research Agent",
  analyst: "Analysis Agent",
  writer: "Writer Agent",
};

const AGENT_ROLES: Record<string, string> = {
  orchestrator: "coordinator",
  researcher: "specialist",
  analyst: "specialist",
  writer: "specialist",
};

// Pipeline definitions per task type
const PIPELINES: Record<string, string[]> = {
  research: ["orchestrator", "researcher"],
  analysis: ["orchestrator", "researcher", "analyst"],
  report: ["orchestrator", "researcher", "analyst", "writer"],
};

/**
 * Execute a real multi-agent Claude pipeline.
 * Each agent is a separate Claude Haiku call with a distinct system prompt.
 * Returns null on any failure so the caller can fall back to hardcoded results.
 */
export async function executeAgentTask(
  taskType: "research" | "analysis" | "report",
  query: string | null
): Promise<AgentTaskResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  const pipeline = PIPELINES[taskType] || PIPELINES.research;
  const topic = query || "cryptocurrency market trends and DeFi adoption in 2025";

  const conversation: ConversationMessage[] = [];
  const agentOutputs: Record<string, string> = {};

  // 15-second overall timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    for (const agentId of pipeline) {
      const systemPrompt = AGENT_PROMPTS[agentId];
      const userMessage = buildUserMessage(agentId, topic, agentOutputs);

      const message = await client.messages.create(
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        },
        { signal: controller.signal }
      );

      const textBlock = message.content.find((b) => b.type === "text");
      const response = textBlock?.text ?? "";
      agentOutputs[agentId] = response;

      conversation.push({
        agent: AGENT_NAMES[agentId],
        role: AGENT_ROLES[agentId],
        message: response,
        timestamp: new Date().toISOString(),
      });
    }

    clearTimeout(timeout);

    // Parse the final result based on which agent finished last
    const result = parseResult(taskType, pipeline, agentOutputs);
    return { conversation, result };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Build the user message for each agent, incorporating context from previous agents.
 */
function buildUserMessage(
  agentId: string,
  topic: string,
  previousOutputs: Record<string, string>
): string {
  switch (agentId) {
    case "orchestrator":
      return `Break down this task for our specialist agents: "${topic}"`;

    case "researcher": {
      const orchestratorContext = previousOutputs.orchestrator
        ? `\n\nOrchestrator directive: ${previousOutputs.orchestrator}`
        : "";
      return `Research the following topic: "${topic}"${orchestratorContext}`;
    }

    case "analyst": {
      const researchContext = previousOutputs.researcher
        ? `\n\nResearch findings: ${previousOutputs.researcher}`
        : "";
      return `Analyze market trends for: "${topic}"${researchContext}`;
    }

    case "writer": {
      const researchContext = previousOutputs.researcher
        ? `\n\nResearch findings: ${previousOutputs.researcher}`
        : "";
      const analysisContext = previousOutputs.analyst
        ? `\n\nAnalysis: ${previousOutputs.analyst}`
        : "";
      return `Create an executive summary for: "${topic}"${researchContext}${analysisContext}`;
    }

    default:
      return topic;
  }
}

/**
 * Parse the final pipeline output into { summary, details[] }.
 */
function parseResult(
  taskType: string,
  pipeline: string[],
  outputs: Record<string, string>
): { summary: string; details: string[] } {
  const lastAgent = pipeline[pipeline.length - 1];
  const lastOutput = outputs[lastAgent] || "";

  // For report tasks, the writer should have returned JSON
  if (taskType === "report" && lastAgent === "writer") {
    try {
      // Try to extract JSON from the response (writer might wrap it in markdown)
      const jsonMatch = lastOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || lastOutput.slice(0, 200),
          details: Array.isArray(parsed.takeaways) ? parsed.takeaways : [lastOutput],
        };
      }
    } catch {
      // Fall through to bullet-point parsing
    }
  }

  // For analyst output, parse bullet points
  if (lastAgent === "analyst") {
    const bullets = lastOutput
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter((line) => line.length > 0);

    if (bullets.length > 1) {
      return {
        summary: bullets[0],
        details: bullets,
      };
    }
  }

  // Generic fallback: first sentence as summary, split on sentence boundaries for details
  const sentences = lastOutput
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return {
    summary: sentences[0] || lastOutput.slice(0, 200),
    details: sentences.length > 1 ? sentences : [lastOutput],
  };
}
