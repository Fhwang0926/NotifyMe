/**
 * PROJECT_DATA 형식 JS 파일 호환성 검증 (Node.js)
 * 사용: node src/validate-js.js <파일경로>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REQUIRED_FIELDS = [
  '분류', 'D-Day', '사업명', '운영기관', '기관유형', '지역',
  '등록일자', '시작일자', '마감일자', '조회수', '공고링크',
];
const OPTIONAL_FIELDS = ['출처'];

function validateJsFile(filepath) {
  if (!filepath) {
    console.log('사용법: node src/validate-js.js <파일경로>');
    console.log('  예: node src/validate-js.js ./exported_data.js');
    return false;
  }

  console.log('='.repeat(60));
  console.log('PROJECT_DATA 형식 호환성 검증:', filepath);
  console.log('='.repeat(60));

  try {
    const content = fs.readFileSync(filepath, 'utf8');

    if (!content.includes('const PROJECT_DATA = ')) {
      console.log("[ERROR] 'const PROJECT_DATA = ' 선언이 없습니다.");
      return false;
    }

    const startMarker = 'const PROJECT_DATA = ';
    const idx = content.indexOf(startMarker);
    let jsonPart = content.slice(idx + startMarker.length).trim();
    if (jsonPart.endsWith(';')) jsonPart = jsonPart.slice(0, -1).trim();
    if (!jsonPart.trimEnd().endsWith(']')) {
      console.log("[ERROR] 배열이 ']'로 닫히지 않습니다.");
      return false;
    }

    let data;
    try {
      data = JSON.parse(jsonPart);
    } catch (e) {
      console.log('[ERROR] JSON 파싱 오류:', e.message);
      return false;
    }

    console.log(`[OK] JSON 파싱 성공: ${data.length}건`);

    if (data.length === 0) {
      console.log('[WARNING] 데이터가 없습니다.');
      return true;
    }

    const sample = data[0];
    const missing = REQUIRED_FIELDS.filter((f) => !(f in sample));
    if (missing.length) {
      console.log('[ERROR] 누락된 필드:', missing.join(', '));
      return false;
    }

    for (const field of OPTIONAL_FIELDS) {
      if (!(field in sample)) {
        console.log(`[WARNING] '${field}' 필드가 없습니다. 크롤러를 다시 실행하면 출처별 필터가 동작합니다.`);
      }
    }

    console.log('[OK] 필수 필드 존재:', REQUIRED_FIELDS.join(', '));

    console.log('\n[샘플 데이터]');
    console.log('  분류:', sample['분류'] ?? 'N/A');
    console.log('  사업명:', (sample['사업명'] ?? 'N/A').slice(0, 50) + '...');
    console.log('  운영기관:', sample['운영기관'] ?? 'N/A');
    console.log('  출처:', sample['출처'] ?? 'N/A');
    console.log('  지역:', sample['지역'] ?? 'N/A');
    console.log('  마감일자:', sample['마감일자'] ?? 'N/A');

    console.log('\n[데이터 통계]');
    console.log('  총 레코드 수:', data.length, '건');

    const allFields = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];
    console.log('\n[필드별 데이터 존재율]');
    for (const field of allFields) {
      const count = data.filter((d) => d[field] != null && String(d[field]).trim()).length;
      const pct = data.length ? ((count / data.length) * 100).toFixed(1) : 0;
      console.log(`  ${field}: ${count}/${data.length} (${pct}%)`);
    }

    console.log('\n[OK] 호환성 검증 완료: index.html과 호환됩니다!');
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('[ERROR] 파일을 찾을 수 없습니다:', filepath);
    } else {
      console.log('[ERROR]', e.message);
    }
    return false;
  }
}

const fileArg = process.argv[2];
const success = validateJsFile(fileArg);
process.exit(success ? 0 : 1);
