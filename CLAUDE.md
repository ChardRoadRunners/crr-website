# Chard Road Runners — Website

## The project

Rebuilding the website for Chard Road Runners (CRR), an England Athletics affiliated running club in Chard, Somerset, established 1981. It replaces a Webador site that hadn't been touched in years.

The site needs to do five things: welcome newcomers and explain how to join, promote the club's two races, publish race reports as a proper blog, show championship and handicap results, and host photos. The aim is for it to become a hub members actually use, rather than everything living on Facebook.

The end goal is a **documented handover to the club as an organisation**, not to an individual. Every decision should be judged against whether the next person can pick it up.

See `crr-sitemap.md` for the page structure and content plan. Read it before proposing structural changes.

## Stack

- **Astro** — static site
- **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.js`, config lives in CSS)
  - Base element styles go in `@layer base`, never unlayered. Unlayered CSS beats
    anything in a cascade layer whatever the selector, so an unlayered `a` or `h2`
    silently overrides every utility class on that element. This bug was live
    site-wide for weeks before it was found.
- **daisyUI v5** — component library, configured with `@plugin` in CSS
- **TypeScript**, strict
- **Markdown** for all content
- **Deployment: live.** Cloudflare Workers, connected to the GitHub repo
  (`Smellyllama/crr-website`). Push to `main` and it builds and deploys itself.
  No manual `wrangler deploy` needed.
- **Not announced yet.** `PRE_LAUNCH` in `src/consts.ts` puts a `noindex` tag on
  every page and makes `/robots.txt` disallow everything, so the site can be
  built, deployed and shown to the committee without turning up in a search for
  the club. It is not security — anyone with the address can read it, and this
  repository is public. Setting it to `false` is the launch switch, and the
  build prints a reminder until somebody does — and there is no
  `public/robots.txt` to edit as well, because it is generated from that same
  flag on purpose. `site` in `astro.config.mjs` is already the real domain:
  that string publishes nothing on its own, it only makes canonical URLs,
  share links, RSS and the sitemap correct.
  **`docs/launch-checklist.md` is the list of everything else still to do.**
- **A second, separate Worker** — `diary-rebuild` in `workers/diary-rebuild/` —
  pings a deploy hook nightly so the race diary rolls forward and the club
  Google calendars stay current on their own. It
  has its own Workers Build against this same repository, with the root
  directory set to that folder, so a push to `main` builds it alongside the site.
  `name` in its `wrangler.jsonc` must match the Worker's name in the Cloudflare
  dashboard: Wrangler deploys to whatever the file says, so a mismatch silently
  targets a different Worker rather than failing. Deliberately not merged into
  the site's own `wrangler.jsonc` — that file is assets-only, and adding a script
  to it would put a Worker in front of unmatched requests and risk the 404
  handling. See `workers/diary-rebuild/README.md`.
- **Sveltia CMS**, at `/admin`, so committee members can post without touching
  code. Loaded from a CDN by `public/admin/index.html` and configured by
  `public/admin/config.yml`; it commits to `Smellyllama/crr-website` on `main`
  through GitHub, which is what makes a post a normal commit and a deploy. This
  is why content stays in Markdown collections. `index.html` also holds the
  preSave hooks — the validation Sveltia's config format cannot express, such as
  requiring alt text only when a photo is set. See `docs/handover.md`.

## Collections

Five, all in `src/content/`: **`race-reports`**, **`races`**, **`pages`**,
**`legal`** and **`calendar-events`**.

**See `docs/content-model.md`** for what each one holds, the race-reports
frontmatter rules, and how the two schemas are kept in step.

The one rule that cannot wait until you open that file: `src/content.config.ts`
and `public/admin/config.yml` describe the same fields twice. **A change to one
is a change to the other, in the same commit.** If they drift, the CMS accepts a
post the build then rejects, and the failure lands on the committee member who
wrote it — the exact thing the CMS exists to prevent.

## Brand

Club colours come from the kit, specified as Pantone by the supplier:

- **PMS 4147** — `#262141` — primary. Reads as a deep purple, not navy.
- **PMS 4149** — `#8AABC6` — secondary, pale blue.

Two more come from the logo, defined in `src/styles/app.css` as `--color-sky`
and `--color-chalk`:

