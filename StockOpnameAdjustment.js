/************************************************
 * FILE STOCK OPNAME & ADJUSTMENT.GS
 *
 * Alur singkat:
 * 1. OPNAME: user (web ATAU WA) input hasil hitung fisik
 *    per SKU+Lokasi. Sistem bandingkan dengan qty di sheet
 *    STOCK. Kalau beda (selisih != 0), dibuat baris PENDING
 *    di sheet "Stock Opname" -- BELUM mengubah stok apapun.
 * 2. Setelah 1 sesi opname selesai disubmit, sistem kirim
 *    email rekap (CSV) berisi semua selisih ke
 *    EMAIL_REKAP_ADJUSTMENT.
 * 3. ADJUSTMENT MANUAL: user input SKU+Lokasi+qty(+/-)+alasan
 *    -- bisa 1 per 1 (bulk dengan 1 item) ATAU banyak sekaligus
 *    (bulk beneran / hasil import CSV) -- juga masuk ke
 *    antrian Pending yang sama.
 * 4. APPROVAL: admin (akses "All") buka halaman web, lihat
 *    semua baris Pending, klik Approve/Reject. Approve akan
 *    menulis baris ADJ_IN/ADJ_OUT ke sheet Log Product
 *    (dengan qty eksplisit di kolom K) lalu rebuildStock()
 *    dipanggil supaya sheet STOCK ikut ter-update.
 *
 * REVISI (SeqID): baris ADJ_IN/ADJ_OUT yang ditulis ke Log
 * Product saat approval sekarang JUGA diisi kolom L (SeqID) --
 * lihat prosesSatuChunkApproval_() di bagian bawah file ini.
 * Semua logika alur opname/adjustment/approval lainnya TIDAK
 * berubah.
 *
 * SHEET BARU YANG HARUS DIBUAT MANUAL: "Stock Opname"
 * Kolom (A-Q):
 *  A SesiID        B Tanggal        C SKU
 *  D NamaProduk    E Size           F Lokasi
 *  G Area          H QtySistem      I QtyFisik
 *  J Selisih       K Status         L Jenis (Opname/Manual)
 *  M Alasan        N Operator       O Invoice
 *  P TanggalApprove Q ApprovedBy
 ************************************************/

/************************************************
 * HAK AKSES: sama kayak Update Database, cuma "All"
 * (karena fitur ini bisa mengubah angka stok beneran)
 ************************************************/
function wmsBisaAksesStockOpname(akses) {
  return akses === "All";
}

/************************************************
 * RENDER HALAMAN
 ************************************************/
function renderWmsStockOpnamePage(session, token) {
  const template = HtmlService.createTemplateFromFile("WmsStockOpnameView");
  template.token = token;
  template.username = session.username;
  template.akses = session.akses;
  template.execUrl = ScriptApp.getService().getUrl();

  return template.evaluate()
    .setTitle("Stock Opname & Adjustment - WMS Chocochips")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/************************************************
 * HELPER: cari qty sistem saat ini utk 1 SKU+Lokasi
 * dari sheet STOCK (kolom A=Lokasi,B=Area,C=SKU,D=Qty)
 ************************************************/
function getQtySistemSkuLokasi(sku, lokasi) {
  sku = String(sku || "").trim().toUpperCase();
  lokasi = normalizeLokasi(lokasi);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetByNameCI_WMS(ss, "STOCK");
  if (!sheet) return 0;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  for (let i = 0; i < values.length; i++) {
    const lok = normalizeLokasi(values[i][0]);
    const skuRow = String(values[i][2] || "").trim().toUpperCase();
    if (lok === lokasi && skuRow === sku) {
      return Number(values[i][3]) || 0;
    }
  }
  return 0;
}

/************************************************
 * HELPER: cari Nama Produk & Size dari sheet "Data"
 ************************************************/
function getNamaSizeDariSku(sku) {
  sku = String(sku || "").trim().toUpperCase();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetByNameCI_WMS(ss, "Data");
  if (!sheet) return { nama: "", size: "" };

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { nama: "", size: "" };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim().toLowerCase());
  let colProd = headers.findIndex(h => h === "product" || h === "nama produk" || h === "produk");
  let colSize = headers.findIndex(h => h === "variant" || h === "size" || h === "ukuran");
  let colSku  = headers.findIndex(h => h === "code" || h === "sku" || h === "item code" || h === "barcode");

  if (colProd === -1) colProd = 1;
  if (colSize === -1) colSize = 3;
  if (colSku === -1) colSku = 4;

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (let i = 0; i < values.length; i++) {
    const skuRow = String(values[i][colSku] || "").trim().toUpperCase();
    if (skuRow === sku) {
      return { nama: String(values[i][colProd] || "").trim(), size: String(values[i][colSize] || "").trim() };
    }
  }
  return { nama: "", size: "" };
}

