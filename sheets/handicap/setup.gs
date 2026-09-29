/**
 * The monthly handicap sheet: reading the tabs, running scoring.gs, writing
 * the answers back, and making the form.
 *
 * Paste scoring.gs and this file into the sheet's Apps Script project
 * (Extensions > Apps Script), as two files side by side. Apps Script has no
 * imports; every file in a project shares one scope, which is how this file
 * calls scoreAll() without asking for it.
 *
 * WHAT RUNS WHEN
 *   - Every form submission recalculates (an installable trigger, made when
 *     the form is created).
 *   - Editing Form responses, Events or Runners recalculates (onEdit), so a
 *     result typed in by hand scores straight away.
 *   - The Start list is ordinary formulas, not script. Custom menus do not
 *     show in the Sheets phone app, and the start list is used on a phone.
 *
 * PRIVACY
 *   The membership list holds dates of birth. The only thing this file ever
 *   reads from it is Name, M or F and Status, to add new members to Runners.
 *   Nothing from it is written anywhere else.
 */

var TAB = {
  results: 'Results',
  notCounted: 'Not counted',
  events: 'Events',
  runners: 'Runners',
  startList: 'Start list',
  settings: 'Settings',
  responses: 'Form responses',
};

var RESULTS_HEADER = ['Date', 'Distance', 'Format', 'Place', 'Name', 'M or F',
  'Finish time', 'Age grade %', 'Handicap', 'Start offset'];
var NOT_COUNTED_HEADER = ['Date', 'Distance', 'Name', 'Finish time', 'Age grade %', 'Why it did not count'];

var Q_NAME = 'Your name';
var Q_RACE = 'Which race?';
var Q_TIME = 'Finish time';
var Q_GRADE = 'Age grade %';

/** Rows of the Start list that get tick boxes. Matches the formulas' reach. */
var START_LIST_ROWS = 299;

// ---------------------------------------------------------------------------
// Menu and triggers
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Handicap')
    .addItem('Recalculate now', 'recalculate')
    .addItem('Add new members from the membership list', 'syncRunners')
    .addSeparator()
    .addItem('Create results form', 'createForm')
    .addItem('Update form lists', 'updateFormLists')
    .addToUi();
  ensureCheckboxes_();
}

/** Simple trigger. Only edits that can change a result are worth the work. */
function onEdit(e) {
  if (!e || !e.range) return;
  var name = e.range.getSheet().getName();
  if (name === TAB.responses || name === TAB.events) {
    recalculate();
  } else if (name === TAB.runners && e.range.getColumn() <= 4) {
    recalculate();
  }
}

/** Installable trigger, created by createForm. */
function onFormSubmitted() {
  recalculate();
}

// ---------------------------------------------------------------------------
// Reading the tabs
// ---------------------------------------------------------------------------

/**
 * A time as the sheet displays it ("0:52:47", "24:31") to seconds.
 *
 * Read from the DISPLAYED text on purpose: Apps Script hands duration cells
 * over as Date objects pinned to 1899, shifted by the sheet's time zone, and
 * that is a worse thing to reason about than the text a person can see.
 *
 * Someone typing "24:30" meaning 24 minutes gets 24 HOURS from Sheets. No 5k
 * takes three hours, so a whole number of minutes over that is read as
 * minutes and seconds instead.
 */
function parseClock_(text) {
  var s = String(text === null || text === undefined ? '' : text).trim();
  if (s === '') return null;
  var parts = s.split(':').map(function (p) { return Number(p); });
  if (parts.some(function (n) { return !isFinite(n) || n < 0; })) return null;
  var seconds = parts.reduce(function (acc, p) { return acc * 60 + p; }, 0);
  if (seconds >= 3 * 3600 && seconds % 60 === 0) seconds = seconds / 60;
  return seconds > 0 ? seconds : null;
}

/** "62.45", "62.45%" or 0.6245 all mean 62.45. */
function parseAgeGrade_(text) {
  var s = String(text === null || text === undefined ? '' : text).replace('%', '').trim();
  if (s === '') return null;
  var n = Number(s);
  if (!isFinite(n) || n <= 0) return null;
  return n < 1.5 ? n * 100 : n;
}

function isoDate_(date, tz) {
  return Utilities.formatDate(date, tz, 'yyyy-MM-dd');
}

/** The label a race has in the form's dropdown and in Form responses. */
function eventLabel_(date, distance, tz) {
  return Utilities.formatDate(date, tz, 'd MMM yyyy') + ' — ' + String(distance).trim();
}

