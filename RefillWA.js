function kirimWA_Refill() {
  const namaSheet = "Refill";
  const token = "PXUrcmHugrZyM14XBdGj";
  const target = "120363410159735625@g.us";

  // Konfigurasi Kolom (Tetap sama, + tambahan colSKU)
  const colSJ      = 1; // Kolom B (index1)
  const colProduk  = 4; // Kolom E (index4) - Nama Produk
  const colSKU     = 5; // Kolom F (index5) - SKU (BARU, dibutuhkan untuk alokasi lokasi)
  const colOutlet  = 9; // Kolom J (index9)
  const colQty     = 7; // Kolom H (index7)
  const colLokasi  = 11;// Kolom L (index11) - info lokasi (array formula, TIDAK dipakai lagi untuk kirim,
                        //                      hanya sebagai referensi visual di sheet)
  const colStatus  = 12;// Kolom M (index12)

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(namaSheet);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  let groups = {};

  data.forEach((row, index) => {
    let sj = row[colSJ];
    let outlet = row[colOutlet];
    let status = String(row[colStatus]);
    let qty = row[colQty];

    let key = sj + "_" + outlet;

    if (sj !== "" && status.trim() !== "Sent" && qty > 0) {
      if (!groups[key]) groups[key] = { sj: sj, outlet: outlet, items: [] };
      groups[key].items.push({
        nama: row[colProduk],
        sku: row[colSKU],
        qty: qty,
        rowIndex: index + 2
      });
    }
  });

  if (Object.keys(groups).length === 0) {
    try {
      SpreadsheetApp.getUi().alert("Tidak ada data baru untuk dikirim.");
    } catch (e) {
      Logger.log("Tidak ada data baru untuk dikirim.");
    }
    return;
  }

  // Pecah tiap item ke lokasi-lokasi sesuai stok tersedia, LINTAS SEMUA SJ
  // dalam proses ini (prioritas: qty terkecil dulu). Tidak mengubah sheet manapun.
  allocateAcrossGroups(groups);

  for (let key in groups) {
    let group = groups[key];
    let pesan = `*PICKING LIST - REFILL*\n`;
    pesan += `*SJ: ${group.sj}*\n`;
    pesan += `*Outlet: ${group.outlet}*\n\n`;

    group.items.forEach(item => {
      pesan += `📦 ${item.nama}\n🔢 Qty: ${item.qty} pcs | 📍 Lokasi: ${item.lokasi}\n\n`;
    });

    const options = {
      method: "post",
      payload: { "target": target, "message": pesan },
      headers: { "Authorization": token },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch("https://api.fonnte.com/send", options);
    const result = JSON.parse(response.getContentText());

    if (result.status === true) {
      // Tandai status "Sent" berdasarkan rowIndex ASLI (bukan baris hasil pecahan),
      // supaya tidak ada baris asli yang double-mark atau tertinggal.
      const rowIndexUnik = new Set(group.items.map(item => item.rowIndex));
      rowIndexUnik.forEach(r => {
        sheet.getRange(r, colStatus + 1).setValue("Sent");
      });
    }
  }
  SpreadsheetApp.getActiveSpreadsheet().toast("Selesai kirim Refill");
}