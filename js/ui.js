'use strict';
// Общий интерфейс: замена <dialog> для старых ТВ, звук, праздник «ГОЛ!», Конь-огонь и шапка, родительский PIN.
// Скрипты подключаются в index.html по порядку и видят общие имена друг друга.

// Старые браузеры (например, в телевизорах) не знают <dialog>: простая замена showModal/close
if (!window.HTMLDialogElement || !HTMLDialogElement.prototype.showModal) {
  document.documentElement.classList.add('no-dialog');
  document.querySelectorAll('dialog').forEach((d) => {
    Object.defineProperty(d, 'open', {
      configurable: true,
      get() { return this.hasAttribute('open'); },
      set(v) { if (v) this.setAttribute('open', ''); else this.removeAttribute('open'); },
    });
    d.showModal = function () { this.setAttribute('open', ''); document.body.classList.add('modal-open'); };
    d.show = d.showModal;
    d.close = function () {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
      this.dispatchEvent(new Event('close'));
    };
  });
}

// ---------- Звук: гудок после гола ----------
let audio;
function horn(win) {
  if (!state.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const g = audio.createGain();
    g.connect(audio.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
    g.gain.setValueAtTime(0.18, t + (win ? 0.9 : 0.45));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (win ? 1.2 : 0.7));
    [220, 277, 330].forEach((f) => {
      const o = audio.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(g);
      o.start(t);
      o.stop(t + (win ? 1.25 : 0.75));
    });
  } catch (e) { /* звук недоступен */ }
}

// ---------- Праздник ----------
const overlay = document.getElementById('goalOverlay');
let overlayTimer;
function celebrate(text) {
  document.getElementById('goalText').textContent = text;
  overlay.classList.remove('show');
  // Поверх открытого окна (например, «Подходы») праздник виден только как popover
  if (overlay.showPopover) { try { overlay.hidePopover(); } catch (e) { /* не был открыт */ } }
  void overlay.offsetWidth;
  overlay.classList.add('show');
  if (overlay.showPopover) { try { overlay.showPopover(); } catch (e) { /* без popover */ } }
  const conf = document.getElementById('confetti');
  conf.innerHTML = '';
  const palette = ['#e63946', '#1e6fd9', '#ffc93c', '#2bb673', '#ff6fae', '#fff'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = palette[i % palette.length];
    p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
    p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    p.style.animationDelay = (0.3 + Math.random() * 0.5) + 's';
    conf.appendChild(p);
  }
  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => {
    overlay.classList.remove('show');
    if (overlay.hidePopover) { try { overlay.hidePopover(); } catch (e) { /* уже закрыт */ } }
    conf.innerHTML = '';
  }, 1900);
}
// Общая реакция на новую шайбу: рекорд важнее победы, победа важнее простого гола
function cheer(k, { scored, record }) {
  const win = scored && doneCount(k) === winTarget(k);
  if (record) celebrate(win ? 'РЕКОРД! ПОБЕДА!' : 'РЕКОРД!');
  else if (win) celebrate('ПОБЕДА!');
  if (scored || record) horn(win || record);
}

// ---------- Конь-огонь: талисман в форме СКА ----------
// Цвета СКА: тёмно-синий, красный, белый
const SKA = { navy: '#123170', red: '#d8232a', white: '#fff', ink: '#2a1a12' };
const ITEMS = [
  { id: 'skates', name: 'Коньки', price: 5, slot: 'skates', ico: '⛸️' },
  { id: 'stick', name: 'Клюшка', price: 10, slot: 'stick', ico: '🏒' },
  { id: 'helmet', name: 'Шлем', price: 15, slot: 'helmet', ico: '⛑️' },
  { id: 'gloves', name: 'Краги', price: 20, slot: 'gloves', ico: '🧤' },
  { id: 'pants', name: 'Шорты и гетры', price: 25, slot: 'pants', ico: '🩳' },
  { id: 'home', name: 'Свитер домашний', price: 30, slot: 'jersey', ico: '🔵', note: 'синий' },
  { id: 'away', name: 'Свитер гостевой', price: 30, slot: 'jersey', ico: '⚪', note: 'белый' },
  { id: 'captain', name: 'Капитанская «С»', price: 50, slot: 'captain', ico: '©️', note: 'видна на свитере' },
  { id: 'gstick', name: 'Золотая клюшка', price: 100, slot: 'stick', ico: '✨' },
  { id: 'cup', name: 'Кубок Гагарина', price: 200, slot: 'cup', ico: '🏆' },
];
const wallet = () => totalGoals() + bonusGoals() - state.shop.spent;
const worn = (slot) => state.shop.worn[slot];

