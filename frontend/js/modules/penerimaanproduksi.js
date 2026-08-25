
  let PENERIMAAN_DATA = [];
  let penerimaanCurrentPage = 1;
  const penerimaanPageSize = 50;
  let isPenerimaanInitialized = false;

  // Struktur State Form Multi-Kode & Multi-Variant
  let FORM_PRODUCT_BLOCKS = [];
  let currentTargetBlockIndexForPhoto = 0;
  let activeWebcamStream = null;

  const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'ALL SIZE', 'FREE SIZE', 'Default'];

  function initPenerimaanView() {
    if (!isPenerimaanInitialized) {
      isPenerimaanInitialized = true;
      const today = new Date().toISOString().split('T')[0];
      const tglInput = document.getElementById('inPenerimaanTanggal');
      if (tglInput && !tglInput.value) tglInput.value = today;

      // Inisialisasi blok produk pertama jika kosong
      if (FORM_PRODUCT_BLOCKS.length === 0) {
        tambahBlokProduk();
      }

      muatDataPenerimaan(false);
    }
  }

  // ============ TAB SWITCHER (RIWAYAT vs FORM INPUT) ============
  function switchPenerimaanTab(tabName) {
    const formEl = document.getElementById('penerimaanFormContainer');
    const riwayatEl = document.getElementById('penerimaanRiwayatContainer');
    const btnForm = document.getElementById('tabBtnForm');
    const btnRiwayat = document.getElementById('tabBtnRiwayat');

    if (tabName === 'form') {
      if (formEl) formEl.style.display = 'block';
      if (riwayatEl) riwayatEl.style.display = 'none';
      if (btnForm) btnForm.classList.add('active');
      if (btnRiwayat) btnRiwayat.classList.remove('active');
      setTimeout(() => {
        const el = document.getElementById('inPenerimaanSuratJalan');
        if (el) el.focus();
      }, 100);
    } else {
      if (formEl) formEl.style.display = 'none';
      if (riwayatEl) riwayatEl.style.display = 'block';
      if (btnForm) btnForm.classList.remove('active');
      if (btnRiwayat) btnRiwayat.classList.add('active');
    }
  }

  // ============ HEADER KATEGORI COMPACT ============
  function pilihKategoriCompact(kat) {
    const inKat = document.getElementById('inPenerimaanKategori');
    const btnLokal = document.getElementById('btnKatLokal');
    const btnKargo = document.getElementById('btnKatKargo');
    const inSj = document.getElementById('inPenerimaanSuratJalan');
    if (inKat) inKat.value = kat;

    if (kat === 'Lokal CMT') {
      if (btnLokal) {
        btnLokal.classList.add('active', 'active-lokal');
        btnLokal.classList.remove('active-kargo');
      }
      if (btnKargo) {
        btnKargo.classList.remove('active', 'active-kargo', 'active-lokal');
      }
      if (inSj) inSj.placeholder = "Contoh: SJ-2026/08/001";
    } else {
      if (btnLokal) {
        btnLokal.classList.remove('active', 'active-lokal', 'active-kargo');
      }
      if (btnKargo) {
        btnKargo.classList.add('active', 'active-kargo');
        btnKargo.classList.remove('active-lokal');
      }
      if (inSj) inSj.placeholder = "Contoh: RESI-KRG-001 / PACKING LIST";
    }
  }

  // ============ SIZE PROGRESSION HELPER ============
  function getNextSize(prevSize) {
    if (!prevSize || typeof prevSize !== 'string') return 'M';
    const clean = prevSize.trim().toUpperCase();

    const standardSizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
    const idx = standardSizes.indexOf(clean);
    if (idx !== -1 && idx < standardSizes.length - 1) {
      return standardSizes[idx + 1];
    }
    if (clean === '2XL') return '3XL';

    const num = parseInt(clean, 10);
    if (!isNaN(num) && String(num) === clean) {
      return String(num + 1);
    }

    if (clean === 'S/M') return 'L/XL';
    if (clean === 'ALL SIZE' || clean === 'ALLSIZE' || clean === 'DEFAULT' || clean === 'FREE SIZE') return 'S';

    return 'M';
  }

  // ============ MULTI-KODE & MULTI-VARIANT BUILDER ============
  function tambahBlokProduk() {
    FORM_PRODUCT_BLOCKS.push({
      id: Date.now() + Math.random(),
      kode_produksi: '',
      catatan: '',
      foto_url: '',
      variants: [
        { warna: '', size: 'S', qty: 1 }
      ]
    });
    renderProductBlocks();
  }

  function hapusBlokProduk(index) {
    if (FORM_PRODUCT_BLOCKS.length <= 1) {
      if (window.showToast) window.showToast('Minimal harus ada 1 Kode Produk.', 'warning');
      return;
    }
    FORM_PRODUCT_BLOCKS.splice(index, 1);
    renderProductBlocks();
  }

  function tambahVariantRow(blockIdx) {
    if (!FORM_PRODUCT_BLOCKS[blockIdx]) return;
    const variants = FORM_PRODUCT_BLOCKS[blockIdx].variants;
    const lastVar = variants.length > 0 ? variants[variants.length - 1] : null;
    const prevWarna = lastVar ? (lastVar.warna || '') : '';
    const nextSize = lastVar ? getNextSize(lastVar.size) : 'M';
    FORM_PRODUCT_BLOCKS[blockIdx].variants.push({ warna: prevWarna, size: nextSize, qty: 1 });
    renderProductBlocks();
  }

  function hapusVariantRow(blockIdx, varIdx) {
    if (!FORM_PRODUCT_BLOCKS[blockIdx]) return;
    if (FORM_PRODUCT_BLOCKS[blockIdx].variants.length <= 1) {
      if (window.showToast) window.showToast('Minimal harus ada 1 varian (warna & size).', 'warning');
      return;
    }
    FORM_PRODUCT_BLOCKS[blockIdx].variants.splice(varIdx, 1);
    renderProductBlocks();
  }

  function updateBlockField(blockIdx, field, val) {
    if (FORM_PRODUCT_BLOCKS[blockIdx]) {
      FORM_PRODUCT_BLOCKS[blockIdx][field] = val;
      updateFormSummary();
    }
  }

  function updateVariantField(blockIdx, varIdx, field, val) {
    if (FORM_PRODUCT_BLOCKS[blockIdx] && FORM_PRODUCT_BLOCKS[blockIdx].variants[varIdx]) {
      FORM_PRODUCT_BLOCKS[blockIdx].variants[varIdx][field] = val;
      updateFormSummary();
    }
  }

  function renderProductBlocks() {
    const container = document.getElementById('daftarBlokProdukContainer');
    if (!container) return;

    let html = '';
    FORM_PRODUCT_BLOCKS.forEach((block, bIdx) => {
      const blockNum = bIdx + 1;
      const hasPhoto = Boolean(block.foto_url);

      const lastVar = (block.variants && block.variants.length > 0) ? block.variants[block.variants.length - 1] : null;
      const nextSizePreview = lastVar ? getNextSize(lastVar.size) : 'M';

      // Foto box HTML
      let photoBoxHtml = '';
      if (hasPhoto) {
        photoBoxHtml = `
          <div class="compact-photo-dropzone has-image" tabindex="0" onfocus="setTargetBlockForPaste(${bIdx})" onpaste="handleDirectPhotoPaste(event, ${bIdx})" ondragover="handlePhotoDragOver(event, ${bIdx})" ondragleave="handlePhotoDragLeave(event, ${bIdx})" ondrop="handlePhotoDrop(event, ${bIdx})" title="Klik preview foto &bull; Tarik / Paste (Ctrl+V) foto baru">
            <img src="${block.foto_url}" class="compact-photo-thumb" onclick="openPhotoLightbox('${escapeHtml(block.foto_url)}', '${escapeHtml(block.kode_produksi || 'Produk ' + blockNum)}', '', '', '', '')" title="Klik preview foto">
            <button type="button" onclick="hapusFotoBlock(${bIdx}, event)" style="position: absolute; top: 2px; right: 2px; background: rgba(239, 68, 68, 0.85); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 11px; font-weight: 800;" title="Hapus foto">✕</button>
          </div>
        `;
      } else {
        photoBoxHtml = `
          <div class="compact-photo-dropzone" tabindex="0" onfocus="setTargetBlockForPaste(${bIdx})" onpaste="handleDirectPhotoPaste(event, ${bIdx})" ondragover="handlePhotoDragOver(event, ${bIdx})" ondragleave="handlePhotoDragLeave(event, ${bIdx})" ondrop="handlePhotoDrop(event, ${bIdx})" onclick="openPhotoPickerOptions(${bIdx})" title="Klik ambil foto / Drag &amp; Drop / Ctrl+V Paste disini">
            <div style="font-size: 18px; margin-bottom: 2px;">📷</div>
            <div style="font-size: 9px; font-weight: 700; color: var(--text-muted); text-align: center; line-height: 1.1;">FOTO<br><span style="font-size: 8px; color: var(--primary); font-weight: 600;">+DROP/PASTE</span></div>
          </div>
        `;
      }

      // Variants rows HTML (Warna, Size, Qty)
      let variantsHtml = `
        <div style="display: grid; grid-template-columns: 1fr 90px 70px 24px; gap: 6px; font-size: 9.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; padding-left: 2px;">
          <span>WARNA</span>
          <span>SIZE</span>
          <span style="text-align: center;">QTY</span>
          <span></span>
        </div>
      `;

      block.variants.forEach((v, vIdx) => {
        variantsHtml += `
          <div class="variant-row">
            <input type="text" class="search-input compact-input" placeholder="Warna (misal: Black, Sage)" value="${escapeHtml(v.warna || '')}" onfocus="setTargetBlockForPaste(${bIdx})" oninput="updateVariantField(${bIdx}, ${vIdx}, 'warna', this.value.toUpperCase())" style="font-weight: 700; text-transform: uppercase;">
            <input type="text" class="search-input compact-input" list="sizeOptionsList" value="${escapeHtml(v.size || 'S')}" placeholder="Size" onfocus="setTargetBlockForPaste(${bIdx})" oninput="updateVariantField(${bIdx}, ${vIdx}, 'size', this.value)" style="text-align: center; font-weight: 700;">
            <input type="number" class="search-input compact-input" min="1" value="${v.qty || 1}" placeholder="Qty" onfocus="setTargetBlockForPaste(${bIdx})" oninput="updateVariantField(${bIdx}, ${vIdx}, 'qty', parseInt(this.value, 10) || 1)" style="text-align: center; font-weight: 800;">
            <button type="button" class="btn-remove-mini" onclick="hapusVariantRow(${bIdx}, ${vIdx})" title="Hapus varian ini">✕</button>
          </div>
        `;
      });

      html += `
        <div class="prod-block-card" data-block-index="${bIdx}" onfocusin="setTargetBlockForPaste(${bIdx})">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px dashed var(--border); padding-bottom: 6px;">
            <div style="font-size: 11px; font-weight: 800; color: var(--primary); display: flex; align-items: center; gap: 6px;">
              <span>🏷️</span> PRODUK #${blockNum}
            </div>
            ${FORM_PRODUCT_BLOCKS.length > 1 ? `<button type="button" onclick="hapusBlokProduk(${bIdx})" class="btn btn-secondary" style="height: 24px; padding: 0 8px; font-size: 10px; color: var(--danger); border-color: rgba(239, 68, 68, 0.3);" title="Hapus seluruh kode produk ini">🗑️ HAPUS KODE</button>` : ''}
          </div>

          <div class="penerimaan-prod-grid">
            
            <!-- 1. FOTO PRODUK (1 KODE = 1 FOTO + DRAG/DROP & PASTE) -->
            <div class="penerimaan-col-photo" id="photoCol_${bIdx}">
              <label class="form-compact-label">FOTO PRODUK</label>
              <div id="photoDropzoneWrap_${bIdx}">
                ${photoBoxHtml}
              </div>
              <div style="display: flex; gap: 3px; margin-top: 4px;">
                <button type="button" onclick="triggerKameraBlock(${bIdx})" style="flex: 1; height: 20px; font-size: 9px; padding: 0; background: var(--card-alt); border: 1px solid var(--border); border-radius: 3px; cursor: pointer; color: var(--text);" title="Ambil Kamera">📷 Kam</button>
                <button type="button" onclick="triggerGaleriBlock(${bIdx})" style="flex: 1; height: 20px; font-size: 9px; padding: 0; background: var(--card-alt); border: 1px solid var(--border); border-radius: 3px; cursor: pointer; color: var(--text);" title="Pilih File Galeri">📁 File</button>
              </div>
            </div>

            <!-- 2. KODE PRODUKSI & CATATAN TAMBAHAN -->
            <div class="penerimaan-col-info">
              <div style="margin-bottom: 8px;">
                <label class="form-compact-label">KODE PRODUKSI <span style="color: var(--danger);">*</span></label>
                <input type="text" class="search-input compact-input" placeholder="Contoh: K-1049, D-552" value="${escapeHtml(block.kode_produksi)}" onfocus="setTargetBlockForPaste(${bIdx})" oninput="updateBlockField(${bIdx}, 'kode_produksi', this.value.toUpperCase())" style="width: 100%; font-weight: 800; color: var(--primary); text-transform: uppercase;">
              </div>
              
              <div>
                <label class="form-compact-label">CATATAN TAMBAHAN</label>
                <input type="text" class="search-input compact-input" placeholder="Catatan khusus produk (opsional)..." value="${escapeHtml(block.catatan)}" onfocus="setTargetBlockForPaste(${bIdx})" oninput="updateBlockField(${bIdx}, 'catatan', this.value)" style="width: 100%; font-size: 11.5px;">
              </div>
            </div>

            <!-- 3. DAFTAR VARIAN (WARNA, SIZE & QTY) -->
            <div class="penerimaan-col-variants">
              <div style="margin-bottom: 4px;">
                <label class="form-compact-label" style="margin-bottom: 0;">VARIAN (WARNA &amp; SIZE &amp; QTY) <span style="color: var(--danger);">*</span></label>
              </div>
              <div style="background: var(--bg-surface); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
                ${variantsHtml}
                <button type="button" class="btn-tambah-varian-bottom" onclick="tambahVariantRow(${bIdx})">
                  ➕ Tambah Varian (${nextSizePreview})
                </button>
              </div>
            </div>

          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    updateFormSummary();
  }

  function updateFormSummary() {
    let totalKode = FORM_PRODUCT_BLOCKS.length;
    let totalVarian = 0;
    let totalQty = 0;

    FORM_PRODUCT_BLOCKS.forEach(b => {
      if (Array.isArray(b.variants)) {
        totalVarian += b.variants.length;
        b.variants.forEach(v => {
          totalQty += (parseInt(v.qty, 10) || 0);
        });
      }
    });

    const badge = document.getElementById('formSummaryBadge');
    if (badge) {
      badge.innerHTML = `Total: <b>${totalKode} Kode</b> &bull; <b>${totalVarian} Varian</b> &bull; <b>${totalQty} Pcs</b>`;
    }
  }

  // ============ UPDATE HANYA DOM FOTO SPESIFIK (ANTI RESET FORM) ============
  function updateBlockPhotoDOM(blockIdx) {
    const block = FORM_PRODUCT_BLOCKS[blockIdx];
    if (!block) return;
    const wrap = document.getElementById(`photoDropzoneWrap_${blockIdx}`);
    if (!wrap) {
      renderProductBlocks();
      return;
    }

    const blockNum = blockIdx + 1;
    const hasPhoto = Boolean(block.foto_url);
    if (hasPhoto) {
      wrap.innerHTML = `
        <div class="compact-photo-dropzone has-image" tabindex="0" onfocus="setTargetBlockForPaste(${blockIdx})" onpaste="handleDirectPhotoPaste(event, ${blockIdx})" ondragover="handlePhotoDragOver(event, ${blockIdx})" ondragleave="handlePhotoDragLeave(event, ${blockIdx})" ondrop="handlePhotoDrop(event, ${blockIdx})" title="Klik preview foto &bull; Tarik / Paste (Ctrl+V) foto baru">
          <img src="${block.foto_url}" class="compact-photo-thumb" onclick="openPhotoLightbox('${escapeHtml(block.foto_url)}', '${escapeHtml(block.kode_produksi || 'Produk ' + blockNum)}', '', '', '', '')" title="Klik preview foto">
          <button type="button" onclick="hapusFotoBlock(${blockIdx}, event)" style="position: absolute; top: 2px; right: 2px; background: rgba(239, 68, 68, 0.85); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 11px; font-weight: 800;" title="Hapus foto">✕</button>
        </div>
      `;
    } else {
      wrap.innerHTML = `
        <div class="compact-photo-dropzone" tabindex="0" onfocus="setTargetBlockForPaste(${blockIdx})" onpaste="handleDirectPhotoPaste(event, ${blockIdx})" ondragover="handlePhotoDragOver(event, ${blockIdx})" ondragleave="handlePhotoDragLeave(event, ${blockIdx})" ondrop="handlePhotoDrop(event, ${blockIdx})" onclick="openPhotoPickerOptions(${blockIdx})" title="Klik ambil foto / Drag &amp; Drop / Ctrl+V Paste disini">
          <div style="font-size: 18px; margin-bottom: 2px;">📷</div>
          <div style="font-size: 9px; font-weight: 700; color: var(--text-muted); text-align: center; line-height: 1.1;">FOTO<br><span style="font-size: 8px; color: var(--primary); font-weight: 600;">+DROP/PASTE</span></div>
        </div>
      `;
    }
  }

  // ============ PHOTO PICKER & DRAG/PASTE PER BLOCK ============
  function setTargetBlockForPaste(blockIdx) {
    currentTargetBlockIndexForPhoto = blockIdx;
  }

  function openPhotoPickerOptions(blockIdx) {
    currentTargetBlockIndexForPhoto = blockIdx;
    triggerKameraBlock(blockIdx);
  }

  function triggerKameraBlock(blockIdx) {
    currentTargetBlockIndexForPhoto = blockIdx;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      const camIn = document.getElementById('globalCameraFileInput');
      if (camIn) {
        camIn.onchange = function() { handleGlobalPhotoSelected(this); };
        camIn.click();
      }
    } else {
      openWebcamModal();
    }
  }

  function triggerGaleriBlock(blockIdx) {
    currentTargetBlockIndexForPhoto = blockIdx;
    const fileIn = document.getElementById('globalGalleryFileInput');
    if (fileIn) {
      fileIn.onchange = function() { handleGlobalPhotoSelected(this); };
      fileIn.click();
    }
  }

  function handleGlobalPhotoSelected(input) {
    if (!input || !input.files || input.files.length === 0) return;
    const file = input.files[0];
    processImageFile(file, currentTargetBlockIndexForPhoto);
    input.value = '';
  }

  function processImageFile(file, blockIdx) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      if (window.showToast) window.showToast('Berkas yang dilampirkan harus berupa gambar (JPG/PNG).', 'warning');
      return;
    }

    if (window.showToast) window.showToast('Memproses & mengompresi foto...', 'info');

    const reader = new FileReader();
    reader.onerror = function() {
      if (window.showToast) window.showToast('Gagal membaca berkas gambar.', 'danger');
    };
    reader.onload = function(e) {
      const img = new Image();
      img.onerror = function() {
        if (window.showToast) window.showToast('Gambar tidak valid atau rusak.', 'danger');
      };
      img.onload = function() {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 900;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
          if (FORM_PRODUCT_BLOCKS[blockIdx]) {
            FORM_PRODUCT_BLOCKS[blockIdx].foto_url = compressedDataUrl;
            updateBlockPhotoDOM(blockIdx);
            if (window.showToast) window.showToast(`✓ Foto berhasil dilampirkan ke Produk #${blockIdx + 1}!`, 'success');
          }
        } catch(err) {
          console.error('Error compressing image:', err);
          if (window.showToast) window.showToast('Gagal memproses gambar: ' + err.message, 'danger');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ============ DRAG & DROP FOTO ============
  window.addEventListener('dragover', function(e) { e.preventDefault(); }, false);
  window.addEventListener('drop', function(e) { e.preventDefault(); }, false);

  function handlePhotoDragOver(e, blockIdx) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    const el = e.currentTarget;
    if (el) el.classList.add('drag-active');
  }

  function handlePhotoDragLeave(e, blockIdx) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    if (el) el.classList.remove('drag-active');
  }

  function handlePhotoDrop(e, blockIdx) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    if (el) el.classList.remove('drag-active');

    currentTargetBlockIndexForPhoto = blockIdx;

    if (e.dataTransfer) {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          if (file.type && file.type.startsWith('image/')) {
            processImageFile(file, blockIdx);
            return;
          }
        }
      }
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];
          if (item.type && item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            if (file) {
              processImageFile(file, blockIdx);
              return;
            }
          }
        }
      }
    }

    if (window.showToast) window.showToast('Tarik berkas foto yang valid (JPG/PNG).', 'warning');
  }

  // ============ DIRECT & GLOBAL PASTE (CTRL+V) ============
  function handleDirectPhotoPaste(e, blockIdx) {
    e.preventDefault();
    e.stopPropagation();
    currentTargetBlockIndexForPhoto = blockIdx;

    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i];
        if (file.type && file.type.startsWith('image/')) {
          processImageFile(file, blockIdx);
          return;
        }
      }
    }

    if (clipboardData.items && clipboardData.items.length > 0) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type && item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            processImageFile(file, blockIdx);
            return;
          }
        }
      }
    }

    if (window.showToast) window.showToast('Tidak ada gambar di clipboard. Copy gambar terlebih dahulu lalu tekan Ctrl+V di sini.', 'warning');
  }

  document.addEventListener('paste', function(e) {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    let imageFile = null;
    if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        if (clipboardData.files[i].type && clipboardData.files[i].type.startsWith('image/')) {
          imageFile = clipboardData.files[i];
          break;
        }
      }
    }

    if (!imageFile && clipboardData.items && clipboardData.items.length > 0) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        if (clipboardData.items[i].type && clipboardData.items[i].type.indexOf('image') !== -1) {
          imageFile = clipboardData.items[i].getAsFile();
          break;
        }
      }
    }

    if (imageFile) {
      e.preventDefault();

      // Jika Edit Modal sedang terbuka, tempel ke form Edit
      const modalEdit = document.getElementById('modalEditPenerimaan');
      if (modalEdit && modalEdit.style.display === 'flex') {
        processEditImageFile(imageFile);
        return;
      }

      // Jika Form Input sedang aktif
      const formEl = document.getElementById('penerimaanFormContainer');
      if (formEl && formEl.style.display !== 'none') {
        let targetIdx = currentTargetBlockIndexForPhoto || 0;
        if (document.activeElement) {
          const card = document.activeElement.closest('.prod-block-card');
          if (card && card.dataset.blockIndex !== undefined) {
            targetIdx = parseInt(card.dataset.blockIndex, 10);
          }
        }
        processImageFile(imageFile, targetIdx);
      }
    }
  });

  function hapusFotoBlock(blockIdx, event) {
    if (event) event.stopPropagation();
    if (FORM_PRODUCT_BLOCKS[blockIdx]) {
      FORM_PRODUCT_BLOCKS[blockIdx].foto_url = '';
      updateBlockPhotoDOM(blockIdx);
    }
  }

  // ============ WEBCAM LIVE CAPTURE (DESKTOP) ============
  function openWebcamModal() {
    const modal = document.getElementById('webcamCaptureModal');
    const video = document.getElementById('webcamVideoEl');
    if (!modal || !video) return;

    modal.style.display = 'flex';

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
          activeWebcamStream = stream;
          video.srcObject = stream;
        })
        .catch(err => {
          if (window.showToast) window.showToast('Tidak dapat mengakses webcam: ' + err.message, 'danger');
          closeWebcamModal();
          const fileIn = document.getElementById('globalGalleryFileInput');
          if (fileIn) fileIn.click();
        });
    } else {
      const fileIn = document.getElementById('globalGalleryFileInput');
      if (fileIn) fileIn.click();
    }
  }

  function closeWebcamModal() {
    const modal = document.getElementById('webcamCaptureModal');
    const video = document.getElementById('webcamVideoEl');
    if (modal) modal.style.display = 'none';

    if (activeWebcamStream) {
      activeWebcamStream.getTracks().forEach(track => track.stop());
      activeWebcamStream = null;
    }
    if (video) video.srcObject = null;
  }

  function capturePhotoFromWebcam() {
    const video = document.getElementById('webcamVideoEl');
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.78);

    // Cek apakah dipanggil saat Edit Modal terbuka
    const modalEdit = document.getElementById('modalEditPenerimaan');
    if (modalEdit && modalEdit.style.display === 'flex') {
      updateEditPhotoPreviewDOM(dataUrl);
    } else if (FORM_PRODUCT_BLOCKS[currentTargetBlockIndexForPhoto]) {
      FORM_PRODUCT_BLOCKS[currentTargetBlockIndexForPhoto].foto_url = dataUrl;
      updateBlockPhotoDOM(currentTargetBlockIndexForPhoto);
    }
    closeWebcamModal();
  }

  // ============ RESET & SUBMIT BATCH PENERIMAAN ============
  function resetFormPenerimaan() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inPenerimaanTanggal').value = today;
    document.getElementById('inPenerimaanSuratJalan').value = '';
    document.getElementById('inPenerimaanCatatanGlobal').value = '';
    pilihKategoriCompact('Lokal CMT');
    FORM_PRODUCT_BLOCKS = [];
    tambahBlokProduk();
  }

  function submitBatchPenerimaan(btn) {
    const tanggal = document.getElementById('inPenerimaanTanggal').value;
    const kategori = document.getElementById('inPenerimaanKategori').value;
    const noSuratJalan = document.getElementById('inPenerimaanSuratJalan').value.trim();
    const catatanGlobal = document.getElementById('inPenerimaanCatatanGlobal').value.trim();

    if (!noSuratJalan) {
      if (window.showToast) window.showToast('Nomor Surat Jalan wajib diisi!', 'warning');
      document.getElementById('inPenerimaanSuratJalan').focus();
      return;
    }

    if (FORM_PRODUCT_BLOCKS.length === 0) {
      if (window.showToast) window.showToast('Minimal harus ada 1 Kode Produk.', 'warning');
      return;
    }

    // Validasi tiap blok
    for (let i = 0; i < FORM_PRODUCT_BLOCKS.length; i++) {
      const b = FORM_PRODUCT_BLOCKS[i];
      if (!b.kode_produksi) {
        if (window.showToast) window.showToast(`Produk #${i + 1}: Kode Produksi wajib diisi!`, 'warning');
        return;
      }
      if (!b.variants || b.variants.length === 0) {
        if (window.showToast) window.showToast(`Produk #${i + 1} (${b.kode_produksi}): Minimal harus ada 1 varian (warna & size)!`, 'warning');
        return;
      }
      for (let j = 0; j < b.variants.length; j++) {
        const v = b.variants[j];
        if (!v.warna) {
          if (window.showToast) window.showToast(`Produk #${i + 1} (${b.kode_produksi}) Baris #${j + 1}: Warna wajib diisi!`, 'warning');
          return;
        }
      }
    }

    const payload = {
      tanggal: tanggal,
      kategori: kategori,
      no_surat_jalan: noSuratJalan,
      keterangan: catatanGlobal,
      produk_list: FORM_PRODUCT_BLOCKS
    };

    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MENYIMPAN KE SUPABASE...');

    google.script.run
      .withSuccessHandler(function(res) {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        if (res && res.success) {
          if (window.showToast) window.showToast(res.message || 'Laporan kedatangan barang berhasil disimpan! 🚀', 'success');
          resetFormPenerimaan();
          switchPenerimaanTab('riwayat');
          muatDataPenerimaan(true);
        } else {
          if (window.showToast) window.showToast(res ? res.message : 'Gagal menyimpan data ke database', 'danger');
        }
      })
      .withFailureHandler(function(err) {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        if (window.showToast) window.showToast('Error server: ' + err.message, 'danger');
      })
      .simpanPenerimaanProduksi(TOKEN, payload);
  }

  // ============ MUAT & RENDER DATA RIWAYAT DARI SUPABASE ============
  function muatDataPenerimaan(force) {
    const tbody = document.getElementById('penerimaanTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 35px; color: var(--text-muted); font-style: italic;">⏳ Mengambil data penerimaan terbaru dari Supabase Cloud...</td></tr>';
    }

    const kategori = document.getElementById('filterPenerimaanKategori') ? document.getElementById('filterPenerimaanKategori').value : 'ALL';
    const startDate = document.getElementById('filterPenerimaanStart') ? document.getElementById('filterPenerimaanStart').value : '';
    const endDate = document.getElementById('filterPenerimaanEnd') ? document.getElementById('filterPenerimaanEnd').value : '';
    const keyword = document.getElementById('searchPenerimaan') ? document.getElementById('searchPenerimaan').value : '';

    const filters = {
      kategori: kategori,
      startDate: startDate,
      endDate: endDate,
      keyword: keyword,
      limit: 500
    };

    google.script.run
      .withSuccessHandler(function(res) {
        if (res && res.success) {
          PENERIMAAN_DATA = res.data || [];
          penerimaanCurrentPage = 1;
          renderPenerimaanTable();
          updateKpiPenerimaan(PENERIMAAN_DATA);
        } else {
          if (tbody) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--danger); padding: 30px;">' + (res ? res.message : 'Gagal memuat data') + '</td></tr>';
          }
        }
      })
      .withFailureHandler(function(err) {
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--danger); padding: 30px;">Error koneksi: ' + err.message + '</td></tr>';
        }
      })
      .getPenerimaanProduksiList(TOKEN, filters);
  }

  function filterDataPenerimaanLokal() {
    renderPenerimaanTable();
  }

  function resetFilterPenerimaan() {
    if (document.getElementById('searchPenerimaan')) document.getElementById('searchPenerimaan').value = '';
    if (document.getElementById('filterPenerimaanKategori')) document.getElementById('filterPenerimaanKategori').value = 'ALL';
    if (document.getElementById('filterPenerimaanStart')) document.getElementById('filterPenerimaanStart').value = '';
    if (document.getElementById('filterPenerimaanEnd')) document.getElementById('filterPenerimaanEnd').value = '';
    muatDataPenerimaan(true);
  }

  function updateKpiPenerimaan(list) {
    let totalItems = list.length;
    let totalQty = 0;
    let totalLokal = 0;
    let totalKargo = 0;

    list.forEach(r => {
      const q = parseInt(r.qty, 10) || 1;
      totalQty += q;
      const kat = String(r.kategori || '').toLowerCase();
      if (kat.includes('lokal')) totalLokal += q;
      else if (kat.includes('kargo')) totalKargo += q;
    });

    const elTotal = document.getElementById('kpiPenerimaanTotal');
    const elQty = document.getElementById('kpiPenerimaanQty');
    const elLokal = document.getElementById('kpiPenerimaanLokal');
    const elKargo = document.getElementById('kpiPenerimaanKargo');

    if (elTotal) elTotal.textContent = totalItems.toLocaleString('id-ID');
    if (elQty) elQty.textContent = totalQty.toLocaleString('id-ID');
    if (elLokal) elLokal.textContent = totalLokal.toLocaleString('id-ID') + ' pcs';
    if (elKargo) elKargo.textContent = totalKargo.toLocaleString('id-ID') + ' pcs';
  }

  function renderPenerimaanTable() {
    const tbody = document.getElementById('penerimaanTableBody');
    const infoEl = document.getElementById('penerimaanPaginationInfo');
    const countBadge = document.getElementById('penerimaanTotalCount');
    const pageIndicator = document.getElementById('penerimaanPageIndicator');
    if (!tbody) return;

    const keyword = (document.getElementById('searchPenerimaan') ? document.getElementById('searchPenerimaan').value : '').toLowerCase().trim();

    let filtered = PENERIMAAN_DATA;
    if (keyword) {
      filtered = filtered.filter(r => {
        const combined = (
          String(r.kode_produksi || '') + ' ' +
          String(r.no_surat_jalan || '') + ' ' +
          String(r.warna || '') + ' ' +
          String(r.size || '') + ' ' +
          String(r.keterangan || '') + ' ' +
          String(r.operator || '')
        ).toLowerCase();
        return combined.includes(keyword);
      });
    }

    if (countBadge) countBadge.textContent = `${filtered.length.toLocaleString('id-ID')} Baris Data`;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 35px; color: var(--text-muted);">Tidak ada data kedatangan barang yang sesuai filter.</td></tr>';
      if (infoEl) infoEl.textContent = 'Menampilkan 0 dari 0 data';
      if (pageIndicator) pageIndicator.textContent = '1 / 1';
      return;
    }

    const totalPages = Math.ceil(filtered.length / penerimaanPageSize) || 1;
    if (penerimaanCurrentPage > totalPages) penerimaanCurrentPage = totalPages;
    if (penerimaanCurrentPage < 1) penerimaanCurrentPage = 1;

    const startIdx = (penerimaanCurrentPage - 1) * penerimaanPageSize;
    const pageData = filtered.slice(startIdx, startIdx + penerimaanPageSize);

    let html = '';
    pageData.forEach((row, idx) => {
      const globalIdx = startIdx + idx;
      const isKargo = String(row.kategori || '').toLowerCase().includes('kargo');
      const katBadge = isKargo
        ? '<span class="badge-kategori-kargo">🚚 KARGO</span>'
        : '<span class="badge-kategori-lokal">🏭 LOKAL CMT</span>';

      let fotoHtml = '<span style="color: var(--text-dim); font-size: 11px;">-</span>';
      if (row.foto_url) {
        fotoHtml = `<img src="${row.foto_url}" class="table-foto-thumb" onclick="openPhotoLightbox('${escapeHtml(row.foto_url)}', '${escapeHtml(row.kode_produksi)}', '${escapeHtml(row.no_surat_jalan)}', '${escapeHtml(row.warna)}', '${escapeHtml(row.size)}', '${row.qty}')" title="Klik perbesar foto">`;
      }

      html += `<tr>
        <td style="padding-left: 10px; font-weight: 600; color: var(--text-muted); font-size: 11.5px; white-space: nowrap;">${formatTanggalIndo(row.tanggal_penerimaan)}</td>
        <td style="text-align: center;">${katBadge}</td>
        <td style="padding-left: 8px; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(row.no_surat_jalan || '-')}"><span class="badge-sku">${escapeHtml(row.no_surat_jalan || '-')}</span></td>
        <td style="text-align: center;">${fotoHtml}</td>
        <td style="padding-left: 8px; font-weight: 800; color: var(--primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(row.kode_produksi || '-')}">${escapeHtml(row.kode_produksi || '-')}</td>
        <td style="padding-left: 8px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(row.warna || '-')}">${escapeHtml(row.warna || '-')}</td>
        <td style="text-align: center;"><span class="badge-size">${escapeHtml(row.size || '-')}</span></td>
        <td style="text-align: center; font-weight: 800; color: var(--text);">${row.qty || 1}</td>
        <td style="padding-left: 8px; font-size: 11px; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(row.keterangan || '-')}">${escapeHtml(row.keterangan || '-')}</td>
        <td style="padding-left: 8px; font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(row.operator || '-')}">${escapeHtml(row.operator || '-')}</td>
        <td style="text-align: center; white-space: nowrap; padding: 4px 4px;">
          <button type="button" class="btn-action-mini edit" onclick="openEditPenerimaanModal(${globalIdx})" title="Edit data penerimaan ini">✏️ Edit</button>
          <button type="button" class="btn-action-mini delete" onclick="konfirmasiHapusPenerimaan(${globalIdx})" title="Hapus data penerimaan ini">🗑️</button>
        </td>
      </tr>`;
    });

    tbody.innerHTML = html;
    if (infoEl) infoEl.textContent = `Menampilkan ${startIdx + 1} - ${Math.min(startIdx + penerimaanPageSize, filtered.length)} dari ${filtered.length} data`;
    if (pageIndicator) pageIndicator.textContent = `${penerimaanCurrentPage} / ${totalPages}`;
  }

  function changePenerimaanPage(delta) {
    penerimaanCurrentPage += delta;
    renderPenerimaanTable();
  }

  // ============ EDIT & HAPUS MODAL CONTROLLERS (PER SURAT JALAN / BATCH) ============
  let editBatchItems = [];
  let currentEditItemPhotoIdx = -1;
  let currentHapusPayload = null;

  function openEditPenerimaanModal(rowIndexOrData) {
    let targetRow = null;
    if (typeof rowIndexOrData === 'number') {
      targetRow = PENERIMAAN_DATA[rowIndexOrData];
    } else {
      targetRow = rowIndexOrData;
    }
    if (!targetRow) return;

    const noSJ = String(targetRow.no_surat_jalan || '').trim().toUpperCase();
    const tgl = targetRow.tanggal_penerimaan || '';
    const kat = targetRow.kategori || 'Lokal CMT';
    const catatan = targetRow.keterangan || '';

    document.getElementById('editPenerimaanOrigSJ').value = noSJ;
    document.getElementById('editInTanggal').value = tgl;
    document.getElementById('editInKategori').value = kat;
    document.getElementById('editInSuratJalan').value = noSJ;
    document.getElementById('editInCatatanGlobal').value = catatan;

    // Kumpulkan SEMUA item yang berada dalam 1 Surat Jalan yang sama (Per Penerimaan)
    let matchingRows = [];
    if (noSJ && noSJ !== '-' && noSJ !== 'DEFAULT') {
      matchingRows = PENERIMAAN_DATA.filter(r => String(r.no_surat_jalan || '').trim().toUpperCase() === noSJ);
    }
    if (matchingRows.length === 0) {
      matchingRows = [targetRow];
    }

    editBatchItems = matchingRows.map(r => ({
      id: r.id || '',
      sheet_row: r.sheet_row || '',
      kode_produksi: r.kode_produksi || '',
      warna: r.warna || '',
      size: r.size || 'Default',
      qty: parseInt(r.qty, 10) || 1,
      foto_url: r.foto_url || '',
      keterangan: r.keterangan || '',
      created_at: r.created_at || ''
    }));

    renderEditBatchItemsTable();

    const modal = document.getElementById('modalEditPenerimaan');
    if (modal) modal.style.display = 'flex';
  }

  function closeEditPenerimaanModal() {
    const modal = document.getElementById('modalEditPenerimaan');
    if (modal) modal.style.display = 'none';
    editBatchItems = [];
    currentEditItemPhotoIdx = -1;
  }

  function renderEditBatchItemsTable() {
    const tbody = document.getElementById('editBatchTableBody');
    const badge = document.getElementById('editBatchCountBadge');
    const summary = document.getElementById('editBatchLiveSummary');
    if (!tbody) return;

    let totalQty = 0;
    let html = '';

    editBatchItems.forEach((it, idx) => {
      const q = parseInt(it.qty, 10) || 0;
      totalQty += q;

      let fotoThumb = '<div style="font-size:16px;">📷</div>';
      if (it.foto_url) {
        fotoThumb = `<img src="${it.foto_url}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;" title="Klik ganti foto">`;
      }

      html += `<tr>
        <td style="text-align:center; padding:4px;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:3px;">
            <div style="width:44px; height:44px; border:1px dashed var(--border); border-radius:var(--radius-sm); overflow:hidden; display:flex; align-items:center; justify-content:center; background:var(--bg-surface); cursor:pointer;" onclick="triggerGaleriEditItem(${idx})" title="Klik untuk upload / ganti foto">
              ${fotoThumb}
            </div>
            <div style="display:flex; gap:3px;">
              <button type="button" class="btn btn-secondary" style="height:18px; width:20px; padding:0; font-size:9px;" onclick="triggerKameraEditItem(${idx})" title="Kamera">📷</button>
              <button type="button" class="btn btn-secondary" style="height:18px; width:20px; padding:0; font-size:9px;" onclick="triggerGaleriEditItem(${idx})" title="Upload">📁</button>
              ${it.foto_url ? `<button type="button" class="btn btn-secondary" style="height:18px; width:20px; padding:0; font-size:9px; color:var(--danger);" onclick="hapusFotoEditItem(${idx})" title="Hapus foto">✕</button>` : ''}
            </div>
          </div>
        </td>
        <td style="padding:4px 6px;">
          <input type="text" class="search-input compact-input" style="width:100%; font-weight:800; color:var(--primary); text-transform:uppercase;" value="${escapeHtml(it.kode_produksi)}" onchange="updateEditBatchField(${idx}, 'kode_produksi', this.value)" placeholder="KODE PRODUKSI">
        </td>
        <td style="padding:4px 6px;">
          <input type="text" class="search-input compact-input" style="width:100%; font-weight:700; text-transform:uppercase;" value="${escapeHtml(it.warna)}" onchange="updateEditBatchField(${idx}, 'warna', this.value)" placeholder="Warna">
        </td>
        <td style="padding:4px 6px;">
          <input type="text" list="sizeOptionsList" class="search-input compact-input" style="width:100%; text-align:center; font-weight:700;" value="${escapeHtml(it.size || 'Default')}" onchange="updateEditBatchField(${idx}, 'size', this.value)">
        </td>
        <td style="padding:4px 6px;">
          <input type="number" min="1" class="search-input compact-input" style="width:100%; text-align:center; font-weight:800;" value="${it.qty || 1}" onchange="updateEditBatchField(${idx}, 'qty', this.value)">
        </td>
        <td style="padding:4px 6px;">
          <input type="text" class="search-input compact-input" style="width:100%; font-size:11px;" value="${escapeHtml(it.keterangan || '')}" onchange="updateEditBatchField(${idx}, 'keterangan', this.value)" placeholder="Catatan opsional...">
        </td>
        <td style="text-align:center; padding:4px;">
          <button type="button" class="btn btn-secondary" style="height:28px; width:28px; padding:0; font-size:12px; color:var(--danger); border-color:rgba(239,68,68,0.3);" onclick="hapusItemEditBatch(${idx})" title="Hapus baris item ini">🗑️</button>
        </td>
      </tr>`;
    });

    tbody.innerHTML = html;
    if (badge) badge.textContent = `${editBatchItems.length} Item`;
    if (summary) summary.innerHTML = `Total: <b>${editBatchItems.length} Item</b> &bull; <b style="color:var(--primary); font-size:12.5px;">${totalQty.toLocaleString('id-ID')} Pcs</b>`;
  }

  function updateEditBatchField(idx, field, value) {
    if (!editBatchItems[idx]) return;
    if (field === 'kode_produksi' || field === 'warna') {
      editBatchItems[idx][field] = String(value || '').trim().toUpperCase();
    } else if (field === 'qty') {
      editBatchItems[idx][field] = parseInt(value, 10) || 1;
      const summary = document.getElementById('editBatchLiveSummary');
      let totalQty = 0;
      editBatchItems.forEach(it => totalQty += (parseInt(it.qty, 10) || 0));
      if (summary) summary.innerHTML = `Total: <b>${editBatchItems.length} Item</b> &bull; <b style="color:var(--primary); font-size:12.5px;">${totalQty.toLocaleString('id-ID')} Pcs</b>`;
    } else {
      editBatchItems[idx][field] = String(value || '').trim();
    }
  }

  function tambahItemEditBatch() {
    // Sinkronisasi data dari DOM input sebelum menambah baris
    syncEditBatchDOMState();
    editBatchItems.push({
      id: '',
      sheet_row: '',
      kode_produksi: '',
      warna: '',
      size: 'Default',
      qty: 1,
      foto_url: '',
      keterangan: ''
    });
    renderEditBatchItemsTable();
  }

  function hapusItemEditBatch(idx) {
    if (editBatchItems.length <= 1) {
      if (window.showToast) window.showToast('Minimal harus ada 1 item dalam penerimaan ini.', 'warning');
      return;
    }
    syncEditBatchDOMState();
    editBatchItems.splice(idx, 1);
    renderEditBatchItemsTable();
  }

  function syncEditBatchDOMState() {
    const tbody = document.getElementById('editBatchTableBody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    rows.forEach((tr, idx) => {
      if (!editBatchItems[idx]) return;
      const inputs = tr.querySelectorAll('input');
      if (inputs.length >= 5) {
        editBatchItems[idx].kode_produksi = inputs[0].value.trim().toUpperCase();
        editBatchItems[idx].warna = inputs[1].value.trim().toUpperCase();
        editBatchItems[idx].size = inputs[2].value.trim() || 'Default';
        editBatchItems[idx].qty = parseInt(inputs[3].value, 10) || 1;
        editBatchItems[idx].keterangan = inputs[4].value.trim();
      }
    });
  }

  function triggerKameraEditItem(idx) {
    currentEditItemPhotoIdx = idx;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      const camIn = document.getElementById('globalCameraFileInput');
      if (camIn) {
        camIn.onchange = function() {
          if (this.files && this.files.length > 0) {
            processEditBatchImageFile(this.files[0], currentEditItemPhotoIdx);
            this.value = '';
          }
        };
        camIn.click();
      }
    } else {
      openWebcamModal();
    }
  }

  function triggerGaleriEditItem(idx) {
    currentEditItemPhotoIdx = idx;
    const fileIn = document.getElementById('globalGalleryFileInput');
    if (fileIn) {
      fileIn.onchange = function() {
        if (this.files && this.files.length > 0) {
          processEditBatchImageFile(this.files[0], currentEditItemPhotoIdx);
          this.value = '';
        }
      };
      fileIn.click();
    }
  }

  function hapusFotoEditItem(idx) {
    if (editBatchItems[idx]) {
      editBatchItems[idx].foto_url = '';
      renderEditBatchItemsTable();
    }
  }

  function processEditBatchImageFile(file, targetIdx) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      if (window.showToast) window.showToast('Berkas harus berupa gambar (JPG/PNG).', 'warning');
      return;
    }
    if (window.showToast) window.showToast('Memproses foto...', 'info');

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 900;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
        if (targetIdx >= 0 && editBatchItems[targetIdx]) {
          editBatchItems[targetIdx].foto_url = compressedDataUrl;
          renderEditBatchItemsTable();
          if (window.showToast) window.showToast(`✓ Foto item #${targetIdx + 1} berhasil dimuat!`, 'success');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function saveEditPenerimaan(btn) {
    syncEditBatchDOMState();

    const origSJ = document.getElementById('editPenerimaanOrigSJ').value;
    const tanggal = document.getElementById('editInTanggal').value;
    const kategori = document.getElementById('editInKategori').value;
    const noSuratJalan = document.getElementById('editInSuratJalan').value.trim().toUpperCase();
    const catatanGlobal = document.getElementById('editInCatatanGlobal').value.trim();

    if (!noSuratJalan) {
      if (window.showToast) window.showToast('Nomor Surat Jalan wajib diisi!', 'warning');
      return;
    }
    if (!tanggal) {
      if (window.showToast) window.showToast('Tanggal Penerimaan wajib diisi!', 'warning');
      return;
    }
    if (editBatchItems.length === 0) {
      if (window.showToast) window.showToast('Minimal harus ada 1 item produk!', 'warning');
      return;
    }

    for (let i = 0; i < editBatchItems.length; i++) {
      const it = editBatchItems[i];
      if (!it.kode_produksi) {
        if (window.showToast) window.showToast(`Baris #${i + 1}: Kode Produksi wajib diisi!`, 'warning');
        return;
      }
      if (!it.qty || it.qty < 1) {
        if (window.showToast) window.showToast(`Baris #${i + 1}: Qty harus minimal 1 pcs!`, 'warning');
        return;
      }
    }

    const payload = {
      orig_no_surat_jalan: origSJ,
      tanggal: tanggal,
      kategori: kategori,
      no_surat_jalan: noSuratJalan,
      keterangan: catatanGlobal,
      items: editBatchItems
    };

    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MENYIMPAN PERUBAHAN...');

    google.script.run
      .withSuccessHandler(function(res) {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        if (res && res.success) {
          if (window.showToast) window.showToast(res.message || 'Data penerimaan berhasil diperbarui! ✨', 'success');
          closeEditPenerimaanModal();
          muatDataPenerimaan(true);
        } else {
          if (window.showToast) window.showToast(res ? res.message : 'Gagal menyimpan perubahan', 'danger');
        }
      })
      .withFailureHandler(function(err) {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        if (window.showToast) window.showToast('Error server: ' + err.message, 'danger');
      })
      .updateBatchPenerimaanProduksi(TOKEN, payload);
  }

  function hapusSeluruhPenerimaanDariEditModal() {
    const origSJ = document.getElementById('editPenerimaanOrigSJ').value;
    if (!origSJ) return;
    closeEditPenerimaanModal();
    konfirmasiHapusPenerimaan({ no_surat_jalan: origSJ, isBatchSJ: true });
  }

  function konfirmasiHapusPenerimaan(rowIndexOrData) {
    let targetRow = null;
    if (typeof rowIndexOrData === 'number') {
      targetRow = PENERIMAAN_DATA[rowIndexOrData];
    } else {
      targetRow = rowIndexOrData;
    }
    if (!targetRow) return;

    const noSJ = String(targetRow.no_surat_jalan || '').trim().toUpperCase();
    const matchingRows = (noSJ && noSJ !== '-') ? PENERIMAAN_DATA.filter(r => String(r.no_surat_jalan || '').trim().toUpperCase() === noSJ) : [targetRow];
    let totalQty = 0;
    matchingRows.forEach(r => totalQty += (parseInt(r.qty, 10) || 0));

    currentHapusPayload = {
      id: targetRow.id,
      sheet_row: targetRow.sheet_row,
      no_surat_jalan: noSJ,
      kode_produksi: targetRow.kode_produksi,
      warna: targetRow.warna,
      size: targetRow.size,
      qty: targetRow.qty,
      isBatchSJ: matchingRows.length > 1 || targetRow.isBatchSJ,
      batchCount: matchingRows.length,
      batchQty: totalQty
    };

    const card = document.getElementById('hapusPenerimaanSummaryCard');
    if (card) {
      if (matchingRows.length > 1 || targetRow.isBatchSJ) {
        card.innerHTML = `
          <div><b>No Surat Jalan:</b> <span class="badge-sku" style="font-size:12px;">${escapeHtml(noSJ || '-')}</span></div>
          <div><b>Total Item dalam Surat Jalan:</b> <b style="color:var(--primary);">${matchingRows.length} Baris Produk</b></div>
          <div><b>Total Kuantitas:</b> <span style="font-weight: 800; color: var(--danger); font-size: 13px;">${totalQty.toLocaleString('id-ID')} pcs</span></div>
          <div style="margin-top:6px; font-size:11px; color:var(--text-muted);">Apakah Anda ingin menghapus seluruh surat jalan ini atau hanya 1 item baris terpilih?</div>
        `;
      } else {
        card.innerHTML = `
          <div><b>No Surat Jalan:</b> ${escapeHtml(targetRow.no_surat_jalan || '-')} (${escapeHtml(targetRow.kategori || '-')})</div>
          <div><b>Kode Produk:</b> <span style="color: var(--primary); font-weight: 800;">${escapeHtml(targetRow.kode_produksi || '-')}</span></div>
          <div><b>Warna / Size:</b> ${escapeHtml(targetRow.warna || '-')} / <b>${escapeHtml(targetRow.size || '-')}</b></div>
          <div><b>Jumlah Qty:</b> <span style="font-weight: 800; color: var(--danger);">${targetRow.qty || 1} pcs</span></div>
          <div><b>Tanggal:</b> ${formatTanggalIndo(targetRow.tanggal_penerimaan)}</div>
        `;
      }
    }

    const modal = document.getElementById('modalHapusPenerimaan');
    if (modal) modal.style.display = 'flex';
  }

  function closeHapusPenerimaanModal() {
    const modal = document.getElementById('modalHapusPenerimaan');
    if (modal) modal.style.display = 'none';
    currentHapusPayload = null;
  }

  function eksekusiHapusPenerimaan(btn) {
    if (!currentHapusPayload) return;

    if (btn && window.setButtonLoading) window.setButtonLoading(btn, true, 'MENGHAPUS...');

    // Jika target adalah seluruh Surat Jalan (Batch)
    if (currentHapusPayload.isBatchSJ && currentHapusPayload.no_surat_jalan) {
      google.script.run
        .withSuccessHandler(function(res) {
          if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
          if (res && res.success) {
            if (window.showToast) window.showToast(res.message || 'Seluruh data surat jalan berhasil dihapus! 🗑️', 'success');
            closeHapusPenerimaanModal();
            muatDataPenerimaan(true);
          } else {
            if (window.showToast) window.showToast(res ? res.message : 'Gagal menghapus data', 'danger');
          }
        })
        .withFailureHandler(function(err) {
          if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
          if (window.showToast) window.showToast('Error server: ' + err.message, 'danger');
        })
        .hapusBatchPenerimaanProduksi(TOKEN, currentHapusPayload.no_surat_jalan);
      return;
    }

    // Hapus single row item
    google.script.run
      .withSuccessHandler(function(res) {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        if (res && res.success) {
          if (window.showToast) window.showToast(res.message || 'Data berhasil dihapus! 🗑️', 'success');
          closeHapusPenerimaanModal();
          muatDataPenerimaan(true);
        } else {
          if (window.showToast) window.showToast(res ? res.message : 'Gagal menghapus data', 'danger');
        }
      })
      .withFailureHandler(function(err) {
        if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
        if (window.showToast) window.showToast('Error server: ' + err.message, 'danger');
      })
      .hapusPenerimaanProduksi(TOKEN, currentHapusPayload);
  }

  // ============ PHOTO LIGHTBOX PREVIEW ============
  function openPhotoLightbox(fotoUrl, kode, noSj, warna, size, qty) {
    const modal = document.getElementById('penerimaanLightboxModal');
    const img = document.getElementById('lightboxImg');
    const title = document.getElementById('lightboxTitle');
    const details = document.getElementById('lightboxDetails');
    const dlBtn = document.getElementById('lightboxDownloadBtn');

    if (!modal || !img) return;

    img.src = fotoUrl;
    if (title) title.textContent = `Foto: ${kode} (${warna || '-'})`;
    if (details) details.innerHTML = `<b>Kode:</b> ${kode} &bull; <b>Warna:</b> ${warna || '-'} &bull; <b>Size:</b> ${size || '-'} &bull; <b>Qty:</b> ${qty || '-'} pcs`;
    if (dlBtn) {
      dlBtn.href = fotoUrl;
      dlBtn.download = `Foto_${kode}_${warna}.jpg`;
    }

    modal.style.display = 'flex';
  }

  function closePhotoLightbox() {
    const modal = document.getElementById('penerimaanLightboxModal');
    if (modal) modal.style.display = 'none';
  }

  // ============ EXPORT CSV ============
  function exportPenerimaanCsv() {
    if (!PENERIMAAN_DATA || PENERIMAAN_DATA.length === 0) {
      if (window.showToast) window.showToast('Tidak ada data untuk diexport', 'warning');
      return;
    }

    const headers = ["Tanggal Penerimaan", "Kategori", "No Surat Jalan", "Kode Produksi", "Warna", "Size", "Qty", "Catatan", "Operator"];
    const rows = [headers];

    PENERIMAAN_DATA.forEach(r => {
      rows.push([
        r.tanggal_penerimaan || '',
        r.kategori || '',
        r.no_surat_jalan || '',
        r.kode_produksi || '',
        r.warna || '',
        r.size || '',
        r.qty || 1,
        r.keterangan || '',
        r.operator || ''
      ]);
    });

    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Kedatangan_Barang_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function formatTanggalIndo(tglStr) {
    if (!tglStr) return '-';
    try {
      const parts = String(tglStr).split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch(e) {}
    return tglStr;
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

  // Expose function global ke window agar selalu dapat dipanggil dari mana pun
  window.switchPenerimaanTab = switchPenerimaanTab;
  window.initPenerimaanView = initPenerimaanView;
  window.muatDataPenerimaan = muatDataPenerimaan;
  window.exportPenerimaanCsv = exportPenerimaanCsv;
  window.tambahBlokProduk = tambahBlokProduk;
  window.hapusBlokProduk = hapusBlokProduk;
  window.tambahVariantRow = tambahVariantRow;
  window.hapusVariantRow = hapusVariantRow;
  window.pilihKategoriCompact = pilihKategoriCompact;
  window.submitBatchPenerimaan = submitBatchPenerimaan;
  window.resetFormPenerimaan = resetFormPenerimaan;
  window.openEditPenerimaanModal = openEditPenerimaanModal;
  window.closeEditPenerimaanModal = closeEditPenerimaanModal;
  window.saveEditPenerimaan = saveEditPenerimaan;
  window.konfirmasiHapusPenerimaan = konfirmasiHapusPenerimaan;
  window.closeHapusPenerimaanModal = closeHapusPenerimaanModal;
  window.eksekusiHapusPenerimaan = eksekusiHapusPenerimaan;
  window.triggerKameraEdit = triggerKameraEdit;
  window.triggerGaleriEdit = triggerGaleriEdit;
  window.hapusFotoEdit = hapusFotoEdit;
  window.handleDirectPhotoPasteEdit = handleDirectPhotoPasteEdit;
  window.handlePhotoDragOverEdit = handlePhotoDragOverEdit;
  window.handlePhotoDragLeaveEdit = handlePhotoDragLeaveEdit;
  window.handlePhotoDropEdit = handlePhotoDropEdit;


// --- Global Window Binding for penerimaanproduksi ---
if (typeof initPenerimaanView === 'function') window.initPenerimaanView = initPenerimaanView;
if (typeof switchPenerimaanTab === 'function') window.switchPenerimaanTab = switchPenerimaanTab;
if (typeof pilihKategoriCompact === 'function') window.pilihKategoriCompact = pilihKategoriCompact;
if (typeof getNextSize === 'function') window.getNextSize = getNextSize;
if (typeof tambahBlokProduk === 'function') window.tambahBlokProduk = tambahBlokProduk;
if (typeof hapusBlokProduk === 'function') window.hapusBlokProduk = hapusBlokProduk;
if (typeof tambahVariantRow === 'function') window.tambahVariantRow = tambahVariantRow;
if (typeof hapusVariantRow === 'function') window.hapusVariantRow = hapusVariantRow;
if (typeof updateBlockField === 'function') window.updateBlockField = updateBlockField;
if (typeof updateVariantField === 'function') window.updateVariantField = updateVariantField;
if (typeof renderProductBlocks === 'function') window.renderProductBlocks = renderProductBlocks;
if (typeof updateFormSummary === 'function') window.updateFormSummary = updateFormSummary;
if (typeof updateBlockPhotoDOM === 'function') window.updateBlockPhotoDOM = updateBlockPhotoDOM;
if (typeof setTargetBlockForPaste === 'function') window.setTargetBlockForPaste = setTargetBlockForPaste;
if (typeof openPhotoPickerOptions === 'function') window.openPhotoPickerOptions = openPhotoPickerOptions;
if (typeof triggerKameraBlock === 'function') window.triggerKameraBlock = triggerKameraBlock;
if (typeof triggerGaleriBlock === 'function') window.triggerGaleriBlock = triggerGaleriBlock;
if (typeof handleGlobalPhotoSelected === 'function') window.handleGlobalPhotoSelected = handleGlobalPhotoSelected;
if (typeof processImageFile === 'function') window.processImageFile = processImageFile;
if (typeof handlePhotoDragOver === 'function') window.handlePhotoDragOver = handlePhotoDragOver;
if (typeof handlePhotoDragLeave === 'function') window.handlePhotoDragLeave = handlePhotoDragLeave;
if (typeof handlePhotoDrop === 'function') window.handlePhotoDrop = handlePhotoDrop;
if (typeof handleDirectPhotoPaste === 'function') window.handleDirectPhotoPaste = handleDirectPhotoPaste;
if (typeof hapusFotoBlock === 'function') window.hapusFotoBlock = hapusFotoBlock;
if (typeof openWebcamModal === 'function') window.openWebcamModal = openWebcamModal;
if (typeof closeWebcamModal === 'function') window.closeWebcamModal = closeWebcamModal;
if (typeof capturePhotoFromWebcam === 'function') window.capturePhotoFromWebcam = capturePhotoFromWebcam;
if (typeof resetFormPenerimaan === 'function') window.resetFormPenerimaan = resetFormPenerimaan;
if (typeof submitBatchPenerimaan === 'function') window.submitBatchPenerimaan = submitBatchPenerimaan;
if (typeof muatDataPenerimaan === 'function') window.muatDataPenerimaan = muatDataPenerimaan;
if (typeof filterDataPenerimaanLokal === 'function') window.filterDataPenerimaanLokal = filterDataPenerimaanLokal;
if (typeof resetFilterPenerimaan === 'function') window.resetFilterPenerimaan = resetFilterPenerimaan;
if (typeof updateKpiPenerimaan === 'function') window.updateKpiPenerimaan = updateKpiPenerimaan;
if (typeof renderPenerimaanTable === 'function') window.renderPenerimaanTable = renderPenerimaanTable;
if (typeof changePenerimaanPage === 'function') window.changePenerimaanPage = changePenerimaanPage;
if (typeof openEditPenerimaanModal === 'function') window.openEditPenerimaanModal = openEditPenerimaanModal;
if (typeof closeEditPenerimaanModal === 'function') window.closeEditPenerimaanModal = closeEditPenerimaanModal;
if (typeof renderEditBatchItemsTable === 'function') window.renderEditBatchItemsTable = renderEditBatchItemsTable;
if (typeof updateEditBatchField === 'function') window.updateEditBatchField = updateEditBatchField;
if (typeof tambahItemEditBatch === 'function') window.tambahItemEditBatch = tambahItemEditBatch;
if (typeof hapusItemEditBatch === 'function') window.hapusItemEditBatch = hapusItemEditBatch;
if (typeof syncEditBatchDOMState === 'function') window.syncEditBatchDOMState = syncEditBatchDOMState;
if (typeof triggerKameraEditItem === 'function') window.triggerKameraEditItem = triggerKameraEditItem;
if (typeof triggerGaleriEditItem === 'function') window.triggerGaleriEditItem = triggerGaleriEditItem;
if (typeof hapusFotoEditItem === 'function') window.hapusFotoEditItem = hapusFotoEditItem;
if (typeof processEditBatchImageFile === 'function') window.processEditBatchImageFile = processEditBatchImageFile;
if (typeof saveEditPenerimaan === 'function') window.saveEditPenerimaan = saveEditPenerimaan;
if (typeof hapusSeluruhPenerimaanDariEditModal === 'function') window.hapusSeluruhPenerimaanDariEditModal = hapusSeluruhPenerimaanDariEditModal;
if (typeof konfirmasiHapusPenerimaan === 'function') window.konfirmasiHapusPenerimaan = konfirmasiHapusPenerimaan;
if (typeof closeHapusPenerimaanModal === 'function') window.closeHapusPenerimaanModal = closeHapusPenerimaanModal;
if (typeof eksekusiHapusPenerimaan === 'function') window.eksekusiHapusPenerimaan = eksekusiHapusPenerimaan;
if (typeof openPhotoLightbox === 'function') window.openPhotoLightbox = openPhotoLightbox;
if (typeof closePhotoLightbox === 'function') window.closePhotoLightbox = closePhotoLightbox;
if (typeof exportPenerimaanCsv === 'function') window.exportPenerimaanCsv = exportPenerimaanCsv;
if (typeof formatTanggalIndo === 'function') window.formatTanggalIndo = formatTanggalIndo;
