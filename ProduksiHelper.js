/************************************************
 * VALIDASI HEADER PRODUKSI
 ************************************************/
function isProduksiHeader(lines) {

  if (lines.length < 2) return false;

  const h1 = (lines[0] || "").trim().toUpperCase();
  const h2 = (lines[1] || "").trim().toUpperCase();

  return (
    h1 === "#PRODUKSI" &&
    h2.startsWith("#KET")
  );

}

/************************************************
 * AMBIL KETERANGAN
 ************************************************/
function getProduksiKeterangan(lines) {

  return (lines[1] || "")
    .replace(/^#KET/i, "")
    .trim();

}

/************************************************
 * AMBIL SUPPLIER
 * (#KET Kargo 29/06/2026 -> KARGO)
 ************************************************/
function getProduksiSupplier(keterangan) {

  keterangan = normalisasiProduksi(keterangan);

  if (keterangan === "") {
    return "";
  }

  return keterangan
    .split(" ")[0]
    .toUpperCase();

}

/************************************************
 * NORMALISASI SPASI
 ************************************************/
function normalisasiProduksi(text) {

  return String(text || "")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}

/************************************************
 * CEK BARIS #KODE
 ************************************************/
function isKodeProduksi(text) {

  return /^#KODE\b/i.test(
    normalisasiProduksi(text)
  );

}

/************************************************
 * AMBIL KODE PRODUKSI
 ************************************************/
function getKodeProduksi(text) {

  return normalisasiProduksi(text)
    .replace(/^#KODE/i, "")
    .trim();

}

/************************************************
 * DAFTAR SIZE
 ************************************************/
const PRODUKSI_SIZE = [

  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "4XL",
  "5XL",

  "FREE",
  "FREESIZE",
  "FREE SIZE",

  "ALL",
  "ALLSIZE",
  "ALL SIZE",

  "DEFAULT"

];

/************************************************
 * CEK SIZE
 ************************************************/
function isProduksiSize(text) {

  text = normalisasiProduksi(text).toUpperCase();

  return PRODUKSI_SIZE.indexOf(text) > -1;

}

/************************************************
 * NORMALISASI SIZE
 ************************************************/
function normalisasiProduksiSize(size) {

  size = normalisasiProduksi(size).toUpperCase();

  switch (size) {

    case "FREE":
    case "FREESIZE":
    case "FREE SIZE":
    case "ALL":
    case "ALLSIZE":
    case "ALL SIZE":
    case "DEFAULT":
      return "Default";

    default:
      return size;

  }

}

/************************************************
 * CEK ANGKA
 ************************************************/
function isQtyProduksi(text) {

  return /^\d+$/.test(
    normalisasiProduksi(text)
  );

}