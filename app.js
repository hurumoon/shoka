// 公開サイト（novel.mjs publish で書き出す静的な書架）。読むための機能だけを持つ。
// 本文は書き出し時に { title, lines } にしてあるので、ここでは表示するだけ。
import { escapeHtml as esc, chapterBodyHtml, inlineToHtml } from './render.js';
import { readingBadges, adultNotice, requireAdultConfirmation, creditsHtml, coverCredit } from './reading.js';
import { seriesBadge, seriesNavigation, seriesOf } from './reading.js';
import { normalize, SIZES, selectNovels, isFiltered, categoryCounts, filterTags, featuredNovel, chapterSubtitle, chapterLabel, validPosition, novelPath, chapterPath, routeToPath, pathToRoute } from './catalog.js';
import { aboutHtml, OPERATOR } from './about.js';

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
const readTime = (chars) => minutes(chars) < 60 ? `約${minutes(chars)}分` : `約${Math.round(minutes(chars) / 60)}時間`;
const genreParts = (n) => [...new Set([n.category, n.genre].filter(Boolean))];
const genreText = (n) => genreParts(n).join('／');
// 語の途中で折り返さないよう項目ごとに包む（画面幅より長い項目だけは中で折り返す）
const genreHtml = (n) => genreParts(n).map((part, i, all) => `<span class="genre-part">${esc(part)}${i < all.length - 1 ? '／' : ''}</span>`).join('');
const imgUrl = (slug, file) => `img/${encodeURIComponent(slug)}/${encodeURIComponent(file)}`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('ja-JP') : '');

