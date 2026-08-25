$rootDir = 'd:\GAS WMS Mini'
$frontendDir = Join-Path $rootDir 'frontend'

Write-Host '=== MEMULAI COMPILATION FRONTEND WMS (PS) ==='

$masterShell = [System.IO.File]::ReadAllText((Join-Path $rootDir 'WmsDashboard.html'), [System.Text.Encoding]::UTF8)

$loginHtml = [System.IO.File]::ReadAllText((Join-Path $rootDir 'WmsLoginPage.html'), [System.Text.Encoding]::UTF8)
$loginBody = ''
if ($loginHtml -match '(?s)(<div class="login-wrap">.*?</div>\s*</form>\s*</div>)') {
    $loginBody = $matches[1]
} elseif ($loginHtml -match '(?s)(<div class="login-wrap">.*?</div>)') {
    $loginBody = $matches[1]
} else {
    $loginBody = $loginHtml
}

$viewFiles = [ordered]@{
    'ViewKlasifikasi' = 'ViewKlasifikasi.html'
    'ViewFulfillment' = 'ViewFulfillment.html'
    'ViewPeminjaman' = 'ViewPeminjaman.html'
    'ViewLogProduk' = 'ViewLogProduk.html'
    'ViewLogMutasi' = 'ViewLogMutasi.html'
    'ViewUpdateDatabase' = 'ViewUpdateDatabase.html'
    'ViewStockOpname' = 'ViewStockOpname.html'
    'ViewSetting' = 'ViewSetting.html'
    'ViewPenerimaanProduksi' = 'ViewPenerimaanProduksi.html'
}

foreach ($entry in $viewFiles.GetEnumerator()) {
    $viewTag = $entry.Key
    $viewPath = Join-Path $rootDir $entry.Value
    if (Test-Path $viewPath) {
        $viewContent = [System.IO.File]::ReadAllText($viewPath, [System.Text.Encoding]::UTF8)
        $pattern = "(?i)<\?!=\s*include\(['`"]" + [regex]::Escape($viewTag) + "['`"]\);?\s*\?>"
        $replacement = "`n<!-- === VIEW: " + $viewTag + " === -->`n" + $viewContent + "`n"
        $masterShell = [regex]::Replace($masterShell, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ return $replacement })
    }
}

$loginContainerPattern = '(?i)<div id="loginScreen"[^>]*></div>'
$loginContainerReplacement = '<div id="loginScreen" style="display: none; align-items: center; justify-content: center; min-height: 100vh; width: 100%; padding: 20px;">' + "`n" + $loginBody + "`n</div>"
$masterShell = [regex]::Replace($masterShell, $loginContainerPattern, [System.Text.RegularExpressions.MatchEvaluator]{ return $loginContainerReplacement })

$bridgeScriptsHead = "`n  <!-- Font Awesome Icons -->`n  <link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'>`n  <!-- WMS Core Standalone Bridge & Auth Controller -->`n  <script src='js/config.js'></script>`n  <script src='js/api.js'></script>`n  <script src='js/auth.js'></script>`n</head>"
$masterShell = $masterShell.Replace('</head>', $bridgeScriptsHead)

