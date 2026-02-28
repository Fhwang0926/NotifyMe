#!/usr/bin/env node
/**
 * 공고 크롤러 개별 테스트 스크립트
 *
 * 사용법:
 *   node scripts/test-crawler.js              # 크롤러 목록 출력 (1~13)
 *   node scripts/test-crawler.js 창업진흥원    # 출처명으로 1개 실행
 *   node scripts/test-crawler.js KEIT          # 출처명(부분 일치, KEIT(S-Rome 과제공고) 등)
 *   node scripts/test-crawler.js 1             # 인덱스(1~13)로 실행
 *   node scripts/test-crawler.js 9             # 예: 한국여성경제인협회
 *   node scripts/test-crawler.js all           # 전체 크롤러 순차 실행 (요약만)
 *
 * 환경: 프로젝트 루트에서 실행. .env 자동 로드.
 */

import 'dotenv/config';
import { crawlers } from '../src/sites/index.js';

const MAX_SAMPLE = 5;
const LIST_PAD = 2;

function listCrawlers() {
  console.log('\n[크롤러 목록]\n');
  crawlers.forEach((c, i) => {
    console.log(`  ${String(i + 1).padStart(LIST_PAD)}. ${c.source}`);
  });
  console.log(`\n예: node scripts/test-crawler.js 창업진흥원`);
  console.log(`예: node scripts/test-crawler.js 1   # 1~${crawlers.length} 인덱스`);
  console.log(`예: node scripts/test-crawler.js all\n`);
}

function printRecords(records, max = MAX_SAMPLE) {
  if (!records.length) return;
  const show = records.slice(0, max);
  show.forEach((r, i) => {
    console.log(`    ${i + 1}. ${r.사업명?.slice(0, 60) || r.사업명 || '-'}${r.사업명?.length > 60 ? '...' : ''}`);
    const sub = [];
    if (r.분류) sub.push(`분류: ${r.분류}`);
    if (r.마감일자 || r.등록일자) sub.push(`마감: ${r.마감일자 || '-'}  등록: ${r.등록일자 || '-'}`);
    if (r.조회수) sub.push(`조회: ${r.조회수}`);
    if (sub.length) console.log(`       ${sub.join('  ')}`);
    if (r.공고링크) console.log(`       → ${r.공고링크.slice(0, 70)}${r.공고링크.length > 70 ? '...' : ''}`);
  });
  if (records.length > max) console.log(`    ... 외 ${records.length - max}건`);
}

async function runOne(sourceNameOrIndex) {
  let idx = -1;
  const n = parseInt(sourceNameOrIndex, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= crawlers.length) {
    idx = n - 1;
  } else {
    const name = sourceNameOrIndex.trim().toLowerCase();
    idx = crawlers.findIndex((c) => c.source.toLowerCase().includes(name));
  }
  if (idx < 0) {
    console.error(`크롤러를 찾을 수 없습니다: ${sourceNameOrIndex}`);
    listCrawlers();
    process.exit(1);
  }
  const { source, crawl } = crawlers[idx];
  console.log(`\n[테스트] ${source} (${idx + 1}/${crawlers.length})\n`);
  const start = Date.now();
  try {
    const records = await crawl();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  수집: ${records?.length ?? 0}건  (${elapsed}s)\n`);
    if (records?.length) {
      console.log('  [샘플]');
      printRecords(records);
    }
    console.log('');
    return records?.length ?? 0;
  } catch (e) {
    console.error('  오류:', e.message);
    if (e.stack) console.error(e.stack);
    process.exit(1);
  }
}

async function runAll() {
  console.log('\n[전체 크롤러 요약 테스트]\n');
  let total = 0;
  for (let i = 0; i < crawlers.length; i++) {
    const { source, crawl } = crawlers[i];
    process.stdout.write(`  ${String(i + 1).padStart(LIST_PAD)}. ${source.padEnd(24)} ... `);
    const start = Date.now();
    try {
      const records = await crawl();
      const n = records?.length ?? 0;
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`${n}건 (${elapsed}s)`);
      total += n;
    } catch (e) {
      console.log(`실패: ${e.message}`);
    }
  }
  console.log(`\n  총 수집: ${total}건\n`);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    listCrawlers();
    return;
  }
  if (arg.toLowerCase() === 'all') {
    await runAll();
    return;
  }
  await runOne(arg);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
