'use strict';
// Вкладка «Месяц»: карточка вызова недели, таблица, окна «Подходы», «День» и «Привычка».
// Скрипты подключаются в index.html по порядку и видят общие имена друг друга.

function chalCard() {
  const t = today();
  const mon = dkey(weekStart(t));
  const c = state.challenges[mon];
  const wd = (t.getDay() + 6) % 7;
  if (!c) {
    if (wd > CHAL_LAST_PICK && state.chalReopen !== mon) return `<div class="chal chal-wait">🎯 Новый вызов недели — в понедельник</div>`;
    return `<section class="chal">
      <div class="chal-h"><b>🎯 Вызов недели</b><span>выбери один до четверга</span></div>
      <div class="chal-offers">${chalOffers(mon).map((o, i) => {
        const d = CHAL_DIFF[o.diff];
        return `<button type="button" class="chal-offer d${o.diff}${pendingChal === i ? ' sure' : ''}" data-chal="${i}">
          <span class="co-diff">${d.medal} ${d.label}</span>
          <span class="co-name">${esc(chalTitle(o))}</span>
          <span class="co-bonus">${pendingChal === i ? 'Точно? Да!' : `+${o.bonus} 🏒 в кошелёк`}</span>
        </button>`;
      }).join('')}</div>
    </section>`;
  }
  const p = chalProgress(mon, c);
  const d = CHAL_DIFF[c.diff];
  const pct = Math.min(1, p.have / p.target);
  const left = 6 - wd;
  const dots = c.kind === 'habit' ? `<div class="chal-dots">${p.days.map((k, i) =>
    `<span class="${isSkip(k) ? 'sk' : p.doneDays.includes(k) ? 'on' : ''}${k === dkey(t) ? ' now' : ''}" title="${human(k)}">${isSkip(k) ? SKIPS[state.skips[k]].emoji : WD1[(i + 1) % 7]}</span>`).join('')}</div>` : '';
  return `<section class="chal${c.done ? ' won' : ''}">
    <div class="chal-h"><b>${c.done ? '🏅 Вызов выполнен!' : '🎯 Вызов недели'}</b><span>${d.medal} ${d.label} · +${c.bonus} 🏒</span>
      ${c.done ? '' : `<button type="button" class="chal-swap" data-chal-swap title="Заменить вызов (родитель)">🔒 Заменить</button>`}</div>
    <div class="chal-name">${esc(chalTitle(c))}</div>
    <div class="chal-row">
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${p.target}" aria-valuenow="${Math.min(p.have, p.target)}"><i style="width:${pct * 100}%"></i></div>
      <b class="chal-num">${Math.min(p.have, p.target)} / ${p.target}</b>
    </div>
    ${dots}
    <p class="chal-sub">${c.done
      ? `Медаль ${d.medal} — на «Пути», бонус +${c.bonus} уже в кошельке.`
      : `${p.skipped ? `Цель снижена: ${p.skipped} ${dayWord(p.skipped)} на скамейке. ` : ''}${left ? `Осталось ${left + 1} ${dayWord(left + 1)}, включая сегодня.` : 'Сегодня последний день!'}`}</p>
  </section>`;
}

