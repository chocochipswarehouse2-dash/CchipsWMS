// ========================================================
// WMS MINI API & BACKEND BRIDGE (v792)
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
  // DIRECT SUPABASE MASTER DATA & LIVE STOCK LOADER
  // Kecepatan kilat < 500ms langsung dari Supabase Cloud
  // ========================================================
  async function fetchMasterDataFromSupabase() {
    const supaUrl = (window.WMS_CONFIG && window.WMS_CONFIG.SUPABASE_URL) ? window.WMS_CONFIG.SUPABASE_URL : "https://filgijcfhgqlirzhvwho.supabase.co";
    const supaKey = (window.WMS_CONFIG && window.WMS_CONFIG.SUPABASE_ANON_KEY) ? window.WMS_CONFIG.SUPABASE_ANON_KEY : "sb_publishable_L4FEkugwRKqcwFzLXfpZag_aByUy5mD";

    const headers = {
      'apikey': supaKey,
      'Authorization': 'Bearer ' + supaKey
    };

    try {
      const [resProd, resStock] = await Promise.all([
        fetch(`${supaUrl}/rest/v1/master_produk?select=sku,nama_produk,kategori,size,dealpos_channels&order=nama_produk.asc&limit=10000`, { headers }).then(r => r.json()),
        fetch(`${supaUrl}/rest/v1/stok_lokasi?select=sku,lokasi,area,qty&qty=gt.0&limit=10000`, { headers }).then(r => r.json())
      ]);

      if (!Array.isArray(resProd)) throw new Error("Format data Supabase master_produk tidak valid");

      const stockMap = {};
      if (Array.isArray(resStock)) {
        resStock.forEach(s => {
          const sku = String(s.sku || '').toUpperCase();
          if (!stockMap[sku]) stockMap[sku] = [];
          stockMap[sku].push({ lokasi: s.lokasi, area: s.area, qty: Number(s.qty) || 0 });
        });
      }

      const masterList = resProd.map(p => {
        const sku = String(p.sku || '').toUpperCase();
        const locList = stockMap[sku] || [];
        const totalQty = locList.reduce((sum, item) => sum + item.qty, 0);

        let studioQty = 0;
        let shpQty = 0;
        let ttkQty = 0;
        let mapQty = 0;

        locList.forEach(l => {
          const loc = (l.lokasi || '').toUpperCase();
          if (loc.startsWith('F')) studioQty += l.qty;
          else if (loc.includes('SHP') || loc.includes('SHOPEE')) shpQty += l.qty;
          else if (loc.includes('TTK') || loc.includes('TIKTOK')) ttkQty += l.qty;
          else mapQty += l.qty;
        });

        const f = p.dealpos_channels || {};

        return {
          sku: p.sku,
          produk: p.nama_produk,
          size: p.size,
          kategori: p.kategori,
          stokFisik: totalQty,
          locList: locList,
          f: f,
          komparasi: {
            MAP: { fisik: mapQty, dealpos: f['Gudang Utama'] || 0 },
            STUDIO: { fisik: studioQty, dealpos: f['Sample Studio'] || 0 },
            LIVE: { fisik: studioQty, dealpos: f['Barang Live'] || 0 }
          },
          singles: {
            SHP: shpQty,
            TTK: ttkQty
          }
        };
      });

      window.WMS_MASTER_DATA = masterList;
      try { localStorage.setItem('wms_inventory_cache_compact_v2', JSON.stringify(masterList)); } catch (e) {}
      window.dispatchEvent(new CustomEvent('wms-master-data-loaded', { detail: masterList }));
      return masterList;
    } catch (e) {
      console.warn("[Supabase direct load error, will fallback to GAS]:", e);
      return null;
    }
  }
  window.fetchMasterDataFromSupabase = fetchMasterDataFromSupabase;

  // ========================================================
  // GOOGLE.SCRIPT.RUN COMPATIBILITY POLYFILL SHIM
  // ========================================================
  class ScriptRunBuilder {
    constructor() {
      this.successHandler = null;
      this.failureHandler = null;
      this.userObject = null;
      this.proxy = null;
    }

    withSuccessHandler(fn) {
      this.successHandler = fn;
      return this.proxy;
    }

    withFailureHandler(fn) {
      this.failureHandler = fn;
      return this.proxy;
    }

    withUserObject(obj) {
      this.userObject = obj;
      return this.proxy;
    }

    static create() {
      const builder = new ScriptRunBuilder();
      builder.proxy = new Proxy(builder, {
        get(target, propKey) {
          if (typeof target[propKey] === 'function') {
            return target[propKey].bind(target);
          }
          if (propKey in target) {
            return target[propKey];
          }

          return function(...args) {
            let actionName = propKey;
            let payload = {};

            // 1. Normalisasi nama action & mapping payload
            if (actionName === 'verifyWmsLogin' || actionName === 'verifyLogin') {
              actionName = 'verifyLogin';
              payload = { username: args[0], password: args[1] };
            } else if (actionName === 'getWmsProdukCompact' || actionName === 'getProdukCompact') {
              actionName = 'getProdukCompact';
              payload = { force: args[1] || (typeof args[0] === 'boolean' ? args[0] : false) };
            } else if (actionName === 'logoutWmsSession' || actionName === 'logout') {
              actionName = 'logout';
              payload = { token: args[0] || window.TOKEN };
            } else if (actionName === 'getWmsQtySistem' || actionName === 'getQtySistem') {
              actionName = 'getQtySistem';
              payload = { sku: args[1] !== undefined ? args[1] : args[0], lokasi: args[2] !== undefined ? args[2] : args[1] };
            } else if (actionName === 'submitFormPeminjaman' || actionName === 'submitPeminjaman') {
              actionName = 'submitPeminjaman';
              payload = args[0];
            } else if (actionName === 'submitScanPeminjaman') {
              actionName = 'submitScanPeminjaman';
              payload = args[0];
            } else if (actionName === 'kembalikanPeminjaman') {
              actionName = 'kembalikanPeminjaman';
              payload = args[0];
            } else if (actionName === 'getPeminjamanInitData' || actionName === 'getProdukListForPeminjaman') {
              actionName = 'getPeminjamanInitData';
              payload = {};
            } else if (actionName === 'getPenerimaanProduksiInitData' || actionName === 'getPenerimaanProduksiInit') {
              actionName = 'getPenerimaanProduksiInitData';
              payload = {};
            } else if (actionName === 'getPenerimaanProduksiList') {
              actionName = 'getPenerimaanProduksiList';
              payload = (args.length > 1 && typeof args[1] === 'object') ? args[1] : (typeof args[0] === 'object' ? args[0] : {});
            } else if (actionName === 'simpanPenerimaanProduksi' || actionName === 'submitPenerimaanProduksi') {
              actionName = 'submitPenerimaanProduksi';
              payload = args[0];
            } else if (actionName === 'updateBatchPenerimaanProduksi') {
              actionName = 'updateBatchPenerimaanProduksi';
              payload = args[0];
            } else if (actionName === 'hapusBatchPenerimaanProduksi') {
              actionName = 'hapusBatchPenerimaanProduksi';
              payload = { no_surat_jalan: args[0] };
            } else if (actionName === 'updatePenerimaanProduksi') {
              actionName = 'updatePenerimaanProduksi';
              payload = args[0];
            } else if (actionName === 'hapusPenerimaanProduksi') {
              actionName = 'hapusPenerimaanProduksi';
              payload = typeof args[0] === 'object' ? args[0] : { id: args[0] };
            } else if (actionName === 'getFulfillmentPickingLists' || actionName === 'getFulfillmentInit') {
              actionName = 'getFulfillmentPickingLists';
              payload = {};
            } else if (actionName === 'simpanDanProsesMultiCsvRefill') {
              actionName = 'simpanDanProsesMultiCsvRefill';
              payload = { filePayloads: args[0], isDirectPrint: args[1], forceProcess: args[2] };
            } else if (actionName === 'selesaiPickingFulfillment') {
              actionName = 'selesaiPickingFulfillment';
              payload = (args.length > 1 && typeof args[1] === 'object') ? args[1] : args[0];
            } else if (actionName === 'tandaiSjSudahDicetak') {
              actionName = 'tandaiSjSudahDicetak';
              payload = { noSJ: args[1] !== undefined ? args[1] : args[0] };
            } else if (actionName === 'hapusSjDariRefill') {
              actionName = 'hapusSjDariRefill';
              payload = { noSJ: args[1] !== undefined ? args[1] : args[0] };
            } else if (actionName === 'cetakUlangSjRefill') {
              actionName = 'cetakUlangSjRefill';
              payload = { noSJ: args[1] !== undefined ? args[1] : args[0] };
            } else if (actionName === 'prosesApprovalRefill') {
              actionName = 'prosesApprovalRefill';
              payload = args[0];
            } else if (actionName === 'getWmsStockOpnameInitData' || actionName === 'getStockOpnameInit') {
              actionName = 'getWmsStockOpnameInitData';
              payload = {};
            } else if (actionName === 'getWmsStockExportCsv') {
              actionName = 'getWmsStockExportCsv';
              payload = {};
            } else if (actionName === 'submitSesiOpname' || actionName === 'submitStockOpname' || actionName === 'simpanHasilOpname') {
              actionName = 'submitSesiOpname';
              payload = (args.length > 1 && Array.isArray(args[1])) ? { items: args[1] } : (Array.isArray(args[0]) ? { items: args[0] } : args[0]);
            } else if (actionName === 'submitAdjustmentManualBulk') {
              actionName = 'submitAdjustmentManualBulk';
              payload = (args.length > 1 && Array.isArray(args[1])) ? { items: args[1] } : (Array.isArray(args[0]) ? { items: args[0] } : args[0]);
            } else if (actionName === 'getWmsAdjustmentPendingList') {
              actionName = 'getWmsAdjustmentPendingList';
              payload = {};
            } else if (actionName === 'approveAdjustment') {
              actionName = 'approveAdjustment';
              payload = { rowIndex: args[1] !== undefined ? args[1] : args[0] };
            } else if (actionName === 'rejectAdjustment') {
              actionName = 'rejectAdjustment';
              payload = { rowIndex: args[1] !== undefined ? args[1] : args[0] };
            } else if (actionName === 'approveAdjustmentBulk') {
              actionName = 'approveAdjustmentBulk';
              payload = { rowIndexList: args[1] !== undefined ? args[1] : args[0] };
            } else if (actionName === 'rejectAdjustmentBulk') {
              actionName = 'rejectAdjustmentBulk';
              payload = { rowIndexList: args[1] !== undefined ? args[1] : args[0] };
            } else if (actionName === 'prosesApprovalAdjustment') {
              actionName = 'prosesApprovalAdjustment';
              payload = { rowIndexList: args[1] !== undefined ? args[1] : args[0], disetujui: args[2] !== undefined ? args[2] : args[1] };
            } else if (actionName === 'getWmsLogProdukData' || actionName === 'getLogProduk') {
              actionName = 'getWmsLogProdukData';
              payload = { sku: args[1] !== undefined ? args[1] : args[0], filters: args[2] !== undefined ? args[2] : (typeof args[1] === 'object' ? args[1] : {}) };
            } else if (actionName === 'getWmsLogProdukInitData') {
              actionName = 'getWmsLogProdukInitData';
              payload = {};
            } else if (actionName === 'getWmsLogMutasiData' || actionName === 'getLogMutasi') {
              actionName = 'getWmsLogMutasiData';
              payload = (args.length > 1 && typeof args[1] === 'object') ? args[1] : (typeof args[0] === 'object' ? args[0] : {});
            } else if (actionName === 'getWmsLogMutasiInitData') {
              actionName = 'getWmsLogMutasiInitData';
              payload = {};
            } else if (actionName === 'updateDatabaseCsv') {
              actionName = 'updateDatabaseCsv';
              payload = { csvData: args[0] };
            } else if (actionName === 'bersihkanCacheProdukWms') {
              actionName = 'bersihkanCacheProdukWms';
              payload = {};
            } else if (actionName === 'getWmsUserList' || actionName === 'getUserList') {
              actionName = 'getUserList';
              payload = {};
            } else if (actionName === 'saveWmsUser' || actionName === 'saveUser') {
              actionName = 'saveUser';
              payload = args[1] || args[0];
            } else if (actionName === 'deleteWmsUser' || actionName === 'deleteUser') {
              actionName = 'deleteUser';
              payload = { username: args[1] || args[0] };
            } else if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
              payload = args[0];
            } else if (args.length > 0) {
              payload = { args: args };
            }

            apiCall(actionName, payload)
              .then(res => {
                if (typeof target.successHandler === 'function') {
                  target.successHandler(res, target.userObject);
                }
              })
              .catch(err => {
                if (typeof target.failureHandler === 'function') {
                  target.failureHandler(err, target.userObject);
                } else {
                  console.error('[Unhandled API Error]', err);
                }
              });
          };
        }
      });
      return builder.proxy;
    }
  }

  // Create global proxy for window.google.script.run
  if (!window.google) window.google = {};
  if (!window.google.script) window.google.script = {};
  
  window.google.script.run = new Proxy({}, {
    get(target, propKey) {
      const freshBuilderProxy = ScriptRunBuilder.create();
      if (typeof freshBuilderProxy[propKey] === 'function') {
        return freshBuilderProxy[propKey];
      }
      return freshBuilderProxy[propKey];
    }
  });

  window.apiCall = apiCall;

})(window);
