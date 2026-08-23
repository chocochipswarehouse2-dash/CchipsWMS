// ========================================================
// WMS MINI API & BACKEND BRIDGE
// Melayani komunikasi HTTP fetch() ke Google Apps Script
// Menggantikan & mem-polyfill google.script.run
// ========================================================

(function(window) {
  'use strict';

  async function apiCall(action, payload = {}) {
    const apiUrl = (window.WMS_CONFIG && window.WMS_CONFIG.GAS_API_URL) ? window.WMS_CONFIG.GAS_API_URL : "";
    
    if (!apiUrl || apiUrl.includes("YOUR_DEPLOYMENT_ID")) {
      console.warn("[WMS API] URL Google Apps Script belum dikonfigurasi di js/config.js");
    }

    const token = localStorage.getItem('wms_token') || sessionStorage.getItem('wms_token') || "";

    const requestBody = {
      action: action,
      token: token,
      payload: payload,
      timestamp: Date.now()
    };

    try {
      // Menggunakan POST mode no-cors / cors
      // Pada GAS Web App, fetch POST dengan text/plain payload mencegah CORS preflight OPTIONS error
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error(`[WMS API Error - ${action}]:`, err);
      throw err;
    }
  }

  // ========================================================
  // GOOGLE.SCRIPT.RUN COMPATIBILITY POLYFILL SHIM
  // Memungkinkan pemanggilan lama tetap berjalan 100% mulus:
  // google.script.run.withSuccessHandler(fn).withFailureHandler(fn).actionName(args)
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

    // Dynamic method invocation handler via Proxy
    static create() {
      const builder = new ScriptRunBuilder();
      return new Proxy(builder, {
        get(target, propKey) {
          if (propKey in target) {
            return target[propKey];
          }

          // Return proxy function for any backend method name
          return function(...args) {
            let actionName = propKey;
            let payload = {};

            // Normalisasi parameter sesuai fungsi backend
            if (actionName === 'verifyWmsLogin') {
              actionName = 'verifyLogin';
              payload = { username: args[0], password: args[1] };
            } else if (actionName === 'getWmsProdukCompact') {
              actionName = 'getProdukCompact';
              payload = { force: args[1] };
            } else if (actionName === 'logoutWmsSession') {
              actionName = 'logout';
              payload = { token: args[0] };
            } else if (actionName === 'getWmsQtySistem') {
              actionName = 'getQtySistem';
              payload = { sku: args[0], lokasi: args[1] };
            } else if (actionName === 'submitFormPeminjaman') {
              actionName = 'submitPeminjaman';
              payload = args[0];
            } else if (actionName === 'simpanPenerimaanProduksi') {
              actionName = 'submitPenerimaanProduksi';
              payload = args[0];
            } else if (actionName === 'simpanHasilOpname') {
              actionName = 'submitStockOpname';
              payload = args[0];
            } else if (actionName === 'updateDatabaseCsv') {
              actionName = 'updateDatabaseCsv';
              payload = { csvData: args[0] };
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
    }
  }

  // Pasang google.script.run jika belum ada
  if (!window.google) window.google = {};
  if (!window.google.script) window.google.script = {};
  window.google.script.run = {
    withSuccessHandler(fn) {
      return ScriptRunBuilder.create().withSuccessHandler(fn);
    },
    withFailureHandler(fn) {
      return ScriptRunBuilder.create().withFailureHandler(fn);
    }
  };

  // Expose Global Helper
  window.apiCall = apiCall;

})(window);
