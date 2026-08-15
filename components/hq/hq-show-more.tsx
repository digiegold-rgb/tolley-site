"use client";

/**
 * Shared "showing N of M — Show more" footer.
 *
 * /hq used to render every row of every list at full height, which produced
 * pages 10,832–62,075px tall (HQ-02): the bottom of the Stats table sat roughly
 * 30 screens below the fold and the browser laid out all of it on every render.
 * Lists now page in HQ_PAGE_SIZE chunks. Nothing is removed — the rest is one
 * click away, and "Show all" is there for anyone who wants to ⌘F the full set.
 */

export const HQ_PAGE_SIZE = 50;

export function HqShowMore({
  shown,
  total,
  onMore,
  onAll,
  noun,
}: {
  shown: number;
  total: number;
  onMore: () => void;
  onAll: () => void;
  noun: string;
}) {
  if (total <= shown) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "10px 0 2px",
        fontSize: 12,
        color: "var(--hq-ink-2)",
      }}
    >
      <span>
        Showing {shown} of {total} {noun}
      </span>
      <button className="btn btn-sm" onClick={onMore}>
        Show {Math.min(HQ_PAGE_SIZE, total - shown)} more
      </button>
      <button className="btn btn-sm" onClick={onAll}>
        Show all {total}
      </button>
    </div>
  );
}
