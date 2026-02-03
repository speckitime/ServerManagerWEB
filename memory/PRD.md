# Nexus Command - Server Management System

## Project Overview
**Nexus Command** is a comprehensive web-based server management system with agent-based architecture for centralized Linux and Windows server administration.

## User Personas
1. **System Administrators** - Manage multiple servers, monitor resources, deploy updates
2. **DevOps Engineers** - Automate tasks, view logs, manage deployments
3. **IT Managers** - Overview dashboards, user management, audit trails

## Core Requirements
- Dashboard with server status overview
- Server management (add, edit, delete servers)
- Real-time monitoring (CPU, RAM, Disk, Network)
- Package management and update scanning
- Task scheduling (cron-like)
- User management with roles (admin/user/readonly)
- Log viewing and documentation per server
- Agent-based data collection
- SSH Web Terminal for Linux servers
- Alert System with email notifications

## Tech Stack
- **Backend**: FastAPI (Python) + MongoDB
- **Frontend**: React + Tailwind CSS
- **Real-time**: WebSocket (SSH Terminal, Alerts)
- **SSH**: Paramiko + xterm.js
- **Design**: Retro-futurism / Terminal aesthetic ("Nexus Command" identity)

---

## What's Been Implemented

### Phase 1 - Core System (COMPLETED - 2026-02-03)

#### Backend API
- [x] Authentication (JWT login/logout)
- [x] Server CRUD operations
- [x] Server metrics endpoints
- [x] Package management APIs
- [x] Update scanning endpoints
- [x] Log file viewing
- [x] Task scheduling APIs
- [x] User management (admin only)
- [x] Server groups
- [x] Activity logging
- [x] Dashboard statistics
- [x] IP overview endpoint
- [x] Agent registration/metrics API
- [x] RDP file generation for Windows
- [x] Hardware information endpoint
- [x] Detailed disk info with SMART data
- [x] Extended server info with last update time

#### Frontend Pages
- [x] Login page with server room background
- [x] Dashboard with stats cards and server overview
- [x] Server list with search/filter/bulk actions
- [x] Server detail with tabs:
  - Overview (with Live/Last Update indicator)
  - Hardware tab (CPU, Memory with slots, Motherboard, Network)
  - Disks tab (individual disks with serial, SMART data, partitions)
  - Monitoring (charts)
  - Packages
  - Updates
  - Processes
  - Logs
  - Documentation
- [x] Tasks page with scheduler
- [x] User management page
- [x] IP Overview with CSV export
- [x] Settings page
- [x] RDP button for Windows servers
- [x] SSH button for Linux servers

### Phase 2 - SSH Web Terminal (COMPLETED - 2026-02-03)
- [x] SSH Terminal component with xterm.js
- [x] WebSocket proxy for SSH connections
- [x] Credential input form for SSH auth
- [x] Terminal resize handling
- [x] Disconnect/reconnect functionality
- [x] Full integration in Server Detail page

### Phase 3 - Alert System (COMPLETED - 2026-02-03)
- [x] Alert page with navigation (Sidebar)
- [x] Alert statistics (Total Active, Critical, Warning, Info)
- [x] Alert list with acknowledge/resolve actions
- [x] Alert Rules management (CRUD)
- [x] Default alert rules (High CPU, High Memory, Disk Critical)
- [x] AlertManager background service
- [x] Server offline detection
- [x] Resource threshold monitoring
- [x] SMTP Configuration UI in Settings page
- [x] SMTP settings stored in MongoDB
- [x] Test email functionality
- [x] Email notifications for alerts

### Phase 4 - Agent System (COMPLETED)
- [x] Linux agent with systemd service
- [x] Windows agent with service installation
- [x] Agent registration API
- [x] Heartbeat mechanism
- [x] Command queue system
- [x] Enhanced hardware collection
- [x] SMART disk data collection

---

## Prioritized Backlog

### P0 - Critical (Next Sprint)
- [x] Main install.sh deployment script (COMPLETED - 2026-02-03)
- [x] Agent installer scripts (COMPLETED - 2026-02-03)
- [x] Documentation files (COMPLETED - 2026-02-03)
- [x] Alert Badge on Dashboard (COMPLETED - 2026-02-03)

### P1 - High Priority
- [ ] Task execution results display
- [ ] Bulk update installation
- [ ] Metrics history persistence
- [ ] Real agent connectivity testing

### P2 - Medium Priority
- [ ] Server groups management UI
- [ ] Configuration backup/restore (JSON export/import)
- [ ] Dark/Light theme toggle
- [ ] IP Address Overview page enhancements

### P3 - Nice to Have
- [ ] Mobile app (React Native)
- [ ] Slack/Discord notifications
- [ ] Backend code refactoring (split server.py into modules)

---

## Default Credentials
- **Email**: admin@nexuscommand.local
- **Password**: KG4GaMYWiNBxsYFW (check backend logs on first start)

## Demo Servers (Seeded)
- demo-server (Linux, Ubuntu 22.04)
- prod-web-01 (Linux, Debian 12)
- win-dc-01 (Windows Server 2022)

## API Documentation

### Key Endpoints
- `POST /api/auth/login` - User login
- `GET /api/servers` - List all servers
- `GET /api/servers/{id}` - Server details
- `GET /api/servers/{id}/hardware` - Hardware info
- `GET /api/servers/{id}/disks` - Disk/SMART data
- `GET /api/servers/{id}/rdp-file` - Generate RDP file (Windows)
- `POST /api/servers/{id}/ssh/connect` - Initiate SSH (Linux)
- `WS /api/ws/ssh/{connection_id}` - SSH WebSocket terminal
- `GET /api/alerts` - List alerts
- `GET /api/alert-rules` - List alert rules
- `POST /api/settings/smtp` - Save SMTP config
- `POST /api/settings/smtp/test` - Send test email
