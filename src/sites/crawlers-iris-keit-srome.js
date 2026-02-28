/**
 * IRIS(범부처통합연구지원시스템), KEIT(S-Rome), S-Rome 과제공고
 */

import * as cheerio from 'cheerio';
import { safeGet, safePost, requireOk } from '../http.js';
import { createRecord } from '../utils.js';
import { urlJoin } from './utils.js';

const IRIS_LIST_BASE = 'https://www.iris.go.kr/contents/retrieveBsnsAncmBtinSituListView.do';
const IRIS_VIEW_BASE = 'https://www.iris.go.kr/contents/retrieveBsnsAncmView.do';
const IRIS_MAX_PAGES = 50;

const IRIS_SIDEBAR_RE = /온라인\s*매뉴얼|고객센터|고객상담\s*챗봇|1877|전자평가시스템|EVAL|전자연구노트|SIMS|TOP\s*$|^매뉴얼$|공모예고|사업일정|서식·자료/i;

/**
 * IRIS(범부처통합연구지원시스템) 사업공고 — main.do 기준 목록(JS 렌더) 반영, 50페이지
 */
export async function crawlIris() {
  console.log('[13] IRIS(범부처통합연구지원시스템)...');
  const results = [];
  const seen = new Set();
  const irisBase = 'https://www.iris.go.kr';

  const getPageHtml = async (url, waitMs) => {
    try {
      const { fetchWithPuppeteer } = await import('../puppeteer-fetch.js');
      const html = await fetchWithPuppeteer(url, { waitAfterLoadMs: waitMs });
      if (html) return html;
    } catch (_) {}
    const res = await safeGet(url);
    return res ? res.data : null;
  };

  const addFromList = ($doc, $container) => {
    let count = 0;
    $container.find('a[href*="retrieveBsnsAncmView"], a[href*="ancmId="]').each((_, el) => {
      const a = $doc(el);
      const title = a.text().trim();
      if (title.length < 8 || IRIS_SIDEBAR_RE.test(title)) return;
      const href = a.attr('href') || '';
      const idMatch = href.match(/ancmId=([^&]+)/);
      const link = idMatch ? `${IRIS_VIEW_BASE}?ancmId=${idMatch[1]}` : urlJoin(irisBase, href);
      const key = link || title.slice(0, 120);
      if (seen.has(key)) return;
      seen.add(key);
      count++;
      results.push(createRecord({
        분류: '국가R&D',
        사업명: title,
        운영기관: 'IRIS(범부처통합연구지원시스템)',
        기관유형: '정부기관',
        공고링크: link,
        출처: 'IRIS',
      }));
    });
    return count;
  };

  const looksLikeAnnouncement = (t) =>
    t.length >= 12 && t.length <= 300 && /(\d{4}년|공고|사업|과제|모집|지원|개발|재공고|공모)/.test(t);

  /** 목록 영역에서 공고번호/공고일자/접수중 등이 있는 블록 안의 링크로 수집 */
  const addFromListFallback = ($doc, $root, pageIndex) => {
    let count = 0;
    $root.find('a[href]').each((_, el) => {
      const a = $doc(el);
      const title = a.text().trim();
      if (!looksLikeAnnouncement(title) || IRIS_SIDEBAR_RE.test(title)) return;
      const parent = a.closest('div, li, tr, section, article');
      const parentText = parent.length ? parent.text() : '';
      if (!/공고번호|공고일자|공고상태|접수중|접수예정|마감예정|지정공모|자유공모/.test(parentText)) return;
      const href = (a.attr('href') || '').trim();
      const idMatch = href.match(/ancmId=([^&]+)/);
      const link = idMatch
        ? `${IRIS_VIEW_BASE}?ancmId=${idMatch[1]}`
        : href && href !== '#' && !/^javascript:/.test(href)
          ? urlJoin(irisBase, href)
          : `${IRIS_LIST_BASE}?pageIndex=${pageIndex || 1}`;
      const key = (idMatch ? idMatch[1] : '') || title.slice(0, 120);
      if (seen.has(key)) return;
      seen.add(key);
      count++;
      results.push(createRecord({
        분류: '국가R&D',
        사업명: title,
        운영기관: 'IRIS(범부처통합연구지원시스템)',
        기관유형: '정부기관',
        공고링크: link,
        출처: 'IRIS',
      }));
    });
    return count;
  };

  try {
    let page = 1;
    while (page <= IRIS_MAX_PAGES) {
      const url = `${IRIS_LIST_BASE}?pageIndex=${page}`;
      const waitMs = page === 1 ? 4500 : 2000;
      const html = await getPageHtml(url, waitMs);
      if (!html) {
        if (page === 1) requireOk(null, 'IRIS 페이지 요청 실패(비정상 상태코드 또는 네트워크 오류)');
        break;
      }
      const $ = cheerio.load(html);
      let found = 0;
      const $listTable = $('table tbody').filter((_, tbody) =>
        /공고|접수중|공고번호|공고상태/.test($(tbody).text())
      );
      if ($listTable.length) found = addFromList($, $listTable);
      if (found === 0) found = addFromList($, $('table tbody'));
      if (found === 0) found = addFromList($, $.root());
      if (found === 0) found = addFromListFallback($, $.root(), page);
      if (found === 0) break;
      console.log(`  → 페이지 ${page}: ${found}건 (누적 ${results.length}건)`);
      page += 1;
    }
  } catch (e) {
    console.warn('  IRIS 크롤 실패:', e.message);
    throw e;
  }
  console.log(`  → IRIS 합계 ${results.length}건`);
  return results;
}

