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

// The club's five public Google calendars, rendered as ordinary HTML. No
// visitor's browser ever talks to Google, which is the whole point of doing it
// this way rather than embedding an iframe.
//
// Since 13 October 2026 the build does not talk to Google either. A nightly
// GitHub workflow (`.github/workflows/fetch-calendars.yml`) downloads each feed
// into `src/data/calendars/<name>.ics`, and the build reads those saved copies.
// Before that, every build fetched from Google, and Google's rate limit on
// Cloudflare's shared build addresses kept stopping the site deploying on
// commits with nothing wrong with them.
//
// These are calendar IDs, not URLs. Each one's public feed is
// `https://calendar.google.com/calendar/ical/<id>/public/basic.ics`, built in
// one place in calendar.ts so the shape is not written out five times. Find an
// ID in Google Calendar under Settings > (the calendar) > Integrate calendar.
// Adding a calendar here means running Fetch calendars once by hand, or the
// build fails for want of its saved copy.
//
// Every one of these must stay set to "Make available to public". If one is
// turned private its feed 404s and the nightly download fails and opens a
// "Calendar fetch failing" issue. The site keeps showing the last copy that
// downloaded until it is fixed.
//
// A 404 fails at once. A 429 does not: that is Google saying "not right now",
// and the nightly job waits it out for a couple of minutes per calendar before
// giving up. The distinction is the point: "no" is loud and immediate, "not
// right now" is waited out.
//
// Changes made in Google reach the site overnight: the calendar job runs at
// 02:17 UTC and the nightly rebuild in `workers/diary-rebuild/` at 04:00. To
// publish one sooner, run Fetch calendars from the Actions tab on GitHub.
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


/**
 * The club championship standings, published from Google Sheets as CSV.
 *
 * The scoring lives in the sheet — runners submit their own result on a Google
 * Form, formulas rank the Chard runners in each race and work out the points.
 * The website reads the finished Standings tab and renders it. See
 * docs/results.md for the sheet, the tabs, and who edits what.
 *
 * TO SWITCH THE STANDINGS ON: in the sheet, File > Share > Publish to web,
 * choose the **Standings** tab and **Comma-separated values (.csv)**, then
 * paste the address Google gives you here. It looks like
 * `https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=…&single=true&output=csv`.
 *
 * Publish the Standings tab and nothing else. "Entire document" would publish
 * the Form responses tab too, and that is every submission as typed — the
 * tidied names on Standings are what goes on a public page.
 *
 * While this is empty the championship section says it is not published yet,
 * which is true. That is the only quiet state here: once there is an address,
 * anything that goes wrong with it fails the build rather than emptying the
 * page, because a standings table that silently loses half the club is worse
 * than a red deploy.
 */
export const CHAMPIONSHIP_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCHyUh70D-4mFbZZVYB_OTbBT7H85nZ18ztyLC7fdGRBAhNrQbcBFzNtSxeVkpEXLD6xOpvqR3B96b/pub?gid=641242785&single=true&output=csv';

/**
 * The championship season, used in headings on the results page.
 *
 * Here rather than in the page's content file because it has to match the
 * sheet the URL above points at — the two change together, at the turn of the
 * year, and a heading saying 2026 over 2027's table is the kind of wrong
 * nobody reports.
 */
export const CHAMPIONSHIP_SEASON = '2026';

/**
 * The monthly handicap results, published from Google Sheets as CSV.
 *
 * The handicap is timed on the night with the timing page in the **CRR
 * Handicap** sheet (Results > Handicap folder in the club Drive), and saving a
 * race writes it to that sheet's History tab. Its **Results** tab is the
 * public slice of History: date, race, position, name, run time, start time,
 * winner and first handicap. Simon's notes, the PIN and the timing page link
 * live on other tabs and never leave the sheet. See docs/results.md.
 *
 * TO SWITCH THE HANDICAP RESULTS ON: in the CRR Handicap sheet, File > Share >
 * Publish to web, choose the **Results** tab and **Comma-separated values
 * (.csv)**, then paste the address here. Publish that tab and nothing else.
 *
 * While this is empty the handicap section says it is not published yet. Once
 * there is an address, anything that goes wrong with it fails the build, for
 * the same reason as the championship above.
 */
export const HANDICAP_CSV_URL = '';
