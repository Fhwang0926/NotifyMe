/**
 * 출처별 수집 상태 테이블 — 수집 가능한 현황에서 정상/장애 표시용
 * 크롤 시 출처별 성공/실패를 저장
 */

export async function up({ context }) {
  const { queryInterface, Sequelize } = context;
  const { STRING, TEXT, DATE } = Sequelize;

  const ignoreDuplicate = (err) => {
    const msg = (err && err.message) || '';
    if (
      msg.includes('Duplicate') ||
      msg.includes('already exists') ||
      msg.includes('ER_DUP_KEYNAME') ||
      err?.original?.code === 'ER_DUP_KEYNAME'
    ) {
      return;
    }
    throw err;
  };

  try {
    await queryInterface.createTable(
      'crawl_source_status',
      {
        source: {
          type: STRING(100),
          primaryKey: true,
          allowNull: false,
        },
        status: { type: STRING(20), allowNull: false, defaultValue: 'ok' },
        last_checked_at: { type: DATE, allowNull: true },
        error_message: { type: TEXT, allowNull: true },
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
        engine: 'InnoDB',
      }
    );
  } catch (e) {
    ignoreDuplicate(e);
  }
}

export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('crawl_source_status');
}
