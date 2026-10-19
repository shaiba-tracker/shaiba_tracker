'use strict';
// Настройки и резервная копия, игроки, вкладки, renderAll и запуск — подключается последним.
// Скрипты подключаются в index.html по порядку и видят общие имена друг друга.

// ---------- Настройки: резервная копия в файл ----------
const elSettings = document.getElementById('tab-settings');
const BACKUP_DAYS = 7; // через сколько дней напоминать о новой копии
let pendingRestore = null;

const daysSince = (k) => Math.round((today() - parseKey(k)) / 86400000);
const anyGoals = () => totalGoals() > 0 || family.order.some((id) => id !== family.active && goalsOf(family.profiles[id]) > 0);
// С синхронизацией данные и так в облаке с историей — о копии не напоминаем
const backupDue = () => !syncOn() && anyGoals() && (!state.lastBackup || daysSince(state.lastBackup) >= BACKUP_DAYS);

// Короткая сводка для сравнения «сейчас / в файле»
function summary(f) {
  const ps = f.order.map((id) => f.profiles[id]);
  const days = ps.flatMap((p) => Object.keys(p.log).filter((k) => p.log[k].length)).sort();
  const sum = (fn) => ps.reduce((n, p) => n + fn(p), 0);
  return {
    team: ps.map((p) => p.team).join(', '),
    habits: sum((p) => p.habits.length),
    goals: sum(goalsOf),
    period: days.length ? `${days[0].split('-').reverse().join('.')} — ${days[days.length - 1].split('-').reverse().join('.')}` : 'нет отметок',
    items: sum((p) => (p.shop && p.shop.owned.length) || 0),
  };
}

function renderSettings() {
  // Имя и номер: поле, которое сейчас набирают, не трогаем
  [[pName, state.team], [jName, jerseyName()], [jNum, state.shop.number]].forEach(([el, v]) => {
    if (document.activeElement !== el) el.value = v;
  });
  const st = document.getElementById('bkStatus');
  if (!state.lastBackup) {
    st.textContent = '⚠️ Копию ещё ни разу не делали.';
  } else {
    const d = daysSince(state.lastBackup);
    const ago = d === 0 ? 'сегодня' : d === 1 ? 'вчера' : `${d} ${dayWord(d)} назад`;
    st.textContent = `${d >= BACKUP_DAYS ? '⚠️' : '✅'} Последняя копия: ${ago} (${human(state.lastBackup)}).`;
  }
  st.classList.toggle('due', backupDue());
  document.getElementById('gearDot').hidden = !backupDue();

  // Замок: имена, номер, восстановление и смена PIN — только в родительском режиме
  const locked = !unlocked();
  ['pName', 'jName', 'jNum'].forEach((id) => { document.getElementById(id).disabled = locked; });
  document.getElementById('bkRestore').hidden = locked;
  document.getElementById('pColor').innerHTML = COLORS.map((c) =>
    `<button type="button" data-pcolor="${c}" class="swatch${c === (state.pcolor || COLORS[0]) ? ' on' : ''}" style="background:${c}" aria-label="Цвет ${c}"${locked ? ' disabled' : ''}></button>`).join('');
  const del = document.getElementById('profDelete');
  del.hidden = family.order.length < 2;
  del.disabled = locked;
  renderPlayer(locked);
  renderSync(locked);
  renderInstall();
  // Открытый режим уже видно на плашке под вкладками, здесь — только замок
  const bar = document.getElementById('pinBar');
  bar.hidden = !(hasPin() && locked);
  bar.innerHTML = '<span>🔒 Имена, номер, профиль и восстановление защищены PIN.</span><button type="button" class="btn btn-blue" data-pin="unlock">🔓 Ввести PIN</button>';
  document.getElementById('pinState').textContent = hasPin()
    ? '✅ PIN задан. Он нужен для отметок и пропусков за прошлые дни, изменения привычек, этих настроек и профиля, выдачи и изменения призов.'
    : 'PIN не задан: прошлые дни и настройки открыты для всех. Призы можно будет выдавать после создания PIN.';
  document.getElementById('pinActions').innerHTML = hasPin()
    ? `<button type="button" class="btn btn-ghost" data-pin="change"${locked ? ' disabled' : ''}>Сменить PIN</button>
       <button type="button" class="btn btn-ghost danger" data-pin="off"${locked ? ' disabled' : ''}>Отключить PIN</button>`
    : '<button type="button" class="btn btn-blue" data-pin="set">🔐 Создать PIN</button>';
}

