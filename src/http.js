/**
 * HTTP 요청 — axios 기반, 재시도·SSL 옵션
 * 1차 실패 시 Puppeteer로 재시도 (일반 웹페이지만, API URL은 제외)
 *
 * Puppeteer 폴백: JS 렌더링이 필요한 페이지나 일반 HTTP가 차단된 경우,
 * 같은 URL을 헤드리스 브라우저로 열어 HTML을 가져옵니다.
 * apis.data.go.kr 등 API 주소는 JSON/XML 응답이므로 폴백하지 않습니다.
 */

import axios from 'axios';
import https from 'https';
import { VERIFY_SSL, HEADERS, REQUEST_TIMEOUT, MAX_RETRIES, RETRY_BACKOFF } from './config.js';

const agent = new https.Agent({
  rejectUnauthorized: VERIFY_SSL,
});

const client = axios.create({
  timeout: REQUEST_TIMEOUT,
  headers: HEADERS,
  httpsAgent: agent,
  maxRedirects: 5,
  validateStatus: (status) => status >= 200 && status < 300,
  responseType: 'text',
  responseEncoding: 'utf8',
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function safeGet(url, options = {}) {
  const { timeout = REQUEST_TIMEOUT, skipPuppeteerFallback = false } = options;
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await client.get(url, { timeout, ...options });
      return { data: res.data, status: res.status, headers: res.headers };
    } catch (e) {
      lastErr = e;
      console.warn(`  GET 실패 (시도 ${attempt + 1}/${MAX_RETRIES}): ${url} → ${e.message}`);
      if (attempt < MAX_RETRIES - 1) await sleep(RETRY_BACKOFF ** attempt * 1000);
    }
  }
  console.warn(`  GET 최종 실패: ${url} → ${lastErr?.message}`);
  const isApiUrl = url.includes('apis.data.go.kr');
  if (!skipPuppeteerFallback && !isApiUrl) {
    try {
      const { fetchWithPuppeteer } = await import('./puppeteer-fetch.js');
      console.warn('  Puppeteer 폴백 시도...');
      const html = await fetchWithPuppeteer(url);
      if (html) {
        console.warn('  Puppeteer 폴백 성공');
        return { data: html, status: 200, headers: {} };
      }
    } catch (e) {
      console.warn('  Puppeteer 폴백 비사용:', e.message);
    }
  }
  return null;
}

/**
 * safeGet 결과가 null(비정상 상태코드·네트워크 오류)이면 throw.
 * 갱신 시 200이 아닌 경우 출처를 '에러'로 표시하려면 크롤러에서 첫 요청 후 이걸 사용.
 */
export function requireOk(res, message = 'HTTP 요청 실패(비정상 상태코드 또는 네트워크 오류)') {
  if (!res) throw new Error(message);
  if (res.status != null && (res.status < 200 || res.status >= 300)) throw new Error(`${message} (${res.status})`);
  return res;
}

export async function safePost(url, data, options = {}) {
  const { timeout = REQUEST_TIMEOUT } = options;
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await client.post(url, new URLSearchParams(data), {
        timeout,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...HEADERS },
        ...options,
      });
      return { data: res.data, status: res.status, headers: res.headers };
    } catch (e) {
      lastErr = e;
      console.warn(`  POST 실패 (시도 ${attempt + 1}/${MAX_RETRIES}): ${url} → ${e.message}`);
      if (attempt < MAX_RETRIES - 1) await sleep(RETRY_BACKOFF ** attempt * 1000);
    }
  }
  console.warn(`  POST 최종 실패: ${url} → ${lastErr?.message}`);
  return null;
}

/** axios 응답이 JSON인 경우 파싱 (응답 타입이 text일 때) */
export function parseJsonResponse(res) {
  if (!res || res.data == null) return null;
  if (typeof res.data === 'object') return res.data;
  try {
    return JSON.parse(res.data);
  } catch {
    return null;
  }
}
