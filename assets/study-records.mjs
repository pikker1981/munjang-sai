/** Shared, serializable book-study records. This module has no browser or server I/O. */
export const PEOPLE = Object.freeze([
  ['dongjin', '서동진'], ['geonguk', '안건국'], ['jihong', '유지홍'],
  ['seungcheol', '김승철'], ['jingyu', '박진규'], ['samuel', '안사무엘'],
].map(person => Object.freeze(person)));

const STUDY_LIMITS = {date: 10, time: 5, place: 300, book: 300, bookLink: 2000, bookSummary: 6000};
const INFO_LIMITS = {
  title: 300, author: 500, translator: 500, publisher: 500, publishedAt: 60,
  pages: 40, isbn: 100, cover: 2000, sourceUrl: 2000, store: 100, linkInput: 2000,
};
const MEMBER_LIMITS = {range: 300, content: 20000, questions: 20000};
const RECORD_ID = /^[a-z0-9_-]{1,80}$/;
const MAX_RECORDS = 100;
const MAX_LIBRARY_BYTES = 3_000_000;
const SEED_TIME = '2026-11-05T00:00:00.000Z';
const SEED_LINK = 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=7498220';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clipped = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';
const fail = message => { throw new Error(message); };

export function emptyStudy() {
  return {
    date: '', time: '', place: '', book: '', bookLink: '', bookSummary: '', bookInfo: null,
    members: Object.fromEntries(PEOPLE.map(([id]) => [id, {range: '', content: '', questions: ''}])),
  };
}

/** Keep only known text fields; legacy questions remain independent of presentation content. */
export function normalizeStudy(raw) {
  const study = emptyStudy();
  if (!isObject(raw)) return study;
  for (const [key, limit] of Object.entries(STUDY_LIMITS)) study[key] = clipped(raw[key], limit);
  if (isObject(raw.bookInfo) && raw.bookInfo.linkInput === study.bookLink) {
    study.bookInfo = Object.fromEntries(Object.entries(INFO_LIMITS).map(([key, limit]) => [key, clipped(raw.bookInfo[key], limit)]));
  }
  for (const [id] of PEOPLE) {
    const member = isObject(raw.members) && isObject(raw.members[id]) ? raw.members[id] : {};
    for (const [key, limit] of Object.entries(MEMBER_LIMITS)) study.members[id][key] = clipped(member[key], limit);
  }
  return study;
}

function isbn13(value) {
  const digits = value.replace(/[\s-]/gu, '');
  if (!/^97[89]\d{10}$/.test(digits)) return '';
  const sum = [...digits].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return sum % 10 === 0 ? digits : '';
}

function canonicalBookUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return '';
    const host = url.hostname.toLowerCase();
    const cleanId = id => id.replace(/^0+(?=\d)/, '');
    if (['aladin.co.kr', 'www.aladin.co.kr'].includes(host) && /^\/shop\/wproduct\.aspx$/i.test(url.pathname)) {
      const ids = [...url.searchParams].filter(([key]) => key.toLowerCase() === 'itemid').map(([, id]) => id);
      if (ids.length === 1 && /^\d{1,12}$/.test(ids[0])) return `https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=${cleanId(ids[0])}`;
    }
    if (['yes24.com', 'www.yes24.com', 'm.yes24.com'].includes(host)) {
      const match = url.pathname.match(/^\/(?:product\/goods|goods\/detail)\/(\d{1,12})\/?$/i);
      if (match) return `https://www.yes24.com/Product/Goods/${cleanId(match[1])}`;
    }
    if (host === 'product.kyobobook.co.kr') {
      const match = url.pathname.match(/^\/detail\/(S\d{6,20})\/?$/i);
      if (match) return `https://product.kyobobook.co.kr/detail/${match[1].toUpperCase()}`;
    }
  } catch { /* Unrecognized links use the normalized title instead. */ }
  return '';
}

const normalizedBookText = value => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();

