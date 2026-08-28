-- =========================================================================
-- SKEMA SUPABASE: PENERIMAAN PRODUKSI & PEMINJAMAN SEMENTARA (SPS)
-- Jalankan skrip ini di Supabase SQL Editor
-- =========================================================================

-- Hapus tabel lama jika ada agar skema kolom ter-update bersih
DROP TABLE IF EXISTS public.penerimaan_produksi CASCADE;
DROP TABLE IF EXISTS public.peminjaman CASCADE;

-- 1. TABEL PENERIMAAN PRODUKSI & KEDATANGAN BARANG
CREATE TABLE public.penerimaan_produksi (
    id BIGSERIAL PRIMARY KEY,
    tanggal_penerimaan DATE NOT NULL DEFAULT CURRENT_DATE,
    kategori VARCHAR(50) NOT NULL DEFAULT 'Lokal CMT', -- 'Lokal CMT', 'Kargo', dll
    no_surat_jalan VARCHAR(100) NOT NULL,
    kode_produksi VARCHAR(100) NOT NULL,
    warna VARCHAR(100) DEFAULT '',
    size VARCHAR(50) DEFAULT 'Default',
    qty INTEGER NOT NULL DEFAULT 1,
    foto_url TEXT DEFAULT '',
    keterangan TEXT DEFAULT '',
    operator VARCHAR(100) DEFAULT 'Operator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk pencarian cepat penerimaan produksi
CREATE INDEX idx_penerimaan_no_sj ON public.penerimaan_produksi (no_surat_jalan);
CREATE INDEX idx_penerimaan_kode_produksi ON public.penerimaan_produksi (kode_produksi);
CREATE INDEX idx_penerimaan_tanggal ON public.penerimaan_produksi (tanggal_penerimaan DESC);

-- 2. TABEL PEMINJAMAN SEMENTARA (SPS)
CREATE TABLE public.peminjaman (
    id BIGSERIAL PRIMARY KEY,
    no_peminjaman VARCHAR(50) NOT NULL,
    pic VARCHAR(150) NOT NULL,
    keperluan TEXT NOT NULL DEFAULT '',
    tanggal_pinjam DATE NOT NULL DEFAULT CURRENT_DATE,
    sku VARCHAR(100) NOT NULL,
    nama_produk VARCHAR(255) DEFAULT '',
    size VARCHAR(50) DEFAULT '-',
    qty INTEGER NOT NULL DEFAULT 1,
    lokasi VARCHAR(100) DEFAULT 'STUDIO',
    status VARCHAR(50) NOT NULL DEFAULT 'Dipinjam', -- 'Dipinjam', 'Dikembalikan', 'Dibatalkan'
    operator VARCHAR(100) DEFAULT '',
    tanggal_kembali TIMESTAMPTZ NULL,
    keterangan TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk pencarian cepat peminjaman
CREATE INDEX IF NOT EXISTS idx_peminjaman_no ON public.peminjaman (no_peminjaman);
CREATE INDEX IF NOT EXISTS idx_peminjaman_sku ON public.peminjaman (sku);
CREATE INDEX IF NOT EXISTS idx_peminjaman_status ON public.peminjaman (status);
CREATE INDEX IF NOT EXISTS idx_peminjaman_pic ON public.peminjaman (pic);
CREATE INDEX IF NOT EXISTS idx_peminjaman_created ON public.peminjaman (created_at DESC);

-- 3. HAK AKSES REST API & RLS
ALTER TABLE public.penerimaan_produksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peminjaman ENABLE ROW LEVEL SECURITY;

-- Allow anon & authenticated access (WMS Mini internal service)
CREATE POLICY "Allow all access to penerimaan_produksi" 
ON public.penerimaan_produksi FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all access to peminjaman" 
ON public.peminjaman FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

GRANT ALL ON TABLE public.penerimaan_produksi TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.peminjaman TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
