
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

    google.script.run.withSuccessHandler(function (res) {
      if (!res.success) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--danger); padding:30px;">' + (res.message || 'Gagal memuat log produk') + '</td></tr>';
        return;
      }
      LOG_PRODUK_DATA = res.data || [];
      logProdukCurrentPage = 1;
      renderLogProdukTable();
    }).withFailureHandler(function (err) {
      if (tbody && (!LOG_PRODUK_DATA || LOG_PRODUK_DATA.length === 0)) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--danger); padding:30px;">Error: ' + err.message + '</td></tr>';
      }
    }).getWmsLogProdukData(TOKEN);
  }
  window.muatDataLogProduk = muatDataLogProduk;

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

    const keyword = (document.getElementById('logProdukSearchInput').value || '').trim().toLowerCase();
    const kataKunci = keyword.split(/\s+/).filter(Boolean);
    const filterType = (document.getElementById('filterLogType').value || '').trim();
    const filterArea = (document.getElementById('filterLogArea').value || '').trim();

    const filtered = LOG_PRODUK_DATA.filter(function (d) {
      if (!d) return false;
      if (filterType && String(d.type || '').toUpperCase() !== filterType.toUpperCase()) return false;
      if (filterArea && String(d.area || '').toUpperCase().indexOf(filterArea.toUpperCase()) === -1) return false;

      const teksGabungan = (String(d.sku || '') + ' ' + String(d.namaProduk || '') + ' ' + String(d.invoice || '') + ' ' + String(d.operator || '') + ' ' + String(d.keterangan || '')).toLowerCase();
      return kataKunci.length === 0 || kataKunci.every(function (kw) { return teksGabungan.indexOf(kw) > -1; });
    });

    const sumEl = document.getElementById('logProdukSummaryCount');
    if (sumEl) sumEl.textContent = `Total: ${filtered.length} log ditemukan`;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--text-muted); padding:30px; font-style:italic;">TIDAK ADA DATA LOG YANG SESUAI FILTER.</td></tr>';
      document.getElementById('logProdukPaginationFooter').style.display = 'none';
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
    document.getElementById('logProdukPaginationInfo').textContent = `SHOWING ${startRecord}-${endRecord} OF ${filtered.length} RECORDS`;
    document.getElementById('logPageIndicator').textContent = `${logProdukCurrentPage} / ${logProdukTotalPages}`;
    
    document.getElementById('btnLogPrev').disabled = (logProdukCurrentPage <= 1);
    document.getElementById('btnLogNext').disabled = (logProdukCurrentPage >= logProdukTotalPages);
    document.getElementById('logProdukPaginationFooter').style.display = 'flex';
  }

  function changeLogProdukPage(direction) {
    const newPage = logProdukCurrentPage + direction;
    if (newPage >= 1 && newPage <= logProdukTotalPages) {
      logProdukCurrentPage = newPage;
      renderLogProdukTable();
    }
  }


// --- Global Window Binding for logproduk ---
if (typeof initLogProdukView === 'function') window.initLogProdukView = initLogProdukView;
if (typeof muatDataLogProduk === 'function') window.muatDataLogProduk = muatDataLogProduk;
if (typeof handleLogProdukSearch === 'function') window.handleLogProdukSearch = handleLogProdukSearch;
if (typeof handleLogProdukFilterChange === 'function') window.handleLogProdukFilterChange = handleLogProdukFilterChange;
if (typeof renderLogProdukTable === 'function') window.renderLogProdukTable = renderLogProdukTable;
if (typeof changeLogProdukPage === 'function') window.changeLogProdukPage = changeLogProdukPage;