/************************************************
 * DATA AWAL HALAMAN: daftar lokasi & produk utk autocomplete
 ************************************************/
function getWmsStockOpnameInitData(token) {
  try {
    const session = getWmsSessionFromToken(token);
    if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
    if (!wmsBisaAksesStockOpname(session.akses)) return { success: false, message: "Akun kamu tidak punya akses ke fitur ini." };

    const cache = CacheService.getScriptCache();
    const cachedStr = cache.get("WMS_STOCK_OPNAME_INIT_V2");
    if (cachedStr) {
      try {
        const parsed = JSON.parse(cachedStr);
        return { success: true, produkList: parsed.produkList, lokasiList: parsed.lokasiList };
      } catch (e) {}
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const shStock = getSheetByNameCI_WMS(ss, "STOCK");
    const shData = getSheetByNameCI_WMS(ss, "Data");

    const produkList = [];
    const lokasiSet = {};

    if (shData) {
      const lastRow = shData.getLastRow();
      const lastCol = shData.getLastColumn();
      if (lastRow >= 2 && lastCol >= 1) {
        const headers = shData.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim().toLowerCase());
        let colProd = headers.findIndex(h => h === "product" || h === "nama produk" || h === "produk");
        let colSize = headers.findIndex(h => h === "variant" || h === "size" || h === "ukuran");
        let colSku  = headers.findIndex(h => h === "code" || h === "sku" || h === "item code" || h === "barcode");
        if (colProd === -1) colProd = 1;
        if (colSize === -1) colSize = 3;
        if (colSku === -1) colSku = 4;

        const values = shData.getRange(2, 1, lastRow - 1, lastCol).getValues();
        values.forEach(function (row) {
          const nama = String(row[colProd] || "").trim();
          const size = String(row[colSize] || "").trim();
          const sku = String(row[colSku] || "").trim();
          if (sku) produkList.push({ produk: nama, size: size, sku: sku });
        });
      }
    }

    if (shStock) {
      const lastRow = shStock.getLastRow();
      if (lastRow >= 2) {
        const values = shStock.getRange(2, 1, lastRow - 1, 1).getValues(); // A = Lokasi
        values.forEach(function (row) {
          const lokasi = String(row[0] || "").trim();
          if (lokasi) lokasiSet[lokasi] = true;
        });
      }
    }

    const resData = {
      produkList: produkList.slice(0, 1000), // Batasi ke 1000 item utama agar datalist DOM ringan
      lokasiList: Object.keys(lokasiSet).sort()
    };

    try {
      cache.put("WMS_STOCK_OPNAME_INIT_V2", JSON.stringify(resData), 21600);
    } catch(e) {}

    return {
      success: true,
      produkList: resData.produkList,
      lokasiList: resData.lokasiList
    };
  } catch (err) {
    return { success: false, message: "Terjadi error di server: " + err.message };
  }
}

/************************************************
 * LOOKUP QTY SISTEM (dipanggil dari client saat user
 * pilih SKU+Lokasi, supaya langsung kelihatan sebelum
 * input qty fisik)
 ************************************************/
function getWmsQtySistem(token, sku, lokasi) {
  try {
    const session = getWmsSessionFromToken(token);
    if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
    if (!wmsBisaAksesStockOpname(session.akses)) return { success: false, message: "Akun kamu tidak punya akses." };

    return { success: true, qtySistem: getQtySistemSkuLokasi(sku, lokasi) };
  } catch (err) {
    return { success: false, message: "Terjadi error di server: " + err.message };
  }
}

/************************************************
 * EXPORT DATA STOK SAAT INI (CSV)
 ************************************************/
function getWmsStockExportCsv(token) {
  try {
    const session = getWmsSessionFromToken(token);
    if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
    if (!wmsBisaAksesStockOpname(session.akses)) return { success: false, message: "Akun kamu tidak punya akses ke fitur ini." };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetByNameCI_WMS(ss, "STOCK");
    if (!sheet) return { success: false, message: "Sheet 'STOCK' tidak ditemukan." };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, csvData: "SKU,Lokasi,Qty Fisik\n" };
    }

    // Kolom A-D = Lokasi, Area, SKU, Qty
    const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

    let csv = "SKU,Lokasi,Qty Fisik\n";

    values.forEach(function (row) {
      const lokasi = String(row[0] || "").trim();
      const sku = String(row[2] || "").trim().toUpperCase();

      if (!sku || !lokasi) return;

      const qtyRaw = Number(row[3]);
      const qty = isNaN(qtyRaw) ? 0 : qtyRaw;

      const cols = [sku, lokasi, qty];
      csv += cols.map(function (c) {
        const s = String(c === undefined || c === null ? "" : c).replace(/"/g, '""');
        return '"' + s + '"';
      }).join(",") + "\n";
    });

    return { success: true, csvData: csv };
  } catch (err) {
    return { success: false, message: "Terjadi error di server: " + err.message };
  }
}

