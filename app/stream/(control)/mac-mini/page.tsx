import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { redirect } from "next/navigation";
import { validateWdAdmin } from "@/lib/wd-auth";
import "../guide/guide.css";
import "./mac-mini.css";

export default async function MacMiniHub() {
  if (!(await validateWdAdmin()).authed) redirect("/login?callbackUrl=/stream/mac-mini");
  const guide = await readFile(path.join(process.cwd(), "ops/stream/mac-mini-hub/README.md"), "utf8");
  return (
    <main className="stream-guide mac-mini-hub">
      <nav aria-label="Mac mini hub navigation">
        <Link href="/hq">← HQ</Link>
        <Link href="/stream/assistant">Open Show Assistant →</Link>
        <Link href="/stream">Stream controls →</Link>
      </nav>
      <p><a href="/api/stream/mac-mini-setup" download="Tolley-Mac-Mini-Setup.command">Download Mac mini setup</a></p>
      <p>Save the setup to Downloads on the mini, then run <code>bash ~/Downloads/Tolley-Mac-Mini-Setup.command</code> in Terminal. It opens Sharing settings for Remote Login and Screen Sharing.</p>
      <article><ReactMarkdown remarkPlugins={[remarkGfm]}>{guide}</ReactMarkdown></article>
    </main>
  );
}
