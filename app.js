// 公開サイト（novel.mjs publish で書き出す静的な書架）。読むための機能だけを持つ。
// 本文は書き出し時に { title, lines } にしてあるので、ここでは表示するだけ。
import { escapeHtml as esc, chapterBodyHtml, inlineToHtml } from './render.js';
import { readingBadges, adultNotice, tagFilterHtml, bindTagFilter, requireAdultConfirmation } from './reading.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const pad = (n) => String(n).padStart(3, '0');

// ---------- 保存（使えない環境では黙って無視） ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('shoka.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('shoka.' + k, JSON.stringify(v)); } catch {} },
};

const cache = new Map();
function getJSON(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(r.status === 404 ? '見つかりませんでした' : r.statusText);
      return r.json();
    }).catch((e) => { cache.delete(url); throw e; }));
  }
  return cache.get(url);
}
const site = () => getJSON('data/site.json');
async function novelOf(slug) {
  const n = (await site()).novels.find((x) => x.slug === slug);
  if (!n) throw new Error('この作品は公開されていません');
  return n;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('on'), 2400);
}

const NOVEL_STATUS = { writing: '連載中', complete: '完結' };
const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 17);
const fmtNum = (n) => (n || 0).toLocaleString('ja-JP');
const minutes = (chars) => Math.max(1, Math.round(chars / 600));
const imgUrl = (slug, file) => `img/${encodeURIComponent(slug)}/${encodeURIComponent(file)}`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('ja-JP') : '');

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------- サイトのテーマ ----------
const THEMES = ['auto', 'light', 'dark'];
function applyTheme() {
  const t = store.get('theme', 'auto');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
  $('#themeBtn').title = `テーマ：${{ auto: '自動', light: 'ライト', dark: 'ダーク' }[t]}`;
}
$('#themeBtn').onclick = () => {
  const t = store.get('theme', 'auto');
  store.set('theme', THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);
  applyTheme();
};
applyTheme();

// ---------- 栞・既読 ----------
const bookmarks = () => store.get('bm', {});
function saveBookmark(slug, no, ratio) {
  const b = bookmarks();
  b[slug] = { no, ratio, t: Date.now() };
  store.set('bm', b);
  if (ratio > 0.92) {
    const r = store.get('read', {});
    r[slug] = [...new Set([...(r[slug] || []), no])];
    store.set('read', r);
  }
}
const readSet = (slug) => new Set(store.get('read', {})[slug] || []);

// ---------- ルーティング ----------
let cleanup = null;
let pendingJump = null; // { ratio } | { top: true }
let siteTitle = '書架';

function crumbs(items) {
  $('#crumbs').innerHTML = items.map((it, i) =>
    (i ? '<span class="sep">／</span>' : '') + (it.href ? `<a href="${it.href}">${esc(it.label)}</a>` : `<span>${esc(it.label)}</span>`)).join('');
}

async function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  document.body.classList.remove('reading');
  $('#topbar').classList.remove('away');
  document.title = siteTitle;
  const h = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  const m = h.match(/^\/n\/([^/]+)(?:\/c\/(\d+))?\/?$/);
  try {
    if (!m) await viewShelf();
    else if (m[2]) await viewReader(m[1], parseInt(m[2], 10));
    else await viewNovel(m[1]);
  } catch (e) {
    app.innerHTML = `<div class="wrap empty"><h2>読み込めませんでした</h2><p>${esc(e.message)}</p><p><a class="btn" href="#/">書架へ戻る</a></p></div>`;
  }
}
window.addEventListener('hashchange', route);

