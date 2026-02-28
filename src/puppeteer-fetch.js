/**
 * Puppeteer 기반 페이지 로드 — 1차 HTTP 실패 시 폴백용
 * JS 렌더링이 필요한 사이트나 차단된 요청에 사용
 */

const PUPPETEER_TIMEOUT = Number(process.env.CRAWLER_PUPPETEER_TIMEOUT_MS) || 30000;

let _browser = null;

async function getBrowser() {
  if (_browser) return _browser;
  const puppeteer = await import('puppeteer').catch(() => null);
  if (!puppeteer || !puppeteer.default) return null;
  _browser = await puppeteer.default.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  return _browser;
}

/**
 * URL을 Puppeteer로 로드해 HTML 문자열 반환
 * @param {string} url
 * @param {{ waitAfterLoadMs?: number }} [options] - 로드 후 추가 대기(ms). JS 렌더링 완료 대기용.
 * @returns {Promise<string|null>}
 */
export async function fetchWithPuppeteer(url, options = {}) {
  const { waitAfterLoadMs = 0 } = options;
  try {
    const browser = await getBrowser();
    if (!browser) return null;
    const page = await browser.newPage();
    try {
      await page.setUserAgent(
        process.env.CRAWLER_USER_AGENT ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: PUPPETEER_TIMEOUT,
      });
      if (waitAfterLoadMs > 0) {
        await new Promise((r) => setTimeout(r, waitAfterLoadMs));
      }
      const html = await page.content();
      return html || null;
    } finally {
      await page.close().catch(() => {});
    }
  } catch (e) {
    console.warn(`  Puppeteer 폴백 실패: ${url} → ${e.message}`);
    return null;
  }
}

/** 프로세스 종료 시 브라우저 정리 (선택 호출) */
export async function closePuppeteerBrowser() {
  if (_browser) {
    try {
      await _browser.close();
    } catch (_) {}
    _browser = null;
  }
}
