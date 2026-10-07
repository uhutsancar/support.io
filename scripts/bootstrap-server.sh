#!/usr/bin/env bash
# Hardens a fresh Ubuntu 24.04 server for Support.io (plan v10 SEC-14,
# runbook §1). Run once as root after the `deploy` user can log in with its
# SSH key; running it again changes nothing that is already in place.
#
#   sudo ./scripts/bootstrap-server.sh
#
# What it does:
#   - security updates install themselves (unattended-upgrades); a reboot a
#     kernel update asks for happens on Sunday at 04:00 UTC, not at random
#   - fail2ban bans an address after 5 failed SSH logins for an hour
#   - chrony keeps the clock right (Paddle's webhook signatures and the
#     two-step codes depend on it)
#   - SSH: no root login, no passwords — only once `deploy` has a key
#   - UFW: incoming denied except SSH, HTTP and HTTPS
#   - Docker daemon: live restore, rotated json logs, no userland proxy,
#     no new privileges (written only if /etc/docker/daemon.json is absent
#     or already ours; anything else is left and reported)
#   - a 2 GB swap file if there is no swap (a 4 GB server, OOM headroom)
#   - /opt/supportio/.env.production readable by `deploy` only
#
# It does not install Docker (docs.docker.com/engine/install/ubuntu) and does
# not restrict 80/443 to Cloudflare (scripts/ufw-cloudflare.sh, later).
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/supportio}"
MARK='# managed by supportio bootstrap-server.sh'

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root (sudo)" >&2
  exit 1
fi
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "user $DEPLOY_USER does not exist; create it first (runbook §1)" >&2
  exit 1
fi

step() { printf '\n== %s\n' "$*"; }

step "packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q unattended-upgrades fail2ban chrony ufw rclone age curl

step "automatic security updates; reboots on Sunday 04:00 UTC"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
cat >/etc/apt/apt.conf.d/52supportio-upgrades <<EOF
$MARK
// Updates install daily; a reboot they need waits for the timer below.
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
cat >/etc/systemd/system/supportio-reboot.service <<EOF
$MARK
[Unit]
Description=Reboot if an update asked for it (Support.io maintenance window)

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'test -f /var/run/reboot-required && /bin/systemctl reboot || true'
EOF
cat >/etc/systemd/system/supportio-reboot.timer <<EOF
$MARK
[Unit]
Description=Support.io maintenance window: Sunday 04:00 UTC

[Timer]
OnCalendar=Sun *-*-* 04:00:00 UTC
Persistent=false

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now supportio-reboot.timer
timedatectl set-timezone UTC

step "fail2ban for SSH"
cat >/etc/fail2ban/jail.d/supportio-sshd.local <<EOF
$MARK
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

step "time sync (chrony)"
systemctl enable --now chrony
timedatectl set-ntp true || true

step "SSH: keys only, no root"
keys="/home/$DEPLOY_USER/.ssh/authorized_keys"
if [[ -s "$keys" ]]; then
  cat >/etc/ssh/sshd_config.d/10-supportio.conf <<EOF
$MARK
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
  if sshd -t; then
    systemctl reload ssh || systemctl reload sshd
  else
    rm -f /etc/ssh/sshd_config.d/10-supportio.conf
    echo "sshd rejected the settings; left as they were" >&2
  fi
else
  echo "skipped: $keys is empty — add the deploy key first, or this would lock you out"
fi

step "firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
if ! ufw status | grep -q 'supportio-cloudflare'; then
  # Not yet restricted to Cloudflare (scripts/ufw-cloudflare.sh does that).
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 443/udp
fi
ufw --force enable

step "Docker daemon settings"
daemon=/etc/docker/daemon.json
wanted='{
  "live-restore": true,
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" },
  "userland-proxy": false,
  "no-new-privileges": true
}'
mkdir -p /etc/docker
if [[ ! -s "$daemon" ]]; then
  echo "$wanted" >"$daemon"
  if systemctl is-active --quiet docker; then
    echo "restarting Docker (containers restart once; live-restore keeps them up from now on)"
    systemctl restart docker
  fi
elif [[ "$(tr -d ' \n' <"$daemon")" == "$(tr -d ' \n' <<<"$wanted")" ]]; then
  echo "already in place"
else
  echo "left as it is: $daemon exists with other settings. Wanted:" >&2
  echo "$wanted" >&2
fi

step "swap"
if [[ -z "$(swapon --show --noheadings)" ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
  sysctl -q vm.swappiness=10
  echo 'vm.swappiness=10' >/etc/sysctl.d/60-supportio-swap.conf
  echo "2 GB swap file on"
else
  echo "swap already on"
fi

step "application directory"
mkdir -p "$APP_DIR"
chown "$DEPLOY_USER": "$APP_DIR"
if [[ -f "$APP_DIR/.env.production" ]]; then
  chown "$DEPLOY_USER": "$APP_DIR/.env.production"
  chmod 600 "$APP_DIR/.env.production"
  echo ".env.production: 600, owner $DEPLOY_USER"
fi

step "done"
echo "Next: Docker (if not installed), then runbook §1 step 6 onwards."
echo "Recommended later: SSH only over Tailscale or WireGuard (runbook §1)."