function debounce(fn, ms) {
  let t;
  const run = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  run.cancel = () => clearTimeout(t);
  return run;
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
function saveBookmark(slug, no, ratio, anchor) {
  const b = bookmarks();
  b[slug] = { no, ratio, anchor, t: Date.now() };
  store.set('bm', b);
  const positions = store.get('positions', {});
  positions[slug] = { ...positions[slug], [no]: b[slug] };
  store.set('positions', positions);
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
let routeVersion = 0;
// URLは生成済みHTMLと同じ普通のパスにする。アドレスバーをそのまま貼っても作品ごとのOGPが出る。
// 古い #/n/... のリンクも開け、開いた時点で普通のパスに置き換える。
const pageUrl = (to) => new URL(routeToPath(to), document.baseURI);
function routeOfUrl(url) {
  if (url.origin !== location.origin) return null;
  if (url.hash.startsWith('#/')) return decodeURIComponent(url.hash.slice(1));
  const root = new URL('./', document.baseURI).pathname;
  return url.pathname.startsWith(root) ? pathToRoute(url.pathname.slice(root.length)) : null;
}
function currentRoute() {
  const to = routeOfUrl(new URL(location.href)) || document.body.dataset.route || '/';
  if (location.hash.startsWith('#/')) history.replaceState(null, '', pageUrl(to));
  return to;
}
function goTo(to) {
  const url = pageUrl(to);
  if (location.href === url.href) { if (pendingJump) route(); return; }
  history.pushState(null, '', url);
  route();
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  const to = routeOfUrl(new URL(a.href));
  if (to == null) return;
  e.preventDefault();
  goTo(to);
});

function crumbs(items) {
  $('#crumbs').innerHTML = items.map((it, i) =>
    (i ? '<span class="sep">／</span>' : '') + (it.href ? `<a href="${it.href}">${esc(it.label)}</a>` : `<span>${esc(it.label)}</span>`)).join('');
}

async function route() {
  const version = ++routeVersion;
  if (cleanup) { cleanup(); cleanup = null; }
  document.body.classList.remove('reading');
  $('#topbar').classList.remove('away');
  document.title = siteTitle;
  try {
    const h = currentRoute();
    const m = h.match(/^\/n\/([^/]+)(?:\/c\/(\d+))?\/?$/);
    const about = /^\/about\/?$/.test(h);
    if (about) $('.site-about').setAttribute('aria-current', 'page');
    else $('.site-about').removeAttribute('aria-current');
    if (!m?.[2]) pendingJump = null;
    if (about) viewAbout();
    else if (!m) await viewShelf(version);
    else if (m[2]) await viewReader(m[1], parseInt(m[2], 10), version);
    else await viewNovel(m[1], version);
  } catch (e) {
    if (version !== routeVersion) return;
    pendingJump = null;
    app.innerHTML = `<div class="wrap empty"><h2>読み込めませんでした</h2><p>${esc(e.message)}</p><p><a class="btn" href="./">書架へ戻る</a></p></div>`;
  }
}
window.addEventListener('popstate', route);
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/')) route(); });

function viewAbout() {
  document.title = `About｜${siteTitle}`;
  crumbs([{ label: 'この書架について' }]);
  app.innerHTML = aboutHtml(siteTitle);
  window.scrollTo(0, 0);
}

// ---------- 書架 ----------
// plain は下に題名を出す一覧用。絵に題名を重ねない
function coverHtml(n, { plain = false, priority = false, sizes = '(max-width: 700px) 45vw, 240px' } = {}) {
  if (n.cover) {
    // small は目録、thumb は書架の並び用の小さい画像。高解像度の画面や大きく出す場所では srcset で本体を選ばせる
    const { file, thumb, small } = n.cover;
    const srcset = [small && `${imgUrl(n.slug, small)} 240w`, thumb && `${imgUrl(n.slug, thumb)} 480w`, thumb && `${imgUrl(n.slug, file)} 1000w`].filter(Boolean).join(', ');
    // 最初に見える一番大きい表紙だけは遅らせず、先に読ませる
    return `<div class="cover has-img" style="--h:${hue(n.slug)}">
      <img src="${imgUrl(n.slug, thumb || file)}"${srcset ? ` srcset="${srcset}" sizes="${sizes}"` : ''} alt="" ${priority ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
      ${n.cover.withTitle || plain ? '' : `<div class="img-ttl"><b>${esc(n.title)}</b>${coverCredit(n) ? `<span>${esc(coverCredit(n))}</span>` : ''}</div>`}
    </div>`;
  }
  return `<div class="cover" style="--h:${hue(n.slug)}">
    <div class="gen" title="${esc(genreText(n))}">${esc(n.category || n.genre || '')}</div>
    <div class="ttl">${esc(n.title)}</div>
    <div class="auth">${esc(coverCredit(n))}</div>
  </div>`;
}

const savedShelf = store.get('shelf', {}) || {};
const FILTER_KEYS = ['query', 'category', 'series', 'status', 'size', 'sort'];
let shelfFilters = { query: '', category: '', series: '', tags: [], status: '', size: '', sort: 'updated' };
for (const key of FILTER_KEYS) if (typeof savedShelf[key] === 'string') shelfFilters[key] = savedShelf[key];
if (Array.isArray(savedShelf.tags)) shelfFilters.tags = savedShelf.tags.filter((t) => typeof t === 'string');
let shelfPage = Math.max(0, Math.floor(Number(savedShelf.page) || 0));
let shelfView = savedShelf.view === 'covers' ? 'covers' : 'catalog';

// 「完／結」のように語の途中で折り返さないよう、項目ごとに nowrap で包む
const nowrap = (text) => `<span class="nowrap">${esc(text)}</span>`;
const shelfLine = (n) => [n.category || n.genre, readTime(n.totalChars), NOVEL_STATUS[n.status] || '連載中'].filter(Boolean).map(nowrap).join('・');
const adultMark = (n) => n.adultContent ? '<span class="badge adult">R18</span>' : '';
function featureHtml(n) {
  if (!n) return '';
  return `<section class="feature" aria-label="注目の作品"><div class="feature-in">
    <a class="feature-cover" href="${novelPath(n.slug)}" aria-label="${esc(n.title)}">${coverHtml(n, { priority: true, sizes: '(max-width: 600px) 112px, 300px' })}</a>
    <div class="feature-text">
      <p class="feature-kick">注目の作品</p>
      <h2><a href="${novelPath(n.slug)}">${esc(n.title)}</a></h2>
      <p class="feature-meta">${esc(n.author || '')}　${shelfLine(n)}</p>
      <p class="feature-synopsis">${esc(n.synopsis || '')}</p>
      <a class="feature-go" href="${chapterPath(n.slug, n.chapters[0]?.no ?? 1)}">読みはじめる</a>
    </div>
  </div></section>`;
}
function resumeHtml(b) {
  return b ? `<span class="resume">栞：第${b.no}話 ${Math.round(b.ratio * 100)}%</span>` : '';
}
function catalogCard(n, b) {
  return `<a class="book entry" href="${novelPath(n.slug)}" data-book-slug="${esc(n.slug)}">
    ${coverHtml(n, { plain: true, sizes: '(max-width: 600px) 72px, 88px' })}
    <div class="book-meta">
      <div class="title">${esc(n.title)}</div>
      ${seriesBadge(n)}
      <div class="line">${shelfLine(n)}・${nowrap(`全${n.chapters.length}話`)}${adultMark(n)}</div>
      <p class="synopsis">${esc(n.synopsis || '紹介文はまだありません。')}</p>
      ${resumeHtml(b)}
    </div></a>`;
}
function coverCard(n, b) {
  return `<a class="book tile" href="${novelPath(n.slug)}" data-book-slug="${esc(n.slug)}">
    ${coverHtml(n, { plain: true, sizes: '(max-width: 700px) 45vw, 230px' })}
    <div class="book-meta">
      <div class="title">${esc(n.title)}</div>
      <div class="line">${shelfLine(n)}${adultMark(n)}</div>
      ${resumeHtml(b)}
    </div></a>`;
}

async function viewShelf(version) {
  const { novels } = await site();
  if (version !== routeVersion) return;
  crumbs([]);
  const bm = bookmarks();
  if (!novels.length) {
    app.innerHTML = '<div class="wrap empty"><h2>まだ作品がありません</h2></div>';
    return;
  }
  const categories = categoryCounts(novels);
  if (!categories.some(([c]) => c === shelfFilters.category)) shelfFilters.category = '';
  const secondaryCount = () => [shelfFilters.series, shelfFilters.status, shelfFilters.size].filter(Boolean).length + shelfFilters.tags.length;
  app.innerHTML = `<h1 class="sr-only">${esc(siteTitle)}</h1>
    <div id="entrances"></div>
    <div class="wrap shelf-wrap">
    <form class="explore" id="explore" role="search" aria-label="作品を探す">
      <label class="query"><span class="sr-only">作品を探す</span><input type="search" name="query" placeholder="題名・タグ・あらすじで探す" value="${esc(shelfFilters.query)}"></label>
      ${categories.length ? `<fieldset class="category-chips"><legend class="sr-only">ジャンル</legend><label><input type="radio" name="category" value="">すべて</label>${categories.map(([c, count]) => `<label><input type="radio" name="category" value="${esc(c)}">${esc(c)}<small>${count}</small></label>`).join('')}</fieldset>` : ''}
      <label class="sort-field"><span class="sr-only">並び順</span><select name="sort"><option value="updated">更新が新しい順</option><option value="genre">ジャンル別</option><option value="title">タイトル順</option><option value="short">文字数が少ない順</option><option value="chars">文字数が多い順</option></select></label>
      <details class="more-filters"${secondaryCount() ? ' open' : ''}><summary>絞り込み<span id="activeFilters"></span></summary>
        <div class="explore-grid">
          <label>シリーズ<select name="series"><option value="">すべて</option>${[...new Set(novels.map(seriesOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')).map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></label>
          <label>連載状況<select name="status"><option value="">すべて</option><option value="complete">完結</option><option value="writing">連載中</option></select></label>
          <label>作品の長さ<select name="size"><option value="">すべて</option>${Object.entries(SIZES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        </div>
        <p class="tag-heading">タグ（選んだものをすべて含む作品）<span id="selectedTags"></span></p>
        <div class="tag-options">${filterTags(novels, shelfFilters.tags).map(([t, count]) => `<label><input type="checkbox" name="tag" value="${esc(t)}"${shelfFilters.tags.includes(t) ? ' checked' : ''}>${esc(t)}<small>${count}</small></label>`).join('') || '<p>タグはまだありません</p>'}</div>
        <small class="muted">ここにないタグは検索欄で探せます。作品の長さは公開中の本文の文字数です。</small>
      </details>
    </form>
    <div class="results-head"><h2 id="resultsTitle"></h2><p id="resultCount" role="status" aria-live="polite"></p><button class="btn small" type="reset" form="explore" id="resetFilters">条件をリセット</button>
      <div class="view-switch" id="viewSwitch" role="group" aria-label="一覧の表示"><button type="button" data-view="catalog">目録</button><button type="button" data-view="covers">表紙</button></div></div>
    <div id="results"></div><nav class="pagination" id="pagination" aria-label="作品一覧のページ"></nav>
    <p class="site-credit">企画・監修：${esc(OPERATOR)}（<a href="about/" data-route="/about">この書架について</a>）</p></div>`;
  const form = $('#explore');
  const syncForm = () => {
    for (const key of FILTER_KEYS) if (key !== 'category') form.elements[key].value = shelfFilters[key];
    $$('[name=category]', form).forEach((el) => { el.checked = el.value === shelfFilters.category; });
  };
  syncForm();
  const entrances = featureHtml(featuredNovel(novels));
  function renderResults() {
    const found = selectNovels(novels, shelfFilters);
    const pages = Math.max(1, Math.ceil(found.length / 24));
    shelfPage = Math.min(shelfPage, pages - 1);
    store.set('shelf', { ...shelfFilters, page: shelfPage, view: shelfView });
    const filtered = isFiltered(shelfFilters);
    $('#entrances').innerHTML = filtered || shelfPage ? '' : entrances;
    $('#resultsTitle').textContent = filtered ? '見つかった作品' : 'すべての作品';
    $('#resultCount').textContent = `${found.length} / ${novels.length}作品`;
    $('#resetFilters').hidden = !filtered && shelfFilters.sort === 'updated';
    $('#activeFilters').textContent = secondaryCount() ? `（${secondaryCount()}件指定中）` : '';
    $('#selectedTags').textContent = shelfFilters.tags.length ? `：${shelfFilters.tags.join('・')}` : '';
    $$('[data-view]', $('#viewSwitch')).forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.view === shelfView)));
    const shown = found.slice(shelfPage * 24, (shelfPage + 1) * 24);
    const entries = (works) => `<div class="entries ${shelfView}">${works.map((n) => (shelfView === 'covers' ? coverCard : catalogCard)(n, bm[n.slug])).join('')}</div>`;
    // ジャンル別のときだけ見出しで分ける。作品の順番は目録と表紙で同じ
    const groups = new Map();
    if (shelfFilters.sort === 'genre') for (const n of shown) groups.set(n.category || '', [...(groups.get(n.category || '') || []), n]);
    $('#results').innerHTML = !shown.length ? '<p class="empty">条件に合う作品はありません。検索語や絞り込みを変更してください。</p>'
      : groups.size ? [...groups].map(([c, works]) => `<section class="genre-group"><h3 class="genre-label">${esc(c || 'ジャンル未設定')}<small>${found.filter((n) => (n.category || '') === c).length}作</small></h3>${entries(works)}</section>`).join('')
      : entries(shown);
    $('#pagination').innerHTML = pages > 1 ? `<button class="btn" data-page="-1" ${!shelfPage ? 'disabled' : ''}>前へ</button><span>${shelfPage + 1} / ${pages}</span><button class="btn" data-page="1" ${shelfPage === pages - 1 ? 'disabled' : ''}>次へ</button>` : '';
  }
  form.onsubmit = (e) => e.preventDefault();
  form.oninput = () => {
    for (const key of FILTER_KEYS) if (key !== 'category') shelfFilters[key] = form.elements[key].value;
    shelfFilters.category = $('[name=category]:checked', form)?.value || '';
    shelfFilters.tags = $$('[name=tag]:checked', form).map((el) => el.value);
    // 絞り込むと注目の作品が消えるので、入力欄が画面上で動かないようにスクロールで補う
    const top = form.getBoundingClientRect().top;
    shelfPage = 0; renderResults();
    window.scrollBy(0, form.getBoundingClientRect().top - top);
  };
  $('#viewSwitch').onclick = (e) => { const b = e.target.closest('[data-view]'); if (b) { shelfView = b.dataset.view; renderResults(); } };
  form.onreset = (e) => {
    e.preventDefault();
    shelfFilters = { query: '', category: '', series: '', tags: [], status: '', size: '', sort: 'updated' };
    shelfPage = 0;
    // reset の既定値ではなく、戻る操作前の条件も含めて全て解除する。
    syncForm();
    $$('[name=tag]', form).forEach((el) => el.checked = false);
    renderResults();
  };
  $('#pagination').onclick = (e) => { const b = e.target.closest('[data-page]'); if (b) { shelfPage += Number(b.dataset.page); renderResults(); $('.results-head').scrollIntoView(); } };
  renderResults();
}

