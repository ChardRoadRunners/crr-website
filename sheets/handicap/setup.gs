/**
 * The handicap sheet's script: the timing page, and saving a night's result.
 *
 * Paste into the sheet's Apps Script project (Extensions > Apps Script) as
 * three files side by side: scoring.gs, this file, and timing.html (an HTML
 * file, named exactly "timing"). Apps Script has no imports; every file shares
 * one scope, which is how this file calls raceResult() from scoring.gs.
 *
 * WHAT DOES WHAT
 *   - The tabs are formulas. Runners works out everyone's suggested start
 *     time; Start list and This race are live views. None of that needs this
 *     script, so it all works in the Sheets phone app.
 *   - The timing page (doGet) is the phone tool for the night: tick who's
 *     running, start the clock, call the starts, tap each finisher, match the
 *     tokens, check the result, save it.
 *   - Saving a race writes History. History is what every suggestion, the
 *     runner form and the website's Results tab read from.
 *
 * DEPLOYING THE PAGE
 *   Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *   Every call checks the PIN on the Settings tab, so the link alone is not
 *   enough to change anything. Share the link with the timers only, never on
 *   the website.
 *
 *   After pasting a newer version of these files, the link keeps serving the
 *   OLD code until the deployment is moved on: Deploy > Manage deployments >
 *   the pencil > Version: New version > Deploy. The link itself stays the same.
 *
 * VERSION 1.2 (November 2026) needs three things the sheet did not have: a
 * "first time" tick column on Runners, a Timing archive tab, and one more row
 * on Settings. upgradeLayout_ adds them, once, the first time the timing page
 * or the sheet is opened after the new code is pasted in. It also rewrites
 * three formulas, which are written out in full there so that the repository
 * holds them and not only the sheet.
 */

var TAB = {
  runners: 'Runners',
  timing: 'Timing',
  history: 'History',
  settings: 'Settings',
  startList: 'Start list',
  archive: 'Timing archive',
};

/** Runners columns, 1-based. Inputs first, worked-out columns after. */
var COL = {
  name: 1, mf: 2, running: 3, token: 4, simonStart: 5, simonNote: 6,
  useStart: 7, suggested: 8, why: 9, handicapsRun: 12, firstHandicap: 16, firstTime: 17,
};
var RUNNERS_LAST_ROW = 300;
var RUNNERS_WIDTH = 17;

/** Settings, column B. */
var SET = { raceDate: 2, raceLabel: 3, step: 4, offNight: 5, pin: 6, clockStart: 7, link: 8, firstGroup: 9 };

/** What goes in Simon's start time for somebody who is not racing tonight. */
var GUEST = 'Guest';

/** Column A of the Timing tab for a tap the timer took back. */
var REMOVED = 'Removed';

var FIRST_HANDICAP_HEADER = 'First handicap next time?';
var FIRST_TIME_HEADER = 'First time? (the timer ticks this)';
var ARCHIVE_HEADER = ['Date', 'Race', 'Position', 'Clock time', 'Clock (seconds)', 'Runner', 'What happened',
  'Tap ID', 'Recorded at'];

var TIMING_HEADER = ['Position', 'Clock time', 'Clock (seconds)', 'Tap ID', 'Recorded at'];
var HISTORY_HEADER = ['Date', 'Race', 'Runner', 'Start time', 'Run time', 'Position', 'Winner',
  'First handicap', 'Go at', 'Clock time', 'Note'];

// ---------------------------------------------------------------------------
// Menu, page, old trigger
// ---------------------------------------------------------------------------

function onOpen() {
  try { ensureLayout_(); } catch (e) { /* the menu must still appear; the timing page will say what is wrong */ }
  SpreadsheetApp.getUi()
    .createMenu('Handicap')
    .addItem('Timing page link', 'showTimingLink')
    .addSeparator()
    .addItem('Save this race to History', 'saveRaceFromMenu')
    .addItem('Clear the timing for this race', 'clearTimingFromMenu')
    .addToUi();
}

/**
 * The September 2026 version of this sheet made a results form with an
 * installable trigger pointing here. Results no longer come from a form, so
 * this does nothing; it exists so that trigger can't throw if it still fires.
 * Delete the trigger (Apps Script > Triggers) when convenient.
 */
function onFormSubmitted() {}

