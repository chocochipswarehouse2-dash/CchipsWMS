/************************************************
 * KONFIGURASI PRINT
 ************************************************/
const ROWS_PER_PAGE_PRINT = 25; // ubah angka ini kalau perlu tuning (sudah dites sesuai cetak asli)

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // Menu Tunggal & Terpusat: WMS Operations
  ui.createMenu('📦 WMS Operations')
    .addItem('🖨️ Print SJ Refill Belum Terproses', 'bukaPDFUntukPrint')
    .addItem('📄 Cetak Surat Jalan Peminjaman', 'cetakSuratJalanPeminjamanViaMenu')
    .addSeparator()
    .addItem('📲 Kirim WhatsApp Refill Baru', 'kirimWA_Refill')
    .addItem('📲 Kirim WhatsApp Peminjaman Baru', 'kirimWaPeminjamanBaru')
    .addSeparator()
    .addItem('🧪 Test Simulasi Scan WA Masuk', 'menuTestSimulasiScanMasuk')
    .addItem('🔄 Hitung Ulang Seluruh Stok (Rebuild Stock)', 'menuRebuildStockManual')
    .addSeparator()
    .addItem('⚡ Sinkronkan Master Produk & Stok ke Supabase', 'menuSyncAllToSupabase')
    .addItem('📥 Tarik Data Penerimaan & Peminjaman ke Supabase', 'menuSyncAllSheetToSupabase')
    .addItem('⏱️ Pasang Auto-Sync Supabase ke Sheet (1 Menit)', 'setupSyncTrigger')
    .addItem('🧹 Bersihkan Cache WMS', 'menuBersihkanCacheManual')
    .addToUi();
}

function menuRebuildStockManual() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert('Konfirmasi Rebuild Stok', 'Apakah Anda yakin ingin menghitung ulang (Rebuild) seluruh saldo stok dari riwayat Log Product?', ui.ButtonSet.YES_NO);
  if (res !== ui.Button.YES) return;

  SpreadsheetApp.getActiveSpreadsheet().toast('Sedang menghitung ulang seluruh stok...', 'WMS Rebuild', 15);
  try {
    if (typeof rebuildStock === "function") {
      rebuildStock();
    }
    if (typeof bersihkanCacheProdukWms === "function") {
      bersihkanCacheProdukWms();
    }
    ui.alert('Sukses', 'Seluruh stok berhasil dihitung ulang dan disinkronkan ke sheet STOCK!', ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Error', 'Gagal menghitung ulang stok: ' + err.message, ui.ButtonSet.OK);
  }
}

function menuBersihkanCacheManual() {
  const ui = SpreadsheetApp.getUi();
  try {
    if (typeof bersihkanCacheProdukWms === "function") {
      bersihkanCacheProdukWms();
    }
    ui.alert('Sukses', 'Cache database WMS berhasil dibersihkan.', ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Error', 'Gagal membersihkan cache: ' + err.message, ui.ButtonSet.OK);
  }
}

/************************************************
 * AMBIL & GROUP DATA
 ************************************************/
function getDataToPrint() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Refill");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: "Tidak ada data pada sheet 'Refill'!" };

  const rawData = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  let dataWithIndex = rawData.map((row, i) => ({ row: row, originalRow: i + 2 }));

  // Catatan: sort manual by Lokasi/Nama Produk yang dulu ada di sini
  // sudah dihapus -- urutan tampil final sekarang ditentukan oleh
  // allocateAcrossGroups() di StockAllocator.gs (prioritas: Area
  // Warehouse -> rak A-Z -> KOLI/KOLIAN paling belakang), jadi
  // sort di titik ini jadi percuma dan dibuang biar tidak dobel kerja.

  let groups = {};
  dataWithIndex.forEach((item) => {
    let row = item.row;
    let noSJ = String(row[1]);
    let status = String(row[13]);

    if (noSJ !== "" && status.trim().toUpperCase() !== "PRINTED" && Number(row[7]) > 0) {
      if (!groups[noSJ]) groups[noSJ] = { sj: noSJ, tujuan: row[9], items: [], totalQty: 0, rows: [] };
      groups[noSJ].items.push({ nama: row[4], sku: row[5], qty: row[7], lokasi: row[11] });
      groups[noSJ].totalQty += Number(row[7]);
      groups[noSJ].rows.push(item.originalRow);
    }
  });

  if (Object.keys(groups).length === 0) return { error: "Tidak ada data baru untuk diprint!" };

  // Pecah tiap item ke lokasi-lokasi sesuai stok tersedia, LINTAS SEMUA SJ
  // dalam proses ini (prioritas: qty terkecil dulu), sekaligus urutkan
  // hasilnya buat picking (Area Warehouse dulu, rak A-Z, KOLI/KOLIAN
  // paling belakang). Tidak mengubah sheet manapun.
  allocateAcrossGroups(groups);

  const html = buildPrintHtml(groups);

  // Tandai semua baris yang ikut tercetak sebagai "PRINTED"
  for (let key in groups) {
    groups[key].rows.forEach(r => sheet.getRange(r, 14).setValue("PRINTED"));
  }

  let blob = Utilities.newBlob(html, "text/html", "picking.html").getAs("application/pdf");
  return "data:application/pdf;base64," + Utilities.base64Encode(blob.getBytes());
}

