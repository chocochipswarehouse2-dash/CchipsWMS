/**
 * ONE-CLICK MASTER BUILD & DEPLOYMENT SCRIPT
 * Otomatis meng-compile frontend, push ke Google Apps Script backend,
 * dan push ke GitHub repository untuk auto-deploy GitHub Pages!
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const frontendDir = path.join(rootDir, 'frontend');
const DEPLOYMENT_ID = "AKfycbyFxfqoqJhrPJOioPxnmbGJTjTTAwli6b87lgOQCPFDOoCVt5EJg3NHZT56zI52rM63";
const GITHUB_REPO = "https://github.com/chocochipswarehouse2-dash/CchipsWMS.git";

function run(cmd, cwd = rootDir) {
  console.log(`\n> [EXEC] ${cmd} (in ${cwd})`);
  return execSync(cmd, { cwd, stdio: 'inherit' });
}

function extractTags(content, tagName) {
  const openTag = `<${tagName}>`;
  const closeTag = `</${tagName}>`;
  const results = [];
  let pos = 0;
  while (true) {
    let start = content.toLowerCase().indexOf(openTag, pos);
    let tagEnd = -1;
    if (start === -1) {
      const startWithAttr = content.toLowerCase().indexOf(`<${tagName} `, pos);
      if (startWithAttr === -1) {
        const startWithAttr2 = content.toLowerCase().indexOf(`<${tagName}\n`, pos);
        if (startWithAttr2 === -1) break;
        tagEnd = content.indexOf('>', startWithAttr2);
        if (tagEnd === -1) break;
        start = startWithAttr2;
      } else {
        tagEnd = content.indexOf('>', startWithAttr);
        if (tagEnd === -1) break;
        start = startWithAttr;
      }
    } else {
      tagEnd = start + openTag.length - 1;
    }

    const end = content.toLowerCase().indexOf(closeTag, tagEnd);
    if (end === -1) break;
    
    const openSnippet = content.slice(start, tagEnd + 1);
    if (!openSnippet.includes('src=')) {
      results.push(content.slice(tagEnd + 1, end));
    }
    pos = end + closeTag.length;
  }
  return results;
}

function removeTags(content, tagName) {
  const closeTag = `</${tagName}>`;
  let result = '';
  let pos = 0;
  while (true) {
    let start = content.toLowerCase().indexOf(`<${tagName}`, pos);
    if (start === -1) {
      result += content.slice(pos);
      break;
    }
    
    let tagEnd = content.indexOf('>', start);
    if (tagEnd === -1) break;
    
    const openSnippet = content.slice(start, tagEnd + 1);
    const end = content.toLowerCase().indexOf(closeTag, tagEnd);
    if (end === -1) break;

    if (tagName === 'script' && openSnippet.toLowerCase().includes('src=')) {
      result += content.slice(pos, end + closeTag.length);
    } else {
      result += content.slice(pos, start);
    }
    pos = end + closeTag.length;
  }
  return result;
}

function cleanHtmlBody(htmlContent) {
  let clean = removeTags(htmlContent, 'style');
  clean = removeTags(clean, 'script');
  clean = clean
    .replace(/<!DOCTYPE html>/gi, '')
    .replace(/<html[^>]*>|<\/html>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<body[^>]*>|<\/body>/gi, '')
    .replace(/<\?!=[\s\S]*?\?>/g, '')
    .replace(/<\?=[\s\S]*?\?>/g, '');
  return clean.trim();
}

console.log('====================================================');
console.log('  🚀 WMS MINI ONE-CLICK BUILD & DEPLOY PIPELINE');
console.log('====================================================');

// 1. BUILD FRONTEND
console.log('\n[STEP 1/3] Meng-compile & memaketkan Frontend...');

const dashContent = fs.readFileSync(path.join(rootDir, 'WmsDashboard.html'), 'utf8');
const loginContent = fs.readFileSync(path.join(rootDir, 'WmsLoginPage.html'), 'utf8');
const peminjamanContent = fs.readFileSync(path.join(rootDir, 'ViewPeminjaman.html'), 'utf8');

const views = [
  { name: 'peminjaman', file: 'ViewPeminjaman.html' },
  { name: 'penerimaanproduksi', file: 'ViewPenerimaanProduksi.html' },
  { name: 'fulfillment', file: 'ViewFulfillment.html' },
  { name: 'stockopname', file: 'ViewStockOpname.html' },
  { name: 'logproduk', file: 'ViewLogProduk.html' },
  { name: 'logmutasi', file: 'ViewLogMutasi.html' },
  { name: 'klasifikasi', file: 'ViewKlasifikasi.html' },
  { name: 'updatedatabase', file: 'ViewUpdateDatabase.html' },
  { name: 'setting', file: 'ViewSetting.html' }
];

const allStyles = [];
const allScripts = {};

allStyles.push('/* === DASHBOARD BASE STYLES === */\n' + extractTags(dashContent, 'style').join('\n'));
allScripts['dashboard'] = extractTags(dashContent, 'script').join('\n');

