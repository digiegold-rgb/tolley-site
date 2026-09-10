# Make T-Agent useful to its owner first

The working hypothesis: T-Agent earns its place by helping Jared follow through with real people and turn existing relationships or requests into appointments and paid work. Listing volume, generated content, and software features do not establish that value.

## What the investigation established

**Code findings, September 9:**

- The original `/leads` cockpit builds “Today’s queue” by slicing the six highest-scoring listings. It does not choose the next promises due. It also duplicated those listings in a second hot-leads widget.
- Its original hot-lead query did not exclude finished/dead stages. Farm filtering joins through `Listing`, which can hide manually sourced people and probate leads without a listing relationship.
- The screen spreads work across research, chat, photos, statistics, tasks and shortcuts. A high score does not establish a reachable contact or an appropriate reason to call.
- The data structures needed for a useful daily routine already exist: subscriber-scoped contacts, tasks, activities, deals, and owner website inquiries.
- An owner without an active LeadSubscriber record is sent to pricing. The owner needs an explicit private workspace activation path to use the product without buying a subscription from himself.

**Recent local operating reports, not freshly queried production facts:**

- The September 6 seller report says 29 of 31 recent signals were Kansas prospects, while its recorded focus for Jared was Missouri. The two Missouri records were unusable: a ten-year-old obituary and a record with no matched address. It also identifies school/search-directory matches.
- That report says the Parcel table remained empty and the phone-enrichment export was still waiting for completion. Its three carried prospects were therefore not a working call list. Reading an unchanged MLS row did not constitute a fresh listing verification.
- The September 8 operating report says there had been no inbound lead for 18 days. A daily routine that assumes a constant stream of new inquiries would start empty.
- Older August notes identify approval/draft overload and recommend validating T-Agent with one real user. Jared can be that first user.

Private evidence remains on the Spark in `business-os/staged/license-calls-2026-09-06.md`, `business-os/staged/tier2-2026-09-08.json`, and `business-os/MONEY-MAP-2026-08.md`. No customer names, private balances, or contact lists from those reports were copied into this repository.

A read-only production aggregate query failed with `PrismaClientInitializationError`. These reports must not be represented as a current database audit, and their old prospects must not be automatically reactivated.

## The first useful routine

Use an initial 15-minute block as a trial, then measure whether that is realistic:

1. Bring one person who has requested help, one existing customer or referral partner, and one follow-up you have been carrying in your head. Use current relationships, not the old report's unverified names.
2. Open `/leads`. Work the next due promise. Read the note, open the contact details, and make the call or write the message yourself.
3. Record what happened: attempted, conversation, appointment, finished, or later. If work remains, choose the next step and time before leaving the record.
4. After three follow-ups, review any other time-sensitive commitments and get back to the rest of the day. Do not turn the application into another full-time job.

Example jobs: confirm an estate-sale walkthrough; follow up on a requested quote; check in with an existing delivery customer; ask an existing referral partner about a property client who already needs help. These are examples, not a claim that a specific customer is currently waiting.

## Implemented first version

- `/leads` is now **Today**, showing due/undated commitments before future work, a small initial batch, contact actions, context, result logging, and next-step scheduling.
- A short form creates the person and their follow-up together. It works without an MLS import.
- Existing contacts with no pending task or recently logged activity can be added deliberately. They are not automatically labeled ready to buy or contacted.
- Owner accounts can bring recent, new `LeadAction` inquiries into private follow-ups. Customers cannot query or import the owner's cross-business intake. Original HQ records remain intact.
- Attempt counts, conversations, appointments and finished tasks remain distinct. Seven-day counts are explicitly self-recorded activity; they are not Stripe revenue or proof of attribution.
- Saves are transactional and retry-safe, including creation, outcomes and rescheduling. Ownership and same-origin checks apply to mutations.
- Owner-only activation creates/enables an owner workspace without creating a Stripe subscription. New owner workspaces have zero SMS allowance; this change does not enable outbound automation.
- The existing research cockpit remains at `/leads/overview`. Its research query excludes terminal workflow stages; the sync display uses successful MLS runs and does not animate stale/unknown data as fresh.
- GPU, Game, existing customer workspaces, billing, and the previous URL cleanup remain preserved.

## The separate seller-research problem

The daily workflow does **not** fix the prospect-source engine. Before presenting research as a call opportunity, that engine needs:

1. The user's chosen service territory applied before ranking. Preserve other territories for the users who actually serve them.
2. Rejection of directory/school/search-result matches masquerading as people.
3. The event date separated from scrape time. Old or undated events require review rather than a manufactured “why now.”
4. A matched property and current evidence, with the source and verification date visible.
5. A usable, attributable contact record. Missing phone/name/address is a research task, not a ready call. A decedent's name is not a living contact.
6. A completed contact-enrichment/import loop, followed by revalidation of the existing records. Do not pay for new scans while the existing export stays unused.

Do not delete old research or silently restrict the shared product to one state's users. Do not claim that this pipeline is repaired by the Today screen. Its parser, promotion paths, enrichment providers and latest production data require a separate verified repair.

## Seven-day usefulness test

The initial success criteria are a hypothesis, not proven outcomes:

- Jared voluntarily opens it on at least five of seven days.
- It helps recover at least one forgotten/delayed follow-up.
- It records at least one useful conversation or appointment that he can describe in his own words.
- Adding a contact and saving a result are easy enough that he keeps doing them.
- Any claimed paid job can be traced to the actual contact, conversation and deal/payment evidence; the software's activity counter is not sufficient.

If those things do not happen, ask what work Jared actually did elsewhere and simplify the workflow around that. Do not respond by adding another dashboard, more generated drafts, or more lead volume.

Once it works for Jared, invite one similar working agent to try the same narrow routine. The pitch should describe the result he actually experienced. A credible example is “I stopped losing track of walkthrough and referral follow-ups,” backed by a real story. Avoid advertising guaranteed leads or income. Validate one user's retention and outcome before widening the pitch or adding paid acquisition.

## External comparison

Follow Up Boss documents daily lists based on stage and last communication, including removal from a follow-up list after recent contact. This supports using relationship state and promises to organize work; it does not establish that our implementation will sell. [Working Your Smart Lists](https://help.followupboss.com/hc/en-us/articles/360034301034-Working-Your-Smart-Lists), [Smart Lists Overview](https://help.followupboss.com/hc/en-us/articles/1500008374882-Smart-Lists-Overview).

HubSpot's sequence-task documentation links tasks to the associated contact and message context. The relevant design principle here is making the next action accessible beside the person. [Complete your sequence tasks](https://knowledge.hubspot.com/sequences/complete-your-sequence-tasks).

## Release status

Implemented on `feat/tagent-daily-use-20260909`, based on the unreleased URL cleanup and security work. No production records were changed and no outreach was sent. No new database migration is introduced by Today, but its prerequisite security migration and release checks still apply.

Validation and final deployment blockers are recorded in `docs/operations/tagent-daily-use-20260909.md`. Local source changes are not a live release.
