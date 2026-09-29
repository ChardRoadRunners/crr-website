// The monthly handicap rules, written as something that runs.
//
// The sheet itself is being built in Google, not from this repository, so
// nothing here drives it. What this is for is saying exactly what the rules
// mean, in a form that can be disagreed with: docs/handicap.md describes them
// in prose, and this proves the prose is consistent. When the sheet exists,
// this is also what its arithmetic gets audited against, the way the
// championship's sums were.
//
// The five that matter, each of which has a plausible wrong answer:
//
//   - the 5k is a HANDICAP and the short races are NOT. Score a mile on
//     finish time and the fastest runner wins something meant to be age
//     graded.
//   - a handicap is last month's 5k, not this month's. An event that
//     handicaps itself gives everybody a result of exactly zero.
//   - start offsets come from the slowest runner ACTUALLY STARTING. Use the
//     slowest on the books and the whole field waits for somebody at home.
//   - a first-timer (no previous 5k, no starting handicap) races but cannot
//     win: not placed, told why, and their time becomes next month's handicap.
//   - ordering by (finish - handicap) has to be the real finishing order.
//
// Plain node, no test framework, like the other checks in this folder. Run it
// with `npm run check:handicap`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// scoring.gs is plain script, not a module, because Apps Script has no
// imports. Load it the way Apps Script effectively does.
const source = readFileSync(new URL('../sheets/handicap/scoring.gs', import.meta.url), 'utf8');
const load = new Function(
  `${source}\nreturn { durationToSeconds, secondsToClock, defaultFormat, handicapFor, startOffsets, latestPerRunner, scoreEvent, scoreAll, currentHolder, eventKey, handicapHistory };`,
);
const S = load();

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

/** mm:ss as seconds, so the fixtures read like race times. */
const t = (mins, secs = 0) => mins * 60 + secs;
const runner = (name, gender, startingSeconds = null) => ({ name, gender, startingSeconds });
const entry = (name, over) => ({ name, submittedAt: 1, finishSeconds: null, ageGrade: null, ...over });
const placed = (rows) => rows.filter((r) => r.counts).map((r) => [r.name, r.place]);

console.log('\nMonthly handicap scoring\n');

// ---------------------------------------------------------------------------
// Durations, which Google hands over as a fraction of a day.
// ---------------------------------------------------------------------------

check('a day fraction becomes seconds', () => {
	// 0.03236111111 of a day is the 46:36 in the championship sheet.
	assert.equal(Math.round(S.durationToSeconds(0.03236111111)), 2796);
	assert.equal(S.secondsToClock(2796), '46:36');
});

check('a missing time is null, not zero', () => {
	assert.equal(S.durationToSeconds(''), null);
	assert.equal(S.durationToSeconds(null), null);
	assert.equal(S.durationToSeconds(0), null);
});

check('the 5k defaults to a handicap and the short races do not', () => {
	assert.equal(S.defaultFormat('5k'), 'Handicap');
	assert.equal(S.defaultFormat('3km'), 'Age graded');
	assert.equal(S.defaultFormat('1500m'), 'Age graded');
	assert.equal(S.defaultFormat('1 mile'), 'Age graded');
});

// ---------------------------------------------------------------------------
// The 5k handicap.
// ---------------------------------------------------------------------------

const runners = [
	runner('Ann Example', 'F', t(30)),
	runner('Bob Example', 'M', t(25)),
	runner('Cat Example', 'F', t(20)),
];

check('first across the line wins, which is not the fastest runner', () => {
	const event = { dateIso: '2026-10-27', distance: '5k', format: 'Handicap' };
	const rows = S.scoreEvent(event, [
		// Cat is far the quickest but only matches her handicap.
		entry('Cat Example', { finishSeconds: t(20) }),
		// Ann is slowest but two minutes inside hers, so she gets there first.
		entry('Ann Example', { finishSeconds: t(28) }),
		entry('Bob Example', { finishSeconds: t(25) }),
	], runners, []);

	assert.deepEqual(placed(rows), [['Ann Example', 1], ['Bob Example', 2], ['Cat Example', 2]]);
});

check('the slowest starts on zero and the fastest waits longest', () => {
	const event = { dateIso: '2026-10-27', distance: '5k', format: 'Handicap' };
	const rows = S.scoreEvent(event, [
		entry('Ann Example', { finishSeconds: t(30) }),
		entry('Bob Example', { finishSeconds: t(25) }),
		entry('Cat Example', { finishSeconds: t(20) }),
	], runners, []);

	const offsets = Object.fromEntries(rows.map((r) => [r.name, r.offsetSeconds]));
	assert.equal(offsets['Ann Example'], 0);
	assert.equal(offsets['Bob Example'], t(5));
	assert.equal(offsets['Cat Example'], t(10));
});

