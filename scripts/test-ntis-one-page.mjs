import * as crawlers from '../src/sites/crawlers-kwbiz-mss-ntis.js';

// 1페이지만 수집해 공고명 확인 (crawlNtis 내부는 50페이지이므로 여기서 slice로 1페이지만 검증)
const { crawlNtis } = crawlers;
const res = await crawlNtis();
const firstPage = res.slice(0, 10);
console.log('Total:', res.length, '(first page sample below)');
firstPage.forEach((r, i) => {
  const name = r.사업명 ? r.사업명.slice(0, 72) : '(empty)';
  console.log((i + 1) + '.', name + (r.사업명?.length > 72 ? '...' : ''));
  console.log('   ', r.운영기관, r.시작일자, r.마감일자);
});
