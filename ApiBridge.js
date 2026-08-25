/************************************************
 * FILE APIBRIDGE.GS (WMS MINI API GATEWAY v781)
 * 
 * Gateway API untuk melayani request dari Frontend GitHub / Standalone Web Client
 * Format Request: POST/GET JSON { action: "namaAction", payload: {...}, token: "..." }
 * Format Response: JSON { success: true/false, data: ..., message: ... }
 ************************************************/

function handleWmsApiRequest(json) {
  try {
    const action = String(json.action || "").trim();
    const token = String(json.token || (json.payload && json.payload.token) || "").trim();
    const payload = json.payload || {};

    // 1. PUBLIC ACTIONS (Tanpa perlu validasi token sesi)
    if (action === "verifyLogin" || action === "login") {
      const username = String(payload.username || "").trim();
      const password = String(payload.password || "").trim();
      const res = verifyWmsLogin(username, password);
      return createJsonResponse(res);
    }

    if (action === "checkSession") {
      const session = getWmsSessionFromToken(token);
      if (!session) {
        return createJsonResponse({ success: false, message: "Sesi tidak valid atau telah berakhir." });
      }
      return createJsonResponse({ success: true, session: session });
    }

    // 2. AUTHENTICATED ACTIONS (Membutuhkan token valid)
    const session = getWmsSessionFromToken(token);
    if (!session) {
      return createJsonResponse({ success: false, message: "Akses ditolak: Sesi tidak valid / kedaluwarsa. Silakan login kembali." });
    }

    // DISPATCHING BERDASARKAN ACTION
    switch (action) {
      // --- AUTH & USER MANAGEMENT ---
      case "logout":
      case "logoutWmsSession":
        if (typeof logoutWmsSession === "function") logoutWmsSession(token);
        return createJsonResponse({ success: true, message: "Logout berhasil" });

      case "getUserList":
      case "getWmsUserList":
        if (typeof getWmsUserList === "function") {
          return createJsonResponse({ success: true, data: getWmsUserList(token) });
        }
        return createJsonResponse({ success: false, message: "Fungsi getUserList tidak tersedia" });

      case "saveUser":
      case "saveWmsUser":
        if (typeof saveWmsUser === "function") {
          return createJsonResponse(saveWmsUser(token, payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi saveUser tidak tersedia" });

      case "deleteUser":
      case "deleteWmsUser":
        if (typeof deleteWmsUser === "function") {
          const userToDelete = payload.username || payload;
          return createJsonResponse(deleteWmsUser(token, userToDelete));
        }
        return createJsonResponse({ success: false, message: "Fungsi deleteUser tidak tersedia" });

      // --- INVENTORY & DASHBOARD MASTER DATA ---
      case "getProdukCompact":
      case "getWmsProdukCompact":
        const force = Boolean(payload.force);
        if (typeof getWmsProdukCompact === "function") {
          return createJsonResponse(getWmsProdukCompact(token, force));
        }
        return createJsonResponse({ success: false, message: "Fungsi getProdukCompact tidak tersedia" });

      // --- PEMINJAMAN ---
      case "getPeminjamanInitData":
      case "getProdukListForPeminjaman":
        if (typeof getPeminjamanInitData === "function") {
          return createJsonResponse(getPeminjamanInitData());
        }
        return createJsonResponse({ success: false, message: "Fungsi getPeminjamanInitData tidak tersedia" });

      case "submitPeminjaman":
      case "submitFormPeminjaman":
        if (typeof submitPeminjaman === "function") {
          return createJsonResponse(submitPeminjaman(payload));
        } else if (typeof submitFormPeminjaman === "function") {
          return createJsonResponse(submitFormPeminjaman(payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi submitPeminjaman tidak tersedia" });

      case "submitScanPeminjaman":
        if (typeof submitScanPeminjaman === "function") {
          return createJsonResponse(submitScanPeminjaman(payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi submitScanPeminjaman tidak tersedia" });

      case "kembalikanPeminjaman":
        if (typeof kembalikanPeminjaman === "function") {
          return createJsonResponse(kembalikanPeminjaman(payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi kembalikanPeminjaman tidak tersedia" });

      // --- PENERIMAAN PRODUKSI ---
      case "getPenerimaanProduksiInit":
      case "getPenerimaanProduksiInitData":
        if (typeof getPenerimaanProduksiInitData === "function") {
          return createJsonResponse(getPenerimaanProduksiInitData());
        }
        return createJsonResponse({ success: true, message: "OK" });

      case "getPenerimaanProduksiList":
        if (typeof getPenerimaanProduksiList === "function") {
          return createJsonResponse(getPenerimaanProduksiList(token, payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi getPenerimaanProduksiList tidak tersedia" });

      case "submitPenerimaanProduksi":
      case "simpanPenerimaanProduksi":
        if (typeof simpanPenerimaanProduksi === "function") {
          return createJsonResponse(simpanPenerimaanProduksi(token, payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi simpanPenerimaanProduksi tidak tersedia" });

      case "updateBatchPenerimaanProduksi":
        if (typeof updateBatchPenerimaanProduksi === "function") {
          return createJsonResponse(updateBatchPenerimaanProduksi(token, payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi updateBatchPenerimaanProduksi tidak tersedia" });

      case "hapusBatchPenerimaanProduksi":
        if (typeof hapusBatchPenerimaanProduksi === "function") {
          const noSJ = payload.no_surat_jalan || payload.noSuratJalan || payload;
          return createJsonResponse(hapusBatchPenerimaanProduksi(token, noSJ));
        }
        return createJsonResponse({ success: false, message: "Fungsi hapusBatchPenerimaanProduksi tidak tersedia" });

      case "updatePenerimaanProduksi":
        if (typeof updatePenerimaanProduksi === "function") {
          return createJsonResponse(updatePenerimaanProduksi(token, payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi updatePenerimaanProduksi tidak tersedia" });

      case "hapusPenerimaanProduksi":
        if (typeof hapusPenerimaanProduksi === "function") {
          return createJsonResponse(hapusPenerimaanProduksi(token, payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi hapusPenerimaanProduksi tidak tersedia" });

      // --- FULFILLMENT & REFILL ---
      case "getFulfillmentPickingLists":
      case "getFulfillmentInit":
        if (typeof getFulfillmentPickingLists === "function") {
          return createJsonResponse(getFulfillmentPickingLists(token));
        }
        return createJsonResponse({ success: false, message: "Fungsi fulfillment tidak tersedia" });

      case "simpanDanProsesMultiCsvRefill":
        if (typeof simpanDanProsesMultiCsvRefill === "function") {
          return createJsonResponse(simpanDanProsesMultiCsvRefill(payload.filePayloads || payload, payload.isDirectPrint, payload.forceProcess, token));
        }
        return createJsonResponse({ success: false, message: "Fungsi simpanDanProsesMultiCsvRefill tidak tersedia" });

      case "selesaiPickingFulfillment":
        if (typeof selesaiPickingFulfillment === "function") {
          return createJsonResponse(selesaiPickingFulfillment(token, payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi selesaiPickingFulfillment tidak tersedia" });

      case "tandaiSjSudahDicetak":
        if (typeof tandaiSjSudahDicetak === "function") {
          const targetSJ = payload.noSJ || payload.no_surat_jalan || payload;
          return createJsonResponse(tandaiSjSudahDicetak(token, targetSJ));
        }
        return createJsonResponse({ success: false, message: "Fungsi tandaiSjSudahDicetak tidak tersedia" });

      case "hapusSjDariRefill":
        if (typeof hapusSjDariRefill === "function") {
          const targetSJ = payload.noSJ || payload.no_surat_jalan || payload;
          return createJsonResponse(hapusSjDariRefill(token, targetSJ));
        }
        return createJsonResponse({ success: false, message: "Fungsi hapusSjDariRefill tidak tersedia" });

      case "cetakUlangSjRefill":
        if (typeof cetakUlangSjRefill === "function") {
          const targetSJ = payload.noSJ || payload.no_surat_jalan || payload;
          return createJsonResponse(cetakUlangSjRefill(token, targetSJ));
        }
        return createJsonResponse({ success: false, message: "Fungsi cetakUlangSjRefill tidak tersedia" });

      case "prosesApprovalRefill":
        if (typeof prosesApprovalRefill === "function") {
          return createJsonResponse(prosesApprovalRefill(payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi prosesApprovalRefill tidak tersedia" });

      // --- STOCK OPNAME & ADJUSTMENT ---
      case "getWmsStockOpnameInitData":
      case "getStockOpnameInit":
        if (typeof getWmsStockOpnameInitData === "function") {
          return createJsonResponse(getWmsStockOpnameInitData(token));
        }
        return createJsonResponse({ success: false, message: "Fungsi getWmsStockOpnameInitData tidak tersedia" });

      case "getQtySistem":
      case "getWmsQtySistem":
        const skuVal = String(payload.sku || "").trim();
        const lokVal = String(payload.lokasi || "").trim();
        if (typeof getWmsQtySistem === "function") {
          return createJsonResponse(getWmsQtySistem(token, skuVal, lokVal));
        }
        return createJsonResponse({ success: false, message: "Fungsi getWmsQtySistem tidak tersedia" });

      case "getWmsStockExportCsv":
        if (typeof getWmsStockExportCsv === "function") {
          return createJsonResponse(getWmsStockExportCsv(token));
        }
        return createJsonResponse({ success: false, message: "Fungsi getWmsStockExportCsv tidak tersedia" });

      case "submitSesiOpname":
      case "submitStockOpname":
      case "simpanHasilOpname":
        if (typeof submitSesiOpname === "function") {
          return createJsonResponse(submitSesiOpname(token, payload.items || payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi submitSesiOpname tidak tersedia" });

      case "submitAdjustmentManualBulk":
        if (typeof submitAdjustmentManualBulk === "function") {
          return createJsonResponse(submitAdjustmentManualBulk(token, payload.items || payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi submitAdjustmentManualBulk tidak tersedia" });

      case "getWmsAdjustmentPendingList":
        if (typeof getWmsAdjustmentPendingList === "function") {
          return createJsonResponse(getWmsAdjustmentPendingList(token));
        }
        return createJsonResponse({ success: false, message: "Fungsi getWmsAdjustmentPendingList tidak tersedia" });

      case "approveAdjustment":
        if (typeof approveAdjustment === "function") {
          return createJsonResponse(approveAdjustment(token, payload.rowIndex || payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi approveAdjustment tidak tersedia" });

      case "rejectAdjustment":
        if (typeof rejectAdjustment === "function") {
          return createJsonResponse(rejectAdjustment(token, payload.rowIndex || payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi rejectAdjustment tidak tersedia" });

      case "approveAdjustmentBulk":
        if (typeof approveAdjustmentBulk === "function") {
          return createJsonResponse(approveAdjustmentBulk(token, payload.rowIndexList || payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi approveAdjustmentBulk tidak tersedia" });

      case "rejectAdjustmentBulk":
        if (typeof rejectAdjustmentBulk === "function") {
          return createJsonResponse(rejectAdjustmentBulk(token, payload.rowIndexList || payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi rejectAdjustmentBulk tidak tersedia" });

      case "prosesApprovalAdjustment":
        if (typeof prosesApprovalAdjustment === "function") {
          return createJsonResponse(prosesApprovalAdjustment(token, payload.rowIndexList || payload, payload.disetujui));
        }
        return createJsonResponse({ success: false, message: "Fungsi prosesApprovalAdjustment tidak tersedia" });

      // --- LOG & MONITORING ---
      case "getLogMutasi":
      case "getWmsLogMutasiData":
        if (typeof getWmsLogMutasiData === "function") {
          return createJsonResponse(getWmsLogMutasiData(token, payload.filters || payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi log mutasi tidak tersedia" });

      case "getWmsLogMutasiInitData":
        if (typeof getWmsLogMutasiInitData === "function") {
          return createJsonResponse(getWmsLogMutasiInitData(token));
        }
        return createJsonResponse({ success: false, message: "Fungsi getWmsLogMutasiInitData tidak tersedia" });

      case "getLogProduk":
      case "getWmsLogProdukData":
        if (typeof getWmsLogProdukData === "function") {
          return createJsonResponse(getWmsLogProdukData(token, payload.sku, payload.filters || payload));
        }
        return createJsonResponse({ success: false, message: "Fungsi log produk tidak tersedia" });

      case "getWmsLogProdukInitData":
        if (typeof getWmsLogProdukInitData === "function") {
          return createJsonResponse(getWmsLogProdukInitData(token));
        }
        return createJsonResponse({ success: false, message: "Fungsi getWmsLogProdukInitData tidak tersedia" });

      // --- UPDATE DATABASE ---
      case "updateDatabaseCsv":
        if (typeof updateDatabaseCsv === "function") {
          return createJsonResponse(updateDatabaseCsv(payload.csvData || payload, token));
        }
        return createJsonResponse({ success: false, message: "Fungsi updateDatabaseCsv tidak tersedia" });

      case "bersihkanCacheProdukWms":
        if (typeof bersihkanCacheProdukWms === "function") {
          return createJsonResponse(bersihkanCacheProdukWms(token));
        }
        return createJsonResponse({ success: false, message: "Fungsi bersihkanCacheProdukWms tidak tersedia" });

      // --- GENERIC DISPATCHER (Jika ada fungsi GAS yang dipanggil langsung) ---
      default:
        if (typeof this[action] === "function") {
          const result = this[action](payload, token);
          return createJsonResponse({ success: true, data: result });
        }
        return createJsonResponse({ success: false, message: "Aksi '" + action + "' tidak dikenali di API backend." });
    }
  } catch (err) {
    Logger.log("Error handleWmsApiRequest: " + err.message + "\n" + err.stack);
    return createJsonResponse({ success: false, message: "Server Error: " + err.message });
  }
}

function createJsonResponse(dataObj) {
  return ContentService.createTextOutput(JSON.stringify(dataObj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}
