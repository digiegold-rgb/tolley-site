#!/usr/bin/env bash
# crypto-drive-scan.sh v2 — Scan a mounted drive for crypto wallets, keys, seeds
# Usage: bash scripts/crypto-drive-scan.sh --mount /mnt/crypto-scan --label "Drive Name"
# Output: JSON results + copies to ~/Desktop/crypto-extractions/<scan-id>/
#
# v2 fixes from first real scan (232GB SanDisk NTFS):
#   - No more SIGPIPE (removed pipefail, use process substitution)
#   - Windows Sticky Notes SQLite scanning
#   - .bat/.cmd/.ps1/.vbs script content scanning
#   - Telegram Desktop folder scanning
#   - Standalone hex private keys (not just labeled ones)
#   - Full BIP39 wordlist seed detection via Python
#   - JSON keystore address extraction
#   - On-chain balance checking (ETH via public RPC)
#   - Dedup by category+filePath (not just filePath)
#   - Robust find piping (no subshell variable loss)

set -eu  # no pipefail — prevents SIGPIPE exit 141

MOUNT=""
LABEL=""
SCAN_ID="scan-$(date +%Y%m%d-%H%M%S)"
OUTPUT_DIR="$HOME/Desktop/crypto-extractions/$SCAN_ID"
RESULTS_FILE="$OUTPUT_DIR/results.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPERS="$SCRIPT_DIR/crypto-drive-helpers.py"
START_TIME=$(date +%s)

usage() {
  echo "Usage: $0 --mount <path> --label <name> [--id <scan-id>]"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --mount) MOUNT="$2"; shift 2 ;;
    --label) LABEL="$2"; shift 2 ;;
    --id) SCAN_ID="$2"; OUTPUT_DIR="$HOME/Desktop/crypto-extractions/$SCAN_ID"; RESULTS_FILE="$OUTPUT_DIR/results.json"; shift 2 ;;
    *) usage ;;
  esac
done

[[ -z "$MOUNT" || -z "$LABEL" ]] && usage
[[ ! -d "$MOUNT" ]] && echo "Error: $MOUNT is not a directory" && exit 1

mkdir -p "$OUTPUT_DIR/copies"
LOG_FILE="$OUTPUT_DIR/scan.log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG_FILE"; }

log "=== Crypto Drive Scan v2 ==="
log "Label: $LABEL"
log "Mount: $MOUNT"
log "Scan ID: $SCAN_ID"
log "Output: $OUTPUT_DIR"

# Get drive info
DEVICE=$(df "$MOUNT" 2>/dev/null | tail -1 | awk '{print $1}') || DEVICE="unknown"
FS_TYPE=$(df -T "$MOUNT" 2>/dev/null | tail -1 | awk '{print $2}') || FS_TYPE="unknown"
TOTAL_SIZE=$(df -BG "$MOUNT" 2>/dev/null | tail -1 | awk '{print $2}' | tr -d 'G') || TOTAL_SIZE=""
SERIAL=$(udevadm info --query=property --name="$DEVICE" 2>/dev/null | grep ID_SERIAL_SHORT | cut -d= -f2 || echo "")

log "Device: $DEVICE | FS: $FS_TYPE | Size: ${TOTAL_SIZE:-?}G | Serial: ${SERIAL:-unknown}"

# Temp file for collecting items as JSONL
ITEMS_FILE=$(mktemp /tmp/crypto-items.XXXXXX)
trap "rm -f '$ITEMS_FILE'" EXIT

