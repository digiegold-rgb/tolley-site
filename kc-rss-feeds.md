# Kansas City Metro / Jackson County RSS & Atom Feeds

Compiled: 2026-03-13
Verified via HTTP status code + content-type header + XML content inspection.

Legend:
- **VERIFIED** = Returns valid RSS/Atom XML (200 + correct content-type + parseable XML)
- **ACTIVE** = Most recent item within last 30 days
- **STALE** = Feed works but last post is older than 30 days
- **DEAD** = 404, 403, redirect to HTML, or paywall blocks feed

---

## 1. LOCAL NEWS

### FOX 4 Kansas City (WDAF-TV)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All stories | `https://fox4kc.com/feed/` | VERIFIED / ACTIVE | Updated hourly, last build 2026-03-13. WordPress RSS 2.0. |
| Local news only | `https://fox4kc.com/news/local-news/feed/` | VERIFIED / ACTIVE | KC metro local stories only. |
| Crime | `https://fox4kc.com/news/crime/feed/` | VERIFIED / ACTIVE | Crime and public safety. |
| Business | `https://fox4kc.com/news/business/feed/` | VERIFIED / ACTIVE | Local business news. |
| Politics | `https://fox4kc.com/news/politics/feed/` | VERIFIED / ACTIVE | Government and political news. |

### KSHB 41 (Scripps / ABC)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All stories | `https://www.kshb.com/about-us/rss.rss` | VERIFIED / ACTIVE | Last build 2026-03-13. Scripps RSS 2.0. Full articles in feed. |

### KMBC 9 (Hearst / ABC)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| Top stories | `https://www.kmbc.com/topstories-rss` | VERIFIED / ACTIVE | Last build 2026-03-13. Hearst XML format. |

### KCUR 89.3 (NPR)
KCUR's main `/feed` URL returns HTML, not RSS. Their RSS is delivered through podcast feeds:
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| Kansas City Today (daily news podcast) | `https://www.kcur.org/podcast/kansas-city-today/rss.xml` | VERIFIED / ACTIVE | Daily weekday episodes, last build 2026-03-13. Best KCUR news feed. |
| Up To Date (daily talk show) | `https://www.kcur.org/podcast/up-to-date/rss.xml` | VERIFIED / ACTIVE | Daily, covers housing, economy, local issues. Last build 2026-03-13. |
| Central Standard | `https://www.kcur.org/podcast/central-standard/rss.xml` | VERIFIED / STALE | Last episode April 2020. Show appears discontinued. |

### The Kansas City Beacon (nonprofit investigative)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All stories | `https://thebeaconnews.org/feed/` | VERIFIED / ACTIVE | Last build 2026-03-13. Strong coverage of MO legislature, KC government, housing policy. |

### Flatland KC (Kansas City PBS nonprofit newsroom)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All stories | `https://flatlandkc.org/feed/` | VERIFIED / ACTIVE | Last build 2026-03-09. Covers development, equity, neighborhoods, CitySceneKC archive. |

### The Pitch (alt-weekly)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All stories | `https://www.thepitchkc.com/feed/` | VERIFIED / ACTIVE | Last build 2026-03-13. News, arts, food, culture. |

### The Examiner (Eastern Jackson County daily)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All stories | `https://www.examiner.net/feed/` | VERIFIED / ACTIVE | Last build 2026-03-13. Covers Independence, Blue Springs, Grain Valley, Lee's Summit. Key for your area. |

### Kansas City Star
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| McClatchy feed | `https://feeds.mcclatchy.com/kansascity/stories` | DEAD | Connection timeout/SSL error. McClatchy infrastructure appears broken or deprecated. |
| Direct site | `https://www.kansascity.com/latest/rss/` | DEAD | Connection timeout. Site blocks non-browser requests aggressively. |

> **KC Star workaround**: No working RSS found. Use Google News RSS as a proxy:
> `https://news.google.com/rss/search?q=site:kansascity.com&hl=en-US&gl=US&ceid=US:en`

### KCTV5 (Gray Television / CBS)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| N/A | N/A | DEAD | No working RSS found. Gray Television sites do not expose RSS feeds. |

---

## 2. BUSINESS & ECONOMY

### Startland News (KC entrepreneurship / innovation)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All stories | `https://www.startlandnews.com/feed/` | VERIFIED / ACTIVE | Last build 2026-03-13. Startups, entrepreneurship, civic innovation. |

### Kansas City Business Journal
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| BizJournals feed | `https://feeds.bizjournals.com/bizj_kansascity` | DEAD (403) | Blocked behind paywall/authentication. |