/************************************************
 * BANGUN HTML — 1 SJ = 1 rangkaian halaman terpisah
 * "Page X of Y" dihitung manual per-SJ (bukan global)
 ************************************************/
function buildPrintHtml(groups) {
  const logoUrl = "https://www.chocochips.co.id/assets/LOGO_CHOCOCHIPS_AI-NEW2.png";

  let allHtml = `<html><style>
    @page {
      size: A4;
      margin: 15mm;
    }
    body { font-family: Arial, sans-serif; }
    .sj-page {
      break-before: page;
      page-break-before: always;
    }
    .sj-page:first-child {
      break-before: auto;
      page-break-before: auto;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { background-color: #f2f2f2; border: 1px solid #000; padding: 5px; }
    td { border: 1px solid #000; padding: 5px; }
    .header-block { width: 100%; border: none; margin-bottom: 8px; }
    .header-block td { border: none; }
    .page-footer { text-align: right; font-size: 10px; margin-top: 5px; }
  </style><body>`;

  for (let key in groups) {
    let g = groups[key];

    // Pecah items jadi chunk per halaman
    const chunks = [];
    for (let i = 0; i < g.items.length; i += ROWS_PER_PAGE_PRINT) {
      chunks.push(g.items.slice(i, i + ROWS_PER_PAGE_PRINT));
    }
    const totalPagesThisSJ = chunks.length;

    const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=80x80&data="
      + encodeURIComponent("#OUT " + g.tujuan + " " + g.sj);

    chunks.forEach((chunkItems, pageIdx) => {
      const pageNumber = pageIdx + 1;
      const isLastChunkOfSJ = (pageIdx === chunks.length - 1);

      allHtml += `<div class="sj-page">`;

      allHtml += `<table class="header-block">
        <tr>
          <td style="text-align:left; vertical-align:top;">
            <img src="${logoUrl}" style="width:240px; margin-bottom:5px;" /><br>
            <div style="font-size:20px;"><b>${g.tujuan}</b></div>
            <div style="font-size:16px;"><b>No: ${g.sj}</b></div>
          </td>
          <td style="text-align:right; vertical-align:top;">
            <img src="${qrUrl}" width="80" height="80">
          </td>
        </tr>
      </table>`;

      allHtml += `<table>
        <thead>
          <tr><th>NO</th><th>NAME</th><th>CODE</th><th>QTY</th><th>LOC</th></tr>
        </thead>
        <tbody>`;

      chunkItems.forEach((item, i) => {
        const nomorUrut = pageIdx * ROWS_PER_PAGE_PRINT + i + 1;
        allHtml += `<tr>
          <td style="text-align:center;">${nomorUrut}</td>
          <td>${item.nama}</td>
          <td>${item.sku}</td>
          <td style="text-align:center;">${item.qty}</td>
          <td style="text-align:center;">${item.lokasi}</td>
        </tr>`;
      });

      // Total cuma tampil di halaman terakhir SJ ini
      if (isLastChunkOfSJ) {
        allHtml += `<tr>
          <td colspan="3" style="text-align:right; font-weight:bold;">Total</td>
          <td style="text-align:center; font-weight:bold;">${g.totalQty}</td>
          <td></td>
        </tr>`;
      }

      allHtml += `</tbody></table>`;

      allHtml += `<div class="page-footer">Page ${pageNumber} of ${totalPagesThisSJ}</div>`;

      allHtml += `</div>`; // .sj-page
    });
  }

  allHtml += "</body></html>";
  return allHtml;
}

function bukaPDFUntukPrint() {
  var html = HtmlService.createHtmlOutput(
    '<script>google.script.run.withSuccessHandler(res => {' +
    '  if(res.error) { alert(res.error); return; }' +
    '  var win = window.open(); win.document.write("<iframe src=\'" + res + "\' style=\'width:100%; height:100%; border:none;\'></iframe>");' +
    '  setTimeout(() => { win.print(); }, 1500);' +
    '}).getDataToPrint();</script>'
  ).setWidth(300).setHeight(100);
  SpreadsheetApp.getUi().showModalDialog(html, 'Proses Print...');
}