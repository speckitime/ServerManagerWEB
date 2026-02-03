#!/bin/bash
#
# Nexus Command - Server Management System
# Installation Script for Debian/Ubuntu
#
# Usage: curl -sSL https://raw.githubusercontent.com/speckitime/ServerManagerWEB/main/install.sh | sudo bash
#

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
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root. Use: sudo bash install.sh"
        exit 1
    fi
}

check_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
        CODENAME=$VERSION_CODENAME
    else
        log_error "Cannot detect OS. This script supports Debian and Ubuntu only."
        exit 1
    fi

    if [[ "$OS" != "debian" && "$OS" != "ubuntu" ]]; then
        log_error "Unsupported OS: $OS. This script supports Debian and Ubuntu only."
        exit 1
    fi

    log_info "Detected OS: $OS $VERSION ($CODENAME)"
}

install_dependencies() {
    log_info "Installing system dependencies..."
    
    export DEBIAN_FRONTEND=noninteractive
    
    apt-get update
    if [[ $? -ne 0 ]]; then
        log_error "apt-get update failed"
        exit 1
    fi
    
    apt-get install -y \
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
        supervisor \
        ufw \
        openssl
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to install dependencies"
        exit 1
    fi

    log_success "System dependencies installed"
}

install_mongodb() {
    log_info "Installing MongoDB ${MONGODB_VERSION}..."

    # Check if MongoDB is already installed
    if command -v mongod &> /dev/null; then
        log_warning "MongoDB is already installed"
        systemctl start mongod || true
        systemctl enable mongod || true
        return
    fi

    # Import MongoDB GPG key
    curl -fsSL https://www.mongodb.org/static/pgp/server-${MONGODB_VERSION}.asc | \
        gpg --dearmor -o /usr/share/keyrings/mongodb-server-${MONGODB_VERSION}.gpg
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to import MongoDB GPG key"
        exit 1
    fi

    # Add MongoDB repository based on Ubuntu version
    # Ubuntu 24.04 (noble) might need jammy repo as fallback
    if [[ "$OS" == "ubuntu" ]]; then
        # For Ubuntu 24.04, use jammy (22.04) repo as MongoDB might not have noble yet
        if [[ "$CODENAME" == "noble" ]]; then
            MONGO_CODENAME="jammy"
            log_info "Using MongoDB repository for Ubuntu 22.04 (jammy) on Ubuntu 24.04"
        else
            MONGO_CODENAME="$CODENAME"
        fi
        echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-${MONGODB_VERSION}.gpg ] https://repo.mongodb.org/apt/ubuntu ${MONGO_CODENAME}/mongodb-org/${MONGODB_VERSION} multiverse" | \
            tee /etc/apt/sources.list.d/mongodb-org-${MONGODB_VERSION}.list
    else
        echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-${MONGODB_VERSION}.gpg ] https://repo.mongodb.org/apt/debian ${CODENAME}/mongodb-org/${MONGODB_VERSION} main" | \
            tee /etc/apt/sources.list.d/mongodb-org-${MONGODB_VERSION}.list
    fi

    apt-get update
    apt-get install -y mongodb-org
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to install MongoDB"
        exit 1
    fi

    # Start and enable MongoDB
    systemctl start mongod
    systemctl enable mongod
    
    # Wait for MongoDB to start
    sleep 3
    
    if systemctl is-active --quiet mongod; then
        log_success "MongoDB ${MONGODB_VERSION} installed and running"
    else
        log_warning "MongoDB installed but may not be running. Check: systemctl status mongod"
    fi
}

install_nodejs() {
    log_info "Installing Node.js ${NODE_VERSION}..."

    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        CURRENT_NODE=$(node --version)
        log_warning "Node.js is already installed: $CURRENT_NODE"
    fi

    # Install Node.js using NodeSource
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to setup Node.js repository"
        exit 1
    fi
    
    apt-get install -y nodejs
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to install Node.js"
        exit 1
    fi

    # Install Yarn
    npm install -g yarn
    
    log_success "Node.js $(node --version) and Yarn installed"
}

install_python() {
    log_info "Checking Python installation..."

    # Ubuntu 24.04 comes with Python 3.12
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version)
        log_info "Found: $PYTHON_VERSION"
    fi

    # Install pip and venv
    apt-get install -y python3-pip python3-venv python3-dev
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to install Python packages"
        exit 1
    fi

    log_success "Python $(python3 --version) ready"
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
    log_info "Cloning Nexus Command repository..."

    if [[ -d "$NEXUS_HOME/app" ]]; then
        log_warning "Application directory already exists. Updating..."
        cd "$NEXUS_HOME/app"
        git pull origin main || true
    else
        mkdir -p "$NEXUS_HOME"
        cd "$NEXUS_HOME"
        git clone "$NEXUS_REPO" app
        
        if [[ $? -ne 0 ]]; then
            log_error "Failed to clone repository from $NEXUS_REPO"
            exit 1
        fi
    fi

    chown -R "$NEXUS_USER:$NEXUS_USER" "$NEXUS_HOME"
    log_success "Repository cloned to $NEXUS_HOME/app"
}

