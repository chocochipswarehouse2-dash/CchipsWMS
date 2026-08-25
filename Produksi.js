/************************************************
 * PROSES PRODUKSI
 ************************************************/
function prosesProduksi(json) {

  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(SHEET_NAME_PRODUKSI);

  const sender = json.sender || "";
  const name = json.pushname || json.name || sender;
  const message = (json.message || json.pesan || "").trim();

  /************************************************
   * STRICT GROUP DETECTION
   ************************************************/
  const groupId =
    (json.sender && json.sender.includes("@g.us")) ? json.sender :
    (json.pengirim && json.pengirim.includes("@g.us")) ? json.pengirim :
    null;

  if (!groupId) {
    return ContentService.createTextOutput("IGNORED_PRIVATE");
  }

  if (!ALLOWED_GROUPS_PRODUKSI.includes(groupId)) {
    return ContentService.createTextOutput("IGNORED_GROUP");
  }

  if (message === "") {
    return ContentService.createTextOutput("OK");
  }

  const lines = message
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  if (!isProduksiHeader(lines)) {
    return ContentService.createTextOutput("OK");
  }

  const keterangan = getProduksiKeterangan(lines);
  const supplier = getProduksiSupplier(keterangan);

  const hasil = parseProduksi(lines);

  if (hasil.length === 0) {
    return ContentService.createTextOutput("OK");
  }

  const tanggal = Utilities.formatDate(
    new Date(),
    TIMEZONE,
    "yyyy-MM-dd"
  );

  const rows = hasil.map(function(item){

    return [

      tanggal,           // A Tanggal
      item.kode,         // B Kode Produksi
      item.warna,        // C Warna
      item.size,         // D Size
      item.qty,          // E Qty
      keterangan,        // F Keterangan
      supplier           // G Supplier

    ];

  });

  const startRow = sheet.getLastRow() + 1;

  sheet
    .getRange(startRow,1,rows.length,7)
    .setValues(rows);

  saveWebhookHistory(json.inboxid);

  return ContentService.createTextOutput("OK");

}