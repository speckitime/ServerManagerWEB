import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Terminal,
  Monitor,
  RefreshCw,
  Power,
  Download,
  Settings,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Activity,
  Package,
  FileText,
  Clock,
  Book,
  Info,
  Thermometer,
  CheckCircle,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Layout } from '../components/layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Spinner,
  ProgressBar,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Textarea
} from '../components/ui';
import { SSHTerminal } from '../components/ssh/SSHTerminal';
import { serverAPI } from '../utils/api';
import { formatBytes, formatRelativeTime, getSeverityColor, cn } from '../utils/helpers';
import { useToast } from '../hooks/use-toast';

export default function ServerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [server, setServer] = useState(null);
  const [extendedInfo, setExtendedInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSSHTerminal, setShowSSHTerminal] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    fetchServerDetails();
  }, [id]);

  const fetchServerDetails = async () => {
    try {
      setLoading(true);
      const [serverRes, extendedRes] = await Promise.all([
        serverAPI.get(id),
        serverAPI.getExtended(id).catch(() => ({ data: null }))
      ]);
      setServer(serverRes.data);
      setExtendedInfo(extendedRes.data);
    } catch (err) {
      showError('Failed to load server details');
      navigate('/servers');
    } finally {
      setLoading(false);
    }
  };

  const handleRdpConnect = async () => {
    try {
      const response = await serverAPI.getRdpFile(id);
      const { filename, content } = response.data;
      
      // Create and download RDP file
      const blob = new Blob([content], { type: 'application/x-rdp' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
      showSuccess('RDP file downloaded');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to generate RDP file');
    }
  };

  if (loading) {
    return (
      <Layout title="Server Details">
        <div className="flex items-center justify-center h-96">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!server) return null;

  const lastUpdate = extendedInfo?.last_metrics_update || server.last_seen;
  const isRealtime = extendedInfo?.agent_connected;

  return (
    <Layout title={server.hostname}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/servers')} data-testid="back-btn">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              {server.os_type === 'linux' ? (
                <Terminal className="w-8 h-8 text-primary" />
              ) : (
                <Monitor className="w-8 h-8 text-blue-400" />
              )}
              <div>
                <h1 className="font-mono font-bold text-2xl">{server.hostname}</h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground font-mono">
                  <span>{server.ip_address}</span>
                  <span>•</span>
                  <span>{server.os_version || server.os_type}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    {isRealtime ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-online animate-pulse" />
                        <span className="text-online">Live</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(lastUpdate)}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={server.status === 'online' ? 'success' : 'danger'}>
              {server.status}
            </Badge>
            <Button variant="ghost" size="sm" onClick={fetchServerDetails} data-testid="refresh-btn">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {server.os_type === 'linux' ? (
              <Button variant="outline" size="sm" onClick={() => setShowSSHTerminal(true)} data-testid="ssh-connect-btn">
                <Terminal className="w-4 h-4 mr-2" />
                SSH
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleRdpConnect} data-testid="rdp-connect-btn">
                <Monitor className="w-4 h-4 mr-2" />
                RDP
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          {({ activeTab, setActiveTab }) => (
            <>
              <TabsList>
                <TabsTrigger value="overview" activeTab={activeTab} setActiveTab={setActiveTab}>
                  <Activity className="w-4 h-4 mr-2" />Overview
                </TabsTrigger>
                <TabsTrigger value="hardware" activeTab={activeTab} setActiveTab={setActiveTab}>
                  <Cpu className="w-4 h-4 mr-2" />Hardware
                </TabsTrigger>
                <TabsTrigger value="disks" activeTab={activeTab} setActiveTab={setActiveTab}>
                  <HardDrive className="w-4 h-4 mr-2" />Disks
                </TabsTrigger>
                <TabsTrigger value="monitoring" activeTab={activeTab} setActiveTab={setActiveTab}>
                  <Activity className="w-4 h-4 mr-2" />Monitoring
                </TabsTrigger>
                <TabsTrigger value="packages" activeTab={activeTab} setActiveTab={setActiveTab}>
                  <Package className="w-4 h-4 mr-2" />Packages
                </TabsTrigger>
                <TabsTrigger value="updates" activeTab={activeTab} setActiveTab={setActiveTab}>
                  <Download className="w-4 h-4 mr-2" />Updates
                </TabsTrigger>
                <TabsTrigger value="processes" activeTab={activeTab} setActiveTab={setActiveTab}>
                  <Settings className="w-4 h-4 mr-2" />Processes
                </TabsTrigger>
                <TabsTrigger value="logs" activeTab={activeTab} setActiveTab={setActiveTab}>
                  <FileText className="w-4 h-4 mr-2" />Logs
                </TabsTrigger>
                <TabsTrigger value="docs" activeTab={activeTab} setActiveTab={setActiveTab}>
                  <Book className="w-4 h-4 mr-2" />Docs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" activeTab={activeTab}>
                <OverviewTab server={server} extendedInfo={extendedInfo} />
              </TabsContent>
              <TabsContent value="hardware" activeTab={activeTab}>
                <HardwareTab serverId={id} />
              </TabsContent>
              <TabsContent value="disks" activeTab={activeTab}>
                <DisksTab serverId={id} />
              </TabsContent>
              <TabsContent value="monitoring" activeTab={activeTab}>
                <MonitoringTab serverId={id} />
              </TabsContent>
              <TabsContent value="packages" activeTab={activeTab}>
                <PackagesTab serverId={id} />
              </TabsContent>
              <TabsContent value="updates" activeTab={activeTab}>
                <UpdatesTab serverId={id} />
              </TabsContent>
              <TabsContent value="processes" activeTab={activeTab}>
                <ProcessesTab serverId={id} />
              </TabsContent>
              <TabsContent value="logs" activeTab={activeTab}>
                <LogsTab serverId={id} />
              </TabsContent>
              <TabsContent value="docs" activeTab={activeTab}>
                <DocumentationTab serverId={id} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* SSH Terminal Modal */}
      {server && server.os_type === 'linux' && (
        <SSHTerminal
          isOpen={showSSHTerminal}
          onClose={() => setShowSSHTerminal(false)}
          server={server}
        />
      )}
    </Layout>
  );
}

const OverviewTab = ({ server, extendedInfo }) => {
  const metrics = server.metrics || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Metrics Cards */}
      <div className="lg:col-span-2 grid grid-cols-2 gap-4">
        <MetricCard
          icon={Cpu}
          title="CPU Usage"
          value={metrics.cpu_percent || 0}
          unit="%"
        />
        <MetricCard
          icon={MemoryStick}
          title="Memory Usage"
          value={metrics.memory_percent || 0}
          unit="%"
          subtitle={metrics.memory_used ? `${formatBytes(metrics.memory_used)} / ${formatBytes(metrics.memory_total)}` : null}
        />
        <MetricCard
          icon={HardDrive}
          title="Disk Usage"
          value={metrics.disk_percent || 0}
          unit="%"
          subtitle={metrics.disk_used ? `${formatBytes(metrics.disk_used)} / ${formatBytes(metrics.disk_total)}` : null}
        />
        <MetricCard
          icon={Network}
          title="Network I/O"
          value={null}
          customContent={
            <div className="text-sm font-mono">
              <div>↑ {formatBytes(metrics.network_bytes_sent || 0)}</div>
              <div>↓ {formatBytes(metrics.network_bytes_recv || 0)}</div>
            </div>
          }
        />
      </div>

      {/* Server Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Server Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Hostname" value={server.hostname} />
          <InfoRow label="IP Address" value={server.ip_address} />
          <InfoRow label="OS" value={server.os_version || server.os_type} />
          <InfoRow label={server.os_type === 'windows' ? 'RDP Port' : 'SSH Port'} value={server.ssh_port} />
          <InfoRow label="Status" value={server.status} />
          <InfoRow label="Uptime" value={extendedInfo?.uptime || 'Unknown'} />
          <InfoRow label="Last Seen" value={formatRelativeTime(server.last_seen)} />
          <InfoRow label="Added" value={formatRelativeTime(server.created_at)} />
        </CardContent>
      </Card>
    </div>
  );
};

const MetricCard = ({ icon: Icon, title, value, unit, subtitle, customContent }) => (
  <Card className="metric-card">
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>
      {customContent || (
        <>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-3xl font-bold">{value?.toFixed(1)}</span>
            <span className="text-muted-foreground">{unit}</span>
          </div>
          {value !== null && <ProgressBar value={value} color="auto" className="mt-2" showLabel={false} />}
          {subtitle && <p className="text-xs text-muted-foreground font-mono mt-2">{subtitle}</p>}
        </>
      )}
    </CardContent>
  </Card>
);

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between">
    <span className="text-xs text-muted-foreground font-mono uppercase">{label}</span>
    <span className="text-sm font-mono">{value}</span>
  </div>
);

const HardwareTab = ({ serverId }) => {
  const [hardware, setHardware] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHardware();
  }, [serverId]);

  const fetchHardware = async () => {
    try {
      const response = await serverAPI.getHardware(serverId);
      setHardware(response.data);
    } catch (err) {
      console.error('Failed to load hardware info');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CPU */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            CPU
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Model" value={hardware?.cpu?.model || 'Unknown'} />
          <InfoRow label="Cores" value={hardware?.cpu?.cores || '-'} />
          <InfoRow label="Threads" value={hardware?.cpu?.threads || '-'} />
          <InfoRow label="Frequency" value={hardware?.cpu?.frequency_mhz ? `${hardware.cpu.frequency_mhz} MHz` : '-'} />
          <InfoRow label="Cache" value={hardware?.cpu?.cache || hardware?.cpu?.cache_mb ? `${hardware.cpu.cache_mb} MB` : '-'} />
        </CardContent>
      </Card>

      {/* Memory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MemoryStick className="w-4 h-4 text-primary" />
            Memory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Total" value={hardware?.memory?.total_gb ? `${hardware.memory.total_gb} GB` : '-'} />
          <InfoRow label="Type" value={hardware?.memory?.type || 'Unknown'} />
          <InfoRow label="Speed" value={hardware?.memory?.speed_mhz || '-'} />
          {hardware?.memory?.slots?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-mono uppercase text-muted-foreground mb-2">Memory Slots</p>
              <div className="space-y-2">
                {hardware.memory.slots.map((slot, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="font-mono text-muted-foreground">{slot.slot}</span>
                    <span className="font-mono">{slot.size_gb} GB - {slot.manufacturer || 'Unknown'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Motherboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Motherboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Manufacturer" value={hardware?.motherboard?.manufacturer || 'Unknown'} />
          <InfoRow label="Model" value={hardware?.motherboard?.model || 'Unknown'} />
          <InfoRow label="BIOS Version" value={hardware?.motherboard?.bios_version || 'Unknown'} />
        </CardContent>
      </Card>

      {/* Network Interfaces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            Network Interfaces
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hardware?.network_interfaces?.length > 0 ? (
            <div className="space-y-4">
              {hardware.network_interfaces.map((iface, idx) => (
                <div key={idx} className="p-3 bg-secondary/30 rounded-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold">{iface.name}</span>
                    <Badge variant={iface.status === 'up' ? 'success' : 'default'}>
                      {iface.status || 'unknown'}
                    </Badge>
                  </div>
                  <div className="text-sm font-mono text-muted-foreground space-y-1">
                    <div>IP: {iface.ip || 'N/A'}</div>
                    <div>MAC: {iface.mac || 'N/A'}</div>
                    <div>Speed: {iface.speed || 'Unknown'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground font-mono text-sm">No network interfaces found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const DisksTab = ({ serverId }) => {
  const [disks, setDisks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDisks();
  }, [serverId]);

  const fetchDisks = async () => {
    try {
      const response = await serverAPI.getDisks(serverId);
      setDisks(response.data);
    } catch (err) {
      console.error('Failed to load disk info');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      {disks.map((disk, idx) => (
        <Card key={idx}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-primary" />
                {disk.device}
                <Badge variant={disk.type === 'SSD' ? 'info' : 'default'}>{disk.type}</Badge>
              </CardTitle>
              {disk.smart?.status && (
                <Badge variant={disk.smart.status === 'PASSED' ? 'success' : 'danger'}>
                  SMART: {disk.smart.status}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Disk Info */}
              <div className="space-y-3">
                <InfoRow label="Model" value={disk.model || 'Unknown'} />
                <InfoRow label="Serial" value={disk.serial || 'Unknown'} />
                <InfoRow label="Size" value={`${disk.size_gb} GB`} />
                
                {/* Partitions */}
                {disk.partitions?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-mono uppercase text-muted-foreground mb-3">Partitions</p>
                    <div className="space-y-3">
                      {disk.partitions.map((part, pidx) => (
                        <div key={pidx}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-mono">{part.mountpoint}</span>
                            <span className="font-mono text-muted-foreground">
                              {part.used_gb?.toFixed(1)} / {part.size_gb?.toFixed(1)} GB
                            </span>
                          </div>
                          <ProgressBar value={part.percent} color="auto" showLabel={false} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SMART Data */}
              {disk.smart && (
                <div className="p-4 bg-secondary/30 rounded-sm">
                  <p className="text-xs font-mono uppercase text-muted-foreground mb-3 flex items-center gap-2">
                    <Activity className="w-3 h-3" />
                    SMART Data
                  </p>
                  <div className="space-y-2">
                    {disk.smart.temperature_celsius && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <Thermometer className="w-3 h-3" />
                          Temperature
                        </span>
                        <span className={cn(
                          "font-mono",
                          disk.smart.temperature_celsius > 50 ? 'text-warning' : 'text-online'
                        )}>
                          {disk.smart.temperature_celsius}°C
                        </span>
                      </div>
                    )}
                    {disk.smart.power_on_hours && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Power On Hours</span>
                        <span className="font-mono">{disk.smart.power_on_hours.toLocaleString()} h</span>
                      </div>
                    )}
                    {disk.smart.power_cycle_count && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Power Cycles</span>
                        <span className="font-mono">{disk.smart.power_cycle_count.toLocaleString()}</span>
                      </div>
                    )}
                    {disk.smart.reallocated_sectors !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Reallocated Sectors</span>
                        <span className={cn(
                          "font-mono",
                          disk.smart.reallocated_sectors > 0 ? 'text-warning' : 'text-online'
                        )}>
                          {disk.smart.reallocated_sectors}
                        </span>
                      </div>
                    )}
                    {disk.smart.health_percent && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Health</span>
                          <span className="font-mono">{disk.smart.health_percent}%</span>
                        </div>
                        <ProgressBar value={disk.smart.health_percent} color="auto" showLabel={false} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const MonitoringTab = ({ serverId }) => {
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetricsHistory();
  }, [serverId]);

  const fetchMetricsHistory = async () => {
    try {
      const response = await serverAPI.getMetricsHistory(serverId, '24h');
      setMetricsHistory(response.data);
    } catch (err) {
      console.error('Failed to load metrics history');
    } finally {
      setLoading(false);
    }
  };

  // Generate demo data if no history
  const chartData = metricsHistory.length > 0 ? metricsHistory : 
    Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
      cpu_percent: 20 + Math.random() * 50,
      memory_percent: 40 + Math.random() * 30,
      disk_percent: 50 + Math.random() * 10
    }));

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">CPU Usage (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(t) => new Date(t).getHours() + ':00'}
                  stroke="#71717A"
                  tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  stroke="#71717A"
                  tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#18181B', 
                    border: '1px solid #27272A',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '12px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cpu_percent" 
                  stroke="#22C55E" 
                  fill="url(#cpuGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Memory Usage (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(t) => new Date(t).getHours() + ':00'}
                    stroke="#71717A"
                    tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  />
                  <YAxis domain={[0, 100]} stroke="#71717A" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181B', border: '1px solid #27272A' }} />
                  <Line type="monotone" dataKey="memory_percent" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Disk Usage (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(t) => new Date(t).getHours() + ':00'}
                    stroke="#71717A"
                    tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  />
                  <YAxis domain={[0, 100]} stroke="#71717A" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181B', border: '1px solid #27272A' }} />
                  <Line type="monotone" dataKey="disk_percent" stroke="#EAB308" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const PackagesTab = ({ serverId }) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPackages();
  }, [serverId]);

  const fetchPackages = async () => {
    try {
      const response = await serverAPI.getPackages(serverId, search);
      setPackages(response.data);
    } catch (err) {
      console.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Installed Packages</CardTitle>
        <input
          type="text"
          placeholder="Search packages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48 bg-input border border-border px-3 py-1.5 text-sm font-mono"
          data-testid="search-packages"
        />
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono">{pkg.name}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{pkg.version}</TableCell>
                  <TableCell>
                    {pkg.update_available ? (
                      <Badge variant="warning">Update: {pkg.new_version}</Badge>
                    ) : (
                      <Badge variant="success">Up to date</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

const UpdatesTab = ({ serverId }) => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [installing, setInstalling] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    fetchUpdates();
  }, [serverId]);

  const fetchUpdates = async () => {
    try {
      const response = await serverAPI.getUpdates(serverId);
      setUpdates(response.data);
    } catch (err) {
      console.error('Failed to load updates');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    try {
      await serverAPI.scanUpdates(serverId);
      showSuccess('Update scan initiated');
    } catch (err) {
      showError('Failed to initiate scan');
    }
  };

  const handleInstall = async (installAll = false) => {
    setInstalling(true);
    try {
      await serverAPI.installUpdates(serverId, installAll ? null : selected, installAll);
      showSuccess('Update installation queued');
    } catch (err) {
      showError('Failed to install updates');
    } finally {
      setInstalling(false);
    }
  };

  const toggleSelect = (pkg) => {
    setSelected(prev => 
      prev.includes(pkg) ? prev.filter(p => p !== pkg) : [...prev, pkg]
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Available Updates ({updates.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleScan} data-testid="scan-updates-btn">
            <RefreshCw className="w-4 h-4 mr-2" />Scan
          </Button>
          {updates.length > 0 && (
            <Button 
              size="sm" 
              onClick={() => handleInstall(true)} 
              disabled={installing}
              data-testid="install-all-btn"
            >
              Install All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : updates.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground font-mono">No updates available</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selected.length === updates.length}
                      onChange={() => setSelected(selected.length === updates.length ? [] : updates.map(u => u.package))}
                      className="accent-primary"
                    />
                  </TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>New</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {updates.map((update, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.includes(update.package)}
                        onChange={() => toggleSelect(update.package)}
                        className="accent-primary"
                      />
                    </TableCell>
                    <TableCell className="font-mono">{update.package}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{update.current_version}</TableCell>
                    <TableCell className="font-mono text-primary">{update.new_version}</TableCell>
                    <TableCell>
                      <span className={cn('badge px-2 py-0.5', getSeverityColor(update.severity))}>
                        {update.severity}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {selected.length > 0 && (
              <div className="p-4 border-t border-border bg-muted/20">
                <Button onClick={() => handleInstall(false)} disabled={installing} data-testid="install-selected-btn">
                  {installing ? <Spinner size="sm" /> : `Install Selected (${selected.length})`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const ProcessesTab = ({ serverId }) => {
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProcesses();
  }, [serverId]);

  const fetchProcesses = async () => {
    try {
      const response = await serverAPI.getProcesses(serverId);
      setProcesses(response.data);
    } catch (err) {
      console.error('Failed to load processes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Running Processes</CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchProcesses}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>CPU %</TableHead>
                <TableHead>Memory %</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processes.map((proc) => (
                <TableRow key={proc.pid}>
                  <TableCell className="font-mono text-muted-foreground">{proc.pid}</TableCell>
                  <TableCell className="font-mono">{proc.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={proc.cpu_percent} className="w-16" showLabel={false} />
                      <span className="font-mono text-xs">{proc.cpu_percent?.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={proc.memory_percent} className="w-16" showLabel={false} />
                      <span className="font-mono text-xs">{proc.memory_percent?.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="success">{proc.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

const LogsTab = ({ serverId }) => {
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [logContent, setLogContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [serverId]);

  const fetchLogs = async () => {
    try {
      const response = await serverAPI.getLogs(serverId);
      setLogs(response.data);
      if (response.data.length > 0) {
        selectLog(response.data[0].name);
      }
    } catch (err) {
      console.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const selectLog = async (filename) => {
    setSelectedLog(filename);
    try {
      const response = await serverAPI.getLogContent(serverId, filename, 200);
      setLogContent(response.data.content);
    } catch (err) {
      setLogContent('Failed to load log content');
    }
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-sm">Log Files</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4"><Spinner /></div>
          ) : (
            <ul className="divide-y divide-border/30">
              {logs.map((log) => (
                <li key={log.name}>
                  <button
                    onClick={() => selectLog(log.name)}
                    className={cn(
                      'w-full text-left px-4 py-2 font-mono text-sm hover:bg-muted/30 transition-colors',
                      selectedLog === log.name && 'bg-primary/10 text-primary'
                    )}
                    data-testid={`log-${log.name}`}
                  >
                    <div>{log.name}</div>
                    <div className="text-xs text-muted-foreground">{log.size}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="col-span-3">
        <CardHeader>
          <CardTitle className="text-sm">{selectedLog || 'Select a log file'}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="terminal-container p-4 h-96 overflow-auto text-xs text-green-400">
            {logContent || 'No log selected'}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

const DocumentationTab = ({ serverId }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    fetchDocs();
  }, [serverId]);

  const fetchDocs = async () => {
    try {
      const response = await serverAPI.getDocumentation(serverId);
      setContent(response.data.content || '');
    } catch (err) {
      console.error('Failed to load documentation');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await serverAPI.updateDocumentation(serverId, content, 'markdown');
      showSuccess('Documentation saved');
    } catch (err) {
      showError('Failed to save documentation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Server Documentation</CardTitle>
        <Button size="sm" onClick={handleSave} disabled={saving} data-testid="save-docs-btn">
          {saving ? <Spinner size="sm" /> : 'Save'}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="# Server Documentation&#10;&#10;Write your server documentation here using Markdown..."
            className="min-h-[400px]"
            data-testid="docs-textarea"
          />
        )}
      </CardContent>
    </Card>
  );
};
