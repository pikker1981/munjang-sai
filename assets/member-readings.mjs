import {PEOPLE,normalizeStudy} from './study-records.mjs';
import {fetchLibrary,publishStudy,cachedLibrary,libraryHasCache} from './study-client.mjs';
import {beginLoading} from './loading.mjs';
import {revealPanel} from './motion.mjs';

// Fresh public data may replace an untouched editor, never a draft or active save.
export function pristineReadingRebase(state,member){
 const base=state?.base;
 if(!base||state.saving||state.hasDraft||state.draftRecovered||state.range!==base.range||state.content!==base.content)return null;
 const range=member?.range||'',content=member?.content||'';
 return {range,content,base:{range,content}};
}

export function readingAnchorFocusTarget(target,guide){
 if(!target||!guide||(target!==guide&&!guide.contains(target)))return null;
 if(target.matches('details'))return target.querySelector(':scope > summary')||target;
 if(target.matches('a[href],button,input,textarea,select,summary'))return target;
 const summary=target.closest('summary');if(summary&&guide.contains(summary))return summary;
 if(target===guide)return guide.querySelector('h2,h3')||guide;
 const heading=target.matches('h1,h2,h3,h4,h5,h6')?target:target.closest('h1,h2,h3,h4,h5,h6')||target.querySelector('h2,h3,h4,h5,h6');
 if(heading&&guide.contains(heading))return heading;
 const details=target.closest('details');
 return details&&guide.contains(details)?details.querySelector(':scope > summary')||target:target;
}

