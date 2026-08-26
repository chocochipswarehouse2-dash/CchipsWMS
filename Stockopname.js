/************************************************
 * FILE STOCK OPNAME.GS
 *
 * REVISI (SeqID): baris yang ditulis ke Log Product sekarang
 * juga diisi kolom L (SeqID) -- angka urut naik terus, dipakai
 * sebagai penanda utk rebuildStock() versi incremental (akan
 * ditulis di langkah berikutnya, RebuildStock.gs). Logika
 * routing/parsing pesan WA & alur opname TIDAK berubah sama
 * sekali di file ini.
 ************************************************/
/************************************************
 * DEBUG LOG -- nulis ke sheet "Debug Log" (dibikin
 * otomatis kalau belum ada). Dipakai buat nelusurin
 * kasus kayak "kenapa item ini nggak masuk ke antrian
 * adjustment", karena Executions log Apps Script suka
 * nggak reliable/delay dan doPost dipakai bareng banyak
 * webhook jadi susah dibedain.
 ************************************************/
function debugLog(context, message) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName("Debug Log");
    if (!sheet) {
      sheet = ss.insertSheet("Debug Log");
      sheet.appendRow(["Waktu", "Context", "Pesan"]);
    }
    sheet.appendRow([
      Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss"),
      context,
      message
    ]);
  } catch (e) {
    // last resort: kalau debug log sendiri gagal, jangan sampai
    // ikut nge-crash proses utamanya.
  }
}

