import { AGENT_MODEL_OPTIONS, AGENT_TOOL_OPTIONS } from "@/lib/agent-options";

type AgentInput = {
  name?: unknown;
  rolePurpose?: unknown;
  modelProvider?: unknown;
  systemPrompt?: unknown;
  toolsEnabled?: unknown;
  webhookUrl?: unknown;
  phoneBinding?: unknown;
  emailBinding?: unknown;
};

export type AgentPayload = {
  name: string;
  rolePurpose: string;
  modelProvider: string;
  systemPrompt: string;
  toolsEnabled: string[];
  webhookUrl: string | null;
  phoneBinding: string | null;
  emailBinding: string | null;
};

function normalizeString(input: unknown, maxLength: number) {
  if (typeof input !== "string") {
    return "";
  }

  return input.trim().slice(0, maxLength);
}

function optionalString(input: unknown, maxLength: number) {
  const value = normalizeString(input, maxLength);
  return value ? value : null;
}

function normalizeTools(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  const allowed = new Set<string>(AGENT_TOOL_OPTIONS);
  const unique = new Set<string>();

  for (const item of input) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim();
    if (!allowed.has(normalized)) {
      continue;
    }
    unique.add(normalized);
  }

  return Array.from(unique).slice(0, AGENT_TOOL_OPTIONS.length);
}

export function parseAgentPayload(input: AgentInput) {
  const payload: AgentPayload = {
    name: normalizeString(input.name, 80),
    rolePurpose: normalizeString(input.rolePurpose, 280),
    modelProvider: normalizeString(input.modelProvider, 64),
    systemPrompt: normalizeString(input.systemPrompt, 8000),
    toolsEnabled: normalizeTools(input.toolsEnabled),
    webhookUrl: optionalString(input.webhookUrl, 300),
    phoneBinding: optionalString(input.phoneBinding, 50),
    emailBinding: optionalString(input.emailBinding, 120),
  };

  const errors: string[] = [];

  if (!payload.name) {
    errors.push("Agent name is required.");
  }

  if (!payload.rolePurpose) {
    errors.push("Role/Purpose is required.");
  }

  if (!payload.modelProvider) {
    errors.push("Model/Provider is required.");
  }

  if (!payload.systemPrompt) {
    errors.push("System prompt is required.");
  }

  if (payload.modelProvider && !AGENT_MODEL_OPTIONS.includes(payload.modelProvider as (typeof AGENT_MODEL_OPTIONS)[number])) {
    errors.push("Model/Provider value is not supported.");
  }

  if (payload.emailBinding && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.emailBinding)) {
    errors.push("Binding email is invalid.");
  }

  if (payload.webhookUrl) {
    try {
      const url = new URL(payload.webhookUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        errors.push("Webhook URL must use http or https.");
      }
    } catch {
      errors.push("Webhook URL is invalid.");
    }
  }

  return { payload, errors };
}