// Уход с Настроек режим не закрывает: только таймер или кнопка «🔒 Закрыть» на плашке
elSettings.addEventListener('click', (e) => {
  // Цвет игрока (кнопки неактивны, пока режим закрыт)
  const c = e.target.closest('[data-pcolor]');
  if (c && !c.disabled) {
    state.pcolor = c.dataset.pcolor;
    save();
    renderAll();
    return;
  }
  const b = e.target.closest('[data-pin]');
  if (!b) return;
  const act = b.dataset.pin;
  if (act === 'unlock') requirePin('', () => {});
  else if (act === 'set' || act === 'change') requirePin('', () => openPin('set'));
  else if (act === 'off') {
    requirePin('', () => {
      if (!confirm('Отключить PIN? Прошлые дни и настройки станут открыты для всех.')) return;
      delete state.pin;
      save();
      refreshLocks();
    });
  }
});

// Имя ребёнка, имя и номер на свитере — меняются сразу при вводе
const pName = document.getElementById('pName');
const jName = document.getElementById('jName');
const jNum = document.getElementById('jNum');
function fillProfile() {
  pName.value = state.team;
  jName.value = jerseyName();
  jNum.value = state.shop.number;
}
pName.addEventListener('input', () => {
  const v = pName.value.trim();
  if (!v) return; // пустое имя не сохраняем
  state.team = v.slice(0, 30);
  save();
  renderAll();
});
jName.addEventListener('input', () => {
  state.shop.jname = jName.value.trim().toUpperCase().slice(0, 10);
  save();
  renderAll();
});
jNum.addEventListener('input', () => {
  const n = Number(jNum.value);
  if (!Number.isInteger(n) || n < 1 || n > 99) return;
  state.shop.number = n;
  save();
  renderAll();
});
// Ушли с поля с пустым или неверным значением — показываем сохранённое
[pName, jName, jNum].forEach((el) => el.addEventListener('change', fillProfile));

// ---------- Приложение на главном экране: работа без интернета и установка ----------
// Service worker работает только по https и на localhost; по адресу в локальной сети его нет
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => { /* без офлайна */ });
}
// Chrome и Android дают поставить трекер своей кнопкой; без этого событие показало бы плашку браузера
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  renderInstall();
});
window.addEventListener('appinstalled', () => { installPrompt = null; renderInstall(); });
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function standalone() {
  return navigator.standalone === true || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches);
}
function renderInstall() {
  const st = document.getElementById('apState');
  document.getElementById('apActions').hidden = !(installPrompt && !standalone());
  if (standalone()) st.textContent = '✅ Трекер открыт как приложение.';
  else if (installPrompt) st.textContent = 'Поставь трекер на главный экран — он будет открываться как приложение.';
  else if (isIOS) st.textContent = 'Чтобы поставить трекер на главный экран, в Safari нажми «Поделиться» → «На экран „Домой“».';
  else if (!window.isSecureContext) st.textContent = 'Поставить трекер на главный экран можно, только если он открыт по адресу https://….';
  else st.textContent = 'Чтобы поставить трекер на главный экран, открой меню браузера (⋮) → «Установить приложение» или «Добавить на главный экран».';
}
document.getElementById('apInstall').addEventListener('click', () => {
  if (!installPrompt) return;
  const p = installPrompt;
  installPrompt = null; // окно установки можно показать только один раз
  p.prompt();
  p.userChoice.then(renderInstall, renderInstall);
});

