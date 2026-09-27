// Guards the championship standings parsing.
//
// The scoring itself happens in Google Sheets, so this is not checking any
// maths. It is checking the seam — the point where a CSV the committee can
// reshape by adding a race turns into a table with people's names on it.
// Everything pinned here has a wrong answer that looks right:
//
//   - a summary column read by position instead of by name, so adding the
//     sixteenth race silently renders somebody's Bonus as their total
//   - a blank race cell and a zero treated the same, so "did not run" and
//     "ran, finished eleventh" become one thing
//   - Google answering an un-published tab with a sign-in page and a 200,
//     which parses as CSV perfectly well and renders as nonsense
//   - a name containing a comma splitting into two columns
//
// None of those fail a build on their own. They ship, and they are wrong
// about named members of the club on a public page.
//
// Plain node, no test framework, like the other checks in this folder. Run it
// with `npm run check:championship`.

import assert from 'node:assert/strict';

const { parseCsv } = await import(new URL('../src/utils/csv.ts', import.meta.url).href);
const { parseStandings } = await import(new URL('../src/utils/championship.ts', import.meta.url).href);
const { assertNotHtml, retryDelayMs, describeStatus } = await import(
	new URL('../src/utils/sheet.ts', import.meta.url).href
);

const red = (s) => `\u001b[31m${s}\u001b[0m`;
const green = (s) => `\u001b[32m${s}\u001b[0m`;
const dim = (s) => `\u001b[2m${s}\u001b[0m`;

let failures = 0;
const check = (name, fn) => {
	try {
		const result = fn();
		if (result && typeof result.then === 'function') {
			throw new Error('check() bodies must be synchronous - this one returned a promise');
		}
		console.log(`  ${green('ok')} ${name}`);
	} catch (error) {
		failures += 1;
		console.log(`  ${red('FAIL')} ${name}`);
		console.log(dim(`       ${error.message.split('\n')[0]}`));
	}
};

/**
 * A Standings tab, shaped exactly like the real one: two name columns, room
 * for more races than are in use, then the five summary columns.
 */
