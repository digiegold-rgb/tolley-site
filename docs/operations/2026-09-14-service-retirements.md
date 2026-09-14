# Service retirements — September 14, 2026

Owner requested the pool off-season shutdown; retirement of Home Essentials Box,
Kerplunk, picnic tables, tables/chairs, and moving supplies; refreshed `/start`
and `/sales`; and replacement of the animated `/agent` hero.

## Production shutdowns

- Disabled local crontab entries: `pool360-sync`, `pool360-health`,
  `pool360-reauth`, `pool360-enrich`, and `retail-price-scan`.
- Disabled/stopped `pool360-sync.timer`; stopped its service.
- Terminated the running retail pool-price scanner and its browser process tree.
- Vercel project route **Pools off-season background shutdown** returns 410 for
  `/api/cron/pools-intelligence` and `/api/pools/{sync,enrich,competitor-prices}`.
  Removed the daily intelligence schedule from `vercel.json` and the cron dashboards.
- Home Essentials storefront `home-essentials-box`: `published=false`,
  `sellingEnabled=false`; associated operator `paused`. No recorded sales at shutdown.
  Its seed script now refuses to republish it.
- Vercel project routes **Home Essentials Box retired** and **Retired event and
  moving rentals** disable the corresponding public paths and descendants.
- Disabled the four dedicated Stripe payment links for Kerplunk, picnic tables,
  tables/chairs, and moving supplies. Existing transaction records retained.

Project routes apply to all deployments and persist across deployments. The
retired-path guard in `lib/retired-sites.ts` also returns 410 before page rendering.
Retired rentals are removed from discovery, the shared directory, and the rental
catalog. Pools remain available by direct URL but are excluded from promotion
while their background work is paused.

## Local records and restart

Local backups and verification screenshots are under
`/home/jelly/.local/state/pools-offseason/`. Backups containing operational data
stay on the machine and are not committed.

For a future pool reopening, explicitly restore only the five disabled cron
entries, remove the pool project route, restore the Vercel intelligence schedule,
and confirm supplier authentication and pricing before promoting the storefront.
Do not restore the entire saved crontab over newer unrelated jobs. The four rental
payment links and Home Essentials remain retired unless the owner reopens them.