allStyles.push('/* === LOGIN STYLES === */\n' + extractTags(loginContent, 'style').join('\n'));
allScripts['login'] = extractTags(loginContent, 'script').join('\n');

for (const v of views) {
  const vFile = path.join(rootDir, v.file);
  if (fs.existsSync(vFile)) {
    const content = fs.readFileSync(vFile, 'utf8');
    const styles = extractTags(content, 'style');
    if (styles.length > 0) {
      allStyles.push(`/* === VIEW: ${v.name} STYLES === */\n` + styles.join('\n'));
    }
    allScripts[v.name] = extractTags(content, 'script').join('\n');
  }
}

// Write CSS
fs.mkdirSync(path.join(frontendDir, 'css'), { recursive: true });
fs.writeFileSync(path.join(frontendDir, 'css', 'style.css'), allStyles.join('\n\n'), 'utf8');

// Write Modules
fs.mkdirSync(path.join(frontendDir, 'js', 'modules'), { recursive: true });
for (const [key, script] of Object.entries(allScripts)) {
  let cleanScript = script
    .replace(/const TOKEN\s*=\s*"<\?=\s*token\s*\?>";?/g, 'var TOKEN = window.TOKEN || "";')
    .replace(/const EXEC_URL\s*=\s*"<\?=\s*execUrl\s*\?>";?/g, 'var EXEC_URL = window.EXEC_URL || "";')
    .replace(/const AKSES\s*=\s*"<\?=\s*akses\s*\?>";?/g, 'var AKSES = window.AKSES || "All";')
    .replace(/const INITIAL_PAGE\s*=\s*"<\?=[\s\S]*?\?>";?/g, 'var INITIAL_PAGE = window.INITIAL_PAGE || "produk";')
    .replace(/const TOKEN\s*=\s*window\.TOKEN\s*\|\|\s*"";?/g, 'var TOKEN = window.TOKEN || "";')
    .replace(/const EXEC_URL\s*=\s*window\.EXEC_URL\s*\|\|\s*"";?/g, 'var EXEC_URL = window.EXEC_URL || "";')
    .replace(/const AKSES\s*=\s*window\.AKSES\s*\|\|\s*"All";?/g, 'var AKSES = window.AKSES || "All";')
    .replace(/const INITIAL_PAGE\s*=\s*window\.INITIAL_PAGE\s*\|\|\s*"produk";?/g, 'var INITIAL_PAGE = window.INITIAL_PAGE || "produk";')
    .replace(/const SUPABASE_DB_URL\s*=/g, 'var SUPABASE_DB_URL =')
    .replace(/const SUPABASE_DB_KEY\s*=/g, 'var SUPABASE_DB_KEY =')
    .replace(/const CABANG_MAP\s*=/g, 'var CABANG_MAP =')
    .replace(/let ALL_PRODUK_DATA\s*=\s*\[\];?/g, 'var ALL_PRODUK_DATA = window.ALL_PRODUK_DATA || [];')
    .replace(/window\.top\.location\.href\s*=\s*redirectUrl;?/g, 'if (typeof handleLoginSuccess === "function") { handleLoginSuccess(res); } else if (typeof setAppVisible === "function") { setAppVisible(true); }')
    .replace(/window\.top\.location\.href\s*=\s*EXEC_URL\s*\+\s*'\?logout=1';?/g, 'if (typeof logoutSession === "function") { logoutSession(); } else if (typeof setAppVisible === "function") { setAppVisible(false); }')
    .replace(/const newUrl = EXEC_URL\s*\+\s*'\?token='[^;]+;\s*window\.history\.pushState\([^)]+\);/g, 'const newUrl = window.location.pathname + "?page=" + encodeURIComponent(pageCode); window.history.pushState({ page: pageCode }, "", newUrl);')
    .replace(/document\.getElementById\('searchGlobal'\)\.value/g, '(document.getElementById("searchGlobal") ? document.getElementById("searchGlobal").value : "")')
    .replace(/const container = document\.getElementById\('tableContainer'\);/g, 'const container = document.getElementById("tableContainer"); if (!container) return;')
    .replace(/<\?!=[\s\S]*?\?>/g, '')
    .replace(/<\?=[\s\S]*?\?>/g, '');

  // Otomatis expose semua function top-level ke window agar inline HTML handler (oninput, onclick) 100% aman
  const fnMatches = Array.from(cleanScript.matchAll(/function\s+([a-zA-Z0-9_$]+)\s*\(/g));
  const uniqueFns = Array.from(new Set(fnMatches.map(m => m[1])));
  const exposeStatements = uniqueFns
    .filter(fn => !['constructor', 'escapeHtml'].includes(fn))
    .map(fn => `if (typeof ${fn} === 'function') window.${fn} = ${fn};`)
    .join('\n');

  cleanScript += `\n\n// --- Global Window Binding for ${key} ---\n${exposeStatements}\n`;

  fs.writeFileSync(path.join(frontendDir, 'js', 'modules', `${key}.js`), cleanScript, 'utf8');
}