/************************************************
 * SUBMIT SESI STOCK OPNAME (dari WEB, butuh token/session)
 ************************************************/
function submitSesiOpname(token, items) {
  const session = getWmsSessionFromToken(token);
  if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
  if (!wmsBisaAksesStockOpname(session.akses)) return { success: false, message: "Akun kamu tidak punya akses ke fitur ini." };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (errLock) {
    return { success: false, message: "Sistem sedang sibuk memproses transaksi lain (SO/IN/OUT/Adjustment). Coba lagi dalam beberapa detik." };
  }

  try {
    return simpanSesiOpnameInternal(items, session.username, false);
  } finally {
    lock.releaseLock();
  }
}

/************************************************
 * VERSI INTERNAL (dipakai bareng oleh submitSesiOpname
 * dari web DAN prosesStockOpname dari webhook WA)
 ************************************************/
function simpanSesiOpnameInternal(items, operator, sertakanSkuTidakDisebut) {
  sertakanSkuTidakDisebut = (sertakanSkuTidakDisebut === true);
  try {
    if (!items || items.length === 0) {
      return { success: false, message: "Tidak ada item untuk disubmit." };
    }

    debugLog("simpanSesiOpnameInternal", "MULAI. operator=" + operator + " sertakanSkuTidakDisebut=" + sertakanSkuTidakDisebut + " items=" + JSON.stringify(items));

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetByNameCI_WMS(ss, SHEET_NAME_ADJUSTMENT);
    if (!sheet) {
      debugLog("simpanSesiOpnameInternal", "GAGAL: sheet '" + SHEET_NAME_ADJUSTMENT + "' tidak ditemukan.");
      return { success: false, message: "Sheet '" + SHEET_NAME_ADJUSTMENT + "' belum dibuat." };
    }

    const shStock = getSheetByNameCI_WMS(ss, "STOCK");
    const shData = getSheetByNameCI_WMS(ss, "Data");

    const stockMap = {};
    const stockByLokasi = {};
    if (shStock && shStock.getLastRow() >= 2) {
      const stockData = shStock.getRange(2, 1, shStock.getLastRow() - 1, 4).getValues();
      stockData.forEach(function(row) {
        const lok = normalizeLokasi(row[0]);
        const skuRow = String(row[2] || "").trim().toUpperCase();
        if (lok && skuRow) {
          const qty = Number(row[3]) || 0;
          stockMap[lok + "_" + skuRow] = qty;
          if (!stockByLokasi[lok]) stockByLokasi[lok] = [];
          stockByLokasi[lok].push({ sku: skuRow, qty: qty });
        }
      });
    }

    const dataMap = {};
    if (shData && shData.getLastRow() >= 2) {
      const infoData = shData.getRange(2, 2, shData.getLastRow() - 1, 4).getValues();
      infoData.forEach(function(row) {
        const skuRow = String(row[3] || "").trim().toUpperCase();
        if (skuRow) {
          dataMap[skuRow] = {
            nama: String(row[0] || "").trim(),
            size: String(row[2] || "").trim()
          };
        }
      });
    }

    const sesiId = getAdjustmentInvoice();
    const tanggal = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm");

    const rows = [];
    let jumlahDiproses = 0;
    let jumlahDilewati = 0;
    let jumlahTidakTerhitung = 0;

    const lokasiTersentuh = {};

    items.forEach(function (it) {
      const sku = String(it.sku || "").trim().toUpperCase();
      const lokasi = normalizeLokasi(it.lokasi);
      const qtyFisik = Number(it.qtyFisik);

      if (!sku || !lokasi || isNaN(qtyFisik)) {
        jumlahDilewati++;
        return;
      }

      if (!lokasiTersentuh[lokasi]) lokasiTersentuh[lokasi] = {};
      lokasiTersentuh[lokasi][sku] = true;

      const key = lokasi + "_" + sku;
      const qtySistem = stockMap.hasOwnProperty(key) ? stockMap[key] : 0;
      const selisih = qtyFisik - qtySistem;

      if (selisih === 0) { 
        jumlahDilewati++; 
        return; 
      }

      const info = dataMap[sku] || { nama: "", size: "" };
      const area = getArea(lokasi);

      rows.push([
        sesiId, tanggal, sku, info.nama, info.size, lokasi, area,
        qtySistem, qtyFisik, selisih, STATUS_ADJ_PENDING, JENIS_ADJ_OPNAME,
        KETERANGAN_ADJUSTMENT_OPNAME, operator, sesiId, "", ""
      ]);
      jumlahDiproses++;
    });

    if (sertakanSkuTidakDisebut) {
      Object.keys(lokasiTersentuh).forEach(function (lokasi) {
        const skuSudahDihitung = lokasiTersentuh[lokasi];
        const daftarSkuSistem = stockByLokasi[lokasi] || [];

        daftarSkuSistem.forEach(function (entrySistem) {
          const sku = entrySistem.sku;
          if (skuSudahDihitung[sku]) return;

          const qtySistem = entrySistem.qty;
          const qtyFisik = 0;
          const selisih = qtyFisik - qtySistem;

          if (selisih === 0) { jumlahDilewati++; return; }

          const info = dataMap[sku] || { nama: "", size: "" };
          const area = getArea(lokasi);

          rows.push([
            sesiId, tanggal, sku, info.nama, info.size, lokasi, area,
            qtySistem, qtyFisik, selisih, STATUS_ADJ_PENDING, JENIS_ADJ_OPNAME,
            KETERANGAN_ADJUSTMENT_OPNAME + " (SKU tidak disebut/dihitung saat opname lokasi ini, qty fisik dianggap 0)",
            operator, sesiId, "", ""
          ]);
          jumlahDiproses++;
          jumlahTidakTerhitung++;
        });
      });
    }

    if (rows.length === 0) {
      return { success: true, message: "Semua item cocok dengan stok sistem, tidak ada adjustment yang perlu dibuat.", jumlahDiproses: 0, jumlahDilewati: jumlahDilewati };
    }

    const startRow = findNextRow(sheet);
    sheet.getRange(startRow, 1, rows.length, 17).setValues(rows);

    try {
      kirimRekapAdjustmentEmail(sesiId, rows);
    } catch (errMail) {
      Logger.log("Gagal kirim email rekap adjustment: " + errMail.message);
    }

    return {
      success: true,
      message: "Sesi opname " + sesiId + " disimpan. " + jumlahDiproses + " item punya selisih dan menunggu approval" +
               (jumlahTidakTerhitung > 0 ? " (termasuk " + jumlahTidakTerhitung + " SKU yang tidak disebut saat opname, ketangkap otomatis)" : "") +
               ", " + jumlahDilewati + " item cocok/dilewati.",
      sesiId: sesiId,
      jumlahDiproses: jumlahDiproses,
      jumlahDilewati: jumlahDilewati,
      jumlahTidakTerhitung: jumlahTidakTerhitung
    };
  } catch (err) {
    debugLog("simpanSesiOpnameInternal", "EXCEPTION: " + err.message);
    return { success: false, message: "Terjadi error di server: " + err.message };
  }
}

