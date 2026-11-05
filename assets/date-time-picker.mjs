import {
  addCalendarDays, addCalendarMonths, calendarCells, formatDateLabel,
  formatDateValue, formatTimeLabel, formatTimeValue, fromTwelveHour,
  parseDateValue, parseTimeValue, seoulToday, toTwelveHour, weekDay,
} from './date-time-model.mjs';

const controllers = new WeakMap();
let activeSession = null;
let nextId = 0;
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const fieldSelector = 'input#study-date[type="date"][name="date"], input#study-time[type="time"][name="time"]';
const noop = () => {};

function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(doc, className, text, label) {
  const node = element(doc, 'button', className, text);
  node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  return node;
}

function icon(doc, kind) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', kind === 'date'
    ? 'M7 3v4m10-4v4M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z'
    : 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z');
  svg.append(path);
  return svg;
}

function baseView(dialog, kind, id, close) {
  const doc = dialog.ownerDocument;
  const layout = element(doc, 'div', 'sbs-dtp-layout');
  const header = element(doc, 'header', 'sbs-dtp-heading');
  const title = element(doc, 'h2', 'sbs-dtp-title', kind === 'date' ? '모임 날짜' : '모임 시간');
  title.id = `${id}-title`;
  const summary = element(doc, 'p', 'sbs-dtp-summary');
  summary.setAttribute('role', 'status');
  summary.setAttribute('aria-live', 'polite');
  summary.setAttribute('aria-atomic', 'true');
  header.append(title, summary);
  const content = element(doc, 'div', 'sbs-dtp-content');
  const footer = element(doc, 'footer', 'sbs-dtp-footer');
  const cancel = button(doc, 'sbs-dtp-button sbs-dtp-cancel', '취소');
  const confirm = button(doc, 'sbs-dtp-button sbs-dtp-confirm', '확인');
  cancel.addEventListener('click', () => close('cancel'));
  confirm.addEventListener('click', () => close('confirm'));
  footer.append(cancel, confirm);
  layout.append(header, content, footer);
  dialog.append(layout);
  dialog.setAttribute('aria-labelledby', title.id);
  return {doc, content, summary, confirm};
}

