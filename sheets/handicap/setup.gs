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
 */

var TAB = {
  runners: 'Runners',
  timing: 'Timing',
  history: 'History',
  settings: 'Settings',
};

/** Runners columns, 1-based. Inputs first, worked-out columns after. */
var COL = {
  name: 1, mf: 2, running: 3, token: 4, simonStart: 5, simonNote: 6,
  useStart: 7, suggested: 8, why: 9, firstHandicap: 16,
};
var RUNNERS_LAST_ROW = 300;
var RUNNERS_WIDTH = 16;

/** Settings, column B. */
var SET = { raceDate: 2, raceLabel: 3, step: 4, offNight: 5, pin: 6, clockStart: 7, link: 8 };

var TIMING_HEADER = ['Position', 'Clock time', 'Clock (seconds)', 'Tap ID', 'Recorded at'];
var HISTORY_HEADER = ['Date', 'Race', 'Runner', 'Start time', 'Run time', 'Position', 'Winner',
  'First handicap', 'Go at', 'Clock time', 'Note'];

// ---------------------------------------------------------------------------
// Menu, page, old trigger
// ---------------------------------------------------------------------------

function onOpen() {
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

function showTimingLink() {
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { url = ''; }
  var ui = SpreadsheetApp.getUi();
  if (!url) {
    ui.alert('The timing page is not deployed yet.\n\nDeploy > New deployment > Web app, '
      + 'execute as Me, access Anyone. Then use this menu again.');
    return;
  }
  sheet_(TAB.settings).getRange(SET.link, 2).setValue(url);
  ui.alert('Timing page\n\n' + url + '\n\nAlso saved on the Settings tab. It asks for the PIN on Settings. '
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
    out.push({
      row: i + 2,
      name: name,
      running: values[i][COL.running - 1] === true,
      token: token === '' || token === null ? null : Number(token),
      startSeconds: clockToSeconds(display[i][COL.useStart - 1]),
      firstHandicap: values[i][COL.firstHandicap - 1] === true,
      simonNote: String(values[i][COL.simonNote - 1] || ''),
    });
  }
  return out;
}

function findRunner_(name) {
  var key = String(name || '').trim().toLowerCase();
  var match = runners_().filter(function (r) { return r.name.toLowerCase() === key; })[0];
  if (!match) throw new Error('No runner called ' + name + ' on the Runners tab');
  return match;
}

function finishes_() {
  var sh = sheet_(TAB.timing);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 5).getValues()
    .filter(function (r) { return r[2] !== '' && r[2] !== null; })
    .map(function (r) { return { id: String(r[3]), clockSeconds: Number(r[2]) }; });
}

function starters_(runners, step) {
  var running = runners.filter(function (r) { return r.running; });
  var goAt = goAtTimes(running.map(function (r) { return { name: r.name, startSeconds: r.startSeconds }; }), step);
  return running.map(function (r) {
    return {
      name: r.name, startSeconds: r.startSeconds, goAtSeconds: goAt[r.name],
      token: r.token, firstHandicap: r.firstHandicap,
    };
  });
}

function withLock_(fn) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) throw new Error('The sheet is busy. Try again in a moment.');
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------------------------------------------------------------------------
// The timing page's calls. Every one checks the PIN first.
// ---------------------------------------------------------------------------

