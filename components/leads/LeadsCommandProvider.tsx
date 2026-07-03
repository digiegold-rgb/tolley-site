"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CommandPaletteProvider } from "@/components/ui/CommandPalette";
import { useToast } from "@/components/ui/Toast";
import { buildCommands } from "@/lib/command-registry";

/**
 * Client-side wrapper that builds the command registry with a live router +
 * toast context and feeds it into <CommandPaletteProvider>. Sits between the
 * server layout shell and the rest of the T-Agent tree.
 */
export default function LeadsCommandProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const commands = useMemo(
    () =>
      buildCommands({
        navigate: (href) => router.push(href),
        toast,
      }),
    [router, toast]
  );

  return (
    <CommandPaletteProvider commands={commands}>
      {children}
    </CommandPaletteProvider>
  );
}
