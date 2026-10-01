// The monthly handicap rules, written as something that runs.
//
// sheets/handicap/scoring.gs holds the rules; the club's sheet runs the same
// file in Apps Script. This proves what the prose in docs/handicap.md claims,
// against the cases that have a plausible wrong answer:
//
//   - the winner is the FIRST ACROSS THE LINE, not the best run time minus
//     start time. In Aug and Sep 2026 those two gave different winners.
//   - a first-timer can't win; the first eligible finisher does.
//   - go-at times come from the slowest runner actually starting.
//   - a run time is clock time minus go-at time.
//   - the suggested start time follows Simon's practice: last run rounded to
//     15 s, an off night ignored, a missed month carried forward.
//
// Plain node, no framework. `npm run check:handicap`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../sheets/handicap/scoring.gs', import.meta.url), 'utf8');
const S = new Function(
  `${source}\nreturn { secondsToClock, clockToSeconds, roundToStep, suggestStartTime, goAtTimes, startGroups, raceResult };`,
)();

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

console.log('\nTimes as people type them');
check('"21:30" is 21 minutes 30, not 21 hours', () => assert.equal(S.clockToSeconds('21:30'), t(21, 30)));
check('"0:21:30", "21.30" and "-0:12" all read', () => {
	assert.equal(S.clockToSeconds('0:21:30'), t(21, 30));
	assert.equal(S.clockToSeconds('21.30'), t(21, 30));
	assert.equal(S.clockToSeconds('-0:12'), -12);
});
check('blank and nonsense are null, not zero', () => {
	assert.equal(S.clockToSeconds(''), null);
	assert.equal(S.clockToSeconds('abc'), null);
	assert.equal(S.clockToSeconds('21:75'), null);
});
check('seconds print back as m:ss', () => {
	assert.equal(S.secondsToClock(t(19, 42)), '19:42');
	assert.equal(S.secondsToClock(-33), '-0:33');
});

console.log('\nGo-at times');
check('slowest actually starting goes on 0:00', () => {
	const go = S.goAtTimes([
		{ name: 'Abbie', startSeconds: t(41, 45) },
		{ name: 'Tom', startSeconds: t(20, 15) },
		{ name: 'Alex', startSeconds: t(21, 15) },
	]);
	assert.deepEqual(go, { Abbie: 0, Tom: t(21, 30), Alex: t(20, 30) });
});
check('a start time nobody gave goes nowhere (null), and does not move anyone', () => {
	const go = S.goAtTimes([{ name: 'A', startSeconds: t(25) }, { name: 'New', startSeconds: null }]);
	assert.deepEqual(go, { A: 0, New: null });
});
check('groups come out in the order people go, names sorted', () => {
	const g = S.startGroups([
		{ name: 'Tom', startSeconds: t(20) }, { name: 'Ann', startSeconds: t(20) }, { name: 'Bob', startSeconds: t(22) },
	]);
	assert.deepEqual(g, [{ goAtSeconds: 0, names: ['Bob'] }, { goAtSeconds: 120, names: ['Ann', 'Tom'] }]);
});

