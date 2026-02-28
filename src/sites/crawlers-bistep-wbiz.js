/**
 * BISTEP 국가/부산시R&D, WBIZ, KOVWA, 서울청년포털
 */

import * as cheerio from 'cheerio';
import { safeGet, requireOk } from '../http.js';
import { createRecord } from '../utils.js';
import { urlJoin } from './utils.js';

export async function crawlBistepNational() {
  console.log('[5-2] BISTEP 국가R&D사업공고...');
  const results = [];
  const seen = new Set();
  const baseUrl = 'https://btis.bistep.re.kr/web/board/list.do';
  const listParams = { mId: '79', ts_tabBusi: '1' };
  const maxPages = 10;
  let page = 1;
  while (page <= maxPages) {
    const url = `${baseUrl}?${new URLSearchParams({ ...listParams, page: String(page) }).toString()}`;
    const res = await safeGet(url);
    if (page === 1) requireOk(res, 'BISTEP 국가R&D 목록 요청 실패(비정상 상태코드 또는 네트워크 오류)');
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
      const org = tds.length >= 3 ? tds.eq(2).text().trim() : 'BISTEP';
      let regDate = '';
      for (let i = 0; i < tds.length; i++) {
        const t = tds.eq(i).text().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
          regDate = t;
          break;
        }
      }
      results.push(createRecord({
        분류: '국가R&D',
        사업명: title,
        운영기관: org || 'BISTEP',
        기관유형: '공공기관',
        등록일자: regDate,
        공고링크: link,
        출처: 'BISTEP 국가R&D',
      }));
    });
    if (found === 0) break;
    page += 1;
  }
  console.log(`  → ${results.length}건`);
  return results;
}

export async function crawlBistepBusan() {
  console.log('[5-3] BISTEP 부산시R&D사업공고...');
  const results = [];
  const seen = new Set();
  const baseUrl = 'https://btis.bistep.re.kr/web/board/list.do';
  const listParams = { mId: '35', ts_tabBusi: '2' };
  const maxPages = 10;
  let page = 1;
  while (page <= maxPages) {
    const url = `${baseUrl}?${new URLSearchParams({ ...listParams, page: String(page) }).toString()}`;
    const res = await safeGet(url);
    if (page === 1) requireOk(res, 'BISTEP 부산시R&D 목록 요청 실패(비정상 상태코드 또는 네트워크 오류)');
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
      const org = tds.length >= 3 ? tds.eq(2).text().trim() : 'BISTEP';
      let regDate = '';
      for (let i = 0; i < tds.length; i++) {
        const t = tds.eq(i).text().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
          regDate = t;
          break;
        }
      }
      results.push(createRecord({
        분류: '기술개발',
        사업명: title,
        운영기관: org || 'BISTEP',
        기관유형: '공공기관',
        등록일자: regDate,
        공고링크: link,
        출처: 'BISTEP 부산시R&D',
      }));
    });
    if (found === 0) break;
    page += 1;
  }
  console.log(`  → ${results.length}건`);
  return results;
}

