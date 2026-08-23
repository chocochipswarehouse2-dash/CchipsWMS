// ========================================================
// WMS MINI CONFIGURATION
// ========================================================

const WMS_CONFIG = {
  // URL Web App Google Apps Script Deployment Aktif
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbyFxfqoqJhrPJOioPxnmbGJTjTTAwli6b87lgOQCPFDOoCVt5EJg3NHZT56zI52rM63/exec",

  // Supabase Configuration untuk Realtime Live Sync
  SUPABASE_URL: "https://filgijcfhgqlirzhvwho.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_L4FEkugwRKqcwFzLXfpZag_aByUy5mD",

  // Local Storage Keys
  STORAGE_PREFIX: "wms_",
  CACHE_TTL_MINUTES: 360 // 6 jam
};

// Expose secara global
window.WMS_CONFIG = WMS_CONFIG;