function prosesStockOpname(json) {
  debugLog("prosesStockOpname", "MASUK FUNGSI. raw json=" + JSON.stringify(json));

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID)
    .getSheets()
    .find(s => s.getName().toUpperCase() === SHEET_NAME_LOG_PRODUCT.toUpperCase());

  if (!sheet) {
    debugLog("prosesStockOpname", "STOP: sheet '" + SHEET_NAME_LOG_PRODUCT + "' tidak ketemu.");
    return ContentService.createTextOutput("SHEET_NOT_FOUND");
  }

  const sender = json.sender || json.pengirim || json.from || json.phone || "";
  const name = json.pushname || json.name || sender;
  const message = (json.message || json.pesan || json.text || "").trim();

  let groupId = null;
  const candidates = [
    json.sender,
    json.pengirim,
    json.from,
    json.chatId,
    json.chat_id,
    json.group,
    json.group_id,
    json.id,
    json.target
  ];
  for (let i = 0; i < candidates.length; i++) {
    const c = String(candidates[i] || "").trim();
    if (c.includes("@g.us")) {
      groupId = c;
      break;
    }
  }

  // Jika pesan dikirim di dalam grup WA, pastikan grupnya terdaftar
  if (groupId && ALLOWED_GROUPS_LOG_PRODUCT && ALLOWED_GROUPS_LOG_PRODUCT.length > 0) {
    if (!ALLOWED_GROUPS_LOG_PRODUCT.includes(groupId)) {
      debugLog("prosesStockOpname", "STOP: groupId=" + groupId + " tidak ada di ALLOWED_GROUPS_LOG_PRODUCT=" + JSON.stringify(ALLOWED_GROUPS_LOG_PRODUCT));
      return ContentService.createTextOutput("IGNORED");
    }
  }

  if (message === "") {
    debugLog("prosesStockOpname", "STOP: message kosong.");
    return ContentService.createTextOutput("OK");
  }

  const lines = message.split("\n").map(x => x.trim()).filter(Boolean);

  let currentType = "";
  let currentDeskripsi = "";
  let currentLokasi = "";
  let rows = [];
  const itemsOpnameFisik = []; // { sku, lokasi, qtyFisik } -- hasil agregasi baris tanpa #IN/#OUT

  const waktuPesan = new Date();
  const tanggal = Utilities.formatDate(waktuPesan, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss"); // 1 Pesan WA = 1 Timestamp Waktu Identik Presisi
  let invoice = "";
  const operator = name + " | " + sender;

  // hitungFisik[lokasi][sku] = jumlah baris (qty fisik hasil scan/listing)
  const hitungFisik = {};

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let upper = line.toUpperCase();

    // Deteksi IN / OUT (termasuk #STD IN, #STD OUT, #SCAN IN, #SCAN OUT, #IN, #OUT, dll)
    if (upper.includes(" IN") || upper.startsWith("#IN")) {
      currentType = TYPE_IN;
      currentDeskripsi = line.replace(/^#[A-Z0-9_\s]*IN\b/i, "").trim() || "IN";
      continue;
    }
    if (upper.includes(" OUT") || upper.startsWith("#OUT")) {
      currentType = TYPE_OUT;
      currentDeskripsi = line.replace(/^#[A-Z0-9_\s]*OUT\b/i, "").trim() || "OUT";
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
        tanggal,
        line,
        currentLokasi,
        "", // invoice diisi nanti jika rows.length > 0
        operator,
        typeToUse,
        deskripsiToUse,
        area
      ]);

      // Kalau baris ini murni listing (stock opname, bukan #IN/#OUT eksplisit),
      // agregasi jadi qty fisik per SKU+Lokasi utk dibandingkan dgn stok sistem.
      if (typeToUse === TYPE_SO) {
        const lokNorm = normalizeLokasi(currentLokasi);
        const skuNorm = String(line || "").trim().toUpperCase();
        if (!hitungFisik[lokNorm]) hitungFisik[lokNorm] = {};
        hitungFisik[lokNorm][skuNorm] = (hitungFisik[lokNorm][skuNorm] || 0) + 1;
      }
    }
  }

  if (rows.length > 0) {
    // Generate Invoice TEPAT sebelum ditulis (tidak lompat/hilang)
    invoice = getInvoice();
    for (let ri = 0; ri < rows.length; ri++) {
      rows[ri][3] = invoice;
    }

    const startRow = findNextRow(sheet);
    sheet.getRange(startRow, 1, rows.length, 8).setValues(rows);

    try {
      rebuildStock();
    } catch (errFull) {
      Logger.log("rebuildStock error: " + errFull.message);
    }

    // [FAST BATCH SUPABASE SYNC] Cukup 1 HTTP Request (150ms)
    try {
      if (typeof catatLogDanUpdateStokSupabaseBatch === "function") {
        const batchEntries = rows.map(function (r) {
          const skuRow = String(r[1] || "").trim().toUpperCase();
          return {
            type: r[5],
            invoice: invoice,
            sku: skuRow,
            nama: skuRow,
            size: "-",
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
      Logger.log("Supabase batch sync error: " + errSupAll.message);
    }
  }

  // Susun daftar item opname fisik dari hasil agregasi, lalu masukkan
  // ke antrian adjustment (butuh approval) kalau ada selisih vs sistem.
  Object.keys(hitungFisik).forEach(function (lokasi) {
    Object.keys(hitungFisik[lokasi]).forEach(function (sku) {
      itemsOpnameFisik.push({ sku: sku, lokasi: lokasi, qtyFisik: hitungFisik[lokasi][sku] });
    });
  });

  debugLog("prosesStockOpname", "invoice=" + invoice + " hitungFisik=" + JSON.stringify(hitungFisik) + " itemsOpnameFisik.length=" + itemsOpnameFisik.length);

  if (itemsOpnameFisik.length > 0) {
    try {
      // Parameter ke-3 = true: jalur WA menarik & membandingkan SEMUA
      // SKU yang sistem catat ada di lokasi yang disebut (#LOK), bukan
      // cuma yang eksplisit muncul di pesan ini -- termasuk yang qty
      // sistemnya minus. Beda dengan jalur WEB/CSV yang cuma bandingkan
      // apa yang eksplisit ada di data yang diupload (lihat
      // submitSesiOpname di StockOpnameAdjustment.gs).
      const hasilOpname = simpanSesiOpnameInternal(itemsOpnameFisik, operator, true);
      debugLog("prosesStockOpname", "invoice=" + invoice + " hasil simpanSesiOpnameInternal=" + JSON.stringify(hasilOpname));
    } catch (e) {
      debugLog("prosesStockOpname", "invoice=" + invoice + " ERROR simpanSesiOpnameInternal: " + e.message + " | " + e.stack);
      Logger.log("Gagal simpan sesi opname dari WA: " + e.message);
    }
  } else {
    debugLog("prosesStockOpname", "invoice=" + invoice + " itemsOpnameFisik KOSONG, tidak ada yang disubmit ke antrian adjustment.");
  }

  saveWebhookHistory(getWebhookDedupKey(json));
  return ContentService.createTextOutput("OK");
}

/************************************************
 * ENDPOINT SUBMIT SCAN DARI WEB APP GITHUB
 ************************************************/
function submitScannerWeb(token, payload) {
  const session = getWmsSessionFromToken(token);
  if (!session) return { success: false, message: "Sesi login tidak valid / kadaluarsa." };
  
  // Mendukung format payload baru (array teks langsung)
  let finalMessage = "";
  if (payload && payload.data && payload.data.length > 0) {
      finalMessage = payload.data.join("\n");
  } else if (payload && payload.items && payload.items.length > 0) {
      // Fallback format lama (jika ada cache browser yg belum terupdate)
      const messageLines = [];
      let currentKat = "";
      let currentLok = "";
      for (let i = payload.items.length - 1; i >= 0; i--) {
         const it = payload.items[i];
         if (it.category && it.category !== currentKat && it.category !== "-") {
            currentKat = it.category;
            messageLines.push("#" + currentKat);
         }
         if (it.location && it.location !== currentLok && it.location !== "-") {
            currentLok = it.location;
            messageLines.push("#LOK " + currentLok);
         }
         messageLines.push(it.sku);
      }
      finalMessage = messageLines.join("\n");
  } else {
      return { success: false, message: "Data scan kosong." };
  }
  
  // Format event dummy layaknya payload WA asli
  const dummyJson = {
      message: finalMessage,
      sender: session.username + " | ScannerWeb",
      inboxid: "WEB-" + Date.now()
  };
  
  try {
     // Gunakan logic yang sudah battle-tested untuk opname/mutasi
     const resText = prosesStockOpname(dummyJson).getContent();
     if (resText.includes("ERROR")) {
        return { success: false, message: resText };
     }
     return { success: true, message: "Berhasil disimpan ke Log Produk!" };
  } catch(e) {
     return { success: false, message: e.message };
  }
}