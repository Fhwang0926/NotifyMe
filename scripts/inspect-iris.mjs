/**
 * IRIS retrieveBsnsAncmBtinSituListView.do 페이지 링크/구조 확인
 */
import https from 'https';
import * as cheerio from 'cheerio';

const url = 'https://www.iris.go.kr/contents/retrieveBsnsAncmBtinSituListView.do?pageIndex=1';
const html = await new Promise((resolve, reject) => {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => resolve(d));
  }).on('error', reject);
});

const $ = cheerio.load(html);
console.log('--- Links with ancmId or retrieveBsnsAncmView ---');
$('a[href*="ancmId"], a[href*="retrieveBsnsAncmView"]').each((i, el) => {
  const a = $(el);
  console.log((i + 1), 'href:', (a.attr('href') || '').slice(0, 100), 'text:', (a.text() || '').trim().slice(0, 50));
});
console.log('\n--- All links in content area (first 15) ---');
let n = 0;
$('a[href]').each((_, el) => {
  const a = $(el);
  const href = a.attr('href') || '';
  const text = a.text().trim();
  if (text.length < 10) return;
  if (/매뉴얼|고객센터|로그인|회원가입|이전|다음|검색/i.test(text)) return;
  n++;
  if (n > 15) return false;
  console.log(n, 'href:', href.slice(0, 90), '| text:', text.slice(0, 55));
});
console.log('\n--- Blocks that look like list items (div/li with 공고) ---');
$('div, li, tr').each((_, el) => {
  const $el = $(el);
  const t = $el.text();
  if (!/공고번호|공고일자|접수중|접수예정/.test(t)) return;
  const link = $el.find('a[href]').first();
  if (!link.length) return;
  const href = link.attr('href') || '';
  console.log('block href:', href.slice(0, 80), '| title:', (link.text() || '').trim().slice(0, 50));
  return false;
});
