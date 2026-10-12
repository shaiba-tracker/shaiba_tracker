'use strict';
// Данные: справочники, даты, хранилище семьи (профили детей), migrate, save, смена игрока.
// Скрипты подключаются в index.html по порядку и видят общие имена друг друга.

const KEY = 'puck-habits-v2';

// Значки привычек по группам: [значок, подсказка]
const EMOJI_GROUPS = [
  { title: '🏒 Хоккей', list: [
    ['🏒', 'Клюшка'], ['🥅', 'Ворота'], ['⛸️', 'Коньки'], ['🧊', 'Лёд'], ['🚨', 'Гол!'],
    ['🎯', 'Броски по цели'], ['⚡', 'Скорость'], ['🧤', 'Краги'], ['⛑️', 'Шлем'], ['🎽', 'Форма'],
    ['🏟️', 'Арена'], ['📋', 'Тактика'], ['🎥', 'Видеоразбор'], ['🧠', 'Игровое мышление'],
    ['🏆', 'Кубок'], ['🥇', 'Медаль'],
  ] },
  { title: '💪 ОФП', list: [
    ['💪', 'Сила'], ['🏋️', 'Штанга'], ['🤸', 'Гимнастика'], ['🧗', 'Подтягивания'], ['🐒', 'Вис'],
    ['🏃', 'Бег'], ['🚴', 'Велотренажёр'], ['🏊', 'Плавание'], ['🧘', 'Растяжка'], ['⏱️', 'Планка'],
    ['🦵', 'Приседания'], ['🧎', 'Выпады'], ['🦘', 'Прыжки'], ['🐸', 'Лягушка'], ['🪢', 'Скакалка'],
    ['🪜', 'Координационная лестница'], ['⚖️', 'Баланс'], ['🤾', 'Реакция с мячом'], ['🏐', 'Мяч'],
    ['🥊', 'Бокс'], ['🤼', 'Борьба'], ['👟', 'Кардио'], ['🔥', 'Интенсив'], ['🫁', 'Дыхание'],
  ] },
  { title: '⭐ Разное', list: [
    ['📚', 'Книга'], ['✏️', 'Уроки'], ['🦷', 'Зубы'], ['🛏️', 'Кровать'], ['🧹', 'Уборка'],
    ['🎒', 'Рюкзак'], ['🥦', 'Овощи'], ['🍎', 'Фрукты'], ['💧', 'Вода'], ['😴', 'Сон вовремя'],
    ['🎹', 'Музыка'], ['🎨', 'Рисование'], ['🐶', 'Питомец'], ['⚽', 'Футбол'], ['🌙', 'Вечер'],
  ] },
];
const EMOJIS = EMOJI_GROUPS.flatMap((g) => g.list.map(([em]) => em));
// Группы привычек: в этом порядке они идут в таблице, Статистике и Зале славы
const GROUPS = [
  { id: 'hockey', emoji: '🏒', label: 'Хоккей' },
  { id: 'ofp', emoji: '💪', label: 'ОФП' },
  { id: 'home', emoji: '⭐', label: 'Дом' },
];
// Группа по значку: 🏒 Хоккей → Хоккей, 💪 ОФП → ОФП, ⭐ Разное → Дом
function guessGroup(emoji) {
  const gi = EMOJI_GROUPS.findIndex((g) => g.list.some(([em]) => em === emoji));
  return gi >= 0 ? GROUPS[gi].id : 'ofp';
}
const groupIndex = (id) => GROUPS.findIndex((g) => g.id === id);
// Держим массив привычек упорядоченным: сначала по группе, внутри — как расставил родитель
function sortHabits(s) {
  s.habits = s.habits.map((h, i) => [h, i])
    .sort((a, b) => groupIndex(a[0].group) - groupIndex(b[0].group) || a[1] - b[1])
    .map(([h]) => h);
}
const COLORS = ['#1e6fd9', '#e63946', '#2a9d8f', '#f4a261', '#8e5bd8', '#ff6fae'];

