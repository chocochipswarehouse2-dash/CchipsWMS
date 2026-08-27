import re

with open('WmsStockOpnameView.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the new Javascript logic
new_js = """
  let isProcessing = false;
  let isSubmittingOpname = false;
  let isSubmittingManual = false;

  let produkList = [];
  let lokasiList = [];
  let keranjang = [];
  let manualKeranjang = [];
  
  const token = "<?= token ?>";
  const akses = "<?= akses ?>";
  const CURRENT_USER = "<?= user ?>";
  
  const SUPABASE_URL = "https://filgijcfhgqlirzhvwho.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_L4FEkugwRKqcwFzLXfpZag_aByUy5mD";

  function showMsg(text, ok) {
    document.getElementById('msgBox').innerHTML =
      '<div class="msg ' + (ok ? 'ok' : 'err') + '">' + text + '</div>';
  }

  function setBtnLoading(btnId, isLoading, loadingLabel, normalLabel) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading
      ? '<span class="spinner-inline"></span> ' + loadingLabel
      : normalLabel;
  }

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'approval') muatPending();
    });
  });

  async function loadInitData() {
    try {
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/master_produk?select=sku,produk,size`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
      });
      if (!pRes.ok) throw new Error("Gagal load produk");
      produkList = await pRes.json();
      
      const dlSku = document.getElementById('listSku');
      dlSku.innerHTML = '';
      produkList.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.sku;
        opt.label = p.produk + (p.size ? (' - ' + p.size) : '');
        dlSku.appendChild(opt);
      });

      const viewRes = await fetch(`${SUPABASE_URL}/rest/v1/view_stok_realtime?select=lokasi`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
      });
      const viewData = await viewRes.json();
      lokasiList = [...new Set(viewData.map(v => v.lokasi))].sort();
      
      const dlLok = document.getElementById('listLokasi');
      dlLok.innerHTML = '';
      lokasiList.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l;
        dlLok.appendChild(opt);
      });
    } catch(err) {
      showMsg('Gagal memuat data awal: ' + err.message, false);
    }
  }
  loadInitData();

  document.getElementById('opnameSku').addEventListener('change', cekQtySistem);
  document.getElementById('opnameLokasi').addEventListener('change', cekQtySistem);

  async function cekQtySistem() {
    const sku = document.getElementById('opnameSku').value.trim();
    const lokasi = document.getElementById('opnameLokasi').value.trim();
    if (!sku || !lokasi) return;
    document.getElementById('qtySistemBadge').innerText = 'Qty sistem: mengecek...';
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/view_stok_realtime?sku=eq.${encodeURIComponent(sku)}&lokasi=eq.${encodeURIComponent(lokasi)}&select=sisa_stok`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
      });
      if (!res.ok) throw new Error("Gagal get qty");
      const data = await res.json();
      const qty = data.length > 0 ? data[0].sisa_stok : 0;
      document.getElementById('qtySistemBadge').innerText = 'Qty sistem: ' + qty;
    } catch (e) {
      document.getElementById('qtySistemBadge').innerText = 'Qty sistem: ?';
    }
  }

  function tambahKeKeranjang() {
    const sku = document.getElementById('opnameSku').value.trim().toUpperCase();
    const lokasi = document.getElementById('opnameLokasi').value.trim();
    const qtyFisik = Number(document.getElementById('opnameQty').value);

    if (!sku) { showMsg('SKU wajib diisi.', false); return; }
    if (!lokasi) { showMsg('Lokasi wajib diisi.', false); return; }
    if (isNaN(qtyFisik) || document.getElementById('opnameQty').value === '') {
      showMsg('Qty fisik wajib diisi angka.', false); return;
    }

    const dupIdx = keranjang.findIndex(item => item.sku === sku && item.lokasi === lokasi);
    if (dupIdx !== -1) {
      keranjang[dupIdx].qtyFisik = qtyFisik;
      showMsg(`SKU ${sku} di lokasi ${lokasi} diperbarui menjadi ${qtyFisik} pcs.`, true);
    } else {
      keranjang.push({ sku: sku, lokasi: lokasi, qtyFisik: qtyFisik });
    }

    renderKeranjang();
    document.getElementById('opnameQty').value = '';
    document.getElementById('qtySistemBadge').innerText = 'Qty sistem: -';
    document.getElementById('opnameSku').focus();
  }

  function hapusItem(idx) {
    keranjang.splice(idx, 1);
    renderKeranjang();
  }

  function renderKeranjang() {
    const container = document.getElementById('keranjangList');
    if (keranjang.length === 0) {
      container.innerHTML = '<div class="empty">BELUM ADA ITEM DITAMBAHKAN</div>';
      return;
    }
    let html = '';
    keranjang.forEach(function (item, idx) {
      html += '<div class="keranjang-item">' +
        '<div class="info"><b>' + item.sku + '</b> &bull; Lokasi: ' + item.lokasi + ' &bull; Qty Fisik: ' + item.qtyFisik + '</div>' +
        '<button class="danger" onclick="hapusItem(' + idx + ')">HAPUS</button>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  async function submitSesi() {
    if (isSubmittingOpname) return;
    if (keranjang.length === 0) { showMsg('Keranjang opname kosong.', false); return; }

    isSubmittingOpname = true;
    setBtnLoading('btnSubmitSesiOpname', true, 'MEMPROSES SESI...', 'SUBMIT SESI OPNAME');

    const sessionId = "SO-" + Date.now();
    try {
       const payloads = await Promise.all(keranjang.map(async item => {
          let qs = 0;
          try {
             const qsRes = await fetch(`${SUPABASE_URL}/rest/v1/view_stok_realtime?sku=eq.${encodeURIComponent(item.sku)}&lokasi=eq.${encodeURIComponent(item.lokasi)}&select=sisa_stok`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
             });
             const qsData = await qsRes.json();
             if (qsData.length > 0) qs = qsData[0].sisa_stok;
          } catch(e) {}
          const prodObj = produkList.find(p => p.sku === item.sku);
          return {
             sesi_id: sessionId,
             sku: item.sku,
             nama_produk: prodObj ? prodObj.produk : "",
             size: prodObj ? prodObj.size : "",
             lokasi: item.lokasi,
             qty_sistem: qs,
             qty_fisik: item.qtyFisik,
             selisih: item.qtyFisik - qs,
             status: 'PENDING',
             jenis: 'Opname',
             operator: CURRENT_USER
          };
       }));
       const insRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_opname_queue`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(payloads)
       });
       if (!insRes.ok) throw new Error("Gagal insert ke Supabase");
       showMsg('Sesi opname ' + sessionId + ' berhasil diajukan (' + keranjang.length + ' item).', true);
       keranjang = [];
       renderKeranjang();
    } catch(err) {
       showMsg('Gagal submit sesi: ' + err.message, false);
    }
    isSubmittingOpname = false;
    setBtnLoading('btnSubmitSesiOpname', false, '', 'SUBMIT SESI OPNAME');
  }

  function tambahKeKeranjangManual() {
    const sku = document.getElementById('manualSku').value.trim().toUpperCase();
    const lokasi = document.getElementById('manualLokasi').value.trim();
    const delta = Number(document.getElementById('manualDelta').value);
    const alasan = document.getElementById('manualAlasan').value.trim();

    if (!sku) { showMsg('SKU wajib diisi.', false); return; }
    if (!lokasi) { showMsg('Lokasi wajib diisi.', false); return; }
    if (!delta || isNaN(delta)) { showMsg('Qty adjustment tidak boleh 0 atau kosong.', false); return; }
    if (!alasan) { showMsg('Alasan wajib diisi.', false); return; }

    const dupIdx = manualKeranjang.findIndex(item => item.sku === sku && item.lokasi === lokasi);
    if (dupIdx !== -1) {
      manualKeranjang[dupIdx].deltaQty = delta;
      manualKeranjang[dupIdx].alasan = alasan;
      showMsg(`Adjustment ${sku} di ${lokasi} diperbarui (${delta > 0 ? '+' + delta : delta}).`, true);
    } else {
      manualKeranjang.push({ sku: sku, lokasi: lokasi, deltaQty: delta, alasan: alasan });
    }

    renderKeranjangManual();
    document.getElementById('manualDelta').value = '';
    document.getElementById('manualAlasan').value = '';
    document.getElementById('manualSku').focus();
  }

  function hapusManualItem(idx) {
    manualKeranjang.splice(idx, 1);
    renderKeranjangManual();
  }

  function renderKeranjangManual() {
    const container = document.getElementById('manualKeranjangList');
    if (manualKeranjang.length === 0) {
      container.innerHTML = '<div class="empty">BELUM ADA ITEM DITAMBAHKAN</div>';
      return;
    }
    let html = '';
    manualKeranjang.forEach(function (item, idx) {
      const cls = item.deltaQty > 0 ? 'selisih-plus' : 'selisih-minus';
      const sign = item.deltaQty > 0 ? '+' : '';
      const prodObj = produkList.find(p => p.sku === item.sku);
      const nama = prodObj ? prodObj.produk : item.sku;
      html += '<div class="keranjang-item">' +
        '<div class="info"><div style="font-weight:700; color:var(--text); margin-bottom:2px;">' + nama + '</div>' +
        '<b>' + item.sku + '</b> &bull; Lokasi: <b>' + item.lokasi + '</b>' +
        ' &bull; Adjustment: <span class="' + cls + '">' + sign + item.deltaQty + '</span>' +
        '<br><small style="color:var(--muted)">Alasan: ' + item.alasan + '</small></div>' +
        '<button class="danger" onclick="hapusManualItem(' + idx + ')">HAPUS</button>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  async function submitManualBulk() {
    if (isSubmittingManual) return;
    if (manualKeranjang.length === 0) { showMsg('Keranjang adjustment manual kosong.', false); return; }

    isSubmittingManual = true;
    setBtnLoading('btnSubmitManualBulk', true, 'MEMPROSES PENGAJUAN...', 'SUBMIT SEMUA ADJUSTMENT MANUAL');
    const sessionId = "ADJ-" + Date.now();

    try {
       const payloads = await Promise.all(manualKeranjang.map(async item => {
          let qs = 0;
          try {
             const qsRes = await fetch(`${SUPABASE_URL}/rest/v1/view_stok_realtime?sku=eq.${encodeURIComponent(item.sku)}&lokasi=eq.${encodeURIComponent(item.lokasi)}&select=sisa_stok`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
             });
             const qsData = await qsRes.json();
             if (qsData.length > 0) qs = qsData[0].sisa_stok;
          } catch(e) {}
          const prodObj = produkList.find(p => p.sku === item.sku);
          return {
             sesi_id: sessionId,
             sku: item.sku,
             nama_produk: prodObj ? prodObj.produk : "",
             size: prodObj ? prodObj.size : "",
             lokasi: item.lokasi,
             qty_sistem: qs,
             qty_fisik: qs + item.deltaQty,
             selisih: item.deltaQty,
             status: 'PENDING',
             jenis: 'Manual',
             alasan: item.alasan,
             operator: CURRENT_USER
          };
       }));
       const insRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_opname_queue`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(payloads)
       });
       if (!insRes.ok) throw new Error("Gagal insert ke Supabase");
       showMsg(`Berhasil mengajukan ${manualKeranjang.length} adjustment manual untuk approval.`, true);
       manualKeranjang = [];
       renderKeranjangManual();
    } catch(err) {
       showMsg('Gagal submit adjustment: ' + err.message, false);
    }
    isSubmittingManual = false;
    setBtnLoading('btnSubmitManualBulk', false, '', 'SUBMIT SEMUA ADJUSTMENT MANUAL');
  }

  async function muatPending() {
    document.getElementById('pendingList').innerHTML = '<div class="empty">MEMUAT DATA PENDING...</div>';
    try {
       const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_opname_queue?status=eq.PENDING&order=tanggal.desc`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
       });
       if (!res.ok) throw new Error("Gagal fetch pending queue");
       const list = await res.json();
       
       const mappedList = list.map(q => ({
          id: q.id,
          timestamp: q.tanggal,
          sku: q.sku,
          namaProduk: q.nama_produk,
          lokasi: q.lokasi,
          tipe: q.jenis,
          qtySistem: q.qty_sistem,
          qtyFisik: q.qty_fisik,
          deltaQty: q.selisih,
          alasan: q.alasan || '-',
          pic: q.operator || '-'
       }));
       renderPending(mappedList);
    } catch(e) {
       document.getElementById('pendingList').innerHTML = '<div class="empty">GAGAL MEMUAT: ' + e.message + '</div>';
    }
  }

  function renderPending(list) {
    const badge = document.getElementById('badgePending');
    badge.innerText = list.length > 0 ? '(' + list.length + ')' : '';

    if (list.length === 0) {
      document.getElementById('pendingList').innerHTML = '<div class="empty">TIDAK ADA ADJUSTMENT YANG MENUNGGU APPROVAL.</div>';
      return;
    }

    let html = '<table><thead><tr>' +
      '<th style="width:30px;"><input type="checkbox" id="checkAllPending" onchange="toggleSelectAll(this)"></th>' +
      '<th>Timestamp</th><th>Produk / SKU</th><th>Lokasi</th><th>Tipe</th>' +
      '<th>Qty Sistem</th><th>Qty Fisik</th><th>Delta</th><th>Alasan</th><th>PIC</th><th>Aksi</th>' +
      '</tr></thead><tbody>';

    list.forEach(function (item) {
      const cls = item.deltaQty > 0 ? 'selisih-plus' : 'selisih-minus';
      const sign = item.deltaQty > 0 ? '+' : '';
      const tgl = item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID') : '-';
      const prodObj = produkList.find(p => p.sku === item.sku);
      const nama = item.namaProduk || (prodObj ? prodObj.produk : item.sku);
      html += '<tr>' +
        '<td><input type="checkbox" class="cb-pending" value="' + item.id + '"></td>' +
        '<td>' + tgl + '</td>' +
        '<td><div style="font-weight:700; font-size:12px;">' + nama + '</div><small style="color:var(--primary); font-weight:700;">' + item.sku + '</small></td>' +
        '<td>' + item.lokasi + '</td>' +
        '<td>' + item.tipe + '</td>' +
        '<td>' + item.qtySistem + '</td>' +
        '<td>' + (item.qtyFisik !== '' ? item.qtyFisik : '-') + '</td>' +
        '<td class="' + cls + '">' + sign + item.deltaQty + '</td>' +
        '<td>' + item.alasan + '</td>' +
        '<td>' + item.pic + '</td>' +
        '<td>' +
          '<div style="display:flex; gap:6px;">' +
            '<button class="approve" onclick="aksiApproval(\'' + item.id + '\', \'approve\')">✓</button>' +
            '<button class="danger" onclick="aksiApproval(\'' + item.id + '\', \'reject\')">✕</button>' +
          '</div>' +
        '</td>' +
        '</tr>';
    });

    html += '</tbody></table>';
    document.getElementById('pendingList').innerHTML = html;
  }

  function toggleSelectAll(master) {
    document.querySelectorAll('.cb-pending').forEach(cb => cb.checked = master.checked);
  }

  function getSelectedPendingIds() {
    const ids = [];
    document.querySelectorAll('.cb-pending:checked').forEach(cb => ids.push(cb.value));
    return ids;
  }

  async function prosesApprovalApi(ids, aksi, alasan) {
     const status = aksi === 'approve' ? 'APPROVED' : 'REJECTED';
     const promises = ids.map(async id => {
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_opname_queue?id=eq.${id}`, {
           method: 'PATCH',
           headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
           body: JSON.stringify({
              status: status,
              tanggal_approve: new Date().toISOString(),
              approved_by: CURRENT_USER,
              alasan: (alasan && aksi === 'reject') ? alasan : undefined
           })
        });
        if (!patchRes.ok) throw new Error("Gagal update queue status");
        
        if (status === 'APPROVED') {
           const getRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_opname_queue?id=eq.${id}&select=*`, {
              headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
           });
           const rowData = await getRes.json();
           const row = rowData[0];
           
           if (row.selisih !== 0) {
              const type = row.selisih > 0 ? 'IN' : 'OUT';
              const absQty = Math.abs(row.selisih);
              const ket = `[${row.jenis.toUpperCase()}] ${row.alasan ? row.alasan : 'Adjustment'}`;
              await fetch(`${SUPABASE_URL}/rest/v1/log_produk`, {
                 method: 'POST',
                 headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                    type: type,
                    sku: row.sku,
                    nama_produk: row.nama_produk,
                    size: row.size,
                    lokasi: row.lokasi,
                    qty: absQty,
                    operator: row.approved_by,
                    keterangan: ket
                 })
              });
           }
        }
     });
     await Promise.all(promises);
  }

  async function aksiApproval(id, aksi) {
    if (isProcessing) return;
    const alasanReject = aksi === 'reject' ? (prompt('Alasan penolakan (opsional):') || '') : '';
    isProcessing = true;
    showMsg('Memproses approval...', true);
    try {
       await prosesApprovalApi([id], aksi, alasanReject);
       showMsg(`Berhasil ${aksi} adjustment.`, true);
       muatPending();
    } catch(e) {
       showMsg('Gagal: ' + e.message, false);
    }
    isProcessing = false;
  }

  async function prosesAksiMassal(aksi) {
    if (isProcessing) return;
    const ids = getSelectedPendingIds();
    if (ids.length === 0) { alert('PILIH MINIMAL SATU DATA YANG INGIN DIPROSES!'); return; }
    const konfirmasi = confirm(`Yakin ingin ${aksi.toUpperCase()} ${ids.length} data terpilih?`);
    if (!konfirmasi) return;

    let alasanReject = '';
    if (aksi === 'reject') alasanReject = prompt('Alasan penolakan massal (opsional):') || '';

    isProcessing = true;
    const btnApprove = document.getElementById('btnApproveMassal');
    const btnReject = document.getElementById('btnRejectMassal');
    btnApprove.disabled = true;
    btnReject.disabled = true;
    if (aksi === 'approve') btnApprove.innerHTML = '<span class="spinner-inline"></span> MEMPROSES...';
    if (aksi === 'reject') btnReject.innerHTML = '<span class="spinner-inline"></span> MEMPROSES...';

    try {
       await prosesApprovalApi(ids, aksi, alasanReject);
       showMsg(`Berhasil memproses massal.`, true);
       muatPending();
    } catch (err) {
       showMsg('Gagal memproses massal: ' + err.message, false);
    }
    isProcessing = false;
    btnApprove.disabled = false;
    btnReject.disabled = false;
    btnApprove.innerHTML = 'APPROVE TERPILIH';
    btnReject.innerHTML = 'REJECT TERPILIH';
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('wms_theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeButtonText(savedTheme);
  }

  function updateThemeButtonText(theme) {
    const btn = document.getElementById('btnToggleTheme');
    if (!btn) return;
    btn.innerHTML = (theme === 'dark') ? '☀️ LIGHT MODE' : '🌙 DARK MODE';
  }

  function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const newTheme = (currentTheme === 'dark') ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('wms_theme', newTheme);
    updateThemeButtonText(newTheme);
  }
  initTheme();

  const MENU_WMS_LIST = [
    { value: "produk", label: "INVENTORY", akses: "Produk" },
    { value: "klasifikasi", label: "MONITORING & KLASIFIKASI", akses: "All" },
    { value: "penerimaanproduksi", label: "PENERIMAAN PRODUKSI", akses: "All" },
    { value: "fulfillment", label: "FULFILLMENT REFILL", akses: "Fulfillment" },
    { value: "peminjaman", label: "PEMINJAMAN", akses: "Peminjaman" },
    { value: "logproduk", label: "LOG PRODUK", akses: "All" },
    { value: "logmutasi", label: "LOG MUTASI", akses: "All" },
    { value: "updatedatabase", label: "UPDATE DATABASE", akses: "All" },
    { value: "stockopname", label: "STOCK OPNAME", akses: "All" }
  ];

  function bisaAksesMenuWms(kode) {
    if (typeof akses === "undefined" || !akses) return true;
    const roles = String(akses).split(',').map(function(r) { return r.trim(); });
    return roles.includes("All") || roles.includes(kode);
  }

  function isiNavDropdownWms(halamanAktif) {
    const select = document.getElementById('navSelectWms');
    if (!select) return;
    select.innerHTML = '';
    MENU_WMS_LIST.forEach(function (m) {
      if (!bisaAksesMenuWms(m.akses)) return;
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.label;
      if (m.value === halamanAktif) opt.selected = true;
      select.appendChild(opt);
    });
  }
  isiNavDropdownWms('stockopname');

  function navigasiMenu(select) {
    const val = select.value;
    if (val && val !== 'stockopname') {
      window.top.location.href = "<?= execUrl ?>?token=" + encodeURIComponent(token) + "&page=" + encodeURIComponent(val);
    }
  }

  function logout() {
    try { sessionStorage.clear(); } catch(e) {}
    window.top.location.href = "<?= execUrl ?>";
  }

  function downloadCsvBrowser(csvStr, filename) {
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  function downloadTemplateCsv() {
    const csv = "SKU,Lokasi,Qty Fisik\\n";
    downloadCsvBrowser(csv, "Template_Opname.csv");
  }

  async function exportStockCsvClient(filename) {
    showMsg('Sedang menyiapkan file export...', true);
    try {
       const res = await fetch(`${SUPABASE_URL}/rest/v1/view_stok_realtime?select=sku,lokasi,sisa_stok&sisa_stok=gt.0`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
       });
       if (!res.ok) throw new Error("Gagal fetch stock realtime");
       const data = await res.json();
       let csv = "SKU,Lokasi,Qty Sistem\\n";
       data.forEach(d => {
          csv += `"${d.sku}","${d.lokasi}",${d.sisa_stok}\\n`;
       });
       downloadCsvBrowser(csv, filename);
       showMsg('File export berhasil diunduh.', true);
    } catch(err) {
       showMsg('Gagal export: ' + err.message, false);
    }
  }

  function exportStockCsv() {
    exportStockCsvClient("Export_Stok_Opname.csv");
  }

  function exportStockCsvManual() {
    exportStockCsvClient("Export_Stok_Referensi.csv");
  }

  function importCsv() {
    const fileInput = document.getElementById('csvFileInputSoScan');
    if (!fileInput.files.length) {
      showMsg('Silakan pilih file CSV terlebih dahulu.', false);
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
      const text = e.target.result;
      const lines = text.split(/\\r?\\n/);
      let addedCount = 0;
      
      let separator = ',';
      if (lines.length > 0 && lines[0].indexOf(';') > -1 && lines[0].indexOf(',') === -1) {
        separator = ';';
      }

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const row = barisCsvKeArray(lines[i], separator);

        if (row.length >= 3) {
          const sku = row[0].trim().toUpperCase();
          const lokasi = row[1].trim();
          const qtyFisik = Number(row[2].trim());

          if (sku && lokasi && !isNaN(qtyFisik) && row[2].trim() !== "") {
            keranjang.push({ sku: sku, lokasi: lokasi, qtyFisik: qtyFisik });
            addedCount++;
          }
        }
      }

      if (addedCount > 0) {
        showMsg(`Berhasil menambahkan ${addedCount} item dari CSV ke sesi.`, true);
        renderKeranjang();
      } else {
        showMsg('Tidak ada data valid yang bisa dibaca. Pastikan format: SKU, Lokasi, Qty Fisik.', false);
      }

      fileInput.value = '';
    };

    reader.onerror = function() {
      showMsg('Gagal membaca file CSV.', false);
    };

    reader.readAsText(file);
  }

  function downloadTemplateManualCsv() {
    const csv = "SKU,Lokasi,Delta,Alasan\\n";
    downloadCsvBrowser(csv, "Template_Adjustment_Manual.csv");
  }

  function importCsvManual() {
    const fileInput = document.getElementById('csvFileInputManualSoScan');
    if (!fileInput.files.length) {
      showMsg('Silakan pilih file CSV terlebih dahulu.', false);
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
      const text = e.target.result;
      const lines = text.split(/\\r?\\n/);
      let addedCount = 0;
      
      let separator = ',';
      if (lines.length > 0 && lines[0].indexOf(';') > -1 && lines[0].indexOf(',') === -1) {
        separator = ';';
      }

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const row = barisCsvKeArray(lines[i], separator);

        if (row.length >= 4) {
          const sku = row[0].trim().toUpperCase();
          const lokasi = row[1].trim();
          const delta = Number(row[2].trim());
          const alasan = row[3].trim();

          if (sku && lokasi && !isNaN(delta) && delta !== 0 && alasan) {
            const dupIdx = manualKeranjang.findIndex(item => item.sku === sku && item.lokasi === lokasi);
            if (dupIdx !== -1) {
              manualKeranjang[dupIdx].deltaQty = delta;
              manualKeranjang[dupIdx].alasan = alasan;
            } else {
              manualKeranjang.push({ sku: sku, lokasi: lokasi, deltaQty: delta, alasan: alasan });
            }
            addedCount++;
          }
        }
      }

      if (addedCount > 0) {
        showMsg(`Berhasil menambahkan/memperbarui ${addedCount} item dari CSV ke sesi adjustment manual.`, true);
        renderKeranjangManual();
      } else {
        showMsg('Tidak ada data valid yang bisa dibaca.', false);
      }

      fileInput.value = '';
    };

    reader.onerror = function () {
      showMsg('Gagal membaca file CSV.', false);
    };

    reader.readAsText(file);
  }

  function barisCsvKeArray(text, separator = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += '"';
          i++; 
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === separator && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
"""

new_content = re.sub(r'<script>.*?</script>', '<script>\\n' + new_js + '\\n</script>', content, flags=re.DOTALL)

with open('WmsStockOpnameView.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Patch SO successful!")
