'use strict';
// Синхронизация через приватный репозиторий GitHub: файл family.json, доступ по токену этого устройства.
// Скрипты подключаются в index.html по порядку и видят общие имена друг друга.

// ---------- Подключение: хранится только на этом устройстве, в облако и копии не попадает ----------
const SYNC_KEY = 'puck-sync-v1';
const SYNC_FILE = 'family.json';
const SYNC_API = 'https://api.github.com';
// conf: { repo: 'владелец/имя', token, sha, base } — sha файла в облаке и base — последняя общая версия (JSON)
let conf = loadSync();
let syncState = conf ? 'ok' : 'off'; // off | ok | busy | wait | error
let syncNote = ''; // текст ошибки
let syncAt = 0; // время последней удачной синхронизации
let syncTimer = null, syncRunning = false, syncAgain = false, applying = false;
let pendingCloud = null; // при подключении в облаке другие данные: ждём выбора родителя

function loadSync() {
  try {
    const c = JSON.parse(localStorage.getItem(SYNC_KEY));
    if (c && c.repo && c.token) return c;
  } catch (e) { /* не подключено */ }
  return null;
}
function storeSync() {
  try {
    if (conf) localStorage.setItem(SYNC_KEY, JSON.stringify(conf));
    else localStorage.removeItem(SYNC_KEY);
  } catch (e) { /* без сохранения */ }
}
const syncOn = () => !!conf;

// ---------- Данные для облака ----------
// Вся семья, кроме того, что у каждого устройства своё: выбранный игрок и звук
function cloudData() {
  syncFamily();
  const shared = Object.assign({}, family.shared);
  delete shared.sound;
  return { order: family.order, profiles: family.profiles, shared };
}
// JSON с ключами по алфавиту: одинаковые данные дают одинаковую строку
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (isObj(v)) {
    return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v === undefined ? null : v);
}
const same = (a, b) => canon(a) === canon(b);

