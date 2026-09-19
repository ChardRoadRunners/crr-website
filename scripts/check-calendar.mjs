// Guards the calendar parsing rules.
//
// `src/utils/calendar.ts` turns five Google feeds into one shape, and most of
// what it does has a wrong answer that looks right. An all-day race showing
// the day before, a 10am start rendering as 9am for half the year, a homepage
// listing five consecutive Tuesdays — each of those ships silently and is only
// noticed by somebody turning up on the wrong day.
//
// So the rules are pinned here against fixtures rather than against the live
// calendars: fixtures cover the cases the club's own feeds do not have yet
// (a cancellation, a summer all-day race), and they do not change under us.
//
// Plain node, no test framework, like the other checks in this folder. Run it
// with `npm run check:calendar`.

import assert from 'node:assert/strict';

import ical from 'node-ical';

const { normalise, formatEventWhen, isSameRace, isPubRun } = await import(
	new URL('../src/utils/calendar.ts', import.meta.url).href
);
const { ordinal } = await import(new URL('../src/utils/date.ts', import.meta.url).href);

const red = (s) => `\u001b[31m${s}\u001b[0m`;
const green = (s) => `\u001b[32m${s}\u001b[0m`;
const dim = (s) => `\u001b[2m${s}\u001b[0m`;

let failures = 0;
const check = (name, fn) => {
	try {
		const result = fn();
		if (result && typeof result.then === 'function') {
			// `check` does not await, so an async body would report ok whatever
			// its assertions did. Fail loudly rather than pass silently.
			throw new Error('check() bodies must be synchronous - this one returned a promise');
		}
		console.log(`  ${green('ok')} ${name}`);
	} catch (error) {
		failures += 1;
		console.log(`  ${red('FAIL')} ${name}`);
		console.log(dim(`       ${error.message.split('\n')[0]}`));
	}
};

/** Builds a VCALENDAR around some VEVENT bodies. */
const feed = (...events) =>
	[
		'BEGIN:VCALENDAR',
		'PRODID:-//Test//EN',
		'VERSION:2.0',
		'CALSCALE:GREGORIAN',
		'X-WR-TIMEZONE:Europe/London',
		...events.flatMap((body) => ['BEGIN:VEVENT', ...body, 'END:VEVENT']),
		'END:VCALENDAR',
	].join('\r\n');

const parse = (text, source, from, to) =>
	normalise(ical.sync.parseICS(text), source, from, to);

const WINDOW_FROM = new Date('2026-01-01T00:00:00Z');
const WINDOW_TO = new Date('2028-01-01T00:00:00Z');

console.log('\nCalendar parsing rules\n');

// ---------------------------------------------------------------------------
// The timezone rules. Both of these have been wrong in real projects.
// ---------------------------------------------------------------------------

check('a UTC-encoded 10am BST start renders as 10am, not 9am', () => {
	const [event] = parse(
		feed([
			'UID:bst@test',
			'DTSTART:20261018T090000Z',
			'DTEND:20261018T110000Z',
			'SUMMARY:Stockland Scamper 10k',
			'STATUS:CONFIRMED',
		]),
		'championship',
		WINDOW_FROM,
		WINDOW_TO,
	);
	const when = formatEventWhen(event, new Date('2026-06-01T00:00:00Z'));
	assert.equal(when, 'Sun 18th Oct 2026, 10:00 am');
});

check('a UTC-encoded 10am GMT start also renders as 10am', () => {
	const [event] = parse(
		feed([
			'UID:gmt@test',
			'DTSTART:20270101T100000Z',
			'DTEND:20270101T120000Z',
			'SUMMARY:Chard Flyer 10k',
			'STATUS:CONFIRMED',
		]),
		'club-races',
		WINDOW_FROM,
		WINDOW_TO,
	);
	assert.match(formatEventWhen(event, new Date('2027-01-01T00:00:00Z')), /10:00 am$/);
});

check('an all-day race in summer keeps its own date', () => {
	// The trap: BST is UTC+1, so a date run through a timezone lands on the
	// evening before and formats as the previous day.
	const [event] = parse(
		feed([
			'UID:allday-summer@test',
			'DTSTART;VALUE=DATE:20260704',
			'DTEND;VALUE=DATE:20260705',
			'SUMMARY:A midsummer all-day race',
			'STATUS:CONFIRMED',
		]),
		'race-calendar',
		WINDOW_FROM,
		WINDOW_TO,
	);
	assert.equal(event.allDay, true);
	const when = formatEventWhen(event, new Date('2026-01-01T00:00:00Z'));
	assert.equal(when, 'Sat 4th Jul 2026', `got "${when}"`);
	assert.ok(!/\d:\d\d/.test(when), `all-day should show no time, got "${when}"`);
});

