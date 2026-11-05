import {get,put} from '@vercel/blob';import {normalizeLibrary} from './lib/study-records.mjs';
process.loadEnvFile('.env.local');
const options={access:'private',token:process.env.BLOB_READ_WRITE_TOKEN};
for(const pathname of ['sbs-study-library-v1.json']){
 const existing=await get(pathname,{...options,useCache:false});
 if(!existing){await put(pathname,JSON.stringify(normalizeLibrary(null)),{...options,addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',cacheControlMaxAge:60});console.log('Initialized '+pathname);}
 else console.log('Preserved existing '+pathname);
}