// Рисунок коня: тело + слои экипировки. viewBox 0 0 200 240, стоит лицом к нам
function horseInner() {
  const st = `stroke="${SKA.ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const body = '#e8692c', light = '#ffc99c', hoof = '#4a2f22';
  const jersey = worn('jersey');
  const jc = jersey === 'away'
    ? { base: SKA.white, text: SKA.navy, s1: SKA.navy, s2: SKA.red }
    : { base: SKA.navy, text: SKA.white, s1: SKA.white, s2: SKA.red };
  const stick = worn('stick');
  const shaft = stick === 'gstick' ? '#ffc93c' : '#3b3f4f';
  const blade = stick === 'gstick' ? '#e0a400' : '#14161f';
  let s = '';
  // Хвост и грива-пламя (сзади)
  s += `<path d="M138 150 Q178 140 186 176 Q172 166 170 182 Q160 166 150 178 Q152 160 138 162 Z" fill="#ff8c1a" ${st}/>
    <path d="M146 156 Q170 152 176 170 Q164 164 160 172 Q156 162 146 166 Z" fill="#ffd23f"/>`;
  s += `<path d="M80 22 Q82 6 96 6 Q98 -4 112 2 Q126 0 130 14 Q148 20 146 42 Q140 36 134 44 L120 24 Z" fill="#ff8c1a" ${st}/>
    <path d="M96 14 Q102 6 112 10 Q122 8 126 18 Q138 22 138 34 L124 24 Z" fill="#ffd23f"/>`;
  // Ноги, руки, туловище
  s += `<rect x="74" y="158" width="20" height="58" rx="9" fill="${body}" ${st}/>
    <rect x="106" y="158" width="20" height="58" rx="9" fill="${body}" ${st}/>`;
  s += `<path d="M64 110 Q100 98 136 110 L142 166 Q100 178 58 166 Z" fill="${body}" ${st}/>
    <path d="M84 120 Q100 114 116 120 L118 160 Q100 166 82 160 Z" fill="${light}"/>`;
  // Шорты и гетры
  if (worn('pants')) {
    s += `<rect x="73" y="186" width="22" height="24" rx="4" fill="${SKA.navy}" ${st}/>
      <rect x="105" y="186" width="22" height="24" rx="4" fill="${SKA.navy}" ${st}/>
      <rect x="74.5" y="194" width="19" height="4" fill="${SKA.white}"/><rect x="74.5" y="198" width="19" height="4" fill="${SKA.red}"/>
      <rect x="106.5" y="194" width="19" height="4" fill="${SKA.white}"/><rect x="106.5" y="198" width="19" height="4" fill="${SKA.red}"/>
      <path d="M60 152 L140 152 L138 186 L106 188 L100 176 L94 188 L62 186 Z" fill="${SKA.navy}" ${st}/>
      <path d="M64 160 L63 184 M136 160 L137 184" stroke="${SKA.red}" stroke-width="5"/>`;
  }
  // Свитер
  if (jersey) {
    s += `<path d="M62 108 Q100 96 138 108 L146 170 Q100 182 54 170 Z" fill="${jc.base}" ${st}/>
      <path d="M56 158 Q100 168 144 158 L145 164 Q100 175 55 164 Z" fill="${jc.s1}"/>
      <path d="M55 164 Q100 175 145 164 L146 169 Q100 180 54 169 Z" fill="${jc.s2}"/>
      <path d="M88 103 L100 116 L112 103" fill="none" stroke="${SKA.red}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M100 119 l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="${SKA.red}"/>
      <text x="100" y="152" text-anchor="middle" font-family="Russo One, Arial Black, sans-serif" font-size="20" fill="${jc.text}" stroke="${SKA.red}" stroke-width="1.2" paint-order="stroke">СКА</text>
      <text x="82" y="130" text-anchor="middle" font-family="Russo One, Arial Black, sans-serif" font-size="12" fill="${jc.text}">${state.shop.number}</text>`;
    if (worn('captain')) {
      s += `<circle cx="119" cy="124" r="7" fill="${SKA.white}" stroke="${SKA.red}" stroke-width="2"/>
        <text x="119" y="128.2" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="10" font-weight="900" fill="${SKA.red}">С</text>`;
    }
  }
  // Руки (рукава — цвета свитера)
  const arm = jersey ? jc.base : body;
  s += `<path d="M66 116 L48 158" stroke="${SKA.ink}" stroke-width="22" stroke-linecap="round"/>
    <path d="M66 116 L48 158" stroke="${arm}" stroke-width="16" stroke-linecap="round"/>
    <path d="M134 116 L152 158" stroke="${SKA.ink}" stroke-width="22" stroke-linecap="round"/>
    <path d="M134 116 L152 158" stroke="${arm}" stroke-width="16" stroke-linecap="round"/>`;
  if (jersey) {
    s += `<path d="M54 144 L51 151 M146 144 L149 151" stroke="${jc.s1}" stroke-width="16" stroke-linecap="butt"/>
      <path d="M51.5 150 L50 153 M148.5 150 L150 153" stroke="${jc.s2}" stroke-width="16" stroke-linecap="butt"/>`;
  }
  // Клюшка — в правом (от нас левом) копыте
  if (stick) {
    s += `<path d="M58 118 L28 224" stroke="${SKA.ink}" stroke-width="9" stroke-linecap="round"/>
      <path d="M58 118 L28 224" stroke="${shaft}" stroke-width="5" stroke-linecap="round"/>
      <path d="M30 220 L6 226 Q1 229 5 233 L34 230 Z" fill="${blade}" ${st}/>`;
    if (stick === 'gstick') s += '<path d="M40 176 l3 -6 l3 6 l-3 6z M18 206 l2 -4 l2 4 l-2 4z" fill="#fff"/>';
  }
  // Кубок Гагарина — в другом копыте
  if (worn('cup')) {
    s += `<path d="M138 104 Q140 140 160 144 Q180 140 182 104 Z" fill="#dfe6ee" ${st}/>
      <ellipse cx="160" cy="104" rx="22" ry="6" fill="#f4f7fa" ${st}/>
      <path d="M144 112 Q146 132 158 136" fill="none" stroke="#fff" stroke-width="3"/>
      <rect x="155" y="144" width="10" height="10" fill="#c9d3de" ${st}/>
      <rect x="146" y="152" width="28" height="10" rx="3" fill="#c9d3de" ${st}/>`;
  }
  // Копыта или краги
  if (worn('gloves')) {
    s += `<rect x="36" y="148" width="26" height="24" rx="8" fill="${SKA.navy}" ${st}/><rect x="37.5" y="148" width="23" height="6" rx="3" fill="${SKA.red}"/>
      <rect x="138" y="148" width="26" height="24" rx="8" fill="${SKA.navy}" ${st}/><rect x="139.5" y="148" width="23" height="6" rx="3" fill="${SKA.red}"/>`;
  } else {
    s += `<circle cx="48" cy="161" r="10" fill="${hoof}" ${st}/><circle cx="152" cy="161" r="10" fill="${hoof}" ${st}/>`;
  }
  // Ноги внизу: коньки или копыта
  if (worn('skates')) {
    s += `<path d="M70 206 L96 206 L98 224 L64 224 Q62 216 70 214 Z" fill="${SKA.navy}" ${st}/>
      <path d="M104 206 L130 206 L136 214 Q138 224 136 224 L102 224 Z" fill="${SKA.navy}" ${st}/>
      <path d="M72 208 L94 208 M106 208 L128 208" stroke="${SKA.red}" stroke-width="3"/>
      <path d="M64 230 L100 230 M102 230 L138 230" stroke="#9fb3c8" stroke-width="4" stroke-linecap="round"/>
      <path d="M70 224 L70 230 M94 224 L94 230 M108 224 L108 230 M132 224 L132 230" stroke="${SKA.ink}" stroke-width="3"/>`;
  } else {
    s += `<ellipse cx="84" cy="218" rx="13" ry="7" fill="${hoof}" ${st}/><ellipse cx="116" cy="218" rx="13" ry="7" fill="${hoof}" ${st}/>`;
  }
  // Голова: грива-пламя по шее, длинная морда, уши торчком
  s += `<path d="M128 40 Q152 52 144 70 Q156 80 146 92 Q154 104 138 110 L122 100 Z" fill="#ff8c1a" ${st}/>
    <path d="M130 54 Q142 62 136 74 Q144 84 136 92 L126 90 Z" fill="#ffd23f"/>
    <path d="M72 32 L76 0 L92 22 Z" fill="${body}" ${st}/><path d="M128 32 L124 0 L108 22 Z" fill="${body}" ${st}/>
    <path d="M77 22 L78 10 L86 20 Z M123 22 L122 10 L114 20 Z" fill="#ff9fb0"/>
    <path d="M68 46 Q68 16 100 16 Q132 16 132 46 L127 90 Q125 112 100 112 Q75 112 73 90 Z" fill="${body}" ${st}/>
    <path d="M96 26 Q100 20 104 26 L106 70 L94 70 Z" fill="#fff4e8"/>
    <path d="M76 80 Q78 66 100 66 Q122 66 124 80 L124 92 Q122 112 100 112 Q78 112 76 92 Z" fill="${light}" ${st}/>
    <ellipse cx="89" cy="86" rx="4" ry="6" fill="${SKA.ink}" transform="rotate(-15 89 86)"/><ellipse cx="111" cy="86" rx="4" ry="6" fill="${SKA.ink}" transform="rotate(15 111 86)"/>
    <path d="M90 100 Q100 106 110 100" fill="none" stroke="${SKA.ink}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="86" cy="44" rx="8" ry="10" fill="#fff" ${st}/><ellipse cx="114" cy="44" rx="8" ry="10" fill="#fff" ${st}/>
    <circle cx="88" cy="46" r="4.5" fill="${SKA.ink}"/><circle cx="116" cy="46" r="4.5" fill="${SKA.ink}"/>
    <circle cx="89.5" cy="44" r="1.5" fill="#fff"/><circle cx="117.5" cy="44" r="1.5" fill="#fff"/>
    <ellipse cx="76" cy="62" rx="5" ry="3" fill="#ff7b9c" opacity=".7"/><ellipse cx="124" cy="62" rx="5" ry="3" fill="#ff7b9c" opacity=".7"/>`;
  // Шлем: уши торчат сквозь отверстия, спереди козырёк
  if (worn('helmet')) {
    s += `<path d="M63 46 Q62 16 100 14 Q138 16 137 46 L137 50 Q100 44 63 50 Z" fill="${SKA.navy}" ${st}/>
      <path d="M100 15 L100 45" stroke="${SKA.red}" stroke-width="6"/>
      <path d="M66 49 Q100 43 134 49 L133 58 Q100 52 67 58 Z" fill="#bfe3ff" fill-opacity=".55" ${st}/>
      <path d="M72 28 L77 6 L88 22 Z M128 28 L123 6 L112 22 Z" fill="${body}" ${st}/>
      <path d="M100 18 l1.6 3.4 3.7.5-2.7 2.6.6 3.7-3.2-1.8-3.2 1.8.6-3.7-2.7-2.6 3.7-.5z" fill="${SKA.white}"/>`;
  } else {
    // чёлка-огонёк
    s += `<path d="M90 26 Q92 12 100 8 Q98 18 106 16 Q112 22 108 30 Q100 24 90 30 Z" fill="#ff8c1a" ${st}/>`;
  }
  return s;
}
// Один рисунок на всё приложение: шапка, «Путь», гол и раздевалка используют <use href="#horse">
function paintHorse() {
  document.getElementById('horse').innerHTML = horseInner();
}

function renderHeader() {
  paintHorse();
  const g = totalGoals();
  const lv = LEVELS[levelIndex(g)];
  document.getElementById('sbGoals').textContent = g;
  document.getElementById('sbLevel').textContent = `${lv.emoji} ${lv.name}`;
  const tn = document.getElementById('teamName');
  tn.textContent = `🏒 ${state.team} ▾`;
  tn.style.setProperty('--pc', state.pcolor || COLORS[0]);
  document.getElementById('soundBtn').textContent = state.sound ? '🔊' : '🔇';
  document.getElementById('gearDot').hidden = !backupDue();
  // Родительский режим открыт — видно на любой вкладке, закрыть можно сразу
  const bar = document.getElementById('parentBar');
  const open = hasPin() && unlocked();
  bar.hidden = !open;
  if (open) {
    const t = new Date(unlockedUntil);
    bar.innerHTML = `<span>🔓 Родительский режим открыт до ${pad(t.getHours())}:${pad(t.getMinutes())} — можно менять прошлые дни, привычки и настройки.</span><button type="button" class="btn btn-ghost" data-lock>🔒 Закрыть</button>`;
  }
}
document.getElementById('parentBar').addEventListener('click', (e) => { if (e.target.closest('[data-lock]')) lockNow(); });

// ---------- Родительский PIN ----------
// PIN и кодовое слово храним не открытым текстом, а хешем — от случайного подсматривания
const UNLOCK_MIN = 5; // после верного PIN родительский режим длится 5 минут
let unlockedUntil = 0;
const pinDlg = document.getElementById('pinDialog');
let pinMode = 'enter'; // enter — ввести PIN, set — задать новый, forgot — кодовое слово
let pinAfter = null; // что сделать после верного PIN

function hashStr(s) {
  let h = 0x811c9dc5;
  for (const ch of `shaiba:${s}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}
