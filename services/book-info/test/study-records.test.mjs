import test from 'node:test';
import assert from 'node:assert/strict';
import {PEOPLE, emptyStudy, normalizeStudy, seedRecord, normalizeLibrary, commitRecord, sameBook} from '../lib/study-records.mjs';

const NOW = '2026-11-06T10:00:00.000Z';
const newStudy = (book = '다음에 함께 읽을 책') => ({...emptyStudy(), book, date: '2026-11-12', time: '19:00', place: '온라인'});
const deepFreeze = value => {
  for (const child of Object.values(value)) if (child && typeof child === 'object') deepFreeze(child);
  return Object.freeze(value);
};

test('seed includes the corrected date, edition metadata, six members and original assignments', () => {
  const library = normalizeLibrary(null);
  const record = library.records[0];
  assert.deepEqual(library, normalizeLibrary(undefined));
  assert.deepEqual(PEOPLE.map(([, name]) => name), ['서동진', '안건국', '유지홍', '김승철', '박진규', '안사무엘']);
  assert.equal(library.latestId, 'silence');
  assert.equal(record.study.date, '2026-11-05');
  assert.equal(record.study.time, '19:00');
  assert.equal(record.study.place, '온라인');
  assert.equal(record.study.bookInfo.isbn, '9788972914679');
  assert.equal(record.study.bookInfo.cover, 'assets/book-silence-cover.jpg');
  assert.equal(record.guide, 'silence.html');
  assert.equal(record.identity, 'isbn:9788972914679');
  assert.match(record.study.members.dongjin.range, /60–106쪽.*말과 몸짓.*형상과 침묵/u);
  assert.match(record.study.members.samuel.range, /228쪽–끝까지.*라디오.*침묵과 신앙/u);
  assert.equal(record.study.members.jingyu.range, '');
  record.study.date = '2026-10-29';
  record.study.members.dongjin.questions = '기존 질문은 남겨주세요.';
  const migrated = normalizeLibrary(library);
  assert.equal(migrated.records[0].study.date, '2026-11-05');
  assert.equal(migrated.records[0].study.members.dongjin.questions, '기존 질문은 남겨주세요.');
});

test('committing a new book makes it latest while retaining every previous record', () => {
  const initial = normalizeLibrary(null);
  const second = commitRecord(initial, newStudy('두 번째 책'), {now: NOW});
  const third = commitRecord(second, newStudy('세 번째 책'), {now: NOW});
  assert.equal(third.records.length, 3);
  assert.deepEqual(third.records.slice(0, 2), second.records);
  assert.equal(third.latestId, third.records[2].id);
  assert.match(third.latestId, /^[a-z0-9_-]{1,80}$/);
  assert.equal(third.records[2].version, 1);
  assert.equal(third.records[2].createdAt, NOW);
  assert.equal(third.revision, 2);
});

test('editing an archived record changes only that record and preserves latestId and order', () => {
  const library = commitRecord(null, newStudy(), {now: NOW});
  const study = structuredClone(library.records[0].study);
  study.members.jingyu.content = '과거 모임에 덧붙인 발제';
  const updated = commitRecord(library, study, {recordId: 'silence', now: '2026-11-07T10:00:00.000Z'});
  assert.equal(updated.latestId, library.latestId);
  assert.deepEqual(updated.records.map(record => record.id), library.records.map(record => record.id));
  assert.equal(updated.records[0].version, 2);
  assert.equal(updated.records[0].createdAt, library.records[0].createdAt);
  assert.equal(updated.records[0].guide, 'silence.html');
  assert.equal(updated.records[0].study.members.jingyu.content, study.members.jingyu.content);
  assert.deepEqual(updated.records[1], library.records[1]);
  assert.throws(() => commitRecord(library, study, {recordId: 'missing', now: NOW}), /찾지 못/u);
});