function normaliseLabel_(s) {
  return String(s).replace(/\s+/g, ' ').replace(/[–-]/g, '—').trim().toLowerCase();
}

function bodyRows_(sheet, columns) {
  if (!sheet || sheet.getLastRow() < 2) return { values: [], display: [] };
  var range = sheet.getRange(2, 1, sheet.getLastRow() - 1, columns);
  return { values: range.getValues(), display: range.getDisplayValues() };
}

function readEvents_(ss) {
  var tz = ss.getSpreadsheetTimeZone();
  var rows = bodyRows_(ss.getSheetByName(TAB.events), 3).values;
  var events = [];
  rows.forEach(function (r) {
    if (!(r[0] instanceof Date) || String(r[1]).trim() === '') return;
    events.push({
      dateIso: isoDate_(r[0], tz),
      distance: String(r[1]).trim(),
      format: String(r[2]).trim() || defaultFormat(r[1]),
      label: eventLabel_(r[0], r[1], tz),
      date: r[0],
    });
  });
  return events;
}

function readRunners_(ss) {
  var data = bodyRows_(ss.getSheetByName(TAB.runners), 4);
  var runners = [];
  data.values.forEach(function (r, i) {
    var name = String(r[0]).trim();
    if (name === '') return;
    runners.push({
      name: name,
      gender: String(r[1]).trim(),
      startingSeconds: parseClock_(data.display[i][2]),
      estimateSeconds: parseClock_(data.display[i][3]),
    });
  });
  return runners;
}

