#!/usr/bin/env python3
"""
Nexus Command - Linux Server Agent
Collects system metrics, hardware info, and SMART data
"""

import os
import sys
import time
import json
import socket
import platform
import subprocess
import configparser
import re
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
CONFIG_PATH = "/etc/servermanager/agent.conf"
LOG_PATH = "/var/log/servermanager-agent.log"

class NexusAgent:
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
            with open(LOG_PATH, 'a') as f:
                f.write(log_line + '\n')
        except:
            pass
    
    def register(self) -> bool:
        """Register agent with server"""
        try:
            os_info = platform.freedesktop_os_release() if hasattr(platform, 'freedesktop_os_release') else {}
            os_version = os_info.get('PRETTY_NAME', f"{platform.system()} {platform.release()}")
            
            response = requests.post(
                f"{self.api_url}/api/agents/register",
                json={
                    'hostname': self.hostname,
                    'ip_address': self.get_primary_ip(),
                    'os_type': 'linux',
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
    
    def check_smartmontools(self) -> bool:
        """Check if smartmontools is installed"""
        return os.path.exists('/usr/sbin/smartctl') or os.path.exists('/usr/bin/smartctl')
    
    def install_smartmontools(self):
        """Attempt to install smartmontools"""
        self.log("smartmontools not found, attempting installation...")
        try:
            if os.path.exists('/usr/bin/apt'):
                subprocess.run(['apt', 'update'], capture_output=True)
                subprocess.run(['apt', 'install', '-y', 'smartmontools'], capture_output=True)
            elif os.path.exists('/usr/bin/yum'):
                subprocess.run(['yum', 'install', '-y', 'smartmontools'], capture_output=True)
            elif os.path.exists('/usr/bin/dnf'):
                subprocess.run(['dnf', 'install', '-y', 'smartmontools'], capture_output=True)
            self.log("smartmontools installation attempted")
        except Exception as e:
            self.log(f"Failed to install smartmontools: {e}")
    
    def get_disk_serial(self, device: str) -> Dict:
        """Get disk serial number and model using various methods"""
        info = {'serial': None, 'model': None}
        
        # Try hdparm first
        try:
            result = subprocess.run(['hdparm', '-I', device], capture_output=True, text=True, timeout=10)
            for line in result.stdout.split('\n'):
                if 'Serial Number' in line:
                    info['serial'] = line.split(':')[-1].strip()
                if 'Model Number' in line:
                    info['model'] = line.split(':')[-1].strip()
        except:
            pass
        
        # Try lsblk
        if not info['serial']:
            try:
                device_name = device.replace('/dev/', '')
                result = subprocess.run(
                    ['lsblk', '-o', 'NAME,SERIAL,MODEL', '-n', '-d', device],
                    capture_output=True, text=True, timeout=10
                )
                parts = result.stdout.strip().split()
                if len(parts) >= 2:
                    info['serial'] = parts[1] if parts[1] != '' else None
                if len(parts) >= 3:
                    info['model'] = ' '.join(parts[2:])
            except:
                pass
        
        # Try udevadm
        if not info['serial']:
            try:
                result = subprocess.run(
                    ['udevadm', 'info', '--query=property', '--name=' + device],
                    capture_output=True, text=True, timeout=10
                )
                for line in result.stdout.split('\n'):
                    if 'ID_SERIAL_SHORT=' in line:
                        info['serial'] = line.split('=')[-1].strip()
                    if 'ID_MODEL=' in line:
                        info['model'] = line.split('=')[-1].strip().replace('_', ' ')
            except:
                pass
        
        return info
    
    def get_smart_data(self, device: str) -> Dict:
        """Get SMART data for a disk"""
        smart = {
            'status': 'UNKNOWN',
            'temperature_celsius': None,
            'power_on_hours': None,
            'power_cycle_count': None,
            'reallocated_sectors': None,
            'health_percent': None
        }
        
        if not self.check_smartmontools():
            return smart
        
        try:
            # Get SMART health
            result = subprocess.run(
                ['smartctl', '-H', device],
                capture_output=True, text=True, timeout=30
            )
            if 'PASSED' in result.stdout:
                smart['status'] = 'PASSED'
            elif 'FAILED' in result.stdout:
                smart['status'] = 'FAILED'
            
            # Get SMART attributes
            result = subprocess.run(
                ['smartctl', '-A', device],
                capture_output=True, text=True, timeout=30
            )
            
            for line in result.stdout.split('\n'):
                parts = line.split()
                if len(parts) >= 10:
                    attr_name = parts[1].lower() if len(parts) > 1 else ''
                    raw_value = parts[-1] if parts else '0'
                    
                    try:
                        if 'temperature' in attr_name:
                            smart['temperature_celsius'] = int(raw_value)
                        elif 'power_on_hours' in attr_name or 'power-on' in attr_name:
                            smart['power_on_hours'] = int(raw_value)
                        elif 'power_cycle' in attr_name:
                            smart['power_cycle_count'] = int(raw_value)
                        elif 'reallocated' in attr_name and 'sector' in attr_name:
                            smart['reallocated_sectors'] = int(raw_value)
                        elif 'wear_leveling' in attr_name:
                            smart['health_percent'] = int(raw_value)
                    except:
                        pass
            
            # For NVMe drives
            result = subprocess.run(
                ['smartctl', '-a', device],
                capture_output=True, text=True, timeout=30
            )
            for line in result.stdout.split('\n'):
                if 'Temperature:' in line:
                    match = re.search(r'(\d+)\s*Celsius', line)
                    if match:
                        smart['temperature_celsius'] = int(match.group(1))
                elif 'Power On Hours:' in line:
                    match = re.search(r'(\d+)', line.split(':')[-1])
                    if match:
                        smart['power_on_hours'] = int(match.group(1))
                elif 'Percentage Used:' in line:
                    match = re.search(r'(\d+)', line)
                    if match:
                        smart['health_percent'] = 100 - int(match.group(1))
                        
        except Exception as e:
            self.log(f"Error getting SMART data for {device}: {e}")
        
        return smart
    
    def get_disk_info(self) -> List[Dict]:
        """Get detailed disk information"""
        disks = []
        
        # Get all block devices
        try:
            result = subprocess.run(
                ['lsblk', '-o', 'NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE', '-J'],
                capture_output=True, text=True, timeout=30
            )
            block_devices = json.loads(result.stdout)
        except:
            block_devices = {'blockdevices': []}
        
        for device in block_devices.get('blockdevices', []):
            if device.get('type') != 'disk':
                continue
            
            dev_path = f"/dev/{device['name']}"
            disk_info = self.get_disk_serial(dev_path)
            smart_data = self.get_smart_data(dev_path)
            
            # Parse size
            size_str = device.get('size', '0')
            size_gb = 0
            try:
                if 'G' in size_str:
                    size_gb = float(size_str.replace('G', ''))
                elif 'T' in size_str:
                    size_gb = float(size_str.replace('T', '')) * 1024
                elif 'M' in size_str:
                    size_gb = float(size_str.replace('M', '')) / 1024
            except:
                pass
            
            # Get partitions
            partitions = []
            for child in device.get('children', []):
                if child.get('mountpoint'):
                    try:
                        usage = psutil.disk_usage(child['mountpoint'])
                        partitions.append({
                            'mountpoint': child['mountpoint'],
                            'filesystem': child.get('fstype', 'unknown'),
                            'size_gb': round(usage.total / (1024**3), 1),
                            'used_gb': round(usage.used / (1024**3), 1),
                            'percent': usage.percent
                        })
                    except:
                        pass
            
            # Determine disk type
            disk_type = 'HDD'
            try:
                rotational_path = f"/sys/block/{device['name']}/queue/rotational"
                if os.path.exists(rotational_path):
                    with open(rotational_path) as f:
                        if f.read().strip() == '0':
                            disk_type = 'SSD'
            except:
                pass
            
            disks.append({
                'device': dev_path,
                'model': disk_info.get('model', 'Unknown'),
                'serial': disk_info.get('serial', 'Unknown'),
                'size_gb': size_gb,
                'type': disk_type,
                'partitions': partitions,
                'smart': smart_data
            })
        
        return disks
    
    def get_hardware_info(self) -> Dict:
        """Collect detailed hardware information"""
        hardware = {}
        
        # CPU Information
        try:
            cpu_info = {}
            with open('/proc/cpuinfo') as f:
                for line in f:
                    if ':' in line:
                        key, value = line.split(':', 1)
                        key = key.strip()
                        value = value.strip()
                        if key == 'model name':
                            cpu_info['model'] = value
                        elif key == 'cpu MHz':
                            cpu_info['frequency_mhz'] = float(value)
                        elif key == 'cache size':
                            cpu_info['cache'] = value
            
            cpu_info['cores'] = psutil.cpu_count(logical=False)
            cpu_info['threads'] = psutil.cpu_count(logical=True)
            hardware['cpu'] = cpu_info
        except:
            pass
        
        # Memory Information
        try:
            mem = psutil.virtual_memory()
            memory_info = {
                'total_gb': round(mem.total / (1024**3), 1),
                'type': 'Unknown',
                'speed_mhz': 'Unknown',
                'slots': []
            }
            
            # Try dmidecode for detailed RAM info
            try:
                result = subprocess.run(
                    ['dmidecode', '-t', 'memory'],
                    capture_output=True, text=True, timeout=10
                )
                current_slot = {}
                for line in result.stdout.split('\n'):
                    line = line.strip()
                    if line.startswith('Locator:'):
                        if current_slot and current_slot.get('size_gb'):
                            memory_info['slots'].append(current_slot)
                        current_slot = {'slot': line.split(':')[-1].strip()}
                    elif line.startswith('Size:') and 'No Module' not in line:
                        size_str = line.split(':')[-1].strip()
                        if 'GB' in size_str:
                            current_slot['size_gb'] = int(size_str.replace('GB', '').strip())
                        elif 'MB' in size_str:
                            current_slot['size_gb'] = int(size_str.replace('MB', '').strip()) / 1024
                    elif line.startswith('Manufacturer:'):
                        current_slot['manufacturer'] = line.split(':')[-1].strip()
                    elif line.startswith('Type:') and 'DDR' in line:
                        memory_info['type'] = line.split(':')[-1].strip()
                    elif line.startswith('Speed:') and 'MHz' in line:
                        memory_info['speed_mhz'] = line.split(':')[-1].strip()
                
                if current_slot and current_slot.get('size_gb'):
                    memory_info['slots'].append(current_slot)
            except:
                pass
            
            hardware['memory'] = memory_info
        except:
            pass
        
        # Motherboard Information
        try:
            motherboard = {}
            try:
                result = subprocess.run(
                    ['dmidecode', '-t', 'baseboard'],
                    capture_output=True, text=True, timeout=10
                )
                for line in result.stdout.split('\n'):
                    line = line.strip()
                    if line.startswith('Manufacturer:'):
                        motherboard['manufacturer'] = line.split(':')[-1].strip()
                    elif line.startswith('Product Name:'):
                        motherboard['model'] = line.split(':')[-1].strip()
            except:
                pass
            
            # BIOS version
            try:
                result = subprocess.run(
                    ['dmidecode', '-t', 'bios'],
                    capture_output=True, text=True, timeout=10
                )
                for line in result.stdout.split('\n'):
                    if 'Version:' in line:
                        motherboard['bios_version'] = line.split(':')[-1].strip()
                        break
            except:
                pass
            
            hardware['motherboard'] = motherboard
        except:
            pass
        
        # Network Interfaces
        try:
            interfaces = []
            for iface, addrs in psutil.net_if_addrs().items():
                if iface == 'lo':
                    continue
                interface = {'name': iface}
                for addr in addrs:
                    if addr.family == socket.AF_INET:
                        interface['ip'] = addr.address
                    elif addr.family == psutil.AF_LINK:
                        interface['mac'] = addr.address
                
                # Get speed
                try:
                    stats = psutil.net_if_stats().get(iface)
                    if stats:
                        interface['speed'] = f"{stats.speed} Mbps" if stats.speed else 'Unknown'
                        interface['status'] = 'up' if stats.isup else 'down'
                except:
                    pass
                
                interfaces.append(interface)
            
            hardware['network_interfaces'] = interfaces
        except:
            pass
        
        return hardware
    
    def get_uptime(self) -> str:
        """Get system uptime"""
        try:
            boot_time = psutil.boot_time()
            uptime_seconds = time.time() - boot_time
            days = int(uptime_seconds // 86400)
            hours = int((uptime_seconds % 86400) // 3600)
            minutes = int((uptime_seconds % 3600) // 60)
            return f"{days}d {hours}h {minutes}m"
        except:
            return "Unknown"
    
    def collect_metrics(self) -> Dict:
        """Collect system metrics"""
        # CPU
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # Memory
        memory = psutil.virtual_memory()
        
        # Disk (total)
        disk = psutil.disk_usage('/')
        
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
        
        # Get detailed disk info
        disks = self.get_disk_info()
        
        # Get hardware info (less frequently, cached)
        hardware = self.get_hardware_info()
        
        return {
            'server_id': self.server_id or '',
            'cpu_percent': cpu_percent,
            'memory_percent': memory.percent,
            'memory_used': memory.used,
            'memory_total': memory.total,
            'disk_percent': disk.percent,
            'disk_used': disk.used,
            'disk_total': disk.total,
            'network_bytes_sent': network.bytes_sent,
            'network_bytes_recv': network.bytes_recv,
            'processes': processes,
            'disks': disks,
            'hardware': hardware,
            'uptime': self.get_uptime(),
            'timestamp': datetime.now().isoformat()
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
        """Get list of installed packages"""
        packages = []
        
        # Debian/Ubuntu
        if os.path.exists('/usr/bin/dpkg'):
            try:
                result = subprocess.run(
                    ['dpkg', '-l'],
                    capture_output=True,
                    text=True
                )
                for line in result.stdout.split('\n')[5:]:
                    parts = line.split()
                    if len(parts) >= 3 and parts[0] == 'ii':
                        packages.append({
                            'name': parts[1],
                            'version': parts[2],
                            'installed': True
                        })
            except:
                pass
        
        # RHEL/CentOS
        elif os.path.exists('/usr/bin/rpm'):
            try:
                result = subprocess.run(
                    ['rpm', '-qa', '--qf', '%{NAME} %{VERSION}\n'],
                    capture_output=True,
                    text=True
                )
                for line in result.stdout.split('\n'):
                    parts = line.split()
                    if len(parts) >= 2:
                        packages.append({
                            'name': parts[0],
                            'version': parts[1],
                            'installed': True
                        })
            except:
                pass
        
        return packages
    
    def check_updates(self) -> List[Dict]:
        """Check for available updates"""
        updates = []
        
        # Debian/Ubuntu
        if os.path.exists('/usr/bin/apt'):
            try:
                subprocess.run(['apt', 'update'], capture_output=True)
                result = subprocess.run(
                    ['apt', 'list', '--upgradable'],
                    capture_output=True,
                    text=True
                )
                for line in result.stdout.split('\n')[1:]:
                    if '/' in line:
                        parts = line.split()
                        if len(parts) >= 2:
                            name = parts[0].split('/')[0]
                            version = parts[1]
                            updates.append({
                                'package': name,
                                'new_version': version,
                                'severity': 'medium'
                            })
            except:
                pass
        
        return updates
    
    def run(self):
        """Main agent loop"""
        self.log("Starting Nexus Command Agent...")
        
        # Check and install smartmontools
        if not self.check_smartmontools():
            self.install_smartmontools()
        
        # Register if no API key
        if not self.api_key:
            self.log("No API key found. Please register the agent.")
            return
        
        metrics_interval = 5  # seconds
        heartbeat_interval = 30  # seconds
        command_check_interval = 10  # seconds
        hardware_update_interval = 300  # 5 minutes for hardware info
        
        last_heartbeat = 0
        last_command_check = 0
        last_hardware_update = 0
        cached_hardware = None
        
        while True:
            try:
                current_time = time.time()
                
                # Collect and send metrics
                metrics = self.collect_metrics()
                
                # Only update hardware info every 5 minutes
                if current_time - last_hardware_update >= hardware_update_interval or cached_hardware is None:
                    cached_hardware = metrics.get('hardware', {})
                    last_hardware_update = current_time
                else:
                    metrics['hardware'] = cached_hardware
                
                if self.send_metrics(metrics):
                    pass  # Success
                else:
                    self.log("Failed to send metrics")
                
                # Send heartbeat
                if current_time - last_heartbeat >= heartbeat_interval:
                    self.send_heartbeat()
                    last_heartbeat = current_time
                
                # Check for commands
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
    agent = NexusAgent()
    
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
        elif sys.argv[1] == 'hardware':
            hardware = agent.get_hardware_info()
            print(json.dumps(hardware, indent=2))
        elif sys.argv[1] == 'disks':
            disks = agent.get_disk_info()
            print(json.dumps(disks, indent=2))
    else:
        agent.run()
