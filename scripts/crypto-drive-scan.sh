#!/usr/bin/env bash
# crypto-drive-scan.sh — Scan a mounted drive for crypto wallets, keys, seeds
# Usage: bash scripts/crypto-drive-scan.sh --mount /mnt/crypto-scan --label "Drive Name"
# Output: JSON results + copies to ~/Desktop/crypto-extractions/<scan-id>/

set -euo pipefail

MOUNT=""
LABEL=""
SCAN_ID="scan-$(date +%Y%m%d-%H%M%S)"
OUTPUT_DIR="$HOME/Desktop/crypto-extractions/$SCAN_ID"
RESULTS_FILE="$OUTPUT_DIR/results.json"
HELPERS="$(dirname "$0")/crypto-drive-helpers.py"
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

log "=== Crypto Drive Scan ==="
log "Label: $LABEL"
log "Mount: $MOUNT"
log "Scan ID: $SCAN_ID"
log "Output: $OUTPUT_DIR"

# Get drive info
DEVICE=$(df "$MOUNT" 2>/dev/null | tail -1 | awk '{print $1}')
FS_TYPE=$(df -T "$MOUNT" 2>/dev/null | tail -1 | awk '{print $2}')
TOTAL_SIZE=$(df -BG "$MOUNT" 2>/dev/null | tail -1 | awk '{print $2}' | tr -d 'G')
SERIAL=$(udevadm info --query=property --name="$DEVICE" 2>/dev/null | grep ID_SERIAL_SHORT | cut -d= -f2 || echo "")

log "Device: $DEVICE | FS: $FS_TYPE | Size: ${TOTAL_SIZE}G | Serial: ${SERIAL:-unknown}"

# Temp file for collecting items as JSONL
ITEMS_FILE=$(mktemp /tmp/crypto-items.XXXXXX)
trap "rm -f $ITEMS_FILE" EXIT