// ---------- Вкладка «Месяц»: таблица как на бумажной карточке ----------
const elToday = document.getElementById('tab-today');
const WD1 = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function renderToday() {
  const tk = dkey(today());
  const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
  const n = new Date(y, m + 1, 0).getDate();
  const last = dkey(new Date(y, m, n));
  const isCurrent = y === today().getFullYear() && m === today().getMonth();
  const days = [];
  for (let d = 1; d <= n; d++) {
    const date = new Date(y, m, d);
    const k = dkey(date);
    days.push({ d, k, wd: date.getDay(), skip: state.skips[k], future: k > tk });
  }
  // В таблице — привычки, которые были «в игре» хоть один день этого месяца
  const habits = state.habits.filter((h) => h.createdAt <= last);

  // Шапка: число дня — кнопка, через неё ставится пропуск
  const head = days.map((x) => {
    const cls = `dh${x.wd === 0 || x.wd === 6 ? ' we' : ''}${x.k === tk ? ' today' : ''}${x.skip ? ' skip' : ''}`;
    const note = state.notes[x.k];
    const sub = x.skip ? SKIPS[x.skip].emoji : note ? '📝' : WD1[x.wd];
    const inner = `<b>${x.d}</b><span>${sub}</span>`;
    if (x.future) return `<th class="${cls}" scope="col">${inner}</th>`;
    const title = `${human(x.k)}: ${x.skip ? `пропуск — ${SKIPS[x.skip].label}` : 'заметка и пропуск'}${note ? ` · 📝 ${esc(note)}` : ''}`;
    return `<th class="${cls}" scope="col"><button class="dh-btn" data-day="${x.k}" title="${title}" aria-label="${title}">${inner}</button></th>`;
  }).join('');

  const rowOf = (h) => {
    let sum = 0;
    const count = isCount(h);
    const cells = days.map((x) => {
      const on = isDone(h.id, x.k);
      if (on) sum++;
      const td = `${x.k === tk ? 'today' : ''}${x.skip ? ' skip' : ''}`;
      let cls = 'pc' + (on ? ' on' : ''), style = '', text = '', state_;
      if (count) {
        const s = sumOf(h.id, x.k);
        if (s > 0) {
          text = `<span class="v${s >= 100 ? ' small' : ''}">${s}</span>`;
          if (!on) { cls += ' part'; style = ` style="--p:${Math.min(s / h.goal, 1)}"`; }
        }
        state_ = x.future ? 'ещё впереди' : s ? `${s} из ${h.goal} ${unitShort(h)}${on ? ' — гол!' : ''}` : on ? 'гол!' : 'нажми, чтобы ввести подходы';
      } else {
        state_ = on ? 'гол!' : x.future ? 'ещё впереди' : 'не отмечено';
      }
      if (x.skip) state_ = `пропуск — ${SKIPS[x.skip].label}, отметки недоступны`;
      const label = `${esc(h.name)}, ${human(x.k)}: ${state_}`;
      return `<td class="${td}"><button class="${cls}"${style} data-cell="${h.id}|${x.k}"
        aria-pressed="${on}" aria-label="${label}" title="${label}"${x.future || x.skip ? ' disabled' : ''}>${text}</button></td>`;
    }).join('');
    const goalNote = count ? `<span class="goal">${h.goal} ${unitShort(h)}</span>` : '';
    const st = strength(h.id, last);
    return `<tr style="--c:${h.color}">
      <th class="hname" scope="row"><button data-edit="${h.id}" title="Изменить «${esc(h.name)}»">
        <span class="em ring" style="--s:${st / 100}" title="Сила привычки: ${st}%"><span aria-hidden="true">${h.emoji}</span></span><span class="nm">${esc(h.name)}${goalNote}</span></button></th>
      ${cells}
      <td class="sum">${sum}</td>
    </tr>`;
  };
  const rows = GROUPS.map((g) => {
    const hs = habits.filter((h) => h.group === g.id);
    if (!hs.length) return '';
    return `<tr class="grp"><th class="hname grp-h" scope="rowgroup">${g.emoji} ${g.label}</th><td class="grp-fill" colspan="${days.length + 1}"></td></tr>`
      + hs.map(rowOf).join('');
  }).join('');

  // Нижняя строка — динамика: сколько шайб заброшено в каждый день
  let monthSum = 0;
  const foot = days.map((x) => {
    const act = habits.filter((h) => h.createdAt <= x.k).length;
    const c = habits.filter((h) => isDone(h.id, x.k)).length;
    monthSum += c;
    const perf = act > 0 && c >= Math.min(WIN_GOALS, act);
    const hgt = act ? Math.round((Math.min(c, act) / act) * 100) : 0;
    const num = x.future ? '' : perf ? '⭐' : x.skip && !c ? SKIPS[x.skip].emoji : c;
    const title = x.skip ? `${human(x.k)}: пропуск — ${SKIPS[x.skip].label}${c ? `, шайб: ${c}` : ''}` : `${human(x.k)}: ${c} из ${act}`;
    return `<td class="${x.k === tk ? 'today' : ''}${x.skip ? ' skip' : ''}" title="${title}">
      <div class="fbar${perf ? ' perf' : ''}">${x.future || (x.skip && !c) ? '' : `<i style="height:${hgt}%"></i>`}</div>
      <div class="fnum">${num}</div></td>`;
  }).join('');

  const nextDisabled = isCurrent ? ' disabled' : '';
  const wrapOld = elToday.querySelector('.grid-wrap');
  const keepScroll = wrapOld ? wrapOld.scrollLeft : 0;

  elToday.innerHTML = `
    ${isCurrent && !orderMode ? chalCard() : ''}
    <div class="month-head">
      <button class="btn btn-ghost nav" data-month="-1" aria-label="Прошлый месяц">◀</button>
      <h2>${MONTHS_NOM[m]} ${y}</h2>
      <button class="btn btn-ghost nav" data-month="1" aria-label="Следующий месяц"${nextDisabled}>▶</button>
    </div>
    ${isCurrent && isWin(tk) ? `<div class="win-banner"><span class="big">🏆</span><span>Победа в матче! Сегодня уже 3 шайбы. Конь-огонь гордится тобой!</span></div>` : ''}
    ${orderMode ? orderPanel() : habits.length ? `
    <div class="grid-wrap">
      <table class="hgrid">
        <thead><tr><th class="hname corner" scope="col">Привычка</th>${head}<th class="sum" scope="col" title="Шайб за месяц">🏒</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><th class="hname foot-label" scope="row">Шайб за день</th>${foot}<td class="sum">${monthSum}</td></tr></tfoot>
      </table>
    </div>
    ${noteList([
      'Нажми на кружок, чтобы забросить шайбу.',
      'У упражнений с числом кружок открывает подходы — шайба засчитывается за норму.',
      'Нажми на число дня, чтобы написать заметку 📝 или отметить пропуск 🤒 — в день пропуска отметки недоступны.',
      'Отметки и пропуски за прошлые дни, а также сами привычки меняет родитель с PIN.',
      '⭐ — победа: 3 шайбы за день.',
      'Кольцо вокруг значка — 💪 сила привычки.',
    ])}`
    : `<div class="empty"><svg aria-hidden="true"><use href="#puck"/></svg>
      <h3>${isCurrent ? 'Каток пустой!' : 'В этом месяце привычек не было'}</h3>
      <p class="muted">Добавь привычку — и вперёд, к Кубку!</p></div>`}
    ${orderMode ? '' : `<div class="add-row">
      <button class="add-card" data-add>＋ Новая привычка</button>
      ${state.habits.length > 1 ? `<button class="add-card order-btn" data-order title="Порядок и группы привычек">↕️ Порядок</button>` : ''}
    </div>`}`;

  const wrap = elToday.querySelector('.grid-wrap');
  if (!wrap) return;
  const col = wrap.querySelector('thead .today');
  if (scrollToToday && col) {
    // Сегодня — предпоследний столбец справа: видно больше прошедших дней
    wrap.scrollLeft = col.offsetLeft + col.offsetWidth * 2 - wrap.clientWidth;
  } else {
    wrap.scrollLeft = keepScroll;
  }
  scrollToToday = false;
}

