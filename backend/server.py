"""
Nexus Command - Server Management System Backend
FastAPI + MongoDB + WebSocket for real-time updates + SSH Terminal + Alert System
"""

import os
import json
import secrets
import hashlib
import asyncio
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr
from pydantic_settings import BaseSettings
from pymongo import MongoClient, DESCENDING, ASCENDING
from bson import ObjectId
from passlib.context import CryptContext
from jose import JWTError, jwt
from cryptography.fernet import Fernet
import socketio

# SSH imports
try:
    import paramiko
except ImportError:
    paramiko = None

# Email imports
try:
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
except ImportError:
    smtplib = None

# ========================
# Configuration
# ========================

class Settings(BaseSettings):
    MONGO_URL: str
    DB_NAME: str
    JWT_SECRET: str = "nexus_command_secret_key_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    # SMTP Settings for alerts
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    ALERT_EMAIL_TO: str = ""

    class Config:
        env_file = ".env"

settings = Settings()

# Encryption key for credentials
ENCRYPTION_KEY = Fernet.generate_key()
fernet = Fernet(ENCRYPTION_KEY)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT
security = HTTPBearer()

# MongoDB Connection
client = MongoClient(settings.MONGO_URL)
db = client[settings.DB_NAME]

# Collections
users_collection = db["users"]
servers_collection = db["servers"]
server_groups_collection = db["server_groups"]
server_metrics_collection = db["server_metrics"]
server_logs_collection = db["server_logs"]
packages_collection = db["packages"]
updates_collection = db["updates"]
tasks_collection = db["tasks"]
task_logs_collection = db["task_logs"]
documentation_collection = db["documentation"]
activity_logs_collection = db["activity_logs"]
alerts_collection = db["alerts"]
alert_rules_collection = db["alert_rules"]

# Create indexes
users_collection.create_index("email", unique=True)
servers_collection.create_index("hostname")
server_metrics_collection.create_index([("server_id", ASCENDING), ("timestamp", DESCENDING)])
activity_logs_collection.create_index([("user_id", ASCENDING), ("timestamp", DESCENDING)])
alerts_collection.create_index([("server_id", ASCENDING), ("created_at", DESCENDING)])
alerts_collection.create_index([("status", ASCENDING)])

# ========================
# SSH Connection Manager
# ========================

class SSHConnectionManager:
    def __init__(self):
        self.connections: Dict[str, paramiko.SSHClient] = {}
        self.channels: Dict[str, paramiko.Channel] = {}
    
    async def connect(self, connection_id: str, hostname: str, port: int, username: str, password: str) -> bool:
        if paramiko is None:
            return False
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(hostname, port=port, username=username, password=password, timeout=10)
            
            channel = client.invoke_shell(term='xterm-256color', width=120, height=40)
            channel.setblocking(0)
            
            self.connections[connection_id] = client
            self.channels[connection_id] = channel
            return True
        except Exception as e:
            print(f"SSH connection error: {e}")
            return False
    
    def send_command(self, connection_id: str, data: str) -> bool:
        if connection_id not in self.channels:
            return False
        try:
            self.channels[connection_id].send(data)
            return True
        except:
            return False
    
    def read_output(self, connection_id: str) -> str:
        if connection_id not in self.channels:
            return ""
        try:
            output = ""
            while self.channels[connection_id].recv_ready():
                output += self.channels[connection_id].recv(4096).decode('utf-8', errors='replace')
            return output
        except:
            return ""
    
    def disconnect(self, connection_id: str):
        if connection_id in self.channels:
            try:
                self.channels[connection_id].close()
            except:
                pass
            del self.channels[connection_id]
        if connection_id in self.connections:
            try:
                self.connections[connection_id].close()
            except:
                pass
            del self.connections[connection_id]
    
    def is_connected(self, connection_id: str) -> bool:
        return connection_id in self.connections and connection_id in self.channels

ssh_manager = SSHConnectionManager()

# ========================
# Alert System
# ========================

class AlertManager:
    def __init__(self):
        self.check_interval = 60  # seconds
        self.running = False
        self.thread = None
    
    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._run_checker, daemon=True)
        self.thread.start()
    
    def stop(self):
        self.running = False
    
    def _run_checker(self):
        while self.running:
            try:
                self._check_servers()
            except Exception as e:
                print(f"Alert checker error: {e}")
            import time
            time.sleep(self.check_interval)
    
    def _check_servers(self):
        # Get all alert rules
        rules = list(alert_rules_collection.find({"enabled": True}))
        
        # Get all servers
        servers = list(servers_collection.find())
        
        for server in servers:
            server_id = str(server["_id"])
            
            # Check server offline
            last_seen = server.get("last_seen")
            if last_seen:
                try:
                    last_seen_dt = datetime.fromisoformat(last_seen.replace('Z', '+00:00'))
                    if datetime.now(timezone.utc) - last_seen_dt > timedelta(minutes=5):
                        if server.get("status") != "offline":
                            servers_collection.update_one(
                                {"_id": server["_id"]},
                                {"$set": {"status": "offline"}}
                            )
                            self._create_alert(
                                server_id=server_id,
                                hostname=server.get("hostname"),
                                alert_type="server_offline",
                                severity="critical",
                                message=f"Server {server.get('hostname')} is offline (no heartbeat for >5 minutes)"
                            )
                except:
                    pass
            
            # Check metrics thresholds
            metrics = server.get("metrics", {})
            
            for rule in rules:
                if rule.get("server_ids") and server_id not in rule.get("server_ids", []):
                    continue
                
                metric_type = rule.get("metric_type")
                threshold = rule.get("threshold", 90)
                comparison = rule.get("comparison", "gt")
                
                value = None
                if metric_type == "cpu":
                    value = metrics.get("cpu_percent")
                elif metric_type == "memory":
                    value = metrics.get("memory_percent")
                elif metric_type == "disk":
                    value = metrics.get("disk_percent")
                
                if value is not None:
                    triggered = False
                    if comparison == "gt" and value > threshold:
                        triggered = True
                    elif comparison == "lt" and value < threshold:
                        triggered = True
                    elif comparison == "eq" and value == threshold:
                        triggered = True
                    
                    if triggered:
                        # Check if similar alert exists in last hour
                        existing = alerts_collection.find_one({
                            "server_id": server_id,
                            "alert_type": f"high_{metric_type}",
                            "status": {"$ne": "resolved"},
                            "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()}
                        })
                        
                        if not existing:
                            self._create_alert(
                                server_id=server_id,
                                hostname=server.get("hostname"),
                                alert_type=f"high_{metric_type}",
                                severity=rule.get("severity", "warning"),
                                message=f"{metric_type.upper()} usage is {value:.1f}% (threshold: {threshold}%)"
                            )
    
    def _create_alert(self, server_id: str, hostname: str, alert_type: str, severity: str, message: str):
        alert = {
            "server_id": server_id,
            "hostname": hostname,
            "alert_type": alert_type,
            "severity": severity,
            "message": message,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "acknowledged": False,
            "acknowledged_by": None,
            "resolved_at": None
        }
        alerts_collection.insert_one(alert)
        
        # Send email notification
        self._send_email_alert(alert)
        
        # Emit via socket
        asyncio.run(sio.emit('new_alert', {
            "server_id": server_id,
            "hostname": hostname,
            "alert_type": alert_type,
            "severity": severity,
            "message": message
        }))
    
    def _send_email_alert(self, alert: dict):
        # Get SMTP config from database
        smtp_config = db["smtp_config"].find_one({}, {"_id": 0})
        if not smtp_config:
            smtp_config = {
                "smtp_host": settings.SMTP_HOST,
                "smtp_port": settings.SMTP_PORT,
                "smtp_user": settings.SMTP_USER,
                "smtp_password": settings.SMTP_PASSWORD,
                "smtp_from": settings.SMTP_FROM,
                "alert_email_to": settings.ALERT_EMAIL_TO
            }
        
        if not smtp_config.get("smtp_host") or not smtp_config.get("alert_email_to"):
            return
        
        try:
            msg = MIMEMultipart()
            msg['From'] = smtp_config.get("smtp_from") or smtp_config.get("smtp_user")
            msg['To'] = smtp_config.get("alert_email_to")
            msg['Subject'] = f"[Nexus Command] {alert['severity'].upper()}: {alert['hostname']} - {alert['alert_type']}"
            
            body = f"""
Nexus Command Alert

Server: {alert['hostname']}
Type: {alert['alert_type']}
Severity: {alert['severity']}
Message: {alert['message']}
Time: {alert['created_at']}

---
Nexus Command Server Management System
            """
            msg.attach(MIMEText(body, 'plain'))
            
            with smtplib.SMTP(smtp_config.get("smtp_host"), smtp_config.get("smtp_port", 587)) as server:
                server.starttls()
                if smtp_config.get("smtp_user") and smtp_config.get("smtp_password"):
                    server.login(smtp_config.get("smtp_user"), smtp_config.get("smtp_password"))
                server.send_message(msg)
        except Exception as e:
            print(f"Failed to send alert email: {e}")