const standingsCsv = (
	{ races = ['Axmouth Challenge', 'Slay the dragon 10k', 'Frogmary Parkrun'], spare = 2, rows = [] } = {},
) => {
	const header = ['Name', 'M or F', ...races, ...Array(spare).fill(''), 'Bonus', 'Races run', 'Points so far', 'Position', 'Championship score'];
	const width = header.length;
	const pad = (row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')];
	// The real sheet runs formulas to row 1000, so blank rows follow the data.
	const blanks = Array.from({ length: 3 }, () => Array(width).fill(''));
	return [header, ...rows.map(pad), ...blanks].map((row) => row.join(',')).join('\r\n');
};

const parse = (csv) => parseStandings(parseCsv(csv), new Date('2026-09-27T00:00:00Z'));

console.log('\nChampionship standings\n');

// ---------------------------------------------------------------------------
// CSV, which is never as simple as splitting on commas.
// ---------------------------------------------------------------------------

check('a quoted field keeps its comma — club members have names like that', () => {
	assert.deepEqual(parseCsv('Name,Club\n"Ellis-Trott, Tracey",CRR'), [
		['Name', 'Club'],
		['Ellis-Trott, Tracey', 'CRR'],
	]);
});

check('a doubled quote inside a quoted field is one quote', () => {
	assert.deepEqual(parseCsv('a,"say ""hi""",c'), [['a', 'say "hi"', 'c']]);
});

check('a quoted field may span lines without losing the row', () => {
	assert.deepEqual(parseCsv('a,"two\nlines",c\nd,e,f'), [
		['a', 'two\nlines', 'c'],
		['d', 'e', 'f'],
	]);
});

check('CRLF is one row break, not two', () => {
	assert.deepEqual(parseCsv('a,b\r\nc,d'), [
		['a', 'b'],
		['c', 'd'],
	]);
});

check('a trailing newline does not invent a blank row', () => {
	assert.deepEqual(parseCsv('a,b\n'), [['a', 'b']]);
});

check('empty input gives no rows at all', () => {
	assert.deepEqual(parseCsv(''), []);
});

check('a byte order mark does not become part of the first header', () => {
	assert.deepEqual(parseCsv('﻿Name,Club'), [['Name', 'Club']]);
});

check('a quote in the middle of an unquoted field is just a character', () => {
	assert.deepEqual(parseCsv(`a,5" nails,c`), [['a', '5" nails', 'c']]);
});

check('empty trailing fields survive', () => {
	assert.deepEqual(parseCsv('a,,'), [['a', '', '']]);
});

// ---------------------------------------------------------------------------
// The columns. This is the one that breaks when a race is added.
// ---------------------------------------------------------------------------

check('summary columns are found by name, not by position', () => {
	// Sixteen races where there were three: every summary column has moved.
	const races = Array.from({ length: 16 }, (_, i) => `Race ${i + 1}`);
	const row = ['Ann Example', 'F', ...Array(16).fill(''), '', '', '1', '4', '31', '2', '29'];
	const { women } = parse(standingsCsv({ races, spare: 2, rows: [row] }));

	assert.equal(women[0].pointsSoFar, 31);
	assert.equal(women[0].position, 2);
	assert.equal(women[0].championshipScore, 29);
	assert.equal(women[0].bonus, 1);
});

check('unused race slots are dropped, and the named ones keep sheet order', () => {
	const { races } = parse(standingsCsv());
	assert.deepEqual(races, ['Axmouth Challenge', 'Slay the dragon 10k', 'Frogmary Parkrun']);
});

check('a renamed summary column fails the build, naming the column', () => {
	const csv = standingsCsv().replace('Points so far', 'Total points');
	assert.throws(() => parse(csv), /Points so far/);
});

check('the wrong tab published fails the build rather than rendering blank', () => {
	const csv = 'Timestamp,Your name,Which race?\n2026-09-01,Ann Example,Ilminster 10k';
	assert.throws(() => parse(csv), /different tab/);
});

check('an empty sheet fails the build', () => {
	assert.throws(() => parse(''), /empty/i);
});

// ---------------------------------------------------------------------------
// The rows.
// ---------------------------------------------------------------------------

check('blank means did not run; zero means ran and scored nothing', () => {
	const row = ['Ann Example', 'F', '', '0', '9', '', '', '0', '2', '9', '1', '9'];
	const { women } = parse(standingsCsv({ rows: [row] }));

	assert.deepEqual(women[0].racePoints, [null, 0, 9]);
});

check('the blank rows the sheet runs to 1000 are dropped', () => {
	const row = ['Ann Example', 'F', '10', '', '', '', '', '0', '1', '10', '1', '10'];
	const { women, men } = parse(standingsCsv({ rows: [row] }));

	assert.equal(women.length, 1);
	assert.equal(men.length, 0);
});

check('men and women are split into separate tables', () => {
	const rows = [
		['Ann Example', 'F', '10', '', '', '', '', '0', '1', '10', '1', '10'],
		['Bob Example', 'M', '9', '', '', '', '', '0', '1', '9', '1', '9'],
	];
	const { men, women } = parse(standingsCsv({ rows }));

	assert.deepEqual(women.map((r) => r.name), ['Ann Example']);
	assert.deepEqual(men.map((r) => r.name), ['Bob Example']);
});

check('runners come out in position order, not the sheet’s alphabetical order', () => {
	const rows = [
		['Ann Example', 'F', '', '', '', '', '', '0', '1', '7', '3', '7'],
		['Bea Example', 'F', '', '', '', '', '', '0', '1', '10', '1', '10'],
		['Cat Example', 'F', '', '', '', '', '', '0', '1', '9', '2', '9'],
	];
	const { women } = parse(standingsCsv({ rows }));

	assert.deepEqual(women.map((r) => r.name), ['Bea Example', 'Cat Example', 'Ann Example']);
});

check('a shared position keeps both runners, in alphabetical order', () => {
	const rows = [
		['Zoe Example', 'F', '', '', '', '', '', '0', '1', '9', '1', '9'],
		['Ann Example', 'F', '', '', '', '', '', '0', '1', '9', '1', '9'],
	];
	const { women } = parse(standingsCsv({ rows }));

	assert.deepEqual(women.map((r) => r.name), ['Ann Example', 'Zoe Example']);
	assert.deepEqual(women.map((r) => r.position), [1, 1]);
});

check('a runner with only a bonus point still appears', () => {
	// Real case: Claire Hall, 0 races run, 1 bonus, 1 point.
	const row = ['Claire Hall', 'F', '', '', '', '', '', '1', '0', '1', '15', '1'];
	const { women } = parse(standingsCsv({ rows: [row] }));

	assert.equal(women.length, 1);
	assert.equal(women[0].racesRun, 0);
	assert.equal(women[0].bonus, 1);
	assert.deepEqual(women[0].racePoints, [null, null, null]);
});

check('a name with a comma in it stays one runner', () => {
	// Written out rather than built by the helper: the point is the quoting in
	// the raw CSV, which is exactly what the helper would paper over.
	const csv = [
		'Name,M or F,Axmouth Challenge,Slay the dragon 10k,Frogmary Parkrun,,,Bonus,Races run,Points so far,Position,Championship score',
		'"Ellis-Trott, Tracey",F,10,10,9,,,0,3,29,1,29',
	].join('\r\n');
	const { women } = parse(csv);

	assert.equal(women[0].name, 'Ellis-Trott, Tracey');
	assert.equal(women[0].pointsSoFar, 29);
});

check('a missing M or F fails the build, naming the runner', () => {
	const row = ['Ann Example', '', '10', '', '', '', '', '0', '1', '10', '1', '10'];
	assert.throws(() => parse(standingsCsv({ rows: [row] })), /Ann Example/);
});

check('a formula error in a points cell fails the build, naming the race', () => {
	const row = ['Ann Example', 'F', '#REF!', '', '', '', '', '0', '1', '10', '1', '10'];
	assert.throws(() => parse(standingsCsv({ rows: [row] })), /Axmouth Challenge/);
});

check('a blank summary cell reads as zero rather than failing', () => {
	// A runner added to Runners before they have run anything.
	const row = ['Ann Example', 'F', '', '', '', '', '', '', '', '', '', ''];
	const { women } = parse(standingsCsv({ rows: [row] }));

	assert.equal(women[0].pointsSoFar, 0);
	assert.equal(women[0].racesRun, 0);
});

check('surrounding spaces in headers and cells do not break matching', () => {
	const csv = standingsCsv({ rows: [['  Ann Example ', ' f ', '10', '', '', '', '', '0', '1', '10', '1', '10']] })
		.replace('Points so far', ' Points so far ');
	const { women } = parse(csv);

	assert.equal(women[0].name, 'Ann Example');
	assert.equal(women[0].gender, 'F');
	assert.equal(women[0].pointsSoFar, 10);
});

// ---------------------------------------------------------------------------
// Talking to Google.
// ---------------------------------------------------------------------------

check('a sign-in page served with a 200 is caught, not parsed', () => {
	assert.throws(
		() => assertNotHtml('<!DOCTYPE html><html><head><title>Sign in</title>', 'championship standings'),
		/not published|HTML/i,
	);
});

check('real CSV is not mistaken for HTML', () => {
	assert.doesNotThrow(() => assertNotHtml('Name,M or F,Bonus\nAnn,F,0', 'championship standings'));
});

check('a 404 is explained as an unpublished tab, not as a rate limit', () => {
	const message = describeStatus('championship standings', 404, 'Not Found');
	assert.match(message, /Publish to web/);
	assert.doesNotMatch(message, /rate limit/);
});

check('a 429 is explained as a rate limit, not as an unpublished tab', () => {
	const message = describeStatus('championship standings', 429, 'Too Many Requests');
	assert.match(message, /rate limit/);
	assert.doesNotMatch(message, /Publish to web/);
});

check('backoff doubles, and Retry-After wins when Google sends one', () => {
	assert.equal(retryDelayMs(1), 1_000);
	assert.equal(retryDelayMs(3), 4_000);
	assert.equal(retryDelayMs(1, '5'), 5_000);
	// Never waits longer than the cap, whatever Google asks for.
	assert.equal(retryDelayMs(1, '600'), 20_000);
});

// ---------------------------------------------------------------------------

console.log('');
if (failures > 0) {
	console.log(red(`${failures} championship check${failures === 1 ? '' : 's'} failed.\n`));
	process.exit(1);
}
console.log(green('All championship checks passed.\n'));
