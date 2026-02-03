#
# Nexus Command - Windows Agent Installation Script
# Run as Administrator in PowerShell
#

param(
    [string]$ApiUrl = "",
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"

Write-Host @"
  _   _                      ____                                          _ 
 | \ | | _____  ___   _ ___ / ___|___  _ __ ___  _ __ ___   __ _ _ __   __| |
 |  \| |/ _ \ \/ / | | / __| |   / _ \| '_ ` _ \| '_ ` _ \ / _` | '_ \ / _` |
 | |\  |  __/>  <| |_| \__ \ |__| (_) | | | | | | | | | | | (_| | | | | (_| |
 |_| \_|\___/_/\_\\__,_|___/\____\___/|_| |_| |_|_| |_| |_|\__,_|_| |_|\__,_|

"@ -ForegroundColor Green

Write-Host "Windows Agent Installation Script" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# Check Administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Error: Please run as Administrator" -ForegroundColor Red
    exit 1
}

$InstallPath = "C:\Program Files\ServerManager"
$ServiceName = "NexusCommandAgent"

function Install-Prerequisites {
    Write-Host "Checking prerequisites..." -ForegroundColor Yellow
    
    # Check Python
    try {
        $pythonVersion = & python --version 2>&1
        Write-Host "Found: $pythonVersion" -ForegroundColor Green
    } catch {
        Write-Host "Python not found. Installing..." -ForegroundColor Yellow
        
        # Download Python installer
        $pythonUrl = "https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe"
        $pythonInstaller = "$env:TEMP\python-installer.exe"
        Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonInstaller
        
        # Install Python
        Start-Process -FilePath $pythonInstaller -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1" -Wait
        Remove-Item $pythonInstaller
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine")
    }
    
    # Install Python packages
    Write-Host "Installing Python packages..." -ForegroundColor Yellow
    & pip install psutil requests --quiet
}

function Create-Directories {
    Write-Host "Creating directories..." -ForegroundColor Yellow
    
    if (-NOT (Test-Path $InstallPath)) {
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    }
}

function Copy-AgentFiles {
    Write-Host "Copying agent files..." -ForegroundColor Yellow
    
    # If running from repo directory
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    if (Test-Path "$scriptPath\agent.py") {
        Copy-Item "$scriptPath\agent.py" "$InstallPath\agent.py" -Force
    } else {
        # Download from server
        if ($ApiUrl) {
            Invoke-WebRequest -Uri "$ApiUrl/agents/windows/agent.py" -OutFile "$InstallPath\agent.py"
        } else {
            Write-Host "Error: agent.py not found and no API URL provided" -ForegroundColor Red
            exit 1
        }
    }
}

function Configure-Agent {
    Write-Host "Configuring agent..." -ForegroundColor Yellow
    
    if (-NOT $ApiUrl) {
        $ApiUrl = Read-Host "Enter Nexus Command API URL (e.g., https://your-server.com)"
    }
    
    if (-NOT $ApiKey) {
        $ApiKey = Read-Host "Enter API Key (leave blank to auto-register)"
    }
    
    $config = @"
[server]
api_url = $ApiUrl
api_key = $ApiKey
"@
    
    $config | Out-File -FilePath "$InstallPath\config.ini" -Encoding UTF8
    
    Write-Host "Configuration saved" -ForegroundColor Green
}

function Create-WindowsService {
    Write-Host "Creating Windows service..." -ForegroundColor Yellow
    
    # Check if service exists
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "Stopping existing service..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force
        & sc.exe delete $ServiceName
        Start-Sleep -Seconds 2
    }
    
    # Create service using NSSM or sc.exe
    $pythonPath = (Get-Command python).Source
    $agentPath = "$InstallPath\agent.py"
    
    # Create a batch file wrapper
    $batchContent = @"
@echo off
cd /d "$InstallPath"
"$pythonPath" "$agentPath"
"@
    $batchContent | Out-File -FilePath "$InstallPath\run-agent.bat" -Encoding ASCII
    
    # Create service
    & sc.exe create $ServiceName binPath= "$InstallPath\run-agent.bat" start= auto DisplayName= "Nexus Command Agent"
    
    # Start service
    Start-Service -Name $ServiceName
    
    Write-Host "Service created and started" -ForegroundColor Green
}

function Test-Connection {
    Write-Host "Testing connection..." -ForegroundColor Yellow
    
    try {
        $result = & python "$InstallPath\agent.py" metrics 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Agent is working correctly" -ForegroundColor Green
        } else {
            Write-Host "Warning: Could not verify agent functionality" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Warning: Could not verify agent functionality" -ForegroundColor Yellow
    }
}

# Main Installation
try {
    Install-Prerequisites
    Create-Directories
    Copy-AgentFiles
    Configure-Agent
    Create-WindowsService
    Test-Connection
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Installation Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Service Status:"
    Get-Service -Name $ServiceName | Format-List Name, Status, StartType
    Write-Host ""
    Write-Host "Useful commands:"
    Write-Host "  View logs:    Get-Content '$InstallPath\agent.log' -Tail 50"
    Write-Host "  Restart:      Restart-Service $ServiceName"
    Write-Host "  Stop:         Stop-Service $ServiceName"
    Write-Host ""
} catch {
    Write-Host "Installation failed: $_" -ForegroundColor Red
    exit 1
}
