// A whole handicap night, driven through the sheet's own script.
//
// check-handicap.mjs pins down the rules. This pins down the script around
// them — sheets/handicap/setup.gs, which only ever runs inside Google Sheets —
// by running it against a pretend sheet (scripts/lib/fake-handicap-sheet.mjs)
// and replaying what went wrong on 27 October 2026, the first night the
// timing page was used for real:
//
//   - Lisa Palmer was ticked with no start time, and the Start tab broke.
//   - Wayne Loveridge ran without being ticked and could not be given token 3.
//   - Matt Sheahan was put on token 17 by mistake and could not be taken off.
//   - People with nothing in History were all treated as first-timers.
//   - It saved with four problems listed, and the unclaimed clock times and a
//     finish removed on the night were lost.
//
// Plain node, no framework. `npm run check:handicap` runs both files.

import assert from 'node:assert/strict';
import { makeSheet, asThePageSeesIt } from './lib/fake-handicap-sheet.mjs';

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
const t = (mins, secs = 0) => mins * 60 + secs;

// A small field with the 27 October cast in it. Start times are made up
// except where the night's own record gives them (Wayne's 17:30).
const FIELD = {
	raceDateIso: '2026-10-27',
	raceLabel: '27 Oct 2026',
	runners: [
		{ name: 'Sean Tovey', suggested: t(26, 30) },
		{ name: 'Stewart Baker', suggested: t(20) },
		{ name: 'Chris Cobb', suggested: t(23) },
		{ name: 'Joe Chlopecki-Carslake', simonStart: '25:00' }, // genuinely new
		{ name: 'Neil Adams', simonStart: '23:00' },             // nothing in History, but ran before Feb 2026
		{ name: 'Lisa Palmer' },                                  // no start time at all
		{ name: 'Lydia Heywood', suggested: t(30) },
		{ name: 'Matt Sheahan', suggested: t(22) },
		{ name: 'Wayne Loveridge', suggested: t(17, 30) },        // ran, was never ticked
	],
	history: [
		{ dateIso: '2026-09-29', name: 'Sean Tovey', runSeconds: t(26, 31) },
		{ dateIso: '2026-09-29', name: 'Stewart Baker', runSeconds: t(20, 2) },
		{ dateIso: '2026-09-29', name: 'Chris Cobb', runSeconds: t(23, 4) },
		{ dateIso: '2026-09-29', name: 'Lydia Heywood', runSeconds: t(30, 1) },
		{ dateIso: '2026-09-29', name: 'Matt Sheahan', runSeconds: t(22, 3) },
		{ dateIso: '2026-09-29', name: 'Wayne Loveridge', runSeconds: t(17, 29) },
	],
};
const field = () => makeSheet(FIELD);

console.log('\nBringing a version 1.1 sheet up to 1.2');
check('the first call from the page adds the tick column, the archive tab and the Settings row', () => {
	const s = field();
	assert.equal(s.book.sheets.Runners.getMaxColumns(), 16);
	s.api.api_state(s.pin);
	assert.equal(s.rows('Runners')[0][16], 'First time? (the timer ticks this)');
	assert.ok(s.book.sheets['Timing archive']);
	assert.equal(s.rows('Settings')[8][0], 'First group when the clock started');
	assert.deepEqual(Object.keys(s.book.formulas).sort(), ['Runners!R2C16', 'Runners!R2C7', 'Start list!R2C4']);
});
check('doing it twice changes nothing, and keeps ticks already made', () => {
	const s = field();
	s.api.api_state(s.pin);
	s.api.api_setFirstTime(s.pin, 'Joe Chlopecki-Carslake', true);
	const before = JSON.stringify(s.rows('Runners'));
	s.api.upgradeLayout_();
	assert.equal(JSON.stringify(s.rows('Runners')), before);
});
check('a sheet laid out differently is refused, not rearranged', () => {
	const s = field();
	s.book.sheets.Runners.put(1, 16, 'Something else');
	assert.throws(() => s.api.api_state(s.pin), /not laid out as version 1.2 expects/);
	assert.equal(s.book.sheets.Runners.getMaxColumns(), 16);
});
check('the wrong PIN gets nothing', () => {
	const s = field();
	assert.throws(() => s.api.api_state('0000'), /Wrong PIN/);
	assert.throws(() => s.api.api_saveRace('0000', true), /Wrong PIN/);
});