function doGet() {
  return HtmlService.createTemplateFromFile('timing')
    .evaluate()
    .setTitle('CRR handicap timing')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

/**
 * Shows the link typed on Settings. ScriptApp.getService().getUrl() is no use
 * here: from a bound script it can return a link to a different deployment,
 * one that only works for the owner (found 1 Oct 2026). So the link is copied
 * from Deploy > Manage deployments onto Settings by hand.
 */
function showTimingLink() {
  var ui = SpreadsheetApp.getUi();
  var url = String(sheet_(TAB.settings).getRange(SET.link, 2).getDisplayValue() || '').trim();
  if (!url) {
    ui.alert('No timing page link on the Settings tab yet.\n\nDeploy > Manage deployments, copy the Web app URL '
      + '(execute as Me, access Anyone), and paste it into Settings, "Timing page link".');
    return;
  }
  ui.alert('Timing page\n\n' + url + '\n\nIt asks for the PIN on Settings. '
    + 'Share it with the timers only, never on the website.');
}

// ---------------------------------------------------------------------------
// Reading the sheet
// ---------------------------------------------------------------------------

function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('The ' + name + ' tab is missing');
  return sh;
}

function settings_() {
  var sh = sheet_(TAB.settings);
  var values = sh.getRange(1, 2, 10, 1).getValues().map(function (r) { return r[0]; });
  var display = sh.getRange(1, 2, 10, 1).getDisplayValues().map(function (r) { return r[0]; });
  var date = values[SET.raceDate - 1];
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return {
    raceDate: date instanceof Date ? date : null,
    raceIso: date instanceof Date ? Utilities.formatDate(date, tz, 'yyyy-MM-dd') : '',
    raceLabel: display[SET.raceLabel - 1],
    step: Number(values[SET.step - 1]) || START_STEP_SECONDS,
    pin: String(display[SET.pin - 1] || '').trim(),
    clockStartMs: Number(values[SET.clockStart - 1]) || null,
    firstGroupStartSeconds: clockToSeconds(display[SET.firstGroup - 1]),
  };
}

function checkPin_(pin) {
  var want = settings_().pin;
  if (!want) throw new Error('No PIN is set. Put one on the Settings tab first.');
  if (String(pin || '').trim() !== want) throw new Error('Wrong PIN');
}

/** Every runner, with what the sheet has worked out for them. */
function runners_() {
  var sh = sheet_(TAB.runners);
  var range = sh.getRange(2, 1, RUNNERS_LAST_ROW - 1, RUNNERS_WIDTH);
  var values = range.getValues();
  var display = range.getDisplayValues();
  var out = [];
  for (var i = 0; i < values.length; i += 1) {
    var name = String(values[i][COL.name - 1] || '').trim();
    if (!name) continue;
    var token = values[i][COL.token - 1];
    var guest = isGuest_(display[i][COL.simonStart - 1]);
    out.push({
      row: i + 2,
      name: name,
      running: values[i][COL.running - 1] === true,
      token: token === '' || token === null ? null : Number(token),
      // A guest has no start time as far as the race is concerned.
      startSeconds: guest ? null : clockToSeconds(display[i][COL.useStart - 1]),
      guest: guest,
      // Nothing in History. Only these runners are offered the "first time" tick.
      noData: Number(values[i][COL.handicapsRun - 1]) === 0,
      // The sheet's own answer: nothing in History AND the timer's tick.
      firstHandicap: values[i][COL.firstHandicap - 1] === true,
      simonNote: String(values[i][COL.simonNote - 1] || ''),
    });
  }
  return out;
}

function isGuest_(text) {
  return String(text || '').trim().toLowerCase() === GUEST.toLowerCase();
}

function findRunner_(name) {
  var key = String(name || '').trim().toLowerCase();
  var match = runners_().filter(function (r) { return r.name.toLowerCase() === key; })[0];
  if (!match) throw new Error('No runner called ' + name + ' on the Runners tab');
  return match;
}

/**
 * Every tap on the Timing tab, including the ones the timer took back. Those
 * sit below the finishes with "Removed" where the position would be, so the
 * This race tab, which looks positions up by number, never sees them.
 */