check('an all-day race in winter keeps its own date', () => {
	const [event] = parse(
		feed([
			'UID:allday-winter@test',
			'DTSTART;VALUE=DATE:20261108',
			'DTEND;VALUE=DATE:20261109',
			'SUMMARY:Malaga Marathon',
			'STATUS:CONFIRMED',
		]),
		'race-calendar',
		WINDOW_FROM,
		WINDOW_TO,
	);
	assert.equal(formatEventWhen(event, new Date('2026-01-01T00:00:00Z')), 'Sun 8th Nov 2026');
});

check('the year is always shown, so a January race is not read as this one', () => {
	const [event] = parse(
		feed([
			'UID:year@test',
			'DTSTART:20270101T100000Z',
			'SUMMARY:Chard Flyer 10k',
			'STATUS:CONFIRMED',
		]),
		'club-races',
		WINDOW_FROM,
		WINDOW_TO,
	);
	assert.equal(formatEventWhen(event, new Date('2026-12-20T00:00:00Z')), 'Fri 1st Jan 2027, 10:00 am');
});

check('ordinals are right for the awkward numbers', () => {
	assert.deepEqual(
		[1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal),
		['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st'],
	);
});

check('the weekday is shown, so a Saturday race is not taken for a Sunday one', () => {
	const [saturday] = parse(
		feed([
			'UID:sat@test',
			'DTSTART:20261017T090000Z',
			'SUMMARY:A Saturday race',
			'STATUS:CONFIRMED',
		]),
		'race-calendar',
		WINDOW_FROM,
		WINDOW_TO,
	);
	assert.match(formatEventWhen(saturday, WINDOW_FROM), /^Sat /);
});

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

const CLUB_NIGHT = [
	'UID:clubnight@test',
	'DTSTART;TZID=Europe/London:20260901T190000',
	'DTEND;TZID=Europe/London:20260901T200000',
	'RRULE:FREQ=WEEKLY',
	'SUMMARY:Tuesday Club Run',
	'STATUS:CONFIRMED',
];

check('a weekly club night stays at 7pm either side of the DST change', () => {
	const events = parse(
		feed(CLUB_NIGHT),
		'club-nights',
		new Date('2026-10-01T00:00:00Z'),
		new Date('2026-12-01T00:00:00Z'),
	);
	const times = events.map((e) => formatEventWhen(e, new Date('2026-10-01T00:00:00Z')));
	assert.ok(times.length > 5, `expected several occurrences, got ${times.length}`);
	const odd = times.filter((t) => !t.endsWith('7:00 pm'));
	assert.equal(odd.length, 0, `these did not read 7:00 pm: ${odd.join(', ')}`);
});

check('an EXDATE cancels that one club night', () => {
	const without = parse(
		feed([...CLUB_NIGHT, 'EXDATE;TZID=Europe/London:20260908T190000']),
		'club-nights',
		new Date('2026-09-01T00:00:00Z'),
		new Date('2026-09-30T00:00:00Z'),
	);
	const dates = without.map((e) => e.start.toISOString().slice(0, 10));
	assert.ok(!dates.includes('2026-09-08'), `8 Sep should be gone, got ${dates.join(', ')}`);
	assert.ok(dates.includes('2026-09-01'), 'the other occurrences should survive');
});

// ---------------------------------------------------------------------------
// Cancellations and links
// ---------------------------------------------------------------------------

check('a cancelled event is dropped', () => {
	const events = parse(
		feed([
			'UID:cancelled@test',
			'DTSTART:20261101T100000Z',
			'DTEND:20261101T120000Z',
			'SUMMARY:A race that is off',
			'STATUS:CANCELLED',
		]),
		'race-calendar',
		WINDOW_FROM,
		WINDOW_TO,
	);
	assert.equal(events.length, 0);
});

