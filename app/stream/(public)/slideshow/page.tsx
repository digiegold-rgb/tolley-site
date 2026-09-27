import { readFile } from "node:fs/promises";
import path from "node:path";
import Slideshow from "@/components/stream/Slideshow";
import { parseShowFile, showFileName } from "@/lib/stream/slideshow";

export const dynamic = "force-dynamic";

export default async function SlideshowPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; interval?: string; bg?: string }>;
}) {
  const sp = await searchParams;
  const fileName = showFileName(typeof sp.date === "string" ? sp.date : undefined);
  const fullPath = path.join(process.cwd(), "public", "stream", "shows", fileName);
  let show = null;
  let error: string | null = null;
  try {
    const parsed = parseShowFile(JSON.parse(await readFile(fullPath, "utf8")));
    if (parsed.ok) show = parsed.show;
    else error = parsed.error;
  } catch {
    error = `Missing or unreadable public/stream/shows/${fileName}`;
  }
  return (
    <Slideshow
      fileName={fileName}
      show={show}
      error={error}
      interval={typeof sp.interval === "string" ? sp.interval : ""}
      transparent={sp.bg === "transparent"}
    />
  );
}
