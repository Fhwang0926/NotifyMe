/**
 * 크롤러 설정 — 환경 변수 및 상수
 */

// SSL 인증서 검증: 기본 비활성화(크롤 사이트 호환). CRAWLER_VERIFY_SSL=1 이면 검증함
export const VERIFY_SSL = ['1', 'true', 'yes'].includes(
  (process.env.CRAWLER_VERIFY_SSL || '').toLowerCase()
);

export const REQUEST_TIMEOUT = 20000;
export const MAX_RETRIES = 3;
export const RETRY_BACKOFF = 1.5;

export const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

export const FIELDS = [
  '분류',
  'D-Day',
  '사업명',
  '운영기관',
  '기관유형',
  '지역',
  '등록일자',
  '시작일자',
  '마감일자',
  '조회수',
  '공고링크',
  '출처',
];

export const INCLUDE_KW = [
  '창업', '스타트업', 'startup', '사업화', '패키지', 'TIPS', '팁스',
  '액셀러레이팅', '보육', '입주기업', 'R&D', '기술개발', '지원사업',
  '모집공고', '투자', '스케일업', '초기창업', '예비창업', '창업도약',
  '초격차', '딥테크', '테스트베드', '실증', '혁신챌린지', '데모데이',
  '사업화지원', '창업경진', '프리마켓', '펀드', '멘토링',
  '인큐베이팅', '기술사업화', '핀테크', '바이오', 'AI', '로봇',
];

export const EXCLUDE_KW = [
  '채용', '인턴모집', '직원모집', '평가위원 모집', '포상',
  '유공자', '개인정보', '운영용역', '노동조합', '교섭',
  '학자금', '규제', '감사보고', '결산', '입찰공고',
];

export const KEYWORD_FILTER_ENABLED = ['1', 'true', 'yes'].includes(
  (process.env.CRAWLER_KEYWORD_FILTER || '').toLowerCase()
);

/** 공공데이터포털 K-Startup API — 창업진흥원 지원사업 공고 */
const K_STARTUP_API_BASE = 'https://apis.data.go.kr/B552735/kisedKstartupService01';
export const K_STARTUP_API_KEY = process.env.K_STARTUP_API_KEY || '';
/** 사업공고 정보 (getAnnouncementInformation01) */
export const DATA_GO_KR_BUSINESS_API_URL =
  process.env.DATA_GO_KR_BUSINESS_API_URL ||
  `${K_STARTUP_API_BASE}/getAnnouncementInformation01`;
/** 사업 정보 (getBusinessInformation01) */
export const DATA_GO_KR_GET_BUSINESS_INFO_URL =
  process.env.DATA_GO_KR_GET_BUSINESS_INFO_URL ||
  `${K_STARTUP_API_BASE}/getBusinessInformation01`;
/** 사업 소개 정보 — 예산·규모·수행기관·사업절차·문의처 등 (getSuptBizIntro01) */
export const DATA_GO_KR_SUPT_BIZ_INTRO_URL =
  process.env.DATA_GO_KR_SUPT_BIZ_INTRO_URL ||
  `${K_STARTUP_API_BASE}/getSuptBizIntro01`;

/** getAnnouncementInformation01 한 페이지 결과 수 (문서 기준 최대 10000) */
export const K_STARTUP_ANNOUNCE_PER_PAGE = Math.min(10000, Math.max(1, Number(process.env.K_STARTUP_ANNOUNCE_PER_PAGE) || 1000));
/** 모집진행여부: Y=모집중만, N=모집마감만, 비우면 전체 */
export const K_STARTUP_ANNOUNCE_RCRT_PRGS = process.env.K_STARTUP_ANNOUNCE_RCRT_PRGS_YN || '';

/** getAnnouncementInformation01 추가 cond (공공데이터포털 문서 기준). 미설정 시 생략 */
export const K_STARTUP_ANNOUNCE_COND_INTG_PBANC_YN = process.env.K_STARTUP_ANNOUNCE_COND_INTG_PBANC_YN || '';
export const K_STARTUP_ANNOUNCE_COND_SUPT_BIZ_CLSFC = process.env.K_STARTUP_ANNOUNCE_COND_SUPT_BIZ_CLSFC || '';
export const K_STARTUP_ANNOUNCE_COND_SUPT_REGIN = process.env.K_STARTUP_ANNOUNCE_COND_SUPT_REGIN || '';
export const K_STARTUP_ANNOUNCE_COND_BIZ_ENYY = process.env.K_STARTUP_ANNOUNCE_COND_BIZ_ENYY || '';

/** getBusinessInformation01 연도 조건 (stdt). 예: 2026 */
export const K_STARTUP_BUSINESS_INFO_STDT = process.env.K_STARTUP_BUSINESS_INFO_STDT || String(new Date().getFullYear());
