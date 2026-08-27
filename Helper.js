/************************************************
 FILE HELPER.GS
 * FIND NEXT ROW (NO LOMPAT)
 ************************************************/
function findNextRow(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 2;

  // Baca Kolom B (SKU / Barcode) untuk mendeteksi baris data riil tanpa terpengaruh ArrayFormula Kolom I & J
  const dataB = sheet.getRange(1, 2, lastRow, 1).getValues();
  for (let i = dataB.length - 1; i >= 0; i--) {
    if (String(dataB[i][0] || "").trim() !== "") {
      return i + 2; // i adalah 0-indexed, +1 = baris data riil terakhir, +1 lagi = baris kosong berikutnya
    }
  }

  return 2;
}

/************************************************
 * ERROR LOGGER
 ************************************************/
function logError(sheet, msg, user) {
  const row = findNextRow(sheet);
  const nowStr = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");

  sheet.getRange(row, 1, 1, 10).setValues([[
    nowStr,
    "ERROR",
    "",
    "",
    "",
    nowStr,
    msg,
    user,
    "",
    ""
  ]]);
}

/************************************************
 * GENERATE INVOICE
 ************************************************/
function getInvoice() {

  const props = PropertiesService.getScriptProperties();

  let n = Number(props.getProperty("INV") || 0);

  n++;

  props.setProperty("INV", n);

  return PREFIX_INVOICE + String(n).padStart(6, "0");

}

/************************************************
 * GENERATE CCTV ID
 ************************************************/
function getCCTVID() {

  const props = PropertiesService.getScriptProperties();

  let no = Number(props.getProperty("CCTV_ID") || 0);

  no++;

  props.setProperty("CCTV_ID", no);

  return PREFIX_CCTV + String(no).padStart(6, "0");

}

/************************************************
 * GENERATE QC ID
 ************************************************/
function getQCID() {

  const props = PropertiesService.getScriptProperties();

  let no = Number(props.getProperty("QC_ID") || 0);

  no++;

  props.setProperty("QC_ID", no);

  return PREFIX_QC + String(no).padStart(6, "0");

}

/************************************************
 * DUPLICATE WEBHOOK PROTECTION (ROBUST MULTI-GATEWAY)
 ************************************************/
const MAX_WEBHOOK_HISTORY = 500;

function getWebhookDedupKey(json) {
  if (!json) return "";

  // 1. Ekstraksi ID dari berbagai provider WhatsApp Gateway (Fonnte, Wablas, Starsender, WAHA, Baileys, Whacenter, dll)
  let rawId = json.inboxid || json.id || json.message_id || json.msgId || json.messageId;
  if (!rawId && json.key && json.key.id) rawId = json.key.id;

  if (rawId) {
    return "ID_" + String(rawId).trim();
  }

  // 2. Jika gateway tidak menyertakan ID, buat Fingerprint dari Sender + Isi Pesan + Window Waktu 60 Detik
  const sender = String(json.sender || json.pengirim || json.from || json.phone || "").trim();
  const message = String(json.message || json.pesan || json.text || "").trim();
  if (!message) return "";

  // Normalisasi pesan (abaikan spasi ganda)
  const cleanMsg = message.replace(/\s+/g, " ").trim().toUpperCase();
  // Window waktu 60 detik (cegah double post jika gateway retry dalam kurun 1 menit)
  const timeWindow = Math.floor(Date.now() / 60000);

  const rawFingerprint = sender + "|" + cleanMsg + "|" + timeWindow;
  return "FP_" + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, rawFingerprint)).replace(/[^a-zA-Z0-9_]/g, "");
}

function isDuplicateWebhook(key) {
  if (!key) return false;

  try {
    // 1. Cek Fast Cache (RAM Cache 0ms)
    const cache = CacheService.getScriptCache();
    if (cache && cache.get("WH_DEDUP_" + key)) {
      return true;
    }

    // 2. Cek Persistent ScriptProperties
    const props = PropertiesService.getScriptProperties();
    const json = props.getProperty("WEBHOOK_HISTORY");
    if (!json) return false;

    const history = JSON.parse(json);
    return history.indexOf(String(key)) > -1;

  } catch (e) {
    Logger.log("isDuplicateWebhook error: " + e.message);
    return false;
  }
}

function saveWebhookHistory(key) {
  if (!key) return;

  try {
    // 1. Simpan ke Fast Cache (10 menit TTL)
    const cache = CacheService.getScriptCache();
    if (cache) {
      cache.put("WH_DEDUP_" + key, "1", 600);
    }

    // 2. Simpan ke Persistent ScriptProperties
    const props = PropertiesService.getScriptProperties();
    let history = [];
    try {
      history = JSON.parse(props.getProperty("WEBHOOK_HISTORY") || "[]");
    } catch (e) {
      history = [];
    }

    if (history.indexOf(String(key)) === -1) {
      history.push(String(key));
      if (history.length > MAX_WEBHOOK_HISTORY) {
        history = history.slice(-MAX_WEBHOOK_HISTORY);
      }
      props.setProperty("WEBHOOK_HISTORY", JSON.stringify(history));
    }

  } catch (e) {
    Logger.log("saveWebhookHistory error: " + e.message);
  }
}

