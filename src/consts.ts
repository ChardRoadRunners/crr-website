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

// The top-level nav, per crr-sitemap.md. Seven items: Calendar and Results were
// one item until the two turned out to answer different questions — "when is
// the next race" and "how did we do" — and a page trying to do both buried the
// calendar under standings tables. Seven is the ceiling. Any more and the
// mobile menu becomes a list nobody reads.
export const NAV_LINKS: { href: string; label: string }[] = [
	{ href: '/', label: 'Home' },
	{ href: '/join-us', label: 'Join Us' },
	{ href: '/race-reports', label: 'Race Reports' },
	{ href: '/our-races', label: 'Our Races' },
	{ href: '/calendar', label: 'Calendar' },
	{ href: '/results', label: 'Results' },
	{ href: '/contact', label: 'Contact' },
];

// Footer page links, per crr-sitemap.md. Welfare is first and stays
// findable in one click from any page.
export const FOOTER_PAGE_LINKS: { href: string; label: string }[] = [
	{ href: '/welfare', label: 'Welfare' },
	{ href: '/inclusion', label: 'Inclusion' },
	{ href: '/rules-and-constitution', label: 'Rules & Constitution' },
	{ href: '/privacy', label: 'Privacy' },
	{ href: '/club-kit', label: 'Club Kit' },
	// The diary specifically, not the top of the page — the label promises races
	// and the club calendar is what sits above it.
	{ href: '/calendar#race-calendar', label: 'Race Calendar' },
];

export const SOCIAL_LINKS = {
	facebook: 'https://www.facebook.com/groups/161908423862991/',
	strava: 'https://www.strava.com/clubs/246805/leaderboard',
};

export const ENGLAND_ATHLETICS_URL = 'https://www.englandathletics.org/';

// The club's four public Google calendars, read at build time by
// `src/utils/calendar.ts` and rendered as ordinary HTML. No visitor's browser
// ever talks to Google — the only request happens on the build machine, which
// is the whole point of doing it this way rather than embedding an iframe.
//
// These are calendar IDs, not URLs. Each one's public feed is
// `https://calendar.google.com/calendar/ical/<id>/public/basic.ics`, built in
// one place in calendar.ts so the shape is not written out four times. Find an
// ID in Google Calendar under Settings > (the calendar) > Integrate calendar.
//
// Every one of these must stay set to "Make available to public". If one is
// turned private its feed 404s and THE BUILD FAILS, by design: a calendar
// quietly serving nothing is worse than a red build, because a page of races
// that silently empties is a page nobody checks.
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
} as const;

// The club's Google Calendar, shown on /calendar above the race diary.
//
// A STOPGAP, and agreed as one. The intended version reads the calendar's .ics
// feed at build time and renders real HTML: styled like the rest of the site,
// working without JavaScript, and with no request to Google from a visitor's
// browser. The weekly rebuild keeps it current. That work is blocked on access
// to the club Google account, so this embed stands in until it lands. Prefer
// finishing the .ics version over investing in this one.
//
// The calendar's ID, not an embed URL — find it in Google Calendar under
// Settings > (the calendar) > Integrate calendar. It looks like an email
// address. The calendar must be set to "Make available to public" or the
// embed shows a permission error to everyone who is not signed in to it.
//
// Empty until somebody sets it, and the page renders the race diary alone
// rather than an iframe that cannot load. Do not guess a value here.
//
// PRIVACY: this is a third-party embed. Every visitor to /calendar would make
// a request to Google, which is the thing self-hosting the fonts was meant to
// avoid. Setting this needs a line on the privacy page, and it would be the
// one place on the site where a visitor's IP reaches Google. That is the whole
// reason the .ics version is the one to build.
export const GOOGLE_CALENDAR_ID = '';
