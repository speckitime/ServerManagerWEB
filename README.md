# Nexus Command

A modern web-based server management system with agent-based architecture for centralized Linux and Windows server administration.

![Dashboard](https://via.placeholder.com/800x400?text=Nexus+Command+Dashboard)

## Features

- **Dashboard** - Real-time overview of all servers with status indicators
- **Server Management** - Add, edit, delete servers with filtering and search
- **Monitoring** - Live CPU, RAM, Disk, and Network metrics with charts
- **Package Management** - View installed packages and available updates
- **Task Scheduler** - Schedule automated tasks (updates, reboots, scripts)
- **User Management** - Role-based access control (admin/user/readonly)
- **Log Viewer** - Browse and search server log files
- **Documentation** - Per-server documentation with Markdown support
- **IP Overview** - Centralized IP address management with export

## Tech Stack

- **Backend**: FastAPI (Python) + MongoDB
- **Frontend**: React + Tailwind CSS
- **Agents**: Python (Linux/Windows)

## Quick Start

### Requirements
- Python 3.8+
- Node.js 18+
- MongoDB 6.0+

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

### Frontend
```bash
cd frontend
yarn install
yarn start
```

### Default Login
- **Email**: admin@nexuscommand.local
- **Password**: Check backend logs on first start

## Agent Installation

### Linux
```bash
curl -sSL https://your-server/agents/linux/install.sh | sudo bash
```

### Windows (PowerShell as Admin)
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
Invoke-WebRequest -Uri https://your-server/agents/windows/install.ps1 | Invoke-Expression
```

## Project Structure

```
/app/
├── backend/           # FastAPI backend
│   ├── server.py      # Main API server
│   └── .env           # Environment config
├── frontend/          # React frontend
│   ├── src/
│   │   ├── pages/     # Page components
│   │   ├── components/ # UI components
│   │   └── utils/     # Helpers & API
│   └── public/
├── agents/            # Server agents
│   ├── linux/         # Linux agent
│   └── windows/       # Windows agent
└── docs/              # Documentation
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/auth/login | POST | JWT authentication |
| /api/servers | GET/POST | List/Create servers |
| /api/servers/{id} | GET/PUT/DELETE | Server operations |
| /api/servers/{id}/metrics | GET | Current metrics |
| /api/tasks | GET/POST | Task management |
| /api/users | GET/POST | User management (admin) |

## License

MIT License

## Screenshots

### Dashboard
Server overview with real-time metrics and activity feed.

### Server List
Searchable, filterable table with bulk actions.

### Server Details
Comprehensive view with monitoring charts, packages, logs, and documentation.

### Task Scheduler
Create and manage automated tasks with cron scheduling.
