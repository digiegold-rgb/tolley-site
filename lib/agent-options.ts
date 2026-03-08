export const AGENT_MODEL_OPTIONS = [
  "openai:gpt-4.1-mini",
  "openai:gpt-4.1",
  "anthropic:claude-3-5-sonnet",
  "anthropic:claude-3-5-haiku",
] as const;

export const AGENT_TOOL_OPTIONS = [
  "web-search",
  "calendar",
  "email",
  "sms",
  "crm",
  "file-ops",
] as const;