- **sky blue** — `#96C8FA` — the logo's wordmark colour.
- **chalk** — `#F2EFE9` — the logo's mark colour, an off-white.

The sky blue is now also the **accent — the call-to-action colour**, set as
`--color-accent` with `--color-accent-content` the dark purple. Measured, that
pairing is 8.67:1, the strongest in the palette and ahead of the pale blue
button's 6.34:1. It is the brightest thing available, which is what a call to
action needs against a page of purple and white.

The name `--color-sky` stays for the raw colour, because it does other work
too — the footer lockup, text on the purple. `accent` is the job; `sky` is the
paint.

**It won as a fill and only as a fill.** The same colour as text on white is
1.76:1, the worst number in the palette. Those two facts are not in tension:
one is a light ground under dark ink, the other is light ink on a light ground.
So `btn-accent` yes, `link-accent` and `text-accent` on anything light never —
there is no size or weight at which 1.76:1 becomes readable.

### Palette rules — not optional

- Pale blue on white is **2.41:1 and fails WCAG AA**. Never use it for text on a
  light background.
- Sky blue on white is **1.76:1 — worse than the pale blue**. Same rule, harder:
  fills, text on dark, and accents only. Never as text on a light background.
- **Neither blue is a link colour on white.** `link-secondary` was used for five
  text links on white — 2.41:1, against the rule two lines above this one, live
  on the site for weeks. They are `link-primary` now: 15.26:1, underlined.
- Sky blue on the purple is **8.49:1**, better than the pale blue's 4.6:1. Where a
  blue goes on the purple and the contrast matters, sky is the stronger choice.
- Dark purple for text on light backgrounds. Pale blue and sky blue for accents,
  borders, and text on dark only.
- Buttons need a foreground colour explicitly different from their fill. The
  accent does this: sky-blue fill, dark purple text, 8.67:1. That is what
  `btn-accent` is for, and calls to action should use it rather than
  `btn-secondary`. This is also how a `btn-secondary` with matching foreground
  and background once shipped invisible at 1:1.
- Check contrast by measuring, not by eye.
- A link in body copy needs a non-colour indicator — underline it. Colour plus
  a hover state is not enough: the default link colour is the dark purple,
  near enough identical to the body text, so a link in a paragraph is invisible
  until it is pointed at, and a hover state does not exist on a phone at all.
  WCAG 1.4.1 rules out colour as the only signal regardless. `.prose a` in
  `global.css` does this for the two places raw Markdown renders. Same family
  of mistake as the cascade bug: colour doing work colour cannot do alone.

The daisyUI theme is named `crr`, defined in `src/styles/app.css`, applied via
`data-theme="crr"` on `<html>`.

### Contour motif

LIDAR topographic contour lines of Chard, from real elevation data. The club's
visual signature.

- Stroke only, `currentColor`, so CSS drives the tint.
- Fill the container with `preserveAspectRatio="xMidYMid slice"` (desktop) or
  `xMidYMax slice` (mobile). The default `meet` letterboxes and leaves blank bands.
- `stroke-width: 7` desktop, `9` mobile. The raw `2` computes to under a pixel
  once scaled and disappears.
- Opacity around 0.5. Always `aria-hidden="true"`.
- Never place contours directly behind body copy — contrast drops to ~2.4:1 where
  a line crosses a letter. Backgrounds, headers, dividers and image fallbacks only.

## Typography

**Outfit** for headings, **Inter** for body. Used through the CSS custom
properties `--font-outfit` and `--font-inter`. The `fonts` config in
`astro.config.mjs` defines them; `src/styles/global.css` only consumes them.

Both are geometric sans faces, so the contrast between heading and body is
subtle. Headings need weight and tighter letter-spacing to separate clearly from
body copy — don't rely on size alone. That is why `@layer base` sets headings to
`letter-spacing: -0.02em`, and h1 and h2 to 700.

**The heading scale lives in one place: `@layer base` in `src/styles/global.css`.**
Its sizes are rem, and they are Tailwind's own steps to the pixel — base `h2` is
`2.25rem`, which is exactly `text-4xl` — so a Markdown heading and a component
heading are the same size. Keep them in rem: `em` resolves against the body
while every `text-*` utility resolves against the root, which is how the two
systems silently drifted apart before.

