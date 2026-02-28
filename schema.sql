-- NotifyMe MariaDB 스키마
-- 사용: mysql -u 사용자 -p < schema.sql
-- 또는 DB_NAME DB가 이미 있으면: mysql -u 사용자 -p DB_NAME < schema.sql

CREATE DATABASE IF NOT EXISTS notifyme
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE notifyme;

-- 크롤 결과 (데이터 갱신 시 전체 교체)
CREATE TABLE IF NOT EXISTS `crawl_results` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category` VARCHAR(100) DEFAULT '',
  `d_day` VARCHAR(20) DEFAULT '',
  `title` VARCHAR(500) NOT NULL,
  `org` VARCHAR(255) DEFAULT '',
  `org_type` VARCHAR(100) DEFAULT '',
  `region` VARCHAR(50) DEFAULT '',
  `reg_date` VARCHAR(20) DEFAULT '',
  `start_date` VARCHAR(20) DEFAULT '',
  `end_date` VARCHAR(20) DEFAULT '',
  `views` VARCHAR(50) DEFAULT '',
  `link` TEXT,
  `source` VARCHAR(100) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_source` (`source`),
  KEY `idx_org` (`org`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 출처별 수집 상태 (수집 가능한 현황 — 정상/장애 표시)
CREATE TABLE IF NOT EXISTS `crawl_source_status` (
  `source` VARCHAR(100) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ok',
  `last_checked_at` DATETIME DEFAULT NULL,
  `error_message` TEXT DEFAULT NULL,
  PRIMARY KEY (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 메일링 리스트 (이메일 등록 / 메일 알림 수신 여부)
CREATE TABLE IF NOT EXISTS `mailing_list` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `subscribed` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
