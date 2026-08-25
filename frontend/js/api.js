// ========================================================
// WMS MINI API & BACKEND BRIDGE (v793)
// Melayani komunikasi HTTP fetch() ke Google Apps Script
// Menggantikan & mem-polyfill google.script.run secara transparan
// ========================================================

(function(window) {
  'use strict';

  async function apiCall(action, payload = {}) {
    const apiUrl = (window.WMS_CONFIG && window.WMS_CONFIG.GAS_API_URL) ? window.WMS_CONFIG.GAS_API_URL : "";
    
    if (!apiUrl || apiUrl.includes("YOUR_DEPLOYMENT_ID")) {
      console.warn("[WMS API] URL Google Apps Script belum dikonfigurasi di js/config.js");
    }

    const token = window.TOKEN || localStorage.getItem('wms_token') || sessionStorage.getItem('wms_token') || "";

    const requestBody = {
      action: action,
      token: token,
      payload: payload,
      timestamp: Date.now()
    };

    try {
      // POST with text/plain prevents CORS preflight OPTIONS error in GAS
      const response = await fetch(apiUrl, {
        method: "POST",
        mode: "cors",
        redirect: "follow",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      return result;
    } catch (err) {
      console.warn(`[WMS API POST failed, trying GET fallback - ${action}]:`, err);
      // GET Fallback (100% resilient across restrictive browser environments)
      try {
        const queryParams = new URLSearchParams({
          action: action,
          token: token,
          payload: JSON.stringify(payload),
          _t: Date.now()
        });
        const getUrl = `${apiUrl}?${queryParams.toString()}`;
        const getResponse = await fetch(getUrl, {
          method: "GET",
          mode: "cors",
          redirect: "follow"
        });
        const getResult = await getResponse.json();
        return getResult;
      } catch (fallbackErr) {
        console.error(`[WMS API Error - ${action}]:`, fallbackErr);
        throw fallbackErr;
      }
    }
  }

  // ========================================================
  // GOOGLE SCRIPT RUN COMPATIBILITY POLYFILL (DYNAMIC PROXY)
  // Memungkinkan kode frontend GAS lama berjalan 100% tanpa diubah
  // ========================================================
  class ScriptRunBuilder {
    constructor() {
      this.successHandler = null;
      this.failureHandler = null;
      this.userObject = null;
    }

    withSuccessHandler(fn) {
      this.successHandler = fn;
      return this;
    }

    withFailureHandler(fn) {
      this.failureHandler = fn;
      return this;
    }

    withUserObject(obj) {
      this.userObject = obj;
      return this;
    }
  }

  function createScriptRunProxy() {
    return new Proxy({}, {
      get: function(target, propKey) {
        const builder = new ScriptRunBuilder();

        return new Proxy(builder, {
          get: function(target, innerKey) {
            if (innerKey === 'withSuccessHandler') {
              return function(fn) { target.withSuccessHandler(fn); return target; };
            }
            if (innerKey === 'withFailureHandler') {
              return function(fn) { target.withFailureHandler(fn); return target; };
            }
            if (innerKey === 'withUserObject') {
              return function(obj) { target.withUserObject(obj); return target; };
            }

            // Pemanggilan method RPC backend langsung
            return function(...args) {
              return executeMethod(innerKey, args, target);
            };
          },

          apply: function(target, thisArg, argArray) {
            return executeMethod(propKey, argArray, target);
          }
        });
      }
    });
  }

  function executeMethod(methodName, rawArgs, builderTarget) {
    let actionName = methodName;
    let payload = {};

    // Cek apakah argumen pertama adalah string token sesi
    const activeToken = window.TOKEN || localStorage.getItem('wms_token') || sessionStorage.getItem('wms_token') || "";
    let args = rawArgs;
    if (args.length > 0 && typeof args[0] === 'string' && (args[0] === activeToken || args[0].length >= 10)) {
      // Hilangkan argumen token dari daftar data payload karena token otomatis dikirim oleh apiCall
      args = rawArgs.slice(1);
    }

    // NORMALISASI LENGKAP UNTUK SELURUH 10 MODUL WMS
    if (actionName === 'verifyWmsLogin' || actionName === 'verifyLogin' || actionName === 'login') {
      actionName = 'verifyLogin';
      payload = { username: rawArgs[0], password: rawArgs[1] };
    } else if (actionName === 'checkSession' || actionName === 'checkAuthSession') {
      actionName = 'checkSession';
      payload = {};
    } else if (actionName === 'logoutWmsSession' || actionName === 'logout') {
      actionName = 'logout';
      payload = {};
    } else if (actionName === 'getWmsProdukCompact' || actionName === 'getProdukCompact') {
      actionName = 'getWmsProdukCompact';
      payload = { force: Boolean(args[0]) };
    } else if (actionName === 'getWmsProdukSearch') {
      actionName = 'getWmsProdukSearch';
      payload = { keyword: args[0], areaFilter: args[1], limit: args[2] };
    } 
    // --- USER MANAGEMENT ---
    else if (actionName === 'getWmsUsersList' || actionName === 'getUsersList' || actionName === 'getWmsUserList' || actionName === 'getUserList') {
      actionName = 'getWmsUsersList';
      payload = {};
    } else if (actionName === 'saveWmsUser' || actionName === 'saveUser') {
      actionName = 'saveWmsUser';
      payload = { userData: args[0] || rawArgs[0] };
    } else if (actionName === 'deleteWmsUser' || actionName === 'deleteUser') {
      actionName = 'deleteWmsUser';
      payload = { username: args[0] || rawArgs[0] };
    }
    // --- PEMINJAMAN SPS ---
    else if (actionName === 'getPeminjamanInitData' || actionName === 'getProdukListForPeminjaman') {
      actionName = 'getPeminjamanInitData';
      payload = {};
    } else if (actionName === 'submitFormPeminjaman' || actionName === 'submitPeminjaman') {
      actionName = 'submitPeminjaman';
      payload = args[0] || rawArgs[0];
    } else if (actionName === 'submitScanPeminjaman') {
      actionName = 'submitScanPeminjaman';
      payload = args[0] || rawArgs[0];
    } else if (actionName === 'kembalikanPeminjaman') {
      actionName = 'kembalikanPeminjaman';
      payload = args[0] || rawArgs[0];
    }
    // --- PENERIMAAN PRODUKSI ---
    else if (actionName === 'getPenerimaanProduksiInitData' || actionName === 'getPenerimaanProduksiInit') {
      actionName = 'getPenerimaanProduksiInitData';
      payload = {};
    } else if (actionName === 'getPenerimaanProduksiList') {
      actionName = 'getPenerimaanProduksiList';
      payload = { filters: args[0] || {} };
    } else if (actionName === 'simpanPenerimaanProduksi' || actionName === 'submitPenerimaanProduksi') {
      actionName = 'simpanPenerimaanProduksi';
      payload = { payload: args[0] || rawArgs[0] };
    } else if (actionName === 'updateBatchPenerimaanProduksi') {
      actionName = 'updateBatchPenerimaanProduksi';
      payload = { payload: args[0] || rawArgs[0] };
    } else if (actionName === 'hapusBatchPenerimaanProduksi') {
      actionName = 'hapusBatchPenerimaanProduksi';
      payload = { no_surat_jalan: args[0] || rawArgs[0] };
    } else if (actionName === 'updatePenerimaanProduksi') {
      actionName = 'updatePenerimaanProduksi';
      payload = { payload: args[0] || rawArgs[0] };
    } else if (actionName === 'hapusPenerimaanProduksi') {
      actionName = 'hapusPenerimaanProduksi';
      payload = typeof args[0] === 'object' ? args[0] : { id: args[0] || rawArgs[0] };
    }
    // --- FULFILLMENT & REFILL ---
    else if (actionName === 'getFulfillmentPickingLists' || actionName === 'getFulfillmentInit') {
      actionName = 'getFulfillmentPickingLists';
      payload = {};
    } else if (actionName === 'simpanDanProsesMultiCsvRefill') {
      actionName = 'simpanDanProsesMultiCsvRefill';
      payload = { filePayloads: args[0] || rawArgs[0], isDirectPrint: args[1] || rawArgs[1], forceProcess: args[2] || rawArgs[2] };
    } else if (actionName === 'selesaiPickingFulfillment') {
      actionName = 'selesaiPickingFulfillment';
      payload = { bubbleObj: args[0] || rawArgs[0] };
    } else if (actionName === 'tandaiSjSudahDicetak') {
      actionName = 'tandaiSjSudahDicetak';
      payload = { noSJ: args[0] || rawArgs[0] };
    } else if (actionName === 'hapusSjDariRefill') {
      actionName = 'hapusSjDariRefill';
      payload = { noSJ: args[0] || rawArgs[0] };
    } else if (actionName === 'cetakUlangSjRefill') {
      actionName = 'cetakUlangSjRefill';
      payload = { noSJ: args[0] || rawArgs[0] };
    } else if (actionName === 'cetakMultipleSuratJalanRefill') {
      actionName = 'cetakMultipleSuratJalanRefill';
      payload = { bubbles: args[0] || rawArgs[0] };
    } else if (actionName === 'cetakSuratJalanRefill') {
      actionName = 'cetakSuratJalanRefill';
      payload = { noSJ: args[0] || rawArgs[0] };
    } else if (actionName === 'prosesApprovalRefill') {
      actionName = 'prosesApprovalRefill';
      payload = args[0] || rawArgs[0];
    }
    // --- STOCK OPNAME & ADJUSTMENT ---
    else if (actionName === 'getWmsStockOpnameInitData' || actionName === 'getStockOpnameInit') {
      actionName = 'getWmsStockOpnameInitData';
      payload = {};
    } else if (actionName === 'getWmsQtySistem' || actionName === 'getQtySistem') {
      actionName = 'getWmsQtySistem';
      payload = { sku: args[0], lokasi: args[1] };
    } else if (actionName === 'getWmsStockExportCsv') {
      actionName = 'getWmsStockExportCsv';
      payload = {};
    } else if (actionName === 'submitSesiOpname' || actionName === 'submitStockOpname' || actionName === 'simpanHasilOpname') {
      actionName = 'submitSesiOpname';
      payload = { items: args[0] || rawArgs[0] };
    } else if (actionName === 'submitAdjustmentManualBulk') {
      actionName = 'submitAdjustmentManualBulk';
      payload = { items: args[0] || rawArgs[0] };
    } else if (actionName === 'getWmsAdjustmentPendingList') {
      actionName = 'getWmsAdjustmentPendingList';
      payload = {};
    } else if (actionName === 'approveAdjustment') {
      actionName = 'approveAdjustment';
      payload = { rowIndex: args[0] !== undefined ? args[0] : rawArgs[0] };
    } else if (actionName === 'rejectAdjustment') {
      actionName = 'rejectAdjustment';
      payload = { rowIndex: args[0] !== undefined ? args[0] : rawArgs[0] };
    } else if (actionName === 'approveAdjustmentBulk') {
      actionName = 'approveAdjustmentBulk';
      payload = { rowIndexList: args[0] || rawArgs[0] };
    } else if (actionName === 'rejectAdjustmentBulk') {
      actionName = 'rejectAdjustmentBulk';
      payload = { rowIndexList: args[0] || rawArgs[0] };
    } else if (actionName === 'prosesApprovalAdjustment') {
      actionName = 'prosesApprovalAdjustment';
      payload = { rowIndexList: args[0], disetujui: args[1] };
    }
    // --- LOG PRODUK & LOG MUTASI ---
    else if (actionName === 'getWmsLogProdukData' || actionName === 'getLogProduk') {
      actionName = 'getWmsLogProdukData';
      payload = { sku: args[0], filters: args[1] || {} };
    } else if (actionName === 'getWmsLogProdukInitData') {
      actionName = 'getWmsLogProdukInitData';
      payload = {};
    } else if (actionName === 'getWmsLogMutasiData' || actionName === 'getLogMutasi') {
      actionName = 'getWmsLogMutasiData';
      payload = { filters: args[0] || {} };
    } else if (actionName === 'getWmsLogMutasiInitData') {
      actionName = 'getWmsLogMutasiInitData';
      payload = {};
    }
    // --- UPDATE DATABASE & REBUILD STOK ---
    else if (actionName === 'getWmsUpdateDatabaseRingkasan') {
      actionName = 'getWmsUpdateDatabaseRingkasan';
      payload = {};
    } else if (actionName === 'updateDatabaseCsv') {
      actionName = 'updateDatabaseCsv';
      payload = { headerRow: args[0], rows: args[1] };
    } else if (actionName === 'bersihkanCacheProdukWms') {
      actionName = 'bersihkanCacheProdukWms';
      payload = {};
    } else if (actionName === 'rebuildStockTriggerManual' || actionName === 'rebuildStock') {
      actionName = 'rebuildStockTriggerManual';
      payload = {};
    }
    // Fallback general
    else if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      payload = args[0];
    } else if (args.length > 0) {
      payload = { args: args };
    }

    apiCall(actionName, payload)
      .then(res => {
        if (builderTarget && typeof builderTarget.successHandler === 'function') {
          builderTarget.successHandler(res, builderTarget.userObject);
        }
      })
      .catch(err => {
        if (builderTarget && typeof builderTarget.failureHandler === 'function') {
          builderTarget.failureHandler(err, builderTarget.userObject);
        } else {
          console.error(`[WMS API Bridge Unhandled Rejection - ${actionName}]:`, err);
        }
      });
  }

  // Pasang Google Script Run Polyfill
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = createScriptRunProxy();

  // Expose global helper
  window.apiCall = apiCall;

})(window);