# ── add_item: append JSONL to items file ──────────────────────
# Args: category subcategory filepath sensitivity [preview] [extractedData_json]
add_item() {
  local category="$1" subcategory="$2" filepath="$3" sensitivity="$4"
  local preview="${5:-}" extracted="${6:-}"
  local filesize=0 mtime=""

  if [ -f "$filepath" ]; then
    filesize=$(stat -c%s "$filepath" 2>/dev/null || echo 0)
    mtime=$(stat -c%Y "$filepath" 2>/dev/null || echo "")
    [[ -n "$mtime" ]] && mtime=$(date -d @"$mtime" --iso-8601=seconds 2>/dev/null || echo "")
    # Copy file (skip huge files > 100MB)
    if [[ "$filesize" -lt 104857600 ]]; then
      local relpath="${filepath#$MOUNT}"
      local destdir="$OUTPUT_DIR/copies/$(dirname "$relpath")"
      mkdir -p "$destdir" 2>/dev/null || true
      cp -a "$filepath" "$destdir/" 2>/dev/null || true
    fi
  fi

  local localcopy="$OUTPUT_DIR/copies/${filepath#$MOUNT}"

  # Redact preview for critical items
  if [[ "$sensitivity" == "critical" && -n "$preview" && ${#preview} -gt 16 ]]; then
    preview="${preview:0:4}...${preview: -4}"
  fi

  python3 -c "
import json, sys
item = {
    'category': sys.argv[1],
    'subcategory': sys.argv[2] if sys.argv[2] != '' else None,
    'filePath': sys.argv[3],
    'fileSize': int(sys.argv[4]),
    'fileMtime': sys.argv[5] if sys.argv[5] != '' else None,
    'contentPreview': sys.argv[6] if sys.argv[6] != '' else None,
    'sensitivity': sys.argv[7],
    'localCopyPath': sys.argv[8],
}
if sys.argv[9]:
    try:
        item['extractedData'] = json.loads(sys.argv[9])
    except: pass
print(json.dumps(item))
" "$category" "$subcategory" "${filepath#$MOUNT}" "$filesize" "$mtime" "$preview" "$sensitivity" "$localcopy" "$extracted" >> "$ITEMS_FILE"

  log "  Found: [$sensitivity] $category/$subcategory — ${filepath#$MOUNT}"
}

# ── Helper: extract address from JSON keystore ────────────────
extract_keystore_addr() {
  local f="$1"
  python3 -c "
import json, sys
try:
    with open(sys.argv[1]) as fh:
        d = json.load(fh)
    addr = d.get('address','')
    if addr and len(addr) >= 40:
        if not addr.startswith('0x'): addr = '0x' + addr
        print(addr)
except: pass
" "$f" 2>/dev/null
}

# ── Helper: check ETH balance via public RPC ──────────────────
check_eth_balance() {
  local addr="$1"
  local result
  result=$(curl -s --max-time 5 -X POST https://eth.llamarpc.com \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"$addr\",\"latest\"],\"id\":1}" 2>/dev/null) || return
  python3 -c "
import json, sys
try:
    r = json.loads(sys.argv[1])
    bal = int(r.get('result','0x0'), 16) / 1e18
    print(f'{bal:.6f}')
except: print('0')
" "$result" 2>/dev/null
}

# ── Helper: check WTC ERC-20 balance ──────────────────────────
check_wtc_balance() {
  local addr="$1"
  local bare="${addr#0x}"
  local padded
  padded=$(printf '%064s' "$bare" | tr ' ' '0')
  local result
  result=$(curl -s --max-time 5 -X POST https://eth.llamarpc.com \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"0xb7cB1C96dB6B22b0D3d9536E0108d062BD488F74\",\"data\":\"0x70a08231${padded}\"},\"latest\"],\"id\":1}" 2>/dev/null) || return
  python3 -c "
import json, sys
try:
    r = json.loads(sys.argv[1])
    bal = int(r.get('result','0x0'), 16) / 1e18
    if bal > 0: print(f'{bal:.2f}')
    else: print('0')
except: print('0')
" "$result" 2>/dev/null
}

# ============================================================
# Phase 1: Known wallet paths
# ============================================================
log "--- Phase 1: Known wallet paths ---"

declare -A WALLET_PATHS=(
  # Linux
  [".bitcoin/wallet.dat"]="wallet_file:bitcoin:sensitive"
  [".litecoin/wallet.dat"]="wallet_file:litecoin:sensitive"
  [".dogecoin/wallet.dat"]="wallet_file:dogecoin:sensitive"
  [".bitmonero/"]="crypto_dir:monero:sensitive"
  [".electrum/wallets/"]="crypto_dir:electrum:sensitive"
  [".ethereum/keystore/"]="crypto_dir:ethereum:critical"
  # Windows (Users/*/AppData/Roaming)
  ["AppData/Roaming/Bitcoin/wallet.dat"]="wallet_file:bitcoin:sensitive"
  ["AppData/Roaming/Litecoin/wallet.dat"]="wallet_file:litecoin:sensitive"
  ["AppData/Roaming/Dogecoin/wallet.dat"]="wallet_file:dogecoin:sensitive"
  ["AppData/Roaming/Electrum/wallets/"]="crypto_dir:electrum:sensitive"
  ["AppData/Roaming/Ethereum/keystore/"]="crypto_dir:ethereum:critical"
  # More Windows wallet software
  ["AppData/Roaming/Exodus/exodus.wallet/"]="crypto_dir:exodus:critical"
  ["AppData/Roaming/atomic/Local Storage/"]="crypto_dir:atomic:critical"
  ["AppData/Roaming/Guarda/"]="crypto_dir:guarda:sensitive"
  ["AppData/Local/Coinomi/Coinomi/wallets/"]="crypto_dir:coinomi:critical"
  ["AppData/Roaming/WaltonChain/Wallet/keystore/"]="crypto_dir:waltonchain:critical"
)

for pattern in "${!WALLET_PATHS[@]}"; do
  IFS=: read -r cat sub sens <<< "${WALLET_PATHS[$pattern]}"
  while IFS= read -r -d '' found; do
    if [ -d "$found" ]; then
      while IFS= read -r -d '' f; do
        [ -f "$f" ] && add_item "$cat" "$sub" "$f" "$sens"
      done < <(find "$found" -maxdepth 2 -type f -print0 2>/dev/null)
    elif [ -f "$found" ]; then
      add_item "$cat" "$sub" "$found" "$sens"
    fi
  done < <(find "$MOUNT" -path "*/$pattern" -print0 2>/dev/null)
done

# Ethereum keystore UTC files anywhere
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  local_addr=$(extract_keystore_addr "$f")
  local_extracted=""
  if [[ -n "$local_addr" ]]; then
    local_bal=$(check_eth_balance "$local_addr" || echo "0")
    local_wtc=$(check_wtc_balance "$local_addr" || echo "0")
    local_extracted=$(python3 -c "
import json
print(json.dumps({
    'address': '$local_addr',
    'balanceETH': float('${local_bal:-0}'),
    'balanceWTC': float('${local_wtc:-0}'),
    'explorerUrl': 'https://etherscan.io/address/$local_addr',
    'keystoreVersion': 3,
}))
" 2>/dev/null || echo "")
  fi
  add_item "keystore" "ethereum" "$f" "critical" "address: ${local_addr:-unknown}" "$local_extracted"
done < <(find "$MOUNT" -name "UTC--*" -type f -print0 2>/dev/null)

# JSON keystore files (*.json with "address" + "crypto" keys)
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  # Quick check: must contain "address" and "crypto" or "Crypto"
  if head -c 2000 "$f" 2>/dev/null | grep -q '"address"' && head -c 2000 "$f" 2>/dev/null | grep -qi '"crypto"'; then
    local_addr=$(extract_keystore_addr "$f")
    if [[ -n "$local_addr" ]]; then
      local_bal=$(check_eth_balance "$local_addr" || echo "0")
      local_wtc=$(check_wtc_balance "$local_addr" || echo "0")
      local_extracted=$(python3 -c "
import json
print(json.dumps({
    'address': '$local_addr',
    'balanceETH': float('${local_bal:-0}'),
    'balanceWTC': float('${local_wtc:-0}'),
    'explorerUrl': 'https://etherscan.io/address/$local_addr',
}))
" 2>/dev/null || echo "")
      add_item "keystore" "ethereum" "$f" "critical" "address: $local_addr" "$local_extracted"
    fi
  fi
done < <(find "$MOUNT" -name "*.json" -type f -size -1M -not -path "*/node_modules/*" -not -path "*/Windows/*" -not -path "*/.git/*" -print0 2>/dev/null)

# ============================================================
# Phase 2: Pattern file search
# ============================================================
log "--- Phase 2: Pattern file search ---"

# wallet.dat anywhere
while IFS= read -r -d '' f; do
  [ -f "$f" ] && add_item "wallet_file" "" "$f" "sensitive" "$(file "$f" 2>/dev/null | cut -d: -f2- | head -c 80)"
done < <(find "$MOUNT" -name "wallet.dat" -type f -print0 2>/dev/null)

# *.wallet, *.key, *.keys files
while IFS= read -r -d '' f; do
  [ -f "$f" ] && add_item "wallet_file" "" "$f" "sensitive"
done < <(find "$MOUNT" \( -name "*.wallet" -o -name "*.key" -o -name "*.keys" -o -name "*.keystore" -o -name "*.seed" \) -type f -print0 2>/dev/null)

# Crypto-named directories
while IFS= read -r -d '' d; do
  add_item "crypto_dir" "$(basename "$d" | tr '[:upper:]' '[:lower:]' | sed 's/^\.//')" "$d" "sensitive"
done < <(find "$MOUNT" -maxdepth 5 -type d \( -iname ".bitcoin" -o -iname ".ethereum" -o -iname ".monero" -o -iname ".zcash" -o -iname "Armory" -o -iname "MultiBit" -o -iname "Exodus" -o -iname "Atomic Wallet" -o -iname "Electrum" \) -print0 2>/dev/null)

# ============================================================
# Phase 3: Content scanning (text files < 10MB)
# ============================================================
log "--- Phase 3: Content scanning ---"

# Scan text files + scripts (.bat, .cmd, .ps1, .vbs, .sh)
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue

  # Read first 500KB for pattern matching
  content=$(head -c 512000 "$f" 2>/dev/null) || continue
  [[ -z "$content" ]] && continue

  # WIF private keys (Bitcoin — starts with 5H/5J/5K, 51 chars base58)
  if echo "$content" | grep -qP '5[HJK][1-9A-HJ-NP-Za-km-z]{49}' 2>/dev/null; then
    match=$(echo "$content" | grep -oP '5[HJK][1-9A-HJ-NP-Za-km-z]{49}' 2>/dev/null | head -1)
    add_item "private_key" "bitcoin-wif" "$f" "critical" "$match"
  fi

  # Hex private keys — standalone 64-char hex (own line or near key/priv/secret labels)
  if echo "$content" | grep -qP '(?:^|[\s:=])([0-9a-fA-F]{64})(?:$|[\s,;])' 2>/dev/null; then
    match=$(echo "$content" | grep -oP '(?:^|[\s:=])([0-9a-fA-F]{64})(?:$|[\s,;])' 2>/dev/null | grep -oP '[0-9a-fA-F]{64}' | head -1)
    if [[ -n "$match" ]]; then
      add_item "private_key" "hex" "$f" "critical" "$match"
    fi
  fi

  # ETH addresses
  if echo "$content" | grep -qP '0x[0-9a-fA-F]{40}' 2>/dev/null; then
    match=$(echo "$content" | grep -oP '0x[0-9a-fA-F]{40}' 2>/dev/null | head -1)
    # Skip Windows system DLLs and common false positives
    case "${f##*/}" in *.dll|*.exe|*.sys) continue ;; esac
    local_bal=$(check_eth_balance "$match" || echo "0")
    local_extracted=""
    if [[ "$local_bal" != "0" && "$local_bal" != "0.000000" ]]; then
      local_extracted=$(python3 -c "
import json; print(json.dumps({'address':'$match','balanceETH':float('$local_bal'),'explorerUrl':'https://etherscan.io/address/$match'}))
" 2>/dev/null || echo "")
    fi
    add_item "address" "ethereum" "$f" "normal" "$match" "$local_extracted"
  fi

  # BTC addresses (P2PKH 1..., P2SH 3..., Bech32 bc1...)
  if echo "$content" | grep -qP '(?:^|[\s:"])(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,90})(?:$|[\s,;"])' 2>/dev/null; then
    match=$(echo "$content" | grep -oP '(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,90})' 2>/dev/null | head -1)
    add_item "address" "bitcoin" "$f" "normal" "$match"
  fi

  # xpub/xprv extended keys
  if echo "$content" | grep -qP 'xp(ub|rv)[0-9A-Za-z]{100,}' 2>/dev/null; then
    match=$(echo "$content" | grep -oP 'xp(ub|rv)[0-9A-Za-z]{100,}' 2>/dev/null | head -1)
    local sens="normal"
    [[ "$match" == xprv* ]] && sens="critical"
    add_item "private_key" "extended-key" "$f" "$sens" "$match"
  fi

  # Mining pool configs (etherbase, pool URLs, worker names)
  if echo "$content" | grep -qiP '(miner\.start|miner\.setEtherbase|epool|stratum\+tcp|coinotron|nicehash|f2pool|nanopool|ethermine)' 2>/dev/null; then
    preview=$(echo "$content" | grep -iP '(miner\.|epool|stratum|pool|worker|wallet)' 2>/dev/null | head -3 | tr '\n' ' ' | head -c 200)
    add_item "config_file" "mining" "$f" "normal" "$preview"
  fi

done < <(find "$MOUNT" -type f -size -10M \
  \( -name "*.txt" -o -name "*.csv" -o -name "*.json" -o -name "*.conf" -o -name "*.cfg" \
     -o -name "*.log" -o -name "*.md" -o -name "*.bak" -o -name "*.old" \
     -o -name "*.bat" -o -name "*.cmd" -o -name "*.ps1" -o -name "*.vbs" -o -name "*.sh" \
     -o -name "*.ini" -o -name "*.yaml" -o -name "*.yml" -o -name "*.toml" \) \
  -not -path "*/Windows/System32/*" -not -path "*/Windows/SysWOW64/*" \
  -not -path "*/Windows/WinSxS/*" -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -print0 2>/dev/null)

# ============================================================
# Phase 4: BIP39 seed phrase detection (Python — full wordlist)
# ============================================================
log "--- Phase 4: BIP39 seed phrase detection ---"

python3 "$SCRIPT_DIR/crypto-drive-helpers.py" scan-seeds "$MOUNT" "$ITEMS_FILE" "$OUTPUT_DIR" 2>/dev/null || log "  Seed scan skipped (helper error)"

# ============================================================
# Phase 5: Windows Sticky Notes SQLite
# ============================================================
log "--- Phase 5: Windows Sticky Notes ---"

while IFS= read -r -d '' db; do
  [ -f "$db" ] || continue
  log "  Scanning Sticky Notes: $db"

  # Copy the DB
  local_relpath="${db#$MOUNT}"
  local_destdir="$OUTPUT_DIR/copies/$(dirname "$local_relpath")"
  mkdir -p "$local_destdir" 2>/dev/null || true
  cp -a "$db" "$local_destdir/" 2>/dev/null || true

  # Extract all note text and scan for crypto content
  python3 -c "
import sqlite3, json, sys, re

db_path = sys.argv[1]
items_file = sys.argv[2]
mount = sys.argv[3]
output_dir = sys.argv[4]
rel_path = db_path[len(mount):]

conn = sqlite3.connect(db_path)
try:
    rows = conn.execute('SELECT Text FROM Note').fetchall()
except:
    sys.exit(0)
conn.close()

full_text = ' '.join(r[0] or '' for r in rows)

# Extract ETH addresses
eth_addrs = list(set(re.findall(r'0x[0-9a-fA-F]{40}', full_text)))
# Extract BTC addresses
btc_addrs = list(set(re.findall(r'(?:^|[\s:\"])((?:[13][a-km-zA-HJ-NP-Z1-9]{25,34})|(?:bc1[a-zA-HJ-NP-Z0-9]{25,90}))(?:$|[\s,;\"])', full_text)))
# Extract 64-char hex keys
hex_keys = list(set(re.findall(r'(?:^|[\s:=])([0-9a-fA-F]{64})(?:$|[\s,;])', full_text)))
# Extract potential seed phrases (12+ lowercase words)
seed_candidates = re.findall(r'\b([a-z]{3,8}(?:\s+[a-z]{3,8}){11,23})\b', full_text.lower())
# Mining references
mining_refs = re.findall(r'(?:miner\.(?:start|setEtherbase)|epool|stratum|f2pool|nicehash|coinotron|walton|amoveo|siacoin|poloniex)\S*', full_text, re.IGNORECASE)

items = []

for addr in eth_addrs:
    items.append({
        'category': 'address', 'subcategory': 'ethereum',
        'filePath': rel_path, 'fileSize': 0, 'fileMtime': None,
        'contentPreview': f'Sticky Note ETH: {addr}',
        'sensitivity': 'sensitive',
        'localCopyPath': output_dir + '/copies' + rel_path,
        'extractedData': {
            'address': addr,
            'explorerUrl': f'https://etherscan.io/address/{addr}',
            'source': 'Windows Sticky Notes',
        },
    })

for addr in btc_addrs:
    if isinstance(addr, tuple): addr = addr[0]
    items.append({
        'category': 'address', 'subcategory': 'bitcoin',
        'filePath': rel_path, 'fileSize': 0, 'fileMtime': None,
        'contentPreview': f'Sticky Note BTC: {addr}',
        'sensitivity': 'normal',
        'localCopyPath': output_dir + '/copies' + rel_path,
        'extractedData': {
            'address': addr,
            'explorerUrl': f'https://www.blockchain.com/btc/address/{addr}',
            'source': 'Windows Sticky Notes',
        },
    })

for key in hex_keys:
    items.append({
        'category': 'private_key', 'subcategory': 'hex',
        'filePath': rel_path, 'fileSize': 0, 'fileMtime': None,
        'contentPreview': key[:4] + '...' + key[-4:],
        'sensitivity': 'critical',
        'localCopyPath': output_dir + '/copies' + rel_path,
    })

for seed in seed_candidates:
    words = seed.split()
    if len(words) in (12, 15, 18, 21, 24):
        items.append({
            'category': 'seed_phrase', 'subcategory': 'bip39',
            'filePath': rel_path, 'fileSize': 0, 'fileMtime': None,
            'contentPreview': words[0][:4] + '...' + words[-1][-4:],
            'sensitivity': 'critical',
            'localCopyPath': output_dir + '/copies' + rel_path,
            'extractedData': {'wordCount': len(words), 'source': 'Windows Sticky Notes'},
        })

if mining_refs:
    items.append({
        'category': 'document', 'subcategory': 'mining-inventory',
        'filePath': rel_path, 'fileSize': 0, 'fileMtime': None,
        'contentPreview': 'Mining references: ' + ', '.join(list(set(mining_refs))[:10]),
        'sensitivity': 'normal',
        'localCopyPath': output_dir + '/copies' + rel_path,
    })

with open(items_file, 'a') as fh:
    for item in items:
        fh.write(json.dumps(item) + '\n')

if items:
    print(f'  Sticky Notes: {len(items)} crypto items found')
" "$db" "$ITEMS_FILE" "$MOUNT" "$OUTPUT_DIR" 2>/dev/null || true

done < <(find "$MOUNT" -iname "plum.sqlite" -print0 2>/dev/null)

# Also check Windows 11 Sticky Notes (different path)
while IFS= read -r -d '' db; do
  [ -f "$db" ] || continue
  log "  Found Windows 11 Sticky Notes state: $db"
  local_relpath="${db#$MOUNT}"
  mkdir -p "$OUTPUT_DIR/copies/$(dirname "$local_relpath")" 2>/dev/null || true
  cp -a "$db" "$OUTPUT_DIR/copies/$(dirname "$local_relpath")/" 2>/dev/null || true
  add_item "document" "sticky-notes" "$db" "sensitive" "Windows 11 Sticky Notes state file"
done < <(find "$MOUNT" -path "*/Microsoft.MicrosoftStickyNotes*/State.json" -print0 2>/dev/null)

# ============================================================
# Phase 6: Browser extension data (MetaMask, Phantom, etc.)
# ============================================================
log "--- Phase 6: Browser extensions ---"

# Chrome MetaMask vault
while IFS= read -r -d '' f; do
  [ -f "$f" ] && add_item "browser_extension" "metamask-chrome" "$f" "critical"
done < <(find "$MOUNT" -path "*/Extensions/nkbihfbeogaeaoehlefnkodbefgpgknn/*" \( -name "*.ldb" -o -name "*.log" \) -print0 2>/dev/null | head -z -20)

# Firefox MetaMask
while IFS= read -r -d '' f; do
  [ -f "$f" ] && add_item "browser_extension" "metamask-firefox" "$f" "critical"
done < <(find "$MOUNT" -path "*/.mozilla/firefox/*/storage/default/*metamask*" -type f -print0 2>/dev/null | head -z -20)

# Brave/Chrome/Edge extension local storage with crypto keywords
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  if strings "$f" 2>/dev/null | grep -qi "metamask\|phantom\|coinbase.*wallet\|trust.*wallet\|keplr\|rabby" 2>/dev/null; then
    add_item "browser_extension" "crypto-extension" "$f" "sensitive"
  fi
done < <(find "$MOUNT" -path "*/Local Storage/leveldb/*" -name "*.ldb" -print0 2>/dev/null | head -z -50)

# ============================================================
# Phase 7: QR code images
# ============================================================
log "--- Phase 7: QR code images ---"

if command -v zbarimg &>/dev/null; then
  while IFS= read -r -d '' f; do
    [ -f "$f" ] || continue
    decoded=$(timeout 5 zbarimg -q "$f" 2>/dev/null || true)
    if [[ -n "$decoded" ]]; then
      if echo "$decoded" | grep -qiP 'bitcoin:|ethereum:|0x[0-9a-fA-F]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1'; then
        add_item "qr_image" "" "$f" "sensitive" "$decoded"
      fi
    fi
  done < <(find "$MOUNT" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.bmp" \) -size -5M \
    -not -path "*/Windows/*" -not -path "*/node_modules/*" -print0 2>/dev/null | head -z -500)
else
  log "  zbarimg not installed — skipping QR scan"
fi

# ============================================================
# Phase 8: Spreadsheets
# ============================================================
log "--- Phase 8: Spreadsheets ---"

if [ -f "$HELPERS" ]; then
  while IFS= read -r -d '' f; do
    [ -f "$f" ] || continue
    result=$(timeout 30 python3 "$HELPERS" scan-spreadsheet "$f" 2>/dev/null || true)
    if [[ -n "$result" && "$result" != "null" ]]; then
      add_item "document" "spreadsheet" "$f" "sensitive" "$result"
    fi
  done < <(find "$MOUNT" -type f \( -name "*.xlsx" -o -name "*.xls" -o -name "*.csv" \) -size -50M \
    -not -path "*/Windows/*" -not -path "*/node_modules/*" -print0 2>/dev/null)
else
  log "  crypto-drive-helpers.py not found — skipping"
fi

# ============================================================
# Phase 9: Telegram Desktop files
# ============================================================
log "--- Phase 9: Telegram Desktop ---"

while IFS= read -r -d '' tdir; do
  [ -d "$tdir" ] || continue
  log "  Scanning Telegram Desktop: $tdir"

  # Look for crypto-related files (PDFs, images, docs)
  while IFS= read -r -d '' f; do
    [ -f "$f" ] || continue
    fname=$(basename "$f")
    # Check filename for crypto keywords
    if echo "$fname" | grep -qiP 'wallet|crypto|bitcoin|ethereum|seed|key|mining|walton|defi|token|coin'; then
      add_item "document" "telegram" "$f" "sensitive" "Telegram file: $fname"
    fi
  done < <(find "$tdir" -type f \( -name "*.pdf" -o -name "*.txt" -o -name "*.json" -o -name "*.csv" -o -name "*.png" -o -name "*.jpg" \) -print0 2>/dev/null)

done < <(find "$MOUNT" -maxdepth 5 -type d -iname "Telegram Desktop" -print0 2>/dev/null)

# ============================================================
# Phase 10: Recovery codes & password files
# ============================================================
log "--- Phase 10: Recovery codes & sensitive docs ---"

while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  fdir=$(dirname "$f")

  # Filename-based detection
  if echo "$fname" | grep -qiP 'recovery|backup|seed|passphrase|2fa|codes|passwords|credentials'; then
    content_preview=$(head -c 200 "$f" 2>/dev/null | tr '\n' ' ' | head -c 100)
    add_item "document" "recovery-codes" "$f" "sensitive" "$content_preview"
  fi
done < <(find "$MOUNT" -type f -size -1M \
  \( -name "*.txt" -o -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) \
  -not -path "*/Windows/*" -not -path "*/node_modules/*" \
  -print0 2>/dev/null)

# ============================================================
# Build results JSON
# ============================================================
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
ITEM_COUNT=$(wc -l < "$ITEMS_FILE" 2>/dev/null || echo 0)

log ""
log "=== Scan Complete ==="
log "Duration: ${DURATION}s"
log "Items found: $ITEM_COUNT"

# Build JSON output with dedup
python3 -c "
import json, sys

items = []
with open(sys.argv[1]) as f:
    for line in f:
        line = line.strip()
        if line:
            try:
                items.append(json.loads(line))
            except json.JSONDecodeError:
                pass

# Deduplicate by category+filePath (allows multiple categories per file)
seen = set()
unique = []
for item in items:
    key = item['category'] + '::' + item['filePath']
    if key not in seen:
        seen.add(key)
        unique.append(item)

result = {
    'label': sys.argv[2],
    'devicePath': sys.argv[3],
    'filesystem': sys.argv[4],
    'totalSizeGb': float(sys.argv[5]) if sys.argv[5] else None,
    'serialNumber': sys.argv[6] if sys.argv[6] else None,
    'scanDuration': int(sys.argv[7]),
    'scanLog': open(sys.argv[8]).read(),
    'items': unique,
}

with open(sys.argv[9], 'w') as out:
    json.dump(result, out, indent=2)

print(f'Results written to {sys.argv[9]}')
print(f'Total unique items: {len(unique)}')
sens = {}
for i in unique:
    s = i['sensitivity']
    sens[s] = sens.get(s, 0) + 1
for s, c in sorted(sens.items()):
    print(f'  {s}: {c}')

# Count funded addresses
funded = [i for i in unique if i.get('extractedData',{}).get('balanceETH',0) > 0 or i.get('extractedData',{}).get('balanceWTC',0) > 0]
if funded:
    print(f'  FUNDED ADDRESSES: {len(funded)}')
    for i in funded:
        d = i['extractedData']
        addr = d.get('address', d.get('derivedAddress','?'))
        bal_parts = []
        if d.get('balanceETH',0) > 0: bal_parts.append(f\"{d['balanceETH']} ETH\")
        if d.get('balanceWTC',0) > 0: bal_parts.append(f\"{d['balanceWTC']} WTC\")
        print(f'    {addr}: {\" + \".join(bal_parts)}')
" "$ITEMS_FILE" "$LABEL" "$DEVICE" "$FS_TYPE" "$TOTAL_SIZE" "$SERIAL" "$DURATION" "$LOG_FILE" "$RESULTS_FILE"

log "Results: $RESULTS_FILE"
log "Copies: $OUTPUT_DIR/copies/"
log ""
log "Next: node scripts/upload-drive-scan.js $RESULTS_FILE"
