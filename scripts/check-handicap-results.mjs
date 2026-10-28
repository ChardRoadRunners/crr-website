// Guards the handicap results parsing.
//
// The timing and judging happen in the CRR Handicap sheet, so this is not
// checking any timing. It is checking the seam — the point where the sheet's
// Results tab turns into a table with people's names on it. Everything pinned
// here has a wrong answer that looks right:
//
//   - a column read by position, so a column added to the tab silently puts
//     somebody's start time where their run time should be
//   - two winners on one night, or two runners in one position, rendered as if
//     that were a result
//   - a runner who started but has no finish quietly dropped from the table
//   - a winner-only night (before Oct 2026) treated as an empty one
//
// Plain node, no test framework, like the other checks. `npm run check:handicap-results`.

import assert from 'node:assert/strict';

const { parseCsv } = await import(new URL('../src/utils/csv.ts', import.meta.url).href);
const { parseHandicapResults } = await import(
	new URL('../src/utils/handicap-results.ts', import.meta.url).href
);

const red = (s) => `\u001b[31m${s}\u001b[0m`;
const green = (s) => `\u001b[32m${s}\u001b[0m`;
const dim = (s) => `\u001b[2m${s}\u001b[0m`;

let failures = 0;
const check = (name, fn) => {
	try {
		fn();
		console.log(`  ${green('ok')} ${name}`);
	} catch (error) {
		failures += 1;
		console.log(`  ${red('FAIL')} ${name}`);
		console.log(dim(`       ${error.message.split('\n')[0]}`));
	}
};

// The real Results tab as it stood after the October 2026 handicap.
const HEADER = 'Date,Race,Position,Name,Run time,Start time,Winner,First handicap';
const REAL = [
	HEADER,
	'2026-10-27,27 Oct 2026,1,Sean Tovey,24:49,26:30,TRUE,',
	'2026-10-27,27 Oct 2026,2,Helen Hickley,27:10,28:00,,',
	'2026-10-27,27 Oct 2026,3,Wayne Loveridge,16:46,17:30,,',
	'2026-10-27,27 Oct 2026,4,Martin Holley,20:37,21:15,,',
	'2026-10-27,27 Oct 2026,5,Joe Chlopecki-Carslake,20:28,21:00,,TRUE',
	'2026-10-27,27 Oct 2026,15,Lisa Palmer,,,,',
	'2026-10-27,27 Oct 2026,16,Lydia Heywood,27:43,25:00,,',
	'2026-10-27,27 Oct 2026,17,Matt Sheahan,,22:30,,',
	'2026-09-29,29 Sep 2026,,Thomas Wallis,19:42,20:15,TRUE,',
	'2026-08-25,25 Aug 2026,,Katie Hobbs,22:20,25:30,TRUE,',
	// The tab runs to the bottom of its formula range: blank rows follow.
	',,,,,,,',
	',,,,,,,',
].join('\r\n');

const parse = (csv) => parseHandicapResults(parseCsv(csv), new Date('2026-10-28T00:00:00Z'));
const throwsWith = (fn, pattern) => assert.throws(fn, (error) => pattern.test(error.message));

console.log('\nHandicap results\n');

check('nights come out newest first, blank rows dropped', () => {
	const { nights } = parse(REAL);
	assert.deepEqual(nights.map((n) => n.dateIso), ['2026-10-27', '2026-09-29', '2026-08-25']);
	assert.equal(nights[0].finishers.length, 8);
});

check('the winner is whoever the sheet says, not the fastest run time', () => {
	const [october] = parse(REAL).nights;
	assert.equal(october.winner.name, 'Sean Tovey');
	// Wayne ran 16:46, by far the fastest, and finished third. Still third.
	assert.equal(october.finishers.find((f) => f.name === 'Wayne Loveridge').position, 3);
});

check('a runner with a position but no time is kept, with no time', () => {
	const lisa = parse(REAL).nights[0].finishers.find((f) => f.name === 'Lisa Palmer');
	assert.deepEqual([lisa.position, lisa.runTime, lisa.startTime], [15, null, null]);
});

check('first handicap is carried through', () => {
	const joe = parse(REAL).nights[0].finishers.find((f) => f.name === 'Joe Chlopecki-Carslake');
	assert.equal(joe.firstHandicap, true);
});

check('nights before October 2026 are winner-only, not empty', () => {
	const [, september] = parse(REAL).nights;
	assert.equal(september.winnerOnly, true);
	assert.equal(september.winner.name, 'Thomas Wallis');
	assert.equal(parse(REAL).nights[0].winnerOnly, false);
});

check('finishing order, with anyone who has no position last', () => {
	const csv = [
		HEADER,
		'2026-11-24,24 Nov 2026,2,B Runner,21:00,21:00,,',
		'2026-11-24,24 Nov 2026,,Z Starter,,25:00,,',
		'2026-11-24,24 Nov 2026,1,A Runner,22:00,22:30,TRUE,',
		'2026-11-24,24 Nov 2026,,C Starter,,24:00,,',
	].join('\n');
	assert.deepEqual(
		parse(csv).nights[0].finishers.map((f) => f.name),
		['A Runner', 'B Runner', 'C Starter', 'Z Starter'],
	);
});

check('columns are found by name: a reordered tab reads the same', () => {
	const csv = [
		'Name,Winner,Run time,Date,Start time,Position,First handicap,Race,Extra',
		'Sean Tovey,TRUE,24:49,2026-10-27,26:30,1,,27 Oct 2026,x',
	].join('\n');
	const sean = parse(csv).nights[0].finishers[0];
	assert.deepEqual([sean.runTime, sean.startTime, sean.position, sean.winner], ['24:49', '26:30', 1, true]);
});

check('a missing column fails the build, naming it', () => {
	throwsWith(() => parse('Date,Race,Position,Name,Start time,Winner,First handicap\n'), /"Run time"/);
});

check('two winners on one night fails the build, naming them', () => {
	const csv = [HEADER, '2026-10-27,x,1,A,20:00,20:00,TRUE,', '2026-10-27,x,2,B,20:00,20:00,TRUE,'].join('\n');
	throwsWith(() => parse(csv), /A and B/);
});

check('two runners in one position fails the build', () => {
	const csv = [HEADER, '2026-10-27,x,3,A,20:00,20:00,,', '2026-10-27,x,3,B,20:00,20:00,,'].join('\n');
	throwsWith(() => parse(csv), /position 3/);
});

check('a date the site cannot read fails the build, naming the runner', () => {
	const csv = [HEADER, '27/10/2026,x,1,Sean Tovey,24:49,26:30,TRUE,'].join('\n');
	throwsWith(() => parse(csv), /Sean Tovey/);
});

check('a position that is not a whole number fails the build', () => {
	const csv = [HEADER, '2026-10-27,x,first,Sean Tovey,24:49,26:30,TRUE,'].join('\n');
	throwsWith(() => parse(csv), /"first"/);
});

check('an empty tab fails the build; a header with no rows is no results', () => {
	throwsWith(() => parse(''), /empty/);
	assert.deepEqual(parse(HEADER).nights, []);
});

console.log('');
if (failures > 0) {
	console.log(red(`${failures} handicap results check${failures === 1 ? '' : 's'} failed.\n`));
	process.exit(1);
}
console.log(green('All handicap results checks passed.\n'));
