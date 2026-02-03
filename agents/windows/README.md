# Nexus Command Windows Agent

## Requirements
- Windows 10/11 or Windows Server 2016+
- Python 3.8+ (will be installed automatically if missing)
- Administrator privileges for installation
- Network connectivity to Nexus Command server

## Installation

### Quick Install (PowerShell as Administrator)
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
Invoke-WebRequest -Uri https://your-server/agents/windows/install.ps1 | Invoke-Expression
```

### Manual Install
1. Install Python 3.8+ from python.org
2. Install dependencies:
```powershell
pip install psutil requests
```

3. Copy agent files to C:\Program Files\ServerManager\
4. Create config file:
```ini
[server]
api_url = https://your-server.com
api_key = your-api-key
```

5. Register agent:
```powershell
python agent.py register https://your-server.com
```

6. Create Windows service or run directly

## Usage

### View metrics
```powershell
python agent.py metrics
```

### Check for updates
```powershell
python agent.py updates
```

### List programs
```powershell
python agent.py packages
```

## Troubleshooting

View logs:
```powershell
Get-Content "C:\Program Files\ServerManager\agent.log" -Tail 50
```

Check service:
```powershell
Get-Service NexusCommandAgent
```

Restart service:
```powershell
Restart-Service NexusCommandAgent
```
