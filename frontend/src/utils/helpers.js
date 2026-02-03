// Format bytes to human readable
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Format date
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString();
};

// Format relative time
export const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

// Get status color class
export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'online': return 'bg-online';
    case 'offline': return 'bg-offline';
    case 'warning': return 'bg-warning';
    case 'maintenance': return 'bg-maintenance';
    default: return 'bg-gray-500';
  }
};

// Get severity color
export const getSeverityColor = (severity) => {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'text-red-500 bg-red-500/20';
    case 'high': return 'text-orange-500 bg-orange-500/20';
    case 'medium': return 'text-yellow-500 bg-yellow-500/20';
    case 'low': return 'text-blue-500 bg-blue-500/20';
    default: return 'text-gray-500 bg-gray-500/20';
  }
};

// Get OS icon name
export const getOSIcon = (osType) => {
  switch (osType?.toLowerCase()) {
    case 'linux': return 'terminal';
    case 'windows': return 'monitor';
    default: return 'server';
  }
};

// Calculate percentage
export const calculatePercentage = (used, total) => {
  if (!total) return 0;
  return Math.round((used / total) * 100);
};

// Truncate text
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Parse cron expression to human readable
export const parseCronExpression = (cron) => {
  if (!cron) return 'Not scheduled';
  // Simple cron parsing
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  if (minute === '0' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Daily at ${hour}:00`;
  }
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Daily at ${hour}:${minute.padStart(2, '0')}`;
  }
  
  return cron;
};

// Classname merger
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};