export async function crawlWbiz() {
  console.log('[6] WBIZ...');
  const results = [];
  const res = await safeGet('https://www.wbiz.or.kr/notice/bizNew.do');
  requireOk(res, 'WBIZ 페이지 요청 실패(비정상 상태코드 또는 네트워크 오류)');
  const $ = cheerio.load(res.data);
  const seen = new Set();

  $('table tbody tr, .board-list li, ul li, [class*="list"] li, .notice-item, article, .card').each((_, row) => {
    const $row = $(row);
    const text = $row.text().replace(/\s+/g, ' ').trim();
    if (!text.includes('신청기간') && !text.includes('신청기')) return;

    let title = '';
    let link = '';
    const href = $row.find('a').filter((_, a) => {
      const t = $(a).text().trim();
      return t === '내용보기';
    }).attr('href') || $row.find('a[href*="noticeDetail"], a[href*="view.do"], a[href*="Detail"]').not('[href="#"]').first().attr('href') || '';
    if (href && !href.startsWith('javascript:')) link = urlJoin('https://www.wbiz.or.kr', href);

    const firstLink = $row.find('a').first();
    const firstLinkText = firstLink.length ? firstLink.text().replace(/\s+/g, ' ').trim() : '';
    if (firstLinkText.length > 20 && !/^모집중$|^모집마감$|^전체보기$/.test(firstLinkText)) {
      if (!title) title = firstLinkText;
    }
    if (!title && firstLinkText.includes('신청기간')) {
      const m = firstLinkText.match(/(?:모집중|모집마감)?\s*(?:BI입주기업|지원사업|교육·행사|대관·예약)\s*(.+?)\s*신청기간/);
      if (m) title = m[1].replace(/\s*내용보기\s*$/, '').trim();
    }
    if (!title) {
      const m = text.match(/(?:모집중|모집마감)?\s*(?:BI입주기업|지원사업|교육·행사|대관·예약)\s*(.+?)\s*신청기간/);
      if (m) title = m[1].replace(/\s*내용보기\s*$/, '').trim();
    }
    if (!title && firstLinkText) title = firstLinkText.split(/\s*신청기간\s*/)[0].replace(/^(모집중|모집마감)\s*(BI입주기업|지원사업)\s*/, '').trim();
    if (!title || title.length < 5) return;
    if (!link) link = 'https://www.wbiz.or.kr/notice/bizNew.do';
    const key = title.slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);

    let startDate = '';
    let endDate = '';
    const periodMatch = text.match(/신청기간\s*[\s\S]*?(\d{4})[.\s/-](\d{1,2})[.\s/-](\d{1,2})[\s\S]*?(\d{4})[.\s/-](\d{1,2})[.\s/-](\d{1,2})/);
    if (periodMatch) {
      startDate = `${periodMatch[1]}-${periodMatch[2].padStart(2, '0')}-${periodMatch[3].padStart(2, '0')}`;
      endDate = `${periodMatch[4]}-${periodMatch[5].padStart(2, '0')}-${periodMatch[6].padStart(2, '0')}`;
    } else {
      const singleMatch = text.match(/(\d{4})[.\s/-](\d{1,2})[.\s/-](\d{1,2})/);
      if (singleMatch) startDate = `${singleMatch[1]}-${singleMatch[2].padStart(2, '0')}-${singleMatch[3].padStart(2, '0')}`;
    }

    let 분류 = '여성기업';
    if (/BI입주기업|입주기업/.test(text)) 분류 = 'BI입주기업';
    else if (/지원사업/.test(text)) 분류 = '지원사업';
    else if (/교육|행사/.test(text)) 분류 = '교육·행사';

    results.push(createRecord({
      분류,
      사업명: title.replace(/\s+/g, ' ').trim(),
      운영기관: 'WBIZ',
      기관유형: '공공기관',
      등록일자: startDate,
      시작일자: startDate,
      마감일자: endDate,
      공고링크: link && link.startsWith('http') ? link : '',
      출처: 'WBIZ',
    }));
  });

  if (results.length === 0) {
    $('table tbody tr').each((_, tr) => {
      const a = $(tr).find('a').first();
      if (!a.length) return;
      const title = a.text().trim();
      if (title.length < 5) return;
      const href = a.attr('href') || '';
      const link = href && !href.startsWith('javascript:') ? urlJoin('https://www.wbiz.or.kr', href) : '';
      let reg = '';
      $(tr).find('td').each((_, td) => {
        const t = $(td).text().trim();
        if (/^\d{4}\.\d{2}\.\d{2}$/.test(t)) reg = t.replace(/\./g, '-');
      });
      results.push(createRecord({
        분류: '여성기업', 사업명: title, 운영기관: 'WBIZ',
        기관유형: '공공기관', 등록일자: reg, 공고링크: link, 출처: 'WBIZ',
      }));
    });
  }

  console.log(`  → ${results.length}건`);
  return results;
}

/** KOVWA 여성벤처협회 — /199(예비창업패키지) + /94(공지사항). JS 렌더링으로 Puppeteer 우선 사용 */
const KOVWA_LIST_Q = 'YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9';

function isKovwaDetailLink(link, baseUrl, listPath) {
  if (!link || !link.includes('kovwa.or.kr')) return false;
  const listBase = `${baseUrl}/${listPath}`;
  if (link === listBase || link === `${listBase}/`) return false;
  const hasQ = link.includes('q=');
  const hasNoOrId = /[?&](no|id|idx)=/.test(link);
  if (hasQ && !hasNoOrId) return false;
  if (link.startsWith(`${listBase}/`) && link.length > `${listBase}/`.length) return true;
  if (link.includes(`/${listPath}?`) && hasNoOrId) return true;
  if (link.includes(`/${listPath}/`) && /\d+/.test(link)) return true;
  return false;
}