/************************************************
 * SUBMIT ADJUSTMENT MANUAL -- 1 ITEM
 ************************************************/
function submitAdjustmentManual(token, data) {
  try {
    const session = getWmsSessionFromToken(token);
    if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
    if (!wmsBisaAksesStockOpname(session.akses)) return { success: false, message: "Akun kamu tidak punya akses ke fitur ini." };

    const sku = String(data && data.sku || "").trim().toUpperCase();
    const lokasi = normalizeLokasi(data && data.lokasi);
    const deltaQty = Number(data && data.deltaQty);
    const alasan = String(data && data.alasan || "").trim();

    if (!sku) return { success: false, message: "SKU wajib diisi." };
    if (!lokasi) return { success: false, message: "Lokasi wajib diisi." };
    if (!deltaQty || isNaN(deltaQty)) return { success: false, message: "Qty adjustment wajib diisi dan tidak boleh 0 (pakai + untuk nambah, - untuk ngurangin)." };
    if (!alasan) return { success: false, message: "Alasan/keterangan wajib diisi." };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetByNameCI_WMS(ss, SHEET_NAME_ADJUSTMENT);
    if (!sheet) return { success: false, message: "Sheet '" + SHEET_NAME_ADJUSTMENT + "' belum dibuat. Buat dulu manual." };

    const operator = session.username;

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
    } catch (errLock) {
      return { success: false, message: "Sistem sedang sibuk memproses transaksi lain (SO/IN/OUT/Adjustment). Coba lagi dalam beberapa detik." };
    }

    let row, invoice;
    try {
      const qtySistem = getQtySistemSkuLokasi(sku, lokasi);
      const qtyFisik = qtySistem + deltaQty;
      const info = getNamaSizeDariSku(sku);
      const area = getArea(lokasi);
      invoice = getAdjustmentInvoice();
      const tanggal = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm");

      row = [
        invoice, tanggal, sku, info.nama, info.size, lokasi, area,
        qtySistem, qtyFisik, deltaQty, STATUS_ADJ_PENDING, JENIS_ADJ_MANUAL,
        KETERANGAN_ADJUSTMENT_MANUAL + ": " + alasan, operator, invoice, "", ""
      ];

      const startRow = findNextRow(sheet);
      sheet.getRange(startRow, 1, 1, 17).setValues([row]);
    } finally {
      lock.releaseLock();
    }

    try {
      kirimRekapAdjustmentEmail(invoice, [row]);
    } catch (errMail) {
      Logger.log("Gagal kirim email rekap adjustment manual: " + errMail.message);
    }

    return { success: true, message: "Adjustment manual " + invoice + " berhasil diajukan, menunggu approval.", invoice: invoice };
  } catch (err) {
    return { success: false, message: "Terjadi error di server: " + err.message };
  }
}