check('offsets come from who is starting, not who is on the books', () => {
	// Ann, the slowest, stays at home. Bob must now be the one on zero,
	// otherwise everybody waits five minutes for a runner who is not there.
	const event = { dateIso: '2026-10-27', distance: '5k', format: 'Handicap' };
	const rows = S.scoreEvent(event, [
		entry('Bob Example', { finishSeconds: t(25) }),
		entry('Cat Example', { finishSeconds: t(20) }),
	], runners, []);

	const offsets = Object.fromEntries(rows.map((r) => [r.name, r.offsetSeconds]));
	assert.equal(offsets['Bob Example'], 0);
	assert.equal(offsets['Cat Example'], t(5));
});

check('the handicap is the previous 5k, never this one', () => {
	const history = [{ name: 'Ann Example', dateIso: '2026-09-29', finishSeconds: t(29) }];
	const event = { dateIso: '2026-10-27', distance: '5k', format: 'Handicap' };
	const rows = S.scoreEvent(event, [entry('Ann Example', { finishSeconds: t(27) })], runners, history);

	// September's 29:00, not the starting handicap and not tonight's 27:00.
	assert.equal(rows[0].handicapSeconds, t(29));
	assert.equal(rows[0].sortKey, t(-2));
});

check('the most recent previous 5k wins, not the first', () => {
	const history = [
		{ name: 'Ann Example', dateIso: '2026-07-28', finishSeconds: t(32) },
		{ name: 'Ann Example', dateIso: '2026-09-29', finishSeconds: t(29) },
	];
	const event = { dateIso: '2026-10-27', distance: '5k', format: 'Handicap' };
	const rows = S.scoreEvent(event, [entry('Ann Example', { finishSeconds: t(27) })], runners, history);

	assert.equal(rows[0].handicapSeconds, t(29));
});

check('a later 5k does not handicap an earlier one', () => {
	const history = [{ name: 'Ann Example', dateIso: '2026-11-24', finishSeconds: t(26) }];
	const event = { dateIso: '2026-10-27', distance: '5k', format: 'Handicap' };
	const rows = S.scoreEvent(event, [entry('Ann Example', { finishSeconds: t(27) })], runners, history);

	// Falls back to the starting handicap rather than reaching forward in time.
	assert.equal(rows[0].handicapSeconds, t(30));
});

check('a first handicap run is not placed, and says so', () => {
	const event = { dateIso: '2026-10-27', distance: '5k', format: 'Handicap' };
	const rows = S.scoreEvent(event, [
		entry('New Person', { finishSeconds: t(18) }),
		entry('Ann Example', { finishSeconds: t(29) }),
	], [runner('New Person', 'F', null), runner('Ann Example', 'F', t(30))], []);

	const newbie = rows.find((r) => r.name === 'New Person');
	// Fastest by miles, and still cannot win: first-timers never do.
	assert.equal(newbie.counts, false);
	assert.equal(newbie.firstRun, true);
	assert.equal(newbie.place, null);
	assert.match(newbie.reason, /first/i);
	assert.deepEqual(placed(rows), [['Ann Example', 1]]);
});

check('a 5k entry with no finish time does not count', () => {
	const event = { dateIso: '2026-10-27', distance: '5k', format: 'Handicap' };
	const rows = S.scoreEvent(event, [entry('Ann Example', {})], runners, []);
	assert.equal(rows[0].counts, false);
	assert.match(rows[0].reason, /finish time/i);
});

// ---------------------------------------------------------------------------
// The short races, which are NOT handicaps.
// ---------------------------------------------------------------------------

check('a mile is won on age grade, not on time', () => {
	const event = { dateIso: '2026-11-24', distance: '1 mile', format: 'Age graded' };
	const rows = S.scoreEvent(event, [
		// Cat is comfortably quickest but grades worst.
		entry('Cat Example', { finishSeconds: t(5, 30), ageGrade: 62.0 }),
		entry('Ann Example', { finishSeconds: t(8, 10), ageGrade: 78.4 }),
		entry('Bob Example', { finishSeconds: t(6, 45), ageGrade: 71.2 }),
	], runners, []);

	assert.deepEqual(placed(rows), [['Ann Example', 1], ['Bob Example', 2], ['Cat Example', 3]]);
});

