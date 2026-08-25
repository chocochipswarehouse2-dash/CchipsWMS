/************************************************
 * HALAMAN "UPDATE DATABASE"
 * Satu-satunya pintu masuk untuk update sheet "Data":
 * upload CSV -> sort alphabet -> replace sheet "Data"
 * (semua kolom asli dipertahankan, cuma barisnya yang
 * diproses; semua baris kecuali header ikut masuk)
 ************************************************/

function wmsBisaAksesUpdateDatabase(akses) {
  return akses === "All";
}

/************************************************
 * RENDER HALAMAN
 ************************************************/
function renderWmsUpdateDatabasePage(session, token) {
  const template = HtmlService.createTemplateFromFile("WmsUpdateDatabaseView");
  template.token = token;
  template.username = session.username;
  template.akses = session.akses;
  template.execUrl = ScriptApp.getService().getUrl();
  template.supabaseUrl = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : "https://filgijcfhgqlirzhvwho.supabase.co";
  template.supabaseAnonKey = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : "sb_publishable_L4FEkugwRKqcwFzLXfpZag_aByUy5mD";

  return template.evaluate()
    .setTitle("Update Database - WMS Chocochips")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/************************************************
 * AMBIL RINGKASAN DATA SAAT INI DI SHEET "Data"
 ************************************************/
function getWmsUpdateDatabaseRingkasan(token) {
  const session = getWmsSessionFromToken(token);
  if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
  if (!wmsBisaAksesUpdateDatabase(session.akses)) return { success: false, message: "Akun kamu tidak punya akses." };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetByNameCI_WMS(ss, "Data");
  if (!sheet) return { success: false, message: "Sheet 'Data' tidak ditemukan." };

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  return {
    success: true,
    jumlahBaris: Math.max(0, lastRow - 1),
    jumlahKolom: lastCol
  };
}

/************************************************
 * PROSES UPDATE DATABASE (SEMUA KOLOM DIPERTAHANKAN)
 * headerRow = ["Category","Product","ProductCode","Variant","Code", ...kolom lain...]
 * rows = [ ["CLOTHING/...","Nama Produk", ...], ... ]  (array of arrays)
 *
 * Logika: semua baris (kecuali header) diambil apa adanya,
 * cuma diurutkan alphabet berdasarkan nama produk (index 1),
 * lalu langsung replace ke sheet "Data".
 ************************************************/
function updateDatabaseCsv(token, headerRow, rows) {
  try {
    const session = getWmsSessionFromToken(token);
    if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
    if (!wmsBisaAksesUpdateDatabase(session.akses)) return { success: false, message: "Akun kamu tidak punya akses." };

    if (!headerRow || headerRow.length === 0) {
      return { success: false, message: "Header CSV kosong/tidak valid." };
    }
    if (!rows || rows.length === 0) {
      return { success: false, message: "Data CSV kosong." };
    }

    const numCols = headerRow.length;
    const totalDibaca = rows.length;

    // Samakan tiap baris data biar jumlah kolomnya persis sama kayak header
    const rowsRata = rows.map(function (r) {
      const baris = r.slice(0, numCols);
      while (baris.length < numCols) baris.push("");
      return baris;
    });

    // SORT alphabet berdasarkan nama produk (kolom index 1)
    rowsRata.sort(function (a, b) {
      const pa = String(a[1] || "").toLowerCase();
      const pb = String(b[1] || "").toLowerCase();
      if (pa < pb) return -1;
      if (pa > pb) return 1;
      return 0;
    });

    if (rowsRata.length === 0) {
      return { success: false, message: "Tidak ada data yang bisa diproses." };
    }

    // TULIS ke sheet "Data" -- REPLACE TOTAL, semua kolom dipertahankan
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetByNameCI_WMS(ss, "Data");
    if (!sheet) return { success: false, message: "Sheet 'Data' tidak ditemukan." };

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow > 0 && lastCol > 0) {
      sheet.getRange(1, 1, lastRow, lastCol).clearContent();
    }

    sheet.getRange(1, 1, 1, numCols).setValues([headerRow]);
    sheet.getRange(2, 1, rowsRata.length, numCols).setValues(rowsRata);

    bersihkanCacheProdukWms();

    return {
      success: true,
      message: "Update database berhasil!",
      totalDibaca: totalDibaca,
      jumlahAkhir: rowsRata.length
    };
  } catch (err) {
    return { success: false, message: "Terjadi error di server: " + err.message };
  }
}

function bersihkanCacheProdukWms() {
  try {
    const cache = CacheService.getScriptCache();
    if (typeof CACHE_WMS_DASH_COUNT_KEY !== 'undefined') {
      cache.remove(CACHE_WMS_DASH_COUNT_KEY);
    }
  } catch (e) {
    Logger.log("Gagal bersihkan cache: " + e.message);
  }
}