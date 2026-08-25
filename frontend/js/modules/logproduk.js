// ========================================================
// WMS MINI - MODUL LOG PRODUK
// ========================================================

(function(window) {
  'use strict';

  let LOG_PRODUK_DATA = [];
  let logProdukCurrentPage = 1;
  const logProdukPageSize = 50;
  let logProdukTotalPages = 1;
  let isLogProdukInitialized = false;

  function initLogProdukView() {
    if (!isLogProdukInitialized) {
      isLogProdukInitialized = true;
      muatDataLogProduk(false);
    }
  }

  function muatDataLogProduk(force) {
    const tbody = document.getElementById('logProdukTableBody');
    if (tbody && (!LOG_PRODUK_DATA || LOG_PRODUK_DATA.length === 0)) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted);">⏳ MEMUAT DATA LOG PRODUK...</td></tr>';
    }

    const currentToken = window.TOKEN || localStorage.getItem('wms_token') || sessionStorage.getItem('wms_token') || '';

    if (window.google && window.google.script && window.google.script.run) {
      google.script.run.withSuccessHandler(function (res) {
        if (!res || !res.success) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--danger); padding:30px;">' + (res ? res.message : 'Gagal memuat log produk') + '</td></tr>';
          return;
        }
        LOG_PRODUK_DATA = res.data || [];
        logProdukCurrentPage = 1;
        renderLogProdukTable();
      }).withFailureHandler(function (err) {
        if (tbody && (!LOG_PRODUK_DATA || LOG_PRODUK_DATA.length === 0)) {
          tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--danger); padding:30px;">Error: ' + (err ? err.message : 'Koneksi gagal') + '</td></tr>';
        }
      }).getWmsLogProdukData(currentToken);
    } else if (typeof window.apiCall === 'function') {
      window.apiCall('getWmsLogProdukData', { token: currentToken })
        .then(res => {
          if (!res || !res.success) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--danger); padding:30px;">' + (res ? res.message : 'Gagal memuat log produk') + '</td></tr>';
            return;
          }
          LOG_PRODUK_DATA = res.data || [];
          logProdukCurrentPage = 1;
          renderLogProdukTable();
        })
        .catch(err => {
          if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--danger); padding:30px;">Error: ' + (err ? err.message : 'Koneksi gagal') + '</td></tr>';
        });
    }
  }

  function handleLogProdukSearch() {
    logProdukCurrentPage = 1;
    renderLogProdukTable();
  }

  function handleLogProdukFilterChange() {
    logProdukCurrentPage = 1;
    renderLogProdukTable();
  }

  function renderLogProdukTable() {
    const tbody = document.getElementById('logProdukTableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('logProdukSearchInput');
    const keyword = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const kataKunci = keyword.split(/\s+/).filter(Boolean);
    const filterTypeEl = document.getElementById('filterLogType');
    const filterType = (filterTypeEl ? filterTypeEl.value : '').trim();
    const filterAreaEl = document.getElementById('filterLogArea');
    const filterArea = (filterAreaEl ? filterAreaEl.value : '').trim();

    const filtered = LOG_PRODUK_DATA.filter(function (d) {
      if (!d) return false;
      if (filterType && String(d.type || '').toUpperCase() !== filterType.toUpperCase()) return false;
      if (filterArea && String(d.area || '').toUpperCase().indexOf(filterArea.toUpperCase()) === -1) return false;

      const teksGabungan = (String(d.sku || '') + ' ' + String(d.namaProduk || '') + ' ' + String(d.invoice || '') + ' ' + String(d.operator || '') + ' ' + String(d.keterangan || '')).toLowerCase();
      return kataKunci.length === 0 || kataKunci.every(function (kw) { return teksGabungan.indexOf(kw) > -1; });
    });

    const sumEl = document.getElementById('logProdukSummaryCount');
    if (sumEl) sumEl.textContent = `Total: ${filtered.length} log ditemukan`;

    const paginationFooter = document.getElementById('logProdukPaginationFooter');

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--text-muted); padding:30px; font-style:italic;">TIDAK ADA DATA LOG YANG SESUAI FILTER.</td></tr>';
      if (paginationFooter) paginationFooter.style.display = 'none';
      return;
    }

    logProdukTotalPages = Math.ceil(filtered.length / logProdukPageSize);
    if (logProdukCurrentPage > logProdukTotalPages) logProdukCurrentPage = logProdukTotalPages;
    if (logProdukCurrentPage < 1) logProdukCurrentPage = 1;

    const startIndex = (logProdukCurrentPage - 1) * logProdukPageSize;
    const paginatedData = filtered.slice(startIndex, startIndex + logProdukPageSize);

    tbody.innerHTML = paginatedData.map(function (d) {
      let isTypeIn = String(d.type || '').toUpperCase() === 'IN';
      let badgeStyle = isTypeIn ? 'background:var(--success-light); color:var(--success);' : 'background:var(--danger-light); color:var(--danger);';

      return '<tr>' +
        '<td style="font-size:11.5px; color:var(--text-muted); padding-left:12px;">' + (d.tanggalStr || '-') + '</td>' +
        '<td style="text-align:center;"><span class="badge-size" style="' + badgeStyle + '">' + (d.type || '-') + '</span></td>' +
        '<td style="font-weight:600; padding-left:10px;">' + (d.invoice || '-') + '</td>' +
        '<td style="padding-left:10px;"><span class="badge-sku">' + (d.sku || '-') + '</span></td>' +
        '<td style="font-weight:600; color:var(--text); padding-left:12px;">' + (d.namaProduk || '-') + '</td>' +
        '<td style="text-align:center;"><span class="badge-size">' + (d.size || '-') + '</span></td>' +
        '<td style="text-align:center; font-size:11px;">' + (d.area || '-') + '</td>' +
        '<td style="text-align:center; font-weight:700; color:var(--primary);">' + (d.lokasi || '-') + '</td>' +
        '<td style="font-size:11.5px; padding-left:10px;">' + (d.operator || '-') + '</td>' +
        '<td style="font-size:11.5px; color:var(--text-muted); padding-left:10px;">' + (d.keterangan || '-') + '</td>' +
      '</tr>';
    }).join('');

    const startRecord = startIndex + 1;
    const endRecord = Math.min(startIndex + logProdukPageSize, filtered.length);
    const infoEl = document.getElementById('logProdukPaginationInfo');
    if (infoEl) infoEl.textContent = `SHOWING ${startRecord}-${endRecord} OF ${filtered.length} RECORDS`;
    
    const indicatorEl = document.getElementById('logPageIndicator');
    if (indicatorEl) indicatorEl.textContent = `${logProdukCurrentPage} / ${logProdukTotalPages}`;
    
    const prevBtn = document.getElementById('btnLogPrev');
    if (prevBtn) prevBtn.disabled = (logProdukCurrentPage <= 1);
    
    const nextBtn = document.getElementById('btnLogNext');
    if (nextBtn) nextBtn.disabled = (logProdukCurrentPage >= logProdukTotalPages);
    
    if (paginationFooter) paginationFooter.style.display = 'flex';
  }

  function changeLogProdukPage(direction) {
    const newPage = logProdukCurrentPage + direction;
    if (newPage >= 1 && newPage <= logProdukTotalPages) {
      logProdukCurrentPage = newPage;
      renderLogProdukTable();
    }
  }

  // --- Expose to window scope ---
  window.initLogProdukView = initLogProdukView;
  window.muatDataLogProduk = muatDataLogProduk;
  window.handleLogProdukSearch = handleLogProdukSearch;
  window.handleLogProdukFilterChange = handleLogProdukFilterChange;
  window.renderLogProdukTable = renderLogProdukTable;
  window.changeLogProdukPage = changeLogProdukPage;

})(window);
