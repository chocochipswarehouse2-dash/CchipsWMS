
    var TOKEN = window.TOKEN || "";
    var EXEC_URL = window.EXEC_URL || "";
    var AKSES = window.AKSES || "All";
    var INITIAL_PAGE = window.INITIAL_PAGE || "produk";

    const ICON_THEME_SUN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 4px;"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    const ICON_THEME_MOON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 4px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

    // ============ THEME MANAGER ============
    function initTheme() {
      const savedTheme = localStorage.getItem('wms_theme') || 'light';
      document.body.setAttribute('data-theme', savedTheme);
      updateThemeButtonText(savedTheme);
    }

    function updateThemeButtonText(theme) {
      const btn = document.getElementById('btnSidebarTheme');
      if (!btn) return;
      btn.innerHTML = (theme === 'light') ? (ICON_THEME_MOON + ' GELAP') : (ICON_THEME_SUN + ' TERANG');
    }

    function toggleTheme() {
      const currentTheme = document.body.getAttribute('data-theme') || 'light';
      const newTheme = (currentTheme === 'dark') ? 'light' : 'dark';
      document.body.setAttribute('data-theme', newTheme);
      localStorage.setItem('wms_theme', newTheme);
      updateThemeButtonText(newTheme);
    }
    initTheme();

    // ============ SIDEBAR TOGGLE (DESKTOP & MOBILE) ============
    function toggleSidebar() {
      if (window.innerWidth > 992) {
        document.body.classList.toggle('sidebar-collapsed');
        const isCollapsed = document.body.classList.contains('sidebar-collapsed');
        localStorage.setItem('wms_sidebar_collapsed', isCollapsed ? '1' : '0');
      } else {
        document.body.classList.toggle('sidebar-open');
      }
    }

    function initSidebarState() {
      if (window.innerWidth > 992) {
        const savedCollapsed = localStorage.getItem('wms_sidebar_collapsed');
        if (savedCollapsed === '1') {
          document.body.classList.add('sidebar-collapsed');
        }
      }
    }
    initSidebarState();

    // ============ VIEW MODE MANAGER (KARTU SELULER vs TABEL DESKTOP) ============
    let currentViewMode = localStorage.getItem('wms_inventory_view_mode');
    if (!currentViewMode) {
      currentViewMode = (window.innerWidth <= 768) ? 'card' : 'table';
    }

    function updateViewButtonText() {
      const btn = document.getElementById('btnToggleView');
      const iconEl = document.getElementById('btnToggleViewIcon');
      const textEl = document.getElementById('btnToggleViewText');
      if (!btn) return;
      if (currentViewMode === 'card') {
        if (iconEl) iconEl.textContent = '💻';
        if (textEl) textEl.textContent = 'MODE TABEL';
        btn.title = 'Beralih ke Tampilan Tabel Spreadsheet Desktop';
      } else {
        if (iconEl) iconEl.textContent = '📱';
        if (textEl) textEl.textContent = 'MODE KARTU';
        btn.title = 'Beralih ke Tampilan Kartu Seluler Ringkas';
      }
    }
    updateViewButtonText();

    function toggleViewMode() {
      currentViewMode = (currentViewMode === 'card') ? 'table' : 'card';
      localStorage.setItem('wms_inventory_view_mode', currentViewMode);
      updateViewButtonText();
      renderProdukList(DISPLAY_DATA);
    }

    // ============ MULTISELECT FILTER AREA (KOLOM DATA TAMPILAN) ============
    let activeAreaFilters = ['ALL', 'GUDANG', 'STORE', 'ONLINE', 'OFFLINE'];

    function initFilterAreaState() {
      try {
        const saved = localStorage.getItem('wms_filter_areas_v2');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            activeAreaFilters = parsed;
          }
        }
      } catch(e) {}
      syncFilterAreaCheckboxes();
      updateFilterAreaButtonText();
    }

    function toggleFilterAreaDropdown(e) {
      if (e) e.stopPropagation();
      const dd = document.getElementById('filterAreaDropdown');
      const btn = document.getElementById('btnFilterArea');
      if (!dd || !btn) return;
      const isShown = dd.style.display === 'block';
      dd.style.display = isShown ? 'none' : 'block';
      if (!isShown) btn.classList.add('active');
      else btn.classList.remove('active');
    }

    document.addEventListener('click', function(e) {
      const wrap = document.getElementById('filterAreaWrap');
      const dd = document.getElementById('filterAreaDropdown');
      const btn = document.getElementById('btnFilterArea');
      if (wrap && dd && !wrap.contains(e.target)) {
        dd.style.display = 'none';
        if (btn) btn.classList.remove('active');
      }
    });

    function handleAreaCheckboxChange(code) {
      const chkAll = document.getElementById('chkAreaAll');

      if (code === 'ALL') {
        if (chkAll && chkAll.checked) {
          activeAreaFilters = ['ALL', 'GUDANG', 'STORE', 'ONLINE', 'OFFLINE'];
        } else {
          activeAreaFilters = ['GUDANG'];
        }
      } else {
        let current = activeAreaFilters.filter(x => x !== 'ALL');
        let chkId = 'chkArea' + code.charAt(0) + code.slice(1).toLowerCase();
        let chk = document.getElementById(chkId);
        if (chk && chk.checked) {
          if (!current.includes(code)) current.push(code);
        } else {
          current = current.filter(x => x !== code);
        }

        if (current.length === 0) {
          current = ['ALL', 'GUDANG', 'STORE', 'ONLINE', 'OFFLINE'];
        } else if (current.includes('GUDANG') && current.includes('STORE') && current.includes('ONLINE') && current.includes('OFFLINE')) {
          current = ['ALL', 'GUDANG', 'STORE', 'ONLINE', 'OFFLINE'];
        }

        activeAreaFilters = current;
      }

      try { localStorage.setItem('wms_filter_areas_v2', JSON.stringify(activeAreaFilters)); } catch(e) {}
      syncFilterAreaCheckboxes();
      updateFilterAreaButtonText();
      renderProdukList(DISPLAY_DATA);
    }

    function syncFilterAreaCheckboxes() {
      const isAll = activeAreaFilters.includes('ALL') || (
        activeAreaFilters.includes('GUDANG') &&
        activeAreaFilters.includes('STORE') &&
        activeAreaFilters.includes('ONLINE') &&
        activeAreaFilters.includes('OFFLINE')
      );

      const chkAll = document.getElementById('chkAreaAll');
      const chkGudang = document.getElementById('chkAreaGudang');
      const chkStore = document.getElementById('chkAreaStore');
      const chkOnline = document.getElementById('chkAreaOnline');
      const chkOffline = document.getElementById('chkAreaOffline');

      if (chkAll) chkAll.checked = isAll;
      if (chkGudang) chkGudang.checked = isAll || activeAreaFilters.includes('GUDANG');
      if (chkStore) chkStore.checked = isAll || activeAreaFilters.includes('STORE');
      if (chkOnline) chkOnline.checked = isAll || activeAreaFilters.includes('ONLINE');
      if (chkOffline) chkOffline.checked = isAll || activeAreaFilters.includes('OFFLINE');
    }

    function updateFilterAreaButtonText() {
      const labelEl = document.getElementById('filterAreaLabel');
      if (!labelEl) return;

      const isAll = activeAreaFilters.includes('ALL') || (
        activeAreaFilters.includes('GUDANG') &&
        activeAreaFilters.includes('STORE') &&
        activeAreaFilters.includes('ONLINE') &&
        activeAreaFilters.includes('OFFLINE')
      );

      if (isAll) {
        labelEl.textContent = 'SEMUA AREA';
        return;
      }

      const names = [];
      if (activeAreaFilters.includes('GUDANG')) names.push('GUDANG');
      if (activeAreaFilters.includes('STORE')) names.push('STORE');
      if (activeAreaFilters.includes('ONLINE')) names.push('ONLINE');
      if (activeAreaFilters.includes('OFFLINE')) names.push('OFFLINE');

      if (names.length === 1) {
        labelEl.textContent = names[0];
      } else {
        labelEl.textContent = names.join(', ') + ' (' + names.length + ')';
      }
    }
    initFilterAreaState();

    // ============ NAVIGATION MENU LIST & SEAMLESS SPA ROUTER ============
    const MENU_WMS_LIST = [
      { value: "produk", label: "Inventory", icon: "📦", akses: "Produk" },
      { value: "klasifikasi", label: "Monitoring & Klasifikasi", icon: "📊", akses: "All" },
      { value: "penerimaanproduksi", label: "Penerimaan Produksi", icon: "📥", akses: "All" },
      { value: "fulfillment", label: "Fulfillment Refill", icon: "🚚", akses: "Fulfillment" },
      { value: "peminjaman", label: "Peminjaman", icon: "📝", akses: "Peminjaman" },
      { value: "logproduk", label: "Log Produk", icon: "📜", akses: "All" },
      { value: "logmutasi", label: "Log Mutasi", icon: "🔄", akses: "All" },
      { value: "updatedatabase", label: "Update Database", icon: "🗄️", akses: "All" },
      { value: "stockopname", label: "Stock Opname", icon: "🔍", akses: "All" },
      { value: "setting", label: "Pengaturan & User", icon: "⚙️", akses: "All" }
    ];

    let currentActivePage = 'produk';

    function bisaAksesMenuWms(kode) {
      if (typeof AKSES === "undefined" || !AKSES) return true;
      const roles = String(AKSES).split(',').map(r => r.trim());
      return roles.includes("All") || roles.includes(kode);
    }

    function renderSidebarNavItems(halamanAktif) {
      const container = document.getElementById('navMenuItems');
      if (!container) return;
      let html = '';
      MENU_WMS_LIST.forEach(function (m) {
        if (!bisaAksesMenuWms(m.akses)) return;
        const isActive = (m.value === halamanAktif);
        html += '<a class="nav-item ' + (isActive ? 'active' : '') + '" data-page="' + m.value + '" onclick="navigasiKe(\'' + m.value + '\')">' +
          '<span class="nav-icon">' + m.icon + '</span>' +
          '<span class="nav-text">' + m.label + '</span>' +
        '</a>';
      });
      container.innerHTML = html;
    }

    function navigasiKe(pageCode, skipHistory) {
      if (!pageCode) pageCode = 'produk';
      currentActivePage = pageCode;

      // 1. Sembunyikan seluruh tampilan view SPA
      document.querySelectorAll('.spa-view').forEach(function(el) {
        el.style.display = 'none';
        el.classList.remove('active');
      });

      // 2. Munculkan view target secara instan (0ms)
      const targetView = document.getElementById('view-' + pageCode);
      if (targetView) {
        targetView.style.display = 'block';
        targetView.classList.add('active');
      }

      // 3. Perbarui menu aktif di sidebar
      document.querySelectorAll('#navMenuItems .nav-item').forEach(function(item) {
        if (item.getAttribute('data-page') === pageCode) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      // 4. Sesuaikan topbar contextual tools
      const topbarSearchWrap = document.getElementById('topbarSearchWrap');
      const topbarPageTitle = document.getElementById('topbarPageTitle');
      const topbarPageIcon = document.getElementById('topbarPageIcon');
      const topbarPageText = document.getElementById('topbarPageText');
      const filterAreaWrap = document.getElementById('filterAreaWrap');
      const btnToggleView = document.getElementById('btnToggleView');
      const btnUpdateStok = document.getElementById('btnUpdateStok');
      const btnExportCsv = document.getElementById('btnExportCsv');

      if (pageCode === 'produk') {
        if (topbarSearchWrap) topbarSearchWrap.style.display = 'block';
        if (topbarPageTitle) topbarPageTitle.style.display = 'none';
        if (filterAreaWrap) filterAreaWrap.style.display = '';
        if (btnToggleView) btnToggleView.style.display = 'inline-flex';
        if (btnUpdateStok) btnUpdateStok.style.display = 'inline-flex';
        if (btnExportCsv) btnExportCsv.style.display = 'inline-flex';
      } else {
        if (topbarSearchWrap) topbarSearchWrap.style.display = 'none';
        if (filterAreaWrap) filterAreaWrap.style.display = 'none';
        if (btnToggleView) btnToggleView.style.display = 'none';
        if (btnUpdateStok) btnUpdateStok.style.display = 'none';
        if (btnExportCsv) btnExportCsv.style.display = 'none';

        if (topbarPageTitle) {
          const menuItem = MENU_WMS_LIST.find(function(m) { return m.value === pageCode; });
          if (menuItem) {
            if (topbarPageIcon) topbarPageIcon.textContent = menuItem.icon;
            if (topbarPageText) topbarPageText.textContent = menuItem.label;
          }
          topbarPageTitle.style.display = 'inline-flex';
        }
      }

      // 5. Update browser history URL tanpa reload
      if (!skipHistory) {
        try {
          const newUrl = window.location.pathname + "?page=" + encodeURIComponent(pageCode); window.history.pushState({ page: pageCode }, "", newUrl);
        } catch(e) {}
      }

      // 6. Tutup drawer sidebar jika berada di layar seluler
      if (window.innerWidth <= 992) {
        document.body.classList.remove('sidebar-open');
      }

      // 7. Inisialisasi lazy loader untuk modul yang dipilih
      if (pageCode === 'klasifikasi' && typeof initKlasifikasiView === 'function') initKlasifikasiView();
      else if (pageCode === 'penerimaanproduksi' && typeof initPenerimaanView === 'function') initPenerimaanView();
      else if (pageCode === 'fulfillment' && typeof initFulfillmentView === 'function') initFulfillmentView();
      else if (pageCode === 'peminjaman' && typeof initPeminjamanView === 'function') initPeminjamanView();
      else if (pageCode === 'logproduk' && typeof initLogProdukView === 'function') initLogProdukView();
      else if (pageCode === 'logmutasi' && typeof initLogMutasiView === 'function') initLogMutasiView();
      else if (pageCode === 'updatedatabase' && typeof initUpdateDatabaseView === 'function') initUpdateDatabaseView();
      else if (pageCode === 'stockopname' && typeof initStockOpnameView === 'function') initStockOpnameView();
      else if (pageCode === 'setting' && typeof initSettingView === 'function') initSettingView();
    }

    // Tangani navigasi tombol Back/Forward browser
    window.addEventListener('popstate', function(e) {
      if (e.state && e.state.page) {
        navigasiKe(e.state.page, true);
      }
    });

    // Inisialisasi menu sidebar dan halaman awal
    renderSidebarNavItems(INITIAL_PAGE);
    if (INITIAL_PAGE && INITIAL_PAGE !== 'produk') {
      setTimeout(function() { navigasiKe(INITIAL_PAGE, true); }, 10);
    }

    function logoutSession() {
      google.script.run.withSuccessHandler(function() {
        try {
          sessionStorage.clear();
          localStorage.removeItem('wms_token');
          localStorage.removeItem('wms_role');
          localStorage.removeItem('wms_username');
        } catch(e) {}
        if (typeof logoutSession === "function") { logoutSession(); } else if (typeof setAppVisible === "function") { setAppVisible(false); }
      }).logoutWmsSession(TOKEN);
    }

    // ============ DEFINISI KOLOM SESUAI SPESIFIKASI ============
    const KOMPARASI_5 = ["MAP", "LIVE", "STUDIO", "PERMAK", "DEFECT"];
    const OFFLINE_COLS = ["WH", "QC", "GA", "LOG"];
    const STORE_COLS = ["LMP", "MKG", "BTS", "CPJ", "CWS", "LWS", "DPM", "PHB", "PMS", "NSJ", "PIM", "SPM", "GAIA", "GST", "LVL"];
    const ONLINE_COLS = ["WEB", "SHP", "TPD", "TTK", "LZD", "WOO"];

    var ALL_PRODUK_DATA = window.ALL_PRODUK_DATA || [];
    let DISPLAY_DATA = [];
    let isFullDataLoaded = false;
    let currentRenderLimit = 50;
    const RENDER_STEP = 50;
    let searchDebounceTimer = null;

    function handleSearchInput(e) {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(function() {
        terapkanFilterLokal();
      }, 150);
    }

    function normalisasiProdukData(data) {
      if (!Array.isArray(data)) return [];
      return data.map(function (row) {
        if (!row || typeof row !== 'object') return null;

        const f = row.f || {};
        const d = row.d || {};
        const b = row.b || {};

        const mapFisik = Number(f['MAP'] || f['Gudang Utama'] || f['Warehouse'] || 0);
        const mapDp    = Number(d['MAP'] || d['Gudang Utama'] || d['Marketplace'] || 0);

        const liveFisik = Number(f['LIVE'] || f['Barang Live'] || f['Sample Live'] || 0);
        const liveDp    = Number(d['LIVE'] || d['Barang Live'] || d['Sample Live'] || 0);

        const studioFisik = Number(f['STUDIO'] || f['Sample Studio'] || 0);
        const studioDp    = Number(d['STUDIO'] || d['Sample Studio'] || 0);

        const permakFisik = Number(f['PERMAK'] || f['Permak / Cuci'] || f['Permak'] || 0);
        const permakDp    = Number(d['PERMAK'] || d['Permak / Cuci'] || d['Permak'] || 0);

        const defectFisik = Number(f['DEFECT'] || f['Barang Cacat'] || f['Cacat'] || 0);
        const defectDp    = Number(d['DEFECT'] || d['Barang Cacat'] || d['Diskon Defect'] || d['Cacat'] || 0);

        let singleVals = {};
        [...OFFLINE_COLS, ...STORE_COLS, ...ONLINE_COLS].forEach(function(code) {
          singleVals[code] = Number(b[code] || d[code] || f[code] || 0);
        });

        return {
          sku: String(row.k || row.sku || ''),
          produk: String(row.p || row.produk || row.k || ''),
          size: String(row.s || row.size || '-'),
          locList: Array.isArray(row.l) ? row.l : (Array.isArray(row.locList) ? row.locList : []),
          komparasi: {
            MAP: { fisik: mapFisik, dp: mapDp },
            LIVE: { fisik: liveFisik, dp: liveDp },
            STUDIO: { fisik: studioFisik, dp: studioDp },
            PERMAK: { fisik: permakFisik, dp: permakDp },
            DEFECT: { fisik: defectFisik, dp: defectDp }
          },
          singles: singleVals
        };
      }).filter(Boolean);
    }

    function sortSize(a, b) {
      const URUTAN_SIZE = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
      const ia = URUTAN_SIZE.indexOf(String(a).toUpperCase());
      const ib = URUTAN_SIZE.indexOf(String(b).toUpperCase());
      if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }

    function urutkanProdukData(list) {
      list.sort(function (a, b) {
        const c1 = a.produk.localeCompare(b.produk);
        if (c1 !== 0) return c1;
        const c2 = sortSize(a.size, b.size);
        if (c2 !== 0) return c2;
        return a.sku.localeCompare(b.sku);
      });
    }

    // ============ REKALKULASI KPI STAT CARDS ============
    function updateKpiCards(dataList) {
      const totalSku = dataList.length;
      let totalMap = 0;
      let totalBlokF = 0;
      let totalPerbaikan = 0;

      dataList.forEach(function(item) {
        if (!item || !item.komparasi) return;
        const k = item.komparasi;
        if (k.MAP) totalMap += (k.MAP.fisik || 0);
        if (k.LIVE) totalBlokF += (k.LIVE.fisik || 0);
        if (k.STUDIO) totalBlokF += (k.STUDIO.fisik || 0);
        if (k.PERMAK) totalPerbaikan += (k.PERMAK.fisik || 0);
        if (k.DEFECT) totalPerbaikan += (k.DEFECT.fisik || 0);
      });

      const elSku = document.getElementById('kpiTotalSku');
      const elMap = document.getElementById('kpiStokMap');
      const elBlokF = document.getElementById('kpiStokBlokF');
      const elPerbaikan = document.getElementById('kpiStokPerbaikan');

      if (elSku) elSku.textContent = Number(totalSku).toLocaleString('id-ID');
      if (elMap) elMap.textContent = Number(totalMap).toLocaleString('id-ID') + ' pcs';
      if (elBlokF) elBlokF.textContent = Number(totalBlokF).toLocaleString('id-ID') + ' pcs';
      if (elPerbaikan) elPerbaikan.textContent = Number(totalPerbaikan).toLocaleString('id-ID') + ' pcs';
    }

    // ============ LOCAL STORAGE FAST CACHE ============
    const CACHE_KEY_INVENTORY = 'wms_cache_inventory_v35';
    let isRenderedFromLocalCache = false;

    function syncGlobalMasterStore(dataList) {
      window.WMS_MASTER_DATA = dataList;
      window.ALL_PRODUK_DATA = dataList;
      window.WMS_SKU_MAP = {};
      const locSet = new Set(["MAP", "LIVE", "STUDIO", "PERMAK", "DEFECT", "WH", "QC", "GA", "LOG"]);

      dataList.forEach(function(item) {
        if (!item || !item.sku) return;
        window.WMS_SKU_MAP[item.sku.toUpperCase()] = item;
        
        if (Array.isArray(item.locList)) {
          item.locList.forEach(function(l) {
            if (typeof l === 'object' && l !== null && l.lokasi) {
              locSet.add(String(l.lokasi).trim().toUpperCase());
            } else if (typeof l === 'string') {
              const parts = l.split(':');
              if (parts[0]) locSet.add(parts[0].trim().toUpperCase());
            }
          });
        }
      });

      window.WMS_LOKASI_LIST = Array.from(locSet).sort();

      try {
        window.dispatchEvent(new CustomEvent('wms-master-data-loaded', { detail: dataList }));
      } catch(e) {}
    }

    function initFastClientCache() {
      try {
        const raw = localStorage.getItem(CACHE_KEY_INVENTORY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (Array.isArray(cached) && cached.length > 0) {
            ALL_PRODUK_DATA = normalisasiProdukData(cached);
            urutkanProdukData(ALL_PRODUK_DATA);
            DISPLAY_DATA = ALL_PRODUK_DATA;
            isFullDataLoaded = true;
            isRenderedFromLocalCache = true;
            syncGlobalMasterStore(ALL_PRODUK_DATA);
            updateKpiCards(DISPLAY_DATA);
            renderProdukList(DISPLAY_DATA);
            const infoEl = document.getElementById('tableInfo');
            if (infoEl) infoEl.innerHTML = '⚡ <b>' + ALL_PRODUK_DATA.length + ' Produk</b> dimuat dari cache lokal';
          }
        }
      } catch (e) {}
    }

    function muatDataProduk(force, callback) {
      if (!force) initFastClientCache();
      else {
        try { localStorage.removeItem(CACHE_KEY_INVENTORY); } catch (e) {}
      }

      const refreshBtn = document.getElementById('btnUpdateStok');
      if (force && refreshBtn && window.setButtonLoading) {
        window.setButtonLoading(refreshBtn, true, 'REFRESHING...');
      }
      if (force && window.showWmsToast) {
        window.showWmsToast('Menyinkronkan data inventori terbaru dari server...', 'info');
      }

      google.script.run.withSuccessHandler(function (res) {
        if (force && refreshBtn && window.setButtonLoading) {
          window.setButtonLoading(refreshBtn, false);
        }
        if (!res.success) {
          if (!isRenderedFromLocalCache) {
            document.getElementById('tableContainer').innerHTML = '<div style="text-align:center; padding:30px; color:var(--danger);">' + (res.message || 'Gagal memuat data') + '</div>';
          }
          if (window.showWmsToast) window.showWmsToast(res.message || 'Gagal memuat data inventori', 'error');
          if (typeof callback === 'function') callback(false);
          return;
        }

        const rawData = res.data || [];
        ALL_PRODUK_DATA = normalisasiProdukData(rawData);
        urutkanProdukData(ALL_PRODUK_DATA);
        DISPLAY_DATA = ALL_PRODUK_DATA;
        isFullDataLoaded = true;
        syncGlobalMasterStore(ALL_PRODUK_DATA);

        try { localStorage.setItem(CACHE_KEY_INVENTORY, JSON.stringify(rawData)); } catch (e) {}

        terapkanFilterLokal();
        if (force && window.showWmsToast) {
          window.showWmsToast(`Data stok inventori berhasil diperbarui (${rawData.length} SKU)!`, 'success');
        }
        if (typeof callback === 'function') callback(true);
      }).withFailureHandler(function (err) {
        if (force && refreshBtn && window.setButtonLoading) {
          window.setButtonLoading(refreshBtn, false);
        }
        if (!isRenderedFromLocalCache) {
          document.getElementById('tableContainer').innerHTML = '<div style="text-align:center; padding:30px; color:var(--danger);">Error: ' + err.message + '</div>';
        }
        if (window.showWmsToast) window.showWmsToast('Terjadi kesalahan: ' + err.message, 'error');
        if (typeof callback === 'function') callback(false);
      }).getWmsProdukCompact(TOKEN, Boolean(force));
    }
    window.muatDataProduk = muatDataProduk;
    muatDataProduk(false);

    // ============ SUPABASE REALTIME AUTO-SYNC & BACKGROUND TIMER ============
    let supabaseRealtimeClient = null;
    let realtimeDebounceTimer = null;

    function initSupabaseRealtimeSync() {
      const supaUrl = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : "https://filgijcfhgqlirzhvwho.supabase.co";
      const supaKey = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : "sb_publishable_L4FEkugwRKqcwFzLXfpZag_aByUy5mD";

      if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        try {
          supabaseRealtimeClient = window.supabase.createClient(supaUrl, supaKey);

          supabaseRealtimeClient
            .channel('wms-unified-realtime-feed')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stok_lokasi' }, handleRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'master_produk' }, handleRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'log_produk' }, handleRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'log_mutasi' }, handleRealtimeChange)
            .subscribe(function(status) {
              const badge = document.getElementById('realtimeStatusBadge');
              const text = document.getElementById('realtimeStatusText');
              if (status === 'SUBSCRIBED') {
                if (badge) badge.style.display = 'inline-flex';
                if (text) text.textContent = '⚡ REALTIME ON';
              }
            });
        } catch (e) {
          console.warn('Realtime Supabase init skipped:', e);
        }
      }

      // Background Periodic Fallback: refresh setiap 5 menit jika tidak ada event realtime
      setInterval(function () {
        muatDataProduk(true);
      }, 5 * 60 * 1000);
    }

    function handleRealtimeChange(payload) {
      if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
      realtimeDebounceTimer = setTimeout(function () {
        if (window.showWmsToast) {
          window.showWmsToast('⚡ Realtime: Perubahan data inventori terdeteksi, menyinkronkan...', 'info');
        }
        muatDataProduk(true, function(success) {
          // Juga trigger reload modul aktif jika sedang dibuka
          const page = typeof currentActivePage !== 'undefined' ? currentActivePage : '';
          if (page === 'fulfillment' && typeof window.muatDataFulfillment === 'function') window.muatDataFulfillment(true);
          else if (page === 'logmutasi' && typeof window.muatDataLogMutasi === 'function') window.muatDataLogMutasi(true);
          else if (page === 'logproduk' && typeof window.muatDataLogProduk === 'function') window.muatDataLogProduk(true);
          else if (page === 'penerimaanproduksi' && typeof window.muatDataPenerimaan === 'function') window.muatDataPenerimaan(true);
          else if (page === 'klasifikasi' && typeof window.muatDataKlasifikasi === 'function') window.muatDataKlasifikasi(true);
        });
      }, 1500);
    }

    // Jalankan inisialisasi Realtime
    setTimeout(initSupabaseRealtimeSync, 1000);

    function terapkanFilterLokal() {
      if (!isFullDataLoaded) return;
      const kw = ((document.getElementById("searchGlobal") ? document.getElementById("searchGlobal").value : "") || '').trim().toLowerCase();
      const kataKunci = kw.split(/\s+/).filter(Boolean);

      const filtered = ALL_PRODUK_DATA.filter(function (d) {
        if (!d) return false;
        const teksGabungan = (d.produk + ' ' + d.sku).toLowerCase();
        return kataKunci.length === 0 || kataKunci.every(function (kwItem) { return teksGabungan.indexOf(kwItem) > -1; });
      });

      DISPLAY_DATA = filtered;
      currentRenderLimit = 50;
      updateKpiCards(DISPLAY_DATA);
      renderProdukList(DISPLAY_DATA);

      const infoEl = document.getElementById('tableInfo');
      if (infoEl) {
        infoEl.innerHTML = 'Menampilkan <b>' + Math.min(currentRenderLimit, filtered.length) + '</b> dari <b>' + filtered.length + '</b> produk';
      }
    }

    // ============ RENDER DATA (CARD VIEW & TABLE VIEW) ============
    function renderProdukList(filtered) {
      const container = document.getElementById("tableContainer"); if (!container) return;
      if (!filtered || filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:50px 20px; color:var(--text-muted); font-style:italic;">TIDAK ADA PRODUK YANG SESUAI FILTER</div>';
        return;
      }

      const itemsToRender = filtered.slice(0, currentRenderLimit);

      if (currentViewMode === 'card') {
        renderCardView(container, itemsToRender, filtered);
      } else {
        renderTableView(container, itemsToRender, filtered);
      }
    }

    // --- 1. RENDER KARTU SELULER (MOBILE CARD VIEW) ---
    function renderCardView(container, itemsToRender, allFiltered) {
      const isAll = activeAreaFilters.includes('ALL');
      const showGudang = isAll || activeAreaFilters.includes('GUDANG');
      const showOffline = isAll || activeAreaFilters.includes('OFFLINE');
      const showStore = isAll || activeAreaFilters.includes('STORE');
      const showOnline = isAll || activeAreaFilters.includes('ONLINE');

      let cardsHtml = '<div class="card-list">';

      itemsToRender.forEach(function (item) {
        if (!item) return;

        let arrayLokasi = [];
        if (Array.isArray(item.locList) && item.locList.length > 0) {
          arrayLokasi = item.locList.map(function(d) {
            if (typeof d === 'object' && d !== null) return d.lokasi + (d.qty ? (':' + d.qty) : '');
            return String(d || '');
          }).filter(Boolean);
        }

        let infoLokasiHtml = '';
        if (arrayLokasi.length > 0) {
          infoLokasiHtml = arrayLokasi.map(function(loc) {
            return '<span class="loc-tag">📍 ' + loc + '</span>';
          }).join('');
        }

        let displaySize = item.size || '-';
        if (displaySize.toLowerCase() === 'default') displaySize = 'ALL';

        let totalStoreStock = 0;
        let countActiveStores = 0;
        [...OFFLINE_COLS, ...STORE_COLS, ...ONLINE_COLS].forEach(function(c) {
          const val = item.singles[c] || 0;
          totalStoreStock += val;
          if (val > 0) countActiveStores++;
        });

        // 5 Komparasi Grid
        let compGridHtml = '';
        if (showGudang) {
          compGridHtml = '<div class="card-section-label">STOK GUDANG UTAMA (FISIK vs DP)</div>' +
            '<div class="comp-grid">';
          KOMPARASI_5.forEach(function(k) {
            const kData = item.komparasi[k] || { fisik: 0, dp: 0 };
            const fisikStr = kData.fisik > 0 ? ('<span class="badge-fisik">' + kData.fisik + '</span>') : '<span class="num-dim">·</span>';
            const dpStr = kData.dp > 0 ? ('<span class="badge-dp">' + kData.dp + '</span>') : '<span class="num-dim">·</span>';

            compGridHtml += '<div class="comp-box">' +
              '<div class="comp-box-title">' + k + '</div>' +
              '<div class="comp-box-vals">' +
                '<div class="comp-line"><span class="comp-lbl">FISIK</span>' + fisikStr + '</div>' +
                '<div class="comp-line"><span class="comp-lbl">DP</span>' + dpStr + '</div>' +
              '</div>' +
            '</div>';
          });
          compGridHtml += '</div>';
        }

        function renderChipsGroup(colList) {
          return colList.map(function(code) {
            const val = item.singles[code] || 0;
            const hasStock = val > 0;
            return '<div class="stock-chip ' + (hasStock ? 'stock-chip-active' : 'stock-chip-zero') + '">' +
              '<span class="chip-code">' + code + '</span>' +
              '<span class="chip-val">' + (hasStock ? val : '·') + '</span>' +
            '</div>';
          }).join('');
        }

        let branchDetailsHtml = '';
        if (showOffline || showStore || showOnline) {
          branchDetailsHtml = '<details class="card-details">' +
            '<summary class="card-summary">' +
              '<span>🏬 CABANG & ONLINE</span>' +
              '<span class="summary-badge">' + totalStoreStock + ' PCS ' + (countActiveStores > 0 ? '(' + countActiveStores + ' LOKASI)' : '') + ' ▾</span>' +
            '</summary>' +
            '<div class="details-body">' +
              (showOffline ? ('<div class="sub-group-title">OFFLINE DEPT</div><div class="chips-grid">' + renderChipsGroup(OFFLINE_COLS) + '</div>') : '') +
              (showStore ? ('<div class="sub-group-title">STORE CABANG</div><div class="chips-grid">' + renderChipsGroup(STORE_COLS) + '</div>') : '') +
              (showOnline ? ('<div class="sub-group-title">MARKETPLACE ONLINE</div><div class="chips-grid">' + renderChipsGroup(ONLINE_COLS) + '</div>') : '') +
            '</div>' +
          '</details>';
        }

        cardsHtml += '<div class="prod-card">' +
          '<div class="card-header-row">' +
            '<div class="card-product-name">' + item.produk + '</div>' +
            '<div class="badge-size">' + displaySize + '</div>' +
          '</div>' +
          '<div class="card-meta-row">' +
            '<span class="badge-sku">' + item.sku + '</span>' +
            infoLokasiHtml +
          '</div>' +
          compGridHtml +
          branchDetailsHtml +
        '</div>';
      });

      cardsHtml += '</div>';

      if (allFiltered.length > itemsToRender.length) {
        cardsHtml += '<div style="text-align:center; padding:16px; border-top:1px solid var(--border-subtle);">' +
          '<button id="btnLoadMore" class="btn btn-secondary" style="font-size:12px; padding:8px 24px; width:100%;">' +
            '⬇️ TAMPILKAN LEBIH BANYAK (SISA ' + (allFiltered.length - itemsToRender.length) + ' PRODUK)' +
          '</button>' +
        '</div>';
      }

      container.innerHTML = cardsHtml;

      const btnMore = document.getElementById('btnLoadMore');
      if (btnMore) {
        btnMore.addEventListener('click', function() {
          currentRenderLimit += RENDER_STEP;
          renderProdukList(allFiltered);
        });
      }
    }

    // --- 2. RENDER UNIFIED TABLE SINGLE CONTAINER DENGAN FILTER KOLOM & ALIGNMENT PRESISI ---
    function renderTableView(container, itemsToRender, allFiltered) {
      const isAll = activeAreaFilters.includes('ALL');
      const showGudang = isAll || activeAreaFilters.includes('GUDANG');
      const showOffline = isAll || activeAreaFilters.includes('OFFLINE');
      const showStore = isAll || activeAreaFilters.includes('STORE');
      const showOnline = isAll || activeAreaFilters.includes('ONLINE');

      // 1. Dynamic Colgroup
      let colgroupHtml = '<colgroup>' +
        '<col style="width:260px; min-width:260px; max-width:260px;">' + // PRODUK
        '<col style="width:55px; min-width:55px; max-width:55px;">' +    // SIZE
        '<col style="width:135px; min-width:135px; max-width:135px;">';  // CODE

      if (showGudang) {
        colgroupHtml += KOMPARASI_5.map(() => '<col style="width:44px; min-width:44px; max-width:44px;"><col style="width:44px; min-width:44px; max-width:44px;">').join('');
      }
      if (showOffline) {
        colgroupHtml += OFFLINE_COLS.map(() => '<col style="width:40px; min-width:40px; max-width:40px;">').join('');
      }
      if (showStore) {
        colgroupHtml += STORE_COLS.map(() => '<col style="width:40px; min-width:40px; max-width:40px;">').join('');
      }
      if (showOnline) {
        colgroupHtml += ONLINE_COLS.map(() => '<col style="width:40px; min-width:40px; max-width:40px;">').join('');
      }
      colgroupHtml += '</colgroup>';

      // 2. Dynamic Width
      let totalColsWidth = 260 + 55 + 135;
      if (showGudang) totalColsWidth += (5 * 88);
      if (showOffline) totalColsWidth += (OFFLINE_COLS.length * 40);
      if (showStore) totalColsWidth += (STORE_COLS.length * 40);
      if (showOnline) totalColsWidth += (ONLINE_COLS.length * 40);

      // 3. Dynamic Thead (Presisi Vertical Center pada PRODUK, SIZE, CODE)
      let theadTopRow = '<tr>' +
        '<th rowspan="2" style="width:260px; text-align:left; padding:0 14px; vertical-align:middle !important;">PRODUK</th>' +
        '<th rowspan="2" style="width:55px; text-align:center; padding:0 4px; vertical-align:middle !important;">SIZE</th>' +
        '<th rowspan="2" style="width:135px; text-align:left; padding:0 10px; vertical-align:middle !important;">CODE</th>';

      if (showGudang) {
        theadTopRow += KOMPARASI_5.map(k => '<th colspan="2" style="color:var(--text); font-weight:700; height:32px; vertical-align:middle !important;">' + k + '</th>').join('');
      }
      if (showOffline) {
        theadTopRow += '<th colspan="' + OFFLINE_COLS.length + '" style="color:var(--text); font-weight:700; height:32px; vertical-align:middle !important;">OFFLINE</th>';
      }
      if (showStore) {
        theadTopRow += '<th colspan="' + STORE_COLS.length + '" style="color:var(--text); font-weight:700; height:32px; vertical-align:middle !important;">STORE</th>';
      }
      if (showOnline) {
        theadTopRow += '<th colspan="' + ONLINE_COLS.length + '" style="color:var(--text); font-weight:700; height:32px; vertical-align:middle !important;">ONLINE</th>';
      }
      theadTopRow += '</tr>';

      let theadSubRow = '<tr>';
      if (showGudang) {
        theadSubRow += KOMPARASI_5.map(() => '<th style="color:var(--primary); font-size:10px; padding:2px 2px; height:28px; vertical-align:middle !important;">FISIK</th><th style="color:var(--text-muted); font-size:10px; padding:2px 2px; height:28px; vertical-align:middle !important;">DP</th>').join('');
      }
      if (showOffline) {
        theadSubRow += OFFLINE_COLS.map(c => '<th style="color:var(--text-muted); font-size:10px; padding:2px 2px; height:28px; vertical-align:middle !important;">' + c + '</th>').join('');
      }
      if (showStore) {
        theadSubRow += STORE_COLS.map(c => '<th style="color:var(--text-muted); font-size:10px; padding:2px 2px; height:28px; vertical-align:middle !important;">' + c + '</th>').join('');
      }
      if (showOnline) {
        theadSubRow += ONLINE_COLS.map(c => '<th style="color:var(--text-muted); font-size:10px; padding:2px 2px; height:28px; vertical-align:middle !important;">' + c + '</th>').join('');
      }
      theadSubRow += '</tr>';

      // 4. Dynamic Tbody
      let rowsHtml = '';
      itemsToRender.forEach(function (item) {
        if (!item) return;

        let arrayLokasi = [];
        if (Array.isArray(item.locList) && item.locList.length > 0) {
          arrayLokasi = item.locList.map(function(d) {
            if (typeof d === 'object' && d !== null) return d.lokasi + (d.qty ? (':' + d.qty) : '');
            return String(d || '');
          }).filter(Boolean);
        }
        
        let infoLokasiHtml = '';
        if (arrayLokasi.length > 0) {
          infoLokasiHtml = '<div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:3px;">' +
            arrayLokasi.map(function(loc) {
              return '<span class="loc-tag">📍 ' + loc + '</span>';
            }).join('') +
          '</div>';
        }

        function getKompCellHtml(kat, isFisik) {
          const kData = item.komparasi[kat] || { fisik: 0, dp: 0 };
          const val = isFisik ? kData.fisik : kData.dp;
          let cellHtml = '<td style="text-align:center;">';
          if (val === 0) {
            cellHtml += '<span class="num-dim">·</span>';
          } else {
            let cls = isFisik ? 'badge-fisik' : 'badge-dp';
            cellHtml += '<span class="' + cls + '">' + val + '</span>';
          }
          cellHtml += '</td>';
          return cellHtml;
        }

        function getSingleCellHtml(code) {
          const val = item.singles[code] || 0;
          let cellHtml = '<td style="text-align:center;">';
          if (val === 0) {
            cellHtml += '<span class="num-dim">·</span>';
          } else {
            cellHtml += '<span class="badge-single">' + val + '</span>';
          }
          cellHtml += '</td>';
          return cellHtml;
        }

        let displaySize = item.size || '-';
        if (displaySize.toLowerCase() === 'default') displaySize = 'ALL';

        let cellsHtml = '<td style="font-weight:600; color:var(--text); font-size:12px; line-height:1.35; white-space:normal; overflow-wrap:break-word; padding:9px 14px;">' + item.produk + infoLokasiHtml + '</td>' +
          '<td style="text-align:center; padding:9px 4px;"><span class="badge-size">' + displaySize + '</span></td>' +
          '<td style="padding:9px 10px;"><span class="badge-sku">' + item.sku + '</span></td>';

        if (showGudang) {
          cellsHtml += KOMPARASI_5.map(k => getKompCellHtml(k, true) + getKompCellHtml(k, false)).join('');
        }
        if (showOffline) {
          cellsHtml += OFFLINE_COLS.map(c => getSingleCellHtml(c)).join('');
        }
        if (showStore) {
          cellsHtml += STORE_COLS.map(c => getSingleCellHtml(c)).join('');
        }
        if (showOnline) {
          cellsHtml += ONLINE_COLS.map(c => getSingleCellHtml(c)).join('');
        }

        rowsHtml += '<tr>' + cellsHtml + '</tr>';
      });

      let html = '<div class="table-scroll-wrap">' +
          '<table class="unified-table table-multilevel-header" style="min-width:' + totalColsWidth + 'px;">' +
            colgroupHtml +
            '<thead>' + theadTopRow + theadSubRow + '</thead>' +
            '<tbody id="produkTableBody">' + rowsHtml + '</tbody>' +
          '</table>' +
        '</div>';

      if (allFiltered.length > itemsToRender.length) {
        html += '<div style="text-align:center; padding:16px; border-top:1px solid var(--border-subtle);">' +
          '<button id="btnLoadMore" class="btn btn-secondary" style="font-size:12px; padding:8px 24px;">' +
            '⬇️ TAMPILKAN LEBIH BANYAK (SISA ' + (allFiltered.length - itemsToRender.length) + ' PRODUK)' +
          '</button>' +
        '</div>';
      }

      container.innerHTML = html;

      const btnMoreD = document.getElementById('btnLoadMore');
      if (btnMoreD) {
        btnMoreD.addEventListener('click', function() {
          currentRenderLimit += RENDER_STEP;
          renderProdukList(allFiltered);
        });
      }
    }



    function exportDataCsv() {
      if (!DISPLAY_DATA || DISPLAY_DATA.length === 0) {
        alert('Tidak ada data produk yang bisa diekspor.');
        return;
      }

      const isAll = activeAreaFilters.includes('ALL');
      const showGudang = isAll || activeAreaFilters.includes('GUDANG');
      const showOffline = isAll || activeAreaFilters.includes('OFFLINE');
      const showStore = isAll || activeAreaFilters.includes('STORE');
      const showOnline = isAll || activeAreaFilters.includes('ONLINE');

      let csvContent = "data:text/csv;charset=utf-8,";
      let headerRow = ["PRODUK", "SIZE", "CODE", "LOKASI_RAK"];
      if (showGudang) {
        KOMPARASI_5.forEach(k => {
          headerRow.push(k + "_FISIK", k + "_DP");
        });
      }
      if (showOffline) {
        OFFLINE_COLS.forEach(c => headerRow.push(c));
      }
      if (showStore) {
        STORE_COLS.forEach(c => headerRow.push(c));
      }
      if (showOnline) {
        ONLINE_COLS.forEach(c => headerRow.push(c));
      }

      csvContent += headerRow.map(h => '"' + h + '"').join(",") + "\r\n";

      DISPLAY_DATA.forEach(function(item) {
        let locStr = "";
        if (Array.isArray(item.locList) && item.locList.length > 0) {
          locStr = item.locList.map(d => typeof d === 'object' && d !== null ? (d.lokasi + (d.qty ? ':' + d.qty : '')) : String(d || '')).join("; ");
        }
        let row = [
          item.produk || "",
          item.size || "-",
          item.sku || "",
          locStr
        ];

        if (showGudang) {
          KOMPARASI_5.forEach(k => {
            const kData = (item.komparasi && item.komparasi[k]) ? item.komparasi[k] : { fisik: 0, dp: 0 };
            row.push(kData.fisik, kData.dp);
          });
        }
        if (showOffline) {
          OFFLINE_COLS.forEach(c => row.push(item.singles[c] || 0));
        }
        if (showStore) {
          STORE_COLS.forEach(c => row.push(item.singles[c] || 0));
        }
        if (showOnline) {
          ONLINE_COLS.forEach(c => row.push(item.singles[c] || 0));
        }

        csvContent += row.map(r => '"' + String(r).replace(/"/g, '""') + '"').join(",") + "\r\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "WMS_INVENTORY_" + new Date().toISOString().slice(0,10) + ".csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showWmsToast("File CSV Inventory berhasil diunduh!", "success");
    }

    // ========================================================
    // GLOBAL ACTION HELPERS: TOAST NOTIF & BUTTON LOADING
    // ========================================================
    window.showWmsToast = function(msg, type, durationMs) {
      if (!type) type = 'success';
      if (!durationMs) durationMs = 4000;

      const container = document.getElementById('wmsGlobalToastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = 'wms-toast ' + type;

      let icon = '✅';
      if (type === 'error' || type === 'danger') icon = '❌';
      else if (type === 'warning') icon = '⚠️';
      else if (type === 'info') icon = 'ℹ️';

      toast.innerHTML = '<div class="toast-icon" style="font-size:16px;">' + icon + '</div>' +
        '<div class="toast-content" style="flex:1; line-height:1.35;">' + msg + '</div>' +
        '<button class="toast-close" onclick="this.parentElement.remove()">✕</button>' +
        '<div class="toast-progress" style="animation-duration:' + durationMs + 'ms;"></div>';

      container.appendChild(toast);

      setTimeout(function() {
        toast.classList.add('hide');
        setTimeout(function() { toast.remove(); }, 300);
      }, durationMs);
    };

    window.setButtonLoading = function(btn, isLoading, loadingText) {
      if (!btn) return;
      if (isLoading) {
        btn.disabled = true;
        if (!btn.hasAttribute('data-original-html')) {
          btn.setAttribute('data-original-html', btn.innerHTML);
        }
        btn.classList.add('is-loading');
        const txt = loadingText || 'Memproses...';
        btn.innerHTML = '<span class="btn-spinner"></span> <span>' + txt + '</span>';
      } else {
        btn.disabled = false;
        btn.classList.remove('is-loading');
        const orig = btn.getAttribute('data-original-html');
        if (orig) btn.innerHTML = orig;
      }
    };

  

    let kpiChartInstance = null;
    
    function closeKpiModal() {
      const modal = document.getElementById('wmsKpiModal');
      if (modal) modal.classList.remove('active');
      if (kpiChartInstance) {
        try { kpiChartInstance.destroy(); } catch(e) {}
        kpiChartInstance = null;
      }
    }

    function getActiveProdukDataSource() {
      if (typeof ALL_PRODUK_DATA !== 'undefined' && Array.isArray(ALL_PRODUK_DATA) && ALL_PRODUK_DATA.length > 0) {
        return ALL_PRODUK_DATA;
      }
      if (window.ALL_PRODUK_DATA && Array.isArray(window.ALL_PRODUK_DATA) && window.ALL_PRODUK_DATA.length > 0) {
        return window.ALL_PRODUK_DATA;
      }
      if (window.WMS_MASTER_DATA && Array.isArray(window.WMS_MASTER_DATA) && window.WMS_MASTER_DATA.length > 0) {
        return window.WMS_MASTER_DATA;
      }
      if (typeof DISPLAY_DATA !== 'undefined' && Array.isArray(DISPLAY_DATA) && DISPLAY_DATA.length > 0) {
        return DISPLAY_DATA;
      }
      return [];
    }
    
    function showKpiDetails(type) {
      const modal = document.getElementById('wmsKpiModal');
      const titleEl = document.getElementById('kpiModalTitle');
      const bodyEl = document.getElementById('kpiModalBody');
      if (!modal || !titleEl || !bodyEl) return;
      
      modal.classList.add('active');
      bodyEl.innerHTML = '<div style="text-align:center; padding:30px;"><div class="btn-spinner" style="display:inline-block; width:28px; height:28px; border:3px solid var(--border-subtle); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; margin-bottom:12px;"></div><div style="font-size:13px; color:var(--text-muted);">Memproses data...</div></div>';
      
      const dataSource = getActiveProdukDataSource();
      
      if (!dataSource || dataSource.length === 0) {
        bodyEl.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">' +
          '⚠️ <b>Data inventori belum siap.</b><br><br>' +
          'Silakan tunggu sesaat atau klik tombol <b style="color:var(--primary);">🔄 REFRESH</b> di bagian atas untuk menyinkronkan data.' +
        '</div>';
        return;
      }
      
      setTimeout(() => {
        if (type === 'total_sku') {
          titleEl.innerHTML = '📦 Total SKU Berdasarkan Kategori';
          renderKpiChartKategori(bodyEl, dataSource);
        } else {
          renderKpiListLokasi(type, titleEl, bodyEl, dataSource);
        }
      }, 50);
    }
    
    function detectKategori(produkName) {
      const name = String(produkName || '').toUpperCase();
      if (name.includes('DRESS')) return 'Dress';
      if (name.includes('TOP') || name.includes('SHIRT') || name.includes('BLOUSE') || name.includes('KEMEJA') || name.includes('TEE') || name.includes('POLO')) return 'Top';
      if (name.includes('BOTTOM') || name.includes('PANTS') || name.includes('CELANA') || name.includes('SHORT') || name.includes('CULOTTE')) return 'Bottom';
      if (name.includes('SKIRT') || name.includes('ROK')) return 'Skirt';
      if (name.includes('OUTER') || name.includes('JACKET') || name.includes('COAT') || name.includes('CARDIGAN') || name.includes('BLAZER')) return 'Outer';
      if (name.includes('SET')) return 'Set';
      if (name.includes('BASIC')) return 'Basic';
      if (name.includes('ACC') || name.includes('BAG') || name.includes('BELT') || name.includes('HIJAB') || name.includes('SCARF')) return 'Accessories';
      return 'Lainnya';
    }
    
    function renderKpiChartKategori(container, dataSource) {
      const katMap = {};
      dataSource.forEach(item => {
        const kat = detectKategori(item.produk);
        katMap[kat] = (katMap[kat] || 0) + 1;
      });
      
      const sortedKats = Object.keys(katMap).sort((a,b) => katMap[b] - katMap[a]);
      const labels = [];
      const data = [];
      const colors = ['#f59e0b', '#10b981', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#06b6d4', '#64748b'];
      
      sortedKats.forEach(k => {
        labels.push(k + ' (' + katMap[k] + ')');
        data.push(katMap[k]);
      });
      
      container.innerHTML = '<div style="width: 100%; max-width: 420px; margin: 0 auto; padding: 10px 0;"><canvas id="kpiChartCanvas"></canvas></div>';
      
      try {
        const ctx = document.getElementById('kpiChartCanvas').getContext('2d');
        const isDarkMode = document.body.getAttribute('data-theme') === 'dark' || document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDarkMode ? '#e2e8f0' : '#1e293b';
        
        if (typeof Chart !== 'undefined') {
          kpiChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: labels,
              datasets: [{
                data: data,
                backgroundColor: colors.slice(0, data.length),
                borderWidth: 2,
                borderColor: isDarkMode ? '#161f30' : '#ffffff'
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: {
                  position: 'right',
                  labels: { color: textColor, font: { family: 'Inter', size: 11 } }
                }
              }
            }
          });
        }
      } catch (err) {
        console.error('Error rendering chart:', err);
      }
    }

    let CURRENT_PERBAIKAN_DATA = [];
    let FILTERED_PERBAIKAN_DATA = [];
    let ACTIVE_PERBAIKAN_TAB = 'ALL';

    let CURRENT_MAP_DATA = [];
    let FILTERED_MAP_DATA = [];
    let ACTIVE_MAP_TAB = 'ALL';

    let CURRENT_BLOKF_DATA = [];
    let FILTERED_BLOKF_DATA = [];
    let ACTIVE_BLOKF_CHANNEL = 'STUDIO';

    let CURRENT_GENERIC_DATA = [];
    let FILTERED_GENERIC_DATA = [];
    let CURRENT_GENERIC_TYPE = '';

    function getProductLocationString(locList) {
      if (!Array.isArray(locList) || locList.length === 0) return '-';
      const locParts = [];
      locList.forEach(l => {
        if (!l) return;
        if (typeof l === 'object' && l !== null) {
          const name = String(l.lokasi || '').trim();
          const q = Number(l.qty) || 0;
          if (name) locParts.push(q > 0 ? `${name} (${q})` : name);
        } else if (typeof l === 'string') {
          const parts = l.split(':');
          const name = String(parts[0] || '').trim();
          const q = Number(parts[1]) || 0;
          if (name) locParts.push(q > 0 ? `${name} (${q})` : name);
        }
      });
      return locParts.length > 0 ? locParts.join(', ') : '-';
    }

    function exportKpiDataToCsv(filename, headers, rows) {
      if (!rows || rows.length === 0) {
        if (window.showWmsToast) showWmsToast('Tidak ada data untuk diexport', 'warning');
        else alert('Tidak ada data untuk diexport');
        return;
      }

      let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
      csvContent += headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + "\r\n";

      rows.forEach(row => {
        csvContent += row.map(val => `"${String(val !== undefined && val !== null ? val : '').replace(/"/g, '""')}"`).join(',') + "\r\n";
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const cleanName = (filename || 'export_stok').toLowerCase().replace(/[^a-z0-9]/g, '_');
      link.setAttribute('download', `${cleanName}_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (window.showWmsToast) showWmsToast(`Data ${filename} berhasil diexport!`, 'success');
    }

    function sortAlphabetical(a, b) {
      const comp = String(a.produk || '').localeCompare(String(b.produk || ''), undefined, { sensitivity: 'base' });
      if (comp !== 0) return comp;
      return String(a.sku || '').localeCompare(String(b.sku || ''));
    }

    function classifyMapItem(item) {
      const nama = String(item.produk || '').trim().toLowerCase();
      const sku = String(item.sku || '').trim().toLowerCase();
      const locList = Array.isArray(item.locList) ? item.locList : [];
      let hasZLoc = false;
      locList.forEach(l => {
        const lStr = typeof l === 'object' && l !== null ? String(l.lokasi || '') : String(l || '');
        if (lStr.toUpperCase().startsWith('Z') || lStr.toUpperCase().includes('SLOW')) hasZLoc = true;
      });

      // 1. Z = Slow Moving
      if (sku.startsWith('z-') || sku.startsWith('z_') || sku === 'z' || nama.includes('slow moving') || nama.includes('slowmoving') || hasZLoc) {
        return { code: 'Z', label: 'Z. SLOW MOVING', short: 'Z', icon: '⏳', color: '#64748b' };
      }

      // 2. D = SALE
      if (sku.startsWith('ds') || sku.startsWith('sc') || nama.includes('special condition') || 
          nama.includes('clearance') || nama.includes('sale') || sku.includes('sale')) {
        return { code: 'D', label: 'D. SALE', short: 'D', icon: '🏷️', color: '#ef4444' };
      }

      // 3. Belt = Aksesoris
      if (nama.includes('belt') || nama.includes('aksesoris') || nama.includes('accessories') || 
          nama.includes('acc') || nama.includes('bag') || nama.includes('gift') || 
          nama.includes('box') || nama.includes('paperbag') || nama.includes('plastic') || 
          nama.includes('plastik') || sku.startsWith('pb-') || sku.startsWith('acc-') || sku.startsWith('blt')) {
        return { code: 'BELT', label: 'BELT (AKSESORIS)', short: 'BELT', icon: '🎀', color: '#8b5cf6' };
      }

      // 4. B = Bottom
      if (nama.includes('pants') || nama.includes('skirt') || nama.includes('skort') || 
          nama.includes('culotte') || nama.includes('shorts') || nama.includes('bottom') || 
          nama.includes('jeans') || nama.includes('trouser') || nama.includes('celana') || 
          nama.includes('rok') || nama.includes('kulot') || nama.includes('legging')) {
        return { code: 'B', label: 'B. BOTTOM', short: 'B', icon: '👖', color: '#3b82f6' };
      }

      // 5. A = Dress
      if (nama.includes('dress') || nama.includes('jumpsuit') || nama.includes('one set') || 
          nama.includes('oneset') || nama.includes('set') || nama.includes('romper') || 
          nama.includes('gown') || nama.includes('maxi') || nama.includes('midi')) {
        return { code: 'A', label: 'A. DRESS', short: 'A', icon: '👗', color: '#f59e0b' };
      }

      // 6. C = Top
      return { code: 'C', label: 'C. TOP', short: 'C', icon: '👚', color: '#10b981' };
    }

    function renderKpiListLokasi(type, titleEl, container, dataSource) {
      if (type === 'BLOK_F') {
        return renderBlokFPopup(titleEl, container, dataSource);
      }
      if (type === 'PERBAIKAN') {
        return renderPerbaikanPopup(titleEl, container, dataSource);
      }
      if (type === 'MAP') {
        return renderMapPopup(titleEl, container, dataSource);
      }
      
      CURRENT_GENERIC_TYPE = type;
      let title = "";
      let list = [];
      
      dataSource.forEach(item => {
        if (!item) return;
        const k = item.komparasi;
        let fisik = 0;
        if (k && k[type]) fisik = Number(k[type].fisik) || 0;
        
        if (fisik > 0) {
          list.push({ 
            sku: item.sku || '-', 
            produk: item.produk || '-', 
            size: item.size || '-', 
            locStr: getProductLocationString(item.locList),
            qty: fisik 
          });
        }
      });
      
      list.sort(sortAlphabetical);
      CURRENT_GENERIC_DATA = list;
      FILTERED_GENERIC_DATA = list;
      
      title = 'Detail Stok ' + type;
      titleEl.innerHTML = title + ` <span style="font-size:11px; font-weight:700; background:var(--card-alt); padding:2px 8px; border-radius:12px; margin-left:8px; border:1px solid var(--border-subtle);">${list.length} SKU</span>`;
      
      if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Tidak ada stok di lokasi ini.</div>';
        return;
      }
      
      let html = `
        <div style="display:flex; gap:8px; margin-bottom:12px; align-items:center;">
          <input type="text" id="searchKpiGeneric" class="search-input compact-input" placeholder="🔍 Cari Nama Produk / SKU..." style="flex:1;" oninput="filterGenericKpiTable(this)">
          <button type="button" class="btn btn-secondary compact-btn" onclick="exportCurrentGenericData()" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; white-space: nowrap;">
            <i class="fa-solid fa-file-csv" style="color:#10b981;"></i> Export CSV
          </button>
        </div>
        <div style="overflow-x:auto; max-height:420px;">
          <table class="kpi-list-table">
            <thead>
              <tr>
                <th>PRODUK</th>
                <th style="text-align:center;">SIZE</th>
                <th>SKU</th>
                <th style="text-align:right;">QTY FISIK</th>
              </tr>
            </thead>
            <tbody id="tableGenericKpiBody"></tbody>
          </table>
        </div>
        <div id="summaryKpiGeneric" style="margin-top: 10px; font-size: 11.5px; color: var(--text-muted); text-align: right;"></div>
      `;
      
      container.innerHTML = html;
      renderGenericKpiTable(CURRENT_GENERIC_DATA);
    }

    function filterGenericKpiTable(input) {
      const q = (input ? input.value : '').trim().toLowerCase();
      let filtered = CURRENT_GENERIC_DATA;
      if (q) {
        const keywords = q.split(/\s+/).filter(Boolean);
        filtered = filtered.filter(item => {
          const text = (item.produk + ' ' + item.sku + ' ' + (item.size || '') + ' ' + (item.locStr || '')).toLowerCase();
          return keywords.every(kw => text.includes(kw));
        });
      }
      FILTERED_GENERIC_DATA = filtered;
      renderGenericKpiTable(filtered);
    }

    function renderGenericKpiTable(list) {
      const tbody = document.getElementById('tableGenericKpiBody');
      const summary = document.getElementById('summaryKpiGeneric');
      if (!tbody) return;

      if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px 0; color:var(--text-muted); font-style:italic;">TIDAK ADA DATA</td></tr>';
        if (summary) summary.innerHTML = 'Total: <b>0 SKU</b> &bull; <b>0 Pcs</b>';
        return;
      }

      let totalPcs = 0;
      let html = '';
      list.forEach(item => {
        totalPcs += item.qty;
        html += `<tr class="kpi-data-row">
          <td style="font-weight:600; color:var(--text); font-size:12px;">${item.produk}</td>
          <td style="text-align:center;"><span class="badge-size">${item.size}</span></td>
          <td><span class="badge-sku">${item.sku}</span></td>
          <td style="text-align:right; font-weight:800; color:var(--primary); font-size:13px;">${item.qty}</td>
        </tr>`;
      });
      tbody.innerHTML = html;
      if (summary) summary.innerHTML = `Total: <b style="color:var(--text);">${list.length} SKU</b> &bull; <b style="color:var(--primary);">${totalPcs} Pcs</b> Fisik`;
    }

    function exportCurrentGenericData() {
      const headers = ['PRODUK', 'SIZE', 'SKU', 'LOKASI / RAK', 'QTY FISIK'];
      const rows = (FILTERED_GENERIC_DATA || []).map(item => [
        item.produk,
        item.size,
        item.sku,
        item.locStr || '-',
        item.qty
      ]);
      exportKpiDataToCsv(`stok_${CURRENT_GENERIC_TYPE || 'lokasi'}`, headers, rows);
    }

    function renderMapPopup(titleEl, container, dataSource) {
      ACTIVE_MAP_TAB = 'ALL';
      titleEl.innerHTML = '🏢 STOK FISIK MAP (GUDANG UTAMA)';

      let list = [];
      dataSource.forEach(p => {
        if (!p) return;
        let mapQty = 0;
        if (p.komparasi && p.komparasi.MAP) {
          mapQty = Number(p.komparasi.MAP.fisik) || 0;
        } else if (p.singles && p.singles.MAP) {
          mapQty = Number(p.singles.MAP) || 0;
        }

        if (mapQty > 0) {
          const kat = classifyMapItem(p);
          list.push({
            produk: p.produk || p.sku || '-',
            size: p.size || '-',
            sku: p.sku || '-',
            locStr: getProductLocationString(p.locList),
            qty: mapQty,
            kat: kat
          });
        }
      });

      list.sort(sortAlphabetical);
      CURRENT_MAP_DATA = list;
      FILTERED_MAP_DATA = list;

      const html = `
        <div style="margin-bottom: 12px;">
          <div class="wms-segmented-tabs" style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;">
            <button type="button" class="wms-segmented-tab-btn active map-tab-btn" onclick="switchKpiMapTab('ALL', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--primary); background: var(--primary); color: #fff;">🌐 SEMUA</button>
            <button type="button" class="wms-segmented-tab-btn map-tab-btn" onclick="switchKpiMapTab('A', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">👗 A. DRESS</button>
            <button type="button" class="wms-segmented-tab-btn map-tab-btn" onclick="switchKpiMapTab('B', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">👖 B. BOTTOM</button>
            <button type="button" class="wms-segmented-tab-btn map-tab-btn" onclick="switchKpiMapTab('C', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">👚 C. TOP</button>
            <button type="button" class="wms-segmented-tab-btn map-tab-btn" onclick="switchKpiMapTab('D', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">🏷️ D. SALE</button>
            <button type="button" class="wms-segmented-tab-btn map-tab-btn" onclick="switchKpiMapTab('BELT', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">🎀 BELT</button>
            <button type="button" class="wms-segmented-tab-btn map-tab-btn" onclick="switchKpiMapTab('Z', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">⏳ Z. SLOW</button>
          </div>
        </div>
        
        <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 11.5px; color: var(--text);">
          💡 <b>Klasifikasi Stok MAP (Gudang Utama):</b> A (Dress), B (Bottom), C (Top), D (Sale), Belt (Aksesoris), Z (Slow Moving).
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center;">
          <input type="text" id="searchKpiMap" class="search-input compact-input" placeholder="🔍 Cari Nama Produk / SKU / Kategori..." style="flex: 1;" oninput="filterKpiMapTable()">
          <button type="button" class="btn btn-secondary compact-btn" onclick="exportCurrentMapData()" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; white-space: nowrap;">
            <i class="fa-solid fa-file-csv" style="color:#10b981;"></i> Export CSV
          </button>
        </div>
        
        <div style="overflow-x: auto; max-height: 400px;">
          <table class="kpi-list-table" id="tableKpiMap" style="min-width: 420px; width: 100%;">
            <colgroup>
              <col style="width: auto;">
              <col style="width: 55px;">
              <col style="width: 110px;">
              <col style="width: 110px;">
              <col style="width: 75px;">
            </colgroup>
            <thead>
              <tr>
                <th style="text-align: left; padding-left: 12px;">PRODUK</th>
                <th style="text-align: center;">SIZE</th>
                <th style="text-align: left; padding-left: 8px;">SKU</th>
                <th style="text-align: center;">KATEGORI</th>
                <th style="text-align: right; padding-right: 12px;">QTY MAP</th>
              </tr>
            </thead>
            <tbody id="tbodyKpiMap"></tbody>
          </table>
        </div>
        <div id="summaryKpiMap" style="margin-top: 10px; font-size: 11.5px; color: var(--text-muted); text-align: right;"></div>
      `;

      container.innerHTML = html;
      renderKpiMapTable(CURRENT_MAP_DATA);
    }

    function switchKpiMapTab(tab, btn) {
      ACTIVE_MAP_TAB = tab;
      document.querySelectorAll('.map-tab-btn').forEach(b => {
        b.style.background = 'var(--card-alt)';
        b.style.borderColor = 'var(--border-subtle)';
        b.style.color = 'var(--text)';
        b.classList.remove('active');
      });
      if (btn) {
        btn.classList.add('active');
        btn.style.background = 'var(--primary)';
        btn.style.borderColor = 'var(--primary)';
        btn.style.color = '#fff';
      }
      filterKpiMapTable();
    }

    function filterKpiMapTable() {
      const searchInput = document.getElementById('searchKpiMap');
      const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
      
      let filtered = CURRENT_MAP_DATA;
      if (q) {
        const keywords = q.split(/\s+/).filter(Boolean);
        filtered = filtered.filter(item => {
          const text = (item.produk + ' ' + item.sku + ' ' + (item.size || '') + ' ' + item.kat.label + ' ' + (item.locStr || '')).toLowerCase();
          return keywords.every(kw => text.includes(kw));
        });
      }
      
      filtered = filtered.filter(item => {
        if (ACTIVE_MAP_TAB === 'ALL') return true;
        return item.kat.code === ACTIVE_MAP_TAB;
      });
      
      FILTERED_MAP_DATA = filtered;
      renderKpiMapTable(filtered);
    }

    function renderKpiMapTable(list) {
      const tbody = document.getElementById('tbodyKpiMap');
      const summary = document.getElementById('summaryKpiMap');
      if (!tbody) return;

      if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px 0; color:var(--text-muted); font-style:italic;">TIDAK ADA STOK PADA PILIHAN INI</td></tr>';
        if (summary) summary.innerHTML = 'Total: <b>0 SKU</b> &bull; <b>0 Pcs</b> Fisik MAP';
        return;
      }

      let totalPcs = 0;
      let rowsHtml = '';

      list.forEach(item => {
        let displaySize = item.size || '-';
        if (displaySize.toLowerCase() === 'default') displaySize = 'ALL';
        totalPcs += (Number(item.qty) || 0);

        rowsHtml += '<tr>' +
          '<td style="font-weight:600; color:var(--text); font-size:11.5px; padding-left:12px;">' + item.produk + '</td>' +
          '<td style="text-align:center;"><span class="badge-size">' + displaySize + '</span></td>' +
          '<td style="padding-left:8px;"><span class="badge-sku">' + item.sku + '</span></td>' +
          '<td style="text-align:center;"><span style="font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; background:' + item.kat.color + '20; color:' + item.kat.color + '; border:1px solid ' + item.kat.color + '40;">' + item.kat.icon + ' ' + item.kat.short + '</span></td>' +
          '<td style="text-align:right; font-weight:800; color:var(--primary); padding-right:12px;">' + item.qty + '</td>' +
        '</tr>';
      });

      tbody.innerHTML = rowsHtml;
      if (summary) summary.innerHTML = `Total: <b style="color:var(--text);">${list.length} SKU</b> &bull; <b style="color:var(--primary);">${totalPcs} Pcs</b> Fisik MAP`;
    }

    function exportCurrentMapData() {
      const headers = ['PRODUK', 'SIZE', 'SKU', 'KATEGORI', 'LOKASI / RAK', 'QTY MAP'];
      const rows = (FILTERED_MAP_DATA || []).map(item => [
        item.produk,
        item.size,
        item.sku,
        item.kat.label,
        item.locStr || '-',
        item.qty
      ]);
      exportKpiDataToCsv(`stok_map_${ACTIVE_MAP_TAB}`, headers, rows);
    }

    function renderPerbaikanPopup(titleEl, container, dataSource) {
      ACTIVE_PERBAIKAN_TAB = 'ALL';
      titleEl.innerHTML = '🛠️ STOK PERBAIKAN (PERMAK & DEFECT)';
      
      let list = [];
      let hasCuci = false;

      dataSource.forEach(p => {
        if (!p) return;
        let permakQty = 0;
        let defectQty = 0;
        let cuciQty = 0;

        // 1. Dari komparasi
        if (p.komparasi) {
          if (p.komparasi.PERMAK) permakQty = Math.max(permakQty, Number(p.komparasi.PERMAK.fisik) || 0);
          if (p.komparasi.DEFECT) defectQty = Math.max(defectQty, Number(p.komparasi.DEFECT.fisik) || 0);
        }

        // 2. Dari singles
        if (p.singles) {
          if (p.singles.PERMAK) permakQty = Math.max(permakQty, Number(p.singles.PERMAK) || 0);
          if (p.singles.DEFECT) defectQty = Math.max(defectQty, Number(p.singles.DEFECT) || 0);
        }

        // 3. Dari locList
        if (Array.isArray(p.locList) && p.locList.length > 0) {
          p.locList.forEach(loc => {
            if (!loc) return;
            let locName = "";
            let qtyVal = 0;
            if (typeof loc === 'object' && loc !== null) {
              locName = String(loc.lokasi || '').toUpperCase();
              qtyVal = Number(loc.qty) || 0;
            } else if (typeof loc === 'string') {
              const parts = loc.split(':');
              locName = String(parts[0] || '').trim().toUpperCase();
              qtyVal = Number(parts[1]) || 0;
            }
            
            if (locName.startsWith('PMK') || locName.includes('PERMAK')) {
              permakQty = Math.max(permakQty, qtyVal);
            } else if (locName.startsWith('DF') || locName.includes('DEFECT') || locName.includes('CACAT')) {
              defectQty = Math.max(defectQty, qtyVal);
            } else if (locName.startsWith('CC') || locName.includes('CUCI')) {
              cuciQty = Math.max(cuciQty, qtyVal);
              hasCuci = true;
            }
          });
        }

        const totalQty = permakQty + defectQty + cuciQty;
        if (totalQty > 0) {
          list.push({
            produk: p.produk || p.sku || '-',
            size: p.size || '-',
            sku: p.sku || '-',
            locStr: getProductLocationString(p.locList),
            permakQty: permakQty,
            defectQty: defectQty,
            cuciQty: cuciQty,
            totalQty: totalQty
          });
        }
      });

      list.sort(sortAlphabetical);
      CURRENT_PERBAIKAN_DATA = list;
      FILTERED_PERBAIKAN_DATA = list;

      const cuciBtnHtml = hasCuci ? `<button type="button" class="wms-segmented-tab-btn perbaikan-tab-btn" onclick="switchKpiPerbaikanTab('CUCI', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">🧺 CUCI</button>` : '';

      const html = `
        <div style="margin-bottom: 12px;">
          <div class="wms-segmented-tabs" style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;">
            <button type="button" class="wms-segmented-tab-btn active perbaikan-tab-btn" onclick="switchKpiPerbaikanTab('ALL', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--primary); background: var(--primary); color: #fff;">🌐 SEMUA</button>
            <button type="button" class="wms-segmented-tab-btn perbaikan-tab-btn" onclick="switchKpiPerbaikanTab('PERMAK', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">🪡 PERMAK</button>
            <button type="button" class="wms-segmented-tab-btn perbaikan-tab-btn" onclick="switchKpiPerbaikanTab('DEFECT', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">⚠️ DEFECT</button>
            ${cuciBtnHtml}
          </div>
        </div>
        
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 11.5px; color: var(--text);">
          💡 <b>Antrean Penanganan Khusus:</b> Daftar barang yang berada dalam penanganan Permak (PMK) dan Barang Defect / Reject (DF).
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center;">
          <input type="text" id="searchKpiPerbaikan" class="search-input compact-input" placeholder="🔍 Cari Nama Produk / SKU..." style="flex: 1;" oninput="filterKpiPerbaikanTable()">
          <button type="button" class="btn btn-secondary compact-btn" onclick="exportCurrentPerbaikanData()" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; white-space: nowrap;">
            <i class="fa-solid fa-file-csv" style="color:#10b981;"></i> Export CSV
          </button>
        </div>
        
        <div style="overflow-x: auto; max-height: 400px;">
          <table class="kpi-list-table" id="tableKpiPerbaikan" style="min-width: 420px; width: 100%;">
            <colgroup id="colgroupKpiPerbaikan"></colgroup>
            <thead id="theadKpiPerbaikan"></thead>
            <tbody id="tbodyKpiPerbaikan"></tbody>
          </table>
        </div>
        <div id="summaryKpiPerbaikan" style="margin-top: 10px; font-size: 11.5px; color: var(--text-muted); text-align: right;"></div>
      `;

      container.innerHTML = html;
      renderKpiPerbaikanTable(CURRENT_PERBAIKAN_DATA);
    }

    function switchKpiPerbaikanTab(tab, btn) {
      ACTIVE_PERBAIKAN_TAB = tab;
      document.querySelectorAll('.perbaikan-tab-btn').forEach(b => {
        b.style.background = 'var(--card-alt)';
        b.style.borderColor = 'var(--border-subtle)';
        b.style.color = 'var(--text)';
        b.classList.remove('active');
      });
      if (btn) {
        btn.classList.add('active');
        btn.style.background = 'var(--primary)';
        btn.style.borderColor = 'var(--primary)';
        btn.style.color = '#fff';
      }
      filterKpiPerbaikanTable();
    }

    function filterKpiPerbaikanTable() {
      const searchInput = document.getElementById('searchKpiPerbaikan');
      const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
      
      let filtered = CURRENT_PERBAIKAN_DATA;
      if (q) {
        const keywords = q.split(/\s+/).filter(Boolean);
        filtered = filtered.filter(item => {
          const text = (item.produk + ' ' + item.sku + ' ' + (item.size || '') + ' ' + (item.locStr || '')).toLowerCase();
          return keywords.every(kw => text.includes(kw));
        });
      }
      
      filtered = filtered.filter(item => {
        if (ACTIVE_PERBAIKAN_TAB === 'PERMAK' && item.permakQty > 0) return true;
        if (ACTIVE_PERBAIKAN_TAB === 'DEFECT' && item.defectQty > 0) return true;
        if (ACTIVE_PERBAIKAN_TAB === 'CUCI' && item.cuciQty > 0) return true;
        if (ACTIVE_PERBAIKAN_TAB === 'ALL') return true;
        return false;
      });
      
      FILTERED_PERBAIKAN_DATA = filtered;
      renderKpiPerbaikanTable(filtered);
    }

    function renderKpiPerbaikanTable(list) {
      const colgroup = document.getElementById('colgroupKpiPerbaikan');
      const thead = document.getElementById('theadKpiPerbaikan');
      const tbody = document.getElementById('tbodyKpiPerbaikan');
      const summary = document.getElementById('summaryKpiPerbaikan');
      if (!tbody) return;

      let isAll = ACTIVE_PERBAIKAN_TAB === 'ALL';

      if (isAll) {
        if (colgroup) colgroup.innerHTML = '<col style="width:auto;"><col style="width:55px;"><col style="width:110px;"><col style="width:65px;"><col style="width:65px;"><col style="width:65px;">';
        if (thead) thead.innerHTML = '<tr>' +
          '<th style="text-align:left; padding-left:12px;">PRODUK</th>' +
          '<th style="text-align:center;">SIZE</th>' +
          '<th style="text-align:left; padding-left:8px;">SKU</th>' +
          '<th style="text-align:center;" title="Permak">PERMAK</th>' +
          '<th style="text-align:center;" title="Defect / Cacat">DEFECT</th>' +
          '<th style="text-align:center;" title="Total">TOTAL</th>' +
        '</tr>';
      } else {
        let colLabel = ACTIVE_PERBAIKAN_TAB;
        if (colgroup) colgroup.innerHTML = '<col style="width:auto;"><col style="width:55px;"><col style="width:110px;"><col style="width:75px;">';
        if (thead) thead.innerHTML = '<tr>' +
          '<th style="text-align:left; padding-left:12px;">PRODUK</th>' +
          '<th style="text-align:center;">SIZE</th>' +
          '<th style="text-align:left; padding-left:8px;">SKU</th>' +
          '<th style="text-align:center;">' + colLabel + '</th>' +
        '</tr>';
      }

      if (!list || list.length === 0) {
        const colSpan = isAll ? 6 : 4;
        tbody.innerHTML = '<tr><td colspan="' + colSpan + '" style="text-align:center; padding:30px 0; color:var(--text-muted); font-style:italic;">TIDAK ADA STOK PADA PILIHAN INI</td></tr>';
        if (summary) summary.innerHTML = 'Total: <b>0 SKU</b> &bull; <b>0 Pcs</b> Perbaikan';
        return;
      }

      let totalPcs = 0;
      let rowsHtml = '';

      list.forEach(item => {
        let displaySize = item.size || '-';
        if (displaySize.toLowerCase() === 'default') displaySize = 'ALL';

        if (isAll) {
          totalPcs += item.totalQty;
          rowsHtml += '<tr>' +
            '<td style="font-weight:600; color:var(--text); font-size:11.5px; padding-left:12px;">' + item.produk + '</td>' +
            '<td style="text-align:center;"><span class="badge-size">' + displaySize + '</span></td>' +
            '<td style="padding-left:8px;"><span class="badge-sku">' + item.sku + '</span></td>' +
            '<td style="text-align:center; font-weight:700; color:#f59e0b;">' + (item.permakQty || 0) + '</td>' +
            '<td style="text-align:center; font-weight:700; color:#ef4444;">' + (item.defectQty || 0) + '</td>' +
            '<td style="text-align:center; font-weight:800; color:var(--primary);">' + item.totalQty + '</td>' +
          '</tr>';
        } else {
          let qVal = item.permakQty;
          let qColor = '#f59e0b';
          if (ACTIVE_PERBAIKAN_TAB === 'DEFECT') { qVal = item.defectQty; qColor = '#ef4444'; }
          else if (ACTIVE_PERBAIKAN_TAB === 'CUCI') { qVal = item.cuciQty; qColor = '#3b82f6'; }

          totalPcs += (Number(qVal) || 0);

          rowsHtml += '<tr>' +
            '<td style="font-weight:600; color:var(--text); font-size:11.5px; padding-left:12px;">' + item.produk + '</td>' +
            '<td style="text-align:center;"><span class="badge-size">' + displaySize + '</span></td>' +
            '<td style="padding-left:8px;"><span class="badge-sku">' + item.sku + '</span></td>' +
            '<td style="text-align:center; font-weight:800; color:' + qColor + ';">' + qVal + '</td>' +
          '</tr>';
        }
      });

      tbody.innerHTML = rowsHtml;
      if (summary) summary.innerHTML = `Total: <b style="color:var(--text);">${list.length} SKU</b> &bull; <b style="color:var(--primary);">${totalPcs} Pcs</b> Perbaikan`;
    }

    function exportCurrentPerbaikanData() {
      let headers = [];
      let rows = [];
      if (ACTIVE_PERBAIKAN_TAB === 'ALL') {
        headers = ['PRODUK', 'SIZE', 'SKU', 'LOKASI / RAK', 'PERMAK', 'DEFECT', 'CUCI', 'TOTAL PERBAIKAN'];
        rows = (FILTERED_PERBAIKAN_DATA || []).map(item => [
          item.produk,
          item.size,
          item.sku,
          item.locStr || '-',
          item.permakQty || 0,
          item.defectQty || 0,
          item.cuciQty || 0,
          item.totalQty || 0
        ]);
      } else {
        headers = ['PRODUK', 'SIZE', 'SKU', 'LOKASI / RAK', `QTY ${ACTIVE_PERBAIKAN_TAB}`];
        rows = (FILTERED_PERBAIKAN_DATA || []).map(item => {
          let q = item.permakQty || 0;
          if (ACTIVE_PERBAIKAN_TAB === 'DEFECT') q = item.defectQty || 0;
          else if (ACTIVE_PERBAIKAN_TAB === 'CUCI') q = item.cuciQty || 0;
          return [
            item.produk,
            item.size,
            item.sku,
            item.locStr || '-',
            q
          ];
        });
      }
      exportKpiDataToCsv(`stok_perbaikan_${ACTIVE_PERBAIKAN_TAB}`, headers, rows);
    }

    function renderBlokFPopup(titleEl, container, dataSource) {
      ACTIVE_BLOKF_CHANNEL = 'STUDIO';
      titleEl.innerHTML = '📍 STOK TERSEDIA (BLOK F)';
      
      let list = [];
      dataSource.forEach(p => {
        if (!p) return;
        let studioQty = 0;
        let shpQty = 0;
        let ttkQty = 0;
        
        // 1. Ambil dari komparasi (LIVE / STUDIO)
        if (p.komparasi) {
          if (p.komparasi.STUDIO) studioQty = Math.max(studioQty, Number(p.komparasi.STUDIO.fisik) || 0);
          if (p.komparasi.LIVE) studioQty = Math.max(studioQty, Number(p.komparasi.LIVE.fisik) || 0);
        }
        
        // 2. Ambil dari singles (SHP / TTK)
        if (p.singles) {
          if (p.singles.SHP) shpQty = Math.max(shpQty, Number(p.singles.SHP) || 0);
          if (p.singles.TTK) ttkQty = Math.max(ttkQty, Number(p.singles.TTK) || 0);
        }
        
        // 3. Ambil dari locList spesifik jika ada
        if (Array.isArray(p.locList) && p.locList.length > 0) {
          p.locList.forEach(loc => {
            if (!loc) return;
            let locName = "";
            let qtyVal = 0;
            if (typeof loc === 'object' && loc !== null) {
              locName = String(loc.lokasi || '').toUpperCase();
              qtyVal = Number(loc.qty) || 0;
            } else if (typeof loc === 'string') {
              const parts = loc.split(':');
              locName = String(parts[0] || '').trim().toUpperCase();
              qtyVal = Number(parts[1]) || 0;
            }
            
            if (locName.includes('STUDIO') || locName.includes('BLOK F') || locName === 'ST' || locName.includes('LIVE')) {
              studioQty = Math.max(studioQty, qtyVal);
            } else if (locName.includes('SHOPEE') || locName === 'SHP' || locName.includes('LIVE SHOPEE')) {
              shpQty = Math.max(shpQty, qtyVal);
            } else if (locName.includes('TIKTOK') || locName === 'TTK' || locName === 'TT' || locName.includes('LIVE TIKTOK')) {
              ttkQty = Math.max(ttkQty, qtyVal);
            }
          });
        }
        
        if (studioQty > 0 || shpQty > 0 || ttkQty > 0) {
          list.push({
            produk: p.produk || p.sku || '-',
            size: p.size || '-',
            sku: p.sku || '-',
            locStr: getProductLocationString(p.locList),
            studioQty: studioQty,
            shpQty: shpQty,
            ttkQty: ttkQty,
            totalQty: studioQty + shpQty + ttkQty
          });
        }
      });
      
      list.sort(sortAlphabetical);
      CURRENT_BLOKF_DATA = list;
      FILTERED_BLOKF_DATA = list;
      
      const html = `
        <div style="margin-bottom: 12px;">
          <div class="wms-segmented-tabs" style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;">
            <button type="button" class="wms-segmented-tab-btn active blokf-tab-btn" onclick="switchKpiBlokFTab('STUDIO', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">📍 STUDIO</button>
            <button type="button" class="wms-segmented-tab-btn blokf-tab-btn" onclick="switchKpiBlokFTab('SHOPEE', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">🧡 SHOPEE</button>
            <button type="button" class="wms-segmented-tab-btn blokf-tab-btn" onclick="switchKpiBlokFTab('TIKTOK', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">🖤 TIKTOK</button>
            <button type="button" class="wms-segmented-tab-btn blokf-tab-btn" onclick="switchKpiBlokFTab('ALL', this)" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--card-alt); color: var(--text);">🌐 SEMUA</button>
          </div>
        </div>
        
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 11.5px; color: var(--text);">
          💡 <b>Acuan Peminjam Divisi Live:</b> Daftar barang yang sudah tersedia di channel/lokasi terpilih.
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center;">
          <input type="text" id="searchKpiBlokF" class="search-input compact-input" placeholder="🔍 Cari Nama Produk / SKU..." style="flex: 1;" oninput="filterKpiBlokFTable()">
          <button type="button" class="btn btn-secondary compact-btn" onclick="exportCurrentBlokFData()" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; white-space: nowrap;">
            <i class="fa-solid fa-file-csv" style="color:#10b981;"></i> Export CSV
          </button>
        </div>
        
        <div style="overflow-x: auto; max-height: 400px;">
          <table class="kpi-list-table" id="tableKpiBlokF" style="min-width: 420px; width: 100%;">
            <colgroup id="colgroupKpiBlokF"></colgroup>
            <thead id="theadKpiBlokF"></thead>
            <tbody id="tbodyKpiBlokF"></tbody>
          </table>
        </div>
        <div id="summaryKpiBlokF" style="margin-top: 10px; font-size: 11.5px; color: var(--text-muted); text-align: right;"></div>
      `;
      
      container.innerHTML = html;
      renderKpiBlokFTable(CURRENT_BLOKF_DATA);
    }
    
    function switchKpiBlokFTab(channel, btn) {
      ACTIVE_BLOKF_CHANNEL = channel;
      document.querySelectorAll('.blokf-tab-btn').forEach(b => {
        b.style.background = 'var(--card-alt)';
        b.style.borderColor = 'var(--border-subtle)';
        b.style.color = 'var(--text)';
        b.classList.remove('active');
      });
      if (btn) {
        btn.classList.add('active');
        btn.style.background = 'var(--primary)';
        btn.style.borderColor = 'var(--primary)';
        btn.style.color = '#fff';
      }
      filterKpiBlokFTable();
    }
    
    function filterKpiBlokFTable() {
      const searchInput = document.getElementById('searchKpiBlokF');
      const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
      
      let filtered = CURRENT_BLOKF_DATA;
      if (q) {
        const keywords = q.split(/\s+/).filter(Boolean);
        filtered = filtered.filter(item => {
          const text = (item.produk + ' ' + item.sku + ' ' + (item.size || '') + ' ' + (item.locStr || '')).toLowerCase();
          return keywords.every(kw => text.includes(kw));
        });
      }
      
      filtered = filtered.filter(item => {
        if (ACTIVE_BLOKF_CHANNEL === 'STUDIO' && item.studioQty > 0) return true;
        if (ACTIVE_BLOKF_CHANNEL === 'SHOPEE' && item.shpQty > 0) return true;
        if (ACTIVE_BLOKF_CHANNEL === 'TIKTOK' && item.ttkQty > 0) return true;
        if (ACTIVE_BLOKF_CHANNEL === 'ALL') return true;
        return false;
      });
      
      FILTERED_BLOKF_DATA = filtered;
      renderKpiBlokFTable(filtered);
    }
    
    function renderKpiBlokFTable(list) {
      const colgroup = document.getElementById('colgroupKpiBlokF');
      const thead = document.getElementById('theadKpiBlokF');
      const tbody = document.getElementById('tbodyKpiBlokF');
      const summary = document.getElementById('summaryKpiBlokF');
      if (!tbody) return;
      
      let isAll = ACTIVE_BLOKF_CHANNEL === 'ALL';
      
      if (isAll) {
        if (colgroup) colgroup.innerHTML = '<col style="width:auto;"><col style="width:55px;"><col style="width:110px;"><col style="width:60px;"><col style="width:60px;"><col style="width:60px;">';
        if (thead) thead.innerHTML = '<tr>' +
          '<th style="text-align:left; padding-left:12px;">PRODUK</th>' +
          '<th style="text-align:center;">SIZE</th>' +
          '<th style="text-align:left; padding-left:8px;">SKU</th>' +
          '<th style="text-align:center;" title="Studio / Blok F">STUDIO</th>' +
          '<th style="text-align:center;" title="Shopee">SHP</th>' +
          '<th style="text-align:center;" title="TikTok">TTK</th>' +
        '</tr>';
      } else {
        let chLabel = 'QTY';
        if (ACTIVE_BLOKF_CHANNEL === 'STUDIO') chLabel = 'STUDIO';
        else if (ACTIVE_BLOKF_CHANNEL === 'SHOPEE') chLabel = 'SHP';
        else if (ACTIVE_BLOKF_CHANNEL === 'TIKTOK') chLabel = 'TTK';
        
        if (colgroup) colgroup.innerHTML = '<col style="width:auto;"><col style="width:55px;"><col style="width:110px;"><col style="width:70px;">';
        if (thead) thead.innerHTML = '<tr>' +
          '<th style="text-align:left; padding-left:12px;">PRODUK</th>' +
          '<th style="text-align:center;">SIZE</th>' +
          '<th style="text-align:left; padding-left:8px;">SKU</th>' +
          '<th style="text-align:center;">' + chLabel + '</th>' +
        '</tr>';
      }
      
      if (!list || list.length === 0) {
        const colSpan = isAll ? 6 : 4;
        tbody.innerHTML = '<tr><td colspan="' + colSpan + '" style="text-align:center; padding:30px 0; color:var(--text-muted); font-style:italic;">TIDAK ADA STOK PADA PILIHAN INI</td></tr>';
        if (summary) summary.innerHTML = 'Total: <b>0 SKU</b> &bull; <b>0 Pcs</b> Tersedia';
        return;
      }
      
      let totalPcs = 0;
      let rowsHtml = '';
      
      list.forEach(item => {
        let displaySize = item.size || '-';
        if (displaySize.toLowerCase() === 'default') displaySize = 'ALL';
        
        if (isAll) {
          totalPcs += item.totalQty;
          rowsHtml += '<tr>' +
            '<td style="font-weight:600; color:var(--text); font-size:11.5px; padding-left:12px;">' + item.produk + '</td>' +
            '<td style="text-align:center;"><span class="badge-size">' + displaySize + '</span></td>' +
            '<td style="padding-left:8px;"><span class="badge-sku">' + item.sku + '</span></td>' +
            '<td style="text-align:center; font-weight:700; color:var(--primary);">' + (item.studioQty || 0) + '</td>' +
            '<td style="text-align:center; font-weight:700; color:#e05638;">' + (item.shpQty || 0) + '</td>' +
            '<td style="text-align:center; font-weight:700; color:var(--text);">' + (item.ttkQty || 0) + '</td>' +
          '</tr>';
        } else {
          let qVal = item.studioQty;
          let qColor = 'var(--primary)';
          if (ACTIVE_BLOKF_CHANNEL === 'SHOPEE') { qVal = item.shpQty; qColor = '#e05638'; }
          else if (ACTIVE_BLOKF_CHANNEL === 'TIKTOK') { qVal = item.ttkQty; qColor = 'var(--text)'; }
          
          totalPcs += (Number(qVal) || 0);
          
          rowsHtml += '<tr>' +
            '<td style="font-weight:600; color:var(--text); font-size:11.5px; padding-left:12px;">' + item.produk + '</td>' +
            '<td style="text-align:center;"><span class="badge-size">' + displaySize + '</span></td>' +
            '<td style="padding-left:8px;"><span class="badge-sku">' + item.sku + '</span></td>' +
            '<td style="text-align:center; font-weight:800; color:' + qColor + ';">' + qVal + '</td>' +
          '</tr>';
        }
      });
      
      tbody.innerHTML = rowsHtml;
      if (summary) summary.innerHTML = `Total: <b style="color:var(--text);">${list.length} SKU</b> &bull; <b style="color:var(--primary);">${totalPcs} Pcs</b> Tersedia`;
    }

    function exportCurrentBlokFData() {
      let headers = [];
      let rows = [];
      if (ACTIVE_BLOKF_CHANNEL === 'ALL') {
        headers = ['PRODUK', 'SIZE', 'SKU', 'LOKASI / RAK', 'STUDIO', 'SHOPEE', 'TIKTOK', 'TOTAL QTY'];
        rows = (FILTERED_BLOKF_DATA || []).map(item => [
          item.produk,
          item.size,
          item.sku,
          item.locStr || '-',
          item.studioQty || 0,
          item.shpQty || 0,
          item.ttkQty || 0,
          item.totalQty || 0
        ]);
      } else {
        headers = ['PRODUK', 'SIZE', 'SKU', 'LOKASI / RAK', `QTY ${ACTIVE_BLOKF_CHANNEL}`];
        rows = (FILTERED_BLOKF_DATA || []).map(item => {
          let q = item.studioQty || 0;
          if (ACTIVE_BLOKF_CHANNEL === 'SHOPEE') q = item.shpQty || 0;
          else if (ACTIVE_BLOKF_CHANNEL === 'TIKTOK') q = item.ttkQty || 0;
          return [
            item.produk,
            item.size,
            item.sku,
            item.locStr || '-',
            q
          ];
        });
      }
      exportKpiDataToCsv(`stok_blokf_${ACTIVE_BLOKF_CHANNEL}`, headers, rows);
    }
  

// --- Global Window Binding for dashboard ---
if (typeof initTheme === 'function') window.initTheme = initTheme;
if (typeof updateThemeButtonText === 'function') window.updateThemeButtonText = updateThemeButtonText;
if (typeof toggleTheme === 'function') window.toggleTheme = toggleTheme;
if (typeof toggleSidebar === 'function') window.toggleSidebar = toggleSidebar;
if (typeof initSidebarState === 'function') window.initSidebarState = initSidebarState;
if (typeof updateViewButtonText === 'function') window.updateViewButtonText = updateViewButtonText;
if (typeof toggleViewMode === 'function') window.toggleViewMode = toggleViewMode;
if (typeof initFilterAreaState === 'function') window.initFilterAreaState = initFilterAreaState;
if (typeof toggleFilterAreaDropdown === 'function') window.toggleFilterAreaDropdown = toggleFilterAreaDropdown;
if (typeof handleAreaCheckboxChange === 'function') window.handleAreaCheckboxChange = handleAreaCheckboxChange;
if (typeof syncFilterAreaCheckboxes === 'function') window.syncFilterAreaCheckboxes = syncFilterAreaCheckboxes;
if (typeof updateFilterAreaButtonText === 'function') window.updateFilterAreaButtonText = updateFilterAreaButtonText;
if (typeof bisaAksesMenuWms === 'function') window.bisaAksesMenuWms = bisaAksesMenuWms;
if (typeof renderSidebarNavItems === 'function') window.renderSidebarNavItems = renderSidebarNavItems;
if (typeof navigasiKe === 'function') window.navigasiKe = navigasiKe;
if (typeof logoutSession === 'function') window.logoutSession = logoutSession;
if (typeof handleSearchInput === 'function') window.handleSearchInput = handleSearchInput;
if (typeof normalisasiProdukData === 'function') window.normalisasiProdukData = normalisasiProdukData;
if (typeof sortSize === 'function') window.sortSize = sortSize;
if (typeof urutkanProdukData === 'function') window.urutkanProdukData = urutkanProdukData;
if (typeof updateKpiCards === 'function') window.updateKpiCards = updateKpiCards;
if (typeof syncGlobalMasterStore === 'function') window.syncGlobalMasterStore = syncGlobalMasterStore;
if (typeof initFastClientCache === 'function') window.initFastClientCache = initFastClientCache;
if (typeof muatDataProduk === 'function') window.muatDataProduk = muatDataProduk;
if (typeof initSupabaseRealtimeSync === 'function') window.initSupabaseRealtimeSync = initSupabaseRealtimeSync;
if (typeof handleRealtimeChange === 'function') window.handleRealtimeChange = handleRealtimeChange;
if (typeof terapkanFilterLokal === 'function') window.terapkanFilterLokal = terapkanFilterLokal;
if (typeof renderProdukList === 'function') window.renderProdukList = renderProdukList;
if (typeof renderCardView === 'function') window.renderCardView = renderCardView;
if (typeof renderChipsGroup === 'function') window.renderChipsGroup = renderChipsGroup;
if (typeof renderTableView === 'function') window.renderTableView = renderTableView;
if (typeof getKompCellHtml === 'function') window.getKompCellHtml = getKompCellHtml;
if (typeof getSingleCellHtml === 'function') window.getSingleCellHtml = getSingleCellHtml;
if (typeof exportDataCsv === 'function') window.exportDataCsv = exportDataCsv;
if (typeof closeKpiModal === 'function') window.closeKpiModal = closeKpiModal;
if (typeof getActiveProdukDataSource === 'function') window.getActiveProdukDataSource = getActiveProdukDataSource;
if (typeof showKpiDetails === 'function') window.showKpiDetails = showKpiDetails;
if (typeof detectKategori === 'function') window.detectKategori = detectKategori;
if (typeof renderKpiChartKategori === 'function') window.renderKpiChartKategori = renderKpiChartKategori;
if (typeof getProductLocationString === 'function') window.getProductLocationString = getProductLocationString;
if (typeof exportKpiDataToCsv === 'function') window.exportKpiDataToCsv = exportKpiDataToCsv;
if (typeof sortAlphabetical === 'function') window.sortAlphabetical = sortAlphabetical;
if (typeof classifyMapItem === 'function') window.classifyMapItem = classifyMapItem;
if (typeof renderKpiListLokasi === 'function') window.renderKpiListLokasi = renderKpiListLokasi;
if (typeof filterGenericKpiTable === 'function') window.filterGenericKpiTable = filterGenericKpiTable;
if (typeof renderGenericKpiTable === 'function') window.renderGenericKpiTable = renderGenericKpiTable;
if (typeof exportCurrentGenericData === 'function') window.exportCurrentGenericData = exportCurrentGenericData;
if (typeof renderMapPopup === 'function') window.renderMapPopup = renderMapPopup;
if (typeof switchKpiMapTab === 'function') window.switchKpiMapTab = switchKpiMapTab;
if (typeof filterKpiMapTable === 'function') window.filterKpiMapTable = filterKpiMapTable;
if (typeof renderKpiMapTable === 'function') window.renderKpiMapTable = renderKpiMapTable;
if (typeof exportCurrentMapData === 'function') window.exportCurrentMapData = exportCurrentMapData;
if (typeof renderPerbaikanPopup === 'function') window.renderPerbaikanPopup = renderPerbaikanPopup;
if (typeof switchKpiPerbaikanTab === 'function') window.switchKpiPerbaikanTab = switchKpiPerbaikanTab;
if (typeof filterKpiPerbaikanTable === 'function') window.filterKpiPerbaikanTable = filterKpiPerbaikanTable;
if (typeof renderKpiPerbaikanTable === 'function') window.renderKpiPerbaikanTable = renderKpiPerbaikanTable;
if (typeof exportCurrentPerbaikanData === 'function') window.exportCurrentPerbaikanData = exportCurrentPerbaikanData;
if (typeof renderBlokFPopup === 'function') window.renderBlokFPopup = renderBlokFPopup;
if (typeof switchKpiBlokFTab === 'function') window.switchKpiBlokFTab = switchKpiBlokFTab;
if (typeof filterKpiBlokFTable === 'function') window.filterKpiBlokFTable = filterKpiBlokFTable;
if (typeof renderKpiBlokFTable === 'function') window.renderKpiBlokFTable = renderKpiBlokFTable;
if (typeof exportCurrentBlokFData === 'function') window.exportCurrentBlokFData = exportCurrentBlokFData;
