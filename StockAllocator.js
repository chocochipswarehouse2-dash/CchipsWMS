/************************************************
 * FILE STOCKALLOCATOR.GS
 * Dipakai bareng oleh RefillWA.gs (kirim WA)
 * dan RefillPDF.gs (print PDF).
 *
 * Fungsi: dari SKU + Qty yang diminta (lintas
 * banyak SJ sekaligus dalam 1x proses), alokasikan
 * ke lokasi-lokasi Warehouse yang punya stok SKU tsb.
 *
 * ATURAN PRIORITAS ALOKASI (stok mana yang diambil):
 * 1. Antar SJ yang rebutan SKU sama: qty request
 *    PALING KECIL diproses/dialokasikan DULUAN
 *    (supaya request kecil lebih mungkin terpenuhi
 *    penuh, request besar yang menanggung kekurangan
 *    kalau stok tidak cukup).
 * 2. Dalam 1 SKU, kalau ada beberapa lokasi Warehouse:
 *    lokasi dengan stok TERKECIL diambil duluan,
 *    tie-break pakai prioritas lokasi (getAreaPriority/
 *    getLokasiPriority).
 * 3. HANYA lokasi area "Warehouse" yang dipakai
 *    (rak A/B/C/dst + KOLI) — Blok F & Perbaikan
 *    tidak ikut jadi sumber alokasi refill.
 *
 * ATURAN URUTAN TAMPIL (buat picking / cetak SJ / WA):
 * Beda dari urutan alokasi di atas -- urutan TAMPIL
 * akhir (hasil groups[key].items) diurutkan ulang biar
 * enak dipakai jalan ambil barang (picking route):
 *   1. Area: Warehouse dulu, baru Blok F, baru Perbaikan
 *      (reuse getAreaPriority dari RebuildStock.gs)
 *   2. Dalam Warehouse: rak biasa A-Z dulu, KOLI/KOLIAN
 *      ditaruh PALING BELAKANG (reuse getLokasiPriority
 *      dari RebuildStock.gs, biar konsisten sama urutan
 *      di sheet STOCK)
 *   3. Alfabetis nama lokasi (tie-break)
 *   4. Alfabetis nama produk (tie-break terakhir, biar
 *      urutan stabil/predictable)
 *
 * TIDAK mengubah data apapun di sheet manapun —
 * murni kalkulasi sementara saat generate WA/PDF.
 ************************************************/

/**
 * Baca sheet STOCK, kelompokkan per SKU.
 * HANYA area "Warehouse" yang diambil.
 * Return: { [SKU]: [ {lokasi, area, qty}, ... ] }
 */
function loadStockMap() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("STOCK");
  if (!sheet) return {};

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  // Kolom A-D = Lokasi, Area, SKU, Qty
  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

  const map = {};

  values.forEach(function (row) {
    const lokasi = String(row[0] || "").trim();
    const area = String(row[1] || "").trim();
    const sku = String(row[2] || "").trim().toUpperCase();
    const qty = Number(row[3]) || 0;

    if (!sku || !lokasi || qty <= 0) return;

    // Refill toko HANYA boleh ambil stok dari area Warehouse
    // (rak A/B/C/dst + KOLI) — bukan Blok F atau Perbaikan.
    if (area.toUpperCase() !== "WAREHOUSE") return;

    if (!map[sku]) map[sku] = [];

    map[sku].push({ lokasi: lokasi, area: area, qty: qty });
  });

  return map;
}

/**
 * Alokasikan qtyDiminta untuk 1 SKU ke lokasi-lokasi yang tersedia.
 * PENTING: fungsi ini MEMOTONG (mutate) qty di dalam stockMap
 * secara langsung — supaya pemanggilan berikutnya (SKU sama,
 * request/SJ lain) melihat sisa stok yang sudah berkurang.
 *
 * Return: [ {lokasi, qty}, ... ]
 */
function allocateLokasiForSku(sku, qtyDiminta, stockMap) {
  sku = String(sku || "").trim().toUpperCase();
  qtyDiminta = Number(qtyDiminta) || 0;

  const daftar = stockMap[sku] || [];

  daftar.sort(function (a, b) {
    if (a.qty !== b.qty) return a.qty - b.qty; // stok terkecil dulu

    const pa = getAreaPriority(a.area);
    const pb = getAreaPriority(b.area);
    if (pa !== pb) return pa - pb;

    const la = getLokasiPriority(a.lokasi);
    const lb = getLokasiPriority(b.lokasi);
    if (la !== lb) return la - lb;

    return a.lokasi.localeCompare(b.lokasi);
  });

  let sisa = qtyDiminta;
  const hasil = [];

  for (let i = 0; i < daftar.length && sisa > 0; i++) {
    if (daftar[i].qty <= 0) continue;

    const ambil = Math.min(daftar[i].qty, sisa);
    if (ambil <= 0) continue;

    hasil.push({ lokasi: daftar[i].lokasi, qty: ambil });

    daftar[i].qty -= ambil; // MUTASI: stok berkurang untuk request berikutnya
    sisa -= ambil;
  }

  if (sisa > 0) {
    hasil.push({ lokasi: "KOSONG", qty: sisa });
  }

  if (hasil.length === 0) {
    hasil.push({ lokasi: "KOSONG", qty: qtyDiminta });
  }

  return hasil;
}

