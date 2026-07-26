#!/usr/bin/env bash
set -e

# ── Cerebro Installer ──
# One-command install:  curl -fsSL https://raw.githubusercontent.com/wanieldd/cerebro/main/install.sh | bash

REPO="https://github.com/wanieldd/cerebro.git"
INSTALL_DIR="${CEREBRO_DIR:-$HOME/cerebro}"
BRANCH="main"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Cerebro AI Chat - Installer     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}[1/6]${NC} Checking prerequisites..."

command -v git >/dev/null 2>&1 || { echo -e "${RED}git is required but not installed.${NC}"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo -e "${RED}python3 is required but not installed.${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}node is required but not installed.${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required but not installed.${NC}"; exit 1; }

# Check for uv (preferred) or pip
UV=""
if command -v uv >/dev/null 2>&1; then
    UV="uv"
    echo -e "  ${GREEN}✓${NC} git, python3, node, npm, uv"
else
    echo -e "  ${YELLOW}⚠${NC} git, python3, node, npm (uv not found, using uvx)"
fi

# Clone or update
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}[2/6]${NC} Updating existing installation at $INSTALL_DIR..."
    cd "$INSTALL_DIR"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
else
    echo -e "${YELLOW}[2/6]${NC} Cloning Cerebro to $INSTALL_DIR..."
    git clone --depth 1 --branch "$BRANCH" "$REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Setup backend
echo -e "${YELLOW}[3/6]${NC} Setting up Python backend..."
cd "$INSTALL_DIR/backend"
if [ -n "$UV" ]; then
    uv sync
else
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
fi

# Setup frontend
echo -e "${YELLOW}[4/6]${NC} Building frontend..."
cd "$INSTALL_DIR/frontend"
npm install --silent
npm run build

# Create data dir
mkdir -p "$INSTALL_DIR/backend/data"

# Make launch script executable
chmod +x "$INSTALL_DIR/launch.py" 2>/dev/null || true

# Create update script
echo -e "${YELLOW}[5/6]${NC} Creating update command..."
cat > "$INSTALL_DIR/cerebro-update" << 'UEOF'
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Updating Cerebro..."
cd "$DIR"
git fetch origin main
git reset --hard origin/main
cd frontend
npm install --silent
npm run build
echo "Update complete! Restart the server to apply."
UEOF
chmod +x "$INSTALL_DIR/cerebro-update"

echo -e "${YELLOW}[6/6]${NC} Done!"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Cerebro installed at:               ║${NC}"
echo -e "${GREEN}║  $INSTALL_DIR        ║${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}║  Start:  python3 launch.py            ║${NC}"
echo -e "${GREEN}║  Update: ./cerebro-update             ║${NC}"
echo -e "${GREEN}║  Web:    http://localhost:3333        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