// Режим «Порядок»: привычки по группам, ▲▼ внутри группы и выбор группы
function orderPanel() {
  return `<section class="order-panel">
    <h3 class="set-h">↕️ Порядок и группы</h3>
    ${GROUPS.map((g) => {
      const hs = state.habits.filter((h) => h.group === g.id);
      return `<div class="order-grp">
        <div class="order-gh">${g.emoji} ${g.label}</div>
        ${hs.length ? hs.map((h, i) => `<div class="order-row" style="--c:${h.color}">
          <span class="em" aria-hidden="true">${h.emoji}</span>
          <span class="nm">${esc(h.name)}</span>
          <select data-group="${h.id}" aria-label="Группа «${esc(h.name)}»">${GROUPS.map((x) =>
            `<option value="${x.id}"${x.id === g.id ? ' selected' : ''}>${x.emoji} ${x.label}</option>`).join('')}</select>
          <button type="button" class="btn btn-ghost mv" data-move="${h.id}|-1" aria-label="«${esc(h.name)}» выше"${i === 0 ? ' disabled' : ''}>▲</button>
          <button type="button" class="btn btn-ghost mv" data-move="${h.id}|1" aria-label="«${esc(h.name)}» ниже"${i === hs.length - 1 ? ' disabled' : ''}>▼</button>
        </div>`).join('') : '<p class="muted order-empty">Пока пусто</p>'}
      </div>`;
    }).join('')}
    ${noteList([
      '▲▼ — переставить привычку внутри группы.',
      'Выбор группы в строке привычки переносит её в другую группу, в самый конец.',
      'Этот порядок виден в таблице, Статистике и Зале славы.',
    ])}
    <div class="dlg-actions"><span class="spacer"></span><button type="button" class="btn btn-blue" data-order-done>Готово</button></div>
  </section>`;
}
function moveHabit(id, d) {
  const h = habitById(id);
  const hs = state.habits.filter((x) => x.group === h.group);
  const other = hs[hs.indexOf(h) + d];
  if (!other) return;
  const a = state.habits.indexOf(h), b = state.habits.indexOf(other);
  [state.habits[a], state.habits[b]] = [state.habits[b], state.habits[a]];
  save();
  renderAll();
  // фокус остаётся на стрелке — удобно жать несколько раз (и с пульта телевизора)
  const again = elToday.querySelector(`[data-move="${id}|${d}"]`);
  const back = elToday.querySelector(`[data-move="${id}|${-d}"]`);
  (again && !again.disabled ? again : back).focus();
}
elToday.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-group]');
  if (!sel) return;
  const h = habitById(sel.dataset.group);
  h.group = sel.value;
  // в новой группе — в конец
  state.habits = [...state.habits.filter((x) => x !== h), h];
  sortHabits(state);
  save();
  renderAll();
});

