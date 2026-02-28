/**
 * KEIT S-Rome 과제공고 페이지 HTML 구조 확인
 */
import https from 'https';
import * as cheerio from 'cheerio';

const url = 'https://srome.keit.re.kr/srome/biz/perform/opnnPrpsl/retrieveTaskAnncmListView.do?prgmId=XPG201040000&pageIndex=1';
const html = await new Promise((resolve, reject) => {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => resolve(d));
  }).on('error', reject);
});

const $ = cheerio.load(html);
console.log('--- table tbody tr count ---');
console.log($('table tbody tr').length);
console.log('--- first 3 table rows (td count, first 100 chars of text) ---');
$('table tbody tr').slice(0, 5).each((i, tr) => {
  const tds = $(tr).find('td');
  const links = $(tr).find('a[href]');
  console.log('Row', i + 1, 'tds:', tds.length, 'links:', links.length);
  links.slice(0, 2).each((j, el) => {
    const a = $(el);
    console.log('  a href:', (a.attr('href') || '').slice(0, 90), '| text:', (a.text() || '').trim().slice(0, 50));
  });
  if (tds.length) console.log('  td[1] text:', tds.eq(1).text().trim().slice(0, 60));
});
console.log('--- any a[href*="View"], a[href*="retrieveTaskAnncm"] ---');
$('a[href*="View"], a[href*="retrieveTaskAnncm"], a[href*="Detail"]').each((i, el) => {
  const a = $(el);
  if (i >= 5) return false;
  console.log((a.attr('href') || '').slice(0, 100), '|', (a.text() || '').trim().slice(0, 40));
});
console.log('--- elements containing 2026년도 자동차 (title text) ---');
const bodyHtml = $('body').html() || '';
const idx = bodyHtml.indexOf('2026년도 자동차');
if (idx >= 0) {
  const snippet = bodyHtml.slice(Math.max(0, idx - 200), idx + 150);
  console.log('HTML snippet around title:', snippet.replace(/\s+/g, ' ').slice(0, 400));
}
console.log('--- all a tags with long text (possible title) ---');
$('a').each((_, el) => {
  const a = $(el);
  const text = a.text().trim();
  if (text.length < 20 || !/2026|공고|과제|사업/.test(text)) return;
  const href = a.attr('href') || '';
  const onclick = a.attr('onclick') || '';
  const dataAttrs = [];
  for (const key of Object.keys(el.attribs || {})) {
    if (key.startsWith('data-') || key.startsWith('@')) dataAttrs.push(key + '=' + (el.attribs[key] || '').slice(0, 30));
  }
  console.log('href:', href.slice(0, 60), 'onclick:', onclick.slice(0, 80), 'data:', dataAttrs.join(' '));
  console.log('  text:', text.slice(0, 55));
});
