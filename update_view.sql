-- =========================================================================
-- VIEW STOK REALTIME (Aman dari duplikasi / Cartesian Product)
-- Menghitung saldo mutasi langsung dari log_produk per (sku, area, lokasi)
-- =========================================================================
DROP VIEW IF EXISTS public.view_stok_realtime CASCADE;

CREATE VIEW public.view_stok_realtime AS
WITH ringkasan_log AS (
    SELECT 
        lp.sku,
        lp.area,
        lp.lokasi,
        MAX(lp.nama_produk) AS nama_produk_log,
        MAX(lp.size) AS size_log,
        SUM(
            CASE 
                WHEN lp.type IN ('IN', 'ADJ_IN', 'KEMBALI') THEN lp.qty 
                WHEN lp.type IN ('OUT', 'ADJ_OUT', 'PINJAM') THEN -lp.qty 
                ELSE 0 
            END
        ) AS sisa_stok
    FROM 
        public.log_produk lp
    GROUP BY 
        lp.sku, lp.area, lp.lokasi
),
master_unik AS (
    SELECT DISTINCT ON (sku)
        sku,
        nama_produk,
        size
    FROM 
        public.master_produk
    ORDER BY sku
)
SELECT 
    r.sku,
    COALESCE(m.size, r.size_log, '-') AS size,
    COALESCE(m.nama_produk, r.nama_produk_log, r.sku) AS nama_produk,
    r.area,
    r.lokasi,
    r.sisa_stok
FROM 
    ringkasan_log r
LEFT JOIN 
    master_unik m ON r.sku = m.sku;

