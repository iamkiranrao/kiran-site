#!/bin/bash
# Setup Cloudflare Tunnel for Command Center API
# Run this from your Mac terminal (not Cowork)
# Usage: bash scripts/setup-cc-tunnel.sh

set -e

TUNNEL_NAME="command-center"
HOSTNAME="cc.kiranrao.ai"
LOCAL_SERVICE="http://localhost:8000"

echo "=== Command Center Tunnel Setup ==="
echo ""

# Step 1: Install cloudflared if needed
if ! command -v cloudflared &> /dev/null; then
    echo "Installing cloudflared..."
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz | tar xz
    else
        curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz | tar xz
    fi
    sudo mv cloudflared /usr/local/bin/
    echo "cloudflared installed ✓"
else
    echo "cloudflared already installed ✓"
fi

# Step 2: Check if already authenticated
if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
    echo ""
    echo "Opening browser for Cloudflare auth..."
    echo "Select the kiranrao.ai zone when prompted."
    cloudflared tunnel login
else
    echo "Already authenticated with Cloudflare ✓"
fi

# Step 3: Create tunnel (skip if exists)
if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo "Tunnel '$TUNNEL_NAME' already exists ✓"
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
else
    echo "Creating tunnel '$TUNNEL_NAME'..."
    cloudflared tunnel create "$TUNNEL_NAME"
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
fi

echo "Tunnel ID: $TUNNEL_ID"

# Step 4: Write config
CONFIG_FILE="$HOME/.cloudflared/config.yml"
echo ""
echo "Writing config to $CONFIG_FILE..."
cat > "$CONFIG_FILE" << EOF
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $HOSTNAME
    service: $LOCAL_SERVICE
    originRequest:
      noTLSVerify: true
  - service: http_status:404
EOF

echo "Config written ✓"

# Step 5: Add DNS route
echo ""
echo "Adding DNS route: $HOSTNAME -> tunnel..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME" 2>/dev/null || echo "(DNS route may already exist — that's fine)"

# Step 6: Done — tell user how to run
echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the tunnel:"
echo "  cloudflared tunnel run $TUNNEL_NAME"
echo ""
echo "To run as a background service (starts on boot):"
echo "  sudo cloudflared service install"
echo "  sudo launchctl start com.cloudflare.cloudflared"
echo ""
echo "Your CC API will be available at: https://$HOSTNAME"
echo ""
echo "Test it with:"
echo "  curl https://$HOSTNAME/api/health"
