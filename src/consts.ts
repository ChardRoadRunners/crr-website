// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

/**
 * True until the site is announced.
 *
 * Turns on a noindex tag on every page and a blanket Disallow in robots.txt,
 * so the site can be built, deployed and shown to the committee without
 * turning up in a search for the club. It is not security — anyone with the
 * address can read the site, and the repository is public — it is only about
 * not being found by accident before the club is ready to say so.
 *
 * The build prints a reminder while this is true. Set it to false on launch
 * day, in its own commit, and check that /robots.txt has changed.
 */
export const PRE_LAUNCH = true;

// The menus used to live here, as NAV_LINKS, FOOTER_PAGE_LINKS, SOCIAL_LINKS
// and ENGLAND_ATHLETICS_URL. They are now content, in
// src/content/navigation/navigation.md, so the committee can change them
// without a developer. src/utils/navigation.ts reads them.

export const SITE_TITLE = 'Chard Road Runners';
export const SITE_DESCRIPTION =
	'Sociable England Athletics affiliated running club in Chard, Somerset. Established 1981.';

// The first thing a keyboard user tabs to on any page, letting them jump the
// nav instead of tabbing through it. Kept here with the other nav labels, not
// in a content collection: it is an assistive control rather than club copy,
// and it must never be edited to something empty or vague.
export const SKIP_LINK_LABEL = 'Skip to content';

// The id it targets, and the id on <main>. One constant so they cannot drift.
export const MAIN_CONTENT_ID = 'main-content';

// The club's five public Google calendars, read at build time by
// `src/utils/calendar.ts` and rendered as ordinary HTML. No visitor's browser
// ever talks to Google — the only request happens on the build machine, which
// is the whole point of doing it this way rather than embedding an iframe.
//
// These are calendar IDs, not URLs. Each one's public feed is
// `https://calendar.google.com/calendar/ical/<id>/public/basic.ics`, built in
// one place in calendar.ts so the shape is not written out five times. Find an
// ID in Google Calendar under Settings > (the calendar) > Integrate calendar.
//
// Every one of these must stay set to "Make available to public". If one is
// turned private its feed 404s and THE BUILD FAILS, by design: a calendar
// quietly serving nothing is worse than a red build, because a page of races
// that silently empties is a page nobody checks.
//
// A 404 fails at once. A 429 does not: Google rate-limits by address, the
// build machines share theirs, and on 20 September 2026 somebody else's
// traffic failed a build of ours that had changed two CSS classes. Those are
// retried with backoff before the build gives up — see fetchCalendar. The
// distinction is the point: "no" is still loud and immediate, "not right now"
// is waited out.
//
// Because the site is built, not live, these are only as current as the last
// build. The nightly rebuild in `workers/diary-rebuild/` is what keeps them
// honest — see its README.
export const CALENDAR_IDS = {
	'club-nights':
		'48e603a15900b03249e5f0e8c758ea0fd006441b66aba41a02bc7883e69792d8@group.calendar.google.com',
	'race-calendar':
		'5d4f7195bb23dea60fd8956b8082ecd3619221bb1731449e14225d54e92b7406@group.calendar.google.com',
	'club-races':
		'78dc42844390d900d7f73636253272e26ee9851256b4af745e6c0efa6f6243f8@group.calendar.google.com',
	championship:
		'a36807b7ef85ef1b9be2d386404124369e9f1db3066e24e2f36b0488a0ae90b0@group.calendar.google.com',
	socials:
		'e5e1ed32f0aa0f46521a0030b4a71d221606e1ff988caa688d67a9f0a4248ce2@group.calendar.google.com',
} as const;