function taps_() {
  var sh = sheet_(TAB.timing);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, TIMING_HEADER.length).getValues()
    .filter(function (r) { return r[2] !== '' && r[2] !== null; })
    .map(function (r) {
      return {
        id: String(r[3]), clockSeconds: Number(r[2]), recordedAt: r[4],
        removed: String(r[0]).trim().toLowerCase() === REMOVED.toLowerCase(),
      };
    });
}

/** The finishes that count. */
function finishes_() {
  return taps_().filter(function (f) { return !f.removed; });
}

function clearTiming_() {
  var timing = sheet_(TAB.timing);
  if (timing.getLastRow() >= 2) timing.getRange(2, 1, timing.getLastRow() - 1, TIMING_HEADER.length).clearContent();
  var set = sheet_(TAB.settings);
  set.getRange(SET.clockStart, 2).clearContent();
  set.getRange(SET.firstGroup, 2).clearContent();
}

function starters_(runners, step) {
  var running = runners.filter(function (r) { return r.running; });
  var goAt = goAtTimes(running.map(function (r) { return { name: r.name, startSeconds: r.startSeconds }; }), step);
  return running.map(function (r) {
    return {
      name: r.name, startSeconds: r.startSeconds, goAtSeconds: goAt[r.name],
      token: r.token, firstHandicap: r.firstHandicap, noData: r.noData, guest: r.guest,
    };
  });
}

function result_(s, runners) {
  return raceResult(starters_(runners, s.step), finishes_(), { firstGroupStartSeconds: s.firstGroupStartSeconds });
}

function withLock_(fn) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) throw new Error('The sheet is busy. Try again in a moment.');
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------------------------------------------------------------------------
// The timing page's calls. Every one checks the PIN first.
// ---------------------------------------------------------------------------

/**
 * A WARNING ABOUT BLANKS. Apps Script does not reliably deliver null to the
 * page: a property that is null here can arrive there missing altogether
 * (undefined). On 27 Oct 2026 one runner with no start time arrived that way,
 * the page only tested for null, and the Start tab put every runner in one
 * group. The page now tidies what it receives (see timing.html); don't rely on
 * a null surviving the trip.
 */
function api_state(pin) {
  checkPin_(pin);
  ensureLayout_();
  var s = settings_();
  var runners = runners_();
  return {
    race: { iso: s.raceIso, label: s.raceLabel },
    step: s.step,
    clockStartMs: s.clockStartMs,
    finishes: taps_().map(function (f) { return { id: f.id, clockSeconds: f.clockSeconds, removed: f.removed }; }),
    runners: runners.map(function (r) {
      return {
        name: r.name, running: r.running, token: r.token, startSeconds: r.startSeconds,
        firstHandicap: r.firstHandicap, noData: r.noData, guest: r.guest,
      };
    }),
  };
}

function api_setRunning(pin, name, running) {
  checkPin_(pin);
  return withLock_(function () {
    var r = findRunner_(name);
    var sh = sheet_(TAB.runners);
    sh.getRange(r.row, COL.running).setValue(running === true);
    if (running !== true) sh.getRange(r.row, COL.token).clearContent();
    return true;
  });
}

/** The timer's "first time" tick. Only means anything for a runner with nothing in History. */
function api_setFirstTime(pin, name, firstTime) {
  checkPin_(pin);
  return withLock_(function () {
    var r = findRunner_(name);
    sheet_(TAB.runners).getRange(r.row, COL.firstTime).setValue(firstTime === true);
    return true;
  });
}

/**
 * Somebody who ran without being ticked, picked on the Tokens tab: tick them,
 * give them the token, and either the start time they went off on or "guest".
 * One call, so a lost signal can't leave them half added.
 */
function api_addLate(pin, name, startText, position) {
  checkPin_(pin);
  var start = String(startText || '').trim();
  var guest = isGuest_(start);
  if (!guest && clockToSeconds(start) === null) {
    throw new Error('Type the start time they went off on, like 24:30, or choose Guest');
  }
  var p = Number(position);
  if (!(p >= 1)) throw new Error('No token number');
  return withLock_(function () {
    var r = findRunner_(name);
    var sh = sheet_(TAB.runners);
    runners_().forEach(function (other) {
      if (other.token === p && other.row !== r.row) sh.getRange(other.row, COL.token).clearContent();
    });
    sh.getRange(r.row, COL.simonStart).setNumberFormat('@').setValue(guest ? GUEST : start);
    sh.getRange(r.row, COL.running).setValue(true);
    sh.getRange(r.row, COL.token).setValue(p);
    SpreadsheetApp.flush();
    return true;
  });
}

