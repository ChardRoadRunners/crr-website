# Handover notes

Decisions that look like oversights unless you know why. Anything here is
deliberate — check with the note before "fixing" it.

---

## Deleting is switched off in the CMS

`public/admin/config.yml` sets `delete: false` on the `race-reports` and
`races` collections. This is deliberate. Do not set it back to `true` without
doing the work in the next section first.

**What happened.** On 4 September 2026, deleting a single test race report
through the CMS deleted every photo in `src/content/race-reports/images/` —
23 files belonging to twenty other posts. Commit `13784bc`, restored in
`7fb8f5b`. The post that triggered it referenced exactly one image, and that
image belonged to a different post, so this was not about which photos the
entry used.

**Why.** Both collections set an entry-relative media folder:

```yaml
folder: src/content/race-reports
media_folder: images      # no leading slash → relative to the entry
public_folder: ./images
```

Sveltia's rule, from its documentation:

> Assets stored in entry-relative folders are only accessible by the associated
> entry and not available for other entries. Therefore, Sveltia CMS
> automatically deletes these assets when the associated entry is deleted.

A path without a leading slash is resolved relative to the entry, so Sveltia
treats `src/content/race-reports/images/` as private to whichever post is being
deleted. Every post shares that one directory, so deleting any post takes all
of them.

There is no separate setting for this. The Sveltia config schema has no option
governing asset deletion — `delete` on the collection is the only lever, which
is why deletion is off entirely rather than made safer.

Until this is reworked, **removing a post or a race is a Git job.**

## The fix, still to be decided

Two viable options. **Option A is the intended direction**, deferred rather
than rejected — with `delete: false` live the cascade cannot fire, so there is
no urgency and it should not be rushed.

**Option A — make the media folder absolute.** Point `media_folder` at
`/src/content/race-reports/images` (leading slash). That is a project-root
path, not an entry-relative one, so the auto-delete rule stops applying. No
files move, no frontmatter paths change, and Astro's image optimisation is
untouched. Deleting a post would then leave its photos behind as orphans,
which is the safe direction to fail in.

*Needs testing on a branch before `delete` goes back on:* it pairs an absolute
`media_folder` with a relative `public_folder: ./images`, and that combination
needs checking — that Sveltia still writes `./images/…` into frontmatter, and
that the media picker still browses the folder.

**Option B — per-post page bundles.** `path: "{{slug}}/index"` with
`media_folder: ""`, giving every post its own folder with its photos beside it.
This is Sveltia's intended model and the only option where deletion becomes
genuinely correct and self-cleaning. Rejected for now because the migration
moves 21 posts, reassigns 25 images by hand, and **changes every race report's
URL** — Astro derives the route from the entry id, which gains `/index`.
Too costly this close to launch.

A third option, moving everything to `public/uploads`, was ruled out: it still
rewrites every path *and* loses Astro's image optimisation, because assets in
`public/` are not processed and `image()` in `src/content.config.ts` would have
to become `z.string()`.

## Related guards

`scripts/check-cms-schema.mjs` resolves every image path in every content file
against the filesystem, and fails the build if one is missing. That is the
general guard against this class of problem: had it existed, the deletion above
would have been a local error before the push rather than a red deploy.

`media_libraries.default.config.slugify_filename: true` normalises uploaded
filenames. Sveltia keeps the original name by default, which is how
`Baltonsborough 5Mile.jpg` — spaces and capitals — reached the repository. The
setting applies to new uploads only; the one file that predates it has since
been renamed by hand.

The top-level `slug` block does the same job for the **entry's own filename**,
which is a different thing. Sveltia's default encoding keeps whatever the title
contains, which is how `2026-09-09-last-of-the-summer...-5k-series.md` got its
dots. `encoding: ascii` restricts filenames to letters, digits, hyphen,
underscore and tilde. Astro already strips such characters when it builds the
URL, so this is about what the repository holds rather than what a visitor
sees — but a filename nobody can type is a filename nobody can fix. New entries
only; existing names are left alone, because renaming one breaks every link to
it.

## When a post does not appear

On 22 September a race report was saved with a photo that never uploaded. The
frontmatter pointed at `./images/20136.webp`; the commit contained only the
`.md`, and that file has never existed in this repository. The guard above
caught it and the build went red.

**A red build does not take the site down. It stops the site updating.** The
last good build carries on being served, which is why nothing looks wrong. What
actually happened is that two unrelated Join Us edits, saved the same evening by
the same person, sat unpublished behind a broken image in a different post for
the best part of a day. The live page still showed the old wording, and nobody
was told.

That is the failure to recognise: not a broken site, a frozen one.

### What to do

1. **Look at the build.** Cloudflare dashboard → `crr-website` → Builds. A
   failed one names the file and the field; `check-cms-schema.mjs` says which
   photo in which post.