function dateView(dialog, input, id, close) {
  const {doc, content, summary, confirm} = baseView(dialog, 'date', id, close);
  const today = seoulToday();
  const minimum = parseDateValue(input.min);
  const maximum = parseDateValue(input.max);
  const allowed = date => {
    const value = formatDateValue(date);
    return Boolean(value) && (!minimum || value >= formatDateValue(minimum)) && (!maximum || value <= formatDateValue(maximum));
  };
  const clamp = date => minimum && formatDateValue(date) < formatDateValue(minimum) ? {...minimum}
    : maximum && formatDateValue(date) > formatDateValue(maximum) ? {...maximum} : date;
  let selected = parseDateValue(input.value);
  let focused = clamp(selected || today);
  let month = {...focused, day: 1};
  let cleared = false;

  const monthBar = element(doc, 'div', 'sbs-dtp-month-bar');
  const previous = button(doc, 'sbs-dtp-nav', '‹', '이전 달');
  const monthTitle = element(doc, 'h3', 'sbs-dtp-month');
  monthTitle.id = `${id}-month`;
  monthTitle.setAttribute('aria-live', 'polite');
  monthTitle.setAttribute('aria-atomic', 'true');
  const next = button(doc, 'sbs-dtp-nav', '›', '다음 달');
  monthBar.append(previous, monthTitle, next);

  const hint = element(doc, 'p', 'sbs-dtp-visually-hidden', '방향키로 날짜를 이동하고 Enter 키로 선택하세요. Page Up과 Page Down은 월을, Shift 키와 함께 누르면 연도를 이동해요.');
  hint.id = `${id}-hint`;
  const calendar = element(doc, 'table', 'sbs-dtp-calendar');
  calendar.setAttribute('role', 'grid');
  calendar.setAttribute('aria-labelledby', monthTitle.id);
  calendar.setAttribute('aria-describedby', hint.id);
  const head = doc.createElement('thead');
  const weekdayRow = doc.createElement('tr');
  weekdayRow.setAttribute('role', 'row');
  weekdays.forEach(day => {
    const cell = element(doc, 'th', '', day);
    cell.scope = 'col';
    cell.setAttribute('role', 'columnheader');
    cell.setAttribute('aria-label', `${day}요일`);
    weekdayRow.append(cell);
  });
  head.append(weekdayRow);
  const body = doc.createElement('tbody');
  calendar.append(head, body);
  const tools = element(doc, 'div', 'sbs-dtp-tools');
  const todayButton = button(doc, 'sbs-dtp-text-button', '오늘');
  todayButton.disabled = !allowed(today);
  const clear = button(doc, 'sbs-dtp-text-button', '선택 지우기');
  clear.hidden = input.required;
  tools.append(todayButton, clear);
  content.append(monthBar, hint, calendar, tools);

  function refreshSummary() {
    summary.textContent = selected ? formatDateLabel(selected, true) : cleared ? '날짜를 선택하지 않았어요' : '함께 만날 날짜를 골라주세요';
    confirm.disabled = selected ? !allowed(selected) : !cleared || input.required;
  }

  function renderCalendar(restoreFocus = false) {
    monthTitle.textContent = `${month.year}년 ${month.month}월`;
    previous.disabled = !addCalendarMonths(month, -1) || Boolean(minimum && formatDateValue(addCalendarMonths(month, -1)) < `${String(minimum.year).padStart(4, '0')}-${String(minimum.month).padStart(2, '0')}-01`);
    next.disabled = !addCalendarMonths(month, 1) || Boolean(maximum && formatDateValue(addCalendarMonths(month, 1)) > formatDateValue(maximum));
    const fragment = doc.createDocumentFragment();
    const cells = calendarCells(month);
    for (let rowIndex = 0; rowIndex < 6; rowIndex++) {
      const row = doc.createElement('tr');
      row.setAttribute('role', 'row');
      for (let column = 0; column < 7; column++) {
        const date = cells[rowIndex * 7 + column];
        const cell = doc.createElement('td');
        cell.setAttribute('role', 'gridcell');
        const value = formatDateValue(date);
        const isSelected = Boolean(value && selected && value === formatDateValue(selected));
        cell.setAttribute('aria-selected', String(isSelected));
        if (date) {
          const day = button(doc, 'sbs-dtp-day', String(date.day), `${formatDateLabel(date, true)}${value === formatDateValue(today) ? ', 오늘' : ''}`);
          day.dataset.date = value;
          day.dataset.outside = String(date.month !== month.month);
          day.tabIndex = value === formatDateValue(focused) ? 0 : -1;
          day.disabled = !allowed(date);
          if (value === formatDateValue(today)) day.setAttribute('aria-current', 'date');
          cell.append(day);
        }
        row.append(cell);
      }
      fragment.append(row);
    }
    body.replaceChildren(fragment);
    if (restoreFocus) body.querySelector('[tabindex="0"]')?.focus({preventScroll: true});
    refreshSummary();
  }

  function moveFocus(date, keepMonth = false) {
    if (!date) return;
    focused = clamp(date);
    if (!keepMonth) month = {...focused, day: 1};
    renderCalendar(true);
  }

  function select(date) {
    if (!date || !allowed(date)) return;
    selected = date;
    cleared = false;
    moveFocus(date);
  }

  previous.addEventListener('click', () => moveFocus(addCalendarMonths(focused, -1)));
  next.addEventListener('click', () => moveFocus(addCalendarMonths(focused, 1)));
  todayButton.addEventListener('click', () => select(today));
  clear.addEventListener('click', () => { selected = null; cleared = true; renderCalendar(); });
  calendar.addEventListener('click', event => {
    const day = event.target.closest('button[data-date]');
    if (day && !day.disabled) select(parseDateValue(day.dataset.date));
  });
  calendar.addEventListener('focusin', event => {
    const day = event.target.closest('button[data-date]');
    if (!day) return;
    focused = parseDateValue(day.dataset.date);
    body.querySelectorAll('button[data-date]').forEach(button => { button.tabIndex = button === day ? 0 : -1; });
  });
  calendar.addEventListener('keydown', event => {
    if (!event.target.closest('button[data-date]')) return;
    let target;
    switch (event.key) {
      case 'ArrowLeft': target = addCalendarDays(focused, -1); break;
      case 'ArrowRight': target = addCalendarDays(focused, 1); break;
      case 'ArrowUp': target = addCalendarDays(focused, -7); break;
      case 'ArrowDown': target = addCalendarDays(focused, 7); break;
      case 'Home': target = addCalendarDays(focused, -weekDay(focused)); break;
      case 'End': target = addCalendarDays(focused, 6 - weekDay(focused)); break;
      case 'PageUp': target = addCalendarMonths(focused, event.shiftKey ? -12 : -1); break;
      case 'PageDown': target = addCalendarMonths(focused, event.shiftKey ? 12 : 1); break;
      case 'Enter': case ' ': event.preventDefault(); select(focused); return;
      default: return;
    }
    event.preventDefault();
    moveFocus(target);
  });
  renderCalendar();
  return {
    focus() { body.querySelector('[tabindex="0"]')?.focus({preventScroll: true}); },
    value() { return confirm.disabled ? undefined : selected ? formatDateValue(selected) : ''; },
    cleanup: noop,
  };
}

