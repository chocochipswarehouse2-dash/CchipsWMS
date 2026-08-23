// ========================================================
// WMS MINI AUTHENTICATION & SESSION CONTROLLER
// ========================================================

(function(window) {
  'use strict';

  // Global Session Variables
  window.TOKEN = localStorage.getItem('wms_token') || sessionStorage.getItem('wms_token') || "";
  window.USERNAME = localStorage.getItem('wms_username') || sessionStorage.getItem('wms_username') || "";
  window.AKSES = localStorage.getItem('wms_role') || sessionStorage.getItem('wms_role') || "All";
  window.INITIAL_PAGE = "produk";
  window.EXEC_URL = window.WMS_CONFIG ? window.WMS_CONFIG.GAS_API_URL : "";
  window.SUPABASE_URL = window.WMS_CONFIG ? window.WMS_CONFIG.SUPABASE_URL : "";
  window.SUPABASE_ANON_KEY = window.WMS_CONFIG ? window.WMS_CONFIG.SUPABASE_ANON_KEY : "";

  function setAppVisible(isLoggedIn) {
    const loginScreen = document.getElementById('loginScreen');
    const appWrapper = document.getElementById('appWrapper');

    if (isLoggedIn) {
      if (loginScreen) loginScreen.style.display = 'none';
      if (appWrapper) appWrapper.style.display = 'flex';
      
      // Update info profil di topbar/sidebar jika ada
      const userLabels = document.querySelectorAll('.user-name-label, #topbarUsername');
      userLabels.forEach(el => el.textContent = window.USERNAME || 'USER');
      
      const roleLabels = document.querySelectorAll('.user-role-label, #topbarRole');
      roleLabels.forEach(el => el.textContent = window.AKSES || 'WMS User');

      // Render menu sidebar & navigasi halaman awal
      if (typeof renderSidebarNavItems === 'function') {
        renderSidebarNavItems(window.INITIAL_PAGE || 'produk');
      }
      if (typeof navigasiKe === 'function') {
        navigasiKe(window.INITIAL_PAGE || 'produk', true);
      }
      if (typeof muatDataProduk === 'function') {
        muatDataProduk(false);
      }
    } else {
      if (loginScreen) loginScreen.style.display = 'flex';
      if (appWrapper) appWrapper.style.display = 'none';
    }
  }

  async function checkAuthSession() {
    const token = localStorage.getItem('wms_token') || sessionStorage.getItem('wms_token');
    
    if (!token) {
      setAppVisible(false);
      return;
    }

    try {
      const res = await apiCall('checkSession', { token: token });
      if (res && res.success) {
        window.TOKEN = token;
        window.USERNAME = res.session.username || localStorage.getItem('wms_username');
        window.AKSES = res.session.akses || localStorage.getItem('wms_role') || "All";
        setAppVisible(true);
      } else {
        // Sesi kedaluwarsa
        logoutWms();
      }
    } catch (e) {
      // Fallback offline / network glitch: jika ada token lokal, izinkan tetap masuk
      console.warn("Gagal verifikasi session dengan server, menggunakan cache lokal:", e);
      if (token) {
        setAppVisible(true);
      } else {
        setAppVisible(false);
      }
    }
  }

  async function handleLoginSuccess(res) {
    if (!res || !res.token) return;

    window.TOKEN = res.token;
    window.USERNAME = res.username;
    window.AKSES = res.akses || res.role || "All";

    localStorage.setItem('wms_token', res.token);
    localStorage.setItem('wms_username', res.username);
    localStorage.setItem('wms_role', window.AKSES);
    localStorage.setItem('wms_saved_username', res.username);

    sessionStorage.setItem('wms_token', res.token);
    sessionStorage.setItem('wms_username', res.username);
    sessionStorage.setItem('wms_role', window.AKSES);

    setAppVisible(true);
    
    if (window.showWmsToast) {
      window.showWmsToast(`Selamat datang, ${res.username}!`, 'success');
    }
  }

  function logoutWms() {
    const token = window.TOKEN;
    if (token) {
      apiCall('logout', { token: token }).catch(() => {});
    }

    localStorage.removeItem('wms_token');
    localStorage.removeItem('wms_role');
    localStorage.removeItem('wms_username');
    sessionStorage.clear();

    window.TOKEN = "";
    window.USERNAME = "";
    window.AKSES = "";

    setAppVisible(false);
  }

  // Override fungsi doLogin global
  window.doLogin = async function() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
      if (typeof showToast === 'function') showToast(false, 'USERNAME DAN PASSWORD WAJIB DIISI.');
      return;
    }

    if (typeof setLoading === 'function') setLoading(true);

    try {
      const res = await apiCall('login', { username: username, password: password });
      if (res && res.success) {
        if (typeof setLoading === 'function') setLoading(false);
        if (typeof showToast === 'function') showToast(true, 'LOGIN BERHASIL!');
        handleLoginSuccess(res);
      } else {
        if (typeof setLoading === 'function') setLoading(false);
        if (typeof showToast === 'function') showToast(false, res.message || 'LOGIN GAGAL: Username atau password salah.');
      }
    } catch (err) {
      if (typeof setLoading === 'function') setLoading(false);
      if (typeof showToast === 'function') showToast(false, 'Koneksi gagal: ' + err.message);
    }
  };

  // Override logoutSession
  window.logoutSession = logoutWms;
  window.logoutWmsSession = logoutWms;
  window.checkAuthSession = checkAuthSession;
  window.setAppVisible = setAppVisible;

})(window);
