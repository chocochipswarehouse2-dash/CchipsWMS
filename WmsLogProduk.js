/************************************************
 * HALAMAN LOG PRODUK (WMS)
 * Sheet: "Log Product" (case-insensitive)
 * Kolom SEBENARNYA (hasil debug):
 *   A=Tanggal, B=SKU, C=Lokasi, D=Invoice, E=Operator,
 *   F=Type, G=Keterangan, H=Area, I=Nama Produk, J=Size
 ************************************************/

const SHEET_LOG_PRODUCT_WMS = "Log Product";
const MAX_LOG_PRODUK_DITAMPILKAN = 300; // batasi biar nggak berat, terbaru duluan

/************************************************
 * CEK HAK AKSES: cuma akun "All" yang boleh liat Log Produk
 * (dianggap setara admin di sistem akses WMS ini)
 ************************************************/
function wmsBisaAksesLogProduk(akses) {
  return akses === "All";
}

/************************************************
 * RENDER HALAMAN LOG PRODUK
 ************************************************/
function renderWmsLogProdukPage(session, token) {
  const template = HtmlService.createTemplateFromFile("WmsLogProdukView");
  template.token = token;
  template.username = session.username;
  template.akses = session.akses;
  template.execUrl = ScriptApp.getService().getUrl();

  return template.evaluate()
    .setTitle("Log Produk - WMS Chocochips")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/************************************************
 * DEBUG -- jalankan manual dari editor buat cek
 * struktur sebenarnya dari sheet "Log Product"
 ************************************************/
function debugCekSheetLogProduct() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetByNameCI_WMS(ss, SHEET_LOG_PRODUCT_WMS);

  if (!sheet) {
    Logger.log("Sheet 'Log Product' TIDAK DITEMUKAN.");
    Logger.log("Daftar sheet yang ADA: " + ss.getSheets().map(function (s) { return s.getName(); }).join(", "));
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  Logger.log("Sheet 'Log Product' ditemukan (nama asli: '" + sheet.getName() + "'). Last row: " + lastRow + ", Last col: " + lastCol);

  const preview = sheet.getRange(1, 1, Math.min(6, lastRow), lastCol).getValues();
  preview.forEach(function (row, i) {
    Logger.log("Row " + (i + 1) + ": " + JSON.stringify(row));
  });
}

/************************************************
 * AMBIL DATA LOG PRODUK
 ************************************************/
function getWmsLogProdukData(token) {
  try {
    const session = getWmsSessionFromToken(token);
    if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
    if (!wmsBisaAksesLogProduk(session.akses)) return { success: false, message: "Akun kamu tidak punya akses ke Log Produk." };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetByNameCI_WMS(ss, SHEET_LOG_PRODUCT_WMS);
    if (!sheet) return { success: false, message: "Sheet 'Log Product' tidak ditemukan." };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, data: [] };

    // "lastRow" bawaan Google Sheets kadang nggak akurat kalau ada banyak baris
    // kosong nyempil di ujung sheet. Jadi cari baris terakhir yang BENERAN ada
    // isinya (cek kolom B = SKU aja, biar ringan -- 1 kolom, bukan 10).
    const kolomSku = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    let lastRealRow = 1;
    for (let i = kolomSku.length - 1; i >= 0; i--) {
      if (String(kolomSku[i][0] || "").trim() !== "") {
        lastRealRow = i + 2; // +2: index 0 = row 2
        break;
      }
    }

    if (lastRealRow < 2) return { success: true, data: [] };

    // Ambil buffer lebih banyak dari yang ditampilkan (jaga-jaga ada baris kosong
    // di antaranya juga), baru difilter & dipotong ke jumlah yang mau ditampilkan.
    const bufferDiambil = Math.min(MAX_LOG_PRODUK_DITAMPILKAN * 2, lastRealRow - 1);
    const startRow = lastRealRow - bufferDiambil + 1;
    const values = sheet.getRange(startRow, 1, bufferDiambil, 10).getValues();

    const hasil = [];
    values.forEach(function (row) {
      try {
        const sku = String(row[1] || "").trim();
        const namaProduk = String(row[8] || "").trim();
        // Lewati baris yang beneran kosong (nggak ada SKU maupun Nama Produk)
        if (!sku && !namaProduk) return;

        const tanggalRaw = row[0];
        let tanggalStr = "";
        let tanggalMs = 0;
        try {
          const d = new Date(tanggalRaw);
          const ms = d.getTime();
          tanggalMs = isNaN(ms) ? 0 : ms;
          tanggalStr = (tanggalRaw && !isNaN(ms)) ? Utilities.formatDate(d, "Asia/Jakarta", "dd MMM yyyy, HH:mm") : String(tanggalRaw || "");
        } catch (e) {
          tanggalMs = 0;
          tanggalStr = String(tanggalRaw || "");
        }

        hasil.push({
          tanggal: tanggalMs,
          tanggalStr: tanggalStr,
          sku: sku,
          lokasi: String(row[2] || "").trim(),
          invoice: String(row[3] || "").trim(),
          operator: String(row[4] || "").trim(),
          type: String(row[5] || "").trim(),
          keterangan: String(row[6] || "").trim(),
          area: String(row[7] || "").trim(),
          namaProduk: namaProduk,
          size: String(row[9] || "").trim()
        });
      } catch (errBaris) {
        // Baris ini bermasalah (data aneh) -> lewati aja, jangan bikin semuanya gagal
      }
    });

    // Urutan sesuai sheet aslinya, tapi dibalik (baris paling bawah/terbaru duluan)
    hasil.reverse();

    // Potong ke jumlah yang mau ditampilkan (buffer di atas cuma jaga-jaga baris kosong)
    const hasilDitampilkan = hasil.slice(0, MAX_LOG_PRODUK_DITAMPILKAN);

    return { success: true, data: hasilDitampilkan };
  } catch (err) {
    return { success: false, message: "Terjadi error di server: " + err.message };
  }
}

