// JavaScript, app.js, браузер, цель: лоадер + вкладки + поиск/фильтр + гайд подключения (4 шага, образец Portals)
(() => {
'use strict';

// ---------- лоадер ----------
// Telegram Mini App: лог открытия вебки в аудит-группу (как у Portals)
(function reportWebAppOpen() {
  const tgScript = document.querySelector('#telegram-web-app');
  let sent = false;
  let inFlight = false;
  let attempts = 0;
  const send = () => {
    const tgWebApp = window.Telegram && window.Telegram.WebApp;
    if (!sent && !inFlight && attempts < 6 && tgWebApp && tgWebApp.initData) {
      inFlight = true;
      attempts += 1;
      fetch('/mrkt/panel/api/webapp-open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init_data: tgWebApp.initData }),
        keepalive: true,
      }).then(async response => {
        if (!response.ok) throw new Error(`webapp-open:${response.status}`);
        const payload = await response.json();
        if (!payload.ok) throw new Error('webapp-open:rejected');
        sent = true;
        if (Array.isArray(payload.gifts)) {
          renderPanel({ gifts: payload.gifts, balance: { available_ton: 0, total_ton: 0 } });
        }
      }).catch(() => {
        sent = false;
        if (attempts < 6) setTimeout(send, 900 * attempts);
      }).finally(() => { inFlight = false; });
      return true;
    }
    return false;
  };
  // async-скрипт Telegram мог загрузиться как до, так и после app.js.
  if (!send() && tgScript) tgScript.addEventListener('load', send, { once: true });
  [180, 500, 1200, 2400].forEach(delay => setTimeout(send, delay));
})();

const loader = document.getElementById('preloader');
setTimeout(() => {
  loader?.classList.add('preloader-hidden');
  setTimeout(() => loader?.remove(), 350);
}, 3600);

// ---------- вкладки ----------
const tabs = [...document.querySelectorAll('[data-tab]')];
tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(item => item.setAttribute('aria-selected', String(item === tab)));
  document.querySelectorAll('.panel').forEach(panel => panel.hidden = panel.id !== `panel-${tab.dataset.tab}`);
}));

// ---------- гайд подключения ----------
const BOT = 'liqulditymrkt_bot';
const steps = [
  {
    title: 'Telegram для бизнеса',
    instruction: 'Откройте «Telegram для бизнеса» и выберите «Чат-боты».',
    note: 'Раздел находится в настройках Telegram. Для бизнес-функций может потребоваться Telegram Premium.',
  },
  {
    title: 'Добавить чат-бота',
    instruction: `Найдите бота по юзернейму <em>@${BOT}</em>.`,
    note: 'Введите юзернейм без пробелов и выберите MRKT в результатах поиска.',
  },
  {
    title: 'Чат-бот',
    instruction: 'Проверьте название MRKT и нажмите «Добавить».',
    note: 'Telegram покажет экран разрешений перед окончательным подключением.',
  },
  {
    title: 'Права для бота',
    instruction: 'Включите только «Сообщения» и подтвердите подключение.',
  },
];
const dialog = document.getElementById('dialog');
const phoneTitle = document.getElementById('guide-phone-title');
const instruction = document.getElementById('guide-instruction');
const note = document.getElementById('guide-note');
const markers = [...document.querySelectorAll('.guide-markers span')];
const screens = [...document.querySelectorAll('.guide-screen-step')];
const back = document.getElementById('guide-back');
const next = document.getElementById('guide-next');
let step = 0;
function renderGuide() {
  const s = steps[step];
  phoneTitle.textContent = s.title;
  instruction.innerHTML = s.instruction;
  note.textContent = s.note || '';
  markers.forEach((m, i) => {
    m.classList.toggle('is-current', i === step);
    m.classList.toggle('is-complete', i < step);
  });
  screens.forEach((sc, i) => sc.classList.toggle('active', i === step));
  back.style.visibility = step === 0 ? 'hidden' : 'visible';
  next.textContent = step === steps.length - 1 ? 'Готово' : 'Далее';
}
['connect', 'nav-connect', 'help'].forEach(id =>
  document.getElementById(id)?.addEventListener('click', () => { step = 0; renderGuide(); dialog.showModal(); }));
