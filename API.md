# Nexus Command - API Documentation

## Base URL
```
https://your-nexuscommand-server/api
```

## Authentication

All API endpoints (except `/api/auth/login` and `/api/health`) require JWT authentication.

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@nexuscommand.local",
  "password": "your-password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "email": "admin@nexuscommand.local",
    "username": "admin",
    "role": "admin",
    "created_at": "2024-01-01T00:00:00Z",
    "last_login": "2024-01-15T10:30:00Z"
  }
}
```

### Using the Token
Include the token in the Authorization header:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## Endpoints

### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### Authentication

#### Login
```http
POST /api/auth/login
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

---

### Servers

#### List Servers
```http
GET /api/servers
Authorization: Bearer <token>
```

Query Parameters:
- `status` (optional): Filter by status (online, offline, unknown)
- `os_type` (optional): Filter by OS (linux, windows)
- `group_id` (optional): Filter by server group
- `search` (optional): Search by hostname or IP

**Response:**
```json
[
  {
    "id": "...",
    "hostname": "demo-server",
    "ip_address": "192.168.1.100",
    "os_type": "linux",
    "os_version": "Ubuntu 22.04",
    "description": "Demo server",
    "ssh_port": 22,
    "status": "online",
    "group_id": null,
    "tags": ["demo", "linux"],
    "last_seen": "2024-01-15T10:30:00Z",
    "created_at": "2024-01-01T00:00:00Z",
    "metrics": {
      "cpu_percent": 25.5,
      "memory_percent": 45.2,
      "disk_percent": 55.0
    }
  }
]
```

#### Get Server
```http
GET /api/servers/{server_id}
Authorization: Bearer <token>
```

#### Create Server
```http
POST /api/servers
Authorization: Bearer <token>
Content-Type: application/json

{
  "hostname": "new-server",
  "ip_address": "192.168.1.101",
  "os_type": "linux",
  "os_version": "Ubuntu 22.04",
  "description": "New server description",
  "ssh_port": 22,
  "ssh_username": "admin",
  "ssh_password": "secret",
  "tags": ["production"]
}
```

#### Update Server
```http
PUT /api/servers/{server_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Updated description",
  "tags": ["production", "web"]
}
```

#### Delete Server
```http
DELETE /api/servers/{server_id}
Authorization: Bearer <token>
```

#### Get Server Hardware
```http
GET /api/servers/{server_id}/hardware
Authorization: Bearer <token>
```

**Response:**
```json
{
  "cpu": {
    "model": "Intel Core i7-12700K",
    "cores": 12,
    "threads": 20,
    "frequency_mhz": 3600
  },
  "memory": {
    "total_gb": 32,
    "type": "DDR4",
    "speed_mhz": 3200,
    "slots": [
      {"slot": "DIMM_A1", "size_gb": 16, "manufacturer": "Samsung"}
    ]
  },
  "motherboard": {
    "manufacturer": "ASUS",
    "model": "ROG STRIX Z690-A"
  },
  "network_interfaces": [
    {"name": "eth0", "mac": "00:1A:2B:3C:4D:5E", "ip": "192.168.1.100"}
  ]
}
```

#### Get Server Disks
```http
GET /api/servers/{server_id}/disks
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "device": "/dev/sda",
    "model": "Samsung SSD 970 EVO Plus 1TB",
    "serial": "S4EWNX0M123456",
    "size_gb": 931,
    "type": "SSD",
    "partitions": [
      {"mountpoint": "/", "filesystem": "ext4", "size_gb": 500, "used_gb": 125, "percent": 25.0}
    ],
    "smart": {
      "status": "PASSED",
      "temperature_celsius": 35,
      "power_on_hours": 8760,
      "health_percent": 98
    }
  }
]
```

#### Generate RDP File (Windows only)
```http
GET /api/servers/{server_id}/rdp-file
Authorization: Bearer <token>
```

**Response:**
```json
{
  "filename": "win-server.rdp",
  "content": "full address:s:192.168.1.100:3389\n...",
  "ip_address": "192.168.1.100",
  "port": 3389,
  "username": "Administrator"
}
```

---

### SSH Terminal

#### Connect SSH
```http
POST /api/servers/{server_id}/ssh/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "root",
  "password": "server-password"
}
```

**Response:**
```json
{
  "connection_id": "uuid-string",
  "status": "connected"
}
```

#### SSH WebSocket
```
WS /api/ws/ssh/{connection_id}
```

Messages:
```json
// Send input
{"type": "input", "data": "ls -la\n"}

// Receive output
{"type": "output", "data": "total 12\ndrwxr-xr-x..."}

// Resize terminal
{"type": "resize", "cols": 120, "rows": 40}
```

#### Disconnect SSH
```http
POST /api/ssh/{connection_id}/disconnect
Authorization: Bearer <token>
```

---

### Alerts

#### List Alerts
```http
GET /api/alerts
Authorization: Bearer <token>
```

Query Parameters:
- `status` (optional): active, acknowledged, resolved
- `server_id` (optional): Filter by server
- `limit` (optional): Number of results (default: 50)