// ---------- Профиль игрока: команда, игровой номер, ссылка на fhspb.ru ----------
// Меняется сразу при вводе, как имя; в закрытом режиме поля неактивны
const plFields = document.querySelectorAll('[data-pl]');
// Что показать в поле: ссылку собираем из PlayerID, пустой номер — пустое поле
function plValue(k) {
  const p = state.player;
  if (k === 'link') return p.fhId ? fhLink(p.fhId) : '';
  if (k === 'number') return p.number || '';
  return p[k];
}
function renderPlayer(locked) {
  const p = state.player;
  plFields.forEach((el) => {
    if (document.activeElement !== el) el.value = plValue(el.dataset.pl);
    el.disabled = locked;
  });
  // Ссылка: найдена — фото и кнопка на карточке; набрана неверная — подсказка
  const raw = document.querySelector('[data-pl="link"]').value.trim();
  const bad = !!raw && !fhIdFrom(raw);
  const msg = document.getElementById('plLink');
  msg.classList.toggle('bad', bad);
  msg.innerHTML = bad
    ? '❌ Это не ссылка на страницу игрока: нужна ссылка вида fhspb.ru/Player?…PlayerID=…'
    : p.fhId
      ? `✅ Фото и кнопка «Страница на ФХСПб» — на карточке игрока во вкладке «Путь». <a href="${fhLink(p.fhId)}" target="_blank" rel="noopener noreferrer">Открыть страницу ↗</a>`
      : 'Вставь ссылку на страницу игрока с сайта Федерации — на карточке появятся фото и кнопка на сайт.';
}
plFields.forEach((el) => {
  el.addEventListener('input', () => {
    const k = el.dataset.pl, v = el.value.trim(), p = state.player;
    if (k === 'number') {
      const n = posInt(v, 99);
      if (v && !n) return;
      p.number = n;
    } else if (k === 'link') {
      const id = fhIdFrom(v);
      if (v && !id) { renderSettings(); return; } // неверную ссылку не сохраняем, но подсказку показываем
      p.fhId = id;
    } else {
      p[k] = v.slice(0, 60);
    }
    save();
    renderAll();
  });
  // Ушли с поля с неверным значением — показываем сохранённое (неверную ссылку оставляем, чтобы была видна подсказка)
  el.addEventListener('change', () => {
    if (el.dataset.pl === 'link' && el.value.trim()) return;
    el.value = plValue(el.dataset.pl);
    renderSettings();
  });
});

// ⚙️ на табло открывает Настройки на весь экран, как вкладку
document.getElementById('settingsBtn').addEventListener('click', () => {
  pendingRestore = null;
  document.getElementById('bkConfirm').hidden = true;
  document.getElementById('bkMsg').textContent = '';
  showTab('settings');
});

