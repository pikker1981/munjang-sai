const guide = document.querySelector('#chapter-guide');
import './reader-underlines.mjs';
if (guide) {
  const panels = [...guide.querySelectorAll('.chapter-panel')];
  const tools = guide.querySelector('.chapter-tools');
  tools.hidden = false;
  tools.addEventListener('click', event => {
    const button = event.target.closest('[data-chapters-action]');
    if (!button) return;
    const expand = button.dataset.chaptersAction === 'expand';
    guide.querySelectorAll('details').forEach(panel => { panel.open = expand; });
    tools.querySelector('[data-chapters-status]').textContent = expand ? '일곱 장을 모두 펼쳤어요.' : '일곱 장을 모두 접었어요.';
  });
  function revealHash(scroll = true) {
    if (!location.hash) return;
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target || !guide.contains(target)) return;
    let ancestor = target;
    while (ancestor && ancestor !== guide) {
      if (ancestor.tagName === 'DETAILS') ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    if (scroll) requestAnimationFrame(() => target.scrollIntoView({block:'start', behavior:'instant'}));
  }
  guide.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target?.matches('.chapter-panel')) target.open = true;
    if (location.hash === link.getAttribute('href')) revealHash();
  });
  // When a panel is closed programmatically, keep focus on its visible summary.
  panels.forEach(panel => panel.addEventListener('toggle', () => {
    const active = document.activeElement;
    if (!panel.open && panel.contains(active) && active !== panel.querySelector(':scope > summary')) panel.querySelector(':scope > summary').focus({preventScroll:true});
  }));
  window.addEventListener('hashchange', () => revealHash());
  revealHash();
}
