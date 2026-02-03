#!/bin/bash
#
# Nexus Command - Linux Agent Installer
# 
# Installs the Nexus Command agent as a systemd service on Linux servers.
# Supported: Debian, Ubuntu, CentOS, RHEL, Fedora
#
# Usage: curl -sSL https://your-nexuscommand-server/agents/linux/install.sh | sudo bash -s -- --server https://your-nexuscommand-server
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
AGENT_USER="nexusagent"
AGENT_HOME="/opt/nexuscommand-agent"
AGENT_SERVICE="nexuscommand-agent"
SERVER_URL=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        --uninstall)
            UNINSTALL=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

print_banner() {
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║           Nexus Command - Linux Agent Installer               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
    fi
}

detect_package_manager() {
    if command -v apt-get &> /dev/null; then
        PKG_MANAGER="apt"
    elif command -v yum &> /dev/null; then
        PKG_MANAGER="yum"
    elif command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
    else
        log_error "Unsupported package manager"
    fi
}

install_dependencies() {
    log_info "Installing dependencies..."
    
    case $PKG_MANAGER in
        apt)
            apt-get update -qq
            apt-get install -y -qq python3 python3-pip python3-venv smartmontools hdparm dmidecode > /dev/null 2>&1
            ;;
        yum|dnf)
            $PKG_MANAGER install -y -q python3 python3-pip smartmontools hdparm dmidecode > /dev/null 2>&1
            ;;
    esac
    
    log_success "Dependencies installed"
}

create_user() {
    log_info "Creating agent user..."
    
    if id "$AGENT_USER" &>/dev/null; then
        log_info "User $AGENT_USER already exists"
    else
        useradd -r -m -d "$AGENT_HOME" -s /bin/false "$AGENT_USER"
        log_success "User $AGENT_USER created"
    fi
}

install_agent() {
    log_info "Installing agent..."
    
    mkdir -p "$AGENT_HOME"
    
    # Copy agent script from the same directory or download
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$SCRIPT_DIR/agent.py" ]]; then
        cp "$SCRIPT_DIR/agent.py" "$AGENT_HOME/agent.py"
    else
        # Download agent from server
        curl -sSL "${SERVER_URL}/agents/linux/agent.py" -o "$AGENT_HOME/agent.py"
    fi

    chmod +x "$AGENT_HOME/agent.py"
    chown -R "$AGENT_USER:$AGENT_USER" "$AGENT_HOME"

    # Install Python dependencies
    pip3 install psutil requests > /dev/null 2>&1

    log_success "Agent installed"
}

create_service() {
    log_info "Creating systemd service..."
    
    cat > /etc/systemd/system/${AGENT_SERVICE}.service << EOF
[Unit]
Description=Nexus Command Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${AGENT_HOME}
ExecStart=/usr/bin/python3 ${AGENT_HOME}/agent.py --server ${SERVER_URL}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${AGENT_SERVICE} > /dev/null 2>&1
    systemctl start ${AGENT_SERVICE}
    
    log_success "Service created and started"
}

uninstall() {
    log_info "Uninstalling Nexus Command Agent..."
    
    systemctl stop ${AGENT_SERVICE} 2>/dev/null || true
    systemctl disable ${AGENT_SERVICE} 2>/dev/null || true
    rm -f /etc/systemd/system/${AGENT_SERVICE}.service
    systemctl daemon-reload
    
    rm -rf "$AGENT_HOME"
    userdel "$AGENT_USER" 2>/dev/null || true
    rm -f /var/log/nexuscommand-agent.log
    
    log_success "Agent uninstalled"
    exit 0
}

print_summary() {
    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║          Nexus Command Agent Installed Successfully!          ║"
    echo "╠═══════════════════════════════════════════════════════════════╣"
    echo "║                                                               ║"
    echo "║  The agent is now running and will automatically register    ║"
    echo "║  with the Nexus Command server.                              ║"
    echo "║                                                               ║"
    echo "║  Commands:                                                    ║"
    echo "║  - Status: systemctl status ${AGENT_SERVICE}                  ║"
    echo "║  - Logs:   journalctl -u ${AGENT_SERVICE} -f                  ║"
    echo "║  - Stop:   systemctl stop ${AGENT_SERVICE}                    ║"
    echo "║  - Start:  systemctl start ${AGENT_SERVICE}                   ║"
    echo "║                                                               ║"
    echo "║  To uninstall: Run this script with --uninstall               ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Main
main() {
    print_banner
    check_root
    
    if [[ "$UNINSTALL" == "true" ]]; then
        uninstall
    fi
    
    if [[ -z "$SERVER_URL" ]]; then
        log_error "Server URL required. Use: --server https://your-nexuscommand-server"
    fi
    
    detect_package_manager
    install_dependencies
    create_user
    install_agent
    create_service
    print_summary
}

main "$@"
