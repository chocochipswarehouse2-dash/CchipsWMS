/************************************************
 * PENERIMAAN PRODUKSI & KEDATANGAN BARANG (BACKEND)
 * Integrasi Supabase Cloud & Google Sheets Mirror
 ************************************************/

const TABLE_PENERIMAAN_PRODUKSI = "penerimaan_produksi";
const SHEET_NAME_PENERIMAAN_PRODUKSI = "Penerimaan Produksi";

/**
 * Upload Foto Base64 ke Supabase Storage dan kembalikan Public URL
 * @param {string} base64DataUrl - Data URL 'data:image/jpeg;base64,...'
 * @param {string} prefixName - Prefix nama file
 * @returns {string} Public URL
 */
function uploadFotoPenerimaanToStorage(base64DataUrl, prefixName) {
  if (!base64DataUrl || typeof base64DataUrl !== 'string') return '';
  if (base64DataUrl.startsWith('http://') || base64DataUrl.startsWith('https://')) {
    return base64DataUrl;
  }
  if (!base64DataUrl.startsWith('data:')) {
    return '';
  }

  try {
    const parts = base64DataUrl.split(',');
    if (parts.length < 2) return '';

    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = parts[1];
    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytes, mimeType);

    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const cleanPrefix = String(prefixName || 'foto').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const fileName = `${cleanPrefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;

    const url = SUPABASE_URL + "/storage/v1/object/penerimaan-foto/" + fileName;
    const options = {
      method: "post",
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
        "Content-Type": mimeType,
        "x-upsert": "true"
      },
      payload: blob.getBytes(),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();

    if (code >= 200 && code < 300) {
      return SUPABASE_URL + "/storage/v1/object/public/penerimaan-foto/" + fileName;
    } else {
      Logger.log("Gagal upload foto ke Supabase Storage (code " + code + "): " + response.getContentText());
      return "";
    }
  } catch (err) {
    Logger.log("Exception upload foto Supabase: " + err.message);
    return "";
  }
}

/**
 * Simpan Laporan Kedatangan Barang ke Supabase & Mirror ke Google Sheets
 * @param {string} token - Token sesi user
 * @param {object} payload - { tanggal, kategori, no_surat_jalan, items: [...], foto_url, keterangan }
 */
function simpanPenerimaanProduksi(token, payload) {
  const session = getWmsSessionFromToken(token);
  if (!session) {
    return { success: false, message: "Sesi login Anda telah berakhir. Silakan login kembali." };
  }

  if (!payload) {
    return { success: false, message: "Data payload penerimaan tidak valid." };
  }

  const tanggal = String(payload.tanggal || "").trim() || Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
  const kategori = String(payload.kategori || "Lokal CMT").trim(); // 'Lokal CMT' atau 'Kargo'
  const noSuratJalan = String(payload.no_surat_jalan || "").trim().toUpperCase();
  const operator = String(session.username || "Operator").trim();
  const globalKeterangan = String(payload.keterangan || "").trim();
  const globalFotoUrl = String(payload.foto_url || "").trim();

  if (!noSuratJalan) {
    return { success: false, message: "Nomor Surat Jalan wajib diisi." };
  }

  // Siapkan daftar item yang akan disimpan
  let items = [];
  if (Array.isArray(payload.produk_list) && payload.produk_list.length > 0) {
    payload.produk_list.forEach(function(p) {
      const kode = String(p.kode_produksi || "").trim();
      const warna = String(p.warna || "").trim();
      const foto = String(p.foto_url || p.foto || globalFotoUrl || "").trim();
      const catatanItem = String(p.catatan || p.keterangan || globalKeterangan || "").trim();

      if (Array.isArray(p.variants) && p.variants.length > 0) {
        p.variants.forEach(function(v) {
          if (v && (v.size || v.qty || v.warna)) {
            const variantWarna = String(v.warna || warna || "").trim().toUpperCase();
            items.push({
              kode_produksi: kode,
              warna: variantWarna,
              size: String(v.size || "Default").trim(),
              qty: parseInt(v.qty, 10) || 1,
              foto_url: foto,
              keterangan: catatanItem
            });
          }
        });
      } else {
        items.push({
          kode_produksi: kode,
          warna: warna,
          size: String(p.size || "Default").trim(),
          qty: parseInt(p.qty, 10) || 1,
          foto_url: foto,
          keterangan: catatanItem
        });
      }
    });
  } else if (Array.isArray(payload.items) && payload.items.length > 0) {
    items = payload.items;
  } else if (payload.kode_produksi) {
    items = [{
      kode_produksi: payload.kode_produksi,
      warna: payload.warna,
      size: payload.size,
      qty: payload.qty,
      keterangan: payload.keterangan || payload.catatan,
      foto_url: payload.foto_url
    }];
  }

  if (items.length === 0) {
    return { success: false, message: "Minimal harus ada 1 item barang yang diinput." };
  }

  // Cache upload foto agar foto yang sama hanya diupload 1 kali ke Supabase Storage
  const photoUploadCache = {};

  const batchNow = new Date();
  const timestampIso = batchNow.toISOString();
  const timestampStr = Utilities.formatDate(batchNow, TIMEZONE, "yyyy-MM-dd HH:mm:ss");

  const rowsToInsertSupabase = [];
  const rowsToInsertSheet = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const kodeProduksi = String(it.kode_produksi || "").trim().toUpperCase();
    const warna = String(it.warna || "").trim().toUpperCase();
    const size = String(it.size || "Default").trim();
    const qty = parseInt(it.qty, 10) || 1;
    const keterangan = String(it.keterangan || globalKeterangan || "").trim();
    let rawFoto = String(it.foto_url || globalFotoUrl || "").trim();
    let finalFotoUrl = "";

    if (rawFoto) {
      if (rawFoto.startsWith("http://") || rawFoto.startsWith("https://")) {
        finalFotoUrl = rawFoto;
      } else if (rawFoto.startsWith("data:")) {
        if (photoUploadCache[rawFoto]) {
          finalFotoUrl = photoUploadCache[rawFoto];
        } else {
          finalFotoUrl = uploadFotoPenerimaanToStorage(rawFoto, `sj_${noSuratJalan}_${kodeProduksi}`);
          if (finalFotoUrl) {
            photoUploadCache[rawFoto] = finalFotoUrl;
          }
        }
      }
    }

    if (!kodeProduksi) {
      return { success: false, message: `Baris ${i + 1}: Kode Produksi wajib diisi.` };
    }

    // Payload untuk Supabase (semua item dalam 1 input form menggunakan timestamp yang sama persis)
    rowsToInsertSupabase.push({
      tanggal_penerimaan: tanggal,
      kategori: kategori,
      no_surat_jalan: noSuratJalan,
      kode_produksi: kodeProduksi,
      warna: warna,
      size: size,
      qty: qty,
      foto_url: finalFotoUrl,
      keterangan: keterangan,
      operator: operator,
      created_at: timestampIso
    });

    // Payload untuk Google Sheets Backup (Aman dari limit 50.000 karakter, 1 input form = 1 timestamp yang sama)
    const sheetFotoCell = (finalFotoUrl && finalFotoUrl.startsWith("http")) ? finalFotoUrl : (finalFotoUrl ? "(Foto Terlampir)" : "-");
    rowsToInsertSheet.push([
      tanggal,
      kategori,
      noSuratJalan,
      kodeProduksi,
      warna,
      size,
      qty,
      sheetFotoCell,
      keterangan,
      operator,
      timestampStr
    ]);
  }

  // 1. Simpan ke Database Supabase
  let supabaseResult = null;
  let supabaseSuccess = false;
  let supabaseErrorMsg = "";

  try {
    const res = supabaseFetch(TABLE_PENERIMAAN_PRODUKSI, "post", rowsToInsertSupabase, "", true);
    if (res && res.success) {
      supabaseSuccess = true;
      supabaseResult = res.data;
    } else {
      supabaseErrorMsg = (res && res.message) ? res.message : "Gagal menyimpan ke Supabase";
      Logger.log("Supabase insert note (penerimaan_produksi): " + supabaseErrorMsg);
    }
  } catch (err) {
    supabaseErrorMsg = err.message;
    Logger.log("Supabase exception (penerimaan_produksi): " + err.message);
  }

  // 2. Mirroring / Backup ke Google Sheets
  let sheetSuccess = false;
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME_PENERIMAAN_PRODUKSI);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME_PENERIMAAN_PRODUKSI);
      sheet.appendRow([
        "Tanggal Penerimaan", "Kategori", "No Surat Jalan", "Kode Produksi",
        "Warna", "Size", "Qty", "Foto URL", "Keterangan", "Operator", "Waktu Input"
      ]);
      sheet.getRange("A1:K1").setFontWeight("bold").setBackground("#f1f5f9");
      sheet.setFrozenRows(1);
    }

    if (rowsToInsertSheet.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToInsertSheet.length, 11).setValues(rowsToInsertSheet);
      sheetSuccess = true;
    }
  } catch (errSheet) {
    Logger.log("Gagal backup ke Google Sheet Penerimaan Produksi: " + errSheet.message);
  }

  if (!supabaseSuccess && !sheetSuccess) {
    return {
      success: false,
      message: `Gagal menyimpan data: ${supabaseErrorMsg}`
    };
  }

  return {
    success: true,
    isSupabaseSaved: supabaseSuccess,
    message: `Berhasil menyimpan ${rowsToInsertSupabase.length} item kedatangan barang (${kategori})! 🚀`,
    count: rowsToInsertSupabase.length
  };
}

/**
 * Mengambil Daftar Riwayat Data Penerimaan Produksi dari Supabase
 * @param {string} token - Token sesi user
 * @param {object} filters - { kategori, startDate, endDate, keyword, limit }
 */
function getPenerimaanProduksiList(token, filters) {
  const session = getWmsSessionFromToken(token);
  if (!session) {
    return { success: false, message: "Sesi login tidak valid atau kadaluarsa." };
  }

  filters = filters || {};
  const kategori = String(filters.kategori || "").trim();
  const startDate = String(filters.startDate || "").trim();
  const endDate = String(filters.endDate || "").trim();
  const keyword = String(filters.keyword || "").trim().toLowerCase();
  const limit = parseInt(filters.limit, 10) || 500;

  // 1. Coba ambil dari Supabase
  try {
    let queryParams = `select=*&order=id.desc&limit=${limit}`;

    if (kategori && kategori !== "ALL" && kategori !== "SEMUA") {
      queryParams += `&kategori=eq.${encodeURIComponent(kategori)}`;
    }
    if (startDate) {
      queryParams += `&tanggal_penerimaan=gte.${encodeURIComponent(startDate)}`;
    }
    if (endDate) {
      queryParams += `&tanggal_penerimaan=lte.${encodeURIComponent(endDate)}`;
    }

    const res = supabaseFetch(TABLE_PENERIMAAN_PRODUKSI, "get", null, queryParams, true);

    if (res && res.success && Array.isArray(res.data)) {
      let data = res.data;

      // Filter lokal keyword jika ada
      if (keyword) {
        data = data.filter(function (row) {
          const combined = (
            String(row.kode_produksi || "") + " " +
            String(row.no_surat_jalan || "") + " " +
            String(row.warna || "") + " " +
            String(row.keterangan || "") + " " +
            String(row.operator || "")
          ).toLowerCase();
          return combined.includes(keyword);
        });
      }

      return {
        success: true,
        source: "supabase",
        data: data,
        total: data.length
      };
    }
  } catch (err) {
    Logger.log("Gagal query Supabase penerimaan_produksi: " + err.message);
  }

  // 2. Fallback: Ambil dari Google Sheets jika tabel Supabase belum dibuat
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME_PENERIMAAN_PRODUKSI);
    if (!sheet) {
      return { success: true, source: "sheet", data: [], total: 0 };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, source: "sheet", data: [], total: 0 };
    }

    const rawValues = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
    let list = [];

    for (let i = rawValues.length - 1; i >= 0; i--) {
      const r = rawValues[i];
      const tgl = r[0] instanceof Date ? Utilities.formatDate(r[0], TIMEZONE, "yyyy-MM-dd") : String(r[0] || "");
      const kat = String(r[1] || "");
      const sj = String(r[2] || "");
      const kode = String(r[3] || "");
      const warna = String(r[4] || "");
      const size = String(r[5] || "");
      const qty = Number(r[6]) || 0;
      const foto = String(r[7] || "");
      const ket = String(r[8] || "");
      const op = String(r[9] || "");
      const createdAt = r[10] instanceof Date ? Utilities.formatDate(r[10], TIMEZONE, "yyyy-MM-dd HH:mm:ss") : String(r[10] || "");

      if (kategori && kategori !== "ALL" && kategori !== "SEMUA" && kat.toLowerCase() !== kategori.toLowerCase()) {
        continue;
      }
      if (startDate && tgl < startDate) continue;
      if (endDate && tgl > endDate) continue;

      if (keyword) {
        const combined = (kode + " " + sj + " " + warna + " " + ket + " " + op).toLowerCase();
        if (!combined.includes(keyword)) continue;
      }

      list.push({
        id: i + 1,
        sheet_row: i + 2,
        tanggal_penerimaan: tgl,
        kategori: kat,
        no_surat_jalan: sj,
        kode_produksi: kode,
        warna: warna,
        size: size,
        qty: qty,
        foto_url: foto,
        keterangan: ket,
        operator: op,
        created_at: createdAt
      });

      if (list.length >= limit) break;
    }

    return {
      success: true,
      source: "sheet_fallback",
      data: list,
      total: list.length
    };
  } catch (errSheet) {
    return { success: false, message: "Gagal memuat data: " + errSheet.message };
  }
}

/**
 * Update seluruh data penerimaan dalam satu Surat Jalan (Batch / Per Penerimaan)
 * @param {string} token - Token sesi user
 * @param {object} payload - { orig_no_surat_jalan, tanggal, kategori, no_surat_jalan, keterangan, items: [...] }
 */
function updateBatchPenerimaanProduksi(token, payload) {
  const session = getWmsSessionFromToken(token);
  if (!session) {
    return { success: false, message: "Sesi login Anda telah berakhir. Silakan login kembali." };
  }

  if (!payload) {
    return { success: false, message: "Payload update tidak valid." };
  }

  const origSJ = String(payload.orig_no_surat_jalan || "").trim().toUpperCase();
  const tanggal = String(payload.tanggal || payload.tanggal_penerimaan || "").trim() || Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
  const kategori = String(payload.kategori || "Lokal CMT").trim();
  const noSuratJalan = String(payload.no_surat_jalan || origSJ || "").trim().toUpperCase();
  const globalKeterangan = String(payload.keterangan || "").trim();
  const operator = String(session.username || "Operator").trim();

  if (!origSJ && !noSuratJalan) {
    return { success: false, message: "Nomor Surat Jalan asal/baru tidak boleh kosong." };
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    return { success: false, message: "Minimal harus ada 1 item produk dalam penerimaan ini." };
  }

  const photoUploadCache = {};
  const batchNow = new Date();
  const timestampIso = batchNow.toISOString();
  const timestampStr = Utilities.formatDate(batchNow, TIMEZONE, "yyyy-MM-dd HH:mm:ss");

  const rowsToInsertSupabase = [];
  const rowsToInsertSheet = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const kodeProduksi = String(it.kode_produksi || "").trim().toUpperCase();
    const warna = String(it.warna || "").trim().toUpperCase();
    const size = String(it.size || "Default").trim();
    const qty = parseInt(it.qty, 10) || 1;
    const keterangan = String(it.keterangan || globalKeterangan || "").trim();
    let rawFoto = String(it.foto_url || it.foto || "").trim();
    let finalFotoUrl = "";

    if (rawFoto) {
      if (rawFoto.startsWith("http://") || rawFoto.startsWith("https://")) {
        finalFotoUrl = rawFoto;
      } else if (rawFoto.startsWith("data:")) {
        if (photoUploadCache[rawFoto]) {
          finalFotoUrl = photoUploadCache[rawFoto];
        } else {
          finalFotoUrl = uploadFotoPenerimaanToStorage(rawFoto, `edit_sj_${noSuratJalan}_${kodeProduksi}`);
          if (finalFotoUrl) {
            photoUploadCache[rawFoto] = finalFotoUrl;
          }
        }
      }
    }

    if (!kodeProduksi) {
      return { success: false, message: `Baris ${i + 1}: Kode Produksi wajib diisi.` };
    }

    rowsToInsertSupabase.push({
      tanggal_penerimaan: tanggal,
      kategori: kategori,
      no_surat_jalan: noSuratJalan,
      kode_produksi: kodeProduksi,
      warna: warna,
      size: size,
      qty: qty,
      foto_url: finalFotoUrl,
      keterangan: keterangan,
      operator: operator,
      created_at: it.created_at || timestampIso
    });

    const sheetFotoCell = (finalFotoUrl && finalFotoUrl.startsWith("http")) ? finalFotoUrl : (finalFotoUrl ? "(Foto Terlampir)" : "-");
    rowsToInsertSheet.push([
      tanggal,
      kategori,
      noSuratJalan,
      kodeProduksi,
      warna,
      size,
      qty,
      sheetFotoCell,
      keterangan,
      operator,
      timestampStr
    ]);
  }

  // 1. Update ke Supabase: Hapus baris lama berdasarkan origSJ, lalu masukkan baris baru
  const targetFilterSJ = origSJ || noSuratJalan;
  try {
    supabaseFetch(TABLE_PENERIMAAN_PRODUKSI, "delete", null, `no_surat_jalan=eq.${encodeURIComponent(targetFilterSJ)}`, true);
    supabaseFetch(TABLE_PENERIMAAN_PRODUKSI, "post", rowsToInsertSupabase, "", true);
  } catch (errSupabase) {
    Logger.log("Exception update batch Supabase: " + errSupabase.message);
  }

  // 2. Update ke Google Sheets Backup
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME_PENERIMAAN_PRODUKSI);
    if (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const rawVals = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
        // Hapus dari bawah ke atas agar index baris tidak bergeser
        for (let r = rawVals.length - 1; r >= 0; r--) {
          const rowSJ = String(rawVals[r][0] || "").trim().toUpperCase();
          if (rowSJ === targetFilterSJ) {
            sheet.deleteRow(r + 2);
          }
        }
      }

      // Masukkan baris baru
      if (rowsToInsertSheet.length > 0) {
        const nextRow = sheet.getLastRow() + 1;
        sheet.getRange(nextRow, 1, rowsToInsertSheet.length, 11).setValues(rowsToInsertSheet);
      }
    }
  } catch (errSheet) {
    Logger.log("Exception update batch Google Sheet: " + errSheet.message);
  }

  return {
    success: true,
    message: `Penerimaan ${noSuratJalan} berhasil diperbarui (${rowsToInsertSupabase.length} item)! ✨`,
    count: rowsToInsertSupabase.length
  };
}

/**
 * Hapus seluruh data penerimaan dalam satu Surat Jalan (Batch)
 * @param {string} token - Token sesi user
 * @param {string} noSuratJalan - Nomor Surat Jalan
 */
function hapusBatchPenerimaanProduksi(token, noSuratJalan) {
  const session = getWmsSessionFromToken(token);
  if (!session) {
    return { success: false, message: "Sesi login Anda telah berakhir." };
  }

  const targetSJ = String(noSuratJalan || "").trim().toUpperCase();
  if (!targetSJ) {
    return { success: false, message: "Nomor Surat Jalan tidak valid." };
  }

  // 1. Hapus dari Supabase
  try {
    supabaseFetch(TABLE_PENERIMAAN_PRODUKSI, "delete", null, `no_surat_jalan=eq.${encodeURIComponent(targetSJ)}`, true);
  } catch (err) {
    Logger.log("Gagal hapus batch dari Supabase: " + err.message);
  }

  // 2. Hapus dari Google Sheets
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME_PENERIMAAN_PRODUKSI);
    if (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const rawVals = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
        for (let r = rawVals.length - 1; r >= 0; r--) {
          const rowSJ = String(rawVals[r][0] || "").trim().toUpperCase();
          if (rowSJ === targetSJ) {
            sheet.deleteRow(r + 2);
          }
        }
      }
    }
  } catch (errSheet) {
    Logger.log("Gagal hapus batch dari Google Sheet: " + errSheet.message);
  }

  return { success: true, message: `Seluruh data Surat Jalan ${targetSJ} berhasil dihapus! 🗑️` };
}

/**
 * Perbarui (Edit) data penerimaan produksi
 * @param {string} token - Token sesi user
 * @param {object} payload - Data perubahan
 */
function updatePenerimaanProduksi(token, payload) {
  const session = getWmsSessionFromToken(token);
  if (!session) {
    return { success: false, message: "Sesi login Anda telah berakhir. Silakan login kembali." };
  }

  if (!payload) {
    return { success: false, message: "Payload update tidak valid." };
  }

  const recordId = payload.id;
  const sheetRow = payload.sheet_row;
  const tanggal = String(payload.tanggal || payload.tanggal_penerimaan || "").trim() || Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
  const kategori = String(payload.kategori || "Lokal CMT").trim();
  const noSuratJalan = String(payload.no_surat_jalan || "").trim().toUpperCase();
  const kodeProduksi = String(payload.kode_produksi || "").trim().toUpperCase();
  const warna = String(payload.warna || "").trim().toUpperCase();
  const size = String(payload.size || "Default").trim();
  const qty = parseInt(payload.qty, 10) || 1;
  const keterangan = String(payload.keterangan || "").trim();
  let rawFoto = String(payload.foto_url || "").trim();
  let finalFotoUrl = "";

  if (rawFoto) {
    if (rawFoto.startsWith("http://") || rawFoto.startsWith("https://")) {
      finalFotoUrl = rawFoto;
    } else if (rawFoto.startsWith("data:")) {
      finalFotoUrl = uploadFotoPenerimaanToStorage(rawFoto, `edit_sj_${noSuratJalan}_${kodeProduksi}`);
    }
  }

  if (!kodeProduksi) {
    return { success: false, message: "Kode Produksi wajib diisi." };
  }
  if (!noSuratJalan) {
    return { success: false, message: "Nomor Surat Jalan wajib diisi." };
  }

  let supabaseUpdated = false;
  let supabaseError = "";

  // 1. Update ke Supabase jika ada ID dan tabel siap
  if (recordId && String(recordId).length > 0) {
    try {
      const updateBody = {
        tanggal_penerimaan: tanggal,
        kategori: kategori,
        no_surat_jalan: noSuratJalan,
        kode_produksi: kodeProduksi,
        warna: warna,
        size: size,
        qty: qty,
        foto_url: finalFotoUrl,
        keterangan: keterangan
      };
      const res = supabaseFetch(TABLE_PENERIMAAN_PRODUKSI, "patch", updateBody, `id=eq.${encodeURIComponent(recordId)}`, true);
      if (res && res.success) {
        supabaseUpdated = true;
      } else {
        supabaseError = res ? res.message : "Gagal update Supabase";
      }
    } catch (err) {
      supabaseError = err.message;
      Logger.log("Exception update Supabase: " + err.message);
    }
  }

  // 2. Update ke Google Sheets Backup
  let sheetUpdated = false;
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME_PENERIMAAN_PRODUKSI);
    if (sheet) {
      let targetRow = parseInt(sheetRow, 10);
      const lastRow = sheet.getLastRow();

      if (!targetRow || targetRow < 2 || targetRow > lastRow) {
        if (lastRow >= 2) {
          const rawVals = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
          for (let i = 0; i < rawVals.length; i++) {
            const rowSJ = String(rawVals[i][2] || "").trim().toUpperCase();
            const rowKode = String(rawVals[i][3] || "").trim().toUpperCase();
            const rowWarna = String(rawVals[i][4] || "").trim().toUpperCase();
            const rowSize = String(rawVals[i][5] || "").trim().toUpperCase();

            const origSJ = String(payload.orig_no_surat_jalan || noSuratJalan).trim().toUpperCase();
            const origKode = String(payload.orig_kode_produksi || kodeProduksi).trim().toUpperCase();

            if (rowSJ === origSJ && rowKode === origKode) {
              targetRow = i + 2;
              break;
            }
          }
        }
      }

      if (targetRow && targetRow >= 2 && targetRow <= lastRow) {
        const sheetFotoCell = (finalFotoUrl && finalFotoUrl.startsWith("http")) ? finalFotoUrl : (finalFotoUrl ? "(Foto Terlampir)" : "-");
        sheet.getRange(targetRow, 1, 1, 10).setValues([[
          tanggal,
          kategori,
          noSuratJalan,
          kodeProduksi,
          warna,
          size,
          qty,
          sheetFotoCell,
          keterangan,
          session.username || "Operator"
        ]]);
        sheetUpdated = true;
      }
    }
  } catch (errSheet) {
    Logger.log("Exception update Google Sheet: " + errSheet.message);
  }

  return {
    success: true,
    message: "Data kedatangan barang berhasil diperbarui! ✨",
    foto_url: finalFotoUrl
  };
}

/**
 * Hapus data penerimaan produksi berdasarkan ID atau baris Sheet
 * @param {string} token - Token sesi user
 * @param {object|string|number} payload - ID atau object { id, sheet_row, no_surat_jalan, kode_produksi }
 */
function hapusPenerimaanProduksi(token, payload) {
  const session = getWmsSessionFromToken(token);
  if (!session) {
    return { success: false, message: "Sesi login Anda telah berakhir." };
  }

  let recordId = null;
  let sheetRow = null;
  let noSuratJalan = null;
  let kodeProduksi = null;
  let warna = null;
  let size = null;

  if (typeof payload === "object" && payload !== null) {
    recordId = payload.id;
    sheetRow = payload.sheet_row;
    noSuratJalan = payload.no_surat_jalan;
    kodeProduksi = payload.kode_produksi;
    warna = payload.warna;
    size = payload.size;
  } else {
    recordId = payload;
  }

  if (!recordId && !sheetRow && !noSuratJalan) {
    return { success: false, message: "ID atau referensi data tidak valid." };
  }

  // 1. Hapus dari Supabase jika ada ID
  if (recordId) {
    try {
      supabaseFetch(TABLE_PENERIMAAN_PRODUKSI, "delete", null, `id=eq.${encodeURIComponent(recordId)}`, true);
    } catch (err) {
      Logger.log("Gagal hapus dari Supabase: " + err.message);
    }
  }

  // 2. Hapus baris dari Google Sheets
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME_PENERIMAAN_PRODUKSI);
    if (sheet) {
      let targetRow = parseInt(sheetRow, 10);
      const lastRow = sheet.getLastRow();

      if (!targetRow || targetRow < 2 || targetRow > lastRow) {
        if (lastRow >= 2) {
          const rawVals = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
          for (let i = 0; i < rawVals.length; i++) {
            const rowSJ = String(rawVals[i][2] || "").trim().toUpperCase();
            const rowKode = String(rawVals[i][3] || "").trim().toUpperCase();
            const rowWarna = String(rawVals[i][4] || "").trim().toUpperCase();
            const rowSize = String(rawVals[i][5] || "").trim().toUpperCase();

            if (String(noSuratJalan || "").trim().toUpperCase() === rowSJ &&
                String(kodeProduksi || "").trim().toUpperCase() === rowKode) {
              if (warna && String(warna).trim().toUpperCase() !== rowWarna) continue;
              if (size && String(size).trim().toUpperCase() !== rowSize) continue;
              targetRow = i + 2;
              break;
            }
          }
        }
      }

      if (targetRow && targetRow >= 2 && targetRow <= sheet.getLastRow()) {
        sheet.deleteRow(targetRow);
      }
    }
  } catch (errSheet) {
    Logger.log("Gagal hapus baris dari Google Sheet: " + errSheet.message);
  }

  return { success: true, message: "Data kedatangan barang berhasil dihapus! 🗑️" };
}