Don't set heading sizes in a page or component style block. Three places used to
set them, and the base scale lost to a page-level rule wherever Markdown
actually rendered — it looked authoritative and did nothing. Body copy is 17px,
18px below 720px, set on `body` and never on `:root`: Tailwind's spacing scale
is rem, so moving the root scales every margin and max-width on the site.

**Self-hosted.** Astro's Fonts API (`fonts` in `astro.config.mjs`) downloads the
files at build time and serves them from our own domain, so no visitor's IP
reaches Google and there is no third-party request to explain on the privacy
page. Google sees the build, not the reader.

Don't swap this for `@fontsource`. It would be a step back: Astro also generates
metric-matched local fallbacks — `size-adjust`, `ascent-override` and the rest,
tuned to Arial — so text does not shift when the real font swaps in. `@fontsource`
ships the files and nothing else.

Weights are declared in the config and only those are built. Latin subset and
`font-display: swap` come as standard. Adding a weight to the config costs a
download on every page, so add one only when a design actually calls for it.

## How I work

I'm not a developer. I'm technically confident, good at following instructions
and troubleshooting, but learning this stack as I go. So:

- Explain what a change does and why, in plain terms
- When you introduce a new concept — collections, frontmatter, layouts, islands —
  give me a sentence on what it is
- Tell me when there's a simpler way to do what I've asked for
- If I ask for something that's a bad idea, say so and explain the trade-off
- Prefer boring, well-documented solutions over clever ones
- Keep dependencies minimal
- **Flag rather than fix** when something needs a judgement call I haven't made.
  Ask, or leave a clear placeholder. Don't guess and don't quietly work around it.
- If a build won't go green, don't add a fallback that hides the problem — a
  missing date defaulting to today is worse than a failing build

## Content rules

- Don't invent club facts. If you need a committee name, a fee, a date or a
  distance I haven't given you, ask or leave a clear placeholder.
- **Never rewrite race report prose.** It's members' own writing, informal voice
  included. Typo fixes only.
- Placeholders must be valid in the field they sit in. Writing `TODO` into a
  field the schema types as a URL or date breaks validation — omit the key
  instead and leave a comment.
- Fields still containing "TODO" must be omitted from rendered output, never
  printed to visitors.
- Real content from the old site is carried over even where dates are stale —
  flag what needs updating rather than inventing a replacement.
- Copy comes from content files. No user-facing text hardcoded in components.
  Link labels are content; route paths stay in code.
- Categories: Race Report, Club News, Couch to 5k, Social.

## Standards

- **Mobile first.** Most visitors are on a phone. Test at 320, 375 and 414px.
- **Accessibility:** one `h1` per page, headings in order, visible keyboard focus,
  no text baked into images, `prefers-reduced-motion` respected, decorative
  graphics `aria-hidden`.
- **Alt text on every lead image**, not just in-body ones. Absent alt beats wrong
  alt — never ship the literal word "TODO" as alt text.
- **Client-side JavaScript is the exception, not the default** — see below.
- Social previews (`og:image`) use the post's own hero image, falling back to the
  contour graphic — never a generic placeholder.
- Images through Astro's image component so dimensions are known and the page
  doesn't shift as they load.

## Client-side JavaScript

The standing rule is minimal. Not none — the site ships two scripts, listed
below — but each one had to earn its place, and every one of them is
**progressive enhancement**: the page is complete and usable with JavaScript
off, and the script only removes friction.

This list exists so the next person can tell a deliberate exception from an
accumulated one. **Adding a third means adding it here, in the same commit.**

Three rules for any new script:

1. **Server-render the working version first.** The unit switcher failed this:
   its `data-units` attribute was only ever set by script, so with JS off both
   spans stayed hidden and *no distance rendered at all*. A feature that
   disappears without JS is not enhancement.
2. **Hide, don't break.** A control that cannot work without a script carries
   `hidden` in the HTML and is revealed by the script. Nobody is offered a
   button that does nothing.
3. **Feature-detect the specific thing, and handle it refusing.** Presence is
   not availability: `navigator.share` exists in some browsers that then reject,
   and the clipboard is unreachable outside a secure context.