// ---------- 書架 ----------
function coverHtml(n) {
  if (n.cover) {
    return `<div class="cover has-img" style="--h:${hue(n.slug)}">
      <img src="${imgUrl(n.slug, n.cover.file)}" alt="">
      ${n.cover.withTitle ? '' : `<div class="img-ttl"><b>${esc(n.title)}</b>${n.author ? `<span>${esc(n.author)}</span>` : ''}</div>`}
    </div>`;
  }
  return `<div class="cover" style="--h:${hue(n.slug)}">
    <div class="gen" title="${esc(n.genre || '')}">${esc(n.genre || '')}</div>
    <div class="ttl">${esc(n.title)}</div>
    <div class="auth">${esc(n.author || '')}</div>
  </div>`;
}

let shelfTag = '';
async function viewShelf() {
  const { novels } = await site();
  crumbs([]);
  const bm = bookmarks();
  if (!novels.length) {
    app.innerHTML = '<div class="wrap empty"><h2>まだ作品がありません</h2></div>';
    return;
  }
  app.innerHTML = `<div class="wrap">
    <h2 class="section-title">${esc(siteTitle)} <small>${novels.length}作品</small></h2>
    ${tagFilterHtml(novels, shelfTag)}
    <div class="shelf">${novels.map((n) => {
      const b = bm[n.slug];
      return `<a class="book" href="#/n/${n.slug}" data-book-slug="${esc(n.slug)}">
        ${coverHtml(n)}
        <div class="book-meta">
          <div class="title">${esc(n.title)}</div>
          ${readingBadges(n)}
          <div class="row"><span>全${n.chapters.length}話${n.status === 'complete' ? '' : '（公開中）'}</span><span>${fmtNum(n.totalChars)}字</span></div>
          <div class="row"><span>${NOVEL_STATUS[n.status] ? `<span class="badge">${NOVEL_STATUS[n.status]}</span>` : ''}</span><span class="muted">${fmtDate(n.updated)}</span></div>
          ${b ? `<span class="resume">栞：第${b.no}話 ${Math.round(b.ratio * 100)}%</span>` : ''}
        </div></a>`;
    }).join('')}</div></div>`;
  bindTagFilter(app, novels, (tag) => { shelfTag = tag; });
}

// ---------- 作品ページ ----------
function tocHtml(n, { compact = false, current = 0 } = {}) {
  const read = readSet(n.slug);
  return `<ul class="toc">${n.chapters.map((c) => `<li><a href="#/n/${n.slug}/c/${c.no}" data-top>
    <span class="no">第${c.no}話</span>
    <span class="t">${esc(c.title)}${c.no === current ? '<span class="here">● 読書中</span>' : read.has(c.no) ? '<span class="here muted">✓</span>' : ''}</span>
    ${compact ? '' : `<span class="c">${fmtNum(c.chars)}字</span>`}
  </a></li>`).join('')}</ul>`;
}

async function viewNovel(slug) {
  const n = await novelOf(slug);
  crumbs([{ label: n.title }]);
  document.title = `${n.title}｜${siteTitle}`;
  const b = bookmarks()[slug];
  const firstNo = n.chapters[0]?.no;
  app.innerHTML = `<div class="wrap">
    <section class="novel-head">
      ${coverHtml(n)}
      <div class="novel-info">
        ${NOVEL_STATUS[n.status] ? `<span class="badge">${NOVEL_STATUS[n.status]}</span>` : ''} <span class="muted" style="font-size:13px">${esc(n.genre || '')}</span>
        <h1>${esc(n.title)}</h1>
        ${readingBadges(n)}
        ${adultNotice(n)}
        ${n.subtitle ? `<p class="sub">${esc(n.subtitle)}</p>` : ''}
        ${n.author ? `<p class="muted" style="margin:0 0 12px">${esc(n.author)}</p>` : ''}
        ${n.synopsis ? `<div class="synopsis">${esc(n.synopsis)}</div>` : ''}
        <div class="stats-row">
          <span><b>${n.chapters.length}</b>話</span>
          <span><b>${fmtNum(n.totalChars)}</b>字</span>
          <span>読了目安 <b>${minutes(n.totalChars)}</b>分</span>
          ${n.updated ? `<span>更新 ${fmtDate(n.updated)}</span>` : ''}
        </div>
        <div class="actions">
          ${firstNo ? `<a class="btn ${b ? '' : 'primary'}" href="#/n/${slug}/c/${firstNo}" data-top>最初から読む</a>` : ''}
          ${b && n.chapters.some((c) => c.no === b.no) ? `<a class="btn primary" href="#/n/${slug}/c/${b.no}" data-resume>続きから読む（第${b.no}話）</a>` : ''}
        </div>
      </div>
    </section>
    <h3 class="section-title" style="font-size:18px">目次</h3>
    ${tocHtml(n)}
  </div>`;
  $$('[data-top]').forEach((a) => a.addEventListener('click', () => { pendingJump = { top: true }; }));
  $$('[data-resume]').forEach((a) => a.addEventListener('click', () => { pendingJump = { ratio: b.ratio }; }));
}

