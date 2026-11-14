'use strict';
/* =====================================================================
   PIP Tracker – iPhone Web-App für das Primus-Inter-Pares-Coaching
   Daten liegen lokal (IndexedDB) und werden per Google Apps Script
   mit dem Coaching-Sheet synchronisiert.
   ===================================================================== */

const APP_VERSION = '1.1.0';

/* ============================ Konstanten ============================ */

const MEALS = [
  { id: 'm1', name: 'Mahlzeit 1' }, { id: 'm2', name: 'Mahlzeit 2' }, { id: 'm3', name: 'Mahlzeit 3' },
  { id: 'm4', name: 'Mahlzeit 4' }, { id: 'm5', name: 'Mahlzeit 5' }, { id: 'm6', name: 'Mahlzeit 6' },
  { id: 'pre', name: 'Pre-Workout', peri: 0 }, { id: 'intra', name: 'Intra-Workout', peri: 1 }, { id: 'post', name: 'Post-Workout', peri: 2 },
];
const MEAL_NAME = Object.fromEntries(MEALS.map(m => [m.id, m.name]));

const FEEDBACK = [
  { k: 'soreness', q: 'Muskelkater vor dem Training', short: 'MK', opts: ['Keiner', 'Früh verheilt', 'Gerade verheilt', 'Noch da'] },
  { k: 'pump', q: 'Pump', short: 'Pump', opts: ['Kaum', 'Mittel', 'Stark'] },
  { k: 'joint', q: 'Gelenkschmerz', short: 'Gelenk', opts: ['Keiner', 'Leicht', 'Mittel', 'Stark'] },
  { k: 'workload', q: 'Belastung', short: 'Last', opts: ['Zu leicht', 'Passend', 'Hart', 'Zu viel'] },
];

const DEFAULT_SIZE_LABELS = [
  'Arm rechts (Bizepspeak)', 'Arm links (Bizepspeak)', 'Oberschenkel rechts (10 cm über Knie)',
  'Oberschenkel links (10 cm über Knie)', 'Unterschenkel rechts (10 cm unter Knie)', 'Unterschenkel links (10 cm unter Knie)',
  'Bauch (Bauchnabel)', 'Brust (unteres Sternum)', 'Brust (Achsel)',
];

const DAY_FIELDS = ['weight', 'time', 'sleepH', 'sleepQ', 'digFreq', 'digQ', 'stress', 'energy', 'steps',
  'cardioType', 'cardioMin', 'posingRounds', 'posingMin', 'training', 'comment'];
const MACRO_FIELDS = ['protein', 'carbs', 'fat', 'fiber', 'fv', 'feedings'];

const DEFAULT_SETTINGS = {
  scriptUrl: '', token: '',
  targets: {
    td: { protein: 195, carbs: 300, fat: 70, fiber: 35, feedings: 4 },
    ntd: { protein: 175, carbs: 275, fat: 70, fiber: 35, feedings: 4 },
  },
  targetsSet: false,
  waterTarget: 3500, waterStep: 250, fvTarget: 600, feedingMin: 20, stepsTarget: 10000, restSec: 120,
  beginDate: null, rehaStart: null, rehaGroups: [], lastSync: 0,
};

const kcalOf = (p, c, f) => (p || 0) * 4.1 + (c || 0) * 4.1 + (f || 0) * 9.3;

/* ============================== Icons =============================== */

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  diary: svg('<path d="M5 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M7 12v9"/><path d="M17 21V3c-2.2 0-4 2.2-4 6v4h4"/>'),
  checkin: svg('<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.5V3h6v1.5"/><path d="M9 13l2 2 4-4"/>'),
  training: svg('<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>'),
  history: svg('<path d="M4 4v16h16"/><path d="M8 15l3.5-4 3 2.5L19 8"/>'),
  more: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
  sync: svg('<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  barcode: svg('<path d="M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12"/>'),
  star: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
  starFill: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  left: svg('<path d="M15 18l-6-6 6-6"/>'),
  right: svg('<path d="M9 18l6-6-6-6"/>'),
  close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  trash: svg('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.4"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  drop: svg('<path d="M12 3.5s6.5 7 6.5 11.3a6.5 6.5 0 0 1-13 0C5.5 10.5 12 3.5 12 3.5z"/>'),
  dots: svg('<circle cx="6" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18" cy="12" r="1.4" fill="currentColor"/>'),
  timer: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>'),
  edit: svg('<path d="M4 20h4L19.5 8.5l-4-4L4 16v4z"/>'),
  link: svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
  cloud: svg('<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>'),
};

/* ============================== Helfer ============================== */

const $ = (s, el = document) => el.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const fmtDay = s => { const d = parseISO(s); return `${WD[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}`; };
const fmtShort = s => { const d = parseISO(s); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; };
const fmtDateTime = ts => { const d = new Date(ts); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const clone = o => JSON.parse(JSON.stringify(o));
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isDirty = o => !!o && (o.updatedAt || 0) > (o.syncedAt || 0);

function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
function nf(n, dec = 0) {
  if (n === null || n === undefined || n === '' || isNaN(n)) return '–';
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
const fmtLoad = v => (v === null || v === undefined || v === '') ? '' : String(v).replace('.', ',');
function fmtDur(min) {
  min = Math.round(min);
  if (!min) return '';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
}
function splitList(s) {
  if (s === null || s === undefined || s === '') return [];
  return String(s).split(/\s*[\/;|]\s*/).map(x => x.trim()).filter(x => x !== '');
}
function splitReps(s) {
  if (s === null || s === undefined || s === '') return [];
  return String(s).split(/[\/;,|\s]+/).map(x => x.trim()).filter(Boolean);
}
function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
}

/* ============================ Speicher ============================== */

const DB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('pip-tracker', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  async function get(k) {
    try {
      const db = await open();
      return await new Promise((res, rej) => {
        const q = db.transaction('kv').objectStore('kv').get(k);
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      });
    } catch (e) {
      try { const v = localStorage.getItem('pip:' + k); return v ? JSON.parse(v) : undefined; } catch (e2) { return undefined; }
    }
  }
  async function set(k, v) {
    try {
      const db = await open();
      await new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(v, k);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      try { localStorage.setItem('pip:' + k, JSON.stringify(v)); } catch (e2) { /* voll */ }
    }
  }
  return { get, set };
})();

const S = {
  settings: clone(DEFAULT_SETTINGS),
  days: {}, foods: {}, favorites: [], recent: [], templates: {},
  plan: null, workouts: {}, sizes: { labels: [], entries: [] },
  supplements: [], reha: null, profile: null,
};
const STATE_KEYS = Object.keys(S);
const pendingSave = new Set();
let saveTimer = null;

function save(...keys) {
  (keys.length ? keys : STATE_KEYS).forEach(k => pendingSave.add(k));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 250);
}
async function flushSave() {
  clearTimeout(saveTimer);
  const ks = [...pendingSave];
  pendingSave.clear();
  for (const k of ks) await DB.set(k, S[k]);
}
async function loadState() {
  for (const k of STATE_KEYS) {
    const v = await DB.get(k);
    if (v !== undefined && v !== null) S[k] = v;
  }
  S.settings = Object.assign(clone(DEFAULT_SETTINGS), S.settings);
  S.settings.targets = {
    td: Object.assign({}, DEFAULT_SETTINGS.targets.td, S.settings.targets && S.settings.targets.td),
    ntd: Object.assign({}, DEFAULT_SETTINGS.targets.ntd, S.settings.targets && S.settings.targets.ntd),
  };
  if (!S.sizes || !Array.isArray(S.sizes.entries)) S.sizes = { labels: [], entries: [] };
}

/* ============================ UI-Zustand ============================ */

const ui = { tab: 'diary', date: today(), trWeek: null, trDay: null, hist: 'weight', range: 84, weeksShown: 12, syncing: false };
try { const t = localStorage.getItem('pip:tab'); if (t) ui.tab = t; } catch (e) { /* egal */ }

/* ============================ Tage & Makros ========================= */

function getDay(date, create) {
  let d = S.days[date];
  if (!d && create) d = S.days[date] = { date, foods: [], supps: {}, reha: {}, manual: {}, cleared: [] };
  if (d) { d.foods = d.foods || []; d.supps = d.supps || {}; d.reha = d.reha || {}; d.manual = d.manual || {}; d.cleared = d.cleared || []; }
  return d;
}
function touchDay(d) { d.updatedAt = Date.now(); save('days'); updateSyncBadge(); }
function setDayField(date, k, v) {
  const d = getDay(date, true);
  const empty = v === null || v === undefined || v === '';
  if (empty) { delete d[k]; if (!d.cleared.includes(k)) d.cleared.push(k); }
  else { d[k] = v; d.cleared = d.cleared.filter(x => x !== k); }
  touchDay(d);
}
function setManual(date, k, v) {
  const d = getDay(date, true);
  if (v === null || v === '') { delete d.manual[k]; if (!d.cleared.includes(k)) d.cleared.push(k); }
  else { d.manual[k] = v; d.cleared = d.cleared.filter(x => x !== k); }
  touchDay(d);
}

function macrosFor(per100, grams) {
  const g = (grams || 0) / 100;
  const p = per100 || {};
  const r = { p: (p.p || 0) * g, c: (p.c || 0) * g, f: (p.f || 0) * g, fiber: (p.fiber || 0) * g };
  r.kcal = kcalOf(r.p, r.c, r.f);
  return r;
}

function dayTotals(d) {
  const t = { p: 0, c: 0, f: 0, fiber: 0, fv: 0, kcal: 0, feedings: 0, fromFoods: false, manual: false, meals: {} };
  if (!d) return t;
  if (d.foods && d.foods.length) {
    t.fromFoods = true;
    for (const e of d.foods) {
      const m = macrosFor(e.per100, e.grams);
      t.p += m.p; t.c += m.c; t.f += m.f; t.fiber += m.fiber;
      if (e.fv) t.fv += e.grams || 0;
      const mm = t.meals[e.meal] || (t.meals[e.meal] = { p: 0, c: 0, f: 0, fiber: 0, kcal: 0, n: 0 });
      mm.p += m.p; mm.c += m.c; mm.f += m.f; mm.fiber += m.fiber; mm.kcal += m.kcal; mm.n++;
    }
    t.feedings = Object.values(t.meals).filter(m => m.p >= (S.settings.feedingMin || 20)).length;
  } else if (d.manual) {
    const m = d.manual;
    t.p = m.protein || 0; t.c = m.carbs || 0; t.f = m.fat || 0; t.fiber = m.fiber || 0; t.fv = m.fv || 0; t.feedings = m.feedings || 0;
    t.manual = ['protein', 'carbs', 'fat'].some(k => m[k] !== undefined && m[k] !== null);
  }
  t.kcal = kcalOf(t.p, t.c, t.f);
  return t;
}

function workoutOnDate(date) {
  return Object.values(S.workouts).find(w => w.date === date && (w.finishedAt || anySetDone(w))) || null;
}
function anySetDone(w) {
  return Object.values(w.rows || {}).some(r => (r.sets || []).some(s => s && s.done));
}
function dayType(date) {
  const d = S.days[date];
  if (d && d.type) return d.type;
  if (d && d.training && /\bW\d+/i.test(d.training) && /\bD\d+/i.test(d.training)) return 'td';
  return workoutOnDate(date) ? 'td' : 'ntd';
}
function targetsFor(type) {
  const t = S.settings.targets[type] || S.settings.targets.ntd;
  return Object.assign({}, t, { kcal: kcalOf(t.protein, t.carbs, t.fat) });
}
function autoTrainingLabel(date) {
  const w = workoutOnDate(date);
  return w ? `M${w.mesoNum} W${w.week} D${w.day}` : null;
}

/* ============================ Rendering ============================= */

const TITLES = { diary: 'Tagebuch', checkin: 'Check-in', training: 'Training', history: 'Verlauf', more: 'Mehr' };
const TABS = [
  { id: 'diary', label: 'Tagebuch', icon: I.diary },
  { id: 'checkin', label: 'Check-in', icon: I.checkin },
  { id: 'training', label: 'Training', icon: I.training },
  { id: 'history', label: 'Verlauf', icon: I.history },
  { id: 'more', label: 'Mehr', icon: I.more },
];

function shellHTML() {
  return `
  <header class="topbar"><h1><span id="tbTitle"></span><i class="brand-dot" aria-hidden="true"></i></h1>
    <button class="sync-btn" id="syncBtn" data-act="sync" aria-label="Mit Google Sheet synchronisieren">${I.sync}<span>Sync</span><span class="badge hidden" id="syncBadge"></span></button>
  </header>
  <main class="view" id="view"></main>
  <div class="timer" id="timer" hidden></div>
  <nav class="tabbar" aria-label="Bereiche">${TABS.map(t => `<button data-act="tab" data-v="${t.id}" id="tab-${t.id}">${t.icon}<span>${t.label}</span></button>`).join('')}</nav>
  <div id="sheets"></div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
}

const VIEWS = {
  diary: renderDiary, checkin: renderCheckin, training: renderTraining, history: renderHistory, more: renderMore,
};

function render() {
  const app = $('#app');
  if (!app.dataset.ready) { app.innerHTML = shellHTML(); app.dataset.ready = '1'; }
  $('#tbTitle').textContent = TITLES[ui.tab];
  TABS.forEach(t => $('#tab-' + t.id).classList.toggle('on', t.id === ui.tab));
  $('#view').innerHTML = VIEWS[ui.tab]();
  updateSyncBadge();
}

function pendingCount() {
  let n = 0;
  for (const d of Object.values(S.days)) if (isDirty(d)) n++;
  for (const w of Object.values(S.workouts)) if (isDirty(w)) n++;
  for (const e of S.sizes.entries) if (isDirty(e)) n++;
  return n;
}
function updateSyncBadge() {
  const b = $('#syncBadge'), btn = $('#syncBtn');
  if (!b) return;
  const n = pendingCount();
  b.textContent = n;
  b.classList.toggle('hidden', !n);
  btn.classList.toggle('spin', ui.syncing);
}

let toastTimer = null;
function toast(msg, err) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.toggle('err', !!err);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), err ? 5000 : 2600);
}

/* ------------------------------ Sheets ------------------------------ */

const sheets = [];
function openSheet(renderFn, state = {}, cls = '', onClose = null) {
  sheets.push({ render: renderFn, state, cls, onClose, fresh: true });
  drawSheets();
}
function closeSheet() {
  const s = sheets.pop();
  if (s && s.onClose) s.onClose(s.state);
  drawSheets();
}
function closeAllSheets() {
  while (sheets.length) { const s = sheets.pop(); if (s.onClose) s.onClose(s.state); }
  drawSheets();
}
function topSheet() { return sheets[sheets.length - 1]; }
function drawSheets() {
  const root = $('#sheets');
  const s = topSheet();
  document.body.classList.toggle('noscroll', !!s);
  if (!s) { root.innerHTML = ''; return; }
  root.innerHTML = `<div class="sheet-wrap ${s.cls} ${s.fresh ? 'anim' : ''}"><div class="sheet-bg" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true">${s.render(s.state)}</div></div>`;
  s.fresh = false;
  if (s.afterDraw) s.afterDraw(s.state);
}
function refreshSheet() {
  const s = topSheet();
  const el = $('#sheets .sheet');
  if (!s || !el) return;
  const sc = el.scrollTop;
  el.innerHTML = s.render(s.state);
  el.scrollTop = sc;
}
const sheetHead = (title, left = '<button class="txt-btn" data-act="closeSheet">Abbrechen</button>', right = '<span></span>') =>
  `<div class="sheet-head">${left}<h2>${esc(title)}</h2>${right}</div>`;

/* ============================== Tagebuch ============================ */

function dateNav() {
  const t = today();
  const rel = ui.date === t ? 'Heute' : ui.date === addDays(t, -1) ? 'Gestern' : ui.date === addDays(t, 1) ? 'Morgen' : '';
  return `<div class="date-nav">
    <button class="icon-btn" data-act="dayShift" data-v="-1" aria-label="Vorheriger Tag">${I.left}</button>
    <label class="date-label"><span>${rel || fmtDay(ui.date)}</span><small>${rel ? fmtDay(ui.date) : parseISO(ui.date).getFullYear()}</small>
      <input type="date" value="${ui.date}" data-ch="pickDate" aria-label="Datum wählen"></label>
    <button class="icon-btn" data-act="dayShift" data-v="1" aria-label="Nächster Tag">${I.right}</button>
  </div>`;
}

