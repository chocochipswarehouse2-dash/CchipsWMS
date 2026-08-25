/************************************************
 * PARSE PRODUKSI
 *
 * Output:
 * [
 *   {
 *     kode: "...",
 *     warna: "...",
 *     size: "...",
 *     qty: 0
 *   }
 * ]
 ************************************************/
function parseProduksi(lines) {

  const hasil = [];

  let kode = "";

  for (let i = 2; i < lines.length; i++) {

    let line = normalisasiProduksi(lines[i]);

    if (line === "") continue;

    /**********************************************
     * HEADER KODE
     **********************************************/
    if (isKodeProduksi(line)) {

      kode = getKodeProduksi(line);

      continue;

    }

    if (kode === "") continue;

    hasil.push.apply(
      hasil,
      parseProduksiItem(kode, line)
    );

  }

  return hasil;

}

/************************************************
 * PARSE 1 BARIS PRODUK
 ************************************************/
function parseProduksiItem(kode, line) {

  const hasil = [];

  line = line
    .replace(/:/g, " ")
    .replace(/=/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const token = line.split(" ");

  let firstSize = -1;

  for (let i = 0; i < token.length; i++) {

    if (isProduksiSize(token[i])) {

      firstSize = i;

      break;

    }

  }

  /**********************************************
   * TANPA SIZE
   **********************************************/
  if (firstSize < 0) {

    if (token.length < 2) {
      return hasil;
    }

    const qty = token[token.length - 1];

    if (!isQtyProduksi(qty)) {
      return hasil;
    }

    hasil.push({

      kode : kode,

      warna : token
        .slice(0, token.length - 1)
        .join(" "),

      size : "Default",

      qty : Number(qty)

    });

    return hasil;

  }

  /**********************************************
   * DENGAN SIZE
   **********************************************/
  const warna = token
    .slice(0, firstSize)
    .join(" ");

  for (let i = firstSize; i < token.length - 1; i++) {

    if (!isProduksiSize(token[i])) {
      continue;
    }

    if (!isQtyProduksi(token[i + 1])) {
      continue;
    }

    hasil.push({

      kode : kode,

      warna : warna,

      size : normalisasiProduksiSize(token[i]),

      qty : Number(token[i + 1])

    });

    i++;

  }

  return hasil;

}