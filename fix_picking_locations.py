import urllib.request
import json

SUPABASE_URL = "https://filgijcfhgqlirzhvwho.supabase.co"
SUPABASE_KEY = "sb_publishable_L4FEkugwRKqcwFzLXfpZag_aByUy5mD"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# 1. Ambil seluruh stok realtime dari view_stok_realtime dengan looping offset (PostgREST max_rows = 1000)
stocks = []
offset = 0
chunk_size = 1000

while True:
    req_stock = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/view_stok_realtime?select=sku,lokasi,sisa_stok&sisa_stok=gt.0&area=ilike.Warehouse&offset={offset}&limit={chunk_size}",
        headers=headers
    )
    with urllib.request.urlopen(req_stock) as res:
        chunk = json.loads(res.read().decode("utf-8"))
        if not chunk:
            break
        stocks.extend(chunk)
        if len(chunk) < chunk_size:
            break
        offset += chunk_size

print(f"Total baris stok Warehouse terambil: {len(stocks)}")
stock_map = {}
for s in stocks:
    sku = str(s.get("sku", "")).strip().upper()
    lok = str(s.get("lokasi", "")).strip()
    qty = int(s.get("sisa_stok", 0) or 0)
    if not sku or not lok or qty <= 0:
        continue
    if sku not in stock_map:
        stock_map[sku] = []
    stock_map[sku].append({"lokasi": lok, "qty": qty})

# 2. Ambil semua picking_list yang lokasinya '-' atau kosong
req_picking = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/picking_list?lokasi=eq.-&select=id,no_sj,sku,nama_produk,qty_req,lokasi&limit=10000",
    headers=headers
)
with urllib.request.urlopen(req_picking) as res:
    pickings = json.loads(res.read().decode("utf-8"))

print(f"Total baris picking_list dengan lokasi '-' : {len(pickings)}")

updated_count = 0
for p in pickings:
    pid = p["id"]
    sku = str(p.get("sku", "")).strip().upper()
    
    if sku in stock_map and len(stock_map[sku]) > 0:
        # Kumpulkan lokasi
        lokasi_list = [item["lokasi"] for item in stock_map[sku] if item["lokasi"]]
        gabungan_lokasi = " | ".join(dict.fromkeys(lokasi_list))
        
        # Patch ke Supabase
        patch_url = f"{SUPABASE_URL}/rest/v1/picking_list?id=eq.{pid}"
        payload = json.dumps({"lokasi": gabungan_lokasi}).encode("utf-8")
        req_patch = urllib.request.Request(patch_url, data=payload, headers=headers, method="PATCH")
        try:
            with urllib.request.urlopen(req_patch) as patch_res:
                updated_count += 1
                print(f"Updated ID {pid} ({sku}): {gabungan_lokasi}")
        except Exception as e:
            print(f"Failed to update ID {pid}: {e}")

print(f"Selesai mengupdate {updated_count} baris picking_list!")
