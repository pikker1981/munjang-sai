import {load} from 'cheerio';

export class LookupError extends Error {
  constructor(message,status=422){super(message);this.status=status;}
}
export function canonicalBookUrl(input){
  let u;try{u=new URL(input);}catch{throw new LookupError('도서 상세 페이지 링크를 입력해주세요.',400);}
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port)throw new LookupError('지원하는 서점의 도서 상세 링크를 입력해주세요.',400);
  const host=u.hostname.toLowerCase();
  if(['aladin.co.kr','www.aladin.co.kr'].includes(host)&&/^\/shop\/wproduct\.aspx$/i.test(u.pathname)){
    const id=u.searchParams.get('ItemId')||u.searchParams.get('itemid');
    if(/^\d{1,12}$/.test(id||''))return {url:`https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=${id}`,store:'알라딘'};
  }
  if(['yes24.com','www.yes24.com','m.yes24.com'].includes(host)){
    const id=u.pathname.match(/^\/(?:product\/goods|goods\/detail)\/(\d{1,12})\/?$/i)?.[1];
    if(id)return {url:`https://www.yes24.com/Product/Goods/${id}`,store:'YES24'};
  }
  if(host==='product.kyobobook.co.kr'&&/^\/detail\/S\d{6,20}\/?$/i.test(u.pathname))return {url:`https://product.kyobobook.co.kr/detail/${u.pathname.split('/')[2].toUpperCase()}`,store:'교보문고'};
  throw new LookupError('알라딘·교보문고·YES24의 도서 상세 링크를 입력해주세요. 검색·단축 링크는 지원하지 않아요.',400);
}
const plain=(value,max=300)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const nameOf=value=>Array.isArray(value)?value.map(nameOf).filter(Boolean).join(', '):typeof value==='object'&&value?plain(value.name):plain(value);
function findBook(nodes){
  for(const node of nodes){
    if(!node||typeof node!=='object')continue;
    if(Array.isArray(node)){const found=findBook(node);if(found)return found;continue;}
    const types=Array.isArray(node['@type'])?node['@type']:[node['@type']];
    if(types.includes('Book'))return node;
    if(node['@graph']){const found=findBook([node['@graph']]);if(found)return found;}
  }
  return null;
}
export function safeImage(value,base){
  try{const u=new URL(value,base);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['image.aladin.co.kr','image.yes24.com','contents.kyobobook.co.kr','image.kyobobook.co.kr'].includes(u.hostname)?u.href:'';}catch{return '';}
}
export function parseBook(html,source){
  const $=load(html);const meta={};
  $('meta').each((_,el)=>{const key=($(el).attr('property')||$(el).attr('name')||'').toLowerCase();if(key)meta[key]=$(el).attr('content')||'';});
  const nodes=[];$('script[type="application/ld+json"]').each((_,el)=>{try{nodes.push(JSON.parse($(el).html()));}catch{}});
  const book=findBook(nodes)||{},edition=Array.isArray(book.workExample)?book.workExample[0]||{}:book.workExample||{};
  const text=value=>plain(load('<div>'+String(value||'')+'</div>').text());
  const title=text(book.name||meta['og:title']||meta.title).split(/\s+[|｜]\s+/)[0].replace(/\s*[:\-]\s*(?:알라딘|예스24|YES24|교보문고)\s*$/i,'').trim();
  if(!title||/access denied|captcha|페이지를 찾을|접근이 제한|로봇이 아닙니다/i.test(title)||(!book.name&&!meta['og:title']))throw new LookupError('서점에서 도서 정보를 읽지 못했어요. 링크를 확인하거나 잠시 후 다시 조회해주세요.');
  const rows={};$('tr').each((_,el)=>{const key=plain($(el).find('th').text());if(key)rows[key]=plain($(el).find('td').text());});
  const mainText=plain($('.conts_info_list1, .Ere_prod_mconts_LS, .Ere_sub2_title, #infoset_specific, .prod_detail_contents').text(),20000);
  const pageRow=Object.entries(rows).find(([key])=>key.includes('쪽수'))?.[1]||'';
  const pageCount=plain(book.numberOfPages||pageRow.match(/([\d,]+)\s*쪽/)?.[1]||mainText.match(/([\d,]+)\s*쪽/)?.[1]);
  const kyoboPeople=[];$('#author-info a[href="#authorInfo"]').each((_,el)=>kyoboPeople.push({name:$(el).text(),role:$(el).parent().parent().text()}));
  const description=text(book.description||meta['og:description']||meta.description);
  const result={title:title.slice(0,200),author:text(nameOf(book.author)||meta.author||meta['og:author']||kyoboPeople.filter(p=>/저자/.test(p.role)).map(p=>p.name).join(', ')),translator:text(nameOf(book.translator)||kyoboPeople.filter(p=>/번역/.test(p.role)).map(p=>p.name).join(', ')),publisher:text(nameOf(book.publisher)||$('.gd_pub a').first().text()||$('#publisher-info>a').first().text()),publishedAt:text(book.datePublished||edition.datePublished||$('.gd_date').first().text()||rows['발행(출시)일자']||$('#publisher-info>span').last().text()),pages:pageCount,isbn:plain(book.isbn||edition.isbn||meta['books:isbn']||meta['books:isbn13']||rows.ISBN13||rows.ISBN).replace(/[^\dX]/gi,''),cover:safeImage(nameOf(book.image?.url||book.image||meta['og:image']),source.url),summary:description,sourceUrl:source.url,store:source.store,fetchedAt:new Date().toISOString()};
  // Metadata descriptions are already short publisher/store introductions. Keep them concise without inventing missing content.
  if(result.summary.length>280)result.summary=result.summary.slice(0,277).replace(/\s+\S*$/,'')+'…';
  if(!result.author&&!result.isbn)throw new LookupError('도서 정보를 확인할 수 없는 페이지예요. 도서 상세 링크인지 확인해주세요.');
  return result;
}
export async function lookupBook(input,{fetchImpl=fetch}={}){
  let source=canonicalBookUrl(input);const signal=AbortSignal.timeout(18000);
  for(let redirects=0;redirects<4;redirects++){
    const response=await fetchImpl(source.url,{redirect:'manual',signal,headers:{'User-Agent':'SBS-Book-Info/1.0 (public book metadata lookup)','Accept':'text/html,application/xhtml+xml','Accept-Language':'ko-KR,ko;q=0.9'}});
    if([301,302,303,307,308].includes(response.status)){
      const next=new URL(response.headers.get('location')||'',source.url);
      const validated=canonicalBookUrl(next.href);
      // Same-store canonical redirects only; never follow redirects to arbitrary hosts or private networks.
      if(validated.store!==source.store)throw new LookupError('다른 사이트로 연결되는 링크는 조회할 수 없어요.');
      if(validated.url===source.url&&next.href!==source.url)source={...validated,url:next.href};else source=validated;
      continue;
    }
    if(!response.ok)throw new LookupError('서점에서 조회를 허용하지 않거나 응답하지 않아요. 잠시 후 다시 시도해주세요.',502);
    if(!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type')||''))throw new LookupError('도서 상세 HTML 페이지를 입력해주세요.');
    const reader=response.body.getReader();const chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024){await reader.cancel();throw new LookupError('페이지가 너무 커서 정보를 가져오지 못했어요.');}chunks.push(value);}}finally{reader.releaseLock();}
    const bytes=Buffer.concat(chunks);const snippet=new TextDecoder().decode(bytes.subarray(0,10000));const charset=snippet.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]||'';
    return parseBook(new TextDecoder(/euc|ks_c/i.test(charset)?'euc-kr':'utf-8').decode(bytes),source);
  }
  throw new LookupError('링크의 이동이 너무 많아요. 최종 도서 상세 주소를 입력해주세요.');
}
