import { useState, useEffect } from 'react';
import { Network, Download, Search, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Layout } from '../components/layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Spinner,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../components/ui';
import { ipOverviewAPI } from '../utils/api';
import { cn } from '../utils/helpers';
import { useToast } from '../hooks/use-toast';

export default function IPOverviewPage() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    fetchIPOverview();
  }, []);

  const fetchIPOverview = async () => {
    try {
      setLoading(true);
      const response = await ipOverviewAPI.get();
      setServers(response.data);
    } catch (err) {
      showError('Failed to load IP overview');
    } finally {
      setLoading(false);
    }
  };

  const filteredServers = servers.filter(server =>
    server.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    server.ip_address.includes(searchTerm)
  );

  const exportToCSV = () => {
    const headers = ['Hostname', 'IP Address', 'OS Type', 'Status'];
    const rows = filteredServers.map(s => [s.hostname, s.ip_address, s.os_type, s.status]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ip_overview.csv';
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('CSV exported');
  };

  return (
    <Layout title="IP Overview">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by hostname or IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 bg-input border border-border pl-10 pr-4 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                data-testid="search-ip"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchIPOverview} data-testid="refresh-ip-btn">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="secondary" onClick={exportToCSV} data-testid="export-csv-btn">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="metric-card">
            <CardContent className="p-4">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Total IPs</p>
              <p className="font-mono text-3xl font-bold text-primary mt-1">{servers.length}</p>
            </CardContent>
          </Card>
          <Card className="metric-card">
            <CardContent className="p-4">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Online</p>
              <p className="font-mono text-3xl font-bold text-online mt-1">
                {servers.filter(s => s.status === 'online').length}
              </p>
            </CardContent>
          </Card>
          <Card className="metric-card">
            <CardContent className="p-4">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Offline</p>
              <p className="font-mono text-3xl font-bold text-destructive mt-1">
                {servers.filter(s => s.status === 'offline').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* IP Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Spinner size="lg" />
              </div>
            ) : filteredServers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Network className="w-12 h-12 mb-4" />
                <p className="font-mono">No servers found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hostname</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>OS Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServers.map((server) => (
                    <TableRow key={server.id}>
                      <TableCell className="font-mono font-medium">{server.hostname}</TableCell>
                      <TableCell>
                        <code className="bg-secondary px-2 py-1 rounded-sm font-mono text-primary">
                          {server.ip_address}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={server.os_type === 'linux' ? 'info' : 'warning'}>
                          {server.os_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {server.status === 'online' ? (
                            <CheckCircle className="w-4 h-4 text-online" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive" />
                          )}
                          <span className={cn(
                            'font-mono text-xs uppercase',
                            server.status === 'online' ? 'text-online' : 'text-destructive'
                          )}>
                            {server.status}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