/**
 * ENTRY POINT UTAMA — panggil ini SEKALI per proses
 * (1x klik tombol kirim WA / 1x klik print PDF),
 * bukan per grup/SJ.
 *
 * `groups` = object hasil grouping SJ yang sudah ada
 * di RefillWA.gs / RefillPDF.gs, formatnya:
 *   { [key]: { ..., items: [ {nama, sku, qty, ...}, ... ] } }
 *
 * Fungsi ini MENGUBAH groups[key].items secara langsung
 * (in-place) jadi versi yang sudah dipecah per lokasi,
 * dan URUTAN TAMPILNYA sudah diurutkan buat picking
 * (Area Warehouse dulu -> rak A-Z -> KOLI/KOLIAN paling
 * belakang), lihat komentar aturan di atas file.
 */
function allocateAcrossGroups(groups) {
  const stockMap = loadStockMap();

  // Kumpulkan semua item dari SEMUA grup/SJ jadi 1 daftar
  const semuaItem = [];
  for (let key in groups) {
    groups[key].items.forEach(function (item) {
      semuaItem.push({ groupKey: key, item: item });
    });
  }

  // Prioritas alokasi GLOBAL lintas SJ: qty PALING KECIL duluan
  const urutanAlokasi = semuaItem.slice().sort(function (a, b) {
    return Number(a.item.qty) - Number(b.item.qty);
  });

  // Proses alokasi sesuai urutan prioritas itu,
  // simpan hasilnya per-item (pakai objek item asli sebagai kunci)
  const hasilAlokasiMap = new Map();
  urutanAlokasi.forEach(function (entry) {
    const alokasi = allocateLokasiForSku(entry.item.sku, entry.item.qty, stockMap);
    hasilAlokasiMap.set(entry.item, alokasi);
  });

  // Susun ulang items tiap grup:
  // Gabungkan multi-lokasi jadi 1 baris per SKU dengan pemisah " | "
  // dan urutkan berdasarkan Nama Produk (A - Z)
  for (let key in groups) {
    const itemMap = new Map();

    groups[key].items.forEach(function (item) {
      const alokasi = hasilAlokasiMap.get(item) || [];

      // Kumpulkan lokasi unik dari alokasi
      const lokasiList = [];
      let totalAllocatedQty = 0;

      alokasi.forEach(function (a) {
        totalAllocatedQty += (Number(a.qty) || 0);
        const lok = String(a.lokasi || "").trim();
        if (lok && !lokasiList.includes(lok)) {
          lokasiList.push(lok);
        }
      });

      const gabunganLokasi = lokasiList.length > 0 ? lokasiList.join(" | ") : "-";

      // Jika dalam 1 SJ ada baris SKU yang sama, gabungkan jadi 1 baris
      const skuKey = String(item.sku || "").trim().toUpperCase();
      if (itemMap.has(skuKey)) {
        const existing = itemMap.get(skuKey);
        existing.qty = (Number(existing.qty) || 0) + (Number(item.qty) || 0);
        
        // Gabungkan lokasi unik
        const curLokasi = existing.lokasi ? existing.lokasi.split(" | ").map(function(s) { return s.trim(); }) : [];
        lokasiList.forEach(function(l) {
          if (l && !curLokasi.includes(l)) curLokasi.push(l);
        });
        existing.lokasi = curLokasi.length > 0 ? curLokasi.join(" | ") : "-";
      } else {
        const clone = Object.assign({}, item);
        clone.qty = Number(item.qty) || totalAllocatedQty || 1;
        clone.lokasi = gabunganLokasi;
        itemMap.set(skuKey, clone);
      }
    });

    const itemsBaru = Array.from(itemMap.values());

    /************************************************
     * URUTKAN BERDASARKAN NAMA PRODUK (A - Z)
     ************************************************/
    itemsBaru.sort(function (a, b) {
      const namaA = String(a.nama || "").toLowerCase();
      const namaB = String(b.nama || "").toLowerCase();
      if (namaA !== namaB) return namaA.localeCompare(namaB);
      return String(a.sku || "").localeCompare(String(b.sku || ""));
    });

    groups[key].items = itemsBaru;
  }
}