// Единицы для количественных привычек и кнопки быстрого ввода подхода
const UNITS = {
  reps: { short: 'раз', label: 'Разы (повторения)', quick: [5, 10, 15, 20] },
  sec: { short: 'сек', label: 'Секунды', quick: [15, 30, 45, 60] },
  min: { short: 'мин', label: 'Минуты', quick: [5, 10, 15, 20] },
  pages: { short: 'стр', label: 'Страницы', quick: [5, 10, 15, 20] },
};
// Нормы стартовых привычек (по id)
const START_UNITS = {
  otzhim: ['reps', 20], podtyag: ['reps', 5], press: ['reps', 30], tolchok: ['reps', 20],
  planka: ['sec', 60], vis: ['sec', 30],
  trenazher: ['min', 15], dribling: ['min', 15], plovec: ['min', 2],
  kniga: ['pages', 10],
};
// «Скамейка запасных»: причины пропуска дня
const SKIPS = {
  sick: { emoji: '🤒', label: 'Болел' },
  trip: { emoji: '🧳', label: 'Отъезд' },
  rest: { emoji: '😴', label: 'Отдых' },
  game: { emoji: '🏟️', label: 'День игры' },
};

// Быстрые кнопки для заметки к дню
// «Микро-матч» не дописывается сразу: сначала спрашиваем счёт (забили : пропустили)
const MICRO = '⏱️ Микро-матч';
// Голы и ассисты спрашивают количество и пишутся одной строкой «🥅 Голы: 2»
const COUNTED = { '🥅 Забил гол': '🥅 Голы', '🤝 Ассист': '🤝 Ассисты' };
const NOTE_QUICK = ['🥅 Забил гол', '🤝 Ассист', MICRO, '🏆 Победа', '😞 Поражение', '⭐ Лучший игрок матча'];
// Путь к Кубку: звания по числу заброшенных шайб
const LEVELS = [
  { min: 0, name: 'Новичок', emoji: '⛸️' },
  { min: 10, name: 'Юный хоккеист', emoji: '🏒' },
  { min: 25, name: 'Нападающий', emoji: '🥅' },
  { min: 50, name: 'Снайпер', emoji: '🎯' },
  { min: 100, name: 'Капитан', emoji: '🦸' },
  { min: 175, name: 'Звезда лиги', emoji: '⭐' },
  { min: 300, name: 'Легенда', emoji: '🏆' },
];

const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
  'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль',
  'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_INS = ['январём', 'февралём', 'мартом', 'апрелем', 'маем', 'июнем', 'июлем',
  'августом', 'сентябрём', 'октябрём', 'ноябрём', 'декабрём'];

