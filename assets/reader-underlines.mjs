const root = document.querySelector('#chapter-guide');
if (root) {
  const key = 'munjang-sai-underlines-v1';
  const blocks = new Map([...root.querySelectorAll('[data-source-block]')]
    .filter(node => !node.querySelector('[data-source-block]'))
    .map(node => [node.dataset.sourceBlock, node]));
  let entries = [], selected = [], queued = false;
  const bar = document.createElement('div');
  bar.className = 'reader-selection-bar';
  bar.hidden = true;
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', '선택한 문장에 밑줄');
  const add = document.createElement('button');
  add.type = 'button'; add.textContent = '밑줄치기';
  const remove = document.createElement('button');
  remove.type = 'button'; remove.textContent = '밑줄 지우기';
  bar.append(add, remove); document.body.append(bar);
  const help = document.createElement('p');
  help.className = 'reader-underline-help';
  help.textContent = '문장을 드래그한 뒤 ‘밑줄치기’를 누르세요. 빨간 밑줄은 이 브라우저에 저장돼요.';
  const status = document.createElement('p');
  status.className = 'reader-underline-status';
  status.setAttribute('role', 'status');
  root.querySelector('.chapter-tools').after(help, status);

  function valid(entry) {
    const block = blocks.get(entry?.id);
    return block && Number.isInteger(entry.start) && Number.isInteger(entry.end)
      && entry.start >= 0 && entry.end > entry.start && entry.end <= block.textContent.length
      && typeof entry.quote === 'string' && block.textContent.slice(entry.start, entry.end) === entry.quote;
  }
  function combine(items) {
    const result = [];
    for (const [id, block] of blocks) {
      const ranges = items.filter(x => x.id === id).sort((a, b) => a.start - b.start);
      for (const range of ranges) {
        const last = result.at(-1);
        if (last?.id === id && range.start <= last.end) last.end = Math.max(last.end, range.end);
        else result.push({id, start:range.start, end:range.end});
      }
      for (const item of result.filter(x => x.id === id)) item.quote = block.textContent.slice(item.start, item.end);
    }
    return result;
  }
  function textNodes(block) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const nodes = []; let node;
    while ((node = walker.nextNode())) nodes.push(node);
    return nodes;
  }
  function paint() {
    root.querySelectorAll('[data-reader-underline]').forEach(span => {
      const parent = span.parentNode;
      span.replaceWith(...span.childNodes); parent.normalize();
    });
    for (const [id, block] of blocks) {
      const ranges = entries.filter(x => x.id === id);
      if (!ranges.length) continue;
      let offset = 0;
      for (const node of textNodes(block)) {
        const value = node.data, base = offset; offset += value.length;
        const spans = ranges.map(x => ({start:Math.max(0, x.start-base), end:Math.min(value.length, x.end-base)}))
          .filter(x => x.end > x.start);
        if (!spans.length) continue;
        const fragment = document.createDocumentFragment(); let cursor = 0;
        for (const span of spans) {
          fragment.append(document.createTextNode(value.slice(cursor, span.start)));
          const mark = document.createElement('span');
          mark.dataset.readerUnderline = ''; mark.className = 'reader-red-underline';
          mark.textContent = value.slice(span.start, span.end); fragment.append(mark);
          cursor = span.end;
        }
        fragment.append(document.createTextNode(value.slice(cursor))); node.replaceWith(fragment);
      }
    }
  }
  try {
    const stored = JSON.parse(localStorage.getItem(key) || 'null');
    if (stored?.version === 1 && Array.isArray(stored.entries)) {
      entries = combine(stored.entries.slice(0, 2000).filter(valid)); paint();
      if (entries.length) status.textContent = '저장된 빨간 밑줄을 불러왔어요.';
    }
  } catch { status.textContent = '저장된 밑줄을 불러오지 못했어요. 문장을 선택해 다시 밑줄을 그을 수 있어요.'; }
  function hide() { bar.hidden = true; selected = []; }
  function capture() {
    queued = false;
    if (bar.contains(document.activeElement)) return;
    const selection = document.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed || !selection.toString().trim()) { hide(); return; }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) { hide(); return; }
    const parts = [];
    for (const [id, block] of blocks) {
      let offset = 0, start = null, end = null;
      for (const node of textNodes(block)) {
        const length = node.length;
        if (range.intersectsNode(node)) {
          const from = node === range.startContainer ? range.startOffset : 0;
          const through = node === range.endContainer ? range.endOffset : length;
          if (through > from) { if (start === null) start = offset + from; end = offset + through; }
        }
        offset += length;
      }
      if (start !== null && end > start) parts.push({id, start, end, quote:block.textContent.slice(start, end)});
    }
    if (!parts.length) { hide(); return; }
    selected = parts;
    remove.disabled = !parts.some(part => entries.some(x => x.id === part.id && x.start < part.end && x.end > part.start));
    const rect = range.getBoundingClientRect();
    bar.hidden = false;
    const width = bar.offsetWidth, height = bar.offsetHeight;
    bar.style.left = `${Math.max(8, Math.min(innerWidth-width-8, rect.left + rect.width/2-width/2))}px`;
    bar.style.top = `${Math.max(72, Math.min(innerHeight-height-8, rect.top-height-10))}px`;
  }
  document.addEventListener('selectionchange', () => {
    if (!queued) { queued = true; requestAnimationFrame(capture); }
  });
  // Keep the native text selection when a pointer presses an annotation button.
  bar.addEventListener('pointerdown', event => event.preventDefault());
  function commit(erase) {
    if (!selected.length) return;
    let next = [...entries];
    if (!erase) next.push(...selected);
    else for (const part of selected) next = next.flatMap(item => {
      if (item.id !== part.id || item.end <= part.start || item.start >= part.end) return [item];
      const pieces = [];
      if (item.start < part.start) pieces.push({...item, end:part.start});
      if (item.end > part.end) pieces.push({...item, start:part.end});
      return pieces;
    });
    next = combine(next);
    if (next.length > 2000) { status.textContent = '밑줄이 많아 저장하지 못했어요. 사용하지 않는 밑줄을 먼저 지워주세요.'; hide(); return; }
    try { localStorage.setItem(key, JSON.stringify({version:1, entries:next})); }
    catch { status.textContent = '밑줄을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.'; hide(); return; }
    const keyboard = bar.contains(document.activeElement);
    const focusBlock = blocks.get(selected[0].id);
    entries = next; document.getSelection()?.removeAllRanges(); paint(); hide();
    status.textContent = erase ? '선택한 부분의 밑줄을 지웠어요.' : '선택한 문장에 빨간 밑줄을 저장했어요.';
    if (keyboard && focusBlock) { focusBlock.setAttribute('tabindex', '-1'); focusBlock.focus({preventScroll:true}); }
  }
  add.addEventListener('click', () => commit(false));
  remove.addEventListener('click', () => commit(true));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !bar.hidden) { hide(); document.getSelection()?.removeAllRanges(); } });
  addEventListener('scroll', () => { if (!bar.contains(document.activeElement)) hide(); }, {passive:true});
  addEventListener('resize', hide);
}