// ---------- 作品ページ ----------
function tocHtml(n, { compact = false, current = 0 } = {}) {
  const read = readSet(n.slug);
  return `<ul class="toc">${n.chapters.map((c) => `<li data-chapter="${c.no}" data-read="${read.has(c.no)}"><a href="${chapterPath(n.slug, c.no)}" data-top${c.no === current ? ' aria-current="page"' : ''}>
    <span class="no">第${c.no}話</span>
    <span class="t">${esc(chapterSubtitle(c))}<span class="read-state">${c.no === current ? '● 読書中' : read.has(c.no) ? '✓ 既読' : '未読'}</span></span>
    ${compact ? '' : `<span class="c">${fmtNum(c.chars)}字</span>`}
  </a></li>`).join('')}</ul>`;
}

// 話数が少ない作品は一覧で見渡せるので、検索と移動を出さない
const TOC_SEARCH_MIN = 10;

function mountToc(container, n, options = {}) {
  const searchable = n.chapters.length >= TOC_SEARCH_MIN;
  container.innerHTML = `<div class="toc-tools">${searchable ? `<label>話数・章題で探す<input type="search" data-toc-query placeholder="例：25、旅立ち"></label><label>話数へ移動<select data-toc-jump><option value="">選んで読む</option>${n.chapters.map((c) => `<option value="${c.no}">${esc(chapterLabel(c))}</option>`).join('')}</select></label>` : ''}<label class="unread-filter"><input type="checkbox" data-unread>未読だけ</label></div><p class="toc-count" role="status"></p>${tocHtml(n, options)}`;
  const filter = () => {
    const q = normalize(searchable ? $('[data-toc-query]', container).value : '');
    const unread = $('[data-unread]', container).checked;
    let count = 0;
    $$('.toc li', container).forEach((li, i) => { li.hidden = !(normalize(`第${n.chapters[i].no}話 ${n.chapters[i].title}`).includes(q) && (!unread || li.dataset.read !== 'true')); if (!li.hidden) count++; });
    $('.toc-count', container).textContent = `${count} / ${n.chapters.length}話`;
  };
  $('[data-unread]', container).onchange = filter;
  if (searchable) {
    $('[data-toc-query]', container).oninput = filter;
    $('[data-toc-jump]', container).onchange = (e) => { if (e.target.value) { pendingJump = { top: true }; goTo(`/n/${n.slug}/c/${e.target.value}`); } };
  }
  container.onclick = (e) => { if (e.target.closest('[data-top]')) pendingJump = { top: true }; };
  filter();
}

