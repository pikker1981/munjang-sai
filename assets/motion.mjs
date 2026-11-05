// A non-secret, device-local choice shared by the site's decorative loops.
const preferenceKey = 'sbs-motion-paused-v1';
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let userPaused = false;
try { userPaused = localStorage.getItem(preferenceKey) === '1'; } catch {}
const panels = new WeakMap();
const activePanels = new Set();
const controls = new Set();

// The root is shared even when this helper is included in more than one classic bundle.
export const isMotionPaused = () => reduced.matches || root.dataset.motionPaused === 'true';

export function cancelPanelAnimation(element) {
  const animation = panels.get(element);
  if (animation) { animation.cancel(); panels.delete(element); activePanels.delete(animation); }
}

export function animatePanel(element, {duration = 170, distance = 5} = {}) {
  if (!element) return null;
  cancelPanelAnimation(element);
  if (isMotionPaused() || element.hidden || element.closest('[hidden], [inert]') || typeof element.animate !== 'function') return null;
  const durationMs = Math.max(0, Math.min(220, Number(duration) || 0));
  if (!durationMs) return null;
  const shift = Math.max(0, Math.min(5, Number(distance) || 0));
  const transform = getComputedStyle(element).transform;
  const restingTransform = transform === 'none' ? 'translateY(0)' : transform;
  const animation = element.animate([
    {opacity: 0, transform: `translateY(${shift}px) ${transform === 'none' ? '' : transform}`.trim()},
    {opacity: 1, transform: restingTransform}
  ], {duration: durationMs, easing: 'cubic-bezier(.2,.7,.2,1)'});
  panels.set(element, animation);
  activePanels.add(animation);
  const clear = () => {
    if (panels.get(element) === animation) panels.delete(element);
    activePanels.delete(animation);
  };
  animation.finished.then(clear, clear);
  return animation;
}

export const revealPanel = animatePanel;

function updateControls() {
  const paused = userPaused || reduced.matches;
  root.dataset.motionPaused = String(paused);
  if (paused) {
    for (const animation of activePanels) animation.cancel();
    activePanels.clear();
  }
  for (const button of controls) {
    button.disabled = reduced.matches;
    button.setAttribute('aria-pressed', String(paused));
    button.querySelector('[data-motion-label]').textContent = reduced.matches ? '동작 줄이기 적용 중' : paused ? '자동 움직임 재생' : '자동 움직임 정지';
    button.querySelector('[data-motion-pause]').toggleAttribute('hidden', paused);
    button.querySelector('[data-motion-play]').toggleAttribute('hidden', !paused);
  }
  document.dispatchEvent(new CustomEvent('sbs:motionchange', {detail: {paused, userPaused, reducedMotion: reduced.matches}}));
}

function setPaused(value) {
  userPaused = Boolean(value);
  try { if (userPaused) localStorage.setItem(preferenceKey, '1'); else localStorage.removeItem(preferenceKey); } catch {}
  updateControls();
}

export const setMotionPaused = value => setPaused(value);

export function initMotionControl() {
  const hero = document.querySelector('.home-page .hero');
  if (!hero || hero.querySelector('[data-motion-toggle]')) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'motion-control';
  const button = document.createElement('button');
  button.className = 'motion-toggle';
  button.type = 'button';
  button.dataset.motionToggle = '';
  button.innerHTML = '<svg data-motion-pause viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10"/></svg><svg data-motion-play viewBox="0 0 16 16" aria-hidden="true" hidden><path d="m5 3 7 5-7 5Z"/></svg><span data-motion-label></span>';
  button.addEventListener('click', () => setPaused(!userPaused));
  controls.add(button);
  wrapper.append(button);
  hero.append(wrapper);
  if ('IntersectionObserver' in globalThis) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.dataset.motionOffscreen = String(!entry.isIntersecting);
    });
    document.querySelectorAll('.home-page .hero, .home-page .sendoff-stage').forEach(element => observer.observe(element));
  }
  updateControls();
}

function updateVisibility() { root.dataset.motionPageHidden = String(document.hidden); }
reduced.addEventListener('change', updateControls);
document.addEventListener('visibilitychange', updateVisibility);
document.addEventListener('sbs:motionchange', event => {
  userPaused = Boolean(event.detail?.userPaused);
  if (event.detail?.paused) {
    for (const animation of activePanels) animation.cancel();
    activePanels.clear();
  }
});
addEventListener('storage', event => {
  if (event.key !== preferenceKey && event.key !== null) return;
  try { userPaused = localStorage.getItem(preferenceKey) === '1'; } catch {}
  updateControls();
});
// The book already has its approved selection sequence; do not append another root fade.
addEventListener('pageswap', event => {
  if (event.viewTransition && (isMotionPaused() || document.querySelector('.bookshelf.is-transitioning'))) event.viewTransition.skipTransition();
});
updateVisibility();
updateControls();
