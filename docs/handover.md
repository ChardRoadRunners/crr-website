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

1. **Look at the build.** Usually you will have been told already — see
   **Build failure alerts** below — and the emailed issue links straight to the
   log. Otherwise: Cloudflare dashboard → `crr-website` → Builds. A failed one
   names the file and the field; `check-cms-schema.mjs` says which photo in
   which post.
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

### A build that fails with nothing changed

On 22 September a merge to `main` failed to deploy. The identical tree had
built and deployed from a branch four hours earlier, `npm run build` was green
locally, and `wrangler deploy --dry-run` validated the config. Retrying the
build, unchanged, succeeded.

So: **a build that fails when nothing in the repository changed is worth one
retry before anybody starts debugging.** If it fails twice, it is real and the
log is worth reading properly.

The likely cause was the deploy step reaching the network. Wrangler used to be
downloaded fresh on every build — the log line reads `npm warn exec The
following package was not found and will be installed: wrangler@4.136.3` — so
one flaky fetch from npm could fail a deploy with nothing wrong in the code.
It is pinned in `package.json` now and installed by `npm ci` alongside
everything else, so the site's deploy no longer depends on npm being reachable
at that moment.

Note what this does *not* claim. The retry used the same Wrangler version as
the failure, so the version was not at fault and pinning would not have
prevented that particular build from failing. What it buys is a smaller
surface for this to happen again, and a repository that records which version
works.

**`workers/diary-rebuild/` is still exposed.** That folder has no
`package.json` on purpose, so its deploy step still downloads Wrangler every
time. Closing that means adding one and setting a build command in the
dashboard — a bigger change than it looks, and left as a decision rather than
made quietly.

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

## Build failure alerts

### What it does

Every time a change is saved to the website — from the CMS or in code — GitHub
runs a check to see whether the site still builds. If the build breaks, GitHub
opens an issue called **"Website build failing"**, assigns it to the web admin,
and emails them.

- **One email per problem, not one per save.** While that issue is open,
  further failures send nothing.
- **It clears itself.** When a later save builds successfully, the issue closes
  automatically and sends one "fixed" email.
- **A failed build does not take the site down.** Cloudflare keeps serving the
  last version that worked; the new change simply has not appeared. That is the
  failure described in **When a post does not appear** above, and the reason
  these alerts exist: the site going quiet is invisible, so something has to
  say so out loud.

### Where it lives

- The check: `.github/workflows/build-check.yml`
- Who gets the email: the repository variable `BUILD_ALERT_ASSIGNEE`, under
  GitHub → the repo → Settings → Secrets and variables → Actions → Variables
- Past alerts: the repository's Issues tab, searching for "Website build
  failing"

### Who gets it now

Matthew, as the current web admin — GitHub username `Smellyllama`, which is
what `BUILD_ALERT_ASSIGNEE` should read.

If the variable and this note ever disagree, **the variable is what decides who
gets emailed** and this note is the one that is wrong. Check the variable, not
the page.

**The variable must be a person's username, or the club account's — never the
organisation name** (`ChardRoadRunners`). Organisations cannot be assigned
issues, so nobody would be emailed. If it is ever blank the issue still opens,
and says in bold that nobody was told.

### The permission it needs

Opening an issue is a write, and a workflow only gets what the default workflow
permissions allow. Read-only is GitHub's default, and it caps what any workflow
can be granted however politely the file asks — so the `issues: write` in
`build-check.yml` is a request, not a guarantee.

**It is an organisation setting, not a repository one.** On the repository's own
page — Settings → Actions → General → Workflow permissions — the option appears
greyed out rather than missing, which reads like a bug and is not one: an
organisation default of read-only means no repository inside it may choose
otherwise. The place to change it is

    github.com/organizations/ChardRoadRunners/settings/actions

under Workflow permissions, set to **Read and write permissions**. Done there on
23 September 2026. GitHub's mobile site hides most of that page and the phone
app leaves it out altogether, so it is a desk job rather than a five-minute one.

**Leave "Allow GitHub Actions to create and approve pull requests" unticked.**
Nothing here uses it — this workflow touches issues and nothing else. It is the
sharper of the two settings, because approving pull requests is a way around
branch protection, and granting it for an alert that never opens one buys
nothing.

Worth checking first if alerts ever stop arriving, because the failure is quiet
in a particular way: the build still fails, the workflow still runs, and only
the step that opens the issue dies. From outside, a broken alarm and a silent
one look the same.

### Handing it over

The aim is for alerts to go to `webmaster@chardroadrunners.com`, a forwarding
address that passes mail to whoever is web admin at the time. Handing over then
means changing where that address forwards, rather than touching GitHub at all.

One-off setup, done once:

1. Make sure `webmaster@chardroadrunners.com` forwards to a real inbox. That
   forwarding is set in Cloudflare — Email → Email Routing — not in the
   website.
2. Create a GitHub account for the club, signed up with
   `webmaster@chardroadrunners.com`, and confirm the email GitHub sends.
3. Add that account to the ChardRoadRunners organisation with at least write
   access to `crr-website`.
4. Change `BUILD_ALERT_ASSIGNEE` to that account's username.
5. Test it, as below.

After that, each new web admin needs only the webmaster@ forwarder pointed at
their own inbox in Cloudflare.

### When an alert arrives

1. Open the issue and follow the **Build log** link.
2. Look for the step with a red cross, which holds the error message.
3. It is most often a CMS edit with a missing or wrongly formatted field — a
   date, a distance without a number, an image path that does not exist. The
   error usually names the file.
4. Fix it in the CMS or in code and save. The next successful build closes the
   issue.

Read **A build that fails with nothing changed** above before digging in. A
build that fails when nothing in the repository changed is worth one retry
first, and the alert closes itself when the retry passes.

### Testing it

Save a deliberate mistake — a race report whose `raceDate` is not a date, say.
Check that the issue opens and the email arrives. Then undo the change and
check that the issue closes itself.

### Good to know

- Editors whose save breaks the build may also get GitHub's own failure email,
  depending on their notification settings. Harmless, and theirs to turn off.
- The check runs the same build Cloudflare runs, but it is not Cloudflare's
  build. A problem that only affects Cloudflare's deploy step will not trigger
  it. Those are rare, and show as a red cross against the commit in GitHub.
- The Node version in the workflow should match Cloudflare's build settings.

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
