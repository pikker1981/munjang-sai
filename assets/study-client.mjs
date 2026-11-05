import {normalizeLibrary,commitRecord} from './study-records.mjs';
export const studiesApi=typeof location!=='undefined'&&['127.0.0.1','localhost'].includes(location.hostname)&&location.port==='4180'?location.origin+'/api/studies':'https://sbs-book-info-api.vercel.app/api/studies';
const cacheKey='sbs-public-library-cache-v1';
let newBookRequiresAdmin=true,adminPassword='';const writerPasswords=new Map();
export function cachedLibrary(){try{return normalizeLibrary(JSON.parse(localStorage.getItem(cacheKey)||'null'));}catch{return normalizeLibrary(null);}}
export function libraryHasCache(){try{const raw=JSON.parse(localStorage.getItem(cacheKey)||'null');if(!raw)return false;normalizeLibrary(raw);return true;}catch{return false;}}
function cache(library){try{localStorage.setItem(cacheKey,JSON.stringify(library));}catch{}}
export async function fetchLibrary(){
 try{
  const response=await fetch(studiesApi,{cache:'no-store',signal:AbortSignal.timeout(20000)});
  const data=await response.json();if(!response.ok){const error=Error(data.error||'공통 모임 기록을 불러오지 못했어요.');error.status=response.status;throw error;}
  newBookRequiresAdmin=data.policy?.newBookRequiresAdmin!==false;
  const library=normalizeLibrary(data.library);cache(library);return library;
 }catch(error){if(error.name==='TimeoutError'||error.name==='AbortError')throw Error('연결 시간이 길어졌어요. 잠시 후 다시 시도해주세요.');if(error instanceof TypeError)throw Error('공통 기록 서버에 연결하지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.');throw error;}
}
export function forgetEditorPassword(){adminPassword='';writerPasswords.clear();}
export async function publishStudy(study,{recordId,library,recordVersion}={}){
 const tentative=commitRecord(library,study,{recordId}),nextId=recordId||tentative.latestId;
 const expectedRecordVersion=recordId?recordVersion:(library.records.find(record=>record.id===nextId)?.version||0);
 const cachedPassword=recordId?(adminPassword||writerPasswords.get(recordId)):'';
 const credentials=cachedPassword?{password:cachedPassword}:await requestCredentials(!recordId);
 if(credentials===null)return null;
 const headers={'Content-Type':'application/json'};
 const response=await fetch(studiesApi,{method:'POST',headers,body:JSON.stringify({study,recordId:recordId||null,expectedRecordVersion,password:credentials.password||'',...(!recordId?{newPassword:credentials.newPassword}:{})}),signal:AbortSignal.timeout(25000)});
 const data=await response.json();
 if(!response.ok){if(response.status===401){adminPassword='';writerPasswords.delete(recordId);}const error=Error(data.error||'공통 기록을 저장하지 못했어요. 초안은 유지돼요.');error.status=response.status;if(/^[a-z0-9_-]{1,80}$/.test(data.existingRecordId||''))error.existingRecordId=data.existingRecordId;throw error;}
 if(data.access==='admin')adminPassword=credentials.password;
 if(!recordId)writerPasswords.set(data.recordId,credentials.newPassword);else if(data.access==='writer')writerPasswords.set(recordId,credentials.password);
 const published=normalizeLibrary(data.library);cache(published);return {library:published,recordId:data.recordId};
}
function requestCredentials(isNew){
 return new Promise(resolve=>{
  const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='study-password-dialog';
  dialog.setAttribute('aria-labelledby','study-password-title');
  const askAdmin=isNew&&newBookRequiresAdmin&&!adminPassword;
  dialog.innerHTML='<form method="dialog"><p class="finder-eyebrow">S.B.S · 공통 모임 기록</p><h2>'+(isNew?'작성자 비밀번호 설정':'모임 기록 저장')+'</h2><p>'+(isNew?'이 책을 수정할 때 사용할 비밀번호를 정해주세요. 관리자는 별도의 관리자 비밀번호로 모든 책을 수정할 수 있어요.':'이 책의 작성자 비밀번호 또는 관리자 비밀번호를 입력해주세요.')+'</p>'+(isNew?'<label for="study-writer-password">이 책의 작성자 비밀번호</label><input type="password" id="study-writer-password" name="newPassword" autocomplete="new-password" required minlength="8" maxlength="200"><label for="study-writer-confirm">작성자 비밀번호 확인</label><input type="password" id="study-writer-confirm" name="confirmation" autocomplete="new-password" required minlength="8" maxlength="200"><p class="member-reading-note">8자 이상 · 비밀번호는 잊지 않도록 따로 보관해주세요.</p>':'')+(!isNew||askAdmin?'<label for="study-editor-password">'+(askAdmin?'관리자 비밀번호':'편집 비밀번호')+'</label><input type="password" id="study-editor-password" name="password" autocomplete="current-password" required maxlength="200">':'')+'<div><button type="button" class="finder-back" data-cancel>취소</button><button type="submit" class="finder-primary">확정하고 공개하기</button></div></form>';
  dialog.querySelector('h2').id='study-password-title';
  document.body.append(dialog);let settled=false;
  function finish(value){if(settled)return;settled=true;dialog.close();dialog.remove();previous?.focus({preventScroll:true});resolve(value);}
  dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;
   if(isNew&&form.elements.newPassword.value!==form.elements.confirmation.value){form.elements.confirmation.setCustomValidity('작성자 비밀번호가 서로 달라요.');form.elements.confirmation.reportValidity();return;}
   finish({password:form.elements.password?.value||(isNew&&newBookRequiresAdmin?adminPassword:''),...(isNew?{newPassword:form.elements.newPassword.value}:{})});
  });
  dialog.querySelector('[name="confirmation"]')?.addEventListener('input',event=>event.target.setCustomValidity(''));
  dialog.querySelector('[data-cancel]').addEventListener('click',()=>finish(null));dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.showModal();dialog.querySelector('input').focus();
 });
}
