import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
for(const page of ['index','how-it-works','silence']){
 let html;try{html=await fs.readFile(path.join(root,page+'.source.html'),'utf8')}catch(error){if(error.code==='ENOENT'&&page!=='index')continue;throw error}
 const chapterStart='<!-- SEVEN-CHAPTER-GUIDE:START -->',chapterEnd='<!-- SEVEN-CHAPTER-GUIDE:END -->';
 if(html.includes(chapterStart)){
  const fragment=await fs.readFile(path.join(root,'assets/chapters.fragment.html'),'utf8');
  html=html.slice(0,html.indexOf(chapterStart))+chapterStart+'\n'+fragment+'\n'+chapterEnd+html.slice(html.indexOf(chapterEnd)+chapterEnd.length);
 }
 html=html.replace('<script type="module" src="assets/app.mjs"></script>','<script defer src="assets/app.bundle.js"></script>');
 for(const name of ['book-forest.svg','book-slow.svg','book-city.svg','book-night.svg','book-silence.svg','book-silence-cover.jpg']){
  const svg=await fs.readFile(path.join(root,'assets',name));
  html=html.replaceAll('src="assets/'+name+'"','src="data:'+(name.endsWith('.jpg')?'image/jpeg':'image/svg+xml')+';base64,'+Buffer.from(svg).toString('base64')+'"');
 }
 await fs.writeFile(path.join(root,page+'.html'),html);console.log(page+'.html packaged.');
}
