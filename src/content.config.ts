import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const distance = z.object({
  value: z.number(),
  unit: z.enum(["km", "mi"]),
});

// A date that may legitimately not be set yet. YAML gives us a Date for
// `2025-02-19`; an unset one arrives as "" from a hand-edited file, and both
// mean the same thing to a template, so "" is normalised away here.
const reviewDate = z
  .union([z.date(), z.literal("")])
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const raceReports = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/race-reports" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),

      // One entry per race the post covers. Weekend round-ups have several.
      // Sort posts by the EARLIEST raceDate in this array — there is no
      // top-level date field, so nothing can drift out of sync.
      races: z
        .array(
          z.object({
            name: z.string(),
            // Optional: timed events (12-hour, lapped ultras) have no fixed distance.
            // Stored as value + unit so the site-wide mi/km switch can convert.
            distance: distance.optional(),
            raceDate: z.date(),
          })
        )
        .min(1),

      // True when a raceDate is a best guess rather than confirmed.
      // Templates should render month and year only when this is set.
      dateApproximate: z.boolean().default(false),

      // When the report was written. Display only — never used for ordering.
      posted: z.date().optional(),

      // Empty string allowed: archive posts often have no byline.
      author: z.string().default(""),

      category: z
        .enum(["Race Report", "Club News", "Couch to 5k", "Social"])
        .default("Race Report"),

      // True for Chard Flyer and Forde Abbey — races the club puts on.
      clubRace: z.boolean().default(false),

      // Optional throughout: posts without photos must render cleanly.
      heroImage: image().optional(),
      // Only meaningful alongside heroImage. Provisional on archive posts
      // where nobody who was there has confirmed who's in the photo.
      //
      // INTENTIONALLY LOOSER THAN THE CMS — do not tighten to match it.
      // Optional here so the archive posts that arrived without alt text keep
      // building. The CMS requires it whenever a photo is set, enforced by the
      // preSave hook in public/admin/index.html, because Sveltia has no
      // conditional validation and `required: true` would demand a description
      // on posts that have no photo at all. New content gets alt text; old
      // content is left alone. See the matching note in public/admin/config.yml.
      heroImageAlt: z.string().optional(),
      // Which part of the hero survives the crop to a 1200x630 share card.
      //
      // Facebook and WhatsApp render a preview at a wide letterbox shape, so a
      // portrait photo loses roughly two thirds of its height. Cropping from
      // the centre decapitated three named members; cropping from the top fixed
      // those and broke a fourth photo whose subjects stand low in the frame.
      // There is no correct global value, so it is set per post.
      //
      // Only the share card is affected — the hero on the page itself is
      // unchanged. Sharp's own position names; "centre" is the default and is
      // what every post that omits this gets.
      heroImagePosition: z
        .enum(["centre", "top", "bottom"])
        .default("centre"),
      images: z
        .array(z.object({ src: image(), alt: z.string() }))
        .default([]),

      excerpt: z.string(),
      draft: z.boolean().default(false),
    }),
});

const races = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/races" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      slug: z.string(),

      distance,

      // Next running of the race. Optional so the page still builds between
      // one year's race and the next year's date being confirmed.
      nextDate: z.date().optional(),
      startTime: z.string().optional(),
      venue: z.string().optional(),

      // entryUrl only renders when entriesOpen is true — this is what stops
      // a dead entry link sitting on the page for eleven months of the year.
      entryUrl: z.string().url().optional(),
      entriesOpen: z.boolean().default(false),

      series: z.string().optional(),
      seriesNote: z.string().optional(),

      juniorRace: z.boolean().default(false),
      juniorRaceNote: z.string().optional(),

      raceDirector: z.string().optional(),

      // The race's own address, for entrants asking about the race itself —
      // road closures, parking, whether the junior race is on. A club address
      // per race rather than the director's own, so it survives them handing
      // the job on and no volunteer's personal inbox goes on the website.
      contactEmail: z.string().email().optional(),

      timing: z.string().optional(),
      resultsUrl: z.string().url().optional(),
      facebookEventUrl: z.string().url().optional(),

      heroImage: image().optional(),
      // Same intentional mismatch as race-reports: optional here, required by
      // the CMS whenever a photo is set. See the note above.
      heroImageAlt: z.string().optional(),

      // Controls order on the Our Races landing page.
      order: z.number().default(99),
    }),
});

const cta = z.object({ label: z.string(), href: z.string() });