const hasPin = () => !!(state.pin && state.pin.hash);
const unlocked = () => !hasPin() || Date.now() < unlockedUntil;
const normWord = (s) => s.trim().toLowerCase().replace(/ё/g, 'е');

// Выполнить действие родителя: спросить PIN, если он задан и режим не открыт.
// must — действие защищено всегда: без PIN сначала предлагаем его создать.
function requirePin(reason, fn, must = false) {
  if (hasPin() ? unlocked() : !must) { fn(); return; }
  pinAfter = fn;
  openPin(hasPin() ? 'enter' : 'set', reason);
}
function unlock() {
  unlockedUntil = Date.now() + UNLOCK_MIN * 60000;
  // по истечении времени обновляем экраны, чтобы снова показать замки
  setTimeout(() => { if (!unlocked()) refreshLocks(); }, UNLOCK_MIN * 60000 + 500);
}
function lockNow() { unlockedUntil = 0; refreshLocks(); }
function refreshLocks() {
  renderHeader();
  if (currentTab === 'settings') renderSettings();
  if (currentTab === 'locker') renderLocker();
}

function openPin(mode, reason) {
  pinMode = mode;
  const t = {
    enter: ['🔐 Родительский PIN', reason || 'Введи PIN, чтобы продолжить.'],
    set: ['🔐 Новый PIN', `${reason ? reason + ' ' : ''}Придумай PIN из 4 цифр и кодовое слово — оно поможет, если PIN забудется.`],
    forgot: ['🔑 Забыли PIN?', 'Введи кодовое слово — потом можно будет задать новый PIN.'],
  }[mode];
  document.getElementById('pinTitle').textContent = t[0];
  document.getElementById('pinText').textContent = t[1];
  document.getElementById('pinMsg').textContent = '';
  pinDlg.querySelectorAll('[data-pinmode]').forEach((el) => { el.hidden = !el.dataset.pinmode.split(' ').includes(mode); });
  pinDlg.querySelectorAll('input').forEach((el) => { el.value = ''; });
  document.getElementById('pinForgot').hidden = mode !== 'enter';
  if (!pinDlg.open) pinDlg.showModal();
  const first = pinDlg.querySelector(`[data-pinmode~="${mode}"] input`);
  if (first) first.focus();
}
function pinDone() {
  const fn = pinAfter;
  pinAfter = null;
  pinDlg.close();
  refreshLocks();
  if (fn) fn();
}

