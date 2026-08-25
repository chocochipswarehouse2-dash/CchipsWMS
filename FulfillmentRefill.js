/************************************************
 * FULFILLMENT: PERSISTENT PICKING LIST & PROSES REFILL
 * Sifat: Permanen di Sheet 'Refill' & dapat dilihat seluruh user
 * Fitur: 1 Bubble 1 CSV, Alokasi Rak, Ceklis Picker, Edit Picked Qty, 
 * Tab On-Proses vs Selesai, Cetak Langsung / Belakangan.
 ************************************************/

/**
 * Mengambil daftar Picking List dari Sheet 'Refill' untuk ditampilkan ke seluruh user
 * Terbagi menjadi: onProcess (belum selesai) dan completed (sudah done)
 */
function getFulfillmentPickingLists(token) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetRefill = ss.getSheetByName("Refill");
    if (!sheetRefill) {
      return { success: false, message: "Sheet 'Refill' tidak ditemukan." };
    }

    const lastRow = sheetRefill.getLastRow();
    if (lastRow < 2) {
      return { success: true, onProcess: [], completed: [] };
    }

    // Ambil data Kolom A (Date) sampai N (Status Cetak / Selesai)
    const rawData = sheetRefill.getRange(2, 1, lastRow - 1, 14).getValues();

    let groupsMap = {};

    rawData.forEach((row, idx) => {
      const rowNum = idx + 2;
      const dateVal = formatRefillDate(row[0]);
      const noSJ = String(row[1] || "").trim();
      const category = String(row[2] || "").trim();
      const produk = String(row[3] || "").trim();
      const variant = String(row[4] || "").trim();
      const sku = String(row[5] || "").trim();
      const price = row[6] || "";
      const qtyReq = Number(row[7]) || 0;
      const source = String(row[8] || "").trim();
      const tujuan = String(row[9] || "").trim();
      const statusCSV = String(row[10] || "").trim();
      const lokasi = String(row[11] || "").trim();
      const valColM = String(row[12] || "").trim();
      const valColN = String(row[13] || "").trim().toUpperCase();

      if (!noSJ || qtyReq <= 0) return;

      if (!groupsMap[noSJ]) {
        groupsMap[noSJ] = {
          noSJ: noSJ,
          tujuan: tujuan || "Marketplace",
          date: dateVal,
          items: [],
          totalQtyReq: 0,
          totalQtyPicked: 0,
          isCompleted: false,
          isPrinted: false,
          completedAt: "",
          pickerName: "",
          allRowsDone: true
        };
      }

      let namaFinal = produk;
      if (variant && variant !== "-" && variant.toLowerCase() !== "default") {
        const pLower = produk.toLowerCase();
        const vLower = variant.toLowerCase();
        if (vLower === pLower) {
          namaFinal = produk;
        } else if (vLower.includes(pLower)) {
          namaFinal = variant;
        } else {
          namaFinal = produk + " (" + variant + ")";
        }
      }

      // Evaluasi status baris
      const isRowDone = (valColN === "SELESAI" || valColN === "DONE");
      const isRowPrinted = (valColN === "PRINTED" || isRowDone);

      if (!isRowDone) {
        groupsMap[noSJ].allRowsDone = false;
      }
      if (isRowPrinted) {
        groupsMap[noSJ].isPrinted = true;
      }

      // Parse qty yang telah diambil picker dari Col M (jika ada)
      let parsedPickedQty = qtyReq;
      let isChecked = false;
      if (valColM) {
        const numPicked = parseInt(valColM, 10);
        if (!isNaN(numPicked)) {
          parsedPickedQty = numPicked;
          isChecked = true;
        } else if (valColM.includes("CHECKED") || valColM.includes("OK") || isRowDone) {
          isChecked = true;
        }
      }
      if (isRowDone) isChecked = true;

      groupsMap[noSJ].items.push({
        rowNum: rowNum,
        sku: sku,
        nama: namaFinal,
        variant: variant,
        qtyReq: qtyReq,
        qtyPicked: parsedPickedQty,
        lokasi: lokasi || "-",
        isChecked: isChecked
      });

      groupsMap[noSJ].totalQtyReq += qtyReq;
      groupsMap[noSJ].totalQtyPicked += (isChecked ? parsedPickedQty : 0);
    });

    // Jalankan alokasi lokasi rak gudang jika ada item yang belum punya lokasi
    let itemsNeedingAllocation = {};
    for (let sj in groupsMap) {
      const g = groupsMap[sj];
      let needsAlloc = false;
      g.items.forEach(item => {
        if (!item.lokasi || item.lokasi === "-") {
          needsAlloc = true;
        }
      });
      if (needsAlloc) {
        itemsNeedingAllocation[sj] = {
          sj: sj,
          tujuan: g.tujuan,
          items: g.items.map(it => ({ nama: it.nama, sku: it.sku, qty: it.qtyReq, lokasi: it.lokasi })),
          totalQty: g.totalQtyReq
        };
      }
    }

    if (Object.keys(itemsNeedingAllocation).length > 0 && typeof allocateAcrossGroups === "function") {
      allocateAcrossGroups(itemsNeedingAllocation);
      for (let sj in itemsNeedingAllocation) {
        if (groupsMap[sj]) {
          const allocatedItems = itemsNeedingAllocation[sj].items || [];
          groupsMap[sj].items.forEach((it, i) => {
            if (allocatedItems[i] && allocatedItems[i].lokasi) {
              it.lokasi = allocatedItems[i].lokasi;
            }
          });
        }
      }
    }

    let onProcess = [];
    let completed = [];

    for (let sj in groupsMap) {
      const g = groupsMap[sj];
      g.totalItems = g.items.length;
      g.isCompleted = g.allRowsDone;
      g.status = g.isCompleted ? "SELESAI" : (g.isPrinted ? "TERCETAK" : "SIAP PICKING");

      if (g.isCompleted) {
        completed.push(g);
      } else {
        onProcess.push(g);
      }
    }

    // Urutkan On-Process: Surat Jalan terbaru di atas
    onProcess.sort((a, b) => b.noSJ.localeCompare(a.noSJ));
    completed.sort((a, b) => b.noSJ.localeCompare(a.noSJ));

    return {
      success: true,
      onProcess: onProcess,
      completed: completed
    };

  } catch (err) {
    return { success: false, message: "Gagal mengambil data picking list: " + err.message };
  }
}

