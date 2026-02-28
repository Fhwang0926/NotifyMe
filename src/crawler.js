/**
 * 메인 크롤러 — 실행, 중복 제거, DB 저장
 */

import 'dotenv/config';
import { KEYWORD_FILTER_ENABLED, INCLUDE_KW, EXCLUDE_KW } from './config.js';
import { isStartupRelated } from './utils.js';
import { crawlers } from './sites/index.js';
import { isConfigured as dbConfigured, initDb, saveCrawlResults, saveSourceStatus } from './db.js';
import { runMigrations } from './migrate.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 수집된 건을 백엔드 콘솔에 출처별로 표시 (최대 표시 건수 제한) */
const MAX_LOG_PER_SOURCE = 50;

function logCollectedRecords(source, items) {
  if (!items || items.length === 0) return;
  const list = items.slice(0, MAX_LOG_PER_SOURCE);
  console.log(`\n  [${source}] 수집 ${items.length}건 (표시 ${list.length}건):`);
  list.forEach((r, i) => {
    const name = (r['사업명'] || '-').slice(0, 50);
    const end = r['마감일자'] || r['등록일자'] || '-';
    const link = r['공고링크'] ? (r['공고링크'].length > 45 ? r['공고링크'].slice(0, 42) + '...' : r['공고링크']) : '-';
    console.log(`    ${i + 1}. ${name} | 마감: ${end}`);
    if (link !== '-') console.log(`       → ${link}`);
  });
  if (items.length > MAX_LOG_PER_SOURCE) {
    console.log(`    ... 외 ${items.length - MAX_LOG_PER_SOURCE}건`);
  }
}

export async function run() {
  const allRecords = [];
  const seen = new Set();
  const sourceStatusEntries = [];

  for (const { source, crawl } of crawlers) {
    try {
      const items = await crawl();
      const added = [];
      for (const r of items) {
        if (!r['사업명'] || r['사업명'].length < 3) continue;
        const key = `${r['사업명'].slice(0, 60).toLowerCase()}|${r['운영기관']}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allRecords.push(r);
        added.push(r);
      }
      sourceStatusEntries.push({ source, status: 'ok' });
      logCollectedRecords(source, added);
    } catch (e) {
      console.error(`크롤러 오류: ${source} →`, e.message);
      sourceStatusEntries.push({ source, status: 'error', errorMessage: e.message });
    }
    await sleep(1000);
  }

  if (sourceStatusEntries.length) {
    await saveSourceStatus(sourceStatusEntries);
  }

  let records = allRecords;
  if (KEYWORD_FILTER_ENABLED) {
    const before = records.length;
    records = records.filter((r) => isStartupRelated(r['사업명'], { INCLUDE_KW, EXCLUDE_KW }));
    console.log(`키워드 필터 적용: ${before}건 → ${records.length}건`);
  }

  console.log(`\n${'='.repeat(60)}\n총 수집: ${records.length}건 (중복제거 후)\n${'='.repeat(60)}`);
  if (records.length > 0) {
    console.log('\n📋 전체 수집 목록 요약 (출처별):');
    const bySource = {};
    records.forEach((r) => {
      const s = r['출처'] || '(미분류)';
      bySource[s] = (bySource[s] || 0) + 1;
    });
    Object.entries(bySource)
      .sort((a, b) => b[1] - a[1])
      .forEach(([s, n]) => console.log(`  ${s}: ${n}건`));
  }
  return records;
}

/**
 * 단일 출처만 크롤 (개별 수집용)
 * @param {string} sourceName - 출처명 (crawlers[].source와 일치)
 * @returns {{ records: Array, statusEntry: { source, status, errorMessage? } }}
 */
export async function runOne(sourceName) {
  const name = String(sourceName || '').trim();
  const entry = crawlers.find((c) => c.source === name);
  if (!entry) {
    return { records: [], statusEntry: { source: name, status: 'error', errorMessage: '알 수 없는 출처' } };
  }
  const { source, crawl } = entry;
  try {
    const items = await crawl();
    const records = [];
    for (const r of items) {
      if (!r['사업명'] || r['사업명'].length < 3) continue;
      let rec = { ...r };
      if (KEYWORD_FILTER_ENABLED && !isStartupRelated(rec['사업명'], { INCLUDE_KW, EXCLUDE_KW })) continue;
      records.push(rec);
    }
    logCollectedRecords(source, records);
    return { records, statusEntry: { source, status: 'ok' } };
  } catch (e) {
    console.error(`크롤러 오류: ${source} →`, e.message);
    return {
      records: [],
      statusEntry: { source, status: 'error', errorMessage: e.message },
    };
  }
}

export function analyzeData(data) {
  if (!data || !data.length) {
    console.warn('분석할 데이터가 없습니다.');
    return;
  }
  const counts = (key) => {
    const o = {};
    data.forEach((d) => {
      const v = d[key] || '(비어있음)';
      o[v] = (o[v] || 0) + 1;
    });
    return o;
  };
  console.log('\n' + '='.repeat(60));
  console.log('📊 수집 데이터 분석 결과');
  console.log('='.repeat(60));
  console.log(`\n✅ 총 수집 건수: ${data.length}건`);
  if (data.some((d) => d['분류'])) {
    console.log('\n📁 분류별 현황:');
    console.log(Object.entries(counts('분류')).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
  }
  if (data.some((d) => d['기관유형'])) {
    console.log('\n🏢 기관유형별 현황:');
    console.log(Object.entries(counts('기관유형')).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
  }
  if (data.some((d) => d['지역'])) {
    console.log('\n🗺️  지역별 현황:');
    console.log(Object.entries(counts('지역')).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
  }
  if (data.some((d) => d['D-Day'])) {
    console.log('\n⏰ 상태별 현황:');
    console.log(Object.entries(counts('D-Day')).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
  }
}

async function main() {
  if (!dbConfigured()) {
    console.error('');
    console.error('MariaDB 설정이 필요합니다.');
    console.error('.env에 DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME을 설정하세요.');
    console.error('');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('🚀 사업공고 통합 크롤러 (Node.js)');
  console.log('='.repeat(60));

  const dbOk = await initDb();
  if (!dbOk) {
    console.error('');
    console.error('DB 연결 실패. 설정 확인 후 다시 실행하세요.');
    console.error('');
    process.exit(1);
  }
  console.log('DB 연결: 성공\n');

  try {
    await runMigrations();
  } catch (e) {
    console.error('마이그레이션 실패:', e.message);
    process.exit(1);
  }

  const data = await run();
  if (data.length) {
    const ok = await saveCrawlResults(data);
    if (ok) console.log('DB: MariaDB 저장 완료');
    analyzeData(data);
    console.log('\n✅ 모든 작업 완료!');
  } else {
    console.log('수집 데이터 없음');
  }
}

// 크롤러는 화면에서 "데이터 갱신" 실행 시에만 동작합니다. npm run crawl 로는 실행하지 않습니다.
const isRunAsScript = process.argv[1] && /crawler\.js$/i.test(process.argv[1]);
if (isRunAsScript) {
  console.log('사업공고 크롤러는 대시보드에서 "데이터 갱신" 버튼을 눌렀을 때만 실행됩니다.');
  console.log('서버 실행: npm start → 브라우저에서 데이터 갱신 클릭');
  process.exit(0);
}
