#!/bin/bash
#
# Nexus Command - Server Management System
# Installation Script for Debian/Ubuntu
#
# This script installs and configures Nexus Command on a fresh server.
# Supported: Debian 11/12, Ubuntu 20.04/22.04/24.04
#
# Usage: curl -sSL https://your-server/install.sh | sudo bash
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NEXUS_USER="nexuscommand"
NEXUS_HOME="/opt/nexuscommand"
NEXUS_REPO="https://github.com/speckitime/ServerManagerWEB.git"
MONGODB_VERSION="7.0"
NODE_VERSION="20"
PYTHON_VERSION="3.11"

# Functions
print_banner() {
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║     ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗              ║"
    echo "║     ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝              ║"
    echo "║     ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗              ║"
    echo "║     ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║              ║"
    echo "║     ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║              ║"
    echo "║     ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝              ║"
    echo "║                      COMMAND                                  ║"
    echo "║         Server Management System - Installer                  ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root. Use: sudo bash install.sh"
    fi
}

check_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        log_error "Cannot detect OS. This script supports Debian and Ubuntu only."
    fi

    if [[ "$OS" != "debian" && "$OS" != "ubuntu" ]]; then
        log_error "Unsupported OS: $OS. This script supports Debian and Ubuntu only."
    fi

    log_info "Detected OS: $OS $VERSION"
}

install_dependencies() {
    log_info "Installing system dependencies..."
    
    apt-get update -qq
    apt-get install -y -qq \
        curl \
        wget \
        git \
        gnupg \
        lsb-release \
        ca-certificates \
        apt-transport-https \
        software-properties-common \
        build-essential \
        nginx \
        certbot \
        python3-certbot-nginx \
        supervisor \
        ufw \
        > /dev/null 2>&1

    log_success "System dependencies installed"
}

install_mongodb() {
    log_info "Installing MongoDB ${MONGODB_VERSION}..."

    # Import MongoDB GPG key
    curl -fsSL https://pgp.mongodb.com/server-${MONGODB_VERSION}.asc | \
        gpg --dearmor -o /usr/share/keyrings/mongodb-server-${MONGODB_VERSION}.gpg

    # Add MongoDB repository
    if [[ "$OS" == "ubuntu" ]]; then
        echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-${MONGODB_VERSION}.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/${MONGODB_VERSION} multiverse" | \
            tee /etc/apt/sources.list.d/mongodb-org-${MONGODB_VERSION}.list > /dev/null
    else
        echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-${MONGODB_VERSION}.gpg ] https://repo.mongodb.org/apt/debian $(lsb_release -cs)/mongodb-org/${MONGODB_VERSION} main" | \
            tee /etc/apt/sources.list.d/mongodb-org-${MONGODB_VERSION}.list > /dev/null
    fi

    apt-get update -qq
    apt-get install -y -qq mongodb-org > /dev/null 2>&1

    # Start and enable MongoDB
    systemctl start mongod
    systemctl enable mongod

    log_success "MongoDB ${MONGODB_VERSION} installed and started"
}

install_nodejs() {
    log_info "Installing Node.js ${NODE_VERSION}..."

    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1

    # Install Yarn
    npm install -g yarn > /dev/null 2>&1

    log_success "Node.js $(node --version) and Yarn installed"
}

install_python() {
    log_info "Installing Python ${PYTHON_VERSION}..."

    apt-get install -y -qq \
        python${PYTHON_VERSION} \
        python${PYTHON_VERSION}-venv \
        python${PYTHON_VERSION}-dev \
        python3-pip \
        > /dev/null 2>&1

    # Set as default python3
    update-alternatives --install /usr/bin/python3 python3 /usr/bin/python${PYTHON_VERSION} 1 > /dev/null 2>&1

    log_success "Python $(python3 --version) installed"
}

create_user() {
    log_info "Creating nexuscommand user..."

    if id "$NEXUS_USER" &>/dev/null; then
        log_warning "User $NEXUS_USER already exists"
    else
        useradd -r -m -d "$NEXUS_HOME" -s /bin/bash "$NEXUS_USER"
        log_success "User $NEXUS_USER created"
    fi
}

clone_repository() {
    log_info "Setting up Nexus Command..."

    if [[ -d "$NEXUS_HOME/app" ]]; then
        log_warning "Application directory already exists. Updating..."
        cd "$NEXUS_HOME/app"
        git pull origin main > /dev/null 2>&1 || true
    else
        mkdir -p "$NEXUS_HOME"
        cd "$NEXUS_HOME"
        git clone "$NEXUS_REPO" app
    fi

    chown -R "$NEXUS_USER:$NEXUS_USER" "$NEXUS_HOME"
    log_success "Application files installed"
}

setup_backend() {
    log_info "Setting up backend..."

    cd "$NEXUS_HOME/app/backend"

    # Create virtual environment
    sudo -u "$NEXUS_USER" python3 -m venv venv

    # Install dependencies
    sudo -u "$NEXUS_USER" ./venv/bin/pip install --upgrade pip > /dev/null 2>&1
    sudo -u "$NEXUS_USER" ./venv/bin/pip install -r requirements.txt > /dev/null 2>&1

    # Create .env file
    ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
    JWT_SECRET=$(openssl rand -hex 32)

    cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=nexuscommand
JWT_SECRET=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
EOF

    chown "$NEXUS_USER:$NEXUS_USER" .env
    chmod 600 .env

    log_success "Backend configured"
}

