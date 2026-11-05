const panel = document.querySelector('#finder');
const left = document.querySelector('.finder-left');
const intro = panel.innerHTML;
const storageKey = 'sbs-next-study-v1';
const people = [['dongjin','서동진'],['geonguk','안건국'],['jihong','유지홍'],['seungcheol','김승철'],['jingyu','박진규'],['samuel','안사무엘']];
const fields = ['date','time','place','book','bookLink','bookSummary'];
const bookInfoApi = 'https://sbs-book-info-api.vercel.app/api/book-info';
const emptyMember = () => ({range:'',content:'',questions:''});
const emptyStudy=()=>({date:'',time:'',place:'',book:'',bookLink:'',bookSummary:'',bookInfo:null,members:Object.fromEntries(people.map(([id])=>[id,emptyMember()]))});
let study = emptyStudy();
let storageFailed = false;
let lookupPhase='idle',lookupMessage='',lookupTimer,lookupController,lookupSequence=0;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function normalizedStudy(raw){
 const next=emptyStudy();
 if(raw&&typeof raw==='object'){
  for (const key of fields) if (typeof raw[key] === 'string') next[key]=raw[key].slice(0,key==='bookSummary'?6000:key==='bookLink'?2000:300);
  if(raw.bookInfo&&typeof raw.bookInfo==='object'&&raw.bookInfo.linkInput===next.bookLink){
   next.bookInfo=Object.fromEntries(['title','author','translator','publisher','publishedAt','pages','isbn','cover','sourceUrl','store','linkInput'].map(key=>[key,String(raw.bookInfo[key]||'').slice(0,key==='linkInput'?2000:500)]));
  }
  for (const [id] of people) for (const key of ['range','content','questions']) if (typeof raw.members?.[id]?.[key] === 'string') next.members[id][key]=raw.members[id][key].slice(0,20000);
 }
 return next;
}
function readLatest(){const saved=JSON.parse(localStorage.getItem(storageKey)||'null');return saved?.version===1&&saved.study?normalizedStudy(saved.study):null;}
try{study=readLatest()||study;}catch{storageFailed=true;}
function persist(change={}) {
 try {
  const latest=readLatest();
  if(change.expectedLink!==undefined&&latest&&latest.bookLink!==change.expectedLink)return 'changed';
  const next=normalizedStudy(latest||study);
  for(const key of change.keys||[])next[key]=study[key];
  if(change.member)for(const key of change.memberKeys||[])next.members[change.member][key]=study.members[change.member][key];
  if(change.lookup&&latest&&(latest.bookInfo?.linkInput===change.expectedLink||latest.bookSummary!==change.summaryBefore))next.bookSummary=latest.bookSummary;
  localStorage.setItem(storageKey,JSON.stringify({version:1,study:next,updatedAt:new Date().toISOString()}));study=next;storageFailed=false;
 }
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
function supportedBookUrl(value){
 try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port)return false;
 return (['aladin.co.kr','www.aladin.co.kr'].includes(u.hostname)&&/^\/shop\/wproduct\.aspx$/i.test(u.pathname)&&/^\d{1,12}$/.test(u.searchParams.get('ItemId')||u.searchParams.get('itemid')||''))||(['yes24.com','www.yes24.com','m.yes24.com'].includes(u.hostname)&&/^\/(?:product\/goods|goods\/detail)\/\d{1,12}\/?$/i.test(u.pathname))||(u.hostname==='product.kyobobook.co.kr'&&/^\/detail\/S\d{6,20}\/?$/i.test(u.pathname));}catch{return false;}
}
function safeCover(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['image.aladin.co.kr','image.yes24.com','contents.kyobobook.co.kr','image.kyobobook.co.kr'].includes(u.hostname)?u.href:'';}catch{return '';}}
function bookInfoHtml(){
 const b=study.bookInfo;
 const message=lookupPhase==='loading'?'서점에서 책 정보를 가져오고 있어요…':lookupMessage;
 if(!b)return `<section class="book-info-card" aria-label="책 정보" aria-busy="${lookupPhase==='loading'}"><p class="book-info-kicker">책 정보</p><p class="book-info-message" role="status">${escapeHtml(message||'알라딘·교보문고·YES24의 도서 상세 링크를 넣으면 기본 정보와 간단한 소개를 불러와요.')}</p>${study.bookLink.trim()&&lookupPhase!=='loading'?`<button type="button" class="finder-back" data-action="lookup-book">${lookupPhase==='error'?'다시 조회하기':'책 정보 불러오기'} ↻</button>`:''}</section>`;
 const cover=safeCover(b.cover);
 const entries=[['저자',b.author],['역자',b.translator],['출판사',b.publisher],['출간일',b.publishedAt],['쪽수',b.pages?b.pages+'쪽':''],['ISBN',b.isbn]].filter(([,v])=>v);
 return `<section class="book-info-card" aria-labelledby="book-info-title"><p class="book-info-kicker">링크에서 가져온 책 정보</p><div class="book-info-heading">${cover?`<img src="${escapeHtml(cover)}" alt="${escapeHtml(b.title)} 표지" loading="lazy" referrerpolicy="no-referrer">`:''}<div><h2 id="book-info-title">${escapeHtml(b.title)}</h2><dl>${entries.map(([k,v])=>`<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl></div></div><div class="finder-field"><label for="study-bookSummary">간단한 책 소개 <span>직접 수정 가능</span></label><textarea id="study-bookSummary" name="bookSummary" data-book-link="${escapeHtml(b.linkInput)}" maxlength="6000" placeholder="서점에 소개가 없으면 직접 작성해주세요.">${escapeHtml(study.bookSummary)}</textarea></div><p class="book-info-source">서점의 공개 소개를 간단히 표시했어요.${supportedBookUrl(b.sourceUrl)?` <a href="${escapeHtml(b.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.store)} 원문 보기 ↗</a>`:''}</p><button type="button" class="finder-back" data-action="lookup-book">책 정보 다시 불러오기 ↻</button><p class="book-info-message" role="status">${escapeHtml(message)}</p></section>`;
}
function updateBookInfo(){const slot=panel.querySelector('#book-info-slot');if(slot)slot.innerHTML=bookInfoHtml();}
async function lookupBookInfo(){
 clearTimeout(lookupTimer);lookupController?.abort();const sequence=++lookupSequence;const link=study.bookLink.trim();
 if(!link){lookupPhase='idle';lookupMessage='';updateBookInfo();return;}
 if(!supportedBookUrl(link)){lookupPhase='error';lookupMessage='알라딘·교보문고·YES24의 도서 상세 링크를 입력해주세요. 검색·단축 링크는 지원하지 않아요.';updateBookInfo();return;}
 const overwriteSummary=study.bookSummary,hasMatchingInfo=study.bookInfo?.linkInput===study.bookLink;
 lookupPhase='loading';lookupMessage='';updateBookInfo();const controller=new AbortController();lookupController=controller;
 const timeout=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch(bookInfoApi+'?url='+encodeURIComponent(link),{signal:controller.signal});
  const data=await response.json();if(!response.ok||!data.book?.title)throw Error(data.error||'책 정보를 불러오지 못했어요.');
  if(sequence!==lookupSequence||study.bookLink.trim()!==link)return;
  const b=data.book;study.bookInfo=Object.fromEntries(['title','author','translator','publisher','publishedAt','pages','isbn','cover','sourceUrl','store'].map(key=>[key,String(b[key]||'').slice(0,500)]));study.bookInfo.linkInput=study.bookLink;
  study.book=String(b.title).slice(0,300);
  if(!hasMatchingInfo&&study.bookSummary===overwriteSummary)study.bookSummary=String(b.summary||'').slice(0,6000);
  const saved=persist({keys:['book','bookInfo','bookSummary'],expectedLink:study.bookLink,summaryBefore:overwriteSummary,lookup:true});
  if(saved==='changed'){study=readLatest()||study;lookupPhase='error';lookupMessage='다른 탭에서 책 링크를 변경했어요. 새로고침해서 최신 모임 정보를 확인해주세요.';updateBookInfo();return;}
  lookupPhase='success';lookupMessage='책 정보를 불러왔어요. 소개는 자유롭게 수정할 수 있어요.';
  const title=panel.querySelector('#study-book');if(title)title.value=study.book;updateBookInfo();status();
 }catch(error){if(sequence!==lookupSequence)return;lookupPhase='error';lookupMessage=error.name==='AbortError'?'조회 시간이 길어졌어요. 잠시 후 다시 조회해주세요.':error.message==='Failed to fetch'?'조회 서버에 연결하지 못했어요. 잠시 후 다시 조회해주세요.':error.message;updateBookInfo();}
 finally{clearTimeout(timeout);}
}
function render() {
 const hash=location.hash.slice(1);
 const person=people.find(([id])=>hash==='member-'+id);
 left.classList.toggle('is-form',hash==='study'||Boolean(person));
 if(hash!=='study'&&!person){panel.innerHTML=intro;return;}
 let title,subtitle,body,back;
 if(person) {
  const [id,name]=person;const member=study.members[id];
  title=`${name}님의 담당 페이지`;subtitle='담당 부분과 발제 내용을 작성해주세요.';back='#study';
  body=`<p class="study-book-context">다음 스터디 모임 책 · ${escapeHtml(study.book||'아직 정하지 않았어요')}</p><div class="finder-grid"><div class="finder-field finder-full"><label for="member-range">담당 부분 · 쪽수 / 장</label><input id="member-range" name="range" maxlength="300" value="${escapeHtml(member.range)}" placeholder="예: 1~59쪽 · 1장"></div><div class="finder-field finder-full"><label for="member-content">담당 내용 · 발제 정리</label><textarea id="member-content" name="content" maxlength="20000" placeholder="담당 부분의 내용과 핵심 생각을 자유롭게 작성해주세요.">${escapeHtml(member.content)}</textarea></div></div>`;
 } else {
  title='다음 스터디 책을 선정해주세요';subtitle='모임 정보를 정하고, 각자의 담당 부분을 작성해주세요.';back='#';
  body=`<div class="finder-grid">${input('date','모임 날짜','date')}${input('time','모임 시간','time')}${input('place','모임 장소','text','장소 또는 온라인 접속 안내')}${input('book','다음 스터디 모임 책','text','함께 읽을 책 제목')}<div class="finder-field finder-full"><label for="study-bookLink">책 링크</label><input type="url" id="study-bookLink" name="bookLink" maxlength="2000" value="${escapeHtml(study.bookLink)}" placeholder="https://www.aladin.co.kr/…" aria-describedby="book-link-hint"><p id="book-link-hint" class="book-link-hint">도서 상세 링크를 붙여 넣으면 책 정보를 자동으로 불러와요.</p></div><div id="book-info-slot" class="finder-full">${bookInfoHtml()}</div></div><section class="study-members" aria-labelledby="study-members-title"><h2 id="study-members-title">스터디 모임 책 개별 담당 정하기</h2><p>이름을 누르면 개인별 담당 페이지에 내용을 입력할 수 있어요.</p><div class="study-member-grid">${people.map(([id,name])=>`<button type="button" class="study-member" data-member="${id}"><strong>${name}</strong><span>${escapeHtml(study.members[id].range||'담당 부분 작성하기')} →</span></button>`).join('')}</div></section>`;
 }
 panel.innerHTML=`<form class="finder-form"><div class="finder-form-head"><p class="finder-eyebrow">S.B.S · 다음 스터디 모임</p><h1 tabindex="-1">${title}</h1><p class="finder-subtitle">${subtitle}</p></div><div class="finder-form-body">${body}<p class="finder-form-note">입력 내용은 현재 기기의 이 브라우저에 자동 저장돼요. 다른 사람이나 기기와 자동으로 공유되지는 않아요.</p><p id="study-status" class="finder-storage-note" role="status">${storageFailed?'브라우저 저장 공간을 사용할 수 없어요. 입력 후 저장 상태를 확인해주세요.':''}</p></div><div class="finder-form-footer"><a class="finder-back" href="${back}">← ${person?'모임 정보로':'이전'}</a><button type="submit" class="finder-primary">${person?'담당 내용 저장':'모임 정보 저장'} <span aria-hidden="true">✓</span></button></div></form>`;
 panel.querySelector('h1')?.focus({preventScroll:true});
}
panel.addEventListener('click',event=>{
 if(event.target.closest('[data-action="lookup-book"]'))lookupBookInfo();
 if(event.target.closest('[data-action="start"]')) location.hash='study';
 const member=event.target.closest('[data-member]')?.dataset.member;
 if(people.some(([id])=>id===member))location.hash='member-'+member;
});
panel.addEventListener('input',event=>{
 const target=event.target;const person=people.find(([id])=>location.hash==='#member-'+id);
 if(person&&['range','content','questions'].includes(target.name))study.members[person[0]][target.name]=target.value;
 else if(location.hash==='#study'&&fields.includes(target.name))study[target.name]=target.value;
 else return;
 if(target.name==='bookLink'){
  clearTimeout(lookupTimer);lookupController?.abort();lookupSequence++;
  if(study.bookInfo?.linkInput!==study.bookLink){study.bookInfo=null;study.bookSummary='';}
  lookupPhase='idle';lookupMessage='';updateBookInfo();
  if(study.bookLink.trim())lookupTimer=setTimeout(lookupBookInfo,700);
 }
 const result=persist(person?{member:person[0],memberKeys:[target.name]}:target.name==='bookSummary'?{keys:['bookSummary'],expectedLink:target.dataset.bookLink}:{keys:target.name==='bookLink'?['bookLink','bookInfo','bookSummary']:[target.name]});
 if(result==='changed'){study=readLatest()||study;lookupPhase='error';lookupMessage='다른 탭에서 책을 변경했어요. 최신 책 정보를 표시했어요.';render();return;}
 status();
});
panel.addEventListener('keydown',event=>{if(event.target.name==='bookLink'&&event.key==='Enter'){event.preventDefault();lookupBookInfo();}});
panel.addEventListener('submit',event=>{event.preventDefault();persist();status();});
addEventListener('hashchange',render);
render();
const pause=document.querySelector('.finder-pause');
pause?.addEventListener('click',()=>{const paused=pause.getAttribute('aria-pressed')!=='true';pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?'흐름 재생하기':'흐름 멈추기';document.querySelector('.finder-ticker').classList.toggle('is-paused',paused);});
