/**
 * 마이그레이션 실행 — Sequelize + Umzug
 * - runMigrations(): pending 마이그레이션 자동 실행 (서버/크롤러에서 호출)
 * - npm run db:migrate       → up (CLI)
 * - npm run db:migrate:undo  → down (마지막 1개 되돌리기)
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import Sequelize from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from './models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'migrations');

const context = {
  queryInterface: sequelize.getQueryInterface(),
  Sequelize,
};

const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.js')).sort();
const migrations = migrationFiles.map((name) => {
  const fullPath = path.join(migrationsDir, name);
  return {
    name: name.replace('.js', ''),
    path: fullPath,
    up: async () => {
      const mod = await import(pathToFileURL(fullPath).href);
      return mod.up({ context });
    },
    down: async () => {
      const mod = await import(pathToFileURL(fullPath).href);
      return mod.down({ context });
    },
  };
});

const umzug = new Umzug({
  migrations,
  context,
  storage: new SequelizeStorage({ sequelize, modelName: 'SequelizeMeta' }),
  logger: console,
});

/**
 * pending 마이그레이션을 실행합니다. (테이블 없을 때·스키마 변경 시 자동 적용)
 * 서버/크롤러 기동 시 호출하면 됩니다. sequelize는 이미 연결된 상태여야 합니다.
 */
export async function runMigrations() {
  const pending = await umzug.pending();
  if (pending.length === 0) {
    return;
  }
  await umzug.up();
}

async function run() {
  const undo = process.argv.includes('--undo');
  try {
    await sequelize.authenticate();
  } catch (e) {
    console.error('DB 연결 실패:', e.message);
    process.exit(1);
  }

  if (undo) {
    const migrated = await umzug.executed();
    if (migrated.length === 0) {
      console.log('되돌릴 마이그레이션이 없습니다.');
      await sequelize.close();
      process.exit(0);
    }
    await umzug.down();
    console.log('마지막 마이그레이션을 되돌렸습니다.');
  } else {
    await umzug.up();
    console.log('마이그레이션 완료.');
  }
  await sequelize.close();
  process.exit(0);
}

// CLI로 직접 실행된 경우에만 run() 실행 (node src/migrate.js)
const isMain = process.argv[1] && process.argv[1].includes('migrate');
if (isMain) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
