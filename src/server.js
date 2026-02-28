/**
 * 대시보드 서버 — 정적 파일 + 크롤 API
 * - GET /api/status → 마지막 크롤 시각/건수
 * - POST /api/crawl → 크롤 실행 후 데이터 갱신
 */

import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { run, runOne } from './crawler.js';
import { isConfigured as dbConfigured, initDb, closeDb, saveCrawlResults, saveSourceStatus, getSubscribedEmails, loadCrawlResults, getCrawlMeta, getSourceStatus, replaceCrawlResultsBySource } from './db.js';
import { runMigrations } from './migrate.js';
import { isMailConfigured, sendMail } from './mail.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

if (!dbConfigured()) {
  console.error('');
  console.error('MariaDB 설정이 필요합니다.');
  console.error('.env에 다음 변수를 설정하세요: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
  console.error('예: DB_HOST=localhost DB_PORT=3306 DB_USER=root DB_PASSWORD=*** DB_NAME=notifyme');
  console.error('');
  process.exit(1);
}

const K_STARTUP_API_KEY = process.env.K_STARTUP_API_KEY || '';
if (!K_STARTUP_API_KEY || K_STARTUP_API_KEY === 'your_service_key_here') {
  console.error('');
  console.error('공공데이터포털 K-Startup API 키가 필요합니다.');
  console.error('.env에 K_STARTUP_API_KEY=발급받은_서비스키 를 설정하세요.');
  console.error('발급: https://www.data.go.kr/');
  console.error('');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

const PORT = Number(process.env.WEB_PORT) || 80;
const HOST = '0.0.0.0';
const CRAWL_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12시간

let crawlInProgress = false;
/** 출처별 개별 갱신 중인 출처명 (한 번에 하나). 새로고침 후에도 GET /api/sources/status 에 포함해 '갱신중' 표시용 */
let crawlingSource = null;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** 등록일자 문자열(YYYY-MM-DD 등)이 최근 N일 이내인지 */
function isWithinDays(regStr, days = 7) {
  if (!regStr || typeof regStr !== 'string') return false;
  const m = regStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((now - d) / 864e5);
  return diff >= 0 && diff <= days;
}

/**
 * 갱신 결과 메일 본문 — 전체 건수 요약 + 최근 7일 이내 등록된 공고만 안내
 */
function buildCrawlMailContent(records) {
  const total = records.length;
  const recent = records.filter((r) => isWithinDays(r['등록일자'], 7));
  const recentSorted = [...recent].sort((a, b) => {
    const da = a['등록일자'] || '';
    const db = b['등록일자'] || '';
    return db.localeCompare(da);
  });
  const list = recentSorted.slice(0, 15);
  const recentCount = recent.length;

  let text = `스타트업 지원사업 공고가 갱신되었습니다.\n\n총 ${total}건 수집. 그 중 최근 7일 이내 등록된 공고는 ${recentCount}건입니다.\n\n`;
  if (list.length) {
    text += '■ 최근 등록 공고\n\n';
    list.forEach((r, i) => {
      const title = r['사업명'] || '(제목 없음)';
      const link = r['공고링크'] || '';
      const source = r['출처'] || '';
      const reg = r['등록일자'] || '-';
      const end = r['마감일자'] || '-';
      text += `${i + 1}. ${title}\n   출처: ${source} | 등록: ${reg} | 마감: ${end}\n   ${link || '-'}\n\n`;
    });
  } else {
    text += '이번 갱신에 최근 7일 이내 등록된 공고는 없습니다.\n\n';
  }
  text += '대시보드에서 전체 목록을 확인하세요.';

  let html = `<p>스타트업 지원사업 공고가 갱신되었습니다.</p><p><strong>총 ${total}건</strong> 수집. 그 중 <strong>최근 7일 이내 등록</strong>된 공고는 <strong>${recentCount}건</strong>입니다.</p>`;
  if (list.length) {
    html += '<h3 style="margin-top:20px;font-size:14px;">■ 최근 등록 공고</h3><ul style="list-style:none;padding:0;margin:8px 0;">';
    list.forEach((r, i) => {
      const title = (r['사업명'] || '(제목 없음)').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const link = (r['공고링크'] || '').trim();
      const isUrl = link.startsWith('http://') || link.startsWith('https://');
      const source = (r['출처'] || '').replace(/</g, '&lt;');
      const reg = (r['등록일자'] || '-').replace(/</g, '&lt;');
      const end = (r['마감일자'] || '-').replace(/</g, '&lt;');
      const linkDisplay = isUrl
        ? `<a href="${link.replace(/"/g, '&quot;')}" style="font-size:12px;">${link}</a>`
        : '<span style="font-size:12px;color:#888;">링크 없음</span>';
      html += `<li style="margin-bottom:12px;padding:8px 0;border-bottom:1px solid #eee;"><strong>${i + 1}. ${title}</strong><br/><span style="color:#666;font-size:12px;">출처: ${source} | 등록: ${reg} | 마감: ${end}</span><br/>${linkDisplay}</li>`;
    });
    html += '</ul>';
  } else {
    html += '<p style="color:#666;">이번 갱신에 최근 7일 이내 등록된 공고는 없습니다.</p>';
  }
  html += '<p style="margin-top:16px;"><a href="#">대시보드에서 전체 목록 확인</a></p>';
  return { text, html, recentCount };
}

/**
 * 크롤 실행 + DB 저장 + (선택) 메일 발송. 스케줄/API 공용.
 */
async function runCrawlAndNotify() {
  if (crawlInProgress) return { ok: false, skipped: true, message: '이미 크롤링 실행 중' };
  crawlInProgress = true;
  try {
    const records = await run();
    let lastUpdated = null;
    if (records.length) {
      await initDb();
      await saveCrawlResults(records);
      const now = new Date();
      lastUpdated = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    if (isMailConfigured() && records.length) {
      const emails = await getSubscribedEmails();
      if (emails.length) {
        const { text, html, recentCount } = buildCrawlMailContent(records);
        const subject = `[스타트업 공고] 갱신 완료 (전체 ${records.length}건, 최근 등록 ${recentCount}건)`;
        const r = await sendMail(emails, subject, text, html);
        if (r.ok) console.log('메일 알림 발송:', emails.length, '명');
        else console.warn('메일 알림 실패:', r.message);
      }
    }
    return { ok: true, count: records.length, lastUpdated };
  } catch (e) {
    console.error('크롤 실행 오류:', e);
    return { ok: false, message: e.message };
  } finally {
    crawlInProgress = false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url?.replace(/\?.*$/, '') || '/';

  if (req.method === 'GET' && url === '/api/status') {
    try {
      const meta = await getCrawlMeta();
      sendJson(res, 200, meta);
    } catch {
      sendJson(res, 200, { lastUpdated: null, count: 0 });
    }
    return;
  }

  if (req.method === 'GET' && url === '/api/data') {
    try {
      const [data, meta] = await Promise.all([loadCrawlResults(), getCrawlMeta()]);
      sendJson(res, 200, { lastUpdated: meta.lastUpdated, data });
    } catch (e) {
      console.error('API 데이터 조회 오류:', e);
      sendJson(res, 500, { lastUpdated: null, data: [] });
    }
    return;
  }

  if (req.method === 'GET' && url === '/api/sources/status') {
    try {
      const list = await getSourceStatus();
      sendJson(res, 200, { ok: true, list, crawlingSource: crawlingSource ?? null });
    } catch (e) {
      console.error('출처 상태 조회 오류:', e);
      sendJson(res, 500, { ok: false, list: [] });
    }
    return;
  }

  if (req.method === 'GET' && url === '/api/mailing/list') {
    try {
      const { getMailingList } = await import('./db.js');
      const list = await getMailingList();
      sendJson(res, 200, { ok: true, list });
    } catch (e) {
      console.error('메일링 리스트 조회 오류:', e);
      sendJson(res, 500, { ok: false, message: e.message });
    }
    return;
  }

  // /api/mailing/subscribe: 토글(k/v) 먼저 처리 → form body가 등록 핸들러에서 JSON으로 파싱되는 것 방지
  const mailingSubscribePath = url.replace(/\?.*$/, '');
  if ((req.method === 'PATCH' || req.method === 'POST') && mailingSubscribePath === '/api/mailing/subscribe') {
    const qs = url.includes('?') ? Object.fromEntries(new URLSearchParams(url.slice(url.indexOf('?') + 1))) : {};
    try {
      let idOrEmail = null;
      let subscribe = null;
      let isToggle = false;
      const contentType = (req.headers['content-type'] || '').toLowerCase();
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const body = await readBody(req);
        const form = Object.fromEntries(new URLSearchParams(body || ''));
        if (form.k != null && (form.v === '1' || form.v === '0')) {
          idOrEmail = form.k.trim();
          subscribe = form.v === '1';
          isToggle = true;
        }
        if (!isToggle && (form.id != null || form.email != null) && (form.on === '1' || form.on === '0' || form.subscribe !== undefined)) {
          idOrEmail = form.id ?? form.email;
          subscribe = form.on === '1' || form.subscribe === 'true' || form.subscribe === '1';
          isToggle = true;
        }
      } else if (qs.k != null && (qs.v === '1' || qs.v === '0')) {
        idOrEmail = String(qs.k).trim();
        subscribe = qs.v === '1';
        isToggle = true;
      } else if (contentType.includes('application/json')) {
        const body = await readBody(req);
        const data = JSON.parse(body || '{}');
        if (data.id != null || data.k != null) {
          idOrEmail = data.id ?? data.k;
          subscribe = typeof data.subscribe === 'boolean' ? data.subscribe : data.on === 1 || data.on === '1';
          isToggle = true;
        } else if (data.email != null) {
          const email = String(data.email).trim();
          const sub = data.subscribe !== false;
          if (!email) {
            sendJson(res, 400, { ok: false, message: '이메일을 입력하세요.' });
            return;
          }
          const { upsertMailingEmail } = await import('./db.js');
          const result = await upsertMailingEmail(email, sub);
          sendJson(res, 200, result);
          return;
        }
      }
      if (isToggle && idOrEmail != null && subscribe !== null) {
        const { setMailingSubscribed } = await import('./db.js');
        const updated = await setMailingSubscribed(idOrEmail, subscribe);
        if (!updated) {
          sendJson(res, 404, { ok: false, message: '해당 이메일을 찾을 수 없습니다.' });
          return;
        }
        sendJson(res, 200, { ok: true, message: subscribe ? '메일 알림을 켰습니다.' : '메일 알림을 끄셨습니다.' });
        return;
      }
      if (!isToggle && !contentType.includes('application/json')) {
        sendJson(res, 400, { ok: false, message: 'id(k)와 on(v=1/0)가 필요합니다. form: k=<id>&v=1' });
        return;
      }
      sendJson(res, 400, { ok: false, message: 'id(k)와 on(v=1/0)가 필요합니다. form: k=<id>&v=1 또는 쿼리: ?k=<id>&v=1' });
    } catch (e) {
      console.error('메일링 구독 변경 오류:', e);
      sendJson(res, 500, { ok: false, message: e.message });
    }
    return;
  }

  if (req.method === 'POST' && url === '/api/crawl') {
    if (crawlInProgress || crawlingSource !== null) {
      sendJson(res, 409, { ok: false, message: crawlInProgress ? '이미 크롤링이 실행 중입니다.' : `출처 갱신 중입니다. (${crawlingSource})` });
      return;
    }
    try {
      const result = await runCrawlAndNotify();
      if (result.skipped) {
        sendJson(res, 409, { ok: false, message: result.message });
        return;
      }
      if (result.ok) {
        sendJson(res, 200, { ok: true, count: result.count, lastUpdated: result.lastUpdated });
      } else {
        sendJson(res, 500, { ok: false, message: result.message || '크롤 실행 중 오류' });
      }
    } catch (e) {
      console.error('크롤 API 오류:', e);
      sendJson(res, 500, { ok: false, message: e.message || '크롤 실행 중 오류' });
    }
    return;
  }

  if (req.method === 'POST' && url === '/api/crawl/source') {
    if (crawlInProgress) {
      sendJson(res, 409, { ok: false, message: '이미 전체 크롤링이 실행 중입니다.' });
      return;
    }
    let body = '';
    try {
      body = await readBody(req);
      const data = JSON.parse(body || '{}');
      const source = data.source ? String(data.source).trim() : '';
      if (!source) {
        sendJson(res, 400, { ok: false, message: '출처(source)를 입력하세요.' });
        return;
      }
      if (crawlingSource !== null) {
        sendJson(res, 409, { ok: false, message: `이미 갱신 중입니다. (현재: ${crawlingSource})` });
        return;
      }
      crawlingSource = source;
      try {
        const { records, statusEntry } = await runOne(source);
        await initDb();
        await replaceCrawlResultsBySource(records, source);
        await saveSourceStatus([statusEntry]);
        sendJson(res, 200, { ok: true, source, count: records.length });
      } catch (e) {
        console.error('개별 크롤 오류:', e);
        sendJson(res, 500, { ok: false, message: e.message || '개별 수집 중 오류' });
      } finally {
        crawlingSource = null;
      }
    } catch (e) {
      if (e instanceof SyntaxError) sendJson(res, 400, { ok: false, message: '잘못된 요청입니다.' });
      else sendJson(res, 500, { ok: false, message: e.message });
    }
    return;
  }

  const p = url === '/' ? '/index.html' : url;
  if (p.includes('..')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  const filepath = path.join(ROOT, p);
  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      res.end(err.code === 'ENOENT' ? 'Not Found' : 'Server Error');
      return;
    }
    const ext = path.extname(filepath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

async function start() {
  try {
    const ok = await initDb();
    if (!ok) {
      console.error('');
      console.error('DB 연결 실패. 설정 확인 후 재시작하세요.');
      console.error('');
      process.exit(1);
    }
    console.log('DB 연결: 성공');

    await runMigrations();
  } catch (e) {
    console.error('');
    console.error('시작 실패 —', e.message);
    console.error('');
    process.exit(1);
  }

  server.listen(PORT, HOST, () => {
    console.log(`대시보드: http://0.0.0.0:${PORT} (http://localhost:${PORT})`);
    console.log('  GET  /api/status         — 마지막 갱신 시각/건수 (DB)');
    console.log('  GET  /api/data           — 크롤 데이터 목록 (DB)');
    console.log('  GET  /api/sources/status — 출처별 수집 상태 (에러/정상 수집중)');
    console.log('  POST /api/crawl         — 데이터 크롤링 실행 (DB 저장)');
    console.log('  POST /api/crawl/source  — 출처별 개별 수집');
    console.log('  GET  /api/mailing/list  — 메일링 리스트');
    console.log('  POST /api/mailing/subscribe — 이메일 등록');
    console.log('  PATCH /api/mailing/subscribe — 메일 알림 켜기/끄기');
    console.log(`  자동 갱신: 12시간마다 실행 (갱신 시 구독자에게 메일 발송)`);
    console.log('종료: Ctrl+C');
  });

  const shutdown = async () => {
    if (server.shuttingDown) return;
    server.shuttingDown = true;
    console.log('\n서버 종료 중...');
    server.close(() => {
      closeDb()
        .then(() => import('./puppeteer-fetch.js').then((m) => m.closePuppeteerBrowser()).catch(() => {}))
        .then(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // 12시간마다 데이터 갱신 실행 (갱신 시 메일 발송)
  const scheduleCrawl = () => {
    if (crawlInProgress) return;
    console.log('[스케줄] 데이터 갱신 시작...');
    runCrawlAndNotify().then((r) => {
      if (r.ok) console.log('[스케줄] 갱신 완료:', r.count, '건');
      else if (!r.skipped) console.warn('[스케줄] 갱신 실패:', r.message);
    });
  };
  const delayMs = 60 * 1000; // 서버 기동 1분 후 첫 실행
  setTimeout(scheduleCrawl, delayMs);
  setInterval(scheduleCrawl, CRAWL_INTERVAL_MS);
}

start();