/** Form responses: Timestamp · Your name · Which race? · Finish time · Age grade % */
function readResponses_(ss) {
  var sheet = ss.getSheetByName(TAB.responses);
  if (!sheet) return [];
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var col = function (title) { return header.indexOf(title); };
  var at = { stamp: 0, name: col(Q_NAME), race: col(Q_RACE), time: col(Q_TIME), grade: col(Q_GRADE) };

  var data = bodyRows_(sheet, header.length);
  var out = [];
  data.values.forEach(function (r, i) {
    var name = at.name >= 0 ? String(r[at.name]).trim() : '';
    var race = at.race >= 0 ? String(r[at.race]).trim() : '';
    if (name === '' && race === '') return;
    var stamp = r[at.stamp] instanceof Date ? r[at.stamp].getTime() : i;
    out.push({
      name: name,
      raceLabel: race,
      submittedAt: stamp,
      finishSeconds: at.time >= 0 ? parseClock_(data.display[i][at.time]) : null,
      ageGrade: at.grade >= 0 ? parseAgeGrade_(data.display[i][at.grade]) : null,
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Recalculating
// ---------------------------------------------------------------------------

function recalculate() {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return;
  try {
    recalculate_(SpreadsheetApp.getActiveSpreadsheet());
  } finally {
    lock.releaseLock();
  }
}

function recalculate_(ss) {
  var events = readEvents_(ss);
  var runners = readRunners_(ss);
  var responses = readResponses_(ss);

  var byLabel = {};
  events.forEach(function (e) { byLabel[normaliseLabel_(e.label)] = e; });

  var entriesByEvent = {};
  var strays = [];
  responses.forEach(function (r) {
    var event = byLabel[normaliseLabel_(r.raceLabel)];
    if (!event) {
      strays.push(r);
      return;
    }
    var key = eventKey(event.dateIso, event.distance);
    (entriesByEvent[key] = entriesByEvent[key] || []).push(r);
  });

  var scored = scoreAll(events, entriesByEvent, runners);

  writeResults_(ss, scored);
  writeNotCounted_(ss, scored, strays);
  writeCurrentHandicaps_(ss, scored, runners);
  ensureCheckboxes_();
}

function newestFirst_(scored) {
  return scored.slice().sort(function (a, b) {
    return a.event.dateIso < b.event.dateIso ? 1 : a.event.dateIso > b.event.dateIso ? -1 : 0;
  });
}

function writeTable_(sheet, header, rows) {
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  var last = sheet.getMaxRows();
  if (last > 1) sheet.getRange(2, 1, last - 1, header.length).clearContent();
  if (rows.length > 0) {
    if (rows.length + 1 > last) sheet.insertRowsAfter(last, rows.length + 1 - last);
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  }
}

function clockOrBlank_(seconds) {
  return seconds === null || seconds === undefined ? '' : secondsToClock(seconds);
}

function writeResults_(ss, scored) {
  var rows = [];
  newestFirst_(scored).forEach(function (s) {
    var handicap = normalise(s.event.format).toLowerCase() === HANDICAP;
    s.rows.filter(function (r) { return r.counts; }).forEach(function (r) {
      rows.push([
        s.event.dateIso,
        s.event.distance,
        s.event.format,
        r.place,
        r.name,
        r.gender,
        clockOrBlank_(r.finishSeconds),
        r.ageGrade === null ? '' : Math.round(r.ageGrade * 100) / 100,
        handicap ? clockOrBlank_(r.handicapSeconds) : '',
        handicap ? clockOrBlank_(r.offsetSeconds) : '',
      ]);
    });
  });
  var sheet = ss.getSheetByName(TAB.results);
  // Text, so "2026-09-29" and "24:31" reach the website exactly as written.
  sheet.getRange(1, 1, sheet.getMaxRows(), RESULTS_HEADER.length).setNumberFormat('@');
  writeTable_(sheet, RESULTS_HEADER, rows);
}

function writeNotCounted_(ss, scored, strays) {
  var rows = [];
  newestFirst_(scored).forEach(function (s) {
    s.rows.filter(function (r) { return !r.counts; }).forEach(function (r) {
      rows.push([s.event.dateIso, s.event.distance, r.name, clockOrBlank_(r.finishSeconds),
        r.ageGrade === null ? '' : r.ageGrade, r.reason]);
    });
  });
  strays.forEach(function (r) {
    rows.push(['', r.raceLabel, r.name, clockOrBlank_(r.finishSeconds),
      r.ageGrade === null ? '' : r.ageGrade, 'Race is not on the Events tab']);
  });
  var sheet = ss.getSheetByName(TAB.notCounted);
  sheet.getRange(1, 1, sheet.getMaxRows(), NOT_COUNTED_HEADER.length).setNumberFormat('@');
  writeTable_(sheet, NOT_COUNTED_HEADER, rows);
}

/**
 * Runners columns E and F: what each runner carries into the next 5k, and
 * where it came from. The Start list reads these. Written as real durations
 * (fractions of a day) so the Start list can do arithmetic on them.
 */
function writeCurrentHandicaps_(ss, scored, runners) {
  var sheet = ss.getSheetByName(TAB.runners);
  if (sheet.getLastRow() < 2) return;
  var names = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  var history = handicapHistory(scored);
  var byName = {};
  runners.forEach(function (r) { byName[normalise(r.name).toLowerCase()] = r; });

  var out = names.map(function (row) {
    var name = String(row[0]).trim();
    if (name === '') return ['', ''];
    var key = normalise(name).toLowerCase();
    var latest = null;
    history.forEach(function (h) {
      if (normalise(h.name).toLowerCase() !== key) return;
      if (latest === null || h.dateIso > latest.dateIso) latest = h;
    });
    if (latest) return [latest.finishSeconds / SECONDS_PER_DAY, latest.dateIso];
    var runner = byName[key];
    if (runner && runner.startingSeconds !== null) {
      return [runner.startingSeconds / SECONDS_PER_DAY, 'Starting handicap'];
    }
    return ['', 'First run next time'];
  });

  sheet.getRange(1, 5, 1, 2).setValues([['Current handicap', 'From']]);
  var target = sheet.getRange(2, 5, out.length, 2);
  target.setValues(out);
  sheet.getRange(2, 5, out.length, 1).setNumberFormat('[m]:ss');
}

/** The Start list's Running? column, as tick boxes, as far as the runners go. */
function ensureCheckboxes_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TAB.startList);
  if (!sheet) return;
  var range = sheet.getRange(2, 2, START_LIST_ROWS, 1);
  var rule = range.getDataValidation();
  if (!rule || rule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
    range.insertCheckboxes();
  }
}

// ---------------------------------------------------------------------------
// The membership list
// ---------------------------------------------------------------------------

/**
 * Adds anybody on the membership list who is not on Runners yet, at the
 * bottom so nobody's tick on the Start list moves. Lapsed members are left
 * out. Reads Name, M or F and Status only.
 */
function syncRunners() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var id = String(ss.getSheetByName(TAB.settings).getRange('B2').getValue()).trim();
  if (id === '') {
    ui.alert('Put the membership list\'s file ID in Settings, cell B2, first.');
    return;
  }
  var members = SpreadsheetApp.openById(id).getSheetByName('Members');
  if (!members || members.getLastRow() < 2) {
    ui.alert('The membership list has no Members tab, or it is empty.');
    return;
  }
  var header = members.getRange(1, 1, 1, members.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var iName = header.indexOf('Name');
  var iGender = header.indexOf('M or F');
  var iStatus = header.indexOf('Status');
  var rows = members.getRange(2, 1, members.getLastRow() - 1, header.length).getValues();

  var runners = ss.getSheetByName(TAB.runners);
  var have = {};
  if (runners.getLastRow() >= 2) {
    runners.getRange(2, 1, runners.getLastRow() - 1, 1).getValues().forEach(function (r) {
      have[normalise(r[0]).toLowerCase()] = true;
    });
  }

  var added = [];
  rows.forEach(function (r) {
    var name = normalise(r[iName]);
    if (name === '' || have[name.toLowerCase()]) return;
    if (iStatus >= 0 && String(r[iStatus]).trim().toLowerCase() === 'lapsed') return;
    added.push([name, iGender >= 0 ? String(r[iGender]).trim() : '']);
    have[name.toLowerCase()] = true;
  });

  if (added.length > 0) {
    runners.getRange(runners.getLastRow() + 1, 1, added.length, 2).setValues(added);
    recalculate();
  }
  ui.alert(added.length === 0 ? 'Runners is already up to date.'
    : 'Added ' + added.length + ': ' + added.map(function (a) { return a[0]; }).join(', ') +
      '\n\nRun Handicap → Update form lists so they appear on the form.');
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

function createForm() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  if (ss.getFormUrl()) {
    ui.alert('This sheet already has a form:\n\n' + ss.getFormUrl());
    return;
  }
  ss.setSpreadsheetTimeZone('Europe/London');

  var form = FormApp.create('CRR Monthly Handicap');
  form.setDescription(
      'Ran the monthly handicap? Put your result in here.\n' +
      'Made a mistake? Just submit again: only your latest entry for each race counts.')
    .setCollectEmail(false)
    .setShowLinkToRespondAgain(true)
    .setConfirmationMessage('Thanks! Your result is in.');

  form.addListItem().setTitle(Q_NAME).setRequired(true)
    .setHelpText('Not on the list? Tell whoever is doing the results tonight.');
  form.addListItem().setTitle(Q_RACE).setRequired(true);
  form.addDurationItem().setTitle(Q_TIME).setRequired(true)
    .setHelpText('Your own watch time, from your own start.');
  form.addTextItem().setTitle(Q_GRADE).setRequired(false)
    .setHelpText('Only for the 3km, 1500m and mile, which are won on age grade. Just the number, e.g. 62.45')
    .setValidation(FormApp.createTextValidation()
      .requireNumberBetween(0, 100)
      .setHelpText('Just the number, e.g. 62.45')
      .build());

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  renameResponsesTab_(ss, form.getId());

  ScriptApp.newTrigger('onFormSubmitted').forSpreadsheet(ss).onFormSubmit().create();
  updateFormLists();

  ui.alert('Form created.\n\nShare this link in the WhatsApp group (not on the website):\n' +
    form.getPublishedUrl() + '\n\nEdit the form here:\n' + form.getEditUrl());
}

function renameResponsesTab_(ss, formId) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var url = sheets[i].getFormUrl();
    if (url && url.indexOf(formId) !== -1) {
      sheets[i].setName(TAB.responses);
      return;
    }
  }
  SpreadsheetApp.getUi().alert('The form is linked, but rename its new tab to exactly: ' + TAB.responses);
}

function updateFormLists() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var url = ss.getFormUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert('No form yet. Use Handicap → Create results form first.');
    return;
  }
  var form = FormApp.openByUrl(url);
  var find = function (title) {
    var items = form.getItems();
    for (var i = 0; i < items.length; i++) if (items[i].getTitle() === title) return items[i];
    throw new Error('Could not find "' + title + '" on the form. Has a question been renamed?');
  };

  var names = readRunners_(ss).map(function (r) { return r.name; })
    .sort(function (a, b) { return a.localeCompare(b, 'en-GB'); });
  find(Q_NAME).asListItem().setChoiceValues(names);

  // Newest first, and only the last six: nobody submits for a race from
  // last year, and a long list on a phone is how the wrong one gets picked.
  var labels = readEvents_(ss)
    .sort(function (a, b) { return a.dateIso < b.dateIso ? 1 : -1; })
    .slice(0, 6)
    .map(function (e) { return e.label; });
  find(Q_RACE).asListItem().setChoiceValues(labels);

  ss.toast(names.length + ' runners and ' + labels.length + ' races on the form.', 'Form updated');
}
