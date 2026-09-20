# Race diary — seed entries and build notes

30 calendar entries, derived from the club's own race reports. Every date in here
comes from a race a CRR member actually ran, not from scraping anyone's website.

---

## What these are, and what they aren't

Each entry records a race the club has done, with a **rule** for roughly when it
happens — "last Sunday in November", "first Sunday in February".

**Every rule is derived from a single observation.** One year's date, from one
race report. That's enough to be useful and nowhere near enough to be certain.
An annual race can move by a fortnight, change to a different weekend, or stop
happening altogether.

So every entry ships as `status: expected`. The page must render those as
approximate — "late November" or "usually the last Sunday in November" — and
never as a specific day. A member turning up to a race that was actually the week
before is a worse outcome than a page that admits it doesn't know.

`status: confirmed` with a `confirmedDate` is set by a human who has checked the
organiser's website. That's the only route to showing an exact date.

---

## Two entries worth reading before the rest

**Chard Flyer** is the only `fixedDate` entry — always New Year's Day, so the
rule can't drift.

**Forde Abbey** has a deliberately wrong-looking rule. The observed date is 15
July 2026, but that year was postponed from June after a red weather warning. The
note says so. It's the clearest example of why a single observation isn't a
pattern, and it's the club's own race, so somebody knows the real answer.

---

## Some of these may not belong

Judgement calls for whoever reviews them:

- **New York Marathon** was in the archive and is excluded here. It's a race one
  member ran, not part of the club's year.
- **Cornish Marathon**, **Bovington**, **New Forest** and the **Bad Cow** weekend
  are all a fair distance away. Worth keeping if members regularly travel to them,
  worth dropping if 2017 was a one-off.
- **Chard Chaser** was in its second year in 2017. Check it still runs.
- **Bad Cow Frolic**, **Marathon** and **Half** are three entries for one weekend.
  Might read better as one entry with a note.

Deleting an entry is easier than inventing one, so err towards keeping and let
the first review cut them.

---

## Building the page

**Group by month, newest first from today.** A running diary is read forwards —
what's coming up — so start at the current month and run twelve months out.
Past months drop off.

**Render approximate dates honestly.** "Last Sunday in November" or "late
November", with the confirmed ones showing a real date and looking visibly more
solid. Don't use colour alone to distinguish them.

**Link each entry to the race reports that mention it.** The race name in the
report frontmatter matches the `name` here, so the Bicton Blister entry can show
what members wrote about it in 2017. That's the "member reviews" idea from the
backlog, with no review system, no moderation and no new infrastructure — and it
improves every time someone posts a report.

**Feed the homepage.** The "coming up" section is currently a placeholder. Three
next entries, same rules.

**Schedule a rebuild.** Built. A Cloudflare cron trigger, nightly at 04:00 UTC,
so the diary rolls forward on its own and past events drop off without anyone
doing anything. That's what stops this lapsing the way the old hand-maintained
calendar did.

It was weekly when this was written, and became nightly once the club's Google
calendars were read at build time as well: a diary moves in weeks, but an event
added to a calendar on a Tuesday shouldn't wait until the following Monday to
appear. The Worker is in
[workers/diary-rebuild/](../workers/diary-rebuild/README.md).

---

## The monthly job

One committee member, twenty minutes a month: **check the next eight weeks
only.** For each race in that window, find the organiser's page, confirm the
date, set `status: confirmed` with the real date, and add the entry link.

Eight weeks is the window that matters — nobody enters a June race from a page
they're reading in January. Bounding it is what makes the job finishable, and a
finishable job is one that still gets done in a year's time.

---

## The four statuses

Every entry is one of four things, and only the first two are listed on the
website:

| Status | Means | On the site |
| --- | --- | --- |
| `active` | Happening | Listed |
| `renamed` | Happening under a new name; this entry is the new one | Listed, badged with the old name |
| `dormant` | Did not run last time round, may return | Hidden |
| `retired` | Gone | Hidden |

`dormant` is the one people skip, and it is the useful one. The Battle of
Sedgemoor had no race in 2024 for want of a race director and nothing since —
that is not the same as the Bad Cow, whose organiser has closed. One is a
question for whoever knows a Langport Runner; the other is settled.

