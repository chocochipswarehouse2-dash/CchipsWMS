/************************************************
 * PROSES QC
 ************************************************/
function prosesQC(json) {

  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(SHEET_NAME_QC);

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

  // Abaikan chat pribadi
  if (!groupId) {
    return ContentService.createTextOutput("IGNORED_PRIVATE");
  }

  // Abaikan grup selain yang diizinkan
  if (!ALLOWED_GROUPS_QC.includes(groupId)) {
    return ContentService.createTextOutput("IGNORED_GROUP");
  }

  if (message === "") {
    return ContentService.createTextOutput("OK");
  }

  const lines = message
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  /************************************************
   * BUKAN FORMAT QC
   ************************************************/
  if (
    (lines[0] || "").trim().toUpperCase() !== "#LAPORQC"
  ) {
    return ContentService.createTextOutput("OK");
  }

  const userWA = name + " | " + sender;
  const today = Utilities.formatDate(
    new Date(),
    TIMEZONE,
    "yyyy-MM-dd"
  );

  const qcID = getQCID();

  /************************************************
   * FORMAT SALAH
   ************************************************/
  if (!isQCHeader(lines)) {

    sheet.appendRow([
      today,
      userWA,
      qcID,
      "FORMAT SALAH",
      "",
      "",
      "Header #LaporQC / #Dari tidak sesuai",
      "",
      ""
    ]);

    saveWebhookHistory(json.inboxid);

    return ContentService.createTextOutput("OK");

  }

  const sumber = getQCSumber(lines);

  const items = lines.slice(2);

  if (items.length === 0) {

    sheet.appendRow([
      today,
      userWA,
      qcID,
      "FORMAT SALAH",
      "",
      "",
      "Data barang kosong",
      "",
      ""
    ]);

    saveWebhookHistory(json.inboxid);

    return ContentService.createTextOutput("OK");

  }

  const rows = [];

  items.forEach(function(line){

    const hasil = parseQCItem(line);

    if (!hasil) return;

    rows.push([
      today,                 // A
      userWA,                // B
      qcID,                  // C
      hasil.nama,            // D
      hasil.size,            // E
      hasil.qty,             // F
      sumber,                // G
      hasil.status,          // H
      hasil.kondisi          // I
    ]);

  });

  if (rows.length > 0) {

    const startRow = findNextRow(sheet);

    sheet
      .getRange(startRow,1,rows.length,9)
      .setValues(rows);

  }

  saveWebhookHistory(json.inboxid);

  return ContentService.createTextOutput("OK");

}