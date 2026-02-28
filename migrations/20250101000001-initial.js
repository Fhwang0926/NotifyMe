/**
 * 초기 스키마: crawl_results, mailing_list
 * 테이블/인덱스가 이미 있으면 건너뜀 (중복 실행 방지)
 */

export async function up({ context }) {
  const { queryInterface, Sequelize } = context;
  const { INTEGER, STRING, TEXT, BOOLEAN, DATE } = Sequelize;

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
      'crawl_results',
      {
        id: {
          type: INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        category: { type: STRING(100), defaultValue: '' },
        d_day: { type: STRING(20), defaultValue: '' },
        title: { type: STRING(500), allowNull: false },
        org: { type: STRING(255), defaultValue: '' },
        org_type: { type: STRING(100), defaultValue: '' },
        region: { type: STRING(50), defaultValue: '' },
        reg_date: { type: STRING(20), defaultValue: '' },
        start_date: { type: STRING(20), defaultValue: '' },
        end_date: { type: STRING(20), defaultValue: '' },
        views: { type: STRING(50), defaultValue: '' },
        link: { type: TEXT },
        source: { type: STRING(100), defaultValue: '' },
        created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
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

  try {
    await queryInterface.addIndex('crawl_results', ['source'], { name: 'idx_source' });
  } catch (e) {
    ignoreDuplicate(e);
  }
  try {
    await queryInterface.addIndex('crawl_results', ['org'], { name: 'idx_org', length: { org: 100 } });
  } catch (e) {
    ignoreDuplicate(e);
  }

  try {
    await queryInterface.createTable(
      'mailing_list',
      {
        id: {
          type: INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        email: { type: STRING(255), allowNull: false },
        subscribed: { type: BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
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
  try {
    await queryInterface.addIndex('mailing_list', ['email'], { unique: true, name: 'email' });
  } catch (e) {
    ignoreDuplicate(e);
  }
}

export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('crawl_results');
  await queryInterface.dropTable('mailing_list');
}
