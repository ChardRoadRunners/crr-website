# Content model

The collections, their frontmatter, and the rules that keep the Astro schema
and the CMS agreeing. Split out of CLAUDE.md, which keeps the pointer and the
one rule you cannot afford to miss.

See also `docs/handover.md` for the decisions that look like oversights.

---

## Collections

Five, all in `src/content/`:

- **`race-reports`** — race reports and club news. Note the hyphen.
- **`races`** — the two club-hosted races.
- **`pages`** — copy for one-off pages (`home.md`, `join-us.md`, `pub-runs.md`).
  A discriminated union: each entry is its own shape, picked by the `page`
  field. Some of these pages carry only the wording around a list whose
  contents come from elsewhere — `calendar.md` and `pub-runs.md` both do, and
  their empty-state copy is the page, not a fallback.
- **`legal`** — welfare, inclusion, privacy, and the rules and constitution. One
  shared shape, and the only collection whose Markdown body is rendered as the
  page. Routed by `src/pages/[legal].astro`, so a new file gets a route on its
  own — but its footer link still has to be added to `FOOTER_PAGE_LINKS`.
- **`calendar-events`** — the race diary. Each entry is a rule for roughly when
  a race happens ("last Sunday in November"), not a date, because every rule was
  derived from a single race report. Entries ship as `status: expected` and the
  page must never render those as a specific day. `docs/race-diary.md` has the
  reasoning; `src/utils/race-diary.ts` is the only place a rule becomes a date.

`race-reports` and `races` each have their own `images/` folder beside the
Markdown, because image paths are relative to the file. A photo used in two
collections needs a copy in both.

### race-reports frontmatter

- **`races`** — an array, one entry per race the post covers. Weekend round-ups
  have up to five. Each has `name`, optional `distance`, and its own `raceDate`.
- **There is no top-level date field and one must not be added.** Sort by the
  earliest `raceDate` in the array, via the helper in `src/utils/`.
- **`distance`** is `{ value, unit }` with unit `"km"` or `"mi"` — never a string.
  This exists so a site-wide miles/km switch can convert. Never render it raw.
- `posted` — when the report was written. Display only, never for ordering.
- `dateApproximate` — when true, render month and year only.
- `author`, `heroImage`, `images` may all be absent. Posts with no photos must
  render cleanly using the contour fallback block.

### The CMS mirrors this schema

`public/admin/config.yml` describes these same fields a second time, as forms
for Sveltia CMS. **A change to `src/content.config.ts` is a change to
`public/admin/config.yml`, in the same commit.** If the two drift, the CMS
accepts a post that the Astro build then rejects — and that failure lands on
the committee member who wrote it, which is the exact thing the CMS exists to
prevent.

Two settings keep them agreeing, and both are easy to undo by accident:

- **`output.omit_empty_optional_fields: true`.** Without it, an untouched
  optional field is written as `''` or `null`. Astro reads those as the wrong
  type and fails the build; an absent key is what `.optional()` and
  `.default()` expect.
- **`required: false` on every optional field.** Sveltia defaults `required`
  to *true*, so a field left unmarked becomes mandatory in the editor even
  though Astro is happy without it.

Dates are safe unquoted: Sveltia writes YAML plain scalars, and Astro parses
frontmatter as YAML 1.2, so `raceDate: 2026-08-01` arrives as a date and
`startTime: 11:00:00` stays a string.