/**
 * Memproses file-file CSV Transfer Order menjadi Picking List Cards & menyimpannya secara permanen ke Sheet Refill
 */
function processRefillCsvFilesToPickingList(filePayloads, options) {
  try {
    if (!filePayloads || filePayloads.length === 0) {
      return { success: false, message: "Tidak ada file CSV yang di-upload." };
    }

    options = options || {};
    const isDirectPrint = Boolean(options.isDirectPrint);
    const forceProcess = Boolean(options.forceProcess);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetRefill = ss.getSheetByName("Refill");
    if (!sheetRefill) {
      return { success: false, message: "Sheet 'Refill' tidak ditemukan di spreadsheet." };
    }

    const maxRow = sheetRefill.getLastRow();
    let trueLastRow = 1;
    let refillValues = [];
    
    if (maxRow >= 2) {
      const rangeData = sheetRefill.getRange(2, 2, maxRow - 1, 13);
      refillValues = rangeData.getValues();
      
      for (let i = refillValues.length - 1; i >= 0; i--) {
        if (String(refillValues[i][0] || "").trim() !== "") {
          trueLastRow = 2 + i;
          break;
        }
      }
    }

    let existingSJMap = {};
    if (refillValues.length > 0) {
      for (let i = 0; i <= (trueLastRow - 2); i++) {
        if (refillValues[i]) {
          const sj = String(refillValues[i][0] || "").trim();
          const status = String(refillValues[i][12] || "").trim().toUpperCase();
          if (sj) {
            existingSJMap[sj] = status;
          }
        }
      }
    }

    let groups = {};
    let duplicateSJList = [];
    let allRowsToInsert = [];
    let bubbles = [];

    filePayloads.forEach((payload, fileIndex) => {
      let fileName = `File CSV #${fileIndex + 1}`;
      let csvText = "";

      if (typeof payload === "string") {
        csvText = payload;
      } else if (payload && typeof payload === "object") {
        fileName = payload.fileName || fileName;
        csvText = payload.content || "";
      }

      if (!csvText) return;

      const lines = csvText.split(/\r\n|\n/);
      if (lines.length < 2) return;

      let fileSJ = "";
      let fileTujuan = "";
      let fileDate = "";
      let fileItems = [];
      let fileTotalQty = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const row = parseRefillCsvLine(line);
        if (row.length < 10) continue;

        const dateVal = row[0] || "";
        const noSJ = String(row[1] || "").trim();
        const category = row[2] || "";
        const produk = String(row[3] || "").trim();
        const variant = String(row[4] || "").trim();
        const sku = String(row[5] || "").trim();
        const price = row[6] || "";
        const qty = Number(row[7]) || 0;
        const source = row[8] || "";
        const tujuan = String(row[9] || "").trim();
        const statusCSV = String(row[10] || "").trim();

        if (noSJ && qty > 0) {
          if (!fileSJ) fileSJ = noSJ;
          if (!fileTujuan) fileTujuan = tujuan || "Marketplace";
          if (!fileDate) fileDate = dateVal;

          const isAlreadyPrinted = (existingSJMap[noSJ] === "PRINTED" || existingSJMap[noSJ] === "SELESAI");

          if (isAlreadyPrinted && !forceProcess) {
            if (duplicateSJList.indexOf(noSJ) === -1) {
              duplicateSJList.push(noSJ);
            }
          }

          if (!groups[noSJ]) {
            groups[noSJ] = { sj: noSJ, tujuan: tujuan || "Marketplace", items: [], totalQty: 0 };
          }

          let namaFinal = produk;
          if (variant && variant !== "-" && variant.toLowerCase() !== "default") {
            const pLower = produk.toLowerCase();
            const vLower = variant.toLowerCase();
            if (vLower === pLower) {
              namaFinal = produk;
            } else if (vLower.includes(pLower)) {
              namaFinal = variant;
            } else {
              namaFinal = produk + " (" + variant + ")";
            }
          }

          const itemObj = {
            nama: namaFinal,
            sku: sku,
            qty: qty,
            lokasi: "-"
          };

          groups[noSJ].items.push(itemObj);
          groups[noSJ].totalQty += qty;

          fileItems.push(itemObj);
          fileTotalQty += qty;

          if (!isAlreadyPrinted) {
            allRowsToInsert.push([
              dateVal,                        // 1. A: Date
              noSJ,                           // 2. B: Number Delivery
              category,                       // 3. C: Category
              produk,                         // 4. D: Product
              variant,                        // 5. E: Variant
              sku,                            // 6. F: Code
              price,                          // 7. G: Price
              qty,                            // 8. H: Qty
              source,                         // 9. I: Source
              tujuan,                         // 10. J: Destination
              statusCSV,                      // 11. K: Status
              "",                             // 12. L: Location (Akan diisi setelah alokasi)
              "",                             // 13. M: Picked Qty
              isDirectPrint ? "PRINTED" : "PENDING" // 14. N: Status
            ]);
          }
        }
      }

      if (fileSJ && fileItems.length > 0) {
        bubbles.push({
          id: 'buble_' + Date.now() + '_' + fileIndex,
          fileName: fileName,
          noSJ: fileSJ,
          tujuan: fileTujuan || "Marketplace",
          date: fileDate,
          totalQtyReq: fileTotalQty,
          totalQtyPicked: 0,
          totalItems: fileItems.length,
          status: isDirectPrint ? "TERCETAK" : "SIAP PICKING",
          isPrinted: isDirectPrint,
          isCompleted: false,
          items: []
        });
      }
    });

    if (duplicateSJList.length > 0 && !forceProcess) {
      return {
        success: false,
        isDuplicate: true,
        duplicateList: duplicateSJList,
        message: "Nomor Surat Jalan berikut sudah pernah diinput ke database:\n• " + duplicateSJList.join("\n• ") + "\n\nApakah Anda ingin tetap memprosesnya ulang?"
      };
    }

    if (Object.keys(groups).length === 0) {
      return { success: false, message: "Format CSV tidak valid atau tidak ada baris barang dengan Qty > 0." };
    }

    // Alokasi lokasi rak gudang otomatis
    if (typeof allocateAcrossGroups === "function") {
      allocateAcrossGroups(groups);
    }

    // Sinkronkan lokasi rak ke allRowsToInsert sebelum disimpan ke Google Sheets
    if (allRowsToInsert.length > 0) {
      allRowsToInsert.forEach(row => {
        const sj = row[1];
        const sku = row[5];
        if (groups[sj] && groups[sj].items) {
          const match = groups[sj].items.find(it => it.sku === sku);
          if (match && match.lokasi) {
            row[11] = match.lokasi; // Set Kolom L (Location)
          }
        }
      });

      const nextRow = trueLastRow + 1;
      sheetRefill.getRange(nextRow, 1, allRowsToInsert.length, 14).setValues(allRowsToInsert);
    }

    let pdfBase64 = null;
    if (isDirectPrint) {
      const html = buildPrintHtml(groups);
      let blob = Utilities.newBlob(html, "text/html", "picking.html").getAs("application/pdf");
      pdfBase64 = "data:application/pdf;base64, " + Utilities.base64Encode(blob.getBytes());
    }

    return {
      success: true,
      message: `Berhasil memproses & menyimpan ${bubbles.length} Transfer Order ke database WMS! 📦`,
      pdfData: pdfBase64
    };

  } catch (err) {
    return { success: false, message: "Gagal memproses file: " + err.message };
  }
}

