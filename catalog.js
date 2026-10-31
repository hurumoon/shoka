// 公開サイト専用。DOM に依存しない探索条件と読書位置の互換処理。
export const normalize = (s) => String(s || '').normalize('NFKC').toLocaleLowerCase('ja').trim();
export const SIZES = { short: '短編（2万字未満）', medium: '中編（2万〜8万字未満）', long: '長編（8万字以上）' };
export const sizeOf = (n) => n.totalChars < 20000 ? 'short' : n.totalChars < 80000 ? 'medium' : 'long';
export function selectNovels(novels, { query = '', genre = '', series = '', tags = [], status = '', size = '', sort = 'updated' } = {}) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return novels.filter((n) => words.every((w) => normalize(`${n.title} ${n.author || ''} ${n.series || ''}`).includes(w))
    && (!series || n.series === series)
    && (!genre || n.genre === genre) && tags.every((t) => (n.tags || []).includes(t))
    && (!status || n.status === status) && (!size || sizeOf(n) === size))
    .sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title, 'ja', { numeric: true })
      : sort === 'chars' ? b.totalChars - a.totalChars : (b.updated || '').localeCompare(a.updated || ''))
      || a.title.localeCompare(b.title, 'ja') || a.slug.localeCompare(b.slug));
}
export function validPosition(value) {
  if (!value || !Number.isInteger(value.no) || value.no < 1) return null;
  return { ...value, ratio: Math.max(0, Math.min(1, Number(value.ratio) || 0)) };
}
export const novelPath = (slug) => `works/${encodeURIComponent(slug)}/`;