/************************************************
 * SUBMIT ADJUSTMENT MANUAL SECARA MASSAL
 ************************************************/
function submitAdjustmentManualBulk(token, items) {
  try {
    const session = getWmsSessionFromToken(token);
    if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
    if (!wmsBisaAksesStockOpname(session.akses)) return { success: false, message: "Akun kamu tidak punya akses ke fitur ini." };

    if (!items || items.length === 0) {
      return { success: false, message: "Tidak ada item untuk disubmit." };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetByNameCI_WMS(ss, SHEET_NAME_ADJUSTMENT);
    if (!sheet) return { success: false, message: "Sheet '" + SHEET_NAME_ADJUSTMENT + "' belum dibuat. Buat dulu manual." };

    const shStock = getSheetByNameCI_WMS(ss, "STOCK");
    const shData = getSheetByNameCI_WMS(ss, "Data");

    const stockMap = {};
    if (shStock && shStock.getLastRow() >= 2) {
      const stockData = shStock.getRange(2, 1, shStock.getLastRow() - 1, 4).getValues();
      stockData.forEach(function (row) {
        const lok = normalizeLokasi(row[0]);
        const skuRow = String(row[2] || "").trim().toUpperCase();
        if (lok && skuRow) {
          stockMap[lok + "_" + skuRow] = Number(row[3]) || 0;
        }
      });
    }

    const dataMap = {};
    if (shData && shData.getLastRow() >= 2) {
      const infoData = shData.getRange(2, 2, shData.getLastRow() - 1, 4).getValues();
      infoData.forEach(function (row) {
        const skuRow = String(row[3] || "").trim().toUpperCase();
        if (skuRow) {
          dataMap[skuRow] = {
            nama: String(row[0] || "").trim(),
            size: String(row[2] || "").trim()
          };
        }
      });
    }

    const tanggal = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm");
    const operator = session.username;

    const rowTemplates = [];
    let jumlahDilewati = 0;

    items.forEach(function (it) {
      const sku = String(it && it.sku || "").trim().toUpperCase();
      const lokasi = normalizeLokasi(it && it.lokasi);
      const deltaQty = Number(it && it.deltaQty);
      const alasan = String(it && it.alasan || "").trim();

      if (!sku || !lokasi || !deltaQty || isNaN(deltaQty) || !alasan) {
        jumlahDilewati++;
        return;
      }

      const key = lokasi + "_" + sku;
      const qtySistem = stockMap.hasOwnProperty(key) ? stockMap[key] : 0;
      const qtyFisik = qtySistem + deltaQty;
      const info = dataMap[sku] || { nama: "", size: "" };
      const area = getArea(lokasi);

      rowTemplates.push([sku, info.nama, info.size, lokasi, area, qtySistem, qtyFisik, deltaQty, alasan]);
    });

    if (rowTemplates.length === 0) {
      return {
        success: false,
        message: "Tidak ada item valid untuk disubmit. Pastikan SKU, Lokasi, dan Alasan terisi, dan Delta tidak boleh 0."
      };
    }

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
    } catch (errLock) {
      return { success: false, message: "Sistem sedang sibuk memproses transaksi lain (SO/IN/OUT/Adjustment). Coba lagi dalam beberapa detik." };
    }

    const rows = [];
    let invoiceSesi;
    try {
      invoiceSesi = getAdjustmentInvoice();

      rowTemplates.forEach(function (t) {
        const invoiceItem = getAdjustmentInvoice();
        rows.push([
          invoiceItem, tanggal, t[0], t[1], t[2], t[3], t[4],
          t[5], t[6], t[7], STATUS_ADJ_PENDING, JENIS_ADJ_MANUAL,
          KETERANGAN_ADJUSTMENT_MANUAL + ": " + t[8], operator, invoiceItem, "", ""
        ]);
      });

      const startRow = findNextRow(sheet);
      sheet.getRange(startRow, 1, rows.length, 17).setValues(rows);
    } finally {
      lock.releaseLock();
    }

    const jumlahDiproses = rows.length;

    try {
      kirimRekapAdjustmentEmail(invoiceSesi, rows);
    } catch (errMail) {
      Logger.log("Gagal kirim email rekap adjustment manual (bulk): " + errMail.message);
    }

    return {
      success: true,
      message: "Berhasil mengajukan " + jumlahDiproses + " adjustment manual, menunggu approval." +
               (jumlahDilewati > 0 ? " (" + jumlahDilewati + " item dilewati karena data tidak lengkap / delta 0.)" : ""),
      jumlahDiproses: jumlahDiproses,
      jumlahDilewati: jumlahDilewati
    };
  } catch (err) {
    return { success: false, message: "Terjadi error di server: " + err.message };
  }
}

