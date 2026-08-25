/************************************************
 FILE REBUILDSTOCK.GS
 ************************************************/
 /************************************************
 * MODUL 1: CONTROLLER
 *
 * ⚠️ FUNGSI rebuildStock() DI BAWAH INI SENGAJA TIDAK
 * MELAKUKAN LockService SENDIRI. Locking jadi tanggung
 * jawab PEMANGGIL, karena fungsi ini dipanggil dari
 * BANYAK jalur yang sebagian SUDAH pegang lock duluan:
 *   - Webhook WA (doPost di Webhook.gs) -- sudah pegang
 *     lock global sepanjang seluruh proses webhook.
 *   - submitSesiOpname (StockOpnameAdjustment.gs, jalur
 *     web) -- sudah pegang lock sendiri.
 *   - prosesApprovalAdjustment (StockOpnameAdjustment.gs)
 *     -- sudah pegang lock sendiri.
 * Kalau lock ditambah LAGI di dalam rebuildStock(), 3
 * jalur di atas jadi NESTED-LOCK (execution yang sama coba
 * mengunci resource yang sudah dia pegang sendiri) --
 * berisiko bikin proses² itu selalu gagal timeout.
 *
 * UNTUK JALUR LAIN yang BELUM PASTI pegang lock (tombol
 * menu manual di spreadsheet, time-driven trigger, atau
 * jalur lain di luar 3 yang disebut di atas) -- JANGAN
 * panggil rebuildStock() langsung. Panggil rebuildStockAman()
 * di bawah, yang pegang lock sendiri dengan aman.
 ************************************************/
function rebuildStock() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shLog = ss.getSheetByName(SHEET_NAME_LOG_PRODUCT);
  const shStock = ss.getSheetByName("STOCK");

  if (!shLog || !shStock) throw new Error("Sheet tidak ditemukan.");

  const lastRow = shLog.getLastRow();
  if (lastRow < 2) return;

  // A-K = 11 kolom (K = Qty, dipakai khusus utk baris ADJ_IN/ADJ_OUT)
  const dataLog = shLog.getRange(1, 1, lastRow, 11).getValues();
  const hasil = calculateStock(dataLog);

  writeStock(shStock, hasil);
}

/************************************************
 * [BARU] VERSI AMAN -- PAKAI INI DARI JALUR YANG BELUM
 * PASTI SUDAH PEGANG LOCK.
 *
 * Wajib dipakai (ganti rebuildStock() jadi rebuildStockAman())
 * di:
 *   - Fungsi yang dipanggil tombol/menu "Rebuild Stock"
 *     manual di spreadsheet.
 *   - Fungsi time-driven trigger (kalau memang ada jadwal
 *     otomatis yang manggil rebuildStock()).
 *   - Jalur lain mana pun yang TIDAK berada di dalam blok
 *     lock yang sudah ada (WA/submitSesiOpname/approval).
 *
 * JANGAN pakai dari 3 jalur yang sudah disebut di atas --
 * itu tetap harus manggil rebuildStock() POLOS (tanpa lock),
 * karena mereka sudah pegang lock sendiri di level atas.
 * Manggil rebuildStockAman() dari situ = nested-lock lagi.
 *
 * Kalau dipanggil pas lock lagi dipegang proses lain (WA/
 * submit opname/approval yang sedang berjalan), fungsi ini
 * akan NUNGGU maks 30 detik lalu throw Error dgn pesan yang
 * jelas -- bukan diam-diam gagal atau nabrak data.
 ************************************************/
function rebuildStockAman() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (errLock) {
    throw new Error("Sistem sedang sibuk memproses transaksi lain (SO/IN/OUT/Adjustment). Coba lagi dalam beberapa detik.");
  }

  try {
    rebuildStock();
  } finally {
    lock.releaseLock();
  }
}

