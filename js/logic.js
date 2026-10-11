'use strict';
// Расчёты: подходы и рекорды, серии, сила привычки, матч-отчёт, вызов недели.
// Скрипты подключаются в index.html по порядку и видят общие имена друг друга.

// ---------- Количество: подходы ----------
const isCount = (h) => !!(h && h.unit && UNITS[h.unit]);
const unitShort = (h) => (isCount(h) ? UNITS[h.unit].short : '');
const setsOf = (id, k) => (state.vals[k] && state.vals[k][id]) || [];
const sumOf = (id, k) => setsOf(id, k).reduce((a, b) => a + b, 0);
// Лучший результат за день (рекорд); exceptKey — не учитывать этот день
function bestOf(id, exceptKey) {
  let best = { v: 0, k: null };
  for (const k of Object.keys(state.vals)) {
    if (k === exceptKey) continue;
    const s = sumOf(id, k);
    if (s > best.v || (s === best.v && s > 0 && k < best.k)) best = { v: s, k };
  }
  return best;
}
// Сколько раз рекорд был побит (первый результат рекордом не считается)
function recordsBroken(id) {
  let max = 0, n = 0;
  for (const k of Object.keys(state.vals).sort()) {
    const s = sumOf(id, k);
    if (s > max) { if (max > 0) n++; max = s; }
  }
  return n;
}

function setDone(id, k, on) {
  const arr = state.log[k] || [];
  const i = arr.indexOf(id);
  if (on && i < 0) arr.push(id);
  if (!on && i >= 0) arr.splice(i, 1);
  if (arr.length) state.log[k] = arr; else delete state.log[k];
}
// Отметка задним числом раньше даты создания — привычка «была» уже тогда
function touch(h, k) { if (k < h.createdAt) h.createdAt = k; }

function toggle(id, k) {
  const h = habitById(id);
  if (h) touch(h, k);
  const was = isDone(id, k);
  setDone(id, k, !was);
  save();
  return !was;
}
// Шайба за количественную привычку — только когда набрана норма
function syncCount(h, k) { setDone(h.id, k, sumOf(h.id, k) >= h.goal); }

function addSet(h, k, v) {
  touch(h, k);
  const before = sumOf(h.id, k);
  const wasDone = isDone(h.id, k);
  const prevBest = bestOf(h.id, k).v;
  state.vals[k] = state.vals[k] || {};
  state.vals[k][h.id] = [...setsOf(h.id, k), v];
  syncCount(h, k);
  save();
  const after = before + v;
  return {
    scored: !wasDone && isDone(h.id, k),
    record: prevBest > 0 && before <= prevBest && after > prevBest,
  };
}
function removeSet(h, k, idx) {
  const sets = setsOf(h.id, k).filter((_, i) => i !== idx);
  if (sets.length) state.vals[k][h.id] = sets;
  else if (state.vals[k]) {
    delete state.vals[k][h.id];
    if (!Object.keys(state.vals[k]).length) delete state.vals[k];
  }
  syncCount(h, k);
  save();
}

// ---------- Серии: дни пропуска серию не ломают ----------
function streak(id) {
  let d = today();
  if (!isDone(id, dkey(d))) d = addDays(d, -1);
  let n = 0;
  for (;;) {
    const k = dkey(d);
    if (isDone(id, k)) n++;
    else if (!isSkip(k)) break;
    d = addDays(d, -1);
  }
  return n;
}
function bestStreak(id) {
  const days = Object.keys(state.log).filter((k) => state.log[k].includes(id)).sort();
  if (!days.length) return 0;
  let best = 0, run = 0;
  const end = days[days.length - 1];
  for (let d = parseKey(days[0]); dkey(d) <= end; d = addDays(d, 1)) {
    const k = dkey(d);
    if (isDone(id, k)) { run++; best = Math.max(best, run); } else if (!isSkip(k)) run = 0;
  }
  return best;
}

// ---------- Сила привычки (как в Loop): 0–100%, пропуск снижает плавно ----------
// Каждый день сила сдвигается к 100% (выполнено) или к 0% (пропущено);
// за 13 дней без отметок она падает вдвое, дни пропуска её не меняют.
// Сегодняшний день, пока не отмечен, не считается — его ещё можно успеть.
const STRENGTH_K = Math.pow(0.5, 1 / 13);
function strength(id, upto) {
  const h = habitById(id);
  if (!h) return 0;
  const tk = dkey(today());
  const end = upto && upto < tk ? upto : tk;
  let s = 0;
  for (let d = parseKey(h.createdAt); dkey(d) <= end; d = addDays(d, 1)) {
    const k = dkey(d);
    const on = isDone(id, k);
    if (isSkip(k) || (k === tk && !on)) continue;
    s = s * STRENGTH_K + (on ? 1 - STRENGTH_K : 0);
  }
  return Math.round(s * 100);
}