function api_state(pin) {
  checkPin_(pin);
  var s = settings_();
  var runners = runners_();
  return {
    race: { iso: s.raceIso, label: s.raceLabel },
    step: s.step,
    clockStartMs: s.clockStartMs,
    finishes: finishes_(),
    runners: runners.map(function (r) {
      return { name: r.name, running: r.running, token: r.token, startSeconds: r.startSeconds, firstHandicap: r.firstHandicap };
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
    if (start) sh.getRange(row, COL.simonStart).setNumberFormat('@').setValue(start);
    SpreadsheetApp.flush();
    return true;
  });
}

/** Simon's start time for a runner (blank to go back to the suggestion). */
function api_setStartTime(pin, name, startText) {
  checkPin_(pin);
  var start = String(startText || '').trim();
  if (start && clockToSeconds(start) === null) throw new Error('Start time should look like 24:30');
  return withLock_(function () {
    var r = findRunner_(name);
    sheet_(TAB.runners).getRange(r.row, COL.simonStart).setNumberFormat('@').setValue(start);
    SpreadsheetApp.flush();
    return true;
  });
}

/** Records when the clock started. Won't overwrite a running clock unless asked. */
function api_startClock(pin, epochMs, force) {
  checkPin_(pin);
  return withLock_(function () {
    var cell = sheet_(TAB.settings).getRange(SET.clockStart, 2);
    var current = Number(cell.getValue()) || null;
    if (current && !force) return current;
    cell.setValue(epochMs || '');
    return epochMs || null;
  });
}

/**
 * The phone holds the full list of finishes and sends all of it every time,
 * so a lost signal or a repeated send can never double-count or drop one.
 */
function api_syncFinishes(pin, finishes) {
  checkPin_(pin);
  return withLock_(function () {
    var sh = sheet_(TAB.timing);
    var list = (finishes || [])
      .filter(function (f) { return f && isFinite(f.clockSeconds); })
      .sort(function (a, b) { return a.clockSeconds - b.clockSeconds; });
    var last = sh.getLastRow();
    if (last >= 2) sh.getRange(2, 1, last - 1, TIMING_HEADER.length).clearContent();
    if (list.length) {
      var now = new Date();
      sh.getRange(2, 1, list.length, TIMING_HEADER.length).setValues(list.map(function (f, i) {
        return [i + 1, f.clockSeconds / SECONDS_PER_DAY, Math.round(f.clockSeconds * 10) / 10, String(f.id), now];
      }));
    }
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
  var result = raceResult(starters_(runners_(), s.step), finishes_());
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
function api_saveRace(pin) {
  checkPin_(pin);
  return withLock_(saveRace_);
}

function saveRace_() {
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

  var result = raceResult(starters, finishes_());
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

  var sh = sheet_(TAB.runners);
  var ran = {};
  result.rows.forEach(function (r) { if (r.runSeconds !== null) ran[r.name] = true; });
  runners.forEach(function (r) {
    if (r.running) sh.getRange(r.row, COL.running).setValue(false);
    if (r.token !== null) sh.getRange(r.row, COL.token).clearContent();
    if (ran[r.name]) sh.getRange(r.row, COL.simonStart).clearContent();
  });
  var timing = sheet_(TAB.timing);
  if (timing.getLastRow() >= 2) timing.getRange(2, 1, timing.getLastRow() - 1, TIMING_HEADER.length).clearContent();
  sheet_(TAB.settings).getRange(SET.clockStart, 2).clearContent();
  SpreadsheetApp.flush();

  var winner = result.rows.filter(function (r) { return r.winner; })[0];
  return {
    saved: rows.length,
    label: s.raceLabel,
    winner: winner ? winner.name : '',
    problems: result.problems,
  };
}

function saveRaceFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var s = settings_();
  var preview = raceResult(starters_(runners_(), s.step), finishes_());
  var msg = 'Save ' + (s.raceLabel || 'this race') + ' to History?\n\nThis clears the ticks, tokens, timing and clock, '
    + "and Simon's start times for everyone who finished.";
  if (preview.problems.length) msg += '\n\nStill to sort out:\n- ' + preview.problems.join('\n- ');
  if (ui.alert(msg, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var done = withLock_(saveRace_);
  ui.alert('Saved ' + done.saved + ' runners for ' + done.label + (done.winner ? '. Winner: ' + done.winner : '') + '.');
}

function clearTimingFromMenu() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Clear every finish time and the clock for this race? Ticks and tokens stay.',
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  withLock_(function () {
    var timing = sheet_(TAB.timing);
    if (timing.getLastRow() >= 2) timing.getRange(2, 1, timing.getLastRow() - 1, TIMING_HEADER.length).clearContent();
    sheet_(TAB.settings).getRange(SET.clockStart, 2).clearContent();
  });
}