// ---------- Объединение: base — общая прошлая версия, local — это устройство, remote — облако ----------
// Меняли с одной стороны — берём эту сторону. С обеих — объединяем по частям: объекты по ключам,
// списки id (отметки за день, купленное, игроки) как множества, привычки, призы и заказы по id,
// потраченные шайбы складываем. В остальном побеждает это устройство (последнее изменение).
function merge3(b, l, r, key) {
  if (same(l, r)) return l;
  if (same(l, b)) return r;
  if (same(r, b)) return l;
  if (isObj(l) && isObj(r)) {
    const bo = isObj(b) ? b : {};
    const out = {};
    new Set([...Object.keys(l), ...Object.keys(r)]).forEach((k) => {
      const v = merge3(bo[k], l[k], r[k], k);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  if (Array.isArray(l) && Array.isArray(r)) {
    const ba = Array.isArray(b) ? b : [];
    const all = [...ba, ...l, ...r];
    if (all.every((x) => typeof x === 'string')) return mergeList(ba, l, r, (x) => x, (bx, lx) => lx);
    if (all.every((x) => isObj(x) && typeof x.id === 'string')) return mergeList(ba, l, r, (x) => x.id, merge3);
    return l; // подходы и прочие списки чисел — целиком
  }
  if (key === 'spent' && [l, r].every((x) => typeof x === 'number')) {
    // Без общей прошлой версии покупки могли быть одни и те же — берём большее, а не сумму
    return typeof b === 'number' ? Math.max(0, l + r - b) : Math.max(l, r);
  }
  return l;
}
// Список как множество: остаётся то, что есть с обеих сторон, и то, что добавили с одной стороны;
// удалённое с одной стороны (и не тронутое с другой) пропадает. Порядок — как на этом устройстве.
function mergeList(b, l, r, id, mergeItem) {
  const bm = new Map(b.map((x) => [id(x), x]));
  const lm = new Map(l.map((x) => [id(x), x]));
  const rm = new Map(r.map((x) => [id(x), x]));
  const keys = [...lm.keys(), ...[...rm.keys()].filter((k) => !lm.has(k))];
  return keys
    .filter((k) => (lm.has(k) && rm.has(k)) || !bm.has(k))
    .map((k) => (lm.has(k) && rm.has(k) ? mergeItem(bm.get(k), lm.get(k), rm.get(k)) : lm.has(k) ? lm.get(k) : rm.get(k)));
}

// ---------- GitHub API ----------
function toB64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromB64(s) {
  const bin = atob(s.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function gh(c, method, path, body) {
  const headers = { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${SYNC_API}/repos/${c.repo}${path}`, { method, headers, cache: 'no-store', body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((json && json.message) || res.statusText);
    err.status = res.status;
    throw err;
  }
  return json;
}
// Файл из облака: { sha, data } или null, если файла ещё нет
async function ghGet(c) {
  let j;
  try {
    j = await gh(c, 'GET', `/contents/${SYNC_FILE}`);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
  let data;
  try { data = JSON.parse(fromB64(j.content || '')); } catch (e) { data = null; }
  if (!data || !familyFromFile(JSON.parse(JSON.stringify(data)))) {
    const err = new Error('bad file');
    err.status = 'bad';
    throw err;
  }
  return { sha: j.sha, data };
}
// Записать файл; sha — версия, поверх которой пишем. null — облако успело измениться (конфликт)
async function ghPut(c, data, sha) {
  const body = { message: 'Шайба-трекер: синхронизация', content: toB64(JSON.stringify(data)) };
  if (sha) body.sha = sha;
  try {
    return (await gh(c, 'PUT', `/contents/${SYNC_FILE}`, body)).content.sha;
  } catch (e) {
    if (e.status === 409 || e.status === 422) return null;
    throw e;
  }
}
function errText(e) {
  if (e.status === 401) return 'Токен не подходит или истёк — создай новый и подключи заново.';
  if (e.status === 403) return 'Нет доступа: у токена нет права записи в репозиторий или GitHub временно ограничил запросы.';
  if (e.status === 404) return 'Репозиторий не найден: проверь имя и что токен выдан на этот репозиторий.';
  if (e.status === 'bad') return 'В облаке непонятный файл family.json — это не данные Шайба-трекера.';
  if (e.status === 'conflict') return 'Облако всё время меняется — попробую ещё раз чуть позже.';
  return 'Нет связи с GitHub — попробую позже.';
}

// ---------- Синхронизация ----------
// Данные из облака (или объединённые) — в эту семью; выбранный игрок и звук остаются свои
function applyCloud(data) {
  const fam = familyFromFile(JSON.parse(JSON.stringify(data)));
  if (!fam) return;
  const sound = state.sound, was = family.active;
  family.order = fam.order;
  family.profiles = fam.profiles;
  family.shared = fam.shared;
  if (sound !== undefined) family.shared.sound = sound;
  activate(fam.profiles[was] ? was : fam.order[0]);
  if (family.active !== was) resetView();
  applying = true;
  save();
  applying = false;
  renderAll();
}
function syncDone(sha, data) {
  conf.sha = sha;
  conf.base = JSON.stringify(data);
  storeSync();
  syncAt = Date.now();
}
async function syncNow() {
  if (!conf || pendingCloud) return;
  if (syncRunning) { syncAgain = true; return; }
  // Пока открыто окно (подходы, день, привычка), данные под рукой не меняем
  // (и проверяем снова каждые 2 секунды — не только по событию закрытия окна)
  if (document.querySelector('dialog[open]')) { setSync('wait'); syncSoon(2000); return; }
  clearTimeout(syncTimer);
  syncRunning = true;
  setSync('busy');
  const c = conf;
  try {
    let ok = false;
    for (let i = 0; i < 3 && !ok; i++) {
      const remote = await ghGet(c);
      if (conf !== c) return; // отключили, пока ждали ответа
      let next = cloudData();
      if (remote && remote.sha !== conf.sha) {
        // Облако изменилось с прошлого раза — объединяем с изменениями этого устройства
        const merged = merge3(conf.base ? JSON.parse(conf.base) : undefined, next, remote.data);
        if (!same(merged, next)) applyCloud(merged);
        next = cloudData();
      }
      if (remote && same(next, remote.data)) { syncDone(remote.sha, next); ok = true; break; }
      const sha = await ghPut(c, next, remote ? remote.sha : null);
      if (conf !== c) return;
      if (sha) { syncDone(sha, next); ok = true; }
    }
    if (!ok) { const err = new Error('conflict'); err.status = 'conflict'; throw err; }
    setSync('ok');
  } catch (e) {
    if (conf === c) setSync('error', errText(e));
  } finally {
    syncRunning = false;
    if (syncAgain) { syncAgain = false; syncSoon(500); }
  }
}
function syncSoon(ms = 2500) {
  if (!conf) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, ms);
}
// После каждого сохранения — отправка через пару секунд (несколько отметок подряд уйдут одним разом)
afterSave.push(() => { if (!applying) syncSoon(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSoon(300); });
window.addEventListener('online', () => syncSoon(300));
// Закрыли окно, пока синхронизация ждала, — продолжаем (close не всплывает, ловим на погружении)
document.addEventListener('close', () => { if (syncState === 'wait') syncSoon(300); }, true);
// Трекер открыт весь день (ТВ) — раз в минуту проверяем облако
setInterval(() => { if (!document.hidden) syncSoon(0); }, 60000);

// ---------- Значок на табло и блок в Настройках ----------
function setSync(st, note = '') {
  syncState = st;
  syncNote = note;
  paintSync();
  if (currentTab === 'settings') renderSettings();
}
function syncStatusText() {
  if (syncState === 'busy') return '🔄 Синхронизация…';
  if (syncState === 'wait') return '⏳ Синхронизация подождёт, пока открыто окно.';
  if (syncState === 'error') return `⚠️ ${syncNote}`;
  if (!syncAt) return '☁️ Подключено.';
  const t = new Date(syncAt);
  return `✅ Всё сохранено в облаке, последняя синхронизация в ${pad(t.getHours())}:${pad(t.getMinutes())}.`;
}
function paintSync() {
  const b = document.getElementById('syncBtn');
  b.hidden = !conf;
  b.textContent = { busy: '🔄', wait: '⏳', error: '⚠️' }[syncState] || '☁️';
  b.classList.toggle('err', syncState === 'error');
  b.title = syncStatusText().replace(/^\S+ /, '') + ' Нажми, чтобы синхронизировать сейчас.';
}
document.getElementById('syncBtn').addEventListener('click', () => {
  if (syncState === 'error') showTab('settings');
  syncNow();
});

const syRepo = document.getElementById('syRepo');
const syToken = document.getElementById('syToken');
const syMsg = document.getElementById('syMsg');
function renderSync(locked) {
  document.getElementById('syForm').hidden = !!conf || !!pendingCloud;
  document.getElementById('syActions').hidden = !conf;
  document.getElementById('syConfirm').hidden = !pendingCloud;
  document.getElementById('syState').textContent = conf
    ? `Подключено к ${conf.repo}. ${syncStatusText()}`
    : 'Не подключено: данные хранятся только на этом устройстве.';
  document.getElementById('syState').classList.toggle('bad', syncState === 'error');
  [syRepo, syToken, document.getElementById('syConnect'), document.getElementById('syOff'),
    ...document.querySelectorAll('#syConfirm [data-sy]')].forEach((el) => { el.disabled = locked; });
}
// Сводка «на этом устройстве / в облаке», как при восстановлении из файла
function showCloudChoice(remote) {
  const a = summary(cloudData()), b = summary(familyFromFile(JSON.parse(JSON.stringify(remote.data))));
  const row = (label, x, y) => `<tr><th>${label}</th><td>${x}</td><td${x !== y ? ' class="diff"' : ''}>${y}</td></tr>`;
  document.getElementById('syCmp').innerHTML =
    row('Игроки', esc(a.team), esc(b.team)) +
    row('Привычек', a.habits, b.habits) +
    row('Шайб', a.goals, b.goals) +
    row('Отметки', a.period, b.period);
}

document.getElementById('syConnect').addEventListener('click', async () => {
  const repo = syRepo.value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  const token = syToken.value.trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { syMsg.textContent = 'Репозиторий — в виде «владелец/имя», например ivanov/shaiba_data.'; return; }
  if (!token) { syMsg.textContent = 'Вставь токен доступа.'; return; }
  const c = { repo, token, sha: null, base: null };
  syMsg.textContent = '🔄 Проверяю…';
  try {
    const info = await gh(c, 'GET', '');
    if (!info.private) {
      syMsg.textContent = '❌ Репозиторий публичный — данные детей увидят все. Сделай его приватным или создай новый приватный.';
      return;
    }
    const remote = await ghGet(c);
    syToken.value = '';
    if (!remote) {
      // Облако пустое — отправляем туда данные этого устройства
      conf = c;
    } else if (same(remote.data, cloudData())) {
      conf = Object.assign(c, { sha: remote.sha, base: JSON.stringify(remote.data) });
    } else {
      pendingCloud = { c, remote };
      showCloudChoice(remote);
      syMsg.textContent = '';
      renderSettings();
      return;
    }
    storeSync();
    syMsg.textContent = '✅ Синхронизация подключена.';
    syncNow();
  } catch (e) {
    syMsg.textContent = `❌ ${errText(e)}`;
  }
});
// Выбор при подключении: взять облако, объединить или заменить облако своими данными
document.getElementById('syConfirm').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sy]');
  if (!b || b.disabled || !pendingCloud) return;
  const { c, remote } = pendingCloud;
  const how = b.dataset.sy;
  if (how === 'local' && !confirm('Заменить данные в облаке данными этого устройства? Прежняя версия останется в истории репозитория.')) return;
  pendingCloud = null;
  if (how === 'cloud') {
    conf = Object.assign(c, { sha: remote.sha, base: JSON.stringify(remote.data) });
    applyCloud(remote.data);
  } else if (how === 'merge') {
    conf = Object.assign(c, { sha: null, base: null }); // общей версии нет — сложится всё с обеих сторон
  } else {
    conf = Object.assign(c, { sha: remote.sha, base: JSON.stringify(remote.data) });
  }
  storeSync();
  syMsg.textContent = '✅ Синхронизация подключена.';
  syncNow();
});
document.getElementById('syCancel').addEventListener('click', () => {
  pendingCloud = null;
  syMsg.textContent = '';
  renderSettings();
});
document.getElementById('syNow').addEventListener('click', () => syncNow());
document.getElementById('syOff').addEventListener('click', () => {
  if (!confirm('Отключить синхронизацию на этом устройстве? Данные останутся и здесь, и в облаке.')) return;
  conf = null;
  storeSync();
  syMsg.textContent = 'Синхронизация отключена.';
  setSync('off');
});
