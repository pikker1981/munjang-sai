import {normalizeLibrary,commitRecord} from './study-records.mjs';
export const studiesApi=typeof location!=='undefined'&&['127.0.0.1','localhost'].includes(location.hostname)&&location.port==='4180'?location.origin+'/api/studies':'https://sbs-book-info-api.vercel.app/api/studies';
const cacheKey='sbs-public-library-cache-v1';
export function cachedLibrary(){try{return normalizeLibrary(JSON.parse(localStorage.getItem(cacheKey)||'null'));}catch{return normalizeLibrary(null);}}
function cache(library){try{localStorage.setItem(cacheKey,JSON.stringify(library));}catch{}}
export async function fetchLibrary(){
 const response=await fetch(studiesApi,{cache:'no-store',signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok)throw Error(data.error||'공통 모임 기록을 불러오지 못했어요.');
 const library=normalizeLibrary(data.library);cache(library);return library;
}
let editorPassword='';
export function forgetEditorPassword(){editorPassword='';}
export async function publishStudy(study,{recordId,library,recordVersion}={}){
 const tentative=commitRecord(library,study,{recordId});
 const nextId=recordId||tentative.latestId;
 const expectedRecordVersion=recordId?recordVersion:(library.records.find(record=>record.id===nextId)?.version||0);
 const password=editorPassword||await requestEditorPassword();
 if(password===null)return null;
 const response=await fetch(studiesApi,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+password},body:JSON.stringify({study,recordId:recordId||null,expectedRecordVersion}),signal:AbortSignal.timeout(25000)});
 const data=await response.json();
 if(!response.ok){if(response.status===401)editorPassword='';const error=Error(data.error||'공통 기록을 저장하지 못했어요. 초안은 유지돼요.');error.status=response.status;if(/^[a-z0-9_-]{1,80}$/.test(data.existingRecordId||''))error.existingRecordId=data.existingRecordId;throw error;}
 editorPassword=password;
 const published=normalizeLibrary(data.library);cache(published);
 return {library:published,recordId:data.recordId};
}
function requestEditorPassword(){
 return new Promise(resolve=>{
  const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='study-password-dialog';
  dialog.innerHTML='<form method="dialog"><p class="finder-eyebrow">S.B.S · 공통 모임 기록</p><h2>모임 기록 저장</h2><p>확정한 정보가 모든 방문자에게 공개돼요.<br>모임 편집 암호를 입력해주세요.</p><label for="study-editor-password">편집 암호</label><input type="password" id="study-editor-password" name="password" autocomplete="current-password" required maxlength="200"><div><button type="button" class="finder-back" data-cancel>취소</button><button type="submit" class="finder-primary">확정하고 공개하기</button></div></form>';
  document.body.append(dialog);let settled=false;
  function finish(value){if(settled)return;settled=true;dialog.close();dialog.remove();previous?.focus({preventScroll:true});resolve(value);}
  dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();finish(dialog.querySelector('input').value);});
  dialog.querySelector('[data-cancel]').addEventListener('click',()=>finish(null));dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
  dialog.showModal();dialog.querySelector('input').focus();
 });
}
