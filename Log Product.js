/************************************************
 FILE LOG PRODUCT.GS
 ************************************************/
function prosesKeluarMasuk(json) {
  // 1. CEK ID PESAN DI AWAL (Mencegah Webhook mengirim ulang data yang sama/Double)
  const dedupKey = getWebhookDedupKey(json);
  if (dedupKey && isDuplicateWebhook(dedupKey)) {
    return ContentService.createTextOutput("OK"); 
  }
  if (dedupKey) saveWebhookHistory(dedupKey);

  // 2. GUNAKAN LOCK SERVICE (Mencegah tabrakan saat operator input bersamaan)
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); 
  } catch (e) {
    return ContentService.createTextOutput("BUSY"); 
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID)
      .getSheets()
      .find(s => s.getName().toUpperCase() === SHEET_NAME_LOG_PRODUCT.toUpperCase());

    if (!sheet) return ContentService.createTextOutput("SHEET_NOT_FOUND");

    const sender = json.sender || "";
    const name = json.pushname || json.name || sender;
    const message = (json.message || json.pesan || "").trim();

    const groupId = (json.sender && json.sender.includes("@g.us")) ? json.sender :
                    (json.pengirim && json.pengirim.includes("@g.us")) ? json.pengirim : null;

    if (!groupId || !ALLOWED_GROUPS_LOG_PRODUCT.includes(groupId)) return ContentService.createTextOutput("IGNORED");
    if (message === "") return ContentService.createTextOutput("OK");

    const lines = message.split("\n").map(x => x.trim()).filter(Boolean);
    
    let currentType = "";
    let currentDeskripsi = "";
    let currentLokasi = "";
    let rows = [];
    
    // UBAH DI SINI: Gunakan Utilities.formatDate agar menyimpan format Tanggal + Jam akurat dalam bentuk teks
    const waktuLengkap = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss"); 
    
    const invoice = getInvoice();
    const operator = name + " | " + sender;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let upper = line.toUpperCase();

      // Deteksi IN / OUT
      if (upper.startsWith("#IN") || upper.startsWith("#OUT")) {
        currentType = upper.startsWith("#IN") ? TYPE_IN : TYPE_OUT;
        currentDeskripsi = line.substring(upper.startsWith("#IN") ? 3 : 4).trim();
        continue;
      }

      // Deteksi Lokasi
      if (upper.startsWith("#LOK")) {
        let lokasiInput = line.replace(/#LOK/i, "").trim();
        if (lokasiInput !== "") {
          currentLokasi = lokasiInput;
        }
        continue;
      }

      // Proses SKU (Jika lokasi sudah ada)
      if (currentLokasi !== "") {
        const typeToUse = (currentType === "") ? TYPE_SO : currentType;
        const deskripsiToUse = (currentType === "") ? KETERANGAN_SO : currentDeskripsi;
        const area = getArea(currentLokasi);
        
        rows.push([
          waktuLengkap, // Masukkan objek tanggal ber-jam lengkap ke Kolom A
          line,
          currentLokasi,
          invoice,
          operator,
          typeToUse,
          deskripsiToUse,
          area
        ]);
      }
    }

    if (rows.length > 0) {
      const startRow = findNextRow(sheet);
      sheet.getRange(startRow, 1, rows.length, 8).setValues(rows);
      
      // 3. SIMPAN HISTORY SEBELUM REBUILD STOCK
      saveWebhookHistory(json.inboxid);

      try { 
        if (typeof updateStockIncremental === "function") {
          updateStockIncremental(rows);
        } else {
          rebuildStock(); 
        }
      } catch (e) { 
        Logger.log(e); 
      }

      // 4. [REAL-TIME SUPABASE SYNC] Update log_produk di Supabase
      try {
        if (typeof catatLogDanUpdateStokSupabaseBatch === "function") {
          const batchEntries = rows.map(function (r) {
            const skuRow = String(r[1] || "").trim().toUpperCase();
            const meta = typeof cariMetaProdukBySku === "function" ? cariMetaProdukBySku(skuRow) : { nama: skuRow, size: "-" };
            return {
              type: r[5],
              invoice: r[3],
              sku: skuRow,
              nama: (meta && meta.nama) ? meta.nama : skuRow,
              size: (meta && meta.size) ? meta.size : "-",
              area: r[7],
              lokasi: r[2],
              qty: 1,
              operator: r[4],
              keterangan: r[6]
            };
          });

          catatLogDanUpdateStokSupabaseBatch(batchEntries);
        }
      } catch (errSupAll) {
        Logger.log("Supabase real-time sync gagal: " + errSupAll.message);
      }
    } else {
      saveWebhookHistory(json.inboxid);
    }

    return ContentService.createTextOutput("OK");

  } finally {
    // 4. SELALU LEPASKAN KUNCI (LOCK) SETELAH SELESAI
    lock.releaseLock();
  }
}