### The two exceptions

**`Header.astro` — the header over a banner.** Sets `data-scrolled` past 72px so
the transparent header goes solid, and re-checks on `load` because iOS can
report a transient scroll position while a page is still settling. That is all
it does. It used to publish the header height as a CSS variable too, and the
hero's top padding was calculated from it — which meant the position of the
first thing anybody sees depended on a measurement taken at whatever moment the
script happened to run. On iOS it ran too early, the padding came up short and
the logo sat under the bar. Both the variable and that dependency are gone;
banner padding is a plain number. **Don't reintroduce it.**

It loads on every page with a purple banner, which is all of them except Our
Races and the race reports index: those start with white content and keep a
solid bar. Without the script the header stays transparent over the banner —
less tidy, still perfectly readable, because the scrim behind it is pure CSS
and the contours sit at an opacity measured to be safe under text.

**`ShareRaceReport.astro` — sharing a race report.** Two copy buttons and the
phone's native share sheet, all three `hidden` in the HTML and revealed only
where the API exists. Without it the Facebook and WhatsApp links are plain
anchors that work as normal, and the paste block is ordinary selectable text.
Nothing is lost but a long-press.

Note the homepage carries the first of these. An earlier version of this file
said the homepage had no JavaScript at all; the built HTML disagreed, which is
what this section is for.

### Rejected

**The miles/kilometres switcher.** Built, then rolled back — not for the
JavaScript but because a distance that changes unit depending on a setting
nobody noticed makes a 10k race harder to read, not easier. Distances now show
both units at once, worked out at build time, and `formatDistance` needs no
script at all. If somebody proposes it again, this is why it went.

## Measurement and verification

The browser pane's readings have twice been wrong in this project, and both
times sent work off in the wrong direction:

- A computed style reported a transparent background while the page was
  demonstrably solid — sending me chasing a CSS cascade bug that didn't exist
- A 0×0 viewport made every size reading meaningless, nearly prompting a "fix"
  to layout that wasn't broken

So: pixel measurements and scroll-0 screenshots are the readings to trust.
Computed-style reads and scrolled screenshots are not reliable here.

**Before acting on a surprising measurement, verify it.** Re-measure at a real
viewport width, or check on an actual device. A reading that contradicts what
you can see in a screenshot is a reason to distrust the tool, not the screenshot.

## Things not to build

- No shop. Kit is displayed with photos and prices; members order by email.
- No members-only login area for now.
- Strava integration is a later phase. Club is
  [Chard Road Runners on Strava](https://www.strava.com/clubs/246805/leaderboard)
  (club id `246805`). Two ready-made embeds for when that starts:

  ```html
  <!-- Summary widget: recent activity feed, no ride list -->
  <iframe allowtransparency="true" frameborder="0" height="160" scrolling="no"
    src="https://www.strava.com/clubs/246805/latest-rides/67f798de53aa60017d6658b4a388a9950668f49f?show_rides=false"
    width="300"></iframe>

  <!-- Activity widget: same feed, with individual rides listed -->
  <iframe allowtransparency="true" frameborder="0" height="454" scrolling="no"
    src="https://www.strava.com/clubs/246805/latest-rides/67f798de53aa60017d6658b4a388a9950668f49f?show_rides=true"
    width="300"></iframe>
  ```

  Note these are third-party embeds and change the site's privacy position.

## Privacy and personal data

- **Never publish the club's bank details.** They appear on the membership form;
  they must not appear on the website. Payment goes through Connect My Club or by
  emailing the membership secretary.
- **Never publish anyone's home address**, including committee members'. Email
  contacts only.
- Championship and handicap results come from Google Sheets, published as CSV and
  read at build time. **Only finishing times and names go in that sheet.** Dates
  of birth, phone numbers, addresses, medical information and emergency contacts
  live in a separate, never-published file.
- Photographs of identifiable members need a privacy policy and a stated consent
  position before galleries go live.

## Housekeeping

- Commit in small, described chunks. One concern per commit.
- `Media/` is design source material and is gitignored — nothing in `src/`
  should reference it.
- The welfare officer's contact must stay easy to find — footer, every page.
