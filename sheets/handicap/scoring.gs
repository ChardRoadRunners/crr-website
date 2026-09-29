/**
 * Working out who won a monthly handicap.
 *
 * Plain functions, no SpreadsheetApp, no modules. That is deliberate twice
 * over: Apps Script has no imports, so setup.gs picks these up simply by
 * sitting in the same project; and Node can load the same file, which is how
 * scripts/check-handicap.mjs pins the rules against fixtures. One copy of the
 * logic, tested before it ever reaches the club's sheet.
 *
 * THE CLUB RUNS TWO DIFFERENT RACES under one name, and nearly every mistake
 * available here comes from treating them as one:
 *
 *   5k            — a true handicap. Everyone starts at a different time,
 *                   worked out from their last 5k, slowest away first. First
 *                   across the line wins.
 *   3km, 1500m,   — not handicaps at all. Everyone starts together on the
 *   1 mile          gun, and the winner is the best age grade percentage.
 *
 * One trophy, held by whoever won the latest event until the next one.
 * There is no season points table — see docs/handicap.md.
 */

/** Seconds in a day. Google hands durations over as a fraction of one. */
var SECONDS_PER_DAY = 86400;

/**
 * A Google Sheets duration is a fraction of a day; a form's duration field
 * arrives the same way. Returns null for anything that is not a usable
 * number, because "no time" and "zero seconds" must not become the same fact.
 */
function durationToSeconds(value) {
  if (value === null || value === undefined || value === '') return null;
  var n = Number(value);
  if (!isFinite(n) || n <= 0) return null;
  return n * SECONDS_PER_DAY;
}

/** Seconds back to h:mm:ss for display. */
function secondsToClock(seconds) {
  if (seconds === null || seconds === undefined || !isFinite(seconds)) return '';
  var sign = seconds < 0 ? '-' : '';
  var s = Math.round(Math.abs(seconds));
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  var mm = h > 0 && m < 10 ? '0' + m : String(m);
  var ss = sec < 10 ? '0' + sec : String(sec);
  return sign + (h > 0 ? h + ':' : '') + mm + ':' + ss;
}

/**
 * Which way an event is decided.
 *
 * Derived from the distance, but the Events tab carries it as its own column
 * so the committee can run a handicap mile one month without anybody editing
 * code. This is only the default offered there.
 */
function defaultFormat(distance) {
  return String(distance).trim().toLowerCase() === '5k' ? 'Handicap' : 'Age graded';
}

var HANDICAP = 'handicap';
var AGE_GRADED = 'age graded';

var normalise = function (value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
};

/** Events are identified by date AND distance — the same 5k comes round monthly. */
function eventKey(dateIso, distance) {
  return normalise(dateIso) + '|' + normalise(distance).toLowerCase();
}

/**
 * The handicap a runner carries into an event.
 *
 * "Based on your 5Km time" — so it is their finish time at the most recent
 * 5k BEFORE this one. Failing that, the starting handicap typed on the Runners
 * tab: a 5k time the club already knew from before this sheet existed, which
 * counts exactly like a previous run.
 *
 * Returns null when there is neither. That runner is on their FIRST handicap:
 * the club's rule is that a first-timer runs it as a race but cannot win it,
 * and that run becomes their handicap for next time. Their start on the night
 * comes from a first-run estimate, which is a guess for the starter and never
 * used in scoring — see scoreEvent.
 *
 * `history` is every counted 5k result already known, as
 * { name, dateIso, finishSeconds }.
 */
function handicapFor(name, beforeDateIso, history, startingSeconds) {
  var key = normalise(name).toLowerCase();
  var best = null;

  for (var i = 0; i < history.length; i += 1) {
    var row = history[i];
    if (normalise(row.name).toLowerCase() !== key) continue;
    // Strictly earlier. An event cannot handicap itself.
    if (!(row.dateIso < beforeDateIso)) continue;
    if (row.finishSeconds === null || row.finishSeconds === undefined) continue;
    if (best === null || row.dateIso > best.dateIso) best = row;
  }

  if (best) return best.finishSeconds;
  return startingSeconds === null || startingSeconds === undefined ? null : startingSeconds;
}

