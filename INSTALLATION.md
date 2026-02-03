# Nexus Command - Installation Guide

## System Requirements

### Server (Central Management)
- **OS**: Debian 11/12, Ubuntu 20.04/22.04/24.04
- **RAM**: Minimum 2GB, Recommended 4GB
- **Storage**: Minimum 20GB
- **Ports**: 80 (HTTP), 443 (HTTPS), 22 (SSH)

### Monitored Servers (Agents)
- **Linux**: Debian, Ubuntu, CentOS, RHEL, Fedora
- **Windows**: Windows Server 2016/2019/2022, Windows 10/11

---

## Quick Install (Recommended)

### Central Server

```bash
# Download and run the installer
curl -sSL https://your-server/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

This will install:
- MongoDB 7.0
- Node.js 20 LTS
- Python 3.11
- Nginx (reverse proxy)
- Supervisor (process manager)
- UFW (firewall)

### Agent Installation

#### Linux Servers
```bash
curl -sSL https://your-nexuscommand-server/agents/linux/install.sh | sudo bash -s -- --server https://your-nexuscommand-server
```

#### Windows Servers
```powershell
# Run as Administrator
Invoke-WebRequest -Uri "https://your-nexuscommand-server/agents/windows/install.ps1" -OutFile install.ps1
.\install.ps1 -ServerUrl "https://your-nexuscommand-server"
```

---

## Manual Installation

### 1. Install Dependencies

#### Debian/Ubuntu
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y curl wget git gnupg lsb-release ca-certificates \
    apt-transport-https software-properties-common build-essential \
    nginx certbot python3-certbot-nginx supervisor ufw

# Install MongoDB 7.0
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn

# Install Python 3.11
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip
```

### 2. Clone Repository
```bash
sudo mkdir -p /opt/nexuscommand
cd /opt/nexuscommand
sudo git clone https://github.com/your-org/nexuscommand.git app
sudo chown -R $USER:$USER /opt/nexuscommand
```

### 3. Setup Backend
```bash
cd /opt/nexuscommand/app/backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=nexuscommand
JWT_SECRET=$(openssl rand -hex 32)
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
EOF

chmod 600 .env
```

### 4. Setup Frontend
```bash
cd /opt/nexuscommand/app/frontend

# Install dependencies
yarn install

# Create .env file
cat > .env << EOF
REACT_APP_BACKEND_URL=
EOF

# Build for production
yarn build
```

### 5. Configure Supervisor
```bash
sudo cat > /etc/supervisor/conf.d/nexuscommand.conf << EOF
[program:nexuscommand-backend]
command=/opt/nexuscommand/app/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
directory=/opt/nexuscommand/app/backend
user=root
autostart=true
autorestart=true
stderr_logfile=/var/log/nexuscommand/backend.err.log
stdout_logfile=/var/log/nexuscommand/backend.out.log
environment=PATH="/opt/nexuscommand/app/backend/venv/bin"
EOF

sudo mkdir -p /var/log/nexuscommand
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start nexuscommand-backend
```

### 6. Configure Nginx
```bash
sudo cat > /etc/nginx/sites-available/nexuscommand << 'EOF'
server {
    listen 80;
    server_name _;

    root /opt/nexuscommand/app/frontend/build;
    index index.html;

    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
EOF

sudo ln -sf /etc/nginx/sites-available/nexuscommand /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Configure Firewall
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### 8. Enable HTTPS (Optional but Recommended)
```bash
sudo certbot --nginx -d your-domain.com
```

---

## Post-Installation

### Default Login Credentials
After installation, check the backend logs for the auto-generated admin password:
```bash
grep "Password:" /var/log/nexuscommand/backend.out.log
```

**Default Email**: `admin@nexuscommand.local`

### First Steps
1. Log in with the default credentials
2. Change the admin password immediately
3. Configure SMTP settings for email alerts (Settings → SMTP Configuration)
4. Install agents on your servers
5. Add servers manually or wait for agents to register

---

## Troubleshooting

### Backend Not Starting
```bash
# Check logs
tail -f /var/log/nexuscommand/backend.err.log

# Check supervisor status
sudo supervisorctl status

# Restart backend
sudo supervisorctl restart nexuscommand-backend
```

### MongoDB Connection Issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

### Agent Not Connecting
```bash
# Linux: Check agent status
sudo systemctl status nexuscommand-agent
sudo journalctl -u nexuscommand-agent -f

# Windows (PowerShell as Admin)
Get-Service NexusCommandAgent
Get-Content "C:\Program Files\NexusCommand\Logs\agent.log" -Tail 50
```

### Nginx 502 Bad Gateway
```bash
# Ensure backend is running
sudo supervisorctl status nexuscommand-backend

# Check backend port
curl http://localhost:8001/api/health
```

---

## Updating

### Update Central Server
```bash
cd /opt/nexuscommand/app
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Update frontend
cd ../frontend
yarn install
yarn build

# Restart services
sudo supervisorctl restart nexuscommand-backend
sudo systemctl reload nginx
```

### Update Agents
Re-run the installation script on each agent with the `--update` flag (coming soon).

---

## Uninstallation

### Central Server
```bash
sudo supervisorctl stop nexuscommand-backend
sudo rm /etc/supervisor/conf.d/nexuscommand.conf
sudo rm /etc/nginx/sites-enabled/nexuscommand
sudo rm /etc/nginx/sites-available/nexuscommand
sudo systemctl reload nginx
sudo rm -rf /opt/nexuscommand
sudo rm -rf /var/log/nexuscommand

# Optional: Remove MongoDB data
sudo systemctl stop mongod
sudo apt remove mongodb-org -y
sudo rm -rf /var/lib/mongodb
```

### Linux Agent
```bash
sudo /opt/nexuscommand-agent/install.sh --uninstall
# or manually:
sudo systemctl stop nexuscommand-agent
sudo systemctl disable nexuscommand-agent
sudo rm /etc/systemd/system/nexuscommand-agent.service
sudo rm -rf /opt/nexuscommand-agent
```

### Windows Agent
```powershell
# Run as Administrator
.\install.ps1 -ServerUrl "https://your-server" -Uninstall
```