add_item() {
  local category="$1" subcategory="$2" filepath="$3" sensitivity="$4" preview="${5:-}"
  local filesize=0 mtime=""
  if [ -f "$filepath" ]; then
    filesize=$(stat -c%s "$filepath" 2>/dev/null || echo 0)
    mtime=$(stat -c%Y "$filepath" 2>/dev/null || echo "")
    [[ -n "$mtime" ]] && mtime=$(date -d @"$mtime" --iso-8601=seconds 2>/dev/null || echo "")
    # Copy file
    local relpath="${filepath#$MOUNT}"
    local destdir="$OUTPUT_DIR/copies/$(dirname "$relpath")"
    mkdir -p "$destdir"
    cp -a "$filepath" "$destdir/" 2>/dev/null || true
  fi
  local localcopy="$OUTPUT_DIR/copies/${filepath#$MOUNT}"
  # Redact preview for critical items
  if [[ "$sensitivity" == "critical" && -n "$preview" && ${#preview} -gt 12 ]]; then
    preview="${preview:0:4}...${preview: -4}"
  fi
  printf '%s\n' "$(python3 -c "
import json, sys
print(json.dumps({
    'category': sys.argv[1],
    'subcategory': sys.argv[2] if sys.argv[2] != '' else None,
    'filePath': sys.argv[3],
    'fileSize': int(sys.argv[4]),
    'fileMtime': sys.argv[5] if sys.argv[5] != '' else None,
    'contentPreview': sys.argv[6] if sys.argv[6] != '' else None,
    'sensitivity': sys.argv[7],
    'localCopyPath': sys.argv[8],
}))
" "$category" "$subcategory" "${filepath#$MOUNT}" "$filesize" "$mtime" "$preview" "$sensitivity" "$localcopy")" >> "$ITEMS_FILE"
  log "  Found: [$sensitivity] $category/$subcategory — ${filepath#$MOUNT}"
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
)

for pattern in "${!WALLET_PATHS[@]}"; do
  IFS=: read -r cat sub sens <<< "${WALLET_PATHS[$pattern]}"
  # Search in home dirs and root
  while IFS= read -r -d '' found; do
    if [ -d "$found" ]; then
      find "$found" -maxdepth 2 -type f 2>/dev/null | while read -r f; do
        [ -f "$f" ] && add_item "$cat" "$sub" "$f" "$sens"
      done
    elif [ -f "$found" ]; then
      add_item "$cat" "$sub" "$found" "$sens"
    fi
  done < <(find "$MOUNT" -path "*/$pattern" -print0 2>/dev/null)
done

# Ethereum keystore UTC files specifically
find "$MOUNT" -name "UTC--*" -type f 2>/dev/null | while read -r f; do
  [ -f "$f" ] && add_item "keystore" "ethereum" "$f" "critical" "$(head -c 80 "$f" 2>/dev/null || true)"
done

# ============================================================
# Phase 2: Pattern file search
# ============================================================
log "--- Phase 2: Pattern file search ---"

# wallet.dat anywhere
find "$MOUNT" -name "wallet.dat" -type f 2>/dev/null | while read -r f; do
  [ -f "$f" ] && add_item "wallet_file" "" "$f" "sensitive" "$(file "$f" 2>/dev/null | cut -d: -f2 | head -c 80)"
done

# *.wallet, *.key, *.keys files
find "$MOUNT" \( -name "*.wallet" -o -name "*.key" -o -name "*.keys" -o -name "*.keystore" \) -type f 2>/dev/null | while read -r f; do
  [ -f "$f" ] && add_item "wallet_file" "" "$f" "sensitive"
done

# Bitcoin/crypto related directories
find "$MOUNT" -maxdepth 5 -type d \( -iname ".bitcoin" -o -iname ".ethereum" -o -iname ".monero" -o -iname ".zcash" -o -iname "Armory" -o -iname "MultiBit" \) 2>/dev/null | while read -r d; do
  add_item "crypto_dir" "$(basename "$d" | tr '[:upper:]' '[:lower:]' | sed 's/^\.//')" "$d" "sensitive"
done

# ============================================================
# Phase 3: Content scanning (text files < 10MB)
# ============================================================
log "--- Phase 3: Content scanning ---"

# BIP39 wordlist (first 20 most common for quick check)
BIP39_CHECK="abandon|ability|able|about|above|absent|absorb|abstract|absurd|abuse|access|accident|account|accuse|achieve|acoustic|acquire|across|action|address"

# Find text files and scan for patterns
find "$MOUNT" -type f -size -10M \( -name "*.txt" -o -name "*.csv" -o -name "*.json" -o -name "*.conf" -o -name "*.cfg" -o -name "*.log" -o -name "*.md" -o -name "*.bak" -o -name "*.old" \) 2>/dev/null | while read -r f; do
  [ -f "$f" ] || continue

  # WIF private keys (Bitcoin)
  if grep -qP '5[HJK][1-9A-HJ-NP-Za-km-z]{49}' "$f" 2>/dev/null; then
    match=$(grep -oP '5[HJK][1-9A-HJ-NP-Za-km-z]{49}' "$f" 2>/dev/null | head -1)
    add_item "private_key" "bitcoin-wif" "$f" "critical" "$match"
  fi

  # Hex private keys (64 hex chars on their own line or clearly labeled)
  if grep -qP '(?:priv|key|secret).*[0-9a-fA-F]{64}' "$f" 2>/dev/null; then
    match=$(grep -oP '[0-9a-fA-F]{64}' "$f" 2>/dev/null | head -1)
    add_item "private_key" "hex" "$f" "critical" "$match"
  fi

  # BTC addresses
  if grep -qP '[13][a-km-zA-HJ-NP-Z1-9]{25,34}' "$f" 2>/dev/null; then
    match=$(grep -oP '[13][a-km-zA-HJ-NP-Z1-9]{25,34}' "$f" 2>/dev/null | head -1)
    add_item "address" "bitcoin" "$f" "normal" "$match"
  fi

  # ETH addresses
  if grep -qP '0x[0-9a-fA-F]{40}' "$f" 2>/dev/null; then
    match=$(grep -oP '0x[0-9a-fA-F]{40}' "$f" 2>/dev/null | head -1)
    add_item "address" "ethereum" "$f" "normal" "$match"
  fi

  # xpub/xprv extended keys
  if grep -qP 'xp(ub|rv)[0-9A-Za-z]{100,}' "$f" 2>/dev/null; then
    match=$(grep -oP 'xp(ub|rv)[0-9A-Za-z]{100,}' "$f" 2>/dev/null | head -1)
    sens="normal"
    [[ "$match" == xprv* ]] && sens="critical"
    add_item "private_key" "extended-key" "$f" "$sens" "$match"
  fi

  # BIP39 seed phrase detection (12+ BIP39 words in a row)
  if grep -qiP "($BIP39_CHECK)(\s+\w+){11,23}" "$f" 2>/dev/null; then
    match=$(grep -oiP "($BIP39_CHECK)(\s+\w+){11,23}" "$f" 2>/dev/null | head -1 | head -c 100)
    add_item "seed_phrase" "" "$f" "critical" "$match"
  fi
done

# ============================================================
# Phase 4: Browser extension data (MetaMask)
# ============================================================
log "--- Phase 4: Browser extension data ---"

# Chrome MetaMask
find "$MOUNT" -path "*/Extensions/nkbihfbeogaeaoehlefnkodbefgpgknn/*" -name "*.ldb" -o -name "*.log" 2>/dev/null | head -20 | while read -r f; do
  [ -f "$f" ] && add_item "browser_extension" "metamask-chrome" "$f" "critical"
done

# Firefox MetaMask
find "$MOUNT" -path "*/.mozilla/firefox/*/storage/default/*metamask*" -type f 2>/dev/null | head -20 | while read -r f; do
  [ -f "$f" ] && add_item "browser_extension" "metamask-firefox" "$f" "critical"
done

# Chrome local storage for any crypto extension
find "$MOUNT" -path "*/Local Storage/leveldb/*" -name "*.ldb" 2>/dev/null | while read -r f; do
  [ -f "$f" ] || continue
  if strings "$f" 2>/dev/null | grep -qi "metamask\|phantom\|coinbase.*wallet\|trust.*wallet" 2>/dev/null; then
    add_item "browser_extension" "crypto-extension" "$f" "sensitive"
  fi
done

# ============================================================
# Phase 5: QR code images (requires zbarimg)
# ============================================================
log "--- Phase 5: QR code images ---"

if command -v zbarimg &>/dev/null; then
  find "$MOUNT" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.bmp" \) -size -5M 2>/dev/null | head -500 | while read -r f; do
    [ -f "$f" ] || continue
    decoded=$(zbarimg -q "$f" 2>/dev/null || true)
    if [[ -n "$decoded" ]]; then
      # Filter for crypto-related QR codes
      if echo "$decoded" | grep -qiP 'bitcoin:|ethereum:|0x[0-9a-fA-F]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1'; then
        add_item "qr_image" "" "$f" "sensitive" "$decoded"
      fi
    fi
  done
else
  log "  zbarimg not installed — skipping QR scan"
fi

# ============================================================
# Phase 6: Spreadsheets/docs (requires Python helper)
# ============================================================
log "--- Phase 6: Spreadsheets and documents ---"

if [ -f "$HELPERS" ]; then
  find "$MOUNT" -type f \( -name "*.xlsx" -o -name "*.xls" -o -name "*.csv" \) -size -50M 2>/dev/null | while read -r f; do
    [ -f "$f" ] || continue
    result=$(python3 "$HELPERS" scan-spreadsheet "$f" 2>/dev/null || true)
    if [[ -n "$result" && "$result" != "null" ]]; then
      add_item "document" "spreadsheet" "$f" "sensitive" "$result"
    fi
  done
else
  log "  crypto-drive-helpers.py not found — skipping spreadsheet scan"
fi

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

# Build JSON output
python3 -c "
import json, sys

items = []
with open(sys.argv[1]) as f:
    for line in f:
        line = line.strip()
        if line:
            items.append(json.loads(line))

# Deduplicate by filePath
seen = set()
unique = []
for item in items:
    if item['filePath'] not in seen:
        seen.add(item['filePath'])
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
cats = {}
for i in unique:
    cats[i[\"sensitivity\"]] = cats.get(i[\"sensitivity\"], 0) + 1
for s, c in sorted(cats.items()):
    print(f'  {s}: {c}')
" "$ITEMS_FILE" "$LABEL" "$DEVICE" "$FS_TYPE" "$TOTAL_SIZE" "$SERIAL" "$DURATION" "$LOG_FILE" "$RESULTS_FILE"

log "Results: $RESULTS_FILE"
log "Copies: $OUTPUT_DIR/copies/"