/**
 * Start offsets for a handicap race, for whoever is running tonight.
 *
 * The slowest goes off first, on zero, and everybody else waits by the
 * difference between their handicap and theirs. If everyone runs exactly to
 * their handicap they all arrive together, which is the whole idea.
 *
 * Computed from the slowest runner ACTUALLY STARTING, not the slowest on the
 * books — if the slowest member stays at home and the sheet still uses their
 * time, every single runner waits for a person who is not there.
 */
/** Offsets are called out by a person with a stopwatch, so nearest 5 seconds. */
var OFFSET_ROUNDING_SECONDS = 5;

function startOffsets(entries) {
  var withHandicap = entries.filter(function (e) {
    return e.handicapSeconds !== null && e.handicapSeconds !== undefined;
  });
  if (withHandicap.length === 0) return entries.map(function () { return null; });

  var slowest = withHandicap.reduce(function (max, e) {
    return e.handicapSeconds > max ? e.handicapSeconds : max;
  }, -Infinity);

  return entries.map(function (e) {
    if (e.handicapSeconds === null || e.handicapSeconds === undefined) return null;
    var raw = slowest - e.handicapSeconds;
    return Math.round(raw / OFFSET_ROUNDING_SECONDS) * OFFSET_ROUNDING_SECONDS;
  });
}

/**
 * Keeps only each runner's latest submission for an event.
 *
 * Same rule as the championship: somebody who submits twice has corrected
 * themselves, and the correction is the one that counts.
 */
function latestPerRunner(entries) {
  var byName = {};
  for (var i = 0; i < entries.length; i += 1) {
    var e = entries[i];
    var key = normalise(e.name).toLowerCase();
    var seen = byName[key];
    if (!seen || Number(e.submittedAt) >= Number(seen.submittedAt)) byName[key] = e;
  }
  return Object.keys(byName).map(function (k) { return byName[k]; });
}

/**
 * Places one event.
 *
 * `event`   — { dateIso, distance, format }
 * `entries` — submissions for this event: { name, submittedAt, finishSeconds,
 *             ageGrade }
 * `runners` — the Runners tab: { name, gender, startingSeconds } (a 5k time known from before the sheet)
 * `history` — counted 5k results from earlier events, for the handicaps.
 *
 * Every row comes back, placed or not, each carrying why. A member who is not
 * in the results wants to know whether they were missed or whether their
 * submission was no good, and a blank row answers neither.
 */
