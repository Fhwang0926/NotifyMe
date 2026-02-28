/* ═══════════════════════════════════════════
   스타트업 지원사업 대시보드 — Logic
   ═══════════════════════════════════════════ */
   (function(){
    'use strict';
    
    // ── Color map ──
    const COLORS={
      '창업진흥원':'#6366f1','서울산업진흥원':'#3b82f6','부산경제진흥원':'#8b5cf6',
      'BTIS':'#06b6d4','대구중구청':'#ec4899','여성기업종합지원센터':'#d946ef',
      '여성벤처협회':'#f43f5e','K-Startup':'#6366f1','KISED':'#6366f1',
      '서울R&BD':'#3b82f6','BEPA':'#8b5cf6','대구2030':'#ec4899',
      'WBIZ':'#d946ef','KEIT':'#0d9488','S-Rome':'#0d9488',
    };
    function srcColor(s){
      if(!s)return '#6b7280';
      for(const k in COLORS)if(s.includes(k))return COLORS[k];
      return '#6b7280';
    }
    
    // ── State ──
    let allData=[],filtered=[],page=1,perPage=20;
    let cardFilter=null,statusFilter='all',regionFilter='all',sourceFilter='all',categoryFilter='all';
    let searchQ='',sortCol='마감일자',sortDir='asc';
    
    // 출처 키 (크롤러 출력에는 출처 있음, 구 데이터는 운영기관으로 대체). 통합 출처는 하나로 정규화
    function sourceKey(d){
      const s=(d['출처']||d['운영기관']||'').trim();
      if(s==='BISTEP 국가R&D'||s==='BISTEP 부산시R&D')return 'BTIS';
      return s;
    }
    
    // 수집 가능한 출처 목록 (대시보드 수집 현황 표와 동기화). BISTEP 국가/부산은 BTIS로 통합
    const SOURCE_LIST=['창업진흥원','서울R&BD','부산경제진흥원','대구 2030 청년창업지원센터','BTIS','WBIZ','KOVWA','서울청년포털','한국여성경제인협회','중소벤처기업부','NTIS','IRIS','KEIT(S-Rome 과제공고)'];
    // 출처별 사이트 URL — 클릭 시 새 창에서 열기
    const SOURCE_URL={
      '창업진흥원':'https://www.kised.or.kr/',
      '서울R&BD':'https://seoul.rnbd.kr/',
      '부산경제진흥원':'https://www.bepa.kr/',
      '대구 2030 청년창업지원센터':'http://jung2030.or.kr/',
      'BTIS':'https://btis.bistep.re.kr/',
      'WBIZ':'https://www.wbiz.or.kr/',
      'KOVWA':'https://kovwa.or.kr/',
      '서울청년포털':'https://youth.seoul.go.kr/',
      '한국여성경제인협회':'https://www.kwbiz.or.kr/',
      '중소벤처기업부':'https://www.mss.go.kr/',
      'NTIS':'https://www.ntis.go.kr/',
      'IRIS':'https://www.iris.go.kr/',
      'KEIT(S-Rome 과제공고)':'https://srome.keit.re.kr/'
    };
    
    // ── DOM refs ──
    const $=id=>document.getElementById(id);
    const $$=(sel,ctx)=>(ctx||document).querySelectorAll(sel);

    function setLoading(show, text){
      const el=$('loadingOverlay');
      if(!el)return;
      el.classList.toggle('show',!!show);
      el.setAttribute('aria-busy',show?'true':'false');
      const textEl=el.querySelector('.loading-text');
      if(textEl)textEl.textContent=text||'로딩 중...';
    }

    // ═══ INIT ═══
    async function init(){
      const tableBody=$('tableBody');
      setLoading(true,'데이터 불러오는 중...');
      try {
        const r=await fetch('/api/data');
        const j=await r.json();
        if(!j||!Array.isArray(j.data)){
          tableBody.innerHTML='<tr><td colspan="7"><div class="empty"><div class="e-icon">📭</div><div class="e-title">데이터를 불러올 수 없습니다</div><div class="e-desc">서버가 실행 중인지 확인하세요. (GET /api/data)</div></div></td></tr>';
          bind();
          return;
        }
        allData=j.data.map((d,i)=>({...d,_i:i}));
        $('lastUpdate').textContent=j.lastUpdated||'갱신 이력 없음';
        $('footerTotal').textContent=allData.length;
        computeStats();
        fillFilterOptions();
        applyFilters();
        bind();
        const badge=$('navBadge');
        if(badge)badge.textContent=allData.length;
        checkCrawlApi();
      } catch(e) {
        tableBody.innerHTML='<tr><td colspan="7"><div class="empty"><div class="e-icon">📭</div><div class="e-title">서버에서 데이터를 불러오세요</div><div class="e-desc">npm start 후 이 페이지를 새로고침하세요.</div></div></td></tr>';
        bind();
      } finally {
        setLoading(false);
      }
    }
    function checkCrawlApi(){
      fetch('/api/status').then(r=>r.json()).then(meta=>{
        const btn=$('crawlBtn');
        if(btn)btn.style.display='inline-flex';
        if(meta.lastUpdated)$('lastUpdate').textContent=meta.lastUpdated;
      }).catch(()=>{});
    }
    
    // ═══ STATS ═══
    function computeStats(){
      const now=new Date();now.setHours(0,0,0,0);
      const dayNames=['일','월','화','수','목','금','토'];
      let urgent=0,week=0,active=0;
      const weekByDay={1:0,2:0,3:0,4:0,5:0};
      const weekStart=new Date(now);
      const d = now.getDay();
      weekStart.setDate(weekStart.getDate()-(d===0?6:d-1));
      weekStart.setHours(0,0,0,0);
      allData.forEach(d=>{
        const dl=pDate(d['마감일자']);
        const reg=pDate(d['등록일자']);
        if(dl){
          const diff=Math.ceil((dl-now)/864e5);
          if(diff>=0&&diff<=7)urgent++;
          if(diff>=0)active++;
        }
        if(reg&&reg>=weekStart&&reg<=now){
          week++;
          const wd=reg.getDay();
          if(wd>=1&&wd<=5)weekByDay[wd]=(weekByDay[wd]||0)+1;
        }
      });
      $('sUrgent').textContent=urgent;
      $('sWeek').textContent=week;
      $('sActive').textContent=active;
      const sWeekByDay=$('sWeekByDay');
      const weekTableRows=['<tr>'];
      for(let i=1;i<=5;i++)weekTableRows.push('<th>'+dayNames[i]+'</th>');
      weekTableRows.push('</tr><tr>');
      for(let i=1;i<=5;i++)weekTableRows.push('<td>'+(weekByDay[i]||0)+'</td>');
      weekTableRows.push('</tr>');
      sWeekByDay.innerHTML='<table class="week-table" aria-label="이번주 요일별 등록"><tbody>'+weekTableRows.join('')+'</tbody></table>';
      sWeekByDay.style.display='block';
    }
    
    // ═══ CHIPS (removed) ───
    // 출처 필터 제거됨. 검색 결과 출처는 테이블 바에 표시
    function applyFilters(){
      const now=new Date();now.setHours(0,0,0,0);

      filtered=allData.filter(d=>{
        if(!d['사업명']&&!d['운영기관'])return false;
    
        const dl=pDate(d['마감일자']);
        const diff=dl?Math.ceil((dl-now)/864e5):null;
    
        // 기본: 종료 숨김 (종료 필터 선택 시 제외)
        if(diff!==null&&diff<0&&statusFilter!=='closed')return false;
    
        // search
        if(searchQ){
          const q=searchQ.toLowerCase();
          const hay=((d['사업명']||'')+(d['운영기관']||'')+(d['분류']||'')+(d['출처']||'')).toLowerCase();
          if(!hay.includes(q))return false;
        }
        // region
        if(regionFilter!=='all'&&d['지역']!==regionFilter)return false;
        // 출처
        if(sourceFilter!=='all'&&sourceKey(d)!==sourceFilter)return false;
        // 분류
        if(categoryFilter!=='all'&&(d['분류']||'')!==categoryFilter)return false;
    
        // card filter
        if(cardFilter==='urgent'&&!(diff!==null&&diff>=0&&diff<=7))return false;
        if(cardFilter==='week'){
          const reg=pDate(d['등록일자']);
          const mon=new Date(now); const d2=now.getDay(); mon.setDate(mon.getDate()-(d2===0?6:d2-1)); mon.setHours(0,0,0,0);
          if(!(reg&&reg>=mon&&reg<=now))return false;
        }
        if(cardFilter==='active'&&!(diff!==null&&diff>=0))return false;
    
        // status (진행중 = 마감일 당일 포함 diff>=0, 마감임박 = 0~7일, 종료 = diff<0 — 통계와 정의 통일)
        if(statusFilter==='active'&&!(diff!==null&&diff>=0))return false;
        if(statusFilter==='urgent'&&!(diff!==null&&diff>=0&&diff<=7))return false;
        if(statusFilter==='closed'&&!(diff!==null&&diff<0))return false;
    
        return true;
      });
    
      doSort();
      page=1;
      renderFilters();
      syncFilterSelects();
      renderTable();
      renderResultSources();
    }
    
    function doSort(){
      const now=new Date();now.setHours(0,0,0,0);
      const dir=sortDir==='asc'?1:-1;
      filtered.sort((a,b)=>{
        switch(sortCol){
          case '마감일자':{
            const da=pDate(a['마감일자']),db=pDate(b['마감일자']);
            const va=da?Math.ceil((da-now)/864e5):99999;
            const vb=db?Math.ceil((db-now)/864e5):99999;
            return dir*(va-vb);
          }
          case '등록일자':{
            const ra=pDate(a['등록일자'])||new Date(0),rb=pDate(b['등록일자'])||new Date(0);
            return dir*(rb-ra);
          }
          case '사업명':
            return dir*(a['사업명']||'').localeCompare(b['사업명']||'','ko');
          default:return 0;
        }
      });
    }
    
    function renderFilters(){
      const el=$('activeFilters');
      const tags=[];
      if(searchQ)tags.push(mk('검색: "'+searchQ+'"','search'));
      const cardLabels={urgent:'마감임박',week:'이번주 등록',active:'진행중'};
      const statusLabels={active:'진행중',urgent:'마감임박',closed:'마감'};
      const sameAsCard=(cardFilter==='active'&&statusFilter==='active')||(cardFilter==='urgent'&&statusFilter==='urgent');
      if(cardFilter)tags.push(mk(cardLabels[cardFilter],'card'));
      if(statusFilter!=='all'&&!sameAsCard)tags.push(mk(statusLabels[statusFilter],'status'));
      if(regionFilter!=='all')tags.push(mk('지역: '+regionFilter,'region'));
      if(sourceFilter!=='all')tags.push(mk('출처: '+sourceFilter,'source'));
      if(categoryFilter!=='all')tags.push(mk('분류: '+categoryFilter,'category'));
      el.innerHTML=tags.join('');
      function mk(label,type){
        return `<span class="filter-tag">${esc(label)}<span class="x" data-rm="${type}">×</span></span>`;
      }
    }

    function fillFilterOptions(){
      const regionSel=$('filterRegion');
      const sourceSel=$('filterSource');
      const categorySel=$('filterCategory');
      if(!regionSel||!sourceSel||!categorySel)return;
      const regions={},sources={},categories={};
      allData.forEach(d=>{
        const r=d['지역']||''; if(r){ regions[r]=true; }
        const s=sourceKey(d); if(s){ sources[s]=true; }
        const c=d['분류']||''; if(c){ categories[c]=true; }
      });
      SOURCE_LIST.forEach(name=>{ sources[name]=true; });
      const setOptions=(sel,currentVal,opts)=>{
        const prev=sel.value;
        sel.innerHTML='<option value="all">전체</option>'+Object.keys(opts).sort().map(k=>`<option value="${String(k).replace(/"/g,'&quot;')}">${esc(k)}</option>`).join('');
        sel.value=opts[currentVal]?currentVal:'all';
      };
      setOptions(regionSel,regionFilter,regions);
      setOptions(sourceSel,sourceFilter,sources);
      setOptions(categorySel,categoryFilter,categories);
    }

    function syncFilterSelects(){
      const statusSel=$('filterStatus'),regionSel=$('filterRegion'),sourceSel=$('filterSource'),categorySel=$('filterCategory'),sortSel=$('filterSort');
      if(statusSel)statusSel.value=statusFilter;
      if(regionSel)regionSel.value=regionFilter;
      if(sourceSel)sourceSel.value=sourceFilter;
      if(categorySel)categorySel.value=categoryFilter;
      if(sortSel)sortSel.value=sortCol+'-'+sortDir;
    }

    function renderResultSources(){
      const sources={};
      filtered.forEach(d=>{const s=sourceKey(d);if(s)sources[s]=(sources[s]||0)+1});
      const list=Object.keys(sources).sort((a,b)=>sources[b]-sources[a]);
      const el=$('resultSources');
      if(!el)return;
      if(list.length){
        el.textContent=' · 출처: '+list.join(', ');
        el.className='result-sources';
      } else {
        el.textContent='';
      }
    }

    function showPage(name){
      const dash=$('pageDashboard');
      const mail=$('pageMailing');
      const sources=$('pageSources');
      if(!dash||!mail)return;
      if(name==='mailing'){
        dash.classList.add('content-page-hidden');
        if(sources)sources.classList.add('content-page-hidden');
        mail.classList.remove('content-page-hidden');
      } else if(name==='sources'){
        dash.classList.add('content-page-hidden');
        mail.classList.add('content-page-hidden');
        if(sources){sources.classList.remove('content-page-hidden');renderSourcesTable();}
      } else {
        dash.classList.remove('content-page-hidden');
        mail.classList.add('content-page-hidden');
        if(sources)sources.classList.add('content-page-hidden');
      }
    }

    function formatSourceTime(iso){
      if(!iso)return '-';
      try{
        const d=new Date(iso);
        if(isNaN(d.getTime()))return '-';
        const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
        const h=String(d.getHours()).padStart(2,'0'),min=String(d.getMinutes()).padStart(2,'0');
        return `${y}-${m}-${day} ${h}:${min}`;
      }catch(e){return '-';}
    }
    function renderSourcesTable(){
      const tbody=$('sourcesBody');
      const lastEl=$('sourcesLastUpdate');
      if(!tbody)return;
      const countBySource={};
      allData.forEach(d=>{
        const s=sourceKey(d);
        if(s)countBySource[s]=(countBySource[s]||0)+1;
      });
      if(lastEl)lastEl.textContent=$('lastUpdate').textContent||'-';
      setLoading(true,'수집 현황 불러오는 중...');
      fetch('/api/sources/status').then(r=>r.json()).then(j=>{
        const statusBySource={};
        if(j.ok&&Array.isArray(j.list))j.list.forEach(row=>{ statusBySource[row.source]=row; });
        const crawlingSourceName=j.crawlingSource||null;
        let html='';
        SOURCE_LIST.forEach((name,i)=>{
          const count=countBySource[name]||Object.keys(countBySource).filter(k=>k.includes(name)||name.includes(k)).reduce((sum,k)=>sum+(countBySource[k]||0),0);
          const updateText=count>0?`${count}건 수집됨`:'-';
          const st=statusBySource[name]||statusBySource[Object.keys(statusBySource).find(k=>k.includes(name)||name.includes(k))];
          const isCrawling=crawlingSourceName!==null&&(name===crawlingSourceName||name.includes(crawlingSourceName)||crawlingSourceName.includes(name));
          let statusText='미확인';
          if(isCrawling) statusText='갱신중';
          else if(st){
            if(st.status==='error') statusText='에러';
            else statusText='정상 수집중';
          } else if(count>0) statusText='정상 수집중';
          const statusClass=statusText==='에러'?'source-status-error':statusText==='갱신중'?'source-status-crawling':'';
          const checkedAt=st&&st.last_checked_at?formatSourceTime(st.last_checked_at):'-';
          const key=Object.keys(SOURCE_URL).find(k=>k===name||name.includes(k)||k.includes(name));
          const url=SOURCE_URL[name]||(key&&SOURCE_URL[key]);
          const nameCell=url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="source-link">${esc(name)}</a>`:esc(name);
          const btnDisabled=isCrawling?' disabled':'';
          const btnLabel=isCrawling?'갱신 중...':'갱신';
          html+=`<tr><td>${i+1}</td><td>${nameCell}</td><td class="${statusClass}">${statusText}</td><td>${checkedAt}</td><td>${updateText}</td><td><button type="button" class="btn btn-ghost btn-sm btn-crawl-source" data-source="${esc(name)}"${btnDisabled}>${btnLabel}</button></td></tr>`;
        });
        tbody.innerHTML=html||'<tr><td colspan="6">출처 목록 없음</td></tr>';
        $$('.btn-crawl-source',tbody).forEach(btn=>{
          if(btn.disabled)return;
          btn.addEventListener('click',async ()=>{
            const source=btn.getAttribute('data-source');
            if(!source)return;
            btn.disabled=true;
            btn.textContent='갱신 중...';
            try{
              const r=await fetch('/api/crawl/source',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source})});
              const j=await r.json();
              if(j.ok){ toast('✅',`${source} ${j.count}건 갱신 완료`); await init(); renderSourcesTable(); }
              else{ toast('❌',j.message||'갱신 실패'); if(r.status===409) renderSourcesTable(); }
            }catch(e){ toast('❌','갱신 요청 실패'); }
            finally{ btn.disabled=false; btn.textContent='갱신'; }
          });
        });
      }).catch(()=>{
        let html='';
        SOURCE_LIST.forEach((name,i)=>{
          const count=countBySource[name]||Object.keys(countBySource).filter(k=>k.includes(name)||name.includes(k)).reduce((sum,k)=>sum+(countBySource[k]||0),0);
          const updateText=count>0?`${count}건 수집됨`:'-';
          const statusText=count>0?'정상 수집중':'미확인';
          const key=Object.keys(SOURCE_URL).find(k=>k===name||name.includes(k)||k.includes(name));
          const url=SOURCE_URL[name]||(key&&SOURCE_URL[key]);
          const nameCell=url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="source-link">${esc(name)}</a>`:esc(name);
          html+=`<tr><td>${i+1}</td><td>${nameCell}</td><td>${statusText}</td><td>-</td><td>${updateText}</td><td><button type="button" class="btn btn-ghost btn-sm btn-crawl-source" data-source="${esc(name)}">갱신</button></td></tr>`;
        });
        tbody.innerHTML=html||'<tr><td colspan="6">출처 목록 없음</td></tr>';
        $$('.btn-crawl-source',tbody).forEach(btn=>{
          btn.addEventListener('click',async ()=>{
            const source=btn.getAttribute('data-source');
            if(!source)return;
            btn.disabled=true;
            btn.textContent='갱신 중...';
            try{
              const r=await fetch('/api/crawl/source',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source})});
              const j=await r.json();
              if(j.ok){ toast('✅',`${source} ${j.count}건 갱신 완료`); await init(); renderSourcesTable(); }
              else{ toast('❌',j.message||'갱신 실패'); if(r.status===409) renderSourcesTable(); }
            }catch(e){ toast('❌','갱신 요청 실패'); }
            finally{ btn.disabled=false; btn.textContent='갱신'; }
          });
        });
      }).finally(()=>setLoading(false));
    }

    async function loadMailingList(){
      const msgEl=$('mailingMsg');
      if(msgEl)msgEl.textContent='';
      setLoading(true,'메일링 리스트 불러오는 중...');
      try {
        const r=await fetch('/api/mailing/list');
        const j=await r.json();
        if(j.ok&&j.list)renderMailingTable(j.list);
        else renderMailingTable([]);
      } catch(e){
        renderMailingTable([]);
        if(msgEl)msgEl.textContent='목록을 불러올 수 없습니다.';
      } finally {
        setLoading(false);
      }
    }

    function renderMailingTable(list){
      const tbody=$('mailingBody');
      const countEl=$('mailingCount');
      if(!tbody)return;
      if(countEl)countEl.textContent=list.length;
      if(!list.length){
        tbody.innerHTML='<tr><td colspan="5"><div class="empty"><div class="e-icon">📧</div><div class="e-title">등록된 이메일이 없습니다</div></div></td></tr>';
        return;
      }
      let html='';
      list.forEach((row,i)=>{
        const date=row.created_at?String(row.created_at).slice(0,10):'-';
        const sub=row.subscribed;
        html+='<tr data-id="'+row.id+'" data-email="'+esc(row.email)+'" data-subscribed="'+sub+'"><td>'+(i+1)+'</td><td>'+esc(row.email)+'</td><td><span class="mailing-badge '+(sub?'on':'off')+'">'+(sub?'예':'아니오')+'</span></td><td>'+date+'</td><td style="width:80px"><button type="button" class="btn btn-ghost btn-sm mailing-toggle" data-id="'+row.id+'" data-email="'+esc(row.email)+'" data-subscribed="'+sub+'">'+(sub?'끄기':'켜기')+'</button></td></tr>';
      });
      tbody.innerHTML=html;
    }
    
    // ═══ TABLE ═══
    function renderTable(){
      const tbody=$('tableBody');
      const start=(page-1)*perPage,end=start+perPage;
      const rows=filtered.slice(start,end);
      $('resultCount').textContent=filtered.length;
    
      if(!rows.length){
        tbody.innerHTML='<tr><td colspan="7"><div class="empty"><div class="e-icon">🔍</div><div class="e-title">조건에 맞는 공고가 없습니다</div><div class="e-desc">필터 조건을 변경해보세요</div></div></td></tr>';
        $('pager').innerHTML='';
        return;
      }
    
      const now=new Date();now.setHours(0,0,0,0);
      let html='';
      rows.forEach((d,i)=>{
        const dl=pDate(d['마감일자']);
        const diff=dl?Math.ceil((dl-now)/864e5):null;
        let badge='';
        if(diff===null)badge='<span class="badge-status badge-closed">미정</span>';
        else if(diff<0)badge='<span class="badge-status badge-closed">종료</span>';
        else if(diff<=7)badge=`<span class="badge-status badge-urgent">D-${diff}</span>`;
        else badge=`<span class="badge-status badge-active">D-${diff}</span>`;
    
        const src=sourceKey(d)||d['출처']||d['운영기관']||'-';
        const c=srcColor(src);
        const link=d['공고링크']&&String(d['공고링크']).startsWith('http');

        html+=`<tr data-idx="${d._i}">
          <td>${badge}</td>
          <td><span class="src-tag" style="background:${c}18;color:${c}">${esc(src)}</span><span class="title-text">${esc(d['사업명']||'-')}</span></td>
          <td>${esc(d['운영기관']||'-')}</td>
          <td>${esc(d['분류']||'-')}</td>
          <td>${d['마감일자']||'-'}</td>
          <td class="link-cell">${link?'🔗':'—'}</td>
        </tr>`;
      });
      tbody.innerHTML=html;
      renderPager();
      updateSortUI();
    }
    
    function renderPager(){
      const total=Math.ceil(filtered.length/perPage);
      if(total<=1){$('pager').innerHTML='';return;}
      let h='';
      const max=7;
      let s=Math.max(1,page-Math.floor(max/2));
      let e=Math.min(total,s+max-1);
      if(e-s<max-1)s=Math.max(1,e-max+1);
      if(s>1)h+='<button class="pg" data-p="1">1</button>';
      if(s>2)h+='<span style="color:var(--text-muted);padding:0 3px">…</span>';
      for(let p=s;p<=e;p++)h+=`<button class="pg${p===page?' active':''}" data-p="${p}">${p}</button>`;
      if(e<total-1)h+='<span style="color:var(--text-muted);padding:0 3px">…</span>';
      if(e<total)h+=`<button class="pg" data-p="${total}">${total}</button>`;
      $('pager').innerHTML=h;
    }
    
    function updateSortUI(){
      $$('th.sortable').forEach(th=>{
        const col=th.dataset.sort;
        th.classList.toggle('sorted',sortCol===col);
        th.setAttribute('aria-sort',sortCol===col?(sortDir==='asc'?'ascending':'descending'):'none');
        const ico=th.querySelector('.sort-ico');
        if(ico)ico.textContent=sortCol===col?(sortDir==='asc'?'↑':'↓'):'↕';
      });
    }
    
    // ═══ DETAIL ═══
    function showDetail(idx){
      const d=allData[idx];if(!d)return;
      const src=sourceKey(d)||d['출처']||d['운영기관']||'-';
      const c=srcColor(src);
      const dl=pDate(d['마감일자']);
      const now=new Date();now.setHours(0,0,0,0);
      const diff=dl?Math.ceil((dl-now)/864e5):null;
      const dday=diff===null?'미정':diff<0?'종료':'D-'+diff;

      let html=`<div style="margin-bottom:16px"><span class="src-tag" style="background:${c}18;color:${c};padding:4px 10px;font-size:12px">${esc(src)}</span></div>`;
      const fields=[
        ['사업명',d['사업명']],['D-Day',dday],['운영기관',d['운영기관']],
        ['분류',d['분류']],['지역',d['지역']],
        ['등록일자',d['등록일자']],['시작일자',d['시작일자']],['마감일자',d['마감일자']],
        ['지원대상',d['지원대상']],['상위사업명',d['상위사업명']],
      ];
      fields.forEach(([l,v])=>{
        if(!v)return;
        html+=`<div class="d-field"><div class="d-lbl">${l}</div><div class="d-val">${esc(String(v))}</div></div>`;
      });
      if(d['공고링크']&&String(d['공고링크']).startsWith('http')){
        html+=`<div class="d-field"><div class="d-lbl">공고링크</div><div class="d-val"><a href="${esc(d['공고링크'])}" target="_blank" rel="noopener">${esc(d['공고링크'])}</a></div></div>`;
      }
    
      $('detailBody').innerHTML=html;
      $('detailLink').href=(d['공고링크']&&String(d['공고링크']).startsWith('http'))?d['공고링크']:'#';
      $('detail').classList.add('open');
    }
    
    // ═══ EVENTS ═══
    function bind(){
      // 햄버거 (모바일: 사이드바 열기/닫기)
      const hamburger=$('hamburger');
      const backdrop=$('backdrop');
      if(hamburger){
        hamburger.addEventListener('click',()=>{
          $('sidebar').classList.toggle('open');
          if(backdrop)backdrop.classList.toggle('show');
          hamburger.setAttribute('aria-expanded',$('sidebar').classList.contains('open'));
        });
      }
      if(backdrop){
        backdrop.addEventListener('click',()=>{
          $('sidebar').classList.remove('open');
          backdrop.classList.remove('show');
          if(hamburger)hamburger.setAttribute('aria-expanded','false');
        });
      }

      // 왼쪽 메뉴 (전체 공고 / 진행중 / 마감임박 / 메일링 / 수집 현황)
      function closeSidebarIfOpen(){
        const sb=$('sidebar');
        if(sb&&sb.classList.contains('open')){ sb.classList.remove('open'); if($('backdrop'))$('backdrop').classList.remove('show'); if($('hamburger'))$('hamburger').setAttribute('aria-expanded','false'); }
      }
      $$('.sidebar-nav .nav-item[data-page]').forEach(item=>{
        item.addEventListener('click',()=>{
          $$('.sidebar-nav .nav-item[data-page]').forEach(n=>n.classList.remove('active'));
          item.classList.add('active');
          const pg=item.dataset.page;
          if(pg==='mailing'){
            showPage('mailing');
            loadMailingList();
            closeSidebarIfOpen();
            return;
          }
          if(pg==='sources'){
            showPage('sources');
            closeSidebarIfOpen();
            return;
          }
          showPage('dashboard');
          cardFilter=null;statusFilter='all';regionFilter='all';searchQ='';
          $$('.stat').forEach(c=>c.classList.remove('selected'));
          if($('searchInput'))$('searchInput').value='';
          if(pg==='active'){statusFilter='active';const sel=$('filterStatus');if(sel)sel.value='active';}
          else if(pg==='closing'){cardFilter='urgent';statusFilter='urgent';$$('.stat').forEach(c=>c.classList.remove('selected'));const urgentStat=document.querySelector('.stat[data-filter="urgent"]');if(urgentStat)urgentStat.classList.add('selected');const sel=$('filterStatus');if(sel)sel.value='urgent';}
          applyFilters();
          closeSidebarIfOpen();
        });
        item.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' ')e.target.click(); });
      });

      // stat cards
    
      $$('.stat').forEach(el=>{
        el.addEventListener('click',()=>{
          const f=el.dataset.filter;

          $$('.stat').forEach(c=>c.classList.remove('selected'));
          if(cardFilter===f){cardFilter=null}else{cardFilter=f;el.classList.add('selected')}
          var statusSel=$('filterStatus');
          if(statusSel){
            if(cardFilter==='urgent'){statusSel.value='urgent';statusFilter='urgent';}
            else if(cardFilter==='active'){statusSel.value='active';statusFilter='active';}
            else{statusSel.value='all';statusFilter='all';}
          }
          applyFilters();
          var filterBar=$('filterBar');
          if(filterBar)filterBar.scrollIntoView({behavior:'smooth',block:'start'});
        });
      });
    
      // search
      let debounce;
      $('searchInput').addEventListener('input',e=>{
        clearTimeout(debounce);
        debounce=setTimeout(()=>{searchQ=e.target.value.trim();applyFilters()},200);
      });

      // 조건 필터
      const filterStatus=$('filterStatus'),filterRegion=$('filterRegion'),filterSource=$('filterSource'),filterCategory=$('filterCategory'),filterSort=$('filterSort'),filterReset=$('filterReset');
      if(filterStatus)filterStatus.addEventListener('change',()=>{statusFilter=filterStatus.value;applyFilters();});
      if(filterRegion)filterRegion.addEventListener('change',()=>{regionFilter=filterRegion.value;applyFilters();});
      if(filterSource)filterSource.addEventListener('change',()=>{sourceFilter=filterSource.value;applyFilters();});
      if(filterCategory)filterCategory.addEventListener('change',()=>{categoryFilter=filterCategory.value;applyFilters();});
      if(filterSort)filterSort.addEventListener('change',()=>{
        const v=filterSort.value;
        const idx=v.lastIndexOf('-');
        if(idx>0){ sortCol=v.slice(0,idx); sortDir=v.slice(idx+1); }
        applyFilters();
      });
      if(filterReset)filterReset.addEventListener('click',()=>{
        statusFilter='all';regionFilter='all';sourceFilter='all';categoryFilter='all';
        cardFilter=null;searchQ='';if($('searchInput'))$('searchInput').value='';
        sortCol='마감일자';sortDir='asc';
        $$('.stat').forEach(c=>c.classList.remove('selected'));
        applyFilters();
      });
    
      // filters (status/region/sort dropdowns removed; sidebar + table header sort still apply)
    
      // th sort
    
      $$('th.sortable').forEach(th=>{
        th.addEventListener('click',()=>{
          const col=th.dataset.sort;
          if(sortCol===col)sortDir=sortDir==='asc'?'desc':'asc';
          else{sortCol=col;sortDir='asc'}
          doSort();renderTable();
        });
      });
    
      // filter tag remove
      $('activeFilters').addEventListener('click',e=>{
        if(!e.target.classList.contains('x'))return;
        const t=e.target.dataset.rm;
        if(t==='search'){searchQ='';$('searchInput').value=''}
        if(t==='card'){cardFilter=null;statusFilter='all';$$('.stat').forEach(c=>c.classList.remove('selected'));const sel=$('filterStatus');if(sel)sel.value='all';}
        if(t==='status'){statusFilter='all';if(cardFilter==='active'||cardFilter==='urgent')cardFilter=null;$$('.stat').forEach(c=>c.classList.remove('selected'));const sel=$('filterStatus');if(sel)sel.value='all';}
        if(t==='region')regionFilter='all';
        if(t==='source')sourceFilter='all';
        if(t==='category')categoryFilter='all';
        applyFilters();
      });
    
      // table row click
      $('tableBody').addEventListener('click',e=>{
        const tr=e.target.closest('tr[data-idx]');
        if(tr)showDetail(parseInt(tr.dataset.idx));
      });
      $('tableBody').addEventListener('dblclick',e=>{
        const tr=e.target.closest('tr[data-idx]');
        if(!tr)return;
        const d=allData[parseInt(tr.dataset.idx)];
        if(d&&d['공고링크']&&String(d['공고링크']).startsWith('http'))window.open(d['공고링크'],'_blank');
      });
    
      // pager
      $('pager').addEventListener('click',e=>{
        const btn=e.target.closest('.pg');
        if(btn){page=parseInt(btn.dataset.p);renderTable();document.querySelector('.table-scroll').scrollTop=0}
      });

      // mailing: submit
      const submitBtn=$('mailingSubmit');
      if(submitBtn)submitBtn.addEventListener('click',async ()=>{
        const input=$('mailingEmail');
        const email=(input&&input.value||'').trim();
        const msgEl=$('mailingMsg');
        if(!email){if(msgEl)msgEl.textContent='이메일을 입력하세요.';return;}
        submitBtn.disabled=true;
        if(msgEl)msgEl.textContent='등록 중...';
        try {
          const r=await fetch('/api/mailing/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,subscribe:true})});
          const j=await r.json();
          if(msgEl)msgEl.textContent=j.message||(j.ok?'등록되었습니다.':'등록 실패');
          if(j.ok){if(input)input.value='';loadMailingList();}
        } catch(e){if(msgEl)msgEl.textContent='요청 실패';}
        submitBtn.disabled=false;
      });

      // mailing: toggle 알림 (ModSecurity 회피: form k/v 또는 GET 쿼리 사용)
      document.addEventListener('click',e=>{
        const btn=e.target.closest('.mailing-toggle');
        if(!btn)return;
        const id=btn.dataset.id;
        const cur=btn.dataset.subscribed==='true';
        const v=cur?'0':'1';
        btn.disabled=true;
        const body=new URLSearchParams({k:String(id),v}).toString();
        fetch('/api/mailing/subscribe',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body}).then(r=>r.json()).then(j=>{
          if(j.ok){ loadMailingList(); toast('✅',j.message||(v==='1'?'알림 켜짐':'알림 꺼짐')); }
          else toast('❌',j.message||'변경 실패');
        }).catch(()=>{ toast('❌','요청 실패'); }).finally(()=>{btn.disabled=false;});
      });

      // detail
      $('detailClose').addEventListener('click',()=>$('detail').classList.remove('open'));
      $('detailCopy').addEventListener('click',()=>{
        const href=$('detailLink').href;
        if(href&&href!=='#')navigator.clipboard.writeText(href).then(()=>toast('✅','링크 복사됨'));
      });
    
      // csv
      $('csvBtn').addEventListener('click',exportCSV);
    
      // theme
      $('themeBtn').addEventListener('click',()=>{
        const t=document.documentElement.getAttribute('data-theme')==='light'?'':'light';
        document.documentElement.setAttribute('data-theme',t);
        $('themeBtn').textContent=t==='light'?'🌙':'☀️';
        localStorage.setItem('theme',t);
      });
      // restore theme
      const saved=localStorage.getItem('theme');
      if(saved){document.documentElement.setAttribute('data-theme',saved);$('themeBtn').textContent=saved==='light'?'🌙':'☀️'}
    
      // keyboard
      document.addEventListener('keydown',e=>{
        if((e.ctrlKey||e.metaKey)&&e.key==='f'){e.preventDefault();$('searchInput').focus()}
        if(e.key==='Escape')$('detail').classList.remove('open');
      });
    
      // refresh
      $('refreshBtn').addEventListener('click',()=>{toast('🔄','페이지를 새로 고침하여 최신 데이터를 불러옵니다.');setTimeout(()=>location.reload(),400)});
      // crawl (서버 API 있을 때만 표시됨)
      const crawlBtn=$('crawlBtn');
      if(crawlBtn)crawlBtn.addEventListener('click',async ()=>{
        crawlBtn.disabled=true;
        crawlBtn.textContent='갱신 중...';
        try{
          const r=await fetch('/api/crawl',{method:'POST'});
          const j=await r.json();
          if(j.ok){toast('✅',`갱신 완료 (${j.count}건). 페이지를 다시 불러옵니다.`);setTimeout(()=>location.reload(),1500)}
          else toast('❌',j.message||'갱신 실패');
        }catch(e){toast('❌','갱신 요청 실패');}
        finally{crawlBtn.disabled=false;crawlBtn.textContent='📡 데이터 갱신';}
      });
    }
    
    // ═══ CSV ═══
    function exportCSV(){
      const h=['사업명','운영기관','분류','지역','등록일자','시작일자','마감일자','공고링크','출처'];
      const rows=filtered.map(d=>h.map(k=>'"'+String(d[k]||'').replace(/"/g,'""')+'"').join(','));
      const csv='\uFEFF'+h.join(',')+'\n'+rows.join('\n');
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=`스타트업_지원사업_${new Date().toISOString().slice(0,10)}_${filtered.length}건.csv`;
      a.click();
      toast('📥',`CSV 다운로드 (${filtered.length}건)`);
    }
    
    // ═══ TOAST ═══
    function toast(ico,msg){
      const el=document.createElement('div');
      el.className='toast';el.innerHTML=`<span class="t-ico">${ico}</span>${esc(msg)}`;
      $('toasts').appendChild(el);
      setTimeout(()=>el.remove(),3000);
    }
    
    // ═══ HELPERS ═══
    function pDate(s){
      if(!s)return null;
      const m=String(s).match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
      if(!m)return null;
      return new Date(+m[1],+m[2]-1,+m[3]);
    }
    function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
    
    // ── Boot ──
    document.addEventListener('DOMContentLoaded',init);
    })();
    