check('an age graded race needs no handicap at all', () => {
	const event = { dateIso: '2026-11-24', distance: '1500m', format: 'Age graded' };
	const rows = S.scoreEvent(event, [entry('New Person', { ageGrade: 70 })], [
		runner('New Person', 'F', null),
	], []);

	// No starting handicap, no previous run, and it still counts — nobody is handicapped.
	assert.equal(rows[0].counts, true);
	assert.equal(rows[0].place, 1);
	assert.equal(rows[0].handicapSeconds, null);
});

check('a short race entry with no age grade does not count', () => {
	const event = { dateIso: '2026-11-24', distance: '3km', format: 'Age graded' };
	const rows = S.scoreEvent(event, [entry('Ann Example', { finishSeconds: t(14) })], runners, []);
	assert.equal(rows[0].counts, false);
	assert.match(rows[0].reason, /age grade/i);
});

// ---------------------------------------------------------------------------
// Rules shared with the championship.
// ---------------------------------------------------------------------------

check('the latest submission for an event wins', () => {
	const event = { dateIso: '2026-10-27', distance: '5k', format: 'Handicap' };
	const rows = S.scoreEvent(event, [
		{ name: 'Ann Example', submittedAt: 1, finishSeconds: t(31), ageGrade: null },
		{ name: 'Ann Example', submittedAt: 2, finishSeconds: t(28), ageGrade: null },
	], runners, []);

	assert.equal(rows.length, 1);
	assert.equal(rows[0].finishSeconds, t(28));
});

check('a name not on the Runners tab does not count, and says so', () => {
	const event = { dateIso: '2026-10-27', distance: '5k', format: 'Handicap' };
	const rows = S.scoreEvent(event, [entry('Ghost Runner', { finishSeconds: t(20) })], runners, []);
	assert.equal(rows[0].counts, false);
	assert.match(rows[0].reason, /Runners tab/i);
});

check('a dead heat shares the place and the next one skips', () => {
	const event = { dateIso: '2026-11-24', distance: '1 mile', format: 'Age graded' };
	const rows = S.scoreEvent(event, [
		entry('Ann Example', { ageGrade: 70 }),
		entry('Bob Example', { ageGrade: 70 }),
		entry('Cat Example', { ageGrade: 65 }),
	], runners, []);

	assert.deepEqual(placed(rows), [['Ann Example', 1], ['Bob Example', 1], ['Cat Example', 3]]);
});

check('everybody comes back, placed or not, so nobody silently vanishes', () => {
	const event = { dateIso: '2026-10-27', distance: '5k', format: 'Handicap' };
	const rows = S.scoreEvent(event, [
		entry('Ann Example', { finishSeconds: t(28) }),
		entry('Ghost Runner', { finishSeconds: t(20) }),
		entry('Bob Example', {}),
	], runners, []);

	assert.equal(rows.length, 3);
	assert.equal(rows.filter((r) => r.counts).length, 1);
	assert.ok(rows.filter((r) => !r.counts).every((r) => r.reason !== ''));
});

// ---------------------------------------------------------------------------
// A season, run end to end.
// ---------------------------------------------------------------------------

check('each 5k handicaps the next, and a mile in between changes nothing', () => {
	const events = [
		{ dateIso: '2026-09-29', distance: '5k', format: 'Handicap' },
		{ dateIso: '2026-10-27', distance: '1 mile', format: 'Age graded' },
		{ dateIso: '2026-11-24', distance: '5k', format: 'Handicap' },
	];
	const entriesByEvent = {
		[S.eventKey('2026-09-29', '5k')]: [entry('Ann Example', { finishSeconds: t(29) })],
		[S.eventKey('2026-10-27', '1 mile')]: [entry('Ann Example', { ageGrade: 75 })],
		[S.eventKey('2026-11-24', '5k')]: [entry('Ann Example', { finishSeconds: t(27) })],
	};

	const scored = S.scoreAll(events, entriesByEvent, runners);

	// September used the starting handicap; November used September, not the mile.
	assert.equal(scored[0].rows[0].handicapSeconds, t(30));
	assert.equal(scored[2].rows[0].handicapSeconds, t(29));
});

