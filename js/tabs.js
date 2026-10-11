'use strict';
// Вкладки «Путь», «Магазин» (и окно приза), «Статистика», «Зал славы».
// Скрипты подключаются в index.html по порядку и видят общие имена друг друга.

// ---------- Вкладка «Путь» ----------
const elPath = document.getElementById('tab-path');

function trophies() {
  const g = totalGoals();
  const keys = Object.keys(state.log);
  const maxDay = keys.reduce((m, k) => Math.max(m, state.log[k].length), 0);
  const perfect = keys.filter(isPerfect).length;
  const wins = keys.filter(isWin).length;
  const best = state.habits.reduce((m, h) => Math.max(m, bestStreak(h.id)), 0);
  const records = state.habits.filter(isCount).reduce((s, h) => s + recordsBroken(h.id), 0);
  return [
    { ico: '🏒', name: 'Первая шайба', desc: 'Выполни любую привычку', ok: g >= 1 },
    { ico: '🎩', name: 'Хет-трик', desc: '3 шайбы за один день', ok: maxDay >= 3 },
    { ico: '🌟', name: 'Идеальный матч', desc: 'Все привычки за день', ok: perfect >= 1 },
    { ico: '🔥', name: 'Разогрев', desc: 'Серия 3 дня', ok: best >= 3 },
    { ico: '💪', name: 'Неделя силы', desc: 'Серия 7 дней', ok: best >= 7 },
    { ico: '🧊', name: 'Железная воля', desc: 'Серия 30 дней', ok: best >= 30 },
    { ico: '🏅', name: 'Рекордсмен', desc: 'Побей свой рекорд', ok: records >= 1 },
    { ico: '🚀', name: 'Машина рекордов', desc: '10 рекордов', ok: records >= 10 },
    { ico: '🥇', name: 'Чемпион', desc: '10 побед в матчах', ok: wins >= 10 },
    { ico: '💯', name: 'Сотня', desc: '100 шайб', ok: g >= 100 },
  ];
}

// Медали за вызовы недели: новые сверху
function medalsHTML() {
  const won = Object.entries(state.challenges).filter(([, c]) => c.done).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const count = (i) => won.filter(([, c]) => c.diff === i).length;
  return `<h2 class="gap-top">Медали вызовов</h2>
    ${won.length ? `<div class="medal-sum">${CHAL_DIFF.map((d, i) => `<span>${d.medal} ${count(i)}</span>`).join('')}</div>
    <div class="trophies">${won.map(([mon, c]) => `<div class="trophy medal">
        <span class="t-ico" aria-hidden="true">${CHAL_DIFF[c.diff].medal}</span>
        <span class="t-name">${esc(chalTitle(c))}</span>
        <span class="t-desc">Неделя с ${shortDate(mon)} · +${c.bonus} 🏒</span>
      </div>`).join('')}</div>`
    : noteList(['Выполни вызов недели — получишь медаль и бонусные шайбы в кошелёк.', '🥉 лёгкий +3, 🥈 средний +5, 🥇 трудный +10.'])}`;
}