/************************************************
 * EMAIL REKAP (CSV)
 ************************************************/
function kirimRekapAdjustmentEmail(sesiId, rows) {
  if (!rows || rows.length === 0) return;

  let csv = "Sesi/Invoice,Tanggal,SKU,Nama Produk,Size,Lokasi,Area,Qty Sistem,Qty Fisik,Selisih,Status,Jenis,Keterangan,Operator\n";
  rows.forEach(function (r) {
    const cols = [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12], r[13]];
    csv += cols.map(function (c) {
      const s = String(c === undefined || c === null ? "" : c).replace(/"/g, '""');
      return '"' + s + '"';
    }).join(",") + "\n";
  });

  const blob = Utilities.newBlob(csv, "text/csv", "rekap-adjustment-" + sesiId + ".csv");
  const penerima = EMAIL_REKAP_ADJUSTMENT;

  MailApp.sendEmail({
    to: penerima,
    subject: "Rekap Selisih Stock Opname/Adjustment - " + sesiId,
    body: "Berikut rekap selisih stock opname/adjustment untuk sesi " + sesiId + " (" + rows.length + " item).\n\n" +
          "Semua item berstatus PENDING dan BELUM mengubah stok sistem sampai di-approve lewat halaman Stock Opname & Adjustment di dashboard WMS.\n\n" +
          "File CSV terlampir untuk detail lengkap.",
    attachments: [blob]
  });
}

/************************************************
 * AMBIL DAFTAR ADJUSTMENT PENDING (utk halaman approval)
 ************************************************/
function getWmsAdjustmentPendingList(token) {
  try {
    const session = getWmsSessionFromToken(token);
    if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
    if (!wmsBisaAksesStockOpname(session.akses)) return { success: false, message: "Akun kamu tidak punya akses ke fitur ini." };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetByNameCI_WMS(ss, SHEET_NAME_ADJUSTMENT);
    if (!sheet) return { success: false, message: "Sheet '" + SHEET_NAME_ADJUSTMENT + "' belum dibuat." };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, data: [] };

    const values = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
    const data = [];

    values.forEach(function (row, idx) {
      const status = String(row[10] || "").trim();
      if (status !== STATUS_ADJ_PENDING) return;

      data.push({
        rowIndex: idx + 2,
        sesiId: row[0],
        tanggal: formatTanggalAman(row[1]),
        sku: row[2],
        namaProduk: row[3],
        size: row[4],
        lokasi: row[5],
        area: row[6],
        qtySistem: row[7],
        qtyFisik: row[8],
        selisih: row[9],
        status: status,
        jenis: row[11],
        alasan: row[12],
        operator: row[13],
        invoice: row[14]
      });
    });

    data.reverse();

    return { success: true, data: data };
  } catch (err) {
    return { success: false, message: "Terjadi error di server: " + err.message };
  }
}

/************************************************
 * FORMAT TANGGAL AMAN
 ************************************************/
function formatTanggalAman(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd HH:mm");
  }
  return String(value || "");
}

/************************************************
 * APPROVE / REJECT
 ************************************************/
function approveAdjustment(token, rowIndex) {
  return prosesApprovalAdjustment(token, [rowIndex], true);
}

function rejectAdjustment(token, rowIndex) {
  return prosesApprovalAdjustment(token, [rowIndex], false);
}

function approveAdjustmentBulk(token, rowIndexList) {
  return prosesApprovalAdjustment(token, rowIndexList, true);
}

function rejectAdjustmentBulk(token, rowIndexList) {
  return prosesApprovalAdjustment(token, rowIndexList, false);
}