console.log('\n27 October 2026, replayed');
const night = () => {
	const s = field();
	const { api, pin } = s;
	api.api_state(pin);
	for (const name of ['Sean Tovey', 'Stewart Baker', 'Chris Cobb', 'Joe Chlopecki-Carslake', 'Neil Adams', 'Lisa Palmer', 'Lydia Heywood', 'Matt Sheahan']) {
		api.api_setRunning(pin, name, true);
	}
	return s;
};
const runner = (state, name) => state.runners.find((r) => r.name === name);

check('Lisa Palmer, ticked with no start time, reaches the page as a blank and moves nobody', () => {
	const s = night();
	const state = asThePageSeesIt(s.api.api_state(s.pin));
	assert.equal(runner(state, 'Lisa Palmer').startSeconds, undefined, 'the blank really does go missing on the way');
	assert.equal(runner(state, 'Lisa Palmer').running, true);
	s.api.api_startClock(s.pin, 1000, false);
	assert.equal(s.rows('Settings')[8][1], '30:00', 'first group is Lydia on 30:00, not Lisa');
});
check('only the runner the timer ticks is a first-timer; nothing in History is not enough', () => {
	const s = night();
	let state = s.api.api_state(s.pin);
	assert.deepEqual(state.runners.filter((r) => r.noData).map((r) => r.name).sort(), ['Joe Chlopecki-Carslake', 'Lisa Palmer', 'Neil Adams']);
	assert.deepEqual(state.runners.filter((r) => r.firstHandicap).map((r) => r.name), []);
	s.api.api_setFirstTime(s.pin, 'Joe Chlopecki-Carslake', true);
	state = s.api.api_state(s.pin);
	assert.deepEqual(state.runners.filter((r) => r.firstHandicap).map((r) => r.name), ['Joe Chlopecki-Carslake']);
});
check('ticking "first time" against somebody with a run in History does nothing', () => {
	const s = night();
	s.api.api_setFirstTime(s.pin, 'Sean Tovey', true);
	assert.equal(runner(s.api.api_state(s.pin), 'Sean Tovey').firstHandicap, false);
});
check('someone added on the night as new starts with the first-time tick on', () => {
	const s = night();
	s.api.api_addRunner(s.pin, 'Brand New', '27:00');
	const r = runner(s.api.api_state(s.pin), 'Brand New');
	assert.deepEqual([r.running, r.noData, r.firstHandicap, r.startSeconds], [true, true, true, t(27)]);
});

// The finish, as the phone sends it: every tap, including one taken back.
const taps = [
	{ id: 'a', clockSeconds: t(30, 5) },   // 1 Sean
	{ id: 'b', clockSeconds: t(30, 9) },   // 2 Stewart
	{ id: 'c', clockSeconds: t(30, 12) },  // 3 Wayne, not ticked
	{ id: 'x', clockSeconds: t(30, 14), removed: true }, // tapped by mistake, taken back
	{ id: 'd', clockSeconds: t(30, 20) },  // 4 Joe
	{ id: 'e', clockSeconds: t(30, 31) },  // 5 Lisa, no start time
	{ id: 'f', clockSeconds: t(31, 2) },   // 6 Lydia, not racing
	{ id: 'g', clockSeconds: t(31, 40) },  // 7 nobody claims it
];
const finished = () => {
	const s = night();
	const { api, pin } = s;
	api.api_setFirstTime(pin, 'Joe Chlopecki-Carslake', true);
	api.api_startClock(pin, 1000, false);
	api.api_syncFinishes(pin, taps);
	api.api_setToken(pin, 'Sean Tovey', 1);
	api.api_setToken(pin, 'Stewart Baker', 2);
	api.api_setToken(pin, 'Joe Chlopecki-Carslake', 4);
	api.api_setToken(pin, 'Lisa Palmer', 5);
	return s;
};

