-- ============================================================================
-- SQL SCRIPT UNTUK MENGISI NAMA PRODUK & SIZE DATA LAMA DI SUPABASE
-- Jalankan script ini di menu "SQL Editor" pada Supabase Dashboard Anda
-- ============================================================================

-- 1. Buka akses RLS tabel master_produk agar dapat disinkronkan
ALTER TABLE master_produk DISABLE ROW LEVEL SECURITY;

-- 2. Update seluruh baris transaksi lama di log_produk yang nama/size masih kosong atau masih berupa SKU
UPDATE log_produk lp
SET 
  nama_produk = mp.nama_produk,
  size = COALESCE(NULLIF(mp.size, ''), '-')
FROM master_produk mp
WHERE UPPER(TRIM(lp.sku)) = UPPER(TRIM(mp.sku))
  AND (lp.size IS NULL OR lp.size = '-' OR lp.nama_produk IS NULL OR lp.nama_produk = lp.sku);

-- 3. Update antrean stock opname lama jika ada yang masih berupa SKU
UPDATE stock_opname_queue so
SET 
  nama_produk = mp.nama_produk,
  size = COALESCE(NULLIF(mp.size, ''), '-')
FROM master_produk mp
WHERE UPPER(TRIM(so.sku)) = UPPER(TRIM(mp.sku))
  AND (so.size IS NULL OR so.size = '-' OR so.nama_produk IS NULL OR so.nama_produk = so.sku);

-- 4. Tampilkan status hasil update
SELECT 
  COUNT(*) AS total_log_terisi,
  COUNT(CASE WHEN size IS NOT NULL AND size <> '-' THEN 1 END) AS total_size_valid
FROM log_produk;
