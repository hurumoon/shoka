// 公開サイト専用。DOM に依存しない探索条件と読書位置の互換処理。
export const normalize = (s) => String(s || '').normalize('NFKC').toLocaleLowerCase('ja').trim();
export const SIZES = { short: '短編（2万字未満）', medium: '中編（2万〜8万字未満）', long: '長編（8万字以上）' };
export const sizeOf = (n) => n.totalChars < 20000 ? 'short' : n.totalChars < 80000 ? 'medium' : 'long';
const searchText = (n) => normalize([n.title, n.subtitle, n.author, n.series, n.category, n.genre, ...(n.tags || []), n.synopsis].filter(Boolean).join(' '));
export function selectNovels(novels, { query = '', category = '', series = '', tags = [], status = '', size = '', sort = 'updated' } = {}) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const genreRank = new Map(categoryCounts(novels).map(([c], i) => [c, i]));
  const rankOf = (n) => genreRank.get(n.category) ?? genreRank.size;
  const compare = {
    title: (a, b) => a.title.localeCompare(b.title, 'ja', { numeric: true }),
    chars: (a, b) => b.totalChars - a.totalChars,
    short: (a, b) => a.totalChars - b.totalChars,
    genre: (a, b) => rankOf(a) - rankOf(b) || (b.updated || '').localeCompare(a.updated || ''),
  }[sort] || ((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  return novels.filter((n) => words.every((w) => searchText(n).includes(w))
    && (!series || n.series === series)
    && (!category || n.category === category) && tags.every((t) => (n.tags || []).includes(t))
    && (!status || n.status === status) && (!size || sizeOf(n) === size))
    .sort((a, b) => compare(a, b) || a.title.localeCompare(b.title, 'ja') || a.slug.localeCompare(b.slug));
}
export const isFiltered = (f) => !!(f.query?.trim() || f.category || f.series || f.status || f.size || f.tags?.length);

// 作品数の多い順。絞り込みの選択肢に使う
function countBy(values) {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
}
export const categoryCounts = (novels) => countBy(novels.map((n) => n.category));
// 1作品にしかないタグは絞り込みの選択肢に出さない（作品には表示し、検索でも見つかる）。選択中のものは解除できるよう残す
export const filterTags = (novels, selected = []) => countBy(novels.flatMap((n) => n.tags || []))
  .filter(([tag, count]) => count >= 2 || selected.includes(tag));

// ---------- 注目の作品 ----------
const isAdult = (n) => n.adultContent === true || n.adultContent === 'on';
const seriesOrderOf = (n) => Number(n.seriesOrder) || Infinity;
const byUpdated = (a, b) => (b.updated || '').localeCompare(a.updated || '') || a.slug.localeCompare(b.slug);
// 完結・一般向けで、シリーズの途中から始まらないもの。題名入りの表紙、表紙あり、なしの順に優先し、同順位は更新が新しいもの
export function featuredNovel(novels) {
  const rank = (n) => (n.cover ? (n.cover.withTitle ? 0 : 1) : 2);
  return novels.filter((n) => !isAdult(n) && n.status === 'complete' && (!n.series || seriesOrderOf(n) === 1))
    .sort((a, b) => rank(a) - rank(b) || byUpdated(a, b))[0] || null;
}

// ---------- 話の題 ----------
const KANJI_DIGITS = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const KANJI_UNITS = { 十: 10, 百: 100, 千: 1000 };
function kanjiNumber(s) {
  if (![...s].some((c) => KANJI_UNITS[c])) return Number([...s].map((c) => KANJI_DIGITS[c]).join(''));
  let total = 0, digit = 0;
  for (const c of s) {
    if (KANJI_UNITS[c]) { total += (digit || 1) * KANJI_UNITS[c]; digit = 0; } else digit = KANJI_DIGITS[c];
  }
  return total + digit;
}
// 題の先頭の「第一話」は話数の表示と重なるので除く。話数と食い違う題は作者の表記としてそのまま出す
export function chapterSubtitle(c) {
  const title = String(c.title || '').trim();
  const m = title.match(/^第([0-9０-９]+|[〇零一二三四五六七八九十百千]+)話[\s:：・\-‐―—]*/);
  if (!m) return title;
  const no = /^[0-9０-９]/.test(m[1]) ? Number(m[1].normalize('NFKC')) : kanjiNumber(m[1]);
  return no === c.no ? title.slice(m[0].length) : title;
}
export const chapterLabel = (c) => `第${c.no}話${chapterSubtitle(c) ? ` ${chapterSubtitle(c)}` : ''}`;

export function validPosition(value) {
  if (!value || !Number.isInteger(value.no) || value.no < 1) return null;
  return { ...value, ratio: Math.max(0, Math.min(1, Number(value.ratio) || 0)) };
}
export const novelPath = (slug) => `works/${encodeURIComponent(slug)}/`;
