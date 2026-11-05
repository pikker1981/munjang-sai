import {PEOPLE} from './study-records.mjs';
import {revealPanel} from './motion.mjs';

const sectionLinks=[...document.querySelectorAll('.silence-rail nav a')];
const sections=sectionLinks.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
const progress=document.querySelector('.silence-progress span');
let activeSection=sections[0],scrollQueued=false,categoryFrame=0;
function hashTarget(){try{return document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch{return null;}}
function updateReading(){
 sectionLinks.forEach(a=>{if(a.hash==='#'+activeSection?.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
 if(activeSection&&progress){const rect=activeSection.getBoundingClientRect(),threshold=innerWidth<=767?160:140;const fraction=Math.max(0,Math.min(1,(threshold-rect.top)/Math.max(1,rect.height-innerHeight+threshold)));progress.style.width=Math.round(fraction*100)+'%';}
 scrollQueued=false;
}
function keepRailVisible(){
 const link=sectionLinks.find(item=>item.hash==='#'+activeSection?.id),nav=link?.parentElement;
 if(!nav||innerWidth>767)return;
 const item=link.getBoundingClientRect(),rail=nav.getBoundingClientRect();
 if(item.left<rail.left+8)nav.scrollLeft-=rail.left+8-item.left;
 else if(item.right>rail.right-8)nav.scrollLeft+=item.right-rail.right+8;
}
function selectCategory(scroll=false,focus=false){
 const target=hashTarget(),guide=document.querySelector('#chapter-guide');
 const selected=sections.find(section=>target&&(section===target||section.contains(target)))||((target&&guide&&(target===guide||guide.contains(target)))?document.querySelector('#member-readings'):null);
 const previous=activeSection;
 if(selected)activeSection=selected;else if(!location.hash)activeSection=sections[0];
 const changed=previous!==activeSection;
 sections.forEach(section=>{if(changed)section.getAnimations?.().forEach(animation=>animation.cancel());section.hidden=section!==activeSection;});
 document.querySelector('.silence-leaves')?.classList.add('has-category-views');updateReading();
 if(changed)revealPanel(activeSection);
 keepRailVisible();cancelAnimationFrame(categoryFrame);
 if(scroll&&selected)categoryFrame=requestAnimationFrame(()=>{
  const member=target?.closest('.member-reading-category');
  const destination=member&&!(guide&&(target===guide||guide.contains(target)))?document.querySelector('#member-readings'):(target?.getClientRects().length?target:selected);
  if(focus&&!member&&!(guide&&(target===guide||guide.contains(target)))){
   const heading=destination?.querySelector('h2,h3')||destination;
   if(heading&&!heading.hasAttribute('tabindex'))heading.setAttribute('tabindex','-1');
   heading?.focus({preventScroll:true});
  }
  destination?.scrollIntoView({block:'start',behavior:'instant'});
 });
}
addEventListener('hashchange',()=>selectCategory(true,true));
document.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=event.target.closest('a[href^="#"]');if(link&&link.hash===location.hash){event.preventDefault();selectCategory(true,true);}});
addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateReading);}},{passive:true});
addEventListener('resize',updateReading);
selectCategory(Boolean(location.hash));
document.addEventListener('DOMContentLoaded',()=>selectCategory(Boolean(location.hash)),{once:true});