> **KC Biz Journal workaround**: Google News RSS proxy:
> `https://news.google.com/rss/search?q=site:bizjournals.com/kansascity&hl=en-US&gl=US&ceid=US:en`

### Economic Development Corporation of Kansas City (EDCKC)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All posts | `https://edckc.com/feed/` | VERIFIED / ACTIVE | Last build 2026-03-04. Development incentives, TIF, business growth. |

### KC Area Development Council (KCADC / OneKC)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All posts | `https://onekc.org/feed/` | VERIFIED / ACTIVE | Last build 2026-03-13. Regional economic development, talent attraction. thinkkc.com redirects here. |

### Federal Reserve Bank of Kansas City
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| RSS page | `https://www.kansascityfed.org/about-us/rss/` | DEAD (renders blank) | Site requires JavaScript; no extractable RSS URLs. KC Fed publishes email alerts instead. |

> **KC Fed workaround**: Subscribe to email alerts at `https://www.kansascityfed.org/about-us/email-alerts/` for Economic Bulletin, Ag surveys, Beige Book, regional data.

### Visit KC (tourism/conventions)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| Press releases | `https://news.visitkc.com/rss.xml` | VERIFIED / ACTIVE | Last build 2026-03-05. Tourism, events, hospitality industry. |

---

## 3. GOVERNMENT

### Jackson County, MO
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| GovDelivery alerts | `https://public.govdelivery.com/accounts/MOJACKSONCO/signup/38632` | N/A (email) | No RSS. Email-only subscription for county news. |
| Prosecutor's office | `https://www.jacksoncountyprosecutor.com/rss.aspx` | DEAD | Returns HTML page, not actual RSS XML. CivicEngage platform. |

> **Jackson County workaround**: Monitor `https://www.jacksongov.org/News-articles` and `https://www.jacksongov.org/Our-County/About-Us/Media-Releases` via a page-change monitor.

### City of Independence, MO
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| N/A | N/A | DEAD | No RSS feed found. City uses GovDelivery email and social media. |
| News page | `https://www.independencemo.gov/news` | N/A | Monitor this page for city announcements. |

### City of Kansas City, MO (KCMO)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| N/A | N/A | DEAD | No working RSS found. kcmo.gov uses email newsletters only. |
| Newsletter signup | `https://kcmo.gov/subscribe` | N/A (email) | Subscribe for city meeting notices and news. |

### Missouri State Legislature
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| N/A | N/A | DEAD | No public RSS feeds from senate.mo.gov or house.mo.gov. |
| LegiScan MO | `https://legiscan.com/MO` | DEAD (403) | LegiScan blocks direct RSS; use their API (free tier: 30K queries/mo). |

> **MO Legislature workaround**: FastDemocracy (`https://fastdemocracy.com/states/mo/`) offers free bill tracking with daily/weekly email alerts.

---

## 4. REAL ESTATE

### Zillow (national market reports)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All press releases | `https://zillow.mediaroom.com/press-releases?pagetemplate=rss` | VERIFIED / ACTIVE | Last item 2026-03-11. National housing data, not KC-specific. |
| Housing/Rental research | `https://zillow.mediaroom.com/press-releases?pagetemplate=rss&category=816` | VERIFIED / ACTIVE | Filtered to housing market and rental research only. |

### Hands on the Heartland (Jason Brown Group - KC Realtor blog)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All posts | `https://handsontheheartland.com/feed/` | VERIFIED / ACTIVE | Last build 2026-03-02. KC area market updates, Johnson County, metro trends. |

### KCRAR (KC Regional Association of Realtors)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| N/A | N/A | DEAD | No RSS feed. Market stats at `https://kcrar.com/media-statistics/market-statistics/`. Monitor page directly. |

---

## 5. NEIGHBORHOODS & COMMUNITY

### Northeast News (Historic Northeast KC)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All stories | `https://northeastnews.net/pages/feed/` | VERIFIED / ACTIVE | Last build 2026-03-13. Hyper-local since 1932. Note: `/pages/feed/` not `/feed/`. |
| Podcast (Northeast Newscast) | `https://rss.buzzsprout.com/88569.rss` | VERIFIED | Community interviews, neighborhood issues. |

### Martin City Telegraph (South KC)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All stories | `https://martincitytelegraph.com/feed/` | VERIFIED / ACTIVE | Last build 2026-03-13. South KC below I-435 to Hwy 150. |

### Midtown KC Post
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All stories | `https://midtownkcpost.com/feed/` | VERIFIED / STALE | Last build 2026-01-14. Block-by-block Midtown history. Publishes irregularly. |