/** A newcomer on the night: added at the bottom, ticked, with a guessed start time. */
function api_addRunner(pin, name, startText) {
  checkPin_(pin);
  name = String(name || '').replace(/\s+/g, ' ').trim();
  if (!name) throw new Error('Type a name');
  var start = String(startText || '').trim();
  if (start && clockToSeconds(start) === null) throw new Error('Start time should look like 24:30');
  return withLock_(function () {
    var existing = runners_().filter(function (r) { return r.name.toLowerCase() === name.toLowerCase(); })[0];
    if (existing) throw new Error(name + ' is already on the list');
    var sh = sheet_(TAB.runners);
    var names = sh.getRange(2, COL.name, RUNNERS_LAST_ROW - 1, 1).getValues();
    var row = 0;
    for (var i = 0; i < names.length; i += 1) { if (String(names[i][0]).trim() === '') { row = i + 2; break; } }
    if (!row) throw new Error('The Runners tab is full');
    sh.getRange(row, COL.name).setValue(name);
    sh.getRange(row, COL.running).setValue(true);
    // Added on the night as somebody new, so the "first time" tick starts on.
    sh.getRange(row, COL.firstTime).setValue(true);
    if (start) sh.getRange(row, COL.simonStart).setNumberFormat('@').setValue(start);
    SpreadsheetApp.flush();
    return true;
  });
}

/** Simon's start time for a runner (blank to go back to the suggestion, "Guest" for not racing). */
function api_setStartTime(pin, name, startText) {
  checkPin_(pin);
  var start = String(startText || '').trim();
  if (isGuest_(start)) start = GUEST;
  else if (start && clockToSeconds(start) === null) throw new Error('Start time should look like 24:30, or Guest');
  return withLock_(function () {
    var r = findRunner_(name);
    sheet_(TAB.runners).getRange(r.row, COL.simonStart).setNumberFormat('@').setValue(start);
    SpreadsheetApp.flush();
    return true;
  });
}

/**
 * Records when the clock started. Won't overwrite a running clock unless asked.
 * Also notes who the first group was at that moment (their start time), so the
 * result can say if 0:00 has since moved under everybody.
 */
function api_startClock(pin, epochMs, force) {
  checkPin_(pin);
  return withLock_(function () {
    var set = sheet_(TAB.settings);
    var cell = set.getRange(SET.clockStart, 2);
    var current = Number(cell.getValue()) || null;
    if (current && !force) return current;
    cell.setValue(epochMs || '');
    var first = epochMs ? slowestStartSeconds(runners_().filter(function (r) { return r.running; })) : null;
    set.getRange(SET.firstGroup, 2).setNumberFormat('@').setValue(first === null ? '' : secondsToClock(first));
    return epochMs || null;
  });
}

/**
 * Back to "not started": no clock, no taps. For a practice or a false start.
 * Ticks and tokens stay, as with Handicap > Clear the timing for this race.
 */
function api_resetClock(pin) {
  checkPin_(pin);
  return withLock_(function () { clearTiming_(); return true; });
}

/**
 * The phone holds the full list of finishes and sends all of it every time,
 * so a lost signal or a repeated send can never double-count or drop one.
 */
function api_syncFinishes(pin, finishes) {
  checkPin_(pin);
  return withLock_(function () {
    var sh = sheet_(TAB.timing);
    var all = (finishes || [])
      .filter(function (f) { return f && isFinite(f.clockSeconds); })
      .sort(function (a, b) { return a.clockSeconds - b.clockSeconds; });
    var list = all.filter(function (f) { return !f.removed; });
    // Taps the timer took back are kept, below the finishes, so that nothing
    // tapped on the night is ever lost (27 Oct 2026: one was, for good).
    var removed = all.filter(function (f) { return f.removed; });
    // Keep the time each tap first reached the sheet.
    var firstSeen = {};
    taps_().forEach(function (f) { firstSeen[f.id] = f.recordedAt; });
    var now = new Date();
    var row = function (f, position) {
      return [position, f.clockSeconds / SECONDS_PER_DAY, Math.round(f.clockSeconds * 10) / 10, String(f.id),
        firstSeen[String(f.id)] || now];
    };
    var rows = list.map(function (f, i) { return row(f, i + 1); })
      .concat(removed.map(function (f) { return row(f, REMOVED); }));
    var last = sh.getLastRow();
    if (last >= 2) sh.getRange(2, 1, last - 1, TIMING_HEADER.length).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, TIMING_HEADER.length).setValues(rows);
    return list.length;
  });
}