check('a tap taken back is kept on the Timing tab, marked Removed, and is not a position', () => {
	const s = finished();
	const timing = s.rows('Timing').slice(1);
	assert.deepEqual(timing.map((r) => r[0]), ['1', '2', '3', '4', '5', '6', '7', 'Removed']);
	assert.equal(timing[7][3], 'x');
	const state = s.api.api_state(s.pin);
	assert.equal(state.finishes.length, 8, 'the page gets it back too, so another phone keeps it');
	assert.equal(state.finishes.filter((f) => f.removed).length, 1);
});
check('sending the same list again changes nothing', () => {
	const s = finished();
	const before = JSON.stringify(s.rows('Timing'));
	s.api.api_syncFinishes(s.pin, taps);
	s.api.api_syncFinishes(s.pin, taps.slice().reverse());
	assert.equal(JSON.stringify(s.rows('Timing')), before);
});
check('Wayne, never ticked, is added from the Tokens tab with the start time he went off on', () => {
	const s = finished();
	s.api.api_addLate(s.pin, 'Wayne Loveridge', '17:30', 3);
	const w = runner(s.api.api_state(s.pin), 'Wayne Loveridge');
	assert.deepEqual([w.running, w.token, w.startSeconds], [true, 3, t(17, 30)]);
	const row = s.api.api_result(s.pin).rows.find((r) => r.name === 'Wayne Loveridge');
	assert.equal(row.run, '17:42', 'clock 30:12 minus a go-at of 12:30');
});
check('adding him late needs a start time or "Guest", and says so', () => {
	const s = finished();
	assert.throws(() => s.api.api_addLate(s.pin, 'Wayne Loveridge', '', 3), /start time they went off on/);
	assert.throws(() => s.api.api_addLate(s.pin, 'Wayne Loveridge', 'fast', 3), /start time they went off on/);
	assert.equal(runner(s.api.api_state(s.pin), 'Wayne Loveridge').running, false, 'and nothing is half done');
});
check('Matt Sheahan put on a token by mistake can be taken off again', () => {
	const s = finished();
	s.api.api_setToken(s.pin, 'Matt Sheahan', 7);
	assert.equal(runner(s.api.api_state(s.pin), 'Matt Sheahan').token, 7);
	s.api.api_setToken(s.pin, 'Matt Sheahan', '');
	assert.equal(runner(asThePageSeesIt(s.api.api_state(s.pin)), 'Matt Sheahan').token, undefined);
});
check('Lydia, not really racing, is a guest: placed, no run time, and her start time moves nobody', () => {
	const s = finished();
	s.api.api_addLate(s.pin, 'Wayne Loveridge', '17:30', 3);
	const before = s.api.api_result(s.pin).rows.find((r) => r.name === 'Sean Tovey').run;
	s.api.api_setStartTime(s.pin, 'Lydia Heywood', 'guest');
	s.api.api_setToken(s.pin, 'Lydia Heywood', 6);
	const result = s.api.api_result(s.pin);
	const lydia = result.rows.find((r) => r.name === 'Lydia Heywood');
	assert.deepEqual([lydia.position, lydia.run, lydia.note], [6, '', 'Guest, not racing']);
	// She was the first group (30:00) when the clock started. As a guest she is in no group, so 0:00 has moved,
	// and the result says so rather than quietly changing every run time.
	assert.notEqual(result.rows.find((r) => r.name === 'Sean Tovey').run, before);
	assert.ok(result.problems.some((p) => /first group was on 30:00; it is now 26:30/.test(p)));
});

