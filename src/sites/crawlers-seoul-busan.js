/**
 * 서울R&BD, 부산경제진흥원, 2030청년창업지원센터, BTIS
 */

import * as cheerio from 'cheerio';
import { safeGet, requireOk } from '../http.js';
import { createRecord } from '../utils.js';
import { urlJoin } from './utils.js';

export async function crawlSeoulRnbd() {
  console.log('[2] 서울R&BD...');
  const results = [];
  for (let pg = 1; pg <= 3; pg++) {
    const res = await safeGet(
      `https://seoul.rnbd.kr/client/c030100/c030100_00.jsp?cPage=${pg}`
    );
    if (pg === 1) requireOk(res, '서울R&BD 페이지 요청 실패(비정상 상태코드 또는 네트워크 오류)');
    if (!res) continue;
    const $ = cheerio.load(res.data);
    $('table tbody tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 4) return;
      const a = $(tr).find('a').first();
      if (!a.length) return;
      const title = a.text().trim();
      if (!title) return;
      const href = a.attr('href') || '';
      const link = urlJoin('https://seoul.rnbd.kr/client/c030100/', href);
      const periodText = tds.eq(2).text().trim();
      const dates = periodText.match(/\d{4}-\d{2}-\d{2}/g) || [];
      const start = dates[0] || '';
      const end = dates[1] || '';
      let views = '';
      if (tds.length >= 5) {
        const v = tds.eq(4).text().trim().replace(/,/g, '');
        if (/^\d+$/.test(v)) views = v;
      }
      results.push(createRecord({
        분류: 'R&D', 사업명: title, 운영기관: '서울R&BD',
        기관유형: '지자체(서울)', 시작일자: start, 마감일자: end,
        조회수: views, 공고링크: link, 출처: '서울R&BD',
      }));
    });
  }
  console.log(`  → ${results.length}건`);
  return results;
}

/** 부산경제진흥원 — 중소기업 목록(진행중, 2026). 테이블: 제목, 번호, 주관, 첨부, 등록일, 조회수 */
export async function crawlBepa() {
  console.log('[3] 부산경제진흥원...');
  const results = [];
  const seen = new Set();
  const baseUrl = 'https://www.bepa.kr';
  const listBase =
    `${baseUrl}/kor/view.do?items=%EC%A4%91%EC%86%8C%EA%B8%B0%EC%97%85&no=1505&view=list&sdate=&edate=&sv=TITLE&sw=&periodState=ing&syear=2026&smonth=&sday=&eyear=&emonth=&eday=`;
  let page = 1;
  const maxPage = 50;
  while (page <= maxPage) {
    const listUrl = `${listBase}&pageIndex=${page}`;
    const res = await safeGet(listUrl);
    if (page === 1) requireOk(res, '부산경제진흥원 페이지 요청 실패(비정상 상태코드 또는 네트워크 오류)');
    if (!res) break;
    const $ = cheerio.load(res.data);
    let found = 0;

    $('table tbody tr, table tr').each((_, tr) => {
      const $tr = $(tr);
      const tds = $tr.find('td');
      if (tds.length < 3) return;
      const rowText = $tr.text();
      if (/제목|번호|주관|등록일|조회수/.test(rowText) && rowText.length < 100) return;

      const titleLink = $tr.find('a[href*="/kor/view.do"]').filter((_, a) => {
        const t = $(a).text().trim();
        return t.length >= 5 && t !== '진행중' && !/^[\d]+$/.test(t);
      }).first();
      if (!titleLink.length) return;
      const title = titleLink.text().trim();
      if (title.length < 5) return;
      let link = titleLink.attr('href') || '';
      link = link.startsWith('http') ? link : urlJoin(baseUrl, link);
      if (seen.has(link)) return;
      seen.add(link);
      found++;

      let regDate = '';
      const dateMatch = rowText.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
      if (dateMatch) regDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      if (!regDate && tds.length >= 5) {
        tds.each((_, td) => {
          const t = $(td).text().trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(t)) regDate = t;
        });
      }

      let views = '';
      const viewsMatch = rowText.match(/조회수\s*[:]?\s*([\d,]+)/);
      if (viewsMatch) views = viewsMatch[1].replace(/,/g, '');
      if (!views && tds.length >= 6) {
        const lastTd = tds.eq(tds.length - 2).text().trim();
        if (/^\d+$/.test(lastTd)) views = lastTd;
      }

      let org = '부산경제진흥원';
      if (/부산광역시/.test(rowText)) org = '부산광역시';
      else if (/부산경제진흥원/.test(rowText)) org = '부산경제진흥원';
      if (tds.length >= 3) {
        tds.each((_, td) => {
          const t = $(td).text().trim();
          if (t === '부산광역시' || t === '부산경제진흥원') org = t;
        });
      }

      results.push(createRecord({
        분류: '중소기업',
        사업명: title,
        운영기관: org,
        기관유형: '지자체(부산)',
        등록일자: regDate,
        조회수: views,
        공고링크: link,
        출처: '부산경제진흥원',
      }));
    });

    if (found === 0) break;
    page += 1;
  }
  console.log(`  → ${results.length}건`);
  return results;
}

