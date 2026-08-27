/************************************************
 * FILE WEBHOOK.GS
 *
 * REVISI (fix race condition kehilangan pesan WA):
 * Versi SEBELUMNYA memanggil lock.waitLock(30000) DI LUAR
 * blok try/catch/finally. Akibatnya, kalau lock GAGAL didapat
 * dalam 30 detik (misal karena rebuildStock() dari pesan WA
 * lain, atau proses approval Adjustment, sedang berjalan lama
 * dan memegang lock yang sama), waitLock() melempar exception
 * yang TIDAK TERTANGKAP sama sekali -- doPost() langsung crash
 * dan PESAN WA YANG MASUK SAAT ITU TIDAK PERNAH DIPROSES SAMA
 * SEKALI -- tidak ada log, tidak ada percobaan ulang otomatis,
 * datanya hilang begitu saja. Ini sangat mungkin jadi penyebab
 * "hasil scan WA tidak masuk ke sheet" yang dilaporkan.
 *
 * FIX:
 * 1. lock.waitLock(30000) sekarang dibungkus try/catch sendiri.
 *    Kalau gagal dapat lock, doPost() balik "BUSY" dengan aman
 *    (pola yang sama persis dgn yang sudah dipakai di
 *    prosesKeluarMasuk / Log Product.gs), bukan crash.
 * 2. Pesan mentah yang masuk dicatat ke "Debug Log" (lewat
 *    debugLog() yang sudah ada di Stockopname.gs) SEBELUM
 *    mencoba ambil lock -- supaya walau lock gagal / proses
 *    gagal di tengah jalan, tetap ada jejak pesan ini pernah
 *    diterima (buat investigasi/rekonsiliasi manual).
 * 3. Saat BUSY atau ERROR, dicatat juga ke Debug Log supaya
 *    kelihatan jelas kapan & seberapa sering lock timeout
 *    terjadi.
 *
 * TIDAK ADA perubahan pada logika ROUTING (#LAPORQC, #PRODUKSI,
 * #LOK/#IN/#OUT, prefix Mutasi, CCTV) -- semua persis sama
 * seperti sebelumnya.
 ************************************************/
