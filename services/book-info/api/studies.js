import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
import {createHash,timingSafeEqual,randomBytes,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {normalizeLibrary,commitRecord} from '../lib/study-records.mjs';
const pathname=process.env.STUDY_DATA_PATH||'sbs-study-library-v1.json';
const attempts=new Map();
const derive=promisify(scrypt);
const requireAdminForNew=()=>process.env.STUDY_ALLOW_WRITER_REGISTRATION!=='true';
const writerHash=(password,salt)=>derive(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
const blobOptions=()=>({access:'private',token:process.env.BLOB_READ_WRITE_TOKEN,abortSignal:AbortSignal.timeout(15000)});
const allowedOrigin=value=>value==='https://pikker1981.github.io'||/^http:\/\/(?:localhost|127\.0\.0\.1):(?:4173|4174|4180)$/.test(value);
export async function loadLibrary(){
 const result=await get(pathname,{...blobOptions(),useCache:false});
 if(!result?.stream)throw new Error('공통 모임 기록 저장소를 읽지 못했어요. 잠시 후 다시 확인해주세요.');
 const raw=await new Response(result.stream).json();
 // Compressed GET responses can expose W/"hash" while Blob's conditional PUT expects "hash".
 const etag=String(result.blob.etag||'').replace(/^W\//,'');
 if(!raw||typeof raw!=='object'||!/^"[^"\r\n]{1,200}"$/.test(etag))throw new Error('공통 기록의 무결성을 확인하지 못했어요.');
 const library=normalizeLibrary(raw),editors=Object.create(null);
 if(raw.editors!==undefined&&(!raw.editors||typeof raw.editors!=='object'||Array.isArray(raw.editors)))throw new Error('작성자 자격 정보가 손상됐어요.');
 for(const [id,credential]of Object.entries(raw.editors||{})){
  if(!library.records.some(record=>record.id===id)||!credential||!/^[a-f0-9]{32}$/.test(credential.salt||'')||!/^[a-f0-9]{64}$/.test(credential.hash||''))throw new Error('작성자 자격 정보가 손상됐어요.');
  editors[id]={salt:credential.salt,hash:credential.hash};
 }
 return {library,editors,etag};
}
export default async function handler(req,res){
 const origin=req.headers.origin||'';res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
 if(allowedOrigin(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');}
 const send=(code,data)=>{res.statusCode=code;res.end(JSON.stringify(data));};
 if(origin&&!allowedOrigin(origin))return send(403,{error:'이 사이트에서는 저장소에 접근할 수 없어요.'});
 if(req.method==='OPTIONS'){res.statusCode=204;return res.end();}
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST, OPTIONS');return send(405,{error:'지원하지 않는 요청이에요.'});}
 try{
  if(req.method==='GET'){const {library}=await loadLibrary();return send(200,{library,policy:{newBookRequiresAdmin:requireAdminForNew()}});}
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0],now=Date.now();
  for(const [key,value]of attempts)if(value.until<now)attempts.delete(key);
  const bucket=attempts.get(ip)||{count:0,until:now+60000};bucket.count++;attempts.set(ip,bucket);
  if(bucket.count>15||attempts.size>2000){res.setHeader('Retry-After','60');return send(429,{error:'저장 요청이 많아요. 잠시 후 다시 시도해주세요.'});}
  const secretHash=process.env.STUDY_EDITOR_HASH||'';
  if(!/^[a-f0-9]{64}$/.test(secretHash))return send(503,{error:'편집 암호 설정을 확인해주세요.'});
  const legacyPassword=String(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!/^application\/json\b/i.test(req.headers['content-type']||''))return send(415,{error:'저장할 정보의 형식이 올바르지 않아요.'});
  let body=req.body;
  if(body===undefined){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1000000)return send(413,{error:'모임 내용이 너무 커서 저장할 수 없어요.'});chunks.push(chunk);}body=Buffer.concat(chunks).toString();}
  if(typeof body==='string')body=JSON.parse(body);
  if(!body||typeof body!=='object'||JSON.stringify(body).length>1000000)return send(400,{error:'저장할 정보를 확인해주세요.'});
  const password=typeof body.password==='string'?body.password:legacyPassword;
  if(password.length>200)return send(401,{error:'편집 비밀번호를 확인해주세요.'});
  const isAdmin=timingSafeEqual(createHash('sha256').update(password).digest(),Buffer.from(secretHash,'hex'));
  const {library,editors,etag}=await loadLibrary();
  if(body.recordId){
   let isWriter=false;const credential=editors[body.recordId];
   if(!isAdmin&&credential&&password)isWriter=timingSafeEqual(await writerHash(password,credential.salt),Buffer.from(credential.hash,'hex'));
   if(!isAdmin&&!isWriter)return send(401,{error:'이 책의 작성자 비밀번호 또는 관리자 비밀번호를 입력해주세요.'});
  }else{
   if(requireAdminForNew()&&!isAdmin)return send(401,{error:'새 책을 처음 공개하려면 관리자 비밀번호도 확인해주세요.'});
   if(typeof body.newPassword!=='string'||body.newPassword.length<8||body.newPassword.length>200)return send(400,{error:'이 책의 작성자 비밀번호를 8자 이상으로 설정해주세요.'});
  }
  if(!Number.isInteger(body.expectedRecordVersion)||body.expectedRecordVersion<0)return send(400,{error:'저장할 기록의 버전을 확인해주세요.'});
  let next;try{next=commitRecord(library,body.study,{recordId:body.recordId||undefined,now:new Date().toISOString()});}catch(error){return send(400,{error:error.message});}
  const changed=body.recordId?next.records.find(record=>record.id===body.recordId):next.records.find(record=>record.id===next.latestId);
  const previous=library.records.find(record=>record.id===changed.id);
  if(!body.recordId&&previous)return send(409,{error:'이미 보관 중인 책이에요. 기존 모임 기록에서 수정해주세요. 작성한 초안은 그대로 남아 있어요.',existingRecordId:previous.id});
  if((previous?.version||0)!==body.expectedRecordVersion)return send(409,{error:'다른 곳에서 이 모임 기록을 변경했어요. 초안은 남아 있어요. 최신 기록을 확인한 뒤 다시 수정해주세요.'});
  const nextEditors={...editors};
  if(!previous){const salt=randomBytes(16).toString('hex');nextEditors[changed.id]={salt,hash:(await writerHash(body.newPassword,salt)).toString('hex')};}
  try{await put(pathname,JSON.stringify({...next,editors:nextEditors}),{...blobOptions(),addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',cacheControlMaxAge:60,ifMatch:etag});}
  catch(error){if(error instanceof BlobPreconditionFailedError)return send(409,{error:'다른 곳에서 먼저 저장했어요. 초안은 남아 있으니 최신 기록을 확인해주세요.'});throw error;}
  return send(200,{library:next,recordId:changed.id,access:isAdmin?'admin':'writer'});
 }catch(error){return send(503,{error:'공통 모임 기록을 불러오거나 저장하지 못했어요. 입력한 초안은 브라우저에 남아 있어요.'});}
}