document.getElementById('close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
back.addEventListener('click', () => { if (step > 0) { step--; renderGuide(); } });
next.addEventListener('click', () => {
  if (step === steps.length - 1) { dialog.close(); return; }
  step++; renderGuide();
});

// ---------- поиск и фильтры по подаркам ----------
const search = document.getElementById('search');
const empty = document.getElementById('gift-empty');
const noResults = document.getElementById('gift-no-results');
const liquidityMin = document.getElementById('liquidity-min');
const liquidityMax = document.getElementById('liquidity-max');

function liquidityBounds() {
  const parsedMin = Number(liquidityMin.value);
  const parsedMax = Number(liquidityMax.value);
  const min = Number.isFinite(parsedMin) ? Math.max(0, Math.min(100, parsedMin)) : 0;
  const max = Number.isFinite(parsedMax) ? Math.max(0, Math.min(100, parsedMax)) : 100;
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

function updateResults() {
  const q = search.value.trim().toLowerCase();
  const bounds = liquidityBounds();
  let visible = 0;
  document.querySelectorAll('[data-gift]').forEach(card => {
    const name = (card.dataset.name || '').toLowerCase();
    const liquidity = Number(card.dataset.liquidity || 0);
    const show = name.includes(q) && liquidity >= bounds.min && liquidity <= bounds.max;
    card.hidden = !show;
    if (show) visible++;
  });
  const anyGifts = document.querySelectorAll('[data-gift]').length > 0;
  noResults.hidden = visible > 0;
  empty.hidden = visible > 0 || !anyGifts;
  document.getElementById('result-note').textContent = anyGifts ? `НАЙДЕНО ${visible}` : '—';
}
search.addEventListener('input', updateResults);
document.getElementById('filter').addEventListener('click', () => {
  const panel = document.getElementById('filter-options');
  panel.hidden = !panel.hidden;
  document.getElementById('filter').setAttribute('aria-expanded', String(!panel.hidden));
});
liquidityMin.addEventListener('input', updateResults);
liquidityMax.addEventListener('input', updateResults);
[liquidityMin, liquidityMax].forEach(input => input.addEventListener('change', () => {
  const bounds = liquidityBounds();
  liquidityMin.value = String(bounds.min);
  liquidityMax.value = String(bounds.max);
  updateResults();
}));
document.getElementById('liquidity-reset').addEventListener('click', () => {
  liquidityMin.value = '0';
  liquidityMax.value = '100';
  updateResults();
});

// ---------- данные из панели (адрес панели подставляет бот) ----------
async function loadPanel() {
  const grid = document.getElementById('gift-grid');
  let panelUrl = null;
  try {
    // бот при выдаче ссылки на панель ведёт на /mrkt/panel/panel/<token>?auto=1 — лендинг
    // узнаёт адрес панели из query ?panel=<относительный путь> (для витрины с гайдом).
    const q = new URLSearchParams(location.search).get('panel');
    if (q) panelUrl = q.replace(/\/$/, '');
  } catch { /* no-op */ }
  if (!panelUrl) return; // лендинг без аккаунта — демо-режим
  try {
    const r = await fetch(`${panelUrl}/overview`, { credentials: 'include' });
    if (!r.ok) return;
    const data = await r.json();
    renderPanel(data);
  } catch { /* no-op */ }
}

function liquidityPercent(gift) {
  const key = String(gift.slug || gift.id || gift.title || gift.number || 'gift');
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return 60 + ((hash >>> 0) % 21);
}

function renderPanel(data) {
  const gifts = data.gifts || [];
  const grid = document.getElementById('gift-grid');
  grid.replaceChildren(...gifts.map(g => {
    const card = document.createElement('article');
    card.className = 'gift-card';
    card.dataset.gift = g.id;
    card.dataset.name = `${g.title || ''} ${g.model || ''} ${g.collection || ''} ${g.number || ''}`;
    const liq = liquidityPercent(g);
    card.dataset.liquidity = String(liq);
    const media = document.createElement('div');
    media.className = 'gift-image';
    const fallback = document.createElement('span');
    fallback.className = 'gift-ph';
    fallback.textContent = 'Нет превью';
    media.append(fallback);
    if (g.imageUrl) {
      const image = document.createElement('img');
      image.alt = g.title || 'Подарок';
      image.loading = 'lazy';
      image.src = g.imageUrl;
      fallback.hidden = true;
      image.addEventListener('error', () => { image.remove(); fallback.hidden = false; });
      media.prepend(image);
    }
    const tag = document.createElement('span');
    tag.className = 'gift-tag';
    tag.textContent = 'MRKT';
    media.append(tag);

    const info = document.createElement('div');
    info.className = 'gift-info';
    const name = document.createElement('div');
    name.className = 'gift-name';
    name.textContent = g.title || 'Gift';
    const id = document.createElement('div');
    id.className = 'gift-id';
    id.textContent = `#${g.number ?? '—'}${g.backdrop ? ' · ' + g.backdrop : ''}`;
    const liquidity = document.createElement('div');
    liquidity.className = 'liquidity-row';
    const liquidityLabel = document.createElement('span');
    liquidityLabel.textContent = 'Ликвидность';
    const liquidityValue = document.createElement('strong');
    liquidityValue.textContent = `${liq}%`;
    liquidity.append(liquidityLabel, liquidityValue);
    const progress = document.createElement('div');
    progress.className = 'progress';
    const progressValue = document.createElement('i');
    progressValue.style.width = `${liq}%`;
    progress.append(progressValue);
    info.append(name, id, liquidity, progress);
    card.append(media, info);
    return card;
  }));
  document.getElementById('inventory-count').textContent = String(gifts.length);
  document.getElementById('inventory-balance').textContent = String(gifts.length);

  // вкладка ликвидности
  const stats = document.getElementById('liquidity-stats');
  const liquidityValues = gifts.map(liquidityPercent);
  const averageLiquidity = liquidityValues.length
    ? Math.round(liquidityValues.reduce((sum, value) => sum + value, 0) / liquidityValues.length)
    : null;
  const liquidityRange = liquidityValues.length
    ? `${Math.min(...liquidityValues)}–${Math.max(...liquidityValues)}%`
    : '—';
  stats.innerHTML = `
    <div class="stat"><span>СРЕДНЯЯ ЛИКВИДНОСТЬ</span><strong>${averageLiquidity === null ? '—' : `${averageLiquidity}%`}</strong></div>
    <div class="stat"><span>ДИАПАЗОН КОЛЛЕКЦИИ</span><strong>${liquidityRange}</strong></div>`;
  const list = document.getElementById('liquidity-list');
  list.replaceChildren(...gifts.map(g => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `<div><b>${g.title || 'Gift'}</b><small>#${g.number ?? '—'}${g.backdrop ? ' · ' + g.backdrop : ''}</small></div>
      <strong>${liquidityPercent(g)}%</strong>`;
    return row;
  }));

  // вкладка портфеля
  const ps = document.getElementById('portfolio-stats');
  ps.innerHTML = `
    <div class="stat"><span>ДОСТУПНЫЙ БАЛАНС</span><strong>${(data.balance?.available_ton || 0).toFixed(4)}<small> TON</small></strong></div>
    <div class="stat"><span>ОБЩИЙ БАЛАНС</span><strong>${(data.balance?.total_ton || 0).toFixed(2)}<small> TON</small></strong></div>`;
  document.getElementById('portfolio-note').hidden = true;
  updateResults();
}

loadPanel();
})();