function api_setToken(pin, name, position) {
  checkPin_(pin);
  return withLock_(function () {
    var r = findRunner_(name);
    var p = position === '' || position === null || position === undefined ? '' : Number(position);
    sheet_(TAB.runners).getRange(r.row, COL.token).setValue(p);
    return true;
  });
}

function api_result(pin) {
  checkPin_(pin);
  var s = settings_();
  var result = result_(s, runners_());
  return {
    race: { iso: s.raceIso, label: s.raceLabel },
    problems: result.problems,
    rows: result.rows.map(function (r) {
      return {
        position: r.position, name: r.name, winner: r.winner, firstHandicap: r.firstHandicap, note: r.note,
        run: secondsToClock(r.runSeconds), start: secondsToClock(r.startSeconds),
        vsStart: r.vsStartSeconds === null ? '' : (r.vsStartSeconds > 0 ? '+' : '') + secondsToClock(r.vsStartSeconds),
      };
    }),
  };
}

/**
 * Writes the night to History and clears the decks for next month: ticks,
 * tokens, the timing, the clock, and Simon's start times for the people who
 * ran (their new run time now drives the suggestion). His notes stay.
 */
function api_saveRace(pin, acceptProblems) {
  checkPin_(pin);
  return withLock_(function () { return saveRace_(acceptProblems === true); });
}

/**
 * `acceptProblems`: the person saving has seen the list of things to sort out
 * and wants it saved as it stands. Without that, a result with problems is
 * refused: on 27 Oct 2026 one went through with four, on an ordinary double
 * tap, and the clock times of the unclaimed positions went with it.
 */
function saveRace_(acceptProblems) {
  var s = settings_();
  if (!s.raceDate) throw new Error('No race to save: add tonight to the Events tab first');
  var runners = runners_();
  var starters = starters_(runners, s.step);
  if (!starters.length) throw new Error('Nobody is ticked as running');

  var history = sheet_(TAB.history);
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var lastRow = history.getLastRow();
  if (lastRow >= 2) {
    var dates = history.getRange(2, 1, lastRow - 1, 1).getValues();
    var already = dates.some(function (d) {
      return d[0] instanceof Date && Utilities.formatDate(d[0], tz, 'yyyy-MM-dd') === s.raceIso;
    });
    if (already) throw new Error(s.raceLabel + ' is already in History');
  }

  var result = result_(s, runners);
  if (result.problems.length && !acceptProblems) {
    throw new Error('There ' + (result.problems.length === 1 ? 'is 1 thing' : 'are ' + result.problems.length + ' things')
      + ' to sort out first. Refresh the result to see ' + (result.problems.length === 1 ? 'it' : 'them') + '.');
  }
  var asDay = function (sec) { return sec === null ? '' : sec / SECONDS_PER_DAY; };
  var rows = result.rows.map(function (r) {
    return [s.raceDate, s.raceLabel, r.name, asDay(r.startSeconds), asDay(r.runSeconds),
      r.position === null ? '' : r.position, r.winner ? true : '', r.firstHandicap ? true : '',
      asDay(r.goAtSeconds), asDay(r.clockSeconds), r.note === 'Winner' ? '' : r.note];
  });
  var start = Math.max(lastRow, 1) + 1;
  history.getRange(start, 1, rows.length, HISTORY_HEADER.length).setValues(rows);
  history.getRange(start, 1, rows.length, 1).setNumberFormat('d mmm yyyy');
  [4, 5, 9, 10].forEach(function (c) { history.getRange(start, c, rows.length, 1).setNumberFormat('[m]:ss'); });

  archiveTaps_(s, result);

  var sh = sheet_(TAB.runners);
  var ran = {};
  result.rows.forEach(function (r) { if (r.runSeconds !== null) ran[r.name] = true; });
  runners.forEach(function (r) {
    if (r.running) sh.getRange(r.row, COL.running).setValue(false);
    if (r.token !== null) sh.getRange(r.row, COL.token).clearContent();
    // "Guest" was for tonight only; a run time replaces Simon's figure.
    if (ran[r.name] || (r.running && r.guest)) sh.getRange(r.row, COL.simonStart).clearContent();
  });
  clearTiming_();
  SpreadsheetApp.flush();

  var winner = result.rows.filter(function (r) { return r.winner; })[0];
  return {
    saved: rows.length,
    label: s.raceLabel,
    winner: winner ? winner.name : '',
    problems: result.problems,
  };
}