const host=document.querySelector('#member-readings');
if(host){
 let recordId=host.dataset.recordId||new URLSearchParams(location.search).get('record')||'';
 const guide=document.querySelector('#chapter-guide');
 const states=new Map();
 let library,record,ready=false,loadRun=0,recordSource='';
 let selectedReader='dongjin',lastReader='',scrollFrame=0;
 const key=id=>'sbs-member-reading-draft-v1:'+recordId+':'+id;

 host.insertAdjacentHTML('beforeend',`<div class="member-reading-library-status" data-library-state="loading" role="status"><p data-library-message>공통 기록에서 최신 정리를 확인하고 있어요.</p><div class="member-reading-library-actions"><button type="button" class="member-reading-confirm" data-library-retry hidden>최신 기록 다시 불러오기</button><a href="index.html#bookshelf" data-library-return hidden>함께 읽는 책으로 돌아가기</a></div></div><nav class="member-reading-nav" aria-label="멤버별 정리 선택">${PEOPLE.map(([id,name])=>`<a href="#member-reading-${id}" aria-controls="member-reading-${id}">${name}</a>`).join('')}</nav><div class="member-reading-list">${PEOPLE.map(([id,name])=>`<details class="member-reading-category" id="member-reading-${id}" data-reader="${id}"><summary><span>${name}</span><small data-range-label>담당 부분을 확인하고 있어요.</small></summary><div class="member-reading-body">${id==='dongjin'&&guide?'<a class="member-reading-guide-link" href="#chapter-guide">일곱 장 상세 읽기 <span aria-hidden="true">↓</span></a>':''}<p class="member-reading-saved" data-saved>저장된 정리 내용을 확인하고 있어요.</p><p class="member-reading-draft-notice" data-draft-notice role="status" hidden></p><button type="button" class="member-reading-edit-toggle" data-editor-toggle="${id}" aria-controls="member-reading-form-${id}" aria-expanded="false" disabled>정리 작성 열기</button><form id="member-reading-form-${id}" data-reader-form="${id}" hidden><label for="reading-range-${id}">담당 부분 · 쪽수 / 장</label><input id="reading-range-${id}" name="range" maxlength="300" disabled><label for="reading-content-${id}">${name}의 본문 정리</label><textarea id="reading-content-${id}" name="content" maxlength="20000" rows="10" placeholder="담당 부분의 내용과 핵심 생각, 발제 내용을 직접 정리해주세요." disabled></textarea><p class="member-reading-note">입력 중에는 이 브라우저에 초안으로 보관해요. 저장하면 이 책의 공통 정리와 모임 정리 화면에 함께 반영돼요.</p><button type="submit" class="member-reading-save" disabled>${name} 정리 저장</button><p class="member-reading-status" role="status"></p><div data-conflict></div></form>${id==='dongjin'&&guide?'<div data-existing-reading><p class="member-reading-original-label">동진의 기존 일곱 장 상세 자료</p></div>':''}</div></details>`).join('')}</div>`);
 if(guide)host.querySelector('[data-existing-reading]').append(guide);

 const feedback=host.querySelector('.member-reading-library-status');
 const retry=feedback.querySelector('[data-library-retry]');
 const returnLink=feedback.querySelector('[data-library-return]');
 const panel=id=>host.querySelector(`[data-reader="${id}"]`);
 const snapshot=member=>({range:member?.range||'',content:member?.content||''});
 const same=(a,b)=>a.range===b.range&&a.content===b.content;
 const draftJSON=state=>JSON.stringify({range:state.range,content:state.content,base:state.base});
 const readerName=id=>PEOPLE.find(person=>person[0]===id)?.[1]||'';

 function emitRecord(state,{source=recordSource,errorKind=''}={}){
  document.dispatchEvent(new CustomEvent('sbs:reading-record',{detail:{state,record:record||null,source,errorKind}}));
 }
 function setFeedback(message,{state='ready',canRetry=false,canReturn=false}={}){
  feedback.dataset.libraryState=state;
  feedback.querySelector('[data-library-message]').textContent=message;
  retry.hidden=!canRetry;retry.disabled=state==='loading';
  retry.textContent=state==='loading'?'최신 기록 확인 중…':'최신 기록 다시 불러오기';
  returnLink.hidden=!canReturn;
 }
 function hashTarget(){try{return document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch{return null;}}
 function revealOriginal({scroll=false,focus=false}={}){
  const target=hashTarget();
  const original=target&&guide&&(target===guide||guide.contains(target));
  const category=original?panel('dongjin'):target?.closest('.member-reading-category');
  if(category)selectedReader=category.dataset.reader;
  const changed=lastReader!==selectedReader;
  host.querySelectorAll('.member-reading-category').forEach(item=>{
   const selected=item.dataset.reader===selectedReader;
   if(changed)item.querySelector('.member-reading-body').getAnimations?.().forEach(animation=>animation.cancel());
   item.hidden=!selected;item.open=selected;
  });
  let selectedLink;
  host.querySelectorAll('.member-reading-nav a').forEach(link=>{
   if(link.hash==='#member-reading-'+selectedReader){link.setAttribute('aria-current','page');selectedLink=link;}
   else link.removeAttribute('aria-current');
  });
  if(changed){lastReader=selectedReader;revealPanel(panel(selectedReader).querySelector('.member-reading-body'));}
  cancelAnimationFrame(scrollFrame);
  if(scroll&&(category||target===host)){
   scrollFrame=requestAnimationFrame(()=>{
    const destination=original?target:host;
    if(!destination?.getClientRects().length)return;
    if(focus){
     const focusTarget=original?readingAnchorFocusTarget(target,guide):(target===host?host.querySelector('h2'):target?.matches('a,button,input,textarea,select,summary')?target:selectedLink);
     if(focusTarget){if(!focusTarget.matches('a[href],button,input,textarea,select,summary,[tabindex]'))focusTarget.setAttribute('tabindex','-1');focusTarget.focus({preventScroll:true});}
    }
    destination.scrollIntoView({block:'start',behavior:'instant'});
   });
  }
 }
 addEventListener('hashchange',()=>revealOriginal({scroll:true,focus:true}));
 host.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');
  if(link&&link.hash===location.hash&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();revealOriginal({scroll:true,focus:true});}
  if(event.target.closest('.member-reading-category > summary'))event.preventDefault();
  const toggle=event.target.closest('[data-editor-toggle]');
  if(toggle){
   const id=toggle.dataset.editorToggle,state=states.get(id);if(!state)return;
   state.editorOpen=!state.editorOpen;renderEditor(id);
   if(state.editorOpen){revealPanel(panel(id).querySelector('[data-reader-form]'));if(ready)panel(id).querySelector('[name="content"]').focus({preventScroll:true});}
  }
 });
 revealOriginal({scroll:Boolean(location.hash),focus:Boolean(location.hash)});

 function backups(id){
  const el=panel(id);el.querySelector('.member-reading-backups')?.remove();
  try{
   const keys=Object.keys(localStorage).filter(k=>k.startsWith(key(id)+':backup:')).sort().reverse();if(!keys.length)return;
   const details=document.createElement('details');details.className='member-reading-backups';
   const summary=document.createElement('summary');summary.textContent='이 브라우저의 추가 초안 · '+keys.length+'개';details.append(summary);
   keys.forEach((savedKey,index)=>{
    const button=document.createElement('button');button.type='button';button.className='member-reading-confirm';button.textContent='추가 초안 '+(index+1)+' 내려받기';
    button.addEventListener('click',()=>{
     const raw=localStorage.getItem(savedKey),url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
     const a=document.createElement('a');a.href=url;a.download='sbs-'+id+'-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });details.append(button);
   });el.querySelector('[data-reader-form]').append(details);
  }catch{}
 }
 function renderEditor(id){
  const state=states.get(id),el=panel(id);if(!state)return;
  const form=el.querySelector('[data-reader-form]'),toggle=el.querySelector('[data-editor-toggle]');
  if(!state.editorOpen&&form.contains(document.activeElement))toggle.focus({preventScroll:true});
  form.hidden=!state.editorOpen;
  toggle.disabled=false;toggle.setAttribute('aria-expanded',String(state.editorOpen));
  toggle.textContent=(record?.study.members[id].content?'정리 수정':'정리 작성')+(state.editorOpen?' 접기':' 열기');
  el.querySelectorAll('input,textarea').forEach(control=>control.disabled=!ready);
  const button=form.querySelector('button[type="submit"]');button.disabled=!ready||state.saving;
  const notice=el.querySelector('[data-draft-notice]');notice.hidden=!state.hasDraft;
  if(state.hasDraft)notice.textContent=state.draftRecovered?'이 브라우저에 보관된 초안을 불러왔어요. 작성 공간에서 이어 쓸 수 있어요.':'이 브라우저에 작성 중인 초안이 있어요. 멤버를 바꾸거나 작성 공간을 접어도 유지돼요.';
 }
 function renderPublic(id){
  const el=panel(id),member=record.study.members[id];
  el.querySelector('[data-range-label]').textContent=member.range||'담당 부분 미정';
  el.querySelector('[data-saved]').textContent=member.content||'아직 공개한 정리 내용이 없어요. ‘정리 작성’을 열어 직접 작성할 수 있어요.';
  renderEditor(id);
 }
 function initializeEditor(id,{draftOnly=false}={}){
  if(states.has(id))return;
  const base=snapshot(record?.study.members[id]);let draft,raw=null;
  try{raw=localStorage.getItem(key(id));draft=JSON.parse(raw||'null');}catch{}
  const valid=draft&&typeof draft.range==='string'&&typeof draft.content==='string'&&draft.base&&typeof draft.base.range==='string'&&typeof draft.base.content==='string';
  if(draftOnly&&!valid)return;
  const state={...(valid?{range:draft.range.slice(0,300),content:draft.content.slice(0,20000),base:snapshot(draft.base)}:{...base,base}),lastRaw:raw,draftKey:key(id),editorOpen:Boolean(valid),hasDraft:Boolean(valid),draftRecovered:Boolean(valid),saving:false};
  states.set(id,state);
  const form=panel(id).querySelector('[data-reader-form]');form.elements.range.value=state.range;form.elements.content.value=state.content;
  backups(id);
 }
 function rebaseEditor(id){
  const state=states.get(id),next=pristineReadingRebase(state,record.study.members[id]);if(!next)return;
  Object.assign(state,next);
  const form=panel(id).querySelector('[data-reader-form]');form.elements.range.value=state.range;form.elements.content.value=state.content;
 }
 function renderBookHeader(){
  const header=document.querySelector('[data-reading-book]');if(!header)return;
  const study=record.study;document.title=study.book+' — 독서 가이드 · S.B.S';
  header.querySelector('h1').textContent=study.book;
  header.querySelector('[data-reading-author]').textContent=study.bookInfo?.author||'함께 읽을 다음 책';
  header.querySelector('[data-reading-intro]').textContent=study.bookSummary||'아래 멤버별 공간에서 이 책의 내용을 함께 정리해요.';
  header.querySelector('[data-reading-meeting]').textContent=(study.date||'날짜 미정')+' · '+(study.time||'시간 미정')+(study.place?' · '+study.place:'');
  const image=header.querySelector('img'),emptyCover=header.querySelector('[data-reading-cover-empty]');
  image.hidden=true;emptyCover.hidden=false;
  try{
   const url=new URL(study.bookInfo?.cover,location.href);
   if(study.bookInfo?.cover==='assets/book-silence-cover.jpg'||(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&['image.aladin.co.kr','image.yes24.com','contents.kyobobook.co.kr','image.kyobobook.co.kr'].includes(url.hostname))){image.src=url.href;image.alt=study.book+' 표지';image.hidden=false;emptyCover.hidden=true;}
  }catch{}
  const summaryLink=header.querySelector('[data-reading-summary]');summaryLink.href='find.html?record='+encodeURIComponent(recordId)+'#summary';summaryLink.hidden=false;
  header.querySelector('[data-reading-original]').hidden=recordId!=='silence';
 }
 function adoptLibrary(nextLibrary,source){
  const id=recordId||nextLibrary.latestId,nextRecord=nextLibrary.records.find(item=>item.id===id);
  if(!nextRecord){const error=Error('이 책의 모임 기록을 찾지 못했어요.');error.code='RECORD_NOT_FOUND';throw error;}
  recordId=id;library=nextLibrary;record=nextRecord;recordSource=source;ready=source==='network';
  renderBookHeader();
  for(const [id]of PEOPLE){initializeEditor(id);if(source==='network')rebaseEditor(id);renderPublic(id);}
  if(guide&&!host.querySelector('[data-reading-summary-link]')){
   const link=document.createElement('a');link.className='member-reading-summary-link';link.dataset.readingSummaryLink='';link.href='find.html?record='+encodeURIComponent(recordId)+'#summary';link.textContent='이 책의 전체 모임 정리 보기 ↗';host.querySelector('.member-reading-nav').after(link);
  }
 }
 function showUnavailable(kind){
  ready=false;
  const message=kind==='not-found'?'이 책의 모임 기록이 없어요. 책장에서 다른 기록을 선택해주세요.':'공통 기록에 연결하지 못했어요. 다시 불러오기를 누르면 최신 정리를 확인할 수 있어요.';
  if(!record){
   for(const [id]of PEOPLE){panel(id).querySelector('[data-range-label]').textContent='담당 부분을 확인할 수 없어요.';panel(id).querySelector('[data-saved]').textContent=kind==='not-found'?'이 책의 공개 기록을 찾지 못했어요.':'공개한 정리를 아직 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.';}
   const header=document.querySelector('[data-reading-book]');
   if(header){header.querySelector('h1').textContent=kind==='not-found'?'이 책의 모임 기록이 없어요':'책의 기록을 불러오지 못했어요';header.querySelector('[data-reading-intro]').textContent=message;}
  }
  for(const [id]of PEOPLE)renderEditor(id);
  return message;
 }
 async function load(){
  const run=++loadRun;
  ready=false;for(const [id]of PEOPLE){if(recordId)initializeEditor(id,{draftOnly:true});renderEditor(id);}
  setFeedback('공통 기록에서 최신 정리를 확인하고 있어요.',{state:'loading',canRetry:true});emitRecord('loading');
  const loadingViews=PEOPLE.map(([id])=>beginLoading(panel(id).querySelector('[data-saved]'),{label:readerName(id)+'의 공개 정리를 불러오고 있어요.',kind:'text',preserve:Boolean(record)}));
  const bookHeader=document.querySelector('[data-reading-book]');
  const headerLoading=bookHeader?beginLoading(bookHeader.querySelector('[data-reading-intro]'),{label:'책과 모임 정보를 불러오고 있어요.',kind:'text',preserve:Boolean(record)}):null;
  try{
   const nextLibrary=await fetchLibrary();if(run!==loadRun)return;
   adoptLibrary(nextLibrary,'network');
   setFeedback('공통 기록의 최신 정리예요. 이름을 선택해 읽고, 필요한 경우 작성 공간을 열어주세요.');emitRecord('ready');
  }catch(error){
   if(run!==loadRun)return;
   const kind=error.code==='RECORD_NOT_FOUND'?'not-found':'network';
   let usingCache=false;
   if(kind==='network'){
    try{if(libraryHasCache()){adoptLibrary(cachedLibrary(),'cache');usingCache=true;}}catch{}
   }
   if(usingCache){
    setFeedback('연결하지 못해 이 브라우저에 보관된 공개 기록을 보여드려요. 최신 기록을 확인한 뒤 작성·저장할 수 있어요. 초안은 그대로 유지돼요.',{state:'cache',canRetry:true});emitRecord('ready',{source:'cache',errorKind:kind});
   }else{
    const message=showUnavailable(kind);
    setFeedback(message+(record?' 이 화면에 열려 있던 정리와 입력한 초안은 그대로 유지돼요. 최신 기록을 확인한 뒤 작성·저장할 수 있어요.':''),{state:'error',canRetry:true,canReturn:kind==='not-found'});emitRecord('error',{errorKind:kind});
   }
  }finally{
   loadingViews.forEach(view=>view.finish());headerLoading?.finish();
  }
 }
 retry.addEventListener('click',()=>load());
 host.addEventListener('input',event=>{
  const form=event.target.closest('[data-reader-form]');if(!form)return;
  const id=form.dataset.readerForm,state=states.get(id);if(!state)return;
  state.range=form.elements.range.value;state.content=form.elements.content.value;state.hasDraft=true;state.draftRecovered=false;
  try{
   const existing=localStorage.getItem(state.draftKey);if(existing!==state.lastRaw&&existing!==null)state.draftKey=key(id)+':backup:'+Date.now();
   const raw=draftJSON(state);localStorage.setItem(state.draftKey,raw);state.lastRaw=raw;
   form.querySelector('.member-reading-status').textContent=state.draftKey===key(id)?'초안을 이 브라우저에 저장했어요.':'다른 탭의 초안을 보존하고 현재 입력은 추가 초안으로 저장했어요.';backups(id);
  }catch{form.querySelector('.member-reading-status').textContent='초안을 저장하지 못했어요. 현재 입력 내용은 유지돼요.';}
  renderEditor(id);
 });
 async function save(id){
  const el=panel(id),state=states.get(id),status=el.querySelector('.member-reading-status'),button=el.querySelector('button[type="submit"]');
  if(!state||!ready||state.saving)return;
  state.saving=true;button.disabled=true;button.textContent='공개 저장 중…';button.setAttribute('aria-busy','true');
  status.textContent='최신 기록을 확인하고 정리를 공개 저장하고 있어요.';
  const submitted=snapshot(state),base=snapshot(state.base);
  try{
   const fresh=await fetchLibrary(),current=fresh.records.find(item=>item.id===recordId);if(!current)throw Error('기록을 찾지 못했어요. 초안은 유지돼요.');
   const latest=snapshot(current.study.members[id]);
   if(!same(base,latest)&&!same(submitted,latest)){
    status.textContent='다른 곳에서 이 멤버의 정리를 수정했어요. 공개된 최신 내용과 비교한 뒤 저장해주세요.';
    const box=el.querySelector('[data-conflict]');box.replaceChildren();const text=document.createElement('pre');text.className='member-reading-compare';text.textContent='최신 공개 내용\n'+latest.range+'\n\n'+latest.content;
    const confirm=document.createElement('button');confirm.type='button';confirm.className='member-reading-confirm';confirm.textContent='최신 내용 확인 완료 · 현재 입력으로 저장';
    confirm.addEventListener('click',()=>{state.base=latest;box.replaceChildren();save(id);});box.append(text,confirm);return;
   }
   const next=normalizeStudy(current.study);next.members[id]={...next.members[id],...submitted};
   const result=await publishStudy(next,{recordId,library:fresh,recordVersion:current.version});
   if(!result){status.textContent='공개 저장을 취소했어요. 초안은 그대로 남아 있어요.';return;}
   library=result.library;record=library.records.find(item=>item.id===recordId);recordSource='network';
   const editedDuringSave=!same(snapshot(state),submitted);state.base=submitted;state.hasDraft=editedDuringSave;state.draftRecovered=false;
   let draftPreserved=true;
   try{
    if(localStorage.getItem(state.draftKey)===state.lastRaw){
     if(!editedDuringSave){localStorage.removeItem(state.draftKey);state.lastRaw=null;}
     else{const raw=draftJSON(state);localStorage.setItem(state.draftKey,raw);state.lastRaw=raw;}
    }else if(editedDuringSave){state.draftKey=key(id)+':backup:'+Date.now();state.lastRaw=draftJSON(state);localStorage.setItem(state.draftKey,state.lastRaw);}
   }catch{draftPreserved=false;}
   backups(id);for(const [memberId]of PEOPLE){rebaseEditor(memberId);renderPublic(memberId);}emitRecord('ready');
   status.textContent=editedDuringSave?(draftPreserved?'입력했던 정리를 공개 저장했어요. 저장 중 추가한 내용은 초안으로 남아 있어요.':'입력했던 정리는 공개 저장했지만 추가로 입력한 초안은 저장하지 못했어요. 현재 화면을 닫기 전에 내려받아주세요.'):'정리를 공개 저장했어요. 다른 방문자도 같은 내용을 볼 수 있어요.';
   el.querySelector('.member-memory-download')?.remove();
   if(editedDuringSave&&!draftPreserved){
    const download=document.createElement('button');download.type='button';download.className='member-reading-confirm member-memory-download';download.textContent='현재 입력한 초안 내려받기';
    download.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([draftJSON(state)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sbs-'+id+'-unsaved-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});status.after(download);
   }
  }catch(error){status.textContent=error.message+' 입력한 초안은 유지돼요.';}
  finally{state.saving=false;button.textContent=readerName(id)+' 정리 저장';button.removeAttribute('aria-busy');renderEditor(id);}
 }
 host.addEventListener('submit',event=>{const form=event.target.closest('[data-reader-form]');if(!form)return;event.preventDefault();save(form.dataset.readerForm);});
 load();
}