// ---------- Итоги месяца: матч-отчёт ----------
// upto — по какое число считать (для текущего месяца — по сегодня)
function monthStats(y, m, upto) {
  const n = new Date(y, m + 1, 0).getDate();
  const tk = dkey(today());
  const last = Math.min(n, upto || n);
  let goals = 0, wins = 0, done = 0, all = 0;
  const per = {};
  for (let d = 1; d <= last; d++) {
    const k = dkey(new Date(y, m, d));
    if (k > tk) break;
    goals += doneCount(k);
    if (isWin(k)) wins++;
    if (isSkip(k)) continue;
    activeOn(k).forEach((h) => {
      const p = per[h.id] || (per[h.id] = { h, done: 0, all: 0 });
      p.all++;
      if (isDone(h.id, k)) p.done++;
    });
  }
  const list = Object.values(per).map((p) => ({ ...p, pct: Math.round((p.done / p.all) * 100) }));
  list.forEach((p) => { done += p.done; all += p.all; });
  const sorted = [...list].sort((a, b) => b.pct - a.pct || b.done - a.done);
  const best = sorted[0] && sorted[0].done > 0 ? sorted[0] : null;
  const worst = sorted.length > 1 && sorted[sorted.length - 1].pct < sorted[0].pct ? sorted[sorted.length - 1] : null;
  return { days: last, goals, wins, pct: all ? Math.round((done / all) * 100) : 0, best, worst, empty: !list.length };
}