const tidied = () => {
	const s = finished();
	s.api.api_addLate(s.pin, 'Wayne Loveridge', '17:30', 3);
	s.api.api_setToken(s.pin, 'Lydia Heywood', 6);
	return s;
};
check('the result: Sean wins, Joe (first time) cannot, Lisa is placed with no run time, nothing reads "undefined"', () => {
	const s = tidied();
	const result = asThePageSeesIt(s.api.api_result(s.pin));
	assert.deepEqual(result.rows.filter((r) => r.winner).map((r) => r.name), ['Sean Tovey']);
	assert.equal(result.rows.find((r) => r.name === 'Joe Chlopecki-Carslake').note, "First handicap, so can't win");
	const lisa = result.rows.find((r) => r.name === 'Lisa Palmer');
	assert.deepEqual([lisa.position, lisa.run, lisa.note], [5, '', 'No start time, so no run time']);
	assert.ok(!JSON.stringify(result).includes('undefined'));
	assert.deepEqual(result.problems, ['Position 7 (31:40 on the clock) has no runner against it']);
});
check('saving with a problem listed is refused unless the person saving has accepted it', () => {
	const s = tidied();
	assert.throws(() => s.api.api_saveRace(s.pin), /There is 1 thing to sort out first/);
	assert.throws(() => s.api.api_saveRace(s.pin, false), /There is 1 thing to sort out first/);
	assert.equal(s.rows('History').length, 7, 'nothing written');
	assert.equal(s.rows('Timing').length, 9, 'nothing cleared');
	const done = s.api.api_saveRace(s.pin, true);
	assert.deepEqual([done.saved, done.winner], [9, 'Sean Tovey']);
});
check('saving copies every tap to the Timing archive first: finishes, the unclaimed one, the one taken back', () => {
	const s = tidied();
	s.api.api_saveRace(s.pin, true);
	const archive = s.rows('Timing archive').slice(1);
	assert.equal(archive.length, 8);
	assert.deepEqual(archive.map((r) => [r[2], r[5], r[6]]), [
		['1', 'Sean Tovey', 'Finish'], ['2', 'Stewart Baker', 'Finish'], ['3', 'Wayne Loveridge', 'Finish'],
		['4', 'Joe Chlopecki-Carslake', 'Finish'], ['5', 'Lisa Palmer', 'Finish'], ['6', 'Lydia Heywood', 'Finish'],
		['7', '', 'Finish, nobody against it'], ['', '', 'Tap removed by the timer'],
	]);
	assert.equal(archive[6][4], String(t(31, 40)), 'the clock time nobody claimed is still there');
	assert.equal(archive[7][4], String(t(30, 14)));
});
check('saving clears the decks: ticks, tokens, the timing, the clock and the first-group note', () => {
	const s = tidied();
	s.api.api_saveRace(s.pin, true);
	const state = asThePageSeesIt(s.api.api_state(s.pin));
	assert.equal(state.runners.filter((r) => r.running || r.token !== undefined).length, 0);
	assert.equal(state.finishes.length, 0);
	assert.equal(state.clockStartMs, undefined);
	assert.equal(s.rows('Settings')[8][1], '');
});
check('History has everyone who started, and Joe now has a run so the first-time tick is spent', () => {
	const s = tidied();
	s.api.api_saveRace(s.pin, true);
	const saved = s.rows('History').slice(7);
	assert.equal(saved.length, 9);
	assert.deepEqual(saved.find((r) => r[2] === 'Matt Sheahan').slice(4, 6), ['', ''], 'ticked, no token: no time, no position');
	const joe = runner(s.api.api_state(s.pin), 'Joe Chlopecki-Carslake');
	assert.deepEqual([joe.noData, joe.firstHandicap], [false, false]);
});
check('a guest is a guest for one night: saving clears the word from Simon\'s start time', () => {
	const s = tidied();
	s.api.api_setStartTime(s.pin, 'Lydia Heywood', 'Guest');
	s.api.api_saveRace(s.pin, true);
	const lydia = runner(s.api.api_state(s.pin), 'Lydia Heywood');
	assert.deepEqual([lydia.guest, lydia.startSeconds], [false, t(30)]);
});
check('the same night cannot be saved twice', () => {
	const s = tidied();
	s.api.api_saveRace(s.pin, true);
	s.api.api_setRunning(s.pin, 'Sean Tovey', true);
	assert.throws(() => s.api.api_saveRace(s.pin, true), /already in History/);
});

