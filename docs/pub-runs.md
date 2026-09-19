# Pub runs

`/pub-runs` is the club's monthly summer pub runs and the annual Pubs Run. It
kept the slug the old Webador site used, so links people have already shared
still land.

## Where the dates come from

**The CRR Socials calendar in Google.** Nothing else. A pub run is added there
exactly like any other social, and it then shows up in three places on its own:

- `/pub-runs`, under "Coming up"
- `/calendar`, in the socials section
- nowhere else — there is no second list to keep in step

This was a deliberate choice over giving pub runs their own content collection.
A pub run *is* a social, so it goes in that calendar regardless. A collection
would have meant entering the same event twice, and two homes for one date is
the drift that `resolveRaceDate` exists to catch on races. It also keeps the
social secretaries in the tool they already use rather than making them learn
the CMS — the old race calendar lapsed because only one person could update it,
and that is the failure this arrangement is trying not to repeat.

## How a pub run is recognised

By its **title**. `isPubRun` in `src/utils/calendar.ts` keeps any socials event
whose title contains "pub run", "pub runs", "pubs run" or "pub-run", in any
case.

**This is the weak point of the page, and it is worth being honest about it.**
Nothing in a Google Calendar event says "this is a pub run", so a naming
convention is holding up a page. The failure is silent: a pub run titled
"Summer social at The George" does not error, it simply never appears.

Three things soften that:

1. **The match is deliberately generous.** Matching too widely pulls a party
   onto a page about pub runs, which somebody notices and mentions. Matching
   too narrowly empties a page nobody is checking. The first is the better
   failure.
2. **The wordings are pinned.** `scripts/check-calendar.mjs` holds the
   titles that must match and the near-misses that must not — "pub quiz" and
   "club run" among them. They run on every build.
3. **The build says something.** If the socials calendar has events in it and
   none of them look like pub runs, the build prints the titles it found and
   what to do about it. It does not fail: an empty pub run list is correct for
   most of the year.

An empty list is normal. Pub runs are a summer thing, so `emptyState` in
`src/content/pages/pub-runs.md` is what the page says from about October to
May, and it is written to read as a season rather than a fault.

If the convention ever proves too fragile, **the honest fix is a field the
secretaries fill in — not a cleverer regex.** Google Calendar has no custom
fields, so that would mean either a separate pub runs calendar of its own
(added to `CALENDAR_IDS`, no title matching at all) or moving the dates into a
content collection and accepting the double entry. The separate calendar is the
better of those two.

## What is on the page but not in the calendar

`src/content/pages/pub-runs.md` holds the wording: what a pub run is, the
annual Pubs Run, and a "Before you come" section.

**That section ships empty on purpose.** It is meant to answer the three
questions a newcomer actually has, and none of them had been confirmed when the
page was built:

- How far and how fast is a monthly pub run?
- Are non-members and guests welcome?
- How does the food work — booked ahead, ordered on the night, roughly what?

The section does not render at all while the list is empty, so the page says
nothing it cannot stand behind. Add any of them in the CMS and it appears.

## Deliberately not built

Route maps and pub reviews. Both were raised and both are after-launch.
