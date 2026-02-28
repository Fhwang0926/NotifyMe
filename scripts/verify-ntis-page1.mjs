/**
 * NTIS 1페이지만 GET 후 결과 테이블 파싱해 공고명 출력 확인
 */
import https from 'https';
import * as cheerio from 'cheerio';

const url = 'https://www.ntis.go.kr/rndgate/eg/un/ra/mng.do';
const html = await new Promise((resolve, reject) => {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => resolve(d));
  }).on('error', reject);
});

const $ = cheerio.load(html);
const resultTable = $('table').filter((_, t) => $(t).find('thead th').text().includes('공고명')).first();
const rows = resultTable.find('tbody tr');
console.log('Result table rows:', rows.length);

rows.each((i, tr) => {
  const tds = $(tr).find('td');
  const a = $(tr).find('a[href*="view.do"]').first();
  if (!a.length || tds.length < 7) return;
  const title = (a.attr('title') || a.text() || '').trim();
  console.log((i + 1) + '.', title.slice(0, 70) + (title.length > 70 ? '...' : ''));
  if (i >= 4) return false;
});
