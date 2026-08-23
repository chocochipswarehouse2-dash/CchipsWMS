
  // ============ KLASIFIKASI MODULE CONTROLLER ============
  let KLASIFIKASI_ALL_DATA = [];
  let KLASIFIKASI_ACTIVE_CAT = 'ALL';
  let KLASIFIKASI_ACTIVE_PROC = 'ALL';
  let KLASIFIKASI_SEARCH_KW = '';
  let KLASIFIKASI_RENDER_COUNT = 50;
  let isKlasifikasiInitialized = false;

  function initKlasifikasiView() {
    if (!isKlasifikasiInitialized) {
      isKlasifikasiInitialized = true;
      muatDataKlasifikasi(false);
    }
  }

  function klasifikasiItemDef(item) {
    const nama = (item.produk || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();

    if (sku.startsWith('ds100') || sku.startsWith('ds40') || sku.startsWith('sc') || 
        nama.includes('special condition') || nama.includes('clearance') || nama.includes('sale') || cat.includes('sale')) {
      return { code: 'D', name: 'D. SALE & SC', label: 'D - SALE', color: '#ef4444' };
    }
    if (nama.includes('paperbag') || nama.includes('plastic') || nama.includes('plastik') || 
        nama.includes('belt') || nama.includes('acc') || nama.includes('gift') || nama.includes('box') ||
        sku.startsWith('pb-') || sku.startsWith('acc-') || cat.includes('access') || cat.includes('pack')) {
      return { code: 'E', name: 'PACKAGING & ACC', label: 'PACKAGING', color: '#64748b' };
    }
    if (nama.includes('pants') || nama.includes('skirt') || nama.includes('skort') || 
        nama.includes('culotte') || nama.includes('shorts') || nama.includes('bottom') || 
        nama.includes('jeans') || nama.includes('trouser') || cat.includes('bottom') || cat.includes('pant') || cat.includes('skirt')) {
      return { code: 'B', name: 'B. BOTTOM', label: 'B - BOTTOM', color: '#3b82f6' };
    }
    if (nama.includes('dress') || nama.includes('jumpsuit') || nama.includes('one set') || 
        nama.includes('set') || nama.includes('romper') || nama.includes('gown') || 
        cat.includes('dress') || cat.includes('jumpsuit') || cat.includes('set')) {
      return { code: 'A', name: 'A. DRESS & SET', label: 'A - DRESS', color: '#f59e0b' };
    }
    return { code: 'C', name: 'C. TOP & OUTER', label: 'C - TOP', color: '#10b981' };
  }

  function muatDataKlasifikasi(force) {
    if (!force && ALL_PRODUK_DATA && ALL_PRODUK_DATA.length > 0) {
      parseAndRenderKlasifikasi(ALL_PRODUK_DATA);
      return;
    }

    if (typeof window.muatDataProduk === 'function' && force) {
      window.muatDataProduk(true);
      return;
    }

    google.script.run.withSuccessHandler(function(res) {
      if (!res.success) return;
      const raw = res.data || [];
      parseAndRenderKlasifikasi(normalisasiProdukData(raw));
    }).getWmsProdukCompact(TOKEN, Boolean(force));
  }

  window.addEventListener('wms-master-data-loaded', function(e) {
    if (e.detail && e.detail.length > 0) {
      parseAndRenderKlasifikasi(e.detail);
    }
  });

  function parseAndRenderKlasifikasi(rawList) {
    KLASIFIKASI_ALL_DATA = [];
    let stats = { A: { sku: 0, qty: 0 }, B: { sku: 0, qty: 0 }, C: { sku: 0, qty: 0 }, D: { sku: 0, qty: 0 }, E: { sku: 0, qty: 0 } };
    let locMap = {};
    let procList = [];
    let totalPcsGlobal = 0;

    rawList.forEach(function(r) {
      if (!r) return;
      const sku = String(r.sku || '');
      const prod = String(r.produk || sku);
      const sz = String(r.size || '-');
      const locs = Array.isArray(r.locList) ? r.locList : [];

      let parsedLocs = [];
      let totalFisik = 0;

      locs.forEach(function(lItem) {
        let lStr = '', q = 0;
        if (typeof lItem === 'object' && lItem !== null) {
          lStr = String(lItem.lokasi || '').trim().toUpperCase();
          q = Number(lItem.qty) || 0;
        } else {
          const parts = String(lItem || '').split(':');
          lStr = String(parts[0] || '').trim().toUpperCase();
          q = Number(parts[1]) || 0;
        }

        if (lStr && q > 0) {
          parsedLocs.push({ loc: lStr, qty: q });
          totalFisik += q;
          locMap[lStr] = (locMap[lStr] || 0) + q;

          if (lStr.startsWith('CC')) procList.push({ tipe: 'CUCI', loc: lStr, qty: q, prod: prod, sz: sz, sku: sku });
          else if (lStr.startsWith('PMK')) procList.push({ tipe: 'PERMAK', loc: lStr, qty: q, prod: prod, sz: sz, sku: sku });
          else if (lStr.startsWith('DF')) procList.push({ tipe: 'DEFECT', loc: lStr, qty: q, prod: prod, sz: sz, sku: sku });
        }
      });

      const mapFisik = r.komparasi && r.komparasi.MAP ? (r.komparasi.MAP.fisik || 0) : 0;
      const mapDp = r.komparasi && r.komparasi.MAP ? (r.komparasi.MAP.dp || 0) : 0;
      if (totalFisik === 0 && mapFisik > 0) totalFisik = mapFisik;

      const kat = klasifikasiItemDef({ produk: prod, sku: sku });
      stats[kat.code].sku++;
      stats[kat.code].qty += totalFisik;
      totalPcsGlobal += totalFisik;

      KLASIFIKASI_ALL_DATA.push({
        sku: sku,
        produk: prod,
        size: sz,
        kat: kat,
        locs: parsedLocs,
        mapFisik: mapFisik,
        mapDp: mapDp,
        totalFisik: totalFisik
      });
    });

    window.GLOBAL_LOC_MAP = locMap;
    window.GLOBAL_PROC_LIST = procList;

    const totalAllPcs = totalPcsGlobal || 1;
    ['A', 'B', 'C', 'D', 'E'].forEach(function(k) {
      const elQty = document.getElementById('qty-' + k);
      const elSku = document.getElementById('sku-' + k);
      const elPct = document.getElementById('pct-' + k);
      if (elQty) elQty.textContent = stats[k].qty.toLocaleString();
      if (elSku) elSku.textContent = stats[k].sku.toLocaleString();
      if (elPct) elPct.textContent = Math.round((stats[k].qty / totalAllPcs) * 100) + '%';
    });

    updateDonutChartDef(stats, totalAllPcs);
    renderProcessListDef();
    renderLokasiCards();
    renderKlasifikasiTable();
  }

  function updateDonutChartDef(stats, totalPcs) {
    const elTot = document.getElementById('donutTotalCount');
    const elBadge = document.getElementById('totalPcsBadge');
    if (elTot) elTot.textContent = KLASIFIKASI_ALL_DATA.length.toLocaleString();
    if (elBadge) elBadge.textContent = totalPcs.toLocaleString() + ' Pcs';

    const pA = Math.round((stats.A.qty / totalPcs) * 100);
    const pB = Math.round((stats.B.qty / totalPcs) * 100);
    const pC = Math.round((stats.C.qty / totalPcs) * 100);
    const pD = Math.round((stats.D.qty / totalPcs) * 100);

    const lA = document.getElementById('leg-val-A'); if (lA) lA.textContent = pA + '% (' + stats.A.qty.toLocaleString() + ')';
    const lB = document.getElementById('leg-val-B'); if (lB) lB.textContent = pB + '% (' + stats.B.qty.toLocaleString() + ')';
    const lC = document.getElementById('leg-val-C'); if (lC) lC.textContent = pC + '% (' + stats.C.qty.toLocaleString() + ')';
    const lD = document.getElementById('leg-val-D'); if (lD) lD.textContent = pD + '% (' + stats.D.qty.toLocaleString() + ')';

    const dA = document.getElementById('donut-A'); if (dA) { dA.setAttribute('stroke-dasharray', pA + ', 100'); dA.setAttribute('stroke-dashoffset', '0'); }
    const dB = document.getElementById('donut-B'); if (dB) { dB.setAttribute('stroke-dasharray', pB + ', 100'); dB.setAttribute('stroke-dashoffset', '-' + pA); }
    const dC = document.getElementById('donut-C'); if (dC) { dC.setAttribute('stroke-dasharray', pC + ', 100'); dC.setAttribute('stroke-dashoffset', '-' + (pA + pB)); }
    const dD = document.getElementById('donut-D'); if (dD) { dD.setAttribute('stroke-dasharray', pD + ', 100'); dD.setAttribute('stroke-dashoffset', '-' + (pA + pB + pC)); }
  }

  function setProcessTab(tab, btn) {
    KLASIFIKASI_ACTIVE_PROC = tab;
    document.querySelectorAll('.proc-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderProcessListDef();
  }

  function renderProcessListDef() {
    const list = window.GLOBAL_PROC_LIST || [];
    let cCuci = 0, cPermak = 0, cDefect = 0, totalPcs = 0;

    list.forEach(function(item) {
      totalPcs += item.qty;
      if (item.tipe === 'CUCI') cCuci += item.qty;
      if (item.tipe === 'PERMAK') cPermak += item.qty;
      if (item.tipe === 'DEFECT') cDefect += item.qty;
    });

    const elAll = document.getElementById('cnt-all'); if (elAll) elAll.textContent = totalPcs;
    const elCuci = document.getElementById('cnt-cuci'); if (elCuci) elCuci.textContent = cCuci;
    const elPmk = document.getElementById('cnt-permak'); if (elPmk) elPmk.textContent = cPermak;
    const elDf = document.getElementById('cnt-defect'); if (elDf) elDf.textContent = cDefect;
    const elHdr = document.getElementById('procHeaderBadge'); if (elHdr) elHdr.textContent = totalPcs.toLocaleString() + ' Pcs';

    const filtered = list.filter(function(i) {
      if (KLASIFIKASI_ACTIVE_PROC === 'ALL') return true;
      return i.tipe === KLASIFIKASI_ACTIVE_PROC;
    });

    const container = document.getElementById('processListContainer');
    if (!container) return;
    if (filtered.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:15px; color:var(--text-muted); font-size:11px;">Tidak ada antrean dalam kategori ini.</div>';
      return;
    }

    let html = '';
    filtered.slice(0, 30).forEach(function(i) {
      let badgeColor = '#3b82f6';
      let icon = '🧼';
      if (i.tipe === 'PERMAK') { badgeColor = '#f59e0b'; icon = '🪡'; }
      if (i.tipe === 'DEFECT') { badgeColor = '#ef4444'; icon = '⚠️'; }

      html += '<div style="display:flex; align-items:center; justify-content:space-between; padding:6px 8px; background:var(--card-alt); border:1px solid var(--border); border-radius:6px; font-size:11px;">' +
        '<div style="display:flex; align-items:center; gap:6px; flex:1; overflow:hidden;">' +
          '<span style="padding:1px 5px; border-radius:4px; font-size:9.5px; font-weight:700; background:rgba(140,140,140,0.12); color:' + badgeColor + ';">' + icon + ' ' + i.tipe + '</span>' +
          '<div style="font-weight:600; color:var(--text); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">' + i.prod + '</div>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:8px;">' +
          '<span style="font-weight:700; color:var(--primary); font-size:10.5px;">📍 ' + i.loc + '</span>' +
          '<span style="font-weight:800; color:var(--text);">' + i.qty + '</span>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  function renderLokasiCards() {
    const container = document.getElementById('locGridContainer');
    if (!container) return;
    const kw = (document.getElementById('locSearchInput').value || '').trim().toUpperCase();
    const map = window.GLOBAL_LOC_MAP || {};
    const keys = Object.keys(map).sort();

    const filtered = keys.filter(k => !kw || k.includes(kw));
    const elTot = document.getElementById('locTotalBadge');
    if (elTot) elTot.textContent = filtered.length + ' Lokasi';

    if (filtered.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); font-size:11px; padding:8px;">Tidak ada lokasi cocok.</div>';
      return;
    }

    let html = '';
    filtered.forEach(function(loc) {
      html += '<div style="background:var(--card-alt); border:1px solid var(--border); border-radius:6px; padding:6px 8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="filterKlasifikasiByRak(\'' + loc + '\')">' +
        '<span style="font-size:11px; font-weight:700; color:var(--text);">📍 ' + loc + '</span>' +
        '<span style="font-size:10.5px; font-weight:800; color:var(--primary); background:var(--primary-light); padding:1px 5px; border-radius:4px;">' + map[loc].toLocaleString() + '</span>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  function filterKlasifikasiByRak(loc) {
    const sInput = document.getElementById('klasifikasiSearchInput');
    if (sInput) sInput.value = loc;
    KLASIFIKASI_SEARCH_KW = loc.toLowerCase();
    KLASIFIKASI_RENDER_COUNT = 50;
    renderKlasifikasiTable();
  }

  function toggleCategoryFilter(cat) {
    if (KLASIFIKASI_ACTIVE_CAT === cat) {
      KLASIFIKASI_ACTIVE_CAT = 'ALL';
      document.querySelectorAll('#klasifikasiKpiGrid .kpi-card').forEach(c => c.style.borderColor = 'var(--border)');
      document.getElementById('tableFilterStatus').textContent = 'Menampilkan seluruh data produk';
    } else {
      KLASIFIKASI_ACTIVE_CAT = cat;
      document.querySelectorAll('#klasifikasiKpiGrid .kpi-card').forEach(c => c.style.borderColor = 'var(--border)');
      const activeCard = document.getElementById('card-' + cat);
      if (activeCard) activeCard.style.borderColor = 'var(--primary)';
      document.getElementById('tableFilterStatus').textContent = 'Filter Aktif: Kategori ' + cat + ' (Klik ulang kartu untuk reset)';
    }
    KLASIFIKASI_RENDER_COUNT = 50;
    renderKlasifikasiTable();
  }

  function handleKlasifikasiSearch() {
    KLASIFIKASI_SEARCH_KW = (document.getElementById('klasifikasiSearchInput').value || '').trim().toLowerCase();
    KLASIFIKASI_RENDER_COUNT = 50;
    renderKlasifikasiTable();
  }

  function renderKlasifikasiTable() {
    const tbody = document.getElementById('detailTableBody');
    if (!tbody) return;
    const kw = KLASIFIKASI_SEARCH_KW;
    const cat = KLASIFIKASI_ACTIVE_CAT;

    const filtered = KLASIFIKASI_ALL_DATA.filter(function(item) {
      if (cat !== 'ALL' && item.kat.code !== cat) return false;
      if (kw) {
        const locStr = item.locs.map(l => l.loc).join(' ').toLowerCase();
        const comb = (item.produk + ' ' + item.sku + ' ' + locStr).toLowerCase();
        if (!comb.includes(kw)) return false;
      }
      return true;
    });

    const cntBadge = document.getElementById('tableCountBadge');
    if (cntBadge) cntBadge.textContent = 'Menampilkan ' + Math.min(KLASIFIKASI_RENDER_COUNT, filtered.length) + ' dari ' + filtered.length + ' Produk';

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">Tidak ada data produk yang cocok.</td></tr>';
      document.getElementById('loadMoreSection').style.display = 'none';
      return;
    }

    let rows = '';
    filtered.slice(0, KLASIFIKASI_RENDER_COUNT).forEach(function(item) {
      let locChips = '';
      if (item.locs.length > 0) {
        locChips = item.locs.map(l => '<span class="loc-tag">📍 ' + l.loc + ' (' + l.qty + ')</span>').join('');
      } else {
        locChips = '<span class="num-dim">-</span>';
      }

      rows += '<tr>' +
        '<td><span class="badge-size" style="color:' + item.kat.color + ';">' + item.kat.label + '</span></td>' +
        '<td style="font-weight:600; color:var(--text);">' + item.produk + '</td>' +
        '<td style="text-align:center;"><span class="badge-size">' + item.size + '</span></td>' +
        '<td><span class="badge-sku">' + item.sku + '</span></td>' +
        '<td>' + locChips + '</td>' +
        '<td style="text-align:center; font-weight:700; color:var(--primary);">' + (item.mapFisik || '<span class="num-dim">·</span>') + '</td>' +
        '<td style="text-align:center; color:var(--text-muted);">' + (item.mapDp || '<span class="num-dim">·</span>') + '</td>' +
        '<td style="text-align:center; font-weight:800; color:var(--text);">' + (item.totalFisik || '<span class="num-dim">·</span>') + '</td>' +
      '</tr>';
    });

    tbody.innerHTML = rows;
    const lm = document.getElementById('loadMoreSection');
    if (lm) lm.style.display = (filtered.length > KLASIFIKASI_RENDER_COUNT) ? 'block' : 'none';
  }

  function loadMoreKlasifikasi() {
    KLASIFIKASI_RENDER_COUNT += 50;
    renderKlasifikasiTable();
  }
