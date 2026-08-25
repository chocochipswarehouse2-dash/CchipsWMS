const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const frontendDir = path.join(rootDir, 'frontend');

console.log('=== MEMULAI COMPILATION FRONTEND WMS ===');

// 1. Baca Master Shell WmsDashboard.html
let masterShell = fs.readFileSync(path.join(rootDir, 'WmsDashboard.html'), 'utf8');

// 2. Baca Komponen Form Login
const loginHtml = fs.readFileSync(path.join(rootDir, 'WmsLoginPage.html'), 'utf8');
let loginBody = '';
const loginWrapMatch = loginHtml.match(/<div class="login-wrap">[\s\S]*?<\/div>\s*<\/form>\s*<\/div>/i) 
  || loginHtml.match(/<div class="login-wrap">[\s\S]*?<\/div>/i);

if (loginWrapMatch) {
  loginBody = loginWrapMatch[0];
} else {
  const bodyMatch = loginHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  loginBody = bodyMatch ? bodyMatch[1] : loginHtml;
}

// 3. Mapping Daftar Views
const viewFiles = {
  'ViewKlasifikasi': 'ViewKlasifikasi.html',
  'ViewFulfillment': 'ViewFulfillment.html',
  'ViewPeminjaman': 'ViewPeminjaman.html',
  'ViewLogProduk': 'ViewLogProduk.html',
  'ViewLogMutasi': 'ViewLogMutasi.html',
  'ViewUpdateDatabase': 'ViewUpdateDatabase.html',
  'ViewStockOpname': 'ViewStockOpname.html',
  'ViewSetting': 'ViewSetting.html',
  'ViewPenerimaanProduksi': 'ViewPenerimaanProduksi.html'
};

// 4. Injeksi setiap View langsung ke posisi <?!= include('...') ?>
for (const [viewTag, viewFileName] of Object.entries(viewFiles)) {
  const viewFilePath = path.join(rootDir, viewFileName);
  if (fs.existsSync(viewFilePath)) {
    const viewContent = fs.readFileSync(viewFilePath, 'utf8');
    const includeRegex = new RegExp(`<\\?!=\\s*include\\(['"]${viewTag}['"]\\);?\\s*\\?>`, 'g');
    masterShell = masterShell.replace(includeRegex, `\n<!-- === VIEW: ${viewTag} === -->\n${viewContent}\n`);
  }
}

// 5. Injeksi Form Login ke dalam #loginScreen
masterShell = masterShell.replace(
  /<div id="loginScreen"[^>]*><\/div>/i,
  `<div id="loginScreen" style="display: none; align-items: center; justify-content: center; min-height: 100vh; width: 100%; padding: 20px;">\n${loginBody}\n</div>`
);

// 6. Injeksi Skrip Bridge & Auth ke dalam <head>
const bridgeScriptsHead = `
  <!-- Font Awesome Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <!-- WMS Core Standalone Bridge & Auth Controller -->
  <script src="js/config.js"></script>
  <script src="js/api.js"></script>
  <script src="js/auth.js"></script>
</head>`;

masterShell = masterShell.replace('</head>', bridgeScriptsHead);

// 7. Normalisasi Variabel Template & Token
masterShell = masterShell
  // TOKEN: gunakan var biasa yang baca window.TOKEN (sudah di-set auth.js dari localStorage)
  .replace(/const TOKEN\s*=\s*"<\?=\s*token\s*\?>";?/g, 'var TOKEN = window.TOKEN || localStorage.getItem(\'wms_token\') || sessionStorage.getItem(\'wms_token\') || "";')
  .replace(/const EXEC_URL\s*=\s*"<\?=\s*execUrl\s*\?>";?/g, 'var EXEC_URL = window.EXEC_URL || "";')
  .replace(/const AKSES\s*=\s*"<\?=\s*akses\s*\?>";?/g, 'var AKSES = window.AKSES || "All";')
  .replace(/const INITIAL_PAGE\s*=\s*"<\?=[\s\S]*?\?>";?/g, 'var INITIAL_PAGE = window.INITIAL_PAGE || "produk";')
  .replace(/<\?=\s*\(typeof username !== 'undefined' && username \? username\.charAt\(0\)\.toUpperCase\(\) : 'W'\)\s*\?>/g, 'W')
  .replace(/<\?=\s*\(typeof username !== 'undefined' && username \? username : 'WAREHOUSE'\)\s*\?>/g, 'WAREHOUSE')
  .replace(/<\?=\s*\(typeof akses !== 'undefined' && akses \? akses : 'All'\)\s*\?>/g, 'All')
  .replace(/<\?=\s*token\s*\?>/g, '')
  .replace(/<\?=\s*execUrl\s*\?>/g, '')
  .replace(/<\?=\s*akses\s*\?>/g, 'All')
  .replace(/<\?=\s*username\s*\?>/g, 'WAREHOUSE')
  .replace(/<\?=\s*supabaseUrl\s*\?>/g, 'https://filgijcfhgqlirzhvwho.supabase.co')
  .replace(/<\?=\s*supabaseAnonKey\s*\?>/g, 'sb_publishable_L4FEkugwRKqcwFzLXfpZag_aByUy5mD')
  .replace(/<\?!=[\s\S]*?\?>/g, '')
  .replace(/<\?=[\s\S]*?\?>/g, '');