// Keep the supplied schedule intact and distinguish it from the shared record.
const schedule=document.querySelector('#schedule');
const heroTime=document.querySelector('.silence-meeting-date time');
if(schedule){
 const originalHero=heroTime?{text:heroTime.textContent,date:heroTime.getAttribute('datetime')}:null;
 const heroLabel=document.createElement('span');heroLabel.className='silence-current-meeting-label';heroLabel.textContent='처음 제공된 일정 · 최신 기록 확인 중';
 heroTime?.before(heroLabel);
 const current=document.createElement('section');current.className='silence-current-record';current.setAttribute('aria-labelledby','silence-current-record-title');current.dataset.state='loading';
 current.innerHTML='<h3 id="silence-current-record-title">현재 모임 정보</h3><p class="silence-current-source" data-current-source role="status">공통 기록에서 최신 일정과 담당 부분을 확인하고 있어요.</p><div data-current-facts hidden><dl><div><dt>일정</dt><dd data-current-date></dd></div><div><dt>장소</dt><dd data-current-place></dd></div></dl><ul class="silence-current-ranges" data-current-ranges></ul><a class="silence-data-link" href="find.html?record=silence#summary">공통 모임 정리 보기 ↗</a></div><button class="silence-current-retry" type="button" data-current-retry hidden>최신 모임 정보 다시 불러오기</button>';
 const originalLabel=document.createElement('p');originalLabel.className='silence-original-schedule-label';originalLabel.textContent='처음 제공된 모임 자료 · 아래 쪽수와 장 제목은 원래 배정대로 보관했어요.';
 const originalDate=schedule.querySelector('.silence-schedule-date');
 if(originalDate)originalDate.before(current,originalLabel);else schedule.querySelector('h2')?.after(current,originalLabel);
 const currentRetry=current.querySelector('[data-current-retry]');
 currentRetry.addEventListener('click',()=>document.querySelector('[data-library-retry]')?.click());
 function setHero(study,source){
  if(!heroTime)return;
  if(!study){heroTime.textContent=originalHero.text;if(originalHero.date)heroTime.setAttribute('datetime',originalHero.date);else heroTime.removeAttribute('datetime');heroLabel.textContent='처음 제공된 일정';return;}
  heroLabel.textContent=source==='network'?'현재 공통 기록의 일정':'이 브라우저에 보관된 일정';
  heroTime.textContent=(study.date||'날짜 미정')+' · '+(study.time||'시간 미정')+(study.place?' · '+study.place:'');
  if(/^\d{4}-\d{2}-\d{2}$/.test(study.date)&&/^\d{2}:\d{2}$/.test(study.time))heroTime.setAttribute('datetime',study.date+'T'+study.time+':00+09:00');else heroTime.removeAttribute('datetime');
 }
 function renderCurrent({state,record,source,errorKind}={}){
  const message=current.querySelector('[data-current-source]'),facts=current.querySelector('[data-current-facts]');
  current.dataset.state=source==='cache'&&state==='ready'?'cache':state||'loading';
  currentRetry.hidden=state==='ready'&&source!=='cache';currentRetry.disabled=state==='loading';
  if(state==='loading'){message.textContent='공통 기록에서 최신 일정과 담당 부분을 확인하고 있어요.';return;}
  if(state!=='ready'||!record){
   facts.hidden=true;setHero(null);
   message.textContent=errorKind==='not-found'?'이 책의 현재 공통 기록을 찾지 못했어요. 아래의 처음 제공된 자료는 그대로 읽을 수 있어요.':'최신 모임 정보에 연결하지 못했어요. 아래의 처음 제공된 자료는 그대로 읽을 수 있어요.';return;
  }
  const study=record.study;facts.hidden=false;setHero(study,source);
  message.textContent=source==='cache'?'이 브라우저에 보관된 공개 기록이에요. 최신 일정과 담당 부분은 연결 후 다시 확인해주세요.':'현재 공통 기록 기준이에요. 모임 정보나 담당 부분을 수정하면 이곳에도 반영돼요.';
  current.querySelector('[data-current-date]').textContent=(study.date||'날짜 미정')+' · '+(study.time||'시간 미정');
  current.querySelector('[data-current-place]').textContent=study.place||'장소 미정';
  const ranges=current.querySelector('[data-current-ranges]');ranges.replaceChildren();
  for(const [id,name]of PEOPLE){const item=document.createElement('li'),label=document.createElement('strong'),range=document.createElement('span');label.textContent=name;range.textContent=study.members[id].range||'담당 부분 미정';item.append(label,range);ranges.append(item);}
 }
 document.addEventListener('sbs:reading-record',event=>renderCurrent(event.detail));
}

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