/************************************************
 * PROSES APPROVAL / REJECT MASSAL (DI-CHUNK)
 ************************************************/
const ADJUSTMENT_APPROVAL_CHUNK_SIZE = 200;

function prosesApprovalAdjustment(token, rowIndexList, disetujui) {
  const session = getWmsSessionFromToken(token);
  if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
  if (!wmsBisaAksesStockOpname(session.akses)) return { success: false, message: "Akun kamu tidak punya akses ke fitur ini." };

  if (!rowIndexList || rowIndexList.length === 0) {
    return { success: false, message: "Tidak ada baris yang dicentang." };
  }

  const chunks = [];
  for (let i = 0; i < rowIndexList.length; i += ADJUSTMENT_APPROVAL_CHUNK_SIZE) {
    chunks.push(rowIndexList.slice(i, i + ADJUSTMENT_APPROVAL_CHUNK_SIZE));
  }

  let totalDiproses = 0;
  let totalChunkRebuildGagal = 0;
  let chunkGagalDi = -1;
  let pesanErrorChunk = "";

  for (let c = 0; c < chunks.length; c++) {
    try {
      const hasilChunk = prosesSatuChunkApproval_(session, chunks[c], disetujui);
      totalDiproses += hasilChunk.jumlahDiproses;
      if (!hasilChunk.stokSudahDiupdate) totalChunkRebuildGagal++;
    } catch (err) {
      chunkGagalDi = c;
      pesanErrorChunk = err.message;
      break;
    }
  }

  if (chunkGagalDi !== -1) {
    return {
      success: totalDiproses > 0,
      message: (totalDiproses > 0 ? totalDiproses + " item berhasil diproses sebelum error terjadi. " : "") +
        "Batch ke-" + (chunkGagalDi + 1) + " dari " + chunks.length + " gagal: " + pesanErrorChunk +
        " -- sisa item BELUM diproses, tetap berstatus Pending, aman dicoba lagi (tidak ada data yang 'gantung')."
    };
  }

  return {
    success: true,
    message: (disetujui ? "Approve" : "Reject") + " berhasil untuk " + totalDiproses + " item." +
             (totalChunkRebuildGagal > 0
               ? " ⚠️ " + totalChunkRebuildGagal + " dari " + chunks.length + " batch gagal di-rebuild otomatis ke sheet STOCK -- jalankan rebuildStock() manual dari editor Apps Script untuk menyegarkan tampilan stok."
               : (disetujui ? " Stok sistem sudah diperbarui." : ""))
  };
}

/************************************************
 * PROSES 1 CHUNK APPROVAL
 *
 * REVISI (SeqID): baris ADJ_IN/ADJ_OUT yang ditulis ke Log
 * Product sekarang JUGA diisi kolom L (SeqID) -- sejajar
 * dengan penulisan qty di kolom K yang sudah ada sebelumnya.
 * Kalau rollback terjadi (errStatus), baris yang dihapus
 * otomatis ikut menghapus SeqID-nya juga (satu kesatuan baris)
 * -- tidak perlu penanganan rollback terpisah utk SeqID.
 ************************************************/