console.log('\nReset the clock');
check('reset stops the clock and clears its taps, removed ones included; ticks and tokens stay', () => {
	const s = finished();
	s.api.api_resetClock(s.pin);
	const state = asThePageSeesIt(s.api.api_state(s.pin));
	assert.equal(state.clockStartMs, undefined);
	assert.equal(state.finishes.length, 0);
	assert.equal(runner(state, 'Sean Tovey').token, 1);
	assert.equal(state.runners.filter((r) => r.running).length, 8);
	assert.equal(s.rows('Timing archive').length, 1, 'a practice is not archived');
});
check('a second phone pressing Start does not replace a running clock; a restart does', () => {
	const s = night();
	assert.equal(s.api.api_startClock(s.pin, 1000, false), 1000);
	assert.equal(s.api.api_startClock(s.pin, 2000, false), 1000);
	assert.equal(s.api.api_startClock(s.pin, 3000, true), 3000);
});

console.log('\nVersion 1.3: bringing a 1.2 sheet up to date');
check('the first call adds Race history and three Settings rows, and touches no formula', () => {
	const s = makeSheet({ ...FIELD, version: '1.2' });
	const formulas = JSON.stringify(s.book.formulas);
	s.api.api_state(s.pin);
	assert.ok(s.book.sheets['Race history']);
	assert.deepEqual(s.rows('Race history')[0].slice(0, 8), ['Date', 'Race', 'Distance', 'Runner', 'M or F', 'Time', 'Position', 'Age grade %']);
	assert.equal(s.rows('Settings')[11][0], 'Finish phone');
	assert.equal(JSON.stringify(s.book.formulas), formulas);
});
check('a handicap night on a 1.3 sheet is a handicap, and says so', () => {
	const s = night();
	const state = s.api.api_state(s.pin);
	assert.deepEqual([state.race.type, state.race.kind, state.race.typeLabel, state.race.label], ['handicap', 'handicap', 'Handicap 5k', '27 Oct 2026']);
	assert.deepEqual(state.raceTypes.map((t) => t.label), ['Handicap 5k', 'Mile', '1500m', '3k']);
});