2. **Try the CMS first.** Re-upload the photo on the post that failed and save
   again. That fixes it without anyone touching Git.
3. **If it still fails, take the photo off the post and save.** The report
   publishes without it, everything queued behind it publishes too, and the
   photo can go back later. An unpublished post helps nobody.

### The upload that hangs

Sveltia reads a photo's dimensions in the browser before uploading it. When the
browser cannot decode the file, that read never returns: the spinner spins for
ever and the only way out is reloading the page. Upstream issue #890, open at
the time of writing.

It matters because of what it leaves behind. After the reload, the path can
already be sitting in the image field with no file behind it — which is exactly
what a saved post with a missing photo looks like.

The usual cause is a photo that is not the format its name claims: an iPhone
HEIC renamed to `.jpg`, which is what happens when pictures arrive over WhatsApp
or are exported by hand. **If an upload spins for more than a few seconds, stop.
Open the photo on your computer, re-save it as JPEG or WebP, and upload that
instead.**

### The check that is not there yet

The preSave hook in `public/admin/index.html` requires alt text whenever a photo
is set. It cannot tell whether the photo uploaded — it only sees that the path
field is not empty, and a path pointing at nothing looks exactly like a path
pointing at a photo. That is why the report above saved cleanly: alt text was
written, so the rule it enforces was satisfied.

Sveltia passes what is needed to close this. The handler receives
`entry.mediaFiles`, whose entries carry a `file` property that is "only set for
newly uploaded files that haven't been saved yet", so a hook could compare the
image path against that list and refuse the save.

It is not written yet, deliberately. Getting it wrong stops the committee
posting at all, which is worse than the gap it closes, and the two cases that
must not be blocked — editing an older post, and choosing a photo already in the
media library — need trying against the real CMS rather than reasoning about.
The build guard already stops a broken photo reaching the site. What is missing
is telling the author, not protecting the site.

## Content notes

### The welfare officer is named with consent

`src/content/legal/welfare.md` names **Lizzie Cox** as welfare officer, and the
welfare page and the contact page both print that name. That is deliberate and
consented to: **consent was given verbally on 12 September 2026.**

It is recorded here rather than as a comment in the content file because the
CMS rebuilds each file from the fields it knows about, and erases comments on
save.

The published contact is the forwarder, **welfare@chardroadrunners.com**, not a
personal address. A safeguarding contact should outlive the person holding the
role, and no volunteer's own inbox belongs on a public website. If the role
changes hands, the forwarder is repointed and the name here is updated — the
address on the page does not change.

There is a separate, unresolved question about the personal address that was
published before this, which is still in the git history. That is the
maintainer's decision and nothing here touches it.

## The map on the contact page

`src/assets/chard-cricket-club-map.png` is a picture of a map, not an embedded
one. That is deliberate: an iframe from a map provider would put a third-party
script on the page that also carries the welfare address, set cookies, and need
its own line on the privacy page — all for a view that never changes.

It is drawn from OpenStreetMap, which is free to use **provided the credit
stays**. "© OpenStreetMap contributors" appears under the image and is a
licence condition, not decoration. It is a required field in the CMS so it
cannot be emptied by accident, but it could still be edited to something wrong.
Leave it alone.

**To redraw it** — only needed if the club moves, or the map itself is wrong:

1. Tiles come from `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, zoom 17,
   centred on 50.8745829, -2.9647888. Those are the cricket ground's own
   coordinates in OpenStreetMap, not the postcode, which sits about 200m
   northeast and would have put the marker in the wrong field.
2. The image is 5x3 tiles cropped to 1024x576, covering roughly 772m across.
3. The marker is drawn on afterwards, in the club purple. The tiles label the
   rugby club but not the cricket ground, so without it nobody can tell which
   green field is ours.
4. Send a real `User-Agent` identifying the club when fetching tiles —
   OpenStreetMap's usage policy requires it and blocks anonymous bulk fetching.

Astro turns the PNG into three sized WebPs at build time, so the committed file
being large does not matter to visitors.

There is deliberately **no text baked into the image**, beyond the street names
in the map itself. The address sits above it as real text, and the alt text
describes where the club is rather than what the picture looks like — somebody
who cannot see the map needs directions, not "a map of Chard".

## Who can edit the site

Not listed here. This repository is public, so a list of names and GitHub
handles in this file would be readable by anyone, and CLAUDE.md rules that out
for members' details. It would also go stale the first time somebody joined or
left.

The real list is the one GitHub keeps: **Settings > Collaborators and teams**
on the repository. That is always current, visible only to people who already
have access, and it records when each invitation was sent. Nothing needs to be
copied out of it.

Anyone who can sign in there can also use the CMS at `/admin` — same GitHub
account, same permissions. Removing somebody from that list removes their CMS
access too, which is the reason there is nothing else to revoke.
