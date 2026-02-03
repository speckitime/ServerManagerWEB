#!/usr/bin/env python3
"""
Nexus Command - Windows Server Agent
Collects system metrics and sends to central server
"""

import os
import sys
import time
import json
import socket
import platform
import subprocess
import configparser
from datetime import datetime
from typing import Dict, List, Optional

try:
    import psutil
    import requests
except ImportError:
    print("Installing required packages...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil", "requests"])
    import psutil
    import requests

# Configuration
CONFIG_PATH = r"C:\Program Files\ServerManager\config.ini"
LOG_PATH = r"C:\Program Files\ServerManager\agent.log"

class NexusAgentWindows:
    def __init__(self):
        self.config = self.load_config()
        self.api_url = self.config.get('api_url', '')
        self.api_key = self.config.get('api_key', '')
        self.hostname = socket.gethostname()
        self.server_id = None
        
    def load_config(self) -> Dict:
        """Load configuration from file"""
        config = {}
        if os.path.exists(CONFIG_PATH):
            parser = configparser.ConfigParser()
            parser.read(CONFIG_PATH)
            if 'server' in parser:
                config['api_url'] = parser['server'].get('api_url', '')
                config['api_key'] = parser['server'].get('api_key', '')
        return config
    
    def log(self, message: str):
        """Log message to file and stdout"""
        timestamp = datetime.now().isoformat()
        log_line = f"[{timestamp}] {message}"
        print(log_line)
        try:
            os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
            with open(LOG_PATH, 'a') as f:
                f.write(log_line + '\n')
        except:
            pass
    
    def register(self) -> bool:
        """Register agent with server"""
        try:
            os_version = f"Windows {platform.release()} {platform.version()}"
            
            response = requests.post(
                f"{self.api_url}/api/agents/register",
                json={
                    'hostname': self.hostname,
                    'ip_address': self.get_primary_ip(),
                    'os_type': 'windows',
                    'os_version': os_version
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                self.api_key = data['api_key']
                self.server_id = data['server_id']
                self.save_config()
                self.log(f"Registered successfully. Server ID: {self.server_id}")
                return True
            else:
                self.log(f"Registration failed: {response.text}")
                return False
        except Exception as e:
            self.log(f"Registration error: {e}")
            return False
    
    def save_config(self):
        """Save configuration to file"""
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        parser = configparser.ConfigParser()
        parser['server'] = {
            'api_url': self.api_url,
            'api_key': self.api_key
        }
        with open(CONFIG_PATH, 'w') as f:
            parser.write(f)
    
    def get_primary_ip(self) -> str:
        """Get primary IP address"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return '127.0.0.1'
    
    def collect_metrics(self) -> Dict:
        """Collect system metrics"""
        # CPU
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # Memory
        memory = psutil.virtual_memory()
        
        # Disk (all drives)
        total_disk = 0
        used_disk = 0
        for part in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(part.mountpoint)
                total_disk += usage.total
                used_disk += usage.used
            except:
                pass
        disk_percent = (used_disk / total_disk * 100) if total_disk > 0 else 0
        
        # Network
        network = psutil.net_io_counters()
        
        # Top processes
        processes = []
        for proc in sorted(psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status']), 
                          key=lambda p: p.info.get('cpu_percent', 0) or 0, 
                          reverse=True)[:20]:
            try:
                processes.append({
                    'pid': proc.info['pid'],
                    'name': proc.info['name'],
                    'cpu_percent': proc.info.get('cpu_percent', 0) or 0,
                    'memory_percent': proc.info.get('memory_percent', 0) or 0,
                    'status': proc.info.get('status', 'unknown')
                })
            except:
                pass
        
        return {
            'server_id': self.server_id or '',
            'cpu_percent': cpu_percent,
            'memory_percent': memory.percent,
            'memory_used': memory.used,
            'memory_total': memory.total,
            'disk_percent': disk_percent,
            'disk_used': used_disk,
            'disk_total': total_disk,
            'network_bytes_sent': network.bytes_sent,
            'network_bytes_recv': network.bytes_recv,
            'processes': processes
        }
    
    def send_metrics(self, metrics: Dict) -> bool:
        """Send metrics to server"""
        try:
            response = requests.post(
                f"{self.api_url}/api/agents/metrics",
                json={
                    'api_key': self.api_key,
                    'metrics': metrics
                },
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            self.log(f"Failed to send metrics: {e}")
            return False
    
    def send_heartbeat(self) -> bool:
        """Send heartbeat to server"""
        try:
            response = requests.post(
                f"{self.api_url}/api/agents/heartbeat",
                params={'api_key': self.api_key},
                timeout=10
            )
            return response.status_code == 200
        except:
            return False
    
    def get_pending_commands(self) -> List[Dict]:
        """Get pending commands from server"""
        try:
            response = requests.get(
                f"{self.api_url}/api/agents/commands/{self.server_id}",
                params={'api_key': self.api_key},
                timeout=10
            )
            if response.status_code == 200:
                return response.json()
        except:
            pass
        return []
    
    def execute_command(self, command: Dict) -> Dict:
        """Execute a command and return result"""
        cmd = command.get('command', '')
        try:
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=300
            )
            return {
                'status': 'success' if result.returncode == 0 else 'failed',
                'stdout': result.stdout,
                'stderr': result.stderr,
                'return_code': result.returncode
            }
        except subprocess.TimeoutExpired:
            return {'status': 'timeout', 'error': 'Command timed out'}
        except Exception as e:
            return {'status': 'error', 'error': str(e)}
    
    def get_installed_packages(self) -> List[Dict]:
        """Get list of installed programs via WMI"""
        packages = []
        try:
            result = subprocess.run(
                ['wmic', 'product', 'get', 'Name,Version', '/format:csv'],
                capture_output=True,
                text=True,
                timeout=60
            )
            lines = result.stdout.strip().split('\n')
            for line in lines[1:]:
                parts = line.strip().split(',')
                if len(parts) >= 3:
                    packages.append({
                        'name': parts[1],
                        'version': parts[2],
                        'installed': True
                    })
        except:
            pass
        return packages
    
    def check_updates(self) -> List[Dict]:
        """Check for Windows updates using COM"""
        updates = []
        try:
            # PowerShell command to check updates
            ps_script = '''
            $Session = New-Object -ComObject Microsoft.Update.Session
            $Searcher = $Session.CreateUpdateSearcher()
            $Results = $Searcher.Search("IsInstalled=0")
            foreach($Update in $Results.Updates) {
                Write-Output "$($Update.Title)|$($Update.MsrcSeverity)"
            }
            '''
            result = subprocess.run(
                ['powershell', '-Command', ps_script],
                capture_output=True,
                text=True,
                timeout=120
            )
            for line in result.stdout.strip().split('\n'):
                if '|' in line:
                    parts = line.split('|')
                    updates.append({
                        'package': parts[0],
                        'new_version': 'Latest',
                        'severity': parts[1] if len(parts) > 1 else 'medium'
                    })
        except:
            pass
        return updates
    
    def run(self):
        """Main agent loop"""
        self.log("Starting Nexus Command Agent (Windows)...")
        
        if not self.api_key:
            self.log("No API key found. Please register the agent.")
            return
        
        metrics_interval = 5
        heartbeat_interval = 30
        command_check_interval = 10
        
        last_heartbeat = 0
        last_command_check = 0
        
        while True:
            try:
                current_time = time.time()
                
                metrics = self.collect_metrics()
                if not self.send_metrics(metrics):
                    self.log("Failed to send metrics")
                
                if current_time - last_heartbeat >= heartbeat_interval:
                    self.send_heartbeat()
                    last_heartbeat = current_time
                
                if current_time - last_command_check >= command_check_interval:
                    commands = self.get_pending_commands()
                    for cmd in commands:
                        self.log(f"Executing command: {cmd.get('command', '')}")
                        result = self.execute_command(cmd)
                        self.log(f"Command result: {result.get('status', '')}")
                    last_command_check = current_time
                
                time.sleep(metrics_interval)
                
            except KeyboardInterrupt:
                self.log("Shutting down agent...")
                break
            except Exception as e:
                self.log(f"Agent error: {e}")
                time.sleep(10)


if __name__ == '__main__':
    agent = NexusAgentWindows()
    
    if len(sys.argv) > 1:
        if sys.argv[1] == 'register':
            if len(sys.argv) >= 3:
                agent.api_url = sys.argv[2]
                if agent.register():
                    print("Registration successful!")
                else:
                    print("Registration failed.")
                    sys.exit(1)
            else:
                print("Usage: agent.py register <api_url>")
                sys.exit(1)
        elif sys.argv[1] == 'packages':
            packages = agent.get_installed_packages()
            print(json.dumps(packages, indent=2))
        elif sys.argv[1] == 'updates':
            updates = agent.check_updates()
            print(json.dumps(updates, indent=2))
        elif sys.argv[1] == 'metrics':
            metrics = agent.collect_metrics()
            print(json.dumps(metrics, indent=2))
    else:
        agent.run()
