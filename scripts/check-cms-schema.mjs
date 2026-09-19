// Guards the seam between the two schemas.
//
// src/content.config.ts and public/admin/config.yml describe the same content
// twice. Astro already shouts when a file breaks its own schema, so the failure
// it cannot see is the opposite one: a frontmatter key that no CMS field
// declares. That key is invisible in the editor, and because Sveltia rebuilds
// each file from the fields it knows about, editing such an entry through the
// CMS can drop the key on save — losing content that nothing in the build
// would have flagged.
//
// So: walk every content file, and assert each frontmatter key is declared by
// the collection's CMS fields. Runs before `astro build`.
//
// A change to one schema is a change to both, in the same commit.
//
// The second guard is media. Every image field is resolved against the
// filesystem, because a path pointing at a file that is not there is a red
// deploy, and the CMS can produce one without anybody editing the post that
// breaks: deleting a race report through Sveltia removed every photo in the
// shared images folder (commit 13784bc), orphaning the paths in twenty other
// posts. Checking here turns that class of failure into a local error before
// the push. Image fields are read from the CMS config rather than named here,
// so a new one is covered the day it is added.
//
// The third guard is the menus. src/content/navigation/navigation.md holds
// routes as well as labels, which is a thing the CMS can now get wrong: an
// editor renaming a page's address, or pointing a menu item at a page that was
// never built, ships a 404 into the header of every page on the site. So every
// internal href there is resolved against src/pages/ and the routes the
// content collections generate. External links are somebody else's to keep
// alive and are left alone, exactly as remote image URLs are.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONFIG = join(ROOT, 'public/admin/config.yml');
const CONTENT = join(ROOT, 'src/content');

const red = (s) => `[31m${s}[0m`;
const yellow = (s) => `[33m${s}[0m`;
const dim = (s) => `[2m${s}[0m`;

/** Frontmatter is everything between the first pair of `---` lines. */
const readFrontMatter = (file) => {
  const match = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? parse(match[1]) : null;
};

/** Every dotted path a collection's field list declares, e.g. `races.distance.unit`. */
const declaredPaths = (fields, prefix = '') => {
  const out = new Set();
  for (const field of fields ?? []) {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    out.add(path);
    // Object and list sub-fields, plus the variable-type `types` form.
    const children = field.fields ?? field.types?.flatMap((t) => t.fields ?? []);
    for (const child of declaredPaths(children, path)) out.add(child);
  }
  return out;
};

/**
 * Every dotted path a parsed frontmatter object actually uses. List indices are
 * collapsed, so `races[0].name` and `races[1].name` both read as `races.name` —
 * the CMS declares one field for the whole list.
 */
const usedPaths = (value, prefix, out) => {
  if (Array.isArray(value)) {
    value.forEach((item) => usedPaths(item, prefix, out));
  } else if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      out.add(path);
      usedPaths(child, path, out);
    }
  }
  return out;
};

/** The dotted paths whose CMS widget holds a file path, e.g. `images.src`. */
const mediaPaths = (fields, prefix = '') => {
  const out = new Set();
  for (const field of fields ?? []) {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    if (field.widget === 'image' || field.widget === 'file') out.add(path);
    const children = field.fields ?? field.types?.flatMap((t) => t.fields ?? []);
    for (const child of mediaPaths(children, path)) out.add(child);
  }
  return out;
};

/**
 * Every [dotted path, value] pair in frontmatter. List indices are collapsed
 * the same way `usedPaths` collapses them, so each item of a photo list is
 * reported against the one field that declares it.
 */
const valuesByPath = (value, prefix, out) => {
  if (Array.isArray(value)) {
    value.forEach((item) => valuesByPath(item, prefix, out));
  } else if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      out.push([path, child]);
      valuesByPath(child, path, out);
    }
  }
  return out;
};

/**
 * Where a frontmatter image path actually points. Collection media folders are
 * entry-relative, so `./images/x.jpg` resolves against the Markdown file that
 * uses it; an absolute path is a public asset and resolves against `public/`.
 * Remote URLs are somebody else's to keep alive, so they are left alone.
 */
