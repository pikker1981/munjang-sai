const motion = matchMedia('(prefers-reduced-motion: reduce)');
const film = document.querySelector('.how-film');
const start = film.querySelector('.how-film-start');
const poster = film.querySelector('.how-poster');
const story = film.querySelector('.how-story');
const controls = film.querySelector('.how-film-controls');
const toggle = film.querySelector('.how-film-toggle');
const progress = film.querySelector('.how-film-progress');
const clock = film.querySelector('.how-film-time');
const status = film.querySelector('.how-film-status');
const titles = ["책장에서 책을 골라요.","담당 범위를 확인해요.","자료를 읽고 정리해요.","모임 정보를 함께 확인해요.","다음 책을 함께 정해요."];
const captions = ["책장에서 선택한 책의 독서 가이드로 이어져요.","이름을 선택하면 한 사람의 정리가 보여요.","장별 자료와 생각을 함께 준비해요.","확정한 일정과 담당을 공통 기록에서 확인해요.","책과 담당을 정하고 공개 저장해요."];
let playing = false, elapsed = 0, frame = 0, last = 0, chapter = -1;
function draw() {
  const next = Math.min(4, Math.floor(elapsed / 4));
  if (next !== chapter) {
    chapter = next;
    film.querySelector('.how-story-kicker').textContent = `0${chapter + 1} / 05 — OUR READING STORY`;
    film.querySelector('.how-story-title').textContent = titles[chapter];
    film.querySelector('.how-story-caption').textContent = captions[chapter];
    film.querySelectorAll('.how-story-art img').forEach((img, i) => img.classList.toggle('is-active', i === [0, 0, 1, 2, 2][chapter]));
    status.textContent = `${chapter + 1}단계. ${titles[chapter]} ${captions[chapter]}`;
  }
  progress.value = String(elapsed);
  progress.setAttribute('aria-valuetext', `${Math.floor(elapsed)}초 / 20초`);
  clock.textContent = `0:${String(Math.floor(elapsed)).padStart(2, '0')} / 0:20`;
  toggle.textContent = playing ? '일시정지' : elapsed >= 20 ? '다시 재생' : '재생';
  toggle.setAttribute('aria-label', `모임 소개 애니메이션 ${toggle.textContent}`);
  story.classList.toggle('is-playing', playing && !motion.matches);
}
function stop() { playing = false; cancelAnimationFrame(frame); draw(); }
function tick(now) {
  if (!playing) return;
  elapsed = Math.min(20, elapsed + (now - last) / 1000);
  last = now;
  if (elapsed >= 20) { stop(); status.textContent = '소개가 끝났어요. 처음부터 다시 보거나 모임을 둘러보세요.'; return; }
  draw();
  frame = requestAnimationFrame(tick);
}
function play() {
  if (elapsed >= 20) { elapsed = 0; chapter = -1; }
  playing = true; last = performance.now(); draw();
  cancelAnimationFrame(frame); frame = requestAnimationFrame(tick);
}
start.addEventListener('click', () => {
  poster.hidden = true; story.hidden = false; controls.hidden = false;
  elapsed = 0; chapter = -1; draw();
  if (!motion.matches) play();
  toggle.focus();
});
toggle.addEventListener('click', () => playing ? stop() : play());
progress.addEventListener('input', () => { elapsed = Number(progress.value); last = performance.now(); if (elapsed >= 20) stop(); else draw(); });
film.querySelector('.how-film-replay').addEventListener('click', () => { elapsed = 0; chapter = -1; motion.matches ? stop() : play(); });
film.querySelector('.how-film-close').addEventListener('click', () => { stop(); elapsed = 0; chapter = -1; poster.hidden = false; story.hidden = true; controls.hidden = true; status.textContent = ''; start.focus(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
motion.addEventListener('change', () => { if (motion.matches) stop(); });
const cards = [...document.querySelectorAll('.how-step')];
const links = [...document.querySelectorAll('.how-rail a')];
if ('IntersectionObserver' in window) {
  if (!motion.matches) document.documentElement.classList.add('how-motion');
  const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-live'); reveal.unobserve(entry.target);
  }), {threshold: .12});
  cards.forEach(card => { card.querySelectorAll('.how-layer').forEach((layer, i) => layer.style.setProperty('--layer', i)); reveal.observe(card); });
}
let scrollPending = false;
function updateRail() {
  scrollPending = false;
  const marker = innerHeight * .4;
  let active = 0;
  cards.forEach((card, i) => { if (card.getBoundingClientRect().top < marker) active = i; });
  links.forEach((link, i) => { if (i === active) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current'); });
}
addEventListener('scroll', () => { if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateRail); } }, {passive:true});
addEventListener('resize', updateRail);
updateRail();
