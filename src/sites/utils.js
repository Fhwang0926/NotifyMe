/**
 * 사이트 크롤러 공통 유틸
 */

export function urlJoin(base, href) {
  if (!href) return '';
  try {
    return new URL(href, base).href;
  } catch {
    return href.startsWith('http') ? href : base.replace(/\/?$/, '/') + href.replace(/^\//, '');
  }
}

/** 공공데이터포털 K-Startup API 응답 날짜(yyyyMMdd) → YYYY-MM-DD */
export function formatApiDate(str) {
  if (!str || typeof str !== 'string') return '';
  const s = str.trim().replace(/\D/g, '');
  if (s.length >= 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return '';
}
