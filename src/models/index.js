/**
 * Sequelize 인스턴스 및 모델 정의
 */

import Sequelize from 'sequelize';
import { getDatabaseConfig } from '../config/database.js';

const config = getDatabaseConfig();
const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: config.dialect,
  dialectOptions: config.dialectOptions,
  define: config.define,
  logging: config.logging,
  pool: config.pool,
});

const CrawlResult = sequelize.define(
  'CrawlResult',
  {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    category: { type: Sequelize.STRING(100), defaultValue: '' },
    d_day: { type: Sequelize.STRING(20), defaultValue: '' },
    title: { type: Sequelize.STRING(500), allowNull: false },
    org: { type: Sequelize.STRING(255), defaultValue: '' },
    org_type: { type: Sequelize.STRING(100), defaultValue: '' },
    region: { type: Sequelize.STRING(50), defaultValue: '' },
    reg_date: { type: Sequelize.STRING(20), defaultValue: '' },
    start_date: { type: Sequelize.STRING(20), defaultValue: '' },
    end_date: { type: Sequelize.STRING(20), defaultValue: '' },
    views: { type: Sequelize.STRING(50), defaultValue: '' },
    link: { type: Sequelize.TEXT },
    source: { type: Sequelize.STRING(100), defaultValue: '' },
  },
  {
    tableName: 'crawl_results',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['source'] },
      { fields: ['org'], length: { org: 100 } },
    ],
  }
);

const MailingList = sequelize.define(
  'MailingList',
  {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
    subscribed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: 'mailing_list',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

const CrawlSourceStatus = sequelize.define(
  'CrawlSourceStatus',
  {
    source: { type: Sequelize.STRING(100), primaryKey: true, allowNull: false },
    status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ok' },
    last_checked_at: { type: Sequelize.DATE, allowNull: true },
    error_message: { type: Sequelize.TEXT, allowNull: true },
  },
  {
    tableName: 'crawl_source_status',
    timestamps: false,
  }
);

export { sequelize, CrawlResult, MailingList, CrawlSourceStatus };
