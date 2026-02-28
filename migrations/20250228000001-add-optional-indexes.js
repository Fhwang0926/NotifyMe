/**
 * 선택 인덱스 추가
 * - crawl_results.created_at: getCrawlMeta() MAX(created_at)용
 * - mailing_list.subscribed: 구독 여부 필터 쿼리 대비
 */

export async function up({ context }) {
  const { queryInterface } = context;
  const ignoreDuplicate = (err) => {
    const msg = (err && err.message) || '';
    if (msg.includes('Duplicate') || msg.includes('already exists') || err?.original?.code === 'ER_DUP_KEYNAME') return;
    throw err;
  };
  try {
    await queryInterface.addIndex('crawl_results', ['created_at'], { name: 'idx_created_at' });
  } catch (e) {
    ignoreDuplicate(e);
  }
  try {
    await queryInterface.addIndex('mailing_list', ['subscribed'], { name: 'idx_subscribed' });
  } catch (e) {
    ignoreDuplicate(e);
  }
}

export async function down({ context }) {
  const { queryInterface } = context;
  try {
    await queryInterface.removeIndex('crawl_results', 'idx_created_at');
  } catch (_) {}
  try {
    await queryInterface.removeIndex('mailing_list', 'idx_subscribed');
  } catch (_) {}
}
