/**
 * The monthly handicap rules, as plain functions.
 *
 * No SpreadsheetApp, no modules, on purpose: Apps Script has no imports, so
 * setup.gs picks these up by sitting in the same project, and Node can load
 * the same file, which is how scripts/check-handicap.mjs pins the rules down.
 *
 * HOW THE NIGHT WORKS (agreed with Simon, the timer, 1 Oct 2026)
 *
 *   - Every runner has a START TIME: a predicted 5k time, in 15-second steps.
 *     Simon sets it. The sheet suggests one (suggestStartTime) and he
 *     overrides it whenever he likes.
 *   - The slowest start time goes first, on 0:00 on one clock. Everybody else
 *     GOES AT (slowest start time − their start time). Done right, everybody
 *     arrives together.
 *   - The WINNER IS THE FIRST PERSON ACROSS THE LINE. Not the best watch time
 *     minus start time: if someone is set off a few seconds early, those two
 *     disagree, and the line is what counts. Both of the first two months of
 *     the 2026 season had a different winner by the line than by the sums.
 *   - Finishing order comes from numbered tokens handed out at the line. The
 *     clock time of each finish comes from the timing page.
 *   - A runner's RUN TIME is their clock time minus their go-at time. It is
 *     what sets their next start time. Nobody needs their own watch.
 *   - A FIRST-TIMER (no handicap run before this one) races but cannot win.
 *     The first eligible runner across the line wins.
 */

var SECONDS_PER_DAY = 86400;

/** Start times move in these steps. Simon's rule: 15 seconds. */
var START_STEP_SECONDS = 15;

/** A run this much slower than the start time is an off night: ignore it. */
var OFF_NIGHT_SECONDS = 60;

/** Nobody runs this 5k in under 12 minutes: a run time below it is a mix-up. */
var MIN_PLAUSIBLE_RUN_SECONDS = 12 * 60;

/** Seconds to m:ss (or h:mm:ss), with a minus sign when negative. */
function secondsToClock(seconds) {
  if (seconds === null || seconds === undefined || !isFinite(seconds)) return '';
  var sign = seconds < 0 ? '-' : '';
  var s = Math.round(Math.abs(seconds));
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  var mm = h > 0 && m < 10 ? '0' + m : String(m);
  return sign + (h > 0 ? h + ':' : '') + mm + ':' + (sec < 10 ? '0' : '') + sec;
}

/**
 * A time as people type it, or as the sheet displays it, to seconds.
 *
 * "21:30" is 21 minutes 30 seconds, never 21 hours — this is a 5k. "0:21:30",
 * "21.30" and "-0:12" work too. Anything else is null, because "no time" and
 * "zero" must not become the same thing.
 */
function clockToSeconds(text) {
  if (text === null || text === undefined) return null;
  var s = String(text).trim().replace('.', ':');
  if (s === '') return null;
  var sign = 1;
  if (s.charAt(0) === '-') { sign = -1; s = s.slice(1); }
  var parts = s.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  for (var i = 0; i < parts.length; i += 1) {
    if (!/^\d+$/.test(parts[i])) return null;
  }
  var n = parts.map(Number);
  var total = parts.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n[0] * 60 + n[1];
  if (n[n.length - 1] >= 60) return null;
  return sign * total;
}

function roundToStep(seconds, step) {
  return Math.round(seconds / step) * step;
}

/**
 * The start time the sheet suggests for a runner's next handicap.
 *
 * `runs` is that runner's handicap history, any order:
 *   { dateIso, startSeconds (or null), runSeconds (or null: ticked, didn't finish) }
 * `latestDateIso` is the most recent handicap anybody ran.
 *
 * Simon's own practice, measured on 48 cases from Feb–Sep 2026: last run
 * time rounded to the nearest 15 s (31 of 48 within 15 s), ignoring an off
 * night, and leaving people who missed a month where they were.
 *
 * Returns { seconds, why }. seconds is null only when there is nothing to go on.
 */
function suggestStartTime(runs, latestDateIso, opts) {
  opts = opts || {};
  var step = opts.step || START_STEP_SECONDS;
  var offNight = opts.offNight === undefined ? OFF_NIGHT_SECONDS : opts.offNight;

  var sorted = runs.slice().sort(function (a, b) {
    return a.dateIso < b.dateIso ? -1 : a.dateIso > b.dateIso ? 1 : 0;
  });
  var latestStart = null;
  var lastRun = null;
  sorted.forEach(function (r) {
    if (r.startSeconds !== null && r.startSeconds !== undefined) latestStart = r.startSeconds;
    if (r.runSeconds !== null && r.runSeconds !== undefined) lastRun = r;
  });

  if (!lastRun) {
    if (latestStart === null) return { seconds: null, why: 'No times yet' };
    return { seconds: latestStart, why: 'No handicap run yet, so the latest start time carries forward' };
  }
  if (lastRun.dateIso < latestDateIso) {
    if (latestStart === null) {
      return { seconds: roundToStep(lastRun.runSeconds, step), why: 'Only run is from an earlier handicap, rounded to 15 s' };
    }
    return { seconds: latestStart, why: "Didn't run the latest handicap, so the latest start time carries forward" };
  }
  var start = lastRun.startSeconds;
  if (start === null || start === undefined) {
    return { seconds: roundToStep(lastRun.runSeconds, step), why: 'First handicap run, rounded to 15 s' };
  }
  if (lastRun.runSeconds - start > offNight) {
    return { seconds: start, why: 'Over a minute slower than their start time: an off night, start time kept' };
  }
  return { seconds: roundToStep(lastRun.runSeconds, step), why: 'Last run time, rounded to 15 s' };
}