/**
 * Every tap of the night, copied to the Timing archive before the Timing tab
 * is cleared: the finishes with whoever held the token, the positions nobody
 * claimed, and the taps the timer took back. Nothing reads this tab. It is
 * there so a clock time can still be found when a question comes up later.
 */
function archiveTaps_(s, result) {
  var taps = taps_();
  if (!taps.length) return;
  var holders = {};
  result.rows.forEach(function (r) {
    if (r.position !== null) (holders[r.position] = holders[r.position] || []).push(r.name);
  });
  var position = 0;
  var rows = taps
    .sort(function (a, b) { return (a.removed ? 1 : 0) - (b.removed ? 1 : 0) || a.clockSeconds - b.clockSeconds; })
    .map(function (f) {
      if (!f.removed) position += 1;
      var who = f.removed ? '' : (holders[position] || []).join(' and ');
      return [s.raceDate, s.raceLabel, f.removed ? '' : position, f.clockSeconds / SECONDS_PER_DAY, f.clockSeconds,
        who, f.removed ? 'Tap removed by the timer' : (who ? 'Finish' : 'Finish, nobody against it'),
        f.id, f.recordedAt || ''];
    });
  var archive = sheet_(TAB.archive);
  var start = Math.max(archive.getLastRow(), 1) + 1;
  archive.getRange(start, 1, rows.length, ARCHIVE_HEADER.length).setValues(rows);
  archive.getRange(start, 1, rows.length, 1).setNumberFormat('d mmm yyyy');
  archive.getRange(start, 4, rows.length, 1).setNumberFormat('[m]:ss.0');
  archive.getRange(start, 9, rows.length, 1).setNumberFormat('d mmm yyyy hh:mm:ss');
}

function saveRaceFromMenu() {
  var ui = SpreadsheetApp.getUi();
  ensureLayout_();
  var s = settings_();
  var preview = result_(s, runners_());
  var msg = 'Save ' + (s.raceLabel || 'this race') + ' to History?\n\nThis clears the ticks, tokens, timing and clock, '
    + "and Simon's start times for everyone who finished.";
  if (preview.problems.length) msg += '\n\nStill to sort out:\n- ' + preview.problems.join('\n- ');
  if (ui.alert(msg, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var done = withLock_(function () { return saveRace_(true); });
  ui.alert('Saved ' + done.saved + ' runners for ' + done.label + (done.winner ? '. Winner: ' + done.winner : '') + '.');
}

function clearTimingFromMenu() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Clear every finish time and the clock for this race? Ticks and tokens stay.',
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  withLock_(clearTiming_);
}

// ---------------------------------------------------------------------------
// Version 1.2: what the sheet itself needs
// ---------------------------------------------------------------------------

/** True once the sheet has everything version 1.2 reads and writes. */
function layoutIsCurrent_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var runners = sheet_(TAB.runners);
  return runners.getMaxColumns() >= COL.firstTime
    && runners.getRange(1, COL.firstTime).getValue() === FIRST_TIME_HEADER
    && !!ss.getSheetByName(TAB.archive);
}

function ensureLayout_() {
  if (layoutIsCurrent_()) return false;
  withLock_(function () { if (!layoutIsCurrent_()) upgradeLayout_(); });
  return true;
}

/**
 * Brings a version 1.1 sheet up to 1.2. Safe to run twice: every step sets
 * something to a fixed value rather than adding to what is there.
 *
 *   1. Runners gets column Q, "First time?", a tick box the timer sets.
 *   2. Runners P, "First handicap next time?", used to be "nothing in History".
 *      It becomes "nothing in History AND the timer's tick". Everything that
 *      already read column P (the This race tab, this script) follows.
 *   3. Runners G, "Start time to use", learns the word Guest.
 *   4. Start list D, the note, reads column P rather than counting History
 *      itself, so it agrees with the tick, and says Guest for a guest.
 *   5. Settings row 9 holds the first group's start time when the clock started.
 *   6. A Timing archive tab keeps every tap of every night.
 *
 * Known gap, left on purpose: the This race tab is a fallback view worked out
 * by formulas, and it does not know about guests. A guest first across the
 * line shows there as the winner. The timing page and Save to History, which
 * both go through raceResult(), get it right.
 */