/** Compare available evidence without merging editions whose valid ISBNs disagree. */
export function sameBook(rawLeft, rawRight) {
  const left = normalizeStudy(rawLeft);
  const right = normalizeStudy(rawRight);
  const leftIsbn = isbn13(left.bookInfo?.isbn || '');
  const rightIsbn = isbn13(right.bookInfo?.isbn || '');
  if (leftIsbn && rightIsbn) return leftIsbn === rightIsbn;
  const leftUrl = canonicalBookUrl(left.bookLink);
  const rightUrl = canonicalBookUrl(right.bookLink);
  if (leftUrl && leftUrl === rightUrl) return true;
  const leftTitle = normalizedBookText(left.book);
  if (!leftTitle || leftTitle !== normalizedBookText(right.book)) return false;
  const leftAuthor = normalizedBookText(left.bookInfo?.author || '').replace(/\s/gu, '');
  const rightAuthor = normalizedBookText(right.bookInfo?.author || '').replace(/\s/gu, '');
  return !(leftAuthor && rightAuthor && leftAuthor !== rightAuthor);
}

function identityFor(study) {
  const isbn = isbn13(study.bookInfo?.isbn || '');
  if (isbn) return `isbn:${isbn}`;
  const url = canonicalBookUrl(study.bookLink);
  if (url) return `url:${url}`;
  return `title:${normalizedBookText(study.book)}`;
}

export function seedRecord() {
  const study = emptyStudy();
  Object.assign(study, {
    date: '2026-11-05', time: '19:00', place: '온라인', book: '침묵의 세계', bookLink: SEED_LINK,
    bookSummary: '피카르트는 침묵을 말의 빈자리로만 보지 않아요. 다른 것에 기대지 않고 존재하는, 그 자체로 의미 있는 현상으로 바라봐요.',
    bookInfo: {
      title: '침묵의 세계', author: '막스 피카르트', translator: '최승자', publisher: '까치',
      publishedAt: '2010-07-30', pages: '278', isbn: '9788972914679',
      cover: 'assets/book-silence-cover.jpg', sourceUrl: SEED_LINK, store: '알라딘', linkInput: SEED_LINK,
    },
  });
  study.members.seungcheol.range = '1–59쪽 · 「침묵의 모습」 — 「침묵 속의 마성과 말」';
  study.members.dongjin.range = '60–106쪽 · 「말과 몸짓」 — 「형상과 침묵」';
  study.members.jihong.range = '107–145쪽 · 「사랑과 침묵」 — 「농부와 침묵」';
  study.members.geonguk.range = '146–227쪽 · 「침묵 속의 인간과 사물」 — 「잡음어」';
  study.members.samuel.range = '228쪽–끝까지 · 「라디오」 — 「침묵과 신앙」';
  return {id: 'silence', version: 1, createdAt: SEED_TIME, updatedAt: SEED_TIME, study, guide: 'silence.html', identity: identityFor(study)};
}

function checkedInteger(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) fail(`${label} 값이 올바르지 않아요.`);
  return value;
}

function checkedTimestamp(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 40 || !Number.isFinite(Date.parse(value))) fail(`${label} 값이 올바르지 않아요.`);
  return new Date(value).toISOString();
}

function checkedId(value) {
  if (typeof value !== 'string' || !RECORD_ID.test(value)) fail('모임 기록 ID가 올바르지 않아요.');
  return value;
}

function checkSize(library) {
  if (library.records.length > MAX_RECORDS) fail('모임 기록은 100권까지 보관할 수 있어요. 기존 기록을 덮어쓰지 않았어요.');
  const serialized = JSON.stringify(library);
  let bytes = 0;
  for (const character of serialized) {
    const code = character.codePointAt(0);
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes > MAX_LIBRARY_BYTES) fail('모임 기록의 전체 크기가 3MB를 넘어요. 기존 기록을 덮어쓰지 않았어요.');
  }
  return library;
}

