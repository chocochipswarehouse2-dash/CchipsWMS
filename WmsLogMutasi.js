/************************************************
 * HALAMAN LOG MUTASI (WMS)
 * Sumber data: sheet "Log Product" yang sama, tapi
 * dikelompokkan per No Invoice -- fokus ke ringkasan
 * mutasi (dari/ke lokasi mana, berapa item), bukan
 * detail per produk (itu ada di halaman Log Produk).
 *
 * Kolom sheet: A=Tanggal, B=SKU, C=Lokasi, D=Invoice,
 * E=Operator, F=Type, G=Keterangan, H=Area, I=Nama Produk, J=Size
 ************************************************/

const MAX_INVOICE_MUTASI_DITAMPILKAN = 150; // batasi jumlah invoice yang ditampilkan
const BUFFER_BARIS_MUTASI = 4000; // baris mentah yang di-scan buat dikelompokkan jadi invoice

/************************************************
 * CEK HAK AKSES: sama kayak Log Produk, cuma "All"
 ************************************************/
function wmsBisaAksesLogMutasi(akses) {
  return akses === "All";
}

/************************************************
 * RENDER HALAMAN
 ************************************************/
function renderWmsLogMutasiPage(session, token) {
  const template = HtmlService.createTemplateFromFile("WmsLogMutasiView");
  template.token = token;
  template.username = session.username;
  template.akses = session.akses;
  template.execUrl = ScriptApp.getService().getUrl();

  return template.evaluate()
    .setTitle("Log Mutasi - WMS Chocochips")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/************************************************
 * AMBIL DATA LOG MUTASI (dikelompokkan per Invoice)
 ************************************************/
function getWmsLogMutasiData(token) {
  try {
    const session = getWmsSessionFromToken(token);
    if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
    if (!wmsBisaAksesLogMutasi(session.akses)) return { success: false, message: "Akun kamu tidak punya akses ke Log Mutasi." };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetByNameCI_WMS(ss, SHEET_LOG_PRODUCT_WMS);
    if (!sheet) return { success: false, message: "Sheet 'Log Product' tidak ditemukan." };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, data: [] };

    // Cari baris terakhir yang beneran ada isinya (sama kayak di Log Produk)
    const kolomSku = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    let lastRealRow = 1;
    for (let i = kolomSku.length - 1; i >= 0; i--) {
      if (String(kolomSku[i][0] || "").trim() !== "") {
        lastRealRow = i + 2;
        break;
      }
    }
    if (lastRealRow < 2) return { success: true, data: [] };

    const jumlahDiambil = Math.min(BUFFER_BARIS_MUTASI, lastRealRow - 1);
    const startRow = lastRealRow - jumlahDiambil + 1;
    const values = sheet.getRange(startRow, 1, jumlahDiambil, 10).getValues();

    const grouped = {}; // { noInvoice: {...} }
    const urutanInvoice = [];

    values.forEach(function (row) {
      try {
        const sku = String(row[1] || "").trim();
        const invoice = String(row[3] || "").trim();
        if (!sku || !invoice) return;

        const tanggalRaw = row[0];
        let tanggalMs = 0;
        let tanggalStr = "";
        try {
          const d = new Date(tanggalRaw);
          const ms = d.getTime();
          tanggalMs = isNaN(ms) ? 0 : ms;
          tanggalStr = (tanggalRaw && !isNaN(ms)) ? Utilities.formatDate(d, "Asia/Jakarta", "dd MMM yyyy") : String(tanggalRaw || "");
        } catch (e) {
          tanggalMs = 0;
          tanggalStr = String(tanggalRaw || "");
        }

        const lokasi = String(row[2] || "").trim();
        const operator = String(row[4] || "").trim();
        const type = String(row[5] || "").trim();
        const keterangan = String(row[6] || "").trim();
        const area = String(row[7] || "").trim();

        if (!grouped[invoice]) {
          grouped[invoice] = {
            invoice: invoice,
            tanggal: tanggalMs,
            tanggalStr: tanggalStr,
            operator: operator,
            keterangan: keterangan,
            jumlahItem: 0,
            typeCount: {},
            lokasiSet: {},
            areaSet: {}
          };
          urutanInvoice.push(invoice);
        }

        const g = grouped[invoice];
        g.jumlahItem++;
        g.typeCount[type] = (g.typeCount[type] || 0) + 1;
        if (lokasi) g.lokasiSet[lokasi] = true;
        if (area) g.areaSet[area] = true;
        if (tanggalMs && (!g.tanggal || tanggalMs < g.tanggal)) g.tanggal = tanggalMs;
      } catch (errBaris) {
        // lewati baris bermasalah
      }
    });

    const daftar = urutanInvoice.map(function (inv) {
      const g = grouped[inv];

      // Type paling dominan buat invoice ini
      let tipeUtama = "";
      let maxCount = 0;
      Object.keys(g.typeCount).forEach(function (t) {
        if (g.typeCount[t] > maxCount) { maxCount = g.typeCount[t]; tipeUtama = t; }
      });

      return {
        invoice: g.invoice,
        tanggalStr: g.tanggalStr,
        tanggal: g.tanggal,
        operator: g.operator,
        keterangan: g.keterangan,
        jumlahItem: g.jumlahItem,
        type: tipeUtama,
        lokasi: Object.keys(g.lokasiSet).join(", "),
        area: Object.keys(g.areaSet).join(", ")
      };
    });

    // Terbaru dulu (berdasarkan urutan baris asli, dibalik)
    daftar.reverse();

    const daftarDitampilkan = daftar.slice(0, MAX_INVOICE_MUTASI_DITAMPILKAN);

    return { success: true, data: daftarDitampilkan };
  } catch (err) {
    return { success: false, message: "Terjadi error di server: " + err.message };
  }
}

