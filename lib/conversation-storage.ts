import type { ConversationState } from "@/types/chat";

const CONVERSATION_PREFIX = "t-agent-conversation:";
const ACTIVE_CONVERSATION_KEY = "t-agent-active-conversation";

function isBrowser() {
  return typeof window !== "undefined";
}

export function createConversationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `conv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function loadActiveConversation(): ConversationState | null {
  if (!isBrowser()) {
    return null;
  }

  const activeId = window.localStorage.getItem(ACTIVE_CONVERSATION_KEY);
  if (!activeId) {
    return null;
  }

  const serialized = window.localStorage.getItem(`${CONVERSATION_PREFIX}${activeId}`);
  if (!serialized) {
    return null;
  }

  try {
    return JSON.parse(serialized) as ConversationState;
  } catch {
    return null;
  }
}

export function saveConversation(state: ConversationState) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    `${CONVERSATION_PREFIX}${state.conversationId}`,
    JSON.stringify(state),
  );
  window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, state.conversationId);
}

export function clearConversation(conversationId: string) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(`${CONVERSATION_PREFIX}${conversationId}`);
  const activeId = window.localStorage.getItem(ACTIVE_CONVERSATION_KEY);
  if (activeId === conversationId) {
    window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
  }
}

export function clearActiveConversation() {
  if (!isBrowser()) {
    return;
  }

  const activeId = window.localStorage.getItem(ACTIVE_CONVERSATION_KEY);
  if (activeId) {
    window.localStorage.removeItem(`${CONVERSATION_PREFIX}${activeId}`);
  }
  window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
}
