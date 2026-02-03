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

#### Frontend Pages
- [x] Login page with server room background
- [x] Dashboard with stats cards and server overview
- [x] Server list with search/filter/bulk actions
- [x] Server detail with 8 tabs (Overview, Monitoring, Packages, Updates, Processes, Logs, Tasks, Docs)
- [x] Tasks page with scheduler
- [x] User management page
- [x] IP Overview with CSV export
- [x] Settings page

#### Agents
- [x] Linux agent (Python) with install.sh
- [x] Windows agent (Python) with install.ps1
- [x] Metrics collection (CPU, RAM, Disk, Network, Processes)
- [x] Command execution support
- [x] Package scanning support

### Phase 2 - Agent System (COMPLETED)
- [x] Linux agent with systemd service
- [x] Windows agent with service installation
- [x] Agent registration API
- [x] Heartbeat mechanism
- [x] Command queue system

### Phase 3 - Additional Features (PARTIAL)
- [x] IP Address Overview page
- [ ] Alert System (email notifications)
- [ ] Backup/Restore configuration

---

## Prioritized Backlog

### P0 - Critical (Next Sprint)
- [ ] SSH Web Terminal (xterm.js integration)
- [ ] RDP file generation for Windows servers
- [ ] Real agent connectivity testing

### P1 - High Priority
- [ ] Alert system (email on server offline/high usage)
- [ ] Metrics history graphs with more data points
- [ ] Task execution results display
- [ ] Bulk update installation

### P2 - Medium Priority
- [ ] Server groups management UI
- [ ] Configuration backup/restore
- [ ] PDF export for IP overview
- [ ] Dark/Light theme toggle

### P3 - Nice to Have
- [ ] Mobile app (React Native)
- [ ] Slack/Discord notifications
- [ ] API rate limiting visualization
- [ ] Custom dashboard widgets

---

## Next Tasks
1. Test agents on real Linux/Windows servers
2. Implement SSH terminal with xterm.js
3. Add email alert system (SMTP configuration)
4. Enhance metrics history with longer retention
5. Create user guide documentation

---

## Default Credentials
- **Email**: admin@nexuscommand.local
- **Password**: Check backend logs on first start (randomly generated)

## Demo Servers (Seeded)
- demo-server (Linux, Ubuntu 22.04)
- prod-web-01 (Linux, Debian 12)
- win-dc-01 (Windows Server 2022)
