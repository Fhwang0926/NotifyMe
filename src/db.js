/**
 * DB 레이어 — Sequelize 모델 사용
 * 환경 변수: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */

import { sequelize, CrawlResult, MailingList, CrawlSourceStatus } from './models/index.js';

function isConfigured() {
  return !!(
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_NAME
  );
}

export async function initDb() {
  if (!isConfigured()) return false;
  try {
    await sequelize.authenticate();
    return true;
  } catch (e) {
    console.warn('DB 연결 실패:', e.message);
    return false;
  }
}

/** 서버/프로세스 종료 시 연결 풀 정리용 */
export async function closeDb() {
  if (!isConfigured()) return;
  try {
    await sequelize.close();
  } catch (e) {
    console.warn('DB 풀 종료 중 오류:', e.message);
  }
}

function recordToRow(r) {
  return {
    category: r['분류'] ?? '',
    d_day: r['D-Day'] ?? '',
    title: r['사업명'] ?? '',
    org: r['운영기관'] ?? '',
    org_type: r['기관유형'] ?? '',
    region: r['지역'] ?? '',
    reg_date: r['등록일자'] ?? '',
    start_date: r['시작일자'] ?? '',
    end_date: r['마감일자'] ?? '',
    views: r['조회수'] ?? '',
    link: r['공고링크'] ?? '',
    source: r['출처'] ?? '',
  };
}

function rowToRecord(row) {
  return {
    '분류': row.category ?? '',
    'D-Day': row.d_day ?? '',
    '사업명': row.title ?? '',
    '운영기관': row.org ?? '',
    '기관유형': row.org_type ?? '',
    '지역': row.region ?? '',
    '등록일자': row.reg_date ?? '',
    '시작일자': row.start_date ?? '',
    '마감일자': row.end_date ?? '',
    '조회수': row.views ?? '',
    '공고링크': row.link ?? '',
    '출처': row.source ?? '',
  };
}

export async function saveCrawlResults(records) {
  if (!isConfigured() || !records.length) return false;
  try {
    await CrawlResult.destroy({ where: {}, truncate: true });
    await CrawlResult.bulkCreate(records.map(recordToRow));
    return true;
  } catch (e) {
    console.warn('DB 저장 실패:', e.message);
    return false;
  }
}

/**
 * 특정 출처의 수집 결과만 교체 (개별 수집 시)
 * 기존 DB에서 해당 출처 행만 삭제 후 새 레코드 추가
 */
export async function replaceCrawlResultsBySource(records, sourceName) {
  if (!isConfigured() || !sourceName) return false;
  try {
    const name = String(sourceName).trim();
    await CrawlResult.destroy({ where: { source: name } });
    if (records.length) {
      await CrawlResult.bulkCreate(records.map(recordToRow));
    }
    return true;
  } catch (e) {
    console.warn('출처별 저장 실패:', e.message);
    return false;
  }
}

export async function loadCrawlResults() {
  if (!isConfigured()) return [];
  try {
    const rows = await CrawlResult.findAll({ order: [['id', 'ASC']] });
    return rows.map((row) => rowToRecord(row));
  } catch (e) {
    console.warn('DB 조회 실패:', e.message);
    return [];
  }
}

export async function getCrawlMeta() {
  if (!isConfigured()) return { count: 0, lastUpdated: null };
  try {
    const count = await CrawlResult.count();
    const ts = await CrawlResult.max('created_at');
    let lastUpdated = null;
    if (ts) {
      const d = new Date(ts);
      lastUpdated = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return { count, lastUpdated };
  } catch (e) {
    return { count: 0, lastUpdated: null };
  }
}

export async function getMailingList() {
  if (!isConfigured()) return [];
  try {
    const rows = await MailingList.findAll({
      order: [['created_at', 'DESC']],
      attributes: ['id', 'email', 'subscribed', 'created_at'],
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      subscribed: Boolean(r.subscribed),
      created_at: r.created_at,
    }));
  } catch (e) {
    console.warn('메일링 조회 실패:', e.message);
    return [];
  }
}

export async function upsertMailingEmail(email, subscribed = true) {
  const normalized = String(email).trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return { ok: false, message: '올바른 이메일을 입력하세요.' };
  if (!isConfigured()) return { ok: false, message: 'MariaDB가 설정되지 않았습니다.' };
  try {
    const [row, created] = await MailingList.findOrCreate({
      where: { email: normalized },
      defaults: { subscribed },
    });
    if (!created) {
      await row.update({ subscribed });
      return { ok: true, message: subscribed ? '메일 알림을 켰습니다.' : '메일 알림을 끄셨습니다.' };
    }
    return { ok: true, message: '등록되었습니다. 메일 알림을 받을 수 있습니다.' };
  } catch (e) {
    console.warn('메일링 DB 오류:', e.message);
    return { ok: false, message: '저장 중 오류가 발생했습니다.' };
  }
}

export async function setMailingSubscribed(idOrEmail, subscribed) {
  if (!isConfigured()) return false;
  try {
    const isId = Number.isInteger(Number(idOrEmail)) && String(idOrEmail).indexOf('@') < 0;
    const where = isId ? { id: idOrEmail } : { email: String(idOrEmail).trim().toLowerCase() };
    await MailingList.update({ subscribed }, { where });
    return true;
  } catch (e) {
    console.warn('메일링 구독 변경 실패:', e.message);
    return false;
  }
}

export async function getSubscribedEmails() {
  const list = await getMailingList();
  return list.filter((r) => r.subscribed).map((r) => r.email);
}

/**
 * 출처별 수집 상태 저장 (크롤 완료 시 호출)
 * @param {Array<{ source: string, status: 'ok'|'error', errorMessage?: string }>} entries
 */
export async function saveSourceStatus(entries) {
  if (!isConfigured() || !entries?.length) return;
  try {
    const now = new Date();
    for (const { source, status, errorMessage } of entries) {
      const name = String(source || '').trim();
      if (!name) continue;
      await CrawlSourceStatus.upsert({
        source: name,
        status: status === 'error' ? 'error' : 'ok',
        last_checked_at: now,
        error_message: status === 'error' ? (errorMessage || '') : null,
      });
    }
  } catch (e) {
    console.warn('출처 상태 저장 실패:', e.message);
  }
}

/**
 * 출처별 수집 상태 조회 — 수집 가능한 현황용
 * @returns {Promise<Array<{ source: string, status: string, last_checked_at: string|null, error_message: string|null }>>}
 */
export async function getSourceStatus() {
  if (!isConfigured()) return [];
  try {
    const rows = await CrawlSourceStatus.findAll({
      order: [['source', 'ASC']],
      attributes: ['source', 'status', 'last_checked_at', 'error_message'],
    });
    return rows.map((r) => ({
      source: r.source ?? '',
      status: r.status ?? 'ok',
      last_checked_at: r.last_checked_at ? new Date(r.last_checked_at).toISOString() : null,
      error_message: r.error_message ?? null,
    }));
  } catch (e) {
    console.warn('출처 상태 조회 실패:', e.message);
    return [];
  }
}

export { isConfigured };