document.getElementById('bkSave').addEventListener('click', () => {
  state.lastBackup = dkey(today());
  save();
  const file = { app: 'shaiba-tracker', format: 2, savedAt: new Date().toISOString(), data: family };
  const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `shaiba-tracker-${state.lastBackup}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  renderSettings();
  document.getElementById('bkMsg').textContent = `Файл «${a.download}» сохранён в «Загрузки». Храни его в надёжном месте — например, отправь себе в почту или в облако.`;
});

document.getElementById('bkFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = ''; // чтобы тот же файл можно было выбрать ещё раз
  if (!f) return;
  const msg = document.getElementById('bkMsg');
  const reader = new FileReader();
  reader.onload = () => {
    let fam;
    try {
      const file = JSON.parse(reader.result);
      fam = file && file.app === 'shaiba-tracker' ? familyFromFile(file.data) : null;
      if (!fam) throw new Error('bad');
    } catch (err) {
      msg.textContent = '❌ Это не файл резервной копии Шайба-трекера.';
      document.getElementById('bkConfirm').hidden = true;
      return;
    }
    pendingRestore = fam;
    syncFamily();
    const a = summary(family), b = summary(pendingRestore);
    const row = (label, x, y) => `<tr><th>${label}</th><td>${x}</td><td${x !== y ? ' class="diff"' : ''}>${y}</td></tr>`;
    document.getElementById('bkCmp').innerHTML =
      row('Игроки', esc(a.team), esc(b.team)) +
      row('Привычек', a.habits, b.habits) +
      row('Шайб', a.goals, b.goals) +
      row('Отметки', a.period, b.period) +
      row('Экипировка', a.items, b.items);
    document.getElementById('bkConfirm').hidden = false;
    msg.textContent = '';
  };
  reader.readAsText(f);
});

document.getElementById('bkNo').addEventListener('click', () => {
  pendingRestore = null;
  document.getElementById('bkConfirm').hidden = true;
});
document.getElementById('bkYes').addEventListener('click', () => {
  if (!pendingRestore) return;
  family.order = pendingRestore.order;
  family.profiles = pendingRestore.profiles;
  family.shared = pendingRestore.shared;
  activate(pendingRestore.active);
  pendingRestore = null;
  save();
  resetView();
  document.getElementById('bkConfirm').hidden = true;
  renderAll();
  document.getElementById('bkMsg').textContent = '✅ Готово! Данные восстановлены из файла.';
});

// ---------- Игроки: у каждого ребёнка свой профиль ----------
const profDlg = document.getElementById('profDialog');
const profForm = document.getElementById('profForm');
const profName = document.getElementById('profName');
const profFrom = document.getElementById('profFrom');

// Экран нового игрока — «с чистого листа»: месяц, график, режимы и незавершённые покупки
function resetView() {
  viewMonth = new Date(today().getFullYear(), today().getMonth(), 1);
  chartMonth = new Date(today().getFullYear(), today().getMonth(), 1);
  chartRange = 'month';
  scrollToToday = true;
  progressHabit = null;
  orderMode = false;
  pendingBuy = null;
  pendingChal = null;
}
function renderProfiles() {
  syncFamily();
  document.getElementById('profList').innerHTML = family.order.map((id) => {
    const p = family.profiles[id];
    const g = goalsOf(p);
    const lv = LEVELS[levelIndex(g)];
    const cur = id === family.active;
    return `<button type="button" class="prof-card${cur ? ' on' : ''}" data-prof="${id}" style="--pc:${p.pcolor || COLORS[0]}"${cur ? ' aria-current="true"' : ''}>
      <span class="pc-name">${esc(p.team)}</span>
      <span class="pc-sub">${lv.emoji} ${lv.name} · 🏒 ${g}</span>
      <span class="pc-on">${cur ? '✓ играет' : ''}</span>
    </button>`;
  }).join('');
}
function switchProfile(id) {
  if (id !== family.active) {
    save();
    activate(id);
    save(); // запоминаем, кто играл последним
    resetView();
    renderAll();
    checkReport();
  }
  profDlg.close();
}
function showProfForm(on) {
  profForm.hidden = !on;
  document.getElementById('profFoot').hidden = on;
  if (on) {
    profName.value = '';
    profFrom.innerHTML = '<option value="">Начать с пустого катка</option>' + family.order.map((id) =>
      `<option value="${id}">Скопировать привычки и призы: ${esc(family.profiles[id].team)}</option>`).join('');
    profName.focus();
  }
}
document.getElementById('teamName').addEventListener('click', () => {
  showProfForm(false);
  renderProfiles();
  profDlg.showModal();
});
document.getElementById('profList').addEventListener('click', (e) => {
  const c = e.target.closest('[data-prof]');
  if (c) switchProfile(c.dataset.prof);
});
document.getElementById('profAdd').addEventListener('click', () =>
  requirePin('Добавить игрока может только родитель.', () => showProfForm(true), true));
document.getElementById('profCancel').addEventListener('click', () => showProfForm(false));
profForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = profName.value.trim().slice(0, 30);
  if (!name) { profName.focus(); return; }
  syncFamily();
  const used = family.order.map((id) => family.profiles[id].pcolor);
  const p = { team: name, habits: [], log: {}, v: 3, pcolor: COLORS.find((c) => !used.includes(c)) || COLORS[family.order.length % COLORS.length] };
  const src = family.profiles[profFrom.value];
  if (src) {
    // Привычки и призы копируются, отметки — нет: новый игрок начинает с сегодняшнего дня
    p.habits = src.habits.map((h) => Object.assign({}, h, { createdAt: dkey(today()) }));
    p.groups = (src.groups || []).map((g) => Object.assign({}, g));
    p.prizes = (src.prizes || []).map((x) => Object.assign({}, x));
  }
  migrate(p);
  const id = 'p' + uid();
  family.order.push(id);
  family.profiles[id] = p;
  showProfForm(false);
  switchProfile(id);
});
// Удаление игрока — в Настройках, с PIN (цвет игрока — в обработчике Настроек выше)
document.getElementById('profDelete').addEventListener('click', () => {
  if (family.order.length < 2) return;
  requirePin('Удалить игрока может только родитель.', () => {
    if (!confirm(`Удалить игрока «${state.team}»? Все его шайбы, экипировка, призы и заметки пропадут. Перед удалением лучше скачать резервную копию.`)) return;
    const i = family.order.indexOf(family.active);
    delete family.profiles[family.active];
    family.order.splice(i, 1);
    activate(family.order[Math.max(0, i - 1)]);
    save();
    resetView();
    renderAll();
  }, true);
});

let currentTab = 'today';
function showTab(name) {
  currentTab = name;
  document.querySelectorAll('.tab-btn').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + name));
  // У Настроек нет кнопки в ряду вкладок — подсвечиваем шестерёнку на табло
  document.getElementById('settingsBtn').classList.toggle('on', name === 'settings');
  renderAll();
}
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) showTab(b.dataset.tab);
});

function renderAll() {
  checkChallenge();
  renderHeader();
  renderToday();
  // «Путь» меряет SVG-дорогу, поэтому рисуем его, только когда вкладка видна
  if (currentTab === 'path') renderPath();
  if (currentTab === 'locker') renderLocker();
  if (currentTab === 'stats') renderStats();
  if (currentTab === 'fame') renderFame();
  if (currentTab === 'settings') renderSettings();
}

// ---------- Матч-отчёт: один раз в новом месяце показываем итоги прошлого ----------
const reportDlg = document.getElementById('reportDialog');
let reportMonth = null;
function checkReport() {
  const t = today();
  const pm = new Date(t.getFullYear(), t.getMonth() - 1, 1);
  const key = dkey(pm).slice(0, 7);
  if (state.reportSeen === key) return;
  state.reportSeen = key;
  save();
  if (monthStats(pm.getFullYear(), pm.getMonth()).empty) return; // прошлый месяц без привычек
  reportMonth = pm;
  document.getElementById('rTitle').textContent = `📋 Матч-отчёт: ${MONTHS_NOM[pm.getMonth()]} ${pm.getFullYear()}`;
  document.getElementById('rBody').innerHTML = reportHTML(pm.getFullYear(), pm.getMonth());
  if (!reportDlg.open) reportDlg.showModal();
}
document.getElementById('rOk').addEventListener('click', () => reportDlg.close());
document.getElementById('rStats').addEventListener('click', () => {
  reportDlg.close();
  chartRange = 'month';
  chartMonth = reportMonth;
  showTab('stats');
  const r = elStats.querySelector('.report');
  if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Новый день — обновляем экран, если вкладка оставалась открытой
let lastDay = dkey(today());
setInterval(() => {
  const k = dkey(today());
  if (k !== lastDay) { lastDay = k; viewMonth = new Date(today().getFullYear(), today().getMonth(), 1); scrollToToday = true; renderAll(); checkReport(); }
}, 60000);

// ---------- Приветствие: первое открытие на этом устройстве ----------
const welDlg = document.getElementById('welcomeDialog');
let welStart = 'sample'; // sample — пример привычек, empty — пустой каток
document.getElementById('wStart').addEventListener('click', (e) => {
  const b = e.target.closest('[data-start]');
  if (!b) return;
  welStart = b.dataset.start;
  document.querySelectorAll('#wStart [data-start]').forEach((x) => x.classList.toggle('on', x === b));
});
// Без выбора окно не закрывается: Esc ничего не делает
welDlg.addEventListener('cancel', (e) => e.preventDefault());
document.getElementById('welcomeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('wName').value.trim().slice(0, 30);
  if (!name) { document.getElementById('wName').focus(); return; }
  state.team = name;
  if (welStart === 'empty') state.habits = [];
  save();
  welDlg.close();
  resetView();
  renderAll();
  if (document.getElementById('wPin').checked && !hasPin()) openPin('set', 'Почти готово!');
});
// Второе устройство: проще всего восстановить файл копии, запасной путь — синхронизация
document.getElementById('wHave').addEventListener('click', (e) => {
  e.preventDefault();
  welDlg.close();
  showTab('settings');
  document.getElementById('bkRestore').scrollIntoView({ block: 'center' });
});

renderAll();
if (firstRun) welDlg.showModal();
else checkReport();
syncSoon(300);