check('events entered out of order still feed the right months', () => {
	const events = [
		{ dateIso: '2026-11-24', distance: '5k', format: 'Handicap' },
		{ dateIso: '2026-09-29', distance: '5k', format: 'Handicap' },
	];
	const entriesByEvent = {
		[S.eventKey('2026-09-29', '5k')]: [entry('Ann Example', { finishSeconds: t(29) })],
		[S.eventKey('2026-11-24', '5k')]: [entry('Ann Example', { finishSeconds: t(27) })],
	};

	const scored = S.scoreAll(events, entriesByEvent, runners);
	assert.equal(scored[0].event.dateIso, '2026-09-29');
	assert.equal(scored[1].rows[0].handicapSeconds, t(29));
});

check('the trophy is held by the winner of the latest event with a result', () => {
	const events = [
		{ dateIso: '2026-09-29', distance: '5k', format: 'Handicap' },
		{ dateIso: '2026-10-27', distance: '1 mile', format: 'Age graded' },
		// Next month, nobody has submitted yet.
		{ dateIso: '2026-11-24', distance: '3km', format: 'Age graded' },
	];
	const entriesByEvent = {
		[S.eventKey('2026-09-29', '5k')]: [entry('Ann Example', { finishSeconds: t(28) })],
		[S.eventKey('2026-10-27', '1 mile')]: [
			entry('Bob Example', { ageGrade: 80 }),
			entry('Cat Example', { ageGrade: 70 }),
		],
	};

	const holder = S.currentHolder(S.scoreAll(events, entriesByEvent, runners));
	assert.deepEqual(holder.winners, ['Bob Example']);
	assert.equal(holder.event.distance, '1 mile');
});

check('a first run becomes the handicap for the next 5k', () => {
	const events = [
		{ dateIso: '2026-09-29', distance: '5k', format: 'Handicap' },
		{ dateIso: '2026-10-27', distance: '5k', format: 'Handicap' },
	];
	const entriesByEvent = {
		[S.eventKey('2026-09-29', '5k')]: [entry('New Person', { finishSeconds: t(24) })],
		[S.eventKey('2026-10-27', '5k')]: [entry('New Person', { finishSeconds: t(23) })],
	};
	const list = [runner('New Person', 'F', null)];

	const scored = S.scoreAll(events, entriesByEvent, list);
	assert.equal(scored[0].rows[0].counts, false);
	assert.equal(scored[0].rows[0].firstRun, true);
	// October is a proper race for them now, off September's 24:00.
	assert.equal(scored[1].rows[0].counts, true);
	assert.equal(scored[1].rows[0].handicapSeconds, t(24));
	assert.equal(scored[1].rows[0].place, 1);
});

check('a 5k that did not count for another reason sets no handicap', () => {
	const events = [
		{ dateIso: '2026-09-29', distance: '5k', format: 'Handicap' },
		{ dateIso: '2026-10-27', distance: '5k', format: 'Handicap' },
	];
	const entriesByEvent = {
		// Not on the Runners tab in September, so that run is not evidence.
		[S.eventKey('2026-09-29', '5k')]: [entry('Late Addition', { finishSeconds: t(24) })],
		[S.eventKey('2026-10-27', '5k')]: [entry('Late Addition', { finishSeconds: t(23) })],
	};
	const scored = S.scoreAll(events, entriesByEvent, []);
	assert.equal(S.handicapHistory(scored).length, 0);
});

check('start offsets are rounded to the nearest 5 seconds', () => {
	const offsets = S.startOffsets([
		{ handicapSeconds: t(30) },
		{ handicapSeconds: t(27, 42) },
		{ handicapSeconds: t(25, 3) },
	]);
	assert.deepEqual(offsets, [0, t(2, 20), t(4, 55)]);
});

check('the next handicap is the latest 5k, first run or not', () => {
	const events = [
		{ dateIso: '2026-08-25', distance: '5k', format: 'Handicap' },
		{ dateIso: '2026-09-29', distance: '5k', format: 'Handicap' },
	];
	const entriesByEvent = {
		[S.eventKey('2026-08-25', '5k')]: [entry('Ann Example', { finishSeconds: t(28) })],
		[S.eventKey('2026-09-29', '5k')]: [entry('Ann Example', { finishSeconds: t(27) })],
	};
	const scored = S.scoreAll(events, entriesByEvent, [runner('Ann Example', 'F', null)]);
	const next = S.handicapFor('Ann Example', '9999-12-31', S.handicapHistory(scored), null);
	assert.equal(next, t(27));
});

// ---------------------------------------------------------------------------

console.log('');
if (failures > 0) {
	console.log(red(`${failures} handicap check${failures === 1 ? '' : 's'} failed.\n`));
	process.exit(1);
}
console.log(green('All handicap checks passed.\n'));