// ---------- 挿絵 ----------
function placeIllustrations(page, slug, lines, items) {
  const end = $('.chapter-end', page);
  for (const it of [...items].sort((a, b) => a.line - b.line)) {
    let at = null;
    if (it.line) {
      const cands = it.quote ? lines.filter((l) => l.text.startsWith(it.quote)) : [];
      const best = cands.sort((a, b) => Math.abs(a.no - it.line) - Math.abs(b.no - it.line))[0] || lines.find((l) => l.no === it.line);
      if (best) at = $(`[data-line="${best.no}"]`, page);
    }
    const fig = document.createElement('figure');
    fig.className = `illust ${it.aspect || ''}`;
    fig.innerHTML = `<a href="${imgUrl(slug, it.file)}" target="_blank" rel="noopener"><img src="${imgUrl(slug, it.file)}" alt="挿絵" loading="lazy"></a>${it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : ''}`;
    if (at) at.after(fig);
    else if (end) end.before(fig);
  }
}

// ---------- リーダー ----------
const FONTS = {
  shippori: ['しっぽり明朝', '"Shippori Mincho B1", "Noto Serif JP", serif'],
  noto: ['Noto明朝', '"Noto Serif JP", "Yu Mincho", serif'],
  yu: ['游明朝', '"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", serif'],
  gothic: ['ゴシック', '"Noto Sans JP", "Yu Gothic", sans-serif'],
  ud: ['教科書体', '"UD Digi Kyokasho N-R", "UD デジタル 教科書体 N-R", "BIZ UDPMincho", serif'],
};
const RTHEMES = { auto: ['自動', ''], white: ['白', '#fff'], kinari: ['生成り', '#f5efe2'], usuzumi: ['薄墨', '#e4e2dc'], night: ['夜', '#141414'] };
const DEFAULTS = { vertical: false, font: 'shippori', fs: 18, lh: 1.95, measure: 36, vlen: 40, rtheme: 'auto', indent: true };

