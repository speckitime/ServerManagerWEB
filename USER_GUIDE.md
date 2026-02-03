# Nexus Command - User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Dashboard](#dashboard)
3. [Server Management](#server-management)
4. [Alerts](#alerts)
5. [Tasks](#tasks)
6. [User Management](#user-management)
7. [Settings](#settings)

---

## Getting Started

### Logging In
1. Navigate to your Nexus Command URL (e.g., `https://nexuscommand.yourcompany.com`)
2. Enter your email and password
3. Click "Access System"

### First Time Setup
1. **Change Password**: Go to Settings and update your password
2. **Configure SMTP**: Set up email notifications for alerts
3. **Install Agents**: Deploy agents on your servers
4. **Add Servers**: Servers with agents will auto-register, or add manually

---

## Dashboard

The dashboard provides a real-time overview of your infrastructure:

### Statistics Cards
- **Total Servers**: Count of all managed servers
- **Online**: Servers currently responding
- **Offline**: Servers not responding (>5 minutes)
- **Updates Available**: Pending system updates
- **Active Alerts**: Current alert count (click to view alerts)

### Server Overview
Shows a quick view of your servers with:
- Status indicator (green = online, red = offline)
- CPU, Memory, and Disk usage bars
- Last seen timestamp

### Recent Activity
Timeline of recent actions:
- Server additions/removals
- Task executions
- User logins/logouts

---

## Server Management

### Server List
Navigate to **Servers** in the sidebar to see all your servers.

#### Filtering & Search
- **Search**: Filter by hostname or IP address
- **OS Filter**: Show only Linux or Windows servers
- **Status Filter**: Show online/offline servers

#### Bulk Actions
Select multiple servers to perform actions like:
- Restart selected servers
- Run updates on selected servers
- Delete selected servers

### Server Details
Click on any server to see detailed information:

#### Tabs

**Overview**
- Real-time CPU, Memory, Disk usage
- Network I/O statistics
- Server information (IP, OS, SSH/RDP port)
- Last seen timestamp with live indicator

**Hardware**
- CPU model, cores, threads, frequency
- RAM details with DIMM slots
- Motherboard information
- Network interfaces

**Disks**
- Individual disk information
- Partition details
- SMART health status
- Serial numbers

**Monitoring**
- Historical charts for CPU, Memory, Disk
- Time range selection (1h, 6h, 24h, 7d)

**Packages**
- Installed packages list
- Search functionality
- Version information

**Updates**
- Available updates with severity
- Update installation options

**Processes**
- Running processes list
- CPU/Memory usage per process

**Logs**
- System log files
- Real-time log viewing

**Docs**
- Custom documentation per server
- Markdown support

### Connecting to Servers

#### SSH (Linux)
1. Click the **SSH** button on a Linux server's detail page
2. Enter your SSH username and password
3. Click **Connect**
4. Use the web terminal to execute commands

#### RDP (Windows)
1. Click the **RDP** button on a Windows server's detail page
2. Download the `.rdp` file
3. Open the file with Remote Desktop Connection
4. Enter credentials when prompted

### Adding Servers

#### Automatic (Recommended)
Install the agent on your server:
```bash
# Linux
curl -sSL https://your-nexuscommand-server/agents/linux/install.sh | sudo bash -s -- --server https://your-nexuscommand-server

# Windows (PowerShell as Admin)
.\install.ps1 -ServerUrl "https://your-nexuscommand-server"
```

#### Manual
1. Click **Add Server** on the server list page
2. Fill in server details:
   - Hostname
   - IP Address
   - OS Type (Linux/Windows)
   - SSH/RDP Port
   - Credentials (optional)
3. Click **Create**

---

## Alerts

Navigate to **Alerts** in the sidebar to manage notifications.

### Alert Overview
- **Total Active**: All unresolved alerts
- **Critical**: Urgent issues requiring immediate attention
- **Warning**: Issues that should be addressed soon
- **Info**: Informational alerts

### Alert List
Shows all alerts with:
- Server name
- Alert type and severity
- Message
- Timestamp
- Status (Active/Acknowledged/Resolved)

### Managing Alerts
- **Acknowledge**: Mark that you've seen the alert
- **Resolve**: Mark the issue as fixed
- **Delete**: Remove the alert (admin only)

### Alert Rules
Configure when alerts should be triggered:

1. Click **Alert Rules** button
2. Click **Add Rule** to create a new rule
3. Configure:
   - **Name**: Descriptive name
   - **Metric**: CPU, Memory, or Disk
   - **Condition**: Greater than, Less than, Equal to
   - **Threshold**: Percentage value
   - **Severity**: Info, Warning, or Critical
4. Click **Create**

#### Default Rules
- High CPU Usage (>90%)
- High Memory Usage (>90%)
- Disk Space Critical (>95%)

---

## Tasks

Navigate to **Tasks** in the sidebar to manage scheduled operations.

### Task Types
- **Update**: Run system updates
- **Reboot**: Restart servers
- **Custom**: Execute custom commands

### Creating Tasks
1. Click **Add Task**
2. Configure:
   - **Name**: Task name
   - **Type**: Update, Reboot, or Custom
   - **Command**: For custom tasks
   - **Schedule**: Cron expression (e.g., `0 3 * * *` for daily at 3 AM)
   - **Servers**: Select target servers
3. Click **Create**

### Cron Schedule Examples
| Expression | Description |
|------------|-------------|
| `0 3 * * *` | Daily at 3:00 AM |
| `0 0 * * 0` | Weekly on Sunday at midnight |
| `0 */6 * * *` | Every 6 hours |
| `0 0 1 * *` | Monthly on the 1st at midnight |

### Task Actions
- **Enable/Disable**: Toggle task execution
- **Execute Now**: Run the task immediately
- **Edit**: Modify task configuration
- **Delete**: Remove the task

---

## User Management

Navigate to **Users** in the sidebar (Admin only).

### User Roles
- **Admin**: Full access to all features
- **User**: Can view and manage servers/tasks, cannot manage users
- **Readonly**: View-only access

### Adding Users
1. Click **Add User**
2. Enter:
   - Email address
   - Username
   - Password
   - Role
3. Click **Create**

### Managing Users
- **Edit**: Change user details or role
- **Delete**: Remove user (cannot delete yourself)

---

## Settings

Navigate to **Settings** in the sidebar.

### Profile
View your account information:
- Username
- Email
- Role

### SMTP Configuration (Admin only)
Configure email notifications for alerts:

1. Enter SMTP server details:
   - **Host**: SMTP server address (e.g., smtp.gmail.com)
   - **Port**: Usually 587 (TLS) or 465 (SSL)
   - **Username**: SMTP login
   - **Password**: SMTP password or app password
   - **From Address**: Sender email address
   - **Alert Recipient**: Email to receive alerts

2. Click **Save**
3. Click **Send Test Email** to verify configuration

### Agent Installation
Shows installation commands for Linux and Windows agents.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Global search |
| `Esc` | Close modal/dialog |
| `?` | Show shortcuts (coming soon) |

---

## Tips & Best Practices

### Security
- Change the default admin password immediately
- Use strong, unique passwords
- Enable HTTPS with a valid SSL certificate
- Regularly update the system

### Monitoring
- Set up alert rules for critical thresholds
- Configure SMTP for email notifications
- Review alerts dashboard regularly

### Maintenance
- Schedule updates during low-traffic periods
- Test tasks on non-production servers first
- Keep server documentation up-to-date

### Performance
- Install agents for real-time monitoring
- Use server groups for organization
- Archive old alerts periodically
