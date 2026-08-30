/************************************************
 * FORM PEMINJAMAN SEMENTARA (SPS) WMS
 ************************************************/

const SHEET_DATA_PRODUK = "Data";   // sheet database produk
const SHEET_PEMINJAMAN = "Peminjaman"; // sheet khusus form peminjaman
const PREFIX_PEMINJAMAN = "PJM";
const PROP_PEMINJAMAN_COUNTER = "PEMINJAMAN_COUNTER";

/************************************************
 * DATA AWAL FORM: daftar produk & stok dari Supabase & Sheet
 ************************************************/
function getPeminjamanInitData() {
  const skuMetaMap = {};
  const produkList = [];
  let stokMap = {};
  let liveStockList = [];
  let realtimeStocks = [];

  // 1. Coba ambil produk dari cache WMS terlebih dahulu (cepat 0.05s)
  let compactData = null;
  try {
    if (typeof ambilProdukListDariCache === "function" && typeof CACHE_WMS_DASH_COUNT_KEY !== "undefined" && typeof CACHE_WMS_DASH_PREFIX !== "undefined") {
      compactData = ambilProdukListDariCache(CACHE_WMS_DASH_COUNT_KEY, CACHE_WMS_DASH_PREFIX);
    }
  } catch (e) {}

  if (compactData && Array.isArray(compactData) && compactData.length > 0) {
    compactData.forEach(function (item) {
      if (!item || !item.k) return;
      const sku = String(item.k).trim().toUpperCase();
      const nama = String(item.p || sku).trim();
      const size = String(item.s || "-").trim();
      skuMetaMap[sku] = { nama: nama, size: size };
    });
  } else {
    // 2. Fallback baca langsung dari Sheet "Data"
    try {
      if (typeof SPREADSHEET_ID !== "undefined" && SPREADSHEET_ID) {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = (typeof getSheetByNameCI_WMS === "function") 
          ? getSheetByNameCI_WMS(ss, "Data") 
          : ss.getSheetByName(SHEET_DATA_PRODUK || "Data");
          
        if (sheet && sheet.getLastRow() >= 2) {
          const values = sheet.getDataRange().getValues();
          if (values.length > 1) {
            const headers = values[0].map(h => String(h || "").trim().toLowerCase());
            let namaIdx = headers.findIndex(h => h === "product" || h === "nama produk" || h === "produk");
            let sizeIdx = headers.findIndex(h => h === "variant" || h === "size" || h === "ukuran");
            let skuIdx  = headers.findIndex(h => h === "code" || h === "sku" || h === "item code" || h === "barcode");
            if (namaIdx === -1) namaIdx = 1;
            if (sizeIdx === -1) sizeIdx = 3;
            if (skuIdx === -1)  skuIdx  = 4;

            for (let r = 1; r < values.length; r++) {
              const row = values[r];
              const sku = String(row[skuIdx] || "").trim().toUpperCase();
              const nama = String(row[namaIdx] || "").trim();
              const size = String(row[sizeIdx] || "").trim();
              if (sku && nama) {
                skuMetaMap[sku] = { nama: nama, size: size || "-" };
              }
            }
          }
        }
      }
    } catch (errSheet) {
      Logger.log("getPeminjamanInitData Sheet read error: " + errSheet.message);
    }
  }

  // 3. Ambil Stok Realtime Supabase (view_stok_realtime)
  try {
    if (typeof fetchAllSupabaseStokRealtime === "function") {
      realtimeStocks = fetchAllSupabaseStokRealtime();
    }
  } catch (errSup) {
    Logger.log("getPeminjamanInitData Supabase fetch error: " + errSup.message);
  }

  if (realtimeStocks && realtimeStocks.length > 0) {
    const channelMap = {};

    realtimeStocks.forEach(function (sRow) {
      const sku = String(sRow.sku || "").trim().toUpperCase();
      const lokasi = String(sRow.lokasi || "").trim();
      const area = String(sRow.area || "").trim().toUpperCase();
      const qty = Number(sRow.sisa_stok) || 0;
      const namaStock = String(sRow.nama_produk || "").trim();
      const sizeStock = String(sRow.size || "").trim();

      if (!sku || qty === 0) return;

      if (!skuMetaMap[sku]) {
        skuMetaMap[sku] = { nama: namaStock || sku, size: sizeStock || "-" };
      }
      const meta = skuMetaMap[sku];

      // Stok Gudang Utama (MAP / Warehouse)
      if (area === "WAREHOUSE" || area === "MAP") {
        if (!stokMap[sku]) stokMap[sku] = { qty: 0, lokasiList: [] };
        stokMap[sku].qty += qty;
        if (lokasi && stokMap[sku].lokasiList.indexOf(lokasi) === -1) {
          stokMap[sku].lokasiList.push(lokasi);
        }
      }

      // Stok Channel Live (Blok F)
      const lUpper = lokasi.toUpperCase();
      let isStudio = lUpper.includes("STUDIO") || lUpper === "SAMPLE" || lUpper === "LIVE";
      let isShopee = lUpper.includes("SHOPEE") || lUpper === "SHP" || lUpper.includes("LIVE SHOPEE");
      let isTiktok = lUpper.includes("TIKTOK") || lUpper === "TTK" || lUpper === "TT" || lUpper.includes("LIVE TIKTOK");

      if (area === "BLOK F") {
        if (!isShopee && !isTiktok) isStudio = true;
      }

      if (isStudio || isShopee || isTiktok) {
        if (!channelMap[sku]) {
          channelMap[sku] = {
            sku: sku,
            produk: meta.nama || sku,
            size: meta.size || "-",
            studioQty: 0,
            shpQty: 0,
            ttkQty: 0,
            totalQty: 0,
            lokasi: lokasi
          };
        }
        if (isStudio) channelMap[sku].studioQty += qty;
        if (isShopee) channelMap[sku].shpQty += qty;
        if (isTiktok) channelMap[sku].ttkQty += qty;
        channelMap[sku].totalQty = channelMap[sku].studioQty + channelMap[sku].shpQty + channelMap[sku].ttkQty;
      }
    });

    Object.keys(stokMap).forEach(function (sku) {
      stokMap[sku].lokasi = stokMap[sku].lokasiList.join(", ");
      delete stokMap[sku].lokasiList;
    });

    liveStockList = Object.values(channelMap);
    liveStockList.sort((a, b) => (a.produk || '').localeCompare(b.produk || ''));

  } else {
    // Fallback ke Sheet STOCK
    stokMap = getStokWarehouseMap();
    liveStockList = getLiveChannelsStockList(skuMetaMap);
  }

  // Susun produkList
  Object.keys(skuMetaMap).forEach(function (sku) {
    const meta = skuMetaMap[sku];
    const info = stokMap[sku];
    const stok = info ? info.qty : 0;
    const lokasi = info ? info.lokasi : "";
    produkList.push({ produk: meta.nama, size: meta.size, sku: sku, stok: stok, lokasi: lokasi });
  });

  produkList.sort(function (a, b) {
    const c = String(a.produk || '').localeCompare(String(b.produk || ''));
    if (c !== 0) return c;
    return String(a.sku || '').localeCompare(String(b.sku || ''));
  });

  return { 
    produkList: produkList,
    liveStockList: liveStockList,
    studioStockList: liveStockList.filter(x => x.studioQty > 0)
  };
}

