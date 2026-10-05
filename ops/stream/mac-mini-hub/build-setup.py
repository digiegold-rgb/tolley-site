#!/usr/bin/env python3
"""Build an inspectable, self-contained macOS bootstrap; embeds public data only."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
guide = root.parent
public_key = (Path.home() / '.ssh/id_ed25519.pub').read_text().strip()
host_key = Path('/etc/ssh/ssh_host_ed25519_key.pub').read_text().strip()
script = r'''#!/bin/bash
# Tolley Mac mini bootstrap. Public keys only. No credentials are embedded.
set -euo pipefail
if [ "$(uname -s)" != Darwin ]; then
  echo 'Run this setup on the Mac mini in macOS Terminal.' >&2
  exit 1
fi
umask 077
hub="$HOME/Desktop/Tolley Hub"
mkdir -p "$hub" "$HOME/bin" "$HOME/.ssh" "$HOME/.config/tolley-hub" "$HOME/stream-director/agents" "$HOME/.codex"
chmod 700 "$HOME/.ssh"
backup_stamp=$(date +%Y%m%d-%H%M%S)
for f in "$HOME/.ssh/config" "$HOME/.ssh/tolley-hub.conf" "$HOME/.codex/AGENTS.md"; do
  if [ -f "$f" ]; then cp -p "$f" "$f.before-tolley-$backup_stamp"; fi
done
touch "$HOME/.ssh/authorized_keys"
chmod 600 "$HOME/.ssh/authorized_keys"
spark_key='@SPARK_PUBLIC_KEY@'
if ! grep -Fq "$(printf '%s\n' "$spark_key" | awk '{print $2}')" "$HOME/.ssh/authorized_keys"; then
  printf '\n%s\n' "$spark_key" >> "$HOME/.ssh/authorized_keys"
fi
mini_key="$HOME/.ssh/id_ed25519_tolley_hub"
if [ ! -f "$mini_key" ]; then
  ssh-keygen -q -t ed25519 -N '' -C "tolley-hub@$(scutil --get LocalHostName)" -f "$mini_key"
fi
chmod 600 "$mini_key"
cat > "$HOME/.ssh/tolley-hub.conf" <<'TOLLEY_SSH'
Host spark tolley-spark
  HostName 100.81.82.79
  User jelly
  IdentityFile ~/.ssh/id_ed25519_tolley_hub
  IdentitiesOnly yes
  ForwardAgent no
  ServerAliveInterval 30
  ServerAliveCountMax 3
Host streaming-pc
  HostName 100.98.175.104
  User tower
  IdentityFile ~/.ssh/id_ed25519_tolley_hub
  IdentitiesOnly yes
  ForwardAgent no
  ServerAliveInterval 30
Host tolley-nas
  HostName 192.168.2.196
  User Jared
  IdentityFile ~/.ssh/id_ed25519_tolley_hub
  IdentitiesOnly yes
  ForwardAgent no
  ServerAliveInterval 30
TOLLEY_SSH
touch "$HOME/.ssh/config"
if ! grep -Fq 'Include ~/.ssh/tolley-hub.conf' "$HOME/.ssh/config"; then
  { printf 'Include ~/.ssh/tolley-hub.conf\n'; cat "$HOME/.ssh/config"; } > "$HOME/.ssh/config.tolley-new"
  mv "$HOME/.ssh/config.tolley-new" "$HOME/.ssh/config"
fi
chmod 600 "$HOME/.ssh/config" "$HOME/.ssh/tolley-hub.conf"
touch "$HOME/.ssh/known_hosts"
spark_host='100.81.82.79,tolley-fixes.taile5cde9.ts.net @SPARK_HOST_KEY@'
if ! grep -Fq "$(printf '%s\n' "$spark_host" | awk '{print $3}')" "$HOME/.ssh/known_hosts"; then
  printf '\n%s\n' "$spark_host" >> "$HOME/.ssh/known_hosts"
fi
cat > "$HOME/bin/stream" <<'TOLLEY_STREAM'
#!/bin/bash
set -euo pipefail
# Keep the real CLI and all credentials on Spark. Bash %q safely quotes arguments.
cmd='$HOME/bin/stream'
for arg in "$@"; do printf -v escaped '%q' "$arg"; cmd="$cmd $escaped"; done
exec /usr/bin/ssh spark "$cmd"
TOLLEY_STREAM
cat > "$HOME/bin/spark-terminal" <<'TOLLEY_TERMINAL'
#!/bin/bash
exec /usr/bin/ssh spark
TOLLEY_TERMINAL
cat > "$HOME/bin/spark-codex" <<'TOLLEY_CODEX'
#!/bin/bash
exec /usr/bin/ssh -t spark 'cd /home/jelly && exec /home/jelly/bin/codex'
TOLLEY_CODEX
cat > "$HOME/bin/tolley-files" <<'TOLLEY_FILES'
#!/bin/bash
exec /usr/bin/open 'smb://192.168.2.196/UserFolder'
TOLLEY_FILES
chmod 700 "$HOME/bin/stream" "$HOME/bin/spark-terminal" "$HOME/bin/spark-codex" "$HOME/bin/tolley-files"
for rc in "$HOME/.zprofile" "$HOME/.bash_profile"; do
  touch "$rc"
  if ! grep -Fq '# Tolley hub PATH' "$rc"; then
    printf '\n# Tolley hub PATH\nexport PATH="$HOME/bin:$PATH"\n' >> "$rc"
  fi
done
export PATH="$HOME/bin:$PATH"
'''
script = script.replace('@SPARK_PUBLIC_KEY@', public_key).replace('@SPARK_HOST_KEY@', host_key)

def embed(content, destination, tag):
    global script
    assert '\n' + tag + '\n' not in content
    script += f'cat > "{destination}" <<\'{tag}\'\n{content.rstrip()}\n{tag}\n'

embed((root / 'README.md').read_text(), '$hub/README.md', 'TOLLEY_README')
embed((root / 'hub.html').read_text(), '$hub/Hub.html', 'TOLLEY_HTML')
embed((root / 'AGENTS.md').read_text(), '$hub/AGENTS.md', 'TOLLEY_AGENTS')
for name in ['STREAM-AGENTS.md', 'OPERATIONS.md']:
    embed((guide / name).read_text(), f'$HOME/stream-director/agents/{name}', 'TOLLEY_' + name.replace('.', '_').replace('-', '_'))
script += r'''
cp "$HOME/stream-director/agents/STREAM-AGENTS.md" "$hub/STREAM-AGENTS.md"
cp "$HOME/stream-director/agents/OPERATIONS.md" "$hub/OPERATIONS.md"
touch "$HOME/.codex/AGENTS.md"
if ! grep -Fq '# Streams Mac mini identity and operating instructions' "$HOME/.codex/AGENTS.md"; then
  printf '\n' >> "$HOME/.codex/AGENTS.md"
  cat "$hub/AGENTS.md" >> "$HOME/.codex/AGENTS.md"
fi
{
  printf 'Role: Tolley primary operator hub\nUsername: %s\nHome: %s\n' "$(id -un)" "$HOME"
  printf 'Computer name: '; scutil --get ComputerName
  printf 'Local host name: '; scutil --get LocalHostName
  printf 'Architecture: '; uname -m
  printf 'macOS:\n'; sw_vers
  system_profiler SPHardwareDataType | awk '/Model Name:|Model Identifier:|Chip:|Processor Name:|Memory:/{print}'
  printf 'Expected Tailscale address: 100.96.109.9\nCurrent power settings:\n'
  pmset -g custom
  printf '\nMini public SSH key:\n'; cat "$mini_key.pub"
} > "$HOME/.config/tolley-hub/identity.txt"
cp "$HOME/.config/tolley-hub/identity.txt" "$hub/Identity.txt"
cp "$HOME/.config/tolley-hub/identity.txt" "$HOME/.config/tolley-hub/tolley-mac-mini-identity.txt"
cat > "$hub/Open Hub.command" <<'TOLLEY_OPEN'
#!/bin/bash
exec /usr/bin/open -a Safari "$HOME/Desktop/Tolley Hub/Hub.html" 'https://www.tolley.io/hq' 'https://www.tolley.io/stream/assistant'
TOLLEY_OPEN
cat > "$hub/Spark Terminal.command" <<'TOLLEY_SPARK_OPEN'
#!/bin/bash
exec "$HOME/bin/spark-terminal"
TOLLEY_SPARK_OPEN
cat > "$hub/Codex on Spark.command" <<'TOLLEY_CODEX_OPEN'
#!/bin/bash
exec "$HOME/bin/spark-codex"
TOLLEY_CODEX_OPEN
chmod 700 "$hub/"*.command
for spec in 'HQ|https://www.tolley.io/hq' 'Show Assistant|https://www.tolley.io/stream/assistant' 'Windows Remote Desktop|https://remotedesktop.google.com/access'; do
  label=${spec%%|*}; url=${spec#*|}
  printf '<?xml version="1.0"?><plist version="1.0"><dict><key>URL</key><string>%s</string></dict></plist>\n' "$url" > "$hub/$label.webloc"
done
for spec in 'NAS Shared Files|smb://192.168.2.196/UserFolder' 'NAS Personal Folder|smb://192.168.2.196/personal_folder' 'Share Mac mini Screen|vnc://100.96.109.9'; do
  label=${spec%%|*}; url=${spec#*|}
  printf '<?xml version="1.0"?><plist version="1.0"><dict><key>URL</key><string>%s</string></dict></plist>\n' "$url" > "$hub/$label.inetloc"
done
ts_bin=''
if command -v tailscale >/dev/null 2>&1; then ts_bin=$(command -v tailscale)
elif [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; then ts_bin=/Applications/Tailscale.app/Contents/MacOS/Tailscale
fi
if [ -n "$ts_bin" ]; then
  if "$ts_bin" file cp "$HOME/.config/tolley-hub/tolley-mac-mini-identity.txt" 100.81.82.79:; then
    echo 'Public identity sent to Spark using Taildrop.'
  else
    echo 'Taildrop return was unavailable. Send the username below; the public key remains in Desktop/Tolley Hub/Identity.txt.'
  fi
fi
open 'x-apple.systempreferences:com.apple.Sharing-Settings.extension' || true
open -a Safari "$hub/Hub.html" || true
printf '\nSetup files installed. Your mini username is: %s\n' "$(id -un)"
printf 'In Sharing settings turn on Remote Login and Screen Sharing for your Mac user.\nTell the agent when Remote Login is on. Target SSH keys still need authorization.\n'
'''
output = root / 'Tolley-Mac-Mini-Setup.command'
output.write_text(script)
output.chmod(0o700)
subprocess.run(['bash', '-n', str(output)], check=True)
print(f'Built {output.name}: {output.stat().st_size} bytes; shell syntax passed')
