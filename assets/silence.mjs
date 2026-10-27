const sectionLinks=[...document.querySelectorAll('.silence-rail nav a')];
const sections=sectionLinks.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
const progress=document.querySelector('.silence-progress span');
let scrollQueued=false;
function updateReading(){
  const threshold=innerWidth<=767?160:140;
  let current=sections[0];
  for(const section of sections){if(section.getBoundingClientRect().top<=threshold)current=section;}
  sectionLinks.forEach(a=>{if(a.hash===`#${current?.id}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
  if(sections.length&&progress){const top=sections[0].getBoundingClientRect().top+scrollY;const end=sections.at(-1).getBoundingClientRect().bottom+scrollY-innerHeight;const fraction=Math.max(0,Math.min(1,(scrollY-top+threshold)/Math.max(1,end-top+threshold)));progress.style.width=`${Math.round(fraction*100)}%`;}
  scrollQueued=false;
}
addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateReading);}},{passive:true});
addEventListener('resize',updateReading);
updateReading();
const note=document.querySelector('#silence-note');
const save=document.querySelector('#silence-note-save');
const remove=document.querySelector('#silence-note-delete');
const count=document.querySelector('#silence-note-count');
const status=document.querySelector('#silence-note-status');
const noteKey='munjang-sai-silence-notes-v1';
if(note&&save&&remove&&status){
  function updateCount(){count.textContent=`${note.value.length.toLocaleString('ko-KR')} / 2,000자`;}
  save.disabled=false;remove.disabled=false;
  try{const stored=localStorage.getItem(noteKey);if(stored!==null){note.value=stored.slice(0,2000);status.textContent='이 브라우저에 저장된 노트를 불러왔어요.';}else status.textContent='아직 저장하지 않았어요. 저장 버튼을 누르면 이 브라우저에만 보관돼요.';}
  catch{status.textContent='브라우저 저장 공간에 접근할 수 없어요. 적은 내용은 직접 복사해 보관해 주세요.';}
  updateCount();
  note.addEventListener('input',()=>{updateCount();status.textContent='편집 중이에요. 저장 버튼을 눌러야 변경 내용이 보관돼요.';});
  save.addEventListener('click',()=>{try{localStorage.setItem(noteKey,note.value);status.textContent='이 브라우저에 노트를 저장했어요. 외부로 전송하지 않았어요.';}catch{status.textContent='노트를 저장하지 못했어요. 브라우저 저장 공간을 확인하거나 내용을 직접 복사해 보관해 주세요.';}});
  remove.addEventListener('click',()=>{try{localStorage.removeItem(noteKey);note.value='';updateCount();status.textContent='이 브라우저의 노트와 입력 내용을 삭제했어요.';}catch{status.textContent='저장된 노트를 삭제하지 못했어요. 입력 내용은 지우지 않았어요. 브라우저 저장 공간 설정을 확인해 주세요.';}});
}
