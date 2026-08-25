
  let isFulfillmentInitialized = false;
  let FULFILLMENT_ON_PROCESS = []; // Data On-Process dari Database
  let FULFILLMENT_COMPLETED = [];  // Data Selesai dari Database
  let currentFulfillmentTab = 'proses';

  function initFulfillmentView() {
    if (!isFulfillmentInitialized) {
      isFulfillmentInitialized = true;
      muatDataFulfillment(false);
    }
  }

  // ============ TAB SWITCHER (ON PROSES vs SELESAI) ============
  function switchFulfillmentTab(tab) {
    currentFulfillmentTab = tab;
    const tabProses = document.getElementById('fulfillmentTabProses');
    const tabSelesai = document.getElementById('fulfillmentTabSelesai');
    const btnProses = document.getElementById('tabBtnFulfillmentProses');
    const btnSelesai = document.getElementById('tabBtnFulfillmentSelesai');

    if (tab === 'proses') {
      if (tabProses) tabProses.style.display = 'block';
      if (tabSelesai) tabSelesai.style.display = 'none';
      if (btnProses) btnProses.classList.add('active');
      if (btnSelesai) btnSelesai.classList.remove('active');
    } else {
      if (tabProses) tabProses.style.display = 'none';
      if (tabSelesai) tabSelesai.style.display = 'block';
      if (btnProses) btnProses.classList.remove('active');
      if (btnSelesai) btnSelesai.classList.add('active');
      renderFulfillmentCompletedBubbles();
    }
  }

  // ============ MUAT DATA PERMANEN DARI DATABASE ============
  function muatDataFulfillment(force) {
    const containerProses = document.getElementById('fulfillmentOnProcessContainer');
    if (containerProses && force) {
      containerProses.innerHTML = '<div style="text-align: center; padding: 35px 20px; color: var(--text-muted); font-style: italic;">⏳ Memperbarui data Picking List dari server...</div>';
    }

    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          FULFILLMENT_ON_PROCESS = res.onProcess || [];
          FULFILLMENT_COMPLETED = res.completed || [];
          
          updateTabBadges();
          renderFulfillmentOnProcessBubbles();
          renderFulfillmentCompletedBubbles();
        } else {
          if (containerProses) {
            containerProses.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 30px;">' + (res ? res.message : 'Gagal memuat data') + '</div>';
          }
        }
      })
      .withFailureHandler(err => {
        if (containerProses) {
          containerProses.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 30px;">Error koneksi: ' + err.message + '</div>';
        }
      })
      .getFulfillmentPickingLists(TOKEN);
  }

  function updateTabBadges() {
    const badgeP = document.getElementById('badgeCountProses');
    const badgeS = document.getElementById('badgeCountSelesai');
    const btnCetakAll = document.getElementById('btnTopCetakSemua');

    if (badgeP) badgeP.textContent = FULFILLMENT_ON_PROCESS.length;
    if (badgeS) badgeS.textContent = FULFILLMENT_COMPLETED.length;

    if (btnCetakAll) {
      btnCetakAll.style.display = FULFILLMENT_ON_PROCESS.length > 0 ? "inline-flex" : "none";
    }
  }

  function handleCsvFileSelected(input) {
    const files = input.files;
    const btn = document.getElementById('btnProcessFulfillment');
    if (files && files.length > 0 && btn) {
      btn.classList.add('pulse-highlight');
    }
  }

  function resetFulfillmentUpload() {
    const fileInput = document.getElementById('csvFileInput');
    if (fileInput) fileInput.value = '';
    const btn = document.getElementById('btnProcessFulfillment');
    if (btn) btn.classList.remove('pulse-highlight');
  }

  function showFulfillmentToast(ok, msg) {
    const el = document.getElementById('fulfillmentToast');
    if (!el) return;
    el.style.display = 'block';
    el.style.background = ok ? 'var(--success-light)' : 'var(--danger-light)';
    el.style.border = '1px solid ' + (ok ? 'var(--success)' : 'var(--danger)');
    el.style.color = ok ? 'var(--success)' : 'var(--danger)';
    el.innerHTML = (ok ? '✓ ' : '⚠️ ') + msg;
    setTimeout(function () { el.style.display = 'none'; }, 6000);
  }

  // ============ PROSES UPLOAD CSV MULTI-FILE ============
  function handleProcessFulfillment(force = false) {
    const fileInput = document.getElementById('csvFileInput');
    const files = fileInput ? fileInput.files : null;

    if (!files || files.length === 0) {
      showFulfillmentToast(false, "Silakan pilih minimal 1 file CSV Transfer Order terlebih dahulu.");
      return;
    }

    const chkDirectPrint = document.getElementById('chkDirectPrint');
    const isDirectPrint = chkDirectPrint ? chkDirectPrint.checked : false;

    const btn = document.getElementById('btnProcessFulfillment');
    const icon = document.getElementById('processIcon');
    const label = document.getElementById('processLabel');

    if (btn) btn.disabled = true;
    if (icon) icon.innerHTML = "⏳";
    if (label) label.textContent = "MEMPROSES CSV...";

    let readCount = 0;
    let filePayloads = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = function(e) {
        filePayloads.push({
          fileName: file.name,
          content: e.target.result
        });
        readCount++;

        if (readCount === files.length) {
          google.script.run
            .withSuccessHandler(res => {
              if (btn) btn.disabled = false;
              if (icon) icon.innerHTML = "⚡";
              if (label) label.textContent = "PROSES CSV";

              if (!res.success && res.isDuplicate) {
                if (confirm(res.message)) {
                  handleProcessFulfillment(true);
                }
                return;
              }

              if (!res.success) {
                showFulfillmentToast(false, "Gagal: " + res.message);
                return;
              }

              showFulfillmentToast(true, res.message || "Transfer Order berhasil disimpan ke database!");
              resetFulfillmentUpload();
              muatDataFulfillment(true);

              if (isDirectPrint && res.pdfData) {
                openPdfPopup(res.pdfData, "Surat_Jalan_Gabungan");
              }
            })
            .withFailureHandler(err => {
              if (btn) btn.disabled = false;
              if (icon) icon.innerHTML = "⚡";
              if (label) label.textContent = "PROSES CSV";
              showFulfillmentToast(false, "Terjadi kesalahan server: " + err.message);
            })
            .processRefillCsvFilesToPickingList(filePayloads, {
              isDirectPrint: isDirectPrint,
              forceProcess: force
            });
        }
      };
      reader.readAsText(file);
    }
  }

  // ============ RENDER TAB 1: ON PROSES (INTERACTIVE PICKING) ============
  function renderFulfillmentOnProcessBubbles() {
    const container = document.getElementById('fulfillmentOnProcessContainer');
    const badge = document.getElementById('fulfillmentProsesSummaryBadge');
    if (!container) return;

    if (FULFILLMENT_ON_PROCESS.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-style: italic;">
          <div style="font-size: 32px; margin-bottom: 8px;">📦</div>
          Tidak ada antrean Picking List yang aktif.<br>Silakan upload file CSV di atas untuk membuat Picking List baru.
        </div>
      `;
      if (badge) badge.textContent = "0 Surat Jalan Aktif";
      return;
    }

    let totalPcsReq = 0;
    FULFILLMENT_ON_PROCESS.forEach(b => { totalPcsReq += (Number(b.totalQtyReq) || 0); });
    if (badge) badge.innerHTML = `<b>${FULFILLMENT_ON_PROCESS.length} Surat Jalan</b> &bull; <b>${totalPcsReq} Pcs Total</b>`;

    let html = '';
    FULFILLMENT_ON_PROCESS.forEach((bubble, bIdx) => {
      const items = bubble.items || [];
      const totalItems = items.length;
      let checkedCount = 0;
      let totalPcsPicked = 0;

      items.forEach(it => {
        if (it.isChecked) {
          checkedCount++;
          totalPcsPicked += (Number(it.qtyPicked) || 0);
        }
      });

      const pct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;
      const isAllChecked = (totalItems > 0 && checkedCount === totalItems);

      let rowsHtml = '';
      items.forEach((item, itemIdx) => {
        const loc = String(item.lokasi || '-').trim();
        const isKoli = loc.toUpperCase().includes('KOLI');
        const locBadge = (loc && loc !== '-')
          ? (isKoli ? `<span class="badge-rak-koli">📦 ${escapeHtml(loc)}</span>` : `<span class="badge-rak-loc">📍 ${escapeHtml(loc)}</span>`)
          : `<span style="color: var(--text-muted); font-size: 10.5px;">-</span>`;

        const isRowChecked = Boolean(item.isChecked);

        rowsHtml += `
          <tr class="picking-item-row ${isRowChecked ? 'row-picked-active' : ''}" id="pickRow_${bIdx}_${itemIdx}" style="font-size: 12px;">
            <td style="text-align: center; width: 35px; color: var(--text-muted); font-weight: 600;">${itemIdx + 1}</td>
            <td style="text-align: center; width: 45px; padding: 4px;">
              <button type="button" class="btn-check-pick ${isRowChecked ? 'checked' : ''}" onclick="toggleCheckItem(${bIdx}, ${itemIdx})" title="Ceklis barang sudah diambil dari rak">
                ${isRowChecked ? '✓' : ''}
              </button>
            </td>
            <td style="font-weight: 700; color: var(--primary); padding-left: 8px; width: 135px;"><span class="badge-sku">${escapeHtml(item.sku || '-')}</span></td>
            <td style="padding-left: 8px; font-weight: 600;">${escapeHtml(item.nama || '-')}</td>
            <td style="text-align: center; font-weight: 700; color: var(--text-muted); width: 60px;">${item.qtyReq || 0}</td>
            <td style="text-align: center; width: 75px; padding: 4px;">
              <input type="number" min="0" max="${item.qtyReq || 999}" value="${item.qtyPicked !== undefined ? item.qtyPicked : item.qtyReq}" class="input-qty-pick" onchange="updateItemPickedQty(${bIdx}, ${itemIdx}, this.value)" onfocus="this.select()" title="Sesuaikan jika barang yang didapat kurang dari request">
            </td>
            <td style="text-align: center; width: 110px;">${locBadge}</td>
          </tr>
        `;
      });

      html += `
        <div class="fulfillment-bubble-card" id="bubbleCard_${bIdx}">
          
          <!-- Bubble Header -->
          <div class="bubble-header">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 14px;">📄</span>
              <span class="bubble-meta-tag bubble-tag-sj">No SJ: ${escapeHtml(bubble.noSJ || '-')}</span>
              <span class="bubble-meta-tag bubble-tag-tujuan">🏪 ${escapeHtml(bubble.tujuan || '-')}</span>
              <span class="bubble-meta-tag ${bubble.isPrinted ? 'bubble-tag-printed' : 'bubble-tag-unprinted'}">${bubble.isPrinted ? '🖨️ TERCETAK' : '🟢 SIAP PICKING'}</span>
            </div>

            <!-- Picking Progress & Actions -->
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              
              <!-- Progress Bar Mini -->
              <div style="display: flex; align-items: center; gap: 6px;" title="Progress pengambilan barang">
                <div class="mini-progress-track">
                  <div class="mini-progress-fill" id="progFill_${bIdx}" style="width: ${pct}%;"></div>
                </div>
                <span id="progText_${bIdx}" style="font-size: 11px; font-weight: 700; color: var(--text-muted); min-width: 45px;">${checkedCount}/${totalItems}</span>
              </div>

              <!-- Tombol Cetak SJ -->
              <button type="button" class="btn btn-secondary" onclick="cetakSingleSuratJalan(${bIdx}, this)" style="height: 28px; padding: 0 10px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" title="Cetak Surat Jalan PDF">
                🖨️ CETAK SJ
              </button>

              <!-- Tombol SELESAI PICKING (DONE) -->
              <button type="button" class="btn btn-primary" onclick="konfirmasiSelesaiPicking(${bIdx}, this)" style="height: 28px; padding: 0 12px; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px; background: #10b981; border-color: #10b981;" title="Selesaikan picking dan pindahkan ke tab Selesai">
                ✓ DONE
              </button>

              <!-- Toggle Detail -->
              <button type="button" class="btn btn-secondary" onclick="toggleBubbleDetail(${bIdx})" style="height: 28px; padding: 0 8px; font-size: 11px;" title="Buka / Tutup tabel rincian">
                <span id="toggleText_${bIdx}">👁️ Rincian</span>
              </button>
            </div>
          </div>

          <!-- Meta Summary Bar -->
          <div style="padding: 6px 14px; background: var(--bg-surface); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted);">
            <div>
              <b>Tanggal:</b> ${escapeHtml(bubble.date || '-')} &bull; <b>Tujuan:</b> ${escapeHtml(bubble.tujuan || '-')}
            </div>
            <div>
              Total: <b>${totalItems} SKU</b> &bull; Request: <b>${bubble.totalQtyReq || 0} Pcs</b> &bull; Diambil: <b style="color: #10b981;" id="pickedTotal_${bIdx}">${totalPcsPicked} Pcs</b>
            </div>
          </div>

          <!-- Collapsible Picking Table Detail -->
          <div id="bubbleTableWrap_${bIdx}" style="display: block; overflow-x: auto;">
            <table class="unified-table" style="width: 100%; min-width: 620px;">
              <thead>
                <tr>
                  <th style="width: 35px; text-align: center;">NO</th>
                  <th style="width: 45px; text-align: center;">CEK</th>
                  <th style="width: 135px; text-align: left; padding-left: 8px;">SKU</th>
                  <th style="text-align: left; padding-left: 8px;">NAMA PRODUK &amp; VARIAN</th>
                  <th style="width: 60px; text-align: center;">REQ</th>
                  <th style="width: 75px; text-align: center;">PICKED</th>
                  <th style="width: 110px; text-align: center;">LOKASI RAK</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ============ INTERAKSI CEKLIS & EDIT PICKED QTY ============
  function toggleCheckItem(bIdx, itemIdx) {
    const bubble = FULFILLMENT_ON_PROCESS[bIdx];
    if (!bubble || !bubble.items || !bubble.items[itemIdx]) return;

    const item = bubble.items[itemIdx];
    item.isChecked = !item.isChecked;

    if (item.isChecked && (item.qtyPicked === undefined || item.qtyPicked === 0)) {
      item.qtyPicked = item.qtyReq || 1;
    }

    // Update row DOM
    const rowEl = document.getElementById(`pickRow_${bIdx}_${itemIdx}`);
    if (rowEl) {
      const btnCheck = rowEl.querySelector('.btn-check-pick');
      const inputQty = rowEl.querySelector('.input-qty-pick');

      if (item.isChecked) {
        rowEl.classList.add('row-picked-active');
        if (btnCheck) {
          btnCheck.classList.add('checked');
          btnCheck.textContent = '✓';
        }
        if (inputQty) inputQty.value = item.qtyPicked;
      } else {
        rowEl.classList.remove('row-picked-active');
        if (btnCheck) {
          btnCheck.classList.remove('checked');
          btnCheck.textContent = '';
        }
      }
    }

    updateBubbleProgress(bIdx);
  }

  function updateItemPickedQty(bIdx, itemIdx, val) {
    const bubble = FULFILLMENT_ON_PROCESS[bIdx];
    if (!bubble || !bubble.items || !bubble.items[itemIdx]) return;

    const item = bubble.items[itemIdx];
    const parsed = parseInt(val, 10);
    item.qtyPicked = isNaN(parsed) ? 0 : Math.max(0, parsed);

    if (item.qtyPicked > 0 && !item.isChecked) {
      toggleCheckItem(bIdx, itemIdx);
    } else {
      updateBubbleProgress(bIdx);
    }
  }

  function updateBubbleProgress(bIdx) {
    const bubble = FULFILLMENT_ON_PROCESS[bIdx];
    if (!bubble || !bubble.items) return;

    let checkedCount = 0;
    let totalPcsPicked = 0;
    const totalItems = bubble.items.length;

    bubble.items.forEach(it => {
      if (it.isChecked) {
        checkedCount++;
        totalPcsPicked += (Number(it.qtyPicked) || 0);
      }
    });

    const pct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;
    const fillEl = document.getElementById(`progFill_${bIdx}`);
    const textEl = document.getElementById(`progText_${bIdx}`);
    const pickedTotalEl = document.getElementById(`pickedTotal_${bIdx}`);

    if (fillEl) fillEl.style.width = `${pct}%`;
    if (textEl) textEl.textContent = `${checkedCount}/${totalItems}`;
    if (pickedTotalEl) pickedTotalEl.textContent = `${totalPcsPicked} Pcs`;
  }

  function toggleBubbleDetail(bIdx) {
    const wrap = document.getElementById(`bubbleTableWrap_${bIdx}`);
    const toggleText = document.getElementById(`toggleText_${bIdx}`);
    if (!wrap) return;

    if (wrap.style.display === 'none') {
      wrap.style.display = 'block';
      if (toggleText) toggleText.textContent = `👁️ Tutup`;
    } else {
      wrap.style.display = 'none';
      if (toggleText) toggleText.textContent = `👁️ Rincian`;
    }
  }

  // ============ SELESAI PICKING (DONE) ============
  function konfirmasiSelesaiPicking(bIdx, btn) {
    const bubble = FULFILLMENT_ON_PROCESS[bIdx];
    if (!bubble) return;

    const items = bubble.items || [];
    let checkedCount = 0;
    let totalPicked = 0;
    items.forEach(it => {
      if (it.isChecked) {
        checkedCount++;
        totalPicked += (Number(it.qtyPicked) || 0);
      }
    });

    let confirmMsg = `Konfirmasi selesai picking untuk Surat Jalan ${bubble.noSJ} (${bubble.tujuan})?\n\n` +
      `• Total SKU: ${items.length}\n` +
      `• SKU Diceklis: ${checkedCount} dari ${items.length}\n` +
      `• Total Fisik Diambil: ${totalPicked} dari ${bubble.totalQtyReq} pcs\n\n` +
      `Picking list ini akan otomatis dipindahkan ke tab SELESAI PICKING. Lanjutkan?`;

    if (!confirm(confirmMsg)) return;

    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MENYIMPAN...');

    const payload = {
      noSJ: bubble.noSJ,
      items: items.map(it => ({
        sku: it.sku,
        qtyReq: it.qtyReq,
        qtyPicked: it.isChecked ? (it.qtyPicked !== undefined ? it.qtyPicked : it.qtyReq) : 0
      })),
      pickerName: (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER : 'Picker'
    };

    google.script.run
      .withSuccessHandler(res => {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        if (res && res.success) {
          if (window.showToast) window.showToast(res.message || "Picking selesai! Dipindahkan ke tab Selesai.", "success");
          muatDataFulfillment(true);
        } else {
          alert("Gagal menyelesaikan: " + (res ? res.message : "Error server"));
        }
      })
      .withFailureHandler(err => {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        alert("Error server: " + err.message);
      })
      .selesaiPickingFulfillment(TOKEN, payload);
  }

  // ============ RENDER TAB 2: SELESAI PICKING ============
  function renderFulfillmentCompletedBubbles() {
    const container = document.getElementById('fulfillmentCompletedContainer');
    const badge = document.getElementById('fulfillmentSelesaiSummaryBadge');
    if (!container) return;

    const keyword = (document.getElementById('searchFulfillmentSelesai') ? document.getElementById('searchFulfillmentSelesai').value : '').toLowerCase().trim();

    let filtered = FULFILLMENT_COMPLETED;
    if (keyword) {
      filtered = filtered.filter(b => {
        const combined = (String(b.noSJ || '') + ' ' + String(b.tujuan || '') + ' ' + String(b.date || '')).toLowerCase();
        return combined.includes(keyword);
      });
    }

    if (badge) badge.textContent = `${filtered.length} Surat Jalan Selesai`;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-style: italic;">
          <div style="font-size: 32px; margin-bottom: 8px;">✅</div>
          Belum ada riwayat Picking List selesai yang sesuai pencarian.
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach((bubble, bIdx) => {
      const items = bubble.items || [];
      let rowsHtml = '';
      items.forEach((item, itemIdx) => {
        rowsHtml += `
          <tr style="font-size: 11.5px;">
            <td style="text-align: center; width: 35px; color: var(--text-muted); font-weight: 600;">${itemIdx + 1}</td>
            <td style="font-weight: 700; color: var(--primary); padding-left: 8px; width: 135px;"><span class="badge-sku">${escapeHtml(item.sku || '-')}</span></td>
            <td style="padding-left: 8px; font-weight: 600;">${escapeHtml(item.nama || '-')}</td>
            <td style="text-align: center; font-weight: 700; width: 70px;">${item.qtyReq || 0}</td>
            <td style="text-align: center; font-weight: 800; color: #10b981; width: 70px;">${item.qtyPicked || item.qtyReq || 0}</td>
            <td style="text-align: center; width: 110px;"><span class="badge-rak-loc">${escapeHtml(item.lokasi || '-')}</span></td>
          </tr>
        `;
      });

      html += `
        <div class="fulfillment-bubble-card completed-card">
          <!-- Header -->
          <div class="bubble-header">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 14px;">✅</span>
              <span class="bubble-meta-tag bubble-tag-sj">No SJ: ${escapeHtml(bubble.noSJ || '-')}</span>
              <span class="bubble-meta-tag bubble-tag-tujuan">🏪 ${escapeHtml(bubble.tujuan || '-')}</span>
              <span class="bubble-meta-tag bubble-tag-done">✓ SELESAI PICKING</span>
            </div>

            <!-- Actions -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <button type="button" class="btn btn-secondary" onclick="cetakSingleSuratJalanCompleted('${escapeHtml(bubble.noSJ)}', this)" style="height: 28px; padding: 0 10px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" title="Cetak ulang Surat Jalan PDF">
                🖨️ CETAK ULANG SJ
              </button>

              <button type="button" class="btn btn-secondary" onclick="toggleCompletedDetail(${bIdx})" style="height: 28px; padding: 0 8px; font-size: 11px;" title="Lihat rincian barang">
                <span id="toggleCompText_${bIdx}">👁️ Rincian (${items.length})</span>
              </button>

              <button type="button" class="btn btn-secondary" onclick="kembalikanKeProses('${escapeHtml(bubble.noSJ)}', this)" style="height: 28px; padding: 0 8px; font-size: 11px; color: var(--danger); border-color: rgba(239,68,68,0.3);" title="Kembalikan ke tab On Proses jika salah selesai">
                ↩️ KEMBALIKAN
              </button>
            </div>
          </div>

          <!-- Meta Bar -->
          <div style="padding: 6px 14px; background: var(--bg-surface); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted);">
            <div>
              <b>Tanggal:</b> ${escapeHtml(bubble.date || '-')} &bull; <b>Tujuan:</b> ${escapeHtml(bubble.tujuan || '-')}
            </div>
            <div>
              Total: <b>${items.length} SKU</b> &bull; Request: <b>${bubble.totalQtyReq || 0} Pcs</b> &bull; Terambil: <b style="color: #10b981;">${bubble.totalQtyPicked || bubble.totalQtyReq || 0} Pcs</b>
            </div>
          </div>

          <!-- Detail Table -->
          <div id="compTableWrap_${bIdx}" style="display: none; overflow-x: auto;">
            <table class="unified-table" style="width: 100%; min-width: 600px;">
              <thead>
                <tr>
                  <th style="width: 35px; text-align: center;">NO</th>
                  <th style="width: 135px; text-align: left; padding-left: 8px;">SKU</th>
                  <th style="text-align: left; padding-left: 8px;">NAMA PRODUK &amp; VARIAN</th>
                  <th style="width: 70px; text-align: center;">REQ</th>
                  <th style="width: 70px; text-align: center;">PICKED</th>
                  <th style="width: 110px; text-align: center;">LOKASI RAK</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function toggleCompletedDetail(bIdx) {
    const wrap = document.getElementById(`compTableWrap_${bIdx}`);
    const toggleText = document.getElementById(`toggleCompText_${bIdx}`);
    if (!wrap) return;

    if (wrap.style.display === 'none') {
      wrap.style.display = 'block';
      if (toggleText) toggleText.textContent = `👁️ Tutup`;
    } else {
      wrap.style.display = 'none';
      if (toggleText) toggleText.textContent = `👁️ Rincian`;
    }
  }

  function kembalikanKeProses(noSJ, btn) {
    if (!confirm(`Kembalikan Surat Jalan ${noSJ} ke tab Picking Proses?`)) return;

    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MEMPROSES...');

    google.script.run
      .withSuccessHandler(res => {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        if (res && res.success) {
          if (window.showToast) window.showToast(res.message, "success");
          muatDataFulfillment(true);
        } else {
          alert("Gagal: " + (res ? res.message : "Error"));
        }
      })
      .withFailureHandler(err => {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        alert("Error: " + err.message);
      })
      .kembalikanPickingKeProses(TOKEN, noSJ);
  }

  // ============ CETAK SURAT JALAN ============
  function cetakSingleSuratJalan(bIdx, btn) {
    const bubble = FULFILLMENT_ON_PROCESS[bIdx];
    if (!bubble) return;

    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MEMBUAT PDF...');

    google.script.run
      .withSuccessHandler(res => {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        if (res && res.success && res.pdfData) {
          bubble.isPrinted = true;
          bubble.status = "TERCETAK";
          renderFulfillmentOnProcessBubbles();
          openPdfPopup(res.pdfData, `Surat_Jalan_${bubble.noSJ}`);
        } else {
          alert("Gagal membuat PDF: " + (res ? res.message : "Error tidak diketahui"));
        }
      })
      .withFailureHandler(err => {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        alert("Error server: " + err.message);
      })
      .cetakSingleSuratJalanRefill(bubble);
  }

  function cetakSingleSuratJalanCompleted(noSJ, btn) {
    const bubble = FULFILLMENT_COMPLETED.find(b => b.noSJ === noSJ);
    if (!bubble) return;

    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MEMBUAT PDF...');

    google.script.run
      .withSuccessHandler(res => {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        if (res && res.success && res.pdfData) {
          openPdfPopup(res.pdfData, `Surat_Jalan_${bubble.noSJ}`);
        } else {
          alert("Gagal membuat PDF: " + (res ? res.message : "Error"));
        }
      })
      .withFailureHandler(err => {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        alert("Error server: " + err.message);
      })
      .cetakSingleSuratJalanRefill(bubble);
  }

  function cetakSemuaSuratJalanAktif() {
    if (FULFILLMENT_ON_PROCESS.length === 0) {
      alert("Tidak ada Surat Jalan aktif untuk dicetak.");
      return;
    }

    const btn = document.getElementById('btnTopCetakSemua');
    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MEMBUAT PDF...');

    google.script.run
      .withSuccessHandler(res => {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        if (res && res.success && res.pdfData) {
          FULFILLMENT_ON_PROCESS.forEach(b => {
            b.isPrinted = true;
            b.status = "TERCETAK";
          });
          renderFulfillmentOnProcessBubbles();
          openPdfPopup(res.pdfData, "Semua_Surat_Jalan_Aktif");
        } else {
          alert("Gagal membuat PDF: " + (res ? res.message : "Error"));
        }
      })
      .withFailureHandler(err => {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        alert("Error: " + err.message);
      })
      .cetakMultipleSuratJalanRefill(FULFILLMENT_ON_PROCESS);
  }

  // ============ POPUP PDF & PRINT ============
  function openPdfPopup(base64PdfData, docTitle = "Surat_Jalan_Refill") {
    var win = window.open();
    if (!win) {
      alert("Pop-up diblokir oleh browser! Izinkan pop-up untuk situs ini agar PDF Surat Jalan dapat ditampilkan.");
      return;
    }
    win.document.write(
      `<html><head><title>${escapeHtml(docTitle)}</title></head>` +
      `<body style="margin:0; background:#333;">` +
      `<iframe src="${base64PdfData}" style="width:100%; height:100%; border:none;"></iframe>` +
      `</body></html>`
    );
    setTimeout(() => { 
      try { win.print(); } catch(e) {}
    }, 1200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Expose function global ke window
  window.initFulfillmentView = initFulfillmentView;
  window.switchFulfillmentTab = switchFulfillmentTab;
  window.muatDataFulfillment = muatDataFulfillment;
  window.handleProcessFulfillment = handleProcessFulfillment;
  window.handleCsvFileSelected = handleCsvFileSelected;
  window.resetFulfillmentUpload = resetFulfillmentUpload;
  window.toggleCheckItem = toggleCheckItem;
  window.updateItemPickedQty = updateItemPickedQty;
  window.toggleBubbleDetail = toggleBubbleDetail;
  window.konfirmasiSelesaiPicking = konfirmasiSelesaiPicking;
  window.toggleCompletedDetail = toggleCompletedDetail;
  window.kembalikanKeProses = kembalikanKeProses;
  window.cetakSingleSuratJalan = cetakSingleSuratJalan;
  window.cetakSingleSuratJalanCompleted = cetakSingleSuratJalanCompleted;
  window.cetakSemuaSuratJalanAktif = cetakSemuaSuratJalanAktif;


// --- Global Window Binding for fulfillment ---
if (typeof initFulfillmentView === 'function') window.initFulfillmentView = initFulfillmentView;
if (typeof switchFulfillmentTab === 'function') window.switchFulfillmentTab = switchFulfillmentTab;
if (typeof muatDataFulfillment === 'function') window.muatDataFulfillment = muatDataFulfillment;
if (typeof updateTabBadges === 'function') window.updateTabBadges = updateTabBadges;
if (typeof handleCsvFileSelected === 'function') window.handleCsvFileSelected = handleCsvFileSelected;
if (typeof resetFulfillmentUpload === 'function') window.resetFulfillmentUpload = resetFulfillmentUpload;
if (typeof showFulfillmentToast === 'function') window.showFulfillmentToast = showFulfillmentToast;
if (typeof handleProcessFulfillment === 'function') window.handleProcessFulfillment = handleProcessFulfillment;
if (typeof renderFulfillmentOnProcessBubbles === 'function') window.renderFulfillmentOnProcessBubbles = renderFulfillmentOnProcessBubbles;
if (typeof toggleCheckItem === 'function') window.toggleCheckItem = toggleCheckItem;
if (typeof updateItemPickedQty === 'function') window.updateItemPickedQty = updateItemPickedQty;
if (typeof updateBubbleProgress === 'function') window.updateBubbleProgress = updateBubbleProgress;
if (typeof toggleBubbleDetail === 'function') window.toggleBubbleDetail = toggleBubbleDetail;
if (typeof konfirmasiSelesaiPicking === 'function') window.konfirmasiSelesaiPicking = konfirmasiSelesaiPicking;
if (typeof renderFulfillmentCompletedBubbles === 'function') window.renderFulfillmentCompletedBubbles = renderFulfillmentCompletedBubbles;
if (typeof toggleCompletedDetail === 'function') window.toggleCompletedDetail = toggleCompletedDetail;
if (typeof kembalikanKeProses === 'function') window.kembalikanKeProses = kembalikanKeProses;
if (typeof cetakSingleSuratJalan === 'function') window.cetakSingleSuratJalan = cetakSingleSuratJalan;
if (typeof cetakSingleSuratJalanCompleted === 'function') window.cetakSingleSuratJalanCompleted = cetakSingleSuratJalanCompleted;
if (typeof cetakSemuaSuratJalanAktif === 'function') window.cetakSemuaSuratJalanAktif = cetakSemuaSuratJalanAktif;
if (typeof openPdfPopup === 'function') window.openPdfPopup = openPdfPopup;
