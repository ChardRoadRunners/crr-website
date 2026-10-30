# Old Webador URLs

Captured **19 September 2026** from `https://chard-road-runners.webador.co.uk/sitemap.xml`,
while the old site was still up.

`docs/launch-checklist.md` asks for this before the old site is cancelled on
30 September 2026. Once it is gone the list cannot be recovered, and every link
anybody has ever shared breaks with nothing to redirect it to.

**The redirects themselves are in `public/_redirects`** (written 30 October
2026). Cloudflare reads that file when the site deploys and answers each old
address with a permanent (301) redirect. Change a destination here, change it
there, in the same commit.

## The eleven pages

All eleven, exactly as the old sitemap gave them. The paths are what matter;
the host changes when the domain moves.

| Old path | Destination |
| --- | --- |
| `/` | `/` — no rule needed, the page is still there |
| `/contact` | `/contact` — no rule needed |
| `/pub-runs` | `/pub-runs` — slug kept deliberately, no rule needed |
| `/our-races` | `/our-races` — no rule needed |
| `/race-calendar` | `/calendar` — redirect |
| `/boring-legal-stuff/rules-and-constitution` | `/rules-and-constitution` — redirect |

The four with no rule must stay that way: a `_redirects` rule always wins
over a real page, so a rule pointing a page at its own address would loop.
Cloudflare adds the trailing slash on its own.

## The five that needed a decision

Decided by Matthew on 30 October 2026:

| Old path | Destination | Why |
| --- | --- | --- |
| `/our-races/chard-flyer` | `/our-races` | The new site has no per-race page. Lands at the top, not on the race's card — if the races ever get their own pages, point this at the new one. |
| `/our-races/forde-abbey-10k` | `/our-races` | Same. |
| `/club-championship` | `/results#championship` | The championship section of Results, using the anchor that was already there. Renaming that `id` breaks this redirect quietly — the page still loads, just at the top. |
| `/membership-form` | `/join-us` | The form itself stays off the website (it carries the club's bank details). Join Us has the fees, Connect My Club and who to email. |
| `/boring-legal-stuff` | `/rules-and-constitution` | The old legal index had no counterpart. The constitution was the only page that lived under it. |

## Testing them

Tested on 30 October 2026 with `wrangler dev`, which runs Cloudflare's own
redirect handling locally: every old address, with and without a trailing
slash, answers 301 and arrives in one hop, `#championship` included.

On the live site, after the domain moves, try each old address in a browser.
None of it does anything until `chardroadrunners.com` points at the new site —
the rules only match paths on whichever domain is serving this Worker.

## Also captured

The old `/pub-runs` page said this, in full. Recorded because it is the only
written description of a pub run the club had, and it goes when the site does:

> We aim to hold a monthly pub run during the summer starting and ending at a
> different pub each month.
>
> Dates are:- Wednesday 3rd July / Thursday 15th August / Thursday 5th
> September (head torches may be needed for thus one)
>
> contact us for more info.

No year was given. Note that two of the three dates are Thursdays, which does
not match "once a month on a Wednesday" — worth checking with the social
secretaries which it is, though the calendar now carries the real dates either
way.

The old navigation put **Pub Runs under Our Races**. The new site puts it in
the footer instead, since Our Races means the two races the club hosts.