/** Zwischenüberschrift nach Styleguide: zwei Phrasen, die zweite in Signalrot. */
function headline(a, b) {
  return `<div class="headline"><span>${esc(a)}</span>${b ? `<span class="red">${esc(b)}</span>` : ''}</div>`;
}

function ring(val, target) {
  const r = 54, C = 2 * Math.PI * r;
  const pct = target ? clamp(val / target, 0, 1) : 0;
  const over = target && val > target * 1.03;
  const left = Math.round(target - val);
  return `<div class="ring ${over ? 'over' : ''}"><svg viewBox="0 0 128 128">
    <circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--fill)" stroke-width="10"/>
    ${pct > 0 ? `<circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--accent)" stroke-width="10" stroke-dasharray="${C * pct} ${C}"/>` : ''}
  </svg><div class="ring-txt"><b class="tnum">${nf(val)}</b><small>von ${nf(target)} kcal</small><small>${left >= 0 ? nf(left) + ' übrig' : nf(-left) + ' drüber'}</small></div></div>`;
}
function macroBar(label, val, target, col) {
  const pct = target ? clamp(val / target * 100, 0, 100) : 0;
  const over = target && val > target * 1.05;
  return `<div class="macro"><div class="row"><span>${label}</span><span class="tnum">${nf(val)} / ${nf(target)} g</span></div>
    <div class="bar ${over ? 'over' : ''}" style="--col:var(--${col})"><i style="width:${pct}%"></i></div></div>`;
}

function periHint(peri) {
  if (!peri) return '';
  const parts = [['P', peri.protein], ['K', peri.carbs], ['F', peri.fat]]
    .filter(([, v]) => v && v !== '-' && v !== 'FLEX')
    .map(([l, v]) => /^\d/.test(v) && !/[a-z]{3,}/i.test(v.replace(/^\d+\s*-?\s*\d*\s*(g|mg)/i, '')) ? `${l} ${v}` : v);
  return parts.length ? 'Vorgabe: ' + parts.join(' · ') : '';
}

function renderDiary() {
  const date = ui.date;
  const d = S.days[date];
  const t = dayTotals(d);
  const type = dayType(date);
  const tg = targetsFor(type);
  const peri = (S.profile && S.profile.peri) || [];
  const showWorkoutMeals = type === 'td';
  const banner = !S.settings.scriptUrl
    ? `<button class="banner" data-act="tab" data-v="more">${I.cloud}<span><b>Mit deinem Google Sheet verbinden</b><br>Unter „Mehr“ die Script-URL eintragen, dann landen alle Daten per Sync im Sheet.</span></button>` : '';
  const meals = MEALS.filter(m => !m.hasOwnProperty('peri') || showWorkoutMeals || (d && d.foods.some(e => e.meal === m.id)));
  return `${banner}${dateNav()}
  <div class="seg">
    <button class="${type === 'td' ? 'on' : ''}" data-act="setType" data-v="td">Training-Day</button>
    <button class="${type === 'ntd' ? 'on' : ''}" data-act="setType" data-v="ntd">Non-Training-Day</button>
  </div>
  <section class="card summary">
    ${ring(t.kcal, tg.kcal)}
    <div>
      ${macroBar('Protein', t.p, tg.protein, 'p')}
      ${macroBar('Kohlenhydrate', t.c, tg.carbs, 'c')}
      ${macroBar('Fett', t.f, tg.fat, 'f')}
      ${macroBar('Ballaststoffe', t.fiber, tg.fiber, 'fi')}
    </div>
    <div class="mini-stats">
      <div>Obst &amp; Gemüse<b class="tnum">${nf(t.fv)} / ${nf(S.settings.fvTarget)} g</b></div>
      <div>Protein-Feedings<b class="tnum">${t.feedings} / ${tg.feedings || '–'}</b></div>
    </div>
    ${t.manual ? '<p class="hint">Werte aus dem Sheet bzw. manuell (keine Lebensmittel eingetragen).</p>' : ''}
  </section>
  ${waterCard(d)}
  ${meals.map(m => mealCard(m, d, t, peri)).join('')}`;
}

function waterCard(d) {
  const w = (d && d.water) || 0;
  const tgt = S.settings.waterTarget || 3000;
  const step = S.settings.waterStep || 250;
  return `<section class="card water">
    <div class="water-top"><span class="lbl">${I.drop}Wasser</span><b class="tnum">${nf(w / 1000, 2)} / ${nf(tgt / 1000, 1)} L</b></div>
    <div class="bar"><i style="width:${clamp(w / tgt * 100, 0, 100)}%"></i></div>
    <div class="btns">
      <button class="btn" data-act="water" data-v="${-step}">− ${step} ml</button>
      <button class="btn" data-act="water" data-v="${step}">+ ${step} ml</button>
      <button class="btn" data-act="water" data-v="${step * 2}">+ ${step * 2} ml</button>
    </div></section>`;
}

function mealCard(m, d, t, peri) {
  const items = d ? d.foods.filter(e => e.meal === m.id) : [];
  const mm = t.meals[m.id];
  const hint = m.peri !== undefined ? periHint(peri[m.peri]) : '';
  const sub = items.length
    ? `<span class="tnum">${nf(mm.kcal)} kcal · P ${nf(mm.p)} · K ${nf(mm.c)} · F ${nf(mm.f)}</span>`
    : (hint || 'Noch nichts eingetragen');
  return `<section class="card meal">
    <div class="meal-head">
      <div><h3>${m.name}</h3><div class="sub">${sub}</div></div>
      <div class="meal-actions">
        <button class="icon-btn" data-act="mealMenu" data-meal="${m.id}" aria-label="Optionen ${m.name}">${I.dots}</button>
        <button class="add-btn" data-act="addFood" data-meal="${m.id}" aria-label="Zu ${m.name} hinzufügen">${I.plus}</button>
      </div>
    </div>
    ${items.map(foodRow).join('')}
  </section>`;
}

function foodRow(e) {
  const m = macrosFor(e.per100, e.grams);
  const amount = e.quick ? 'Schnelleintrag' : `${nf(e.grams, e.grams % 1 ? 1 : 0)} ${e.unit === 'ml' ? 'ml' : 'g'}`;
  return `<button class="food-row" data-act="editEntry" data-id="${e.id}">
    <div><div class="fname">${esc(e.name)}${e.fv ? '<span class="tag-fv">O/G</span>' : ''}</div>
    <div class="fsub tnum">${amount} · P ${nf(m.p)} · K ${nf(m.c)} · F ${nf(m.f)}</div></div>
    <div class="fkcal tnum">${nf(m.kcal)}</div></button>`;
}

/* ------------------------ Lebensmittel-Suche ------------------------ */

function allFoods() { return Object.values(S.foods).filter(f => !f.deleted); }

function foodSub(f) {
  const p = f.per100 || {};
  const k = kcalOf(p.p, p.c, p.f);
  const brand = f.kind === 'recipe' ? 'Rezept' : (f.brand || (f.kind === 'own' ? 'Eigenes' : ''));
  return `${brand ? esc(brand) + ' · ' : ''}100 ${f.unit === 'ml' ? 'ml' : 'g'}: P ${nf(p.p, 1)} · K ${nf(p.c, 1)} · F ${nf(p.f, 1)}`;
}
function foodItemHTML(f, act, attrs) {
  const k = kcalOf(f.per100.p, f.per100.c, f.per100.f);
  return `<button class="food-item" data-act="${act}" ${attrs}><div><b>${esc(f.name)}</b><small>${foodSub(f)}</small></div><span class="kc tnum">${nf(k)} kcal</span></button>`;
}

function openFoodSearch(ctx) {
  const tab = S.recent.length ? 'recent' : (S.favorites.length ? 'fav' : 'own');
  openSheet(renderFoodSearch, { ctx, q: '', tab, off: null, offLoading: false, offErr: null }, 'full');
}

function renderFoodSearch(st) {
  const title = st.ctx.target === 'recipe' ? 'Zutat hinzufügen' : MEAL_NAME[st.ctx.meal];
  const tabs = [['recent', 'Zuletzt'], ['fav', 'Favoriten'], ['own', 'Eigene'], ['recipes', 'Rezepte']];
  if (st.ctx.target === 'diary') tabs.push(['templates', 'Vorlagen']);
  return `${sheetHead(title)}
  <form class="search-row" data-submit="offSearch" autocomplete="off">
    <label class="search">${I.search}<input id="foodQ" type="search" placeholder="Lebensmittel suchen …" value="${esc(st.q)}" data-in="foodQ" enterkeyhint="search" aria-label="Lebensmittel suchen"></label>
    <button type="button" class="icon-btn big" data-act="scan" aria-label="Barcode scannen">${I.barcode}</button>
  </form>
  ${st.q ? '' : `<div class="chips scroll">${tabs.map(([k, l]) => `<button class="chip sm ${st.tab === k ? 'on' : ''}" data-act="foodTab" data-v="${k}">${l}</button>`).join('')}</div>`}
  <div id="foodList">${foodListHTML(st)}</div>
  <div class="btn-row">
    <button class="btn" data-act="newFood">+ Eigenes Lebensmittel</button>
    ${st.ctx.target === 'diary' ? '<button class="btn" data-act="quickAdd">Schnelleintrag</button>' : ''}
  </div>`;
}

function foodListHTML(st) {
  if (st.q) {
    const words = normalize(st.q).split(/\s+/).filter(Boolean);
    const local = allFoods().filter(f => {
      const hay = normalize(f.name + ' ' + (f.brand || '') + ' ' + (f.barcode || ''));
      return words.every(w => hay.includes(w));
    }).sort((a, b) => (S.recent.indexOf(a.id) + 1 || 999) - (S.recent.indexOf(b.id) + 1 || 999)).slice(0, 25);
    let html = local.length
      ? `<div class="list-label">Meine Lebensmittel</div><div class="food-list">${local.map(f => foodItemHTML(f, 'pickFood', `data-id="${esc(f.id)}"`)).join('')}</div>` : '';
    html += '<div class="list-label">Open Food Facts</div>';
    if (st.offLoading) html += '<div class="spinner"></div>';
    else if (st.offErr) html += `<p class="muted small">${esc(st.offErr)}</p><button class="btn block" data-act="offSearch">Erneut suchen</button>`;
    else if (st.off) {
      html += st.off.length
        ? `<div class="food-list">${st.off.map((f, i) => foodItemHTML(f, 'pickOff', `data-i="${i}"`)).join('')}</div>`
        : '<p class="muted small">Keine Treffer. Tipp: Barcode scannen oder eigenes Lebensmittel anlegen.</p>';
    } else html += `<button class="btn block" data-act="offSearch">${I.search} „${esc(st.q)}“ online suchen</button>`;
    return html;
  }
  let items = [];
  if (st.tab === 'recent') items = S.recent.map(id => S.foods[id]).filter(f => f && !f.deleted);
  if (st.tab === 'fav') items = S.favorites.map(id => S.foods[id]).filter(f => f && !f.deleted);
  if (st.tab === 'own') items = allFoods().filter(f => f.kind === 'own').sort((a, b) => a.name.localeCompare(b.name, 'de'));
  if (st.tab === 'recipes') items = allFoods().filter(f => f.kind === 'recipe').sort((a, b) => a.name.localeCompare(b.name, 'de'));
  if (st.tab === 'templates') {
    const tpl = Object.values(S.templates);
    if (!tpl.length) return '<div class="empty"><p>Noch keine Vorlagen. Über „…“ an einer Mahlzeit kannst du sie als Vorlage speichern.</p></div>';
    return `<div class="food-list">${tpl.map(t => {
      const m = t.items.reduce((a, e) => { const x = macrosFor(e.per100, e.grams); a.k += x.kcal; a.p += x.p; return a; }, { k: 0, p: 0 });
      return `<button class="food-item" data-act="useTemplate" data-id="${t.id}"><div><b>${esc(t.name)}</b><small>${t.items.length} Lebensmittel · P ${nf(m.p)} g</small></div><span class="kc tnum">${nf(m.k)} kcal</span></button>`;
    }).join('')}</div>`;
  }
  if (!items.length) {
    const msg = { recent: 'Hier erscheinen deine zuletzt genutzten Lebensmittel.', fav: 'Markiere Lebensmittel mit ★, um sie hier zu sehen.', own: 'Noch keine eigenen Lebensmittel.', recipes: 'Rezepte legst du unter „Mehr → Rezepte“ an.' }[st.tab];
    return `<div class="empty"><p>${msg}</p><p class="small">Oder oben suchen bzw. Barcode scannen.</p></div>`;
  }
  return `<div class="food-list">${items.slice(0, 60).map(f => foodItemHTML(f, 'pickFood', `data-id="${esc(f.id)}"`)).join('')}</div>`;
}

/* --------------------------- Open Food Facts ------------------------ */

const OFF_FIELDS = 'code,product_name,product_name_de,generic_name_de,brands,nutriments,serving_quantity,serving_size,countries_tags';
function offToFood(p) {
  const n = p.nutriments || {};
  const g = k => { const v = num(n[k]); return v === null ? 0 : Math.round(v * 10) / 10; };
  const name = (p.product_name_de || p.product_name || p.generic_name_de || '').trim();
  if (!name) return null;
  if (n.proteins_100g === undefined && n.carbohydrates_100g === undefined && n.fat_100g === undefined) return null;
  return {
    id: 'off:' + p.code, kind: 'off', barcode: p.code, name,
    brand: String(p.brands || '').split(',')[0].trim(),
    per100: { p: g('proteins_100g'), c: g('carbohydrates_100g'), f: g('fat_100g'), fiber: g('fiber_100g') },
    serving: num(p.serving_quantity) || null, unit: 'g',
  };
}
async function offFetch(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (r.status === 429) throw new Error('Zu viele Suchanfragen – bitte kurz warten.');
    if (!r.ok) throw new Error('Open Food Facts nicht erreichbar (' + r.status + ').');
    return await r.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Zeitüberschreitung – Open Food Facts antwortet nicht.');
    if (e instanceof TypeError) throw new Error('Keine Verbindung zu Open Food Facts.');
    throw e;
  } finally { clearTimeout(t); }
}
async function offSearch(q) {
  const url = `https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=40&fields=${OFF_FIELDS}`;
  const j = await offFetch(url);
  // In Deutschland verkaufte Produkte zuerst
  const de = p => (p.countries_tags || []).includes('en:germany') ? 0 : 1;
  return (j.products || []).slice().sort((a, b) => de(a) - de(b)).map(offToFood).filter(Boolean);
}
async function offProduct(code) {
  const j = await offFetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!j || j.status !== 1 || !j.product) return null;
  return offToFood(Object.assign({ code }, j.product));
}

/* ------------------------------ Menge ------------------------------- */

function openAmount(food, ctx, entry) {
  const grams = entry ? entry.grams : (food.lastGrams || food.serving || 100);
  openSheet(renderAmount, {
    food, ctx, entry,
    grams: String(grams).replace('.', ','),
    fv: entry ? !!entry.fv : !!food.fv,
    meal: entry ? entry.meal : ctx.meal,
  });
}
function amountPreviewHTML(st) {
  const m = macrosFor(st.food.per100, num(st.grams) || 0);
  return `<div class="k"><b class="tnum">${nf(m.kcal)}</b><small>kcal</small></div>
    <div class="p"><b class="tnum">${nf(m.p, 1)}</b><small>Protein</small></div>
    <div class="c"><b class="tnum">${nf(m.c, 1)}</b><small>KH</small></div>
    <div class="f"><b class="tnum">${nf(m.f, 1)}</b><small>Fett</small></div>
    <div class="fi"><b class="tnum">${nf(m.fiber, 1)}</b><small>Bst.</small></div>`;
}
function renderAmount(st) {
  const f = st.food;
  const unit = f.unit === 'ml' ? 'ml' : 'g';
  const fav = S.favorites.includes(f.id);
  const quick = [f.serving ? [f.serving, `1 Portion (${nf(f.serving)} ${unit})`] : null, [50], [100], [150], [200], [250]].filter(Boolean);
  const isDiary = st.ctx.target === 'diary';
  return `${sheetHead(st.entry ? 'Eintrag bearbeiten' : 'Menge', '<button class="txt-btn" data-act="closeSheet">Zurück</button>',
    `<button class="icon-btn" data-act="toggleFav" aria-label="Favorit" style="color:${fav ? 'var(--f)' : 'var(--muted)'}">${fav ? I.starFill : I.star}</button>`)}
  <div class="food-title"><h3>${esc(f.name)}</h3><small>${foodSub(f)}</small></div>
  <div class="amount-box"><input id="amtG" inputmode="decimal" value="${esc(st.grams)}" data-in="amtG" aria-label="Menge"><span>${unit}</span></div>
  <div class="chips" style="justify-content:center;margin-bottom:12px">${quick.map(([g, l]) => `<button class="chip sm" data-act="amtSet" data-v="${g}">${l || g + ' ' + unit}</button>`).join('')}</div>
  <div class="preview" id="amtPreview">${amountPreviewHTML(st)}</div>
  <section class="card">
    <label class="toggle"><span>Zählt als Obst / Gemüse</span><input type="checkbox" id="amtFv" ${st.fv ? 'checked' : ''} data-ch="amtFv"></label>
    ${isDiary ? `<label class="field" style="margin:8px 0 0"><span>Mahlzeit</span><select data-ch="amtMeal">${MEALS.map(m => `<option value="${m.id}" ${m.id === st.meal ? 'selected' : ''}>${m.name}</option>`).join('')}</select></label>` : ''}
  </section>
  <button class="btn primary block" data-act="amtSave">${st.entry ? 'Speichern' : 'Hinzufügen'}</button>
  ${st.entry ? '<button class="btn danger block" data-act="amtDelete">Eintrag löschen</button>' : ''}
  ${f.kind === 'own' || f.kind === 'off' ? '<button class="btn danger block" style="color:var(--muted)" data-act="editFoodFromAmount">Nährwerte bearbeiten</button>' : ''}`;
}

function rememberFood(f, grams) {
  if (f.kind !== 'quick') {
    S.foods[f.id] = Object.assign(S.foods[f.id] || {}, f, { lastGrams: grams });
    S.recent = [f.id, ...S.recent.filter(x => x !== f.id)].slice(0, 80);
  }
  save('foods', 'recent');
}

/* ------------------------- Eigenes Lebensmittel --------------------- */

function openFoodForm(food, ctx) {
  const f = food ? clone(food) : { id: uid('own:'), kind: 'own', name: '', brand: '', barcode: '', unit: 'g', per100: { p: '', c: '', f: '', fiber: '' }, serving: '', fv: false };
  openSheet(renderFoodForm, { f, ctx, isNew: !food || !S.foods[food.id] });
}
function renderFoodForm(st) {
  const f = st.f;
  const k = kcalOf(num(f.per100.p), num(f.per100.c), num(f.per100.f));
  const v = x => esc(x === null || x === undefined ? '' : String(x).replace('.', ','));
  return `${sheetHead(st.isNew ? 'Neues Lebensmittel' : 'Lebensmittel bearbeiten', undefined, '<button class="txt-btn bold" data-act="foodFormSave">Sichern</button>')}
  <section class="card">
    <label class="field"><span>Name *</span><input data-ff="name" value="${esc(f.name)}" placeholder="z. B. Skyr natur"></label>
    <div class="grid2">
      <label class="field"><span>Marke</span><input data-ff="brand" value="${esc(f.brand)}"></label>
      <label class="field"><span>Barcode</span><input data-ff="barcode" inputmode="numeric" value="${esc(f.barcode)}"></label>
    </div>
  </section>
  <div class="sub-title">Nährwerte pro 100 ${f.unit === 'ml' ? 'ml' : 'g'}</div>
  <section class="card">
    <div class="grid2">
      <label class="field"><span>Protein (g)</span><input data-ff="per100.p" inputmode="decimal" value="${v(f.per100.p)}"></label>
      <label class="field"><span>Kohlenhydrate (g)</span><input data-ff="per100.c" inputmode="decimal" value="${v(f.per100.c)}"></label>
      <label class="field"><span>Fett (g)</span><input data-ff="per100.f" inputmode="decimal" value="${v(f.per100.f)}"></label>
      <label class="field"><span>Ballaststoffe (g)</span><input data-ff="per100.fiber" inputmode="decimal" value="${v(f.per100.fiber)}"></label>
    </div>
    <p class="muted small" id="ffKcal" style="margin:10px 0 0">= ${nf(k)} kcal (P/K × 4,1 · F × 9,3)</p>
  </section>
  <section class="card">
    <div class="grid2">
      <label class="field"><span>Portion (optional)</span><input data-ff="serving" inputmode="decimal" value="${v(f.serving)}" placeholder="z. B. 150"></label>
      <label class="field"><span>Einheit</span><select data-ff="unit"><option value="g" ${f.unit !== 'ml' ? 'selected' : ''}>Gramm</option><option value="ml" ${f.unit === 'ml' ? 'selected' : ''}>Milliliter</option></select></label>
    </div>
    <label class="toggle" style="margin-top:8px"><span>Standardmäßig Obst / Gemüse</span><input type="checkbox" data-ff="fv" ${f.fv ? 'checked' : ''}></label>
  </section>
  ${!st.isNew && st.f.kind === 'own' ? '<button class="btn danger block" data-act="foodDelete">Lebensmittel löschen</button>' : ''}`;
}

/* ----------------------------- Rezepte ------------------------------ */

function recipePer100(r) {
  const tot = r.items.reduce((a, e) => { const m = macrosFor(e.per100, e.grams); a.p += m.p; a.c += m.c; a.f += m.f; a.fiber += m.fiber; a.g += e.grams || 0; return a; }, { p: 0, c: 0, f: 0, fiber: 0, g: 0 });
  const w = num(r.totalWeight) || tot.g || 1;
  const k = 100 / w;
  return { per100: { p: tot.p * k, c: tot.c * k, f: tot.f * k, fiber: tot.fiber * k }, weight: w, raw: tot };
}
function openRecipe(rec) {
  const r = rec ? clone(rec) : { id: uid('rec:'), kind: 'recipe', name: '', items: [], totalWeight: '', unit: 'g' };
  openSheet(renderRecipe, { r, isNew: !rec });
}
function renderRecipe(st) {
  const r = st.r;
  const calc = recipePer100(r);
  return `${sheetHead(st.isNew ? 'Neues Rezept' : 'Rezept bearbeiten', undefined, '<button class="txt-btn bold" data-act="recipeSave">Sichern</button>')}
  <section class="card">
    <label class="field"><span>Name *</span><input data-rf="name" value="${esc(r.name)}" placeholder="z. B. Overnight Oats"></label>
    <label class="field" style="margin:0"><span>Gesamtgewicht fertig (g, optional)</span><input data-rf="totalWeight" inputmode="decimal" value="${esc(r.totalWeight)}" placeholder="Summe der Zutaten: ${nf(calc.raw.g)} g"></label>
  </section>
  <div class="sub-title">Zutaten</div>
  <section class="card">
    ${r.items.length ? r.items.map((e, i) => `<div class="list-row"><div><b>${esc(e.name)}</b><small class="tnum">${nf(e.grams)} g · ${nf(macrosFor(e.per100, e.grams).kcal)} kcal</small></div><button class="icon-btn" data-act="recipeDelItem" data-i="${i}" aria-label="Entfernen" style="color:var(--danger)">${I.trash}</button></div>`).join('') : '<p class="muted small" style="margin:0">Noch keine Zutaten.</p>'}
    <button class="btn block" style="margin-top:10px" data-act="recipeAddItem">+ Zutat</button>
  </section>
  <section class="card"><b>Pro 100 g:</b> <span class="tnum">${nf(kcalOf(calc.per100.p, calc.per100.c, calc.per100.f))} kcal · P ${nf(calc.per100.p, 1)} · K ${nf(calc.per100.c, 1)} · F ${nf(calc.per100.f, 1)}</span></section>
  ${!st.isNew ? '<button class="btn danger block" data-act="recipeDelete">Rezept löschen</button>' : ''}`;
}

/* ----------------------------- Scanner ------------------------------ */

const loadedScripts = {};
function loadScript(src) {
  if (!loadedScripts[src]) {
    loadedScripts[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = res;
      s.onerror = () => { delete loadedScripts[src]; rej(new Error('Scanner konnte nicht geladen werden (offline?).')); };
      document.head.appendChild(s);
    });
  }
  return loadedScripts[src];
}
let scanner = null;
async function stopScanner() {
  const s = scanner;
  scanner = null;
  if (s) { try { await s.stop(); } catch (e) { /* schon gestoppt */ } try { s.clear(); } catch (e) { /* egal */ } }
}
function openScanner(ctx) {
  openSheet(st => `${sheetHead('Barcode scannen', '<button class="txt-btn" data-act="closeSheet">Schließen</button>')}
    <div class="scan-wrap"><div id="scanRegion"></div></div>
    <p class="muted small center" id="scanMsg">${st.msg || 'Kamera auf den Barcode richten …'}</p>
    <form class="search-row" data-submit="manualCode"><label class="search">${I.barcode}<input id="manualCode" inputmode="numeric" placeholder="oder Nummer eintippen" aria-label="Barcode-Nummer"></label><button class="btn" type="submit">Suchen</button></form>`,
  { ctx }, 'full', () => stopScanner());
  startScanner(ctx);
}
async function startScanner(ctx) {
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js');
    if (!$('#scanRegion')) return;
    const F = window.Html5QrcodeSupportedFormats;
    scanner = new window.Html5Qrcode('scanRegion', {
      verbose: false,
      formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    });
    let done = false;
    await scanner.start({ facingMode: 'environment' },
      { fps: 12, qrbox: (w, h) => ({ width: Math.floor(Math.min(w * 0.88, 340)), height: Math.floor(Math.min(h * 0.45, 150)) }), aspectRatio: 1.333 },
      code => { if (done) return; done = true; handleBarcode(code, ctx); }, () => {});
  } catch (e) {
    const m = $('#scanMsg');
    if (m) m.textContent = (e && e.message && /Permission|NotAllowed/i.test(e.message + e.name))
      ? 'Kein Kamerazugriff. Bitte in den iPhone-Einstellungen erlauben – oder die Nummer unten eintippen.'
      : 'Kamera nicht verfügbar: ' + ((e && e.message) || e) + '. Nummer unten eintippen.';
  }
}
async function handleBarcode(code, ctx) {
  code = String(code).trim();
  await stopScanner();
  const m = $('#scanMsg');
  if (m) m.textContent = `Suche ${code} …`;
  const local = allFoods().find(f => f.barcode === code);
  if (local) { closeSheet(); openAmount(local, ctx); return; }
  try {
    const f = await offProduct(code);
    closeSheet();
    if (f) { openAmount(f, ctx); return; }
    toast('Produkt nicht gefunden – bitte Nährwerte vom Etikett eintragen.');
    openFoodForm({ id: uid('own:'), kind: 'own', name: '', brand: '', barcode: code, unit: 'g', per100: { p: '', c: '', f: '', fiber: '' }, serving: '', fv: false }, ctx);
  } catch (e) {
    closeSheet();
    toast(e.message, true);
  }
}

/* ============================== Check-in ============================ */

function scale(field, val, from, to, legend, extra = []) {
  const vals = [];
  for (let i = from; i <= to; i++) vals.push(i);
  extra.forEach(x => vals.push(x));
  return `<div class="scale" style="--n:${vals.length}">${vals.map(v => `<button class="${String(val) === String(v) ? 'on' : ''}" data-act="setField" data-f="${field}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>
    ${legend ? `<div class="scale-legend"><span>${legend[0]}</span><span>${legend[1]}</span></div>` : ''}`;
}
function fieldInput(f, d, opts = {}) {
  const v = d && d[f] !== undefined && d[f] !== null ? d[f] : '';
  const shown = typeof v === 'number' && opts.decimal ? String(v).replace('.', ',') : v;
  return `<input class="input" data-field="${f}" ${opts.num ? `inputmode="${opts.decimal ? 'decimal' : 'numeric'}"` : ''} ${opts.type ? `type="${opts.type}"` : ''} value="${esc(shown)}" placeholder="${esc(opts.ph || '')}" ${opts.list ? `list="${opts.list}"` : ''} aria-label="${esc(opts.label || f)}">`;
}

function renderCheckin() {
  const date = ui.date;
  const d = S.days[date];
  const t = dayTotals(d);
  const auto = autoTrainingLabel(date);
  const g = (k) => d && d[k] !== undefined ? d[k] : '';
  const sleepH = num(g('sleepH'));
  const rehaHTML = rehaCard(date, d);
  const supps = S.supplements || [];
  return `${dateNav()}
  <section class="card">
    <div class="grid2">
      <label class="field"><span>Gewicht (kg)</span>${fieldInput('weight', d, { num: true, decimal: true, ph: lastWeight(date), label: 'Gewicht' })}</label>
      <label class="field"><span>Uhrzeit Einwaage</span>${fieldInput('time', d, { type: 'time', label: 'Uhrzeit' })}</label>
    </div>
  </section>

  <div class="sub-title">Schlaf</div>
  <section class="card">
    <div class="row"><span>Stunden</span>
      <div class="row" style="gap:6px">
        <button class="icon-btn" data-act="sleepStep" data-v="-0.5" aria-label="Weniger">−</button>
        <b class="tnum" style="min-width:56px;text-align:center;font-size:20px">${sleepH !== null ? nf(sleepH, 1) : (g('sleepH') || '–')}</b>
        <button class="icon-btn" data-act="sleepStep" data-v="0.5" aria-label="Mehr">+</button>
      </div></div>
    <div style="margin-top:12px"><span class="muted small">Qualität</span>${scale('sleepQ', g('sleepQ'), 1, 10, ['schlecht', 'super'])}</div>
  </section>

  <div class="sub-title">Verdauung</div>
  <section class="card">
    <span class="muted small">Frequenz</span>${scale('digFreq', g('digFreq'), 0, 5, null, ['>5'])}
    <div style="margin-top:12px"><span class="muted small">Qualität</span>${scale('digQ', g('digQ'), 1, 5, ['schlecht', 'super'])}</div>
  </section>

  <div class="sub-title">Befinden</div>
  <section class="card">
    <span class="muted small">Stress</span>${scale('stress', g('stress'), 1, 5, ['wenig', 'enorm'])}
    <div style="margin-top:12px"><span class="muted small">Energie</span>${scale('energy', g('energy'), 1, 5, ['niedrig', 'super'])}</div>
  </section>

  <div class="sub-title">Aktivität</div>
  <section class="card">
    <label class="field"><span>Schritte</span>${fieldInput('steps', d, { num: true, ph: String(S.settings.stepsTarget || ''), label: 'Schritte' })}</label>
    <div class="grid2" style="margin-bottom:12px">
      <label class="field"><span>Cardio</span>${fieldInput('cardioType', d, { list: 'cardioList', ph: 'z. B. Bike', label: 'Cardio-Art' })}</label>
      <label class="field"><span>Dauer (min)</span>${fieldInput('cardioMin', d, { num: true, label: 'Cardio-Minuten' })}</label>
    </div>
    <datalist id="cardioList"><option value="Bike"><option value="Laufband"><option value="Crosstrainer"><option value="Stepper"><option value="Walk"></datalist>
    <div class="grid2">
      <label class="field"><span>Posing (Runden)</span>${fieldInput('posingRounds', d, { num: true, label: 'Posing-Runden' })}</label>
      <label class="field"><span>Posing (min)</span>${fieldInput('posingMin', d, { num: true, label: 'Posing-Minuten' })}</label>
    </div>
  </section>

  <div class="sub-title">Trainingstag</div>
  <section class="card">
    ${fieldInput('training', d, { ph: auto || 'z. B. M19 W4 D5 oder Rest', label: 'Trainingstag' })}
    <div class="chips" style="margin-top:10px">
      ${[auto, 'Rest', 'Deload', 'Rest/Krank'].filter(Boolean).map(x => `<button class="chip sm ${g('training') === x ? 'on' : ''}" data-act="setField" data-f="training" data-v="${esc(x)}">${esc(x)}</button>`).join('')}
    </div>
  </section>

  <div class="sub-title">Makros ${t.fromFoods ? '(aus dem Tagebuch)' : '(manuell)'}</div>
  <section class="card">
    ${t.fromFoods
      ? `<p class="tnum" style="margin:0">${nf(t.kcal)} kcal · P ${nf(t.p)} · K ${nf(t.c)} · F ${nf(t.f)} · Bst ${nf(t.fiber)} · O/G ${nf(t.fv)} g · ${t.feedings} Feedings</p>`
      : `<div class="grid3">${[['protein', 'Protein'], ['carbs', 'KH'], ['fat', 'Fett'], ['fiber', 'Ballastst.'], ['fv', 'Obst/Gem. g'], ['feedings', 'Feedings']].map(([k, l]) =>
        `<label class="field"><span>${l}</span><input class="input" data-manual="${k}" inputmode="decimal" value="${esc(d && d.manual && d.manual[k] !== undefined ? String(d.manual[k]).replace('.', ',') : '')}"></label>`).join('')}</div>
        <p class="muted small" style="margin:10px 0 0">Wenn du Lebensmittel im Tagebuch einträgst, werden die Makros automatisch berechnet.</p>`}
  </section>

  ${supps.length ? `<div class="sub-title">Supplements</div><section class="card">${supps.map(s => `<label class="check-row"><input type="checkbox" data-ch="supp" data-id="${esc(s.id)}" ${d && d.supps[s.id] ? 'checked' : ''}><span class="grow">${esc(s.name)}<small>${esc([s.amount, s.timing].filter(Boolean).join(' · '))}</small></span></label>`).join('')}</section>` : ''}
  ${rehaHTML}

  <div class="sub-title">Kommentar</div>
  <section class="card"><textarea class="input" style="min-height:90px" data-field="comment" placeholder="z. B. Urlaub, krank, Besonderheiten" aria-label="Kommentar">${esc(g('comment'))}</textarea></section>`;
}

function lastWeight(date) {
  for (let i = 1; i <= 14; i++) { const d = S.days[addDays(date, -i)]; if (d && d.weight) return String(d.weight).replace('.', ','); }
  return '';
}

function rehaWeek(date) {
  if (!S.settings.rehaStart) return 1;
  return clamp(Math.floor(daysBetween(S.settings.rehaStart, date) / 7) + 1, 1, 12);
}
function rehaCard(date, d) {
  const groups = ((S.reha && S.reha.groups) || []).filter(g => (S.settings.rehaGroups || []).includes(g.name));
  if (!groups.length) return '';
  const wk = rehaWeek(date);
  return `<div class="sub-title">Reha${S.settings.rehaStart ? ' · Woche ' + wk : ''}</div><section class="card">${groups.map(g => g.items.map(it => {
    const key = g.name + '|' + it.name;
    const presc = it.weeks.length > 1 ? it.weeks[wk - 1] || it.weeks[it.weeks.length - 1] : it.weeks[0];
    return `<label class="check-row"><input type="checkbox" data-ch="reha" data-id="${esc(key)}" ${d && d.reha[key] ? 'checked' : ''}><span class="grow">${esc(it.name)}<small>${esc([g.name, presc, it.note].filter(Boolean).join(' · '))}</small></span></label>`;
  }).join('')).join('')}</section>`;
}

/* ============================== Training ============================ */

const wkey = (meso, week, day) => `${meso}|${week}|${day}`;
const rowsForWeek = (day, wk) => day.rows.filter(r => r.weeks[wk] && r.weeks[wk].sets > 0);

function groupRows(rows) {
  const groups = [];
  rows.forEach(r => {
    const last = groups[groups.length - 1];
    if (last && last.name === r.name) last.rows.push(r);
    else groups.push({ name: r.name, muscle: r.muscle, rows: [r] });
  });
  return groups;
}

function workoutDone(wk, dayIdx) {
  const P = S.plan;
  const w = S.workouts[wkey(P.name, wk, dayIdx)];
  if (w && w.finishedAt) return true;
  const day = P.days.find(x => x.idx === dayIdx);
  return !!day && rowsForWeek(day, wk).some(r => r.weeks[wk].load || r.weeks[wk].repsDone);
}

function ensureTrainingSelection() {
  const P = S.plan;
  if (ui.trWeek && P.weeks.includes(ui.trWeek) && P.days.some(d => d.idx === ui.trDay)) return;
  // 1) Heute schon begonnen?
  const t = today();
  const running = Object.values(S.workouts).find(w => w.meso === P.name && w.date === t);
  if (running) { ui.trWeek = running.week; ui.trDay = running.day; return; }
  // 2) Trainingstag aus dem Daily Tracking (heute) oder nach dem letzten erledigten
  const re = new RegExp(`^M${P.num}\\s*W(\\d+)\\s*D(\\d+)`, 'i');
  const todayLabel = S.days[t] && S.days[t].training && re.exec(S.days[t].training);
  if (todayLabel && P.weeks.includes(+todayLabel[1])) { ui.trWeek = +todayLabel[1]; ui.trDay = +todayLabel[2]; return; }
  let best = null;
  const consider = (wk, dy) => { if (!best || wk > best[0] || (wk === best[0] && dy > best[1])) best = [wk, dy]; };
  for (const d of Object.values(S.days)) {
    if (d.date > t || !d.training) continue;
    const m = re.exec(d.training);
    if (m) consider(+m[1], +m[2]);
  }
  for (const w of Object.values(S.workouts)) if (w.meso === P.name && w.finishedAt) consider(w.week, w.day);
  const order = [];
  P.weeks.forEach(wk => P.days.forEach(d => { if (rowsForWeek(d, wk).length) order.push([wk, d.idx]); }));
  let next = order[0];
  if (best) {
    const i = order.findIndex(([wk, dy]) => wk > best[0] || (wk === best[0] && dy > best[1]));
    next = i >= 0 ? order[i] : order[order.length - 1];
  }
  ui.trWeek = next ? next[0] : P.weeks[0];
  ui.trDay = next ? next[1] : P.days[0].idx;
}

function sheetPerf(pw) {
  if (!pw) return [];
  const loads = splitList(pw.load);
  const reps = splitReps(pw.repsDone);
  const n = Math.max(loads.length, reps.length);
  const out = [];
  for (let i = 0; i < n; i++) out.push({ load: loads[i] !== undefined ? loads[i] : loads[loads.length - 1], reps: reps[i] !== undefined ? reps[i] : '' });
  return out;
}
function prevPerf(r, wk, dayIdx) {
  const P = S.plan;
  for (let k = wk - 1; k >= 1; k--) {
    const w = S.workouts[wkey(P.name, k, dayIdx)];
    const st = w && w.rows[r.row];
    if (st && st.sets.some(s => s && (s.load || s.reps))) return st.sets.map(s => ({ load: s.load, reps: s.reps }));
    const sp = sheetPerf(r.weeks[k]);
    if (sp.length) return sp;
  }
  // gleiche Übung in einem anderen Workout (z. B. vorheriger Mesocycle)
  let best = null;
  for (const w of Object.values(S.workouts)) {
    if (w.meso === P.name && w.week >= wk) continue;
    for (const [row, st] of Object.entries(w.rows || {})) {
      const name = w.meta && w.meta.rows && w.meta.rows[row] && w.meta.rows[row].name;
      if (name === r.name && st.sets.some(s => s && (s.load || s.reps)) && (!best || (w.date || '') > (best.date || ''))) best = { date: w.date, sets: st.sets };
    }
  }
  return best ? best.sets.map(s => ({ load: s.load, reps: s.reps })) : [];
}

function getWorkout(wk, day, create) {
  const P = S.plan;
  const k = wkey(P.name, wk, day.idx);
  let w = S.workouts[k];
  if (!w && create) {
    w = S.workouts[k] = { key: k, meso: P.name, mesoNum: P.num, week: wk, day: day.idx, rows: {}, feedback: {}, date: null };
  }
  if (w) {
    w.meta = {
      headerRow: day.headerRow, rpeRow: day.rpeRow, title: day.title,
      rows: Object.fromEntries(day.rows.map(r => [r.row, { name: r.name, muscle: r.muscle, reps: r.weeks[wk] ? r.weeks[wk].reps : '', rir: r.weeks[wk] ? r.weeks[wk].rir : '' }])),
    };
  }
  return w;
}
function rowState(w, r, wk) {
  const n = r.weeks[wk].sets;
  const st = w.rows[r.row] || (w.rows[r.row] = { sets: [], note: '' });
  while (st.sets.length < n) st.sets.push({});
  return st;
}
function touchWorkout(w) { w.updatedAt = Date.now(); save('workouts'); updateSyncBadge(); }

function renderTraining() {
  const P = S.plan;
  if (!P || !P.days || !P.days.length) {
    return `<div class="empty">${headline('Kein Plan.', 'Noch nicht geladen.')}<p>Der aktuelle Mesocycle wird beim Sync aus deinem Google Sheet geladen.</p>
      <button class="btn primary" data-act="${S.settings.scriptUrl ? 'fullPull' : 'tab'}" data-v="more">${S.settings.scriptUrl ? 'Jetzt laden' : 'Sheet verbinden'}</button></div>`;
  }
  ensureTrainingSelection();
  const wk = ui.trWeek;
  const day = P.days.find(d => d.idx === ui.trDay) || P.days[0];
  const w = S.workouts[wkey(P.name, wk, day.idx)];
  const groups = groupRows(rowsForWeek(day, wk));
  const lastIdxOfMuscle = {};
  groups.forEach((g, i) => { lastIdxOfMuscle[g.muscle] = i; });
  const sess = day.session && day.session[wk];
  return `<section class="card tr-head"><div><b>${esc(P.name)}</b><div class="muted small">${esc([P.meta && P.meta.prio ? 'Prio: ' + P.meta.prio : '', P.meta && P.meta.rate].filter(Boolean).join(' · '))}</div></div></section>
  <div class="chips scroll" aria-label="Woche">${P.weeks.map(n => {
    const done = P.days.every(d => !rowsForWeek(d, n).length || workoutDone(n, d.idx));
    return `<button class="chip sm ${n === wk ? 'on' : ''} ${done ? 'done' : ''}" data-act="trWeek" data-v="${n}">Woche ${n}</button>`;
  }).join('')}</div>
  <div class="day-tabs" aria-label="Trainingstag">${P.days.map(d => `<button class="day-tab ${d.idx === day.idx ? 'on' : ''} ${workoutDone(wk, d.idx) ? 'done' : ''}" data-act="trDay" data-v="${d.idx}"><b>Tag ${d.idx}</b><small>${esc(d.title)}</small></button>`).join('')}</div>
  ${headline(`Woche ${wk} · Tag ${day.idx}.`, day.title)}
  ${w && w.date ? `<p class="muted small" style="margin:-8px 2px 12px">${fmtDay(w.date)}${w.finishedAt ? ' · abgeschlossen' : ' · läuft'}</p>` : ''}
  ${groups.length ? groups.map((g, gi) => exerciseCard(g, wk, day, w, lastIdxOfMuscle[g.muscle] === gi)).join('') : '<div class="empty">In dieser Woche ist für diesen Tag nichts geplant.</div>'}
  ${groups.length ? finishBlock(w, sess) : ''}`;
}

function exerciseCard(g, wk, day, w, isLastOfMuscle) {
  let setNo = 0;
  const first = g.rows[0];
  const body = g.rows.map((r, gi) => {
    const p = r.weeks[wk];
    const prev = prevPerf(r, wk, day.idx);
    const st = w && w.rows[r.row];
    const rirArr = splitList(p.rir);
    const tgt = `${p.sets} × ${esc(p.reps || '?')} Wdh · RIR ${esc(p.rir || '–')}${p.tempo ? ' · Tempo ' + esc(p.tempo) : ''}`;
    let html = g.rows.length > 1 ? `<div class="set-group-label">${gi === 0 ? 'Satzgruppe 1' : 'Satzgruppe ' + (gi + 1)} · ${tgt}</div>` : `<div class="ex-target">${tgt}</div>`;
    html += '<div class="set-head"><span>#</span><span>kg</span><span>Wdh</span><span>RIR</span><span></span></div>';
    for (let i = 0; i < p.sets; i++) {
      setNo++;
      const s = (st && st.sets[i]) || {};
      const pv = prev[i] || prev[prev.length - 1] || {};
      const trir = rirArr[i] !== undefined ? rirArr[i] : (rirArr[rirArr.length - 1] || '');
      html += `<div class="set ${s.done ? 'done' : ''}">
        <span class="set-n">${setNo}</span>
        <input class="set-in" data-set="${r.row}|${i}|load" inputmode="decimal" placeholder="${esc(fmtLoad(pv.load))}" value="${esc(fmtLoad(s.load))}" aria-label="Gewicht Satz ${setNo}">
        <input class="set-in" data-set="${r.row}|${i}|reps" inputmode="numeric" placeholder="${esc(pv.reps === undefined ? '' : pv.reps)}" value="${esc(s.reps === undefined ? '' : s.reps)}" aria-label="Wiederholungen Satz ${setNo}">
        <input class="set-in" data-set="${r.row}|${i}|rir" inputmode="numeric" placeholder="${esc(trir)}" value="${esc(s.rir === undefined ? '' : s.rir)}" aria-label="RIR Satz ${setNo}">
        <button class="set-chk" data-act="setDone" data-row="${r.row}" data-i="${i}" aria-label="Satz ${setNo} abhaken">${I.check}</button>
      </div>`;
    }
    return html;
  }).join('');
  const note = (w && w.rows[first.row] && w.rows[first.row].note) || '';
  let fb = '';
  if (isLastOfMuscle && g.muscle) {
    const f = w && w.feedback[g.muscle];
    fb = `<button class="fb-chip ${f ? 'done' : ''}" data-act="feedback" data-m="${esc(g.muscle)}"><span>Feedback ${esc(g.muscle)}</span><span>${f ? feedbackText(f) : 'offen ›'}</span></button>`;
  }
  return `<section class="card ex">
    <div class="ex-top"><span class="pill">${esc(g.muscle || 'Übung')}</span><button class="icon-btn" data-act="exInfo" data-row="${first.row}" aria-label="Technik-Hinweise">${I.info}</button></div>
    <h3 class="ex-name">${esc(g.name)}</h3>
    ${body}
    <details class="ex-note" ${note ? 'open' : ''}><summary>${note ? 'Notiz' : '+ Notiz'}</summary><textarea data-note="${first.row}" rows="2" placeholder="z. B. Sitzposition 4, enger Griff">${esc(note)}</textarea></details>
    ${fb}
  </section>`;
}

function feedbackText(f) {
  return FEEDBACK.filter(q => f[q.k] !== undefined).map(q => `${q.short}: ${q.opts[f[q.k]]}`).join(' · ');
}

function finishBlock(w, sess) {
  if (w && w.finishedAt) {
    return `<section class="card done-card">${I.check}<div style="flex:1"><b>Training abgeschlossen</b><div class="muted small">${[w.rpe ? 'RPE ' + String(w.rpe).replace('.', ',') : '', w.durationMin ? fmtDur(w.durationMin) : '', w.date ? fmtDay(w.date) : ''].filter(Boolean).join(' · ')}</div></div>
      <button class="txt-btn" data-act="finishWorkout">Ändern</button></section>`;
  }
  const sheetInfo = sess && (sess.rpe || sess.duration) ? `<p class="muted small center">Im Sheet: ${[sess.rpe ? 'RPE ' + sess.rpe : '', sess.duration].filter(Boolean).join(' · ')}</p>` : '';
  return `${sheetInfo}<button class="btn primary block" data-act="finishWorkout">Training abschließen</button>`;
}

function currentDay() { return S.plan.days.find(d => d.idx === ui.trDay) || S.plan.days[0]; }

function checkMuscleFeedback(w, day, wk, muscle) {
  if (!muscle || w.feedback[muscle]) return;
  const rows = rowsForWeek(day, wk).filter(r => r.muscle === muscle);
  const all = rows.every(r => { const st = w.rows[r.row]; return st && st.sets.slice(0, r.weeks[wk].sets).every(s => s && s.done); });
  if (all) setTimeout(() => openFeedback(muscle), 350);
}

function openFeedback(muscle) {
  const P = S.plan, day = currentDay(), wk = ui.trWeek;
  const w = getWorkout(wk, day, true);
  const draft = Object.assign({}, w.feedback[muscle] || {});
  openSheet(st => `${sheetHead('Feedback · ' + muscle, '<button class="txt-btn" data-act="closeSheet">Später</button>', '<button class="txt-btn bold" data-act="fbSave">Sichern</button>')}
    ${FEEDBACK.map(q => `<section class="card"><b>${q.q}</b><div class="chips" style="margin-top:10px">${q.opts.map((o, i) => `<button class="chip sm ${st.draft[q.k] === i ? 'on' : ''}" data-act="fbSet" data-k="${q.k}" data-v="${i}">${o}</button>`).join('')}</div></section>`).join('')}
    <p class="muted small">Das Feedback landet im Notes-Feld der Übung im Sheet, damit dein Coach es sieht.</p>`,
  { muscle, draft, wkKey: w.key });
}

/* ------------------------------ Pausentimer ------------------------- */

const timer = { end: 0, iv: null, fired: false };
let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* kein Audio */ }
}
function beep() {
  if (!audioCtx) return;
  try {
    [0, 0.25, 0.5].forEach(t => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch (e) { /* egal */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
function startRest(sec) {
  timer.end = Date.now() + sec * 1000;
  timer.fired = false;
  clearInterval(timer.iv);
  timer.iv = setInterval(tickTimer, 250);
  tickTimer();
}
function tickTimer() {
  const el = $('#timer');
  if (!el) return;
  const left = Math.ceil((timer.end - Date.now()) / 1000);
  if (left <= 0 && !timer.fired) {
    timer.fired = true;
    beep();
    el.classList.add('ring');
    setTimeout(stopRest, 5000);
  }
  const l = Math.max(0, left);
  el.hidden = false;
  el.innerHTML = `<span class="t">${I.timer}${Math.floor(l / 60)}:${pad(l % 60)}<small>${l ? 'Pause' : 'Weiter geht’s!'}</small></span>
    <button data-act="restAdj" data-v="-15" aria-label="15 Sekunden weniger">−15</button><button data-act="restAdj" data-v="15" aria-label="15 Sekunden mehr">+15</button><button data-act="restStop" aria-label="Timer beenden">${I.close}</button>`;
}
function stopRest() {
  clearInterval(timer.iv);
  const el = $('#timer');
  if (el) { el.hidden = true; el.classList.remove('ring'); }
}

/* ============================== Verlauf ============================= */

function sleepNum(v) { if (v === '<3') return 3; if (v === '>12') return 12; return num(v); }
function weekBegin() { return S.settings.beginDate || (S.profile && S.profile.beginning) || null; }
function weekStartOf(date) {
  const b = weekBegin();
  if (b) return addDays(b, Math.floor(daysBetween(b, date) / 7) * 7);
  const dow = (parseISO(date).getDay() + 6) % 7;
  return addDays(date, -dow);
}
const avg = arr => { const a = arr.filter(x => x !== null && x !== undefined && !isNaN(x)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };

function weekStats(start) {
  const ds = [];
  const t = today();
  for (let i = 0; i < 7; i++) { const dt = addDays(start, i); const d = S.days[dt]; if (d && dt <= t) ds.push(d); }
  const tot = ds.map(dayTotals).filter(t => t.kcal > 0);
  const trainings = ds.filter(d => { const l = d.training || autoTrainingLabel(d.date) || ''; return /\bW\d+/i.test(l) && /\bD\d+/i.test(l); }).length;
  return {
    start, n: ds.length,
    weight: avg(ds.map(d => num(d.weight))),
    kcal: avg(tot.map(t => t.kcal)), p: avg(tot.map(t => t.p)), c: avg(tot.map(t => t.c)), f: avg(tot.map(t => t.f)), fiber: avg(tot.map(t => t.fiber)),
    sleepH: avg(ds.map(d => sleepNum(d.sleepH))), sleepQ: avg(ds.map(d => num(d.sleepQ))),
    steps: avg(ds.map(d => num(d.steps))), stress: avg(ds.map(d => num(d.stress))), energy: avg(ds.map(d => num(d.energy))),
    digQ: avg(ds.map(d => num(d.digQ))), water: avg(ds.map(d => d.water || null)),
    trainings, cardio: ds.reduce((s, d) => s + (num(d.cardioMin) || 0), 0), posing: ds.reduce((s, d) => s + (num(d.posingMin) || 0), 0),
  };
}

function renderHistory() {
  const seg = `<div class="seg">${[['weight', 'Gewicht'], ['weeks', 'Wochen'], ['sizes', 'Maße']].map(([k, l]) => `<button class="${ui.hist === k ? 'on' : ''}" data-act="hist" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (ui.hist === 'weeks') return seg + renderWeeks();
  if (ui.hist === 'sizes') return seg + renderSizes();
  return seg + renderWeight();
}

function renderWeight() {
  const all = Object.values(S.days).filter(d => num(d.weight)).sort((a, b) => a.date < b.date ? -1 : 1);
  if (all.length < 2) return `<div class="empty">${headline('Zu wenig Daten.', 'Erst wiegen.')}<p>Trage dein Gewicht im Check-in ein oder lade deine Historie aus dem Sheet.</p></div>`;
  const end = today();
  const ranges = [[28, '4 W'], [84, '12 W'], [182, '6 M'], [365, '1 J'], [0, 'Alles']];
  const start = ui.range ? addDays(end, -ui.range + 1) : all[0].date;
  const pts = all.filter(d => d.date >= start && d.date <= end);
  const cur = weekStats(weekStartOf(end));
  const prev = weekStats(addDays(weekStartOf(end), -7));
  const four = avg([0, 1, 2, 3].map(i => weekStats(addDays(weekStartOf(end), -7 * i)).weight));
  const delta = cur.weight !== null && prev.weight !== null ? cur.weight - prev.weight : null;
  return `<div class="stat-row">
    <div class="stat"><small>Ø diese Woche</small><b class="tnum">${nf(cur.weight, 1)}</b> <small style="display:inline">kg</small></div>
    <div class="stat"><small>vs. Vorwoche</small><b class="tnum ${delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : ''}">${delta === null ? '–' : (delta > 0 ? '+' : '') + nf(delta, 2)}</b> <small style="display:inline">kg</small></div>
    <div class="stat"><small>Ø 4 Wochen</small><b class="tnum">${nf(four, 1)}</b> <small style="display:inline">kg</small></div>
  </div>
  <div class="chips" style="margin-bottom:12px">${ranges.map(([r, l]) => `<button class="chip sm ${ui.range === r ? 'on' : ''}" data-act="range" data-v="${r}">${l}</button>`).join('')}</div>
  <section class="card">${weightChart(pts, all)}<p class="muted small" style="margin:6px 0 0">Punkte = Tageswerte · Linie = 7-Tage-Schnitt</p></section>`;
}

function weightChart(pts, all) {
  if (pts.length < 2) return '<p class="muted">Im gewählten Zeitraum zu wenige Werte.</p>';
  const W = 340, H = 190, L = 34, R = 8, T = 10, B = 22;
  const d0 = pts[0].date, d1 = pts[pts.length - 1].date;
  const span = Math.max(1, daysBetween(d0, d1));
  const byDate = Object.fromEntries(all.map(d => [d.date, num(d.weight)]));
  const ma = pts.map(p => {
    const vals = [];
    for (let i = 0; i < 7; i++) { const v = byDate[addDays(p.date, -i)]; if (v) vals.push(v); }
    return { date: p.date, v: avg(vals) };
  });
  const ys = pts.map(p => num(p.weight)).concat(ma.map(m => m.v));
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const padY = Math.max(0.3, (hi - lo) * 0.12);
  lo -= padY; hi += padY;
  const x = date => L + (W - L - R) * daysBetween(d0, date) / span;
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = [lo + padY, (lo + hi) / 2, hi - padY];
  const grid = ticks.map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${nf(v, 1)}</text>`).join('');
  const dots = pts.map(p => `<circle class="dot" cx="${x(p.date).toFixed(1)}" cy="${y(num(p.weight)).toFixed(1)}" r="2.2"/>`).join('');
  const path = ma.map((m, i) => `${i ? 'L' : 'M'}${x(m.date).toFixed(1)},${y(m.v).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewichtsverlauf">
    ${grid}${dots}<path class="avg" d="${path}"/>
    <text x="${L}" y="${H - 6}">${fmtShort(d0)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${fmtShort(d1)}</text>
  </svg>`;
}

function renderWeeks() {
  const dates = Object.keys(S.days).filter(k => k <= today()).sort();
  if (!dates.length) return '<div class="empty"><p>Noch keine Daten.</p></div>';
  const first = weekStartOf(dates[0]);
  let start = weekStartOf(today());
  const cards = [];
  let shown = 0;
  while (start >= first && shown < ui.weeksShown) {
    const s = weekStats(start);
    if (s.n) {
      const p = weekStats(addDays(start, -7));
      const four = avg([0, 1, 2, 3].map(i => weekStats(addDays(start, -7 * i)).weight));
      const dW = s.weight !== null && p.weight !== null ? s.weight - p.weight : null;
      const weekNo = weekBegin() ? Math.floor(daysBetween(weekBegin(), start) / 7) + 1 : null;
      cards.push(`<section class="card week-card">
        <h3><span>${fmtShort(start)} – ${fmtShort(addDays(start, 6))}</span><small>${weekNo ? 'Woche ' + weekNo : ''}</small></h3>
        <div class="kv">
          <div><span>Ø Gewicht</span><b class="tnum">${nf(s.weight, 2)} kg</b></div>
          <div><span>Veränderung</span><b class="tnum ${dW > 0 ? 'delta-up' : dW < 0 ? 'delta-down' : ''}">${dW === null ? '–' : (dW > 0 ? '+' : '') + nf(dW, 2) + ' kg (' + (dW > 0 ? '+' : '') + nf(dW / p.weight * 100, 2) + ' %)'}</b></div>
          <div><span>4-Wochen-Ø</span><b class="tnum">${nf(four, 2)} kg</b></div>
          <div><span>Ø kcal</span><b class="tnum">${nf(s.kcal)}</b></div>
          <div><span>Ø P / K / F</span><b class="tnum">${nf(s.p)} / ${nf(s.c)} / ${nf(s.f)}</b></div>
          <div><span>Ø Ballaststoffe</span><b class="tnum">${nf(s.fiber)} g</b></div>
          <div><span>Ø Schlaf</span><b class="tnum">${nf(s.sleepH, 1)} h · Q ${nf(s.sleepQ, 1)}</b></div>
          <div><span>Ø Schritte</span><b class="tnum">${nf(s.steps)}</b></div>
          <div><span>Ø Stress / Energie</span><b class="tnum">${nf(s.stress, 1)} / ${nf(s.energy, 1)}</b></div>
          <div><span>Trainings</span><b class="tnum">${s.trainings}</b></div>
          <div><span>Cardio</span><b class="tnum">${s.cardio ? nf(s.cardio) + ' min' : '–'}</b></div>
          <div><span>Posing</span><b class="tnum">${s.posing ? nf(s.posing) + ' min' : '–'}</b></div>
        </div></section>`);
      shown++;
    }
    start = addDays(start, -7);
  }
  const more = start >= first ? '<button class="btn block" data-act="moreWeeks">Ältere Wochen anzeigen</button>' : '';
  return cards.join('') + more;
}

function sizeLabels() { return S.sizes.labels && S.sizes.labels.length ? S.sizes.labels : DEFAULT_SIZE_LABELS; }
function renderSizes() {
  const labels = sizeLabels();
  const entries = S.sizes.entries.filter(e => e.date).sort((a, b) => a.date < b.date ? 1 : -1);
  const last = entries[0], prev = entries[1];
  return `<button class="btn primary block" data-act="newSizes" style="margin-bottom:12px">+ Neue Messung</button>
  ${last ? `<section class="card"><div class="row" style="margin-bottom:6px"><b>Letzte Messung</b><span class="muted small">${fmtDay(last.date)}${prev ? ' · vs. ' + fmtShort(prev.date) : ''}</span></div>
    ${labels.map((l, i) => {
      const v = num(last.values[i]), pv = prev ? num(prev.values[i]) : null;
      const dl = v !== null && pv !== null ? v - pv : null;
      return `<div class="size-row"><span>${esc(l)}</span><b class="tnum">${nf(v, 1)} cm ${dl !== null ? `<small class="muted">(${dl > 0 ? '+' : ''}${nf(dl, 1)})</small>` : ''}</b></div>`;
    }).join('')}</section>` : `<div class="empty">${headline('Noch keine Maße.', 'Maßband raus.')}<p>Messung anlegen – sie landet beim Sync im Tab „Sizes“.</p></div>`}
  ${entries.length ? `<div class="sub-title">Alle Messungen</div><section class="card">${entries.map(e => `<button class="list-row" style="width:100%;text-align:left" data-act="editSizes" data-date="${e.date}"><div><b>${fmtDay(e.date)} ${parseISO(e.date).getFullYear()}</b><small>${e.values.filter(v => v !== null && v !== '').length} Werte${isDirty(e) ? ' · noch nicht synchronisiert' : ''}</small></div>${I.right}</button>`).join('')}</section>` : ''}`;
}

function openSizes(date) {
  const e = S.sizes.entries.find(x => x.date === date);
  openSheet(st => `${sheetHead('Körpermaße', undefined, '<button class="txt-btn bold" data-act="sizesSave">Sichern</button>')}
    <section class="card"><label class="field" style="margin:0"><span>Datum</span><input type="date" class="input" data-sz="date" value="${st.date}"></label></section>
    <section class="card">${sizeLabels().map((l, i) => `<label class="field"><span>${esc(l)} (cm)</span><input class="input" inputmode="decimal" data-sz="${i}" value="${esc(st.values[i] === null || st.values[i] === undefined ? '' : String(st.values[i]).replace('.', ','))}"></label>`).join('')}</section>
    ${e ? '<button class="btn danger block" data-act="sizesDelete">Messung löschen</button>' : ''}`,
  { date: date || today(), orig: date, values: e ? e.values.slice() : new Array(9).fill(null) });
}

/* =============================== Mehr =============================== */

function targetEditor(type, label) {
  const t = S.settings.targets[type];
  const k = kcalOf(t.protein, t.carbs, t.fat);
  const f = (key, l) => `<label class="field"><span>${l}</span><input class="input" inputmode="decimal" data-setting="targets.${type}.${key}" data-num="1" value="${esc(t[key])}"></label>`;
  return `<b>${label}</b><div class="target-grid" style="margin-top:8px">${f('protein', 'Protein')}${f('carbs', 'KH')}${f('fat', 'Fett')}${f('fiber', 'Bst.')}${f('feedings', 'Feedings')}</div>
    <p class="target-kcal tnum">= ${nf(k)} kcal</p>`;
}

function renderMore() {
  const st = S.settings;
  const pending = pendingCount();
  const rehaGroups = (S.reha && S.reha.groups) || [];
  const set = (path, label, opts = {}) => `<label class="field"><span>${label}</span><input class="input" ${opts.num ? 'inputmode="decimal" data-num="1"' : ''} ${opts.type ? `type="${opts.type}"` : ''} data-setting="${path}" value="${esc(path.split('.').reduce((o, k) => o && o[k], st) ?? '')}" ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''} autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label>`;
  const urlOk = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{30,}\/exec$/.test(st.scriptUrl || '');
  return `<h2 class="section-title">Google Sheet</h2>
  <section class="card">
    ${set('scriptUrl', 'Web-App-URL (Apps Script)', { type: 'url', ph: 'https://script.google.com/macros/s/…/exec' })}
    ${st.scriptUrl ? `<p class="small" style="margin:-6px 0 12px;color:${urlOk ? 'var(--ok)' : 'var(--danger)'}">${urlOk ? '✓ Gespeichert' : '✗ Unvollständig'}: ${esc(shortScriptUrl(st.scriptUrl))}</p>` : ''}
    ${set('token', 'Passwort (TOKEN aus dem Script)', { type: 'password' })}
    <div class="btn-row"><button class="btn" data-act="testConn">Verbindung testen</button><button class="btn" data-act="fullPull">Alles aus Sheet laden</button></div>
    <button class="btn primary block" data-act="sync">Jetzt synchronisieren${pending ? ` (${pending} offen)` : ''}</button>
    <p class="muted small" style="margin:10px 0 0">Letzter Sync: ${st.lastSync ? fmtDateTime(st.lastSync) : 'noch nie'}${S.plan ? ' · Plan: ' + esc(S.plan.name) : ''}${S.profile && S.profile.name ? ' · ' + esc(S.profile.name) : ''}</p>
  </section>

  <h2 class="section-title">Makroziele</h2>
  <section class="card">
    ${targetEditor('td', 'Training-Day')}
    ${targetEditor('ntd', 'Non-Training-Day')}
    <p class="muted small" style="margin:0 0 10px">kcal = Protein × 4,1 + Kohlenhydrate × 4,1 + Fett × 9,3</p>
    ${S.profile && S.profile.targets ? '<button class="btn block" data-act="targetsFromSheet">Ziele aus dem Sheet übernehmen</button>' : ''}
  </section>

  <h2 class="section-title">Weitere Ziele</h2>
  <section class="card"><div class="grid2">
    ${set('waterTarget', 'Wasser pro Tag (ml)', { num: true })}
    ${set('waterStep', 'Wasser-Schritt (ml)', { num: true })}
    ${set('fvTarget', 'Obst & Gemüse (g)', { num: true })}
    ${set('feedingMin', 'Feeding ab … g Protein', { num: true })}
    ${set('stepsTarget', 'Schritte pro Tag', { num: true })}
    ${set('restSec', 'Pausentimer (Sek.)', { num: true })}
  </div></section>

  <h2 class="section-title">Supplements</h2>
  <section class="card">
    ${(S.supplements || []).map(s => `<div class="supp-edit">
      <input data-supp="${esc(s.id)}|name" value="${esc(s.name)}" placeholder="Name" aria-label="Name">
      <input data-supp="${esc(s.id)}|amount" value="${esc(s.amount)}" placeholder="Menge" aria-label="Menge">
      <input data-supp="${esc(s.id)}|timing" value="${esc(s.timing)}" placeholder="Zeitpunkt" aria-label="Zeitpunkt">
      <button class="icon-btn" data-act="suppDel" data-id="${esc(s.id)}" aria-label="Löschen" style="color:var(--danger)">${I.trash}</button></div>`).join('') || '<p class="muted small" style="margin-top:0">Lege deine Supplements an – im Check-in hakst du sie täglich ab.</p>'}
    <button class="btn block" data-act="suppAdd">+ Supplement</button>
  </section>

  <h2 class="section-title">Reha</h2>
  <section class="card">
    ${rehaGroups.length ? `<p class="muted small" style="margin-top:0">Welche Programme willst du im Check-in abhaken?</p>
      ${rehaGroups.map(g => `<label class="check-row"><input type="checkbox" data-ch="rehaGroup" data-id="${esc(g.name)}" ${(st.rehaGroups || []).includes(g.name) ? 'checked' : ''}><span class="grow">${esc(g.name)}<small>${g.items.map(i => esc(i.name)).join(', ')}</small></span></label>`).join('')}
      <label class="field" style="margin-top:12px"><span>Start der Reha (für Woche 1–12)</span><input type="date" class="input" data-setting="rehaStart" value="${esc(st.rehaStart || '')}"></label>`
    : '<p class="muted small" style="margin:0">Der Reha-Plan wird beim Sync aus dem Tab „Knie-Rehab“ geladen.</p>'}
  </section>

  <h2 class="section-title">Lebensmittel</h2>
  <section class="card">
    <button class="list-row" style="width:100%;text-align:left" data-act="manage" data-v="own"><div><b>Eigene Lebensmittel</b><small>${allFoods().filter(f => f.kind === 'own').length} Einträge</small></div>${I.right}</button>
    <button class="list-row" style="width:100%;text-align:left" data-act="manage" data-v="recipes"><div><b>Rezepte</b><small>${allFoods().filter(f => f.kind === 'recipe').length} Rezepte</small></div>${I.right}</button>
    <button class="list-row" style="width:100%;text-align:left" data-act="manage" data-v="templates"><div><b>Mahlzeiten-Vorlagen</b><small>${Object.keys(S.templates).length} Vorlagen</small></div>${I.right}</button>
  </section>

  <h2 class="section-title">Backup</h2>
  <section class="card">
    <div class="btn-row"><button class="btn" data-act="backupDrive">In Google Drive sichern</button><button class="btn" data-act="restoreDrive">Aus Drive laden</button></div>
    <div class="btn-row"><button class="btn" data-act="exportFile">Als Datei exportieren</button><label class="btn" style="flex:1 1 140px">Datei importieren<input type="file" accept="application/json,.json" data-ch="importFile" hidden></label></div>
    <p class="muted small" style="margin:0">Tracking-Werte liegen zusätzlich im Sheet. Lebensmittel-Einträge, Rezepte, Wasser & Supplements nur in der App – deshalb regelmäßig sichern.</p>
  </section>
  <p class="app-version">PIP Tracker · v${APP_VERSION}</p>`;
}

function openManage(kind) {
  openSheet(st => {
    let list = '';
    if (st.kind === 'own') {
      const items = allFoods().filter(f => f.kind === 'own').sort((a, b) => a.name.localeCompare(b.name, 'de'));
      list = items.map(f => foodItemHTML(f, 'manageFood', `data-id="${esc(f.id)}"`)).join('') || '<p class="muted center">Noch keine eigenen Lebensmittel.</p>';
      return `${sheetHead('Eigene Lebensmittel', '<button class="txt-btn" data-act="closeSheet">Fertig</button>', '<button class="txt-btn bold" data-act="newFoodPlain">Neu</button>')}<div class="food-list">${list}</div>`;
    }
    if (st.kind === 'recipes') {
      const items = allFoods().filter(f => f.kind === 'recipe').sort((a, b) => a.name.localeCompare(b.name, 'de'));
      list = items.map(f => foodItemHTML(f, 'manageRecipe', `data-id="${esc(f.id)}"`)).join('') || '<p class="muted center">Noch keine Rezepte.</p>';
      return `${sheetHead('Rezepte', '<button class="txt-btn" data-act="closeSheet">Fertig</button>', '<button class="txt-btn bold" data-act="newRecipe">Neu</button>')}<div class="food-list">${list}</div>`;
    }
    const tpl = Object.values(S.templates);
    list = tpl.map(t => `<div class="list-row"><div><b>${esc(t.name)}</b><small>${t.items.map(e => esc(e.name)).join(', ')}</small></div><button class="icon-btn" data-act="tplDelete" data-id="${t.id}" aria-label="Löschen" style="color:var(--danger)">${I.trash}</button></div>`).join('');
    return `${sheetHead('Mahlzeiten-Vorlagen', '<button class="txt-btn" data-act="closeSheet">Fertig</button>')}<section class="card">${list || '<p class="muted">Vorlagen speicherst du im Tagebuch über „…“ an einer Mahlzeit.</p>'}</section>`;
  }, { kind }, 'full');
}

/* ============================== Sync ================================ */

/** Holt die Script-URL aus beliebig eingefügtem Text (Leerzeichen, Zeilenumbrüche, <…> usw.). */
function cleanScriptUrl(v) {
  const s = String(v || '').replace(/\s+/g, '');
  const m = /https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/(exec|dev)/.exec(s);
  return m ? m[0] : s;
}
function shortScriptUrl(u) {
  const m = /\/s\/([A-Za-z0-9_-]+)\/(\w+)$/.exec(u || '');
  if (!m) return u ? (u.length > 48 ? u.slice(0, 24) + '…' + u.slice(-20) : u) : '–';
  return `…/s/${m[1].slice(0, 8)}…${m[1].slice(-6)}/${m[2]} (${m[1].length} Zeichen)`;
}

async function api(action, payload) {
  const token = String(S.settings.token || '').trim();
  const scriptUrl = cleanScriptUrl(S.settings.scriptUrl);
  if (!scriptUrl) throw new Error('Bitte zuerst unter „Mehr“ die Web-App-URL eintragen.');
  if (/\/dev$/.test(scriptUrl)) throw new Error('Das ist die Test-URL (endet auf /dev). Bitte die URL der Bereitstellung verwenden – sie endet auf /exec.');
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{30,}\/exec$/.test(scriptUrl)) {
    throw new Error(`Die gespeicherte URL ist unvollständig: ${shortScriptUrl(scriptUrl)}. Sie muss so aussehen: https://script.google.com/macros/s/…/exec`);
  }
  let res;
  try {
    res = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token, action, payload }), redirect: 'follow' });
  } catch (e) {
    if (navigator.onLine === false) throw new Error('Keine Internetverbindung.');
    // Diagnose: antwortet die URL überhaupt?
    let reachable = false;
    try { const g = await fetch(scriptUrl); const j = await g.json(); reachable = !!(j && j.app === 'PIP Tracker Sync'); } catch (e2) { reachable = false; }
    throw new Error(reachable
      ? 'Script erreichbar, aber die Anfrage wurde abgebrochen. Bitte App ganz schließen, neu öffnen und erneut versuchen.'
      : `Script unter dieser URL nicht erreichbar: ${shortScriptUrl(scriptUrl)}. Bitte URL neu einfügen.`);
  }
  if (!res.ok) throw new Error('Script-Fehler (HTTP ' + res.status + ').');
  const txt = await res.text();
  let j;
  try { j = JSON.parse(txt); } catch (e) { throw new Error('Unerwartete Antwort – prüfe URL und Bereitstellung („Zugriff: Jeder“).'); }
  if (!j.ok) throw new Error(j.error || 'Unbekannter Fehler im Script.');
  return j;
}

function dayPayload(d) {
  const f = {};
  const put = (k, v) => { if (v !== null && v !== undefined && v !== '') f[k] = v; };
  DAY_FIELDS.forEach(k => put(k, d[k]));
  if (!d.training) put('training', autoTrainingLabel(d.date));
  const t = dayTotals(d);
  if (t.fromFoods) {
    f.protein = Math.round(t.p); f.carbs = Math.round(t.c); f.fat = Math.round(t.f);
    f.fiber = Math.round(t.fiber); f.fv = Math.round(t.fv); f.feedings = t.feedings;
  } else {
    MACRO_FIELDS.forEach(k => put(k, d.manual[k]));
  }
  if (f.cardioMin !== undefined) f.cardioMin = num(f.cardioMin);
  if (f.posingMin !== undefined) f.posingMin = num(f.posingMin);
  (d.cleared || []).forEach(k => { if (!(k in f)) f[k] = ''; });
  return Object.keys(f).length ? { date: d.date, fields: f } : null;
}

function workoutPayload(w) {
  const meta = w.meta || { rows: {} };
  const muscleLastRow = {};
  Object.keys(w.rows).map(Number).sort((a, b) => a - b).forEach(row => {
    const m = meta.rows[row] && meta.rows[row].muscle;
    if (m) muscleLastRow[m] = row;
  });
  const rows = Object.entries(w.rows).map(([row, st]) => {
    row = Number(row);
    const info = meta.rows[row] || {};
    const rirArr = splitList(info.rir);
    const sets = (st.sets || []).map((s, i) => ({
      load: s.load === undefined ? '' : s.load, reps: s.reps === undefined ? '' : s.reps, rir: s.rir === undefined ? '' : s.rir,
      targetRir: rirArr[i] !== undefined ? rirArr[i] : (rirArr[rirArr.length - 1] || ''),
    }));
    const parts = [];
    if (st.note) parts.push(st.note);
    if (info.muscle && muscleLastRow[info.muscle] === row && w.feedback[info.muscle]) parts.push('Feedback ' + info.muscle + ': ' + feedbackText(w.feedback[info.muscle]));
    return { row, name: info.name || '', muscle: info.muscle || '', targetReps: info.reps || '', sets, note: parts.join(' · ') };
  }).filter(r => r.name);
  if (!rows.length && !w.finishedAt) return null;
  return {
    key: w.key, meso: w.meso, week: w.week, day: w.day, date: w.date || '', headerRow: meta.headerRow || null, rpeRow: meta.rpeRow || null,
    rpe: w.rpe || null, duration: w.durationMin ? fmtDur(w.durationMin) : null, rows,
  };
}

function mergeSheetDay(sd) {
  const local = S.days[sd.date];
  if (local && isDirty(local)) return;
  const d = getDay(sd.date, true);
  DAY_FIELDS.forEach(k => { const v = sd[k]; if (v === null || v === undefined || v === '') delete d[k]; else d[k] = v; });
  MACRO_FIELDS.forEach(k => { const v = sd[k]; if (v === null || v === undefined || v === '') delete d.manual[k]; else d.manual[k] = v; });
  d.cleared = [];
  d.updatedAt = d.syncedAt = Date.now();
}

function applyTargetsFromSheet(tg) {
  ['td', 'ntd'].forEach(type => {
    const s = tg && tg[type];
    if (!s) return;
    ['protein', 'carbs', 'fat', 'fiber', 'feedings'].forEach(k => { if (s[k] !== null && s[k] !== undefined) S.settings.targets[type][k] = s[k]; });
  });
}

function applyPull(r) {
  if (r.profile) {
    S.profile = r.profile;
    if (!S.settings.targetsSet && r.profile.targets) applyTargetsFromSheet(r.profile.targets);
    if (r.profile.stepsTarget && S.settings.stepsTarget === DEFAULT_SETTINGS.stepsTarget) S.settings.stepsTarget = r.profile.stepsTarget;
  }
  if (Array.isArray(r.days)) r.days.forEach(mergeSheetDay);
  if (r.plan) {
    if (!S.plan || S.plan.name !== r.plan.name) { ui.trWeek = null; ui.trDay = null; }
    S.plan = r.plan;
  }
  if (r.sizes) {
    if (r.sizes.labels && r.sizes.labels.some(Boolean)) S.sizes.labels = r.sizes.labels;
    (r.sizes.entries || []).forEach(e => {
      if (!e.date) return;
      const local = S.sizes.entries.find(x => x.date === e.date);
      if (!local) S.sizes.entries.push({ date: e.date, values: e.values, updatedAt: Date.now(), syncedAt: Date.now() });
      else if (!isDirty(local)) local.values = e.values;
    });
  }
  if (Array.isArray(r.supplements) && r.supplements.length && !(S.supplements || []).length) {
    S.supplements = r.supplements.map(s => ({ id: uid('sup'), name: s.name, amount: [s.amount, s.pieces].filter(Boolean).join(' '), timing: s.timing || '' }));
  }
  if (r.reha) S.reha = r.reha;
  save();
}

async function syncNow(opts = {}) {
  if (ui.syncing) return;
  if (!S.settings.scriptUrl || !S.settings.token) {
    toast('Bitte zuerst Web-App-URL und Passwort eintragen.', true);
    ui.tab = 'more'; render();
    return;
  }
  ui.syncing = true;
  updateSyncBadge();
  try {
    await flushSave();
    const sentAt = Date.now();
    const dirtyDays = Object.values(S.days).filter(isDirty);
    const dayItems = [];
    dirtyDays.forEach(d => { const p = dayPayload(d); if (p) dayItems.push(p); else d.syncedAt = sentAt; });
    const dirtyW = Object.values(S.workouts).filter(isDirty);
    const wItems = [];
    dirtyW.forEach(w => { const p = workoutPayload(w); if (p) wItems.push(p); else w.syncedAt = sentAt; });
    const dirtySizes = S.sizes.entries.filter(isDirty);
    const payload = {
      days: dayItems, workouts: wItems, sizes: dirtySizes.map(e => ({ date: e.date, values: e.values })),
      pullAfter: { history: true, since: opts.full ? null : addDays(today(), -45) },
    };
    const r = await api('push', payload);
    const wd = new Set(r.written.days), ww = new Set(r.written.workouts), ws = new Set(r.written.sizes);
    dirtyDays.forEach(d => { if (wd.has(d.date) && (d.updatedAt || 0) <= sentAt) { d.syncedAt = sentAt; d.cleared = []; } });
    dirtyW.forEach(w => { if (ww.has(w.key) && (w.updatedAt || 0) <= sentAt) w.syncedAt = sentAt; });
    dirtySizes.forEach(e => { if (ws.has(e.date) && (e.updatedAt || 0) <= sentAt) e.syncedAt = sentAt; });
    applyPull(r);
    S.settings.lastSync = Date.now();
    save();
    const msg = `Synchronisiert ✓ ${r.written.days.length} Tage · ${r.written.workouts.length} Trainings · ${r.written.sizes.length} Maße`;
    if (r.warnings && r.warnings.length) {
      toast(msg + ' – ' + r.warnings.length + ' Hinweis(e)');
      openSheet(() => `${sheetHead('Sync-Hinweise', '<span></span>', '<button class="txt-btn bold" data-act="closeSheet">OK</button>')}<section class="card"><ul class="bullets warn-list">${r.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></section>`);
    } else toast(msg);
  } catch (e) {
    toast('Sync fehlgeschlagen: ' + e.message, true);
  } finally {
    ui.syncing = false;
    render();
  }
}

/* ============================ Backup ================================ */

function exportState() {
  const data = clone(S);
  data.settings.token = '';
  return { app: 'pip-tracker', version: APP_VERSION, exportedAt: new Date().toISOString(), data };
}
function importState(obj) {
  if (!obj || obj.app !== 'pip-tracker' || !obj.data) throw new Error('Keine gültige PIP-Tracker-Sicherung.');
  const token = S.settings.token;
  STATE_KEYS.forEach(k => { if (obj.data[k] !== undefined) S[k] = obj.data[k]; });
  S.settings = Object.assign(clone(DEFAULT_SETTINGS), S.settings);
  if (!S.settings.token) S.settings.token = token;
  save();
}

/* ============================== Aktionen ============================ */

const A = {
  tab(el) {
    ui.tab = el.dataset.v;
    try { localStorage.setItem('pip:tab', ui.tab); } catch (e) { /* egal */ }
    render();
    window.scrollTo(0, 0);
  },
  sync() { syncNow(); },
  fullPull() { syncNow({ full: true }); },
  async testConn() {
    try { await flushSave(); const r = await api('ping', {}); toast(`Verbunden mit „${r.title}“ ✓`); }
    catch (e) { toast(e.message, true); }
  },
  closeSheet() { closeSheet(); },
  dayShift(el) { ui.date = addDays(ui.date, Number(el.dataset.v)); render(); },
  setType(el) {
    const d = getDay(ui.date, true);
    d.type = el.dataset.v;
    touchDay(d);
    render();
  },
  water(el) {
    const d = getDay(ui.date, true);
    d.water = Math.max(0, (d.water || 0) + Number(el.dataset.v));
    touchDay(d);
    render();
  },
  addFood(el) { openFoodSearch({ target: 'diary', meal: el.dataset.meal, date: ui.date }); },
  editEntry(el) {
    const d = getDay(ui.date);
    const e = d && d.foods.find(x => x.id === el.dataset.id);
    if (!e) return;
    const food = (e.foodId && S.foods[e.foodId]) || { id: e.foodId || 'tmp', kind: e.quick ? 'quick' : 'own', name: e.name, brand: e.brand, per100: e.per100, unit: e.unit };
    if (e.quick) { openQuickAdd({ target: 'diary', meal: e.meal, date: ui.date }, e); return; }
    openAmount(Object.assign({}, food, { per100: e.per100 }), { target: 'diary', meal: e.meal, date: ui.date }, e);
  },
  mealMenu(el) {
    const meal = el.dataset.meal;
    const d = getDay(ui.date);
    const has = d && d.foods.some(e => e.meal === meal);
    const y = S.days[addDays(ui.date, -1)];
    const hasY = y && y.foods.some(e => e.meal === meal);
    openSheet(() => `${sheetHead(MEAL_NAME[meal])}
      <section class="card">
        ${has ? `<button class="list-row" style="width:100%;text-align:left" data-act="saveTemplate" data-meal="${meal}"><div><b>Als Vorlage speichern</b><small>Mit einem Tipp wieder eintragen</small></div>${I.right}</button>` : ''}
        ${hasY ? `<button class="list-row" style="width:100%;text-align:left" data-act="copyYesterday" data-meal="${meal}"><div><b>Von gestern kopieren</b><small>${y.foods.filter(e => e.meal === meal).length} Einträge</small></div>${I.right}</button>` : ''}
        <button class="list-row" style="width:100%;text-align:left" data-act="addFoodFromMenu" data-meal="${meal}"><div><b>Lebensmittel hinzufügen</b></div>${I.right}</button>
        ${has ? `<button class="list-row" style="width:100%;text-align:left;color:var(--danger)" data-act="clearMeal" data-meal="${meal}"><div><b>Alle Einträge löschen</b></div></button>` : ''}
      </section>`);
  },
  addFoodFromMenu(el) { closeSheet(); openFoodSearch({ target: 'diary', meal: el.dataset.meal, date: ui.date }); },
  saveTemplate(el) {
    const meal = el.dataset.meal;
    const d = getDay(ui.date);
    const items = d.foods.filter(e => e.meal === meal).map(e => { const c = clone(e); delete c.id; delete c.meal; return c; });
    const name = window.prompt('Name der Vorlage', MEAL_NAME[meal]);
    if (!name) return;
    const id = uid('tpl');
    S.templates[id] = { id, name: name.trim(), items };
    save('templates');
    closeSheet();
    toast('Vorlage gespeichert');
  },
  copyYesterday(el) {
    const meal = el.dataset.meal;
    const y = S.days[addDays(ui.date, -1)];
    const d = getDay(ui.date, true);
    y.foods.filter(e => e.meal === meal).forEach(e => d.foods.push(Object.assign(clone(e), { id: uid('e') })));
    touchDay(d);
    closeSheet();
    render();
    toast('Kopiert');
  },
  clearMeal(el) {
    if (!window.confirm('Alle Einträge dieser Mahlzeit löschen?')) return;
    const d = getDay(ui.date);
    d.foods = d.foods.filter(e => e.meal !== el.dataset.meal);
    if (!d.foods.length) markMacrosCleared(d);
    touchDay(d);
    closeSheet();
    render();
  },
  foodTab(el) { const st = topSheet().state; st.tab = el.dataset.v; refreshSheet(); },
  pickFood(el) {
    const st = topSheet().state;
    const f = S.foods[el.dataset.id];
    if (f) openAmount(f, st.ctx);
  },
  pickOff(el) {
    const st = topSheet().state;
    const f = st.off && st.off[Number(el.dataset.i)];
    if (f) openAmount(Object.assign({}, S.foods[f.id] || {}, f), st.ctx);
  },
  async offSearch() {
    const s = topSheet();
    if (!s || !s.state.q) return;
    const st = s.state;
    const q = st.q;
    st.offLoading = true; st.offErr = null;
    const list = $('#foodList'); if (list) list.innerHTML = foodListHTML(st);
    try {
      const res = await offSearch(q);
      if (st.q !== q) return;
      st.off = res;
    } catch (e) { st.offErr = e.message; }
    st.offLoading = false;
    if (topSheet() === s) { const l = $('#foodList'); if (l) l.innerHTML = foodListHTML(st); }
  },
  scan() { const st = topSheet().state; unlockAudio(); openScanner(st.ctx); },
  newFood() { const st = topSheet().state; openFoodForm(null, st.ctx); },
  newFoodPlain() { openFoodForm(null, null); },
  quickAdd() { const st = topSheet().state; openQuickAdd(st.ctx); },
  useTemplate(el) {
    const st = topSheet().state;
    const t = S.templates[el.dataset.id];
    const d = getDay(st.ctx.date, true);
    t.items.forEach(e => d.foods.push(Object.assign(clone(e), { id: uid('e'), meal: st.ctx.meal })));
    touchDay(d);
    closeAllSheets();
    render();
    toast(`„${t.name}“ eingetragen`);
  },
  amtSet(el) {
    const st = topSheet().state;
    st.grams = String(el.dataset.v).replace('.', ',');
    const inp = $('#amtG'); if (inp) inp.value = st.grams;
    const pv = $('#amtPreview'); if (pv) pv.innerHTML = amountPreviewHTML(st);
  },
  toggleFav() {
    const st = topSheet().state;
    const id = st.food.id;
    if (S.favorites.includes(id)) S.favorites = S.favorites.filter(x => x !== id);
    else { S.favorites.unshift(id); if (!S.foods[id] && st.food.kind !== 'quick') S.foods[id] = clone(st.food); }
    save('favorites', 'foods');
    refreshSheet();
  },
  amtSave() {
    const st = topSheet().state;
    const g = num(st.grams);
    if (!g || g <= 0) { toast('Bitte eine Menge eingeben.', true); return; }
    const f = st.food;
    if (st.ctx.target === 'recipe') {
      const rs = sheets.find(s => s.render === renderRecipe);
      if (rs) rs.state.r.items.push({ foodId: f.id, name: f.name, grams: g, per100: clone(f.per100) });
      rememberFood(f, g);
      while (topSheet() && topSheet().render !== renderRecipe) sheets.pop();
      drawSheets();
      return;
    }
    const d = getDay(st.ctx.date || ui.date, true);
    if (st.entry) {
      const e = d.foods.find(x => x.id === st.entry.id);
      if (e) { e.grams = g; e.fv = st.fv; e.meal = st.meal; }
    } else {
      d.foods.push({ id: uid('e'), meal: st.meal, foodId: f.id, name: f.name, brand: f.brand || '', grams: g, per100: clone(f.per100), fv: st.fv, unit: f.unit || 'g' });
    }
    d.cleared = d.cleared.filter(k => !MACRO_FIELDS.includes(k));
    rememberFood(f, g);
    touchDay(d);
    closeAllSheets();
    render();
    if (!st.entry) toast(`${f.name} hinzugefügt`);
  },
  amtDelete() {
    const st = topSheet().state;
    const d = getDay(st.ctx.date || ui.date);
    d.foods = d.foods.filter(x => x.id !== st.entry.id);
    if (!d.foods.length) markMacrosCleared(d);
    touchDay(d);
    closeAllSheets();
    render();
  },
  editFoodFromAmount() {
    const st = topSheet().state;
    const f = S.foods[st.food.id] || st.food;
    const copy = clone(f);
    if (copy.kind === 'off') { copy.kind = 'own'; copy.id = uid('own:'); }
    closeSheet();
    openFoodForm(copy, st.entry ? null : st.ctx);
  },
  foodFormSave() {
    const st = topSheet().state;
    const f = st.f;
    if (!String(f.name || '').trim()) { toast('Bitte einen Namen eingeben.', true); return; }
    f.name = f.name.trim();
    ['p', 'c', 'f', 'fiber'].forEach(k => { f.per100[k] = num(f.per100[k]) || 0; });
    f.serving = num(f.serving) || null;
    f.kind = f.kind === 'recipe' ? 'recipe' : 'own';
    S.foods[f.id] = f;
    save('foods');
    closeSheet();
    if (st.ctx) openAmount(f, st.ctx);
    else if (topSheet()) refreshSheet();
    else render();
    toast('Gespeichert');
  },
  foodDelete() {
    const st = topSheet().state;
    if (!window.confirm(`„${st.f.name}“ löschen? Bereits eingetragene Mahlzeiten bleiben erhalten.`)) return;
    if (S.foods[st.f.id]) S.foods[st.f.id].deleted = true;
    S.favorites = S.favorites.filter(x => x !== st.f.id);
    S.recent = S.recent.filter(x => x !== st.f.id);
    save('foods', 'favorites', 'recent');
    closeSheet();
    if (topSheet()) refreshSheet(); else render();
  },
  manage(el) { openManage(el.dataset.v); },
  manageFood(el) { openFoodForm(S.foods[el.dataset.id], null); },
  manageRecipe(el) { openRecipe(S.foods[el.dataset.id]); },
  newRecipe() { openRecipe(null); },
  recipeAddItem() { openFoodSearch({ target: 'recipe' }); },
  recipeDelItem(el) { const st = topSheet().state; st.r.items.splice(Number(el.dataset.i), 1); refreshSheet(); },
  recipeSave() {
    const st = topSheet().state;
    const r = st.r;
    if (!String(r.name || '').trim()) { toast('Bitte einen Namen eingeben.', true); return; }
    if (!r.items.length) { toast('Bitte mindestens eine Zutat hinzufügen.', true); return; }
    const calc = recipePer100(r);
    r.name = r.name.trim();
    r.per100 = calc.per100;
    r.totalWeight = num(r.totalWeight) || null;
    S.foods[r.id] = r;
    save('foods');
    closeSheet();
    if (topSheet()) refreshSheet(); else render();
    toast('Rezept gespeichert');
  },
  recipeDelete() {
    const st = topSheet().state;
    if (!window.confirm(`Rezept „${st.r.name}“ löschen?`)) return;
    if (S.foods[st.r.id]) S.foods[st.r.id].deleted = true;
    save('foods');
    closeSheet();
    if (topSheet()) refreshSheet(); else render();
  },
  tplDelete(el) {
    if (!window.confirm('Vorlage löschen?')) return;
    delete S.templates[el.dataset.id];
    save('templates');
    refreshSheet();
  },
  quickSave() {
    const st = topSheet().state;
    const v = k => num(st[k]) || 0;
    if (!v('p') && !v('c') && !v('f')) { toast('Bitte mindestens einen Makro-Wert eingeben.', true); return; }
    const d = getDay(st.ctx.date || ui.date, true);
    const data = { name: (st.name || '').trim() || 'Schnelleintrag', grams: 100, per100: { p: v('p'), c: v('c'), f: v('f'), fiber: v('fiber') }, quick: true, unit: 'x', fv: false };
    if (st.entry) Object.assign(d.foods.find(x => x.id === st.entry.id) || {}, data);
    else d.foods.push(Object.assign({ id: uid('e'), meal: st.ctx.meal }, data));
    d.cleared = d.cleared.filter(k => !MACRO_FIELDS.includes(k));
    touchDay(d);
    closeAllSheets();
    render();
  },
  quickDelete() {
    const st = topSheet().state;
    const d = getDay(st.ctx.date || ui.date);
    d.foods = d.foods.filter(x => x.id !== st.entry.id);
    if (!d.foods.length) markMacrosCleared(d);
    touchDay(d);
    closeAllSheets();
    render();
  },
  setField(el) {
    const d = getDay(ui.date);
    const f = el.dataset.f;
    let v = el.dataset.v;
    if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
    const cur = d ? d[f] : undefined;
    setDayField(ui.date, f, String(cur) === String(v) ? null : v);
    render();
  },
  sleepStep(el) {
    const d = getDay(ui.date);
    const cur = sleepNum(d && d.sleepH);
    const base = cur === null ? 7.5 : cur + Number(el.dataset.v);
    setDayField(ui.date, 'sleepH', clamp(base, 0, 16));
    render();
  },
  hist(el) { ui.hist = el.dataset.v; render(); },
  range(el) { ui.range = Number(el.dataset.v); render(); },
  moreWeeks() { ui.weeksShown += 12; render(); },
  newSizes() { openSizes(null); },
  editSizes(el) { openSizes(el.dataset.date); },
  sizesSave() {
    const st = topSheet().state;
    if (!st.date) { toast('Bitte ein Datum wählen.', true); return; }
    const vals = st.values.map(v => num(v));
    if (!vals.some(v => v !== null)) { toast('Bitte mindestens einen Wert eintragen.', true); return; }
    if (st.orig && st.orig !== st.date) S.sizes.entries = S.sizes.entries.filter(e => e.date !== st.orig);
    let e = S.sizes.entries.find(x => x.date === st.date);
    if (!e) { e = { date: st.date, values: [] }; S.sizes.entries.push(e); }
    e.values = vals;
    e.updatedAt = Date.now();
    save('sizes');
    closeSheet();
    render();
  },
  sizesDelete() {
    const st = topSheet().state;
    if (!window.confirm('Messung in der App löschen? (Im Sheet bleibt sie stehen.)')) return;
    S.sizes.entries = S.sizes.entries.filter(e => e.date !== st.orig);
    save('sizes');
    closeSheet();
    render();
  },
  trWeek(el) { ui.trWeek = Number(el.dataset.v); render(); },
  trDay(el) { ui.trDay = Number(el.dataset.v); render(); window.scrollTo(0, 0); },
  setDone(el) {
    unlockAudio();
    const P = S.plan, day = currentDay(), wk = ui.trWeek;
    const r = day.rows.find(x => x.row === Number(el.dataset.row));
    if (!r) return;
    const w = getWorkout(wk, day, true);
    const st = rowState(w, r, wk);
    const i = Number(el.dataset.i);
    const s = st.sets[i];
    if (s.done) { s.done = false; touchWorkout(w); render(); return; }
    const prev = prevPerf(r, wk, day.idx);
    const pv = prev[i] || prev[prev.length - 1] || {};
    if ((s.load === undefined || s.load === '') && pv.load !== undefined && pv.load !== '') s.load = num(pv.load) !== null ? num(pv.load) : pv.load;
    if ((s.reps === undefined || s.reps === '') && pv.reps !== undefined && pv.reps !== '') s.reps = num(pv.reps) !== null ? num(pv.reps) : pv.reps;
    s.done = true;
    if (!w.startedAt) w.startedAt = Date.now();
    if (!w.date) w.date = today();
    touchWorkout(w);
    const d = getDay(w.date, true);
    if (!d.training) { d.updatedAt = Date.now(); save('days'); }
    render();
    startRest(S.settings.restSec || 120);
    checkMuscleFeedback(w, day, wk, r.muscle);
  },
  restAdj(el) { timer.end += Number(el.dataset.v) * 1000; timer.fired = false; $('#timer').classList.remove('ring'); tickTimer(); },
  restStop() { stopRest(); },
  exInfo(el) {
    const day = currentDay(), wk = ui.trWeek;
    const r = day.rows.find(x => x.row === Number(el.dataset.row));
    if (!r) return;
    const p = r.weeks[wk] || {};
    const tempo = p.tempo ? tempoText(p.tempo) : '';
    const link = r.link || `https://www.youtube.com/results?search_query=${encodeURIComponent(r.name + ' exercise')}`;
    openSheet(() => `${sheetHead(r.name, '<span></span>', '<button class="txt-btn bold" data-act="closeSheet">Fertig</button>')}
      <section class="card"><span class="pill">${esc(r.muscle)}</span>
        <p style="margin:10px 0 0"><b>Vorgabe Woche ${wk}:</b> ${p.sets} × ${esc(p.reps)} Wdh · RIR ${esc(p.rir || '–')}</p>
        ${p.tempo ? `<p class="muted" style="margin:6px 0 0"><b>Tempo ${esc(p.tempo)}</b> – ${esc(tempo)}</p>` : ''}</section>
      ${r.info ? `<div class="sub-title">Technik-Hinweise vom Coach</div><section class="card"><p style="margin:0;white-space:pre-line">${esc(r.info.split(' / ').join('\n• ').replace(/^/, '• '))}</p></section>` : ''}
      <a class="btn block" href="${esc(link)}" target="_blank" rel="noopener">${I.link}${r.link ? 'Technik-Video öffnen' : 'Video suchen'}</a>`);
  },
  feedback(el) { openFeedback(el.dataset.m); },
  fbSet(el) { const st = topSheet().state; st.draft[el.dataset.k] = Number(el.dataset.v); refreshSheet(); },
  fbSave() {
    const st = topSheet().state;
    const w = S.workouts[st.wkKey];
    w.feedback[st.muscle] = st.draft;
    touchWorkout(w);
    closeSheet();
    render();
  },
  finishWorkout() {
    const day = currentDay(), wk = ui.trWeek;
    const w = getWorkout(wk, day, true);
    const dur = w.durationMin || (w.startedAt ? clamp(Math.round((Date.now() - w.startedAt) / 60000), 1, 300) : '');
    openSheet(st => `${sheetHead('Training abschließen', undefined, '<button class="txt-btn bold" data-act="finishSave">Fertig</button>')}
      <section class="card"><b>Session-RPE</b><p class="muted small" style="margin:2px 0 10px">Wie anstrengend war die Einheit insgesamt? (10 = maximal)</p>
        <div class="chips">${[5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(v => `<button class="chip sm ${st.rpe === v ? 'on' : ''}" data-act="finRpe" data-v="${v}">${String(v).replace('.', ',')}</button>`).join('')}</div></section>
      <section class="card"><div class="grid2">
        <label class="field"><span>Dauer (Minuten)</span><input class="input" inputmode="numeric" data-fin="dur" value="${esc(st.dur)}"></label>
        <label class="field"><span>Datum</span><input class="input" type="date" data-fin="date" value="${esc(st.date)}"></label>
      </div></section>
      <p class="muted small">Beim nächsten Sync landen Gewichte, Wiederholungen, RIR, Notizen, Session-RPE und Dauer im Sheet (Mesocycle-Blatt + Tab „Training Log“).</p>`,
    { rpe: w.rpe || null, dur: String(dur), date: w.date || today(), wkKey: w.key });
  },
  finRpe(el) { const st = topSheet().state; st.rpe = Number(el.dataset.v); refreshSheet(); },
  finishSave() {
    const st = topSheet().state;
    const w = S.workouts[st.wkKey];
    const oldDate = w.date;
    w.rpe = st.rpe;
    w.durationMin = num(st.dur) || null;
    w.date = st.date || today();
    w.finishedAt = w.finishedAt || Date.now();
    touchWorkout(w);
    [oldDate, w.date].filter(Boolean).forEach(dt => { const d = getDay(dt, true); if (!d.training) touchDay(d); });
    stopRest();
    closeSheet();
    render();
    toast('Training gespeichert 💪');
  },
  targetsFromSheet() {
    applyTargetsFromSheet(S.profile.targets);
    S.settings.targetsSet = false;
    save('settings');
    render();
    toast('Ziele aus dem Sheet übernommen');
  },
  suppAdd() { S.supplements = S.supplements || []; S.supplements.push({ id: uid('sup'), name: '', amount: '', timing: '' }); save('supplements'); render(); },
  suppDel(el) { S.supplements = S.supplements.filter(s => s.id !== el.dataset.id); save('supplements'); render(); },
  async backupDrive() {
    try { await flushSave(); const r = await api('backupSave', { data: JSON.stringify(exportState()) }); toast(`In Google Drive gesichert (${nf(r.size / 1024)} KB)`); }
    catch (e) { toast(e.message, true); }
  },
  async restoreDrive() {
    try {
      const r = await api('backupLoad', {});
      if (!window.confirm(`Backup vom ${fmtDateTime(r.updated)} laden? Die Daten in der App werden ersetzt.`)) return;
      importState(JSON.parse(r.data));
      render();
      toast('Backup wiederhergestellt');
    } catch (e) { toast(e.message, true); }
  },
  async exportFile() {
    const blob = new Blob([JSON.stringify(exportState())], { type: 'application/json' });
    const name = `PIP-Tracker-${today()}.json`;
    try {
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
};

function markMacrosCleared(d) {
  MACRO_FIELDS.forEach(k => { if (d.manual[k] === undefined && !d.cleared.includes(k)) d.cleared.push(k); });
}

function tempoText(t) {
  const p = String(t).split('-');
  if (p.length !== 4) return '';
  const part = (x, what) => /^x$/i.test(x) ? `${what} explosiv` : /^\d+$/.test(x) ? `${what} ${x} s` : `${what} ${x}`;
  return [part(p[0], 'Exzentrik'), part(p[1], 'Pause unten'), part(p[2], 'Konzentrik'), part(p[3], 'Pause oben')].join(' · ');
}

function openQuickAdd(ctx, entry) {
  const p = entry ? entry.per100 : {};
  const v = x => x === undefined || x === null ? '' : String(x).replace('.', ',');
  openSheet(st => `${sheetHead('Schnelleintrag', undefined, '<button class="txt-btn bold" data-act="quickSave">Sichern</button>')}
    <section class="card">
      <label class="field"><span>Bezeichnung (optional)</span><input class="input" data-q="name" value="${esc(st.name)}" placeholder="z. B. Restaurant"></label>
      <div class="grid2">
        <label class="field"><span>Protein (g)</span><input class="input" inputmode="decimal" data-q="p" value="${esc(st.p)}"></label>
        <label class="field"><span>Kohlenhydrate (g)</span><input class="input" inputmode="decimal" data-q="c" value="${esc(st.c)}"></label>
        <label class="field"><span>Fett (g)</span><input class="input" inputmode="decimal" data-q="f" value="${esc(st.f)}"></label>
        <label class="field"><span>Ballaststoffe (g)</span><input class="input" inputmode="decimal" data-q="fiber" value="${esc(st.fiber)}"></label>
      </div>
    </section>
    ${st.entry ? '<button class="btn danger block" data-act="quickDelete">Eintrag löschen</button>' : ''}`,
  { ctx, entry, name: entry ? entry.name : '', p: v(p.p), c: v(p.c), f: v(p.f), fiber: v(p.fiber) });
}

/* ============================== Events ============================== */

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(el, e);
});

document.addEventListener('submit', e => {
  const f = e.target.closest('[data-submit]');
  if (!f) return;
  e.preventDefault();
  if (f.dataset.submit === 'offSearch') { const q = $('#foodQ'); if (q) q.blur(); A.offSearch(); }
  if (f.dataset.submit === 'manualCode') { const v = $('#manualCode').value.replace(/\D/g, ''); if (v) handleBarcode(v, topSheet().state.ctx); }
});

document.addEventListener('input', e => {
  const el = e.target;
  const s = topSheet();
  if (el.dataset.in === 'foodQ' && s) {
    s.state.q = el.value.trim();
    s.state.off = null; s.state.offErr = null;
    const list = $('#foodList'); if (list) list.innerHTML = foodListHTML(s.state);
    const chips = $('.sheet .chips.scroll');
    if (chips) chips.classList.toggle('hidden', !!s.state.q);
  } else if (el.dataset.in === 'amtG' && s) {
    s.state.grams = el.value;
    const pv = $('#amtPreview'); if (pv) pv.innerHTML = amountPreviewHTML(s.state);
  } else if (el.dataset.ff && s) {
    setPath(s.state.f, el.dataset.ff, el.type === 'checkbox' ? el.checked : el.value);
    if (el.dataset.ff.startsWith('per100')) {
      const k = $('#ffKcal');
      const p = s.state.f.per100;
      if (k) k.textContent = `= ${nf(kcalOf(num(p.p), num(p.c), num(p.f)))} kcal (P/K × 4,1 · F × 9,3)`;
    }
  } else if (el.dataset.rf && s) {
    s.state.r[el.dataset.rf] = el.value;
  } else if (el.dataset.q && s) {
    s.state[el.dataset.q] = el.value;
  } else if (el.dataset.sz && s) {
    if (el.dataset.sz === 'date') s.state.date = el.value; else s.state.values[Number(el.dataset.sz)] = el.value;
  } else if (el.dataset.fin && s) {
    s.state[el.dataset.fin] = el.value;
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  const s = topSheet();
  if (el.dataset.field) {
    let v = el.value.trim();
    const f = el.dataset.field;
    if (['weight', 'steps', 'cardioMin', 'posingRounds', 'posingMin'].includes(f)) v = num(v);
    if (f === 'weight' && v !== null && !getDay(ui.date, false)?.time) {
      const n = new Date();
      if (ui.date === today()) setDayField(ui.date, 'time', `${pad(n.getHours())}:${pad(n.getMinutes())}`);
    }
    setDayField(ui.date, f, v === '' ? null : v);
    if (f === 'weight' || f === 'training') render();
  } else if (el.dataset.manual) {
    setManual(ui.date, el.dataset.manual, num(el.value));
  } else if (el.dataset.set) {
    const [row, i, field] = el.dataset.set.split('|');
    const day = currentDay(), wk = ui.trWeek;
    const r = day.rows.find(x => x.row === Number(row));
    if (!r) return;
    const w = getWorkout(wk, day, true);
    const st = rowState(w, r, wk);
    const raw = el.value.trim();
    st.sets[Number(i)][field] = raw === '' ? '' : (num(raw) !== null ? num(raw) : raw);
    if (!w.date) w.date = today();
    touchWorkout(w);
  } else if (el.dataset.note) {
    const day = currentDay(), wk = ui.trWeek;
    const r = day.rows.find(x => x.row === Number(el.dataset.note));
    if (!r) return;
    const w = getWorkout(wk, day, true);
    rowState(w, r, wk).note = el.value.trim();
    touchWorkout(w);
  } else if (el.dataset.setting) {
    let v = el.value.trim();
    if (el.dataset.num) v = num(v);
    if (el.dataset.setting === 'scriptUrl') v = cleanScriptUrl(v);
    setPath(S.settings, el.dataset.setting, v === '' ? null : v);
    if (el.dataset.setting.startsWith('targets.') || el.dataset.setting === 'scriptUrl') {
      if (el.dataset.setting.startsWith('targets.')) S.settings.targetsSet = true;
      render();
    }
    save('settings');
  } else if (el.dataset.supp) {
    const [id, field] = el.dataset.supp.split('|');
    const sp = S.supplements.find(x => x.id === id);
    if (sp) { sp[field] = el.value.trim(); save('supplements'); }
  } else if (el.dataset.ff && s) {
    setPath(s.state.f, el.dataset.ff, el.type === 'checkbox' ? el.checked : el.value);
    if (el.dataset.ff === 'unit') refreshSheet();
  } else if (el.dataset.ch) {
    const k = el.dataset.ch;
    if (k === 'pickDate') { if (el.value) { ui.date = el.value; render(); } }
    else if (k === 'amtFv' && s) s.state.fv = el.checked;
    else if (k === 'amtMeal' && s) s.state.meal = el.value;
    else if (k === 'supp' || k === 'reha') {
      const d = getDay(ui.date, true);
      const map = k === 'supp' ? d.supps : d.reha;
      if (el.checked) map[el.dataset.id] = true; else delete map[el.dataset.id];
      touchDay(d);
    } else if (k === 'rehaGroup') {
      const set = new Set(S.settings.rehaGroups || []);
      if (el.checked) set.add(el.dataset.id); else set.delete(el.dataset.id);
      S.settings.rehaGroups = [...set];
      save('settings');
    } else if (k === 'importFile') {
      const file = el.files && el.files[0];
      if (!file) return;
      file.text().then(txt => {
        if (!window.confirm('Sicherung importieren? Die Daten in der App werden ersetzt.')) return;
        importState(JSON.parse(txt));
        render();
        toast('Import erfolgreich');
      }).catch(err => toast('Import fehlgeschlagen: ' + err.message, true));
    }
  }
});

function setPath(obj, path, v) {
  const ks = path.split('.');
  let o = obj;
  ks.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; });
  o[ks[ks.length - 1]] = v;
}

window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushSave();
  else if (ui.date !== today() && !sheets.length && (ui.tab === 'diary' || ui.tab === 'checkin')) {
    // App am nächsten Tag wieder geöffnet → auf heute springen
    ui.date = today(); render();
  }
});

/* ============================== Start =============================== */

(async function init() {
  await loadState();
  ui.date = today();
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost') {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) { /* egal */ }
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* egal */ }
})();