$masterShell = [regex]::Replace($masterShell, '(?i)const TOKEN\s*=\s*"<\?=\s*token\s*\?>";?', 'var TOKEN = window.TOKEN || "";')
$masterShell = [regex]::Replace($masterShell, '(?i)const EXEC_URL\s*=\s*"<\?=\s*execUrl\s*\?>";?', 'var EXEC_URL = window.EXEC_URL || "";')
$masterShell = [regex]::Replace($masterShell, '(?i)const AKSES\s*=\s*"<\?=\s*akses\s*\?>";?', 'var AKSES = window.AKSES || "All";')
$masterShell = [regex]::Replace($masterShell, '(?i)const INITIAL_PAGE\s*=\s*"<\?=[\s\S]*?\?>";?', 'var INITIAL_PAGE = window.INITIAL_PAGE || "produk";')
$masterShell = [regex]::Replace($masterShell, '<\?=\s*\(typeof username !== ''undefined'' && username \? username\.charAt\(0\)\.toUpperCase\(\) : ''W''\)\s*\?>', 'W')
$masterShell = [regex]::Replace($masterShell, '<\?=\s*\(typeof username !== ''undefined'' && username \? username : ''WAREHOUSE''\)\s*\?>', 'WAREHOUSE')
$masterShell = [regex]::Replace($masterShell, '<\?=\s*\(typeof akses !== ''undefined'' && akses \? akses : ''All''\)\s*\?>', 'All')
$masterShell = [regex]::Replace($masterShell, '<\?=\s*token\s*\?>', '')
$masterShell = [regex]::Replace($masterShell, '<\?=\s*execUrl\s*\?>', '')
$masterShell = [regex]::Replace($masterShell, '<\?=\s*akses\s*\?>', 'All')
$masterShell = [regex]::Replace($masterShell, '<\?=\s*username\s*\?>', 'WAREHOUSE')
$masterShell = [regex]::Replace($masterShell, '<\?=\s*supabaseUrl\s*\?>', 'https://filgijcfhgqlirzhvwho.supabase.co')
$masterShell = [regex]::Replace($masterShell, '<\?=\s*supabaseAnonKey\s*\?>', 'sb_publishable_L4FEkugwRKqcwFzLXfpZag_aByUy5mD')
$masterShell = [regex]::Replace($masterShell, '<\?!=[\s\S]*?\?>', '')
$masterShell = [regex]::Replace($masterShell, '<\?=[\s\S]*?\?>', '')

$masterShell = [regex]::Replace($masterShell, 'window\.top\.location\.href\s*=\s*EXEC_URL\s*\+\s*''\?logout=1'';?', 'if (typeof logoutWms === "function") { logoutWms(); } else if (typeof setAppVisible === "function") { setAppVisible(false); }')
$masterShell = [regex]::Replace($masterShell, 'window\.top\.location\.href\s*=\s*redirectUrl;?', 'if (typeof handleLoginSuccess === "function") { handleLoginSuccess(res); } else if (typeof setAppVisible === "function") { setAppVisible(true); }')

function Build-HtmlPage($targetPage) {
    $initScript = "`n  <script>`n    document.addEventListener('DOMContentLoaded', function() {`n      window.INITIAL_PAGE = '" + $targetPage + "';`n      if (typeof checkAuthSession === 'function') {`n        checkAuthSession();`n      }`n    });`n  </script>`n</body>"
    return $masterShell.Replace('</body>', $initScript)
}

[System.IO.Directory]::CreateDirectory((Join-Path $rootDir 'js')) | Out-Null
[System.IO.Directory]::CreateDirectory((Join-Path $rootDir 'css')) | Out-Null
[System.IO.Directory]::CreateDirectory((Join-Path $frontendDir 'js')) | Out-Null
[System.IO.Directory]::CreateDirectory((Join-Path $frontendDir 'css')) | Out-Null

Copy-Item -Path (Join-Path $rootDir 'js\config.js') -Destination (Join-Path $frontendDir 'js\config.js') -Force
Copy-Item -Path (Join-Path $rootDir 'js\api.js') -Destination (Join-Path $frontendDir 'js\api.js') -Force
Copy-Item -Path (Join-Path $rootDir 'js\auth.js') -Destination (Join-Path $frontendDir 'js\auth.js') -Force

$pages = @(
    @{ file = 'index.html'; page = 'produk' },
    @{ file = 'peminjaman.html'; page = 'peminjaman' },
    @{ file = 'penerimaanproduksi.html'; page = 'penerimaanproduksi' },
    @{ file = 'fulfillment.html'; page = 'fulfillment' }
)

foreach ($p in $pages) {
    $content = Build-HtmlPage $p.page
    [System.IO.File]::WriteAllText((Join-Path $rootDir $p.file), $content, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText((Join-Path $frontendDir $p.file), $content, [System.Text.Encoding]::UTF8)
    Write-Host ("[OK] Generated: " + $p.file + " (Default: " + $p.page + ")")
}

Write-Host '=== COMPILATION SELESAI DENGAN SUKSES! ==='