test('repeated ISBN, supported canonical URL and normalized title identities do not duplicate books', () => {
  const isbnStudy = seedRecord().study;
  isbnStudy.book = '같은 판본의 변경된 제목';
  isbnStudy.bookLink = 'https://www.yes24.com/Product/Goods/4066828';
  isbnStudy.bookInfo.linkInput = isbnStudy.bookLink;
  isbnStudy.bookInfo.isbn = '978-89-7291-467-9';
  const isbnLibrary = commitRecord(commitRecord(null, newStudy(), {now: NOW}), isbnStudy, {now: NOW});
  assert.equal(isbnLibrary.records.length, 2);
  assert.equal(isbnLibrary.latestId, 'silence');
  assert.equal(isbnLibrary.records[0].version, 2);

  const pairs = [
    ['http://aladin.co.kr/shop/wproduct.aspx?itemid=0001234&utm_source=test#preview', 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1234'],
    ['https://m.yes24.com/goods/detail/001234?tracking=1', 'https://www.yes24.com/Product/Goods/1234'],
    ['https://product.kyobobook.co.kr/detail/s00000123456?utm_source=test', 'https://product.kyobobook.co.kr/detail/S00000123456/'],
  ];
  for (const [first, second] of pairs) {
    const original = {...newStudy('링크로 식별한 책'), bookLink: first};
    const once = commitRecord(null, original, {now: NOW});
    const twice = commitRecord(once, {...original, book: '제목이 달라도 같은 책', bookLink: second}, {now: NOW});
    assert.equal(twice.records.length, 2);
    assert.equal(twice.latestId, once.latestId);
    assert.equal(twice.records[1].version, 2);
  }
  const once = commitRecord(null, newStudy('  Ｂｏｏｋ   한 권  '), {now: NOW});
  const twice = commitRecord(once, newStudy('book 한 권'), {now: NOW});
  assert.equal(twice.records.length, 2);
  assert.equal(twice.latestId, once.latestId);
});

test('sameBook matches an ISBN-bearing seed and the same Aladin URL without ISBN metadata', () => {
  const seed = seedRecord().study;
  const withoutInfo = {
    ...newStudy('정보를 불러오기 전 제목'),
    bookLink: 'http://aladin.co.kr/shop/wproduct.aspx?itemid=07498220&utm_source=test#preview',
  };
  assert.equal(sameBook(seed, withoutInfo), true);
  assert.equal(sameBook(withoutInfo, seed), true);
  const saved = commitRecord(null, withoutInfo, {now: NOW});
  assert.equal(saved.records.length, 1);
  assert.equal(saved.records[0].id, 'silence');
  assert.equal(saved.records[0].version, 2);
});

test('sameBook keeps distinct valid ISBN editions separate despite matching titles and URLs', () => {
  const seed = seedRecord().study;
  const otherEdition = structuredClone(seed);
  otherEdition.bookInfo.isbn = '9780306406157';
  assert.equal(sameBook(seed, otherEdition), false);
  assert.equal(sameBook(otherEdition, seed), false);
  const saved = commitRecord(null, otherEdition, {now: NOW});
  assert.equal(saved.records.length, 2);
  assert.equal(saved.records[0].study.bookInfo.isbn, '9788972914679');
  assert.equal(saved.records[1].study.bookInfo.isbn, '9780306406157');
  assert.equal(saved.records[1].version, 1);
});

test('sameBook matches the same ISBN across different bookstores', () => {
  const seed = seedRecord().study;
  const elsewhere = structuredClone(seed);
  elsewhere.book = '다른 서점에서 가져온 제목';
  elsewhere.bookLink = 'https://www.yes24.com/Product/Goods/4066828';
  elsewhere.bookInfo.linkInput = elsewhere.bookLink;
  elsewhere.bookInfo.isbn = '978-89-7291-467-9';
  assert.equal(sameBook(seed, elsewhere), true);
  assert.equal(sameBook(elsewhere, seed), true);
  assert.equal(commitRecord(null, elsewhere, {now: NOW}).records.length, 1);
});

test('sameBook title fallback accepts missing authors and rejects clearly different known authors', () => {
  const left = newStudy('  Ｂｏｏｋ   한 권  ');
  left.bookInfo = {linkInput: '', author: '막스 피카르트'};
  const right = newStudy('book 한 권');
  right.bookInfo = {linkInput: '', author: '막스피카르트'};
  assert.equal(sameBook(left, right), true);
  right.bookInfo.author = '다른 저자';
  assert.equal(sameBook(left, right), false);
  right.bookInfo = null;
  assert.equal(sameBook(left, right), true);
  assert.equal(sameBook(emptyStudy(), emptyStudy()), false);
});

test('explicit record edits reject a collision with another archived book', () => {
  const library = commitRecord(null, newStudy('다른 기록의 책'), {now: NOW});
  const before = JSON.stringify(library);
  assert.throws(() => commitRecord(library, library.records[1].study, {recordId: 'silence', now: NOW}), /이미 다른 모임 기록/u);
  assert.throws(() => commitRecord(library, library.records[0].study, {recordId: library.records[1].id, now: NOW}), /이미 다른 모임 기록/u);
  assert.equal(JSON.stringify(library), before);
});

test('explicit guided record edits reject replacing the book while allowing metadata and title corrections', () => {
  const library = normalizeLibrary(null);
  assert.throws(() => commitRecord(library, newStudy('완전히 다른 책'), {recordId: 'silence', now: NOW}), /새 책은 새 모임으로 등록/u);
  const titleCorrection = structuredClone(library.records[0].study);
  titleCorrection.book = '침묵의 세계 · 제목 수정';
  assert.equal(commitRecord(library, titleCorrection, {recordId: 'silence', now: NOW}).records[0].version, 2);
  const urlCorrection = {...newStudy('서지 정보를 다시 확인한 제목'), bookLink: library.records[0].study.bookLink};
  const saved = commitRecord(library, urlCorrection, {recordId: 'silence', now: NOW});
  assert.equal(saved.records[0].guide, 'silence.html');
  assert.equal(saved.records[0].study.book, urlCorrection.book);
});

test('normalizing and committing return independent data without mutating frozen inputs', () => {
  const library = deepFreeze(normalizeLibrary(null));
  const study = deepFreeze(newStudy());
  const before = JSON.stringify({library, study});
  const saved = commitRecord(library, study, {now: NOW});
  const restored = normalizeLibrary(library);
  saved.records[0].study.members.dongjin.content = '별도의 사본';
  saved.records[1].study.members.samuel.questions = '새 질문';
  restored.records[0].study.bookInfo.author = '사본의 저자';
  assert.equal(JSON.stringify({library, study}), before);
  assert.equal(seedRecord().study.members.dongjin.content, '');
  assert.equal(emptyStudy().members.samuel.questions, '');
});

test('malformed restored data throws instead of silently replacing history with the seed', () => {
  const valid = normalizeLibrary(null);
  for (const invalid of [false, '', [], {}, {version: 2, revision: 0, latestId: 'silence', records: []}, {...valid, records: null}, {...valid, revision: -1}, {...valid, latestId: 'missing'}]) {
    assert.throws(() => normalizeLibrary(invalid));
  }
  for (const patch of [{id: '../silence'}, {version: 0}, {study: {}}, {identity: ''}, {createdAt: ''}]) {
    assert.throws(() => normalizeLibrary({...valid, records: [{...valid.records[0], ...patch}]}));
  }
  assert.throws(() => normalizeLibrary({...valid, records: [valid.records[0], valid.records[0]]}), /중복/u);
  const noSeed = commitRecord(valid, newStudy(), {now: NOW});
  noSeed.records.shift();
  const restored = normalizeLibrary(noSeed);
  assert.equal(restored.records.length, 2);
  assert.equal(restored.latestId, noSeed.latestId);
  assert.equal(restored.records[1].guide, 'silence.html');
});

test('blank commits fail and normalization keeps only bounded strings including legacy questions', () => {
  for (const blank of [null, {}, emptyStudy(), newStudy(' \n\t ')]) assert.throws(() => commitRecord(null, blank, {now: NOW}), /책 제목/u);
  const raw = {
    date: '2026-11-05extra', time: '19:00extra', place: '장'.repeat(400), book: '책'.repeat(400),
    bookLink: 'x'.repeat(2001), bookSummary: '소'.repeat(7000),
    bookInfo: {title: {toString() { throw new Error('must not coerce objects'); }}, linkInput: 'x'.repeat(2000)},
    members: {dongjin: {range: '쪽'.repeat(400), content: '내'.repeat(21000), questions: '질'.repeat(21000)}, outsider: {content: 'ignored'}},
    unknown: 'ignored',
  };
  const normalized = normalizeStudy(raw);
  assert.deepEqual(Object.keys(normalized), Object.keys(emptyStudy()));
  for (const [key, limit] of Object.entries({date: 10, time: 5, place: 300, book: 300, bookLink: 2000, bookSummary: 6000})) assert.equal(normalized[key].length, limit);
  assert.equal(normalized.bookInfo.title, '');
  assert.equal(normalized.members.dongjin.range.length, 300);
  assert.equal(normalized.members.dongjin.content.length, 20000);
  assert.equal(normalized.members.dongjin.questions.length, 20000);
  assert.equal(normalized.members.outsider, undefined);
});

test('record and UTF-8 size limits reject writes without dropping saved records', () => {
  const library = normalizeLibrary(null);
  for (let index = 1; index < 100; index++) {
    const record = {...seedRecord(), id: `saved-${index}`, study: newStudy(`보관된 책 ${index}`)};
    library.records.push(record);
  }
  const before = JSON.stringify(library);
  assert.throws(() => commitRecord(library, newStudy('101번째 책'), {now: NOW}), /100권/u);
  assert.equal(JSON.stringify(library), before);

  const oversized = normalizeLibrary(null);
  for (let index = 1; index < 6; index++) {
    const study = newStudy(`긴 발제 ${index}`);
    for (const member of Object.values(study.members)) Object.assign(member, {content: '가'.repeat(20000), questions: '나'.repeat(20000)});
    oversized.records.push({...seedRecord(), id: `large-${index}`, study});
  }
  assert.throws(() => normalizeLibrary(oversized), /3MB/u);
});
