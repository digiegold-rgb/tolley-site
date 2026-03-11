const AGENT_PATTERNS: [RegExp, string][] = [
  [/claude/i, "Claude"],
  [/chatgpt/i, "ChatGPT"],
  [/anthropic/i, "Anthropic"],
  [/openai/i, "OpenAI"],
  [/perplexity/i, "Perplexity"],
  [/cohere/i, "Cohere"],
  [/cursor/i, "Cursor"],
  [/copilot/i, "Copilot"],
  [/gpt-/i, "GPT"],
  [/agent/i, "Agent"],
  [/bot\b/i, "Bot"],
  [/spider/i, "Spider"],
  [/crawler/i, "Crawler"],
];

export function isAgentRequest(
  userAgent?: string,
  acceptHeader?: string
): { isAgent: boolean; agentName?: string } {
  if (acceptHeader?.includes("text/markdown")) {
    return { isAgent: true, agentName: "Markdown-Agent" };
  }

  if (!userAgent) return { isAgent: false };

  for (const [pattern, name] of AGENT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { isAgent: true, agentName: name };
    }
  }

  return { isAgent: false };
}
