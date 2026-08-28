/**
 * FILE SyncSupabaseToSheet.js
 * Bertugas untuk melakukan sinkronisasi satu arah (Sync-Back) dari Supabase 
 * ke Google Sheets secara reguler (Time-Driven Trigger) maupun manual.
 * Google Sheets difungsikan sebagai passive live backup & reporting.
 */

function initSyncSupabase() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shLog = ss.getSheetByName("Log Product");
  const props = PropertiesService.getScriptProperties();

  // Cari invoice terakhir yang ada di sheet Log Product secara akurat
  let lastInvoice = "";
  if (shLog) {
    const nextRow = typeof findNextRow === "function" ? findNextRow(shLog) : (shLog.getLastRow() + 1);
    const lastRowIndex = nextRow - 1;
    if (lastRowIndex > 1) {
      const invVal = shLog.getRange(lastRowIndex, 4).getValue(); // Kolom D: Invoice
      lastInvoice = String(invVal || "").trim();
    }
  }

  if (lastInvoice) {
    const url = SUPABASE_URL + "/rest/v1/log_produk?invoice=eq." + encodeURIComponent(lastInvoice) + "&order=id.desc&limit=1";
    const options = {
      method: "get",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
      },
      muteHttpExceptions: true
    };
    const res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      if (data && data.length > 0) {
        const foundId = data[0].id;
        props.setProperty("LAST_SYNCED_LOG_ID", foundId.toString());
        return foundId.toString();
      }
    }
  }

  props.setProperty("LAST_SYNCED_LOG_ID", "0");
  return "0";
}