async function viewReader(slug, no) {
  const prefs = { ...DEFAULTS, ...store.get('reader', {}) };
  const savePrefs = () => store.set('reader', prefs);
  const novel = await novelOf(slug);
  const idx = novel.chapters.findIndex((c) => c.no === no);
  if (idx < 0) throw new Error(`第${no}話は公開されていません`);
  if (!requireAdultConfirmation(app, novel, () => route())) return;
  const { title, lines, illus = [] } = await getJSON(`data/${slug}/${pad(no)}.json`);
  const prev = novel.chapters[idx - 1];
  const next = novel.chapters[idx + 1];

  document.body.classList.add('reading');
  app.innerHTML = `
    <div class="reader" id="reader">
      <div class="reader-scroll" id="rs"><article class="page" id="page"></article></div>
    </div>
    <div class="read-progress"><i id="rp"></i></div>
    <div class="dock" id="dock">
      <button class="icon-btn" data-act="toc" title="目次 (T)">☰</button>
      <button class="icon-btn" data-act="back" title="">‹</button>
      <span class="lbl" id="lbl"></span>
      <button class="icon-btn" data-act="fwd" title="">›</button>
      <button class="icon-btn" data-act="prefs" title="表示設定 (S)">Aa</button>
    </div>
    <div class="scrim" id="scrim"></div>
    <aside class="panel left" id="pToc"><h3>目次 <button class="icon-btn" data-close>✕</button></h3><div id="tocBody"></div></aside>
    <aside class="panel" id="pPrefs"><h3>表示設定 <button class="icon-btn" data-close>✕</button></h3><div id="prefsBody"></div></aside>`;

  const reader = $('#reader'), rs = $('#rs'), page = $('#page');
  crumbs([{ label: novel.title, href: `#/n/${slug}` }, { label: `第${no}話` }]);
  document.title = `${title || `第${no}話`}｜${novel.title}`;

  const endCard = next
    ? `<a class="next-card" href="#/n/${slug}/c/${next.no}" data-top><span class="muted">次の話</span><b>${esc(next.title)}</b></a>`
    : novel.status === 'complete' ? '<p>― 完 ―</p>' : '<p>続きは公開をお待ちください。</p>';
  page.innerHTML = `<h1>${inlineToHtml(title || `第${no}話`)}</h1>${chapterBodyHtml(lines)}
    <div class="chapter-end"><div>第${no}話 了</div>${endCard}</div>`;
  if (illus.length) placeIllustrations(page, slug, lines, illus);
  $$('[data-top]', page).forEach((a) => a.addEventListener('click', () => { pendingJump = { top: true }; }));

  // --- 表示設定の反映 ---
  function applyPrefs() {
    reader.classList.toggle('vertical', prefs.vertical);
    reader.classList.toggle('no-indent', !prefs.indent);
    reader.dataset.rtheme = prefs.rtheme;
    reader.style.setProperty('--fs', prefs.fs + 'px');
    reader.style.setProperty('--lh', prefs.lh);
    reader.style.setProperty('--measure', prefs.measure + 'em');
    reader.style.setProperty('--vlen', prefs.vlen + 'em');
    reader.style.setProperty('--r-font', (FONTS[prefs.font] || FONTS.shippori)[1]);
    rs.style.writingMode = prefs.vertical ? 'vertical-rl' : '';
    // 縦書きでは左が「進む」
    const [back, fwd] = prefs.vertical ? ['fwd', 'back'] : ['back', 'fwd'];
    const btns = $$('#dock [data-act="back"], #dock [data-act="fwd"]');
    btns[0].dataset.act = back; btns[1].dataset.act = fwd;
    btns.forEach((b) => b.title = b.dataset.act === 'fwd' ? (next ? `次の話：${next.title}` : '次の話はありません') : (prev ? `前の話：${prev.title}` : '前の話はありません'));
    btns.forEach((b) => b.disabled = b.dataset.act === 'fwd' ? !next : !prev);
  }

  // --- スクロール位置 ---
  const getRatio = () => {
    const max = prefs.vertical ? rs.scrollWidth - rs.clientWidth : rs.scrollHeight - rs.clientHeight;
    if (max <= 0) return 1;
    return Math.min(1, Math.abs(prefs.vertical ? rs.scrollLeft : rs.scrollTop) / max);
  };
  const setRatio = (r) => {
    if (prefs.vertical) rs.scrollLeft = -r * (rs.scrollWidth - rs.clientWidth);
    else rs.scrollTop = r * (rs.scrollHeight - rs.clientHeight);
  };
  const updateProgress = () => {
    const r = getRatio();
    $('#rp').style.width = (r * 100).toFixed(1) + '%';
    $('#lbl').textContent = `第${no}話 ${idx + 1}/${novel.chapters.length}　${Math.round(r * 100)}%`;
  };
  const persist = debounce(() => saveBookmark(slug, no, getRatio()), 400);
  rs.addEventListener('scroll', () => { updateProgress(); persist(); hideChrome(); }, { passive: true });

  // 縦書き時はホイールを横スクロールに
  rs.addEventListener('wheel', (e) => {
    if (!prefs.vertical || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    rs.scrollLeft -= e.deltaY * (e.deltaMode === 1 ? 32 : 1);
  }, { passive: false });

  // --- UI の自動非表示 ---
  const dock = $('#dock'), topbar = $('#topbar');
  let hideT;
  function showChrome() {
    dock.classList.remove('away'); topbar.classList.remove('away');
    clearTimeout(hideT);
    hideT = setTimeout(() => { if (!$('.panel.open')) { dock.classList.add('away'); topbar.classList.add('away'); } }, 2600);
  }
  function hideChrome() {
    if ($('.panel.open') || dock.matches(':hover')) return;
    dock.classList.add('away'); topbar.classList.add('away');
  }
  const onMove = (e) => { if (e.clientY > innerHeight - 110 || e.clientY < 70) showChrome(); };
  document.addEventListener('mousemove', onMove);
  rs.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    dock.classList.contains('away') ? showChrome() : hideChrome();
  });

  // --- パネル ---
  const panels = { toc: $('#pToc'), prefs: $('#pPrefs') };
  function openPanel(k) {
    const isOpen = panels[k].classList.contains('open');
    Object.values(panels).forEach((p) => p.classList.remove('open'));
    $('#scrim').classList.toggle('on', !isOpen);
    if (isOpen) return;
    panels[k].classList.add('open');
    if (k === 'toc') $('#tocBody').innerHTML = tocHtml(novel, { compact: true, current: no });
    if (k === 'prefs') renderPrefs();
    showChrome();
  }
  const closePanels = () => { Object.values(panels).forEach((p) => p.classList.remove('open')); $('#scrim').classList.remove('on'); };
  $('#scrim').onclick = closePanels;
  $$('[data-close]').forEach((b) => b.onclick = closePanels);
  $('#tocBody').addEventListener('click', (e) => { if (e.target.closest('a')) pendingJump = { top: true }; });

  const go = (c) => { if (c) { pendingJump = { top: true }; location.hash = `#/n/${slug}/c/${c.no}`; } };
  dock.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'toc' || a === 'prefs') openPanel(a);
    else if (a === 'fwd') go(next);
    else if (a === 'back') go(prev);
  });

  function renderPrefs() {
    const seg = (key, opts) => `<div class="seg" data-key="${key}">${Object.entries(opts).map(([v, l]) =>
      `<button data-v="${v}" class="${String(prefs[key]) === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const range = (key, min, max, step, unit) =>
      `<input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${prefs[key]}"><span class="muted" style="font-size:12px">${prefs[key]}${unit}</span>`;
    $('#prefsBody').innerHTML = `
      <div class="field"><label>組み方向</label>${seg('vertical', { false: '横書き', true: '縦書き' })}</div>
      <div class="field"><label>書体</label>${seg('font', Object.fromEntries(Object.entries(FONTS).map(([k, v]) => [k, v[0]])))}</div>
      <div class="field"><label>文字サイズ</label>${range('fs', 13, 30, 1, 'px')}</div>
      <div class="field"><label>行間</label>${range('lh', 1.5, 2.6, 0.05, '')}</div>
      <div class="field ${prefs.vertical ? 'hidden' : ''}"><label>一行の長さ（横書き）</label>${range('measure', 22, 52, 1, '字')}</div>
      <div class="field ${prefs.vertical ? '' : 'hidden'}"><label>一行の長さ（縦書き）</label>${range('vlen', 20, 60, 1, '字')}</div>
      <div class="field"><label>背景</label><div class="seg" data-key="rtheme">${Object.entries(RTHEMES).map(([k, [l, c]]) =>
        `<button data-v="${k}" class="${prefs.rtheme === k ? 'on' : ''} ${c ? 'swatch' : ''}" title="${l}" style="${c ? `background:${c}` : ''}">${c ? '' : l}</button>`).join('')}</div></div>
      <div class="field"><label>段落の字下げ</label>${seg('indent', { true: 'あり', false: 'なし' })}</div>
      <div class="field"><label>操作</label><div class="muted" style="font-size:12px;line-height:1.9">
        横書き：← → で前後の話／Space でスクロール<br>縦書き：← で進む・→ で戻る（端で前後の話へ）<br>T 目次　S 設定　Esc 閉じる</div></div>
      <button class="btn small" id="resetPrefs">初期設定に戻す</button>`;
    $$('#prefsBody .seg').forEach((s) => s.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const key = s.dataset.key;
      const r = getRatio();
      prefs[key] = typeof DEFAULTS[key] === 'boolean' ? b.dataset.v === 'true' : b.dataset.v;
      savePrefs(); applyPrefs(); renderPrefs();
      requestAnimationFrame(() => setRatio(r));
    });
    $$('#prefsBody input[type=range]').forEach((inp) => inp.oninput = () => {
      const r = getRatio();
      prefs[inp.dataset.key] = parseFloat(inp.value);
      inp.nextElementSibling.textContent = inp.value + ({ fs: 'px', measure: '字', vlen: '字' }[inp.dataset.key] || '');
      savePrefs(); applyPrefs();
      setRatio(r);
    });
    $('#resetPrefs').onclick = () => { Object.assign(prefs, DEFAULTS); savePrefs(); applyPrefs(); renderPrefs(); };
  }

  // --- キーボード ---
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape') return closePanels();
    if (k === 't' || k === 'T') return openPanel('toc');
    if (k === 's' || k === 'S') return openPanel('prefs');
    if (k === 'n') return go(next);
    if (k === 'p') return go(prev);
    if (prefs.vertical) {
      const stepPage = (dir) => {
        const r = getRatio();
        if (dir > 0 && r >= 0.999) return go(next);
        if (dir < 0 && r <= 0.001) return go(prev);
        rs.scrollBy({ left: -dir * rs.clientWidth * 0.88, behavior: 'smooth' });
      };
      if (k === 'ArrowLeft' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) { e.preventDefault(); stepPage(1); }
      else if (k === 'ArrowRight' || k === 'PageUp' || (k === ' ' && e.shiftKey)) { e.preventDefault(); stepPage(-1); }
      else if (k === 'ArrowDown') { e.preventDefault(); rs.scrollBy({ left: -120 }); }
      else if (k === 'ArrowUp') { e.preventDefault(); rs.scrollBy({ left: 120 }); }
    } else {
      if (k === 'ArrowRight') go(next);
      else if (k === 'ArrowLeft') go(prev);
      else if (k === ' ' || k === 'PageDown' || k === 'PageUp' || k === 'ArrowDown' || k === 'ArrowUp') {
        if (document.activeElement !== rs) rs.focus({ preventScroll: true });
      }
    }
  };
  document.addEventListener('keydown', onKey);
  rs.tabIndex = -1;

  // --- 初期表示 ---
  applyPrefs();
  rs.focus({ preventScroll: true });
  const jump = pendingJump;
  pendingJump = null;
  requestAnimationFrame(() => {
    if (jump?.ratio != null) setRatio(jump.ratio);
    else if (!jump?.top) {
      const b = bookmarks()[slug];
      if (b && b.no === no) setRatio(b.ratio);
    }
    updateProgress();
    showChrome();
  });

  cleanup = () => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('mousemove', onMove);
    clearTimeout(hideT);
  };
}

site().then((s) => {
  siteTitle = s.title || '書架';
  $('#siteTitle').textContent = siteTitle;
}).catch(() => toast('作品の一覧を読み込めませんでした')).finally(route);