### CitySceneKC (Downtown KC development)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| N/A | `https://cityscenekc.com/feed/` | DEAD (redirect) | Redirects to flatlandkc.org. CitySceneKC archive donated to Flatland. Use Flatland feed instead. |

---

## 6. CRIME & SAFETY

### KCPD Crime Data (via Open Data KC / Socrata)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| 2026 crime data | `https://data.kcmo.org/api/views/f7wj-ckmw/rows.rss` | VERIFIED / ACTIVE | Structured data: report #, offense, beat, address, date. Updated as incidents are logged. |

> **Note**: This is raw tabular data in RSS wrappers, not narrative articles. Each item = one crime report row. High volume. Best consumed programmatically.

### Jackson County Prosecutor
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| N/A | N/A | DEAD | CivicEngage platform RSS page exists but returns HTML. No working feed. |

### MO Highway Patrol
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| RSS page | `https://www.mshp.dps.missouri.gov/MSHPWeb/RSSNewsFeed.html` | DEAD | Landing page only, no extractable RSS URLs found. |

---

## 7. DEVELOPMENT & CONSTRUCTION

### EDCKC (see Business section above)
`https://edckc.com/feed/` -- includes development incentive news, TIF districts, construction projects.

### Flatland KC (see Local News section above)
`https://flatlandkc.org/feed/` -- absorbed CitySceneKC's downtown development coverage.

### KCMO Open Data - Building Permits
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| Permits dashboard | `https://data.kcmo.org/stories/s/Building-Permits-Dashboards/sq5v-m7n2/` | N/A | Interactive dashboard, no RSS. Use Socrata API for programmatic access. |

---

## 8. UNIVERSITY & RESEARCH

### UMKC Roo News (student newspaper)
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| All stories | `https://kcroonews.com/feed/` | VERIFIED / ACTIVE | Last build 2026-03-12. Student journalism covering UMKC and KC community. |

### University of Missouri System
| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| System-wide RSS | `https://www.umsystem.edu/rss` | UNVERIFIED | RSS page exists but could not confirm feed content (JS-rendered). |

---

## BONUS FEEDS

### Google News KC Proxies (for outlets without RSS)
These generate RSS from Google News search results. Useful for paywalled or RSS-less sources:

| Source | Google News RSS URL |
|--------|---------------------|
| KC Star | `https://news.google.com/rss/search?q=site:kansascity.com&hl=en-US&gl=US&ceid=US:en` |
| KC Biz Journal | `https://news.google.com/rss/search?q=site:bizjournals.com/kansascity&hl=en-US&gl=US&ceid=US:en` |
| Jackson County MO | `https://news.google.com/rss/search?q=%22Jackson+County%22+Missouri&hl=en-US&gl=US&ceid=US:en` |
| Independence MO | `https://news.google.com/rss/search?q=%22Independence+Missouri%22&hl=en-US&gl=US&ceid=US:en` |
| KC real estate market | `https://news.google.com/rss/search?q=%22Kansas+City%22+real+estate+housing+market&hl=en-US&gl=US&ceid=US:en` |
| KC development | `https://news.google.com/rss/search?q=%22Kansas+City%22+development+construction+project&hl=en-US&gl=US&ceid=US:en` |

---

## SUMMARY: WORKING FEEDS (copy-paste ready OPML import list)

All 22 verified, actively updated feeds:

```
https://fox4kc.com/feed/
https://fox4kc.com/news/local-news/feed/
https://fox4kc.com/news/crime/feed/
https://fox4kc.com/news/business/feed/
https://fox4kc.com/news/politics/feed/
https://www.kshb.com/about-us/rss.rss
https://www.kmbc.com/topstories-rss
https://www.kcur.org/podcast/kansas-city-today/rss.xml
https://www.kcur.org/podcast/up-to-date/rss.xml
https://thebeaconnews.org/feed/
https://flatlandkc.org/feed/
https://www.thepitchkc.com/feed/
https://www.examiner.net/feed/
https://www.startlandnews.com/feed/
https://edckc.com/feed/
https://onekc.org/feed/
https://news.visitkc.com/rss.xml
https://northeastnews.net/pages/feed/
https://martincitytelegraph.com/feed/
https://midtownkcpost.com/feed/
https://kcroonews.com/feed/
https://handsontheheartland.com/feed/
```

Data feeds (structured, not articles):
```
https://data.kcmo.org/api/views/f7wj-ckmw/rows.rss
https://zillow.mediaroom.com/press-releases?pagetemplate=rss&category=816
https://zillow.mediaroom.com/press-releases?pagetemplate=rss
```

Podcast feeds:
```
https://rss.buzzsprout.com/88569.rss
```
