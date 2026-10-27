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
const titles = ['취향을 알려주세요.', '함께 읽을 모임을 골라요.', '책과 질문을 준비해요.', '첫 인사를 나눠요.', '다음 페이지도 함께해요.'];
const captions = ['좋아하는 이야기에서 출발해요.', '지금의 나에게 맞는 작은 테이블.', '한 문장과 작은 물음표 하나면 충분해요.', '다른 생각을 반갑게 맞이해요.', '우리의 대화는 다음 책으로 이어져요.'];
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