/**
 * Menyelesaikan proses picking untuk satu Surat Jalan (Tombol DONE)
 * Menyimpan qty aktual yang diambil picker dan memindahkan status ke SELESAI
 */
function selesaiPickingFulfillment(token, payload) {
  try {
    if (!payload || !payload.noSJ) {
      return { success: false, message: "Nomor Surat Jalan wajib disertakan." };
    }

    const noSJ = String(payload.noSJ).trim();
    const items = payload.items || [];
    const pickerName = String(payload.pickerName || "Picker").trim();

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetRefill = ss.getSheetByName("Refill");
    if (!sheetRefill) {
      return { success: false, message: "Sheet 'Refill' tidak ditemukan." };
    }

    const lastRow = sheetRefill.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: "Tidak ada data pada sheet Refill." };
    }

    // Ambil kolom B (SJ), F (SKU), H (QtyReq), M (PickedQty), N (Status)
    const sjRange = sheetRefill.getRange(2, 2, lastRow - 1, 13).getValues();

    // Map item update berdasarkan SKU atau rowNum
    const itemMapBySku = {};
    items.forEach(it => {
      if (it.sku) {
        itemMapBySku[String(it.sku).trim().toUpperCase()] = it.qtyPicked !== undefined ? it.qtyPicked : it.qtyReq;
      }
    });

    for (let i = 0; i < sjRange.length; i++) {
      const curSJ = String(sjRange[i][0] || "").trim();
      if (curSJ === noSJ) {
        const curRow = 2 + i;
        const curSku = String(sjRange[i][4] || "").trim().toUpperCase();
        const reqQty = Number(sjRange[i][6]) || 0;

        let finalPickedQty = reqQty;
        if (itemMapBySku[curSku] !== undefined) {
          finalPickedQty = itemMapBySku[curSku];
        }

        // Update Col M: Picked Qty
        sheetRefill.getRange(curRow, 13).setValue(finalPickedQty);
        // Update Col N: Status SELESAI
        sheetRefill.getRange(curRow, 14).setValue("SELESAI");
      }
    }

    return {
      success: true,
      message: `✓ Picking untuk No Surat Jalan ${noSJ} berhasil diselesaikan oleh ${pickerName}! 🚀`,
      noSJ: noSJ
    };

  } catch (err) {
    return { success: false, message: "Gagal menyelesaikan picking: " + err.message };
  }
}