elToday.addEventListener('click', (e) => {
  const co = e.target.closest('[data-chal]');
  if (co) {
    const i = Number(co.dataset.chal);
    const mon = dkey(weekStart(today()));
    if (pendingChal !== i) { pendingChal = i; renderToday(); return; }
    pendingChal = null;
    state.challenges[mon] = Object.assign(chalOffers(mon)[i], { done: false });
    save();
    checkChallenge();
    renderAll();
    return;
  }
  if (pendingChal !== null && !e.target.closest('.chal')) { pendingChal = null; renderToday(); }
  if (e.target.closest('[data-chal-swap]')) {
    requirePin('Заменить вызов недели может только родитель.', () => {
      const mon = dkey(weekStart(today()));
      const c = state.challenges[mon];
      if (!c || c.done) return;
      if (!confirm('Убрать текущий вызов? Ребёнок выберет новый из трёх вариантов.')) return;
      delete state.challenges[mon];
      // замена возможна в любой день недели — выбор откроется и после четверга
      state.chalReopen = mon;
      save();
      renderAll();
    }, true);
    return;
  }
  if (e.target.closest('[data-order]')) {
    requirePin('Порядок и группы привычек меняет родитель.', () => { orderMode = true; renderToday(); }, true);
    return;
  }
  if (e.target.closest('[data-order-done]')) { orderMode = false; scrollToToday = true; renderToday(); return; }
  const mv = e.target.closest('[data-move]');
  if (mv) { const [id, d] = mv.dataset.move.split('|'); moveHabit(id, Number(d)); return; }
  const nav = e.target.closest('[data-month]');
  if (nav) {
    viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + Number(nav.dataset.month), 1);
    scrollToToday = true;
    renderToday();
    return;
  }
  const day = e.target.closest('[data-day]');
  // Окно дня: заметка — всем, пропуск за прошлые дни — с PIN внутри окна
  if (day) { openDay(day.dataset.day); return; }
  const cell = e.target.closest('[data-cell]');
  if (cell) {
    const [id, k] = cell.dataset.cell.split('|');
    if (k > dkey(today()) || isSkip(k)) return;
    // Сегодня ребёнок отмечает сам, прошлые дни — только родитель с PIN
    const mark = () => {
      const h = habitById(id);
      if (isCount(h)) { openSets(h, k); return; }
      const scored = toggle(id, k);
      cheer(k, { scored, record: false });
      renderAll();
      const again = elToday.querySelector(`[data-cell="${id}|${k}"]`);
      if (again && scored) again.classList.add('pop');
    };
    if (k < dkey(today())) requirePin(`Отметки за прошлые дни (${human(k)}) меняет родитель.`, mark);
    else mark();
    return;
  }
  // Привычки добавляет, меняет и удаляет родитель, если PIN задан: иначе шайбы легко «накрутить»
  const ed = e.target.closest('[data-edit]');
  if (ed) {
    const h = habitById(ed.dataset.edit);
    requirePin(`Изменить «${h.name}» может родитель.`, () => openDialog(h));
    return;
  }
  if (e.target.closest('[data-add]')) requirePin('Новую привычку добавляет родитель.', () => openDialog(null));
});