alert_manager = AlertManager()

# ========================
# Socket.IO Setup
# ========================

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*'
)

# ========================
# Pydantic Models
# ========================

class UserBase(BaseModel):
    email: EmailStr
    username: str
    role: str = "user"  # admin, user, readonly

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    role: str
    created_at: str
    last_login: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ServerBase(BaseModel):
    hostname: str
    ip_address: str
    os_type: str  # linux, windows
    os_version: Optional[str] = None
    description: Optional[str] = None
    ssh_port: int = 22
    ssh_username: Optional[str] = None
    ssh_password: Optional[str] = None
    group_id: Optional[str] = None
    tags: List[str] = []

class ServerCreate(ServerBase):
    pass

class ServerUpdate(BaseModel):
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    description: Optional[str] = None
    ssh_port: Optional[int] = None
    ssh_username: Optional[str] = None
    ssh_password: Optional[str] = None
    group_id: Optional[str] = None
    tags: Optional[List[str]] = None

class ServerResponse(BaseModel):
    id: str
    hostname: str
    ip_address: str
    os_type: str
    os_version: Optional[str] = None
    description: Optional[str] = None
    ssh_port: int
    status: str = "unknown"
    group_id: Optional[str] = None
    tags: List[str] = []
    last_seen: Optional[str] = None
    created_at: str
    metrics: Optional[dict] = None

class ServerGroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#22C55E"

class ServerGroupResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    color: str
    server_count: int = 0

class DiskInfo(BaseModel):
    device: str
    mountpoint: str
    fstype: str
    total: int
    used: int
    free: int
    percent: float
    serial: Optional[str] = None
    model: Optional[str] = None
    smart_status: Optional[str] = None
    smart_data: Optional[dict] = None

class HardwareInfo(BaseModel):
    cpu_model: Optional[str] = None
    cpu_cores: Optional[int] = None
    cpu_threads: Optional[int] = None
    cpu_freq_mhz: Optional[float] = None
    ram_total: Optional[int] = None
    ram_type: Optional[str] = None
    ram_speed: Optional[str] = None
    ram_slots: Optional[List[dict]] = None
    motherboard: Optional[str] = None
    bios_version: Optional[str] = None
    network_interfaces: Optional[List[dict]] = None

class MetricsData(BaseModel):
    server_id: str
    cpu_percent: float
    memory_percent: float
    memory_used: int
    memory_total: int
    disk_percent: float
    disk_used: int
    disk_total: int
    network_bytes_sent: int
    network_bytes_recv: int
    processes: List[dict] = []
    disks: Optional[List[dict]] = None
    hardware: Optional[dict] = None
    timestamp: Optional[str] = None

class TaskBase(BaseModel):
    name: str
    task_type: str  # update, reboot, custom
    command: Optional[str] = None
    schedule: Optional[str] = None  # cron expression
    server_ids: List[str] = []
    enabled: bool = True

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    task_type: Optional[str] = None
    command: Optional[str] = None
    schedule: Optional[str] = None
    server_ids: Optional[List[str]] = None
    enabled: Optional[bool] = None

class TaskResponse(BaseModel):
    id: str
    name: str
    task_type: str
    command: Optional[str] = None
    schedule: Optional[str] = None
    server_ids: List[str]
    enabled: bool
    last_run: Optional[str] = None
    next_run: Optional[str] = None
    created_at: str

class DocumentationUpdate(BaseModel):
    content: str
    content_type: str = "markdown"  # markdown, html

class AgentRegisterRequest(BaseModel):
    hostname: str
    ip_address: str
    os_type: str
    os_version: str

class AgentMetricsRequest(BaseModel):
    api_key: str
    metrics: MetricsData

# Alert Models
class AlertRuleCreate(BaseModel):
    name: str
    metric_type: str  # cpu, memory, disk, server_offline
    comparison: str = "gt"  # gt, lt, eq
    threshold: float = 90.0
    severity: str = "warning"  # info, warning, critical
    server_ids: List[str] = []  # Empty = all servers
    enabled: bool = True

class AlertRuleUpdate(BaseModel):
    name: Optional[str] = None
    metric_type: Optional[str] = None
    comparison: Optional[str] = None
    threshold: Optional[float] = None
    severity: Optional[str] = None
    server_ids: Optional[List[str]] = None
    enabled: Optional[bool] = None