const resolveMedia = (value, file) => {
  if (/^(https?:)?\/\//.test(value)) return null;
  return value.startsWith('/') ? join(ROOT, 'public', value) : join(dirname(file), value);
};

/** Assert every frontmatter key is declared, and every image path resolves. */
const checkEntry = (file, frontMatter, declared, media, label) => {
  for (const path of usedPaths(frontMatter, '', new Set())) {
    if (!declared.has(path)) {
      problems.push(
        `${relative(ROOT, file)} uses "${path}", which no field in the ` + `"${label}" CMS collection declares.`,
      );
    }
  }
  for (const [path, value] of valuesByPath(frontMatter, '', [])) {
    if (!media.has(path) || typeof value !== 'string' || !value.trim()) continue;
    const target = resolveMedia(value, file);
    if (target && !existsSync(target)) {
      mediaProblems.push(`${relative(ROOT, file)} → "${path}" points at ${value}, which is not on disk.`);
    }
  }
};

const markdownIn = (dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(dir, name));

const config = parse(readFileSync(CONFIG, 'utf8'));
const problems = [];
const mediaProblems = [];
const covered = new Set();

for (const collection of config.collections) {
  if (collection.folder) {
    const dir = join(ROOT, collection.folder);
    covered.add(collection.folder);
    if (!existsSync(dir)) {
      problems.push(`Collection "${collection.name}" points at ${collection.folder}, which does not exist.`);
      continue;
    }
    const declared = declaredPaths(collection.fields);
    const media = mediaPaths(collection.fields);
    for (const file of markdownIn(dir)) {
      const frontMatter = readFrontMatter(file);
      if (!frontMatter) {
        problems.push(`${relative(ROOT, file)} has no frontmatter.`);
        continue;
      }
      checkEntry(file, frontMatter, declared, media, collection.name);
    }
  } else {
    for (const entry of collection.files ?? []) {
      covered.add(entry.file.replace(/\/[^/]+$/, ''));
      const file = join(ROOT, entry.file);
      if (!existsSync(file)) {
        problems.push(`Collection file "${collection.name}/${entry.name}" points at ${entry.file}, which does not exist.`);
        continue;
      }
      const declared = declaredPaths(entry.fields);
      const media = mediaPaths(entry.fields);
      const frontMatter = readFrontMatter(file);
      if (!frontMatter) {
        problems.push(`${relative(ROOT, file)} has no frontmatter.`);
        continue;
      }
      checkEntry(file, frontMatter, declared, media, `${collection.name}/${entry.name}`);
    }

    // A `files` collection names its files one by one, so the loop above only
    // ever sees the ones the CMS already knows about. A new Markdown file
    // dropped into the same folder is invisible to it — which is the failure
    // this script exists to catch, one level down: the page builds, renders,
    // and cannot be edited by anybody without a text editor and a Git client.
    // src/content/pages/contact.md was exactly that for a build.
    for (const dir of new Set((collection.files ?? []).map((e) => dirname(e.file)))) {
      const declaredFiles = new Set(
        (collection.files ?? []).map((e) => join(ROOT, e.file)),
      );
      for (const file of markdownIn(join(ROOT, dir))) {
        if (!declaredFiles.has(file)) {
          problems.push(
            `${relative(ROOT, file)} is not listed under the "${collection.name}" CMS collection, so nobody can edit it.`,
          );
        }
      }
    }
  }
}

// A whole collection added to src/content/ but never given a CMS collection is
// the same failure one level up: nobody can edit it, and nobody finds out.
for (const name of readdirSync(CONTENT)) {
  const dir = join(CONTENT, name);
  if (!statSync(dir).isDirectory()) continue;
  if (!markdownIn(dir).length) continue; // e.g. the images/ folders
  const asConfigured = `src/content/${name}`;
  if (![...covered].some((path) => path === asConfigured)) {
    problems.push(`${asConfigured} holds Markdown but no CMS collection covers it.`);
  }
}

// ---------------------------------------------------------------------------
// The menus point at real pages
// ---------------------------------------------------------------------------

const NAV_FILE = join(ROOT, 'src/content/navigation/navigation.md');
const navProblems = [];

/**
 * Every route the site actually serves.
 *
 * Two sources, because the site builds pages two ways: files in src/pages/,
 * and the routes a dynamic page generates from a collection. [legal].astro is
 * the one that matters here — /welfare and /privacy are files in
 * src/content/legal/, not src/pages/, so checking src/pages/ alone would call
 * the footer's most important link a 404.
 */
const builtRoutes = () => {
  const routes = new Set(['/']);

  const walk = (dir, prefix) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full, prefix + name + '/');
        continue;
      }
      const match = name.match(/^(.+)\.(astro|md|ts|js)$/);
      if (!match) continue;
      const base = match[1];
      // Dynamic routes are filled in from their collections below rather than
      // guessed at from the filename.
      if (base.startsWith('[')) continue;
      // robots.txt.ts and rss.xml.js are endpoints, not pages, and nothing in
      // a menu should point at one.
      if (base.includes('.')) continue;
      routes.add(base === 'index' ? ('/' + prefix).replace(/\/$/, '') || '/' : '/' + prefix + base);
    }
  };
  walk(join(ROOT, 'src/pages'), '');

  // src/pages/[legal].astro turns each file in src/content/legal/ into a
  // top-level route of its own.
  const legalDir = join(CONTENT, 'legal');
  if (existsSync(join(ROOT, 'src/pages/[legal].astro')) && existsSync(legalDir)) {
    for (const file of markdownIn(legalDir)) {
      routes.add('/' + file.split('/').pop().replace(/\.md$/, ''));
    }
  }

  return routes;
};