setup_frontend() {
    log_info "Setting up frontend..."

    cd "$NEXUS_HOME/app/frontend"

    # Install dependencies
    sudo -u "$NEXUS_USER" yarn install > /dev/null 2>&1

    # Create .env file
    cat > .env << EOF
REACT_APP_BACKEND_URL=
EOF

    # Build frontend
    sudo -u "$NEXUS_USER" yarn build > /dev/null 2>&1

    chown -R "$NEXUS_USER:$NEXUS_USER" "$NEXUS_HOME/app/frontend"

    log_success "Frontend built"
}

configure_supervisor() {
    log_info "Configuring Supervisor..."

    cat > /etc/supervisor/conf.d/nexuscommand.conf << EOF
[program:nexuscommand-backend]
command=${NEXUS_HOME}/app/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
directory=${NEXUS_HOME}/app/backend
user=${NEXUS_USER}
autostart=true
autorestart=true
stderr_logfile=/var/log/nexuscommand/backend.err.log
stdout_logfile=/var/log/nexuscommand/backend.out.log
environment=PATH="${NEXUS_HOME}/app/backend/venv/bin"
EOF

    # Create log directory
    mkdir -p /var/log/nexuscommand
    chown -R "$NEXUS_USER:$NEXUS_USER" /var/log/nexuscommand

    # Reload supervisor
    supervisorctl reread > /dev/null 2>&1
    supervisorctl update > /dev/null 2>&1
    supervisorctl start nexuscommand-backend > /dev/null 2>&1

    log_success "Supervisor configured"
}

configure_nginx() {
    log_info "Configuring Nginx..."

    # Get server IP or hostname
    SERVER_IP=$(hostname -I | awk '{print $1}')

    cat > /etc/nginx/sites-available/nexuscommand << EOF
server {
    listen 80;
    server_name ${SERVER_IP} _;

    # Frontend (React build)
    root ${NEXUS_HOME}/app/frontend/build;
    index index.html;

    # API Proxy
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    # WebSocket for SSH
    location /api/ws {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    # React Router - serve index.html for all other routes
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/nexuscommand /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    # Test and reload
    nginx -t > /dev/null 2>&1
    systemctl reload nginx

    log_success "Nginx configured"
}

configure_firewall() {
    log_info "Configuring firewall..."

    ufw --force reset > /dev/null 2>&1
    ufw default deny incoming > /dev/null 2>&1
    ufw default allow outgoing > /dev/null 2>&1
    ufw allow ssh > /dev/null 2>&1
    ufw allow 80/tcp > /dev/null 2>&1
    ufw allow 443/tcp > /dev/null 2>&1
    ufw --force enable > /dev/null 2>&1

    log_success "Firewall configured (ports 22, 80, 443 open)"
}

print_summary() {
    # Get admin password from backend logs
    sleep 3
    ADMIN_PASS=$(grep -o 'Password: [^"]*' /var/log/nexuscommand/backend.out.log 2>/dev/null | tail -1 | cut -d' ' -f2 || echo "Check logs")
    SERVER_IP=$(hostname -I | awk '{print $1}')

    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                 INSTALLATION COMPLETE!                        ║"
    echo "╠═══════════════════════════════════════════════════════════════╣"
    echo "║                                                               ║"
    echo "║  Access Nexus Command at:                                     ║"
    echo "║  http://${SERVER_IP}                                          ║"
    echo "║                                                               ║"
    echo "║  Default Admin Credentials:                                   ║"
    echo "║  Email: admin@nexuscommand.local                              ║"
    echo "║  Password: ${ADMIN_PASS}                                      ║"
    echo "║                                                               ║"
    echo "║  IMPORTANT: Change the admin password after first login!      ║"
    echo "║                                                               ║"
    echo "╠═══════════════════════════════════════════════════════════════╣"
    echo "║  Useful Commands:                                             ║"
    echo "║  - View backend logs: tail -f /var/log/nexuscommand/*.log     ║"
    echo "║  - Restart backend: supervisorctl restart nexuscommand-backend║"
    echo "║  - Nginx status: systemctl status nginx                       ║"
    echo "║  - MongoDB status: systemctl status mongod                    ║"
    echo "║                                                               ║"
    echo "║  To enable HTTPS, run:                                        ║"
    echo "║  certbot --nginx -d your-domain.com                           ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Main installation flow
main() {
    print_banner
    
    log_info "Starting Nexus Command installation..."
    echo ""

    check_root
    check_os
    
    install_dependencies
    install_mongodb
    install_nodejs
    install_python
    
    create_user
    clone_repository
    
    setup_backend
    setup_frontend
    
    configure_supervisor
    configure_nginx
    configure_firewall
    
    print_summary
}

# Run main function
main "$@"