function timeView(dialog, input, id, close) {
  const {doc, content, summary} = baseView(dialog, 'time', id, close);
  const time = toTwelveHour(parseTimeValue(input.value) || {hour: 19, minute: 0});
  let cleared = false;
  const periodGroup = element(doc, 'div', 'sbs-dtp-period');
  periodGroup.setAttribute('role', 'radiogroup');
  periodGroup.setAttribute('aria-label', '오전 또는 오후');
  const periodButtons = ['am', 'pm'].map(period => {
    const node = button(doc, 'sbs-dtp-period-button', period === 'am' ? '오전' : '오후');
    node.setAttribute('role', 'radio');
    node.dataset.period = period;
    node.addEventListener('click', () => { cleared = false; time.period = period; refresh(); });
    periodGroup.append(node);
    return node;
  });
  periodGroup.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    cleared = false;
    time.period = event.key === 'Home' ? 'am' : event.key === 'End' ? 'pm' : time.period === 'am' ? 'pm' : 'am';
    refresh();
    periodButtons.find(node => node.dataset.period === time.period).focus({preventScroll: true});
  });
  const columns = element(doc, 'div', 'sbs-dtp-time-columns');
  const hint = element(doc, 'p', 'sbs-dtp-time-hint', '목록을 스크롤하거나 방향키로 시와 분을 골라주세요.');
  hint.id = `${id}-hint`;
  const wheels = [];
  const tools = element(doc, 'div', 'sbs-dtp-tools');
  tools.hidden = input.required;
  const clear = button(doc, 'sbs-dtp-text-button', '선택 지우기');
  clear.addEventListener('click', () => {
    if (input.required) return;
    cleared = true;
    wheels.forEach(wheel => { wheel.cleanup(); wheel.scrollSelected(); });
    refresh();
  });
  tools.append(clear);

  function refresh() {
    summary.textContent = cleared ? '시간을 선택하지 않았어요' : formatTimeLabel(fromTwelveHour(time));
    periodButtons.forEach(node => {
      const selected = !cleared && node.dataset.period === time.period;
      node.setAttribute('aria-checked', String(selected));
      node.tabIndex = node.dataset.period === time.period ? 0 : -1;
    });
    wheels.forEach(wheel => wheel.refresh());
  }

  function makeWheel(key, label, values) {
    const column = element(doc, 'div', 'sbs-dtp-time-column');
    const heading = element(doc, 'p', 'sbs-dtp-time-label', label);
    heading.id = `${id}-${key}-label`;
    const wheel = element(doc, 'div', 'sbs-dtp-wheel');
    wheel.id = `${id}-${key}`;
    wheel.tabIndex = 0;
    wheel.setAttribute('role', 'listbox');
    wheel.setAttribute('aria-orientation', 'vertical');
    wheel.setAttribute('aria-labelledby', heading.id);
    wheel.setAttribute('aria-describedby', hint.id);
    const options = values.map(value => {
      const option = element(doc, 'div', 'sbs-dtp-time-option', key === 'minute' ? String(value).padStart(2, '0') : String(value));
      option.id = `${id}-${key}-${value}`;
      option.dataset.value = String(value);
      option.setAttribute('role', 'option');
      option.setAttribute('aria-label', `${value}${label}`);
      wheel.append(option);
      return option;
    });
    let scrollTimer = null;
    let numberBuffer = '';
    let lastNumberAt = 0;

    function scrollSelected() {
      const option = options[values.indexOf(time[key])];
      if (option) wheel.scrollTop = option.offsetTop - (wheel.clientHeight - option.offsetHeight) / 2;
    }

    function select(value, scroll = true) {
      cleared = false;
      time[key] = value;
      refresh();
      if (scroll) scrollSelected();
    }

    function settle() {
      if (scrollTimer !== null) clearTimeout(scrollTimer);
      scrollTimer = null;
      if (!wheel.isConnected || cleared) return;
      const middle = wheel.scrollTop + wheel.clientHeight / 2;
      const nearest = options.reduce((best, option) => Math.abs(option.offsetTop + option.offsetHeight / 2 - middle) < Math.abs(best.offsetTop + best.offsetHeight / 2 - middle) ? option : best);
      select(Number(nearest.dataset.value), false);
    }

    wheel.addEventListener('scroll', () => {
      // Queued alignment/inertia events must not undo an explicit clear.
      // A new pointer, wheel, click or keyboard action resumes selection.
      if (cleared) return;
      if (scrollTimer !== null) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(settle, 110);
    }, {passive: true});
    const resumeSelection = () => { if (cleared) { cleared = false; refresh(); } };
    wheel.addEventListener('pointerdown', resumeSelection, {passive: true});
    wheel.addEventListener('wheel', resumeSelection, {passive: true});
    wheel.addEventListener('click', event => {
      const option = event.target.closest('[role="option"]');
      if (!option) return;
      select(Number(option.dataset.value));
      wheel.focus({preventScroll: true});
    });
    wheel.addEventListener('keydown', event => {
      const index = values.indexOf(time[key]);
      let target;
      switch (event.key) {
        case 'ArrowUp': target = Math.max(0, index - 1); break;
        case 'ArrowDown': target = Math.min(values.length - 1, index + 1); break;
        case 'PageUp': target = Math.max(0, index - 5); break;
        case 'PageDown': target = Math.min(values.length - 1, index + 5); break;
        case 'Home': target = 0; break;
        case 'End': target = values.length - 1; break;
        default: {
          if (!/^\d$/.test(event.key)) return;
          const now = Date.now();
          numberBuffer = now - lastNumberAt < 650 ? numberBuffer + event.key : event.key;
          lastNumberAt = now;
          if (!values.includes(Number(numberBuffer))) numberBuffer = event.key;
          target = values.indexOf(Number(numberBuffer));
          if (target < 0) return;
        }
      }
      event.preventDefault();
      select(values[target]);
    });
    column.append(heading, wheel);
    columns.append(column);
    return {
      node: wheel,
      refresh() {
        options.forEach(option => option.setAttribute('aria-selected', String(!cleared && Number(option.dataset.value) === time[key])));
        wheel.setAttribute('aria-activedescendant', options[values.indexOf(time[key])].id);
      },
      scrollSelected,
      flush() { if (scrollTimer !== null) settle(); },
      cleanup() { if (scrollTimer !== null) clearTimeout(scrollTimer); scrollTimer = null; },
    };
  }

  wheels.push(makeWheel('hour', '시', Array.from({length: 12}, (_, index) => index + 1)));
  wheels.push(makeWheel('minute', '분', Array.from({length: 60}, (_, index) => index)));
  content.append(periodGroup, columns, hint, tools);
  refresh();
  return {
    focus() { wheels.forEach(wheel => wheel.scrollSelected()); wheels[0].node.focus({preventScroll: true}); },
    value() {
      if (cleared) return input.required ? undefined : '';
      wheels.forEach(wheel => wheel.flush());
      return formatTimeValue(fromTwelveHour(time));
    },
    cleanup() { wheels.forEach(wheel => wheel.cleanup()); },
  };
}