setup_backend() {
    log_info "Setting up backend..."

    cd "$NEXUS_HOME/app/backend"

    # Create virtual environment
    python3 -m venv venv
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to create Python virtual environment"
        exit 1
    fi

    # Activate and install dependencies
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to install Python dependencies"
        exit 1
    fi
    
    deactivate

    # Create .env file
    JWT_SECRET=$(openssl rand -hex 32)

    cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=nexuscommand
JWT_SECRET=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
EOF

    chown -R "$NEXUS_USER:$NEXUS_USER" "$NEXUS_HOME/app/backend"
    chmod 600 .env

    log_success "Backend configured"
}

setup_frontend() {
    log_info "Setting up frontend (this may take a few minutes)..."

    cd "$NEXUS_HOME/app/frontend"

    # Create .env file
    cat > .env << EOF
REACT_APP_BACKEND_URL=
EOF

    # Install dependencies
    yarn install
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to install frontend dependencies"
        exit 1
    fi

    # Build frontend
    yarn build
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to build frontend"
        exit 1
    fi

    chown -R "$NEXUS_USER:$NEXUS_USER" "$NEXUS_HOME/app/frontend"

    log_success "Frontend built"
}

configure_supervisor() {
    log_info "Configuring Supervisor..."

    # Create log directory
    mkdir -p /var/log/nexuscommand
    chown -R "$NEXUS_USER:$NEXUS_USER" /var/log/nexuscommand

    cat > /etc/supervisor/conf.d/nexuscommand.conf << EOF
[program:nexuscommand-backend]
command=${NEXUS_HOME}/app/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
directory=${NEXUS_HOME}/app/backend
user=root
autostart=true
autorestart=true
stderr_logfile=/var/log/nexuscommand/backend.err.log
stdout_logfile=/var/log/nexuscommand/backend.out.log
environment=PATH="${NEXUS_HOME}/app/backend/venv/bin"
EOF

    # Reload supervisor
    supervisorctl reread
    supervisorctl update
    
    # Wait a moment then start
    sleep 2
    supervisorctl start nexuscommand-backend || true

    log_success "Supervisor configured"
}

configure_nginx() {
    log_info "Configuring Nginx..."

    # Get server IP
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

    # WebSocket for SSH Terminal
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
    nginx -t
    if [[ $? -ne 0 ]]; then
        log_error "Nginx configuration test failed"
        exit 1
    fi
    
    systemctl reload nginx
    systemctl enable nginx

    log_success "Nginx configured"
}

configure_firewall() {
    log_info "Configuring firewall..."

    # Check if UFW is available
    if ! command -v ufw &> /dev/null; then
        log_warning "UFW not found, skipping firewall configuration"
        return
    fi

    ufw --force reset > /dev/null 2>&1 || true
    ufw default deny incoming > /dev/null 2>&1
    ufw default allow outgoing > /dev/null 2>&1
    ufw allow ssh > /dev/null 2>&1
    ufw allow 80/tcp > /dev/null 2>&1
    ufw allow 443/tcp > /dev/null 2>&1
    ufw --force enable > /dev/null 2>&1

    log_success "Firewall configured (ports 22, 80, 443 open)"
}

print_summary() {
    # Wait for backend to start and get password
    sleep 5
    
    ADMIN_PASS=$(grep -o 'Password: [^"]*' /var/log/nexuscommand/backend.out.log 2>/dev/null | tail -1 | cut -d' ' -f2)
    if [[ -z "$ADMIN_PASS" ]]; then
        ADMIN_PASS="Check /var/log/nexuscommand/backend.out.log"
    fi
    
    SERVER_IP=$(hostname -I | awk '{print $1}')

    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                 INSTALLATION COMPLETE!                        ║"
    echo "╠═══════════════════════════════════════════════════════════════╣"
    echo "║                                                               ║"
    echo "║  Access Nexus Command at:                                     ║"
    echo "║  http://${SERVER_IP}                                          "
    echo "║                                                               ║"
    echo "║  Default Admin Credentials:                                   ║"
    echo "║  Email: admin@nexuscommand.local                              ║"
    echo "║  Password: ${ADMIN_PASS}                                      "
    echo "║                                                               ║"
    echo "║  IMPORTANT: Change the admin password after first login!      ║"
    echo "║                                                               ║"
    echo "╠═══════════════════════════════════════════════════════════════╣"
    echo "║  Useful Commands:                                             ║"
    echo "║  - View logs: tail -f /var/log/nexuscommand/*.log             ║"
    echo "║  - Restart:   supervisorctl restart nexuscommand-backend      ║"
    echo "║  - Status:    supervisorctl status                            ║"
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