// Write Config
const configJs = `const WMS_CONFIG = {
  GAS_API_URL: "https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec",
  SUPABASE_URL: "https://filgijcfhgqlirzhvwho.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_L4FEkugwRKqcwFzLXfpZag_aByUy5mD",
  STORAGE_PREFIX: "wms_",
  CACHE_TTL_MINUTES: 360
};
window.WMS_CONFIG = WMS_CONFIG;
`;
fs.writeFileSync(path.join(frontendDir, 'js', 'config.js'), configJs, 'utf8');

function readHtml(name) {
  const fileName = name.endsWith('.html') ? name : name + '.html';
  const filePath = path.join(rootDir, fileName);
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
  return '';
}

// Assemble index.html
let dashboardContent = readHtml('WmsDashboard');
let loginBody = cleanHtmlBody(readHtml('WmsLoginPage'));

let baseMasterHtml = dashboardContent
  .replace(/<\?!= include\('([^']+)'\); \?>/g, '') // Hapus include karena view akan di-inject terpisah via JS
  .replace(/<\?!=[\s\S]*?\?>/g, '')
  .replace(/<\?=[\s\S]*?\?>/g, '')
  .replace('</head>', '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">\n  <link rel="stylesheet" href="css/style.css">\n</head>');

// REMOVE inline scripts and styles from master html so we don't have duplicates!
baseMasterHtml = removeTags(baseMasterHtml, 'style');
baseMasterHtml = removeTags(baseMasterHtml, 'script');

const allViewsExceptPeminjaman = views.filter(v => v.name !== 'dashboard' && v.name !== 'login');
let injectedViewsHtml = allViewsExceptPeminjaman.map(v => {
  const content = readHtml(v.file);
  return cleanHtmlBody(content);
}).join('\n\n');

// Inject login form into #loginScreen container
baseMasterHtml = baseMasterHtml.replace(
  '<div id="loginScreen" style="display: none; align-items: center; justify-content: center; min-height: 100vh; width: 100%; padding: 20px;"></div>',
  `<div id="loginScreen" style="display: none; align-items: center; justify-content: center; min-height: 100vh; width: 100%; padding: 20px;">\n${loginBody}\n</div>`
);