/************************************************
 * NORMALISASI LOKASI
 * Menyeragamkan penulisan lokasi yang typo/variasi,
 * khususnya KOLI (contoh: "KOLIAN", "KOLI1", dll -> "KOLI").
 *
 * Kalau nanti ketemu typo lain yang perlu diseragamkan
 * (bukan varian KOLI), tinggal tambah aturan baru di sini.
 ************************************************/
function normalizeLokasi(lokasi) {
  lokasi = String(lokasi || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  // Semua yang diawali "KOLI" -> KOLI
  if (/^KOLI/.test(lokasi)) return "KOLI";

  // Semua yang diawali "CUCI" -> CUCI
  if (/^CUCI/.test(lokasi)) return "CUCI";

  // Semua yang diawali "DEFECT" / "DEFEK" -> DEFECT
  if (/^DEFEC?T/.test(lokasi) || /^DEFEK/.test(lokasi)) return "DEFECT";

  // Semua yang diawali "PERMAK" -> PERMAK
  if (/^PERMAK/.test(lokasi)) return "PERMAK";

  // Semua yang diawali "TIKTOK" atau "TT" -> TIKTOK
  if (/^TIKTOK/.test(lokasi) || lokasi === "TT") return "TIKTOK";

  // Semua yang diawali "SHOPEE" / "SHOPE" -> SHOPEE
  if (/^SHOPE/.test(lokasi)) return "SHOPEE";

  // Semua yang diawali "STUDIO" -> STUDIO
  if (/^STUDIO/.test(lokasi)) return "STUDIO";

  // --- NORMALISASI TYPO ANGKA LOKASI ---
  lokasi = lokasi.replace(/\s+/g, "");
  let match = lokasi.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    let huruf = match[1];
    let angka = match[2];
    if (angka.length === 2) {
      lokasi = huruf + "0" + angka;
    } else if (angka.length === 1) {
      lokasi = huruf + "00" + angka;
    }
  }

  return lokasi;
}

/************************************************
 * GET AREA
 ************************************************/
function getArea(lokasi) {

  lokasi = normalizeLokasi(lokasi);

  /************************************************
   * WAREHOUSE - KOLI (sudah dinormalisasi di atas)
   ************************************************/
  if (lokasi === "KOLI") {
    return "Warehouse";
  }

  /************************************************
   * WAREHOUSE - RAK
   * Contoh :
   * A011
   * B75
   * C32
   * D16
   * E45
   ************************************************/
  if (/^[A-Z][0-9]{2,3}$/.test(lokasi)) {
    return "Warehouse";
  }

  /************************************************
   * BLOK F
   ************************************************/
  if (AREA_BLOK_F.includes(lokasi)) {
    return "Blok F";
  }

  /************************************************
   * PERBAIKAN
   * Memeriksa kata kunci tetap (PERMAK, CUCI, DEFECT)
   * ATAU pola dinamis PMK + 4 digit angka (misal: PMK0001, PMK0123)
   ************************************************/
  if (AREA_PERBAIKAN.includes(lokasi) || /^PMK\d{3}$/.test(lokasi)) {
    return "Perbaikan";
  }
   if (AREA_PERBAIKAN.includes(lokasi) || /^DF\d{3}$/.test(lokasi)) {
    return "Perbaikan";
  }
   if (AREA_PERBAIKAN.includes(lokasi) || /^CC\d{3}$/.test(lokasi)) {
    return "Perbaikan";
  }
  if (AREA_AKSESORIS.includes(lokasi) || /^BELT\d{3}$/.test(lokasi)) {
    return "Aksesoris";
  }

  /************************************************
   * AREA TIDAK DIKENAL
   ************************************************/
  return "";

}

/************************************************
 * HELPER TEMPLATE INCLUDE (Untuk modular HTML)
 ************************************************/
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/************************************************
 * CARI META PRODUK (NAMA & SIZE) BY SKU
 * Cepat via Cache (<1ms) -> TextFinder Sheet Data (<15ms)
 ************************************************/
function cariMetaProdukBySku(sku) {
  sku = String(sku || "").trim().toUpperCase();
  if (!sku) return { nama: "", size: "-" };

  // 1. Cek Script Cache (0ms)
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get("SKU_META_" + sku);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  // 2. Cek Sheet Data via TextFinder (<15ms)
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const shData = (typeof getSheetByNameCI_WMS === "function") 
      ? getSheetByNameCI_WMS(ss, "Data") 
      : ss.getSheetByName("Data");

    if (shData) {
      // Cari di Kolom E (Code / SKU)
      const finder = shData.getRange("E:E").createTextFinder(sku).matchEntireCell(true);
      const foundCell = finder.findNext();
      if (foundCell) {
        const row = foundCell.getRow();
        const rowVals = shData.getRange(row, 2, 1, 3).getValues()[0]; // Kolom B, C, D
        const nama = String(rowVals[0] || "").trim() || sku;
        const size = String(rowVals[2] || "").trim() || "-";
        const meta = { nama: nama, size: size };

        try {
          const cache = CacheService.getScriptCache();
          cache.put("SKU_META_" + sku, JSON.stringify(meta), 21600); // 6 jam
        } catch (eCache) {}

        return meta;
      }
    }
  } catch (err) {
    Logger.log("Gagal cariMetaProdukBySku: " + err.message);
  }

  return { nama: sku, size: "-" };
}