export async function crawlKovwa() {
  console.log('[7] KOVWA 여성벤처협회...');
  const results = [];
  const seen = new Set();
  const baseUrl = 'https://kovwa.or.kr';
  const listConfigs = [
    { path: '94', 분류: '공지사항', maxPages: 5, useQ: true, usePuppeteerEveryPage: false },
    { path: '199', 분류: '예비창업패키지', maxPages: 10 },
  ];

  const extractFromRow = ($, $row, rowText, baseUrl, listPath, default분류) => {
    const tds = $row.find('td');
    const links = $row.find('a[href]').filter((_, a) => {
      const href = $(a).attr('href') || '';
      const text = $(a).text().trim().replace(/\s+/g, ' ');
      if (href.startsWith('javascript:') || href.startsWith('#')) return false;
      if (text.length < 5) return false;
      if (/^(공지사항|예비창업패키지|전체보기|회원서비스|간행물|갤러리|보도자료|회원사소식|Previous|Next|\d+)$/.test(text)) return false;
      if (/^카테고리|제목|글쓴이|작성시간|조회수|좋아요|No$/i.test(text)) return false;
      if (/^한국여성벤처협회$/i.test(text)) return false;
      return true;
    });
    const linkCandidates = links.toArray().map((a) => $(a)).sort((a, b) => (b.text().trim().length - a.text().trim().length));
    let titleEl = null;
    let link = '';
    for (const $a of linkCandidates) {
      const href = $a.attr('href') || '';
      let resolved = href;
      if (href && !href.startsWith('http')) {
        if (href.startsWith('/')) resolved = `${baseUrl}${href}`;
        else if (href.startsWith('?')) resolved = `${baseUrl}/${listPath}${href}`;
        else resolved = urlJoin(baseUrl, href);
      }
      if (resolved && isKovwaDetailLink(resolved, baseUrl, listPath)) {
        titleEl = $a;
        link = resolved;
        break;
      }
    }
    if (!titleEl || !titleEl.length) return null;
    const title = titleEl.text().trim().replace(/\s+/g, ' ');
    if (title.length < 5) return null;
    if (!link) {
      const idFromHref = titleEl.attr('href') && titleEl.attr('href').match(new RegExp(`/${listPath}/(\\d+)`));
      const idFromRow = rowText.match(new RegExp(`(?:^|[^\\d])(\\d{4,})(?:[^\\d]|$)`));
      const id = idFromHref ? idFromHref[1] : (idFromRow ? idFromRow[1] : null);
      if (id) link = `${baseUrl}/${listPath}/${id}`;
      else return null;
    }

    let reg = '';
    const dateMatch = rowText.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (dateMatch) reg = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    if (!reg && tds.length >= 4) {
      tds.each((_, td) => {
        const t = $(td).text().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) reg = t;
      });
    }
    let 분류 = default분류;
    if (/회원서비스/.test(rowText)) 분류 = '회원서비스';
    else if (/유관기관/.test(rowText)) 분류 = '유관기관';
    else if (/행사/.test(rowText)) 분류 = '행사';
    else if (/사업공고|입주공고/.test(rowText)) 분류 = '사업공고';
    else if (/교육/.test(rowText)) 분류 = '교육';
    let views = '';
    const viewsMatch = rowText.match(/조회수\s*(\d+)/);
    if (viewsMatch) views = viewsMatch[1];
    return { title, link, reg, 분류, views };
  };

  let fetchWithPuppeteer = null;
  try {
    const mod = await import('../puppeteer-fetch.js');
    fetchWithPuppeteer = mod.fetchWithPuppeteer;
  } catch (_) {}

  for (const { path: listPath, 분류: default분류, maxPages, useQ, usePuppeteerEveryPage } of listConfigs) {
    const firstUrl = `${baseUrl}/${listPath}`;
    const usePuppeteer = usePuppeteerEveryPage ? !!fetchWithPuppeteer : false;
    let addedThisBoard = 0;
    for (let page = 1; page <= maxPages; page++) {
      const url =
        page === 1
          ? firstUrl
          : useQ
            ? `${firstUrl}/?q=${encodeURIComponent(KOVWA_LIST_Q)}&page=${page}`
            : `${firstUrl}?page=${page}`;

      let html = null;
      const tryPuppeteer = page === 1 || usePuppeteer;
      if (tryPuppeteer && fetchWithPuppeteer) {
        try {
          html = await fetchWithPuppeteer(url, { waitAfterLoadMs: 4000 });
        } catch (_) {}
      }
      if (!html) {
        const res = await safeGet(url);
        if (page === 1 && listConfigs[0].path === listPath) requireOk(res, 'KOVWA 페이지 요청 실패(비정상 상태코드 또는 네트워크 오류)');
        if (!res) break;
        html = res.data;
      }

      const $ = cheerio.load(html);
      let found = 0;

      const rowSelector = 'table tbody tr, table tr, .board-list li, [class*="list"] li, li.tit, li[class*="tit"], [class*="board"] tr, .bbs-list tr';
      $(rowSelector).each((_, tr) => {
        const $tr = $(tr);
        const item = extractFromRow($, $tr, $tr.text(), baseUrl, listPath, default분류);
        if (!item) return;
        const key = `${item.title.slice(0, 100)}|${item.link}`;
        if (seen.has(key)) return;
        seen.add(key);
        found++;
        addedThisBoard++;
        results.push(createRecord({
          분류: item.분류,
          사업명: item.title,
          운영기관: 'KOVWA',
          기관유형: '협회',
          등록일자: item.reg,
          조회수: item.views,
          공고링크: item.link,
          출처: 'KOVWA',
        }));
      });

      if (found === 0) {
        const listBase = `${baseUrl}/${listPath}`;
        $('a[href*="kovwa.or.kr"], a[href^="/"], a[href^="?"]').each((_, a) => {
          const href = $(a).attr('href') || '';
          let link = href.startsWith('http') ? href : href.startsWith('/') ? `${baseUrl}${href}` : href.startsWith('?') ? `${listBase}${href}` : urlJoin(baseUrl, href);
          if (!link.includes('kovwa.or.kr')) return;
          if (!isKovwaDetailLink(link, baseUrl, listPath)) return;
          const text = $(a).text().trim().replace(/\s+/g, ' ');
          if (text.length < 8) return;
          if (/^(공지사항|예비창업패키지|전체보기|회원서비스|간행물|갤러리|보도자료|회원사소식|Previous|Next|\d+)$/.test(text)) return;
          const key = `${text.slice(0, 100)}|${link}`;
          if (seen.has(key)) return;
          seen.add(key);
          found++;
          addedThisBoard++;
          results.push(createRecord({
            분류: default분류,
            사업명: text,
            운영기관: 'KOVWA',
            기관유형: '협회',
            공고링크: link,
            출처: 'KOVWA',
          }));
        });
      }

      if (found === 0 && page >= 2) break;
    }
    if (addedThisBoard > 0) {
      console.log(`  /${listPath} ${default분류}: ${addedThisBoard}건`);
    }
  }

  console.log(`  → ${results.length}건`);
  return results;
}