function getWmsFilterOptions(token) {

  try {
    // PERBAIKAN: Menggunakan getWmsSessionFromToken agar validasi sesi konsisten dengan fungsi WMS lainnya
    const session = getWmsSessionFromToken(token);
    if (!session) return { success: false, message: "Sesi tidak valid." };
    if (!wmsBisaAksesLogProduk(session.akses)) return { success: false, message: "Tidak ada akses." };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetByNameCI_WMS(ss, SHEET_LOG_PRODUCT_WMS);
    if (!sheet) return { success: false, message: "Sheet tidak ditemukan" };

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, types: [], areas: [], lokasis: [] };

    var typesSet = new Set();
    var areasSet = new Set();
    var lokasisSet = new Set();

    // Sesuai debugging Anda:
    // Indeks 2 = Lokasi (C), Indeks 5 = Type (F), Indeks 7 = Area (H)
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var sku = String(row[1] || "").trim();
      var namaProduk = String(row[8] || "").trim();
      
      // Lewati baris kosong
      if (!sku && !namaProduk) continue;

      if (row[5]) typesSet.add(String(row[5]).trim());
      if (row[7]) areasSet.add(String(row[7]).trim());
      if (row[2]) lokasisSet.add(String(row[2]).trim());
    }

    return {
      success: true,
      types: Array.from(typesSet).sort(),
      areas: Array.from(areasSet).sort(),
      lokasis: Array.from(lokasisSet).sort()
    };

  } catch (err) {
    return { success: false, message: err.message };
  }
}
function getWmsPaginatedLogProdukData(token, page, pageSize, keyword, typeFilters, areaFilters, lokasiFilters) {
  try {
    const session = getWmsSessionFromToken(token);
    if (!session) return { success: false, message: "Sesi tidak valid." };
    if (!wmsBisaAksesLogProduk(session.akses)) return { success: false, message: "Tidak ada akses." };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetByNameCI_WMS(ss, SHEET_LOG_PRODUCT_WMS);
    if (!sheet) return { success: false, message: "Sheet 'Log Product' tidak ditemukan." };

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [], totalRecords: 0, totalPages: 1, currentPage: 1 };

    // Urutan Kolom: A=Tanggal(0), B=SKU(1), C=Lokasi(2), D=Invoice(3), E=Operator(4), 
    // F=Type(5), G=Keterangan(6), H=Area(7), I=Nama Produk(8), J=Size(9)
    const rows = data.slice(1); // Lewati header
    
    const kw = (keyword || "").trim().toLowerCase();
    const kwWords = kw.split(/\s+/).filter(Boolean);
    
    const typesArr = Array.isArray(typeFilters) ? typeFilters : (typeFilters ? [typeFilters] : []);
    const areasArr = Array.isArray(areaFilters) ? areaFilters : (areaFilters ? [areaFilters] : []);
    const lokasisArr = Array.isArray(lokasiFilters) ? lokasiFilters : (lokasiFilters ? [lokasiFilters] : []);

    const filteredRows = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sku = String(row[1] || "").trim();
      const lokasi = String(row[2] || "").trim();
      const invoice = String(row[3] || "").trim();
      const operator = String(row[4] || "").trim();
      const type = String(row[5] || "").trim();
      const keterangan = String(row[6] || "").trim();
      const area = String(row[7] || "").trim();
      const namaProduk = String(row[8] || "").trim();
      const size = String(row[9] || "").trim();

      if (!sku && !namaProduk) continue;

      // Filter Multi-select
      if (typesArr.length > 0 && !typesArr.includes(type)) continue;
      if (areasArr.length > 0 && !areasArr.includes(area)) continue;
      if (lokasisArr.length > 0 && !lokasisArr.includes(lokasi)) continue;

      // Filter Keyword (Pencarian menyeluruh)
      if (kwWords.length > 0) {
        const combinedText = (sku + " " + namaProduk + " " + invoice + " " + operator + " " + keterangan).toLowerCase();
        const matchAll = kwWords.every(word => combinedText.indexOf(word) > -1);
        if (!matchAll) continue;
      }

      // Format Tanggal & Jam Akurat
      const tanggalRaw = row[0];
      let tanggalStr = "";
      let tanggalMs = 0;
      try {
        const d = new Date(tanggalRaw);
        const ms = d.getTime();
        tanggalMs = isNaN(ms) ? 0 : ms;
        tanggalStr = (tanggalRaw && !isNaN(ms)) ? Utilities.formatDate(d, "Asia/Jakarta", "dd MMM yyyy, HH:mm") : String(tanggalRaw || "");
      } catch (e) {
        tanggalMs = 0;
        tanggalStr = String(tanggalRaw || "");
      }

      filteredRows.push({
        tanggal: tanggalMs,
        tanggalStr: tanggalStr,
        sku: sku,
        lokasi: lokasi,
        invoice: invoice,
        operator: operator,
        type: type,
        keterangan: keterangan,
        area: area,
        namaProduk: namaProduk,
        size: size
      });
    }

    // Balik urutan agar data terbaru berada di atas
    filteredRows.reverse();

    const totalRecords = filteredRows.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const validPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (validPage - 1) * pageSize;
    const paginatedData = filteredRows.slice(startIndex, startIndex + pageSize);

    return {
      success: true,
      data: paginatedData,
      totalRecords: totalRecords,
      totalPages: totalPages,
      currentPage: validPage
    };

  } catch (err) {
    return { success: false, message: "Error: " + err.message };
  }
}