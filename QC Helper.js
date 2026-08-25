/************************************************
 * VALIDASI HEADER QC
 ************************************************/
function isQCHeader(lines) {

  if (lines.length < 2) return false;

  const h1 = (lines[0] || "").trim().toUpperCase();
  const h2 = (lines[1] || "").trim().toUpperCase();

  return (
    h1 === "#LAPORQC" &&
    h2.startsWith("#DARI")
  );

}

/************************************************
 * AMBIL SUMBER LAPORAN
 ************************************************/
function getQCSumber(lines) {

  return lines[1]
    .replace(/^#DARI/i, "")
    .trim();

}

/************************************************
 * PARSE 1 BARIS ITEM QC
 ************************************************/
function parseQCItem(text) {

  let item = text.trim();

  if (item === "") return null;

  let kondisi = "";
  let status = "PASS";

  /**********************************************
   * KONDISI SETELAH "/"
   **********************************************/
  if (item.indexOf("/") > -1) {

    let arr = item.split("/");

    item = arr[0].trim();

    kondisi = arr.slice(1).join("/").trim();

    if (kondisi !== "") {
      status = "Reject";
    }

  }

  /**********************************************
   * QTY
   **********************************************/
  let qty = 1;

  let qtyMatch = item.match(/\s+(\d+)$/);

  if (qtyMatch) {

    qty = Number(qtyMatch[1]);

    item = item.replace(/\s+\d+$/, "").trim();

  }

  /**********************************************
   * SIZE
   **********************************************/
  let size = "Default";

  const sizeList = [
    "XXL",
    "XL",
    "L",
    "M",
    "S",
    "FREESIZE",
    "FREE SIZE",
    "ALLSIZE",
    "ALL SIZE",
    "DEFAULT"
  ];

  for (let i = 0; i < sizeList.length; i++) {

    const s = sizeList[i];

    const reg = new RegExp("\\s+" + s + "$","i");

    if (reg.test(item)) {

      if (
        s == "FREESIZE" ||
        s == "FREE SIZE" ||
        s == "ALLSIZE" ||
        s == "ALL SIZE" ||
        s == "DEFAULT"
      ) {

        size = "Default";

      } else {

        size = s;

      }

      item = item.replace(reg,"").trim();

      break;

    }

  }

  return {

    nama : item,
    size : size,
    qty : qty,
    status : status,
    kondisi : kondisi

  };

}