/**
 * Mengembalikan Surat Jalan yang sudah selesai ke tab Picking Proses
 */
function kembalikanPickingKeProses(token, noSJ) {
  try {
    if (!noSJ) return { success: false, message: "Nomor Surat Jalan wajib diisi." };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetRefill = ss.getSheetByName("Refill");
    if (!sheetRefill) return { success: false, message: "Sheet 'Refill' tidak ditemukan." };

    const lastRow = sheetRefill.getLastRow();
    if (lastRow < 2) return { success: false, message: "Sheet Refill kosong." };

    const sjRange = sheetRefill.getRange(2, 2, lastRow - 1, 1).getValues();
    for (let i = 0; i < sjRange.length; i++) {
      const curSJ = String(sjRange[i][0] || "").trim();
      if (curSJ === String(noSJ).trim()) {
        sheetRefill.getRange(2 + i, 14).setValue("PRINTED");
      }
    }

    return {
      success: true,
      message: `Surat Jalan ${noSJ} berhasil dikembalikan ke tab Picking Proses.`,
      noSJ: noSJ
    };
  } catch (err) {
    return { success: false, message: "Gagal mengembalikan status: " + err.message };
  }
}

/**
 * Mencetak PDF Surat Jalan untuk 1 Bubble / 1 SJ tertentu (Cetak Belakangan)
 */