/**
 * When each starter goes, in seconds after the first runner sets off.
 *
 * Worked from the slowest runner ACTUALLY STARTING, not the slowest on the
 * books — or the whole field waits for somebody who stayed at home.
 * `starters` is [{ name, startSeconds }]; the result is keyed by name.
 * A starter with no start time gets null: they cannot be given a start.
 */
function goAtTimes(starters, step) {
  step = step || START_STEP_SECONDS;
  var timed = starters.filter(function (s) { return s.startSeconds !== null && s.startSeconds !== undefined; });
  var out = {};
  if (timed.length === 0) {
    starters.forEach(function (s) { out[s.name] = null; });
    return out;
  }
  var slowest = Math.max.apply(null, timed.map(function (s) { return s.startSeconds; }));
  starters.forEach(function (s) {
    out[s.name] = s.startSeconds === null || s.startSeconds === undefined
      ? null
      : roundToStep(slowest - s.startSeconds, step);
  });
  return out;
}

/**
 * Starters grouped by go-at time, for whoever is calling the starts.
 * Returns [{ goAtSeconds, names: [...] }] in the order they go.
 */
function startGroups(starters, step) {
  var goAt = goAtTimes(starters, step);
  var byTime = {};
  starters.forEach(function (s) {
    var g = goAt[s.name];
    if (g === null) return;
    (byTime[g] = byTime[g] || []).push(s.name);
  });
  return Object.keys(byTime).map(Number).sort(function (a, b) { return a - b; }).map(function (g) {
    return { goAtSeconds: g, names: byTime[g].sort() };
  });
}

/**
 * The result of one handicap night.
 *
 * `starters`: [{ name, startSeconds, goAtSeconds, token, firstHandicap }]
 *   token is the finishing position on the token they were handed, or null.
 * `finishes`: [{ clockSeconds }] — one per tap on the timing page. Sorted by
 *   clock time, the first is position 1: the tokens are handed out in that
 *   same order, which is what ties a token number to a clock time.
 *
 * Returns { rows, problems }. Every starter appears in rows, finished or not,
 * so nobody is silently missing. problems lists anything a person must sort
 * out before the race is saved.
 */
function raceResult(starters, finishes) {
  var clock = finishes
    .map(function (f) { return f.clockSeconds; })
    .filter(function (c) { return c !== null && c !== undefined && isFinite(c); })
    .sort(function (a, b) { return a - b; });

  var problems = [];
  var tokenOwners = {};
  starters.forEach(function (s) {
    if (s.token === null || s.token === undefined || s.token === '') return;
    (tokenOwners[s.token] = tokenOwners[s.token] || []).push(s.name);
  });
  Object.keys(tokenOwners).forEach(function (t) {
    if (tokenOwners[t].length > 1) problems.push('Token ' + t + ' is against ' + tokenOwners[t].join(' and '));
  });
  for (var p = 1; p <= clock.length; p += 1) {
    if (!tokenOwners[p]) problems.push('Position ' + p + ' (' + secondsToClock(clock[p - 1]) + ' on the clock) has no runner against it');
  }

  var rows = starters.map(function (s) {
    var position = s.token === null || s.token === undefined || s.token === '' ? null : Number(s.token);
    var clockSeconds = position !== null && position >= 1 && position <= clock.length ? clock[position - 1] : null;
    var runSeconds = clockSeconds !== null && s.goAtSeconds !== null && s.goAtSeconds !== undefined
      ? Math.round(clockSeconds - s.goAtSeconds)
      : null;
    var note = '';
    if (position === null) note = 'No finish recorded';
    else if (clockSeconds === null) {
      note = 'Token ' + position + ' has no clock time';
      problems.push(s.name + ' has token ' + position + ', but only ' + clock.length + ' finishes were timed');
    } else if (s.goAtSeconds === null || s.goAtSeconds === undefined) {
      note = 'No start time, so no run time';
    } else if (runSeconds < MIN_PLAUSIBLE_RUN_SECONDS) {
      problems.push(s.name + "'s run time works out at " + secondsToClock(runSeconds)
        + ': check their token, or that the clock started with the first group');
    }
    return {
      position: position,
      name: s.name,
      startSeconds: s.startSeconds === undefined ? null : s.startSeconds,
      goAtSeconds: s.goAtSeconds === undefined ? null : s.goAtSeconds,
      clockSeconds: clockSeconds,
      runSeconds: runSeconds,
      vsStartSeconds: runSeconds !== null && s.startSeconds !== null && s.startSeconds !== undefined
        ? runSeconds - s.startSeconds
        : null,
      firstHandicap: !!s.firstHandicap,
      winner: false,
      note: note,
    };
  });

  var eligible = rows.filter(function (r) {
    return r.position !== null && r.clockSeconds !== null && !r.firstHandicap;
  });
  if (eligible.length) {
    var best = Math.min.apply(null, eligible.map(function (r) { return r.position; }));
    rows.forEach(function (r) {
      if (r.position === best && !r.firstHandicap) { r.winner = true; r.note = 'Winner'; }
    });
  }
  rows.forEach(function (r) {
    if (r.firstHandicap && r.position !== null && r.clockSeconds !== null) r.note = "First handicap, so can't win";
  });

  rows.sort(function (a, b) {
    if (a.position === null && b.position === null) return a.name.localeCompare(b.name, 'en-GB');
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  });
  return { rows: rows, problems: problems };
}
