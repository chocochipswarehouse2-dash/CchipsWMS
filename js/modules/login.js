
    const EXEC_URL = window.EXEC_URL || "";

    const ICON_SUN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    const ICON_MOON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    const ICON_EYE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    const ICON_EYE_OFF = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

    function togglePasswordVisibility() {
      const pwd = document.getElementById('password');
      const btn = document.getElementById('btnTogglePwd');
      if (!pwd || !btn) return;
      if (pwd.type === 'password') {
        pwd.type = 'text';
        btn.innerHTML = ICON_EYE_OFF;
        btn.title = 'Sembunyikan password';
      } else {
        pwd.type = 'password';
        btn.innerHTML = ICON_EYE;
        btn.title = 'Lihat password';
      }
    }

    function initTheme() {
      const savedTheme = localStorage.getItem('wms_theme') || 'dark';
      document.body.setAttribute('data-theme', savedTheme);
      updateThemeButtonText(savedTheme);
    }

    function updateThemeButtonText(theme) {
      const btn = document.getElementById('btnToggleTheme');
      if (!btn) return;
      btn.innerHTML = (theme === 'dark') 
        ? ICON_SUN + ' <span>Light Mode</span>' 
        : ICON_MOON + ' <span>Dark Mode</span>';
    }

    function toggleTheme() {
      const currentTheme = document.body.getAttribute('data-theme') || 'dark';
      const newTheme = (currentTheme === 'dark') ? 'light' : 'dark';
      document.body.setAttribute('data-theme', newTheme);
      localStorage.setItem('wms_theme', newTheme);
      updateThemeButtonText(newTheme);
    }

    initTheme();

    function setLoading(isLoading) {
      const btn = document.getElementById('btnLogin');
      const label = document.getElementById('loginLabel');
      btn.disabled = isLoading;
      label.innerHTML = isLoading
        ? '<span class="spinner"></span> Memeriksa...'
        : 'Masuk';
    }

    function showToast(ok, msg) {
      const el = document.getElementById('toast');
      el.className = 'toast show ' + (ok ? 'ok' : 'err');
      el.textContent = msg;
    }

    // Inisialisasi form login: bersihkan token usang agar tidak loop/loading terus
    (function initLoginForm() {
      try {
        // Hapus token usang karena server sudah mengarahkan ke halaman login
        localStorage.removeItem('wms_token');
        sessionStorage.removeItem('wms_token');

        // Isi otomatis username yang terakhir kali digunakan (jika ada)
        const savedUsername = localStorage.getItem('wms_saved_username');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');

        if (savedUsername && usernameInput) {
          usernameInput.value = savedUsername;
          if (passwordInput) passwordInput.focus();
        } else if (usernameInput) {
          usernameInput.focus();
        }
      } catch (e) {}
    })();

    function doLogin() {
      const usernameInput = document.getElementById('username');
      const passwordInput = document.getElementById('password');
      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!username || !password) {
        showToast(false, 'USERNAME DAN PASSWORD WAJIB DIISI.');
        return;
      }

      setLoading(true);

      google.script.run.withSuccessHandler(function (res) {
        if (res && res.success) {
          const btn = document.getElementById('btnLogin');
          const label = document.getElementById('loginLabel');
          if (btn) btn.disabled = true;
          if (label) label.innerHTML = '<span class="spinner"></span> 🚀 MEMBUKA DASHBOARD...';
          showToast(true, 'LOGIN BERHASIL! MEMBUKA DASHBOARD WMS...');

          try {
            localStorage.setItem('wms_saved_username', res.username || username);
            sessionStorage.setItem('wms_token', res.token);
            sessionStorage.setItem('wms_role', res.akses || res.role);
            sessionStorage.setItem('wms_username', res.username);
            localStorage.setItem('wms_token', res.token);
            localStorage.setItem('wms_role', res.akses || res.role);
            localStorage.setItem('wms_username', res.username);
          } catch (e) {}

          const redirectUrl = EXEC_URL + '?token=' + encodeURIComponent(res.token);
          if (typeof handleLoginSuccess === "function") { handleLoginSuccess(res); } else if (typeof setAppVisible === "function") { setAppVisible(true); }
        } else {
          setLoading(false);
          showToast(false, (res ? res.message : null) || 'LOGIN GAGAL: USERNAME ATAU PASSWORD SALAH.');
        }
      }).withFailureHandler(function (err) {
        setLoading(false);
        showToast(false, 'GAGAL LOGIN: ' + (err ? err.message : 'Koneksi terputus'));
      }).verifyWmsLogin(username, password);
    }
  