console.log('\nA mile, with a phone at each end');
const mileNight = (extra = {}) => {
	const s = makeSheet({ ...FIELD, raceDateIso: '2026-12-08', raceLabel: '8 Dec 2026 \u2014 Mile', distance: 'Mile', ...extra });
	s.api.api_state(s.pin);
	for (const name of ['Sean Tovey', 'Stewart Baker', 'Chris Cobb', 'Lisa Palmer']) s.api.api_setRunning(s.pin, name, true);
	return s;
};
check('Events says Mile, so the page is told it is a mass-start race', () => {
	const s = mileNight();
	const race = s.api.api_state(s.pin).race;
	assert.deepEqual([race.type, race.kind, race.typeLabel, race.label], ['mile', 'mass', 'Mile', '8 Dec 2026 \u2014 Mile']);
});
check('the time call needs no PIN and reads no sheet', () => {
	const s = mileNight();
	const before = Date.now();
	const t = s.api.api_time();
	assert.ok(t >= before && t <= Date.now());
});
check('the finish phone hears the start the starter made', () => {
	const s = mileNight();
	assert.equal(asThePageSeesIt(s.api.api_clock(s.pin)).clockStartMs, undefined);
	s.api.api_startClock(s.pin, 1765224000000, false);
	const c = s.api.api_clock(s.pin);
	assert.deepEqual([c.clockStartMs, c.raceKey], [1765224000000, '2026-12-08|mile']);
	assert.equal(s.rows('Settings')[8][1], '', 'no "first group" for a race where everyone goes together');
	assert.throws(() => s.api.api_clock('0000'), /Wrong PIN/);
});
const mileTaps = [{ id: 'a', clockSeconds: 311.2 }, { id: 'b', clockSeconds: 340 }, { id: 'c', clockSeconds: 395.6 }, { id: 'd', clockSeconds: 420.9 }];
const mileFinished = () => {
	const s = mileNight();
	s.api.api_startClock(s.pin, 1765224000000, false);
	s.api.api_syncFinishes(s.pin, mileTaps, 'finish-phone');
	s.api.api_setToken(s.pin, 'Stewart Baker', 1);
	s.api.api_setToken(s.pin, 'Sean Tovey', 2);
	s.api.api_setToken(s.pin, 'Chris Cobb', 3);
	return s;
};
check('the first phone to send a finish is the finish phone; another phone\'s list is refused', () => {
	const s = mileFinished();
	assert.equal(s.api.api_clock(s.pin).finishPhone, 'finish-phone');
	assert.throws(() => s.api.api_syncFinishes(s.pin, [{ id: 'z', clockSeconds: 5 }], 'start-phone'), /ANOTHER_PHONE/);
	assert.equal(s.rows('Timing').length, 5, 'and the finish phone\'s list is untouched');
	s.api.api_syncFinishes(s.pin, mileTaps, 'finish-phone');
	assert.equal(s.rows('Timing').length, 5);
});
check('a phone can take the finish over on purpose, and then it is the finish phone', () => {
	const s = mileFinished();
	s.api.api_syncFinishes(s.pin, [...mileTaps, { id: 'e', clockSeconds: 450 }], 'spare-phone', true);
	assert.equal(s.api.api_clock(s.pin).finishPhone, 'spare-phone');
	assert.equal(s.rows('Timing').length, 6);
	assert.throws(() => s.api.api_syncFinishes(s.pin, mileTaps, 'finish-phone'), /ANOTHER_PHONE/);
});
check('a page from before 1.3, which sends no phone code, still works', () => {
	const s = mileNight();
	s.api.api_startClock(s.pin, 1765224000000, false);
	s.api.api_syncFinishes(s.pin, mileTaps);
	assert.equal(s.rows('Timing').length, 5);
	assert.equal(s.api.api_clock(s.pin).finishPhone, '');
});
check('someone who ran without being ticked is added with no start time asked for', () => {
	const s = mileFinished();
	s.api.api_addLate(s.pin, 'Wayne Loveridge', '', 4);
	const w = runner(s.api.api_state(s.pin), 'Wayne Loveridge');
	assert.deepEqual([w.running, w.token], [true, 4]);
	assert.equal(s.rows('Runners').find((r) => r[0] === 'Wayne Loveridge')[4], '', 'and nothing is written to Simon\'s start time');
});
check('a newcomer added at a mile is not marked as a handicap first-timer', () => {
	const s = mileNight();
	s.api.api_addRunner(s.pin, 'Brand New', '');
	assert.equal(s.rows('Runners').find((r) => r[0] === 'Brand New')[16], 'FALSE');
});
check('the result: finishing order, whole-second times rounded up, no winner claimed', () => {
	const s = mileFinished();
	const result = asThePageSeesIt(s.api.api_result(s.pin));
	assert.deepEqual(result.rows.map((r) => [r.position, r.name, r.run]), [
		[1, 'Stewart Baker', '5:12'], [2, 'Sean Tovey', '5:40'], [3, 'Chris Cobb', '6:36'], [undefined, 'Lisa Palmer', ''],
	]);
	assert.equal(result.rows.filter((r) => r.winner).length, 0);
	assert.deepEqual(result.problems, ['Position 4 (7:01 on the clock) has no runner against it']);
	assert.ok(!JSON.stringify(result).includes('undefined'));
});
check('saving goes to Race history and never to the handicap\'s History', () => {
	const s = mileFinished();
	const handicapRows = s.rows('History').length;
	const simon = JSON.stringify(s.rows('Runners').map((r) => r[4]));
	assert.throws(() => s.api.api_saveRace(s.pin), /There is 1 thing to sort out first/);
	const done = s.api.api_saveRace(s.pin, true);
	assert.deepEqual([done.saved, done.winner], [4, '']);
	assert.equal(s.rows('History').length, handicapRows, 'a mile must not feed the 5k suggestions');
	assert.equal(JSON.stringify(s.rows('Runners').map((r) => r[4])), simon, 'nor touch Simon\'s start times');
	const saved = s.rows('Race history').slice(1);
	assert.deepEqual(saved.map((r) => [r[1], r[2], r[3], r[5], r[6]]), [
		['8 Dec 2026 \u2014 Mile', 'Mile', 'Stewart Baker', '5:12', '1'], ['8 Dec 2026 \u2014 Mile', 'Mile', 'Sean Tovey', '5:40', '2'],
		['8 Dec 2026 \u2014 Mile', 'Mile', 'Chris Cobb', '6:36', '3'], ['8 Dec 2026 \u2014 Mile', 'Mile', 'Lisa Palmer', '', ''],
	]);
	assert.equal(s.rows('Timing archive').length, 5);
	const state = asThePageSeesIt(s.api.api_state(s.pin));
	assert.equal(state.runners.filter((r) => r.running || r.token !== undefined).length, 0);
	assert.deepEqual([state.clockStartMs, state.finishPhone, state.finishes.length], [undefined, '', 0]);
	assert.throws(() => { s.api.api_setRunning(s.pin, 'Sean Tovey', true); s.api.api_saveRace(s.pin, true); }, /already in Race history/);
});

