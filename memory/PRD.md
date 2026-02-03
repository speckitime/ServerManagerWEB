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

## Tech Stack
- **Backend**: FastAPI (Python) + MongoDB
- **Frontend**: React + Tailwind CSS
- **Real-time**: WebSocket ready
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
- [x] **NEW: RDP file generation for Windows**
- [x] **NEW: Hardware information endpoint**
- [x] **NEW: Detailed disk info with SMART data**
- [x] **NEW: Extended server info with last update time**

#### Frontend Pages
- [x] Login page with server room background
- [x] Dashboard with stats cards and server overview
- [x] Server list with search/filter/bulk actions
- [x] Server detail with tabs:
  - Overview (with Live/Last Update indicator)
  - **NEW: Hardware tab** (CPU, Memory with slots, Motherboard, Network)
  - **NEW: Disks tab** (individual disks with serial, SMART data, partitions)
  - Monitoring (charts)
  - Packages
  - Updates
  - Processes
  - Logs
  - Documentation
- [x] Tasks page with scheduler (properly displaying schedule info)
- [x] User management page
- [x] IP Overview with CSV export
- [x] Settings page
- [x] **NEW: RDP button for Windows servers**
- [x] **NEW: SSH button for Linux servers**

#### Agents (Updated 2026-02-03)
- [x] Linux agent with enhanced hardware collection
  - CPU model, cores, threads, frequency
  - RAM details with slots (via dmidecode)
  - Motherboard info
  - Network interfaces with speed
  - **Disk serial numbers** (via hdparm, lsblk, udevadm)
  - **SMART data** (via smartmontools)
  - Auto-install smartmontools if missing
- [x] Windows agent with hardware collection
- [x] Installation scripts for both platforms

### Phase 2 - Agent System (COMPLETED)
- [x] Linux agent with systemd service
- [x] Windows agent with service installation
- [x] Agent registration API
- [x] Heartbeat mechanism
- [x] Command queue system

### Phase 3 - Additional Features (PARTIAL)
- [x] IP Address Overview page
- [ ] SSH Web Terminal (xterm.js integration)
- [ ] Alert System (email notifications)
- [ ] Backup/Restore configuration

---

## Prioritized Backlog

### P0 - Critical (Next Sprint)
- [ ] SSH Web Terminal (xterm.js + WebSocket)
- [ ] Real agent connectivity testing
- [ ] Alert system for server offline

### P1 - High Priority
- [ ] Email alerts on high resource usage
- [ ] Task execution results display
- [ ] Bulk update installation
- [ ] Metrics history persistence

### P2 - Medium Priority
- [ ] Server groups management UI
- [ ] Configuration backup/restore
- [ ] Dark/Light theme toggle

### P3 - Nice to Have
- [ ] Mobile app (React Native)
- [ ] Slack/Discord notifications

---

## Default Credentials
- **Email**: admin@nexuscommand.local
- **Password**: Check backend logs on first start

## Demo Servers (Seeded)
- demo-server (Linux, Ubuntu 22.04)
- prod-web-01 (Linux, Debian 12)
- win-dc-01 (Windows Server 2022)