function prosesSatuChunkApproval_(session, rowIndexListChunk, disetujui) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shAdj = getSheetByNameCI_WMS(ss, SHEET_NAME_ADJUSTMENT);
  const shLog = getSheetByNameCI_WMS(ss, SHEET_NAME_LOG_PRODUCT);
  if (!shAdj) throw new Error("Sheet '" + SHEET_NAME_ADJUSTMENT + "' tidak ditemukan.");
  if (!shLog) throw new Error("Sheet '" + SHEET_NAME_LOG_PRODUCT + "' tidak ditemukan.");

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const lastRow = shAdj.getLastRow();
    if (lastRow < 2) return { jumlahDiproses: 0, stokSudahDiupdate: true };

    const allData = shAdj.getRange(2, 1, lastRow - 1, 17).getValues();

    const tanggalProses = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm");
    const approver = session.username;
    const tanggalLog = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");

    const rowsUntukLog = [];
    const qtyUntukLog = [];
    const idxTerpakai = [];

    rowIndexListChunk.forEach(function (rowIndex) {
      rowIndex = Number(rowIndex);
      const idx = rowIndex - 2;
      if (!rowIndex || rowIndex < 2 || idx < 0 || idx >= allData.length) return;

      const rowData = allData[idx];
      const status = String(rowData[10] || "").trim();
      if (status !== STATUS_ADJ_PENDING) return;

      if (disetujui) {
        const sku = String(rowData[2] || "").trim().toUpperCase();
        const lokasi = String(rowData[5] || "").trim();
        const selisih = Number(rowData[9]) || 0;
        const invoice = String(rowData[14] || "").trim();
        const keterangan = String(rowData[12] || "");

        if (selisih !== 0) {
          const type = selisih > 0 ? TYPE_ADJ_IN : TYPE_ADJ_OUT;
          const qtyAdj = Math.abs(selisih);
          rowsUntukLog.push([tanggalLog, sku, lokasi, invoice, approver, type, keterangan, getArea(lokasi)]);
          qtyUntukLog.push([qtyAdj]);
        }
      }

      idxTerpakai.push(idx);
    });

    if (idxTerpakai.length === 0) {
      return { jumlahDiproses: 0, stokSudahDiupdate: true };
    }

    let startRowLog = null;
    if (rowsUntukLog.length > 0) {
      startRowLog = findNextRow(shLog);
      shLog.getRange(startRowLog, 1, rowsUntukLog.length, 8).setValues(rowsUntukLog);
      shLog.getRange(startRowLog, 11, qtyUntukLog.length, 1).setValues(qtyUntukLog);
    }

    try {
      idxTerpakai.forEach(function (idx) {
        allData[idx][10] = disetujui ? STATUS_ADJ_APPROVED : STATUS_ADJ_REJECTED;
        allData[idx][15] = tanggalProses;
        allData[idx][16] = approver;
      });
      shAdj.getRange(2, 1, allData.length, 17).setValues(allData);
    } catch (errStatus) {
      if (startRowLog) {
        try {
          shLog.deleteRows(startRowLog, rowsUntukLog.length);
        } catch (errRollback) {
          Logger.log("GAGAL ROLLBACK Log Product setelah update status Adjustment gagal: " + errRollback.message);
        }
      }
      throw errStatus;
    }

    let stokSudahDiupdate = true;
    if (rowsUntukLog.length > 0) {
      try {
        rebuildStock();
      } catch (errRebuild) {
        stokSudahDiupdate = false;
        Logger.log("Chunk approval berhasil dicatat (Log Product + status), tapi rebuildStock() gagal: " + errRebuild.message);
      }

      // [SUPABASE SYNC] Sync baris ADJ_IN / ADJ_OUT ke Supabase real-time
      try {
        if (typeof catatLogDanUpdateStokSupabase === "function") {
          const ssSup = SpreadsheetApp.openById(SPREADSHEET_ID);
          const shDataSup = getSheetByNameCI_WMS ? getSheetByNameCI_WMS(ssSup, "Data") : ssSup.getSheetByName("Data");
          const skuNamaMap = {};
          if (shDataSup && shDataSup.getLastRow() > 1) {
            const shDataVals = shDataSup.getDataRange().getValues();
            const hdrs = shDataVals[0].map(h => String(h || "").trim().toLowerCase());
            const iSku  = hdrs.findIndex(h => h === "code" || h === "sku" || h === "item code" || h === "barcode");
            const iNama = hdrs.findIndex(h => h === "product" || h === "produk" || h === "nama produk");
            const iSize = hdrs.findIndex(h => h === "variant" || h === "size" || h === "ukuran");
            for (let ri = 1; ri < shDataVals.length; ri++) {
              const s = String(shDataVals[ri][iSku >= 0 ? iSku : 4] || "").trim().toUpperCase();
              if (s) skuNamaMap[s] = {
                nama: String(shDataVals[ri][iNama >= 0 ? iNama : 1] || "").trim(),
                size: String(shDataVals[ri][iSize >= 0 ? iSize : 3] || "").trim()
              };
            }
          }

          for (let li = 0; li < rowsUntukLog.length; li++) {
            try {
              const r = rowsUntukLog[li];
              const skuRow = String(r[1] || "").trim().toUpperCase();
              const meta = skuNamaMap[skuRow] || { nama: skuRow, size: "-" };
              const q = (qtyUntukLog[li] && qtyUntukLog[li][0]) ? Number(qtyUntukLog[li][0]) : 1;
              catatLogDanUpdateStokSupabase({
                type: r[5],
                invoice: r[3],
                sku: skuRow,
                nama: meta.nama || skuRow,
                size: meta.size || "-",
                area: r[7],
                lokasi: r[2],
                qty: q,
                operator: r[4],
                keterangan: r[6]
              });
            } catch (errRowSup) {
              Logger.log("Supabase adjustment row error: " + errRowSup.message);
            }
          }
        }
      } catch (errSupAll) {
        Logger.log("Supabase adjustment sync error: " + errSupAll.message);
      }
    }

    return { jumlahDiproses: idxTerpakai.length, stokSudahDiupdate: stokSudahDiupdate };
  } finally {
    lock.releaseLock();
  }
}