// Ganti redirect window.top.location.href di inline handler agar mulus di GitHub Pages
masterShell = masterShell
  .replace(/window\.top\.location\.href\s*=\s*EXEC_URL\s*\+\s*'\?logout=1';?/g, 'if (typeof logoutWms === "function") { logoutWms(); } else if (typeof setAppVisible === "function") { setAppVisible(false); }')
  .replace(/window\.top\.location\.href\s*=\s*redirectUrl;?/g, 'if (typeof handleLoginSuccess === "function") { handleLoginSuccess(res); } else if (typeof setAppVisible === "function") { setAppVisible(true); }');

// Hapus panggilan muatDataProduk(false) yang duplikat dari inline WmsDashboard
// (auth.js setAppVisible() sudah memanggil muatDataProduk(false) setelah login berhasil)
masterShell = masterShell
  .replace(/window\.muatDataProduk\s*=\s*muatDataProduk;\s*\n\s*muatDataProduk\(false\);/g,
           'window.muatDataProduk = muatDataProduk;');

// Perbaiki URL history push untuk GitHub Pages (EXEC_URL kosong, gunakan path relatif)
masterShell = masterShell
  .replace(
    /const newUrl = EXEC_URL \+ '\?token=' \+ encodeURIComponent\(TOKEN\) \+ '&page=' \+ encodeURIComponent\(pageCode\);/g,
    `const newUrl = (window.EXEC_URL && !window.EXEC_URL.includes('script.google.com')) ? (window.EXEC_URL + '?page=' + encodeURIComponent(pageCode)) : ('?page=' + encodeURIComponent(pageCode));`
  );

// 8. Generator untuk Halaman SPA Spesifik
function buildPage(defaultPageCode) {
  const initScript = `
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      window.INITIAL_PAGE = "${defaultPageCode}";
      if (typeof checkAuthSession === 'function') {
        checkAuthSession();
      }
    });
  </script>
</body>`;

  return masterShell.replace('</body>', initScript);
}

// Pastikan direktori tujuan tersedia
fs.mkdirSync(path.join(rootDir, 'js'), { recursive: true });
fs.mkdirSync(path.join(rootDir, 'css'), { recursive: true });
fs.mkdirSync(path.join(frontendDir, 'js'), { recursive: true });
fs.mkdirSync(path.join(frontendDir, 'css'), { recursive: true });

// Copy assets ke frontend/
fs.copyFileSync(path.join(rootDir, 'js', 'config.js'), path.join(frontendDir, 'js', 'config.js'));
fs.copyFileSync(path.join(rootDir, 'js', 'api.js'), path.join(frontendDir, 'js', 'api.js'));
fs.copyFileSync(path.join(rootDir, 'js', 'auth.js'), path.join(frontendDir, 'js', 'auth.js'));

// Tulis Halaman Root & frontend/
const pages = [
  { file: 'index.html', page: 'produk' },
  { file: 'peminjaman.html', page: 'peminjaman' },
  { file: 'penerimaanproduksi.html', page: 'penerimaanproduksi' },
  { file: 'fulfillment.html', page: 'fulfillment' }
];

for (const p of pages) {
  const content = buildPage(p.page);
  fs.writeFileSync(path.join(rootDir, p.file), content, 'utf8');
  fs.writeFileSync(path.join(frontendDir, p.file), content, 'utf8');
  console.log(`✓ Berhasil generate ${p.file} (Default: ${p.page})`);
}

console.log('=== COMPILATION SUKSES! ===');
