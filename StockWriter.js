/************************************************
 * FILE WRITE STOCK.GS
 *
 * Tulis hasil perhitungan ke Sheet Stock
 *
 * Kolom yang ditulis :
 * A = Lokasi
 * B = Area
 * C = SKU
 * D = Qty
 *
 * Kolom E-F :
 * Tidak disentuh
 *
 * REVISI (anti "jendela kosong" saat dibaca proses lain):
 * Versi sebelumnya HAPUS SEMUA isi lama DULU baru TULIS data
 * baru -- ada jeda nyata (bukan instan) di antara 2 langkah
 * itu di mana sheet STOCK kelihatan kosong/tidak lengkap.
 *
 * rebuildStock() dipanggil SANGAT SERING (tiap WA #IN/#OUT,
 * tiap submit Stock Opname, tiap approval Adjustment), dan
 * walau proses PENULIS sudah saling antre lewat LockService,
 * proses PEMBACA (getQtySistemSkuLokasi, loadStockMap di
 * StockAllocator.gs, getWmsStockOpnameInitData, dll) TIDAK
 * ikut lock itu -- jadi kalau kebetulan baca persis di jeda
 * itu, bisa dapat qty 0/salah padahal datanya sebenarnya ada.
 *
 * Sekarang urutannya dibalik: TULIS DULU data baru (menimpa
 * baris lama di posisi yang sama), BARU hapus SISA baris lama
 * yang lebih panjang dari data baru (kalau ada). Dengan ini:
 * - Kalau jumlah baris data baru >= data lama -> TIDAK ADA
 *   jendela kosong sama sekali, karena tidak ada yang perlu
 *   dihapus (setValues cukup menimpa semuanya).
 * - Kalau data baru lebih pendek (ada SKU/lokasi yang qty-nya
 *   jadi 0 & hilang dari daftar) -> jendela yang tersisa jauh
 *   lebih kecil & jinak, cuma baris "sisa" di ekor yang memang
 *   sudah seharusnya 0, bukan seluruh sheet kosong.
 ************************************************/
function writeStock(sheet, hasil) {

  const lastRow = sheet.getLastRow();
  const jumlahBarisLama = lastRow >= 2 ? (lastRow - 1) : 0;

  /************************************************
   * TULIS DATA BARU DULU (kalau ada)
   * Menimpa baris 2..(2+hasil.length-1) dengan data baru.
   ************************************************/
  if (hasil.length > 0) {
    sheet
      .getRange(
        2,
        1,
        hasil.length,
        4
      )
      .setValues(hasil);
  }

  /************************************************
   * BARU HAPUS SISA BARIS LAMA (kalau data baru lebih
   * pendek dari data lama). Kalau data baru >= data lama,
   * blok ini otomatis dilewati -- tidak ada apa pun yang
   * perlu dihapus.
   ************************************************/
  const barisSisaMulai = 2 + hasil.length;      // baris pertama yang jadi "sisa"
  const jumlahBarisSisa = jumlahBarisLama - hasil.length;

  if (jumlahBarisSisa > 0) {
    sheet
      .getRange(
        barisSisaMulai,
        1,
        jumlahBarisSisa,
        4
      )
      .clearContent();
  }

}