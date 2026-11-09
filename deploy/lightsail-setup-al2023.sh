#!/bin/sh
# One-time setup of a Lightsail Amazon Linux 2023 instance (2 GB plan) for RealityProof.
# Run as root: sudo sh deploy/lightsail-setup-al2023.sh
# Installs Docker from the Amazon Linux repository, and the Compose and Buildx plugins
# from their official GitHub releases after checking their published SHA-256 sums.
set -eu

# The image build needs more than 2 GB of memory: keep a 2 GB swap file across reboots.
if ! swapon --show | grep -q '^/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap defaults 0 0' >> /etc/fstab
fi

dnf install -y docker tar gzip
systemctl enable --now docker
usermod -aG docker ec2-user

plugins=/usr/local/lib/docker/cli-plugins
mkdir -p "$plugins"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

latest() { curl -fsSL "https://api.github.com/repos/$1/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n1; }

compose_v=$(latest docker/compose)
curl -fsSL -o "$tmp/docker-compose-linux-x86_64" "https://github.com/docker/compose/releases/download/$compose_v/docker-compose-linux-x86_64"
curl -fsSL -o "$tmp/compose.sha256" "https://github.com/docker/compose/releases/download/$compose_v/docker-compose-linux-x86_64.sha256"
(cd "$tmp" && sha256sum -c compose.sha256)
install -m 755 "$tmp/docker-compose-linux-x86_64" "$plugins/docker-compose"

buildx_v=$(latest docker/buildx)
asset="buildx-$buildx_v.linux-amd64"
curl -fsSL -o "$tmp/$asset" "https://github.com/docker/buildx/releases/download/$buildx_v/$asset"
curl -fsSL -o "$tmp/checksums.txt" "https://github.com/docker/buildx/releases/download/$buildx_v/checksums.txt"
(cd "$tmp" && grep " \*\?$asset\$" checksums.txt | sha256sum -c -)
install -m 755 "$tmp/$asset" "$plugins/docker-buildx"

docker --version
docker compose version
docker buildx version
swapon --show