/** Missing remote data creates the initial library; malformed saved data never resets history. */
export function normalizeLibrary(raw) {
  if (raw === null || raw === undefined) return {version: 1, revision: 0, latestId: 'silence', records: [seedRecord()]};
  if (!isObject(raw) || raw.version !== 1 || !Array.isArray(raw.records)) fail('모임 기록 파일의 구조나 버전이 올바르지 않아요.');
  const revision = checkedInteger(raw.revision, '모임 기록 수정 번호');
  const latestId = checkedId(raw.latestId);
  if (raw.records.length > MAX_RECORDS) fail('모임 기록은 100권까지 보관할 수 있어요.');
  const ids = new Set();
  const records = raw.records.map(record => {
    if (!isObject(record) || !isObject(record.study)) fail('책별 모임 기록이 올바르지 않아요.');
    const id = checkedId(record.id);
    if (ids.has(id)) fail('중복된 모임 기록 ID가 있어요.');
    ids.add(id);
    const version = checkedInteger(record.version, '책별 모임 기록 버전', 1);
    if (typeof record.study.book !== 'string' || !record.study.book.trim()) fail('책 제목이 없는 모임 기록은 복원할 수 없어요.');
    const study = normalizeStudy(record.study);
    if (!study.book.trim()) fail('책 제목이 없는 모임 기록은 복원할 수 없어요.');
    if (id === 'silence' && study.date === '2026-10-29') study.date = '2026-11-05';
    if (typeof record.identity !== 'string' || !record.identity.trim()) fail('책 식별 정보가 없는 모임 기록은 복원할 수 없어요.');
    if (record.guide !== undefined && typeof record.guide !== 'string') fail('읽기 자료 경로가 올바르지 않아요.');
    return {
      id, version,
      createdAt: checkedTimestamp(record.createdAt, '최초 저장 시각'),
      updatedAt: checkedTimestamp(record.updatedAt, '최근 저장 시각'),
      study, guide: clipped(record.guide, 300), identity: identityFor(study),
    };
  });
  if (!ids.has('silence')) {
    records.push(seedRecord());
    ids.add('silence');
  }
  if (!ids.has(latestId)) fail('대표 모임이 보관된 기록에 없어요.');
  return checkSize({version: 1, revision, latestId, records});
}

function newRecordId(records, timestamp) {
  const ids = new Set(records.map(record => record.id));
  for (let attempt = 0; attempt < 100; attempt++) {
    const uuid = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : '';
    const id = uuid && RECORD_ID.test(`book-${uuid}`)
      ? `book-${uuid}`
      : `book-${Date.parse(timestamp).toString(36)}-${Math.random().toString(36).slice(2, 12)}-${attempt.toString(36)}`;
    if (!ids.has(id)) return id;
  }
  fail('새 모임 기록 ID를 만들지 못했어요. 다시 저장해주세요.');
}

/** Return a new library. Explicit archive edits keep the existing latestId and record order. */
export function commitRecord(rawLibrary, rawStudy, options = {}) {
  if (!isObject(options)) fail('저장 옵션이 올바르지 않아요.');
  const library = normalizeLibrary(rawLibrary);
  const study = normalizeStudy(rawStudy);
  study.book = study.book.trim();
  if (!study.book) fail('책 제목을 입력한 뒤 모임 정보를 저장해주세요.');
  const suppliedNow = options.now === undefined ? new Date().toISOString() : options.now;
  let timestamp;
  if (suppliedNow instanceof Date || typeof suppliedNow === 'number') {
    if (!Number.isFinite(new Date(suppliedNow).getTime())) fail('저장 시각이 올바르지 않아요.');
    timestamp = new Date(suppliedNow).toISOString();
  } else timestamp = checkedTimestamp(suppliedNow, '저장 시각');
  const hasRecordId = options.recordId !== undefined && options.recordId !== null && options.recordId !== '';
  const identity = identityFor(study);
  const index = hasRecordId
    ? library.records.findIndex(record => record.id === checkedId(options.recordId))
    : library.records.findIndex(record => sameBook(record.study, study));
  if (hasRecordId && index === -1) fail('수정할 모임 기록을 찾지 못했어요. 기존 기록은 그대로 보관돼요.');
  const previous = index === -1 ? null : library.records[index];
  if (hasRecordId) {
    if (library.records.some(record => record.id !== previous.id && sameBook(record.study, study))) {
      fail('이미 다른 모임 기록에 보관된 책이에요. 해당 책의 기존 모임을 수정해주세요.');
    }
    if (previous.guide && !sameBook(previous.study, study)) {
      fail('읽기 자료가 연결된 모임을 다른 책으로 바꿀 수 없어요. 새 책은 새 모임으로 등록해주세요.');
    }
  }
  const id = previous?.id || newRecordId(library.records, timestamp);
  if (id === 'silence' && study.date === '2026-10-29') study.date = '2026-11-05';
  const record = {
    id, version: previous ? checkedInteger(previous.version + 1, '책별 모임 기록 버전', 1) : 1,
    createdAt: previous?.createdAt || timestamp, updatedAt: timestamp, study,
    guide: previous?.guide || '', identity,
  };
  const records = [...library.records];
  if (index === -1) records.push(record);
  else records[index] = record;
  return checkSize({
    version: 1, revision: checkedInteger(library.revision + 1, '모임 기록 수정 번호'),
    latestId: hasRecordId ? library.latestId : id, records,
  });
}
