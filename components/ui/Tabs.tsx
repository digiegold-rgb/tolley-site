"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * URL-synced or local-state tabs. Pass `syncUrl` with a query param name to
 * persist the active tab in the URL. Otherwise purely local state.
 *
 *   <Tabs defaultValue="activity" syncUrl="tab">
 *     <TabList>
 *       <TabTrigger value="activity">Activity</TabTrigger>
 *       <TabTrigger value="notes">Notes</TabTrigger>
 *     </TabList>
 *     <TabPanel value="activity">...</TabPanel>
 *     <TabPanel value="notes">...</TabPanel>
 *   </Tabs>
 */

interface TabsCtx {
  value: string;
  setValue: (v: string) => void;
  idBase: string;
}

const Ctx = createContext<TabsCtx | null>(null);

function useTabs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Tabs components must be used inside <Tabs>");
  return ctx;
}

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  syncUrl,
  children,
  className = "",
}: {
  defaultValue: string;
  value?: string;
  onValueChange?: (v: string) => void;
  syncUrl?: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlValue = syncUrl ? searchParams?.get(syncUrl) ?? null : null;

  const [local, setLocal] = useState<string>(urlValue ?? defaultValue);
  const value = controlledValue ?? urlValue ?? local;

  const setValue = useCallback(
    (v: string) => {
      setLocal(v);
      onValueChange?.(v);
      if (syncUrl) {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set(syncUrl, v);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    },
    [onValueChange, syncUrl, pathname, router, searchParams]
  );

  // Use React's stable useId so SSR + hydration produce identical IDs.
  // (Previously used a module-level counter which caused tab id mismatch
  // hydration warnings.)
  const idBase = useId();
  const ctx = useMemo(() => ({ value, setValue, idBase }), [value, setValue, idBase]);

  return (
    <Ctx.Provider value={ctx}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
}

export function TabList({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 border-b border-white/10 ${className}`}
    >
      {children}
    </div>
  );
}

export function TabTrigger({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: active, setValue, idBase } = useTabs();
  const isActive = active === value;
  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-controls={`${idBase}-panel-${value}`}
      id={`${idBase}-trigger-${value}`}
      onClick={() => setValue(value)}
      className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
        isActive
          ? "border-white/60 font-medium text-white"
          : "border-transparent text-white/40 hover:text-white/70"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabPanel({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: active, idBase } = useTabs();
  if (active !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-trigger-${value}`}
      className={className}
    >
      {children}
    </div>
  );
}