const night = z.object({
  day: z.string(),
  time: z.string(),
  venue: z.string(),
  summary: z.string(),
  detail: z.string(),
});

// Copy nobody has written yet is parked in the content file as "TODO — …".
// Stripping it here means the page renders without that line, rather than
// publishing a note that was meant for whoever edits the file.
const draftable = z
  .string()
  .optional()
  .transform((value) =>
    value?.trimStart().startsWith("TODO") ? undefined : value
  );

// src/content/pages/home.md
const homePage = z.object({
  page: z.literal("home"),
  hero: z.object({
    heading: z.string(),
    strapline: z.string(),
    primaryCta: cta,
    secondaryCta: cta,
  }),
  clubNights: z.object({
    heading: z.string(),
    intro: z.string(),
    nights: z.array(night),
    reassurance: z.string(),
  }),
  handicap: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  couchTo5k: z.object({
    heading: z.string(),
    body: z.string(),
    // Empty until a course date is confirmed — the page shows
    // emptyState instead of a blank or invented date.
    nextCourse: z.string().default(""),
    // Shown when nextCourse is empty.
    emptyState: z.string(),
    cta,
  }),
  latestReports: z.object({
    heading: z.string(),
    linkLabel: z.string(),
    emptyState: z.string(),
  }),
  upcoming: z.object({
    heading: z.string(),
    linkLabel: z.string(),
    emptyState: z.string(),
    // Shown on a race that counts towards the championship. The homepage
    // carries its own wording rather than reading the calendar page's — each
    // page owns what it says.
    championshipLabel: z.string().min(1),
  }),
  ourRaces: z.object({
    heading: z.string(),
    intro: z.string(),
    linkLabel: z.string(),
  }),
});

// src/content/pages/join-us.md
const joinUsPage = z.object({
  page: z.literal("join-us"),
  hero: z.object({
    heading: z.string(),
    strapline: z.string(),
  }),
  firstVisit: z.object({
    heading: z.string(),
    intro: draftable,
    // Rendered as a labelled list. `detail` may hold what3words references
    // (///word.word.word) and, for the address, meaningful line breaks.
    steps: z
      .array(
        z.object({
          label: z.string(),
          detail: z.string(),
          // Optional, and per step rather than per page, so the map sits with
          // whichever step describes the place and travels with it if the
          // steps are reordered. Only "Where" carries one today. The picture
          // is a file in the repository — this is just the copy around it.
          map: z
            .object({
              // Describes the place, not the picture.
              alt: z.string().min(1),
              // The anchor's own text, so the link reads as a link with
              // images off.
              linkLabel: z.string().min(1),
              url: z.string().url(),
              // OpenStreetMap's licence requires attribution wherever the
              // map appears.
              credit: z.string().min(1),
            })
            .optional(),
        })
      )
      .min(1),
    reassurance: z.string(),
  }),
  whichNight: z.object({
    heading: z.string(),
    // Each already names its own day — the template adds no heading of
    // its own, so the day stays part of the copy.
    tuesday: z.string(),
    thursday: z.string(),
  }),
  membership: z.object({
    heading: z.string(),
    intro: draftable,
    options: z
      .array(
        z.object({
          name: z.string(),
          price: z.string(),
          detail: z.string(),
        })
      )
      .min(1),
    renewal: draftable,
    howToPay: z.string(),
    connectMyClubCode: z.string(),
    // Empty until there's a form to point at. Nothing renders while it is,
    // so the page never shows a dead link.
    formUrl: z.string().default(""),
    membershipEmail: z.string().email(),
  }),
  couchTo5k: z.object({
    heading: z.string(),
    body: z.string(),
    // Same pattern as the homepage: emptyState shows while this is blank.
    nextCourse: z.string().default(""),
    emptyState: z.string(),
  }),
  questions: z.object({
    heading: z.string(),
    body: z.string(),
  }),
});

