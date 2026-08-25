# Frontend WMS Mini (Chocochips Warehouse)

Aplikasi Web Standalone untuk **Warehouse Management System (WMS) Chocochips**, siap dideploy di GitHub Pages / Static Web Hosting.

---

## 📁 Struktur File Frontend

```text
frontend/
├── index.html              <-- Main Single Page Application (SPA)
├── css/
│   └── style.css           <-- Unified modern styling (Dark/Light mode, responsive)
└── js/
    ├── config.js           <-- Konfigurasi URL Google Apps Script & Supabase
    ├── api.js              <-- API Bridge & fetch polyfill (pengganti google.script.run)
    ├── auth.js             <-- Session controller, token & user permissions
    └── modules/            <-- Modul fungsional WMS
        ├── dashboard.js            (Master Inventory & KPI)
        ├── login.js                (Autentikasi Login)
        ├── peminjaman.js           (Form Peminjaman SPS & Live Stock)
        ├── penerimaanproduksi.js   (Penerimaan Produksi & Barcode Roll)
        ├── fulfillment.js          (Fulfillment & Refill Toko/Live)
        ├── stockopname.js          (Stock Opname & Scanner Barcode)
        ├── logproduk.js            (Riwayat Log Produk)
        ├── logmutasi.js            (Riwayat Log Mutasi)
        ├── klasifikasi.js          (Monitoring & Klasifikasi)
        ├── updatedatabase.js       (Sinkronisasi Master Database)
        └── setting.js              (Manajemen User & Hak Akses)
```

---

## 🚀 Panduan Deploy ke GitHub Pages

### Langkah 1: Hubungkan ke Google Apps Script Backend
1. Buka file [`js/config.js`](file:///d:/GAS%20WMS%20Mini/frontend/js/config.js).
2. Isi `GAS_API_URL` dengan URL Web App Deployment Google Apps Script Anda (akhiran `/exec`):
   ```javascript
   GAS_API_URL: "https://script.google.com/macros/s/AKfycb.../exec",
   ```
3. Pastikan di Google Apps Script:
   * **Deploy** > **Manage deployments** > **Edit / New Version**.
   * **Who has access**: `Anyone` (*Siapa saja*).

### Langkah 2: Upload / Push Folder `frontend/` ke GitHub
Anda bisa meng-upload seluruh isi folder `frontend/` ke repository GitHub Anda (bisa di root repo atau branch `gh-pages` / folder `/docs`).

### Langkah 3: Aktifkan GitHub Pages
1. Di repository GitHub Anda, buka menu **Settings** > **Pages**.
2. Pada bagian **Build and deployment**:
   * **Source**: `Deploy from a branch`
   * **Branch**: `main` (atau `gh-pages`) / folder `/ (root)`.
3. Klik **Save**.
4. Website WMS Mini Anda akan langsung live di URL: `https://<username>.github.io/<repo-name>/`.

---

## 🔒 Keamanan & Data
* Semua panggilan data menggunakan token sesi aman yang disimpan di `localStorage` / `sessionStorage`.
* Sistem dilengkapi sinkronisasi realtime dengan **Supabase Database** untuk pembaruan inventori langsung secara instan.
