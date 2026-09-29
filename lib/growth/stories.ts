import { prisma } from "@/lib/prisma";
import { blogPosts, type BlogPost } from "@/lib/blog-posts";
export async function allBlogPosts(): Promise<BlogPost[]> {
  const stories = await prisma.buildStory.findMany({ where: { status: "published", publishedAt: { not: null } }, orderBy: { publishedAt: "desc" } });
  return [...stories.map(s => ({ slug: s.slug, title: s.title, description: s.description, body: s.body, category: s.retrospective ? "From the build archive" : "Building Tolley", tags: ["Behind the scenes", "AI building"], readingTime: Math.max(1, Math.ceil(s.body.split(/\s+/).length/220)), publishedAt: s.publishedAt!.toISOString() })), ...blogPosts];
}