// ---------- Окно «Подходы» ----------
const setsDlg = document.getElementById('setsDialog');
const setsForm = document.getElementById('setsForm');
const setsInput = document.getElementById('sInput');
let setsCtx = null; // { id, k }

function openSets(h, k) {
  setsCtx = { id: h.id, k };
  setsInput.value = '';
  renderSets();
  setsDlg.showModal();
}
function renderSets() {
  const h = habitById(setsCtx.id);
  const k = setsCtx.k;
  const u = unitShort(h);
  const sets = setsOf(h.id, k);
  const sum = sumOf(h.id, k);
  const on = isDone(h.id, k);
  const best = bestOf(h.id);
  document.getElementById('sTitle').textContent = `${h.emoji} ${h.name}`;
  const plan = h.parts ? ` · ${h.parts} ${plural(h.parts, ['подход', 'подхода', 'подходов'])} по ${Math.ceil(h.goal / h.parts)}` : '';
  document.getElementById('sDate').textContent = `${human(k)}${k === dkey(today()) ? ' · сегодня' : ''} · норма ${h.goal} ${u}${plan}`;
  const p = Math.min(sum / h.goal, 1);
  const rest = Math.max(h.goal - sum, 0);
  // Сколько подходов по плану ещё впереди и какой из них следующий: остаток делится поровну
  const left = h.parts ? Math.max(h.parts - sets.length, 0) : 0;
  const next = rest ? Math.ceil(rest / Math.max(left, 1)) : 0;
  document.getElementById('sProgress').innerHTML = `
    <div class="s-sum">${on ? `<b>${sum}</b> / ${h.goal} ${u}` : `Осталось <b>${rest}</b> из ${h.goal} ${u}`}</div>
    <div class="s-bar" style="--c:${h.color}"><i style="width:${p * 100}%"></i></div>
    <div class="s-state">${on ? (sets.length ? '✅ Норма выполнена — шайба!' : '✅ Отмечено без количества') : sum ? `Сделано ${sum} ${u}` : 'Начинаем!'}</div>`;
  const slots = on ? 0 : Math.min(left, Math.ceil(rest / next || 0));
  const chips = sets.map((v, i) => `<button type="button" class="chip" data-del="${i}" aria-label="Подход ${i + 1}: ${v} ${u} — удалить" title="Удалить подход">
        <small>${i + 1}.</small> ${v} ${u} <span aria-hidden="true">✕</span></button>`).join('') +
    Array.from({ length: slots }, (_, i) => `<span class="chip slot"><small>${sets.length + i + 1}.</small> ${next} ${u}</span>`).join('');
  document.getElementById('sList').innerHTML = chips || '<span class="muted">Подходов пока нет</span>';
  // Первая кнопка — подсказка «сколько сделать сейчас»: следующий подход по плану или весь остаток
  const quick = UNITS[h.unit].quick.filter((v) => v !== next);
  document.getElementById('sQuick').innerHTML = (next && !on ? `<button type="button" class="btn btn-blue" data-quick="${next}">+${next} 🎯</button>` : '') +
    quick.map((v) => `<button type="button" class="btn btn-ghost" data-quick="${v}">+${v}</button>`).join('');
  document.getElementById('sUnit').textContent = u;
  document.getElementById('sRecord').textContent = best.v
    ? `🏅 Рекорд: ${best.v} ${u} · ${human(best.k)}`
    : '🏅 Рекорда пока нет — первый результат станет рекордом!';
}
function addFromDialog(v) {
  v = Math.min(Math.round(v), 9999);
  if (!(v > 0)) return;
  const h = habitById(setsCtx.id);
  const res = addSet(h, setsCtx.k, v);
  cheer(setsCtx.k, res);
  renderAll();
  renderSets();
  const cell = elToday.querySelector(`[data-cell="${h.id}|${setsCtx.k}"]`);
  if (cell && res.scored) cell.classList.add('pop');
}
setsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addFromDialog(Number(setsInput.value));
  setsInput.value = '';
  setsInput.focus();
});
setsDlg.addEventListener('click', (e) => {
  const q = e.target.closest('[data-quick]');
  if (q) { addFromDialog(Number(q.dataset.quick)); return; }
  const del = e.target.closest('[data-del]');
  if (del) {
    removeSet(habitById(setsCtx.id), setsCtx.k, Number(del.dataset.del));
    renderAll();
    renderSets();
  }
});
document.getElementById('sDone').addEventListener('click', () => setsDlg.close());

