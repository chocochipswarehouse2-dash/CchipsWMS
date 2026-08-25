// ========================================================
// WMS MINI - MODUL LOG MUTASI
// ========================================================

(function(window) {
  'use strict';

  let LOG_MUTASI_DATA = [];
  let logMutasiCurrentPage = 1;
  const logMutasiPageSize = 50;
  let logMutasiTotalPages = 1;
  let isLogMutasiInitialized = false;

  function initLogMutasiView() {
    if (!isLogMutasiInitialized) {
      isLogMutasiInitialized = true;
      muatDataLogMutasi(false);
    }
  }

  function muatDataLogMutasi(force) {
    const tbody = document.getElementById('logMutasiTableBody');
    if (tbody && (!LOG_MUTASI_DATA || LOG_MUTASI_DATA.length === 0)) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted);">⏳ MEMUAT DATA LOG MUTASI...</td></tr>';
    }

    const currentToken = window.TOKEN || localStorage.getItem('wms_token') || sessionStorage.getItem('wms_token') || '';

    if (window.google && window.google.script && window.google.script.run) {
      google.script.run.withSuccessHandler(function (res) {
        if (!res || !res.success) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--danger); padding:30px;">' + (res ? res.message : 'Gagal memuat log mutasi') + '</td></tr>';
          return;
        }
        LOG_MUTASI_DATA = res.data || [];
        logMutasiCurrentPage = 1;
        renderLogMutasiTable();
      }).withFailureHandler(function (err) {
        if (tbody && (!LOG_MUTASI_DATA || LOG_MUTASI_DATA.length === 0)) {
          tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--danger); padding:30px;">Error: ' + (err ? err.message : 'Koneksi gagal') + '</td></tr>';
        }
      }).getWmsLogMutasiData(currentToken);
    } else if (typeof window.apiCall === 'function') {
      window.apiCall('getWmsLogMutasiData', { token: currentToken })
        .then(res => {
          if (!res || !res.success) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--danger); padding:30px;">' + (res ? res.message : 'Gagal memuat log mutasi') + '</td></tr>';
            return;
          }
          LOG_MUTASI_DATA = res.data || [];
          logMutasiCurrentPage = 1;
          renderLogMutasiTable();
        })
        .catch(err => {
          if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--danger); padding:30px;">Error: ' + (err ? err.message : 'Koneksi gagal') + '</td></tr>';
        });
    }
  }

  function handleLogMutasiSearch() {
    logMutasiCurrentPage = 1;
    renderLogMutasiTable();
  }

  function handleLogMutasiFilterChange() {
    logMutasiCurrentPage = 1;
    renderLogMutasiTable();
  }

  function renderLogMutasiTable() {
    const tbody = document.getElementById('logMutasiTableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('logMutasiSearchInput');
    const keyword = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const kataKunci = keyword.split(/\s+/).filter(Boolean);
    const filterTypeEl = document.getElementById('filterMutasiType');
    const filterType = (filterTypeEl ? filterTypeEl.value : '').trim();

    const filtered = LOG_MUTASI_DATA.filter(function (d) {
      if (!d) return false;
      if (filterType && String(d.tipe || d.type || '').toUpperCase().indexOf(filterType.toUpperCase()) === -1) return false;

      const teksGabungan = (String(d.sku || '') + ' ' + String(d.namaProduk || '') + ' ' + String(d.asal || '') + ' ' + String(d.tujuan || '') + ' ' + String(d.operator || '') + ' ' + String(d.keterangan || '')).toLowerCase();
      return kataKunci.length === 0 || kataKunci.every(function (kw) { return teksGabungan.indexOf(kw) > -1; });
    });

    const sumEl = document.getElementById('logMutasiSummaryCount');
    if (sumEl) sumEl.textContent = `Total: ${filtered.length} mutasi ditemukan`;

    const paginationFooter = document.getElementById('logMutasiPaginationFooter');

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--text-muted); padding:30px; font-style:italic;">TIDAK ADA DATA LOG MUTASI YANG SESUAI FILTER.</td></tr>';
      if (paginationFooter) paginationFooter.style.display = 'none';
      return;
    }

    logMutasiTotalPages = Math.ceil(filtered.length / logMutasiPageSize);
    if (logMutasiCurrentPage > logMutasiTotalPages) logMutasiCurrentPage = logMutasiTotalPages;
    if (logMutasiCurrentPage < 1) logMutasiCurrentPage = 1;

    const startIndex = (logMutasiCurrentPage - 1) * logMutasiPageSize;
    const paginatedData = filtered.slice(startIndex, startIndex + logMutasiPageSize);

    tbody.innerHTML = paginatedData.map(function (d) {
      return '<tr>' +
        '<td style="font-size:11.5px; color:var(--text-muted); padding-left:12px;">' + (d.tanggalStr || '-') + '</td>' +
        '<td style="text-align:center;"><span class="badge-size" style="background:rgba(59,130,246,0.12); color:#3b82f6;">' + (d.tipe || d.type || 'MUTASI') + '</span></td>' +
        '<td style="padding-left:10px;"><span class="badge-sku">' + (d.sku || '-') + '</span></td>' +
        '<td style="font-weight:600; color:var(--text); padding-left:12px;">' + (d.namaProduk || '-') + '</td>' +
        '<td style="text-align:center;"><span class="badge-size">' + (d.size || '-') + '</span></td>' +
        '<td style="text-align:center; font-weight:600; color:var(--text-dim);">' + (d.asal || '-') + '</td>' +
        '<td style="text-align:center; font-weight:700; color:var(--primary);">' + (d.tujuan || '-') + '</td>' +
        '<td style="text-align:center; font-weight:800; color:var(--text);">' + (d.qty || 0) + '</td>' +
        '<td style="font-size:11.5px; padding-left:10px;">' + (d.operator || '-') + '</td>' +
        '<td style="font-size:11.5px; color:var(--text-muted); padding-left:10px;">' + (d.keterangan || '-') + '</td>' +
      '</tr>';
    }).join('');

    const startRecord = startIndex + 1;
    const endRecord = Math.min(startIndex + logMutasiPageSize, filtered.length);
    const infoEl = document.getElementById('logMutasiPaginationInfo');
    if (infoEl) infoEl.textContent = `SHOWING ${startRecord}-${endRecord} OF ${filtered.length} RECORDS`;
    
    const indicatorEl = document.getElementById('logMutasiPageIndicator');
    if (indicatorEl) indicatorEl.textContent = `${logMutasiCurrentPage} / ${logMutasiTotalPages}`;
    
    const prevBtn = document.getElementById('btnMutasiPrev');
    if (prevBtn) prevBtn.disabled = (logMutasiCurrentPage <= 1);
    
    const nextBtn = document.getElementById('btnMutasiNext');
    if (nextBtn) nextBtn.disabled = (logMutasiCurrentPage >= logMutasiTotalPages);
    
    if (paginationFooter) paginationFooter.style.display = 'flex';
  }

  function changeLogMutasiPage(direction) {
    const newPage = logMutasiCurrentPage + direction;
    if (newPage >= 1 && newPage <= logMutasiTotalPages) {
      logMutasiCurrentPage = newPage;
      renderLogMutasiTable();
    }
  }

  // --- Expose to window scope ---
  window.initLogMutasiView = initLogMutasiView;
  window.muatDataLogMutasi = muatDataLogMutasi;
  window.handleLogMutasiSearch = handleLogMutasiSearch;
  window.handleLogMutasiFilterChange = handleLogMutasiFilterChange;
  window.renderLogMutasiTable = renderLogMutasiTable;
  window.changeLogMutasiPage = changeLogMutasiPage;

})(window);