/************************************************
 * BACA DAFTAR STOK TERSEDIA DI CHANNEL LIVE (STUDIO, SHOPEE, TIKTOK)
 ************************************************/
function getLiveChannelsStockList(skuMetaMap) {
  try {
    if (typeof SPREADSHEET_ID === "undefined" || !SPREADSHEET_ID) return [];
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (!ss) return [];
    const sheet = ss.getSheetByName("STOCK");
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const numCols = Math.max(4, Math.min(sheet.getLastColumn(), 6));
    const values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

    const channelMap = {};
    values.forEach(function (row) {
      const lokasi = String(row[0] || "").trim();
      const area = String(row[1] || "").trim();
      const sku = String(row[2] || "").trim().toUpperCase();
      const qty = Number(row[3]) || 0;
      const namaColE = numCols >= 5 ? String(row[4] || "").trim() : "";
      const sizeColF = numCols >= 6 ? String(row[5] || "").trim() : "";

      if (!sku || qty <= 0) return;

      const aUpper = area.toUpperCase();
      const lUpper = lokasi.toUpperCase();

      let isStudio = lUpper.includes("STUDIO") || lUpper === "SAMPLE" || lUpper === "LIVE";
      let isShopee = lUpper.includes("SHOPEE") || lUpper === "SHP" || lUpper.includes("LIVE SHOPEE");
      let isTiktok = lUpper.includes("TIKTOK") || lUpper === "TTK" || lUpper === "TT" || lUpper.includes("LIVE TIKTOK");

      if (aUpper === "BLOK F") {
        if (!isShopee && !isTiktok) isStudio = true;
      }

      if (!isStudio && !isShopee && !isTiktok) return;

      const meta = (skuMetaMap && skuMetaMap[sku]) ? skuMetaMap[sku] : { nama: namaColE || sku, size: sizeColF || "-" };

      if (!channelMap[sku]) {
        channelMap[sku] = {
          sku: sku,
          produk: meta.nama || namaColE || sku,
          size: meta.size || sizeColF || "-",
          studioQty: 0,
          shpQty: 0,
          ttkQty: 0,
          totalQty: 0,
          lokasi: lokasi
        };
      }

      if (isStudio) channelMap[sku].studioQty += qty;
      if (isShopee) channelMap[sku].shpQty += qty;
      if (isTiktok) channelMap[sku].ttkQty += qty;
      channelMap[sku].totalQty = channelMap[sku].studioQty + channelMap[sku].shpQty + channelMap[sku].ttkQty;
    });

    const list = Object.keys(channelMap).map(k => channelMap[k]);
    list.sort((a, b) => a.produk.localeCompare(b.produk));
    return list;
  } catch (err) {
    Logger.log("Error getLiveChannelsStockList: " + err.message);
    return [];
  }
}

