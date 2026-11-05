import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalBookUrl,parseBook,lookupBook} from '../lib/book.mjs';
test('only canonical public book pages are fetched',()=>{
 for(const url of ['http://127.0.0.1/','https://www.aladin.co.kr.evil.com/shop/wproduct.aspx?ItemId=1','https://www.aladin.co.kr@localhost/shop/wproduct.aspx?ItemId=1','https://www.aladin.co.kr:4430/shop/wproduct.aspx?ItemId=1','file:///etc/passwd','https://www.yes24.com/search','https://product.kyobobook.co.kr/../../admin'])assert.throws(()=>canonicalBookUrl(url));
 assert.equal(canonicalBookUrl('http://www.aladin.co.kr/shop/wproduct.aspx?ItemId=7498220&utm_source=test').url,'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=7498220');
 assert.equal(canonicalBookUrl('https://m.yes24.com/Goods/Detail/4066828').url,'https://www.yes24.com/Product/Goods/4066828');
});
test('JSON-LD graph, metadata, entities and missing fields stay source-bound',()=>{
 const html=`<meta content="Book &amp; thoughts | Author" property="og:title"><meta property="og:image" content="javascript:alert(1)"><meta name="description" content="&lt;b&gt;소개&lt;/b&gt; &amp; 생각"><script type="application/ld+json">{"@graph":[{"@type":"Book","name":"A book","author":[{"name":"Author"}],"translator":{"name":"Translator"},"publisher":{"name":"Press"},"workExample":[{"isbn":"9788972914679","datePublished":"2010-07-30"}]}]}</script>`;
 const b=parseBook(html,canonicalBookUrl('https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=7498220'));
 assert.equal(b.title,'A book');assert.equal(b.author,'Author');assert.equal(b.translator,'Translator');assert.equal(b.isbn,'9788972914679');assert.equal(b.publishedAt,'2010-07-30');assert.equal(b.cover,'');assert.equal(b.summary,'소개 & 생각');assert.equal(b.pages,'');
});
test('redirect to a private host is rejected before fetching it',async()=>{
 let calls=0;
 await assert.rejects(()=>lookupBook('https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1',{fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://169.254.169.254/latest/meta-data/'}});}}));
 assert.equal(calls,1);
});
test('challenge/non-book pages do not become a successful card',()=>{
 assert.throws(()=>parseBook('<title>Access denied</title>',{url:'https://www.aladin.co.kr',store:'알라딘'}));
});
test('non-book graph before Book script does not hide the actual book',()=>{
 const html='<script type="application/ld+json">{"@graph":[{"@type":"Organization","name":"Store"}]}</script><script type="application/ld+json">{"@type":"Book","name":"Actual book","author":{"name":"Author"}}</script>';
 assert.equal(parseBook(html,{url:'https://www.aladin.co.kr',store:'알라딘'}).title,'Actual book');
});
