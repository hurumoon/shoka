// 原稿テキスト → HTML 変換。ブラウザ（ビューア）と Node（書き出し）の両方から使う。DOM には依存しない。

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const KANJI = '一-龠々〆ヵヶ〇仝';

// ルビ・傍点・縦中横を含む一行分の本文を HTML にする
export function inlineToHtml(text, { tcy = true } = {}) {
  let s = escapeHtml(text);
  const LIT = '\u0000';
  s = s.replace(/[|｜]《/g, LIT); // |《 はルビ記号そのものを表示
  s = s.replace(/《《(.+?)》》/g, '<em class="bouten">$1</em>');
  s = s.replace(/[|｜]([^|｜《》]+?)《([^《》]+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
  s = s.replace(new RegExp(`([${KANJI}]+)《([^《》]+?)》`, 'g'), '<ruby>$1<rt>$2</rt></ruby>');
  s = s.replace(/\u0000/g, '《');
  if (tcy) {
    s = s.replace(/(^|[^0-9A-Za-z<\/="-])([0-9]{1,2})(?![0-9A-Za-z])/g, '$1<span class="tcy">$2</span>');
    s = s.replace(/[！？!?]{2}/g, (m) => `<span class="tcy">${m.replace(/！/g, '!').replace(/？/g, '?')}</span>`);
  }
  return s;
}

// 取り込んだ原稿の区切り線（「ーーーー」「—-------」「〜〜」など）も、本文は変えずに表示だけ場面転換にする
const SCENE_BREAK = /^\s*(?:[＊*◇◆☆★※■□○●]\s*){1,5}$|^\s*[-ー―—─]{3,}\s*$|^\s*〜{2,}\s*$/;
const DIALOGUE_START = /^[「『（(〈《【]/;

export function stripComments(text) {
  return String(text).replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''));
}

// 章ファイルを { title, lines } に分解。lines は元ファイルの行番号を保持する
export function parseChapter(raw) {
  const all = stripComments(raw).split('\n');
  let title = '';
  const lines = [];
  all.forEach((text, i) => {
    if (!title && /^#\s+/.test(text)) {
      title = text.replace(/^#\s+/, '').trim();
      return;
    }
    if (/^#{1,6}\s+/.test(text)) return;
    lines.push({ no: i + 1, text: text.replace(/^[ 　\t]+/, '').replace(/\s+$/, '') });
  });
  while (lines.length && !lines[0].text) lines.shift();
  while (lines.length && !lines[lines.length - 1].text) lines.pop();
  return { title, lines };
}

export function lineKind(text) {
  if (!text) return 'blank';
  if (SCENE_BREAK.test(text)) return 'break';
  if (DIALOGUE_START.test(text)) return 'dlg';
  return 'nar';
}

export function chapterBodyHtml(lines) {
  const out = [];
  let blanks = 0;
  for (const { no, text } of lines) {
    const kind = lineKind(text);
    if (kind === 'blank') {
      if (++blanks === 1) out.push('<p class="blank"></p>');
      continue;
    }
    blanks = 0;
    if (kind === 'break') out.push(`<p class="scene-break" data-line="${no}">◇</p>`);
    else out.push(`<p class="${kind}" data-line="${no}">${inlineToHtml(text)}</p>`);
  }
  return out.join('\n');
}

// 本文文字数（空白・見出し・コメント・ルビの読み・記法記号を除く）
export function countChars(raw) {
  const { lines } = parseChapter(raw);
  let s = lines.map((l) => l.text).join('');
  s = s.replace(/《《(.+?)》》/g, '$1').replace(/[|｜]《/g, '《').replace(/[|｜]([^|｜《》]+?)《[^《》]+?》/g, '$1');
  s = s.replace(new RegExp(`([${KANJI}]+)《[^《》]+?》`, 'g'), '$1');
  return s.replace(/\s/g, '').length;
}

// ---- 設定資料用のミニ Markdown ----

function mdInline(s) {
  const codes = [];
  const lits = [];
  let t = String(s).replace(/`([^`]+)`/g, (_, c) => `\u0001${codes.push(c) - 1}\u0001`);
  // バックスラッシュエスケープ（\* \# \| など）は記号そのものとして表示する
  t = t.replace(/\\([!-/:-@[-`{-~])/g, (_, c) => `\u0002${lits.push(c) - 1}\u0002`);
  t = inlineToHtml(t, { tcy: false });
  t = t
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return t
    .replace(/\u0001(\d+)\u0001/g, (_, i) => `<code>${escapeHtml(codes[i])}</code>`)
    .replace(/\u0002(\d+)\u0002/g, (_, i) => escapeHtml(lits[i]));
}

// ``` か ~~~ で始まるコードブロックの開始行。閉じる行は同じ記号で同じ長さ以上
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
const fenceCloser = (mark) => new RegExp(`^ {0,3}${mark[0] === '`' ? '`' : '~'}{${mark.length},}\\s*$`);

// コードブロックの外だけ <!-- --> を消す（中は原文のまま見せる）
function stripCommentsOutsideFences(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let run = [];
  const flush = () => { if (run.length) out.push(stripComments(run.join('\n'))); run = []; };
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].match(FENCE_OPEN);
    if (!f) { run.push(lines[i]); continue; }
    flush();
    const close = fenceCloser(f[1]);
    const block = [lines[i]];
    while (++i < lines.length) {
      block.push(lines[i]);
      if (close.test(lines[i])) break;
    }
    out.push(block.join('\n'));
  }
  flush();
  return out.join('\n');
}

export function markdownToHtml(md) {
  const lines = stripCommentsOutsideFences(md).split('\n');
  const out = [];
  let i = 0;
  const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  const cells = (l) => l.trim().replace(/^\||(?<!\\)\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = line.match(FENCE_OPEN);
    if (fence) {
      const close = fenceCloser(fence[1]);
      const buf = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) buf.push(lines[i++]);
      i++;
      // ```text は依頼の原文など、記号を解釈せずに折り返して見せる
      const cls = fence[2] === 'text' ? ' class="verbatim"' : '';
      out.push(`<pre${cls}><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${mdInline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      out.push('<div class="table-wrap"><table><thead><tr>' + head.map((c) => `<th>${mdInline(c)}</th>`).join('') +
        '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => `<td>${mdInline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${markdownToHtml(buf.join('\n'))}</blockquote>`);
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      // インデントでネストするリスト
      const stack = [];
      const html = [];
      while (i < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && stack.length))) {
        const l = lines[i];
        const m = l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) { html.push(' ' + mdInline(l.trim())); i++; continue; }
        const indent = m[1].replace(/\t/g, '  ').length;
        const tag = /\d/.test(m[2]) ? 'ol' : 'ul';
        while (stack.length && indent < stack[stack.length - 1].indent) html.push(`</li></${stack.pop().tag}>`);
        if (!stack.length || indent > stack[stack.length - 1].indent) {
          stack.push({ indent, tag });
          html.push(`<${tag}><li>`);
        } else {
          html.push('</li><li>');
        }
        let content = m[3];
        const cb = content.match(/^\[([ xX])\]\s*(.*)$/);
        if (cb) content = `<span class="check ${cb[1] === ' ' ? '' : 'on'}">${cb[1] === ' ' ? '☐' : '☑'}</span> ${mdInline(cb[2])}`;
        else content = mdInline(content);
        html.push(content);
        i++;
      }
      while (stack.length) html.push(`</li></${stack.pop().tag}>`);
      out.push(html.join(''));
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i]) && !FENCE_OPEN.test(lines[i]) && !isTableRow(lines[i])) {
      buf.push(mdInline(lines[i++].trim()));
    }
    if (buf.length) out.push(`<p>${buf.join('<br>')}</p>`);
    else i++;
  }
  return out.join('\n');
}

// 元にした本文・設定の版（サーバーの compareBasis の結果）。作った後に元が変わったものだけ目立たせる
export function basisHtml(list = []) {
  if (!list.length) return '';
  const stale = list.filter((b) => b.stale);
  if (!stale.length) {
    const all = list.map((b) => `${escapeHtml(b.label)} 第${b.now}版`).join('・');
    return list.length > 1 ? `<span class="ver" title="${all}">元の資料は作ったときのまま</span>` : `<span class="ver">${all}から</span>`;
  }
  return stale.map((b) => {
    const label = escapeHtml(b.label);
    if (b.missing) return `<span class="ver stale" title="作った後に元の資料がなくなりました">⚠ ${label}がなくなっています</span>`;
    return `<span class="ver stale" title="作った後に元の資料が直されています。作り直すかどうか確かめてください">⚠ ${label}が変わっています（${b.made ? `第${b.made}版で作成` : '作成後に更新'}・今は第${b.now}版）</span>`;
  }).join('');
}
