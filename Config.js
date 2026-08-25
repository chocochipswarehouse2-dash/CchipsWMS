/************************************************
 * FILE CONFIG.GS (WMS Chocochips v715)
 ************************************************/

// ===================================================
// MUTASI
// ===================================================
const SPREADSHEET_ID = "1kkjkKiqU39PnIWQhED1sLfH5uX349_vgqcs2qTpYixQ";
const SHEET_NAME = "Mutasi";

const ALLOWED_GROUPS = [
  "120363427883208118@g.us",
  "120363409655838712@g.us"
];

// ===================================================
// CCTV
// ===================================================
const SPREADSHEET_ID_CCTV = "1MbvxnMqT0YI5Jj9euOx_hUUTz7GcwCh0y3X2eDnmcVo";
const SHEET_NAME_CCTV = "CCTV";

const ALLOWED_GROUPS_CCTV = [
  "120363408697377629@g.us"
];

// ===================================================
// QC
// ===================================================
const SHEET_NAME_QC = "Laporan QC";

const ALLOWED_GROUPS_QC = [
  "120363427883208118@g.us",
  "120363409655838712@g.us",
  "6289651864089-1537358005@g.us"
];

// ===================================================
// PRODUKSI
// ===================================================
const SHEET_NAME_PRODUKSI = "Produksi";

const ALLOWED_GROUPS_PRODUKSI = [
  "120363427883208118@g.us",
  "120363409655838712@g.us"
];

// ===================================================
// STOCK OPNAME
// ===================================================
const SHEET_NAME_LOG_PRODUCT = "Log Product";

const ALLOWED_GROUPS_LOG_PRODUCT = [
  "120363426359702090@g.us",
  "120363430508883535@g.us",
  "120363410159735625@g.us",
  "120363410565626286@g.us"
];

/************************************************
 * AREA LOKASI
 ************************************************/

const AREA_BLOK_F = [
  "STUDIO",
  "SHOPEE",
  "TIKTOK",
  "PEMINJAMAN"
];

const AREA_PERBAIKAN = [
  "PERMAK",
  "CUCI",
  "DEFECT"
];

const AREA_AKSESORIS = [
  "BELT",
  "ACC"
];

/************************************************
 * TYPE
 ************************************************/

const TYPE_SO = "SO";
const TYPE_IN = "IN";
const TYPE_OUT = "OUT";

const KETERANGAN_SO = "Stock Opname";

// ===================================================
// UMUM
// ===================================================
const TIMEZONE = "Asia/Jakarta";

const PREFIX_INVOICE = "INV";
const PREFIX_CCTV = "CCTV";
const PREFIX_QC = "QC";

// ===================================================
// ADJUSTMENT (hasil Stock Opname / adjustment manual
// yang BUTUH APPROVAL sebelum stok sistem berubah)
// ===================================================
const SHEET_NAME_ADJUSTMENT = "Stock Opname"; // buat manual sheet ini, lihat SKEMA_SHEET_STOCK_OPNAME.md

const TYPE_ADJ_IN = "ADJ_IN";
const TYPE_ADJ_OUT = "ADJ_OUT";
const KETERANGAN_ADJUSTMENT_OPNAME = "Adjustment - Stock Opname";
const KETERANGAN_ADJUSTMENT_MANUAL = "Adjustment - Manual";

const STATUS_ADJ_PENDING = "Pending";
const STATUS_ADJ_APPROVED = "Approved";
const STATUS_ADJ_REJECTED = "Rejected";

const JENIS_ADJ_OPNAME = "Opname";
const JENIS_ADJ_MANUAL = "Manual";

// GANTI dengan alamat email tujuan rekap selisih stock opname/adjustment.
// Bisa lebih dari satu, pisahkan dengan koma: "a@x.com,b@x.com"
const EMAIL_REKAP_ADJUSTMENT = "ISI-EMAIL-ANDA@example.com";

const PREFIX_ADJUSTMENT = "ADJ";
const PROP_ADJUSTMENT_COUNTER = "ADJUSTMENT_COUNTER";

/************************************************
 * GENERATE NO SESI / INVOICE ADJUSTMENT
 * Format: ADJ-000001
 ************************************************/
function getAdjustmentInvoice() {
  const props = PropertiesService.getScriptProperties();
  let n = Number(props.getProperty(PROP_ADJUSTMENT_COUNTER) || 0);
  n++;
  props.setProperty(PROP_ADJUSTMENT_COUNTER, n);
  return PREFIX_ADJUSTMENT + "-" + String(n).padStart(6, "0");
}