if (existsSync(NAV_FILE)) {
  const nav = readFrontMatter(NAV_FILE);
  const routes = builtRoutes();

  const links = [
    ...(nav?.primary ?? []).map((link) => ['top menu', link]),
    ...(nav?.footerGroups ?? []).flatMap((group) =>
      (group.links ?? []).map((link) => ['footer column "' + group.label + '"', link]),
    ),
  ];

  for (const [where, link] of links) {
    const href = link?.href;
    if (typeof href !== 'string' || !href) {
      navProblems.push(`${where}: "${link?.label ?? '(no label)'}" has no address.`);
      continue;
    }
    // Somebody else's site to keep alive, same as a remote image.
    if (/^(https?:)?\/\//.test(href) || href.startsWith('mailto:')) continue;

    if (!href.startsWith('/')) {
      navProblems.push(
        `${where}: "${link.label}" points at "${href}", which is neither a route on this site (starting with /) nor a full web address.`,
      );
      continue;
    }

    // A hash targets a section of a page; the page is the thing that has to exist.
    const path = href.split('#')[0].replace(/\/$/, '') || '/';
    if (!routes.has(path)) {
      navProblems.push(`${where}: "${link.label}" points at ${href}, which is not a page on this site.`);
    }
  }
}

if (navProblems.length) {
  console.error(red(`\n✗ Menu links — ${navProblems.length} broken link(s)\n`));
  for (const problem of navProblems) console.error(`  ${red('•')} ${problem}`);
  console.error(
    yellow(
      '\n  src/content/navigation/navigation.md holds routes as well as labels, so a\n' +
        '  menu item can point at a page that does not exist. Fix the address, or\n' +
        '  remove the item. A broken menu link shows on every page of the site.\n',
    ),
  );
}

if (problems.length) {
  console.error(red(`\n✗ CMS schema drift — ${problems.length} problem(s)\n`));
  for (const problem of problems) console.error(`  ${red('•')} ${problem}`);
  console.error(
    yellow(
      '\n  public/admin/config.yml and src/content.config.ts have to describe the\n' +
        '  same fields. Add the missing field(s) to the CMS config.\n',
    ),
  );
}

if (mediaProblems.length) {
  console.error(red(`\n✗ Missing images — ${mediaProblems.length} broken path(s)\n`));
  for (const problem of mediaProblems) console.error(`  ${red('•')} ${problem}`);
  console.error(
    yellow(
      '\n  Either the file was removed and needs restoring from Git, or the path\n' +
        '  in the frontmatter is wrong. Astro fails the build on these, so fixing\n' +
        '  it here is cheaper than finding out from a red deploy.\n',
    ),
  );
}

if (problems.length || mediaProblems.length || navProblems.length) process.exit(1);

console.log(dim('✓ CMS schema mirrors the content — no undeclared frontmatter keys.'));
console.log(dim('✓ Every image path resolves on disk.'));
console.log(dim('✓ Every menu link points at a real page.'));
