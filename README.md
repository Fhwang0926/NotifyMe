# 🚀 스타트업 지원사업 통합 대시보드

**▶ [데모 보기](https://notifyme.awen.3vi.co.kr/)** — 실제 동작을 브라우저에서 확인할 수 있습니다.

K-Startup, 서울R&BD, 부산경제진흥원 등 국내 주요 스타트업 지원사업 공고를 자동 수집하고, 웹 대시보드로 한눈에 확인할 수 있는 통합 시스템입니다.

**런타임: Node.js 18+** (크롤러·검증·로컬 서버)

---

## 📁 프로젝트 구조

```
NotifyMe/
├── index.html                      # 메인 대시보드 (웹 UI)
├── dashboard.css                   # 대시보드 스타일시트
├── dashboard.js                    # 대시보드 로직 (필터, 정렬, 검색 등)
├── package.json                    # Node.js 의존성 및 스크립트
├── schema.sql                      # MariaDB 스키마 (선택, 수동 실행용)
├── migrations/                     # Sequelize 마이그레이션
│   └── 20250101000001-initial.js
├── src/
│   ├── config/
│   │   └── database.js             # DB 설정 (Sequelize용)
│   ├── models/
│   │   └── index.js                # Sequelize 모델 (CrawlResult, MailingList)
│   ├── migrate.js                  # 마이그레이션 실행 스크립트
│   ├── config.js                   # 설정 (FIELDS, SSL, 키워드 등)
│   ├── db.js                       # DB 레이어 (Sequelize 모델 사용)
│   ├── validate-js.js              # JS 데이터 호환성 검증
│   ├── server.js                   # 정적 파일 서버 (대시보드)
│   └── sites/
│       ├── index.js                # 크롤러 진입점 (crawlers 목록)
│       ├── utils.js                # 공통 유틸 (urlJoin, formatApiDate)
│       ├── kised.js                # 창업진흥원 (K-Startup API)
│       ├── crawlers-seoul-busan.js # 서울R&BD, 부산경제진흥원, 2030청년, BTIS
│       ├── crawlers-bistep-wbiz.js # WBIZ, KOVWA, 서울청년포털 (BISTEP는 BTIS로 통합)
│       ├── crawlers-kwbiz-mss-ntis.js # 한국여성경제인협회, 중소벤처기업부, NTIS
│       └── crawlers-iris-keit-srome.js # IRIS, KEIT(S-Rome 과제공고)
├── .env.sample                     # 환경 변수 예시 (복사 후 .env)
```

---

## 📡 데이터 수집 가능 사이트

아래 사이트들에서 스타트업·지원사업 공고를 수집합니다. **K-Startup(창업진흥원)**은 공공데이터포털 API를 필수로 사용하며, 나머지는 웹 크롤링으로 수집합니다.

| # | 출처 | 수집 방식 | 비고 |
|---|------|-----------|------|
| 1 | K-Startup (창업진흥원) | **API** (필수) | 공공데이터포털 서비스 키 설정 |
| 2 | 서울R&BD | 크롤링 | |
| 3 | 부산경제진흥원 | 크롤링 | |
| 4 | 대구 2030 청년창업지원센터 | 크롤링 | |
| 5 | BTIS (부산과학기술정보서비스·BISTEP) | 크롤링 | 국가R&D·부산시R&D 게시판 통합 수집 |
| 6 | WBIZ 여성기업포털 | 크롤링 | |
| 7 | KOVWA 여성벤처협회 | 크롤링 | /199 예비창업패키지 + /94 공지사항 |
| 8 | 서울청년포털 | 크롤링 | |
| 9 | 한국여성경제인협회 | 크롤링 | |
| 10 | 중소벤처기업부 (MSS) | 크롤링 | |
| 11 | NTIS 국가R&D | 크롤링 | |
| 12 | IRIS (범부처통합연구지원시스템) | 크롤링 | Puppeteer 대기 |
| 13 | KEIT(S-Rome 과제공고) | 크롤링 | S-Rome 과제공고 목록 (f_detail 파싱) |

---

## ⚙️ 설치 및 실행 (Node.js)

### 1. 필수 요구사항

- **Node.js 18** 이상

### 2. 의존성 설치

```bash
npm install
```

### 3. 크롤링 실행 (데이터 수집)

**방법 A — 대시보드에서 실행 (권장)**  
서버를 띄운 뒤 브라우저에서 **「📡 데이터 갱신」** 버튼을 누르면 크롤링이 실행되고, 완료 후 자동으로 최신 데이터가 반영됩니다.

```bash
npm start
# 브라우저에서 http://localhost 접속 후 "데이터 갱신" 클릭 (기본 포트 80)
```

**방법 B — 터미널에서 직접 실행**

```bash
npm run crawl
```

실행 후 크롤 결과는 **MariaDB**에만 저장됩니다. (로컬 파일 생성 없음)  
대시보드는 서버의 **GET /api/data**로 DB에서 데이터를 불러옵니다.  
`.env`에 MariaDB 접속 정보(`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` 등)를 **필수**로 설정하세요.

**DB 테이블**  
- **자동 마이그레이션**: 서버(`npm start`) 또는 크롤러(`npm run crawl`) 실행 시 테이블이 없거나 pending 마이그레이션이 있으면 자동으로 적용됩니다. 별도 실행 불필요.  
- **수동 실행**: `npm run db:migrate` — pending 마이그레이션만 실행. 되돌리기: `npm run db:migrate:undo`  
- **수동 SQL**: `mysql -u 사용자 -p < schema.sql` — `notifyme` DB 및 테이블 생성

### 4. JS 데이터 호환성 검증 (선택)

`const PROJECT_DATA = [...]` 형식의 JS 파일이 대시보드 필드와 호환되는지 검증합니다.

```bash
npm run validate -- <파일경로>
# 예: node src/validate-js.js ./exported.js
```

### 5. 대시보드 실행

**방법 A — 로컬 서버 (권장)**

```bash
npm start
```

- 브라우저에서 **http://localhost** 접속 (기본 포트 80, `WEB_PORT`로 변경 가능)
- **데이터 갱신**: 사이드바 하단에 **「데이터 갱신: YYYY-MM-DD HH:mm」** 로 마지막 크롤 시각 표시
- **📡 데이터 갱신** 버튼으로 서버에서 크롤링 실행 후 자동 반영

포트 변경 시:

```bash
WEB_PORT=8080 npm start
```

**방법 B — 파일 직접 열기**  
`index.html`을 브라우저에서 열면 **데이터가 로드되지 않습니다.** 데이터는 서버의 **GET /api/data**에서만 제공되므로 **반드시 `npm start`로 서버를 띄운 뒤** 접속하세요.

---

## 🖥️ 대시보드 기능

| 기능 | 설명 |
|------|------|
| 📊 통계 카드 | 전체 공고 수, 마감임박(D-7), 이번주 등록, 진행중, 링크 보유 현황 |
| 🔍 통합 검색 | 사업명, 기관명, 분류 키워드 검색 (Ctrl+F 단축키) |
| 🏷️ 출처 필터 | 수집 사이트별 칩(Chip) 클릭으로 필터링 |
| 📋 상태 필터 | 진행중 / 마감임박 / 종료 상태별 필터 |
| 🗺️ 지역 필터 | 전국, 서울, 부산, 대구, 인천, 광주, 대전, 경기 |
| ↕️ 정렬 | 마감임박순, 최신등록순, 조회수순, 사업명순 |
| 📄 상세 패널 | 행 클릭 시 공고 상세 정보 슬라이드 표시 |
| 🔗 원문 바로가기 | 행 더블클릭 또는 상세 패널의 원문보기 버튼 |
| 📥 CSV 내보내기 | 현재 필터된 결과를 CSV 파일로 다운로드 |
| 📡 데이터 갱신 | 서버 실행 시: 크롤링 실행 버튼 (API 연동) |
| 🕐 데이터 갱신 시각 | 사이드바 하단에 **최근 갱신 시각** 표시 |
| 📧 메일링 리스트 | 이메일 등록 및 메일 알림 수신 여부 관리 (Nodemailer/SMTP 설정 시 갱신 시 알림 발송) |
| 🌙 다크/라이트 테마 | 테마 전환 (설정값 로컬스토리지 저장) |

---

## 🗂️ 데이터 필드 구조

| 필드 | 설명 |
|------|------|
| `분류` | 사업 유형 (예: 창업지원, 기술사업화 등) |
| `D-Day` | 마감일까지 남은 일수 |
| `사업명` | 지원사업 공고명 |
| `운영기관` | 공고 운영 기관명 |
| `기관유형` | 정부기관 / 공공 / 민간 |
| `지역` | 지원 대상 지역 |
| `등록일자` | 공고 등록일 (YYYY-MM-DD) |
| `시작일자` | 접수 시작일 |
| `마감일자` | 접수 마감일 |
| `조회수` | 원문 사이트 조회수 |
| `공고링크` | 원문 공고 URL |
| `출처` | 수집 출처 사이트명 |

---

## 🔧 환경 변수

`.env.sample`을 복사해 `.env`로 저장한 뒤 필요한 값만 설정합니다.  
**보안:** `.env`에는 DB 비밀번호·API 키 등 실제 값만 넣고, **`.env` 파일은 Git에 커밋하지 마세요.** (`.gitignore`에 포함됨)

| 변수 | 설명 |
|------|------|
| `CRAWLER_VERIFY_SSL` | `1` 또는 `true` 시 HTTPS 인증서 검증 (기본: 비활성화, 일부 사이트 호환) |
| `CRAWLER_KEYWORD_FILTER` | `1` 또는 `true` 시 수집 후 키워드 필터 적용 |
| `WEB_PORT` | 대시보드 **웹 서버** 포트 (기본 80). 0.0.0.0에 바인드되어 외부 접속 가능 |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | **(필수)** MariaDB 접속 정보. `DB_PORT`는 MariaDB 포트(기본 3306). 미설정 시 서버·크롤러 기동 안 함 |
| `K_STARTUP_API_KEY` | **(필수)** 공공데이터포털 K-Startup API 서비스 키. 미설정 시 서버 기동 안 함 |
| `DATA_GO_KR_BUSINESS_API_URL` | (선택) 사업공고 API URL. 미설정 시 `getAnnouncementInformation01` 사용 |
| `DATA_GO_KR_GET_BUSINESS_INFO_URL` | (선택) 사업 정보 API URL. 미설정 시 `getBusinessInformation01` 사용 |

| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | (선택) Nodemailer SMTP. 설정 시 데이터 갱신 후 구독자에게 메일 알림 발송 |
| `SMTP_SECURE` | (선택) `1`이면 465 등 TLS 사용 |

---

## 🔒 민감 정보 (공개 저장소)

- 저장소에는 **`.env.sample`** 만 포함됩니다. 실제 비밀번호·API 키는 이 파일에 넣지 마세요.
- 로컬에서 `cp .env.sample .env` 후 **`.env`** 에만 실제 값을 설정하고, `.env`는 절대 커밋하지 마세요.
- 이미 `.env`를 커밋했다면 `git rm --cached .env` 후 DB 비밀번호·API 키를 재발급하는 것을 권장합니다.

---

## 🔔 GitHub Actions (main push 웹훅)

`main` 브랜치에 push되면 웹훅 URL로 POST 요청을 보냅니다. (배포 서버 알림·자동 배포 트리거 등)

- **워크플로**: `.github/workflows/webhook-on-push.yml`
- **트리거**: `push` to `main`
- **시크릿**: 저장소 **Settings → Secrets and variables → Actions** 에서 `DEPLOY_WEBHOOK_URL` 추가 (웹훅 수신 URL)
- **페이로드**: JSON `{ "ref", "branch", "repository", "sha", "pusher", "event": "push" }`, 헤더 `X-GitHub-Event: push`

`DEPLOY_WEBHOOK_URL`을 설정하지 않으면 웹훅 단계는 건너뜁니다.

---

## 📊 크롤러 키워드 필터

`CRAWLER_KEYWORD_FILTER=1`로 실행 시 다음 키워드로 스타트업 관련 공고만 남깁니다.

**포함 키워드:** 창업, 스타트업, 사업화, TIPS, 팁스, 액셀러레이팅, 보육, R&D, 기술개발, 투자, 스케일업, 예비창업, 딥테크, 테스트베드, AI, 바이오, 로봇, 핀테크 등  

**제외 키워드:** 채용, 인턴모집, 평가위원 모집, 포상, 입찰공고, 개인정보, 결산 등

---

## 📝 주의사항

- 크롤러 실행 시 각 사이트에 HTTP 요청을 보내므로 **네트워크 연결**이 필요합니다.
- **SSL 검증**: 크롤 시 기본적으로 인증서 검증을 하지 않습니다 (일부 사이트에서 오류 방지). 검증을 쓰려면 `CRAWLER_VERIFY_SSL=1`로 설정하세요.
- `index.html`을 파일로 열면 데이터가 없습니다. **반드시 `npm start` 후 브라우저에서 http://localhost (기본 포트 80) 으로 접속**하세요.

---
1