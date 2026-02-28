/**
 * NTIS mng.do 페이지 HTML 구조 확인 — 공고명이 어디에 있는지
 */
import https from 'https';
import * as cheerio from 'cheerio';

const url = 'https://www.ntis.go.kr/rndgate/eg/un/ra/mng.do';
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  let data = '';
  res.on('data', (c) => (data += c));
  res.on('end', () => {
    const $ = cheerio.load(data);
    const links = $('a[href*="view.do"][href*="roRndUid"]');
    console.log('Links with view.do and roRndUid:', links.length);
    links.slice(0, 5).each((i, el) => {
      const a = $(el);
      console.log('--- Link', i + 1, '---');
      console.log('  href:', (a.attr('href') || '').slice(0, 90));
      console.log('  text:', (a.text() || '').trim().slice(0, 70));
      console.log('  title:', (a.attr('title') || '').slice(0, 70));
    });
    $('table').each((tidx, table) => {
      const $t = $(table);
      const theadText = $t.find('thead th').map((_, el) => $(el).text().trim()).get().join(' | ');
      const rows = $t.find('tbody tr');
      const withViewLink = rows.filter((_, tr) => $(tr).find('a[href*="view.do"]').length > 0);
      if (withViewLink.length > 0 || theadText.includes('공고명') || theadText.includes('순번')) {
        console.log('\nTable', tidx, 'thead:', theadText.slice(0, 120));
        console.log('  tbody tr:', rows.length, 'rows with view.do link:', withViewLink.length);
        withViewLink.slice(0, 2).each((i, tr) => {
          const tds = $(tr).find('td');
          const a = $(tr).find('a[href*="view.do"]').first();
          console.log('  --- Result row', i + 1, 'tds:', tds.length, '---');
          console.log('    a text:', (a.text() || '').trim().slice(0, 60));
          console.log('    td[2] (공고명?):', tds.eq(2).text().trim().slice(0, 60));
        });
      }
    });
  });
}).on('error', (e) => console.error(e));
