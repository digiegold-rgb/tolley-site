# claude/ — Cloud Routine Workspace

This directory is read/written by the **15 daily cloud routines** defined at
`/home/jelly/.claude/plans/guess-what-i-get-delegated-origami.md`.

Cloud routines clone this repo fresh on each fire, work in this dir, and push PRs
on `claude/*` prefix branches for Cordless to review before merging.

## Files here

| File | Used by | Purpose |
|---|---|---|
| `kc-agent-targets.csv` | Slot 1 | Target list of KC (and future PA) real estate agents for T-Agent cold outreach. Cordless seeds rows; routine marks `drafted_at` when emailed. |
| `linkedin-targets.csv` | Slot 5 | LinkedIn profile URLs to connect with (free LinkedIn, ~15/day cap). Cordless seeds. |
| `tagent-trials.json` | Slot 3 | DGX writes active trial list here daily (7am cron, future work). Routine reads to draft nurture emails. |
| `keyword-queue.md` | Slot 7 | Ordered backlog of long-tail SEO keywords for daily blog posts. |
| `vs-queue.md` | Slot 10 | Competitors to write "X vs Y" comparison pages for. |
| `investor-targets.csv` | Slot 15 | KC property owner list for Your KC Homes investor outreach. |
| `ad-creative/` | Slot 13 | Generated Google/FB ad creative variants bank. |
| `agent-leads.md` | Slot 2 | Running log of inbound T-Agent inquiry scores and reply drafts. |
| `revenue-log.json` | *(not slot-owned)* | Reserved for future. |

## Rules

- Routines only push to `claude/*` branches. Never let a routine touch `main`.
- Every outbound slot (1, 2, 3, 5, 15) drafts into **Gmail Drafts**. Never auto-sends.
- Every SEO slot (7, 8, 9, 10) opens a PR. Cordless merges → Vercel deploys.