**Do not delete either.**

A hidden entry disappears from the diary and from the homepage's next three.
The file stays in the repository, which is the whole point of it: it is a record
that somebody looked at this race and what they found.

**Deleting instead would undo itself.** The entries here were derived from the
club's own race reports, and those reports are not going anywhere. Any later
pass over them — by hand or scripted — finds the same 2017 result for a race
that died in 2019 and adds it straight back, because nothing in the repository
says otherwise. A retired entry is what says otherwise.

So, for anything that derives diary entries from race reports:

> Skip a race name that already has an entry in `src/content/calendar-events`,
> whether or not that entry is retired. Existing entries win. New ones are only
> for names that appear nowhere.

The CMS entry list has a filter per status for finding them. There is no
default filter, so the list shows everything until you narrow it.

## Dates, and the one rule about them

Two separate questions, and they used to be muddled into one field:

- **`date`** — when the next running is, if we know. Fill it in even when it is
  a guess from a listings site: it puts the race in the right place in the
  order, and it will not be printed.
- **`dateConfirmed`** — has a human checked that date with the organiser? Only
  a true here earns a specific day on the page. Everything else gets "usually
  the second Sunday in February".

The page's wording is derived from that boolean, so there is no "check before
entering" note anybody has to remember to delete once a date is confirmed.

**A date in the past counts as unconfirmed however the boolean is set.** That
is checked in `hasExactDate`, not left to whoever edits the entry, because a
stale confirmed date rendering as fact is precisely what produced a diary full
of 2017 dates presented as certainties.

### The ones flagged as worth reviewing

The notes above singled these out as possibly not belonging: **Cornish
Marathon**, **Bovington**, **New Forest**, the three **Bad Cow** entries, and
**Chard Chaser**. All are now resolved — Cornish and New Forest have confirmed
2026 dates, the rest are retired. What remains open is listed under the second
review below.

---

## What the first review found, September 2026

The thirty seed entries were checked against the organisers a day after they
shipped. **Every entry whose only evidence was a 2017 or 2018 report was wrong.
Every entry with a recent report was still real.**

Seven races had stopped: the three Bad Cow entries (White Star Running became
Keep Running Rural, which has held its last event), Bovington, Chard Chaser and
both Dartmoor Vale entries. They are retired rather than deleted, each carrying
the evidence and the date it was checked.

Four were still running but wrongly described. The Bicton Blister is now the
Budleigh Blister, moved and shortened to 9.5 miles. Dark Valley is now a 10km
night trail run by BigFeat Events — same name, different race. The Humdinger
moved from February to March. And Forde Abbey, the club's own race, was
recorded from the one year it was postponed.

That last one is the lesson in miniature: the rule was derived from a single
observation, and the single observation was the exception.

**Age predicted wrongness better than anything else**, which is what
`npm run check:diary` now reports — every unconfirmed entry whose newest
published report is over three years old. It runs as part of the build and
prints a worklist without failing anything, because those entries are not
wrong, only unverified, and the page already renders them as approximate.


---

## What the second review found, September 2026

The remaining eleven entries, checked against the organisers. Ten resolved.

**Three were wrong about what the race even is.** The Axmouth Challenge is four
distances and our 9 miles was the long option, not the event. Blackmore Vale
starts at Bishop's Caundle, not Gillingham. The Cider Challenge is not a
distance race at all — it is a timed lap event on a farm, 8, 12 or 24 hours.

**Bridgwater was one event listed as two.** A half, a 10k and a 5k from a single
start, written up by members under both names, and sitting in the diary as two
races on the same day. That is what `distances` and `aliases` are for, and the
merged entry carries both old names so both reports still find it.

**One is dormant rather than dead.** Battle of Sedgemoor had no race in 2024
for want of a race director, organisers hoped for 2025, nothing since. That is a
different answer from the Bad Cow, whose organiser has shut, and the statuses
now say so.

**One needs a human.** Our own 2026 report puts the Cider Challenge on 27 June;
the organiser's 2026 edition is listed as 17–18 July at Blandford Forum, "on
tour". Both cannot be right about the same running, and the club's own report is
not evidence to overwrite from a listings page.

The pattern from the first review held. Everything wrong was old.
