// ローカルと公開サイトの読書画面で共用する。ルートを離れるときに戻り値で解除する。
export function bindReaderKeys({ document, rs, getVertical, getRatio, hasOpenPanel, next, prev, openPanel, closePanels, toggleCheck, openListen }) {
  const onKey = (e) => {
    if (e.isComposing) return;
    if (e.key === 'Escape') return closePanels();
    if (e.target.closest('input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"])') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 't' || k === 'T') return openPanel('toc');
    if (k === 's' || k === 'S') return openPanel('prefs');
    if ((k === 'c' || k === 'C') && toggleCheck) return toggleCheck();
    if ((k === 'l' || k === 'L') && openListen) return openListen();
    if (hasOpenPanel()) return;
    if (k === 'n') return next();
    if (k === 'p') return prev();
    if (getVertical()) {
      const stepPage = (dir) => {
        const ratio = getRatio();
        if (dir > 0 && ratio >= 0.999) return next();
        if (dir < 0 && ratio <= 0.001) return prev();
        rs.scrollBy({ left: -dir * rs.clientWidth * 0.88, behavior: 'smooth' });
      };
      if (k === 'ArrowLeft' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) { e.preventDefault(); stepPage(1); }
      else if (k === 'ArrowRight' || k === 'PageUp' || (k === ' ' && e.shiftKey)) { e.preventDefault(); stepPage(-1); }
      else if (k === 'ArrowDown') { e.preventDefault(); rs.scrollBy({ left: -120 }); }
      else if (k === 'ArrowUp') { e.preventDefault(); rs.scrollBy({ left: 120 }); }
    } else {
      if (k === 'ArrowRight') next();
      else if (k === 'ArrowLeft') prev();
      else if (k === ' ' || k === 'PageDown' || k === 'PageUp' || k === 'ArrowDown' || k === 'ArrowUp') {
        if (document.activeElement !== rs) rs.focus({ preventScroll: true });
      }
    }
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