function getStudioStockList(skuMetaMap) {
  return getLiveChannelsStockList(skuMetaMap).filter(x => x.studioQty > 0);
}

/************************************************
 * BACA STOK + LOKASI DARI SHEET "STOCK"
 ************************************************/
function getStokWarehouseMap() {
  try {
    if (typeof SPREADSHEET_ID === "undefined" || !SPREADSHEET_ID) return {};
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (!ss) return {};

    const sheet = ss.getSheetByName("STOCK");
    if (!sheet) return {};

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return {};

    const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues(); 

    const map = {};
    values.forEach(function (row) {
      const area = String(row[1] || "").trim();
      if (area.toUpperCase() !== "WAREHOUSE") return;

      const lokasi = String(row[0] || "").trim();
      const sku = String(row[2] || "").trim().toUpperCase();
      const qty = Number(row[3]) || 0;
      if (!sku) return;

      if (!map[sku]) map[sku] = { qty: 0, lokasiList: [] };
      map[sku].qty += qty;
      if (lokasi && map[sku].lokasiList.indexOf(lokasi) === -1) {
        map[sku].lokasiList.push(lokasi);
      }
    });

    Object.keys(map).forEach(function (sku) {
      map[sku].lokasi = map[sku].lokasiList.join(", ");
      delete map[sku].lokasiList;
    });

    return map;
  } catch (err) {
    Logger.log("Error getStokWarehouseMap: " + err.message);
    return {};
  }
}