// スマホは端末の共有メニュー、PCはURLのコピー
async function shareNovel(n) {
  const url = new URL(novelPath(n.slug), document.baseURI).href;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title: n.title, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('この作品のURLをコピーしました'); }
  catch { toast(url); }
}

async function viewNovel(slug, version) {
  const n = await novelOf(slug);
  const seriesWorks = (await site()).novels;
  if (version !== routeVersion) return;
  crumbs([{ label: n.title }]);
  document.title = `${n.title}｜${siteTitle}`;
  const saved = validPosition(bookmarks()[slug]);
  const b = saved && n.chapters.some((c) => c.no === saved.no) ? saved : null;
  const firstNo = n.chapters[0]?.no;
  app.innerHTML = `<div class="wrap">
    <section class="novel-head">
      ${coverHtml(n)}
      <div class="novel-info">
        ${NOVEL_STATUS[n.status] ? `<span class="badge">${NOVEL_STATUS[n.status]}</span>` : ''} <span class="muted" style="font-size:13px">${genreHtml(n)}</span>
        <h1>${esc(n.title)}</h1>
        ${seriesBadge(n)}
        ${seriesNavigation(n, seriesWorks, (work) => novelPath(work.slug))}
        ${readingBadges(n)}
        ${adultNotice(n)}
        ${n.subtitle ? `<p class="sub">${esc(n.subtitle)}</p>` : ''}
        ${n.author ? `<p>${esc(n.author)}</p>` : ''}
        <div class="synopsis">${esc(n.synopsis || '紹介文はまだありません。目次から作品をお楽しみください。')}</div>
        <div class="actions">
          ${firstNo ? `<a class="btn ${b ? '' : 'primary'}" href="${chapterPath(slug, firstNo)}" data-top>最初から読む</a>` : ''}
          ${b && n.chapters.some((c) => c.no === b.no) ? `<a class="btn primary" href="${chapterPath(slug, b.no)}" data-resume>続きから読む（第${b.no}話）</a>` : ''}
        </div>
        <div class="stats-row">
          <span><b>${n.chapters.length}</b>話</span>
          <span><b>${fmtNum(n.totalChars)}</b>字</span>
          <span>読了目安 <b>${minutes(n.totalChars)}</b>分</span>
          ${n.updated ? `<span>更新 ${fmtDate(n.updated)}</span>` : ''}
        </div>
        <p><button class="btn small" type="button" id="shareNovel">この作品を共有</button></p>
        <details class="production"><summary>制作担当</summary>${creditsHtml(n) || '<p>制作担当の記録はありません。</p>'}</details>
      </div>
    </section>
    <h3 class="section-title" style="font-size:18px">目次</h3>
    <div id="novelToc"></div>
  </div>`;
  mountToc($('#novelToc'), n);
  $('#shareNovel').onclick = () => shareNovel(n);
  $$('[data-top]').forEach((a) => a.addEventListener('click', () => { pendingJump = { top: true }; }));
  $$('[data-resume]').forEach((a) => a.addEventListener('click', () => { pendingJump = b; }));
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
// Noto明朝を選んだ人だけが読み込む（CSSだけで約30KB）
const FONT_SHEETS = { noto: 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400..600&display=swap' };
function loadFontSheet(font) {
  const href = FONT_SHEETS[font];
  if (!href || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}
const RTHEMES = { auto: ['自動', ''], white: ['白', '#fff'], kinari: ['生成り', '#f5efe2'], usuzumi: ['薄墨', '#e4e2dc'], night: ['夜', '#141414'] };
const DEFAULTS = { vertical: false, font: 'shippori', fs: 18, lh: 1.95, measure: 36, vlen: 40, rtheme: 'auto', indent: true };

async function viewReader(slug, no, version) {
  const prefs = { ...DEFAULTS, ...store.get('reader', {}) };
  const savePrefs = () => store.set('reader', prefs);
  const novel = await novelOf(slug);
  if (version !== routeVersion) return;
  const idx = novel.chapters.findIndex((c) => c.no === no);
  if (idx < 0) throw new Error(`第${no}話は公開されていません`);
  if (!requireAdultConfirmation(app, novel, () => route())) return;
  const { title, lines, illus = [] } = await getJSON(`data/${slug}/${pad(no)}.json`);
  if (version !== routeVersion) return;
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
  crumbs([{ label: novel.title, href: novelPath(slug) }, { label: `第${no}話` }]);
  document.title = `${title || `第${no}話`}｜${novel.title}`;

  const endCard = next
    ? `<a class="next-card" href="${chapterPath(slug, next.no)}" data-top><span class="muted">次の話</span><b>${esc(next.title)}</b></a>`
    : novel.status === 'complete' ? '<p>― 完 ―</p>' : '<p>続きは公開をお待ちください。</p>';
  page.innerHTML = `<h1>${inlineToHtml(title || `第${no}話`)}</h1>${chapterBodyHtml(lines)}
    <div class="chapter-end"><div>第${no}話 了</div>${endCard}<div class="end-links"><a class="btn" href="${novelPath(slug)}">作品・目次へ</a><a class="btn" href="./">書架で作品を探す</a></div></div>`;
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
    loadFontSheet(prefs.font);
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
    r = Math.max(0, Math.min(1, Number(r) || 0));
    if (prefs.vertical) rs.scrollLeft = -r * (rs.scrollWidth - rs.clientWidth);
    else rs.scrollTop = r * (rs.scrollHeight - rs.clientHeight);
  };
  // 段落と段落内の割合を栞に残す。文字サイズ・縦横の変更で全体の比率が変わっても同じ段落へ戻せる。
  const lineElements = $$('[data-line]', page);
  function capturePosition() {
    const viewport = rs.getBoundingClientRect();
    const edge = prefs.vertical ? viewport.right - 20 : viewport.top + 64;
    const el = lineElements.find((el) => {
      const r = el.getBoundingClientRect();
      return prefs.vertical ? r.left < edge && r.right > viewport.left : r.bottom > edge && r.top < viewport.bottom;
    });
    const rect = el?.getBoundingClientRect();
    const offset = rect ? (prefs.vertical ? rect.right - edge : edge - rect.top) : 0;
    const extent = rect ? (prefs.vertical ? rect.width : rect.height) : 1;
    return { no, ratio: getRatio(), anchor: el ? { line: Number(el.dataset.line), fraction: Math.max(0, Math.min(1, offset / extent)) } : null };
  }
  function restorePosition(position) {
    if (!position) return;
    setRatio(position.ratio);
    // 端は本文の外（見出し／読了カード）も含めた端として保存する。
    if (position.ratio < 0.001 || position.ratio > 0.999) return;
    const el = lineElements.find((el) => Number(el.dataset.line) === position.anchor?.line);
    if (el) {
      const rect = el.getBoundingClientRect(), viewport = rs.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, Number(position.anchor.fraction) || 0));
      if (prefs.vertical) rs.scrollLeft += rect.right - fraction * rect.width - (viewport.right - 20);
      else rs.scrollTop += rect.top + fraction * rect.height - (viewport.top + 64);
    }
  }
  const updateProgress = () => {
    const r = getRatio();
    $('#rp').style.width = (r * 100).toFixed(1) + '%';
    $('#lbl').textContent = `第${no}話 ${idx + 1}/${novel.chapters.length}　${Math.round(r * 100)}%`;
  };
  let ready = false, disposed = false, lastPosition = null;
  const savePosition = () => {
    if (!ready || disposed) return;
    lastPosition = capturePosition();
    saveBookmark(slug, no, lastPosition.ratio, lastPosition.anchor);
  };
  const persist = debounce(savePosition, 400);
  rs.addEventListener('scroll', () => { if (!ready || disposed) return; lastPosition = capturePosition(); updateProgress(); persist(); hideChrome(); }, { passive: true });
  const onPageHide = () => { persist.cancel(); savePosition(); };
  const onVisibility = () => { if (document.hidden) onPageHide(); };
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibility);

  // 縦書き時はホイールを横スクロールに
  rs.addEventListener('wheel', (e) => {
    if (!prefs.vertical || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    rs.scrollLeft -= e.deltaY * (e.deltaMode === 1 ? 32 : 1);
  }, { passive: false });

  // --- UI の自動非表示 ---
  const dock = $('#dock'), topbar = $('#topbar');
  const initialChromeUntil = performance.now() + 350;
  let hideT;
  function showChrome() {
    dock.classList.remove('away'); topbar.classList.remove('away');
    clearTimeout(hideT);
    hideT = setTimeout(() => { if (!$('.panel.open')) { dock.classList.add('away'); topbar.classList.add('away'); } }, 2600);
  }
  function hideChrome() {
    if (performance.now() < initialChromeUntil) return;
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
    if (k === 'toc') {
      mountToc($('#tocBody'), novel, { compact: true, current: no });
      requestAnimationFrame(() => $('.toc [aria-current]', panels.toc)?.scrollIntoView({ block: 'center' }));
    }
    if (k === 'prefs') renderPrefs();
    showChrome();
  }
  const closePanels = () => { Object.values(panels).forEach((p) => p.classList.remove('open')); $('#scrim').classList.remove('on'); };
  $('#scrim').onclick = closePanels;
  $$('[data-close]').forEach((b) => b.onclick = closePanels);
  $('#tocBody').addEventListener('click', (e) => { if (e.target.closest('a')) pendingJump = { top: true }; });

  const go = (c) => { if (c) { pendingJump = { top: true }; goTo(`/n/${slug}/c/${c.no}`); } };
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
      const position = capturePosition();
      prefs[key] = typeof DEFAULTS[key] === 'boolean' ? b.dataset.v === 'true' : b.dataset.v;
      savePrefs(); applyPrefs(); renderPrefs();
      restorePosition(position); updateProgress(); savePosition();
    });
    $$('#prefsBody input[type=range]').forEach((inp) => inp.oninput = () => {
      const position = capturePosition();
      prefs[inp.dataset.key] = parseFloat(inp.value);
      inp.nextElementSibling.textContent = inp.value + ({ fs: 'px', measure: '字', vlen: '字' }[inp.dataset.key] || '');
      savePrefs(); applyPrefs();
      restorePosition(position); updateProgress(); savePosition();
    });
    $('#resetPrefs').onclick = () => { const position = capturePosition(); Object.assign(prefs, DEFAULTS); savePrefs(); applyPrefs(); renderPrefs(); restorePosition(position); updateProgress(); savePosition(); };
  }

  // --- キーボード ---
  const onKey = (e) => {
    // Esc はボタンにフォーカスが残っていても閉じる（変換の取り消しは除く）
    if (e.key === 'Escape' && !e.isComposing) return closePanels();
    if (e.target.matches('input, textarea, select, button, a') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 't' || k === 'T') return openPanel('toc');
    if (k === 's' || k === 'S') return openPanel('prefs');
    if ($('.panel.open')) return;
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
  const previous = validPosition(store.get('positions', {})[slug]?.[no]) || validPosition(bookmarks()[slug]);
  const initialPosition = jump?.top ? { no, ratio: 0 } : jump || (previous?.no === no ? previous : { no, ratio: 0 });
  requestAnimationFrame(() => {
    if (disposed) return;
    restorePosition(initialPosition);
    ready = true;
    savePosition();
    updateProgress();
    showChrome();
  });

  // Webフォント・挿絵・画面回転による再レイアウトでも最後の読書位置を維持する。
  const reflow = () => { if (!ready || disposed) return; restorePosition(lastPosition); updateProgress(); };
  const observer = new ResizeObserver(reflow);
  observer.observe(page);
  window.addEventListener('resize', reflow);
  document.fonts?.ready.then(reflow);

  cleanup = () => {
    persist.cancel(); savePosition(); disposed = true;
    observer.disconnect();
    window.removeEventListener('resize', reflow);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('mousemove', onMove);
    clearTimeout(hideT);
  };
}

site().then((s) => {
  siteTitle = s.title || '書架';
  $('#siteTitle').textContent = siteTitle;
}).catch(() => toast('作品の一覧を読み込めませんでした')).finally(route);
