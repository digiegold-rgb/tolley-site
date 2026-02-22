"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";

import { AccountPopover } from "@/components/portal/account-popover";
import { AccomplishmentDrift } from "@/components/portal/accomplishment-drift";
import { ChatThread } from "@/components/portal/chat-thread";
import { DebugPanel } from "@/components/portal/debug-panel";
import { DropOverlay } from "@/components/portal/drop-overlay";
import { LoginModal } from "@/components/portal/login-modal";
import { MemoryPanel } from "@/components/portal/memory-panel";
import { PaywallModal } from "@/components/portal/paywall-modal";
import { SearchBar } from "@/components/portal/search-bar";
import { SearchProgress } from "@/components/portal/search-progress";
import { UsageLimitModal } from "@/components/portal/usage-limit-modal";
import {
  clearActiveConversation,
  createConversationId,
  loadActiveConversation,
  saveConversation,
} from "@/lib/conversation-storage";
import type {
  AgentMessage,
  AskApiResponse,
  ListingCard,
  MemorySummary,
  UsageMeta,
} from "@/types/chat";

type SearchStatus = "idle" | "searching" | "success" | "error";

type ForgetTarget = {
  key: string;
  index?: number;
};

const SEARCH_ERROR_MESSAGE = "Service temporarily unavailable. Try again.";

