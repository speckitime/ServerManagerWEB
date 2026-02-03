# Nexus Command Linux Agent

## Requirements
- Python 3.8+
- Root privileges for installation
- Network connectivity to Nexus Command server

## Supported Systems
- Debian 11/12
- Ubuntu 20.04/22.04/24.04
- RHEL/CentOS 8/9
- Rocky Linux / AlmaLinux

## Installation

### Quick Install
```bash
curl -sSL https://your-server/agents/linux/install.sh | sudo bash
```

### Manual Install
1. Install dependencies:
```bash
pip3 install psutil requests
```

2. Copy agent to /opt/servermanager/:
```bash
sudo mkdir -p /opt/servermanager
sudo cp agent.py /opt/servermanager/
```

3. Create config file:
```bash
sudo mkdir -p /etc/servermanager
sudo cat > /etc/servermanager/agent.conf << EOF
[server]
api_url = https://your-server.com
api_key = your-api-key
EOF
```

4. Register agent:
```bash
sudo python3 /opt/servermanager/agent.py register https://your-server.com
```

5. Start agent:
```bash
sudo python3 /opt/servermanager/agent.py
```

## Usage

### Run as service
```bash
sudo systemctl start servermanager-agent
sudo systemctl enable servermanager-agent
```

### View metrics
```bash
python3 agent.py metrics
```

### Check for updates
```bash
python3 agent.py updates
```

### List packages
```bash
python3 agent.py packages
```

## Troubleshooting

View logs:
```bash
journalctl -u servermanager-agent -f
```

Check config:
```bash
cat /etc/servermanager/agent.conf
```