document.getElementById('pinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = document.getElementById('pinMsg');
  const v = (id) => document.getElementById(id).value.trim();
  if (pinMode === 'enter') {
    if (hashStr(v('pinIn')) === state.pin.hash) { unlock(); pinDone(); return; }
    msg.textContent = '❌ Неверный PIN. Попробуй ещё раз.';
    document.getElementById('pinIn').value = '';
    pinDlg.querySelector('.pin-box').classList.remove('shake');
    void pinDlg.offsetWidth;
    pinDlg.querySelector('.pin-box').classList.add('shake');
    return;
  }
  if (pinMode === 'forgot') {
    if (state.pin && normWord(v('pinWord2')) && hashStr(normWord(v('pinWord2'))) === state.pin.word) {
      unlock();
      openPin('set', '✅ Кодовое слово верное.');
      return;
    }
    msg.textContent = '❌ Кодовое слово не подходит.';
    return;
  }
  // set: новый PIN
  if (!/^\d{4}$/.test(v('pinNew'))) { msg.textContent = 'PIN — ровно 4 цифры.'; return; }
  if (v('pinNew') !== v('pinNew2')) { msg.textContent = 'PIN не совпадает с повтором.'; return; }
  if (normWord(v('pinWord')).length < 3) { msg.textContent = 'Кодовое слово — хотя бы 3 буквы.'; return; }
  state.pin = { hash: hashStr(v('pinNew')), word: hashStr(normWord(v('pinWord'))) };
  save();
  // Новый PIN не оставляет родительский режим открытым: отложенное действие
  // (например, выдача приза) выполняется один раз, дальше снова нужен PIN
  unlockedUntil = 0;
  pinDone();
});
// PIN ввели целиком — проверяем сразу, без кнопки
document.getElementById('pinIn').addEventListener('input', (e) => {
  if (!/^\d{4}$/.test(e.target.value)) return;
  const f = document.getElementById('pinForm');
  // requestSubmit есть не везде (старые браузеры ТВ) — тогда отправляем событие сами
  if (f.requestSubmit) f.requestSubmit();
  else f.dispatchEvent(new Event('submit', { cancelable: true }));
});
document.getElementById('pinForgot').addEventListener('click', () => openPin('forgot'));
pinDlg.addEventListener('close', () => { pinAfter = null; });

// Кнопка ✕ в любом окне — закрыть, как «Отмена»
document.addEventListener('click', (e) => {
  const x = e.target.closest('[data-close]');
  if (x) x.closest('dialog').close();
});

// ---------- Шапка, вкладки ----------
document.getElementById('soundBtn').addEventListener('click', () => {
  state.sound = !state.sound;
  save();
  renderHeader();
});
