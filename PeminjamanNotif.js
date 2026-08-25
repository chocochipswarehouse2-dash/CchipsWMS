function onEdit(e) {
  if (!e) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== "Peminjaman") return;

  // Ubah kondisi agar merespons perubahan di Kolom K (11) tanpa bergantung mutlak pada e.value
  if (e.range.getColumn() === 11) {
    SpreadsheetApp.flush();
    kirimWaPeminjamanBaru();
  }
}

function kirimWaPeminjamanBaru() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetPeminjaman = ss.getSheetByName("Peminjaman");
  const sheetUsers = ss.getSheetByName("Users");
  
  if (!sheetPeminjaman || !sheetUsers) return;

  const usersData = sheetUsers.getDataRange().getValues();
  let phoneMap = {};
  for (let i = 1; i < usersData.length; i++) {
    let key = String(usersData[i][0]).trim().toLowerCase();
    let noHp = String(usersData[i][3]).trim();
    if (key) {
      phoneMap[key] = noHp;
    }
  }

  const lastRow = sheetPeminjaman.getLastRow();
  if (lastRow < 2) return;
  
  // Naikkan rentang pembacaan kolom menjadi 16 agar mencakup Kolom P
  const data = sheetPeminjaman.getRange(2, 1, lastRow - 1, 16).getValues();

  let groupedInvoices = {};

  data.forEach((row, index) => {
    let rowIndex = index + 2;
    
    // =========================================================================
    // PASTIKAN INDEX KOLOM SESUAI (Array dimulai dari 0: Kolom A=0, B=1, dst)
    // =========================================================================
    let pic = String(row[2]).trim();          // Kolom C: Nama/PIC Peminjam
    let keperluan = String(row[3]).trim();    // Kolom D: Keperluan (Ubah angka 3 jika salah)
    let rawTanggal = row[4];                  // Kolom E: Tanggal Peminjaman (Ubah angka 4 jika salah)
    let namaProduk = String(row[6]).trim();   // Kolom G: Nama Produk
    let qty = row[9];                         // Kolom J: Qty
    let noPeminjaman = String(row[10]).trim();// Kolom K: No Peminjaman
    let emailPengirim = String(row[12]).trim();// Kolom M: Email Google pengirim
    let lokasi = String(row[13]).trim();      // Kolom N: Lokasi
    let statusWa = String(row[14]).trim();    // Kolom O: Sent WA
    // =========================================================================

    // Format Tanggal Peminjaman agar rapi (cth: "01 August 2026")
    let tglPeminjaman = "";
    if (rawTanggal instanceof Date) {
      tglPeminjaman = Utilities.formatDate(rawTanggal, "GMT+7", "dd MMMM yyyy");
    } else {
      tglPeminjaman = String(rawTanggal || "").trim();
    }

    // Proses jika nomor peminjaman ada dan status WA di kolom O masih kosong
    if (noPeminjaman && statusWa === "") {
      if (!groupedInvoices[noPeminjaman]) {
        groupedInvoices[noPeminjaman] = {
          pic: pic,
          email: emailPengirim,
          keperluan: keperluan,
          tanggal: tglPeminjaman,
          rows: [],
          itemsPersonal: [],
          itemsGroup: []
        };
      }
      groupedInvoices[noPeminjaman].rows.push(rowIndex);
      groupedInvoices[noPeminjaman].itemsPersonal.push(`- ${namaProduk} (Qty: ${qty})`);
      
      let itemBlock = `📦 ${namaProduk}\n🔢 Qty: ${qty} pcs | 📍 Lokasi: ${lokasi}`;
      groupedInvoices[noPeminjaman].itemsGroup.push(itemBlock);
    }
  });

  const tokenFonnte = "PXUrcmHugrZyM14XBdGj"; 
  // Pastikan targetGroup menggunakan format ID Grup Fonnte (contoh: ...@g.us) jika ini adalah Grup WhatsApp
  const targetGroup = "120363410159735625@g.us"; 

  for (let noPj in groupedInvoices) {
    let group = groupedInvoices[noPj];
    
    // 1. Kirim pesan ke PIC Personal
    let searchKey1 = group.pic.toLowerCase();
    let searchKey2 = group.email.split("@")[0].toLowerCase();
    let targetPhone = phoneMap[searchKey1] || phoneMap[searchKey2];

    if (targetPhone) {
      let pesanPersonal = `Halo Ka ${group.pic},\n` +
                          `Pengajuan peminjaman produk kamu\n\n` +
                          `No Invoice : ${noPj}\n` +
                          `Keperluan  : ${group.keperluan}\n` +
                          `Tanggal    : ${group.tanggal}\n\n` +
                          `Daftar Produk:\n` +
                          `*` + group.itemsPersonal.join("\n") + `*\n` +  
                          `\nTelah kami terima dan akan segera diproses ya`;

      sendFonnteMessage(targetPhone, pesanPersonal, tokenFonnte);
    }

    // 2. Kirim pesan ke Grup Gudang
    let pesanGrup = `@vina @yesi @novi @ria @nur\n` +
                    `@eka Cetak SJ Peminjamannya ya\n\n` +                     
                    `*PEMINJAMAN BARU*\n` +
                    `PIC: ${group.pic}\n` +
                    `No Invoice: ${noPj}\n` +
                    `Keperluan: ${group.keperluan}\n` +
                    `Tanggal: ${group.tanggal}\n\n` +
                    group.itemsGroup.join("\n\n");

    let successGroup = sendFonnteMessage(targetGroup, pesanGrup, tokenFonnte);

    // Kolom O (15) = status WA -- SENT kalau berhasil, FAILED kalau gagal
    group.rows.forEach(r => {
      sheetPeminjaman.getRange(r, 15).setValue(successGroup ? "SENT" : "FAILED");
    });

    // 3. Kirim email SJ PDF Peminjaman ke alamat-alamat di Script Properties
    // (dilakukan terpisah dari sukses/gagalnya WA -- email tetap dicoba jalan)
    // Kolom P (16) = status email -- SENT kalau berhasil, FAILED kalau gagal
    try {
      const successEmail = kirimEmailSuratJalanPeminjaman(noPj, group.pic);
      group.rows.forEach(r => {
        sheetPeminjaman.getRange(r, 16).setValue(successEmail ? "SENT" : "FAILED");
      });
    } catch (errEmail) {
      Logger.log("Gagal kirim email SJ Peminjaman untuk " + noPj + ": " + errEmail.message);
      group.rows.forEach(r => {
        sheetPeminjaman.getRange(r, 16).setValue("FAILED");
      });
    }
  }
}

