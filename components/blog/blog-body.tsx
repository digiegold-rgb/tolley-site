"use client";

import parse from "html-react-parser";

interface BlogBodyProps {
  html: string;
}

/**
 * Renders static, author-controlled blog post HTML using html-react-parser,
 * which converts HTML strings to safe React elements — no eval, no raw injection.
 * Content is sourced exclusively from lib/blog-posts.ts — never from user input.
 */
export function BlogBody({ html }: BlogBodyProps) {
  return (
    <div
      className="prose prose-invert prose-sm sm:prose-base max-w-none
        prose-headings:font-bold prose-headings:text-white/90 prose-headings:leading-snug
        prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-white/8 prose-h2:pb-2
        prose-h3:text-base prose-h3:mt-7 prose-h3:mb-3
        prose-p:text-white/65 prose-p:leading-7
        prose-li:text-white/65 prose-li:leading-7
        prose-strong:text-white/85
        prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:text-cyan-300 prose-a:font-medium
        prose-blockquote:border-l-cyan-500/50 prose-blockquote:bg-white/[0.03] prose-blockquote:rounded-r-lg
        prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:not-italic
        prose-ol:text-white/65 prose-ul:text-white/65"
    >
      {parse(html)}
    </div>
  );
}
