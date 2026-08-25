
  // ========================================================
  // STOCK OPNAME & ADJUSTMENT CONTROLLER (ANIMATED & AUTO-REFRESH)
  // ========================================================
  let isProcessingSo = false;
  let soKeranjang = [];
  let soManualKeranjang = [];
  let isStockOpnameInitialized = false;

  function initStockOpnameView() {
    isStockOpnameInitialized = true;
    syncStockOpnameWithMasterData();
  }

  function syncStockOpnameWithMasterData() {
    const masterList = window.WMS_MASTER_DATA || ALL_PRODUK_DATA || [];
    const statusEl = document.getElementById('soMasterDataStatus');

    if (masterList.length > 0) {
      if (statusEl) statusEl.innerHTML = `⚡ <b>${masterList.length.toLocaleString('id-ID')} Produk</b> siap &bull; 0ms`;
      populateLokasiDatalist();
    } else {
      if (statusEl) statusEl.textContent = '⏳ Sinkronisasi data master...';
    }
  }

  window.addEventListener('wms-master-data-loaded', function () {
    syncStockOpnameWithMasterData();
  });

  function populateLokasiDatalist() {
    const locList = window.WMS_LOKASI_LIST || [];
    const dlLok = document.getElementById('listLokasiSo');
    if (dlLok && locList.length > 0) {
      dlLok.innerHTML = '';
      locList.forEach(function (l) {
        const opt = document.createElement('option');
        opt.value = l;
        dlLok.appendChild(opt);
      });
    }
  }

  function refreshStockOpnameMaster(btn) {
    if (window.setButtonLoading) window.setButtonLoading(btn, true, 'SINKRONISASI...');
    if (window.showWmsToast) window.showWmsToast('Menyinkronkan master data dari server...', 'info');
    if (typeof muatDataProduk === 'function') {
      muatDataProduk();
    }
    setTimeout(function() {
      if (window.setButtonLoading) window.setButtonLoading(btn, false);
      if (window.showWmsToast) window.showWmsToast('Master data berhasil disinkronkan!', 'success');
    }, 1200);
  }

  function switchSoTab(tabName, btn) {
    document.querySelectorAll('.so-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.so-tab-content').forEach(c => {
      c.style.display = 'none';
      c.classList.remove('active');
    });

    if (btn) btn.classList.add('active');
    const target = document.getElementById('so-tab-' + tabName);
    if (target) {
      target.style.display = 'block';
      target.classList.add('active');
    }

    if (tabName === 'approval') muatPending();
  }

  // ========================================================
  // FAST AUTO-SUGGEST COMBOBOX (SEARCH ACROSS 5,000+ PRODUCTS)
  // ========================================================
  function setupProductCombobox(wrapId, inputId, panelId, onSelectCallback) {
    const wrap = document.getElementById(wrapId);
    const input = document.getElementById(inputId);
    const panel = document.getElementById(panelId);
    if (!wrap || !input || !panel) return;

    function renderOptions(query) {
      const masterList = window.WMS_MASTER_DATA || ALL_PRODUK_DATA || [];
      const q = (query || '').trim().toLowerCase();
      const keywords = q.split(/\s+/).filter(Boolean);

      let matched = [];
      if (keywords.length === 0) {
        matched = masterList.slice(0, 40);
      } else {
        matched = masterList.filter(function (item) {
          const text = (item.sku + ' ' + item.produk + ' ' + (item.size || '')).toLowerCase();
          return keywords.every(kw => text.includes(kw));
        });
      }

      if (matched.length === 0) {
        panel.innerHTML = '<div style="padding:12px; text-align:center; font-size:12px; color:var(--text-muted); font-style:italic;">Tidak ada produk yang cocok dengan pencarian</div>';
        panel.style.display = 'block';
        return;
      }

      const totalMatches = matched.length;
      const displayItems = matched.slice(0, 50);

      let html = '<div style="padding:6px 14px; font-size:10.5px; font-weight:700; color:var(--text-muted); background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between;">' +
        '<span>HASIL PENCARIAN</span><span>Menampilkan ' + displayItems.length + ' dari ' + totalMatches + ' produk</span></div>';

      displayItems.forEach(function (item, idx) {
        const displaySize = item.size && item.size.toUpperCase() !== 'DEFAULT' && item.size !== '-' ? item.size : 'ALL';
        
        let locSummary = '';
        if (Array.isArray(item.locList) && item.locList.length > 0) {
          locSummary = item.locList.slice(0, 4).map(l => {
            const locStr = (typeof l === 'object' && l.lokasi) ? l.lokasi : String(l).split(':')[0];
            const qStr = (typeof l === 'object' && l.qty !== undefined) ? l.qty : String(l).split(':')[1];
            return `<span style="font-size:10px; color:var(--primary); font-weight:700; background:var(--primary-light); padding:2px 6px; border-radius:4px;">📍 ${locStr}: ${qStr || 0}</span>`;
          }).join(' ');
        } else {
          locSummary = '<span style="font-size:10px; color:var(--text-dim); font-style:italic;">Belum ada lokasi rak tercatat</span>';
        }

        html += '<div class="combo-opt-item" data-index="' + idx + '" style="padding:10px 14px; border-bottom:1px solid var(--border-subtle); cursor:pointer; display:flex; flex-direction:column; gap:6px; transition:all 0.15s ease;" data-sku="' + item.sku + '">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">' +
            '<div style="font-size:12.5px; color:var(--text); font-weight:700; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + item.produk + '</div>' +
            '<div style="display:flex; gap:5px; align-items:center; flex-shrink:0;">' +
              '<span class="badge-size" style="font-size:10px; padding:2px 6px;">' + displaySize + '</span>' +
              '<span class="badge-sku" style="font-size:10.5px; font-family:\'JetBrains Mono\',monospace; padding:2px 6px;">' + item.sku + '</span>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex; gap:5px; flex-wrap:wrap;">' +
            locSummary +
          '</div>' +
        '</div>';
      });

      panel.innerHTML = html;
      panel.style.display = 'block';

      let activeOptIndex = -1;

      panel.querySelectorAll('.combo-opt-item').forEach(function (el) {
        function chooseItem(e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          const selectedSku = el.getAttribute('data-sku');
          const found = (window.WMS_SKU_MAP && window.WMS_SKU_MAP[selectedSku]) || masterList.find(x => x.sku === selectedSku);
          if (found) {
            input.value = found.sku;
            panel.style.display = 'none';
            if (onSelectCallback) onSelectCallback(found);
          }
        }
        el.addEventListener('pointerdown', chooseItem);
        el.addEventListener('mousedown', chooseItem);
      });
    }

    let activeOptIndex = -1;

    input.addEventListener('input', function () {
      activeOptIndex = -1;
      renderOptions(input.value);
    });

    input.addEventListener('focus', function () {
      activeOptIndex = -1;
      renderOptions(input.value);
    });

    // Keyboard Arrow Navigation
    input.addEventListener('keydown', function (e) {
      const items = panel.querySelectorAll('.combo-opt-item');
      if (items.length === 0 || panel.style.display === 'none') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeOptIndex = (activeOptIndex + 1) % items.length;
        highlightOption();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeOptIndex = (activeOptIndex - 1 + items.length) % items.length;
        highlightOption();
      } else if (e.key === 'Enter') {
        if (activeOptIndex >= 0 && activeOptIndex < items.length) {
          e.preventDefault();
          items[activeOptIndex].dispatchEvent(new Event('mousedown'));
        }
      } else if (e.key === 'Escape') {
        panel.style.display = 'none';
      }

      function highlightOption() {
        items.forEach((it, idx) => {
          if (idx === activeOptIndex) {
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
      if (!wrap.contains(e.target)) {
        panel.style.display = 'none';
      }
    });
  }

  // ============ LIVE PREVIEW NAMA PRODUK ============
  function updateOpnameProductInfo(item) {
    const infoEl = document.getElementById('opnameProductInfo');
    if (!infoEl) return;
    if (!item) {
      infoEl.style.display = 'none';
      infoEl.innerHTML = '';
      return;
    }
    const sizeStr = (item.size && item.size !== '-' && item.size !== 'DEFAULT') ? `<span class="badge-size" style="font-size:9.5px; padding:1px 5px; margin-left:4px;">${item.size}</span>` : '';
    infoEl.innerHTML = `📦 <b>${item.produk || item.namaProduk || ''}</b> ${sizeStr}`;
    infoEl.style.display = 'block';
  }

  function updateManualProductInfo(item) {
    const infoEl = document.getElementById('manualProductInfo');
    if (!infoEl) return;
    if (!item) {
      infoEl.style.display = 'none';
      infoEl.innerHTML = '';
      return;
    }
    const sizeStr = (item.size && item.size !== '-' && item.size !== 'DEFAULT') ? `<span class="badge-size" style="font-size:9.5px; padding:1px 5px; margin-left:4px;">${item.size}</span>` : '';
    infoEl.innerHTML = `📦 <b>${item.produk || item.namaProduk || ''}</b> ${sizeStr}`;
    infoEl.style.display = 'block';
  }

  // Pasang fast autocomplete combobox pada tab Opname & Manual
  setupProductCombobox('wrapOpnameSku', 'opnameSku', 'opnameSkuPanel', function (item) {
    updateOpnameProductInfo(item);
    if (Array.isArray(item.locList) && item.locList.length > 0) {
      const firstLoc = typeof item.locList[0] === 'object' ? item.locList[0].lokasi : String(item.locList[0]).split(':')[0];
      const locInput = document.getElementById('opnameLokasi');
      if (locInput && !locInput.value && firstLoc) {
        locInput.value = firstLoc;
      }
    }
    cekQtySistem();
  });

  setupProductCombobox('wrapManualSku', 'manualSku', 'manualSkuPanel', function (item) {
    updateManualProductInfo(item);
    if (Array.isArray(item.locList) && item.locList.length > 0) {
      const firstLoc = typeof item.locList[0] === 'object' ? item.locList[0].lokasi : String(item.locList[0]).split(':')[0];
      const locInput = document.getElementById('manualLokasi');
      if (locInput && !locInput.value && firstLoc) {
        locInput.value = firstLoc;
      }
    }
  });

  const manSkuInputEl = document.getElementById('manualSku');
  if (manSkuInputEl) {
    manSkuInputEl.addEventListener('input', function() {
      const sku = (this.value || '').trim().toUpperCase();
      const masterList = window.WMS_MASTER_DATA || ALL_PRODUK_DATA || [];
      const found = (window.WMS_SKU_MAP && window.WMS_SKU_MAP[sku]) || masterList.find(x => x.sku === sku);
      updateManualProductInfo(found);
    });
  }

  const opnSkuInputEl = document.getElementById('opnameSku');
  if (opnSkuInputEl) {
    opnSkuInputEl.addEventListener('input', function() {
      const sku = (this.value || '').trim().toUpperCase();
      const masterList = window.WMS_MASTER_DATA || ALL_PRODUK_DATA || [];
      const found = (window.WMS_SKU_MAP && window.WMS_SKU_MAP[sku]) || masterList.find(x => x.sku === sku);
      updateOpnameProductInfo(found);
    });
  }

  // ============ LIVE CHECK QTY SISTEM (0ms IN-MEMORY + BACKGROUND VERIFICATION) ============
  const opSkuEl = document.getElementById('opnameSku');
  const opLokEl = document.getElementById('opnameLokasi');
  if (opSkuEl) opSkuEl.addEventListener('change', cekQtySistem);
  if (opLokEl) opLokEl.addEventListener('change', cekQtySistem);

  function cekQtySistem() {
    const sku = (document.getElementById('opnameSku').value || '').trim().toUpperCase();
    const lokasi = (document.getElementById('opnameLokasi').value || '').trim().toUpperCase();
    const badge = document.getElementById('qtySistemBadge');
    if (!badge) return;

    if (!sku || !lokasi) {
      badge.innerText = 'Qty sistem: -';
      return;
    }

    let localQty = null;
    if (window.WMS_SKU_MAP && window.WMS_SKU_MAP[sku]) {
      const prod = window.WMS_SKU_MAP[sku];
      if (Array.isArray(prod.locList)) {
        prod.locList.forEach(function (l) {
          const lStr = typeof l === 'object' ? String(l.lokasi || '').toUpperCase() : String(l || '').split(':')[0].toUpperCase();
          const qVal = typeof l === 'object' ? Number(l.qty || 0) : Number(String(l || '').split(':')[1] || 0);
          if (lStr === lokasi) localQty = qVal;
        });
      }
    }

    if (localQty !== null) {
      badge.innerHTML = `Qty sistem: <b>${localQty} pcs</b> (lokal)`;
    } else {
      badge.innerText = 'Qty sistem: mengecek server...';
    }

    google.script.run.withSuccessHandler(function (res) {
      if (res && res.success && badge) {
        badge.innerHTML = `Qty sistem: <b>${res.qtySistem} pcs</b>`;
      }
    }).getWmsQtySistem(TOKEN, sku, lokasi);
  }

  // ============ INPUT OPNAME KERANJANG ============
  function tambahKeKeranjang() {
    const sku = (document.getElementById('opnameSku').value || '').trim().toUpperCase();
    const lokasi = (document.getElementById('opnameLokasi').value || '').trim();
    const qtyFisik = Number(document.getElementById('opnameQty').value);

    if (!sku) { if (window.showWmsToast) window.showWmsToast('SKU wajib diisi.', 'error'); return; }
    if (!lokasi) { if (window.showWmsToast) window.showWmsToast('Lokasi wajib diisi.', 'error'); return; }
    if (isNaN(qtyFisik) || document.getElementById('opnameQty').value === '') {
      if (window.showWmsToast) window.showWmsToast('Qty fisik wajib diisi angka.', 'error'); return;
    }

    const masterList = window.WMS_MASTER_DATA || ALL_PRODUK_DATA || [];
    const found = (window.WMS_SKU_MAP && window.WMS_SKU_MAP[sku]) || masterList.find(x => x.sku === sku);
    const namaProduk = found ? found.produk : sku;

    const dupIdx = soKeranjang.findIndex(item => item.sku === sku && item.lokasi === lokasi);
    if (dupIdx !== -1) {
      soKeranjang[dupIdx].qtyFisik = qtyFisik;
      soKeranjang[dupIdx].namaProduk = namaProduk;
      if (window.showWmsToast) window.showWmsToast(`SKU ${sku} di lokasi ${lokasi} diperbarui (${qtyFisik} pcs).`, 'info');
    } else {
      soKeranjang.push({ sku: sku, namaProduk: namaProduk, lokasi: lokasi, qtyFisik: qtyFisik });
      if (window.showWmsToast) window.showWmsToast(`Item ${sku} ditambahkan ke sesi.`, 'success');
    }

    renderKeranjang();
    document.getElementById('opnameQty').value = '';
    document.getElementById('qtySistemBadge').innerText = 'Qty sistem: -';
    updateOpnameProductInfo(null);
    document.getElementById('opnameSku').focus();
  }

  function hapusItemSo(idx) {
    soKeranjang.splice(idx, 1);
    renderKeranjang();
    if (window.showWmsToast) window.showWmsToast('Item dihapus dari sesi.', 'info');
  }

  function renderKeranjang() {
    const container = document.getElementById('keranjangList');
    if (!container) return;
    if (soKeranjang.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:24px; font-style:italic; background:var(--card-alt); border:1px dashed var(--border); border-radius:var(--radius-md);">BELUM ADA ITEM DITAMBAHKAN KE SESI INI</div>';
      return;
    }
    let html = '';
    soKeranjang.forEach(function (item, idx) {
      const masterList = window.WMS_MASTER_DATA || ALL_PRODUK_DATA || [];
      const skuKey = String(item.sku || '').trim().toUpperCase();
      const found = (window.WMS_SKU_MAP && window.WMS_SKU_MAP[skuKey]) || masterList.find(x => String(x.sku || '').trim().toUpperCase() === skuKey);
      const nama = (item.namaProduk && item.namaProduk.trim()) ? item.namaProduk : (found ? found.produk : item.sku);

      html += '<div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:var(--card-alt); border:1px solid var(--border); border-radius:var(--radius-md); font-size:12px; gap:10px;">' +
        '<div style="flex:1; min-width:0;">' +
          '<div style="font-size:12.5px; font-weight:700; color:var(--text); margin-bottom:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + nama + '">' + nama + '</div>' +
          '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; font-size:11.5px;">' +
            '<span class="badge-sku" style="font-size:10.5px; padding:1px 6px;">' + item.sku + '</span>' +
            '&bull; Lokasi: <b style="color:var(--primary);">' + item.lokasi + '</b>' +
            '&bull; Qty Fisik: <b>' + item.qtyFisik + ' pcs</b>' +
          '</div>' +
        '</div>' +
        '<button class="btn btn-danger" style="height:28px; font-size:10.5px; padding:0 8px; flex-shrink:0;" onclick="hapusItemSo(' + idx + ')">HAPUS</button>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  function submitSesi(btn) {
    if (isProcessingSo) return;
    if (soKeranjang.length === 0) {
      if (window.showWmsToast) window.showWmsToast('Keranjang opname masih kosong.', 'error');
      return;
    }

    isProcessingSo = true;
    if (window.setButtonLoading) window.setButtonLoading(btn, true, 'MEMPROSES SESI OPNAME...');

    google.script.run.withSuccessHandler(function (res) {
      isProcessingSo = false;
      if (window.setButtonLoading) window.setButtonLoading(btn, false);
      if (res.success) {
        if (window.showWmsToast) window.showWmsToast('Sesi opname ' + res.sessionId + ' berhasil diajukan (' + res.count + ' item)!', 'success');
        soKeranjang = [];
        renderKeranjang();
        // Otomatis refresh master dan pending list
        if (typeof muatDataProduk === 'function') muatDataProduk();
      } else {
        if (window.showWmsToast) window.showWmsToast(res.message || 'Gagal submit sesi', 'error');
      }
    }).withFailureHandler(function (err) {
      isProcessingSo = false;
      if (window.setButtonLoading) window.setButtonLoading(btn, false);
      if (window.showWmsToast) window.showWmsToast('Gagal submit sesi: ' + err.message, 'error');
    }).submitWmsStockOpnameSesi(TOKEN, soKeranjang);
  }

  // ============ ADJUSTMENT MANUAL KERANJANG ============
  function tambahKeKeranjangManual() {
    const sku = (document.getElementById('manualSku').value || '').trim().toUpperCase();
    const lokasi = (document.getElementById('manualLokasi').value || '').trim();
    const delta = Number(document.getElementById('manualDelta').value);
    const alasan = (document.getElementById('manualAlasan').value || '').trim();

    if (!sku) { if (window.showWmsToast) window.showWmsToast('SKU wajib diisi.', 'error'); return; }
    if (!lokasi) { if (window.showWmsToast) window.showWmsToast('Lokasi wajib diisi.', 'error'); return; }
    if (!delta || isNaN(delta)) { if (window.showWmsToast) window.showWmsToast('Qty adjustment tidak boleh 0 atau kosong.', 'error'); return; }
    if (!alasan) { if (window.showWmsToast) window.showWmsToast('Alasan wajib diisi.', 'error'); return; }

    const masterList = window.WMS_MASTER_DATA || ALL_PRODUK_DATA || [];
    const found = (window.WMS_SKU_MAP && window.WMS_SKU_MAP[sku]) || masterList.find(x => x.sku === sku);
    const namaProduk = found ? found.produk : sku;

    const dupIdx = soManualKeranjang.findIndex(item => item.sku === sku && item.lokasi === lokasi);
    if (dupIdx !== -1) {
      soManualKeranjang[dupIdx].deltaQty = delta;
      soManualKeranjang[dupIdx].alasan = alasan;
      soManualKeranjang[dupIdx].namaProduk = namaProduk;
      if (window.showWmsToast) window.showWmsToast(`Adjustment ${sku} di ${lokasi} diperbarui (${delta > 0 ? '+' + delta : delta}).`, 'info');
    } else {
      soManualKeranjang.push({ sku: sku, namaProduk: namaProduk, lokasi: lokasi, deltaQty: delta, alasan: alasan });
      if (window.showWmsToast) window.showWmsToast(`Adjustment ${sku} ditambahkan ke sesi.`, 'success');
    }

    renderKeranjangManual();
    document.getElementById('manualDelta').value = '';
    document.getElementById('manualAlasan').value = '';
    updateManualProductInfo(null);
    document.getElementById('manualSku').focus();
  }

  function hapusManualItemSo(idx) {
    soManualKeranjang.splice(idx, 1);
    renderKeranjangManual();
    if (window.showWmsToast) window.showWmsToast('Item adjustment dihapus.', 'info');
  }

  function renderKeranjangManual() {
    const container = document.getElementById('manualKeranjangList');
    if (!container) return;
    if (soManualKeranjang.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:24px; font-style:italic; background:var(--card-alt); border:1px dashed var(--border); border-radius:var(--radius-md);">BELUM ADA ITEM DITAMBAHKAN</div>';
      return;
    }
    let html = '';
    soManualKeranjang.forEach(function (item, idx) {
      const color = item.deltaQty > 0 ? 'var(--success)' : 'var(--danger)';
      const sign = item.deltaQty > 0 ? '+' : '';
      const masterList = window.WMS_MASTER_DATA || ALL_PRODUK_DATA || [];
      const skuKey = String(item.sku || '').trim().toUpperCase();
      const found = (window.WMS_SKU_MAP && window.WMS_SKU_MAP[skuKey]) || masterList.find(x => String(x.sku || '').trim().toUpperCase() === skuKey);
      const nama = (item.namaProduk && item.namaProduk.trim()) ? item.namaProduk : (found ? found.produk : item.sku);

      html += '<div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:var(--card-alt); border:1px solid var(--border); border-radius:var(--radius-md); font-size:12px; gap:10px;">' +
        '<div style="flex:1; min-width:0;">' +
          '<div style="font-size:12.5px; font-weight:700; color:var(--text); margin-bottom:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + nama + '">' + nama + '</div>' +
          '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; font-size:11.5px;">' +
            '<span class="badge-sku" style="font-size:10.5px; padding:1px 6px;">' + item.sku + '</span>' +
            '&bull; Lokasi: <b style="color:var(--primary);">' + item.lokasi + '</b>' +
            '&bull; Adjustment: <b style="color:' + color + ';">' + sign + item.deltaQty + '</b>' +
          '</div>' +
          '<div style="font-size:11px; color:var(--text-muted); margin-top:3px;">Alasan: ' + item.alasan + '</div>' +
        '</div>' +
        '<button class="btn btn-danger" style="height:28px; font-size:10.5px; padding:0 8px; flex-shrink:0;" onclick="hapusManualItemSo(' + idx + ')">HAPUS</button>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  function submitManualBulk(btn) {
    if (isProcessingSo) return;
    if (soManualKeranjang.length === 0) {
      if (window.showWmsToast) window.showWmsToast('Keranjang adjustment manual kosong.', 'error');
      return;
    }

    isProcessingSo = true;
    if (window.setButtonLoading) window.setButtonLoading(btn, true, 'MEMPROSES ADJUSTMENT...');

    google.script.run.withSuccessHandler(function (res) {
      isProcessingSo = false;
      if (window.setButtonLoading) window.setButtonLoading(btn, false);
      if (res.success) {
        if (window.showWmsToast) window.showWmsToast(`Berhasil mengajukan ${res.jumlahDiproses || soManualKeranjang.length} adjustment untuk approval!`, 'success');
        soManualKeranjang = [];
        renderKeranjangManual();
        // Otomatis refresh master dan pending list
        if (typeof muatDataProduk === 'function') muatDataProduk();
      } else {
        if (window.showWmsToast) window.showWmsToast(res.message || 'Gagal submit adjustment', 'error');
      }
    }).withFailureHandler(function (err) {
      isProcessingSo = false;
      if (window.setButtonLoading) window.setButtonLoading(btn, false);
      if (window.showWmsToast) window.showWmsToast('Gagal submit: ' + err.message, 'error');
    }).submitWmsAdjustmentManualBulk(TOKEN, soManualKeranjang);
  }

  // ============ APPROVAL TAB ============
  function muatPending(btn) {
    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'REFRESHING...');
    const listEl = document.getElementById('pendingList');
    if (listEl) listEl.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:30px; font-style:italic;">Memuat data pending dari sheet Stock Opname...</div>';

    google.script.run.withSuccessHandler(function (res) {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      if (!res.success) {
        if (listEl) listEl.innerHTML = '<div style="color:var(--danger); padding:20px; text-align:center;">' + res.message + '</div>';
        return;
      }
      renderPending(res.data || []);
    }).withFailureHandler(function (err) {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      if (listEl) listEl.innerHTML = '<div style="color:var(--danger); padding:20px; text-align:center;">GAGAL MEMUAT: ' + err.message + '</div>';
    }).getWmsAdjustmentPendingList(TOKEN);
  }

  function cleanOperatorDisplay(raw) {
    if (!raw) return '-';
    let s = String(raw).trim();
    if (s.includes('@g.us')) {
      s = s.split('@')[0];
    }
    if (s.includes('|')) {
      const parts = s.split('|').map(x => x.trim()).filter(Boolean);
      if (parts.length > 0 && parts[0] !== '.' && parts[0] !== '') s = parts[0];
      else if (parts.length > 1) s = parts[1];
    }
    if (s.startsWith('.')) s = s.replace(/^\.+/, '').trim() || 'System';
    return s;
  }

  function renderPending(list) {
    const badge = document.getElementById('badgePending');
    if (badge) badge.innerText = list.length > 0 ? '(' + list.length + ')' : '';

    const listEl = document.getElementById('pendingList');
    if (!listEl) return;

    if (list.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:30px; font-style:italic;">TIDAK ADA ADJUSTMENT YANG MENUNGGU APPROVAL (SEMUA STATUS BERSIH).</div>';
      return;
    }

    const masterList = window.WMS_MASTER_DATA || ALL_PRODUK_DATA || [];

    let html = '<div class="table-scroll-wrap"><table class="unified-table" style="min-width:1180px; table-layout:fixed;">' +
      '<colgroup>' +
        '<col style="width:36px;">' +
        '<col style="width:125px;">' +
        '<col style="width:240px;">' +
        '<col style="width:75px;">' +
        '<col style="width:75px;">' +
        '<col style="width:65px;">' +
        '<col style="width:65px;">' +
        '<col style="width:70px;">' +
        '<col style="width:220px;">' +
        '<col style="width:115px;">' +
        '<col style="width:90px;">' +
      '</colgroup>' +
      '<thead><tr>' +
        '<th style="text-align:center;"><input type="checkbox" id="checkAllPending" onchange="toggleSelectAll(this)"></th>' +
        '<th style="text-align:left; padding-left:10px;">TANGGAL</th>' +
        '<th style="text-align:left; padding-left:10px;">PRODUK / SKU</th>' +
        '<th style="text-align:center;">LOKASI</th>' +
        '<th style="text-align:center;">JENIS</th>' +
        '<th style="text-align:center;">SISTEM</th>' +
        '<th style="text-align:center;">FISIK</th>' +
        '<th style="text-align:center;">SELISIH</th>' +
        '<th style="text-align:left; padding-left:10px;">ALASAN / KET</th>' +
        '<th style="text-align:left; padding-left:10px;">OPERATOR</th>' +
        '<th style="text-align:center;">AKSI</th>' +
      '</tr></thead><tbody>';

    list.forEach(function (item) {
      const deltaQty = Number(item.selisih) || 0;
      const deltaColor = deltaQty > 0 ? 'var(--success)' : 'var(--danger)';
      const sign = deltaQty > 0 ? '+' : '';
      const tgl = item.tanggal || '-';
      const opDisplay = cleanOperatorDisplay(item.operator);

      const skuKey = String(item.sku || '').trim().toUpperCase();
      const found = (window.WMS_SKU_MAP && window.WMS_SKU_MAP[skuKey]) || masterList.find(x => String(x.sku || '').trim().toUpperCase() === skuKey);
      const nama = (item.namaProduk && item.namaProduk.trim()) ? item.namaProduk : (found ? found.produk : item.sku);
      const displaySize = (item.size && item.size !== '-') ? item.size : (found && found.size && found.size !== '-' ? found.size : '');

      html += '<tr>' +
        '<td style="text-align:center;"><input type="checkbox" class="cb-pending" value="' + item.rowIndex + '"></td>' +
        '<td style="font-size:11px; color:var(--text-muted); padding-left:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + tgl + '</td>' +
        '<td style="padding-left:10px; overflow:hidden;">' +
          '<div style="font-weight:700; color:var(--text); font-size:12px; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + nama + '">' + nama + '</div>' +
          '<div style="display:flex; gap:5px; align-items:center; margin-top:2px;">' +
            '<span class="badge-sku" style="font-size:10px; padding:1px 5px;" title="' + item.sku + '">' + item.sku + '</span>' +
            (displaySize && displaySize !== 'DEFAULT' ? '<span class="badge-size" style="font-size:9.5px; padding:1px 4px;">' + displaySize + '</span>' : '') +
          '</div>' +
        '</td>' +
        '<td style="text-align:center; font-weight:700; color:var(--primary);">' + item.lokasi + '</td>' +
        '<td style="text-align:center;"><span class="badge-size">' + (item.jenis || 'Manual') + '</span></td>' +
        '<td style="text-align:center; font-weight:600;">' + item.qtySistem + '</td>' +
        '<td style="text-align:center; font-weight:700; color:var(--text);">' + (item.qtyFisik !== '' ? item.qtyFisik : '-') + '</td>' +
        '<td style="text-align:center; font-weight:800; color:' + deltaColor + ';">' + sign + deltaQty + '</td>' +
        '<td style="padding-left:10px; overflow:hidden;"><div style="max-width:210px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.5px;" title="' + (item.alasan || '-') + '">' + (item.alasan || '-') + '</div></td>' +
        '<td style="padding-left:10px; overflow:hidden;"><div style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.5px; font-weight:600; color:var(--text);" title="' + (item.operator || '-') + '">' + opDisplay + '</div></td>' +
        '<td style="text-align:center; padding:4px 6px; white-space:nowrap;">' +
          '<div style="display:flex; gap:6px; justify-content:center; align-items:center;">' +
            '<button class="btn btn-success btn-act-row" style="height:28px; width:32px; padding:0; font-size:12px; display:inline-flex; align-items:center; justify-content:center;" onclick="aksiApproval(' + item.rowIndex + ', \'approve\', this)" title="Setujui penyesuaian stok">✓</button>' +
            '<button class="btn btn-danger btn-act-row" style="height:28px; width:32px; padding:0; font-size:12px; display:inline-flex; align-items:center; justify-content:center;" onclick="aksiApproval(' + item.rowIndex + ', \'reject\', this)" title="Tolak penyesuaian">✕</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    listEl.innerHTML = html;
  }

  function toggleSelectAll(master) {
    document.querySelectorAll('.cb-pending').forEach(cb => cb.checked = master.checked);
  }

  function getSelectedPendingIds() {
    const ids = [];
    document.querySelectorAll('.cb-pending:checked').forEach(cb => ids.push(Number(cb.value)));
    return ids;
  }

  function aksiApproval(rowIndex, aksi, btnEl) {
    if (isProcessingSo) return;
    const konfirmasi = confirm(`Yakin ingin ${aksi === 'approve' ? 'MENYETUJUI' : 'MENOLAK'} adjustment baris ini?`);
    if (!konfirmasi) return;

    isProcessingSo = true;
    if (btnEl && window.setButtonLoading) window.setButtonLoading(btnEl, true, '...');
    if (window.showWmsToast) window.showWmsToast('Memproses approval di Sheet & sinkronisasi cloud...', 'info');

    const runner = google.script.run.withSuccessHandler(function (res) {
      isProcessingSo = false;
      if (btnEl && window.setButtonLoading) window.setButtonLoading(btnEl, false);
      if (window.showWmsToast) window.showWmsToast(res.message || 'Approval berhasil diproses!', res.success ? 'success' : 'error');
      if (res.success) {
        // Otomatis refresh data pending dan master inventory
        muatPending();
        if (typeof muatDataProduk === 'function') muatDataProduk();
      }
    }).withFailureHandler(function (err) {
      isProcessingSo = false;
      if (btnEl && window.setButtonLoading) window.setButtonLoading(btnEl, false);
      if (window.showWmsToast) window.showWmsToast('Gagal memproses approval: ' + err.message, 'error');
    });

    if (aksi === 'approve') runner.approveAdjustment(TOKEN, rowIndex);
    else runner.rejectAdjustment(TOKEN, rowIndex);
  }

  function prosesAksiMassal(aksi, btn) {
    if (isProcessingSo) return;
    const ids = getSelectedPendingIds();
    if (ids.length === 0) {
      if (window.showWmsToast) window.showWmsToast('PILIH MINIMAL SATU DATA TERLEBIH DAHULU!', 'warning');
      return;
    }

    const konfirmasi = confirm(`Yakin ingin ${aksi.toUpperCase()} ${ids.length} data terpilih?`);
    if (!konfirmasi) return;

    isProcessingSo = true;
    const btnApprove = document.getElementById('btnApproveMassal');
    const btnReject = document.getElementById('btnRejectMassal');
    if (btnApprove && window.setButtonLoading) window.setButtonLoading(btnApprove, true, 'APPROVING...');
    if (btnReject && window.setButtonLoading) window.setButtonLoading(btnReject, true, 'REJECTING...');

    if (window.showWmsToast) window.showWmsToast(`Memproses ${aksi.toUpperCase()} ${ids.length} item...`, 'info');

    const runner = google.script.run.withSuccessHandler(function (res) {
      isProcessingSo = false;
      if (btnApprove && window.setButtonLoading) window.setButtonLoading(btnApprove, false);
      if (btnReject && window.setButtonLoading) window.setButtonLoading(btnReject, false);
      if (window.showWmsToast) window.showWmsToast(res.message || 'Proses massal selesai!', res.success ? 'success' : 'error');
      if (res.success) {
        // Otomatis refresh data pending dan master inventory
        muatPending();
        if (typeof muatDataProduk === 'function') muatDataProduk();
      }
    }).withFailureHandler(function (err) {
      isProcessingSo = false;
      if (btnApprove && window.setButtonLoading) window.setButtonLoading(btnApprove, false);
      if (btnReject && window.setButtonLoading) window.setButtonLoading(btnReject, false);
      if (window.showWmsToast) window.showWmsToast('Gagal memproses massal: ' + err.message, 'error');
    });

    if (aksi === 'approve') runner.approveAdjustmentBulk(TOKEN, ids);
    else runner.rejectAdjustmentBulk(TOKEN, ids);
  }

  // ============ CSV EXPORT & IMPORT ============
  function downloadCsvBrowserSo(csvStr, filename) {
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  function downloadTemplateCsv() {
    const csv = "SKU,Lokasi,Qty Fisik\n";
    downloadCsvBrowserSo(csv, "Template_Opname.csv");
    if (window.showWmsToast) window.showWmsToast("Template CSV Opname berhasil diunduh.", "success");
  }

  function exportStockCsv(btn) {
    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MENYIAPKAN EXPORT...');
    if (window.showWmsToast) window.showWmsToast('Menyiapkan file export stok dari sistem...', 'info');

    google.script.run.withSuccessHandler(function (res) {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      if (res.success) {
        downloadCsvBrowserSo(res.csvData, "Export_Stok_Opname.csv");
        if (window.showWmsToast) window.showWmsToast('File export stok berhasil diunduh!', 'success');
      } else {
        if (window.showWmsToast) window.showWmsToast(res.message || 'Gagal export', 'error');
      }
    }).withFailureHandler(function (err) {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      if (window.showWmsToast) window.showWmsToast('Gagal export: ' + err.message, 'error');
    }).getWmsStockExportCsv(TOKEN);
  }

  function importCsv(btn) {
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput || !fileInput.files.length) {
      if (window.showWmsToast) window.showWmsToast('Silakan pilih file CSV terlebih dahulu.', 'warning');
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MEMBACA FILE...');

    reader.onload = function(e) {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      const text = e.target.result;
      const lines = text.split(/\r?\n/);
      let addedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = barisCsvKeArraySo(lines[i]);
        if (row.length >= 3) {
          const sku = row[0].trim().toUpperCase();
          const lokasi = row[1].trim();
          const qtyFisik = Number(row[2].trim());

          if (sku && lokasi && !isNaN(qtyFisik) && row[2].trim() !== "") {
            soKeranjang.push({ sku: sku, lokasi: lokasi, qtyFisik: qtyFisik });
            addedCount++;
          }
        }
      }

      if (addedCount > 0) {
        if (window.showWmsToast) window.showWmsToast(`Berhasil menambahkan ${addedCount} item dari CSV ke sesi!`, 'success');
        renderKeranjang();
      } else {
        if (window.showWmsToast) window.showWmsToast('Tidak ada data valid yang bisa dibaca. Pastikan format: SKU, Lokasi, Qty Fisik.', 'error');
      }
      fileInput.value = '';
    };

    reader.onerror = function() {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      if (window.showWmsToast) window.showWmsToast('Gagal membaca file CSV.', 'error');
    };

    reader.readAsText(file);
  }

  function downloadTemplateManualCsv() {
    const csv = "SKU,Lokasi,Delta,Alasan\n";
    downloadCsvBrowserSo(csv, "Template_Adjustment_Manual.csv");
    if (window.showWmsToast) window.showWmsToast("Template Adjustment CSV berhasil diunduh.", "success");
  }

  function exportStockCsvManual(btn) {
    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MENYIAPKAN...');
    if (window.showWmsToast) window.showWmsToast('Menyiapkan file export stok referensi...', 'info');

    google.script.run.withSuccessHandler(function (res) {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      if (res.success) {
        downloadCsvBrowserSo(res.csvData, "Export_Stok_Referensi.csv");
        if (window.showWmsToast) window.showWmsToast('File export berhasil diunduh!', 'success');
      } else {
        if (window.showWmsToast) window.showWmsToast(res.message || 'Gagal export', 'error');
      }
    }).withFailureHandler(function (err) {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      if (window.showWmsToast) window.showWmsToast('Gagal export: ' + err.message, 'error');
    }).getWmsStockExportCsv(TOKEN);
  }

  function importCsvManual(btn) {
    const fileInput = document.getElementById('csvFileInputManual');
    if (!fileInput || !fileInput.files.length) {
      if (window.showWmsToast) window.showWmsToast('Silakan pilih file CSV terlebih dahulu.', 'warning');
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MEMBACA FILE...');

    reader.onload = function (e) {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      const text = e.target.result;
      const lines = text.split(/\r?\n/);
      let addedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = barisCsvKeArraySo(lines[i]);
        if (row.length >= 4) {
          const sku = row[0].trim().toUpperCase();
          const lokasi = row[1].trim();
          const delta = Number(row[2].trim());
          const alasan = row[3].trim();

          if (sku && lokasi && !isNaN(delta) && delta !== 0 && alasan) {
            const dupIdx = soManualKeranjang.findIndex(item => item.sku === sku && item.lokasi === lokasi);
            if (dupIdx !== -1) {
              soManualKeranjang[dupIdx].deltaQty = delta;
              soManualKeranjang[dupIdx].alasan = alasan;
            } else {
              soManualKeranjang.push({ sku: sku, lokasi: lokasi, deltaQty: delta, alasan: alasan });
            }
            addedCount++;
          }
        }
      }

      if (addedCount > 0) {
        if (window.showWmsToast) window.showWmsToast(`Berhasil menambahkan ${addedCount} item ke sesi adjustment!`, 'success');
        renderKeranjangManual();
      } else {
        if (window.showWmsToast) window.showWmsToast('Tidak ada data valid yang bisa dibaca.', 'error');
      }
      fileInput.value = '';
    };

    reader.onerror = function () {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      if (window.showWmsToast) window.showWmsToast('Gagal membaca file CSV.', 'error');
    };

    reader.readAsText(file);
  }

  function barisCsvKeArraySo(text) {
    const re_valid = /^\s*(?:'[^'\\]*(?:\\[\s\S][^'\\]*)*'|"[^"\\]*(?:\\[\s\S][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\s\S][^'\\]*)*'|"[^"\\]*(?:\\[\s\S][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    const re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\s\S][^'\\]*)*)'|"([^"\\]*(?:\\[\s\S][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    if (!re_valid.test(text)) return [];
    const a = [];
    text.replace(re_value, function(m0, m1, m2, m3) {
      if      (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
      else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
      else if (m3 !== undefined) a.push(m3);
      return '';
    });
    if (/,\s*$/.test(text)) a.push('');
    return a;
  }


// --- Global Window Binding for stockopname ---
if (typeof initStockOpnameView === 'function') window.initStockOpnameView = initStockOpnameView;
if (typeof syncStockOpnameWithMasterData === 'function') window.syncStockOpnameWithMasterData = syncStockOpnameWithMasterData;
if (typeof populateLokasiDatalist === 'function') window.populateLokasiDatalist = populateLokasiDatalist;
if (typeof refreshStockOpnameMaster === 'function') window.refreshStockOpnameMaster = refreshStockOpnameMaster;
if (typeof switchSoTab === 'function') window.switchSoTab = switchSoTab;
if (typeof setupProductCombobox === 'function') window.setupProductCombobox = setupProductCombobox;
if (typeof renderOptions === 'function') window.renderOptions = renderOptions;
if (typeof chooseItem === 'function') window.chooseItem = chooseItem;
if (typeof highlightOption === 'function') window.highlightOption = highlightOption;
if (typeof updateOpnameProductInfo === 'function') window.updateOpnameProductInfo = updateOpnameProductInfo;
if (typeof updateManualProductInfo === 'function') window.updateManualProductInfo = updateManualProductInfo;
if (typeof cekQtySistem === 'function') window.cekQtySistem = cekQtySistem;
if (typeof tambahKeKeranjang === 'function') window.tambahKeKeranjang = tambahKeKeranjang;
if (typeof hapusItemSo === 'function') window.hapusItemSo = hapusItemSo;
if (typeof renderKeranjang === 'function') window.renderKeranjang = renderKeranjang;
if (typeof submitSesi === 'function') window.submitSesi = submitSesi;
if (typeof tambahKeKeranjangManual === 'function') window.tambahKeKeranjangManual = tambahKeKeranjangManual;
if (typeof hapusManualItemSo === 'function') window.hapusManualItemSo = hapusManualItemSo;
if (typeof renderKeranjangManual === 'function') window.renderKeranjangManual = renderKeranjangManual;
if (typeof submitManualBulk === 'function') window.submitManualBulk = submitManualBulk;
if (typeof muatPending === 'function') window.muatPending = muatPending;
if (typeof cleanOperatorDisplay === 'function') window.cleanOperatorDisplay = cleanOperatorDisplay;
if (typeof renderPending === 'function') window.renderPending = renderPending;
if (typeof toggleSelectAll === 'function') window.toggleSelectAll = toggleSelectAll;
if (typeof getSelectedPendingIds === 'function') window.getSelectedPendingIds = getSelectedPendingIds;
if (typeof aksiApproval === 'function') window.aksiApproval = aksiApproval;
if (typeof prosesAksiMassal === 'function') window.prosesAksiMassal = prosesAksiMassal;
if (typeof downloadCsvBrowserSo === 'function') window.downloadCsvBrowserSo = downloadCsvBrowserSo;
if (typeof downloadTemplateCsv === 'function') window.downloadTemplateCsv = downloadTemplateCsv;
if (typeof exportStockCsv === 'function') window.exportStockCsv = exportStockCsv;
if (typeof importCsv === 'function') window.importCsv = importCsv;
if (typeof downloadTemplateManualCsv === 'function') window.downloadTemplateManualCsv = downloadTemplateManualCsv;
if (typeof exportStockCsvManual === 'function') window.exportStockCsvManual = exportStockCsvManual;
if (typeof importCsvManual === 'function') window.importCsvManual = importCsvManual;
if (typeof barisCsvKeArraySo === 'function') window.barisCsvKeArraySo = barisCsvKeArraySo;