/************************************************
 * KIRIM EMAIL SJ PDF PEMINJAMAN
 * Alamat tujuan diambil dari Script Properties,
 * key: EMAIL_SJ_PEMINJAMAN
 * Format value: bisa 1 alamat, atau beberapa alamat
 * dipisah koma, contoh:
 *   "gudang@chocochips.com,admin@chocochips.com"
 *
 * Cara isi Script Properties:
 * Apps Script editor > Project Settings (ikon gerigi)
 * > scroll ke "Script Properties" > Add script property
 * > Property = EMAIL_SJ_PEMINJAMAN
 * > Value = alamat email (pisah koma kalau lebih dari 1)
 ************************************************/
function kirimEmailSuratJalanPeminjaman(noPeminjaman, namaPic) {
  const emailTujuan = PropertiesService.getScriptProperties().getProperty("EMAIL_SJ_PEMINJAMAN");

  if (!emailTujuan || !emailTujuan.trim()) {
    Logger.log("EMAIL_SJ_PEMINJAMAN belum diisi di Script Properties, email SJ dilewati.");
    return false;
  }

  const pdfBlob = generateSuratJalanPeminjamanPdf(noPeminjaman);
  if (!pdfBlob) {
    Logger.log("Gagal generate PDF SJ Peminjaman untuk " + noPeminjaman + " (invoice tidak ditemukan?), email dilewati.");
    return false;
  }

  pdfBlob.setName("SJ-Peminjaman-" + noPeminjaman + ".pdf");

  const subjek = "Surat Jalan Peminjaman - " + noPeminjaman;
  const isiEmail =
    "Halo,\n\n" +
    "Terlampir Surat Jalan Peminjaman untuk:\n" +
    "No Invoice : " + noPeminjaman + "\n" +
    "PIC        : " + namaPic + "\n\n" +
    "Dokumen ini dikirim otomatis oleh sistem WMS Chocochips.";

  try {
    MailApp.sendEmail({
      to: emailTujuan.trim(), // MailApp otomatis dukung banyak alamat dipisah koma dalam 1 string
      subject: subjek,
      body: isiEmail,
      attachments: [pdfBlob]
    });
    return true;
  } catch (errKirim) {
    Logger.log("MailApp.sendEmail gagal untuk " + noPeminjaman + ": " + errKirim.message);
    return false;
  }
}

function sendFonnteMessage(target, message, token) {
  const url = "https://api.fonnte.com/send";
  const payload = {
    "target": target,
    "message": message,
    "countryCode": "62"
  };

  const options = {
    "method": "post",
    "headers": {
      "Authorization": token
    },
    "payload": payload,
    "muteHttpExceptions": true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    return result.status === true || result.status === "true";
  } catch (error) {
    console.error("Gagal mengirim WA: " + error);
    return false;
  }
}