function scoreEvent(event, entries, runners, history) {
  var format = normalise(event.format).toLowerCase();
  var isHandicap = format === HANDICAP;

  var byName = {};
  for (var i = 0; i < runners.length; i += 1) {
    byName[normalise(runners[i].name).toLowerCase()] = runners[i];
  }

  var rows = latestPerRunner(entries).map(function (entry) {
    var runner = byName[normalise(entry.name).toLowerCase()];
    var row = {
      name: runner ? runner.name : normalise(entry.name),
      gender: runner ? runner.gender : '',
      finishSeconds: entry.finishSeconds === undefined ? null : entry.finishSeconds,
      ageGrade: entry.ageGrade === undefined ? null : entry.ageGrade,
      handicapSeconds: null,
      offsetSeconds: null,
      sortKey: null,
      place: null,
      counts: false,
      firstRun: false,
      reason: '',
    };

    if (!runner) {
      row.reason = 'Not on the Runners tab';
      return row;
    }

    if (isHandicap) {
      row.handicapSeconds = handicapFor(
        runner.name, event.dateIso, history,
        runner.startingSeconds === undefined ? null : runner.startingSeconds
      );
      if (row.finishSeconds === null) {
        row.reason = 'No finish time';
      } else if (row.handicapSeconds === null) {
        // Club rule: a first-timer races but cannot win. The time still
        // matters: scoreAll makes it their handicap for next month.
        row.firstRun = true;
        row.reason = 'First handicap run, so not placed. This time is their handicap next month';
      } else {
        // Ordering by (finish - handicap) is exactly the finishing order: every
        // runner's elapsed time from the gun is slowest-handicap plus this, and
        // that first term is the same for everybody. It also means the result
        // does not move if a different set of people turns up.
        row.sortKey = row.finishSeconds - row.handicapSeconds;
        row.counts = true;
      }
    } else {
      if (row.ageGrade === null || !isFinite(Number(row.ageGrade)) || Number(row.ageGrade) <= 0) {
        row.reason = 'No age grade %';
      } else {
        // Negated so that, like the handicap, smallest sorts first.
        row.sortKey = -Number(row.ageGrade);
        row.counts = true;
      }
    }

    return row;
  });

  var counted = rows.filter(function (r) { return r.counts; });
  var offsets = startOffsets(counted);
  counted.forEach(function (r, i) { r.offsetSeconds = offsets[i]; });

  // Competition ranking: ties share a place and the next one skips, exactly as
  // the championship's Position column does.
  counted.forEach(function (row) {
    row.place = 1 + counted.filter(function (other) {
      return other.sortKey < row.sortKey;
    }).length;
  });

  rows.sort(function (a, b) {
    if (a.counts !== b.counts) return a.counts ? -1 : 1;
    if (a.counts) return a.sortKey - b.sortKey || a.name.localeCompare(b.name, 'en-GB');
    return a.name.localeCompare(b.name, 'en-GB');
  });

  return rows;
}

/**
 * Every event in order, each scored with the handicaps the ones before it
 * produced.
 *
 * Order matters and is the reason this is not a per-event formula: a 5k
 * handicap is last month's 5k time, so September has to be settled before
 * October can be. Events are sorted by date first so that entering an old
 * result late still feeds the right months.
 */
function scoreAll(events, entriesByEvent, runners) {
  var ordered = events.slice().sort(function (a, b) {
    return a.dateIso < b.dateIso ? -1 : a.dateIso > b.dateIso ? 1 : 0;
  });

  var history = [];
  var out = [];

  for (var i = 0; i < ordered.length; i += 1) {
    var event = ordered[i];
    var key = eventKey(event.dateIso, event.distance);
    var rows = scoreEvent(event, entriesByEvent[key] || [], runners, history);

    out.push({ event: event, rows: rows });

    // Only a 5k feeds a future handicap: a counted one, or a first run, which
    // exists precisely to set one. An age-graded mile says nothing about
    // somebody's 5k, and any other submission that did not count (no time,
    // not on the Runners tab) is not evidence of anything.
    if (normalise(event.format).toLowerCase() === HANDICAP) {
      rows.forEach(function (r) {
        if ((r.counts || r.firstRun) && r.finishSeconds !== null) {
          history.push({ name: r.name, dateIso: event.dateIso, finishSeconds: r.finishSeconds });
        }
      });
    }
  }

  return out;
}

/**
 * Every counted or first-run 5k, as handicap history. The Runners tab and the
 * start list use this to show what each runner carries into the NEXT 5k.
 */
function handicapHistory(scored) {
  var history = [];
  scored.forEach(function (s) {
    if (normalise(s.event.format).toLowerCase() !== HANDICAP) return;
    s.rows.forEach(function (r) {
      if ((r.counts || r.firstRun) && r.finishSeconds !== null) {
        history.push({ name: r.name, dateIso: s.event.dateIso, finishSeconds: r.finishSeconds });
      }
    });
  });
  return history;
}

/** Who holds the trophy: the winner of the latest event that has a result. */
function currentHolder(scored) {
  for (var i = scored.length - 1; i >= 0; i -= 1) {
    var winners = scored[i].rows.filter(function (r) { return r.place === 1; });
    if (winners.length > 0) {
      return { event: scored[i].event, winners: winners.map(function (w) { return w.name; }) };
    }
  }
  return null;
}