console.log('\nChoosing tonight\'s race on the page');
check('with nothing due on Events, the page is told there is no race until one is chosen', () => {
	const s = makeSheet({ ...FIELD, events: false, version: '1.2' });
	assert.equal(s.api.api_state(s.pin).race.iso, '');
	const race = s.api.api_setRace(s.pin, 'm1500');
	assert.deepEqual([race.type, race.kind, race.iso], ['m1500', 'mass', new Date().toISOString().slice(0, 10)]);
	assert.match(race.label, / \u2014 1500m$/);
});
check('a choice on the page overrides Events, and can be handed back', () => {
	const s = night();
	assert.equal(s.api.api_setRace(s.pin, 'k3').type, 'k3');
	assert.equal(s.api.api_state(s.pin).race.kind, 'mass');
	const back = s.api.api_setRace(s.pin, '');
	assert.deepEqual([back.type, back.iso], ['handicap', '2026-10-27']);
});
check('a choice left over from another day is ignored', () => {
	const s = night();
	s.api.api_setRace(s.pin, 'mile');
	s.book.sheets.Settings.put(11, 2, new Date(Date.now() - 3 * 86400000));
	assert.equal(s.api.api_state(s.pin).race.type, 'handicap');
});
check('the race cannot be changed once the clock is running or finishes are held', () => {
	const s = night();
	s.api.api_startClock(s.pin, 1000, false);
	assert.throws(() => s.api.api_setRace(s.pin, 'mile'), /Reset the clock/);
	s.api.api_resetClock(s.pin);
	assert.equal(s.api.api_setRace(s.pin, 'mile').type, 'mile');
	assert.throws(() => s.api.api_setRace(s.pin, 'marathon'), /No such race/);
});
check('saving a race chosen on the page clears the choice, so next time goes by Events again', () => {
	const s = night();
	s.api.api_setRace(s.pin, 'mile');
	s.api.api_startClock(s.pin, 1000, false);
	s.api.api_syncFinishes(s.pin, [{ id: 'a', clockSeconds: 300 }], 'p');
	s.api.api_setToken(s.pin, 'Sean Tovey', 1);
	s.api.api_saveRace(s.pin, true);
	assert.equal(s.api.api_state(s.pin).race.type, 'handicap');
	assert.equal(s.rows('History').length, 7, 'and the mile did not land in History');
});

console.log(failures ? red(`\n${failures} failed\n`) : green('\nthe handicap night checks pass\n'));
process.exit(failures ? 1 : 0);
