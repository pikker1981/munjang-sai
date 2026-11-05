import {cachedLibrary,fetchLibrary} from './study-client.mjs';
const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function imageFor(record){
 const value=record.study.bookInfo?.cover;
 if(value==='assets/book-silence-cover.jpg')return value;
 try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['image.aladin.co.kr','image.yes24.com','contents.kyobobook.co.kr','image.kyobobook.co.kr'].includes(u.hostname))return u.href;}catch{}
 return 'assets/book-placeholder.svg';
}
const guideHref=record=>record.id==='silence'?'silence.html':'reading.html?record='+encodeURIComponent(record.id);
function schedule(study){
 let date='날짜 미정';
 if(/^\d{4}-\d{2}-\d{2}$/.test(study.date)){const d=new Date(study.date+'T00:00:00+09:00');date=`${Number(study.date.slice(5,7))}월 ${Number(study.date.slice(8,10))}일(${'일월화수목금토'[d.getUTCDay()===6?0:d.getUTCDay()+1]})`;}
 let time='시간 미정';if(/^\d{2}:\d{2}$/.test(study.time)){const hour=Number(study.time.slice(0,2)),minute=Number(study.time.slice(3));time=`${hour>=12?'오후':'오전'} ${hour%12||12}시${minute?' '+minute+'분':''}`;}
 return date+' '+time;
}
function spine(record,current){
 const s=record.study,author=s.bookInfo?.author||'',shortAuthor=author.split(/[,，]/)[0];
 return `<a class="bookshelf-link is-library-book${current?' is-current':''}" href="${guideHref(record)}" data-bookshelf-link data-record-id="${escapeHtml(record.id)}" aria-label="${escapeHtml(s.book)} — 독서 가이드 열기" aria-describedby="bookshelf-description"><span class="bookshelf-book" aria-hidden="true"><span class="bookshelf-face bookshelf-front"><img src="${escapeHtml(imageFor(record))}" width="700" height="989" alt="" decoding="async" loading="eager"></span><span class="bookshelf-face bookshelf-back"></span><span class="bookshelf-face bookshelf-spine"><span class="bookshelf-spine-title">${escapeHtml(s.book)}</span><span class="bookshelf-spine-author">${escapeHtml(shortAuthor)}</span></span><span class="bookshelf-face bookshelf-pages"></span><span class="bookshelf-face bookshelf-top"></span><span class="bookshelf-face bookshelf-bottom"></span></span><span class="bookshelf-caption" aria-hidden="true"><strong>${escapeHtml(s.book)}</strong><span>${escapeHtml(author||'확정한 스터디 모임')} · 독서 가이드 ↗</span></span></a>`;
}
export function initHomeLibrary(initBookshelf,{beforeChange=()=>{},afterChange=()=>{}}={}){
 const shelf=document.querySelector('[data-bookshelf]');if(!shelf)return;
 const row=shelf.querySelector('.bookshelf-row'),featured=document.querySelector('.featured-book');
 const originalFeatured=featured?.innerHTML;
 let cleanup=()=>{},library=cachedLibrary(),lastSignature='',lastFetch=0;
 function apply(next,{offline=false}={}){
  const signature=JSON.stringify(next)+offline;if(signature===lastSignature)return;lastSignature=signature;library=next;
  beforeChange();cleanup();
  const current=library.records.find(record=>record.id===library.latestId),previous=library.records.filter(record=>record.id!==current.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const slots=[previous[2],previous[0],current,previous[1],previous[3]],colors=['','--clay','','--stone','--blue'];
  shelf.classList.toggle('has-long-title',slots.some(record=>record&&(record.study.book.length>15||(record.study.bookInfo?.author||'').length>24)));
  row.innerHTML=slots.map((record,index)=>record?spine(record,index===2):`<div class="bookshelf-placeholder${colors[index]?' bookshelf-placeholder'+colors[index]:''}" aria-hidden="true"></div>`).join('');
  shelf.querySelector('#bookshelf-description').textContent=`가운데에는 가장 최근에 확정한 『${current.study.book}』이 있어요.`;
  shelf.querySelector('.bookshelf-note').textContent=offline?'공통 기록에 연결하지 못했어요. 표시된 책장은 최신이 아닐 수 있어요.':'가운데는 이번 모임의 책, 옆에는 함께 읽어온 책들이에요.';
  shelf.querySelector('.bookshelf-history')?.remove();
  const history=document.createElement('details');history.className='bookshelf-history';
  history.innerHTML=`<summary>함께 읽어온 책과 모임 기록 · ${library.records.length}권</summary><div class="bookshelf-history-grid">${[current,...previous].map(record=>`<a href="${guideHref(record)}"><img src="${escapeHtml(imageFor(record))}" alt="" loading="lazy"><span><strong>${escapeHtml(record.study.book)}</strong><small>${escapeHtml(schedule(record.study))}${record.id===library.latestId?' · 이번 모임':''}</small></span></a>`).join('')}</div>`;shelf.append(history);
  if(featured){
   if(current.id==='silence'&&current.version===1){featured.innerHTML=originalFeatured;featured.querySelector('.card-link').href=guideHref(current);}
   else{
    const s=current.study,author=s.bookInfo?.author||'함께 읽을 다음 책',presenters=Object.values(s.members).filter(member=>member.range||member.content).length;
    featured.innerHTML=`<div class="card-copy"><div class="card-label"><span class="tiny-star" aria-hidden="true">✳</span> 이번 모임의 책 · ${escapeHtml(author)}</div><div class="card-main"><h2>${escapeHtml(s.book)}</h2><p>${escapeHtml((s.bookSummary||'책 한 권과 서로 다른 생각이 만나는 시간.').slice(0,180))}</p><a class="card-link" href="${guideHref(current)}">${escapeHtml(s.book)} · 독서 가이드 열기 <span aria-hidden="true">↗</span></a></div><div class="card-bottom"><p class="meeting-meta">${escapeHtml(schedule(s))}${s.place?' · '+escapeHtml(s.place):''}${presenters?' · 담당 작성 '+presenters+'명':''}</p></div></div><div class="card-art art-sage"><div class="paper-print" aria-hidden="true"></div><span class="art-pencil" aria-hidden="true">a space for words to begin</span><div class="peel-frame" data-peel><img src="${escapeHtml(imageFor(current))}" width="700" height="989" alt="${escapeHtml(s.book)}${imageFor(current).includes('placeholder')?' 표지 미등록':' 표지'}"></div><span class="art-caption" aria-hidden="true">책을 읽고, 서로를 듣는 시간</span></div>`;
   }
   featured.dataset.meeting=current.id;
  }
  const note=document.querySelector('.section-note>span:last-child');if(note)note.textContent='확정 도서 '+library.records.length+'권 · 함께 읽는 모임';
  cleanup=initBookshelf()||(()=>{});afterChange();
 }
 async function refresh(){
  if(Date.now()-lastFetch<5000)return;lastFetch=Date.now();
  try{apply(await fetchLibrary());}catch{apply(library,{offline:true});}
 }
 apply(library);refresh();
 addEventListener('pageshow',refresh);addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}
