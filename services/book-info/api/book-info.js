import {lookupBook,LookupError} from '../lib/book.mjs';
const windows=new Map();
export default async function handler(req,res){
  const origin=req.headers.origin||'';
  const allowed=origin==='https://pikker1981.github.io'||/^http:\/\/(?:127\.0\.0\.1|localhost):(?:4173|4174|4180)$/.test(origin);
  res.setHeader('Vary','Origin');res.setHeader('X-Content-Type-Options','nosniff');
  if(allowed){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');}
  if(req.method==='OPTIONS'){res.statusCode=allowed?204:403;return res.end();}
  if(req.method!=='GET'){res.setHeader('Allow','GET, OPTIONS');res.statusCode=405;return res.end();}
  res.setHeader('Content-Type','application/json; charset=utf-8');
  const send=(code,body)=>{res.statusCode=code;res.end(JSON.stringify(body));};
  if(origin&&!allowed)return send(403,{error:'이 사이트에서는 조회할 수 없어요.'});
  const now=Date.now();for(const [key,value]of windows)if(value.until<now)windows.delete(key);
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
  const bucket=windows.get(ip)||{count:0,until:now+60000};bucket.count++;windows.set(ip,bucket);
  if(bucket.count>30||windows.size>2000){res.setHeader('Retry-After','60');return send(429,{error:'조회가 많아요. 잠시 후 다시 시도해주세요.'});}
  const url=new URL(req.url,'http://localhost');const input=url.searchParams.get('url')||'';
  if(input.length>2000)return send(400,{error:'링크가 너무 길어요. 도서 상세 주소만 입력해주세요.'});
  try{const book=await lookupBook(input);res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=3600');send(200,{book});}
  catch(error){res.setHeader('Cache-Control','no-store');send(error instanceof LookupError?error.status:502,{error:error instanceof LookupError?error.message:'서점 연결이 지연되거나 차단됐어요. 잠시 후 다시 조회해주세요.'});}
}