function cetakSingleSuratJalanRefill(bubbleData) {
  try {
    if (!bubbleData || !bubbleData.noSJ || !bubbleData.items) {
      return { success: false, message: "Data Surat Jalan tidak valid." };
    }

    const groups = {};
    groups[bubbleData.noSJ] = {
      sj: bubbleData.noSJ,
      tujuan: bubbleData.tujuan || "Marketplace",
      items: bubbleData.items.map(it => ({
        nama: it.nama,
        sku: it.sku,
        qty: it.qtyReq || it.qty || 0,
        lokasi: it.lokasi || "-"
      })),
      totalQty: bubbleData.totalQtyReq || bubbleData.totalQty || bubbleData.items.reduce((a, b) => a + (Number(b.qtyReq || b.qty) || 0), 0)
    };

    // Tandai status di sheet Refill sebagai PRINTED jika belum selesai
    tandaiStatusSjPrinted([bubbleData.noSJ]);

    const html = buildPrintHtml(groups);
    let blob = Utilities.newBlob(html, "text/html", "Surat_Jalan_" + bubbleData.noSJ + ".html").getAs("application/pdf");
    const pdfBase64 = "data:application/pdf;base64, " + Utilities.base64Encode(blob.getBytes());

    return {
      success: true,
      pdfData: pdfBase64,
      noSJ: bubbleData.noSJ
    };
  } catch (err) {
    return { success: false, message: "Gagal membuat PDF Surat Jalan: " + err.message };
  }
}

/**
 * Mencetak Semua Surat Jalan dari daftar bubble yang dipilih
 */
function cetakMultipleSuratJalanRefill(bubblesList) {
  try {
    if (!bubblesList || bubblesList.length === 0) {
      return { success: false, message: "Tidak ada Surat Jalan yang dipilih." };
    }

    const groups = {};
    const sjList = [];

    bubblesList.forEach(b => {
      if (b.noSJ && b.items && b.items.length > 0) {
        groups[b.noSJ] = {
          sj: b.noSJ,
          tujuan: b.tujuan || "Marketplace",
          items: b.items.map(it => ({
            nama: it.nama,
            sku: it.sku,
            qty: it.qtyReq || it.qty || 0,
            lokasi: it.lokasi || "-"
          })),
          totalQty: b.totalQtyReq || b.totalQty || b.items.reduce((sum, item) => sum + (Number(item.qtyReq || item.qty) || 0), 0)
        };
        sjList.push(b.noSJ);
      }
    });

    if (Object.keys(groups).length === 0) {
      return { success: false, message: "Daftar Surat Jalan kosong." };
    }

    tandaiStatusSjPrinted(sjList);

    const html = buildPrintHtml(groups);
    let blob = Utilities.newBlob(html, "text/html", "Semua_Surat_Jalan_Refill.html").getAs("application/pdf");
    const pdfBase64 = "data:application/pdf;base64, " + Utilities.base64Encode(blob.getBytes());

    return {
      success: true,
      pdfData: pdfBase64
    };
  } catch (err) {
    return { success: false, message: "Gagal membuat PDF Surat Jalan gabungan: " + err.message };
  }
}

/**
 * Helper: Tandai baris di sheet Refill dengan status PRINTED jika belum SELESAI
 */
function tandaiStatusSjPrinted(sjList) {
  try {
    if (!sjList || sjList.length === 0) return;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetRefill = ss.getSheetByName("Refill");
    if (!sheetRefill) return;

    const lastRow = sheetRefill.getLastRow();
    if (lastRow < 2) return;

    const statusRange = sheetRefill.getRange(2, 2, lastRow - 1, 13).getValues();
    for (let i = 0; i < statusRange.length; i++) {
      const sj = String(statusRange[i][0] || "").trim();
      const status = String(statusRange[i][12] || "").trim().toUpperCase();
      if (sj && sjList.indexOf(sj) !== -1 && status !== "SELESAI" && status !== "DONE") {
        sheetRefill.getRange(2 + i, 14).setValue("PRINTED");
      }
    }
  } catch (e) {
    console.error("Error tandaiStatusSjPrinted:", e);
  }
}

function formatRefillDate(val) {
  if (!val) return "-";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || "GMT+7", "dd/MM/yyyy");
  }
  return String(val);
}

/**
 * Wrapper backwards-compatible untuk fungsi lama
 */
function processRefillCsvFilesToPdf(csvTextList, forceProcess) {
  return processRefillCsvFilesToPickingList(csvTextList, { isDirectPrint: true, forceProcess: forceProcess });
}

/************************************************
 * FUNGSI BANTUAN: PARSE CSV
 ************************************************/
function parseRefillCsvLine(text) {
  let result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}