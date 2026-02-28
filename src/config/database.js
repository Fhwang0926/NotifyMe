/**
 * DB 설정 — 환경 변수 기반 (Sequelize용)
 * 연결 풀을 한 번 생성해 앱 전체에서 공유합니다.
 */
export function getDatabaseConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'notifyme',
    dialect: 'mysql',
    dialectOptions: {
      charset: 'utf8mb4',
    },
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      timestamps: true,
      underscored: false,
    },
    logging: process.env.DB_DEBUG === '1' ? console.log : false,
    // 연결 풀: 앱 전체에서 공유, 요청마다 새 연결하지 않음
    pool: {
      max: Number(process.env.DB_POOL_MAX) || 10,
      min: Number(process.env.DB_POOL_MIN) || 0,
      acquire: Number(process.env.DB_POOL_ACQUIRE_MS) || 60000,
      idle: Number(process.env.DB_POOL_IDLE_MS) || 10000,
    },
  };
}