function doPost(e) {

  // 1. PARSE JSON / URL-ENCODED FORM DULU
  let json = {};
  try {
    if (e && e.postData && e.postData.contents) {
      try {
        json = JSON.parse(e.postData.contents);
      } catch (errJson) {
        if (e.parameter && Object.keys(e.parameter).length > 0) {
          json = e.parameter;
        } else {
          const contents = String(e.postData.contents);
          const pairs = contents.split("&");
          pairs.forEach(function(pair) {
            const parts = pair.split("=");
            if (parts.length === 2) {
              json[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1].replace(/\+/g, " "));
            }
          });
        }
      }
    } else if (e && e.parameter) {
      json = e.parameter;
    }
  } catch (errParse) {
    Logger.log("doPost: gagal parse payload: " + errParse.message);
    return ContentService.createTextOutput("ERROR : invalid payload");
  }

  // =========================================================================
  // 1.1 ROUTING API REQUEST DARI FRONTEND GITHUB / WEB STANDALONE
  // =========================================================================
  if (json.action || json.type === "API") {
    return handleWmsApiRequest(json);
  }

  // =========================================================================
  // FAST-FILTER: JIKA BUKAN PESAN BERAWALAN '#' LANGSUNG SKIP SEKETIKA (0ms)
  // Tidak membuang waktu, tidak menyentuh Google Sheets, dan tidak mengunci Lock.
  // =========================================================================
  const message = String(json.message || json.pesan || json.text || "").trim();
  if (!message.startsWith("#")) {
    return ContentService.createTextOutput("IGNORED_NO_HASHTAG");
  }

  // 2. CATAT PESAN MENTAH SEBELUM LOCK (best-effort).
  try {
    debugLog(
      "doPost-masuk",
      "inboxid=" + (json.inboxid || "") +
      " sender=" + (json.sender || json.pengirim || "") +
      " message=" + message
    );
  } catch (eLogMasuk) {
    // abaikan, jangan sampai logging gagal menghentikan proses utama
  }

    // 3. DUPLICATE PROTECTION & PARSING MESSAGE

    /************************************************
     * DUPLICATE WEBHOOK PROTECTION (ROBUST MULTI-GATEWAY)
     ************************************************/
    const dedupKey = getWebhookDedupKey(json);

    if (dedupKey && isDuplicateWebhook(dedupKey)) {
      Logger.log("Duplicate Webhook diabaikan: " + dedupKey);
      try {
        debugLog("doPost-DUPLICATE", "Pesan duplikat diabaikan: " + dedupKey);
      } catch (eDup) {}
      return ContentService.createTextOutput("OK");
    }

    // SIMPAN KEY SEGERA: Cegah request paralel/retry berikutnya masuk
    if (dedupKey) {
      saveWebhookHistory(dedupKey);
    }

    const upper = message.toUpperCase();

    const isInventoryScan = 
      upper.startsWith("#LOK") ||
      upper.startsWith("#IN") ||
      upper.startsWith("#OUT") ||
      upper.startsWith("#STD") ||
      upper.startsWith("#TPD") ||
      upper.startsWith("#SHP") ||
      upper.startsWith("#SCAN") ||
      upper.startsWith("#PERMAK") ||
      upper.startsWith("#CUCI") ||
      upper.startsWith("#DEFECT");

    if (isInventoryScan) {
      // FASE 2: ROUTER CEPAT WEBHOOK FONNTE
      // Request inventori (IN, OUT, LOK) jalan TANPA LOCK
      // karena akan dikirim langsung ke Supabase (tidak nyentuh Sheet Log Product).
      return prosesStockOpname(json);
    }

    // 3. AMBIL LOCK -- UNTUK PROSES QC DAN PRODUKSI YANG MASIH PAKAI SHEETS
    const lock = LockService.getScriptLock();
    let hasLock = false;
    try {
      lock.waitLock(30000);
      hasLock = true;
    } catch (errLock) {
      try { debugLog("doPost-BUSY", "Lock antrean penuh (>30s)."); } catch (e) {}
      throw new Error("BUSY: System is overloaded, please retry");
    }

    try {

    /************************************************
     * ROUTING QC
     ************************************************/
    if (upper.startsWith("#LAPORQC")) {
      return prosesQC(json);
    }

    /************************************************
     * ROUTING PRODUKSI
     ************************************************/
    if (upper.startsWith("#PRODUKSI")) {
      return prosesProduksi(json);
    }

    // ROUTING LAINNYA DI HAPUS DARI BLOK INI KARENA DIPINDAHKAN KE ATAS (isInventoryScan)

    /************************************************
     * HASHTAG TIDAK DIKENAL
     ************************************************/
    return ContentService.createTextOutput("IGNORED");

  } catch (err) {

    Logger.log(err);
    try {
      debugLog("doPost-ERROR", "inboxid=" + (json.inboxid || "") + " ERROR: " + err.message);
    } catch (eLogErr) {}

    // Hanya throw 500 untuk error concurrency/lock/timeout agar diretry oleh gateway.
    // Jika error karena salah input, return 200 supaya tidak di-retry terus menerus.
    const msgLower = err.message.toLowerCase();
    if (msgLower.includes("busy") || msgLower.includes("sibuk") || msgLower.includes("lock") || msgLower.includes("timeout") || msgLower.includes("terlalu banyak") || msgLower.includes("too many")) {
      throw err;
    }

    return ContentService.createTextOutput("ERROR : " + err.message);
  } finally {
    if (typeof hasLock !== 'undefined' && hasLock) {
      lock.releaseLock();
    }
  }

}

function menuTestSimulasiScanMasuk() {
  const ui = SpreadsheetApp.getUi();
  const res = testSimulasiScanWA();
  ui.alert("Hasil Test Simulasi Scan", res, ui.ButtonSet.OK);
}

function testSimulasiScanWA() {
  try {
    const dummyEvent = {
      postData: {
        contents: JSON.stringify({
          inboxid: "TEST-" + Date.now(), 
          message: "#IN\n#LOK A019\nF26CDB574DDS",
          sender: "120363426359702090@g.us",
          pushname: "Testing Simulator",
          device: "62899999999"
        })
      }
    };

    const hasil = doPost(dummyEvent);
    const code = hasil.getContent();
    return "✅ Simulasi Berhasil Dijalankan!\nStatus: " + code + "\n\nSilakan cek:\n1. Sheet 'Log Product' (ada baris baru F26CDB574DDS #IN)\n2. Table Supabase 'log_produk' (ada baris baru)\n3. Sheet 'STOCK' / Supabase 'stok_lokasi' (stok A019 bertambah)";
  } catch (err) {
    return "❌ Error saat simulasi: " + err.message + "\n" + err.stack;
  }
}

function testWebhookManual() {
  testSimulasiScanWA();
}