const KEIT_LIST_URL = 'https://srome.keit.re.kr/srome/biz/perform/opnnPrpsl/retrieveTaskAnncmListView.do';
const KEIT_VIEW_URL = 'https://srome.keit.re.kr/srome/biz/perform/opnnPrpsl/retrieveTaskAnncmView.do';
const KEIT_PRGM_ID = 'XPG201040000';
const KEIT_BASE_JOIN = 'https://srome.keit.re.kr/srome/biz/perform/opnnPrpsl';
const KEIT_MAX_PAGES = 70;

/**
 * KEIT(S-Rome) 과제공고 — 목록이 table이 아닌 p.subject a[onclick*="f_detail"] 구조
 */
export async function crawlKeit() {
  console.log('[14] KEIT(한국산업기술평가관리원)...');
  const results = [];
  const seen = new Set();

  const getPageHtml = async (url) => {
    const res = await safeGet(url);
    return res ? res.data : null;
  };

  try {
    let page = 1;
    while (page <= KEIT_MAX_PAGES) {
      const getUrl = `${KEIT_LIST_URL}?prgmId=${KEIT_PRGM_ID}&pageIndex=${page}`;
      const html = await getPageHtml(getUrl);
      if (!html) {
        if (page === 1) requireOk(null, 'KEIT(S-Rome) 과제공고 목록 요청 실패(비정상 상태코드 또는 네트워크 오류)');
        break;
      }
      const $ = cheerio.load(html);
      let found = 0;

      // S-Rome 실제 구조: a[onclick*="f_detail('ID', '연도')"] + span.title, 상세링크는 taskAnncmId
      $(`a[onclick*="f_detail"]`).each((_, el) => {
        const a = $(el);
        const onclick = a.attr('onclick') || '';
        const idMatch = onclick.match(/f_detail\s*\(\s*'([^']+)'/);
        const taskId = idMatch ? idMatch[1] : '';
        const titleEl = a.find('span.title').length ? a.find('span.title').first() : a;
        let title = (titleEl.text() || '').trim();
        if (!title || title.length < 5) return;
        title = title.replace(/^\s*IRIS 공고\s*접수(중|예정|마감)\s*/i, '').trim();
        if (title.length < 5) return;
        const link = taskId
          ? `${KEIT_VIEW_URL}?taskAnncmId=${taskId}`
          : `${KEIT_LIST_URL}?prgmId=${KEIT_PRGM_ID}&pageIndex=${page}`;
        const key = taskId || title.slice(0, 120);
        if (seen.has(key)) return;
        seen.add(key);
        const block = a.closest('li, div[class], section').length ? a.closest('li, div[class], section') : a.parent();
        const blockText = block.length ? block.text() : '';
        const periodMatch = blockText.match(/접수기간\s*(\d{4}-\d{2}-\d{2})\s*[\d:]+\s*~\s*(\d{4}-\d{2}-\d{2})/);
        const regMatch = blockText.match(/등록일\s*(\d{4}-\d{2}-\d{2})/);
        const endDate = periodMatch ? periodMatch[2] : (regMatch ? regMatch[1] : '');
        const regDate = regMatch ? regMatch[1] : '';
        found++;
        results.push(createRecord({
          분류: '국가R&D',
          사업명: title,
          운영기관: '한국산업기술평가관리원',
          기관유형: '공공기관',
          등록일자: regDate,
          마감일자: endDate,
          공고링크: link,
          출처: 'KEIT(S-Rome 과제공고)',
        }));
      });

      if (found === 0) {
        $('table tbody tr').each((_, tr) => {
          const tds = $(tr).find('td');
          if (tds.length < 2) return;
          const linkEl = $(tr).find('a[href*="View.do"], a[href*="Detail"], a[href*="view.do"], a[href*="retrieveTaskAnncm"]').first();
          if (!linkEl.length) return;
          let title = linkEl.text().trim().replace(/^\s*IRIS 공고\s*접수(중|예정|마감)\s*/i, '').trim();
          if (!title || title.length < 3) return;
          let link = linkEl.attr('href') || '';
          if (link && !link.startsWith('http')) link = urlJoin(KEIT_BASE_JOIN, link);
          const key = `${title.slice(0, 100)}|${link}`;
          if (seen.has(key)) return;
          seen.add(key);
          const rowText = $(tr).text();
          const periodMatch = rowText.match(/접수기간\s*(\d{4}-\d{2}-\d{2})\s*[\d:]+\s*~\s*(\d{4}-\d{2}-\d{2})/);
          const regMatch = rowText.match(/등록일\s*(\d{4}-\d{2}-\d{2})/);
          found++;
          results.push(createRecord({
            분류: '국가R&D',
            사업명: title,
            운영기관: '한국산업기술평가관리원',
            기관유형: '공공기관',
            등록일자: regMatch ? regMatch[1] : '',
            마감일자: periodMatch ? periodMatch[2] : (regMatch ? regMatch[1] : ''),
            공고링크: link,
            출처: 'KEIT(S-Rome 과제공고)',
          }));
        });
      }
      if (found === 0) break;
      console.log(`  → 페이지 ${page}: ${found}건 (누적 ${results.length}건)`);
      page += 1;
    }
  } catch (e) {
    console.warn('  KEIT 크롤 실패:', e.message);
    throw e;
  }
  console.log(`  → KEIT 합계 ${results.length}건`);
  return results;
}