// Карточка игрока: команду, номер и ссылку заполняет родитель в ⚙️ Настройках; пустой профиль — без карточки
function playerCard() {
  const p = state.player;
  if (!(p.club || p.number || p.fhId)) return '';
  const line = [p.number ? `№${p.number}` : '', esc(p.club)].filter(Boolean).join(' · ');
  // Фото с сайта Федерации; не загрузилось — остаётся Конь-огонь
  return `<div class="player-card">
    <div class="pl-photo"><svg viewBox="0 0 200 240" aria-hidden="true"><use href="#horse"/></svg>${p.fhId
      ? `<img src="${fhPhoto(p.fhId)}" alt="Фото: ${esc(state.team)}" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>
    <div class="pl-info">
      <div class="pl-name">${esc(state.team)}</div>
      ${line ? `<div class="pl-line">🏒 ${line}</div>` : ''}
      ${p.fhId ? `<a class="btn btn-ghost pl-site" href="${fhLink(p.fhId)}" target="_blank" rel="noopener noreferrer">Страница на ФХСПб ↗</a>` : ''}
    </div>
  </div>`;
}

const wideRoad = window.matchMedia('(min-width: 1000px)');
function renderPath() {
  const g = totalGoals();
  const li = levelIndex(g);
  const lv = LEVELS[li];
  const next = LEVELS[li + 1];
  const frac = next ? (g - lv.min) / (next.min - lv.min) : 1;

  // Станции: на широком экране — один ряд, на узком — змейка из двух рядов (4 + 3)
  const one = wideRoad.matches;
  const n = LEVELS.length;
  let W, H, pts, nameFs, subFs, R;
  if (one) {
    W = 1000; H = 200; nameFs = 16; subFs = 13; R = 38;
    pts = LEVELS.map((l, i) => ({ x: 80 + i * (840 / (n - 1)), y: 90 + (i % 2 ? 14 : 0) }));
  } else {
    W = 380; nameFs = 14; subFs = 12; R = 34;
    const row2 = n - 4; // сколько станций во втором ряду
    const y1 = 80, y2 = 270;
    pts = LEVELS.map((l, i) => (i < 4
      ? { x: 55 + i * 90, y: y1 }
      : { x: 325 - (i - 4) * ((325 - 55) / (row2 - 1)), y: y2 }));
    H = y2 + 110;
  }
  // Дорога между станциями; на повороте змейки — дуга справа
  const segs = pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1];
    if (p.x === q.x) return `M${p.x} ${p.y} C${p.x + 60} ${p.y}, ${q.x + 60} ${q.y}, ${q.x} ${q.y}`;
    const mx = (p.x + q.x) / 2;
    return `M${p.x} ${p.y} C${mx} ${p.y}, ${mx} ${q.y}, ${q.x} ${q.y}`;
  });

  const road = segs.map((d) => `<path d="${d}" fill="none" stroke="#d6ecff" stroke-width="30" stroke-linecap="round"/>`).join('');
  const progress = segs.map((d, i) => {
    if (i < li) return `<path d="${d}" fill="none" stroke="#1e6fd9" stroke-width="30" stroke-linecap="round"/>`;
    if (i === li && frac > 0) return `<path d="${d}" pathLength="1" stroke-dasharray="${frac} 1" fill="none" stroke="#1e6fd9" stroke-width="30" stroke-linecap="round"/>`;
    return '';
  }).join('');
  const center = segs.map((d) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 10" opacity=".9"/>`).join('');

  const stations = LEVELS.map((l, i) => {
    const p = pts[i];
    const got = g >= l.min;
    // На узком экране длинное звание переносим на две строки
    const words = l.name.split(' ');
    const lines = !one && words.length > 1 ? [words[0], words.slice(1).join(' ')] : [l.name];
    const nameY = p.y + R + nameFs + 6;
    const subY = nameY + (lines.length - 1) * (nameFs + 2) + subFs + 4;
    return `<g class="${got ? '' : 'locked'}">
      <circle cx="${p.x}" cy="${p.y}" r="${R}" fill="${got ? '#ffc93c' : '#eef3f9'}" stroke="${got ? '#d39a00' : '#b9dcfb'}" stroke-width="5"/>
      <text x="${p.x}" y="${p.y + 11}" text-anchor="middle" font-size="${R - 6}" style="${got ? '' : 'opacity:.45;filter:grayscale(1)'}">${l.emoji}</text>
      ${got ? '' : `<text x="${p.x + R - 10}" y="${p.y - R + 16}" font-size="18">🔒</text>`}
      <text class="st-name" x="${p.x}" y="${nameY}" text-anchor="middle" style="font-size:${nameFs}px">${lines.map((t, j) => `<tspan x="${p.x}" dy="${j ? nameFs + 2 : 0}">${t}</tspan>`).join('')}</text>
      <text class="st-sub" x="${p.x}" y="${subY}" text-anchor="middle" style="font-size:${subFs}px">${l.min ? `${l.min} ${puckWord(l.min)}` : 'старт'}</text>
    </g>`;
  }).join('');

  const left = next ? next.min - g : 0;
  elPath.innerHTML = `
    ${playerCard()}
    <div class="level-card">
      <div class="lv-emoji" aria-hidden="true">${lv.emoji}</div>
      <div>
        <div class="lv-name">${lv.name}</div>
        <div class="lv-sub">${next
          ? `Ещё ${left} ${puckWord(left)} до звания «${next.name}» ${next.emoji}`
          : 'Ты прошёл весь путь! Кубок твой! 🏆'}</div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(frac * 100)}"><i style="width:${frac * 100}%"></i></div>
      </div>
    </div>
    <h2>Путь к Кубку</h2>
    <div class="road-wrap">
      <svg class="road ${one ? 'one' : 'two'}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Путь к Кубку: сейчас звание ${lv.name}, ${g} шайб">
        ${road}${progress}${center}${stations}
        <g id="roadPuck"><g class="bob" style="transform-box:fill-box;transform-origin:center"><use href="#horse" x="-25" y="-56" width="50" height="60"/></g></g>
      </svg>
    </div>
    <h2 class="gap-top">Трофеи</h2>
    <div class="trophies">
      ${trophies().map((t) => `<div class="trophy${t.ok ? '' : ' locked'}">
        <span class="t-ico" aria-hidden="true">${t.ico}</span>
        <span class="t-name">${t.name}</span>
        <span class="t-desc">${t.ok ? 'Получен!' : t.desc}</span>
      </div>`).join('')}
    </div>
    ${medalsHTML()}`;

  // Ставим Коня-огня на дорогу
  const puck = elPath.querySelector('#roadPuck');
  let pos = pts[pts.length - 1];
  if (next) {
    const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tmp.setAttribute('d', segs[li]);
    puck.parentNode.appendChild(tmp);
    const pt = tmp.getPointAtLength(tmp.getTotalLength() * frac);
    tmp.remove();
    pos = { x: pt.x, y: pt.y };
  }
  puck.setAttribute('transform', `translate(${pos.x} ${pos.y - 6})`);
}

