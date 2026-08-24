
  let PEMINJAMAN_PRODUK_LIST = [];
  let LIVE_CHANNEL_STOCK_CACHE = [];
  let ACTIVE_STOCK_CHANNEL = 'STUDIO'; // 'STUDIO' | 'SHOPEE' | 'TIKTOK' | 'ALL'
  let CURRENT_CHANNEL_STOCK_LIST = [];
  let FILTERED_CHANNEL_STOCK_LIST = [];
  let peminjamanItemCounter = 0;
  let isPeminjamanInitialized = false;

  function switchPeminjamanMobileTab(tab) {
    const container = document.querySelector('.peminjaman-split-container');
    const btnForm = document.getElementById('mobileTabForm');
    const btnStok = document.getElementById('mobileTabStok');
    if (!container) return;

    if (tab === 'stok') {
      container.classList.remove('tab-form-active');
      container.classList.add('tab-stok-active');
      if (btnForm) btnForm.classList.remove('active');
      if (btnStok) btnStok.classList.add('active');
    } else {
      container.classList.remove('tab-stok-active');
      container.classList.add('tab-form-active');
      if (btnForm) btnForm.classList.add('active');
      if (btnStok) btnStok.classList.remove('active');
    }
  }

  function initPeminjamanView() {
    if (!isPeminjamanInitialized) {
      isPeminjamanInitialized = true;
      const tglEl = document.getElementById('tglPinjam');
      if (tglEl && !tglEl.value) tglEl.value = new Date().toISOString().slice(0, 10);
      
      syncPeminjamanWithMasterStore();
      loadPeminjamanInitData(false);
    }
  }

  function extractExactLocationStocks(p) {
    let studioQty = 0;
    let shpQty = 0;
    let ttkQty = 0;
    let mapQty = 0;

    if (p.komparasi) {
      if (p.komparasi.MAP) mapQty = Number(p.komparasi.MAP.fisik || 0);
      if (p.komparasi.STUDIO) studioQty = Math.max(studioQty, Number(p.komparasi.STUDIO.fisik || 0));
      if (p.komparasi.LIVE) studioQty = Math.max(studioQty, Number(p.komparasi.LIVE.fisik || 0));
    }

    if (p.singles) {
      if (p.singles.SHP) shpQty = Math.max(shpQty, Number(p.singles.SHP || 0));
      if (p.singles.TTK) ttkQty = Math.max(ttkQty, Number(p.singles.TTK || 0));
    }

    // Scan murni berdasarkan kriteria LOKASI fisik di sheet STOCK
    if (Array.isArray(p.locList)) {
      p.locList.forEach(function (l) {
        let locName = '';
        let qtyVal = 0;
        if (typeof l === 'object' && l !== null) {
          locName = String(l.lokasi || '').toUpperCase().trim();
          qtyVal = Number(l.qty || 0);
        } else if (typeof l === 'string') {
          const parts = l.split(':');
          locName = String(parts[0] || '').toUpperCase().trim();
          qtyVal = Number(parts[1] || 0);
        }

        if (qtyVal <= 0) return;

        // 1. Lokasi Khusus STUDIO / SAMPLE
        if (locName.includes('STUDIO') || locName === 'SAMPLE STUDIO' || locName === 'SAMPLE' || locName === 'LIVE') {
          studioQty = Math.max(studioQty, qtyVal);
        }
        // 2. Lokasi Khusus SHOPEE (SHP)
        else if (locName.includes('SHOPEE') || locName === 'SHP' || locName.includes('LIVE SHOPEE')) {
          shpQty = Math.max(shpQty, qtyVal);
        }
        // 3. Lokasi Khusus TIKTOK (TTK)
        else if (locName.includes('TIKTOK') || locName === 'TTK' || locName === 'TT' || locName.includes('LIVE TIKTOK')) {
          ttkQty = Math.max(ttkQty, qtyVal);
        }
      });
    }

    return {
      map: mapQty,
      studio: studioQty,
      shp: shpQty,
      ttk: ttkQty
    };
  }

  function syncPeminjamanWithMasterStore() {
    const master = window.WMS_MASTER_DATA || ALL_PRODUK_DATA || [];
    if (master.length > 0) {
      PEMINJAMAN_PRODUK_LIST = master.map(function (p) {
        const stocks = extractExactLocationStocks(p);

        return {
          produk: p.produk,
          size: p.size,
          sku: p.sku,
          stok: stocks.map,
          stokMap: stocks.map,
          stokStudio: stocks.studio,
          stokShp: stocks.shp,
          stokTtk: stocks.ttk,
          lokasi: 'MAP'
        };
      });

      if (peminjamanItemCounter === 0) tambahItemPeminjaman();
      buildChannelStockList(ACTIVE_STOCK_CHANNEL);
    }
  }

  window.addEventListener('wms-master-data-loaded', function() {
    syncPeminjamanWithMasterStore();
  });

  function switchStockChannel(channel, btn) {
    ACTIVE_STOCK_CHANNEL = channel;
    document.querySelectorAll('.stock-ch-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const headingEl = document.getElementById('stokChannelHeading');
    if (headingEl) {
      if (channel === 'STUDIO') headingEl.textContent = '📍 STOK TERSEDIA DI STUDIO (BLOK F)';
      else if (channel === 'SHOPEE') headingEl.textContent = '🧡 STOK TERSEDIA DI SHOPEE (SHP)';
      else if (channel === 'TIKTOK') headingEl.textContent = '🖤 STOK TERSEDIA DI TIKTOK (TTK)';
      else headingEl.textContent = '🌐 GABUNGAN STOK (STUDIO / SHP / TTK)';
    }

    buildChannelStockList(channel);
  }

  function getProductLocationStringPeminjaman(locList) {
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

  function sortPeminjamanAlphabetical(a, b) {
    const comp = String(a.produk || '').localeCompare(String(b.produk || ''), undefined, { sensitivity: 'base' });
    if (comp !== 0) return comp;
    return String(a.sku || '').localeCompare(String(b.sku || ''));
  }

  function buildChannelStockList(channel) {
    const master = window.WMS_MASTER_DATA || ALL_PRODUK_DATA || [];
    let list = [];

    if (master.length > 0) {
      master.forEach(function (p) {
        const stocks = extractExactLocationStocks(p);
        const studioQty = stocks.studio;
        const shpQty = stocks.shp;
        const ttkQty = stocks.ttk;

        let include = false;
        if (channel === 'STUDIO' && studioQty > 0) include = true;
        else if (channel === 'SHOPEE' && shpQty > 0) include = true;
        else if (channel === 'TIKTOK' && ttkQty > 0) include = true;
        else if (channel === 'ALL' && (studioQty > 0 || shpQty > 0 || ttkQty > 0)) include = true;

        if (include) {
          list.push({
            produk: p.produk,
            size: p.size,
            sku: p.sku,
            locStr: getProductLocationStringPeminjaman(p.locList),
            studioQty: studioQty,
            shpQty: shpQty,
            ttkQty: ttkQty,
            totalQty: studioQty + shpQty + ttkQty
          });
        }
      });
    } else if (LIVE_CHANNEL_STOCK_CACHE && LIVE_CHANNEL_STOCK_CACHE.length > 0) {
      LIVE_CHANNEL_STOCK_CACHE.forEach(function (p) {
        let include = false;
        if (channel === 'STUDIO' && p.studioQty > 0) include = true;
        else if (channel === 'SHOPEE' && p.shpQty > 0) include = true;
        else if (channel === 'TIKTOK' && p.ttkQty > 0) include = true;
        else if (channel === 'ALL' && (p.totalQty > 0 || p.studioQty > 0 || p.shpQty > 0 || p.ttkQty > 0)) include = true;

        if (include) {
          list.push({
            produk: p.produk,
            size: p.size,
            sku: p.sku,
            locStr: getProductLocationStringPeminjaman(p.locList),
            studioQty: p.studioQty || 0,
            shpQty: p.shpQty || 0,
            ttkQty: p.ttkQty || 0,
            totalQty: (p.studioQty || 0) + (p.shpQty || 0) + (p.ttkQty || 0)
          });
        }
      });
    }

    list.sort(sortPeminjamanAlphabetical);
    CURRENT_CHANNEL_STOCK_LIST = list;
    FILTERED_CHANNEL_STOCK_LIST = list;
    filterStudioStockSpa();
  }

  function renderStockTableByChannel(list) {
    const table = document.getElementById('peminjamanStockTable');
    const colgroup = document.getElementById('peminjamanColgroup');
    const thead = document.getElementById('peminjamanThead');
    const tbody = document.getElementById('studioTableBody');
    const sumEl = document.getElementById('studioSummary');
    if (!tbody || !thead || !colgroup) return;

    if (ACTIVE_STOCK_CHANNEL === 'ALL') {
      table.style.minWidth = '520px';
      colgroup.innerHTML = '<col style="width:auto;"><col style="width:55px;"><col style="width:110px;"><col style="width:60px;"><col style="width:60px;"><col style="width:60px;">';
      thead.innerHTML = '<tr>' +
        '<th style="text-align:left; padding-left:12px;">PRODUK</th>' +
        '<th style="text-align:center;">SIZE</th>' +
        '<th style="text-align:left; padding-left:8px;">SKU</th>' +
        '<th style="text-align:center;" title="Studio / Blok F">STUDIO</th>' +
        '<th style="text-align:center;" title="Shopee">SHP</th>' +
        '<th style="text-align:center;" title="TikTok">TTK</th>' +
      '</tr>';
    } else {
      table.style.minWidth = '420px';
      let chLabel = 'QTY';
      if (ACTIVE_STOCK_CHANNEL === 'STUDIO') chLabel = 'STUDIO';
      else if (ACTIVE_STOCK_CHANNEL === 'SHOPEE') chLabel = 'SHP';
      else if (ACTIVE_STOCK_CHANNEL === 'TIKTOK') chLabel = 'TTK';

      colgroup.innerHTML = '<col style="width:auto;"><col style="width:55px;"><col style="width:110px;"><col style="width:70px;">';
      thead.innerHTML = '<tr>' +
        '<th style="text-align:left; padding-left:12px;">PRODUK</th>' +
        '<th style="text-align:center;">SIZE</th>' +
        '<th style="text-align:left; padding-left:8px;">SKU</th>' +
        '<th style="text-align:center;">' + chLabel + '</th>' +
      '</tr>';
    }

    if (!list || list.length === 0) {
      const colSpan = ACTIVE_STOCK_CHANNEL === 'ALL' ? 6 : 4;
      tbody.innerHTML = '<tr><td colspan="' + colSpan + '" style="text-align:center; padding:30px 0; color:var(--text-muted); font-style:italic;">TIDAK ADA STOK TERSEDIA PADA PILIHAN INI</td></tr>';
      if (sumEl) sumEl.textContent = 'Total: 0 Item';
      return;
    }

    let totalPcs = 0;
    let rowsHtml = '';

    list.forEach(function (item) {
      let displaySize = item.size || '-';
      if (displaySize.toLowerCase() === 'default') displaySize = 'ALL';

      if (ACTIVE_STOCK_CHANNEL === 'ALL') {
        totalPcs += item.totalQty;
        rowsHtml += '<tr>' +
          '<td style="font-weight:600; color:var(--text); font-size:11.5px; padding-left:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + item.produk + '">' + item.produk + '</td>' +
          '<td style="text-align:center;"><span class="badge-size">' + displaySize + '</span></td>' +
          '<td style="padding-left:8px;"><span class="badge-sku">' + item.sku + '</span></td>' +
          '<td style="text-align:center; font-weight:700; color:var(--primary);">' + (item.studioQty || 0) + '</td>' +
          '<td style="text-align:center; font-weight:700; color:#e05638;">' + (item.shpQty || 0) + '</td>' +
          '<td style="text-align:center; font-weight:700; color:var(--text);">' + (item.ttkQty || 0) + '</td>' +
        '</tr>';
      } else {
        let qVal = item.studioQty;
        let qColor = 'var(--primary)';
        if (ACTIVE_STOCK_CHANNEL === 'SHOPEE') { qVal = item.shpQty; qColor = '#e05638'; }
        else if (ACTIVE_STOCK_CHANNEL === 'TIKTOK') { qVal = item.ttkQty; qColor = 'var(--text)'; }

        totalPcs += (Number(qVal) || 0);

        rowsHtml += '<tr>' +
          '<td style="font-weight:600; color:var(--text); font-size:11.5px; padding-left:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + item.produk + '">' + item.produk + '</td>' +
          '<td style="text-align:center;"><span class="badge-size">' + displaySize + '</span></td>' +
          '<td style="padding-left:8px;"><span class="badge-sku">' + item.sku + '</span></td>' +
          '<td style="text-align:center; font-weight:800; color:' + qColor + ';">' + qVal + '</td>' +
        '</tr>';
      }
    });

    if (!rowsHtml) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px 0; color:var(--text-muted); font-style:italic;">TIDAK ADA STOK PADA CHANNEL INI</td></tr>';
      if (sumEl) sumEl.innerHTML = `Total: <b style="color:var(--text);">0 SKU</b> &bull; <b style="color:var(--primary);">0 Pcs</b> Tersedia`;
      return;
    }

    tbody.innerHTML = rowsHtml;
    if (sumEl) sumEl.innerHTML = `Total: <b style="color:var(--text);">${list.length} SKU</b> &bull; <b style="color:var(--primary);">${totalPcs} Pcs</b> Tersedia`;
  }

  function filterStudioStockSpa() {
    const q = (document.getElementById('searchStudio').value || '').trim().toLowerCase();
    if (!q) {
      FILTERED_CHANNEL_STOCK_LIST = CURRENT_CHANNEL_STOCK_LIST;
      renderStockTableByChannel(CURRENT_CHANNEL_STOCK_LIST);
      return;
    }
    const keywords = q.split(/\s+/).filter(Boolean);
    const filtered = CURRENT_CHANNEL_STOCK_LIST.filter(function (item) {
      const text = (item.produk + ' ' + item.sku + ' ' + (item.size || '') + ' ' + (item.locStr || '')).toLowerCase();
      return keywords.every(kw => text.includes(kw));
    });
    FILTERED_CHANNEL_STOCK_LIST = filtered;
    renderStockTableByChannel(filtered);
  }

  function exportPeminjamanStockData() {
    const dataToExport = FILTERED_CHANNEL_STOCK_LIST || CURRENT_CHANNEL_STOCK_LIST || [];
    if (!dataToExport || dataToExport.length === 0) {
      if (window.showWmsToast) showWmsToast('Tidak ada data untuk diexport', 'warning');
      else alert('Tidak ada data untuk diexport');
      return;
    }

    let headers = [];
    let rows = [];

    if (ACTIVE_STOCK_CHANNEL === 'ALL') {
      headers = ['PRODUK', 'SIZE', 'SKU', 'LOKASI / RAK', 'STUDIO', 'SHOPEE', 'TIKTOK', 'TOTAL QTY'];
      rows = dataToExport.map(item => [
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
      headers = ['PRODUK', 'SIZE', 'SKU', 'LOKASI / RAK', `QTY ${ACTIVE_STOCK_CHANNEL}`];
      rows = dataToExport.map(item => {
        let q = item.studioQty || 0;
        if (ACTIVE_STOCK_CHANNEL === 'SHOPEE') q = item.shpQty || 0;
        else if (ACTIVE_STOCK_CHANNEL === 'TIKTOK') q = item.ttkQty || 0;
        return [
          item.produk,
          item.size,
          item.sku,
          item.locStr || '-',
          q
        ];
      });
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
    const cleanName = `stok_peminjaman_${ACTIVE_STOCK_CHANNEL.toLowerCase()}`;
    link.setAttribute('download', `${cleanName}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (window.showWmsToast) showWmsToast(`Data stok peminjaman (${ACTIVE_STOCK_CHANNEL}) berhasil diexport!`, 'success');
  }

  function refreshStockPeminjaman(btn) {
    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'REFRESH...');
    if (window.showWmsToast) window.showWmsToast('Menyinkronkan data stok peminjaman dari server...', 'info');

    if (typeof muatDataProduk === 'function') {
      muatDataProduk(true, function() {
        loadPeminjamanInitData(true);
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      });
    } else {
      loadPeminjamanInitData(true);
      setTimeout(function() {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        if (window.showWmsToast) window.showWmsToast('Data stok peminjaman diperbarui!', 'success');
      }, 1200);
    }
  }

  function loadPeminjamanInitData(isRefresh) {
    google.script.run.withSuccessHandler(function (data) {
      if (data) {
        if (data.produkList && data.produkList.length > 0) {
          PEMINJAMAN_PRODUK_LIST = data.produkList;
          if (peminjamanItemCounter === 0) tambahItemPeminjaman();
        }
        if (data.liveStockList && data.liveStockList.length > 0) {
          LIVE_CHANNEL_STOCK_CACHE = data.liveStockList;
          buildChannelStockList(ACTIVE_STOCK_CHANNEL);
        }
      }
    }).withFailureHandler(function (err) {
      if (PEMINJAMAN_PRODUK_LIST.length === 0) {
        if (window.showWmsToast) window.showWmsToast('Gagal memuat data awal: ' + err.message, 'error');
      }
    }).getPeminjamanInitData();
  }

  // ============ FORM ITEM COMBOBOX & MULTI-ROW ============
  function tambahItemPeminjaman() {
    peminjamanItemCounter++;
    const id = 'p_item_' + peminjamanItemCounter;

    const card = document.createElement('div');
    card.className = 'prod-card';
    card.id = id;
    card.style.padding = '12px 14px';
    card.style.background = 'var(--card-alt)';
    card.style.border = '1px solid var(--border)';
    card.style.borderRadius = 'var(--radius-md)';
    card.innerHTML =
      '<div class="peminjaman-item-grid">' +
        '<div style="position:relative;">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">' +
            '<label style="font-size:10.5px; font-weight:700; color:var(--text-muted);">PILIH PRODUK &amp; SIZE <span style="color:var(--danger);">*</span></label>' +
            '<span class="stokInfo" style="font-size:10.5px; font-weight:700; display:none;"></span>' +
          '</div>' +
          '<input type="text" class="search-input produkInput" placeholder="Ketik nama produk / SKU..." autocomplete="off" style="height:38px; font-size:12px; width:100%;">' +
          '<div class="combo-panel" id="' + id + '_panel" style="position:absolute; top:calc(100% + 2px); left:0; right:0; max-height:240px; overflow-y:auto; background:var(--card); border:1px solid var(--border); border-radius:6px; box-shadow:var(--shadow); z-index:1000; display:none;"></div>' +
        '</div>' +
        '<div class="peminjaman-item-actions">' +
          '<div>' +
            '<label style="display:block; font-size:10.5px; font-weight:700; color:var(--text-muted); margin-bottom:4px;">QTY <span style="color:var(--danger);">*</span></label>' +
            '<div style="display:flex; border:1px solid var(--border); border-radius:6px; background:var(--input-bg); overflow:hidden; height:38px;">' +
              '<button type="button" class="qtyMin" style="width:34px; border:none; background:transparent; color:var(--primary); font-weight:700; font-size:14px; cursor:pointer;">−</button>' +
              '<input type="number" class="qtyInput" value="1" min="1" style="width:100%; border:none; background:transparent; text-align:center; font-weight:700; font-size:13px; color:var(--text);">' +
              '<button type="button" class="qtyPlus" style="width:34px; border:none; background:transparent; color:var(--primary); font-weight:700; font-size:14px; cursor:pointer;">+</button>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label style="display:block; font-size:10.5px; font-weight:700; color:transparent; margin-bottom:4px;">AKSI</label>' +
            '<button type="button" class="btn btn-danger btn-hapus" style="height:38px; padding:0 8px; font-size:11px; width:100%;">HAPUS</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('itemContainer').appendChild(card);

    const inputEl = card.querySelector('.produkInput');
    const panelEl = card.querySelector('.combo-panel');
    const stokInfoEl = card.querySelector('.stokInfo');
    const qtyInputEl = card.querySelector('.qtyInput');

    function updateStokInfo() {
      const stok = Number(inputEl.dataset.stok);
      if (inputEl.dataset.stok === undefined || isNaN(stok)) {
        stokInfoEl.style.display = 'none';
        return;
      }
      const diminta = parseInt(qtyInputEl.value, 10) || 0;
      stokInfoEl.style.display = 'inline';
      if (stok <= 0) {
        stokInfoEl.style.color = 'var(--danger)';
        stokInfoEl.textContent = '❌ MAP KOSONG';
      } else if (diminta > stok) {
        stokInfoEl.style.color = 'var(--warning)';
        stokInfoEl.textContent = '⚠️ SISA MAP: ' + stok;
      } else {
        stokInfoEl.style.color = 'var(--success)';
        stokInfoEl.textContent = '✅ STOK MAP: ' + stok;
      }
    }

    function renderCombo(filteredList) {
      panelEl.innerHTML = '';
      if (filteredList.length === 0) {
        panelEl.innerHTML = '<div style="padding:16px; font-size:12px; color:var(--text-muted); text-align:center; font-style:italic;">Produk tidak ditemukan</div>';
        return;
      }
      filteredList.slice(0, 35).forEach(function (opt, idx) {
        const div = document.createElement('div');
        div.className = 'combo-option-item';
        div.dataset.index = idx;
        div.style.padding = '10px 14px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid var(--border-subtle)';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '6px';
        div.style.color = 'var(--text)';
        div.style.transition = 'all 0.15s ease';

        const displaySize = opt.size && opt.size.toUpperCase() !== 'DEFAULT' ? opt.size : 'ALL';

        div.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div style="font-weight:700; font-size:12.5px; line-height:1.3; color:var(--text);">${opt.value || opt.label}</div>
            <div style="display:flex; gap:5px; align-items:center; flex-shrink:0;">
              <span class="badge-size" style="font-size:10px; padding:2px 6px;">${displaySize}</span>
              <span class="badge-sku" style="font-size:10.5px; font-family:'JetBrains Mono',monospace; padding:2px 6px;">${opt.sku}</span>
            </div>
          </div>
          <div style="display:flex; gap:5px; font-size:10px; font-weight:700; flex-wrap:wrap;">
            <span style="background:var(--primary-light); color:var(--primary); padding:2px 7px; border-radius:4px;">🏢 MAP: ${opt.stokMap !== undefined ? opt.stokMap : opt.stok}</span>
            <span style="background:var(--card-alt); color:var(--text); padding:2px 7px; border:1px solid var(--border); border-radius:4px;">📍 Studio: ${opt.stokStudio || 0}</span>
            <span style="background:rgba(224,86,56,0.12); color:#e05638; padding:2px 7px; border-radius:4px;">🧡 SHP: ${opt.stokShp || 0}</span>
            <span style="background:rgba(0,0,0,0.06); color:var(--text); padding:2px 7px; border-radius:4px;">🖤 TTK: ${opt.stokTtk || 0}</span>
          </div>
        `;

        function selectItem(e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          inputEl.value = opt.label;
          inputEl.dataset.value = opt.value;
          inputEl.dataset.stok = opt.stokMap !== undefined ? opt.stokMap : opt.stok;
          inputEl.dataset.size = opt.size;
          inputEl.dataset.sku = opt.sku;
          inputEl.dataset.lokasi = opt.lokasi;
          panelEl.style.display = 'none';
          updateStokInfo();
        }

        div.addEventListener('pointerdown', selectItem);
        div.addEventListener('mousedown', selectItem);

        panelEl.appendChild(div);
      });
    }

    let activeComboIndex = -1;

    function getFilteredOpts() {
      const q = inputEl.value.trim().toLowerCase();
      const kw = q.split(/\s+/).filter(Boolean);
      const opts = PEMINJAMAN_PRODUK_LIST.map(p => {
        const label = p.size && p.size.toUpperCase() !== 'DEFAULT' ? (p.produk + ' - ' + p.size) : p.produk;
        return {
          label: label,
          value: p.produk,
          size: p.size,
          sku: p.sku,
          stok: p.stok,
          stokMap: p.stokMap,
          stokStudio: p.stokStudio,
          stokShp: p.stokShp,
          stokTtk: p.stokTtk,
          lokasi: p.lokasi
        };
      });
      return kw.length === 0 ? opts : opts.filter(o => {
        const teks = (o.label + ' ' + (o.sku || '')).toLowerCase();
        return kw.every(k => teks.includes(k));
      });
    }

    inputEl.addEventListener('input', function () {
      activeComboIndex = -1;
      const filtered = getFilteredOpts();
      renderCombo(filtered);
      panelEl.style.display = 'block';
    });

    inputEl.addEventListener('focus', function () {
      activeComboIndex = -1;
      const filtered = getFilteredOpts();
      renderCombo(filtered);
      panelEl.style.display = 'block';
    });

    // Desktop Keyboard Arrow Navigation (Up, Down, Enter, Escape)
    inputEl.addEventListener('keydown', function (e) {
      const items = panelEl.querySelectorAll('.combo-option-item');
      if (items.length === 0 || panelEl.style.display === 'none') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeComboIndex = (activeComboIndex + 1) % items.length;
        updateActiveItem();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeComboIndex = (activeComboIndex - 1 + items.length) % items.length;
        updateActiveItem();
      } else if (e.key === 'Enter') {
        if (activeComboIndex >= 0 && activeComboIndex < items.length) {
          e.preventDefault();
          items[activeComboIndex].dispatchEvent(new Event('mousedown'));
        }
      } else if (e.key === 'Escape') {
        panelEl.style.display = 'none';
      }

      function updateActiveItem() {
        items.forEach((it, idx) => {
          if (idx === activeComboIndex) {
            it.style.background = 'var(--card-alt)';
            it.style.borderLeft = '3px solid var(--primary)';
            it.style.paddingLeft = '11px';
            it.scrollIntoView({ block: 'nearest' });
          } else {
            it.style.background = 'transparent';
            it.style.borderLeft = 'none';
            it.style.paddingLeft = '14px';
          }
        });
      }
    });

    document.addEventListener('click', function (e) {
      if (!card.contains(e.target)) panelEl.style.display = 'none';
    });

    qtyInputEl.addEventListener('input', updateStokInfo);

    card.querySelector('.qtyMin').addEventListener('click', function () {
      qtyInputEl.value = Math.max(1, (parseInt(qtyInputEl.value, 10) || 1) - 1);
      updateStokInfo();
    });

    card.querySelector('.qtyPlus').addEventListener('click', function () {
      qtyInputEl.value = (parseInt(qtyInputEl.value, 10) || 1) + 1;
      updateStokInfo();
    });

    card.querySelector('.btn-hapus').addEventListener('click', function () {
      if (document.querySelectorAll('#itemContainer .prod-card').length <= 1) return;
      card.remove();
    });
  }

  document.getElementById('btnTambahItemAtas').addEventListener('click', tambahItemPeminjaman);
  document.getElementById('btnTambahItemBawah').addEventListener('click', tambahItemPeminjaman);

  function submitFormPeminjamanSpa() {
    const namaPeminjam = document.getElementById('namaPeminjam').value.trim();
    const keperluan = document.getElementById('keperluan').value.trim();
    const tglPinjam = document.getElementById('tglPinjam').value;

    const items = [];
    document.querySelectorAll('#itemContainer .prod-card').forEach(function (card) {
      const produkInput = card.querySelector('.produkInput');
      const produk = produkInput.value.trim();
      const size = produkInput.dataset.size || '';
      const sku = produkInput.dataset.sku || '';
      const lokasi = produkInput.dataset.lokasi || '';
      const qty = parseInt(card.querySelector('.qtyInput').value, 10) || 0;

      if (produk) {
        items.push({ produk: produk, size: size, sku: sku, lokasi: lokasi, qty: qty });
      }
    });

    if (!namaPeminjam) { if (window.showWmsToast) window.showWmsToast('NAMA / PIC PEMINJAM WAJIB DIISI.', 'error'); return; }
    if (!keperluan) { if (window.showWmsToast) window.showWmsToast('KEPERLUAN WAJIB DIISI.', 'error'); return; }
    if (!tglPinjam) { if (window.showWmsToast) window.showWmsToast('TANGGAL PINJAM WAJIB DIISI.', 'error'); return; }
    if (items.length === 0) { if (window.showWmsToast) window.showWmsToast('MINIMAL 1 ITEM DENGAN PRODUK TERPILIH.', 'error'); return; }

    const btn = document.getElementById('btnSubmitPeminjaman');
    if (window.setButtonLoading) window.setButtonLoading(btn, true, 'MEMPROSES PENGAJUAN...');

    google.script.run.withSuccessHandler(function (res) {
      if (window.setButtonLoading) window.setButtonLoading(btn, false);
      if (res.success) {
        if (window.showWmsToast) window.showWmsToast(res.message || 'Peminjaman berhasil diajukan!', 'success');
        document.getElementById('namaPeminjam').value = '';
        document.getElementById('keperluan').value = '';
        document.getElementById('itemContainer').innerHTML = '';
        peminjamanItemCounter = 0;
        tambahItemPeminjaman();
        // Otomatis refresh stok lokal dan master
        if (typeof muatDataProduk === 'function') muatDataProduk();
      } else {
        if (window.showWmsToast) window.showWmsToast(res.message || 'Gagal mengajukan peminjaman', 'error');
      }
    }).withFailureHandler(function (err) {
      if (window.setButtonLoading) window.setButtonLoading(btn, false);
      if (window.showWmsToast) window.showWmsToast('GAGAL MENGIRIM: ' + err.message, 'error');
    }).submitPeminjaman({
      namaPeminjam: namaPeminjam,
      keperluan: keperluan,
      tglPinjam: tglPinjam,
      items: items,
      token: TOKEN
    });
  }

