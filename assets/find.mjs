const panel = document.querySelector('#finder');
const left = document.querySelector('.finder-left');
const intro = panel.innerHTML;
const storageKey = 'sbs-next-study-v1';
const people = [['dongjin','서동진'],['geonguk','안건국'],['jihong','유지홍'],['seungcheol','김승철'],['jingyu','박진규'],['samuel','안사무엘']];
const fields = ['date','time','place','book'];
const emptyMember = () => ({range:'',content:'',questions:''});
let study = {date:'',time:'',place:'',book:'',members:Object.fromEntries(people.map(([id])=>[id,emptyMember()]))};
let storageFailed = false;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try {
 const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
 if (saved?.version === 1 && saved.study) {
  for (const key of fields) if (typeof saved.study[key] === 'string') study[key]=saved.study[key].slice(0,300);
  for (const [id] of people) for (const key of ['range','content','questions']) if (typeof saved.study.members?.[id]?.[key] === 'string') study.members[id][key]=saved.study.members[id][key].slice(0,20000);
 }
} catch { storageFailed = true; }
function persist() {
 try { localStorage.setItem(storageKey,JSON.stringify({version:1,study,updatedAt:new Date().toISOString()}));storageFailed=false; }
 catch {storageFailed=true;}
 return !storageFailed;
}
function status(message) {
 const note=panel.querySelector('#study-status');
 if(note) note.textContent=message || (storageFailed?'저장하지 못했어요. 입력 내용은 현재 화면에 유지돼요.':'입력한 내용을 이 브라우저에 저장했어요.');
}
function input(name,label,type='text',placeholder='') {
 return `<div class="finder-field${name==='place'||name==='book'?' finder-full':''}"><label for="study-${name}">${label}</label><input type="${type}" id="study-${name}" name="${name}" value="${escapeHtml(study[name])}" maxlength="300" placeholder="${placeholder}"></div>`;
}
function render() {
 const hash=location.hash.slice(1);
 const person=people.find(([id])=>hash==='member-'+id);
 left.classList.toggle('is-form',hash==='study'||Boolean(person));
 if(hash!=='study'&&!person){panel.innerHTML=intro;return;}
 let title,subtitle,body,back;
 if(person) {
  const [id,name]=person;const member=study.members[id];
  title=`${name}님의 담당 페이지`;subtitle='담당 부분과 발제 내용, 함께 나눌 질문을 작성해주세요.';back='#study';
  body=`<p class="study-book-context">다음 스터디 모임 책 · ${escapeHtml(study.book||'아직 정하지 않았어요')}</p><div class="finder-grid"><div class="finder-field finder-full"><label for="member-range">담당 부분 · 쪽수 / 장</label><input id="member-range" name="range" maxlength="300" value="${escapeHtml(member.range)}" placeholder="예: 1~59쪽 · 1장"></div><div class="finder-field finder-full"><label for="member-content">담당 내용 · 발제 정리</label><textarea id="member-content" name="content" maxlength="20000" placeholder="담당 부분의 내용과 핵심 생각을 자유롭게 작성해주세요.">${escapeHtml(member.content)}</textarea></div><div class="finder-field finder-full"><label for="member-questions">함께 나눌 질문</label><textarea id="member-questions" name="questions" maxlength="20000" placeholder="모임에서 이야기하고 싶은 질문을 작성해주세요.">${escapeHtml(member.questions)}</textarea></div></div>`;
 } else {
  title='다음 스터디 책을 선정해주세요';subtitle='모임 정보를 정하고, 각자의 담당 부분을 작성해주세요.';back='#';
  body=`<div class="finder-grid">${input('date','모임 날짜','date')}${input('time','모임 시간','time')}${input('place','모임 장소','text','장소 또는 온라인 접속 안내')}${input('book','다음 스터디 모임 책','text','함께 읽을 책 제목')}</div><section class="study-members" aria-labelledby="study-members-title"><h2 id="study-members-title">스터디 모임 책 개별 담당 정하기</h2><p>이름을 누르면 개인별 담당 페이지에 내용을 입력할 수 있어요.</p><div class="study-member-grid">${people.map(([id,name])=>`<button type="button" class="study-member" data-member="${id}"><strong>${name}</strong><span>${escapeHtml(study.members[id].range||'담당 부분 작성하기')} →</span></button>`).join('')}</div></section>`;
 }
 panel.innerHTML=`<form class="finder-form"><div class="finder-form-head"><p class="finder-eyebrow">S.B.S · 다음 스터디 모임</p><h1 tabindex="-1">${title}</h1><p class="finder-subtitle">${subtitle}</p></div><div class="finder-form-body">${body}<p class="finder-form-note">입력 내용은 현재 기기의 이 브라우저에 자동 저장돼요. 다른 사람이나 기기와 자동으로 공유되지는 않아요.</p><p id="study-status" class="finder-storage-note" role="status">${storageFailed?'브라우저 저장 공간을 사용할 수 없어요. 입력 후 저장 상태를 확인해주세요.':''}</p></div><div class="finder-form-footer"><a class="finder-back" href="${back}">← ${person?'모임 정보로':'이전'}</a><button type="submit" class="finder-primary">${person?'담당 내용 저장':'모임 정보 저장'} <span aria-hidden="true">✓</span></button></div></form>`;
 panel.querySelector('h1')?.focus({preventScroll:true});
}
panel.addEventListener('click',event=>{
 if(event.target.closest('[data-action="start"]')) location.hash='study';
 const member=event.target.closest('[data-member]')?.dataset.member;
 if(people.some(([id])=>id===member))location.hash='member-'+member;
});
panel.addEventListener('input',event=>{
 const target=event.target;const person=people.find(([id])=>location.hash==='#member-'+id);
 if(person&&['range','content','questions'].includes(target.name))study.members[person[0]][target.name]=target.value;
 else if(location.hash==='#study'&&fields.includes(target.name))study[target.name]=target.value;
 else return;
 persist();status();
});
panel.addEventListener('submit',event=>{event.preventDefault();persist();status();});
addEventListener('hashchange',render);
render();
const pause=document.querySelector('.finder-pause');
pause?.addEventListener('click',()=>{const paused=pause.getAttribute('aria-pressed')!=='true';pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?'흐름 재생하기':'흐름 멈추기';document.querySelector('.finder-ticker').classList.toggle('is-paused',paused);});