// Ширина, с которой путь вытягивается в один ряд (ТВ и компьютер)
// В старых браузерах (телевизоры) у MediaQueryList нет addEventListener — только addListener
const onWideRoad = () => { if (currentTab === 'path') renderPath(); };
if (wideRoad.addEventListener) wideRoad.addEventListener('change', onWideRoad);
else if (wideRoad.addListener) wideRoad.addListener(onWideRoad);

// ---------- Вкладка «Магазин»: экипировка Коня-огня и настоящие призы ----------
const elLocker = document.getElementById('tab-locker');
let pendingBuy = null; // покупка в два нажатия: «Купить» → «Точно?»
let shopView = 'equip'; // 'equip' — экипировка, 'prizes' — призы

const jerseyName = () => (state.shop.jname || state.team.split(' ')[0] || 'ИГРОК').toUpperCase();
const PRIZE_EMOJI = ['📺', '🍦', '🎮', '⛸️', '🎬', '🏟️', '🍕', '🍫', '🍰', '🎁', '🧸', '🎢', '🎳', '🏊', '🚲', '📚', '🎨', '🎟️', '📱', '💰'];
const shortDate = (k) => { const d = parseKey(k); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };

function walletCard(note) {
  const have = Math.max(0, wallet());
  return `<div class="wallet">
    <div><span>Кошелёк</span><b>🏒 ${have}</b></div>
    <ul class="wallet-list">
      <li>Заработано ${totalGoals()}${bonusGoals() ? `, бонусы за вызовы ${bonusGoals()}` : ''}, потрачено ${state.shop.spent}.</li>
      <li>Один кошелёк на экипировку и призы.</li>
      <li>Покупки не снижают звание.</li>
      ${note ? `<li><b>${note}</b></li>` : ''}
    </ul>
  </div>`;
}
const priceBtn = (attr, id, price, have) => (pendingBuy === id
  ? `<button class="btn btn-red" ${attr}="${id}">Точно? Да!</button>`
  : `<button class="btn btn-gold" ${attr}="${id}"${have < price ? ' disabled' : ''}>🏒 ${price}</button>`);
const needMore = (price, have) => `ещё ${price - have} ${puckWord(price - have)}`;

function renderEquip(have) {
  const next = ITEMS.filter((it) => !state.shop.owned.includes(it.id)).sort((a, b) => a.price - b.price)[0];
  const cards = ITEMS.map((it) => {
    const owned = state.shop.owned.includes(it.id);
    const on = worn(it.slot) === it.id;
    const btn = owned
      ? `<button class="btn ${on ? 'btn-ghost' : 'btn-blue'}" data-wear="${it.id}">${on ? 'Снять' : 'Надеть'}</button>`
      : priceBtn('data-buy', it.id, it.price, have);
    const sub = owned ? (on ? '✓ надето' : 'в шкафчике') : have < it.price ? needMore(it.price, have) : (it.note || 'можно купить');
    return `<div class="item${owned ? ' owned' : ''}${on ? ' on' : ''}">
      <span class="it-ico" aria-hidden="true">${it.ico}</span>
      <span class="it-name">${it.name}</span>
      <span class="it-sub">${sub}</span>
      ${btn}
    </div>`;
  }).join('');
  const note = next ? (have >= next.price ? `Хватает на «${next.name}»!` : `До «${next.name}» ещё ${next.price - have}.`) : 'Вся экипировка куплена! 🏆';
  return `
    <div class="locker">
      <div class="locker-stage">
        <svg class="locker-horse bob" viewBox="0 0 200 240" role="img" aria-label="Конь-огонь в экипировке"><use href="#horse"/></svg>
        <div class="nameplate"><b>${esc(jerseyName())}</b><span>${state.shop.number}</span></div>
      </div>
      <div class="locker-side">${walletCard(note)}</div>
    </div>
    <h2>Экипировка СКА</h2>
    <div class="items">${cards}</div>
    ${noteList([
      'Купленное лежит в шкафчике: его можно надевать и снимать сколько угодно.',
      'Свитер можно выбрать домашний или гостевой.',
      'Капитанская «С» видна только на свитере.',
      'Имя и номер на свитере меняются в ⚙️ Настройках.',
    ])}`;
}