export async function crawlSromeTask() {
  console.log('[15] S-Rome 과제공고...');
  const results = [];
  const seen = new Set();
  const baseUrl = 'https://srome.keit.re.kr/srome/biz/perform/opnnPrpsl/retrieveTaskAnncmListView.do';
  const prgmId = 'XPG201040000';
  const maxPages = 70;
  let page = 1;
  while (page <= maxPages) {
    const getUrl = `${baseUrl}?prgmId=${prgmId}&pageIndex=${page}`;
    let res = await safeGet(getUrl);
    if (!res && page === 1) {
      res = await safePost(baseUrl, { prgmId, pageIndex: String(page) });
    }
    if (page === 1) requireOk(res, 'S-Rome 과제공고 목록 요청 실패(비정상 상태코드 또는 네트워크 오류)');
    if (!res) break;
    const $ = cheerio.load(res.data);
    let found = 0;
    $('table tbody tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 2) return;
      const a = $(tr).find('a[href*="View.do"], a[href*="Detail"], a[href*="view.do"], a[href*="detail"]').first();
      const fallback = $(tr).find('a[href]').first();
      const linkEl = a.length ? a : fallback;
      if (!linkEl.length) return;
      let title = linkEl.text().trim();
      title = title.replace(/\s*접수기간\s*[\d\s\-:~]+\s*/g, ' ').replace(/\s*등록일\s*[\d\-]+\s*/g, ' ');
      title = title.replace(/^\s*IRIS 공고\s*접수(중|예정|마감)\s*/i, '').trim();
      if (!title || title.length < 3) return;
      let link = linkEl.attr('href') || '';
      if (link && !link.startsWith('http')) link = urlJoin('https://srome.keit.re.kr/srome/biz/perform/opnnPrpsl/', link);
      const key = `${title.slice(0, 100)}|${link}`;
      if (seen.has(key)) return;
      seen.add(key);
      found++;
      let endDate = '';
      let regDate = '';
      const rowText = $(tr).text();
      const periodMatch = rowText.match(/접수기간\s*(\d{4}-\d{2}-\d{2})\s*[\d:]+\s*~\s*(\d{4}-\d{2}-\d{2})/);
      if (periodMatch) endDate = periodMatch[2];
      const regMatch = rowText.match(/등록일\s*(\d{4}-\d{2}-\d{2})/);
      if (regMatch) regDate = regMatch[1];
      if (!endDate && regMatch) endDate = regMatch[1];
      results.push(createRecord({
        분류: '국가R&D',
        사업명: title,
        운영기관: '한국산업기술평가관리원',
        기관유형: '공공기관',
        등록일자: regDate,
        마감일자: endDate,
        공고링크: link,
        출처: 'S-Rome 과제공고',
      }));
    });
    if (found === 0) {
      $('.board-list a, .list-wrap a, [class*="list"] a, .task-list a').each((_, el) => {
        const a = $(el);
        const href = a.attr('href') || '';
        if (!href || !/View\.do|Detail|view\.do|detail/.test(href)) return;
        let title = a.text().trim();
        title = title.replace(/\s*접수기간\s*[\d\s\-:~]+\s*/g, ' ').replace(/\s*등록일\s*[\d\-]+\s*/g, ' ');
        title = title.replace(/^\s*IRIS 공고\s*접수(중|예정|마감)\s*/i, '').trim();
        if (!title || title.length < 3) return;
        const link = href.startsWith('http') ? href : urlJoin('https://srome.keit.re.kr/srome/biz/perform/opnnPrpsl/', href);
        const key = `${title.slice(0, 100)}|${link}`;
        if (seen.has(key)) return;
        seen.add(key);
        found++;
        results.push(createRecord({
          분류: '국가R&D',
          사업명: title,
          운영기관: '한국산업기술평가관리원',
          기관유형: '공공기관',
          공고링크: link,
          출처: 'S-Rome 과제공고',
        }));
      });
    }
    if (found === 0) break;
    page += 1;
  }
  console.log(`  → ${results.length}건`);
  return results;
}