console.log('\nThe result');
// September 2026, as it really went: Marek first over the line on his first
// handicap; Tom next. Tom wins.
const sept = () => {
	const starters = [
		{ name: 'Marek', startSeconds: t(20, 30), goAtSeconds: t(6), token: 1, firstHandicap: true },
		{ name: 'Tom', startSeconds: t(20, 15), goAtSeconds: t(6, 15), token: 2, firstHandicap: false },
		{ name: 'Alex', startSeconds: t(21, 15), goAtSeconds: t(5, 15), token: 3, firstHandicap: false },
		{ name: 'Sean', startSeconds: t(26, 30), goAtSeconds: 0, token: null, firstHandicap: false },
	];
	const finishes = [{ clockSeconds: t(26, 0) }, { clockSeconds: t(25, 51) }, { clockSeconds: t(26, 20) }];
	return S.raceResult(starters, finishes);
};
check('positions follow the clock: the earliest tap is position 1, whatever order they were sent', () => {
	const r = sept();
	assert.deepEqual(r.rows.filter((x) => x.position).map((x) => [x.position, x.clockSeconds]), [[1, t(25, 51)], [2, t(26, 0)], [3, t(26, 20)]]);
});
check('a first-timer over the line first does not win; the next eligible runner does', () => {
	const r = sept();
	assert.deepEqual(r.rows.filter((x) => x.winner).map((x) => x.name), ['Tom']);
	assert.equal(r.rows.find((x) => x.name === 'Marek').note, "First handicap, so can't win");
});
check('run time = clock time − go-at time', () => {
	const r = sept();
	const tom = r.rows.find((x) => x.name === 'Tom');
	assert.equal(tom.runSeconds, t(26, 0) - t(6, 15));
	assert.equal(tom.vsStartSeconds, t(19, 45) - t(20, 15));
});
check('the line beats the sums: winner is position 1 even with a worse run-vs-start', () => {
	const r = S.raceResult(
		[
			{ name: 'Katie', startSeconds: t(25, 30), goAtSeconds: t(0, 50), token: 1, firstHandicap: false },
			{ name: 'Matthew', startSeconds: t(24), goAtSeconds: t(2, 30), token: 2, firstHandicap: false },
		],
		[{ clockSeconds: t(23, 20) }, { clockSeconds: t(23, 25) }],
	);
	assert.deepEqual(r.rows.filter((x) => x.winner).map((x) => x.name), ['Katie']);
	assert.ok(r.rows[1].vsStartSeconds < r.rows[0].vsStartSeconds, 'Matthew did beat his start time by more');
});
check('everybody who started appears; no token = "No finish recorded", listed last', () => {
	const r = sept();
	assert.equal(r.rows.length, 4);
	assert.deepEqual([r.rows[3].name, r.rows[3].note], ['Sean', 'No finish recorded']);
});
check('problems: a timed position nobody holds, a token beyond the timed finishes, a shared token', () => {
	const r = S.raceResult(
		[
			{ name: 'A', startSeconds: t(20), goAtSeconds: 0, token: 1 },
			{ name: 'B', startSeconds: t(20), goAtSeconds: 0, token: 1 },
			{ name: 'C', startSeconds: t(20), goAtSeconds: 0, token: 4 },
		],
		[{ clockSeconds: 1200 }, { clockSeconds: 1210 }, { clockSeconds: 1220 }],
	);
	assert.ok(r.problems.some((p) => /Token 1 is against A and B/.test(p)));
	assert.ok(r.problems.some((p) => /Position 2 .* has no runner/.test(p)));
	assert.ok(r.problems.some((p) => /C has token 4, but only 3 finishes/.test(p)));
});
check('an impossible run time (token against the wrong runner) is flagged', () => {
	const r = S.raceResult([{ name: 'Fast', startSeconds: t(17), goAtSeconds: t(20), token: 1 }], [{ clockSeconds: t(25) }]);
	assert.ok(r.problems.some((p) => /Fast's run time works out at 5:00/.test(p)));
});
check('nobody eligible finished: no winner, no crash', () => {
	const r = S.raceResult([{ name: 'New', startSeconds: t(25), goAtSeconds: 0, token: 1, firstHandicap: true }], [{ clockSeconds: 1500 }]);
	assert.equal(r.rows.filter((x) => x.winner).length, 0);
});

console.log('\nSuggested start time');
const run = (dateIso, start, runTime) => ({ dateIso, startSeconds: start, runSeconds: runTime });
check('last run rounded to the nearest 15 s (Marek Sedlak: 19:21 → 19:15)', () => {
	const s = S.suggestStartTime([run('2026-09-29', t(20, 30), t(19, 21))], '2026-09-29');
	assert.equal(s.seconds, t(19, 15));
});
check('an off night (over a minute slow) keeps the start time (Matthew, Mar: 25:51 on 23:00)', () => {
	const s = S.suggestStartTime([run('2026-03-31', t(23), t(25, 51))], '2026-03-31');
	assert.equal(s.seconds, t(23));
	assert.match(s.why, /off night/);
});
check('missed the latest handicap: latest start time carries forward', () => {
	const s = S.suggestStartTime([run('2026-08-25', t(25, 30), t(22, 20)), run('2026-09-29', t(22), null)], '2026-09-29');
	assert.equal(s.seconds, t(22));
});
check('first handicap (no start time): the run itself, rounded', () => {
	const s = S.suggestStartTime([run('2026-08-25', null, t(21, 2))], '2026-08-25');
	assert.equal(s.seconds, t(21));
});
check('never run, but has a start time: it carries forward; nothing at all: null', () => {
	assert.equal(S.suggestStartTime([run('2026-09-29', t(23), null)], '2026-09-29').seconds, t(23));
	assert.equal(S.suggestStartTime([], '2026-09-29').seconds, null);
});
check('only run is from an earlier handicap and no start time since: rounded run', () => {
	assert.equal(S.suggestStartTime([run('2026-04-28', null, t(29, 26))], '2026-09-29').seconds, t(29, 30));
});

console.log(failures ? red(`\n${failures} failed\n`) : green('\nall handicap checks pass\n'));
process.exit(failures ? 1 : 0);
