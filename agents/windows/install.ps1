#
# Nexus Command - Windows Agent Installer
# 
# Installs the Nexus Command agent as a Windows Service.
#
# Usage (PowerShell as Administrator):
# Invoke-WebRequest -Uri https://your-nexuscommand-server/agents/windows/install.ps1 -OutFile install.ps1
# .\install.ps1 -ServerUrl "https://your-nexuscommand-server"
#

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerUrl,
    
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

# Configuration
$AgentName = "NexusCommandAgent"
$AgentDisplayName = "Nexus Command Agent"
$AgentPath = "C:\Program Files\NexusCommand\Agent"
$AgentScript = "$AgentPath\agent.py"
$LogPath = "C:\Program Files\NexusCommand\Logs"

function Write-Banner {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║           Nexus Command - Windows Agent Installer             ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

function Test-Admin {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Install-Python {
    Write-Info "Checking Python installation..."
    
    try {
        $pythonVersion = python --version 2>&1
        Write-Info "Found Python: $pythonVersion"
    }
    catch {
        Write-Info "Python not found. Installing Python..."
        
        $pythonInstaller = "$env:TEMP\python-installer.exe"
        Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.11.0/python-3.11.0-amd64.exe" -OutFile $pythonInstaller
        
        Start-Process -FilePath $pythonInstaller -ArgumentList "/quiet", "InstallAllUsers=1", "PrependPath=1" -Wait
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        Remove-Item $pythonInstaller -Force
        Write-Success "Python installed"
    }
    
    # Install required packages
    Write-Info "Installing Python packages..."
    pip install psutil requests pywin32 2>&1 | Out-Null
    Write-Success "Python packages installed"
}

function Install-Agent {
    Write-Info "Installing Nexus Command Agent..."
    
    # Create directories
    New-Item -ItemType Directory -Path $AgentPath -Force | Out-Null
    New-Item -ItemType Directory -Path $LogPath -Force | Out-Null
    
    # Create agent script
    $agentScript = @'
#!/usr/bin/env python3
"""
Nexus Command Windows Agent
Collects system metrics and sends them to the central server.
"""

import os
import sys
import json
import time
import socket
import platform
import subprocess
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

# Configure logging
log_path = r"C:\Program Files\NexusCommand\Logs\agent.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(log_path)
    ]
)
logger = logging.getLogger(__name__)

try:
    import psutil
except ImportError:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'psutil'])
    import psutil

try:
    import requests
except ImportError:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'requests'])
    import requests

try:
    import wmi
except ImportError:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'wmi'])
    import wmi