function renderPrizes(have) {
  const waiting = state.orders.filter((o) => o.status === 'wait');
  const given = state.orders.filter((o) => o.status === 'given').slice(-8).reverse();
  const cards = state.prizes.map((p) => `
    <div class="item prize">
      <button class="prize-edit" data-pedit="${p.id}" title="Изменить приз (родитель)" aria-label="Изменить приз «${esc(p.name)}»">✏️</button>
      <span class="it-ico" aria-hidden="true">${p.emoji}</span>
      <span class="it-name">${esc(p.name)}</span>
      <span class="it-sub">${have < p.price ? needMore(p.price, have) : 'можно купить'}</span>
      ${priceBtn('data-pbuy', p.id, p.price, have)}
    </div>`).join('');
  const order = (o) => `
    <div class="order">
      <span class="o-ico" aria-hidden="true">${o.emoji}</span>
      <span class="o-name">${esc(o.name)}<small>куплено ${shortDate(o.at)} · 🏒 ${o.price}</small></span>
      <button class="btn btn-blue" data-give="${o.id}">✓ Выдано</button>
      <button class="btn btn-ghost" data-refund="${o.id}" title="Отменить и вернуть шайбы">↩︎</button>
    </div>`;
  const cheapest = state.prizes.reduce((m, p) => (p.price < m ? p.price : m), Infinity);
  const note = state.prizes.length ? (have >= cheapest ? 'Выбирай приз!' : `До первого приза ещё ${cheapest - have}.`) : '';
  return `
    ${walletCard(note)}
    ${waiting.length ? `
      <h2>⏳ Ждут выдачи</h2>
      <div class="orders">${waiting.map(order).join('')}</div>
      ${noteList([
        'Приз куплен — родитель отмечает «✓ Выдано», когда приз получен.',
        '↩︎ — отменить покупку и вернуть шайбы.',
      ])}` : ''}
    <h2>🎁 Призы</h2>
    ${state.prizes.length ? `<div class="items">${cards}</div>` : '<p class="muted">Призов пока нет — родитель может их добавить.</p>'}
    <button class="add-card" data-padd>＋ Новый приз <small>(родитель)</small></button>
    ${given.length ? `
      <h3 class="gap-top">✅ Получено</h3>
      <ul class="given">${given.map((o) => `<li>${o.emoji} ${esc(o.name)} <span>${shortDate(o.givenAt)} · 🏒 ${o.price}</span></li>`).join('')}</ul>` : ''}`;
}

function renderLocker() {
  const have = Math.max(0, wallet());
  const waiting = state.orders.filter((o) => o.status === 'wait').length;
  elLocker.innerHTML = `
    <div class="seg shop-seg" role="group" aria-label="Раздел магазина">
      <button data-view="equip" class="${shopView === 'equip' ? 'on' : ''}">🐴 Экипировка</button>
      <button data-view="prizes" class="${shopView === 'prizes' ? 'on' : ''}">🎁 Призы${waiting ? ` <i class="badge">${waiting}</i>` : ''}</button>
    </div>
    ${shopView === 'equip' ? renderEquip(have) : renderPrizes(have)}`;
}

elLocker.addEventListener('click', (e) => {
  const view = e.target.closest('[data-view]');
  if (view) { shopView = view.dataset.view; pendingBuy = null; renderLocker(); return; }
  const b = e.target.closest('[data-buy]');
  if (b) {
    const it = ITEMS.find((x) => x.id === b.dataset.buy);
    if (pendingBuy !== it.id) { pendingBuy = it.id; renderLocker(); return; }
    pendingBuy = null;
    if (wallet() < it.price || state.shop.owned.includes(it.id)) { renderLocker(); return; }
    state.shop.spent += it.price;
    state.shop.owned.push(it.id);
    state.shop.worn[it.slot] = it.id; // обновку сразу надеваем
    save();
    renderAll();
    celebrate('ОБНОВКА!');
    horn(false);
    return;
  }
  const wr = e.target.closest('[data-wear]');
  if (wr) {
    const it = ITEMS.find((x) => x.id === wr.dataset.wear);
    if (worn(it.slot) === it.id) delete state.shop.worn[it.slot];
    else state.shop.worn[it.slot] = it.id;
    pendingBuy = null;
    save();
    renderAll();
    return;
  }
  // Призы: покупает ребёнок, выдаёт и отменяет — родитель
  const pb = e.target.closest('[data-pbuy]');
  if (pb) {
    const p = state.prizes.find((x) => x.id === pb.dataset.pbuy);
    if (pendingBuy !== p.id) { pendingBuy = p.id; renderLocker(); return; }
    pendingBuy = null;
    if (wallet() < p.price) { renderLocker(); return; }
    state.shop.spent += p.price;
    state.orders.push({ id: uid(), prizeId: p.id, name: p.name, emoji: p.emoji, price: p.price, at: dkey(today()), status: 'wait' });
    save();
    renderAll();
    celebrate('ПРИЗ!');
    horn(false);
    return;
  }
  const give = e.target.closest('[data-give]');
  if (give) {
    const o = state.orders.find((x) => x.id === give.dataset.give);
    requirePin(`Выдать приз «${o.name}»?`, () => {
      o.status = 'given';
      o.givenAt = dkey(today());
      save();
      renderLocker();
    }, true);
    return;
  }
  const rf = e.target.closest('[data-refund]');
  if (rf) {
    const o = state.orders.find((x) => x.id === rf.dataset.refund);
    requirePin(`Отменить «${o.name}» и вернуть ${o.price} ${plural(o.price, ['шайбу', 'шайбы', 'шайб'])}?`, () => {
      state.orders = state.orders.filter((x) => x !== o);
      state.shop.spent = Math.max(0, state.shop.spent - o.price);
      save();
      renderAll();
    }, true);
    return;
  }
  const pe = e.target.closest('[data-pedit]');
  if (pe) { requirePin('Изменять призы может только родитель.', () => openPrize(state.prizes.find((x) => x.id === pe.dataset.pedit)), true); return; }
  if (e.target.closest('[data-padd]')) { requirePin('Добавлять призы может только родитель.', () => openPrize(null), true); return; }
  if (pendingBuy) { pendingBuy = null; renderLocker(); }
});