**Response:**
```json
[
  {
    "id": "...",
    "server_id": "...",
    "hostname": "demo-server",
    "alert_type": "high_cpu",
    "severity": "warning",
    "message": "CPU usage is 95.2% (threshold: 90%)",
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z",
    "acknowledged": false,
    "acknowledged_by": null,
    "resolved_at": null
  }
]
```

#### Get Active Alerts Count
```http
GET /api/alerts/active-count
Authorization: Bearer <token>
```

**Response:**
```json
{
  "total": 5,
  "critical": 2,
  "warning": 3,
  "info": 0
}
```

#### Acknowledge Alert
```http
PUT /api/alerts/{alert_id}/acknowledge
Authorization: Bearer <token>
```

#### Resolve Alert
```http
PUT /api/alerts/{alert_id}/resolve
Authorization: Bearer <token>
```

#### Delete Alert
```http
DELETE /api/alerts/{alert_id}
Authorization: Bearer <token>
```

---

### Alert Rules

#### List Alert Rules
```http
GET /api/alert-rules
Authorization: Bearer <token>
```

#### Create Alert Rule
```http
POST /api/alert-rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "High CPU Usage",
  "metric_type": "cpu",
  "comparison": "gt",
  "threshold": 90.0,
  "severity": "warning",
  "server_ids": [],
  "enabled": true
}
```

#### Update Alert Rule
```http
PUT /api/alert-rules/{rule_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "threshold": 85.0,
  "enabled": false
}
```

#### Delete Alert Rule
```http
DELETE /api/alert-rules/{rule_id}
Authorization: Bearer <token>
```

---

### SMTP Settings

#### Get SMTP Settings
```http
GET /api/settings/smtp
Authorization: Bearer <token>
```

**Response:**
```json
{
  "smtp_host": "smtp.example.com",
  "smtp_port": 587,
  "smtp_user": "alerts@example.com",
  "smtp_from": "alerts@example.com",
  "alert_email_to": "admin@example.com",
  "configured": true
}
```

#### Save SMTP Settings
```http
POST /api/settings/smtp
Authorization: Bearer <token>
Content-Type: application/json

{
  "smtp_host": "smtp.example.com",
  "smtp_port": 587,
  "smtp_user": "alerts@example.com",
  "smtp_password": "password",
  "smtp_from": "alerts@example.com",
  "alert_email_to": "admin@example.com"
}
```

#### Test SMTP
```http
POST /api/settings/smtp/test
Authorization: Bearer <token>
```

---

### Tasks

#### List Tasks
```http
GET /api/tasks
Authorization: Bearer <token>
```

#### Create Task
```http
POST /api/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Daily Updates",
  "task_type": "update",
  "command": "apt update && apt upgrade -y",
  "schedule": "0 3 * * *",
  "server_ids": ["server-id-1", "server-id-2"],
  "enabled": true
}
```

#### Update Task
```http
PUT /api/tasks/{task_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": false
}
```

#### Execute Task
```http
POST /api/tasks/{task_id}/execute
Authorization: Bearer <token>
```

#### Delete Task
```http
DELETE /api/tasks/{task_id}
Authorization: Bearer <token>
```

---

### Users (Admin only)

#### List Users
```http
GET /api/users
Authorization: Bearer <token>
```

#### Create User
```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "newuser",
  "password": "securepassword",
  "role": "user"
}
```

#### Update User
```http
PUT /api/users/{user_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "admin"
}
```

#### Delete User
```http
DELETE /api/users/{user_id}
Authorization: Bearer <token>
```

---

### Agent API (For Agents)

#### Register Agent
```http
POST /api/agents/register
Content-Type: application/json

{
  "hostname": "server-hostname",
  "ip_address": "192.168.1.100",
  "os_type": "linux",
  "os_version": "Ubuntu 22.04"
}
```

**Response:**
```json
{
  "api_key": "generated-api-key",
  "server_id": "server-id"
}
```

#### Send Metrics
```http
POST /api/agents/metrics
Content-Type: application/json

{
  "api_key": "agent-api-key",
  "metrics": {
    "server_id": "...",
    "cpu_percent": 25.5,
    "memory_percent": 45.2,
    "memory_used": 4000000000,
    "memory_total": 8000000000,
    "disk_percent": 55.0,
    "disk_used": 50000000000,
    "disk_total": 100000000000,
    "network_bytes_sent": 1500000000,
    "network_bytes_recv": 3200000000,
    "processes": [],
    "disks": [],
    "hardware": {},
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Heartbeat
```http
POST /api/agents/heartbeat?api_key=agent-api-key
```

---

## Error Responses

All error responses follow this format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

Common HTTP Status Codes:
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production deployments.

---

## WebSocket Events

Connect to Socket.IO for real-time updates:

```javascript
const socket = io('https://your-nexuscommand-server');

// Subscribe to server updates
socket.emit('subscribe_server', { server_id: 'server-id' });

// Receive metrics updates
socket.on('metrics_update', (data) => {
  console.log('Metrics:', data);
});

// Receive new alerts
socket.on('new_alert', (data) => {
  console.log('Alert:', data);
});
```
