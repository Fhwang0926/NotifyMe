/**
 * 한국여성경제인협회, 중소벤처기업부, NTIS
 */

import * as cheerio from 'cheerio';
import { safeGet, safePost, requireOk } from '../http.js';
import { createRecord, normDate } from '../utils.js';
import { urlJoin } from './utils.js';

export async function crawlKwbiz() {
  console.log('[10] 한국여성경제인협회...');
  const results = [];
  const seen = new Set();
  const base = 'https://www.kwbiz.or.kr';
  const add = (title, link, regDate = '') => {
    if (!title || title.length < 5 || title.length > 300) return;
    const key = `${title.slice(0, 120)}|${link}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (link && !link.startsWith('http')) return;
    results.push(createRecord({
      분류: '여성기업',
      사업명: title.trim(),
      운영기관: '한국여성경제인협회',
      기관유형: '협회',
      등록일자: regDate,
      공고링크: link,
      출처: '한국여성경제인협회',
    }));
  };

  const skipTitle = (t) => !t || /^view\s*more|더보기|more$/i.test(t.trim()) || t.trim().length < 5;

  const resolveKwbizLink = (href) => {
    if (!href || href.startsWith('http')) return href;
    const goDetail = href.match(/goDetail\s*\(\s*['"]?([^'")]+)['"]?\s*\)/i);
    if (goDetail) {
      const id = goDetail[1].trim();
      if (/^BOARD_\d+$/i.test(id)) return `${base}/notice/${id}`;
    }
    if (/\/notice\/BOARD_|view\.do|detail|Detail/i.test(href)) return urlJoin(base, href);
    return href;
  };

  const parseListPage = (html, pageUrl) => {
    const $ = cheerio.load(html);
    let found = 0;
    $('table tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const tds = $tr.find('td');
      const detailLinks = $tr.find('a[href*="view.do"], a[href*="View.do"], a[href*="detail"], a[href*="Detail"], a[href*="goDetail"], a[href*="notice/BOARD_"], a[href*="/notice/"]').filter((_, a) => {
        const href = $(a).attr('href') || '';
        return /BOARD_|view\.do|detail|Detail|goDetail/i.test(href);
      });
      const linkEl = detailLinks.first();
      if (!linkEl.length || tds.length < 2) return;
      let link = resolveKwbizLink(linkEl.attr('href') || '');
      if (!link || !link.startsWith('http') || link === pageUrl) return;
      let title = (linkEl.attr('title') || linkEl.attr('data-title') || linkEl.text()).trim();
      if (skipTitle(title)) {
        const titleTd = linkEl.closest('td');
        const titleTdText = titleTd.length ? titleTd.text().trim().replace(/\s+/g, ' ') : '';
        if (titleTdText.length > title.length && !skipTitle(titleTdText) && titleTdText.length < 300) title = titleTdText;
        else {
          let bestTitle = '';
          tds.each((_, td) => {
            const t = $(td).text().trim().replace(/\s+/g, ' ');
            if (t.length > bestTitle.length && !skipTitle(t) && !/^\d+$/.test(t) && !/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(t) && t.length < 300) bestTitle = t;
          });
          $tr.find('a[href]').each((_, a) => {
            const t = $(a).text().trim().replace(/\s+/g, ' ');
            if (t.length > bestTitle.length && !skipTitle(t) && t.length < 300) bestTitle = t;
          });
          title = bestTitle;
        }
      }
      if (!title || title.length < 5) return;
      let regDate = '';
      tds.each((_, td) => {
        const t = $(td).text().trim();
        if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(t)) regDate = normDate(t) || t.replace(/\./g, '-');
      });
      add(title, link, regDate);
      found++;
    });
    if (found === 0) {
      $('.board-list a, .list-wrap a, ul.list a, .bbs-list a, [class*="list"] a, article a').each((_, el) => {
        const a = $(el);
        const href = a.attr('href') || '';
        if (!href || /^#|javascript:/.test(href)) return;
        if (!/view\.do|detail|Detail|goDetail|board\.php\?.*wr_id|nttId|notice\/BOARD_/i.test(href)) return;
        let title = a.text().trim();
        if (skipTitle(title) || title.length > 300) return;
        const link = href.startsWith('http') ? href : urlJoin(base, href);
        add(title, link);
        found++;
      });
    }
    return found;
  };

  const candidateListUrls = [
    `${base}/notice`,
    `${base}/board/notice/list.do`,
    `${base}/kr/contents/bbs/list.do`,
    `${base}/kr/board/list.do`,
    `${base}/support/notice/list.do`,
    `${base}/biz/notice/list.do`,
    `${base}/`,
  ];

  for (const listUrl of candidateListUrls) {
    const res = await safeGet(listUrl);
    if (!res) continue;
    if (listUrl === `${base}/`) requireOk(res, '한국여성경제인협회 메인 페이지 요청 실패');
    const $ = cheerio.load(res.data);
    if (listUrl === `${base}/`) {
      const boardLinks = [];
      $('a[href]').each((_, el) => {
        const a = $(el);
        const href = (a.attr('href') || '').trim();
        const text = a.text().trim();
        if (!href || /^#|javascript:/.test(href)) return;
        const hasBoard = /board|bbs|notice|list\.do|공지|사업공고|창업|지원사업/.test(href + text);
        if (hasBoard && text.length >= 4 && text.length <= 200) {
          const full = href.startsWith('http') ? href : urlJoin(base, href);
          if (full.startsWith(base) && !boardLinks.includes(full)) boardLinks.push(full);
        }
      });
      for (const u of boardLinks.slice(0, 10)) {
        if (results.length >= 80) break;
        const r = await safeGet(u);
        if (r) parseListPage(r.data, u);
      }
    }
    let got = parseListPage(res.data, listUrl);
    if (got > 0 && listUrl !== `${base}/`) {
      const sep = listUrl.includes('?') ? '&' : '?';
      for (let pg = 2; pg <= 5; pg++) {
        const pageUrl = `${listUrl}${sep}pageIndex=${pg}`;
        const next = await safeGet(pageUrl);
        if (!next) break;
        got = parseListPage(next.data, pageUrl);
        if (got === 0) break;
      }
      break;
    }
  }

  if (results.length === 0) {
    const res = await safeGet(`${base}/`);
    if (res) {
      const $ = cheerio.load(res.data);
      $('a[href]').each((_, el) => {
        const a = $(el);
        const title = a.text().trim();
        const href = a.attr('href') || '';
        if ((href.includes('goDetail') || /view\.do|detail|notice/.test(href)) &&
            title.length >= 8 && title.length <= 200) {
          const link = href.startsWith('javascript:') ? '' : urlJoin(base, href);
          if (link) add(title, link);
        }
      });
    }
  }

  console.log(`  → ${results.length}건`);
  return results;
}

const MSS_LIST_BASE = 'https://www.mss.go.kr/site/smba/ex/bbs/List.do';
const MSS_VIEW_BASE = 'https://www.mss.go.kr/site/smba/ex/bbs/View.do';
const MSS_CBIDX_SMBA = 81;   // 알림소식(공지 등)
const MSS_CBIDX_BIZ = 310;   // 사업공고

/**
 * 중소벤처기업부: 사업공고(cbIdx=310) 2026년 전체 + 공지사항(cbIdx=81) 전체 (페이징)
 */
export async function crawlMss() {
  console.log('[11] 중소벤처기업부...');
  const results = [];
  const seen = new Set();

  // ---- 1) 사업공고 (cbIdx=310, 2026년 전체) ----
  console.log('  [사업공고]');
  const year = 2026;
  const listUrlBiz = `${MSS_LIST_BASE}?cbIdx=${MSS_CBIDX_BIZ}&year=${year}&month=00`;
  for (let pageIndex = 1; ; pageIndex++) {
    const url = `${listUrlBiz}&pageIndex=${pageIndex}`;
    const res = await safeGet(url);
    if (pageIndex === 1) requireOk(res, '중소벤처기업부 사업공고 페이지 요청 실패');
    if (!res) break;
    const $ = cheerio.load(res.data);
    const rows = $('table tbody tr').filter((_, tr) => $(tr).find('td').length >= 5);
    let count = 0;
    rows.each((_, tr) => {
      const tds = $(tr).find('td');
      const titleTd = tds.eq(1);
      const a = titleTd.find('a').first();
      const title = (a.length ? a.text() : titleTd.text()).trim();
      if (!title || title.length < 3) return;
      const regDate = normDate(tds.eq(3).text().trim());
      const viewsText = tds.eq(4).text().trim();
      const views = /^[\d,]+$/.test(viewsText) ? viewsText.replace(/,/g, '') : '';
      const firstCol = tds.eq(0).text().trim().replace(/,/g, '');
      const bcIdxNum = firstCol.match(/^\d+$/)?.[0] || null;
      let link = '';
      if (a.length) {
        const onclick = a.attr('onclick') || '';
        const bcMatch = onclick.match(/bcIdx\s*=\s*(\d+)|fn_detail\s*\(\s*'?(\d+)/);
        const detailId = bcMatch ? (bcMatch[1] || bcMatch[2]) : bcIdxNum;
        if (detailId) link = `${MSS_VIEW_BASE}?cbIdx=${MSS_CBIDX_BIZ}&bcIdx=${detailId}`;
        else {
          const href = a.attr('href') || '';
          if (href && !['#', '#view', '#none'].includes(href)) link = urlJoin('https://www.mss.go.kr', href);
        }
      }
      if (!link && bcIdxNum) link = `${MSS_VIEW_BASE}?cbIdx=${MSS_CBIDX_BIZ}&bcIdx=${bcIdxNum}`;
      const key = `사업공고|${title.slice(0, 120)}|${link || title}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push(createRecord({
        분류: '사업공고', 사업명: title, 운영기관: '중소벤처기업부', 기관유형: '중앙부처',
        등록일자: regDate, 조회수: views, 공고링크: link, 출처: '중소벤처기업부',
      }));
      count++;
    });
    if (count === 0) break;
    console.log(`    페이지 ${pageIndex}: ${count}건 (누적 ${results.length}건)`);
    if (pageIndex >= 10) break;
  }
  console.log(`  → 사업공고 합계 ${results.length}건`);

  // ---- 2) 공지사항 (cbIdx=81) — 번호(0), 제목(1), 담당부서(2), 첨부(3), 등록일(4), 조회(5) ----
  console.log('  [공지사항]');
  const listUrlNotice = `${MSS_LIST_BASE}?cbIdx=${MSS_CBIDX_SMBA}`;
  const beforeNotice = results.length;
  for (let pageIndex = 1; ; pageIndex++) {
    const url = `${listUrlNotice}&pageIndex=${pageIndex}`;
    const res = await safeGet(url);
    if (pageIndex === 1) requireOk(res, '중소벤처기업부 공지사항 페이지 요청 실패');
    if (!res) break;
    const $ = cheerio.load(res.data);
    const rows = $('table tbody tr').filter((_, tr) => $(tr).find('td').length >= 6);
    let count = 0;
    rows.each((_, tr) => {
      const tds = $(tr).find('td');
      const titleTd = tds.eq(1);
      const a = titleTd.find('a').first();
      const title = (a.length ? a.text() : titleTd.text()).trim();
      if (!title || title.length < 3) return;
      const regDate = normDate(tds.eq(4).text().trim());
      const viewsText = tds.eq(5).text().trim();
      const views = /^[\d,]+$/.test(viewsText) ? viewsText.replace(/,/g, '') : '';
      const firstCol = tds.eq(0).text().trim();
      const bcIdxNum = firstCol.match(/^\d+$/)?.[0] || null;
      let link = '';
      if (a.length) {
        const onclick = a.attr('onclick') || '';
        const bcMatch = onclick.match(/bcIdx\s*=\s*(\d+)|fn_detail\s*\(\s*'?(\d+)/);
        const detailId = bcMatch ? (bcMatch[1] || bcMatch[2]) : bcIdxNum;
        if (detailId) link = `${MSS_VIEW_BASE}?cbIdx=${MSS_CBIDX_SMBA}&bcIdx=${detailId}`;
        else {
          const href = a.attr('href') || '';
          if (href && !['#', '#view', '#none'].includes(href)) link = urlJoin('https://www.mss.go.kr', href);
        }
      }
      if (!link && bcIdxNum) link = `${MSS_VIEW_BASE}?cbIdx=${MSS_CBIDX_SMBA}&bcIdx=${bcIdxNum}`;
      const key = `공지사항|${title.slice(0, 120)}|${link || title}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push(createRecord({
        분류: '공지사항', 사업명: title, 운영기관: '중소벤처기업부', 기관유형: '중앙부처',
        등록일자: regDate, 조회수: views, 공고링크: link, 출처: '중소벤처기업부',
      }));
      count++;
    });
    if (count === 0) break;
    console.log(`    페이지 ${pageIndex}: ${count}건 (누적 ${results.length}건)`);
    if (pageIndex >= 10) break;
  }
  console.log(`  → 공지사항 ${results.length - beforeNotice}건, 중소벤처기업부 전체 ${results.length}건`);
  return results;
}

const NTIS_LIST_URL = 'https://www.ntis.go.kr/rndgate/eg/un/ra/mng.do';
const NTIS_VIEW_BASE = 'https://www.ntis.go.kr/rndgate/eg/un/ra/view.do';
const NTIS_MAX_PAGES = 50;

/**
 * NTIS 국가R&D통합공고 — mng.do 목록 GET + 테이블 파싱 (최대 50페이지).
 * 공고명: 페이지 상단 링크 목록(전체 제목) + 테이블 행 매칭(roRndUid), 없으면 행 내 a 텍스트/title 속성 사용.
 */
export async function crawlNtis() {
  console.log('[12] NTIS(국가R&D통합공고)...');
  const results = [];
  const seen = new Set();

  for (let pageIndex = 1; pageIndex <= NTIS_MAX_PAGES; pageIndex++) {
    const url = pageIndex === 1
      ? NTIS_LIST_URL
      : `${NTIS_LIST_URL}?pageIndex=${pageIndex}&recordCountPerPage=30`;
    const res = await safeGet(url);
    if (pageIndex === 1) requireOk(res, 'NTIS 페이지 요청 실패(비정상 상태코드 또는 네트워크 오류)');
    if (!res) continue;

    const $ = cheerio.load(res.data);

    // 결과 테이블만 사용: thead에 "공고명"이 있는 테이블 (순번|현황|공고명|부처명|접수일|마감일|D-day). 8열(체크박스 포함) 또는 7열.
    const resultTable = $('table').filter((_, table) => $(table).find('thead th').text().includes('공고명')).first();
    const rows = resultTable.find('tbody tr');
    const uidToTitle = new Map();
    $(`a[href*="view.do"][href*="roRndUid"]`).each((_, el) => {
      const a = $(el);
      const href = (a.attr('href') || '').trim();
      const uidM = href.match(/roRndUid=(\d+)/);
      if (!uidM) return;
      const uid = uidM[1];
      const title = (a.attr('title') || a.text() || '').trim();
      if (title.length < 3) return;
      const prev = uidToTitle.get(uid);
      if (!prev || title.length > prev.length) uidToTitle.set(uid, title);
    });

    let count = 0;
    rows.each((_, tr) => {
      const tds = $(tr).find('td');
      const a = $(tr).find('a[href*="view.do"]').first();
      if (!a.length) return;
      const colN = tds.length;
      if (colN < 7) return;
      const href = (a.attr('href') || '').trim();
      const uidM = href.match(/roRndUid=(\d+)/);
      const uid = uidM ? uidM[1] : null;
      const link = uid
        ? `${NTIS_VIEW_BASE}?roRndUid=${uid}&flag=rndList`
        : href && href !== '#' ? urlJoin('https://www.ntis.go.kr', href) : '';
      const titleFromRow = (a.attr('title') || a.text() || '').trim();
      const 사업명 = ((uid && uidToTitle.get(uid)) || titleFromRow || '').trim();
      if (!사업명 || 사업명.length < 3) return;
      const idx = colN >= 8 ? { dept: 4, start: 5, end: 6 } : { dept: 3, start: 4, end: 5 };
      const dept = tds.eq(idx.dept).text().trim();
      const start = normDate(tds.eq(idx.start).text().trim());
      const end = normDate(tds.eq(idx.end).text().trim());

      const key = link || 사업명;
      if (seen.has(key)) return;
      seen.add(key);

      results.push(createRecord({
        분류: '국가R&D',
        사업명,
        운영기관: dept || 'NTIS',
        기관유형: '중앙부처',
        시작일자: start,
        마감일자: end,
        공고링크: link,
        출처: 'NTIS',
      }));
      count++;
    });

    if (count === 0 && uidToTitle.size > 0) {
      uidToTitle.forEach((사업명, uid) => {
        const key = `${NTIS_VIEW_BASE}?roRndUid=${uid}&flag=rndList`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push(createRecord({
          분류: '국가R&D', 사업명, 운영기관: 'NTIS', 기관유형: '중앙부처',
          공고링크: key, 출처: 'NTIS',
        }));
        count++;
      });
    }

    if (count === 0) break;
    console.log(`  → 페이지 ${pageIndex}: ${count}건 (누적 ${results.length}건)`);
  }
  console.log(`  → NTIS 합계 ${results.length}건`);
  return results;
}