// ---------- Окно приза (родитель) ----------
const prizeDlg = document.getElementById('prizeDialog');
let editPrize = null;
let prizeEmoji = PRIZE_EMOJI[0];
function paintPrizeEmoji() {
  document.getElementById('prEmoji').innerHTML = PRIZE_EMOJI.map((em) =>
    `<button type="button" class="emo${em === prizeEmoji ? ' on' : ''}" data-pem="${em}">${em}</button>`).join('');
}
function openPrize(p) {
  editPrize = p;
  prizeEmoji = p ? p.emoji : PRIZE_EMOJI[0];
  document.getElementById('prTitle').textContent = p ? 'Изменить приз' : 'Новый приз';
  document.getElementById('prName').value = p ? p.name : '';
  document.getElementById('prPrice').value = p ? p.price : '';
  document.getElementById('prDelete').hidden = !p;
  paintPrizeEmoji();
  prizeDlg.showModal();
}
document.getElementById('prEmoji').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pem]');
  if (b) { prizeEmoji = b.dataset.pem; paintPrizeEmoji(); }
});
document.getElementById('prizeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('prName').value.trim();
  const price = Math.round(Number(document.getElementById('prPrice').value));
  if (!name || !(price >= 1)) return;
  if (editPrize) Object.assign(editPrize, { name, price, emoji: prizeEmoji });
  else state.prizes.push({ id: uid(), name, price, emoji: prizeEmoji });
  save();
  prizeDlg.close();
  renderLocker();
});
document.getElementById('prCancel').addEventListener('click', () => prizeDlg.close());
document.getElementById('prDelete').addEventListener('click', () => {
  if (!editPrize || !confirm(`Удалить приз «${editPrize.name}»? Уже купленные призы останутся в списке выдачи.`)) return;
  state.prizes = state.prizes.filter((x) => x !== editPrize);
  save();
  prizeDlg.close();
  renderLocker();
});

// ---------- Вкладка «Статистика» ----------
const elStats = document.getElementById('tab-stats');
const tip = document.getElementById('tooltip');