// src/content/pages/contact.md
//
// Only ONE address is stored here — the general one, which has nowhere else to
// live. The membership, welfare and race addresses belong to the join-us page,
// the welfare page and the races collection, and the contact page reads them
// from there. Restating them would be a second source of truth for a thing that
// changes rarely and silently: the day somebody updates the welfare address on
// the welfare page, a stale copy here would send a safeguarding concern into a
// dead mailbox, and nothing would fail.
const contactPage = z.object({
  page: z.literal("contact"),
  hero: z.object({
    heading: z.string(),
    strapline: z.string(),
  }),
  intro: z.string(),

  general: z.object({
    label: z.string(),
    detail: z.string(),
    email: z.string().email(),
  }),

  // Label and wording only. Each of these three renders the address owned by
  // the collection named above.
  membership: z.object({ label: z.string(), detail: z.string() }),
  welfare: z.object({ label: z.string(), detail: z.string() }),
  races: z.object({ label: z.string(), detail: z.string() }),

  // Where we meet. The map is a committed image, not an embed: no third-party
  // script, no cookie banner, and nothing extra to explain on the privacy
  // page. It is regenerated by hand when the map needs to change, which is
  // roughly never.
  whereWeAre: z.object({
    heading: z.string(),
    address: z.string(),
    // Describes the place, not the picture. Somebody who cannot see the map
    // needs to know where the club is, not that a map is present.
    mapAlt: z.string().min(1),
    // The anchor's own text, so the link still reads as a link with images
    // off and announces itself properly to a screen reader.
    linkLabel: z.string().min(1),
    mapUrl: z.string().url(),
    // OpenStreetMap's licence requires attribution wherever the map is shown.
    // Required, and min(1), so it cannot be emptied by accident.
    credit: z.string().min(1),
  }),

  committee: z.object({
    heading: z.string(),
    // Nothing renders while this is a TODO — a committee list is names and
    // roles of real people, and inventing one is worse than not having it.
    body: draftable,
  }),
});

// The calendar page.
//
// Two of its three sections are read from the club's Google calendars at
// build time; the third is the rule-based race diary. The empty states are
// real copy rather than "no events found" in a component, because an empty
// calendar is a legitimate state somebody has to read.
const calendarPage = z.object({
  page: z.literal("calendar"),
  hero: z.object({ heading: z.string(), strapline: z.string() }),
  seo: z.object({ description: z.string() }),

  clubNights: z.object({
    heading: z.string(),
    intro: z.string(),
    emptyState: z.string(),
  }),

  socials: z.object({
    heading: z.string(),
    intro: z.string(),
    emptyState: z.string(),
  }),

  races: z.object({
    heading: z.string(),
    intro: z.string(),
    emptyState: z.string(),
  }),

  // Wording shown on individual events, shared by every page that lists them.
  championshipLabel: z.string().min(1),
  entryLabel: z.string().min(1),

  raceDiary: z.object({ heading: z.string(), intro: z.string() }),
});

// The pub runs page.
//
// Its dates are not here. They are read from the socials calendar in Google
// and filtered by title, because a pub run IS a social and the secretaries
// already keep that calendar — giving it a second home here would be the
// two-dates-for-one-race problem that resolveRaceDate exists to catch. This
// file holds the wording around them.
const pubRunsPage = z.object({
  page: z.literal("pub-runs"),
  hero: z.object({ heading: z.string(), strapline: z.string() }),
  seo: z.object({ description: z.string() }),

  intro: z.string(),

  upcoming: z.object({
    heading: z.string(),
    intro: z.string(),
    emptyState: z.string(),
  }),

  pubsRun: z.object({ heading: z.string(), body: z.string() }),

  // Pace, guests and food: the questions a newcomer asks, none of them
  // confirmed at the time of writing. An empty list is a legitimate state
  // and hides the section, rather than printing a heading over nothing or
  // an invented answer.
  practicalities: z.object({
    heading: z.string(),
    items: z
      .array(z.object({ question: z.string(), answer: z.string() }))
      .default([]),
  }),

  footnote: z.string(),
});

// One collection, one file per page, each page its own shape. The `page`
// field picks the branch — which also means a validation error names the
// field that's wrong instead of listing every page's fields at once.
const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.discriminatedUnion("page", [
    homePage,
    joinUsPage,
    contactPage,
    calendarPage,
    pubRunsPage,
  ]),
});