function openPicker(controller) {
  const {input, trigger, kind} = controller;
  if (controller.disposed || !input.isConnected || !trigger.isConnected || input.disabled || input.readOnly) return;
  activeSession?.close('cancel');
  const doc = input.ownerDocument;
  const win = doc.defaultView;
  const abort = new win.AbortController();
  const dialog = element(doc, 'dialog', `sbs-dtp sbs-dtp-${kind}`);
  dialog.id = `sbs-dtp-${++nextId}`;
  dialog.setAttribute('aria-modal', 'true');
  const originalValue = input.value;
  let closed = false;
  let view;
  let observer;
  let pointerStartedOutside = false;
  const session = {controller, close, originalValue};

  function close(reason = 'cancel') {
    if (closed) return;
    const value = reason === 'confirm' ? view?.value() : undefined;
    if (reason === 'confirm' && value === undefined) return;
    const commit = reason === 'confirm' && value !== originalValue && input.isConnected && trigger.isConnected
      && !controller.disposed && !input.disabled && !input.readOnly && input.value === originalValue;
    closed = true;
    abort.abort();
    observer?.disconnect();
    view?.cleanup();
    if (dialog.open) dialog.close();
    dialog.remove();
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-controls');
    if (activeSession === session) activeSession = null;
    if (!['dispose', 'route'].includes(reason) && trigger.isConnected && !controller.disposed) trigger.focus({preventScroll: true});
    if (commit) {
      input.value = value;
      controller.sync();
      const EventType = win.InputEvent || win.Event;
      input.dispatchEvent(new EventType('input', {bubbles: true, composed: true}));
    }
  }

  function position(event) {
    if (closed || !dialog.open) return;
    if (event?.target instanceof win.Node && dialog.contains(event.target)) return;
    const viewport = win.visualViewport;
    const viewportWidth = Math.min(viewport?.width || win.innerWidth, doc.documentElement.clientWidth);
    dialog.style.setProperty('--sbs-picker-viewport-width', `${viewportWidth}px`);
    if (win.matchMedia('(max-width: 767px)').matches) {
      dialog.style.removeProperty('left');
      dialog.style.removeProperty('top');
      return;
    }
    const margin = 12;
    const edgeX = viewport?.offsetLeft || 0;
    const edgeY = viewport?.offsetTop || 0;
    const viewportHeight = viewport?.height || win.innerHeight;
    const anchor = trigger.getBoundingClientRect();
    const rect = dialog.getBoundingClientRect();
    const maximumX = Math.max(edgeX + margin, edgeX + viewportWidth - rect.width - margin);
    const maximumY = Math.max(edgeY + margin, edgeY + viewportHeight - rect.height - margin);
    const below = anchor.bottom + 8;
    const above = anchor.top - rect.height - 8;
    const top = below + rect.height <= edgeY + viewportHeight - margin ? below : above >= edgeY + margin ? above : maximumY;
    dialog.style.left = `${Math.min(Math.max(anchor.left, edgeX + margin), maximumX)}px`;
    dialog.style.top = `${Math.min(Math.max(top, edgeY + margin), maximumY)}px`;
  }

  function outside(event) {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }

  try {
    view = kind === 'date' ? dateView(dialog, input, dialog.id, close) : timeView(dialog, input, dialog.id, close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close('cancel'); }, {signal: abort.signal});
    dialog.addEventListener('close', () => close('cancel'), {signal: abort.signal});
    dialog.addEventListener('pointerdown', event => { pointerStartedOutside = event.target === dialog && outside(event); }, {signal: abort.signal});
    dialog.addEventListener('click', event => {
      if (pointerStartedOutside && event.target === dialog && outside(event)) close('cancel');
      pointerStartedOutside = false;
    }, {signal: abort.signal});
    win.addEventListener('hashchange', () => close('route'), {signal: abort.signal});
    win.addEventListener('resize', position, {signal: abort.signal});
    doc.addEventListener('scroll', position, {capture: true, passive: true, signal: abort.signal});
    win.visualViewport?.addEventListener('resize', position, {signal: abort.signal});
    win.visualViewport?.addEventListener('scroll', position, {signal: abort.signal});
    doc.body.append(dialog);
    activeSession = session;
    dialog.showModal();
    position();
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-controls', dialog.id);
    view.focus();
    observer = new win.MutationObserver(() => {
      if (!input.isConnected || !trigger.isConnected) controller.dispose();
    });
    observer.observe(doc.body, {childList: true, subtree: true});
  } catch {
    close('dispose');
    controller.dispose();
    if (input.isConnected) {
      input.focus({preventScroll: true});
      try { input.showPicker?.(); } catch { /* The native field remains usable. */ }
    }
  }
}

