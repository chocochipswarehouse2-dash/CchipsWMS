
  let isSettingInitialized = false;
  let WMS_USERS_DATA = [];
  let isPasswordMasked = true;

  function initSettingView() {
    if (!isSettingInitialized) {
      isSettingInitialized = true;
      muatDaftarPengguna();
    }
  }

  function muatDaftarPengguna(btn) {
    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MEMUAT...');
    const tbody = document.getElementById('tbodyUsersList');
    const badge = document.getElementById('badgeTotalUsers');

    google.script.run.withSuccessHandler(function (res) {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      if (res && res.success) {
        WMS_USERS_DATA = res.users || [];
        if (badge) badge.textContent = `${WMS_USERS_DATA.length} User Aktif`;
        renderTabelUsers(WMS_USERS_DATA, res.currentUser);
      } else {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--danger);">${res ? res.message : 'Gagal memuat pengguna'}</td></tr>`;
      }
    }).withFailureHandler(function (err) {
      if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--danger);">Error: ${err.message}</td></tr>`;
    }).getWmsUsersList(TOKEN);
  }

  function renderTabelUsers(list, currentUser) {
    const tbody = document.getElementById('tbodyUsersList');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted); font-style:italic;">Tidak ada pengguna ditemukan.</td></tr>';
      return;
    }

    let html = '';
    list.forEach(function (u, idx) {
      const isMe = currentUser && (u.username.toLowerCase() === currentUser.toLowerCase());
      const roleBadges = formatRoleBadges(u.role);

      html += `
        <tr style="vertical-align: middle;">
          <td style="text-align: center; font-weight: 700; color: var(--text-muted); font-size: 11.5px;">${idx + 1}</td>
          <td style="padding-left: 12px;">
            <div style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: nowrap;">
              <span style="font-weight: 800; color: var(--text); font-size: 12px;">${escapeHtml(u.username)}</span>
              ${isMe ? `<span class="badge-akun-anda">AKUN ANDA</span>` : ''}
            </div>
          </td>
          <td style="padding-left: 8px;">
            <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
              ${roleBadges}
            </div>
          </td>
          <td style="padding-left: 8px;">
            <div class="pwd-cell-box">
              <span id="pwd_${idx}" class="mono" style="font-size: 12px; color: var(--text-muted); letter-spacing: 1.5px;">••••••••</span>
              <button type="button" class="btn-pwd-eye" onclick="togglePasswordRow(${idx}, '${escapeHtml(u.password)}')" title="Lihat / Sembunyikan Password">👁️</button>
            </div>
          </td>
          <td style="text-align: center;">
            <div style="display: flex; justify-content: center; gap: 6px; align-items: center;">
              <button type="button" class="btn btn-secondary" onclick="bukaModalEditUser(${idx})" style="height: 28px; font-size: 11px; padding: 0 10px; font-weight: 700;" title="Edit User">
                ✏️ EDIT
              </button>
              ${!isMe ? `
                <button type="button" class="btn btn-danger" onclick="konfirmasiHapusUser('${escapeHtml(u.username)}')" style="height: 28px; width: 28px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 12px;" title="Hapus User">
                  🗑️
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function formatRoleBadges(roleStr) {
    if (!roleStr) return '<span class="section-badge-info" style="font-size:10.5px; padding: 2px 7px;">👑 All</span>';
    const parts = String(roleStr).split(',').map(r => r.trim());
    return parts.map(r => {
      let bg = 'var(--card-alt)';
      let color = 'var(--text)';
      let border = 'var(--border)';
      let icon = '🔖';

      if (r === 'All') { 
        bg = 'rgba(245, 158, 11, 0.12)'; color = '#d97706'; border = 'rgba(245, 158, 11, 0.3)'; icon = '👑';
      } else if (r === 'Produk') { 
        bg = 'rgba(59, 130, 246, 0.12)'; color = '#2563eb'; border = 'rgba(59, 130, 246, 0.3)'; icon = '📦';
      } else if (r === 'Peminjaman') { 
        bg = 'rgba(168, 85, 247, 0.12)'; color = '#9333ea'; border = 'rgba(168, 85, 247, 0.3)'; icon = '📝';
      } else if (r === 'Fulfillment') { 
        bg = 'rgba(16, 185, 129, 0.12)'; color = '#059669'; border = 'rgba(16, 185, 129, 0.3)'; icon = '🚚';
      }

      return `<span style="display:inline-flex; align-items:center; gap:3px; font-size:10.5px; font-weight:700; padding:2px 7px; border-radius:4px; background:${bg}; color:${color}; border:1px solid ${border};">${icon} ${escapeHtml(r)}</span>`;
    }).join('');
  }

  function togglePasswordRow(idx, realPassword) {
    const el = document.getElementById('pwd_' + idx);
    if (!el) return;
    if (el.textContent === '••••••••') {
      el.textContent = realPassword;
      el.style.color = 'var(--text)';
      el.style.fontWeight = '700';
      el.style.letterSpacing = 'normal';
    } else {
      el.textContent = '••••••••';
      el.style.color = 'var(--text-muted)';
      el.style.fontWeight = 'normal';
      el.style.letterSpacing = '1.5px';
    }
  }

  function filterTabelUser() {
    const q = (document.getElementById('searchUserInput').value || '').trim().toLowerCase();
    if (!q) {
      renderTabelUsers(WMS_USERS_DATA);
      return;
    }
    const filtered = WMS_USERS_DATA.filter(u => 
      u.username.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
    );
    renderTabelUsers(filtered);
  }

  // ============ MODAL ADD / EDIT ============
  function bukaModalUser(isEdit, userObj) {
    const modal = document.getElementById('modalUserForm');
    const titleText = document.getElementById('modalUserTitleText');
    const titleIcon = document.getElementById('modalUserTitleIcon');
    const isEditInput = document.getElementById('formUserIsEdit');
    const oldUsernameInput = document.getElementById('formUserOldUsername');
    const usernameInput = document.getElementById('formUserUsername');
    const passwordInput = document.getElementById('formUserPassword');

    if (!modal) return;
    modal.style.display = 'flex';

    if (isEdit && userObj) {
      titleText.textContent = `EDIT PENGGUNA: ${userObj.username}`;
      titleIcon.textContent = '✏️';
      isEditInput.value = '1';
      oldUsernameInput.value = userObj.username;
      usernameInput.value = userObj.username;
      passwordInput.value = userObj.password;
      setRoleCheckboxes(userObj.role);
    } else {
      titleText.textContent = 'TAMBAH PENGGUNA BARU';
      titleIcon.textContent = '👤';
      isEditInput.value = '0';
      oldUsernameInput.value = '';
      usernameInput.value = '';
      passwordInput.value = '';
      setRoleCheckboxes('All');
    }
  }

  function bukaModalEditUser(idx) {
    if (!WMS_USERS_DATA[idx]) return;
    bukaModalUser(true, WMS_USERS_DATA[idx]);
  }

  function tutupModalUser() {
    const modal = document.getElementById('modalUserForm');
    if (modal) modal.style.display = 'none';
  }

  function toggleFormPasswordVisibility() {
    const pwdInput = document.getElementById('formUserPassword');
    if (!pwdInput) return;
    if (pwdInput.type === 'password') {
      pwdInput.type = 'text';
    } else {
      pwdInput.type = 'password';
    }
  }

  function handleRoleAllToggle(chkAll) {
    const subChks = document.querySelectorAll('.role-sub-chk');
    if (chkAll.checked) {
      subChks.forEach(c => { c.checked = false; c.disabled = true; });
    } else {
      subChks.forEach(c => { c.disabled = false; });
    }
  }

  function handleRoleSubToggle() {
    const chkAll = document.getElementById('roleChkAll');
    const subChks = document.querySelectorAll('.role-sub-chk');
    let anySubChecked = false;
    subChks.forEach(c => { if (c.checked) anySubChecked = true; });
    if (anySubChecked && chkAll) {
      chkAll.checked = false;
    }
  }

  function setRoleCheckboxes(roleStr) {
    const chkAll = document.getElementById('roleChkAll');
    const subChks = document.querySelectorAll('.role-sub-chk');
    
    const parts = String(roleStr || 'All').split(',').map(s => s.trim().toLowerCase());
    
    if (parts.includes('all')) {
      if (chkAll) chkAll.checked = true;
      subChks.forEach(c => { c.checked = false; c.disabled = true; });
    } else {
      if (chkAll) chkAll.checked = false;
      subChks.forEach(c => {
        c.disabled = false;
        c.checked = parts.includes(c.value.toLowerCase());
      });
    }
  }

  function getSelectedRoles() {
    const chkAll = document.getElementById('roleChkAll');
    if (chkAll && chkAll.checked) return 'All';

    const subChks = document.querySelectorAll('.role-sub-chk');
    const selected = [];
    subChks.forEach(c => {
      if (c.checked) selected.push(c.value);
    });

    return selected.length > 0 ? selected.join(', ') : 'All';
  }

  function submitFormUser() {
    const isEdit = document.getElementById('formUserIsEdit').value === '1';
    const oldUsername = document.getElementById('formUserOldUsername').value.trim();
    const username = document.getElementById('formUserUsername').value.trim();
    const password = document.getElementById('formUserPassword').value.trim();
    const role = getSelectedRoles();
    const btnSubmit = document.getElementById('btnSubmitUserForm');

    if (!username || !password) {
      alert("Username dan Password wajib diisi.");
      return;
    }

    if (window.setButtonLoading) window.setButtonLoading(btnSubmit, true, 'MENYIMPAN...');

    const payload = {
      isEdit: isEdit,
      oldUsername: oldUsername,
      username: username,
      password: password,
      role: role
    };

    google.script.run.withSuccessHandler(function (res) {
      if (window.setButtonLoading) window.setButtonLoading(btnSubmit, false);
      if (res && res.success) {
        tutupModalUser();
        if (window.showToast) window.showToast(res.message || "User berhasil disimpan!", "success");
        muatDaftarPengguna();
      } else {
        alert("Gagal: " + (res ? res.message : "Error tidak diketahui"));
      }
    }).withFailureHandler(function (err) {
      if (window.setButtonLoading) window.setButtonLoading(btnSubmit, false);
      alert("Error server: " + err.message);
    }).saveWmsUser(TOKEN, payload);
  }

  function konfirmasiHapusUser(uname) {
    if (!confirm(`Yakin ingin menghapus user "${uname}" dari sistem?`)) return;

    google.script.run.withSuccessHandler(function (res) {
      if (res && res.success) {
        if (window.showToast) window.showToast(res.message || "User berhasil dihapus", "success");
        muatDaftarPengguna();
      } else {
        alert("Gagal: " + (res ? res.message : "Error"));
      }
    }).withFailureHandler(function (err) {
      alert("Error: " + err.message);
    }).deleteWmsUser(TOKEN, uname);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  window.initSettingView = initSettingView;
  window.muatDaftarPengguna = muatDaftarPengguna;
  window.bukaModalUser = bukaModalUser;
  window.bukaModalEditUser = bukaModalEditUser;
  window.tutupModalUser = tutupModalUser;
  window.filterTabelUser = filterTabelUser;
  window.submitFormUser = submitFormUser;
  window.konfirmasiHapusUser = konfirmasiHapusUser;


// --- Global Window Binding for setting ---
if (typeof initSettingView === 'function') window.initSettingView = initSettingView;
if (typeof muatDaftarPengguna === 'function') window.muatDaftarPengguna = muatDaftarPengguna;
if (typeof renderTabelUsers === 'function') window.renderTabelUsers = renderTabelUsers;
if (typeof formatRoleBadges === 'function') window.formatRoleBadges = formatRoleBadges;
if (typeof togglePasswordRow === 'function') window.togglePasswordRow = togglePasswordRow;
if (typeof filterTabelUser === 'function') window.filterTabelUser = filterTabelUser;
if (typeof bukaModalUser === 'function') window.bukaModalUser = bukaModalUser;
if (typeof bukaModalEditUser === 'function') window.bukaModalEditUser = bukaModalEditUser;
if (typeof tutupModalUser === 'function') window.tutupModalUser = tutupModalUser;
if (typeof toggleFormPasswordVisibility === 'function') window.toggleFormPasswordVisibility = toggleFormPasswordVisibility;
if (typeof handleRoleAllToggle === 'function') window.handleRoleAllToggle = handleRoleAllToggle;
if (typeof handleRoleSubToggle === 'function') window.handleRoleSubToggle = handleRoleSubToggle;
if (typeof setRoleCheckboxes === 'function') window.setRoleCheckboxes = setRoleCheckboxes;
if (typeof getSelectedRoles === 'function') window.getSelectedRoles = getSelectedRoles;
if (typeof submitFormUser === 'function') window.submitFormUser = submitFormUser;
if (typeof konfirmasiHapusUser === 'function') window.konfirmasiHapusUser = konfirmasiHapusUser;