function reportHTML(y, m) {
  const t = today();
  const isCur = y === t.getFullYear() && m === t.getMonth();
  const cur = monthStats(y, m, isCur ? t.getDate() : 0);
  if (cur.empty) return '<p class="muted">В этом месяце привычек ещё не было.</p>';
  const pm = new Date(y, m - 1, 1);
  // Текущий месяц сравниваем с тем же числом дней прошлого: 1–8 октября против 1–8 сентября
  const prev = monthStats(pm.getFullYear(), pm.getMonth(), isCur ? cur.days : 0);
  const since = `1–${cur.days} ${MONTHS[pm.getMonth()]}`;

  const delta = (a, b, suf = '') => {
    const d = a - b;
    if (prev.empty) return '';
    if (!d) return '<span class="dl same">= как раньше</span>';
    return `<span class="dl ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲ +' : '▼ −'}${Math.abs(d)}${suf}</span>`;
  };
  const card = (title, p, cls) => `
    <div class="rp-card ${cls}" style="--c:${p.h.color}">
      <div class="rp-title">${title}</div>
      <div class="rp-hab"><span aria-hidden="true">${p.h.emoji}</span> ${esc(p.h.name)}</div>
      <div class="rp-sub"><b>${p.pct}%</b> · ${p.done} ${puckWord(p.done)} из ${p.all}</div>
    </div>`;

  return `
    <div class="rp-nums">
      <div><span>🏒 Шайбы</span><b>${cur.goals}</b>${delta(cur.goals, prev.goals)}</div>
      <div><span>📈 Выполнено</span><b>${cur.pct}%</b>${delta(cur.pct, prev.pct, '%')}</div>
      <div><span>🏆 Победы</span><b>${cur.wins}</b>${delta(cur.wins, prev.wins)}</div>
    </div>
    ${noteList([prev.empty ? 'Это первый месяц — сравнивать пока не с чем.' : `▲▼ — сравнение с ${isCur ? since : MONTHS_INS[pm.getMonth()]}.`])}
    <div class="rp-cards">
      ${cur.best ? card('⭐ Лучший игрок', cur.best, 'best') : ''}
      ${cur.worst ? card('🎯 Надо подтянуть', cur.worst, 'worst') : ''}
    </div>
    ${monthNotes(y, m)}`;
}
// Заметки месяца по датам — в отчёте видно, что происходило
function monthNotes(y, m) {
  const pre = `${y}-${pad(m + 1)}-`;
  const keys = Object.keys(state.notes).filter((k) => k.startsWith(pre)).sort();
  if (!keys.length) return '';
  return `<div class="rp-notes">
    <div class="rp-title">📝 Заметки месяца</div>
    <ul>${keys.map((k) => `<li><b>${shortDay(k)}</b>${state.skips[k] ? ` ${SKIPS[state.skips[k]].emoji}` : ''} ${esc(state.notes[k])}</li>`).join('')}</ul>
  </div>`;
}
const shortDay = (k) => { const d = parseKey(k); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}, ${WD[d.getDay()].toLowerCase()}`; };

// ---------- Вызов недели ----------
// Неделя пн–вс. Выбрать вызов можно до четверга, считаются шайбы с понедельника.
const CHAL_DIFF = [
  { label: 'Лёгкий', medal: '🥉', bonus: 3 },
  { label: 'Средний', medal: '🥈', bonus: 5 },
  { label: 'Трудный', medal: '🥇', bonus: 10 },
];
const CHAL_LAST_PICK = 3; // 0 — пн … 3 — чт
const weekStart = (d) => addDays(d, -((d.getDay() + 6) % 7));
const weekDays = (mon) => Array.from({ length: 7 }, (_, i) => dkey(addDays(parseKey(mon), i)));
const weekPucks = (days) => days.reduce((n, k) => n + (state.log[k] || []).length, 0);
const bonusGoals = () => Object.values(state.challenges || {}).reduce((n, c) => n + (c.done ? c.bonus : 0), 0);
let pendingChal = null; // выбор вызова в два нажатия

// Три варианта: лёгкий и трудный — шайбы за неделю, средний — отстающая привычка N дней
function chalOffers(mon) {
  const prev = weekDays(dkey(addDays(parseKey(mon), -7)));
  const act = activeOn(mon);
  const last = weekPucks(prev);
  const base = last > 0 ? last : Math.max(7, act.length * 2);
  const pucks = (diff, mult, min) => ({ kind: 'pucks', diff, target: Math.max(min, Math.ceil(base * mult)) });
  const offers = [pucks(0, 1, 5)];
  // Отстающую ищем среди привычек, которые были всю прошлую неделю: у новой силы ещё нет, она не «отстаёт»
  const old = act.filter((h) => h.createdAt <= prev[0]);
  if (old.length) {
    const lag = old.reduce((m, h) => (strength(h.id, prev[6]) < strength(m.id, prev[6]) ? h : m), old[0]);
    const lastDays = prev.filter((k) => isDone(lag.id, k)).length;
    offers.push({ kind: 'habit', diff: 1, habit: lag.id, name: lag.name, emoji: lag.emoji, target: Math.min(6, Math.max(3, lastDays + 2)) });
  } else {
    offers.push(pucks(1, 1.2, 7));
  }
  offers.push(pucks(2, 1.4, 10));
  return offers.map((o) => Object.assign(o, { bonus: CHAL_DIFF[o.diff].bonus }));
}
const chalTitle = (c) => (c.kind === 'habit'
  ? `${c.emoji} ${c.name}: ${c.target} ${dayWord(c.target)} за неделю`
  : `🏒 ${c.target} ${puckWord(c.target)} за неделю`);
// Прогресс с учётом Скамейки запасных: цель снижается пропорционально дням пропуска
function chalProgress(mon, c) {
  const days = weekDays(mon);
  const skipped = days.filter(isSkip).length;
  const target = Math.max(1, Math.ceil(c.target * (7 - skipped) / 7));
  const doneDays = c.kind === 'habit' ? days.filter((k) => isDone(c.habit, k)) : [];
  const have = c.kind === 'habit' ? doneDays.length : weekPucks(days);
  return { days, skipped, target, have, doneDays };
}
// Проверка после каждой отметки: выполнен — медаль, бонус и праздник (один раз)
function checkChallenge() {
  const mon = dkey(weekStart(today()));
  const c = state.challenges[mon];
  if (!c || c.done) return;
  const p = chalProgress(mon, c);
  if (p.have >= p.target) {
    c.done = true;
    c.doneAt = dkey(today());
    save();
    celebrate(`ВЫЗОВ! +${c.bonus}`);
    horn(true);
  }
}

// ---------- Профиль игрока ----------
// Ссылка на страницу игрока ФХСПб: из неё берём только PlayerID — по нему строятся фото и адрес страницы
const FH = 'https://www.fhspb.ru/';
function fhIdFrom(url) {
  const m = String(url).match(/fhspb\.ru\/Player\?[^#]*?PlayerID=([0-9a-f-]{36})/i);
  return m && isGuid(m[1]) ? m[1].toLowerCase() : '';
}
const fhLink = (id) => `${FH}Player?PlayerID=${id}`;
const fhPhoto = (id) => `${FH}ImageHandler.ashx?ID=${id}&Size=O&TableName=Player`;