export async function crawlSeoulYouth() {
  console.log('[8] 서울청년포털...');
  const results = [];
  for (let pg = 1; pg <= 3; pg++) {
    const url = `https://youth.seoul.go.kr/bbs/list.do?key=2303300002&sc_bbsCtgrySn=2304110001&pageIndex=${pg}`;
    const res = await safeGet(url);
    if (pg === 1) requireOk(res, '서울청년포털 페이지 요청 실패(비정상 상태코드 또는 네트워크 오류)');
    if (!res) continue;
    const $ = cheerio.load(res.data);
    $('table tbody tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 4) return;
      const a = $(tr).find('a').first();
      if (!a.length) return;
      const title = a.text().trim();
      if (!title || title.length < 3) return;
      const onclick = a.attr('onclick') || '';
      const href = a.attr('href') || '';
      let link = url;
      const sn = onclick.match(/bbsSn['"]?\s*[:=]\s*['"]?(\d+)/) || onclick.match(/(\d{10,})/);
      if (sn) link = `https://youth.seoul.go.kr/bbs/view.do?key=2303300002&bbsSn=${sn[1]}`;
      else if (href && href !== '#none') link = urlJoin('https://youth.seoul.go.kr', href);
      let regDate = '';
      let views = '';
      tds.each((_, td) => {
        const txt = $(td).text().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) regDate = txt;
        else if (/^\d{1,6}$/.test(txt.replace(/,/g, ''))) views = txt.replace(/,/g, '');
      });
      results.push(createRecord({
        분류: '청년정책', 사업명: title, 운영기관: '서울청년포털',
        기관유형: '지자체(서울)', 등록일자: regDate, 조회수: views, 공고링크: link, 출처: '서울청년포털',
      }));
    });
  }
  console.log(`  → ${results.length}건`);
  return results;
}