class SMTPConfigUpdate(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_user: str
    smtp_password: str
    smtp_from: str
    alert_email_to: str

# SSH Terminal Models
class SSHConnectRequest(BaseModel):
    username: str
    password: str

# ========================
# Helper Functions
# ========================

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = verify_token(credentials.credentials)
    user = users_collection.find_one({"_id": ObjectId(payload["sub"])}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["id"] = payload["sub"]
    return user

def encrypt_credential(value: str) -> str:
    return fernet.encrypt(value.encode()).decode()

def decrypt_credential(value: str) -> str:
    return fernet.decrypt(value.encode()).decode()

def serialize_server(server: dict) -> dict:
    return {
        "id": str(server["_id"]),
        "hostname": server["hostname"],
        "ip_address": server["ip_address"],
        "os_type": server["os_type"],
        "os_version": server.get("os_version"),
        "description": server.get("description"),
        "ssh_port": server.get("ssh_port", 22),
        "status": server.get("status", "unknown"),
        "group_id": server.get("group_id"),
        "tags": server.get("tags", []),
        "last_seen": server.get("last_seen"),
        "created_at": server.get("created_at"),
        "metrics": server.get("metrics")
    }

def log_activity(user_id: str, action: str, details: dict = None):
    activity_logs_collection.insert_one({
        "user_id": user_id,
        "action": action,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

# ========================
# App Lifespan
# ========================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create default admin user if not exists
    admin_exists = users_collection.find_one({"email": "admin@nexuscommand.local"})
    if not admin_exists:
        admin_password = secrets.token_urlsafe(12)
        users_collection.insert_one({
            "email": "admin@nexuscommand.local",
            "username": "admin",
            "password": pwd_context.hash(admin_password),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": None
        })
        print(f"\n{'='*50}")
        print("DEFAULT ADMIN CREDENTIALS")
        print(f"Email: admin@nexuscommand.local")
        print(f"Password: {admin_password}")
        print(f"{'='*50}\n")
    
    # Create demo server for testing
    demo_exists = servers_collection.find_one({"hostname": "demo-server"})
    if not demo_exists:
        servers_collection.insert_one({
            "hostname": "demo-server",
            "ip_address": "192.168.1.100",
            "os_type": "linux",
            "os_version": "Ubuntu 22.04",
            "description": "Demo server for testing",
            "ssh_port": 22,
            "status": "online",
            "tags": ["demo", "linux"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "metrics": {
                "cpu_percent": 25.5,
                "memory_percent": 45.2,
                "memory_used": 4000000000,
                "memory_total": 8000000000,
                "disk_percent": 55.0,
                "disk_used": 50000000000,
                "disk_total": 100000000000
            }
        })
        # Add second demo server
        servers_collection.insert_one({
            "hostname": "prod-web-01",
            "ip_address": "10.0.0.15",
            "os_type": "linux",
            "os_version": "Debian 12",
            "description": "Production web server",
            "ssh_port": 22,
            "status": "online",
            "tags": ["production", "web"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "metrics": {
                "cpu_percent": 65.3,
                "memory_percent": 78.1,
                "memory_used": 6200000000,
                "memory_total": 8000000000,
                "disk_percent": 40.0,
                "disk_used": 40000000000,
                "disk_total": 100000000000
            }
        })
        # Windows server demo
        servers_collection.insert_one({
            "hostname": "win-dc-01",
            "ip_address": "10.0.0.20",
            "os_type": "windows",
            "os_version": "Windows Server 2022",
            "description": "Domain Controller",
            "ssh_port": 3389,
            "status": "offline",
            "tags": ["windows", "domain"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "metrics": {
                "cpu_percent": 12.0,
                "memory_percent": 35.5,
                "memory_used": 5500000000,
                "memory_total": 16000000000,
                "disk_percent": 25.0,
                "disk_used": 50000000000,
                "disk_total": 200000000000
            }
        })
    
    # Create demo tasks
    demo_task_exists = tasks_collection.find_one({"name": "Daily System Updates"})
    if not demo_task_exists:
        # Get server IDs for tasks
        all_servers = list(servers_collection.find({}, {"_id": 1}))
        server_ids = [str(s["_id"]) for s in all_servers]
        
        tasks_collection.insert_one({
            "name": "Daily System Updates",
            "task_type": "update",
            "command": "apt update && apt upgrade -y",
            "schedule": "0 3 * * *",
            "server_ids": server_ids[:2] if len(server_ids) >= 2 else server_ids,
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_run": datetime.now(timezone.utc).isoformat(),
            "next_run": None
        })
        tasks_collection.insert_one({
            "name": "Weekly Reboot",
            "task_type": "reboot",
            "command": "shutdown -r now",
            "schedule": "0 4 * * 0",
            "server_ids": server_ids[:1] if server_ids else [],
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_run": None,
            "next_run": None
        })
        tasks_collection.insert_one({
            "name": "Cleanup Logs",
            "task_type": "custom",
            "command": "find /var/log -name '*.log' -mtime +30 -delete",
            "schedule": "0 2 1 * *",
            "server_ids": server_ids,
            "enabled": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_run": None,
            "next_run": None
        })
    
    # Create default alert rules
    default_rules = alert_rules_collection.find_one({"name": "High CPU Usage"})
    if not default_rules:
        alert_rules_collection.insert_one({
            "name": "High CPU Usage",
            "metric_type": "cpu",
            "comparison": "gt",
            "threshold": 90.0,
            "severity": "warning",
            "server_ids": [],
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        alert_rules_collection.insert_one({
            "name": "High Memory Usage",
            "metric_type": "memory",
            "comparison": "gt",
            "threshold": 90.0,
            "severity": "warning",
            "server_ids": [],
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        alert_rules_collection.insert_one({
            "name": "Disk Space Critical",
            "metric_type": "disk",
            "comparison": "gt",
            "threshold": 95.0,
            "severity": "critical",
            "server_ids": [],
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Start alert manager
    alert_manager.start()
    
    yield
    
    # Cleanup
    alert_manager.stop()
    client.close()

# ========================
# FastAPI App
# ========================

app = FastAPI(
    title="Nexus Command API",
    description="Server Management System API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)

# ========================
# Auth Endpoints
# ========================

@app.post("/api/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    user = users_collection.find_one({"email": request.email})
    if not user or not pwd_context.verify(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    token = create_access_token({"sub": str(user["_id"])})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "username": user["username"],
            "role": user["role"],
            "created_at": user["created_at"],
            "last_login": datetime.now(timezone.utc).isoformat()
        }
    }

@app.post("/api/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    log_activity(current_user["id"], "logout")
    return {"message": "Logged out successfully"}

@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    user = users_collection.find_one({"_id": ObjectId(current_user["id"])})
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "username": user["username"],
        "role": user["role"],
        "created_at": user["created_at"],
        "last_login": user.get("last_login")
    }

# ========================
# Server Endpoints
# ========================

@app.get("/api/servers")
async def list_servers(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    os_type: Optional[str] = None,
    group_id: Optional[str] = None,
    search: Optional[str] = None
):
    query = {}
    if status:
        query["status"] = status
    if os_type:
        query["os_type"] = os_type
    if group_id:
        query["group_id"] = group_id
    if search:
        query["$or"] = [
            {"hostname": {"$regex": search, "$options": "i"}},
            {"ip_address": {"$regex": search, "$options": "i"}}
        ]
    
    servers = list(servers_collection.find(query))
    return [serialize_server(s) for s in servers]

@app.post("/api/servers", response_model=ServerResponse)
async def create_server(server: ServerCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "readonly":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    server_data = server.model_dump()
    
    # Encrypt credentials if provided
    if server_data.get("ssh_password"):
        server_data["ssh_password"] = encrypt_credential(server_data["ssh_password"])
    
    server_data["status"] = "unknown"
    server_data["created_at"] = datetime.now(timezone.utc).isoformat()
    server_data["api_key"] = secrets.token_urlsafe(32)
    
    result = servers_collection.insert_one(server_data)
    server_data["id"] = str(result.inserted_id)
    
    log_activity(current_user["id"], "server_created", {"server_id": server_data["id"], "hostname": server.hostname})
    
    return serialize_server({**server_data, "_id": result.inserted_id})

@app.get("/api/servers/{server_id}", response_model=ServerResponse)
async def get_server(server_id: str, current_user: dict = Depends(get_current_user)):
    server = servers_collection.find_one({"_id": ObjectId(server_id)})
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return serialize_server(server)

@app.put("/api/servers/{server_id}", response_model=ServerResponse)
async def update_server(server_id: str, update: ServerUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "readonly":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    if update_data.get("ssh_password"):
        update_data["ssh_password"] = encrypt_credential(update_data["ssh_password"])
    
    result = servers_collection.update_one(
        {"_id": ObjectId(server_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Server not found")
    
    log_activity(current_user["id"], "server_updated", {"server_id": server_id})
    
    server = servers_collection.find_one({"_id": ObjectId(server_id)})
    return serialize_server(server)

@app.delete("/api/servers/{server_id}")
async def delete_server(server_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = servers_collection.delete_one({"_id": ObjectId(server_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Server not found")
    
    log_activity(current_user["id"], "server_deleted", {"server_id": server_id})
    return {"message": "Server deleted"}

@app.get("/api/servers/{server_id}/status")
async def get_server_status(server_id: str, current_user: dict = Depends(get_current_user)):
    server = servers_collection.find_one({"_id": ObjectId(server_id)}, {"_id": 0, "status": 1, "last_seen": 1, "metrics": 1})
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server

# ========================
# Monitoring Endpoints
# ========================

@app.get("/api/servers/{server_id}/metrics")
async def get_server_metrics(server_id: str, current_user: dict = Depends(get_current_user)):
    server = servers_collection.find_one({"_id": ObjectId(server_id)})
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server.get("metrics", {})

@app.get("/api/servers/{server_id}/metrics/history")
async def get_metrics_history(
    server_id: str,
    period: str = "24h",
    current_user: dict = Depends(get_current_user)
):
    # Calculate time range
    hours = int(period.replace("h", "")) if "h" in period else 24
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    metrics = list(server_metrics_collection.find(
        {
            "server_id": server_id,
            "timestamp": {"$gte": since.isoformat()}
        },
        {"_id": 0}
    ).sort("timestamp", ASCENDING).limit(500))
    
    return metrics

@app.get("/api/servers/{server_id}/processes")
async def get_server_processes(server_id: str, current_user: dict = Depends(get_current_user)):
    server = servers_collection.find_one({"_id": ObjectId(server_id)})
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    # Return mock processes for demo
    return [
        {"pid": 1, "name": "systemd", "cpu_percent": 0.1, "memory_percent": 0.5, "status": "running"},
        {"pid": 234, "name": "nginx", "cpu_percent": 2.3, "memory_percent": 1.2, "status": "running"},
        {"pid": 456, "name": "postgres", "cpu_percent": 5.1, "memory_percent": 8.4, "status": "running"},
        {"pid": 789, "name": "python3", "cpu_percent": 12.4, "memory_percent": 4.2, "status": "running"},
        {"pid": 1024, "name": "node", "cpu_percent": 8.7, "memory_percent": 6.1, "status": "running"}
    ]

@app.get("/api/servers/{server_id}/network")
async def get_server_network(server_id: str, current_user: dict = Depends(get_current_user)):
    server = servers_collection.find_one({"_id": ObjectId(server_id)})
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    return {
        "bytes_sent": 1500000000,
        "bytes_recv": 3200000000,
        "packets_sent": 1200000,
        "packets_recv": 2500000,
        "connections": 45
    }

# ========================
# Package Management Endpoints
# ========================

@app.get("/api/servers/{server_id}/packages")
async def get_server_packages(
    server_id: str,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"server_id": server_id}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    packages = list(packages_collection.find(query, {"_id": 0}))
    
    # Return demo packages if none
    if not packages:
        return [
            {"name": "nginx", "version": "1.24.0", "installed": True, "update_available": True, "new_version": "1.25.3"},
            {"name": "postgresql-15", "version": "15.4", "installed": True, "update_available": False},
            {"name": "python3", "version": "3.11.6", "installed": True, "update_available": True, "new_version": "3.11.7"},
            {"name": "nodejs", "version": "20.10.0", "installed": True, "update_available": False},
            {"name": "docker-ce", "version": "24.0.7", "installed": True, "update_available": True, "new_version": "25.0.0"}
        ]
    return packages

@app.get("/api/servers/{server_id}/updates")
async def get_server_updates(server_id: str, current_user: dict = Depends(get_current_user)):
    updates = list(updates_collection.find({"server_id": server_id}, {"_id": 0}))
    
    if not updates:
        return [
            {"package": "nginx", "current_version": "1.24.0", "new_version": "1.25.3", "severity": "low"},
            {"package": "python3", "current_version": "3.11.6", "new_version": "3.11.7", "severity": "medium"},
            {"package": "docker-ce", "current_version": "24.0.7", "new_version": "25.0.0", "severity": "high"},
            {"package": "linux-kernel", "current_version": "6.2.0", "new_version": "6.5.0", "severity": "critical"}
        ]
    return updates

@app.post("/api/servers/{server_id}/updates/scan")
async def scan_updates(server_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "readonly":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # In real implementation, this would queue a command to the agent
    log_activity(current_user["id"], "update_scan", {"server_id": server_id})
    return {"message": "Update scan initiated", "status": "queued"}

@app.post("/api/servers/{server_id}/updates/install")
async def install_updates(
    server_id: str,
    packages: Optional[List[str]] = None,
    install_all: bool = False,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] == "readonly":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    log_activity(current_user["id"], "update_install", {
        "server_id": server_id,
        "packages": packages,
        "install_all": install_all
    })
    return {"message": "Update installation queued", "status": "queued"}

# ========================
# Logs Endpoints
# ========================

@app.get("/api/servers/{server_id}/logs")
async def get_available_logs(server_id: str, current_user: dict = Depends(get_current_user)):
    # Return common log files
    return [
        {"name": "syslog", "path": "/var/log/syslog", "size": "2.5 MB"},
        {"name": "auth.log", "path": "/var/log/auth.log", "size": "1.2 MB"},
        {"name": "nginx/access.log", "path": "/var/log/nginx/access.log", "size": "5.8 MB"},
        {"name": "nginx/error.log", "path": "/var/log/nginx/error.log", "size": "0.3 MB"},
        {"name": "dmesg", "path": "/var/log/dmesg", "size": "0.1 MB"}
    ]

@app.get("/api/servers/{server_id}/logs/{filename}")
async def get_log_content(
    server_id: str,
    filename: str,
    lines: int = 100,
    current_user: dict = Depends(get_current_user)
):
    # Mock log content
    log_lines = []
    for i in range(min(lines, 50)):
        log_lines.extend([
            f"2024-01-15 10:23:{i:02d} INFO Server started successfully",
            f"2024-01-15 10:24:{i:02d} DEBUG Processing request from 192.168.1.50",
            f"2024-01-15 10:25:{i:02d} WARN High memory usage detected: 85%",
            f"2024-01-15 10:26:{i:02d} INFO Connection established to database",
            f"2024-01-15 10:27:{i:02d} ERROR Failed to connect to remote service"
        ])
    return {"filename": filename, "content": "\n".join(log_lines[:lines])}

# ========================
# Tasks Endpoints
# ========================

@app.get("/api/tasks")
async def list_tasks(current_user: dict = Depends(get_current_user)):
    tasks = list(tasks_collection.find())
    return [{
        "id": str(t["_id"]),
        "name": t["name"],
        "task_type": t["task_type"],
        "command": t.get("command"),
        "schedule": t.get("schedule"),
        "server_ids": t.get("server_ids", []),
        "enabled": t.get("enabled", True),
        "last_run": t.get("last_run"),
        "next_run": t.get("next_run"),
        "created_at": t["created_at"]
    } for t in tasks]

@app.post("/api/tasks", response_model=TaskResponse)
async def create_task(task: TaskCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "readonly":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    task_data = task.model_dump()
    task_data["created_at"] = datetime.now(timezone.utc).isoformat()
    task_data["created_by"] = current_user["id"]
    
    result = tasks_collection.insert_one(task_data)
    task_data["id"] = str(result.inserted_id)
    
    log_activity(current_user["id"], "task_created", {"task_id": task_data["id"], "name": task.name})
    
    return {**task_data, "last_run": None, "next_run": None}

@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, current_user: dict = Depends(get_current_user)):
    task = tasks_collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {
        "id": str(task["_id"]),
        "name": task["name"],
        "task_type": task["task_type"],
        "command": task.get("command"),
        "schedule": task.get("schedule"),
        "server_ids": task.get("server_ids", []),
        "enabled": task.get("enabled", True),
        "last_run": task.get("last_run"),
        "next_run": task.get("next_run"),
        "created_at": task["created_at"]
    }

@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, update: TaskUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "readonly":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    result = tasks_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = tasks_collection.find_one({"_id": ObjectId(task_id)})
    return {
        "id": str(task["_id"]),
        "name": task["name"],
        "task_type": task["task_type"],
        "command": task.get("command"),
        "schedule": task.get("schedule"),
        "server_ids": task.get("server_ids", []),
        "enabled": task.get("enabled", True),
        "last_run": task.get("last_run"),
        "next_run": task.get("next_run"),
        "created_at": task["created_at"]
    }

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = tasks_collection.delete_one({"_id": ObjectId(task_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    log_activity(current_user["id"], "task_deleted", {"task_id": task_id})
    return {"message": "Task deleted"}

@app.post("/api/tasks/{task_id}/execute")
async def execute_task(task_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "readonly":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    task = tasks_collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Queue task execution
    log_activity(current_user["id"], "task_executed", {"task_id": task_id})
    return {"message": "Task execution queued", "status": "queued"}

# ========================
# Documentation Endpoints
# ========================

@app.get("/api/servers/{server_id}/documentation")
async def get_documentation(server_id: str, current_user: dict = Depends(get_current_user)):
    doc = documentation_collection.find_one({"server_id": server_id}, {"_id": 0})
    if not doc:
        return {"content": "", "content_type": "markdown", "updated_at": None}
    return doc

@app.put("/api/servers/{server_id}/documentation")
async def update_documentation(
    server_id: str,
    doc: DocumentationUpdate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] == "readonly":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    documentation_collection.update_one(
        {"server_id": server_id},
        {
            "$set": {
                "content": doc.content,
                "content_type": doc.content_type,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user["id"]
            }
        },
        upsert=True
    )
    
    log_activity(current_user["id"], "documentation_updated", {"server_id": server_id})
    return {"message": "Documentation updated"}

# ========================
# User Management Endpoints
# ========================

@app.get("/api/users")
async def list_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    users = list(users_collection.find({}, {"password": 0}))
    return [{
        "id": str(u["_id"]),
        "email": u["email"],
        "username": u["username"],
        "role": u["role"],
        "created_at": u["created_at"],
        "last_login": u.get("last_login")
    } for u in users]

@app.post("/api/users", response_model=UserResponse)
async def create_user(user: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    existing = users_collection.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_data = user.model_dump()
    user_data["password"] = pwd_context.hash(user_data["password"])
    user_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    result = users_collection.insert_one(user_data)
    
    log_activity(current_user["id"], "user_created", {"user_id": str(result.inserted_id)})
    
    return {
        "id": str(result.inserted_id),
        "email": user.email,
        "username": user.username,
        "role": user.role,
        "created_at": user_data["created_at"],
        "last_login": None
    }

@app.put("/api/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, update: UserUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin" and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    if "password" in update_data:
        update_data["password"] = pwd_context.hash(update_data["password"])
    
    result = users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "username": user["username"],
        "role": user["role"],
        "created_at": user["created_at"],
        "last_login": user.get("last_login")
    }

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    if current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = users_collection.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    log_activity(current_user["id"], "user_deleted", {"user_id": user_id})
    return {"message": "User deleted"}

# ========================
# Server Groups Endpoints
# ========================

@app.get("/api/server-groups")
async def list_server_groups(current_user: dict = Depends(get_current_user)):
    groups = list(server_groups_collection.find())
    result = []
    for g in groups:
        count = servers_collection.count_documents({"group_id": str(g["_id"])})
        result.append({
            "id": str(g["_id"]),
            "name": g["name"],
            "description": g.get("description"),
            "color": g.get("color", "#22C55E"),
            "server_count": count
        })
    return result

@app.post("/api/server-groups", response_model=ServerGroupResponse)
async def create_server_group(group: ServerGroupBase, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "readonly":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    group_data = group.model_dump()
    result = server_groups_collection.insert_one(group_data)
    
    return {
        "id": str(result.inserted_id),
        "name": group.name,
        "description": group.description,
        "color": group.color,
        "server_count": 0
    }

# ========================
# Agent API Endpoints
# ========================

@app.post("/api/agents/register")
async def register_agent(request: AgentRegisterRequest):
    # Find or create server
    server = servers_collection.find_one({"ip_address": request.ip_address})
    
    api_key = secrets.token_urlsafe(32)
    
    if server:
        servers_collection.update_one(
            {"_id": server["_id"]},
            {
                "$set": {
                    "hostname": request.hostname,
                    "os_type": request.os_type,
                    "os_version": request.os_version,
                    "api_key": api_key,
                    "status": "online",
                    "last_seen": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return {"api_key": api_key, "server_id": str(server["_id"])}
    else:
        server_data = {
            "hostname": request.hostname,
            "ip_address": request.ip_address,
            "os_type": request.os_type,
            "os_version": request.os_version,
            "api_key": api_key,
            "status": "online",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_seen": datetime.now(timezone.utc).isoformat()
        }
        result = servers_collection.insert_one(server_data)
        return {"api_key": api_key, "server_id": str(result.inserted_id)}

@app.post("/api/agents/metrics")
async def receive_metrics(request: AgentMetricsRequest):
    # Verify API key
    server = servers_collection.find_one({"api_key": request.api_key})
    if not server:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    metrics = request.metrics.model_dump()
    metrics["timestamp"] = datetime.now(timezone.utc).isoformat()
    
    # Store in history
    server_metrics_collection.insert_one(metrics)
    
    # Update current metrics
    servers_collection.update_one(
        {"_id": server["_id"]},
        {
            "$set": {
                "metrics": metrics,
                "status": "online",
                "last_seen": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Emit via WebSocket
    await sio.emit('metrics_update', {
        "server_id": str(server["_id"]),
        "metrics": metrics
    })
    
    return {"status": "ok"}

@app.post("/api/agents/heartbeat")
async def agent_heartbeat(api_key: str):
    server = servers_collection.find_one({"api_key": api_key})
    if not server:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    servers_collection.update_one(
        {"_id": server["_id"]},
        {"$set": {"status": "online", "last_seen": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "ok"}

@app.get("/api/agents/commands/{server_id}")
async def get_agent_commands(server_id: str, api_key: str):
    server = servers_collection.find_one({"_id": ObjectId(server_id), "api_key": api_key})
    if not server:
        raise HTTPException(status_code=401, detail="Invalid API key or server")
    
    # Get pending commands for this server
    commands = list(db["agent_commands"].find(
        {"server_id": server_id, "status": "pending"},
        {"_id": 0}
    ))
    
    return commands

@app.post("/api/agents/command-result")
async def agent_command_result(api_key: str, command_id: str, result: dict):
    server = servers_collection.find_one({"api_key": api_key})
    if not server:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    db["agent_commands"].update_one(
        {"command_id": command_id},
        {"$set": {"status": "completed", "result": result, "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "ok"}

# ========================
# Dashboard Stats Endpoint
# ========================

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    total_servers = servers_collection.count_documents({})
    online_servers = servers_collection.count_documents({"status": "online"})
    offline_servers = servers_collection.count_documents({"status": "offline"})
    total_updates = updates_collection.count_documents({})
    
    return {
        "total_servers": total_servers,
        "online_servers": online_servers,
        "offline_servers": offline_servers,
        "unknown_servers": total_servers - online_servers - offline_servers,
        "total_updates_available": total_updates,
        "total_tasks": tasks_collection.count_documents({}),
        "total_users": users_collection.count_documents({})
    }

@app.get("/api/activity-logs")
async def get_activity_logs(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    logs = list(activity_logs_collection.find({}, {"_id": 0}).sort("timestamp", DESCENDING).limit(limit))
    return logs

# ========================
# IP Overview Endpoint
# ========================

@app.get("/api/ip-overview")
async def get_ip_overview(current_user: dict = Depends(get_current_user)):
    servers = list(servers_collection.find({}, {"_id": 1, "hostname": 1, "ip_address": 1, "status": 1, "os_type": 1, "last_seen": 1}))
    return [{
        "id": str(s["_id"]),
        "hostname": s["hostname"],
        "ip_address": s["ip_address"],
        "status": s.get("status", "unknown"),
        "os_type": s.get("os_type", "unknown"),
        "last_seen": s.get("last_seen")
    } for s in servers]

# ========================
# RDP Connection Endpoint
# ========================

@app.get("/api/servers/{server_id}/rdp-file")
async def generate_rdp_file(server_id: str, current_user: dict = Depends(get_current_user)):
    """Generate .rdp file content for Windows server connection"""
    server = servers_collection.find_one({"_id": ObjectId(server_id)})
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if server.get("os_type") != "windows":
        raise HTTPException(status_code=400, detail="RDP only available for Windows servers")
    
    rdp_port = server.get("ssh_port", 3389)  # Use ssh_port field for RDP port
    username = server.get("ssh_username", "")
    
    rdp_content = f"""screen mode id:i:2
use multimon:i:0
desktopwidth:i:1920
desktopheight:i:1080
session bpp:i:32
winposstr:s:0,1,0,0,1920,1080
compression:i:1
keyboardhook:i:2
audiocapturemode:i:0
videoplaybackmode:i:1
connection type:i:7
networkautodetect:i:1
bandwidthautodetect:i:1
displayconnectionbar:i:1
enableworkspacereconnect:i:0
disable wallpaper:i:0
allow font smoothing:i:1
allow desktop composition:i:1
disable full window drag:i:0
disable menu anims:i:0
disable themes:i:0
disable cursor setting:i:0
bitmapcachepersistenable:i:1
full address:s:{server['ip_address']}:{rdp_port}
audiomode:i:0
redirectprinters:i:0
redirectcomports:i:0
redirectsmartcards:i:0
redirectclipboard:i:1
redirectposdevices:i:0
autoreconnection enabled:i:1
authentication level:i:2
prompt for credentials:i:0
negotiate security layer:i:1
remoteapplicationmode:i:0
alternate shell:s:
shell working directory:s:
gatewayhostname:s:
gatewayusagemethod:i:4
gatewaycredentialssource:i:4
gatewayprofileusagemethod:i:0
promptcredentialonce:i:0
gatewaybrokeringtype:i:0
use redirection server name:i:0
rdgiskdcproxy:i:0
kdcproxyname:s:
username:s:{username}
"""
    
    return {
        "filename": f"{server['hostname']}.rdp",
        "content": rdp_content,
        "ip_address": server['ip_address'],
        "port": rdp_port,
        "username": username
    }

# ========================
# Hardware Info Endpoint
# ========================

@app.get("/api/servers/{server_id}/hardware")
async def get_server_hardware(server_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed hardware information for a server"""
    server = servers_collection.find_one({"_id": ObjectId(server_id)})
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    hardware = server.get("hardware", {})
    
    # Return stored hardware info or demo data
    if not hardware:
        hardware = {
            "cpu": {
                "model": "Intel Core i7-12700K",
                "cores": 12,
                "threads": 20,
                "frequency_mhz": 3600,
                "cache_mb": 25
            },
            "memory": {
                "total_gb": 32,
                "type": "DDR4",
                "speed_mhz": 3200,
                "slots": [
                    {"slot": "DIMM_A1", "size_gb": 16, "manufacturer": "Samsung"},
                    {"slot": "DIMM_B1", "size_gb": 16, "manufacturer": "Samsung"}
                ]
            },
            "motherboard": {
                "manufacturer": "ASUS",
                "model": "ROG STRIX Z690-A",
                "bios_version": "2103"
            },
            "network_interfaces": [
                {"name": "eth0", "mac": "00:1A:2B:3C:4D:5E", "speed": "1000 Mbps", "ip": server.get("ip_address")}
            ]
        }
    
    return hardware

# ========================
# Disk Details Endpoint
# ========================

@app.get("/api/servers/{server_id}/disks")
async def get_server_disks(server_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed disk information including SMART data"""
    server = servers_collection.find_one({"_id": ObjectId(server_id)})
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    disks = server.get("disks", [])
    
    # Return stored disk info or demo data
    if not disks:
        disks = [
            {
                "device": "/dev/sda",
                "model": "Samsung SSD 970 EVO Plus 1TB",
                "serial": "S4EWNX0M123456",
                "size_gb": 931,
                "type": "SSD",
                "partitions": [
                    {"mountpoint": "/", "filesystem": "ext4", "size_gb": 500, "used_gb": 125, "percent": 25.0},
                    {"mountpoint": "/home", "filesystem": "ext4", "size_gb": 400, "used_gb": 180, "percent": 45.0}
                ],
                "smart": {
                    "status": "PASSED",
                    "temperature_celsius": 35,
                    "power_on_hours": 8760,
                    "power_cycle_count": 245,
                    "reallocated_sectors": 0,
                    "wear_leveling_count": 98,
                    "health_percent": 98
                }
            },
            {
                "device": "/dev/sdb",
                "model": "WD Red Plus 4TB",
                "serial": "WD-WMC4N0123456",
                "size_gb": 3726,
                "type": "HDD",
                "partitions": [
                    {"mountpoint": "/data", "filesystem": "ext4", "size_gb": 3726, "used_gb": 2100, "percent": 56.4}
                ],
                "smart": {
                    "status": "PASSED",
                    "temperature_celsius": 38,
                    "power_on_hours": 15000,
                    "power_cycle_count": 120,
                    "reallocated_sectors": 0,
                    "spin_retry_count": 0,
                    "health_percent": 95
                }
            }
        ]
    
    return disks

# ========================
# Extended Server Info
# ========================

@app.get("/api/servers/{server_id}/extended")
async def get_server_extended(server_id: str, current_user: dict = Depends(get_current_user)):
    """Get extended server information including last update time"""
    server = servers_collection.find_one({"_id": ObjectId(server_id)})
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    return {
        "id": str(server["_id"]),
        "hostname": server["hostname"],
        "ip_address": server["ip_address"],
        "os_type": server["os_type"],
        "os_version": server.get("os_version"),
        "status": server.get("status", "unknown"),
        "last_seen": server.get("last_seen"),
        "last_metrics_update": server.get("metrics", {}).get("timestamp"),
        "agent_connected": server.get("status") == "online",
        "hardware": server.get("hardware", {}),
        "disks": server.get("disks", []),
        "uptime": server.get("uptime"),
        "created_at": server.get("created_at")
    }

# ========================
# Health Check
# ========================

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ========================
# Socket.IO Events
# ========================

@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def subscribe_server(sid, data):
    server_id = data.get("server_id")
    if server_id:
        await sio.enter_room(sid, f"server_{server_id}")

@sio.event
async def unsubscribe_server(sid, data):
    server_id = data.get("server_id")
    if server_id:
        await sio.leave_room(sid, f"server_{server_id}")

# ========================
# Alert Endpoints
# ========================

@app.get("/api/alerts")
async def list_alerts(
    status: Optional[str] = None,
    server_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List all alerts"""
    query = {}
    if status:
        query["status"] = status
    if server_id:
        query["server_id"] = server_id
    
    alerts = list(alerts_collection.find(query).sort("created_at", DESCENDING).limit(limit))
    return [{
        "id": str(a["_id"]),
        "server_id": a["server_id"],
        "hostname": a.get("hostname"),
        "alert_type": a["alert_type"],
        "severity": a["severity"],
        "message": a["message"],
        "status": a["status"],
        "created_at": a["created_at"],
        "acknowledged": a.get("acknowledged", False),
        "acknowledged_by": a.get("acknowledged_by"),
        "resolved_at": a.get("resolved_at")
    } for a in alerts]

@app.get("/api/alerts/active-count")
async def get_active_alerts_count(current_user: dict = Depends(get_current_user)):
    """Get count of active alerts by severity"""
    critical = alerts_collection.count_documents({"status": "active", "severity": "critical"})
    warning = alerts_collection.count_documents({"status": "active", "severity": "warning"})
    info = alerts_collection.count_documents({"status": "active", "severity": "info"})
    
    return {
        "total": critical + warning + info,
        "critical": critical,
        "warning": warning,
        "info": info
    }

@app.put("/api/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, current_user: dict = Depends(get_current_user)):
    """Acknowledge an alert"""
    result = alerts_collection.update_one(
        {"_id": ObjectId(alert_id)},
        {
            "$set": {
                "acknowledged": True,
                "acknowledged_by": current_user["id"],
                "acknowledged_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert acknowledged"}

@app.put("/api/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, current_user: dict = Depends(get_current_user)):
    """Resolve an alert"""
    result = alerts_collection.update_one(
        {"_id": ObjectId(alert_id)},
        {
            "$set": {
                "status": "resolved",
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "resolved_by": current_user["id"]
            }
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert resolved"}

@app.delete("/api/alerts/{alert_id}")
async def delete_alert(alert_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an alert"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = alerts_collection.delete_one({"_id": ObjectId(alert_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert deleted"}

# ========================
# Alert Rules Endpoints
# ========================

@app.get("/api/alert-rules")
async def list_alert_rules(current_user: dict = Depends(get_current_user)):
    """List all alert rules"""
    rules = list(alert_rules_collection.find())
    return [{
        "id": str(r["_id"]),
        "name": r["name"],
        "metric_type": r["metric_type"],
        "comparison": r.get("comparison", "gt"),
        "threshold": r["threshold"],
        "severity": r["severity"],
        "server_ids": r.get("server_ids", []),
        "enabled": r["enabled"],
        "created_at": r.get("created_at")
    } for r in rules]

@app.post("/api/alert-rules")
async def create_alert_rule(rule: AlertRuleCreate, current_user: dict = Depends(get_current_user)):
    """Create a new alert rule"""
    if current_user["role"] == "readonly":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    rule_data = rule.model_dump()
    rule_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    result = alert_rules_collection.insert_one(rule_data)
    rule_data["id"] = str(result.inserted_id)
    
    return rule_data

@app.put("/api/alert-rules/{rule_id}")
async def update_alert_rule(rule_id: str, update: AlertRuleUpdate, current_user: dict = Depends(get_current_user)):
    """Update an alert rule"""
    if current_user["role"] == "readonly":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    result = alert_rules_collection.update_one(
        {"_id": ObjectId(rule_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    
    rule = alert_rules_collection.find_one({"_id": ObjectId(rule_id)})
    return {
        "id": str(rule["_id"]),
        "name": rule["name"],
        "metric_type": rule["metric_type"],
        "comparison": rule.get("comparison", "gt"),
        "threshold": rule["threshold"],
        "severity": rule["severity"],
        "server_ids": rule.get("server_ids", []),
        "enabled": rule["enabled"]
    }

@app.delete("/api/alert-rules/{rule_id}")
async def delete_alert_rule(rule_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an alert rule"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = alert_rules_collection.delete_one({"_id": ObjectId(rule_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    
    return {"message": "Alert rule deleted"}

# ========================
# SMTP Configuration
# ========================

# Collection for SMTP settings (stored in DB instead of .env for dynamic config)
smtp_config_collection = db["smtp_config"]

def get_smtp_config():
    """Get SMTP configuration from database or fallback to env"""
    config = smtp_config_collection.find_one({}, {"_id": 0})
    if config:
        return config
    return {
        "smtp_host": settings.SMTP_HOST,
        "smtp_port": settings.SMTP_PORT,
        "smtp_user": settings.SMTP_USER,
        "smtp_password": settings.SMTP_PASSWORD,
        "smtp_from": settings.SMTP_FROM,
        "alert_email_to": settings.ALERT_EMAIL_TO
    }

@app.get("/api/settings/smtp")
async def get_smtp_settings(current_user: dict = Depends(get_current_user)):
    """Get SMTP configuration (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    config = get_smtp_config()
    return {
        "smtp_host": config.get("smtp_host", ""),
        "smtp_port": config.get("smtp_port", 587),
        "smtp_user": config.get("smtp_user", ""),
        "smtp_from": config.get("smtp_from", ""),
        "alert_email_to": config.get("alert_email_to", ""),
        "configured": bool(config.get("smtp_host"))
    }

@app.post("/api/settings/smtp")
async def save_smtp_settings(config: SMTPConfigUpdate, current_user: dict = Depends(get_current_user)):
    """Save SMTP configuration (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    config_data = {
        "smtp_host": config.smtp_host,
        "smtp_port": config.smtp_port,
        "smtp_user": config.smtp_user,
        "smtp_password": config.smtp_password,
        "smtp_from": config.smtp_from,
        "alert_email_to": config.alert_email_to,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    smtp_config_collection.replace_one({}, config_data, upsert=True)
    log_activity(current_user["id"], "smtp_config_updated", {"smtp_host": config.smtp_host})
    
    return {"message": "SMTP configuration saved"}

@app.post("/api/settings/smtp/test")
async def test_smtp_settings(current_user: dict = Depends(get_current_user)):
    """Send a test email to verify SMTP configuration"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    config = get_smtp_config()
    
    if not config.get("smtp_host") or not config.get("alert_email_to"):
        raise HTTPException(status_code=400, detail="SMTP not configured")
    
    try:
        msg = MIMEMultipart()
        msg['From'] = config.get("smtp_from") or config.get("smtp_user")
        msg['To'] = config.get("alert_email_to")
        msg['Subject'] = "[Nexus Command] Test Email"
        
        body = "This is a test email from Nexus Command. If you received this, your SMTP configuration is working correctly."
        msg.attach(MIMEText(body, 'plain'))
        
        with smtplib.SMTP(config.get("smtp_host"), config.get("smtp_port", 587)) as server:
            server.starttls()
            if config.get("smtp_user") and config.get("smtp_password"):
                server.login(config.get("smtp_user"), config.get("smtp_password"))
            server.send_message(msg)
        
        return {"message": "Test email sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send test email: {str(e)}")

# ========================
# SSH Terminal Endpoints
# ========================

@app.post("/api/servers/{server_id}/ssh/connect")
async def ssh_connect(server_id: str, request: SSHConnectRequest, current_user: dict = Depends(get_current_user)):
    """Initiate SSH connection to a server"""
    if current_user["role"] == "readonly":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    if paramiko is None:
        raise HTTPException(status_code=500, detail="SSH not available (paramiko not installed)")
    
    server = servers_collection.find_one({"_id": ObjectId(server_id)})
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if server.get("os_type") != "linux":
        raise HTTPException(status_code=400, detail="SSH only available for Linux servers")
    
    # Generate connection ID
    connection_id = secrets.token_urlsafe(16)
    
    # Try to connect
    success = await ssh_manager.connect(
        connection_id=connection_id,
        hostname=server["ip_address"],
        port=server.get("ssh_port", 22),
        username=request.username,
        password=request.password
    )
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to establish SSH connection")
    
    log_activity(current_user["id"], "ssh_connected", {"server_id": server_id, "hostname": server["hostname"]})
    
    return {
        "connection_id": connection_id,
        "message": "SSH connection established"
    }

@app.post("/api/ssh/{connection_id}/send")
async def ssh_send(connection_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Send data to SSH session"""
    if not ssh_manager.is_connected(connection_id):
        raise HTTPException(status_code=400, detail="SSH connection not found")
    
    input_data = data.get("input", "")
    ssh_manager.send_command(connection_id, input_data)
    
    return {"status": "sent"}

@app.get("/api/ssh/{connection_id}/read")
async def ssh_read(connection_id: str, current_user: dict = Depends(get_current_user)):
    """Read output from SSH session"""
    if not ssh_manager.is_connected(connection_id):
        raise HTTPException(status_code=400, detail="SSH connection not found")
    
    output = ssh_manager.read_output(connection_id)
    
    return {"output": output}

@app.post("/api/ssh/{connection_id}/disconnect")
async def ssh_disconnect(connection_id: str, current_user: dict = Depends(get_current_user)):
    """Disconnect SSH session"""
    ssh_manager.disconnect(connection_id)
    
    return {"message": "SSH connection closed"}

@app.post("/api/ssh/{connection_id}/resize")
async def ssh_resize(connection_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Resize SSH terminal"""
    if not ssh_manager.is_connected(connection_id):
        raise HTTPException(status_code=400, detail="SSH connection not found")
    
    cols = data.get("cols", 80)
    rows = data.get("rows", 24)
    
    try:
        if connection_id in ssh_manager.channels:
            ssh_manager.channels[connection_id].resize_pty(width=cols, height=rows)
    except:
        pass
    
    return {"status": "resized"}

# WebSocket for SSH Terminal
@app.websocket("/api/ws/ssh/{connection_id}")
async def ssh_websocket(websocket: WebSocket, connection_id: str):
    """WebSocket endpoint for real-time SSH communication"""
    await websocket.accept()
    
    if not ssh_manager.is_connected(connection_id):
        await websocket.close(code=4000)
        return
    
    try:
        while True:
            # Check for input from client
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                message = json.loads(data)
                
                if message.get("type") == "input":
                    ssh_manager.send_command(connection_id, message.get("data", ""))
                elif message.get("type") == "resize":
                    cols = message.get("cols", 80)
                    rows = message.get("rows", 24)
                    if connection_id in ssh_manager.channels:
                        try:
                            ssh_manager.channels[connection_id].resize_pty(width=cols, height=rows)
                        except:
                            pass
            except asyncio.TimeoutError:
                pass
            
            # Read output and send to client
            output = ssh_manager.read_output(connection_id)
            if output:
                await websocket.send_json({"type": "output", "data": output})
            
            # Check if connection is still alive
            if not ssh_manager.is_connected(connection_id):
                await websocket.send_json({"type": "disconnected"})
                break
            
            await asyncio.sleep(0.05)
            
    except WebSocketDisconnect:
        pass
    finally:
        ssh_manager.disconnect(connection_id)

# ========================
# Run with Socket.IO
# ========================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(socket_app, host="0.0.0.0", port=8001)