/************************************************
 * MODUL 2: CALCULATOR
 * - lokasi dinormalisasi (typo KOLI dsb -> KOLI)
 * - area DIHITUNG ULANG dari lokasi ternormalisasi
 *   (bukan sekadar percaya kolom H di Log Product),
 *   supaya data lama yang sempat typo ikut kebenerin
 *   otomatis begitu rebuildStock() dijalankan lagi.
 * - Type IN/OUT: 1 baris = 1 unit (scan/list per barang).
 * - Type ADJ_IN/ADJ_OUT (hasil approval Stock Opname/
 *   Adjustment): qty diambil dari kolom K (index 10),
 *   bukan 1 per baris -- karena adjustment diinput
 *   sebagai angka langsung (misal +5 / -3), bukan
 *   scan satu-satu.
 * - Type SO: murni catatan hasil hitung fisik mentah,
 *   TIDAK mengubah stok (yang mengubah stok adalah
 *   ADJ_IN/ADJ_OUT setelah selisihnya di-approve).
 ************************************************/
function calculateStock(dataLog) {
  const stockMap = new Map();

  for (let i = 1; i < dataLog.length; i++) {
    const row = dataLog[i];
    const sku = String(row[1] || "").trim().toUpperCase();
    const lokasi = normalizeLokasi(row[2]);
    const type = String(row[5] || "").trim().toUpperCase();
    const area = getArea(lokasi);

    if (!sku || !lokasi) continue;

    let qty = 0;
    if (type === TYPE_IN) {
      qty = 1;
    } else if (type === TYPE_OUT) {
      qty = -1;
    } else if (type === TYPE_ADJ_IN) {
      const qtyAdj = Math.abs(Number(row[10]) || 0) || 1;
      qty = qtyAdj;
    } else if (type === TYPE_ADJ_OUT) {
      const qtyAdj = Math.abs(Number(row[10]) || 0) || 1;
      qty = -qtyAdj;
    } else {
      continue; // TYPE_SO & tipe lain: catatan saja, tidak mengubah stok
    }

    if (qty === 0) continue;

    const key = lokasi + "|" + area.toUpperCase() + "|" + sku;
    const item = stockMap.get(key) || { lokasi, area, sku, qty: 0 };
    item.qty += qty;
    stockMap.set(key, item);
  }

  const hasil = [];
  for (let item of stockMap.values()) {
    if (item.qty !== 0) {
      hasil.push({
        data: [item.lokasi, item.area, item.sku, item.qty],
        pArea: getAreaPriority(item.area),
        pLokasi: getLokasiPriority(item.lokasi)
      });
    }
  }

  hasil.sort((a, b) => {
    if (a.pArea !== b.pArea) return a.pArea - b.pArea;
    if (a.pLokasi !== b.pLokasi) return a.pLokasi - b.pLokasi;
    const cmpLok = a.data[0].localeCompare(b.data[0]);
    if (cmpLok !== 0) return cmpLok;
    return a.data[2].localeCompare(b.data[2]);
  });

  return hasil.map(i => i.data);
}

/************************************************
 * MODUL 3: PRIORITAS SORTING
 ************************************************/
function getAreaPriority(area) {
  area = String(area).trim().toUpperCase();
  switch (area) {
    case "WAREHOUSE": return 1;
    case "BLOK F":    return 2;
    case "PERBAIKAN": return 3;
    default:          return 99;
  }
}

function getLokasiPriority(lokasi) {
  lokasi = String(lokasi).trim().toUpperCase();
  switch (lokasi) {

    // Blok F -> urutan: TikTok -> Studio -> Shopee -> Peminjaman
    case "TIKTOK":     return 1;
    case "STUDIO":     return 2;
    case "SHOPEE":     return 3;
    case "PEMINJAMAN": return 4;

    // Perbaikan -> urutan: Permak -> Cuci -> Defect
    case "PERMAK": return 1;
    case "CUCI":   return 2;
    case "DEFECT": return 3;

    // Warehouse -> KOLI harus SETELAH rak biasa (A001, B075, dst)
    case "KOLI": return 2;

    // Default = rak biasa dalam Warehouse -> prioritas tertinggi,
    // lalu diurutkan alfanumerik lewat localeCompare di calculateStock()
    default: return 1;

  }
}