// ローカル・公開サイトで共用する、読者向けの作品情報と閲覧確認。
import { escapeHtml as esc } from './render.js';

const CREDIT_LABELS = { settings: '設定', plot: 'プロット', writing: '本編', revision: '修正', review: '校閲', cover: '表紙', illustration: '挿絵', character: '人物画像' };

export function creditLines(n, { compact = false } = {}) {
  const credits = n.credits || {};
  const roles = compact ? ['plot', 'writing', 'cover', 'illustration'] : Object.keys(CREDIT_LABELS);
  const lines = roles.filter((role) => Array.isArray(credits[role]) && credits[role].length)
    .map((role) => `${CREDIT_LABELS[role]}：${credits[role].join('・')}`);
  const author = String(n.author || '').trim();
  if (author && !['Claude', 'Codex'].includes(author)) lines.unshift(`作者：${author}`);
  else if (author && !Object.values(credits).some((names) => Array.isArray(names) && names.length)) lines.push(`制作（工程不明）：${author}`);
  return lines;
}

export function creditsHtml(n, options = {}) {
  const lines = creditLines(n, options);
  return lines.length ? `<div class="credits${options.compact ? ' compact' : ''}" aria-label="制作担当">${lines.map((line) => `<span>${esc(line)}</span>`).join('')}</div>` : '';
}

// 表紙上には本編担当を短く表示し、詳細は表紙の外で工程別に示す。
export function coverCredit(n) {
  if (n.author && !['Claude', 'Codex'].includes(n.author)) return `作者：${n.author}`;
  return n.credits?.writing?.length ? `本編：${n.credits.writing.join('・')}` : '';
}

export function tagsOf(value) {
  const tags = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,、\n\r]+/) : [];
  return [...new Set(tags.filter((t) => typeof t === 'string').map((t) => t.trim()).filter(Boolean))];
}

export const isAdult = (n) => n.adultContent === true || n.adultContent === 'on';

export function readerMetadata(patch) {
  const result = {};
  if ('tags' in patch) {
    if (typeof patch.tags !== 'string' && !(Array.isArray(patch.tags) && patch.tags.every((t) => typeof t === 'string'))) {
      throw new Error('タグは文字列か文字列の配列で指定してください');
    }
    result.tags = tagsOf(patch.tags);
    if (result.tags.length > 20 || result.tags.some((t) => [...t].length > 40)) throw new Error('タグは20個まで、1個40文字以内で指定してください');
  }
  if ('adultContent' in patch) {
    if (![true, false, 'on', 'off'].includes(patch.adultContent)) throw new Error('成人向けは on / off で指定してください');
    result.adultContent = isAdult(patch);
  }
  return result;
}

export function readingBadges(n) {
  return `<div class="reading-tags">${isAdult(n) ? '<span class="badge adult">R18・成人向け</span>' : ''}${tagsOf(n.tags).map((t) => `<span class="reading-tag">${esc(t)}</span>`).join('')}</div>`;
}

export const adultNotice = (n) => isAdult(n) ? '<p class="adult-notice">この作品は成人向け（R18）です。18歳未満の方は閲覧できません。</p>' : '';

export function tagFilterHtml(novels, selected = '') {
  const tags = [...new Set(novels.flatMap((n) => tagsOf(n.tags)))].sort((a, b) => a.localeCompare(b, 'ja'));
  return `<div class="tag-filter"><label>タグで絞り込む <select data-tag-filter><option value="">すべて</option>${tags.map((t) => `<option value="${esc(t)}"${t === selected ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label><span data-tag-count role="status"></span></div>`;
}

export function bindTagFilter(container, novels, onSelect = () => {}) {
  const select = container.querySelector('[data-tag-filter]');
  const apply = () => {
    const shown = new Set(novels.filter((n) => !select.value || tagsOf(n.tags).includes(select.value)).map((n) => n.slug));
    container.querySelectorAll('[data-book-slug]').forEach((el) => { el.hidden = !shown.has(el.dataset.bookSlug); });
    container.querySelector('[data-tag-count]').textContent = shown.size ? `${shown.size}作品` : '該当する作品はありません';
    onSelect(select.value);
  };
  select.onchange = apply;
  apply();
}

const confirmed = new Set();
function hasConfirmed(slug) {
  try { return confirmed.has(slug) || sessionStorage.getItem('shoka.adult.' + slug) === 'yes'; } catch { return confirmed.has(slug); }
}

// 本文と挿絵を取得する前に呼ぶ。直リンク・栞・話送りでも同じ入口を通す。
export function requireAdultConfirmation(container, n, proceed) {
  if (!isAdult(n) || hasConfirmed(n.slug)) return true;
  container.innerHTML = `<section class="wrap adult-gate" aria-labelledby="adult-title">
    <span class="badge adult">R18・成人向け</span><h1 id="adult-title" tabindex="-1">閲覧前の確認</h1>
    <h2>${esc(n.title)}</h2>${adultNotice(n)}<p>あなたは18歳以上ですか？</p>
    <div class="actions"><button class="btn primary" data-adult-confirm>18歳以上なので読む</button><a class="btn" href="#/">読むのをやめて書架へ戻る</a></div>
    <p class="muted">確認はこのタブを閉じるまで、作品ごとに記憶します。</p></section>`;
  container.querySelector('#adult-title').focus();
  container.querySelector('[data-adult-confirm]').onclick = () => {
    confirmed.add(n.slug);
    try { sessionStorage.setItem('shoka.adult.' + n.slug, 'yes'); } catch { /* 保存できない環境ではページ内だけ記憶 */ }
    proceed();
  };
  return false;
}
