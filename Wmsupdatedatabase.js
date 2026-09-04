/************************************************
 * HALAMAN "UPDATE DATABASE"
 * Satu-satunya pintu masuk untuk update sheet "Data":
 * upload CSV -> sort alphabet -> replace sheet "Data"
 * (semua kolom asli dipertahankan, cuma barisnya yang
 * diproses; semua baris kecuali header ikut masuk)
 ************************************************/

function wmsBisaAksesUpdateDatabase(akses) {
  return akses === "All";
}

/************************************************
 * RENDER HALAMAN
 ************************************************/
function renderWmsUpdateDatabasePage(session, token) {
  const template = HtmlService.createTemplateFromFile("WmsUpdateDatabaseView");
  template.token = token;
  template.username = session.username;
  template.akses = session.akses;
  template.execUrl = ScriptApp.getService().getUrl();
  template.supabaseUrl = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : "https://vxongwtxmhjixhzeoidp.supabase.co";
  template.supabaseAnonKey = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : "sb_publishable_XFvjJipUzyi0EuM_tDTTsg_ll7TJ7rA";

  return template.evaluate()
    .setTitle("Update Database - WMS Chocochips")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}



function bersihkanCacheProdukWms() {
  try {
    const cache = CacheService.getScriptCache();
    if (typeof CACHE_WMS_DASH_COUNT_KEY !== 'undefined') {
      cache.remove(CACHE_WMS_DASH_COUNT_KEY);
    }
  } catch (e) {
    Logger.log("Gagal bersihkan cache: " + e.message);
  }
}