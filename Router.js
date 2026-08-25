/************************************************
 * FILE ROUTER.GS
 ************************************************/
function doGet(e) {
  // 0. API Request Gateway via GET (CORS Resilient)
  if (e && e.parameter && (e.parameter.action || e.parameter.type === "API")) {
    let payload = {};
    try {
      if (e.parameter.payload) payload = JSON.parse(e.parameter.payload);
    } catch (errJson) {}
    const apiData = {
      action: e.parameter.action,
      token: e.parameter.token || "",
      payload: Object.keys(payload).length > 0 ? payload : e.parameter
    };
    return handleWmsApiRequest(apiData);
  }

  // 1. Cek route cetak surat jalan peminjaman
  if (e && e.parameter && e.parameter.print) {
    return printSuratJalanPeminjaman(e.parameter.print);
  }

  const token = (e && e.parameter && e.parameter.token) ? String(e.parameter.token).trim() : "";
  const session = getWmsSessionFromToken(token);

  if (!session) {
    return renderWmsLoginPage();
  }

  const page = (e && e.parameter && e.parameter.page) ? String(e.parameter.page).toLowerCase() : "";

  return renderWmsDashboard(session, token, page);
}

/************************************************
 * RENDER HALAMAN FULFILLMENT
 ************************************************/
function renderFulfillmentPage(session, token) {
  if (!wmsBisaAksesFulfillment(session.akses)) {
    return renderWmsAksesDitolak();
  }

  const template = HtmlService.createTemplateFromFile("FulfillmentPage");
  
  template.token = token;
  template.username = session.username;
  template.akses = session.akses;
  template.execUrl = ScriptApp.getService().getUrl();

  return template.evaluate()
    .setTitle("Fulfillment - WMS Chocochips")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/************************************************
 * HAK AKSES & RENDER HALAMAN LOG PRODUK
 ************************************************/
function wmsBisaAksesLogProduk(akses) {
  return akses === "All"; 
}

function renderWmsLogProdukPage(session, token) {
  if (!wmsBisaAksesLogProduk(session.akses)) {
    return renderWmsAksesDitolak();
  }

  const template = HtmlService.createTemplateFromFile("WmsLogProdukView");
  
  template.token = token;
  template.username = session.username;
  template.akses = session.akses;
  template.execUrl = ScriptApp.getService().getUrl();

  return template.evaluate()
    .setTitle("Log Produk - WMS Chocochips")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/************************************************
 * RENDER HALAMAN KLASIFIKASI & MONITORING
 ************************************************/
function renderWmsKlasifikasiPage(session, token) {
  const template = HtmlService.createTemplateFromFile("WmsKlasifikasiView");
  template.token = token;
  template.username = session.username;
  template.akses = session.akses;
  template.execUrl = ScriptApp.getService().getUrl();

  return template.evaluate()
    .setTitle("Dashboard Monitoring & Klasifikasi - WMS Chocochips")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}