check('the entry link is lifted out of the description', () => {
	const [event] = parse(
		feed([
			'UID:link@test',
			'DTSTART:20261018T090000Z',
			'DTEND:20261018T110000Z',
			'SUMMARY:Stockland Scamper 10k',
			'DESCRIPTION:https://example.test/enter\\n\\nMud\\, hills and cake.',
			'STATUS:CONFIRMED',
		]),
		'championship',
		WINDOW_FROM,
		WINDOW_TO,
	);
	assert.equal(event.entryLink, 'https://example.test/enter');
	assert.ok(
		!event.description.includes('https://'),
		`the URL should not also be in the prose: "${event.description}"`,
	);
	assert.ok(event.description.includes('Mud, hills and cake.'));
});

check('an event with no description has no entry link', () => {
	const [event] = parse(
		feed([
			'UID:nolink@test',
			'DTSTART:20261018T090000Z',
			'SUMMARY:No description',
			'STATUS:CONFIRMED',
		]),
		'race-calendar',
		WINDOW_FROM,
		WINDOW_TO,
	);
	assert.equal(event.entryLink, null);
	assert.equal(event.description, null);
});

check('championship events are flagged, others are not', () => {
	const body = [
		'UID:flag@test',
		'DTSTART:20261018T090000Z',
		'SUMMARY:A race',
		'STATUS:CONFIRMED',
	];
	const [champ] = parse(feed(body), 'championship', WINDOW_FROM, WINDOW_TO);
	const [other] = parse(feed(body), 'race-calendar', WINDOW_FROM, WINDOW_TO);
	assert.equal(champ.isChampionship, true);
	assert.equal(other.isChampionship, false);
});

// ---------------------------------------------------------------------------
// Reconciling the two sources
//
// The homepage merges the Google calendars with the rule-based race diary, and
// a race in both would otherwise appear twice. Matching too eagerly is worse
// than matching too little: a missed duplicate is untidy, a wrong match hides
// a real race.
// ---------------------------------------------------------------------------

const d = (iso) => new Date(iso);

for (const [a, b, aDate, bDate, want, why] of [
	['Chard Flyer 10k', 'Chard Flyer', '2027-01-01', '2027-01-01', true, 'calendar carries the distance'],
	['Chard Flyer 10k', 'Chard Flyer', '2027-01-01', '2027-03-01', false, 'same name months apart is next year'],
	['Chard Flyer 10k', 'Chard Half', '2027-01-01', '2027-01-01', false, 'different race, same venue'],
	['Stockland Scamper 10k', 'Stockland Scamper', '2026-10-18', '2026-10-20', true, 'a few days out is still one race'],
	['Forde Abbey 10k', 'Forde Abbey 10k and free Junior 1500m', '2027-06-23', '2027-06-24', true, 'diary name is the longer one'],
	['Malaga Marathon', 'Marathon', '2026-11-08', '2026-11-08', false, 'a bare word must not swallow races'],
	['Chard Flyer 10k', '', '2027-01-01', '2027-01-01', false, 'an empty name matches nothing'],
]) {
	check(`same race? ${why}`, () => {
		assert.equal(isSameRace(a, b, d(aDate), d(bDate)), want);
	});
}

// ---------------------------------------------------------------------------
// Which socials are pub runs
//
// The /pub-runs page reads the socials calendar and keeps the pub runs. There
// is no field saying which those are, only the title, so this is a naming
// convention holding up a page. A miss is silent — the run simply never
// appears — which is why the match is generous and why the wordings the
// secretaries actually use are pinned here rather than assumed.
// ---------------------------------------------------------------------------

for (const [title, want, why] of [
	['Pub Run', true, 'the plain wording'],
	['Pub run - The George', true, 'a pub named after a dash'],
	['Pub Run: The Eagle Tavern', true, 'a colon instead'],
	['July pub run', true, 'the month first'],
	['Pub runs', true, 'plural'],
	['Pubs Run', true, 'the annual one, pubs plural'],
	['PUB RUN', true, 'shouted'],
	['Pub-run', true, 'hyphenated'],
	['Christmas party', false, 'an ordinary social'],
	['Pub quiz', false, 'a pub, but nobody is running'],
	['Club run', false, 'a run, but not to a pub'],
	['Summer BBQ', false, 'no pub, no run'],
]) {
	check(`pub run? ${why}`, () => {
		assert.equal(isPubRun({ title }), want, `"${title}"`);
	});
}

console.log(
	failures === 0
		? `\n${green('All calendar rules hold.')}\n`
		: `\n${red(`${failures} calendar rule(s) broken.`)}\n`,
);
process.exit(failures === 0 ? 0 : 1);
