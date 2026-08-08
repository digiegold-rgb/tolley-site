import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat | Tolley.io",
  description: "Internal AI chat console.",
  robots: { index: false, follow: false },
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