class NexusAgent:
    def __init__(self, server_url: str, api_key: Optional[str] = None):
        self.server_url = server_url.rstrip('/')
        self.api_key = api_key
        self.hostname = socket.gethostname()
        self.interval = 30
        self.wmi = wmi.WMI()
        
    def get_ip_address(self) -> str:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def get_os_info(self) -> Dict[str, str]:
        return {
            "type": "windows",
            "version": f"{platform.system()} {platform.release()} {platform.version()}"
        }
    
    def get_cpu_info(self) -> Dict[str, Any]:
        try:
            cpu = self.wmi.Win32_Processor()[0]
            return {
                "model": cpu.Name,
                "cores": int(cpu.NumberOfCores),
                "threads": int(cpu.NumberOfLogicalProcessors),
                "frequency_mhz": int(cpu.MaxClockSpeed)
            }
        except Exception as e:
            logger.warning(f"Failed to get CPU info: {e}")
            return {}
    
    def get_memory_info(self) -> Dict[str, Any]:
        mem = psutil.virtual_memory()
        
        slots = []
        try:
            for mem_module in self.wmi.Win32_PhysicalMemory():
                slots.append({
                    "slot": mem_module.DeviceLocator,
                    "size": f"{int(mem_module.Capacity) // (1024**3)} GB",
                    "manufacturer": mem_module.Manufacturer,
                    "speed": f"{mem_module.Speed} MHz" if mem_module.Speed else "Unknown"
                })
        except:
            pass
        
        return {
            "total_bytes": mem.total,
            "used_bytes": mem.used,
            "percent": mem.percent,
            "slots": slots
        }
    
    def get_disk_info(self) -> List[Dict[str, Any]]:
        disks = []
        
        for partition in psutil.disk_partitions():
            try:
                if 'cdrom' in partition.opts or partition.fstype == '':
                    continue
                    
                usage = psutil.disk_usage(partition.mountpoint)
                
                disk_info = {
                    "device": partition.device,
                    "mountpoint": partition.mountpoint,
                    "fstype": partition.fstype,
                    "total_bytes": usage.total,
                    "used_bytes": usage.used,
                    "free_bytes": usage.free,
                    "percent": usage.percent
                }
                
                # Get disk model and serial via WMI
                try:
                    drive_letter = partition.device.rstrip('\\')
                    for disk in self.wmi.Win32_LogicalDisk(DeviceID=drive_letter):
                        disk_info['volume_name'] = disk.VolumeName
                except:
                    pass
                
                disks.append(disk_info)
            except Exception as e:
                logger.debug(f"Failed to get disk info: {e}")
        
        return disks
    
    def get_network_info(self) -> Dict[str, Any]:
        net = psutil.net_io_counters()
        
        interfaces = []
        for name, addrs in psutil.net_if_addrs().items():
            if 'Loopback' in name:
                continue
            iface = {"name": name}
            for addr in addrs:
                if addr.family == socket.AF_INET:
                    iface['ip'] = addr.address
            if 'ip' in iface:
                interfaces.append(iface)
        
        return {
            "bytes_sent": net.bytes_sent,
            "bytes_recv": net.bytes_recv,
            "packets_sent": net.packets_sent,
            "packets_recv": net.packets_recv,
            "interfaces": interfaces
        }
    
    def get_processes(self) -> List[Dict[str, Any]]:
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status']):
            try:
                pinfo = proc.info
                processes.append({
                    "pid": pinfo['pid'],
                    "name": pinfo['name'],
                    "cpu_percent": pinfo['cpu_percent'],
                    "memory_percent": pinfo['memory_percent'],
                    "status": pinfo['status']
                })
            except:
                pass
        
        processes.sort(key=lambda x: x['cpu_percent'] or 0, reverse=True)
        return processes[:20]
    
    def collect_metrics(self) -> Dict[str, Any]:
        cpu_info = self.get_cpu_info()
        mem_info = self.get_memory_info()
        disk_info = self.get_disk_info()
        net_info = self.get_network_info()
        
        total_disk = sum(d.get('total_bytes', 0) for d in disk_info)
        used_disk = sum(d.get('used_bytes', 0) for d in disk_info)
        disk_percent = (used_disk / total_disk * 100) if total_disk > 0 else 0
        
        return {
            "server_id": "",
            "hostname": self.hostname,
            "ip_address": self.get_ip_address(),
            "cpu_percent": psutil.cpu_percent(interval=1),
            "memory_percent": mem_info['percent'],
            "memory_used": mem_info['used_bytes'],
            "memory_total": mem_info['total_bytes'],
            "disk_percent": disk_percent,
            "disk_used": used_disk,
            "disk_total": total_disk,
            "network_bytes_sent": net_info['bytes_sent'],
            "network_bytes_recv": net_info['bytes_recv'],
            "processes": self.get_processes(),
            "disks": disk_info,
            "hardware": {
                "cpu": cpu_info,
                "memory": mem_info,
                "network_interfaces": net_info['interfaces']
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    def register(self) -> bool:
        try:
            os_info = self.get_os_info()
            data = {
                "hostname": self.hostname,
                "ip_address": self.get_ip_address(),
                "os_type": os_info['type'],
                "os_version": os_info['version']
            }
            
            response = requests.post(
                f"{self.server_url}/api/agents/register",
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                self.api_key = result.get('api_key')
                
                api_key_file = os.path.join(os.path.dirname(__file__), '.api_key')
                with open(api_key_file, 'w') as f:
                    f.write(self.api_key)
                
                logger.info(f"Registered successfully. Server ID: {result.get('server_id')}")
                return True
            else:
                logger.error(f"Registration failed: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Registration error: {e}")
            return False
    
    def send_metrics(self) -> bool:
        try:
            metrics = self.collect_metrics()
            
            response = requests.post(
                f"{self.server_url}/api/agents/metrics",
                json={"api_key": self.api_key, "metrics": metrics},
                timeout=30
            )
            
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to send metrics: {e}")
            return False
    
    def send_heartbeat(self) -> bool:
        try:
            response = requests.post(
                f"{self.server_url}/api/agents/heartbeat",
                params={"api_key": self.api_key},
                timeout=10
            )
            return response.status_code == 200
        except:
            return False
    
    def run(self):
        logger.info(f"Starting Nexus Command Agent for {self.hostname}")
        
        api_key_file = os.path.join(os.path.dirname(__file__), '.api_key')
        if os.path.exists(api_key_file):
            with open(api_key_file, 'r') as f:
                self.api_key = f.read().strip()
            logger.info("Loaded existing API key")
        else:
            if not self.register():
                logger.error("Failed to register. Exiting.")
                sys.exit(1)
        
        metrics_counter = 0
        while True:
            try:
                self.send_heartbeat()
                
                if metrics_counter == 0:
                    if self.send_metrics():
                        logger.debug("Metrics sent successfully")
                    else:
                        logger.warning("Failed to send metrics")
                
                metrics_counter = (metrics_counter + 1) % 3
                time.sleep(10)
                
            except KeyboardInterrupt:
                logger.info("Agent stopped")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                time.sleep(30)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Nexus Command Windows Agent')
    parser.add_argument('--server', required=True, help='Nexus Command server URL')
    args = parser.parse_args()
    
    agent = NexusAgent(server_url=args.server)
    agent.run()
'@

    $agentScript | Out-File -FilePath $AgentScript -Encoding UTF8
    
    # Create config file
    $config = @{
        server_url = $ServerUrl
    } | ConvertTo-Json
    
    $config | Out-File -FilePath "$AgentPath\config.json" -Encoding UTF8
    
    Write-Success "Agent files installed"
}

function Install-Service {
    Write-Info "Installing Windows Service..."
    
    # Create a wrapper script for NSSM
    $wrapperScript = @"
@echo off
cd /d "$AgentPath"
python agent.py --server "$ServerUrl"
"@
    
    $wrapperScript | Out-File -FilePath "$AgentPath\run-agent.bat" -Encoding ASCII
    
    # Download NSSM if not present
    $nssmPath = "$AgentPath\nssm.exe"
    if (-not (Test-Path $nssmPath)) {
        Write-Info "Downloading NSSM..."
        $nssmZip = "$env:TEMP\nssm.zip"
        Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile $nssmZip
        Expand-Archive -Path $nssmZip -DestinationPath "$env:TEMP\nssm" -Force
        Copy-Item "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe" $nssmPath
        Remove-Item $nssmZip -Force
        Remove-Item "$env:TEMP\nssm" -Recurse -Force
    }
    
    # Remove existing service if present
    & $nssmPath stop $AgentName 2>&1 | Out-Null
    & $nssmPath remove $AgentName confirm 2>&1 | Out-Null
    
    # Install service
    & $nssmPath install $AgentName "$AgentPath\run-agent.bat"
    & $nssmPath set $AgentName DisplayName $AgentDisplayName
    & $nssmPath set $AgentName Description "Nexus Command monitoring agent for Windows servers"
    & $nssmPath set $AgentName AppDirectory $AgentPath
    & $nssmPath set $AgentName AppStdout "$LogPath\service.log"
    & $nssmPath set $AgentName AppStderr "$LogPath\service-error.log"
    & $nssmPath set $AgentName Start SERVICE_AUTO_START
    
    # Start service
    & $nssmPath start $AgentName
    
    Write-Success "Service installed and started"
}

function Uninstall-Agent {
    Write-Info "Uninstalling Nexus Command Agent..."
    
    $nssmPath = "$AgentPath\nssm.exe"
    if (Test-Path $nssmPath) {
        & $nssmPath stop $AgentName 2>&1 | Out-Null
        & $nssmPath remove $AgentName confirm 2>&1 | Out-Null
    }
    
    Remove-Item -Path "C:\Program Files\NexusCommand" -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Success "Agent uninstalled"
    exit 0
}

function Show-Summary {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║          Nexus Command Agent Installed Successfully!          ║" -ForegroundColor Green
    Write-Host "╠═══════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║                                                               ║" -ForegroundColor Green
    Write-Host "║  The agent is now running as a Windows Service.              ║" -ForegroundColor Green
    Write-Host "║                                                               ║" -ForegroundColor Green
    Write-Host "║  Server: $ServerUrl" -ForegroundColor Green
    Write-Host "║                                                               ║" -ForegroundColor Green
    Write-Host "║  Commands (PowerShell as Admin):                              ║" -ForegroundColor Green
    Write-Host "║  - Status:  Get-Service $AgentName                            ║" -ForegroundColor Green
    Write-Host "║  - Stop:    Stop-Service $AgentName                           ║" -ForegroundColor Green
    Write-Host "║  - Start:   Start-Service $AgentName                          ║" -ForegroundColor Green
    Write-Host "║  - Logs:    Get-Content '$LogPath\agent.log' -Tail 50         ║" -ForegroundColor Green
    Write-Host "║                                                               ║" -ForegroundColor Green
    Write-Host "║  To uninstall: .\install.ps1 -ServerUrl '$ServerUrl' -Uninstall║" -ForegroundColor Green
    Write-Host "║                                                               ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
}

# Main
Write-Banner

if (-not (Test-Admin)) {
    Write-Error "This script must be run as Administrator"
}

if ($Uninstall) {
    Uninstall-Agent
}

Install-Python
Install-Agent
Install-Service
Show-Summary