/************************************************
 * GENERATE NO PEMINJAMAN
 ************************************************/
function getPeminjamanID() {
  const props = PropertiesService.getScriptProperties();
  let n = Number(props.getProperty(PROP_PEMINJAMAN_COUNTER) || 0);
  n++;
  props.setProperty(PROP_PEMINJAMAN_COUNTER, n);
  return PREFIX_PEMINJAMAN + "-" + String(n).padStart(6, "0");
}

function getNextNoPeminjaman(sheet, startRow) {
  if (startRow <= 2) return 1;
  const lastNo = sheet.getRange(startRow - 1, 1).getValue();
  return (typeof lastNo === "number" && lastNo > 0) ? lastNo + 1 : (startRow - 1);
}

/************************************************
 * SUBMIT FORM PEMINJAMAN (SIMPAN KE SUPABASE & SHEET)
 ************************************************/
function submitPeminjaman(data) {
  const session = getWmsSessionFromToken(data && data.token);
  if (!session) {
    return { success: false, message: "Sesi login tidak valid/kadaluarsa. Silakan login ulang." };
  }
  if (!wmsBisaAksesPeminjaman(session.akses)) {
    return { success: false, message: "Akun kamu tidak punya akses ke fitur ini." };
  }
  if (!data || !data.namaPeminjam || !String(data.namaPeminjam).trim()) {
    return { success: false, message: "Nama/PIC peminjam wajib diisi." };
  }
  if (!data.keperluan || !String(data.keperluan).trim()) {
    return { success: false, message: "Keperluan wajib diisi." };
  }
  if (!data.tglPinjam) {
    return { success: false, message: "Tanggal peminjaman wajib diisi." };
  }
  if (!data.items || data.items.length === 0) {
    return { success: false, message: "Minimal 1 item produk." };
  }

  const itemsValid = data.items.filter(function (it) {
    return it.produk && String(it.produk).trim() && Number(it.qty) > 0;
  });

  if (itemsValid.length === 0) {
    return { success: false, message: "Tidak ada item dengan produk & qty yang valid." };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_PEMINJAMAN);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const timestamp = new Date();
    const noPeminjaman = getPeminjamanID();
    const emailPengisi = session.username; 
    const tglPinjamVal = data.tglPinjam;

    // 1. Simpan ke Database Supabase (Table: peminjaman)
    const rowsSupabase = itemsValid.map(function (it) {
      return {
        no_peminjaman: noPeminjaman,
        pic: String(data.namaPeminjam).trim(),
        keperluan: String(data.keperluan).trim(),
        tanggal_pinjam: tglPinjamVal,
        sku: String(it.sku || "").trim().toUpperCase(),
        nama_produk: String(it.produk || "").trim(),
        size: String(it.size || "-").trim(),
        qty: Number(it.qty) || 1,
        lokasi: it.lokasi || "STUDIO",
        status: "Dipinjam",
        operator: emailPengisi,
        created_at: timestamp.toISOString()
      };
    });

    let isSupabaseSaved = false;
    try {
      if (typeof supabaseFetch === "function") {
        const resSup = supabaseFetch("peminjaman", "post", rowsSupabase, "", true);
        if (resSup && resSup.success) isSupabaseSaved = true;
      }
    } catch (errSup) {
      Logger.log("Supabase insert error peminjaman: " + errSup.message);
    }

    // 2. Simpan Backup ke Google Sheet "Peminjaman"
    if (sheet) {
      const startRow = findNextRow(sheet); 
      let noUrut = getNextNoPeminjaman(sheet, startRow);

      const rows = itemsValid.map(function (it) {
        return [
          noUrut++,                           // A - No
          timestamp,                          // B - Timestamp submit
          String(data.namaPeminjam).trim(),   // C - Nama/PIC Peminjam
          String(data.keperluan).trim(),      // D - Keperluan
          tglPinjamVal,                       // E - Tanggal Peminjaman
          "",                                 // F - Kosong
          String(it.produk).trim(),           // G - Nama Produk
          it.sku || "",                       // H - SKU
          it.size || "",                      // I - Size
          Number(it.qty),                     // J - Qty
          noPeminjaman,                       // K - No Peminjaman
          "Dipinjam",                         // L - Status
          emailPengisi,                       // M - Username pengisi
          it.lokasi || ""                     // N - Lokasi
        ];
      });

      sheet.getRange(startRow, 1, rows.length, 14).setValues(rows);
    }

    try {
      if (typeof kirimWaPeminjamanBaru === "function") {
        kirimWaPeminjamanBaru();
      }
    } catch (errWa) {
      Logger.log("Gagal kirim WA notifikasi peminjaman baru: " + errWa.message);
    }

    return {
      success: true,
      noPeminjaman: noPeminjaman,
      isSupabaseSaved: isSupabaseSaved,
      message: "Peminjaman berhasil diajukan (" + itemsValid.length + " item). No Peminjaman: " + noPeminjaman
    };

  } catch (err) {
    return { success: false, message: "Terjadi error: " + err.message };
  } finally {
    lock.releaseLock();
  }
}

