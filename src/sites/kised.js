/**
 * 창업진흥원(K-Startup) — 공공데이터 API + HTML 폴백
 */

import * as cheerio from 'cheerio';
import { safeGet, requireOk } from '../http.js';
import { createRecord } from '../utils.js';
import { formatApiDate, urlJoin } from './utils.js';
import {
  K_STARTUP_API_KEY,
  DATA_GO_KR_BUSINESS_API_URL,
  DATA_GO_KR_GET_BUSINESS_INFO_URL,
  K_STARTUP_ANNOUNCE_PER_PAGE,
  K_STARTUP_ANNOUNCE_RCRT_PRGS,
  K_STARTUP_ANNOUNCE_COND_INTG_PBANC_YN,
  K_STARTUP_ANNOUNCE_COND_SUPT_BIZ_CLSFC,
  K_STARTUP_ANNOUNCE_COND_SUPT_REGIN,
  K_STARTUP_ANNOUNCE_COND_BIZ_ENYY,
  K_STARTUP_BUSINESS_INFO_STDT,
} from '../config.js';

async function fetchAnnouncementInformation01(serviceKey) {
  const baseUrl = DATA_GO_KR_BUSINESS_API_URL;
  const perPage = K_STARTUP_ANNOUNCE_PER_PAGE;
  const maxPages = 20;
  const out = [];
  let page = 1;
  while (page <= maxPages) {
    const params = new URLSearchParams();
    params.set('serviceKey', serviceKey);
    params.set('page', String(page));
    params.set('perPage', String(perPage));
    params.set('returnType', 'json');
    if (K_STARTUP_ANNOUNCE_RCRT_PRGS === 'Y' || K_STARTUP_ANNOUNCE_RCRT_PRGS === 'N') {
      params.set('cond[rcrt_prgs_yn::EQ]', K_STARTUP_ANNOUNCE_RCRT_PRGS);
    }
    if (K_STARTUP_ANNOUNCE_COND_INTG_PBANC_YN) params.set('cond[intg_pbanc_yn::EQ]', K_STARTUP_ANNOUNCE_COND_INTG_PBANC_YN);
    if (K_STARTUP_ANNOUNCE_COND_SUPT_BIZ_CLSFC) params.set('cond[supt_biz_clsfc::LIKE]', K_STARTUP_ANNOUNCE_COND_SUPT_BIZ_CLSFC);
    if (K_STARTUP_ANNOUNCE_COND_SUPT_REGIN) params.set('cond[supt_regin::LIKE]', K_STARTUP_ANNOUNCE_COND_SUPT_REGIN);
    if (K_STARTUP_ANNOUNCE_COND_BIZ_ENYY) params.set('cond[biz_enyy::LIKE]', K_STARTUP_ANNOUNCE_COND_BIZ_ENYY);
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}${params.toString()}`;
    const res = await safeGet(url);
    if (!res || !res.data) break;
    const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    const list = json?.data?.data ?? (Array.isArray(json?.data) ? json.data : []);
    const items = Array.isArray(list) ? list : [];
    for (const it of items) out.push(it);
    if (items.length < perPage) break;
    page += 1;
  }
  return out;
}

function normalizeBusinessItem(it) {
  if (!it) return null;
  let row = it;
  if (Array.isArray(it.col)) {
    row = {};
    it.col.forEach((c) => {
      const name = c['@name'] ?? c.name;
      const val = c['_'] ?? c['#text'] ?? c.value ?? (typeof c === 'string' ? c : null);
      if (name && val != null) row[name] = String(val);
    });
  }
  return row;
}

function parseBusinessInfoXml(xmlStr) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const colRegex = /<col\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/col>/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xmlStr)) !== null) {
    const row = {};
    const block = itemMatch[1];
    colRegex.lastIndex = 0;
    let colMatch;
    while ((colMatch = colRegex.exec(block)) !== null) {
      let val = colMatch[2]
        .replace(/&#xD;&#xA;/g, '\n')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&apos;/g, "'")
        .trim();
      row[colMatch[1]] = val;
    }
    if (Object.keys(row).length) items.push(row);
  }
  return items;
}

async function fetchBusinessInformation01(serviceKey) {
  const baseUrl = DATA_GO_KR_GET_BUSINESS_INFO_URL;
  const stdt = K_STARTUP_BUSINESS_INFO_STDT;
  const perPage = 500;
  const maxPages = 20;
  const out = [];
  let page = 1;
  while (page <= maxPages) {
    const params = new URLSearchParams();
    params.set('serviceKey', serviceKey);
    params.set('stdt', stdt);
    params.set('page', String(page));
    params.set('perPage', String(perPage));
    params.set('returnType', 'json');
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}${params.toString()}`;
    const res = await safeGet(url);
    if (!res || !res.data) break;
    const raw = typeof res.data === 'string' ? res.data : '';
    let items = [];

    if (raw.trimStart().startsWith('<')) {
      items = parseBusinessInfoXml(raw);
    } else {
      let json;
      try {
        json = typeof res.data === 'object' ? res.data : JSON.parse(res.data);
      } catch (_) {
        break;
      }
      items = Array.isArray(json?.data)
        ? json.data
        : (json?.data?.data ?? json?.data?.item ?? json?.body?.items?.item ?? json?.response?.body?.items?.item ?? []);
      const rd = json?.results?.data;
      if (rd) items = Array.isArray(rd) ? rd : (rd?.item ? (Array.isArray(rd.item) ? rd.item : [rd.item]) : items);
      if (!Array.isArray(items)) items = items ? [items] : [];
    }

    for (const it of items) {
      const row = typeof it === 'object' && it !== null && !Array.isArray(it.col) && (it.supt_biz_titl_nm || it.detl_pg_url)
        ? it
        : normalizeBusinessItem(it);
      if (row) out.push(row);
    }
    if (items.length < perPage) break;
    page += 1;
  }
  return out;
}

