import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(root, 'assets/silence-seven-chapters.md');
const source = await readFile(sourcePath, 'utf8');
const videoSupplement = JSON.parse(await readFile(path.join(root, 'assets/silence-video-supplements.json'), 'utf8'));
const videoSource = await readFile(path.join(root, 'assets', videoSupplement.sourceFile), 'utf8');
if (videoSupplement.chapters.length !== 7) throw new Error('Expected seven video supplements');
for (const section of videoSupplement.chapters) {
  for (const excerpt of section.excerpts) {
    if (!videoSource.includes(excerpt.text)) throw new Error(`Video excerpt mismatch: ${section.id} ${excerpt.section}`);
  }
}
const lines = source.replace(/\r\n?/g, '\n').split('\n');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = url => /^(https?:\/\/|#|(?:\.?\.?\/)?[\w-]+(?:\/|\.))/.test(url) && !/[\u0000-\u0020]/.test(url);
const inline = text => {
  const pattern = /\[([^\]]+)\]\(([^\s]+)\)|\*\*([^*]+)\*\*/g;
  let html = '', start = 0;
  for (const match of text.matchAll(pattern)) {
    html += esc(text.slice(start, match.index));
    if (match[1]) {
      if (!safeUrl(match[2])) throw new Error(`Unsafe link: ${match[2]}`);
      html += `<a href="${esc(match[2])}"${/^https?:/.test(match[2]) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(match[1])}</a>`;
    } else html += `<strong>${esc(match[3])}</strong>`;
    start = match.index + match[0].length;
  }
  return html + esc(text.slice(start));
};
const plain = text => text.replace(/\[([^\]]+)\]\(([^\s]+)\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');
const blocks = [];
const add = block => blocks.push({ id: `source-${String(blocks.length + 1).padStart(3,'0')}`, ...block });
const isStart = line => /^(#{1,6} |---+$|> |(?:\d+\. |[-*] )|\|)/.test(line);
for (let i = 0; i < lines.length;) {
  const line = lines[i].trim();
  if (!line) { i++; continue; }
  if (/^---+$/.test(line)) { add({ type:'rule' }); i++; continue; }
  const heading = /^(#{1,6}) (.+)$/.exec(line);
  if (heading) { add({type:'heading', level:heading[1].length, text:heading[2]}); i++; continue; }
  if (line.startsWith('|')) {
    const rows = [];
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const row = lines[i++].trim().replace(/^\||\|$/g,'').split('|').map(x => x.trim());
      if (row.every(x => /^:?-+:?$/.test(x))) continue;
      rows.push(row);
    }
    add({type:'table', rows}); continue;
  }
  const list = /^(\d+)\. (.*)$|^[-*] (.*)$/.exec(line);
  if (list) {
    const ordered = Boolean(list[1]), items = [], start = ordered ? Number(list[1]) : null;
    while (i < lines.length) {
      const item = /^(\d+)\. (.*)$|^[-*] (.*)$/.exec(lines[i].trim());
      if (!item || Boolean(item[1]) !== ordered) break;
      items.push(item[2] ?? item[3]); i++;
    }
    add({type:'list', ordered, start, items}); continue;
  }
  if (line.startsWith('> ')) {
    const text = [];
    while (i < lines.length && lines[i].trim().startsWith('> ')) text.push(lines[i++].trim().slice(2));
    add({type:'quote', text:text.join(' ')}); continue;
  }
  const paragraph = [line]; i++;
  while (i < lines.length && lines[i].trim() && !isStart(lines[i].trim())) paragraph.push(lines[i++].trim());
  add({type:'paragraph', text:paragraph.join(' ')});
}

const units = [];
for (const b of blocks) {
  if (b.type === 'rule') continue;
  if (b.type === 'list') b.items.forEach((text,i) => units.push({id:`${b.id}-item-${i+1}`,text:plain(text)}));
  else if (b.type === 'table') b.rows.forEach((row,r) => row.forEach((text,c) => units.push({id:`${b.id}-cell-${r+1}-${c+1}`,text:plain(text)})));
  else units.push({id:b.id,text:plain(b.text)});
}
const attr = id => `data-source-block="${id}"`;
function render(b) {
  if (b.type === 'rule') return `<hr ${attr(b.id)}>`;
  if (b.type === 'heading') return `<h${b.level === 1 ? 3 : b.level + 1} ${attr(b.id)}>${inline(b.text)}</h${b.level === 1 ? 3 : b.level + 1}>`;
  if (b.type === 'paragraph') return `<p ${attr(b.id)}>${inline(b.text)}</p>`;
  if (b.type === 'quote') return `<blockquote ${attr(b.id)}>${inline(b.text)}</blockquote>`;
  if (b.type === 'list') {
    const tag = b.ordered ? 'ol' : 'ul';
    return `<${tag} ${attr(b.id)}${b.ordered ? ` start="${b.start}"` : ''}>${b.items.map((item,i) => `<li ${attr(`${b.id}-item-${i+1}`)}>${inline(item)}</li>`).join('')}</${tag}>`;
  }
  if (b.type === 'table') {
    const [head, ...body] = b.rows;
    return `<div class="chapter-comparison" ${attr(b.id)}><table><caption class="chapter-sr-only">일곱 장 비교표</caption><thead><tr>${head.map((cell,c) => `<th scope="col" ${attr(`${b.id}-cell-1-${c+1}`)}>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row,r) => `<tr>${row.map((cell,c) => `<${c ? 'td' : 'th scope="row"'} data-label="${esc(plain(head[c]))}" ${attr(`${b.id}-cell-${r+2}-${c+1}`)}>${inline(cell)}</${c ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  throw new Error(`Unsupported block ${b.type}`);
}
const sections = [];
let current = {title:'資料', blocks:[]}; sections.push(current);
for (const block of blocks) {
  if (block.type === 'heading' && block.level === 2) {current = {title:block.text, heading:block, blocks:[]}; sections.push(current);}
  else current.blocks.push(block);
}
const chapters = sections.filter(s => /^\d+\. /.test(s.title));
if (chapters.length !== 7) throw new Error('Expected exactly seven chapters');
function videoReading(index) {
  const section = videoSupplement.chapters[index];
  if (section.id !== `chapter-${index+1}` || section.title !== chapters[index].title.replace(/^\d+\. /,'')) throw new Error('Video supplement chapter mismatch');
  const id = `video-chapter-${index+1}`;
  return `<details class="chapter-video" id="${id}"><summary>추가 읽기 · 영상 해설에서 <span>${esc(section.focus)}</span></summary><div class="chapter-video-body">
<p class="chapter-kind">연결 범위</p><p data-source-block="${id}-scope">${esc(section.relationship)}</p>
<h4>제공 자료에서 발췌</h4><p class="chapter-video-note">아래 인용은 사용자가 제공한 영상 정리문의 문장입니다. 책 원문이나 영상 자막의 직접 인용이 아닙니다.</p>
${section.excerpts.map((item,i)=>`<figure class="chapter-video-excerpt"><blockquote data-source-block="${id}-excerpt-${i+1}">${esc(item.text)}</blockquote><figcaption>제공 정리문 · ${esc(item.section)}</figcaption></figure>`).join('\n')}
<h4>이 장과 연결해 읽기</h4>${section.commentary.map((text,i)=>`<p data-source-block="${id}-commentary-${i+1}">${esc(text)}</p>`).join('\n')}
<div class="chapter-questions"><p class="chapter-kind">추가 토론 질문 · 편집</p><h4>함께 더 물어보기</h4><ol>${section.questions.map((text,i)=>`<li data-source-block="${id}-question-${i+1}">${esc(text)}</li>`).join('')}</ol></div>
<p class="chapter-video-note">출처: <a href="${esc(videoSupplement.videoUrl)}" target="_blank" rel="noopener noreferrer">${esc(videoSupplement.channel)} · 영상 원출처 ↗</a> / <a href="assets/${esc(videoSupplement.sourceFile)}" download>제공 정리문 전체 내려받기</a>. 절 번호는 정리문 기준이며 책의 장 번호·영상 재생 시각이 아닙니다. 연결 해설과 추가 질문은 이 페이지의 편집입니다.</p>
</div></details>`;
}
function chapter(section,index) {
  const groups = [];
  let group = {title:'', blocks:[]}; groups.push(group);
  for (const b of section.blocks) {
    if (b.type === 'heading' && b.level === 3) { group = {title:b.text,heading:b,blocks:[]}; groups.push(group); }
    else group.blocks.push(b);
  }
  const content = groups.map(g => {
    const heading = g.heading ? `<h4 ${attr(g.heading.id)}>${inline(g.title)}</h4>` : '';
    const body = g.blocks.map(render).join('\n');
    if (!g.heading) return body;
    const secondary = /^(해설|이해를 돕는 예|관련 출처)/.test(g.title);
    const kind = g.title === '독서 질문' ? 'questions' : g.title === '핵심 문제' ? 'core' : g.title === '독서 활동' ? 'activity' : /^비판/.test(g.title) ? 'critical' : 'understanding';
    if (secondary) return `<details class="chapter-aside"><summary ${attr(g.heading.id)}>${inline(g.title)}</summary><div class="chapter-aside-body">${body}</div></details>`;
    return `<div class="chapter-${kind}">${g.title === '독서 질문' ? '<p class="chapter-kind">토론 질문</p>' : g.title === '내용 정리' ? '<p class="chapter-kind">내용 이해</p>' : ''}${heading}${body}</div>`;
  }).join('\n');
  return `<details class="chapter-panel" id="chapter-${index+1}"${index === 0 ? ' open' : ''}><summary><span class="chapter-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><span ${attr(section.heading.id)}>${inline(section.title)}</span><span class="chapter-toggle" aria-hidden="true"></span></summary><div class="chapter-body">${content}${videoReading(index)}</div></details>`;
}
const introSections = sections.filter(s => !/^\d+\. /.test(s.title) && (s === sections[0] || s.title === '이 문서에 대하여'));
const otherSections = sections.filter(s => !chapters.includes(s) && !introSections.includes(s));
const questionCount = chapters.reduce((total, s) => {
  let inQuestions = false;
  return total + s.blocks.reduce((n,b) => { if (b.type === 'heading') inQuestions = b.text === '독서 질문'; return n + (inQuestions && b.type === 'list' ? b.items.length : 0); },0);
},0);
const overallQuestions = sections.find(s => s.title === '전체를 연결하는 종합 질문')?.blocks.filter(b => b.type === 'list').reduce((n,b) => n + b.items.length,0) ?? 0;
const report = { sourceSha256:createHash('sha256').update(source).digest('hex'), chapters:chapters.length, chapterQuestions:questionCount, overallQuestions, sourceBlocks:blocks.length, textUnits:units.length, renderedTextUnits:0, missingUnits:[] };
const supplemental = otherSections.map(s => {
  const heading = `<h3 ${attr(s.heading.id)}>${inline(s.title)}</h3>`;
  if (s.title === '일곱 장 비교표') return `<div class="chapter-synthesis">${heading}${s.blocks.map(render).join('\n')}</div>`;
  return `<details class="chapter-secondary"${s.title === '전체를 이해하는 출발점' ? ' open' : ''}><summary ${attr(s.heading.id)}>${inline(s.title)}</summary><div class="chapter-secondary-body">${s.blocks.map(render).join('\n')}</div></details>`;
}).join('\n');
let html = `<section class="silence-leaf chapter-guide" id="chapter-guide" aria-labelledby="chapter-guide-title">
<p class="silence-section-label">동진 담당 · 60–106쪽</p><h2 id="chapter-guide-title">일곱 장 상세 읽기</h2>
<p class="chapter-intro">말과 몸짓에서 형상과 침묵까지. 내용을 먼저 이해하고, 각자의 경험으로 질문을 이어가요.</p>
<p class="chapter-provenance">제공자료 기반 · 한국어판 전체를 문장별로 대조한 자료는 아니에요. 해설과 질문은 저자의 직접 인용과 구분해 읽어요.</p>
<p class="chapter-video-intro">각 장 끝의 ‘추가 읽기 · 영상 해설에서’에 새 자료를 덧붙였어요. 제공된 영상 정리문에서 발췌하고 연결 해설·추가 질문을 구분했어요. 역사 장은 간접 비교 읽기예요.</p>
<details class="chapter-secondary"><summary>자료 안내와 확인 범위</summary><div class="chapter-secondary-body">${introSections.map(s => `${s.heading ? render(s.heading) : ''}${s.blocks.map(render).join('\n')}`).join('\n')}</div></details>
<nav class="chapter-jump" aria-label="일곱 장 바로가기">${chapters.map((s,i) => `<a href="#chapter-${i+1}"><span>${String(i+1).padStart(2,'0')}</span>${esc(s.title.replace(/^\d+\. /,''))}</a>`).join('')}</nav>
<div class="chapter-tools" hidden><span>일곱 장 펼쳐 읽기</span><button type="button" data-chapters-action="expand">모두 펼치기</button><button type="button" data-chapters-action="collapse">모두 접기</button><p class="chapter-sr-only" role="status" data-chapters-status></p></div>
${chapters.map(chapter).join('\n')}
${supplemental}
<div class="chapter-downloads"><p>자료를 따로 읽고 싶다면</p><a href="assets/silence-seven-chapters.md" download>제공 원문 전체 내려받기 · MD</a><a href="assets/silence-chapters.json" download>구조화 자료 내려받기 · JSON</a><a href="assets/${esc(videoSupplement.sourceFile)}" download>추가 영상 정리문 전체 · MD</a><a href="assets/silence-video-supplements.json" download>장별 추가 읽기 · JSON</a></div>
</section>`;
// Verify every source heading, paragraph, list item and table cell against its rendered text.
const decode = text => text.replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
for (const unit of units) {
  const pattern = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*data-source-block="${unit.id}"[^>]*>([\\s\\S]*?)<\\/\\1>`);
  const found = pattern.exec(html);
  if (!found || decode(found[2]).replace(/\s+/g,' ').trim() !== unit.text.replace(/\s+/g,' ').trim()) report.missingUnits.push(unit.id);
  else report.renderedTextUnits++;
}
if (report.missingUnits.length) throw new Error(`Content mismatch: ${report.missingUnits.join(', ')}`);
html = `<!-- Source completeness: ${JSON.stringify(report)} -->\n${html}\n`;
await writeFile(path.join(root,'assets/chapters.fragment.html'), html);
await writeFile(path.join(root,'assets/silence-chapters.json'), JSON.stringify({title:'『침묵의 세계』 일곱 장 상세 정리와 독서 질문', provenance:'사용자 제공 자료. 새로운 판본 대조 또는 추가 조사 결과가 아님.', source:'silence-seven-chapters.md', report, blocks, units},null,2)+'\n');
console.log(JSON.stringify(report,null,2));
