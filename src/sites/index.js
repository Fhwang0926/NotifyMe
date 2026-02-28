/**
 * 사이트 크롤러 진입점 — 크롤러 목록만 re-export
 */

import { crawlKised } from './kised.js';
import { crawlSeoulRnbd, crawlBepa, crawlJung2030, crawlBtis } from './crawlers-seoul-busan.js';
import { crawlWbiz, crawlKovwa, crawlSeoulYouth } from './crawlers-bistep-wbiz.js';
import { crawlKwbiz, crawlMss, crawlNtis } from './crawlers-kwbiz-mss-ntis.js';
import { crawlIris, crawlKeit } from './crawlers-iris-keit-srome.js';

export { crawlKised, crawlSeoulRnbd, crawlBepa, crawlJung2030, crawlBtis };
export { crawlWbiz, crawlKovwa, crawlSeoulYouth };
export { crawlKwbiz, crawlMss, crawlNtis };
export { crawlIris, crawlKeit };

export const crawlers = [
  { source: '창업진흥원', crawl: crawlKised },
  { source: '서울R&BD', crawl: crawlSeoulRnbd },
  { source: '부산경제진흥원', crawl: crawlBepa },
  { source: '대구 2030 청년창업지원센터', crawl: crawlJung2030 },
  { source: 'BTIS', crawl: crawlBtis },
  { source: 'WBIZ', crawl: crawlWbiz },
  { source: 'KOVWA', crawl: crawlKovwa },
  { source: '서울청년포털', crawl: crawlSeoulYouth },
  { source: '한국여성경제인협회', crawl: crawlKwbiz },
  { source: '중소벤처기업부', crawl: crawlMss },
  { source: 'NTIS', crawl: crawlNtis },
  { source: 'IRIS', crawl: crawlIris },
  { source: 'KEIT(S-Rome 과제공고)', crawl: crawlKeit },
];