export async function crawlKised() {
  console.log('[1] 창업진흥원...');
  const results = [];
  const seen = new Set();
  const dedupeKey = (name, org) => `${(name || '').trim().toLowerCase().slice(0, 80)}|${(org || '창업진흥원').trim()}`;

  if (K_STARTUP_API_KEY) {
    try {
      const announcementItems = await fetchAnnouncementInformation01(K_STARTUP_API_KEY);
      console.log(`  → getAnnouncementInformation01: ${announcementItems.length}건  ${DATA_GO_KR_BUSINESS_API_URL}`);
      for (const it of announcementItems) {
        const title = it.biz_pbanc_nm ?? it.intg_pbanc_biz_nm ?? '';
        if (!title || String(title).trim().length < 3) continue;
        const link = it.detl_pg_url || it.biz_aply_url || it.biz_gdnc_url || '';
        const start = formatApiDate(it.pbanc_rcpt_bgng_dt);
        const end = formatApiDate(it.pbanc_rcpt_end_dt);
        const org = it.pbanc_ntrp_nm || it.sprv_inst || it.biz_prch_dprt_nm || '창업진흥원';
        const 분류 = it.supt_biz_clsfc ? String(it.supt_biz_clsfc).trim() : '창업지원';
        const key = dedupeKey(title, org);
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(createRecord({
          분류,
          사업명: String(title).trim(),
          운영기관: String(org).trim() || '창업진흥원',
          기관유형: '정부기관',
          시작일자: start,
          마감일자: end,
          공고링크: link && String(link).startsWith('http') ? link : '',
          출처: '창업진흥원',
        }));
      }

      const businessItems = await fetchBusinessInformation01(K_STARTUP_API_KEY);
      console.log(`  → getBusinessInformation01: ${businessItems.length}건  ${DATA_GO_KR_GET_BUSINESS_INFO_URL}`);
      for (const it of businessItems) {
        const title = it.supt_biz_titl_nm ?? it.biz_nm ?? it.biz_pbanc_nm ?? it.intg_pbanc_biz_nm ?? '';
        if (!title || String(title).trim().length < 3) continue;
        const org = it.pbanc_ntrp_nm ?? it.sprv_inst ?? it.biz_prch_dprt_nm ?? '창업진흥원';
        const key = dedupeKey(title, org);
        if (seen.has(key)) continue;
        seen.add(key);
        let link = it.detl_pg_url || it.biz_aply_url || it.biz_gdnc_url || '';
        if (link && !link.startsWith('http')) link = link.startsWith('www.') ? `https://${link}` : `https://www.k-startup.go.kr/${link.replace(/^\//, '')}`;
        const start = formatApiDate(it.pbanc_rcpt_bgng_dt ?? it.rcpt_bgng_dt);
        const end = formatApiDate(it.pbanc_rcpt_end_dt ?? it.rcpt_end_dt);
        const 분류 = (it.supt_biz_clsfc ?? it.biz_category_cd ?? '').trim() || '창업지원';
        results.push(createRecord({
          분류,
          사업명: String(title).trim(),
          운영기관: String(org).trim() || '창업진흥원',
          기관유형: '정부기관',
          시작일자: start,
          마감일자: end,
          공고링크: link && link.startsWith('http') ? link : '',
          출처: '창업진흥원',
        }));
      }

      if (results.length > 0) {
        console.log(`  → 합계 ${results.length}건`);
        return results;
      }
    } catch (e) {
      console.warn('  K-Startup API 실패, HTML 크롤링으로 대체:', e.message);
    }
  }
  const res = await safeGet('https://www.kised.or.kr/misAnnouncement/index.es?mid=a10302000000');
  requireOk(res, '창업진흥원 페이지 요청 실패(비정상 상태코드 또는 네트워크 오류)');
  const $ = cheerio.load(res.data);
  $('a[href*="k-startup.go.kr"]').each((_, el) => {
    const a = $(el);
    const title = a.text().trim();
    if (title.length < 5 || title.includes('자세히 보기')) return;
    const link = a.attr('href') || '';
    const parent = a.parent();
    const blockText = parent.length ? parent.text() : '';
    const orgM = blockText.match(/기관명\s*[:：]?\s*(.+?)(?:\n|마감|진행|$)/);
    const org = orgM ? orgM[1].trim() : '창업진흥원';
    const dlM = blockText.match(/마감일자\s*[:：]?\s*([\d\-:.]+)/);
    const deadline = dlM ? dlM[1].trim().slice(0, 10) : '';
    results.push(createRecord({
      분류: '창업지원', 사업명: title, 운영기관: org,
      기관유형: '정부기관', 마감일자: deadline, 공고링크: link, 출처: '창업진흥원',
    }));
  });
  console.log(`  → ${results.length}건`);
  return results;
}