// «Круглый» шаг оси, чтобы подписи были 0, 10, 20… а не 0, 24, 48…
const niceStep = (max) => [1, 2, 5, 10, 15, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((s) => max / s <= 6) || 10000;
const roundTop = (x, yy, w, h) => {
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return `M${x} ${yy + h}V${yy + r}Q${x} ${yy} ${x + r} ${yy}H${x + w - r}Q${x + w} ${yy} ${x + w} ${yy + r}V${yy + h}Z`;
};

// Столбчатый график по дням. o: val(d), track(d), goal, barStyle(d), mark(d), tip(d), label
function barChart(days, o) {
  const t = dkey(today());
  const rawMax = Math.max(1, o.goal || 0, ...days.map((d) => Math.max(o.val(d), o.track ? o.track(d) : 0)));
  const step = niceStep(rawMax);
  const maxY = Math.ceil(rawMax / step) * step;
  // Рисуем по реальной ширине вкладки, чтобы подписи на телефоне не становились мелкими
  const VW = Math.max(300, Math.round(elStats.clientWidth) || 640), VH = 230, L = 36, R = 6, T = 22, B = 28;
  const pw = VW - L - R, ph = VH - T - B;
  const band = pw / days.length;
  const bw = Math.max(4, Math.min(28, band * 0.62));
  const y = (v) => T + ph - (v / maxY) * ph;
  let grid = '';
  for (let v = 0; v <= maxY; v += step) {
    grid += `<line class="grid" x1="${L}" x2="${VW - R}" y1="${y(v)}" y2="${y(v)}"/>
      <text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }
  const goalLine = o.goal ? `<line class="goal-line" x1="${L}" x2="${VW - R}" y1="${y(o.goal)}" y2="${y(o.goal)}"/>
    <text class="goal-label" x="${VW - R}" y="${y(o.goal) - 5}" text-anchor="end">норма ${o.goal}</text>` : '';
  const cols = days.map((d, i) => {
    const cx = L + band * i + band / 2;
    const x = cx - bw / 2;
    const dd = parseKey(d.k);
    const v = o.val(d);
    const tr = o.track ? o.track(d) : 0;
    const mark = o.mark(d);
    const showLabel = days.length <= 16 || dd.getDate() === 1 || dd.getDate() % 5 === 0 || d.k === t;
    return `<g class="col${d.future ? ' future' : ''}${d.skip ? ' skipday' : ''}" data-tip="${human(d.k)}: ${o.tip(d)}">
      <rect x="${L + band * i}" y="${T - 20}" width="${band}" height="${ph + 20}" fill="transparent"/>
      ${tr ? `<path class="track" d="${roundTop(x, y(tr), bw, y(0) - y(tr))}"/>` : ''}
      ${d.future ? '' : `<path class="bar-v" ${o.barStyle ? o.barStyle(d) : ''} d="${roundTop(x, y(v), bw, y(0) - y(v))}"/>`}
      ${mark ? `<text x="${cx}" y="${y(v) - 5}" text-anchor="middle" font-size="13">${mark}</text>` : ''}
      ${showLabel ? `<text x="${cx}" y="${VH - 8}" text-anchor="middle">${dd.getDate()}</text>` : ''}
    </g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${o.label}">${grid}${goalLine}${cols}</svg>`;
}

function renderStats() {
  const t = today();
  const g = totalGoals();
  const perfect = Object.keys(state.log).filter(isWin).length;
  const best = state.habits.reduce((m, h) => Math.max(m, bestStreak(h.id)), 0);
  // Процент считаем без дней пропуска
  let wkDone = 0, wkAll = 0;
  for (let i = 0; i < 7; i++) {
    const k = dkey(addDays(t, -i));
    if (isSkip(k)) continue;
    wkDone += doneCount(k);
    wkAll += expectedOn(k).length;
  }
  const wkPct = wkAll ? Math.round((wkDone / wkAll) * 100) : 0;

  // Неделя — последние 7 дней (без дней до первой привычки),
  // месяц — выбранный месяц с 1-го по последнее число; будущие дни — пунктиром.
  // Листать назад можно до месяца, где появились первые привычки или отметки.
  const firstKey = [...state.habits.map((h) => h.createdAt), ...Object.keys(state.log)]
    .reduce((m, k) => (k < m ? k : m), dkey(t));
  const minMonth = new Date(parseKey(firstKey).getFullYear(), parseKey(firstKey).getMonth(), 1);
  const curMonth = new Date(t.getFullYear(), t.getMonth(), 1);
  if (chartMonth < minMonth) chartMonth = minMonth;
  if (chartMonth > curMonth) chartMonth = curMonth;
  const cm = chartMonth;
  let from, to = t;
  if (chartRange === 'week') {
    const firstHabit = state.habits.reduce((m, h) => (h.createdAt < m ? h.createdAt : m), dkey(t));
    from = addDays(t, -6);
    if (dkey(from) < firstHabit) from = parseKey(firstHabit);
  } else {
    from = new Date(cm.getFullYear(), cm.getMonth(), 1);
    to = new Date(cm.getFullYear(), cm.getMonth() + 1, 0);
  }
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const k = dkey(d);
    days.push({ k, done: doneCount(k), all: expectedOn(k).length, act: activeOn(k).length, future: d > t, skip: state.skips[k] });
  }
  const isWinDay = (d) => !d.future && d.act > 0 && d.done >= Math.min(WIN_GOALS, d.act);
  // Итог выбранного периода
  const past = days.filter((d) => !d.future);
  const mGoals = past.reduce((s, d) => s + d.done, 0);
  const mWins = past.filter(isWinDay).length;
  const counted = past.filter((d) => !d.skip);
  const mAll = counted.reduce((s, d) => s + d.all, 0);
  const mPct = mAll ? Math.round((counted.reduce((s, d) => s + d.done, 0) / mAll) * 100) : 0;
  const mSkips = past.filter((d) => d.skip).length;
  const monthName = `${MONTHS_NOM[cm.getMonth()]} ${cm.getFullYear()}`;
  const periodName = chartRange === 'week' ? 'последние 7 дней' : monthName;

  const goalsChart = barChart(days, {
    val: (d) => d.done,
    track: (d) => d.all,
    mark: (d) => (isWinDay(d) ? '⭐' : d.skip && !d.future && !d.done ? SKIPS[d.skip].emoji : ''),
    tip: (d) => (d.future ? 'ещё впереди'
      : d.skip ? `пропуск — ${SKIPS[d.skip].label}${d.done ? `, шайб: ${d.done}` : ''}`
      : `${d.done} из ${d.all}${isWinDay(d) ? ' 🏆' : ''}`),
    label: `Выполненные привычки: ${periodName}`,
  });

  // Прогресс в упражнениях с числом: результат по дням и норма
  const counts = state.habits.filter(isCount);
  if (!counts.some((h) => h.id === progressHabit)) progressHabit = counts[0] ? counts[0].id : null;
  let progress = '';
  if (counts.length) {
    const ph = habitById(progressHabit);
    const u = unitShort(ph);
    const rec = bestOf(ph.id);
    const vals = past.map((d) => sumOf(ph.id, d.k)).filter((v) => v > 0);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    const chart = barChart(days, {
      val: (d) => sumOf(ph.id, d.k),
      goal: ph.goal,
      barStyle: (d) => `style="fill:${ph.color};opacity:${sumOf(ph.id, d.k) >= ph.goal ? 1 : 0.45}"`,
      mark: (d) => (rec.k === d.k && rec.v > 0 ? '🏅' : ''),
      tip: (d) => {
        if (d.future) return 'ещё впереди';
        const s = sumOf(ph.id, d.k), n = setsOf(ph.id, d.k).length;
        return s ? `${s} ${u} (${n} ${plural(n, ['подход', 'подхода', 'подходов'])})${s >= ph.goal ? ' ✓' : ''}${rec.k === d.k ? ' 🏅 рекорд' : ''}` : 'нет результата';
      },
      label: `${ph.name}: результат по дням, ${periodName}`,
    });
    progress = `
    <section class="sbox">
      <h3 class="sbox-title" id="progress">🎯 Прогресс в упражнениях</h3>
      <div class="habit-chips" role="group" aria-label="Упражнение">
        ${counts.map((h) => `<button class="hchip${h.id === ph.id ? ' on' : ''}" data-prog="${h.id}" style="--c:${h.color}">${h.emoji} ${esc(h.name)}</button>`).join('')}
      </div>
      ${noteList([
        `${periodName}: дней с результатом — ${vals.length}, в среднем ${avg} ${u}, норма ${ph.goal} ${u}.`,
        'Яркий столбик — норма выполнена.',
        '🏅 — рекорд.',
      ])}
      ${chart}
    </section>`;
  }

  // Тепловая полоса по каждой привычке за 28 дней
  const rows = state.habits.map((h) => {
    let cells = '';
    for (let i = 27; i >= 0; i--) {
      const k = dkey(addDays(t, -i));
      const active = h.createdAt <= k;
      const on = isDone(h.id, k);
      const sk = state.skips[k];
      const cls = !active ? ' off' : on ? ' on' : sk ? ' skip' : '';
      const txt = !active ? 'ещё не было' : on ? 'гол! ✓' : sk ? `пропуск — ${SKIPS[sk].label}` : 'мимо';
      cells += `<span class="cell${cls}" data-tip="${human(k)}: ${txt}"></span>`;
    }
    const st = strength(h.id);
    return `<div class="hrow" style="--c:${h.color}">
      <div class="hr-name"><span aria-hidden="true">${h.emoji}</span><span>${esc(h.name)}</span></div>
      <div class="cells">${cells}</div>
      <div class="hr-nums">🔥 <b>${streak(h.id)}</b> · 🏅 <b>${bestStreak(h.id)}</b> · <span title="Сила привычки">💪 <b>${st}%</b></span></div>
    </div>`;
  }).join('');

  elStats.innerHTML = `
    <section class="sbox">
    <h3 class="sbox-title">🏒 Итоги</h3>
    <div class="tiles">
      <div class="tile"><div class="t-label">🏒 Всего шайб</div><div class="t-val">${g}</div></div>
      <div class="tile"><div class="t-label">🏆 Побед в матчах</div><div class="t-val">${perfect}</div></div>
      <div class="tile"><div class="t-label">🔥 Лучшая серия</div><div class="t-val">${best} ${dayWord(best)}</div></div>
      <div class="tile"><div class="t-label">📅 За 7 дней</div><div class="t-val">${wkPct}%</div></div>
    </div>
    </section>
    <section class="sbox">
    <h3 class="sbox-title">📊 Шайбы по дням</h3>
    <div class="chart-head">
      <div class="seg" role="group" aria-label="Период">
        ${[['week', '7 дней'], ['month', 'Месяц']].map(([r, label]) =>
          `<button data-range="${r}" class="${r === chartRange ? 'on' : ''}">${label}</button>`).join('')}
      </div>
    </div>
    ${chartRange === 'month' ? `
    <div class="chart-month">
      <button class="btn btn-ghost nav" data-cmonth="-1" aria-label="Прошлый месяц"${cm <= minMonth ? ' disabled' : ''}>◀</button>
      <div>
        <b>${monthName}</b>
        <span>🏒 ${mGoals} ${puckWord(mGoals)} · 🏆 ${mWins} ${plural(mWins, ['победа', 'победы', 'побед'])} · ${mPct}%${mSkips ? ` · 🩹 ${mSkips} ${plural(mSkips, ['пропуск', 'пропуска', 'пропусков'])}` : ''}</span>
      </div>
      <button class="btn btn-ghost nav" data-cmonth="1" aria-label="Следующий месяц"${cm >= curMonth ? ' disabled' : ''}>▶</button>
    </div>` : ''}
    ${goalsChart}
    ${noteList([
      'Синий — забитые шайбы, светлый — сколько можно было забить.',
      '⭐ — победа: 3 шайбы за день.',
      '🤒🧳😴🏟️ — пропуск, он не портит процент и серии.',
    ])}
    </section>
    <section class="sbox report">
      <h3 class="sbox-title">📋 Матч-отчёт: ${monthName}</h3>
      ${reportHTML(cm.getFullYear(), cm.getMonth())}
    </section>
    ${progress}
    <section class="sbox">
    <h3 class="sbox-title">🔥 Каждая привычка за 4 недели</h3>
    ${noteList([
      '🔥 — серия сейчас.',
      '🏅 — лучшая серия.',
      '💪 — сила привычки: растёт от каждой шайбы, а пропуск снижает её чуть-чуть, а не обнуляет.',
    ], 'tight')}
    ${rows || '<p class="muted">Пока нет привычек.</p>'}
    </section>`;
}

elStats.addEventListener('click', (e) => {
  const b = e.target.closest('[data-range]');
  if (b) { chartRange = b.dataset.range; renderStats(); return; }
  const nav = e.target.closest('[data-cmonth]');
  if (nav) {
    chartMonth = new Date(chartMonth.getFullYear(), chartMonth.getMonth() + Number(nav.dataset.cmonth), 1);
    renderStats();
    return;
  }
  const pr = e.target.closest('[data-prog]');
  if (pr) { progressHabit = pr.dataset.prog; renderStats(); }
});
function moveTip(e) {
  const el = e.target.closest('[data-tip]');
  if (!el) { tip.classList.remove('show'); return; }
  tip.textContent = el.dataset.tip;
  const x = Math.min(window.innerWidth - 90, Math.max(90, e.clientX));
  tip.style.left = x + 'px';
  tip.style.top = e.clientY + 'px';
  tip.classList.add('show');
}
elStats.addEventListener('pointermove', moveTip);
elStats.addEventListener('pointerdown', moveTip);
elStats.addEventListener('pointerleave', () => tip.classList.remove('show'));

// ---------- Вкладка «Зал славы»: рекорды упражнений ----------
const elFame = document.getElementById('tab-fame');

function renderFame() {
  const counts = state.habits.filter(isCount);
  if (!counts.length) {
    elFame.innerHTML = `<h2>🏅 Зал славы</h2>
      <div class="empty"><svg aria-hidden="true"><use href="#puck"/></svg>
      <h3>Рекордов пока нет</h3><p class="muted">Включи у привычки «🔢 Количество» — и здесь появятся рекорды.</p></div>`;
    return;
  }
  // Сначала свежие рекорды, упражнения без результата — в конце
  const items = counts.map((h) => ({ h, rec: bestOf(h.id), n: recordsBroken(h.id) }))
    .sort((a, b) => (b.rec.k || '').localeCompare(a.rec.k || ''));
  const total = items.reduce((s, x) => s + x.n, 0);
  const withRec = items.filter((x) => x.rec.v).length;
  const tk = dkey(today());
  elFame.innerHTML = `
    <div class="fame-head">
      <div class="fh-ico" aria-hidden="true">🏅</div>
      <div>
        <h2>Зал славы</h2>
        <div class="muted">Рекордов побито: <b>${total}</b> · упражнений с рекордом: <b>${withRec} из ${items.length}</b></div>
      </div>
    </div>
    <div class="fame-grid">
      ${items.map(({ h, rec, n }) => {
        const u = unitShort(h);
        const x = rec.v ? Math.round((rec.v / h.goal) * 10) / 10 : 0;
        return `<button class="fame${rec.k === tk ? ' fresh' : ''}" style="--c:${h.color}" data-fame="${h.id}" title="Открыть прогресс «${esc(h.name)}»">
          <div class="f-top"><span aria-hidden="true">${h.emoji}</span> ${esc(h.name)}</div>
          <div class="f-val">${rec.v ? `${rec.v} <small>${u}</small>` : '—'}</div>
          <div class="f-sub">${rec.v
            ? `${rec.k === tk ? '🔥 Сегодня!' : human(rec.k)}${n ? ` · побит ${n} ${plural(n, ['раз', 'раза', 'раз'])}` : ''}`
            : 'рекорда пока нет'}</div>
          <div class="f-goal">норма ${h.goal} ${u}${x >= 1 ? ` · рекорд ×${String(x).replace('.', ',')}` : ''}</div>
        </button>`;
      }).join('')}
    </div>
    ${noteList(['Нажми на карточку, чтобы посмотреть прогресс упражнения по дням.'])}`;
}

elFame.addEventListener('click', (e) => {
  const f = e.target.closest('[data-fame]');
  if (f) {
    progressHabit = f.dataset.fame;
    showTab('stats');
    const p = document.getElementById('progress');
    if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