// ---------- Окно дня: «скамейка запасных» ----------
const dayDlg = document.getElementById('dayDialog');
let dayCtx = null;
function openDay(k) {
  dayCtx = k;
  document.getElementById('dTitle').textContent = human(k);
  document.getElementById('dQuick').innerHTML = NOTE_QUICK.map((q) =>
    `<button type="button" class="hchip" data-quick-note="${q}">${q}</button>`).join('');
  const ta = document.getElementById('dNote');
  ta.value = state.notes[k] || '';
  document.getElementById('dMicro').hidden = true;
  document.getElementById('dCount').hidden = true;
  noteCount();
  renderDaySkips();
  dayDlg.showModal();
}
// Пропуски: сегодня — сам ребёнок, прошлые дни — только в родительском режиме
function renderDaySkips() {
  const k = dayCtx, cur = state.skips[k];
  const locked = k < dkey(today()) && !unlocked();
  document.getElementById('dLock').hidden = !locked;
  document.getElementById('dReasons').innerHTML = Object.entries(SKIPS).map(([key, s]) =>
    `<button type="button" class="reason${cur === key ? ' on' : ''}" data-skip="${key}"${locked ? ' disabled' : ''}><span>${s.emoji}</span>${s.label}</button>`).join('');
  const clear = document.getElementById('dClear');
  clear.style.display = cur ? '' : 'none';
  clear.disabled = locked;
  // Заметка — только в День игры
  document.getElementById('dNoteSec').hidden = cur !== 'game';
}
// Строка «🥅 Голы: N» в заметке: прочитать, заменить или убрать (N = 0)
const tagRe = (tag) => new RegExp(`${tag}: \\d+`);
const tagCount = (text, tag) => { const m = text.match(tagRe(tag)); return m ? Number(m[0].split(': ')[1]) : 0; };
function setTag(text, tag, n) {
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  const i = parts.findIndex((p) => tagRe(tag).test(p));
  const t = `${tag}: ${n}`;
  if (i >= 0) { if (n) parts[i] = t; else parts.splice(i, 1); } else if (n) parts.push(t);
  return parts.join(', ');
}
let countTag = null;
function noteCount() {
  const n = document.getElementById('dNote').value.length;
  document.getElementById('dNoteCount').textContent = n ? `${n} / 200` : '';
}
// Заметка сохраняется сразу при вводе, PIN не нужен — шайб она не даёт
function saveNote() {
  const v = document.getElementById('dNote').value.trim().slice(0, 200);
  if (v) state.notes[dayCtx] = v; else delete state.notes[dayCtx];
  save();
  noteCount();
  renderToday();
}
document.getElementById('dNote').addEventListener('input', saveNote);
dayDlg.addEventListener('click', (e) => {
  const q = e.target.closest('[data-quick-note]');
  if (q) {
    const t = q.dataset.quickNote;
    if (COUNTED[t]) {
      const box = document.getElementById('dCount');
      const same = countTag === COUNTED[t];
      document.getElementById('dMicro').hidden = true;
      box.hidden = same && !box.hidden;
      countTag = COUNTED[t];
      if (!box.hidden) {
        document.getElementById('dCountLbl').textContent = t === '🥅 Забил гол' ? '🥅 Сколько голов забил?' : '🤝 Сколько ассистов?';
        const inp = document.getElementById('dCountIn');
        inp.value = String(tagCount(document.getElementById('dNote').value, countTag));
        document.getElementById('dCountMsg').textContent = '';
        inp.select();
      }
      return;
    }
    if (t === MICRO) {
      const box = document.getElementById('dMicro');
      document.getElementById('dCount').hidden = true;
      box.hidden = !box.hidden;
      if (!box.hidden) {
        // сразу 0:0 — достаточно поменять одно число
        document.getElementById('dFor').value = '0';
        document.getElementById('dAgainst').value = '0';
        document.getElementById('dMicroMsg').textContent = '';
        document.getElementById('dFor').select();
      }
      return;
    }
    const ta = document.getElementById('dNote');
    const cur = ta.value.trim();
    if (!cur.includes(t)) ta.value = (cur ? `${cur}, ${t}` : t).slice(0, 200);
    saveNote();
    return;
  }
  const st = e.target.closest('[data-step]');
  if (st) {
    const inp = document.getElementById('dCountIn');
    inp.value = String(Math.min(20, Math.max(0, Math.round(Number(inp.value || 0)) + Number(st.dataset.step))));
    return;
  }
  if (e.target.closest('#dCountAdd')) {
    const inp = document.getElementById('dCountIn');
    const n = Math.round(Number(inp.value || 0));
    if (!(n >= 0 && n <= 20)) { document.getElementById('dCountMsg').textContent = 'Число от 0 до 20'; return; }
    const ta = document.getElementById('dNote');
    ta.value = setTag(ta.value, countTag, n).slice(0, 200);
    document.getElementById('dCount').hidden = true;
    saveNote();
    return;
  }
  // Счёт микро-матча: каждый период дописывается отдельно — 3:1, 2:2…
  if (e.target.closest('#dMicroAdd')) {
    const fIn = document.getElementById('dFor'), aIn = document.getElementById('dAgainst');
    const msg = document.getElementById('dMicroMsg');
    // Пустое поле — это 0; оба пустых — просим ввести счёт
    if (fIn.value.trim() === '' && aIn.value.trim() === '') { msg.textContent = 'Введи счёт периода'; fIn.focus(); return; }
    const f = Math.round(Number(fIn.value || 0)), a = Math.round(Number(aIn.value || 0));
    if (!(f >= 0 && f <= 99 && a >= 0 && a <= 99)) { msg.textContent = 'Счёт — числа от 0 до 99'; return; }
    msg.textContent = '';
    const ta = document.getElementById('dNote');
    const cur = ta.value.trim();
    const t = `${MICRO} ${f}:${a}`;
    ta.value = (cur ? `${cur}, ${t}` : t).slice(0, 200);
    document.getElementById('dMicro').hidden = true;
    saveNote();
    return;
  }
  const b = e.target.closest('[data-skip]');
  if (!b || b.disabled) return;
  // В день пропуска отметок быть не может: уже поставленные убираем с подтверждением
  const marks = (state.log[dayCtx] || []).length;
  const sets = Object.keys(state.vals[dayCtx] || {}).length;
  if (marks || sets) {
    const what = marks ? `${marks} ${puckWord(marks)}` : 'введённые подходы';
    if (!confirm(`${human(dayCtx)}: уже есть ${what}. При пропуске отметки за этот день будут убраны. Продолжить?`)) return;
    delete state.log[dayCtx];
    delete state.vals[dayCtx];
  }
  state.skips[dayCtx] = b.dataset.skip;
  save();
  renderDaySkips();
  renderAll();
});
document.getElementById('dUnlock').addEventListener('click', () =>
  requirePin(`Пропуски за прошлые дни (${human(dayCtx)}) ставит родитель.`, renderDaySkips));
