# CMS sign-in

The Worker that signs committee members in to the CMS at `/admin`.

Sveltia CMS commits to GitHub as the person editing, which means it needs a
GitHub OAuth token, which means something has to hold the OAuth client secret.
A static site cannot. This Worker is that something: the browser sends it to
GitHub, GitHub sends the reader back here, and this Worker exchanges the code
for a token and hands it to the CMS.

Nothing on the public website touches it. If this Worker were down, the site
would be completely unaffected and only editing would stop.

## Where it came from

Derived from [`sveltia/sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth),
currently at upstream **`f3beae3`** ("Update dependencies").

**To pull future upstream changes, diff against that hash.** That is the whole
maintenance path, and it is why this folder keeps upstream's tooling config and
its own `UPSTREAM-README.md` rather than a tidied-up subset.

### Local divergence, in full

Two files, five lines. Nothing in `src/` is modified.

| File | Change |
| :--- | :----- |
| `wrangler.toml` | `name` is `crr-cms-auth`, not `sveltia-cms-auth` |
| `.gitignore` | gains `.env` and `.env.*` |

Two upstream directories were **not** copied, and a diff against upstream will
show them as missing:

- `.github/` — CI workflow, `CODEOWNERS` and `FUNDING.yml`. GitHub only reads
  workflows from the repository root, so upstream's deploy workflow would never
  have run from here; `CODEOWNERS` naming upstream's maintainer inside this
  repository would have been actively misleading.
- `.vscode/` — editor settings, which would fight this repository's own.

## Deploying it

From this directory:

```
npx wrangler deploy
```

**The `name` in `wrangler.toml` must match the Worker in the Cloudflare
dashboard — `crr-cms-auth`.** Wrangler deploys to whatever the file says and
does not check whether that Worker already exists, so a mismatch does not error:
it creates a second Worker under the other name, leaves the real one untouched,
and sign-in carries on using the old code while you wonder why your change did
nothing.

### Why this one is `wrangler.toml` and its sibling is `wrangler.jsonc`

`workers/diary-rebuild/` uses `wrangler.jsonc`, and consistency would say match
it. It is deliberate that this one does not: this Worker is maintained by
diffing against upstream, upstream ships `toml`, and converting the file would
put a permanent diff in the way of every future update. Matching upstream is
worth more here than matching the folder next door.

## What it needs to work

### The GitHub OAuth App

Its **Authorization callback URL** is:

```
https://crr-cms-auth.buddygoestravelling.workers.dev/callback
```

That is this Worker's address, **not the website's**. It does not change when
the site's domain changes.

**It does change if the Cloudflare account changes.** The `workers.dev`
subdomain belongs to the account, not to the Worker, so moving this Worker to
the club's own Cloudflare account turns every
`*.buddygoestravelling.workers.dev` address into
`*.<the new account's>.workers.dev` — this callback URL with them. That is
planned for the November handover, and the callback URL is one of three things
that have to change together: it, `base_url` in `public/admin/config.yml`, and
`ALLOWED_DOMAINS` below. See `docs/launch-checklist.md` under November
handover.

### Worker environment variables

Set in the Cloudflare dashboard. Names only — the values are not written down
anywhere in this repository, and the secret must not be.

| Variable | What it is |
| :------- | :--------- |
| `GITHUB_CLIENT_ID` | From the OAuth App |
| `GITHUB_CLIENT_SECRET` | From the OAuth App. Encrypted. |
| `ALLOWED_DOMAINS` | Which sites may use this Worker to sign in |

### ALLOWED_DOMAINS is about the SITE, not this Worker

It is the list of hostnames allowed to obtain a token through this Worker — so
it takes the addresses `/admin` is served from, never this Worker's own address.

Two ways to get it wrong:

- **A naked domain and its subdomains are separate entries.**
  `*.chardroadrunners.com` matches `www.chardroadrunners.com` and does **not**
  match `chardroadrunners.com`. List both:
  `chardroadrunners.com, *.chardroadrunners.com`
- **Do not drop the `workers.dev` host** while the site is still served from it,
  or sign-in stops working there the moment you change the variable.

If a domain is not on the list the Worker refuses with
`Your domain is not allowed to use the authenticator` and the error code
`UNSUPPORTED_DOMAIN`. It fails silently from the outside: the website is
perfectly fine and only the committee cannot edit it.

This is on the launch checklist, because the site changing domain is exactly
when it bites.

## The one thing nobody should "fix"

`base_url` in `public/admin/config.yml` points at **this Worker**:

```
base_url: https://crr-cms-auth.buddygoestravelling.workers.dev
```

It is not the website's address and it **does not change when the site's domain
changes**. It will look wrong to somebody tidying up after the domain switch.
Changing it to `chardroadrunners.com` breaks a working login.

## Status

This folder is the canonical source. It was previously its own repository —
`Smellyllama/crr-cms-auth`, moved to `ChardRoadRunners/crr-cms-auth` with
everything else — and that copy is to be archived so there is only one.
Both paths are named here so an old link still leads somewhere.

**It has no Workers Build of its own**, which is what makes retiring it safe:
nothing deploys from it. This Worker is deployed by hand from this folder, as
above. Archiving matters more than where it is archived — a read-only,
visibly-dead repository is what stops somebody finding it in a year, taking it
for the live source, and deploying from it. Two divergent copies of the thing
that controls CMS sign-in is the failure worth preventing.

Two things to finish it off, and they are not the same job:

1. **Cloudflare** — deploy once from here and confirm sign-in still works.
2. **GitHub** — archive `ChardRoadRunners/crr-cms-auth`, once it has been
   transferred.
