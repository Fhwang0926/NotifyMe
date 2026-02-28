# DB 인덱스 정리

## 현재 적용된 인덱스

### crawl_results
| 인덱스 | 용도 |
|--------|------|
| `PRIMARY KEY (id)` | 기본키, `ORDER BY id`, 개별 조회 |
| `KEY idx_source (source)` | 출처별 삭제/교체 `WHERE source = ?` (replaceCrawlResultsBySource) |
| `KEY idx_org (org(100))` | 운영기관 필터/검색 대비 (선택) |

### mailing_list
| 인덱스 | 용도 |
|--------|------|
| `PRIMARY KEY (id)` | 기본키, 토글 시 `WHERE id = ?` |
| `UNIQUE KEY (email)` | 이메일 등록/조회 `WHERE email = ?` (findOrCreate, setMailingSubscribed) |

### crawl_source_status
| 인덱스 | 용도 |
|--------|------|
| `PRIMARY KEY (source)` | 출처별 상태 upsert/조회 |

---

## 추가 권장 인덱스

### 1. crawl_results – created_at (선택)

**용도**: `getCrawlMeta()` 에서 `MAX(created_at)` 사용. 데이터가 많을 때 풀 스캔 대신 인덱스 스캔으로 최신 시각만 빠르게 조회.

```sql
ALTER TABLE crawl_results ADD INDEX idx_created_at (created_at);
```

### 2. mailing_list – subscribed (선택)

**용도**: 나중에 구독자 목록을 DB에서 `WHERE subscribed = 1` 로만 가져오는 쿼리를 넣을 경우. 현재는 `findAll` 후 애플리케이션에서 필터링하므로 필수는 아님.

```sql
ALTER TABLE mailing_list ADD INDEX idx_subscribed (subscribed);
```

---

## 적용 방법

- **수동**: 위 `ALTER TABLE` 문을 DB 클라이언트에서 실행.
- **마이그레이션**: `migrations/` 에 새 마이그레이션 파일을 만들어 `queryInterface.addIndex` 로 추가 후 `npm run db:migrate` 실행.

이미 `schema.sql` / 초기 마이그레이션에 `idx_source`, `idx_org`, `mailing_list.email` 유니크는 반영되어 있음.