// Welfare, privacy, inclusion, and the rules and constitution. Deliberately
// not part of `pages`: that collection is a discriminated union of one-off
// page shapes, and these four share one shape — a title, an intro and a
// Markdown body — so they would only bloat the union. They are also the only
// content whose Markdown body is rendered as the page.
//
// A file here gets its route automatically from src/pages/[legal].astro, but
// its footer link still has to be added to FOOTER_PAGE_LINKS in consts.ts.
const legal = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/legal" }),
  schema: z.object({
    title: z.string(),
    intro: z.string(),

    // Only the pages that carry a date have these. An empty string counts as
    // absent: the CMS omits empty optional fields, but a hand-authored file
    // can still arrive with `lastReviewed: ""`, and the page shows nothing
    // rather than a blank or invented date.
    lastUpdated: reviewDate,
    lastReviewed: reviewDate,

    // Welfare only. Named here rather than left to the body so the contact
    // can be rendered as a real mailto and kept findable, per CLAUDE.md.
    welfareOfficer: z
      .object({ name: z.string(), email: z.string().email() })
      .optional(),
  }),
});

// The race diary. Each entry is a race the club has run, with a rule for
// roughly when it happens rather than a date — see docs/race-diary.md.
//
// Every rule is derived from one observation, from one race report, so an
// entry is a decent guess and nothing more. That is why `status` defaults to
// `expected` and why the page must never render an expected entry as a
// specific day: somebody turning up a week late is worse than a page that
// admits it does not know.
const calendarEvents = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/calendar-events" }),
  schema: z
    .object({
      // The name the race goes by now.
      name: z.string(),

      // Every other name this race is known by, or has been known by.
      //
      // The diary lists the reports about each race by matching the race name
      // in the report's frontmatter, so without this a rename orphans every
      // report written before it, and merging two entries orphans one of them.
      // Both have happened here: the Bicton Blister became the Budleigh
      // Blister, and the Bridgwater 10k and Half turned out to be one event
      // with two distances, written up under both names.
      //
      // Never edit an old report to match the current name. It is a member's
      // account of a race that really was called that at the time.
      aliases: z.array(z.string()).default([]),

      month: z.number().int().min(1).max(12),

      // Two ways of saying when a race happens.
      //
      // fixedDate — a calendar date that never moves ("1 January").
      // nth + weekday — a rule ("last Sunday"), resolved at build time.
      //
      // Exactly one of these. See the refine below.
      fixedDate: z.string().optional(),
      nth: z.enum(["first", "second", "third", "fourth", "last"]).optional(),
      weekday: z
        .enum([
          "Monday", "Tuesday", "Wednesday",
          "Thursday", "Friday", "Saturday", "Sunday",
        ])
        .optional(),

      // One event can offer several. Bridgwater is a half, a 10k and a 5k from
      // a single start, which is why this is a list and not a field — it was
      // two calendar entries until somebody noticed. Empty is meaningful: a
      // timed lap event has no distance at all, only a duration.
      distances: z.array(distance).default([]),

      // Where a race is in its life, which is not the same question as whether
      // we know its date.
      //
      //   active   — happening, list it.
      //   renamed  — happening under a new name; this entry is the new one and
      //              `aliases` carries the old, so the history follows it.
      //   dormant  — did not run last time round and may return. Not listed.
      //   retired  — gone. Not listed.
      //
      // dormant and retired stay in the repository on purpose. Deleting them
      // loses the fact that somebody checked, and the next pass over the race
      // reports re-adds the Bad Cow from a 2017 write-up.
      status: z
        .enum(["active", "renamed", "dormant", "retired"])
        .default("active"),

      // The date of the next running, when we have one.
      //
      // Used for ordering whether or not it is confirmed — a date from an
      // aggregator still sorts the entry correctly. What it must not do is
      // print as a specific day unless dateConfirmed is true.
      date: z.date().optional(),

      // Has a human checked this date with the organiser?
      //
      // A boolean, and the page's wording is derived from it, so nothing has to
      // be edited in two places and no "check before entering" note can be left
      // behind after a date is confirmed.
      dateConfirmed: z.boolean().default(false),

      // The most recent date we have evidence for, from a club race report.
      // What the rule was derived from — not a prediction.
      lastSeen: z.date().optional(),

      clubRace: z.boolean().default(false),
      championship: z.boolean().default(false),

      // Whoever takes the entries, which is usually not the organiser: Race
      // Nation, FullOnSport, a club's own page. Optional — several of these
      // have no booking link at all and take entries on the day.
      entryUrl: z.string().url().optional(),
      resultsUrl: z.string().url().optional(),
    })
    .refine((d) => Boolean(d.fixedDate) !== Boolean(d.nth && d.weekday), {
      message:
        "Provide either fixedDate, or both nth and weekday — not both, not neither.",
    }),
});

export const collections = {
  "race-reports": raceReports,
  races,
  pages,
  legal,
  "calendar-events": calendarEvents,
};
