/**
 * 크롤러 유틸 — 날짜, D-Day, 지역, 분류, 레코드 생성
 */

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const TODAY = today();

export function normDate(s) {
  if (!s) return '';
  const str = String(s).trim();
  const m = str.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return '';
}

export function calcDday(마감일자) {
  if (!마감일자 || !String(마감일자).trim()) return '';
  const m = String(마감일자).match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!m) return '';
  try {
    const dl = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    dl.setHours(0, 0, 0, 0);
    const diff = Math.round((dl - TODAY) / 86400000);
    if (diff === 0) return 'D-Day';
    if (diff > 0) return `D-${diff}`;
    return '마감';
  } catch {
    return '';
  }
}

export function regionFrom(org, orgType = '') {
  const keywords = [
    '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
    '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
  ];
  for (const kw of keywords) {
    if (String(org).includes(kw) || String(orgType).includes(kw)) return kw;
  }
  if (['중앙부처', '정부'].some((k) => String(orgType).includes(k))) return '전국';
  return '기타';
}

export function extractCategory(text) {
  if (!text) return '';
  const t = String(text).trim();
  if (t.includes('사업화')) return '사업화';
  if (/시설|공간|보육/.test(t)) return '시설ㆍ공간ㆍ보육';
  if (/멘토링|컨설팅|교육/.test(t)) return '멘토링ㆍ컨설팅ㆍ교육';
  if (/R&D|기술개발/.test(t)) return '기술개발(R&D)';
  if (/행사|네트워크/.test(t)) return '행사ㆍ네트워크';
  if (t.includes('융자')) return '융자';
  if (t.includes('인력')) return '인력';
  if (t.includes('글로벌')) return '글로벌';
  if (/청년|창업/.test(t)) return '청년창업';
  if (t.includes('여성')) return '여성기업';
  if (t.includes('소상공인')) return '소상공인';
  if (t.includes('중소기업')) return '중소기업';
  if (/국가R&D|R&D/.test(t)) return '국가R&D';
  return '';
}

export function isStartupRelated(title, { INCLUDE_KW, EXCLUDE_KW }) {
  if (!title) return false;
  const t = String(title).toLowerCase();
  if (EXCLUDE_KW.some((kw) => t.includes(kw.toLowerCase()))) return false;
  return INCLUDE_KW.some((kw) => t.includes(kw.toLowerCase()));
}

export function createRecord(opts = {}) {
  const {
    분류 = '',
    사업명 = '',
    운영기관 = '',
    기관유형 = '',
    등록일자 = '',
    시작일자 = '',
    마감일자 = '',
    조회수 = '',
    공고링크 = '',
    출처 = '',
  } = opts;

  let name = (사업명 || '').replace(/\s+/g, ' ').trim();
  if (name.length > 200) name = name.slice(0, 197) + '...';

  const 분류Final = 분류 || extractCategory(name);
  const 등록일자N = normDate(등록일자);
  const 시작일자N = normDate(시작일자);
  const 마감일자N = normDate(마감일자);
  const dday = calcDday(마감일자N);
  const 지역 = regionFrom(운영기관, 기관유형);
  const 조회수Str = 조회수 != null ? String(조회수).trim().replace(/,/g, '') : '';
  const link = 공고링크 && String(공고링크).startsWith('http') ? 공고링크 : '';

  return {
    '분류': 분류Final,
    'D-Day': dday,
    '사업명': name,
    '운영기관': 운영기관 || '',
    '기관유형': 기관유형 || '',
    '지역': 지역,
    '등록일자': 등록일자N,
    '시작일자': 시작일자N,
    '마감일자': 마감일자N,
    '조회수': 조회수Str,
    '공고링크': link,
    '출처': 출처 || '',
  };
}