function upgradeLayout_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var runners = sheet_(TAB.runners);
  var last = RUNNERS_LAST_ROW;
  if (runners.getRange(1, COL.firstHandicap).getValue() !== FIRST_HANDICAP_HEADER) {
    throw new Error('The Runners tab is not laid out as version 1.2 expects (column P should be "'
      + FIRST_HANDICAP_HEADER + '"), so nothing has been changed. Ask whoever looks after the website.');
  }

  // 1. The tick column.
  if (runners.getMaxColumns() < COL.firstTime) {
    runners.insertColumnsAfter(runners.getMaxColumns(), COL.firstTime - runners.getMaxColumns());
  }
  // Only when the column is new: inserting tick boxes over existing ones unticks them all.
  if (runners.getRange(1, COL.firstTime).getValue() !== FIRST_TIME_HEADER) {
    runners.getRange(1, COL.firstHandicap).copyFormatToRange(runners, COL.firstTime, COL.firstTime, 1, 1);
    runners.getRange(1, COL.firstTime).setValue(FIRST_TIME_HEADER)
      .setNote('Tick on the night if this really is their first handicap: a first-timer races but cannot win. '
        + 'Only matters for runners with nothing in History. The timing page shows the same tick.');
    runners.getRange(2, COL.firstTime, last - 1, 1).insertCheckboxes();
  }

  // 2. First handicap = nothing in History (L = 0) and the timer's tick (Q).
  runners.getRange(2, COL.firstHandicap).setFormula(
    '=MAP(A2:A' + last + ',L2:L' + last + ',Q2:Q' + last + ',LAMBDA(n,c,q,IF(n="","",AND(c=0,q=TRUE))))');

  // 3. Start time to use: Simon's figure, else the suggestion; "Guest" stays "Guest".
  runners.getRange(2, COL.useStart).setFormula(
    '=MAP(A2:A' + last + ',E2:E' + last + ',H2:H' + last + ',LAMBDA(n,e,h,IF(n="","",IF(TRIM(e)="",h,'
    + 'IF(LOWER(TRIM(e))="guest","' + GUEST + '",'
    + 'IFERROR(LET(t,SUBSTITUTE(TRIM(e),".",":"),IF(LEN(t)-LEN(SUBSTITUTE(t,":",""))>=2,TIMEVALUE(t),TIMEVALUE("0:"&t))),'
    + '"Check Simon\'s start time"))))))');

  // 4. The Start list's note.
  sheet_(TAB.startList).getRange(2, 4).setFormula(
    '=MAP(A2:A' + last + ',B2:B' + last + ',LAMBDA(n,b,IF(n="","",IF(b="' + GUEST + '","Guest: not racing, no run time",'
    + 'IF(NOT(ISNUMBER(b)),"No start time: set Simon\'s start time on Runners",'
    + 'IF(IFERROR(INDEX(FILTER(Runners!P2:P' + last + ',Runners!A2:A' + last + '=n),1),FALSE)=TRUE,'
    + '"First handicap: can\'t win",""))))))');

  // 5. Settings.
  var set = sheet_(TAB.settings);
  set.getRange(SET.firstGroup, 1).setValue('First group when the clock started');
  set.getRange(SET.firstGroup, 3).setValue('Written by the timing page: the slowest start time among those ticked '
    + 'when the clock was started. The result warns if it has changed since, because every run time would have moved.');
  set.getRange(SET.firstGroup, 2).setNumberFormat('@');

  // 6. The archive.
  var archive = ss.getSheetByName(TAB.archive);
  if (!archive) {
    archive = ss.insertSheet(TAB.archive, ss.getSheetByName(TAB.timing).getIndex());
    archive.getRange(1, 1, 1, ARCHIVE_HEADER.length).setValues([ARCHIVE_HEADER]).setFontWeight('bold');
    archive.setFrozenRows(1);
  }
  SpreadsheetApp.flush();
}