function createMessageId(role: AgentMessage["role"]) {
  return `${role}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeCards(cards: AskApiResponse["cards"]): ListingCard[] {
  if (!Array.isArray(cards)) {
    return [];
  }

  return cards
    .filter((card) => typeof card?.address === "string" && card.address.trim())
    .map((card) => ({
      type: typeof card.type === "string" ? card.type : "listing",
      address: card.address.trim(),
      price: typeof card.price === "number" ? card.price : null,
      beds: typeof card.beds === "number" ? card.beds : null,
      baths: typeof card.baths === "number" ? card.baths : null,
      sqft: typeof card.sqft === "number" ? card.sqft : null,
      summaryBullets: Array.isArray(card.summaryBullets)
        ? card.summaryBullets.filter((item) => typeof item === "string")
        : [],
      link: typeof card.link === "string" ? card.link : undefined,
      source: typeof card.source === "string" ? card.source : undefined,
    }));
}

function normalizeFollowUps(followUps: AskApiResponse["followUps"]) {
  if (!Array.isArray(followUps)) {
    return [];
  }

  return followUps.filter((item): item is string => typeof item === "string");
}

function normalizeErrorMessage(errorCode: string | undefined) {
  switch (errorCode) {
    case "SUBSCRIPTION_REQUIRED":
      return "Choose a plan to continue with T-Agent.";
    case "USAGE_LIMIT_REACHED":
      return "You have reached your current plan usage limit.";
    case "SESSION_EXPIRED":
      return "Session expired. Please sign in again.";
    case "LOGIN_REQUIRED":
      return "Sign in required.";
    default:
      return SEARCH_ERROR_MESSAGE;
  }
}

export function TAgentPortal() {
  const { data: session, status: authStatus } = useSession();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [usageMeta, setUsageMeta] = useState<UsageMeta | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [agentUrl, setAgentUrl] = useState("loading...");
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginModalTitle, setLoginModalTitle] = useState("Sign In Required");
  const [loginModalMessage, setLoginModalMessage] = useState(
    "Log in with your email link to continue searching.",
  );
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [usageResetAt, setUsageResetAt] = useState<string | null>(null);
  const [usagePlan, setUsagePlan] = useState<string | null>(null);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<
    "basic" | "pro" | null
  >(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [lastAskRawJson, setLastAskRawJson] = useState<Record<string, unknown> | null>(
    null,
  );
  const [lastRequestMeta, setLastRequestMeta] = useState<{
    requestId?: string;
    latency?: number;
    cached?: boolean;
  }>({});
  const [pingStatus, setPingStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [pingError, setPingError] = useState<string | null>(null);
  const [pingResponse, setPingResponse] = useState<Record<string, unknown> | null>(
    null,
  );
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [memorySummary, setMemorySummary] = useState<MemorySummary | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [savingListingAddress, setSavingListingAddress] = useState<string | null>(
    null,
  );
  const dragDepthRef = useRef(0);

  const isSearching = status === "searching";
  const hasConversation = messages.length > 0;

  useEffect(() => {
    const cachedConversation = loadActiveConversation();

    if (cachedConversation?.conversationId) {
      setConversationId(cachedConversation.conversationId);
      setMessages(cachedConversation.messages || []);
      return;
    }

    setConversationId(createConversationId());
  }, []);

  useEffect(() => {
    if (!conversationId || !messages.length) {
      return;
    }

    saveConversation({
      conversationId,
      messages,
      updatedAt: new Date().toISOString(),
    });
  }, [conversationId, messages]);

  useEffect(() => {
    const handleKeyToggle = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (event.metaKey && key === "k") {
        event.preventDefault();
        setIsDebugOpen((currentValue) => !currentValue);
      }

      if (event.metaKey && key === "m") {
        event.preventDefault();
        setIsMemoryOpen((currentValue) => !currentValue);
      }
    };

    window.addEventListener("keydown", handleKeyToggle);
    return () => {
      window.removeEventListener("keydown", handleKeyToggle);
    };
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      setIsLoginOpen(false);
      setLoginModalTitle("Sign In Required");
      setLoginModalMessage("Log in with your email link to continue searching.");
    }
  }, [authStatus]);

  useEffect(() => {
    if (!isDebugOpen) {
      return;
    }

    let active = true;

    const loadDebugConfig = async () => {
      try {
        const response = await fetch("/api/debug-config", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as { agentUrl?: string };

        if (!active) {
          return;
        }

        setAgentUrl(data.agentUrl || "not configured");
      } catch {
        if (!active) {
          return;
        }

        setAgentUrl("unavailable");
      }
    };

    void loadDebugConfig();

    return () => {
      active = false;
    };
  }, [isDebugOpen]);

  useEffect(() => {
    if (!isMemoryOpen || authStatus !== "authenticated") {
      return;
    }

    let active = true;

    const loadMemory = async () => {
      setMemoryLoading(true);
      setMemoryError(null);

      try {
        const response = await fetch("/api/memory/get", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId }),
        });

        const data = (await response.json()) as MemorySummary & { error?: string };

        if (!active) {
          return;
        }

        if (!response.ok || data.error) {
          setMemoryError(data.error || "Unable to load memory.");
          return;
        }

        setMemorySummary(data);
      } catch {
        if (!active) {
          return;
        }

        setMemoryError("Unable to load memory.");
      } finally {
        if (active) {
          setMemoryLoading(false);
        }
      }
    };

    void loadMemory();

    return () => {
      active = false;
    };
  }, [authStatus, conversationId, isMemoryOpen]);

  const hasFilePayload = (event: DragEvent<HTMLElement>) => {
    return Array.from(event.dataTransfer.types).includes("Files");
  };

  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!hasFilePayload(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!hasFilePayload(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!isDragActive) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!hasFilePayload(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!hasFilePayload(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragActive(false);
  };

  const openLoginModal = (title: string, message: string) => {
    setLoginModalTitle(title);
    setLoginModalMessage(message);
    setIsLoginOpen(true);
  };

  const callAskApi = async (question: string, activeConversationId: string) => {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question, conversationId: activeConversationId }),
    });

    const data = (await response.json()) as AskApiResponse;
    setLastAskRawJson(data as Record<string, unknown>);
    setLastRequestMeta({
      requestId: typeof data.requestId === "string" ? data.requestId : undefined,
      latency: typeof data.latency === "number" ? data.latency : undefined,
      cached: typeof data.cached === "boolean" ? data.cached : undefined,
    });

    return { response, data };
  };

  const startCheckout = async (plan: "basic" | "pro") => {
    setCheckoutLoadingPlan(plan);
    setBillingError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        if (data.error === "LOGIN_REQUIRED") {
          openLoginModal(
            "Session Expired",
            "Please log in again to start your subscription.",
          );
        } else {
          setBillingError("Unable to start checkout. Please try again.");
        }
        return;
      }

      window.location.href = data.url;
    } catch {
      setBillingError("Unable to start checkout. Please try again.");
    } finally {
      setCheckoutLoadingPlan(null);
    }
  };

  const openBillingPortal = async () => {
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setBillingError("Unable to open billing portal right now.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setBillingError("Unable to open billing portal right now.");
    }
  };

  const runSearch = async (queryInput: string) => {
    if (!queryInput || isSearching) {
      return;
    }

    if (authStatus !== "authenticated") {
      openLoginModal(
        "Sign In Required",
        "Log in with your email link to unlock T-Agent search.",
      );
      return;
    }

    const activeConversationId = conversationId || createConversationId();
    if (!conversationId) {
      setConversationId(activeConversationId);
    }

    const userMessage: AgentMessage = {
      id: createMessageId("user"),
      role: "user",
      text: queryInput,
      createdAt: new Date().toISOString(),
    };

    setStatus("searching");
    setErrorMessage(null);
    setBillingError(null);
    setQuery("");
    setMessages((currentMessages) => [...currentMessages, userMessage]);

    try {
      const { response, data } = await callAskApi(queryInput, activeConversationId);

      if (!response.ok || data?.error) {
        const errorCode = data?.error;

        if (errorCode === "LOGIN_REQUIRED") {
          openLoginModal(
            "Sign In Required",
            "Log in with your email link to continue.",
          );
        } else if (errorCode === "SESSION_EXPIRED") {
          openLoginModal(
            "Session Expired",
            "Your session timed out due to inactivity. Log in again to continue.",
          );
        } else if (errorCode === "SUBSCRIPTION_REQUIRED") {
          setIsPaywallOpen(true);
        } else if (errorCode === "USAGE_LIMIT_REACHED") {
          setUsagePlan(data.usage?.plan || "basic");
          setUsageResetAt(data.usage?.resetAt || data.resetAt || null);
          setIsUsageModalOpen(true);
        }

        setErrorMessage(normalizeErrorMessage(errorCode));
        setStatus("error");
        return;
      }

      const assistantMessage: AgentMessage = {
        id: createMessageId("assistant"),
        role: "assistant",
        text:
          typeof data.answer === "string" && data.answer.trim()
            ? data.answer
            : "I can keep refining this. Ask me for a tighter location, budget, or property type.",
        cards: normalizeCards(data.cards),
        followUps: normalizeFollowUps(data.followUps),
        requestId: typeof data.requestId === "string" ? data.requestId : undefined,
        cached: typeof data.cached === "boolean" ? data.cached : undefined,
        latency: typeof data.latency === "number" ? data.latency : undefined,
        createdAt: new Date().toISOString(),
      };

      setMessages((currentMessages) => [...currentMessages, assistantMessage]);
      setUsageMeta(data.usage || null);

      if (typeof data.conversationId === "string" && data.conversationId.trim()) {
        setConversationId(data.conversationId.trim());
      }

      setStatus("success");
    } catch {
      setErrorMessage(SEARCH_ERROR_MESSAGE);
      setStatus("error");
    }
  };

  const pingAgent = async () => {
    setPingStatus("loading");
    setPingError(null);
    setPingResponse(null);

    try {
      const activeConversationId = conversationId || createConversationId();
      const { response, data } = await callAskApi("health check", activeConversationId);
      setPingResponse(data as Record<string, unknown>);

      if (!response.ok || data?.error) {
        setPingStatus("error");
        setPingError(data?.error || "Service temporarily unavailable");
        return;
      }

      setPingStatus("success");
    } catch {
      const message = "Service temporarily unavailable";
      setPingStatus("error");
      setPingError(message);
      setPingResponse({ error: message });
      setLastAskRawJson({ error: message });
    }
  };

  const handleFollowUp = (followUp: string) => {
    setQuery(followUp);
    void runSearch(followUp);
  };

  const handleNewChat = () => {
    clearActiveConversation();
    setMessages([]);
    setQuery("");
    setUsageMeta(null);
    setErrorMessage(null);
    setStatus("idle");
    setConversationId(createConversationId());
  };

  const refreshMemory = async () => {
    if (authStatus !== "authenticated") {
      openLoginModal("Sign In Required", "Sign in to access memory.");
      return;
    }

    setMemoryLoading(true);
    setMemoryError(null);

    try {
      const response = await fetch("/api/memory/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = (await response.json()) as MemorySummary & { error?: string };

      if (!response.ok || data.error) {
        setMemoryError(data.error || "Unable to load memory.");
        return;
      }

      setMemorySummary(data);
    } catch {
      setMemoryError("Unable to load memory.");
    } finally {
      setMemoryLoading(false);
    }
  };

  const saveListing = async (listing: ListingCard) => {
    if (authStatus !== "authenticated") {
      openLoginModal("Sign In Required", "Sign in to save listings.");
      return;
    }

    setSavingListingAddress(listing.address);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/memory/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversationId, listing }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok || data.error) {
        setErrorMessage(data.error || "Unable to save listing right now.");
        return;
      }

      if (isMemoryOpen) {
        await refreshMemory();
      }
    } catch {
      setErrorMessage("Unable to save listing right now.");
    } finally {
      setSavingListingAddress(null);
    }
  };

  const forgetMemoryItem = async ({ key, index }: ForgetTarget) => {
    if (authStatus !== "authenticated") {
      openLoginModal("Sign In Required", "Sign in to edit memory.");
      return;
    }

    try {
      const response = await fetch("/api/memory/forget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, key, index }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok || data.error) {
        setMemoryError(data.error || "Unable to remove memory item.");
        return;
      }

      await refreshMemory();
    } catch {
      setMemoryError("Unable to remove memory item.");
    }
  };

  const clearSessionMemory = async () => {
    if (authStatus !== "authenticated") {
      openLoginModal("Sign In Required", "Sign in to clear memory.");
      return;
    }

    try {
      await fetch("/api/memory/forget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, key: "session", clearSession: true }),
      });
    } catch {
      setMemoryError("Unable to clear session memory.");
    }

    setMemorySummary(null);
    handleNewChat();
  };

  const exportMemoryJson = () => {
    if (!memorySummary || typeof window === "undefined") {
      return;
    }

    const blob = new Blob([JSON.stringify(memorySummary, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `t-agent-memory-${new Date().toISOString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main
      className="portal-shell ambient-noise relative flex min-h-screen w-full items-center justify-center overflow-hidden px-5 py-10 sm:px-8"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AccomplishmentDrift />
      <DropOverlay visible={isDragActive} />
      <DebugPanel
        visible={isDebugOpen}
        agentUrl={agentUrl}
        lastRequestId={lastRequestMeta.requestId}
        latency={lastRequestMeta.latency}
        cached={lastRequestMeta.cached}
        rawResponse={lastAskRawJson}
        pingStatus={pingStatus}
        pingError={pingError}
        pingResponse={pingResponse}
        onPing={pingAgent}
      />
      <MemoryPanel
        visible={isMemoryOpen}
        memory={memorySummary}
        loading={memoryLoading}
        errorMessage={memoryError}
        onRefresh={() => {
          void refreshMemory();
        }}
        onForget={forgetMemoryItem}
        onClearSession={() => {
          void clearSessionMemory();
        }}
        onExport={exportMemoryJson}
      />

      {authStatus === "authenticated" ? (
        <div className="absolute top-5 right-5 z-30">
          <button
            type="button"
            onClick={() => setIsAccountOpen((currentValue) => !currentValue)}
            className="h-9 w-9 rounded-full border border-white/22 bg-white/[0.06] text-xs font-semibold text-white/90"
            aria-label="Account"
          >
            A
          </button>
          <AccountPopover
            visible={isAccountOpen}
            email={session?.user?.email}
            onManageBilling={openBillingPortal}
            onSignOut={() => void signOut({ callbackUrl: "/" })}
          />
        </div>
      ) : null}

      <div aria-hidden="true" className="portal-spotlight portal-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-right" />

      <section className="portal-hero relative z-20 flex w-full max-w-4xl -translate-y-[7vh] flex-col items-center">
        <p className="mb-3 text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase sm:text-xs">
          t-agent
        </p>
        <h1 className="mb-8 text-center text-2xl font-semibold tracking-[0.02em] text-white/94 sm:mb-10 sm:text-[2.45rem]">
          Real Estate Unlocked.
        </h1>

        <div className="w-full max-w-3xl">
          {hasConversation ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/18 bg-white/[0.03] px-3 py-1.5 text-[0.62rem] font-semibold tracking-[0.09em] text-white/75 uppercase transition hover:bg-white/[0.08]"
                  onClick={handleNewChat}
                >
                  New chat
                </button>
              </div>

              <ChatThread
                messages={messages}
                onFollowUp={handleFollowUp}
                onSaveListing={(listing) => {
                  void saveListing(listing);
                }}
                savingListingAddress={savingListingAddress}
              />

              <p className="mt-4 mb-2 text-[0.65rem] tracking-[0.11em] text-white/62 uppercase">
                Keep talking
              </p>
              <SearchBar
                value={query}
                onChange={setQuery}
                onSubmit={runSearch}
                locked={isSearching}
              />
            </>
          ) : (
            <SearchBar
              value={query}
              onChange={setQuery}
              onSubmit={runSearch}
              locked={isSearching}
            />
          )}

          <div className="flex min-h-9 items-center justify-between gap-3">
            <SearchProgress visible={isSearching} />
            {usageMeta ? (
              <span className="rounded-full border border-white/18 bg-white/[0.03] px-3 py-1 text-[0.65rem] tracking-[0.1em] text-white/72 uppercase">
                {usageMeta.remaining}/{usageMeta.limit} remaining
              </span>
            ) : null}
          </div>

          {status === "error" && errorMessage ? (
            <p className="mt-3 text-center text-sm leading-6 text-rose-200/84">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </section>

      <LoginModal
        visible={isLoginOpen}
        title={loginModalTitle}
        message={loginModalMessage}
        onClose={() => setIsLoginOpen(false)}
      />
      <PaywallModal
        visible={isPaywallOpen}
        loadingPlan={checkoutLoadingPlan}
        errorMessage={billingError}
        onClose={() => setIsPaywallOpen(false)}
        onStartPlan={startCheckout}
      />
      <UsageLimitModal
        visible={isUsageModalOpen}
        plan={usagePlan}
        resetAt={usageResetAt}
        onClose={() => setIsUsageModalOpen(false)}
        onUpgrade={() => void startCheckout("pro")}
      />
    </main>
  );
}
