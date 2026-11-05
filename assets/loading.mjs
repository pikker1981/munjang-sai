import {Reveal} from './vendor/skullet.mjs';

// Measure a disposable reading sample. Never clone or replace live forms,
// passwords, original chapter nodes, notes, or a visitor's draft.
const pending = new WeakMap();
export function beginLoading(target,{label='공통 기록을 불러오고 있어요',kind='text',preserve=false}={}){
  if(!target)return {finish(){},fail(){},cancel(){}};
  pending.get(target)?.cancel();
  const wasHidden=target.hidden,wasBusy=target.getAttribute('aria-busy');
  const box=document.createElement('div');box.className='sbs-loading-region';box.hidden=true;
  const stage=document.createElement('div');stage.className='sbs-loading-stage';
  const status=document.createElement('p');status.className='sbs-loading-label';status.setAttribute('role','status');status.textContent=label;
  box.append(stage,status);target.before(box);target.setAttribute('aria-busy','true');
  const sample=document.createElement('div');sample.className='sbs-loading-sample'+(kind==='book'?' is-book':'');
  if(kind==='book'){const cover=document.createElement('div');cover.className='sbs-loading-cover';cover.setAttribute('skullet-block','');sample.append(cover);}
  const lines=document.createElement('div');lines.className='sbs-loading-lines';
  for(const text of ['함께 읽는 책과 각자의 생각','책과 모임의 내용을 확인하고 있어요.','잠시 후 이 자리에 내용이 표시돼요.']){const p=document.createElement('p');p.textContent=text;lines.append(p);}sample.append(lines);
  let reveal,stopped=false,errorNode;
  const timer=setTimeout(()=>{
    if(stopped||!target.isConnected)return;
    box.hidden=false;
    if(preserve){stage.hidden=true;return;}
    target.hidden=true;
    try{reveal=new Reveal(stage,{label,id:'sbs-loading-'+kind,reveal:'together'});reveal.load(sample);}
    catch{stage.append(sample);stage.classList.add('sbs-loading-fallback');}
  },150);
  function clean(){
    if(stopped)return;stopped=true;clearTimeout(timer);
    reveal?.destroy();box.remove();target.hidden=wasHidden;
    if(wasBusy===null)target.removeAttribute('aria-busy');else target.setAttribute('aria-busy',wasBusy);
    if(pending.get(target)===control)pending.delete(target);
  }
  const control={finish:clean,cancel:clean,fail(message){clean();if(message){errorNode=document.createElement('p');errorNode.className='sbs-load-error';errorNode.setAttribute('role','status');errorNode.textContent=message;target.before(errorNode);}}};
  target.parentElement?.querySelectorAll(':scope > .sbs-load-error').forEach(el=>el.remove());
  pending.set(target,control);return control;
}