/************************************************
 * BANGUN HTML PDF SURAT JALAN MUTASI UNTUK 1 INVOICE
 ************************************************/
function buildLogMutasiPdfHtml(noInvoice, rows) {
  const isiQr = "Invoice: " + noInvoice + " | Keterangan: " + (rows[0].keterangan || "-");
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=" + encodeURIComponent(isiQr);

  let rowsHtml = "";
  rows.forEach(function (r, i) {
    rowsHtml += `<tr>
      <td style="text-align:center;">${i + 1}</td>
      <td>${r.namaProduk}</td>
      <td>${r.size}</td>
      <td>${r.sku}</td>
      <td>${r.type}</td>
      <td>${r.area}</td>
      <td>${r.lokasi}</td>
    </tr>`;
  });

  return `<html><head><style>
    @page { size: A4; margin: 15mm; }
    body { font-family: Arial, sans-serif; color:#3A2A28; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #B5697A; padding-bottom:14px; margin-bottom:18px; }
    .header .judul h1 { margin:0; font-size:19px; color:#7A3E42; }
    .header .judul p { margin:2px 0 0; font-size:11px; color:#9C8481; }
    .info-table { width:100%; margin-bottom:18px; border-collapse:collapse; }
    .info-table td { padding:4px 0; font-size:13px; vertical-align:top; }
    .info-table td.label { width:130px; color:#9C8481; }
    table.items { width:100%; border-collapse:collapse; margin-bottom:20px; }
    table.items th { background:#FBF3EF; border:1px solid #ecdcd8; padding:7px; font-size:11.5px; text-align:left; }
    table.items td { border:1px solid #ecdcd8; padding:7px; font-size:12px; }
  </style></head><body>

    <div class="header">
      <div class="judul">
        <h1>SURAT JALAN MUTASI</h1>
        <p>Riwayat Mutasi / Stock Opname</p>
      </div>
      <img src="${qrUrl}" width="90" height="90" alt="QR" style="width:90px; height:90px; flex-shrink:0; display:block;">
    </div>

    <table class="info-table">
      <tr><td class="label">No Invoice</td><td><b>${noInvoice}</b></td></tr>
      <tr><td class="label">Tanggal</td><td>${rows[0].tanggalStr}</td></tr>
      <tr><td class="label">Operator</td><td>${rows[0].operator}</td></tr>
      <tr><td class="label">Keterangan</td><td>${rows[0].keterangan}</td></tr>
    </table>

    <table class="items">
      <thead>
        <tr>
          <th style="width:30px;">No</th>
          <th>Nama Produk</th>
          <th style="width:50px;">Size</th>
          <th style="width:110px;">SKU</th>
          <th style="width:60px;">Type</th>
          <th style="width:80px;">Area</th>
          <th style="width:90px;">Lokasi</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

  </body></html>`;
}

/************************************************
 * GENERATE PDF (dipanggil dari client)
 ************************************************/
function generateLogMutasiPdfBase64(token, noInvoice) {
  try {
    const session = getWmsSessionFromToken(token);
    if (!session) return { success: false, message: "Sesi tidak valid, silakan login ulang." };
    if (!wmsBisaAksesLogMutasi(session.akses)) return { success: false, message: "Akun kamu tidak punya akses." };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetByNameCI_WMS(ss, SHEET_LOG_PRODUCT_WMS);
    if (!sheet) return { success: false, message: "Sheet 'Log Product' tidak ditemukan." };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: "Data kosong." };

    const values = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
    const rows = [];

    values.forEach(function (row) {
      const invoiceRow = String(row[3] || "").trim();
      if (invoiceRow !== noInvoice) return;

      const tanggalRaw = row[0];
      let tanggalStr = "";
      try {
        tanggalStr = tanggalRaw ? Utilities.formatDate(new Date(tanggalRaw), "Asia/Jakarta", "dd MMM yyyy, HH:mm") : "";
      } catch (e) {
        tanggalStr = String(tanggalRaw || "");
      }

      rows.push({
        sku: String(row[1] || "").trim(),
        lokasi: String(row[2] || "").trim(),
        operator: String(row[4] || "").trim(),
        type: String(row[5] || "").trim(),
        keterangan: String(row[6] || "").trim(),
        area: String(row[7] || "").trim(),
        namaProduk: String(row[8] || "").trim(),
        size: String(row[9] || "").trim(),
        tanggalStr: tanggalStr
      });
    });

    if (rows.length === 0) return { success: false, message: "Invoice tidak ditemukan." };

    const html = buildLogMutasiPdfHtml(noInvoice, rows);
    const blob = Utilities.newBlob(html, "text/html", "log-mutasi.html").getAs("application/pdf");
    const base64 = Utilities.base64Encode(blob.getBytes());

    return { success: true, base64: base64 };
  } catch (err) {
    return { success: false, message: "Terjadi error di server: " + err.message };
  }
}