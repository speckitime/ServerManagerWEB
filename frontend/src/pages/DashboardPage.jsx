import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Server,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  RefreshCw,
  ArrowUpRight,
  Cpu,
  HardDrive,
  MemoryStick
} from 'lucide-react';
import { Layout } from '../components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Spinner, ProgressBar } from '../components/ui';
import { dashboardAPI, serverAPI } from '../utils/api';
import { formatBytes, formatRelativeTime, cn } from '../utils/helpers';
import { useToast } from '../hooks/use-toast';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [servers, setServers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showError } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, serversRes, activitiesRes] = await Promise.all([
        dashboardAPI.getStats(),
        serverAPI.list(),
        dashboardAPI.getActivityLogs(10)
      ]);
      setStats(statsRes.data);
      setServers(serversRes.data);
      setActivities(activitiesRes.data);
    } catch (err) {
      showError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center h-96">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Servers"
            value={stats?.total_servers || 0}
            icon={Server}
            color="primary"
            testId="stat-total-servers"
          />
          <StatCard
            title="Online"
            value={stats?.online_servers || 0}
            icon={CheckCircle}
            color="success"
            testId="stat-online-servers"
          />
          <StatCard
            title="Offline"
            value={stats?.offline_servers || 0}
            icon={XCircle}
            color="danger"
            testId="stat-offline-servers"
          />
          <StatCard
            title="Updates Available"
            value={stats?.total_updates_available || 0}
            icon={AlertTriangle}
            color="warning"
            testId="stat-updates"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Server Cards */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-mono font-bold uppercase tracking-wider text-lg">
                Server Overview
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchDashboardData}
                  data-testid="refresh-dashboard-btn"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Link to="/servers?action=add">
                  <Button size="sm" data-testid="add-server-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Server
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {servers.slice(0, 4).map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </div>

            {servers.length > 4 && (
              <Link to="/servers" className="block">
                <Button variant="outline" className="w-full" data-testid="view-all-servers-btn">
                  View All Servers ({servers.length})
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>

          {/* Activity Feed */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/30">
                  {activities.length > 0 ? (
                    activities.map((activity, idx) => (
                      <ActivityItem key={idx} activity={activity} />
                    ))
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground font-mono">
                      No recent activity
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

const StatCard = ({ title, value, icon: Icon, color, testId }) => {
  const colors = {
    primary: 'text-primary',
    success: 'text-online',
    danger: 'text-destructive',
    warning: 'text-warning'
  };

  return (
    <Card hover className="metric-card" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            <p className={cn('font-mono text-3xl font-bold mt-1', colors[color])}>
              {value}
            </p>
          </div>
          <div className={cn('p-3 rounded-sm bg-secondary', colors[color])}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ServerCard = ({ server }) => {
  const statusColors = {
    online: 'status-online',
    offline: 'status-offline',
    unknown: 'status-unknown'
  };

  return (
    <Link to={`/servers/${server.id}`}>
      <Card hover className="server-card" data-testid={`server-card-${server.hostname}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', statusColors[server.status])} />
                <h3 className="font-mono font-bold">{server.hostname}</h3>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {server.ip_address}
              </p>
            </div>
            <Badge variant={server.os_type === 'linux' ? 'info' : 'warning'}>
              {server.os_type}
            </Badge>
          </div>

          {server.metrics && (
            <div className="space-y-3">
              <MetricRow
                icon={Cpu}
                label="CPU"
                value={server.metrics.cpu_percent}
              />
              <MetricRow
                icon={MemoryStick}
                label="RAM"
                value={server.metrics.memory_percent}
              />
              <MetricRow
                icon={HardDrive}
                label="Disk"
                value={server.metrics.disk_percent}
              />
            </div>
          )}

          <p className="text-xs text-muted-foreground font-mono mt-4">
            Last seen: {formatRelativeTime(server.last_seen)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
};

const MetricRow = ({ icon: Icon, label, value }) => {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div className="flex-1">
        <ProgressBar value={value} color="auto" showLabel={false} />
      </div>
      <span className="font-mono text-xs w-12 text-right">{value?.toFixed(1)}%</span>
    </div>
  );
};

const ActivityItem = ({ activity }) => {
  const actionIcons = {
    server_created: Server,
    server_updated: Server,
    server_deleted: Server,
    login: CheckCircle,
    logout: XCircle,
    task_created: Activity,
    task_executed: Activity
  };

  const Icon = actionIcons[activity.action] || Activity;

  return (
    <div className="p-4 hover:bg-muted/10 transition-colors">
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 text-muted-foreground mt-0.5" />
        <div>
          <p className="text-sm font-mono">
            {activity.action.replace(/_/g, ' ')}
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {formatRelativeTime(activity.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
};