function buildFullSpaHtml(defaultPage) {
  let customHtml = baseMasterHtml.replace('</body>', `
  <div id="injectedSpaViews" style="display:none;">
    ${injectedViewsHtml}
  </div>
  <div id="wmsGlobalToastContainer" class="toast-container"></div>
  <script src="js/config.js"></script>
  <script src="js/api.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/modules/dashboard.js"></script>
  <script src="js/modules/login.js"></script>
  <script src="js/modules/peminjaman.js"></script>
  <script src="js/modules/penerimaanproduksi.js"></script>
  <script src="js/modules/fulfillment.js"></script>
  <script src="js/modules/stockopname.js"></script>
  <script src="js/modules/logproduk.js"></script>
  <script src="js/modules/logmutasi.js"></script>
  <script src="js/modules/klasifikasi.js"></script>
  <script src="js/modules/updatedatabase.js"></script>
  <script src="js/modules/setting.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const appContent = document.querySelector('.app-content');
      const injected = document.getElementById('injectedSpaViews');
      if (appContent && injected) {
        while (injected.firstChild) appContent.appendChild(injected.firstChild);
        injected.remove();
      }
      window.INITIAL_PAGE = "${defaultPage}";
      if (typeof checkAuthSession === 'function') checkAuthSession();
    });
  </script>
</body>
</html>`);

  return customHtml;
}

// 1. Write index.html (Default page: 'produk')
fs.writeFileSync(path.join(frontendDir, 'index.html'), buildFullSpaHtml('produk'), 'utf8');

// 2. Write peminjaman.html (Full Master Shell with default page: 'peminjaman')
fs.writeFileSync(path.join(frontendDir, 'peminjaman.html'), buildFullSpaHtml('peminjaman'), 'utf8');

// 3. Write penerimaanproduksi.html (Full Master Shell with default page: 'penerimaanproduksi')
fs.writeFileSync(path.join(frontendDir, 'penerimaanproduksi.html'), buildFullSpaHtml('penerimaanproduksi'), 'utf8');

// 4. Write fulfillment.html (Full Master Shell with default page: 'fulfillment')
fs.writeFileSync(path.join(frontendDir, 'fulfillment.html'), buildFullSpaHtml('fulfillment'), 'utf8');

console.log('✓ Build Frontend Selesai!');

// 2. PUSH & DEPLOY BACKEND KE GAS
console.log('\n[STEP 2/3] Menyinkronkan Backend ke Google Apps Script...');
try {
  run('npx clasp push', rootDir);
  run(`npx clasp deploy -i ${DEPLOYMENT_ID} -d "Auto-deploy via master deployment pipeline"`, rootDir);
  console.log('✓ Google Apps Script Backend Ter-update!');
} catch (e) {
  console.warn('⚠️ Gagal sinkronisasi clasp (dilewati jika tidak ada perubahan backend):', e.message);
}

// 3. PUSH KE GITHUB PAGES
console.log('\n[STEP 3/3] Mem-push Frontend ke GitHub Pages...');
try {
  const timeStr = new Date().toLocaleString('id-ID');
  run('git add .', frontendDir);
  try {
    run(`git commit -m "Auto-deploy update (${timeStr})"`, frontendDir);
  } catch (errCommit) {
    console.log('ℹ️ Tidak ada perubahan file frontend baru untuk di-commit.');
  }
  run('git push origin main', frontendDir);
  console.log('✓ Frontend Ter-push ke GitHub Pages!');
} catch (e) {
  console.warn('⚠️ Catatan Git push:', e.message);
}

console.log('\n🎉 ====================================================');
console.log('  SEMUA PROSES SELESAI & LIVE SECARA OTOMATIS!');
console.log('  URL Peminjaman: https://chocochipswarehouse2-dash.github.io/CchipsWMS/peminjaman.html');
console.log('  URL Dashboard : https://chocochipswarehouse2-dash.github.io/CchipsWMS/index.html');
console.log('====================================================\n');
