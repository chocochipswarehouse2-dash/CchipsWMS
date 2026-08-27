CREATE OR REPLACE VIEW public.view_stok_realtime AS
SELECT 
    lp.sku,
    COALESCE(mp.size, lp.size) AS size,
    COALESCE(mp.nama_produk, lp.nama_produk) AS nama_produk,
    lp.area,
    lp.lokasi,
    SUM(
        CASE 
            WHEN lp.type IN ('IN', 'ADJ_IN', 'KEMBALI') THEN lp.qty 
            WHEN lp.type IN ('OUT', 'ADJ_OUT', 'PINJAM') THEN -lp.qty 
            ELSE 0 
        END
    ) AS sisa_stok
FROM 
    public.log_produk lp
LEFT JOIN 
    public.master_produk mp ON lp.sku = mp.sku
GROUP BY 
    lp.sku, mp.size, lp.size, mp.nama_produk, lp.nama_produk, lp.area, lp.lokasi;
