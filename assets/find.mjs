import {cachedLibrary,fetchLibrary,publishStudy} from './study-client.mjs';
const panel = document.querySelector('#finder');
const left = document.querySelector('.finder-left');
const intro = panel.innerHTML;
const recordId=new URLSearchParams(location.search).get('record')||'';
const storageKey = recordId?'sbs-study-draft-v1:'+recordId:'sbs-next-study-v1';
let publicLibrary=cachedLibrary(),publicReady=false,publicFailure='',recordVersion=publicLibrary.records.find(record=>record.id===recordId)?.version||0;
const people = [['dongjin','서동진'],['geonguk','안건국'],['jihong','유지홍'],['seungcheol','김승철'],['jingyu','박진규'],['samuel','안사무엘']];
const fields = ['date','time','place','book','bookLink','bookSummary'];
const bookInfoApi = 'https://sbs-book-info-api.vercel.app/api/book-info';
const emptyMember = () => ({range:'',content:'',questions:''});
const emptyStudy=()=>({date:'',time:'',place:'',book:'',bookLink:'',bookSummary:'',bookInfo:null,members:Object.fromEntries(people.map(([id])=>[id,emptyMember()]))});
let study = emptyStudy();
let storageFailed = false;
let draftConflict=false;
let lookupPhase='idle',lookupMessage='',lookupTimer,lookupController,lookupSequence=0;
let activeLookup=Promise.resolve();
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
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');study=readLatest()||normalizedStudy(publicLibrary.records.find(record=>record.id===recordId)?.study);if(recordId&&Number.isInteger(saved?.recordVersion))recordVersion=saved.recordVersion;}catch{storageFailed=true;}
function persist(change={}) {
 try {
  const stored=JSON.parse(localStorage.getItem(storageKey)||'null');
  if(recordId&&stored?.version===1&&Number.isInteger(stored.recordVersion)&&stored.recordVersion!==recordVersion){draftConflict=true;storageFailed=true;return false;}
  const latest=stored?.version===1&&stored.study?normalizedStudy(stored.study):null;
  if(change.expectedLink!==undefined&&latest&&latest.bookLink!==change.expectedLink)return 'changed';
  const next=normalizedStudy(latest||study);
  for(const key of change.keys||[])next[key]=study[key];
  if(change.member)for(const key of change.memberKeys||[])next.members[change.member][key]=study.members[change.member][key];
  if(change.lookup&&latest&&(latest.bookInfo?.linkInput===change.expectedLink||latest.bookSummary!==change.summaryBefore))next.bookSummary=latest.bookSummary;
  localStorage.setItem(storageKey,JSON.stringify({version:1,study:next,recordVersion,updatedAt:new Date().toISOString()}));study=next;storageFailed=false;draftConflict=false;
 }
 catch {storageFailed=true;}
 return !storageFailed;
}
function status(message) {
 const note=panel.querySelector('#study-status');
 if(note) note.textContent=message || (draftConflict?'다른 버전에서 작성한 초안이 있어 합치지 않았어요. 현재 입력과 저장된 초안을 백업한 뒤 최신 기록으로 전환해주세요.':storageFailed?'초안을 저장하지 못했어요. 입력 내용은 현재 화면에 유지돼요.':'초안을 이 브라우저에 저장했어요. 마무리 저장하면 공통 기록에 공개돼요.');
 if(draftConflict&&note&&!panel.querySelector('#study-recovery')){const box=document.createElement('div');box.id='study-recovery';const button=document.createElement('button');button.type='button';button.className='finder-back';button.dataset.action='recover-record';button.textContent='현재 입력과 저장된 초안을 백업하고 최신 기록으로 전환';box.append(button);note.after(box);}
}
function input(name,label,type='text',placeholder='') {
 return `<div class="finder-field${name==='place'||name==='book'?' finder-full':''}"><label for="study-${name}">${label}</label><input type="${type}" id="study-${name}" name="${name}" value="${escapeHtml(study[name])}" maxlength="300" placeholder="${placeholder}"></div>`;
}
function supportedBookUrl(value){
 try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port)return false;
 return (['aladin.co.kr','www.aladin.co.kr'].includes(u.hostname)&&/^\/shop\/wproduct\.aspx$/i.test(u.pathname)&&/^\d{1,12}$/.test(u.searchParams.get('ItemId')||u.searchParams.get('itemid')||''))||(['yes24.com','www.yes24.com','m.yes24.com'].includes(u.hostname)&&/^\/(?:product\/goods|goods\/detail)\/\d{1,12}\/?$/i.test(u.pathname))||(u.hostname==='product.kyobobook.co.kr'&&/^\/detail\/S\d{6,20}\/?$/i.test(u.pathname));}catch{return false;}
}
function safeCover(value){if(value==='assets/book-silence-cover.jpg')return value;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['image.aladin.co.kr','image.yes24.com','contents.kyobobook.co.kr','image.kyobobook.co.kr'].includes(u.hostname)?u.href:'';}catch{return '';}}
function bookInfoHtml(){
 const b=study.bookInfo;
 const message=lookupPhase==='loading'?'서점에서 책 정보를 가져오고 있어요…':lookupMessage;
 if(!b)return `<section class="book-info-card" aria-label="책 정보" aria-busy="${lookupPhase==='loading'}"><p class="book-info-kicker">책 정보</p><p class="book-info-message" role="status">${escapeHtml(message||'알라딘·교보문고·YES24의 도서 상세 링크를 넣으면 기본 정보와 간단한 소개를 불러와요.')}</p>${study.bookLink.trim()&&lookupPhase!=='loading'?`<button type="button" class="finder-back" data-action="lookup-book">${lookupPhase==='error'?'다시 조회하기':'책 정보 불러오기'} ↻</button>`:''}</section>`;
 const cover=safeCover(b.cover);
 const entries=[['저자',b.author],['역자',b.translator],['출판사',b.publisher],['출간일',b.publishedAt],['쪽수',b.pages?b.pages+'쪽':''],['ISBN',b.isbn]].filter(([,v])=>v);
 return `<section class="book-info-card" aria-labelledby="book-info-title"><p class="book-info-kicker">링크에서 가져온 책 정보</p><div class="book-info-heading">${cover?`<img src="${escapeHtml(cover)}" alt="${escapeHtml(b.title)} 표지" loading="lazy" referrerpolicy="no-referrer">`:''}<div><h2 id="book-info-title">${escapeHtml(b.title)}</h2><dl>${entries.map(([k,v])=>`<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl></div></div><div class="finder-field"><label for="study-bookSummary">간단한 책 소개 <span>직접 수정 가능</span></label><textarea id="study-bookSummary" name="bookSummary" data-book-link="${escapeHtml(b.linkInput)}" maxlength="6000" placeholder="서점에 소개가 없으면 직접 작성해주세요.">${escapeHtml(study.bookSummary)}</textarea></div><p class="book-info-source">서점의 공개 소개를 간단히 표시했어요.${supportedBookUrl(b.sourceUrl)?` <a href="${escapeHtml(b.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.store)} 원문 보기 ↗</a>`:''}</p><button type="button" class="finder-back" data-action="lookup-book">책 정보 다시 불러오기 ↻</button><p class="book-info-message" role="status">${escapeHtml(message)}</p></section>`;
}
function updateBookInfo(){const slot=panel.querySelector('#book-info-slot');if(slot)slot.innerHTML=bookInfoHtml();}
function lookupBookInfo(){activeLookup=performBookLookup();return activeLookup;}
async function performBookLookup(){
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
function renderSummary(){
 if(!publicReady&&!publicFailure){panel.innerHTML='<article class="study-summary"><h1 tabindex="-1">확정한 모임을 불러오고 있어요</h1><p role="status">공통 기록을 확인하고 있어요.</p></article>';return;}
 const record=publicLibrary.records.find(item=>item.id===(recordId||publicLibrary.latestId));
 if(!record){panel.innerHTML='<article class="study-summary"><h1 tabindex="-1">모임 기록을 찾지 못했어요</h1><p>주소를 확인하거나 메인 책장에서 다시 선택해주세요.</p><a class="finder-primary" href="index.html#bookshelf">책장으로 돌아가기</a></article>';return;}
 const viewStudy=record.study;
 const b=viewStudy.bookInfo,cover=b?safeCover(b.cover):'';
 const date=/^\d{4}-\d{2}-\d{2}$/.test(viewStudy.date)?viewStudy.date.replace(/(\d{4})-(\d{2})-(\d{2})/,'$1년 $2월 $3일'):viewStudy.date;
 const details=b?[['저자',b.author],['역자',b.translator],['출판사',b.publisher],['출간일',b.publishedAt],['쪽수',b.pages?b.pages+'쪽':''],['ISBN',b.isbn]].filter(([,v])=>v):[];
 panel.innerHTML=`<article class="study-summary"><header class="study-summary-head"><p class="finder-eyebrow">S.B.S · 다음 스터디 모임</p><h1 tabindex="-1">다음 모임, 이렇게 함께 읽어요</h1><p>저장한 모임 정보와 책, 각자의 담당 내용을 한곳에 모았어요.</p>${new URLSearchParams(location.search).has('draftKept')?'<p class="finder-storage-note">저장 중 추가로 작성한 초안은 브라우저에 남겨뒀어요. <a href="'+(new URLSearchParams(location.search).get('draftKept')==='new'?'find.html#study':'find.html?record='+encodeURIComponent(record.id)+'#study')+'">추가 초안 이어서 작성하기 ↗</a></p>':''}<a class="finder-primary" href="find.html?record=${encodeURIComponent(record.id)}#study">모임 정보 수정 ↗</a></header><div class="study-summary-grid"><section class="study-summary-card" aria-labelledby="summary-meeting-title"><p class="book-info-kicker">함께 만나는 날</p><h2 id="summary-meeting-title">다음 스터디 모임 안내</h2><dl class="study-summary-details">${[['날짜',date],['시간',viewStudy.time],['장소',viewStudy.place]].map(([k,v])=>`<div><dt>${k}</dt><dd>${escapeHtml(v||'아직 정하지 않았어요')}</dd></div>`).join('')}</dl></section><section class="study-summary-card" aria-labelledby="summary-book-title"><p class="book-info-kicker">함께 읽을 다음 책</p><div class="book-info-heading">${cover?`<img src="${escapeHtml(cover)}" alt="${escapeHtml(viewStudy.book||b.title)} 표지" referrerpolicy="no-referrer">`:''}<div><h2 id="summary-book-title">${escapeHtml(viewStudy.book||b?.title||'아직 정하지 않았어요')}</h2><dl>${details.map(([k,v])=>`<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl></div></div>${viewStudy.bookSummary?`<h3>간단한 책 소개</h3><p class="study-summary-text">${escapeHtml(viewStudy.bookSummary)}</p>`:''}${supportedBookUrl(viewStudy.bookLink)?`<a class="study-summary-source" href="${escapeHtml(viewStudy.bookLink)}" target="_blank" rel="noopener noreferrer">도서 원문 링크 보기 ↗</a>`:''}${record.id==='silence'?'<a class="study-summary-source" href="silence.html">침묵의 세계 독서 가이드 열기 ↗</a>':''}</section><section class="study-summary-members" aria-labelledby="summary-members-title"><div class="study-summary-section-head"><p class="book-info-kicker">각자의 읽기, 함께 나눌 생각</p><h2 id="summary-members-title">개별 담당 정리</h2></div><div class="study-summary-member-grid">${people.map(([id,name])=>`<article class="study-summary-card"><div class="study-summary-member-head"><h3>${name}</h3><a href="find.html?record=${encodeURIComponent(record.id)}#member-${id}">${name} 담당 수정 ↗</a></div><p class="study-summary-range">${escapeHtml(viewStudy.members[id].range||'담당 부분 미정')}</p><p class="study-summary-text${viewStudy.members[id].content?'':' is-empty'}">${escapeHtml(viewStudy.members[id].content||'아직 작성한 담당 내용이 없어요.')}</p></article>`).join('')}</div></section></div><footer class="study-summary-footer"><a class="finder-back" href="index.html">← 메인으로</a><p>${publicFailure?'연결이 지연되어 마지막으로 확인한 공통 기록을 표시해요.':'모든 방문자가 함께 보는 확정 모임 기록이에요.'}</p><a class="finder-primary" href="find.html?record=${encodeURIComponent(record.id)}#study">모임 정보 수정 ↗</a></footer></article>`;
 panel.querySelector('h1')?.focus({preventScroll:true});
}
function render() {
 const hash=location.hash.slice(1);
 const person=people.find(([id])=>hash==='member-'+id);
 document.body.classList.toggle('is-study-summary',hash==='summary');
 left.classList.toggle('is-form',hash==='study'||Boolean(person));
 if(hash==='summary'){renderSummary();return;}
 if(recordId&&!publicReady){panel.innerHTML=`<div class="finder-intro"><h1 tabindex="-1">${publicFailure?'공통 모임 기록에 연결하지 못했어요':'기존 모임을 불러오고 있어요'}</h1><p class="finder-subtitle">${publicFailure?'초안은 그대로 보관돼요. 잠시 후 다시 연결해주세요.':'잠시만 기다려주세요.'}</p>${publicFailure?'<button type="button" class="finder-primary" data-action="reload-public">다시 연결하기</button>':''}</div>`;return;}
 if(recordId&&!publicLibrary.records.some(record=>record.id===recordId)){panel.innerHTML='<div class="finder-intro"><h1>모임 기록을 찾지 못했어요</h1><a href="index.html#bookshelf">책장으로 돌아가기</a></div>';return;}
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
 panel.innerHTML=`<form class="finder-form"><div class="finder-form-head"><p class="finder-eyebrow">S.B.S · 다음 스터디 모임</p><h1 tabindex="-1">${title}</h1><p class="finder-subtitle">${subtitle}</p></div><div class="finder-form-body">${body}<p class="finder-form-note">입력 중인 초안은 이 브라우저에 보관돼요. 마무리 저장하면 확정한 모임 정보가 모든 방문자에게 공개돼요.</p><p id="study-status" class="finder-storage-note" role="status">${storageFailed?'브라우저 저장 공간을 사용할 수 없어요. 입력 후 저장 상태를 확인해주세요.':''}</p></div><div class="finder-form-footer"><a class="finder-back" href="${back}">← ${person?'모임 정보로':'이전'}</a><button type="submit" class="finder-primary"${!publicReady&&(!person||recordId)?' disabled':''}>${person?'담당 내용 저장':'모임 정보 저장'} <span aria-hidden="true">✓</span></button></div></form>`;
 panel.querySelector('h1')?.focus({preventScroll:true});
}
panel.addEventListener('click',event=>{
 if(event.target.closest('[data-action="recover-record"]'))recoverRecord();
 if(event.target.closest('[data-action="reload-public"]'))syncPublicRecords();
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
panel.addEventListener('submit',async event=>{
 event.preventDefault();
 if(location.hash!=='#study'){
  if(!persist()){status();return;}
  if(!recordId){status('개별 담당 초안을 저장했어요. 모임 정보로 돌아가 마무리 저장하면 모두에게 공개돼요.');return;}
  const button=event.submitter;if(button)button.disabled=true;
  try{await publishCurrentStudy();}finally{if(button)button.disabled=false;}
  return;
 }
 const link=study.bookLink,button=event.submitter;
 if(button)button.disabled=true;
 try{
  clearTimeout(lookupTimer);
  if(lookupPhase==='loading'){status('책 정보를 불러온 뒤 전체 정리 화면으로 이동할게요.');await activeLookup;}
  else if(link.trim()&&!study.bookInfo&&supportedBookUrl(link)){status('책 정보를 확인하고 있어요.');await lookupBookInfo();}
  if(location.hash!=='#study')return;
  if(study.bookLink!==link){status('책 링크가 변경됐어요. 확인 후 다시 저장해주세요.');return;}
  if(persist())await publishCurrentStudy();else status();
 }finally{if(button)button.disabled=false;}
});
async function publishCurrentStudy(){
 if(!publicReady){status('공통 기록에 연결되지 않아 아직 공개할 수 없어요. 초안은 유지돼요. 새로고침 후 다시 저장해주세요.');return;}
 if(!study.book.trim()){status('책 제목을 입력한 뒤 마무리 저장해주세요.');panel.querySelector('#study-book')?.focus();return;}
 try{
  const snapshot=normalizedStudy(study),draftBefore=localStorage.getItem(storageKey),snapshotText=JSON.stringify(snapshot);
  const result=await publishStudy(snapshot,{recordId:recordId||undefined,library:publicLibrary,recordVersion});
  if(!result){status('공개 저장을 취소했어요. 작성한 초안은 남아 있어요.');return;}
  publicLibrary=result.library;
  let kept=false;
  try{if(localStorage.getItem(storageKey)===draftBefore&&JSON.stringify(study)===snapshotText)localStorage.removeItem(storageKey);else kept=true;}catch{kept=true;}
  location.assign('find.html?record='+encodeURIComponent(result.recordId)+(kept?'&draftKept='+encodeURIComponent(recordId||'new'):'')+'#summary');
 }catch(error){
  status(error.message);
  const existing=panel.querySelector('#study-recovery');if(existing)existing.remove();
  if(error.status===409){
   const recovery=document.createElement('div');recovery.id='study-recovery';
   if(error.existingRecordId){const link=document.createElement('a');link.className='finder-back';link.href='find.html?record='+encodeURIComponent(error.existingRecordId)+'#study';link.textContent='기존 책의 모임 기록 수정하기 ↗';recovery.append(link);}
   else if(recordId){const button=document.createElement('button');button.type='button';button.className='finder-back';button.dataset.action='recover-record';button.textContent='현재 초안을 백업하고 최신 기록으로 다시 편집';recovery.append(button);}
   panel.querySelector('#study-status')?.after(recovery);
  }
 }
}
async function recoverRecord(){
 try{
  const fresh=await fetchLibrary(),record=fresh.records.find(item=>item.id===recordId);if(!record)throw Error('기록을 찾지 못했어요. 초안은 유지돼요.');
  const backupKey='sbs-study-backup-v1:'+recordId+':'+Date.now(),storedDraftRaw=localStorage.getItem(storageKey);
  localStorage.setItem(backupKey,JSON.stringify({version:1,recordId,recordVersion,study:normalizedStudy(study),storedDraftRaw}));
  if(localStorage.getItem(storageKey)!==storedDraftRaw)throw Error('다른 탭에서 초안이 변경됐어요. 다시 전환해주세요.');
  localStorage.setItem(storageKey,JSON.stringify({version:1,recordVersion:record.version,study:record.study,updatedAt:new Date().toISOString()}));
  clearTimeout(lookupTimer);lookupController?.abort();lookupSequence++;lookupPhase='idle';lookupMessage='';
  publicLibrary=fresh;publicReady=true;study=normalizedStudy(record.study);recordVersion=record.version;draftConflict=false;storageFailed=false;render();status('현재 입력과 저장된 이전 초안을 브라우저에 백업했어요. 최신 기록에서 다시 수정할 수 있어요.');
  const button=document.createElement('button');button.type='button';button.className='finder-back';button.textContent='백업한 초안 내려받기';button.addEventListener('click',()=>{const data=localStorage.getItem(backupKey);const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sbs-study-draft-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});panel.querySelector('#study-status')?.after(button);
 }catch(error){status('최신 기록으로 전환하지 못했어요. 현재 초안은 유지돼요. '+error.message);}
}
async function syncPublicRecords(){
 publicFailure='';
 try{
  publicLibrary=await fetchLibrary();publicReady=true;
  if(recordId&&!readLatest()){
   const record=publicLibrary.records.find(item=>item.id===recordId);
   if(record){study=normalizedStudy(record.study);recordVersion=record.version;}
  }
 }catch(error){publicFailure=error.message;}
 render();
}
addEventListener('hashchange',render);
render();
syncPublicRecords();
const pause=document.querySelector('.finder-pause');
pause?.addEventListener('click',()=>{const paused=pause.getAttribute('aria-pressed')!=='true';pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?'흐름 재생하기':'흐름 멈추기';document.querySelector('.finder-ticker').classList.toggle('is-paused',paused);});