function makeController(input) {
  const doc = input.ownerDocument;
  const win = doc.defaultView;
  const kind = input.type;
  const abort = new win.AbortController();
  const originalHidden = input.hidden;
  const trigger = button(doc, 'sbs-dtp-trigger');
  trigger.dataset.sbsPickerTrigger = kind;
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  const text = element(doc, 'span', 'sbs-dtp-trigger-value');
  trigger.append(text, icon(doc, kind));
  const controller = {input, trigger, kind, disposed: false, sync, dispose};

  function sync() {
    const label = kind === 'date' ? formatDateLabel(parseDateValue(input.value)) : formatTimeLabel(parseTimeValue(input.value));
    text.textContent = label || (kind === 'date' ? '날짜 선택' : '시간 선택');
    trigger.dataset.empty = String(!label);
    trigger.disabled = input.disabled || input.readOnly;
    trigger.setAttribute('aria-label', `${kind === 'date' ? '모임 날짜' : '모임 시간'} 선택${label ? `, ${label}` : ''}`);
    for (const name of ['aria-describedby', 'aria-invalid']) {
      if (input.hasAttribute(name)) trigger.setAttribute(name, input.getAttribute(name));
      else trigger.removeAttribute(name);
    }
    if (activeSession?.controller === controller && (input.value !== activeSession.originalValue || trigger.disabled)) activeSession.close('cancel');
  }

  function dispose() {
    if (controller.disposed) return;
    controller.disposed = true;
    if (activeSession?.controller === controller) activeSession.close('dispose');
    abort.abort();
    input.hidden = originalHidden;
    trigger.remove();
    if (controllers.get(input) === controller) controllers.delete(input);
  }

  try {
    trigger.addEventListener('click', () => openPicker(controller), {signal: abort.signal});
    input.addEventListener('input', sync, {signal: abort.signal});
    input.addEventListener('change', sync, {signal: abort.signal});
    input.addEventListener('invalid', event => {
      event.preventDefault();
      trigger.setAttribute('aria-invalid', 'true');
      trigger.focus({preventScroll: true});
    }, {signal: abort.signal});
    input.form?.addEventListener('reset', () => queueMicrotask(() => {
      if (controller.disposed) return;
      if (activeSession?.controller === controller) activeSession.close('cancel');
      sync();
    }), {signal: abort.signal});
    for (const label of input.labels || []) label.addEventListener('click', event => {
      if (!trigger.isConnected || trigger.disabled) return;
      event.preventDefault();
      trigger.focus({preventScroll: true});
    }, {signal: abort.signal});
    sync();
    input.after(trigger);
    // Hiding is the last step: any initialization failure leaves the original
    // date/time input visible, named, and usable by the existing form code.
    input.hidden = true;
    controllers.set(input, controller);
    return controller;
  } catch {
    dispose();
    return null;
  }
}

/** Enhance only the editor's native date/time fields. Safe to call each render.
 * The returned cleanup restores those inputs and dismisses an open draft.
 */
export function enhanceDateTimeFields(root) {
  if (!root?.querySelectorAll) return noop;
  const doc = root.ownerDocument || root;
  if (!doc.defaultView?.HTMLDialogElement?.prototype.showModal || !doc.body) return noop;
  const fields = [...root.querySelectorAll(fieldSelector)];
  if (root.matches?.(fieldSelector)) fields.unshift(root);
  const enhanced = [];
  fields.forEach(input => {
    let controller = controllers.get(input);
    if (controller) controller.sync();
    else if (!input.hidden && input.isConnected) controller = makeController(input);
    if (controller) enhanced.push(controller);
  });
  return () => enhanced.forEach(controller => controller.dispose());
}