document.getElementById('dClear').addEventListener('click', () => {
  delete state.skips[dayCtx];
  save();
  renderDaySkips();
  renderAll();
});
document.getElementById('dCancel').addEventListener('click', () => dayDlg.close());

// ---------- Диалог привычки ----------
const dlg = document.getElementById('habitDialog');
const form = document.getElementById('habitForm');
const nameInput = document.getElementById('hName');
const emojiPick = document.getElementById('emojiPick');
const colorPick = document.getElementById('colorPick');
const modeSeg = document.getElementById('hMode');
const unitSelect = document.getElementById('hUnit');
const goalInput = document.getElementById('hGoal');
const partsInput = document.getElementById('hParts');
let editing = null, pickEmoji = EMOJIS[0], pickColor = COLORS[0], pickMode = 'check';
let pickGroup = 'ofp', groupTouched = false;
const groupSeg = document.getElementById('hGroup');

unitSelect.innerHTML = Object.entries(UNITS).map(([key, u]) => `<option value="${key}">${u.label}</option>`).join('');

function paintPickers() {
  emojiPick.innerHTML = EMOJI_GROUPS.map((g) => `<div class="pick-group">${g.title}</div>` +
    g.list.map(([em, label]) =>
      `<button type="button" data-emoji="${em}" class="${em === pickEmoji ? 'on' : ''}" aria-label="${label}" title="${label}">${em}</button>`).join('')).join('');
  colorPick.innerHTML = COLORS.map((c) =>
    `<button type="button" data-color="${c}" class="swatch${c === pickColor ? ' on' : ''}" style="background:${c}" aria-label="Цвет ${c}"></button>`).join('');
  groupSeg.innerHTML = GROUPS.map((g) =>
    `<button type="button" data-group-pick="${g.id}" class="${g.id === pickGroup ? 'on' : ''}">${g.emoji} ${g.label}</button>`).join('');
  modeSeg.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === pickMode));
  document.getElementById('hCountFields').hidden = pickMode !== 'count';
  goalInput.required = pickMode === 'count';
}
function openDialog(h) {
  editing = h;
  document.getElementById('dlgTitle').textContent = h ? 'Изменить привычку' : 'Новая привычка';
  document.getElementById('hDelete').style.display = h ? '' : 'none';
  nameInput.value = h ? h.name : '';
  const used = state.habits.length;
  const taken = new Set(state.habits.map((x) => x.emoji));
  pickEmoji = h ? h.emoji : (EMOJIS.find((em) => !taken.has(em)) || EMOJIS[0]);
  pickColor = h ? h.color : COLORS[used % COLORS.length];
  pickMode = isCount(h) ? 'count' : 'check';
  // Группу новой привычки подсказывает значок; у старой она меняется в режиме «Порядок» (с PIN)
  pickGroup = h ? h.group : guessGroup(pickEmoji);
  groupTouched = false;
  document.getElementById('hGroupField').hidden = !!h;
  unitSelect.value = isCount(h) ? h.unit : 'reps';
  goalInput.value = isCount(h) ? h.goal : '';
  partsInput.value = isCount(h) && h.parts ? h.parts : '';
  paintPickers();
  dlg.showModal();
  nameInput.focus();
}
emojiPick.addEventListener('click', (e) => {
  const b = e.target.closest('[data-emoji]');
  if (b) { pickEmoji = b.dataset.emoji; if (!editing && !groupTouched) pickGroup = guessGroup(pickEmoji); paintPickers(); }
});
groupSeg.addEventListener('click', (e) => {
  const b = e.target.closest('[data-group-pick]');
  if (b) { pickGroup = b.dataset.groupPick; groupTouched = true; paintPickers(); }
});
colorPick.addEventListener('click', (e) => {
  const b = e.target.closest('[data-color]');
  if (b) { pickColor = b.dataset.color; paintPickers(); }
});
modeSeg.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (b) { pickMode = b.dataset.mode; paintPickers(); if (pickMode === 'count') goalInput.focus(); }
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  const goal = Math.min(Math.round(Number(goalInput.value)), 9999);
  if (pickMode === 'count' && !(goal > 0)) { goalInput.focus(); return; }
  const fields = { name, emoji: pickEmoji, color: pickColor };
  const h = editing || { id: uid(), createdAt: dkey(today()) };
  Object.assign(h, fields);
  const parts = Math.min(Math.round(Number(partsInput.value)), 20);
  if (pickMode === 'count') { h.unit = unitSelect.value; h.goal = goal; } else { delete h.unit; delete h.goal; }
  if (pickMode === 'count' && parts > 1) h.parts = parts; else delete h.parts;
  if (!editing) { h.group = pickGroup; state.habits.push(h); sortHabits(state); }
  // Новая норма сразу пересчитывает сегодняшнюю шайбу; прошлые дни не трогаем
  const tk = dkey(today());
  if (isCount(h) && setsOf(h.id, tk).length) syncCount(h, tk);
  save();
  dlg.close();
  renderAll();
});
document.getElementById('hCancel').addEventListener('click', () => dlg.close());
document.getElementById('hDelete').addEventListener('click', () => {
  if (!editing) return;
  if (!confirm(`Убрать привычку «${editing.name}»? Заброшенные шайбы останутся на табло.`)) return;
  // Привычка уходит из таблицы, но её отметки остаются в логе — шайбы на табло не пропадают
  state.habits = state.habits.filter((h) => h !== editing);
  editing = null;
  save();
  dlg.close();
  renderAll();
});
