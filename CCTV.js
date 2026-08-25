/************************************************
 * PROSES CCTV
 ************************************************/
function prosesCCTV(json) {

  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID_CCTV)
    .getSheetByName(SHEET_NAME_CCTV);

  const message = (json.message || json.pesan || "").trim();

  const groupId =
    (json.sender && json.sender.includes("@g.us")) ? json.sender :
    (json.pengirim && json.pengirim.includes("@g.us")) ? json.pengirim :
    null;

  // Abaikan chat pribadi
  if (!groupId) {
    return ContentService.createTextOutput("IGNORED_PRIVATE");
  }

  // Abaikan grup selain yang diizinkan
  if (!ALLOWED_GROUPS_CCTV.includes(groupId)) {
    return ContentService.createTextOutput("IGNORED_GROUP");
  }

  if (message === "") {
    return ContentService.createTextOutput("OK");
  }

  const lines = message
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  // Minimal Resi + 1 SKU
  if (lines.length < 2) {
    return ContentService.createTextOutput("OK");
  }

  const resi = lines[0];
  const skus = lines.slice(1);

  const timestamp = Utilities.formatDate(
    new Date(),
    TIMEZONE,
    "yyyy-MM-dd HH:mm:ss"
  );

  const inputID = getCCTVID();

  const rows = skus.map(function (sku) {
    return [
      timestamp,
      resi,
      sku,
      "",
      inputID
    ];
  });

  const startRow = findNextRowCCTV(sheet);

  sheet
    .getRange(startRow, 1, rows.length, 5)
    .setValues(rows);

  /************************************************
   * SIMPAN HISTORY WEBHOOK
   * Disimpan SETELAH berhasil input spreadsheet
   ************************************************/
  saveWebhookHistory(json.inboxid);

  return ContentService.createTextOutput("OK");

}

/************************************************
 * FIND NEXT ROW CCTV
 ************************************************/
function findNextRowCCTV(sheet) {

  const data = sheet.getRange("C:C").getValues();

  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][0]) {
      return i + 2;
    }
  }

  return 1;

}