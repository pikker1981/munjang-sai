import {PEOPLE,normalizeStudy} from './study-records.mjs';
import {fetchLibrary,publishStudy} from './study-client.mjs';
const host=document.querySelector('#member-readings');
const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(host){
 const recordId=host.dataset.recordId||'silence',guide=document.querySelector('#chapter-guide');
 let library,record,ready=false;
 const states=new Map();
 const key=id=>'sbs-member-reading-draft-v1:'+recordId+':'+id;
 host.insertAdjacentHTML('beforeend',`<nav class="member-reading-nav" aria-label="멤버별 정리 선택">${PEOPLE.map(([id,name])=>`<a href="#member-reading-${id}">${name}</a>`).join('')}</nav><div class="member-reading-list">${PEOPLE.map(([id,name])=>`<details class="member-reading-category" id="member-reading-${id}" data-reader="${id}"><summary><span>${name}</span><small data-range-label>담당 부분을 확인하고 있어요.</small></summary><div class="member-reading-body"><p class="member-reading-saved" data-saved>공통 정리 내용을 불러오고 있어요.</p><form data-reader-form="${id}"><label for="reading-range-${id}">담당 부분 · 쪽수 / 장</label><input id="reading-range-${id}" name="range" maxlength="300" disabled><label for="reading-content-${id}">${name}의 본문 정리</label><textarea id="reading-content-${id}" name="content" maxlength="20000" rows="10" placeholder="담당 부분의 내용과 핵심 생각, 발제 내용을 직접 정리해주세요." disabled></textarea><p class="member-reading-note">입력 중에는 이 브라우저에 초안으로 보관해요. 저장하면 이 책의 공통 정리와 모임 정리 화면에 함께 반영돼요.</p><button type="submit" class="member-reading-save" disabled>${name} 정리 저장</button><p class="member-reading-status" role="status"></p><div data-conflict></div></form>${id==='dongjin'?'<div data-existing-reading><p class="member-reading-original-label">동진의 기존 일곱 장 상세 자료</p></div>':''}</div></details>`).join('')}</div>`);
 if(guide){host.querySelector('[data-existing-reading]').append(guide);}
 function revealOriginal(){const target=document.getElementById(location.hash.slice(1));const original=target&&guide?.contains(target);const category=original?host.querySelector('[data-reader="dongjin"]'):target?.closest('.member-reading-category');if(category){host.querySelectorAll('.member-reading-category').forEach(item=>item.open=item===category);if(!original&&target===category)requestAnimationFrame(()=>category.scrollIntoView({block:'start',behavior:'instant'}));}}
 addEventListener('hashchange',revealOriginal);revealOriginal();
 function panel(id){return host.querySelector(`[data-reader="${id}"]`);}
 function snapshot(member){return {range:member?.range||'',content:member?.content||''};}
 function same(a,b){return a.range===b.range&&a.content===b.content;}
 function draftJSON(state){return JSON.stringify({range:state.range,content:state.content,base:state.base});}
 function backups(id){
  const el=panel(id);el.querySelector('.member-reading-backups')?.remove();
  try{const keys=Object.keys(localStorage).filter(k=>k.startsWith(key(id)+':backup:')).sort().reverse();if(!keys.length)return;
   const details=document.createElement('details');details.className='member-reading-backups';const summary=document.createElement('summary');summary.textContent='이 브라우저의 추가 초안 · '+keys.length+'개';details.append(summary);
   keys.forEach((savedKey,index)=>{const button=document.createElement('button');button.type='button';button.className='member-reading-confirm';button.textContent='추가 초안 '+(index+1)+' 내려받기';button.addEventListener('click',()=>{const raw=localStorage.getItem(savedKey);const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sbs-'+id+'-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});details.append(button);});el.querySelector('[data-reader-form]').append(details);
  }catch{}
 }
 function show(id){
  const state=states.get(id),el=panel(id),member=record.study.members[id];
  el.querySelector('[data-range-label]').textContent=member.range||'담당 부분 미정';
  el.querySelector('[data-saved]').textContent=member.content||'아직 공개한 정리 내용이 없어요. 아래에 직접 작성할 수 있어요.';
  el.querySelector('[name="range"]').value=state.range;el.querySelector('[name="content"]').value=state.content;
  el.querySelectorAll('input,textarea,button[type="submit"]').forEach(control=>control.disabled=!ready);
 }
 async function load(){
  try{
   library=await fetchLibrary();record=library.records.find(item=>item.id===recordId);if(!record)throw Error('이 책의 모임 기록을 찾지 못했어요.');ready=true;
   for(const [id]of PEOPLE){const base=snapshot(record.study.members[id]);let draft,raw=null;try{raw=localStorage.getItem(key(id));draft=JSON.parse(raw||'null');}catch{}
    const valid=draft&&typeof draft.range==='string'&&typeof draft.content==='string'&&draft.base&&typeof draft.base.range==='string'&&typeof draft.base.content==='string';
    states.set(id,{...(valid?{range:draft.range.slice(0,300),content:draft.content.slice(0,20000),base:snapshot(draft.base)}:{...base,base}),lastRaw:raw,draftKey:key(id)});show(id);backups(id);
   }
  }catch(error){for(const [id]of PEOPLE)panel(id).querySelector('.member-reading-status').textContent='공통 기록을 불러오지 못했어요. 잠시 후 새로고침해주세요.';}
 }
 host.addEventListener('input',event=>{
  const form=event.target.closest('[data-reader-form]');if(!form)return;const id=form.dataset.readerForm,state=states.get(id);if(!state)return;
  state.range=form.elements.range.value;state.content=form.elements.content.value;
  try{const existing=localStorage.getItem(state.draftKey);if(existing!==state.lastRaw&&existing!==null)state.draftKey=key(id)+':backup:'+Date.now();const raw=draftJSON(state);localStorage.setItem(state.draftKey,raw);state.lastRaw=raw;form.querySelector('.member-reading-status').textContent=state.draftKey===key(id)?'초안을 이 브라우저에 저장했어요.':'다른 탭의 초안을 보존하고 현재 입력은 추가 초안으로 저장했어요.';backups(id);}catch{form.querySelector('.member-reading-status').textContent='초안을 저장하지 못했어요. 현재 입력 내용은 유지돼요.';}
 });
 async function save(id){
  const el=panel(id),state=states.get(id),status=el.querySelector('.member-reading-status'),button=el.querySelector('button[type="submit"]');
  if(!state||!ready)return;button.disabled=true;const submitted=snapshot(state),base=snapshot(state.base);
  try{
   const fresh=await fetchLibrary(),current=fresh.records.find(item=>item.id===recordId);if(!current)throw Error('기록을 찾지 못했어요. 초안은 유지돼요.');
   const latest=snapshot(current.study.members[id]);
   if(!same(base,latest)&&!same(submitted,latest)){
    status.textContent='다른 곳에서 이 멤버의 정리를 수정했어요. 공개된 최신 내용과 비교한 뒤 저장해주세요.';
    const box=el.querySelector('[data-conflict]');box.replaceChildren();const text=document.createElement('pre');text.className='member-reading-compare';text.textContent='최신 공개 내용\n'+latest.range+'\n\n'+latest.content;const confirm=document.createElement('button');confirm.type='button';confirm.className='member-reading-confirm';confirm.textContent='최신 내용 확인 완료 · 현재 입력으로 저장';confirm.addEventListener('click',()=>{state.base=latest;box.replaceChildren();save(id);});box.append(text,confirm);return;
   }
   const next=normalizeStudy(current.study);next.members[id]={...next.members[id],...submitted};
   const result=await publishStudy(next,{recordId,library:fresh,recordVersion:current.version});if(!result){status.textContent='공개 저장을 취소했어요. 초안은 그대로 남아 있어요.';return;}
   library=result.library;record=library.records.find(item=>item.id===recordId);
   const editedDuringSave=!same(snapshot(state),submitted);state.base=submitted;
   let draftPreserved=true;
   try{if(localStorage.getItem(state.draftKey)===state.lastRaw){if(!editedDuringSave){localStorage.removeItem(state.draftKey);state.lastRaw=null;}else{const raw=draftJSON(state);localStorage.setItem(state.draftKey,raw);state.lastRaw=raw;}}else if(editedDuringSave){state.draftKey=key(id)+':backup:'+Date.now();state.lastRaw=draftJSON(state);localStorage.setItem(state.draftKey,state.lastRaw);}}catch{draftPreserved=false;}
   backups(id);
   el.querySelector('[data-range-label]').textContent=submitted.range||'담당 부분 미정';el.querySelector('[data-saved]').textContent=submitted.content||'공개한 정리 내용이 아직 없어요.';
   status.textContent=editedDuringSave?(draftPreserved?'입력했던 정리를 공개 저장했어요. 저장 중 추가한 내용은 초안으로 남아 있어요.':'입력했던 정리는 공개 저장했지만 추가로 입력한 초안은 저장하지 못했어요. 현재 화면을 닫기 전에 내려받아주세요.'):'정리를 공개 저장했어요. 다른 방문자도 같은 내용을 볼 수 있어요.';
   el.querySelector('.member-memory-download')?.remove();
   if(editedDuringSave&&!draftPreserved){const download=document.createElement('button');download.type='button';download.className='member-reading-confirm member-memory-download';download.textContent='현재 입력한 초안 내려받기';download.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([draftJSON(state)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sbs-'+id+'-unsaved-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});status.after(download);}
  }catch(error){status.textContent=error.message+' 입력한 초안은 유지돼요.';}finally{button.disabled=false;}
 }
 host.addEventListener('submit',event=>{const form=event.target.closest('[data-reader-form]');if(!form)return;event.preventDefault();save(form.dataset.readerForm);});
 load();
}
