// Progressive enhancement of each real link; confirmed study data lives separately.
export function initBookshelf(){
  const shelf=document.querySelector('[data-bookshelf]');
  if(!shelf)return;
  const cleanups=[...shelf.querySelectorAll('[data-bookshelf-link]')].map(link=>attachBook(shelf,link));
  return ()=>cleanups.forEach(cleanup=>cleanup?.());
}
function attachBook(shelf,link){
  const book=link?.querySelector('.bookshelf-book');
  const cover=book?.querySelector('img');
  if(!link||!book||!cover)return;
  if(link.dataset.bookshelfReady)return;
  link.dataset.bookshelfReady='true';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const status=shelf.querySelector('[data-bookshelf-status]');
  const returnKey='munjang-sai-bookshelf-return-v1:'+location.pathname+':'+link.getAttribute('href');
  let active=null,restoreVersion=0,restoreFrames=[];

  const coverReady=(async()=>{
    try{
      if(!cover.complete)await new Promise((resolve,reject)=>{
        cover.addEventListener('load',resolve,{once:true});
        cover.addEventListener('error',reject,{once:true});
      });
      if(!cover.naturalWidth)return false;
      if(cover.decode)await cover.decode();
      return cover.naturalWidth>0;
    }catch{return cover.complete&&cover.naturalWidth>0;}
  })();

  function rememberReturn(){
    try{sessionStorage.setItem(returnKey,JSON.stringify({at:Date.now(),x:scrollX,y:scrollY,offset:shelf.getBoundingClientRect().top,focus:document.activeElement===link}));}catch{}
  }
  function stopRestore(){
    restoreVersion++;
    restoreFrames.forEach(cancelAnimationFrame);
    restoreFrames=[];
  }
  function restoreReturn(){
    let saved;
    try{saved=JSON.parse(sessionStorage.getItem(returnKey)||'null');sessionStorage.removeItem(returnKey);}catch{return;}
    if(!saved||!Number.isFinite(saved.at)||Date.now()-saved.at>1800000||!Number.isFinite(saved.y)||!Number.isFinite(saved.offset))return;
    // Explicit existing section links keep their own destination.
    if(location.hash&&location.hash!=='#bookshelf')return;
    const version=restoreVersion;
    const restore=()=>{
      if(version!==restoreVersion||active)return;
      restoreFrames.push(requestAnimationFrame(()=>restoreFrames.push(requestAnimationFrame(()=>{
        if(version!==restoreVersion||active)return;
        const top=Math.max(0,scrollY+shelf.getBoundingClientRect().top-saved.offset);
        scrollTo({left:Number.isFinite(saved.x)?saved.x:0,top,behavior:'instant'});
        if(saved.focus)link.focus({preventScroll:true});
        restoreFrames=[];
      }))));
    };
    if(document.fonts?.ready)document.fonts.ready.then(restore,restore);else restore();
  }
  function clean(transaction,{focus=false}={}){
    if(!transaction)return;
    transaction.animations.forEach(animation=>animation.cancel());
    clearTimeout(transaction.timeout);
    transaction.overlay?.remove();
    link.classList.remove('is-leaving');
    link.removeAttribute('aria-busy');
    shelf.classList.remove('is-transitioning');
    document.removeEventListener('keydown',handleKeydown);
    removeEventListener('wheel',preventScroll);
    removeEventListener('touchmove',preventScroll);
    if(status)status.textContent='';
    if(active===transaction)active=null;
    if(focus&&link.isConnected)link.focus({preventScroll:true});
  }
  function animate(transaction,element,keyframes,options){
    const animation=element.animate(keyframes,options);
    transaction.animations.push(animation);
    animation.finished.catch(()=>{});
    return animation;
  }
  function cancel({immediate=false,focus=true}={}){
    const transaction=active;
    if(!transaction||transaction.cancelled)return;
    transaction.cancelled=true;
    clearTimeout(transaction.timeout);
    if(immediate||!transaction.overlay||reduced.matches){clean(transaction,{focus});return;}
    const flightTransform=getComputedStyle(transaction.flight).transform;
    const bookTransform=getComputedStyle(transaction.model).transform;
    const opacity=getComputedStyle(transaction.backdrop).opacity;
    transaction.animations.forEach(animation=>animation.cancel());
    try{
      const options={duration:200,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'};
      const returning=[
        animate(transaction,transaction.flight,[{transform:flightTransform},{transform:'translate3d(0,0,0) scale(1)'}],options),
        animate(transaction,transaction.model,[{transform:bookTransform},{transform:transaction.initialTransform}],options),
        animate(transaction,transaction.backdrop,[{opacity},{opacity:0}],options)
      ];
      Promise.allSettled(returning.map(animation=>animation.finished)).then(()=>{if(active===transaction)clean(transaction,{focus});});
    }catch{clean(transaction,{focus});}
  }
  function navigate(transaction){
    if(active!==transaction||transaction.cancelled)return;
    rememberReturn();
    try{location.assign(link.href);}catch{clean(transaction,{focus:true});}
  }
  async function select(transaction){
    try{
      const ready=await Promise.race([coverReady,new Promise(resolve=>{transaction.timeout=setTimeout(()=>resolve(false),1000);})]);
      clearTimeout(transaction.timeout);
      if(active!==transaction||transaction.cancelled)return;
      if(!ready){navigate(transaction);return;}
      const bounds=link.getBoundingClientRect(),style=getComputedStyle(book);
      const width=parseFloat(style.width),height=parseFloat(style.height);
      if(!width||!height){navigate(transaction);return;}
      const left=bounds.left+bounds.width/2-width/2,top=bounds.top;
      const overlay=document.createElement('div');
      overlay.className='bookshelf-overlay';
      overlay.setAttribute('aria-hidden','true');
      const backdrop=document.createElement('div');
      backdrop.className='bookshelf-backdrop';
      const flight=document.createElement('div');
      flight.className='bookshelf-flight';
      Object.assign(flight.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
      flight.style.setProperty('--book-width',width+'px');
      flight.style.setProperty('--book-height',height+'px');
      flight.style.setProperty('--book-thickness',style.getPropertyValue('--book-thickness'));
      const model=book.cloneNode(true);
      const initialTransform=style.transform;
      model.style.transform=initialTransform;
      flight.append(model);overlay.append(backdrop,flight);
      Object.assign(transaction,{overlay,backdrop,flight,model,initialTransform});
      document.body.append(overlay);
      link.classList.add('is-leaving');
      shelf.classList.add('is-transitioning');
      const ratio=width/height;
      const targetHeight=Math.min(440,innerHeight*.64,(innerWidth-64)/ratio);
      const scale=Math.max(.5,targetHeight/height);
      const dx=innerWidth/2-(left+width/2),dy=innerHeight/2-(top+height/2);
      const destination=`translate3d(${dx}px,${dy}px,0) scale(${scale})`;
      const easing='cubic-bezier(.2,.7,.2,1)';
      const flightAnimation=animate(transaction,flight,[
        {transform:'translate3d(0,0,0) scale(1)',offset:0,easing},
        {transform:'translate3d(0,-5px,0) scale(1.035)',offset:.1875,easing},
        {transform:destination,offset:.75},
        {transform:destination,offset:1}
      ],{duration:800,fill:'both'});
      const bookAnimation=animate(transaction,model,[
        {transform:initialTransform,offset:0,easing},
        {transform:'perspective(900px) translateZ(74px) translateY(-3px) rotateY(84deg)',offset:.1875,easing},
        {transform:'perspective(900px) translateZ(0) translateY(0) rotateY(0deg)',offset:.75},
        {transform:'perspective(900px) translateZ(0) translateY(0) rotateY(0deg)',offset:1}
      ],{duration:800,fill:'both'});
      animate(transaction,backdrop,[{opacity:0},{opacity:.94}],{duration:450,fill:'both',easing});
      await Promise.all([flightAnimation.finished,bookAnimation.finished]);
      navigate(transaction);
    }catch{
      if(active===transaction&&!transaction.cancelled){clean(transaction);rememberReturn();location.assign(link.href);}
    }
  }

  function handleClick(event){
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
    if(active){event.preventDefault();return;}
    if(reduced.matches||typeof book.animate!=='function'||!globalThis.CSS?.supports('transform-style','preserve-3d')){rememberReturn();return;}
    event.preventDefault();stopRestore();
    const transaction={animations:[],cancelled:false};
    active=transaction;
    document.addEventListener('keydown',handleKeydown);
    addEventListener('wheel',preventScroll,{passive:false});
    addEventListener('touchmove',preventScroll,{passive:false});
    link.setAttribute('aria-busy','true');
    if(status)status.textContent=(link.querySelector('.bookshelf-caption strong')?.textContent||'책')+' 독서 가이드를 여는 중이에요. Escape 키로 취소할 수 있어요.';
    select(transaction);
  }
  link.addEventListener('click',handleClick);
  function handleKeydown(event){
    if(!active)return;
    if(event.key==='Escape'){event.preventDefault();cancel();return;}
    if(!event.metaKey&&!event.ctrlKey&&['Enter',' ','Tab','PageDown','PageUp','Home','End','ArrowUp','ArrowDown'].includes(event.key))event.preventDefault();
  }
  const preventScroll=event=>{if(active)event.preventDefault();};
  const resize=()=>cancel({immediate:true});
  const motionChange=()=>{if(reduced.matches)cancel({immediate:true});};
  const pageHide=()=>{stopRestore();cancel({immediate:true,focus:false});if(active)clean(active);};
  addEventListener('resize',resize);
  reduced.addEventListener('change',motionChange);
  addEventListener('pagehide',pageHide);
  const pageShow=()=>{if(active)clean(active);stopRestore();restoreReturn();};
  addEventListener('pageshow',pageShow);
  if(document.readyState==='complete')pageShow();
  return ()=>{stopRestore();cancel({immediate:true,focus:false});link.removeEventListener('click',handleClick);removeEventListener('resize',resize);reduced.removeEventListener('change',motionChange);removeEventListener('pagehide',pageHide);removeEventListener('pageshow',pageShow);delete link.dataset.bookshelfReady;};
}
