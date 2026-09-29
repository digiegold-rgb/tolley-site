import { z } from "zod";
export const storySchema = z.object({
  title: z.string().min(15).max(120), description: z.string().min(40).max(240),
  paragraphs: z.array(z.string().min(40).max(1800)).min(4).max(12),
});
export type Story = z.infer<typeof storySchema>;
const privatePattern = /(?:\b(?:customer name|private report|security vulnerability)\b|\b(?:api[_ -]?key|access[_ -]?token|password|secret|credential)\s*(?:is|:|=)\s*\S+|\bsk[-_][a-zA-Z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b\d{3}[- .]\d{3}[- .]\d{4}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:fuck\w*|shit\w*|bitch\w*)\b)/i;
export function validateStory(value: unknown): Story {
  const s=storySchema.parse(value), text=[s.title,s.description,...s.paragraphs].join("\n");
  if(privatePattern.test(text) || /<[^>]*>|https?:\/\/|\]\(/.test(text)) throw Error("Story contains private, unsafe, or unverified embedded content");
  return s;
}
export const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function storyHtml(s: Story, url: string, releasedAt: string, retrospective: boolean) {
  return `<p><em>${retrospective ? "From the build archive. " : ""}Production release: ${escapeHtml(releasedAt.slice(0,10))}. Written with AI assistance from verified build records.</em></p>`+s.paragraphs.map(p=>`<p>${escapeHtml(p)}</p>`).join("\n")+`<p><a href="${escapeHtml(url)}">Explore what we built</a></p>`;
}
export function eligibleDeployment(d: { state?: string; readyState?: string; target?: string; readySubstate?: string; meta?: Record<string,string> }) {
  return (d.state || d.readyState) === "READY" && d.target === "production" && d.readySubstate !== "STAGED" && /^[a-f0-9]{40}$/.test(d.meta?.githubCommitSha || "");
}