/************************************************
 * AMBIL RIWAYAT PEMINJAMAN DARI SUPABASE
 ************************************************/
function getPeminjamanList(token, filters) {
  const session = getWmsSessionFromToken(token);
  if (!session) return { success: false, message: "Sesi tidak valid." };

  filters = filters || {};
  const status = filters.status || "";
  const keyword = (filters.keyword || "").trim().toLowerCase();
  const limit = parseInt(filters.limit, 10) || 200;

  try {
    let queryParams = `order=created_at.desc&limit=${limit}`;
    if (status) queryParams += `&status=eq.${encodeURIComponent(status)}`;

    if (typeof supabaseFetch === "function") {
      const res = supabaseFetch("peminjaman", "get", null, queryParams, true);
      if (res && res.success && Array.isArray(res.data)) {
        let list = res.data;
        if (keyword) {
          list = list.filter(item => {
            const combined = `${item.no_peminjaman} ${item.pic} ${item.sku} ${item.nama_produk}`.toLowerCase();
            return combined.includes(keyword);
          });
        }
        return { success: true, data: list, count: list.length, source: "supabase" };
      }
    }
  } catch (e) {
    Logger.log("getPeminjamanList error: " + e.message);
  }

  return { success: true, data: [], count: 0 };
}

/************************************************
 * SUBMIT SCANNER IN / OUT KAMERA HP (ADMIN ONLY)
 * type: "OUT" (Barang Keluar / Pinjam) | "IN" (Barang Masuk / Kembali)
 ************************************************/
