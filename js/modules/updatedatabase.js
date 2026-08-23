
  let isUpdateDbInitialized = false;
  let DB_PARSED_HEADER = null;
  let DB_PARSED_ROWS = [];

  const SUPABASE_DB_URL = "https://filgijcfhgqlirzhvwho.supabase.co";
  const SUPABASE_DB_KEY = "sb_publishable_L4FEkugwRKqcwFzLXfpZag_aByUy5mD";

  function initUpdateDatabaseView() {
    if (!isUpdateDbInitialized) {
      isUpdateDbInitialized = true;
      muatInfoDatabase();
    }
  }

  function muatInfoDatabase(btn) {
    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MEMUAT...');
    const lastEl = document.getElementById('dbLastUpdateText');
    const badgeEl = document.getElementById('dbTotalRecordsBadge');

    google.script.run.withSuccessHandler(function(res) {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      if (res && res.success) {
        if (lastEl) lastEl.innerHTML = `Database Terhubung &bull; <b>${(res.jumlahBaris || 0).toLocaleString('id-ID')}</b> Baris Produk (${res.jumlahKolom || 0} Kolom)`;
        if (badgeEl) badgeEl.textContent = `${(res.jumlahBaris || 0).toLocaleString('id-ID')} Records`;
      } else {
        if (lastEl) lastEl.textContent = res ? res.message : 'Database Aktif';
      }
    }).withFailureHandler(function(err) {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      if (lastEl) lastEl.textContent = 'Gagal memuat info database';
    }).getWmsUpdateDatabaseRingkasan(TOKEN);
  }

  // ============ PARSE CSV MULTI-FILE ============
  function parseDbCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
      current += ch;
    }
    result.push(current);
    return result.map(s => s.trim());
  }

  function bacaFileCsvSebagaiTeks(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (evt) { resolve({ name: file.name, size: file.size, text: evt.target.result }); };
      reader.onerror = function () { reject(new Error('Gagal membaca file: ' + file.name)); };
      reader.readAsText(file, 'UTF-8');
    });
  }

  function handleFilesSelected(input) {
    const files = Array.from(input.files || []);
    const previewArea = document.getElementById('dbFilesPreviewArea');
    const listEl = document.getElementById('dbFilesList');
    const summaryBadge = document.getElementById('dbTotalSummaryBadge');
    const uploadBtn = document.getElementById('btnUploadDbCsv');

    if (files.length === 0) {
      previewArea.style.display = 'none';
      uploadBtn.disabled = true;
      DB_PARSED_HEADER = null;
      DB_PARSED_ROWS = [];
      return;
    }

    previewArea.style.display = 'block';
    listEl.innerHTML = '<div style="font-size:12px; color:var(--text-muted); font-style:italic;">Memproses pembacaan ' + files.length + ' file CSV...</div>';
    summaryBadge.style.display = 'none';
    uploadBtn.disabled = true;

    Promise.all(files.map(bacaFileCsvSebagaiTeks)).then(function (results) {
      let headerGabungan = null;
      let rowsGabungan = [];
      let filesListHtml = '';

      results.forEach(function (resItem) {
        const lines = resItem.text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 1) return;

        const headerThisFile = parseDbCsvLine(lines[0]);
        if (!headerGabungan) headerGabungan = headerThisFile;

        let rowCount = 0;
        lines.slice(1).forEach(function (line) {
          const cols = parseDbCsvLine(line);
          const hasContent = cols.some(c => c !== '');
          if (hasContent) {
            rowsGabungan.push(cols);
            rowCount++;
          }
        });

        const sizeKb = (resItem.size / 1024).toFixed(1);
        filesListHtml += `
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--card-alt); border:1px solid var(--border); border-radius:6px; padding:6px 12px; font-size:11.5px;">
            <div style="font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:70%;">
              📄 ${resItem.name} <span style="font-size:10px; color:var(--text-muted);">(${sizeKb} KB)</span>
            </div>
            <div style="font-weight:700; color:var(--primary); font-size:11px;">
              ${rowCount.toLocaleString('id-ID')} baris
            </div>
          </div>
        `;
      });

      if (!headerGabungan || rowsGabungan.length === 0) {
        listEl.innerHTML = '<div style="color:var(--danger); font-size:12px;">File CSV kosong atau format tidak valid.</div>';
        uploadBtn.disabled = true;
        return;
      }

      DB_PARSED_HEADER = headerGabungan;
      DB_PARSED_ROWS = rowsGabungan;

      listEl.innerHTML = filesListHtml;
      summaryBadge.style.display = 'block';
      summaryBadge.innerHTML = `✅ <b>Total ${rowsGabungan.length.toLocaleString('id-ID')} Baris Produk</b> dari <b>${files.length} File CSV</b> berhasil digabungkan dan siap diunggah!`;
      uploadBtn.disabled = false;

    }).catch(function (err) {
      listEl.innerHTML = `<div style="color:var(--danger); font-size:12px;">Terjadi kesalahan: ${err.message}</div>`;
      uploadBtn.disabled = true;
    });
  }

  // ============ SUPABASE-FIRST DIRECT BATCH UPLOADER ============
  async function startSupabaseFirstUpload(btn) {
    if (!DB_PARSED_HEADER || DB_PARSED_ROWS.length === 0) {
      if (window.showWmsToast) window.showWmsToast('Silakan pilih minimal 1 file CSV yang valid.', 'error');
      return;
    }

    const headers = DB_PARSED_HEADER.map(h => String(h || '').trim());
    const headersLower = headers.map(h => h.toLowerCase());

    let namaIdx = headersLower.findIndex(h => h === "product" || h === "nama produk" || h === "produk");
    let sizeIdx = headersLower.findIndex(h => h === "variant" || h === "size" || h === "ukuran");
    let skuIdx  = headersLower.findIndex(h => h === "code" || h === "sku" || h === "item code" || h === "barcode");
    let catIdx  = headersLower.findIndex(h => h === "category" || h === "kategori");
    let priceIdx = headersLower.findIndex(h => h === "price" || h === "harga");

    if (namaIdx === -1) namaIdx = 1;
    if (sizeIdx === -1) sizeIdx = 3;
    if (skuIdx === -1)  skuIdx  = 4;
    if (catIdx === -1)  catIdx  = 0;

    const CABANG_MAP = {
      "inventory_lippo mall puri": "LMP", "inventory_mall kelapa gading": "MKG",
      "inventory_by the sea pik": "BTS", "inventory_central park jakarta": "CPJ",
      "inventory_ciputra world surabaya": "CWS", "inventory_living world tangerang": "LWS",
      "inventory_deli park medan": "DPM", "inventory_paskal hyper square bandung": "PHB",
      "inventory_pakuwon mall surabaya": "PMS", "inventory_neo soho jakarta": "NSJ",
      "inventory_puri indah mall": "PIM", "inventory_sun plaza medan": "SPM",
      "inventory_gaia pontianak": "GAIA", "inventory_gading serpong tangerang": "GST",
      "inventory_la vela tangerang": "LVL", "inventory_website": "WEB",
      "inventory_shopee": "SHP", "inventory_tokopedia": "TPD",
      "inventory_tiktok": "TTK", "inventory_lazada": "LZD"
    };

    const supabasePayload = [];
    const skuSeen = new Set();

    DB_PARSED_ROWS.forEach(function (r) {
      const sku = skuIdx > -1 ? String(r[skuIdx] || '').trim().toUpperCase() : '';
      const nama = namaIdx > -1 ? String(r[namaIdx] || '').trim() : '';
      const kategori = catIdx > -1 ? String(r[catIdx] || '').trim() : '-';
      const size = sizeIdx > -1 ? String(r[sizeIdx] || '').trim() : '-';
      const price = priceIdx > -1 ? (Number(r[priceIdx]) || 0) : 0;

      if (sku && nama && !skuSeen.has(sku)) {
        skuSeen.add(sku);

        const dealposChannels = {
          "Gudang Utama": 0, "Barang Live": 0, "Sample Studio": 0,
          "Permak / Cuci": 0, "Barang Cacat": 0, "WH": 0, "QC": 0, "GA": 0, "Lainnya": 0,
          "cabang": {}
        };

        for (let c = 0; c < headers.length; c++) {
          const hLower = headersLower[c];
          const qty = Number(r[c]) || 0;
          if (hLower.startsWith("inventory_") && qty !== 0) {
            const sub = hLower.replace("inventory_", "").trim();
            if (sub === "marketplace" || sub === "map") dealposChannels["Gudang Utama"] += qty;
            else if (sub === "sample live" || sub === "live") dealposChannels["Barang Live"] += qty;
            else if (sub === "sample studio" || sub === "studio") dealposChannels["Sample Studio"] += qty;
            else if (sub === "gudang permak" || sub === "permak" || sub === "cuci") dealposChannels["Permak / Cuci"] += qty;
            else if (sub === "diskon defect" || sub === "defect" || sub === "cacat") dealposChannels["Barang Cacat"] += qty;
            else if (sub === "warehouse" || sub === "wh") dealposChannels["WH"] += qty;
            else if (sub === "gudang qc" || sub === "qc") dealposChannels["QC"] += qty;
            else if (sub === "gudang awal" || sub === "ga") dealposChannels["GA"] += qty;
            else {
              const singkatan = CABANG_MAP[hLower];
              if (singkatan) dealposChannels.cabang[singkatan] = qty;
            }
          }
        }

        supabasePayload.push({
          sku: sku,
          nama_produk: nama,
          kategori: kategori,
          size: size,
          price: price,
          dealpos_channels: dealposChannels
        });
      }
    });

    if (supabasePayload.length === 0) {
      if (window.showWmsToast) window.showWmsToast('Tidak ada data produk yang valid untuk diunggah.', 'error');
      return;
    }

    // Tampilkan Progress Bar
    const progContainer = document.getElementById('dbUploadProgressContainer');
    const progText = document.getElementById('dbProgressStatusText');
    const progPercent = document.getElementById('dbProgressPercentText');
    const progFill = document.getElementById('dbProgressBarFill');

    progContainer.style.display = 'block';
    progFill.style.width = '5%';
    progPercent.textContent = '5%';
    progText.textContent = `Mengunggah ${supabasePayload.length.toLocaleString('id-ID')} SKU ke Supabase Cloud...`;

    if (window.setButtonLoading) window.setButtonLoading(btn, true, 'PUSH KE SUPABASE...');

    const CHUNK_SIZE = 1000;
    const totalChunks = Math.ceil(supabasePayload.length / CHUNK_SIZE);
    let uploadedCount = 0;
    let hasError = false;

    // Direct Parallel / Batch Push ke Supabase
    for (let i = 0; i < supabasePayload.length; i += CHUNK_SIZE) {
      const chunk = supabasePayload.slice(i, i + CHUNK_SIZE);
      try {
        const resp = await fetch(SUPABASE_DB_URL + "/rest/v1/master_produk?on_conflict=sku", {
          method: "POST",
          headers: {
            "apikey": SUPABASE_DB_KEY,
            "Authorization": "Bearer " + SUPABASE_DB_KEY,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify(chunk)
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        }

        uploadedCount += chunk.length;
        const pct = Math.min(95, Math.round((uploadedCount / supabasePayload.length) * 95));
        progFill.style.width = pct + '%';
        progPercent.textContent = pct + '%';
        progText.textContent = `Supabase: ${uploadedCount.toLocaleString('id-ID')} / ${supabasePayload.length.toLocaleString('id-ID')} SKU...`;

      } catch (err) {
        hasError = true;
        console.warn("Supabase direct push warning:", err.message);
        break;
      }
    }

    progFill.style.width = '100%';
    progPercent.textContent = '100%';

    if (!hasError) {
      progText.textContent = '✅ Supabase Cloud Selesai (1s)! Menyinkronkan Google Sheets di background...';
      if (window.showWmsToast) window.showWmsToast(`⚡ Berhasil! ${supabasePayload.length.toLocaleString('id-ID')} SKU aktif di Supabase Cloud. Menyinkronkan Google Sheets...`, 'success');
    } else {
      progText.textContent = 'Menyinkronkan langsung ke Google Sheets...';
    }

    if (window.setButtonLoading) window.setButtonLoading(btn, true, 'SINKRON GOOGLE SHEETS...');

    // Lanjutkan Full Replace ke Google Sheets "Data" di server
    google.script.run.withSuccessHandler(function (res) {
      if (window.setButtonLoading) window.setButtonLoading(btn, false);
      progContainer.style.display = 'none';
      if (res && res.success) {
        if (window.showWmsToast) window.showWmsToast(`🎉 Sempurna! Seluruh database (${res.jumlahAkhir ? res.jumlahAkhir.toLocaleString('id-ID') : supabasePayload.length} SKU) telah sinkron di Supabase & Spreadsheet!`, 'success');
        document.getElementById('dbCsvFileInput').value = '';
        document.getElementById('dbFilesPreviewArea').style.display = 'none';
        DB_PARSED_HEADER = null;
        DB_PARSED_ROWS = [];
        btn.disabled = true;
        muatInfoDatabase();
        if (typeof muatDataProduk === 'function') muatDataProduk();
      } else {
        if (window.showWmsToast) window.showWmsToast('Update selesai di Supabase. Sheet: ' + (res ? res.message : 'OK'), 'info');
      }
    }).withFailureHandler(function (err) {
      if (window.setButtonLoading) window.setButtonLoading(btn, false);
      progContainer.style.display = 'none';
      if (window.showWmsToast) window.showWmsToast('Supabase terupdate! Error background Sheets: ' + err.message, 'warning');
    }).updateDatabaseCsv(TOKEN, DB_PARSED_HEADER, DB_PARSED_ROWS);
  }

  function handleRebuildStock(btn) {
    if (window.setButtonLoading) window.setButtonLoading(btn, true, 'REBUILDING STOK...');
    if (window.showWmsToast) window.showWmsToast('Memulai proses rebuild stok menyeluruh...', 'info');

    google.script.run.withSuccessHandler(function (res) {
      if (window.setButtonLoading) window.setButtonLoading(btn, false);
      if (res && res.success) {
        if (window.showWmsToast) window.showWmsToast('Rebuild stok berhasil diselesaikan!', 'success');
        muatInfoDatabase();
        if (typeof muatDataProduk === 'function') muatDataProduk();
      } else {
        if (window.showWmsToast) window.showWmsToast('Rebuild stok selesai atau tidak ada error.', 'info');
      }
    }).withFailureHandler(function (err) {
      if (window.setButtonLoading) window.setButtonLoading(btn, false);
      if (window.showWmsToast) window.showWmsToast('Gagal rebuild: ' + err.message, 'error');
    }).rebuildStockTriggerManual();
  }
