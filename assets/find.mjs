const panel = document.querySelector('#finder');
const left = document.querySelector('.finder-left');
const intro = panel.innerHTML;
const storageKey = 'munjang-sai-preferences-v1';
const defaults = {topic:'',book:'',pace:'',frequency:'',where:'',time:'',location:'',nickname:'',interest:'',source:'',consent:false};
let values = {...defaults}, step = 0, storageNote = '';
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
try {
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 1 || typeof saved.preferences !== 'object' || !saved.preferences) throw new Error('invalid preferences');
    for (const key of Object.keys(defaults)) {
      if (key !== 'consent' && typeof saved.preferences[key] === 'string') values[key] = saved.preferences[key].slice(0, key === 'interest' ? 500 : 100);
    }
    storageNote = '이 브라우저에 저장한 취향을 불러왔어요. 다시 살펴보고 바꿀 수 있어요.';
  }
} catch { storageNote = '저장된 취향을 불러올 수 없어 새로 시작해요. 지금도 모임을 찾아볼 수 있어요.'; }
function setRestoreNote() {
  const note = document.querySelector('#restore-note');
  if (note && storageNote) { note.textContent = storageNote; note.hidden = false; }
}
setRestoreNote();
const selectField = (name, title, options) => `<div class="finder-field"><label for="find-${name}">${title}</label><select id="find-${name}" name="${name}" required aria-describedby="error-${name}"><option value="">골라주세요</option>${options.map(([id,label])=>`<option value="${id}"${values[name] === id ? ' selected' : ''}>${label}</option>`).join('')}</select><p class="finder-error" id="error-${name}" hidden></p></div>`;
const optionsField = (name, title, options, required = true) => `<fieldset class="finder-field finder-fieldset"><legend>${title}</legend><div class="finder-options">${options.map(([id,label])=>`<label class="finder-option"><input type="radio" name="${name}" value="${id}"${values[name] === id ? ' checked' : ''}${required ? ' required' : ''} aria-describedby="error-${name}"><span>${label}</span></label>`).join('')}</div><p class="finder-error" id="error-${name}" hidden></p></fieldset>`;
function header(title, subtitle) {
  return `<div class="finder-form-head"><div class="finder-progress"><span>2페이지 중 ${step}페이지</span><div class="finder-progress-track${step === 2 ? ' is-last' : ''}" role="progressbar" aria-label="모임 찾기 진행" aria-valuenow="${step}" aria-valuemin="0" aria-valuemax="2"><span></span></div></div><h1 tabindex="-1">${title}</h1><p class="finder-subtitle">${subtitle}</p></div>`;
}
function capture() {
  const form = panel.querySelector('form');
  if (!form) return;
  const data = new FormData(form);
  const fields = step === 1 ? ['topic','book','pace','frequency','where','time','location'] : ['nickname','interest','source'];
  for (const name of fields) values[name] = String(data.get(name) || '').trim();
  if (step === 2) values.consent = data.has('consent');
}
function render(nextStep, focus = true) {
  step = nextStep;
  left.classList.toggle('is-form', step !== 0);
  if (step === 0) { panel.innerHTML = intro; setRestoreNote(); }
  else {
    const body = step === 1 ? `<div class="finder-grid">
      ${selectField('topic','모임 주제',[['silence','철학 · 침묵의 세계'],['fiction','문학 / 소설'],['essay','에세이'],['humanities','인문'],['free','자유 도서']])}
      <div class="finder-field"><label for="find-book">요즘 읽는 책 <span>선택</span></label><input id="find-book" name="book" value="${escapeHtml(values.book)}" maxlength="100" placeholder="예: 마음에 남은 책 한 권"></div>
      ${selectField('pace','읽는 속도',[['slow','천천히, 한 장씩'],['regular','꾸준히, 한 권씩'],['flexible','각자의 속도로']])}
      ${selectField('frequency','모임 주기',[['weekly','매주'],['biweekly','격주'],['monthly','매달'],['any','상관없어요']])}
      ${optionsField('where','만나는 방식',[['online','온라인'],['offline','오프라인'],['either','둘 다 좋아요']])}
      ${optionsField('time','편안한 시간',[['weekday','평일 저녁'],['weekend','주말'],['any','상관없어요']])}
      <div class="finder-field finder-full" id="location-field"${values.where === 'offline' || values.where === 'either' ? '' : ' hidden'}><label for="find-location">희망 지역 <span>선택</span></label><input id="find-location" name="location" maxlength="100" value="${escapeHtml(values.location)}" placeholder="예: 서울 마포구"></div>
      </div><p class="finder-form-note">✳ 정답은 없어요. 지금의 생활에 편안하게 들어오는 읽기를 골라주세요.</p>` : `<div class="finder-grid">
      <div class="finder-field finder-full"><label for="find-nickname">불리고 싶은 이름</label><input id="find-nickname" name="nickname" autocomplete="nickname" required maxlength="30" value="${escapeHtml(values.nickname)}" aria-describedby="error-nickname" placeholder="이름 또는 별명"><p class="finder-error" id="error-nickname" hidden></p></div>
      <div class="finder-field finder-full"><label for="find-interest">함께 나누고 싶은 이야기 <span>선택</span></label><textarea id="find-interest" name="interest" maxlength="500" placeholder="좋아하는 책이나 모임에 기대하는 것을 들려주세요.">${escapeHtml(values.interest)}</textarea></div>
      <div class="finder-full">${optionsField('source','어떻게 알게 되었나요? <span>선택</span>',[['search','검색'],['friend','지인 추천'],['social','소셜 미디어'],['other','그 밖의 곳']],false)}</div>
      <div class="finder-field finder-full"><label class="finder-consent" for="find-consent"><input type="checkbox" id="find-consent" name="consent" required${values.consent ? ' checked' : ''} aria-describedby="error-consent"><span>입력한 이름과 독서 취향을 현재 브라우저에 저장하는 데 동의해요.</span></label><p class="finder-error" id="error-consent" hidden></p></div>
      </div><p class="finder-form-note">입력한 정보는 이 브라우저에만 보관해요. 연락처 수집, 외부 전송, 실제 모임 등록은 없어요. 공유 기기에서는 저장 후 취향을 삭제해 주세요.</p><p id="save-error" class="finder-storage-note" role="alert" hidden></p>`;
    panel.innerHTML = `<form class="finder-form" novalidate>${header(step === 1 ? '어떤 읽기를 원하나요?' : '함께 읽을 당신',step === 1 ? '좋아하는 주제와 만나는 방식을 알려주세요.' : '이름 하나, 그리고 나누고 싶은 이야기.')}<div class="finder-form-body">${body}</div><div class="finder-form-footer"><button type="button" class="finder-back" data-action="back">← 이전</button><button type="submit" class="finder-primary">${step === 1 ? '다음' : '취향 저장하고 모임 보기'} <span aria-hidden="true">→</span></button></div></form>`;
  }
  if (focus) panel.querySelector('h1')?.focus({preventScroll:true});
}
function validate() {
  const required = step === 1 ? ['topic','pace','frequency','where','time'] : ['nickname','consent'];
  let first = null;
  for (const name of required) {
    const valid = name === 'consent' ? values.consent : Boolean(values[name]);
    const error = panel.querySelector(`#error-${name}`);
    error.hidden = valid;
    error.textContent = name === 'consent' ? '브라우저 저장에 동의해야 취향을 저장할 수 있어요.' : name === 'nickname' ? '불리고 싶은 이름을 입력해 주세요.' : '항목을 하나 골라주세요.';
    panel.querySelectorAll(`[name="${name}"]`).forEach(control=>{if(valid)control.removeAttribute('aria-invalid');else control.setAttribute('aria-invalid','true');});
    if (!valid && !first) first = panel.querySelector(`[name="${name}"]`);
  }
  if (first) { first.focus(); first.scrollIntoView({block:'nearest',behavior:'instant'}); }
  return !first;
}
const meetings = {
  silence:{name:'침묵의 세계 함께 읽기',time:'10월 29일(목) 오후 7시',where:'online',frequency:'once',timeId:'weekday',asset:'book-silence-cover.jpg',guide:'silence.html'},
  fiction:{name:'문학을 읽는 저녁',time:'격주 화요일 저녁',where:'online',frequency:'biweekly',timeId:'weekday',asset:'book-forest.svg'},
  essay:{name:'나를 돌보는 읽기',time:'격주 목요일 저녁',where:'online',frequency:'biweekly',timeId:'weekday',asset:'book-slow.svg'},
  humanities:{name:'질문이 자라는 시간',time:'매달 둘째 토요일 오후',where:'offline',frequency:'monthly',timeId:'weekend',asset:'book-city.svg'},
  free:{name:'각자의 책, 하나의 테이블',time:'매주 일요일 오전',where:'online',frequency:'weekly',timeId:'weekend',asset:'book-night.svg'}
};
function recommendations() {
  return Object.entries(meetings).map(([id,m])=>({id,...m,score:(values.topic===id?8:0)+(values.where===m.where?3:0)+(values.frequency===m.frequency?2:0)+(values.time===m.timeId?2:0)+(values.pace==='flexible'&&id==='free'?1:0)+(values.pace==='slow'&&id==='essay'?1:0)})).sort((a,b)=>b.score-a.score).slice(0,2);
}
function showResults() {
  step = 3;
  panel.innerHTML = `<div class="finder-results"><p class="finder-eyebrow">이 브라우저에 취향을 저장했어요</p><h1 tabindex="-1">${escapeHtml(values.nickname)} 님의<br>다음 페이지</h1><p class="finder-subtitle">고른 주제, 방식과 시간을 참고한 모임 예시예요.<br>모든 조건이 일치하는 모임은 아닐 수 있어요.</p>${recommendations().map(m=>`<article class="finder-result-card"><img src="assets/${m.asset}" alt="${m.guide?'침묵의 세계 개정3판 실제 표지':`${m.name} 큐레이션 예시 표지`}"><div><h2>${m.name}</h2><p>${m.time} · ${m.where==='online'?'온라인':'오프라인'}</p><a href="${m.guide || `index.html?meeting=${m.id}#meetings`}">모임 자세히 보기 →</a></div></article>`).join('')}<p class="finder-prototype">『침묵의 세계』 모임은 10월 29일 오후 7시로 안내돼요. 이 화면의 저장 기능은 참여 신청 체험이에요. 실제 모집 접수나 예약이 완료된 것은 아니에요. 저장한 취향은 이 기기의 브라우저 데이터를 지우면 함께 삭제돼요.</p><div class="finder-result-actions"><button type="button" class="finder-back" data-action="edit">취향 다시 고르기</button><a class="finder-primary" href="index.html#meetings">모든 모임 보기 →</a></div><button type="button" class="finder-back" data-action="clear">저장한 취향 삭제</button><p class="finder-storage-note" id="result-status" role="status" hidden></p></div>`;
  panel.querySelector('h1').focus({preventScroll:true});
}
panel.addEventListener('click',event=>{
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'start') render(1);
  if (action === 'back') { capture(); render(step-1); }
  if (action === 'edit') render(1);
  if (action === 'clear') {
    try { localStorage.removeItem(storageKey); values={...defaults}; storageNote='이 브라우저에 저장한 취향을 삭제했어요.'; render(0); }
    catch { const note=panel.querySelector('#result-status');note.textContent='저장 공간에 접근할 수 없어 삭제하지 못했어요. 브라우저의 사이트 데이터 설정에서 삭제할 수 있어요.';note.hidden=false; }
  }
});
panel.addEventListener('change',event=>{
  const name=event.target.name;
  if(name==='where') panel.querySelector('#location-field').hidden=event.target.value==='online';
  if(name) {
    const error=panel.querySelector(`#error-${name}`);
    if(error)error.hidden=true;
    panel.querySelectorAll(`[name="${name}"]`).forEach(control=>control.removeAttribute('aria-invalid'));
  }
});
panel.addEventListener('input',event=>{
  if(event.target.name==='nickname' && event.target.value.trim()) { event.target.removeAttribute('aria-invalid');panel.querySelector('#error-nickname').hidden=true; }
});
panel.addEventListener('submit',event=>{
  event.preventDefault();capture();if(!validate())return;
  if(step===1){render(2);return;}
  try {
    const payload={version:1,preferences:{...values},updatedAt:new Date().toISOString()};
    if(values.where==='online')payload.preferences.location='';
    localStorage.setItem(storageKey,JSON.stringify(payload));
    showResults();
  } catch {
    const error=panel.querySelector('#save-error');error.textContent='취향을 저장하지 못했어요. 입력 내용은 이 화면에 남아 있어요. 브라우저 저장 공간 설정을 확인한 뒤 다시 시도해 주세요.';error.hidden=false;error.scrollIntoView({block:'nearest'});
  }
});
const pause=document.querySelector('.finder-pause');
pause.addEventListener('click',()=>{const paused=pause.getAttribute('aria-pressed')!=='true';pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?'흐름 재생하기':'흐름 멈추기';document.querySelector('.finder-ticker').classList.toggle('is-paused',paused);});