function syncLogProdukFromSupabase(forceReset) {
  const props = PropertiesService.getScriptProperties();
  let lastSyncedId = forceReset ? null : props.getProperty("LAST_SYNCED_LOG_ID");
  
  if (!lastSyncedId) {
    lastSyncedId = initSyncSupabase();
    if (!lastSyncedId) return;
  }
  
  // Ambil data terbaru dari Supabase (Limit 500 per eksekusi agar tidak timeout)
  const url = SUPABASE_URL + "/rest/v1/log_produk?id=gt." + lastSyncedId + "&order=id.asc&limit=500";
  const options = {
    method: "get",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    Logger.log("Gagal fetch Supabase: " + response.getContentText());
    return;
  }
  
  const newLogs = JSON.parse(response.getContentText());
  if (!newLogs || newLogs.length === 0) {
    return; // Tidak ada data baru
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shLog = ss.getSheetByName("Log Product");
  
  if (!shLog) {
    Logger.log("Sheet Log Product tidak ditemukan!");
    return;
  }
  
  const rowsToAppend = [];
  let highestId = parseInt(lastSyncedId, 10) || 0;
  
  for (let i = 0; i < newLogs.length; i++) {
    const log = newLogs[i];
    
    // Format timestamp Jakarta WIB (yyyy-MM-dd HH:mm:ss)
    let timestamp = log.created_at;
    try {
      timestamp = Utilities.formatDate(new Date(log.created_at), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    } catch(e) {}
    
    // Susunan 8 kolom "Log Product" (Kolom A-H): 
    // [0:Tanggal, 1:SKU, 2:Lokasi, 3:Invoice, 4:Operator, 5:Type, 6:Keterangan, 7:Area]
    // Kolom I (Nama Produk) & J (Size) otomatis diisi oleh ARRAYFORMULA di Sheet
    const row = [
      timestamp,
      log.sku || "",
      log.lokasi || "",
      log.invoice || "",
      log.operator || "",
      log.type || "",
      log.keterangan || "",
      log.area || ""
    ];
    
    rowsToAppend.push(row);
    
    if (log.id > highestId) {
      highestId = log.id;
    }
  }
  
  if (rowsToAppend.length > 0) {
    // 1. Tulis ke "Log Product" (8 kolom: A s/d H)
    const startRow = typeof findNextRow === "function" ? findNextRow(shLog) : (shLog.getLastRow() + 1);
    shLog.getRange(startRow, 1, rowsToAppend.length, 8).setValues(rowsToAppend);
    
    // 2. Kalkulasi "STOCK" sheet (Incremental)
    try {
      if (typeof updateStockIncremental === "function") {
        updateStockIncremental(rowsToAppend);
      } else if (typeof rebuildStockAman === "function") {
        rebuildStockAman();
      }
    } catch (err) {
      Logger.log("Gagal mengupdate STOCK: " + err.message);
    }
    
    // 3. Update pointer ID terakhir
    props.setProperty("LAST_SYNCED_LOG_ID", highestId.toString());
    Logger.log("Berhasil sync " + rowsToAppend.length + " baris. Highest ID: " + highestId);
  }
}

/**
 * Sinkronisasi Langsung Saldo Stok dari Supabase ke Sheet "STOCK"
 */
function syncStokLokasiToSheetStock() {
  try {
    const url = SUPABASE_URL + "/rest/v1/view_stok_realtime?select=lokasi,area,sku,sisa_stok&sisa_stok=gt.0&order=lokasi.asc,sku.asc";
    const options = {
      method: "get",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
      },
      muteHttpExceptions: true
    };
    const res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() !== 200) return { success: false, message: "Gagal fetch view_stok_realtime" };

    const data = JSON.parse(res.getContentText());
    if (!data) return { success: false, message: "Data kosong" };

    const stockRows = data.map(function(r) {
      return [
        r.lokasi || "",
        r.area || getArea(r.lokasi),
        r.sku || "",
        Number(r.sisa_stok) || 0
      ];
    });

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const shStock = ss.getSheetByName("STOCK");
    if (!shStock) return { success: false, message: "Sheet STOCK tidak ditemukan" };

    // Clear old data and write new
    const lastRow = shStock.getLastRow();
    if (lastRow >= 2) {
      shStock.getRange(2, 1, lastRow - 1, 4).clearContent();
    }

    if (stockRows.length > 0) {
      shStock.getRange(2, 1, stockRows.length, 4).setValues(stockRows);
    }

    return { success: true, count: stockRows.length };
  } catch (e) {
    Logger.log("Gagal syncStokLokasiToSheetStock: " + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Sinkronisasi Penerimaan Produksi dari Supabase ke Sheet "Penerimaan Produksi"
 */
function syncPenerimaanProduksiFromSupabase(forceReset) {
  const props = PropertiesService.getScriptProperties();
  let lastSyncedId = forceReset ? "0" : (props.getProperty("LAST_SYNCED_PENERIMAAN_ID") || "0");

  const url = SUPABASE_URL + "/rest/v1/penerimaan_produksi?id=gt." + lastSyncedId + "&order=id.asc&limit=500";
  const options = {
    method: "get",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() !== 200) return;

    const newRows = JSON.parse(res.getContentText());
    if (!newRows || newRows.length === 0) return;

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Penerimaan Produksi");
    if (!sheet) return;

    const rowsToAppend = [];
    let highestId = parseInt(lastSyncedId, 10) || 0;

    for (let i = 0; i < newRows.length; i++) {
      const item = newRows[i];
      let tglStr = item.tanggal_penerimaan || "";
      let waktuInputStr = item.created_at;
      try {
        waktuInputStr = Utilities.formatDate(new Date(item.created_at), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
      } catch (e) {}

      // Susunan Kolom Sheet "Penerimaan Produksi":
      // [0:Tanggal, 1:Kategori, 2:No SJ, 3:Kode Prod, 4:Warna, 5:Size, 6:Qty, 7:Foto, 8:Ket, 9:Operator, 10:Waktu Input]
      const row = [
        tglStr,
        item.kategori || "Lokal CMT",
        item.no_surat_jalan || "",
        item.kode_produksi || "",
        item.warna || "",
        item.size || "Default",
        item.qty || 1,
        item.foto_url || "",
        item.keterangan || "",
        item.operator || "Operator",
        waktuInputStr
      ];

      rowsToAppend.push(row);
      if (item.id > highestId) highestId = item.id;
    }

    if (rowsToAppend.length > 0) {
      const startRow = typeof findNextRow === "function" ? findNextRow(sheet) : (sheet.getLastRow() + 1);
      sheet.getRange(startRow, 1, rowsToAppend.length, 11).setValues(rowsToAppend);
      props.setProperty("LAST_SYNCED_PENERIMAAN_ID", highestId.toString());
      Logger.log("Berhasil sync " + rowsToAppend.length + " baris Penerimaan Produksi ke Sheet.");
    }
  } catch (err) {
    Logger.log("syncPenerimaanProduksiFromSupabase error: " + err.message);
  }
}

/**
 * Sinkronisasi Peminjaman dari Supabase ke Sheet "Peminjaman"
 */
function syncPeminjamanFromSupabase(forceReset) {
  const props = PropertiesService.getScriptProperties();
  let lastSyncedId = forceReset ? "0" : (props.getProperty("LAST_SYNCED_PEMINJAMAN_ID") || "0");

  const url = SUPABASE_URL + "/rest/v1/peminjaman?id=gt." + lastSyncedId + "&order=id.asc&limit=500";
  const options = {
    method: "get",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() !== 200) return;

    const newRows = JSON.parse(res.getContentText());
    if (!newRows || newRows.length === 0) return;

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Peminjaman");
    if (!sheet) return;

    const startRow = typeof findNextRow === "function" ? findNextRow(sheet) : (sheet.getLastRow() + 1);
    let noUrut = typeof getNextNoPeminjaman === "function" ? getNextNoPeminjaman(sheet, startRow) : (startRow - 1);

    const rowsToAppend = [];
    let highestId = parseInt(lastSyncedId, 10) || 0;

    for (let i = 0; i < newRows.length; i++) {
      const item = newRows[i];
      let waktuInputStr = item.created_at;
      try {
        waktuInputStr = Utilities.formatDate(new Date(item.created_at), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
      } catch (e) {}

      // Susunan Kolom Sheet "Peminjaman" (14 Kolom):
      // [A:No, B:Timestamp, C:PIC, D:Keperluan, E:Tgl Pinjam, F:-, G:Produk, H:SKU, I:Size, J:Qty, K:No Pjm, L:Status, M:User, N:Lokasi]
      const row = [
        noUrut++,
        waktuInputStr,
        item.pic || "",
        item.keperluan || "",
        item.tanggal_pinjam || "",
        "",
        item.nama_produk || "",
        item.sku || "",
        item.size || "-",
        item.qty || 1,
        item.no_peminjaman || "",
        item.status || "Dipinjam",
        item.operator || "",
        item.lokasi || "STUDIO"
      ];

      rowsToAppend.push(row);
      if (item.id > highestId) highestId = item.id;
    }

    if (rowsToAppend.length > 0) {
      sheet.getRange(startRow, 1, rowsToAppend.length, 14).setValues(rowsToAppend);
      props.setProperty("LAST_SYNCED_PEMINJAMAN_ID", highestId.toString());
      Logger.log("Berhasil sync " + rowsToAppend.length + " baris Peminjaman ke Sheet.");
    }
  } catch (err) {
    Logger.log("syncPeminjamanFromSupabase error: " + err.message);
  }
}

/**
 * Master Sync Berkala: Log Produk + Penerimaan Produksi + Peminjaman
 */
function syncAllSupabaseToSheets() {
  try {
    syncLogProdukFromSupabase();
  } catch (e1) {
    Logger.log("Error syncLogProduk: " + e1.message);
  }

  try {
    syncPenerimaanProduksiFromSupabase();
  } catch (e2) {
    Logger.log("Error syncPenerimaanProduksi: " + e2.message);
  }

  try {
    syncPeminjamanFromSupabase();
  } catch (e3) {
    Logger.log("Error syncPeminjaman: " + e3.message);
  }
}

function setupSyncTrigger() {
  // Bersihkan trigger lama jika ada agar tidak double
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    const fn = triggers[i].getHandlerFunction();
    if (fn === "syncLogProdukFromSupabase" || fn === "syncAllSupabaseToSheets") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Buat trigger baru setiap 1 menit untuk sinkronisasi semua modul
  ScriptApp.newTrigger("syncAllSupabaseToSheets")
    .timeBased()
    .everyMinutes(1)
    .create();
    
  Logger.log("Trigger time-driven syncAllSupabaseToSheets (1 menit) berhasil dibuat.");
}
