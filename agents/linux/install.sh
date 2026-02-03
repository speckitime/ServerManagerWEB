#!/bin/bash
#
# Nexus Command - Linux Agent Installation Script
# Supports: Debian 11/12, Ubuntu 20.04/22.04/24.04, RHEL/CentOS 8/9
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "  _   _                      ____                                          _ "
echo " | \ | | _____  ___   _ ___ / ___|___  _ __ ___  _ __ ___   __ _ _ __   __| |"
echo " |  \| |/ _ \ \/ / | | / __| |   / _ \| '_ \` _ \| '_ \` _ \ / _\` | '_ \ / _\` |"
echo " | |\  |  __/>  <| |_| \__ \ |__| (_) | | | | | | | | | | | (_| | | | | (_| |"
echo " |_| \_|\___/_/\_\\__,_|___/\____\___/|_| |_| |_|_| |_| |_|\__,_|_| |_|\__,_|"
echo -e "${NC}"
echo "Linux Agent Installation Script"
echo "================================"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root (sudo)${NC}"
    exit 1
fi

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    elif [ -f /etc/debian_version ]; then
        OS="debian"
        VERSION=$(cat /etc/debian_version)
    elif [ -f /etc/redhat-release ]; then
        OS="rhel"
        VERSION=$(cat /etc/redhat-release | sed 's/.*release \([0-9]*\).*/\1/')
    else
        echo -e "${RED}Error: Unsupported operating system${NC}"
        exit 1
    fi
    echo -e "${GREEN}Detected OS: $OS $VERSION${NC}"
}

# Install dependencies
install_dependencies() {
    echo -e "${YELLOW}Installing dependencies...${NC}"
    
    case $OS in
        ubuntu|debian)
            apt-get update -qq
            apt-get install -y -qq python3 python3-pip curl
            ;;
        centos|rhel|rocky|almalinux)
            yum install -y -q python3 python3-pip curl
            ;;
        fedora)
            dnf install -y -q python3 python3-pip curl
            ;;
        *)
            echo -e "${RED}Unsupported OS: $OS${NC}"
            exit 1
            ;;
    esac
    
    # Install Python packages
    pip3 install -q psutil requests
    echo -e "${GREEN}Dependencies installed${NC}"
}

# Create directories
create_directories() {
    echo -e "${YELLOW}Creating directories...${NC}"
    mkdir -p /opt/servermanager
    mkdir -p /etc/servermanager
    mkdir -p /var/log
}

# Copy agent files
copy_files() {
    echo -e "${YELLOW}Copying agent files...${NC}"
    
    # If running from repo directory
    if [ -f "./agent.py" ]; then
        cp ./agent.py /opt/servermanager/agent.py
    # If downloaded directly
    elif [ -f "/tmp/agent.py" ]; then
        cp /tmp/agent.py /opt/servermanager/agent.py
    else
        echo -e "${YELLOW}Downloading agent...${NC}"
        curl -sSL "${API_URL}/agents/linux/agent.py" -o /opt/servermanager/agent.py
    fi
    
    chmod +x /opt/servermanager/agent.py
    echo -e "${GREEN}Agent files copied${NC}"
}

# Configure agent
configure_agent() {
    echo -e "${YELLOW}Configuring agent...${NC}"
    
    # Get API URL if not set
    if [ -z "$API_URL" ]; then
        read -p "Enter Nexus Command API URL (e.g., https://your-server.com): " API_URL
    fi
    
    # Get API key if not set
    if [ -z "$API_KEY" ]; then
        read -p "Enter API Key (leave blank to auto-register): " API_KEY
    fi
    
    # Create config file
    cat > /etc/servermanager/agent.conf << EOF
[server]
api_url = $API_URL
api_key = $API_KEY
EOF
    
    chmod 600 /etc/servermanager/agent.conf
    echo -e "${GREEN}Configuration saved${NC}"
}

# Create systemd service
create_service() {
    echo -e "${YELLOW}Creating systemd service...${NC}"
    
    cat > /etc/systemd/system/servermanager-agent.service << 'EOF'
[Unit]
Description=Nexus Command Server Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/servermanager/agent.py
Restart=always
RestartSec=10
User=root
WorkingDirectory=/opt/servermanager

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable servermanager-agent
    systemctl start servermanager-agent
    
    echo -e "${GREEN}Service created and started${NC}"
}

# Test connectivity
test_connection() {
    echo -e "${YELLOW}Testing connection...${NC}"
    
    if python3 /opt/servermanager/agent.py metrics > /dev/null 2>&1; then
        echo -e "${GREEN}Agent is working correctly${NC}"
    else
        echo -e "${YELLOW}Warning: Could not verify agent functionality${NC}"
    fi
}

# Main installation
main() {
    detect_os
    install_dependencies
    create_directories
    copy_files
    configure_agent
    create_service
    test_connection
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Installation Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Agent Status:"
    systemctl status servermanager-agent --no-pager
    echo ""
    echo "Useful commands:"
    echo "  View logs:    journalctl -u servermanager-agent -f"
    echo "  Restart:      systemctl restart servermanager-agent"
    echo "  Stop:         systemctl stop servermanager-agent"
    echo ""
}

main