export async function crawlJung2030() {
  console.log('[4] 2030청년창업지원센터...');
  const results = [];
  let res = await safeGet('http://jung2030.or.kr/board/notice');
  if (!res) res = await safeGet('http://jung2030.or.kr/');
  requireOk(res, '대구 2030 청년창업지원센터 페이지 요청 실패(비정상 상태코드 또는 네트워크 오류)');
  const $ = cheerio.load(res.data);
  $('a[href*="/post/"]').each((_, el) => {
    const a = $(el);
    let title = a.text().trim();
    if (title.length < 5) return;
    const link = urlJoin('http://jung2030.or.kr/', a.attr('href') || '');
    const parentText = a.parent().text() || '';
    const dm = parentText.match(/(\d{4})[.-](\d{2})[.-](\d{2})/);
    const reg = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : '';
    title = title.replace(/관리자\d{4}\.\d{2}\.\d{2}/g, '').trim();
    title = title.replace(/^\d{1,3}(?=\d{4}년)/, '').trim();
    results.push(createRecord({
      분류: '청년창업', 사업명: title, 운영기관: '대구 중구 2030청년창업지원센터',
      기관유형: '지자체(대구)', 등록일자: reg, 공고링크: link, 출처: '대구 2030 청년창업지원센터',
    }));
  });
  console.log(`  → ${results.length}건`);
  return results;
}

export async function crawlBtis() {
  console.log('[5] BTIS 부산과학기술정보서비스...');
  const results = [];
  const seen = new Set();
  const listConfigs = [
    { mId: '35', ts_tabBusi: '2', 분류: '부산시R&D' },
    { mId: '79', ts_tabBusi: '1', 분류: '국가R&D' },
  ];
  const baseUrl = 'https://btis.bistep.re.kr/web/board/list.do';
  const maxPagesPerBoard = 50;

  for (const { mId, ts_tabBusi, 분류 } of listConfigs) {
    let page = 1;
    while (page <= maxPagesPerBoard) {
      const url = `${baseUrl}?${new URLSearchParams({ mId, ts_tabBusi, page: String(page) }).toString()}`;
      const res = await safeGet(url);
      const isFirstRequest = listConfigs[0].mId === mId && page === 1;
      if (isFirstRequest) requireOk(res, 'BTIS 목록 요청 실패(비정상 상태코드 또는 네트워크 오류)');
      if (!res) break;
      const $ = cheerio.load(res.data);
      let found = 0;
      $('table tbody tr').each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length < 4) return;
        const a = $(tr).find('a[href*="view.do"], a[href*="detail"], a[href*="View.do"]').first();
        const fallbackLink = $(tr).find('a[href]').first();
        const linkEl = a.length ? a : fallbackLink;
        if (!linkEl.length) return;
        const title = linkEl.text().trim();
        if (!title || title.length < 3) return;
        let link = linkEl.attr('href') || '';
        if (link && !link.startsWith('http')) link = urlJoin('https://btis.bistep.re.kr/web/board/', link);
        const key = `${title.slice(0, 80)}|${link}`;
        if (seen.has(key)) return;
        seen.add(key);
        found++;
        const org = tds.length >= 3 ? tds.eq(2).text().trim() : 'BTIS';
        let regDate = '';
        for (let i = 0; i < tds.length; i++) {
          const t = tds.eq(i).text().trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
            regDate = t;
            break;
          }
        }
        results.push(createRecord({
          분류,
          사업명: title,
          운영기관: org || 'BTIS',
          기관유형: '공공기관',
          등록일자: regDate,
          공고링크: link,
          출처: 'BTIS',
        }));
      });
      if (found === 0) break;
      page += 1;
    }
  }
  console.log(`  → ${results.length}건`);
  return results;
}
