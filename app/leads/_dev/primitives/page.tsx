"use client";

import { useState } from "react";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { Drawer } from "@/components/ui/Drawer";
import { Dialog } from "@/components/ui/Dialog";
import { Tooltip } from "@/components/ui/Tooltip";
import { Popover } from "@/components/ui/Popover";
import { Accordion } from "@/components/ui/Accordion";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { KeyHint } from "@/components/ui/KeyHint";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import {
  CommandPaletteProvider,
  useCommandPalette,
  type Command,
} from "@/components/ui/CommandPalette";
import {
  Sidebar,
  SidebarBrand,
  SidebarSection,
  SidebarLink,
  SidebarFooter,
} from "@/components/ui/Sidebar";

export default function PrimitivesDevPage() {
  return (
    <ToastProvider>
      <CommandPaletteProvider commands={DEMO_COMMANDS}>
        <PrimitivesInner />
      </CommandPaletteProvider>
    </ToastProvider>
  );
}

const DEMO_COMMANDS: Command[] = [
  {
    id: "demo.hello",
    title: "Say hello",
    group: "Demo",
    keywords: ["hi", "greet"],
    shortcut: ["Cmd", "H"],
    run: ({ close }) => {
      alert("Hello from the palette!");
      close();
    },
  },
  {
    id: "demo.navigate",
    title: "Navigate to Cockpit",
    group: "Navigation",
    keywords: ["home", "dashboard"],
    run: ({ close }) => {
      close();
    },
  },
  {
    id: "demo.toast",
    title: "Show toast",
    group: "Demo",
    run: ({ close }) => {
      close();
    },
  },
];

function PrimitivesInner() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const palette = useCommandPalette();

  return (
    <div className="grid grid-cols-[16rem_1fr] gap-6">
      <Sidebar>
        <SidebarBrand>t-agent</SidebarBrand>
        <SidebarSection label="Primary">
          <SidebarLink item={{ href: "/leads", label: "Cockpit" }} />
          <SidebarLink item={{ href: "/leads/pipeline", label: "Pipeline" }} />
          <SidebarLink item={{ href: "/leads/people", label: "People" }} />
          <SidebarLink item={{ href: "/leads/marketing", label: "Marketing" }} />
          <SidebarLink item={{ href: "/leads/admin", label: "Admin" }} />
        </SidebarSection>
        <SidebarSection label="Shortcuts">
          <SidebarLink item={{ href: "/leads/snap", label: "Snap", accent: "purple" }} />
          <SidebarLink
            item={{ href: "/leads/unclaimed", label: "Unclaimed $", accent: "emerald" }}
          />
        </SidebarSection>
        <SidebarFooter>
          <div className="text-xs text-white/40">primitives demo</div>
        </SidebarFooter>
      </Sidebar>

      <div className="space-y-8 p-6">
        <section>
          <h2 className="mb-3 text-sm font-medium text-white/80">Tabs</h2>
          <Tabs defaultValue="activity">
            <TabList>
              <TabTrigger value="activity">Activity</TabTrigger>
              <TabTrigger value="notes">Notes</TabTrigger>
              <TabTrigger value="docs">Docs</TabTrigger>
            </TabList>
            <TabPanel value="activity" className="p-4 text-sm text-white/70">
              Activity panel content
            </TabPanel>
            <TabPanel value="notes" className="p-4 text-sm text-white/70">
              Notes panel content
            </TabPanel>
            <TabPanel value="docs" className="p-4 text-sm text-white/70">
              Docs panel content
            </TabPanel>
          </Tabs>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-white/80">Accordion</h2>
          <Accordion
            defaultOpen={["a"]}
            items={[
              {
                id: "a",
                title: "First section",
                count: 3,
                children: <p className="text-sm text-white/60">Panel A body</p>,
              },
              {
                id: "b",
                title: "Second section (alert)",
                alert: true,
                children: <p className="text-sm text-white/60">Panel B body</p>,
              },
              {
                id: "c",
                title: "Third section (highlight)",
                highlight: true,
                children: <p className="text-sm text-white/60">Panel C body</p>,
              },
            ]}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-white/80">Overlays</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              Open Drawer
            </button>
            <button
              onClick={() => setDialogOpen(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              Open Dialog
            </button>
            <button
              onClick={() => palette.open()}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              Open Command Palette
            </button>
            <button
              onClick={() =>
                toast({
                  title: "Toast fired",
                  description: "Everything looks good.",
                  variant: "success",
                })
              }
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              Show Toast
            </button>
          </div>
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title="Drawer demo"
          >
            <div className="p-5 text-sm text-white/70">Drawer body</div>
          </Drawer>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Dialog demo"
            description="A centered modal using the platform <dialog> element."
            footer={
              <button
                onClick={() => setDialogOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
              >
                Close
              </button>
            }
          >
            <p className="text-sm text-white/70">Dialog body contents go here.</p>
          </Dialog>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-white/80">
            Tooltip + Popover
          </h2>
          <div className="flex gap-4">
            <Tooltip label="Hello tooltip">
              <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80">
                Hover me
              </button>
            </Tooltip>
            <Popover
              trigger={
                <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80">
                  Popover
                </button>
              }
            >
              <div className="p-3 text-sm text-white/70">Popover body</div>
            </Popover>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-white/80">
            Skeleton + KeyHint
          </h2>
          <div className="grid gap-3">
            <Skeleton className="h-8 w-64" />
            <SkeletonText lines={3} />
            <div className="text-sm text-white/70">
              Press <KeyHint keys={["Cmd", "K"]} /> to open the palette.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
