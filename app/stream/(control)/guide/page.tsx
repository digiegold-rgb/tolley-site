import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { redirect } from "next/navigation";
import { validateWdAdmin } from "@/lib/wd-auth";
import "./guide.css";

export default async function StreamGuide() {
  if (!(await validateWdAdmin()).authed) redirect("/login?callbackUrl=/stream/guide");
  const guide = await readFile(path.join(process.cwd(), "ops/stream/OPERATIONS.md"), "utf8");
  return (
    <main className="stream-guide">
      <nav aria-label="Streaming guide navigation"><Link href="/hq">← HQ</Link><Link href="/stream">Stream controls →</Link></nav>
      <article><ReactMarkdown remarkPlugins={[remarkGfm]}>{guide}</ReactMarkdown></article>
    </main>
  );
}