// ---------- Даты ----------
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const human = (k) => { const d = parseKey(k); return `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };

// Склонение: plural(5, ['шайба','шайбы','шайб'])
const plural = (n, f) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return f[2];
  if (b > 1 && b < 5) return f[1];
  if (b === 1) return f[0];
  return f[2];
};
// Частые склонения: «5 шайб», «3 дня»
const puckWord = (n) => plural(n, ['шайба', 'шайбы', 'шайб']);
const dayWord = (n) => plural(n, ['день', 'дня', 'дней']);
// Примечание списком: «Примечание:» и пункты — читается легче сплошного текста
const noteList = (items, mod = '') => `<div class="note${mod ? ` ${mod}` : ''}"><b>Примечание:</b><ul>${items.filter(Boolean).map((i) => `<li>${i}</li>`).join('')}</ul></div>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Состояние ----------
// Стартовые данные: пример привычек хоккеиста с нормами, без отметок — привычки считаются с сегодняшнего дня
function seed() {
  const start = dkey(today());
  const list = [
    ['trenazher', 'Тренажёр', '🚴'],
    ['press', 'Пресс classic', '💪'],
    ['podtyag', 'Подтягивания', '🧗'],
    ['vis', 'Вис', '🐒'],
    ['plovec', 'Пловец', '🏊'],
    ['planka', 'Планка 2.0', '⏱️'],
    ['otzhim', 'Отжимания', '🤸'],
    ['tolchok', 'Толчок', '🏋️'],
    ['dribling', 'Дриблинг', '🏒'],
    ['kniga', 'Книга', '📚'],
  ];
  return migrate({
    team: 'Игрок',
    sound: true,
    habits: list.map(([id, name, emoji], i) => ({ id, name, emoji, color: COLORS[i % COLORS.length], createdAt: start })),
    log: {},
  });
}
// ---------- Проверка данных: файл копии мог быть испорчен — чиним молча ----------
// Значки, цвета и id попадают прямо в разметку, поэтому проверяем их строго
const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const isKey = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
const isId = (x) => typeof x === 'string' && /^[\w-]{1,40}$/.test(x) && x !== '__proto__';
const isColor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const isEmoji = (e) => typeof e === 'string' && e.length > 0 && e.length <= 16 && !/[<>&"']/.test(e);
const isText = (t) => typeof t === 'string' && t.trim() !== '';
const isGuid = (x) => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
// Целое от 1 до max, иначе 0
const posInt = (n, max) => { const v = Math.round(Number(n)); return v >= 1 && v <= max ? v : 0; };
// Записи по датам: оставляем только верную дату и то, что вернул fix (undefined — выбросить)
function byDate(o, fix) {
  const r = {};
  if (isObj(o)) Object.keys(o).forEach((k) => { const v = isKey(k) ? fix(o[k]) : undefined; if (v !== undefined) r[k] = v; });
  return r;
}
function cleanProfile(s) {
  s.team = isText(s.team) ? s.team.trim().slice(0, 30) : 'Игрок';
  s.habits = s.habits.filter(isObj).map((h, i) => {
    if (!isId(h.id)) h.id = uid();
    if (!isText(h.name)) h.name = 'Привычка';
    if (!isEmoji(h.emoji)) h.emoji = '⭐';
    if (!isColor(h.color)) h.color = COLORS[i % COLORS.length];
    if (!isKey(h.createdAt)) h.createdAt = dkey(today());
    if (has(UNITS, h.unit) && posInt(h.goal, 9999)) h.goal = posInt(h.goal, 9999);
    else { delete h.unit; delete h.goal; }
    return h;
  });
  s.log = byDate(s.log, (a) => {
    const ids = Array.isArray(a) ? a.filter(isId) : [];
    return ids.length ? ids : undefined;
  });
  s.vals = byDate(s.vals, (o) => {
    const r = {};
    if (isObj(o)) Object.keys(o).forEach((id) => {
      const sets = isId(id) && Array.isArray(o[id]) ? o[id].map((v) => posInt(v, 9999)).filter(Boolean) : [];
      if (sets.length) r[id] = sets;
    });
    return Object.keys(r).length ? r : undefined;
  });
  s.skips = byDate(s.skips, (v) => (has(SKIPS, v) ? v : undefined));
  s.notes = byDate(s.notes, (v) => (isText(v) ? v.slice(0, 200) : undefined));
  const sh = isObj(s.shop) ? s.shop : {};
  const worn = {};
  if (isObj(sh.worn)) Object.keys(sh.worn).forEach((slot) => { if (isId(slot) && isId(sh.worn[slot])) worn[slot] = sh.worn[slot]; });
  s.shop = {
    spent: Math.max(0, Math.round(Number(sh.spent)) || 0),
    owned: Array.isArray(sh.owned) ? sh.owned.filter(isId) : [],
    worn,
    number: posInt(sh.number, 99) || 17,
    jname: typeof sh.jname === 'string' ? sh.jname.trim().toUpperCase().slice(0, 10) : '',
  };
  if (Array.isArray(s.prizes)) {
    s.prizes = s.prizes.filter(isObj).map((p) => ({
      id: isId(p.id) ? p.id : uid(),
      name: isText(p.name) ? p.name : 'Приз',
      emoji: isEmoji(p.emoji) ? p.emoji : '🎁',
      price: posInt(p.price, 999999) || 1,
    }));
  }
  if (Array.isArray(s.orders)) {
    s.orders = s.orders.filter(isObj).map((o) => {
      const r = {
        id: isId(o.id) ? o.id : uid(),
        prizeId: o.prizeId,
        name: isText(o.name) ? o.name : 'Приз',
        emoji: isEmoji(o.emoji) ? o.emoji : '🎁',
        price: Math.max(0, Math.round(Number(o.price)) || 0),
        at: isKey(o.at) ? o.at : dkey(today()),
        status: o.status === 'given' ? 'given' : 'wait',
      };
      if (r.status === 'given') r.givenAt = isKey(o.givenAt) ? o.givenAt : r.at;
      return r;
    });
  }
  // Вызов: сложность 0–2, цель и бонус — числа; у вызова-привычки нужна привычка
  s.challenges = byDate(s.challenges, (c) => {
    if (!isObj(c) || ![0, 1, 2].includes(c.diff) || !posInt(c.target, 999)) return undefined;
    if (c.kind === 'habit' && !(isId(c.habit) && isText(c.name) && isEmoji(c.emoji))) return undefined;
    if (c.kind !== 'habit' && c.kind !== 'pucks') return undefined;
    return Object.assign(c, { target: posInt(c.target, 999), bonus: posInt(c.bonus, 100), done: c.done === true });
  });
  if (!isColor(s.pcolor)) delete s.pcolor;
  // Профиль игрока: команда, игровой номер и PlayerID на fhspb.ru (по нему фото и ссылка)
  const pl = isObj(s.player) ? s.player : {};
  s.player = {
    club: typeof pl.club === 'string' ? pl.club.trim().slice(0, 60) : '',
    number: posInt(pl.number, 99),
    fhId: isGuid(pl.fhId) ? pl.fhId.toLowerCase() : '',
  };

}
// Общие настройки семьи: PIN, звук, дата копии
function cleanShared(sh) {
  const r = {};
  if (!isObj(sh)) return r;
  if (isObj(sh.pin) && typeof sh.pin.hash === 'string' && typeof sh.pin.word === 'string') r.pin = { hash: sh.pin.hash, word: sh.pin.word };
  if (typeof sh.sound === 'boolean') r.sound = sh.sound;
  if (isKey(sh.lastBackup)) r.lastBackup = sh.lastBackup;
  return r;
}

// v3: количество (vals — подходы по дням), пропуски дней (skips), нормы стартовых привычек
function migrate(s) {
  // Проверяет все поля и заводит пустые: подходы (vals), пропуски (skips), заметки к дням (notes),
  // вызовы недели (challenges) и раздевалку Коня-огня (shop: потрачено, куплено, надето, номер, имя)
  cleanProfile(s);
  // Магазин призов: примеры, которые родитель может поменять; купленные призы ждут выдачи
  if (!Array.isArray(s.prizes)) {
    s.prizes = [['📺', 'Мультик', 10], ['🍦', 'Мороженое', 15], ['🎮', '+30 минут игр', 20],
      ['⛸️', 'Каток с семьёй', 40], ['🎬', 'Кино', 60], ['🏟️', 'Матч СКА на арене', 150]]
      .map(([emoji, name, price], i) => ({ id: 'p' + i, emoji, name, price }));
  }
  s.orders = s.orders || [];
  // Цвет игрока: плашка с именем в шапке и карточка в списке игроков
  if (!s.pcolor) s.pcolor = COLORS[0];
  // Группы: старым привычкам подбираем группу по значку
  s.habits.forEach((h) => { if (groupIndex(h.group) < 0) h.group = guessGroup(h.emoji); });
  sortHabits(s);
  if (!(s.v >= 3)) {
    s.habits.forEach((h) => {
      const mu = START_UNITS[h.id];
      if (mu && !h.unit) { h.unit = mu[0]; h.goal = mu[1]; }
    });
    s.v = 3;
  }
  return s;
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.habits) && s.log) {
      // Раньше удаление только «архивировало» привычку — добиваем такие
      s.habits = s.habits.filter((h) => !(h && h.archivedAt));
      return migrate(s);
    }
  } catch (e) { /* пусто или недоступно */ }
  return seed();
}
// Семья: у каждого ребёнка свой профиль (привычки, шайбы, Конь-огонь, призы, заметки).
// Общие для всех только PIN, звук и дата последней копии — они лежат в family.shared.
const FAMILY_KEY = 'puck-family-v1';
const SHARED = ['pin', 'sound', 'lastBackup'];
function splitShared(st) {
  const own = {}, shared = {};
  Object.keys(st).forEach((k) => { if (SHARED.includes(k)) shared[k] = st[k]; else own[k] = st[k]; });
  return { own, shared };
}
// Семья из готовых данных: первый ребёнок задаёт общие настройки
function familyFrom(states) {
  const f = { active: null, order: [], profiles: {}, shared: {} };
  states.forEach((st, i) => {
    const id = 'p' + uid();
    const { own, shared } = splitShared(st);
    f.order.push(id);
    f.profiles[id] = own;
    if (i === 0) f.shared = cleanShared(shared);
  });
  f.active = f.order[0];
  return f;
}
const validProfile = (p) => !!(p && Array.isArray(p.habits) && p.log && typeof p.log === 'object');
// Файл копии: формат 1 — один ребёнок, формат 2 — вся семья
function familyFromFile(data) {
  if (validProfile(data)) {
    data.habits = data.habits.filter((h) => !(h && h.archivedAt));
    return familyFrom([migrate(data)]);
  }
  if (!data || !Array.isArray(data.order) || !data.order.length || !isObj(data.profiles)) return null;
  const old = data.order.filter((id, i) => typeof id === 'string' && data.order.indexOf(id) === i && has(data.profiles, id));
  if (!old.length || !old.every((id) => validProfile(data.profiles[id]))) return null;
  // id профиля попадает в разметку: неподходящий заменяем новым
  const f = { active: null, order: [], profiles: {}, shared: cleanShared(data.shared) };
  old.forEach((id) => {
    const p = data.profiles[id];
    p.habits = p.habits.filter((h) => !(h && h.archivedAt));
    const nid = isId(id) ? id : 'p' + uid();
    f.order.push(nid);
    f.profiles[nid] = migrate(p);
    if (id === data.active) f.active = nid;
  });
  if (!f.active) f.active = f.order[0];
  return f;
}
function loadFamily() {
  try {
    const f = JSON.parse(localStorage.getItem(FAMILY_KEY));
    if (f && Array.isArray(f.order) && f.order.length && f.profiles && f.order.every((id) => validProfile(f.profiles[id]))) {
      f.order.forEach((id) => migrate(f.profiles[id]));
      f.shared = cleanShared(f.shared);
      if (!f.profiles[f.active]) f.active = f.order[0];
      return f;
    }
  } catch (e) { /* пусто или недоступно */ }
  // Данные одного ребёнка из прошлой версии переезжают в первый профиль
  return familyFrom([load()]);
}
// Первое открытие на этом устройстве: ни семьи, ни данных прошлой версии — покажем приветствие
const firstRun = (() => {
  try { return !localStorage.getItem(FAMILY_KEY) && !localStorage.getItem(KEY); } catch (e) { return false; }
})();
const family = loadFamily();
// state — всегда профиль того, кто сейчас играет; при смене игрока его содержимое подменяется
const state = {};
function activate(id) {
  family.active = id;
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, family.profiles[id], family.shared);
}
activate(family.active);
function syncFamily() {
  const { own, shared } = splitShared(state);
  family.profiles[family.active] = own;
  family.shared = shared;
}
// Что сделать после каждого сохранения (синхронизация с облаком добавляет сюда отправку)
const afterSave = [];
function save() {
  syncFamily();
  try { localStorage.setItem(FAMILY_KEY, JSON.stringify(family)); } catch (e) { /* без сохранения */ }
  afterSave.forEach((fn) => fn());
}
const goalsOf = (p) => Object.values(p.log).reduce((n, a) => n + a.length, 0);
save(); // данные из прошлой версии сразу переезжают в хранилище семьи
let viewMonth = new Date(today().getFullYear(), today().getMonth(), 1);
let scrollToToday = true;
let chartRange = 'month'; // 'week' — 7 дней, 'month' — месяц
let chartMonth = new Date(today().getFullYear(), today().getMonth(), 1); // какой месяц смотрим в статистике
let progressHabit = null; // какая количественная привычка выбрана в «Прогрессе»
let orderMode = false; // режим «Порядок»: ▲▼ и выбор группы вместо таблицы

const habitById = (id) => state.habits.find((h) => h.id === id);
// Привычка «в игре» в день k: создана не позже и ещё не удалена
const activeOn = (k) => state.habits.filter((h) => h.createdAt <= k);
const isSkip = (k) => !!state.skips[k];
// Сколько привычек «ожидалось» в день k: в день пропуска — ни одной
const expectedOn = (k) => (isSkip(k) ? [] : activeOn(k));
const isDone = (id, k) => (state.log[k] || []).includes(id);
const doneCount = (k) => activeOn(k).filter((h) => isDone(h.id, k)).length;
const isPerfect = (k) => { const a = activeOn(k); return a.length > 0 && a.every((h) => isDone(h.id, k)); };
// Победа в матче — 3 шайбы за день (или все привычки, если их меньше трёх)
const WIN_GOALS = 3;
const winTarget = (k) => Math.min(WIN_GOALS, activeOn(k).length);
const isWin = (k) => { const t = winTarget(k); return t > 0 && doneCount(k) >= t; };
const totalGoals = () => Object.values(state.log).reduce((s, a) => s + a.length, 0);
const levelIndex = (g) => LEVELS.reduce((idx, l, i) => (g >= l.min ? i : idx), 0);
