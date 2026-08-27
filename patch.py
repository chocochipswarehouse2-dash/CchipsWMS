import re

with open('ViewFulfillment.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Define the new script block
new_script = """<script>
  const SUPABASE_URL = "https://filgijcfhgqlirzhvwho.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_L4FEkugwRKqcwFzLXfpZag_aByUy5mD";
  
  let currentFulfillmentTab = 'proses';
  let isFulfillmentInitialized = false;
  let FULFILLMENT_CSV_FILE = null;

  let FULFILLMENT_ON_PROCESS = [];
  let FULFILLMENT_COMPLETED = [];
  
  // Data dummy user jika CURRENT_USER belum diset dari GAS
  let CURRENT_USER = typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : 'Gudang';

  function initFulfillmentView() {
    if (!isFulfillmentInitialized) {
      isFulfillmentInitialized = true;
      muatDataFulfillment(true);
    }
  }

  function switchFulfillmentTab(tabId) {
    currentFulfillmentTab = tabId;
    document.querySelectorAll('.fulfillment-tab').forEach(el => el.classList.remove('active'));
    document.querySelector(.fulfillment-tab[onclick*=" + tabId + "]).classList.add('active');

    document.getElementById('fulfillmentOnProcessContainer').style.display = 'none';
    document.getElementById('fulfillmentCompletedContainer').style.display = 'none';

    if (tabId === 'proses') {
      document.getElementById('fulfillmentOnProcessContainer').style.display = 'block';
    } else {
      document.getElementById('fulfillmentCompletedContainer').style.display = 'block';
    }
  }

  function saveToLocalStorage() {
    localStorage.setItem('FULFILLMENT_ON_PROCESS', JSON.stringify(FULFILLMENT_ON_PROCESS));
    localStorage.setItem('FULFILLMENT_COMPLETED', JSON.stringify(FULFILLMENT_COMPLETED));
  }

  function muatDataFulfillment(force) {
    const containerProses = document.getElementById('fulfillmentOnProcessContainer');
    if (containerProses && force) {
      containerProses.innerHTML = '<div style="text-align: center; padding: 35px 20px; color: var(--text-muted); font-style: italic;">Memuat data Picking List lokal...</div>';
    }

    try {
      const storedOnProcess = localStorage.getItem('FULFILLMENT_ON_PROCESS');
      if (storedOnProcess) FULFILLMENT_ON_PROCESS = JSON.parse(storedOnProcess);
      
      const storedCompleted = localStorage.getItem('FULFILLMENT_COMPLETED');
      if (storedCompleted) FULFILLMENT_COMPLETED = JSON.parse(storedCompleted);
      
      updateTabBadges();
      renderFulfillmentOnProcessBubbles();
      renderFulfillmentCompletedBubbles();
    } catch(err) {
      console.error(err);
      if (containerProses) {
        containerProses.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 30px;">Error memuat data lokal: ' + err.message + '</div>';
      }
    }
  }

  function updateTabBadges() {
    const badgeProses = document.getElementById('badgeFulfillmentProses');
    const badgeCompleted = document.getElementById('badgeFulfillmentCompleted');
    if (badgeProses) {
      badgeProses.textContent = FULFILLMENT_ON_PROCESS.length;
      badgeProses.style.display = FULFILLMENT_ON_PROCESS.length > 0 ? 'inline-block' : 'none';
    }
    if (badgeCompleted) {
      badgeCompleted.textContent = FULFILLMENT_COMPLETED.length;
      badgeCompleted.style.display = FULFILLMENT_COMPLETED.length > 0 ? 'inline-block' : 'none';
    }
  }

  function handleCsvFileSelected(input) {
    const file = input.files[0];
    if (!file) return;

    const label = document.getElementById('fulfillmentUploadLabel');
    if (label) {
      label.innerHTML = <span style="font-size: 24px; display: block; margin-bottom: 6px;">📄</span> File Terpilih: <b></b>;
      label.classList.add('has-file');
    }
    FULFILLMENT_CSV_FILE = file;
    document.getElementById('btnProcessUpload').style.display = 'inline-flex';
  }

  function resetFulfillmentUpload() {
    FULFILLMENT_CSV_FILE = null;
    const input = document.getElementById('fulfillmentCsvInput');
    if (input) input.value = "";
    
    const label = document.getElementById('fulfillmentUploadLabel');
    if (label) {
      label.innerHTML = 
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">📥</span>
        <b style="font-size: 14px; display: block; margin-bottom: 4px; color: var(--text-color);">Klik atau Tarik File CSV ke Sini</b>
        <span style="color: var(--text-muted); font-size: 11px;">Upload file "Transfer Order" (.csv) dari marketplace/TikTok</span>
      ;
      label.classList.remove('has-file');
    }
    document.getElementById('btnProcessUpload').style.display = 'none';
  }

  function parseRefillCsvLine(text) {
    let result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      let char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  async function handleProcessFulfillment(force = false) {
    if (!FULFILLMENT_CSV_FILE) return;
    
    const btn = document.getElementById('btnProcessUpload');
    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MEMPROSES...');

    const file = FULFILLMENT_CSV_FILE;
    const reader = new FileReader();
    
    reader.onload = async function(e) {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(x => x.trim().length > 0);
        if (lines.length < 2) {
          throw new Error("File CSV kosong atau tidak valid.");
        }

        let newGroups = {};
        let allSkus = new Set();
        let skippedSJs = [];

        // Parse CSV
        for (let i = 1; i < lines.length; i++) {
          const row = parseRefillCsvLine(lines[i]);
          if (row.length < 10) continue;

          const dateVal = row[0] || "";
          const noSJ = String(row[1] || "").trim();
          const category = row[2] || "";
          const produk = String(row[3] || "").trim();
          const variant = String(row[4] || "").trim();
          const sku = String(row[5] || "").trim().toUpperCase();
          const qty = Number(row[7]) || 0;
          const tujuan = String(row[9] || "").trim();

          if (noSJ && qty > 0) {
            // Cek apakah SJ sudah ada di completed atau onProcess
            if (!force) {
               if (FULFILLMENT_COMPLETED.find(b => b.noSJ === noSJ) || FULFILLMENT_ON_PROCESS.find(b => b.noSJ === noSJ)) {
                 if (!skippedSJs.includes(noSJ)) skippedSJs.push(noSJ);
                 continue; // Skip
               }
            }

            if (!newGroups[noSJ]) {
              newGroups[noSJ] = {
                noSJ: noSJ,
                tujuan: tujuan || "Marketplace",
                date: dateVal,
                items: [],
                totalQtyReq: 0,
                totalQtyPicked: 0,
                isCompleted: false,
                isPrinted: false
              };
            }

            let namaFinal = produk;
            if (variant && variant !== "-" && variant.toLowerCase() !== "default") {
              if (!variant.toLowerCase().includes(produk.toLowerCase())) {
                namaFinal = produk + " (" + variant + ")";
              } else {
                namaFinal = variant;
              }
            }

            newGroups[noSJ].items.push({
              sku: sku,
              nama: namaFinal,
              variant: variant,
              qtyReq: qty,
              qtyPicked: qty,
              lokasi: "-",
              isChecked: false
            });
            newGroups[noSJ].totalQtyReq += qty;
            allSkus.add(sku);
          }
        }

        if (skippedSJs.length > 0) {
          if (!confirm(Terdapat  Surat Jalan yang sudah ada atau pernah dicetak (misal: ). \n\nLanjutkan tanpa Surat Jalan tersebut?)) {
             if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
             return;
          }
        }

        const skuArray = Array.from(allSkus);
        if (skuArray.length === 0) {
          throw new Error("Tidak ada data valid yang dapat diproses.");
        }

        // Ambil lokasi dari Supabase
        const skuLocMap = {};
        const chunkSize = 50;
        for (let i = 0; i < skuArray.length; i += chunkSize) {
          const chunk = skuArray.slice(i, i + chunkSize);
          const res = await fetch(${SUPABASE_URL}/rest/v1/master_produk?select=sku,nama,lokasi&sku=in.(), {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
            }
          });
          if (res.ok) {
            const data = await res.json();
            data.forEach(d => {
               skuLocMap[d.sku.toUpperCase()] = d.lokasi || "-";
            });
          }
        }

        // Terapkan lokasi
        const newlyAdded = [];
        for (let sj in newGroups) {
          let g = newGroups[sj];
          g.items.forEach(it => {
            if (skuLocMap[it.sku]) {
              it.lokasi = skuLocMap[it.sku];
            }
          });
          
          // Hapus jika exist dan di-force
          if (force) {
            FULFILLMENT_ON_PROCESS = FULFILLMENT_ON_PROCESS.filter(b => b.noSJ !== sj);
            FULFILLMENT_COMPLETED = FULFILLMENT_COMPLETED.filter(b => b.noSJ !== sj);
          }
          
          FULFILLMENT_ON_PROCESS.unshift(g); // Tambah ke awal
          newlyAdded.push(g);
        }

        saveToLocalStorage();
        updateTabBadges();
        renderFulfillmentOnProcessBubbles();
        resetFulfillmentUpload();
        if (window.showToast) window.showToast(Sukses memproses  Surat Jalan., "success");

      } catch(err) {
        alert("Error memproses file: " + err.message);
      } finally {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      }
    };
    reader.readAsText(file);
  }

  function toggleCheckItem(bIdx, itemIdx) {
    const bubble = FULFILLMENT_ON_PROCESS[bIdx];
    if (!bubble) return;
    const item = bubble.items[itemIdx];
    if (!item) return;

    item.isChecked = !item.isChecked;
    if (item.isChecked && item.qtyPicked === undefined) {
      item.qtyPicked = item.qtyReq; 
    }
    
    saveToLocalStorage();
    renderFulfillmentOnProcessBubbles();
  }

  function updateItemPickedQty(bIdx, itemIdx, val) {
    const bubble = FULFILLMENT_ON_PROCESS[bIdx];
    if (!bubble) return;
    const item = bubble.items[itemIdx];
    if (!item) return;

    let parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 0) parsed = 0;
    
    item.qtyPicked = parsed;
    if (parsed > 0 && !item.isChecked) {
      item.isChecked = true; 
    }
    
    saveToLocalStorage();
    renderFulfillmentOnProcessBubbles();
  }

  async function konfirmasiSelesaiPicking(bIdx, btn) {
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

    let confirmMsg = Konfirmasi selesai picking untuk Surat Jalan  ()?\n\n +
      📦 Total SKU: \n +
      ✅ SKU Diceklis:  dari \n +
      📦 Total Fisik Diambil:  dari  pcs\n\n +
      Picking list ini akan otomatis dipindahkan ke tab SELESAI PICKING. Lanjutkan?;

    if (!confirm(confirmMsg)) return;

    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MENYIMPAN...');

    try {
      // 1. Simpan history mutasi (log_produk) type OUT
      const mutasiPayload = items.filter(it => it.isChecked && it.qtyPicked > 0).map(it => {
        return {
          sku: it.sku,
          qty: it.qtyPicked,
          tipe_mutasi: 'OUT',
          keterangan: Fulfillment  - ,
          pic: CURRENT_USER,
          waktu: new Date().toISOString()
        };
      });

      if (mutasiPayload.length > 0) {
         const res = await fetch(${SUPABASE_URL}/rest/v1/log_produk, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(mutasiPayload)
         });
         
         if (!res.ok) {
           const errData = await res.json();
           throw new Error("Supabase error (log_produk): " + (errData.message || JSON.stringify(errData)));
         }
      }

      // 2. Pindahkan ke tab Completed
      bubble.isCompleted = true;
      bubble.status = "SELESAI";
      bubble.totalQtyPicked = totalPicked;
      
      FULFILLMENT_ON_PROCESS.splice(bIdx, 1);
      FULFILLMENT_COMPLETED.unshift(bubble);

      saveToLocalStorage();
      updateTabBadges();
      renderFulfillmentOnProcessBubbles();
      renderFulfillmentCompletedBubbles();

      if (window.showToast) window.showToast(Picking SJ  Selesai!, "success");

    } catch(err) {
      alert("Error menyimpan: " + err.message);
    } finally {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
    }
  }

  function toggleBubbleDetail(bIdx) {
    const wrap = document.getElementById(ubbleTableWrap_);
    const toggleText = document.getElementById(	oggleText_);
    if (!wrap) return;

    if (wrap.style.display === 'none') {
      wrap.style.display = 'block';
      if (toggleText) toggleText.textContent = 👁️ Tutup;
    } else {
      wrap.style.display = 'none';
      if (toggleText) toggleText.textContent = 👁️ Rincian;
    }
  }

  // ============ RENDER TAB 1: ON PROSES (INTERACTIVE PICKING) ============
  function renderFulfillmentOnProcessBubbles() {
    const container = document.getElementById('fulfillmentOnProcessContainer');
    const badge = document.getElementById('fulfillmentProsesSummaryBadge');
    if (!container) return;

    if (FULFILLMENT_ON_PROCESS.length === 0) {
      container.innerHTML = 
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-style: italic;">
          <div style="font-size: 32px; margin-bottom: 8px;">📦</div>
          Tidak ada antrean Picking List yang aktif.<br>Silakan upload file CSV di atas untuk membuat Picking List baru.
        </div>
      ;
      if (badge) badge.textContent = "0 Surat Jalan Aktif";
      return;
    }

    let totalPcsReq = 0;
    FULFILLMENT_ON_PROCESS.forEach(b => { totalPcsReq += (Number(b.totalQtyReq) || 0); });
    if (badge) badge.innerHTML = <b> Surat Jalan</b> &bull; <b> Pcs Total</b>;

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

      let rowsHtml = '';
      items.forEach((item, itemIdx) => {
        const loc = String(item.lokasi || '-').trim();
        const isKoli = loc.toUpperCase().includes('KOLI');
        const locBadge = (loc && loc !== '-')
          ? (isKoli ? <span class="badge-rak-koli">📦 </span> : <span class="badge-rak-loc">📍 </span>)
          : <span style="color: var(--text-muted); font-size: 10.5px;">-</span>;

        const isRowChecked = Boolean(item.isChecked);

        rowsHtml += 
          <tr class="picking-item-row " id="pickRow__" style="font-size: 12px;">
            <td style="text-align: center; width: 35px; color: var(--text-muted); font-weight: 600;"></td>
            <td style="text-align: center; width: 45px; padding: 4px;">
              <button type="button" class="btn-check-pick " onclick="toggleCheckItem(, )" title="Ceklis barang sudah diambil dari rak">
                
              </button>
            </td>
            <td style="font-weight: 700; color: var(--primary); padding-left: 8px; width: 135px;"><span class="badge-sku"></span></td>
            <td style="padding-left: 8px; font-weight: 600;"></td>
            <td style="text-align: center; font-weight: 700; color: var(--text-muted); width: 60px;"></td>
            <td style="text-align: center; width: 75px; padding: 4px;">
              <input type="number" min="0" max="" value="" class="input-qty-pick" onchange="updateItemPickedQty(, , this.value)" onfocus="this.select()" title="Sesuaikan jika barang yang didapat kurang dari request">
            </td>
            <td style="text-align: center; width: 110px;"></td>
          </tr>
        ;
      });

      html += 
        <div class="fulfillment-bubble-card" id="bubbleCard_">
          
          <div class="bubble-header">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 14px;">🛍️</span>
              <span class="bubble-meta-tag bubble-tag-sj">No SJ: </span>
              <span class="bubble-meta-tag bubble-tag-tujuan">🏪 </span>
              <span class="bubble-meta-tag "></span>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 6px;" title="Progress pengambilan barang">
                <div class="mini-progress-track">
                  <div class="mini-progress-fill" id="progFill_" style="width: %;"></div>
                </div>
                <span id="progText_" style="font-size: 11px; font-weight: 700; color: var(--text-muted); min-width: 45px;">/</span>
              </div>

              <button type="button" class="btn btn-secondary" onclick="cetakSingleSuratJalan(, this)" style="height: 28px; padding: 0 10px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" title="Cetak Surat Jalan PDF">
                🖨️ CETAK SJ
              </button>

              <button type="button" class="btn btn-primary" onclick="konfirmasiSelesaiPicking(, this)" style="height: 28px; padding: 0 12px; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px; background: #10b981; border-color: #10b981;" title="Selesaikan picking dan pindahkan ke tab Selesai">
                ✅ DONE
              </button>

              <button type="button" class="btn btn-secondary" onclick="toggleBubbleDetail()" style="height: 28px; padding: 0 8px; font-size: 11px;" title="Buka / Tutup tabel rincian">
                <span id="toggleText_">👁️ Rincian</span>
              </button>
            </div>
          </div>

          <div style="padding: 6px 14px; background: var(--bg-surface); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted);">
            <div>
              <b>Tanggal:</b>  &bull; <b>Tujuan:</b> 
            </div>
            <div>
              Total: <b> SKU</b> &bull; Request: <b> Pcs</b> &bull; Diambil: <b style="color: #10b981;" id="pickedTotal_"> Pcs</b>
            </div>
          </div>

          <div id="bubbleTableWrap_" style="display: block; overflow-x: auto;">
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
                
              </tbody>
            </table>
          </div>
        </div>
      ;
    });
    container.innerHTML = html;
  }

  // ============ RENDER TAB 2: SELESAI PICKING ============
  function renderFulfillmentCompletedBubbles() {
    const container = document.getElementById('fulfillmentCompletedContainer');
    const badge = document.getElementById('fulfillmentCompletedSummaryBadge');
    if (!container) return;

    if (FULFILLMENT_COMPLETED.length === 0) {
      container.innerHTML = 
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-style: italic;">
          <div style="font-size: 32px; margin-bottom: 8px;">✅</div>
          Tidak ada data Picking List yang telah selesai.
        </div>
      ;
      if (badge) badge.textContent = "0 Surat Jalan Selesai";
      return;
    }

    if (badge) badge.innerHTML = <b> Surat Jalan</b> Selesai;

    let html = '';
    FULFILLMENT_COMPLETED.forEach((bubble, bIdx) => {
      const items = bubble.items || [];
      let rowsHtml = '';
      items.forEach((item, itemIdx) => {
        rowsHtml += 
          <tr style="font-size: 12px; background: #f9fafb;">
            <td style="text-align: center; width: 35px; color: var(--text-muted); font-weight: 600;"></td>
            <td style="font-weight: 700; color: var(--primary); padding-left: 8px; width: 135px;"><span class="badge-sku"></span></td>
            <td style="padding-left: 8px; font-weight: 600;"></td>
            <td style="text-align: center; font-weight: 700; width: 70px;"></td>
            <td style="text-align: center; font-weight: 800; color: #10b981; width: 70px;"></td>
            <td style="text-align: center; width: 110px;"><span class="badge-rak-loc"></span></td>
          </tr>
        ;
      });

      html += 
        <div class="fulfillment-bubble-card completed-card">
          <div class="bubble-header">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 14px;">✅</span>
              <span class="bubble-meta-tag bubble-tag-sj">No SJ: </span>
              <span class="bubble-meta-tag bubble-tag-tujuan">🏪 </span>
              <span class="bubble-meta-tag bubble-tag-done">✓ SELESAI PICKING</span>
            </div>

            <div style="display: flex; align-items: center; gap: 6px;">
              <button type="button" class="btn btn-secondary" onclick="cetakSingleSuratJalanCompleted('', this)" style="height: 28px; padding: 0 10px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" title="Cetak ulang Surat Jalan PDF">
                🖨️ CETAK ULANG SJ
              </button>

              <button type="button" class="btn btn-secondary" onclick="toggleCompletedDetail()" style="height: 28px; padding: 0 8px; font-size: 11px;" title="Lihat rincian barang">
                <span id="toggleCompText_">👁️ Rincian ()</span>
              </button>

              <button type="button" class="btn btn-secondary" onclick="kembalikanKeProses('', this)" style="height: 28px; padding: 0 8px; font-size: 11px; color: var(--danger); border-color: rgba(239,68,68,0.3);" title="Kembalikan ke tab On Proses jika salah selesai">
                ↩️ KEMBALIKAN
              </button>
            </div>
          </div>

          <div style="padding: 6px 14px; background: var(--bg-surface); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted);">
            <div>
              <b>Tanggal:</b>  &bull; <b>Tujuan:</b> 
            </div>
            <div>
              Total: <b> SKU</b> &bull; Request: <b> Pcs</b> &bull; Terambil: <b style="color: #10b981;"> Pcs</b>
            </div>
          </div>

          <div id="compTableWrap_" style="display: none; overflow-x: auto;">
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
                
              </tbody>
            </table>
          </div>
        </div>
      ;
    });
    container.innerHTML = html;
  }

  function toggleCompletedDetail(bIdx) {
    const wrap = document.getElementById(compTableWrap_);
    const toggleText = document.getElementById(	oggleCompText_);
    if (!wrap) return;

    if (wrap.style.display === 'none') {
      wrap.style.display = 'block';
      if (toggleText) toggleText.textContent = 👁️ Tutup;
    } else {
      wrap.style.display = 'none';
      if (toggleText) toggleText.textContent = 👁️ Rincian;
    }
  }

  function kembalikanKeProses(noSJ, btn) {
    if (!confirm(Kembalikan Surat Jalan  ke tab Picking Proses? (Ini hanya memindahkan tab, stok yang sudah tercatat keluar di Supabase TIDAK di-revert otomatis).)) return;

    const bIdx = FULFILLMENT_COMPLETED.findIndex(b => b.noSJ === noSJ);
    if (bIdx >= 0) {
      const bubble = FULFILLMENT_COMPLETED[bIdx];
      bubble.isCompleted = false;
      bubble.status = "SIAP PICKING";
      FULFILLMENT_COMPLETED.splice(bIdx, 1);
      FULFILLMENT_ON_PROCESS.unshift(bubble);

      saveToLocalStorage();
      updateTabBadges();
      renderFulfillmentOnProcessBubbles();
      renderFulfillmentCompletedBubbles();
      
      if (window.showToast) window.showToast(Surat Jalan  dikembalikan ke On Proses., "info");
    }
  }

  // ============ CETAK SURAT JALAN ============
  function cetakSingleSuratJalan(bIdx, btn) {
    alert("Fitur cetak Surat Jalan PDF dinonaktifkan di versi Client-Side sementara waktu.");
  }

  function cetakSingleSuratJalanCompleted(noSJ, btn) {
    alert("Fitur cetak Surat Jalan PDF dinonaktifkan di versi Client-Side sementara waktu.");
  }

  function cetakSemuaSuratJalanAktif() {
    alert("Fitur cetak Surat Jalan PDF dinonaktifkan di versi Client-Side sementara waktu.");
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
</script>"""

# Replace in html
updated_html = re.sub(r'<script>\s*let currentFulfillmentTab.*?</script>', new_script, html, flags=re.DOTALL)

with open('ViewFulfillment.html', 'w', encoding='utf-8') as f:
    f.write(updated_html)

print("Patch successful!")