function submitScanPeminjaman(data) {
  const session = getWmsSessionFromToken(data && data.token);
  if (!session) {
    return { success: false, message: "Sesi login tidak valid / kadaluarsa. Silakan login ulang." };
  }
  if (!wmsBisaAksesAdmin(session.akses)) {
    return { success: false, message: "Akses scanner IN/OUT hanya diizinkan untuk akun Administrator." };
  }

  if (!data || !data.items || data.items.length === 0) {
    return { success: false, message: "Daftar item hasil scan kosong." };
  }

  const scanType = (data.type || "OUT").toUpperCase(); // "OUT" atau "IN"
  const pic = String(data.pic || session.username).trim();
  const catatan = String(data.catatan || (scanType === "OUT" ? "Peminjaman" : "Pengembalian")).trim();
  const lokasiAsal = String(data.lokasi || "STUDIO").trim();

  const itemsValid = data.items.filter(function (it) {
    return it && (it.sku || it.nama) && Number(it.qty) > 0;
  });

  if (itemsValid.length === 0) {
    return { success: false, message: "Tidak ada item scan dengan SKU & Qty yang valid." };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shPeminjaman = ss.getSheetByName(SHEET_PEMINJAMAN);
  const shLog = ss.getSheetByName(SHEET_NAME_LOG_PRODUCT);

  if (!shLog) {
    return { success: false, message: "Sheet '" + SHEET_NAME_LOG_PRODUCT + "' tidak ditemukan." };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const timestamp = new Date();
    const tanggalStr = Utilities.formatDate(timestamp, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    const noRef = getPeminjamanID();
    const invoice = getInvoice();
    const operatorStr = (session.nama || session.username) + " | " + pic;
    const typeToUse = (scanType === "OUT") ? TYPE_OUT : TYPE_IN;
    const deskripsiToUse = `Scan ${scanType} (${noRef}): ${pic} - ${catatan}`;

    // 1. TULIS KE LOG PRODUCT (MUTASI RESMI SEPERTI SCAN WA)
    const logRows = [];
    itemsValid.forEach(function (it) {
      const qtyCount = Number(it.qty) || 1;
      const skuVal = String(it.sku || "").trim().toUpperCase();
      const lokVal = it.lokasi || lokasiAsal;
      const areaVal = getArea(lokVal);

      for (let q = 0; q < qtyCount; q++) {
        logRows.push([
          tanggalStr,
          skuVal,
          lokVal,
          invoice,
          operatorStr,
          typeToUse,
          deskripsiToUse,
          areaVal
        ]);
      }
    });

    if (logRows.length > 0) {
      const startRowLog = findNextRow(shLog);
      shLog.getRange(startRowLog, 1, logRows.length, 8).setValues(logRows);

      // Rebuild Stock Instan
      try {
        rebuildStock();
      } catch (eReb) {
        Logger.log("rebuildStock error in submitScanPeminjaman: " + eReb.message);
      }

      // Sync Supabase Batch
      try {
        if (typeof catatLogDanUpdateStokSupabaseBatch === "function") {
          const batchPayload = logRows.map(function (r) {
            return {
              type: r[5],
              invoice: invoice,
              sku: r[1],
              nama: r[1],
              size: "-",
              area: r[7],
              lokasi: r[2],
              qty: 1,
              operator: r[4],
              keterangan: r[6]
            };
          });
          catatLogDanUpdateStokSupabaseBatch(batchPayload);
        }
      } catch (eSup) {
        Logger.log("Supabase batch sync error in submitScanPeminjaman: " + eSup.message);
      }
    }

    // 2. ARSIPKAN KE SHEET PEMINJAMAN (SPS)
    if (shPeminjaman) {
      const startRowPjm = findNextRow(shPeminjaman);
      let noUrut = getNextNoPeminjaman(shPeminjaman, startRowPjm);
      const statusLabel = (scanType === "OUT") ? "Dipinjam" : "Dikembalikan";

      const pjmRows = itemsValid.map(function (it) {
        return [
          noUrut++,
          timestamp,
          pic,
          catatan,
          tanggalStr,
          "",
          String(it.nama || it.produk || it.sku).trim(),
          String(it.sku || "").trim().toUpperCase(),
          String(it.size || "-").trim(),
          Number(it.qty) || 1,
          noRef,
          statusLabel,
          session.username,
          it.lokasi || lokasiAsal
        ];
      });

      shPeminjaman.getRange(startRowPjm, 1, pjmRows.length, 14).setValues(pjmRows);
    }

    return {
      success: true,
      noRef: noRef,
      invoice: invoice,
      type: scanType,
      totalPcs: logRows.length,
      totalSku: itemsValid.length,
      message: `Berhasil! SCAN ${scanType} (${logRows.length} Pcs) telah masuk ke Log Product [${invoice}] & Peminjaman [${noRef}], serta stok gudang langsung terupdate.`
    };

  } catch (err) {
    return { success: false, message: "Terjadi error saat simpan scan: " + err.message };
  } finally {
    lock.releaseLock();
  }
}