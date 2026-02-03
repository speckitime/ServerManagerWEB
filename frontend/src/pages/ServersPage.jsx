import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Server,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Terminal,
  Monitor,
  Trash2,
  Edit,
  MoreVertical,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Layout } from '../components/layout';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Spinner,
  Modal,
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../components/ui';
import { serverAPI } from '../utils/api';
import { formatRelativeTime, cn } from '../utils/helpers';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../hooks/useAuth';

export default function ServersPage() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [osFilter, setOsFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [selectedServers, setSelectedServers] = useState([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchServers();
    if (searchParams.get('action') === 'add') {
      setShowAddModal(true);
    }
  }, []);

  const fetchServers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (osFilter) params.os_type = osFilter;
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      
      const response = await serverAPI.list(params);
      setServers(response.data);
    } catch (err) {
      showError('Failed to load servers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchServers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, osFilter, statusFilter]);

  const handleDeleteServer = async (serverId) => {
    if (!window.confirm('Are you sure you want to delete this server?')) return;
    
    try {
      await serverAPI.delete(serverId);
      showSuccess('Server deleted');
      fetchServers();
    } catch (err) {
      showError('Failed to delete server');
    }
  };

  const toggleSelectServer = (serverId) => {
    setSelectedServers(prev => 
      prev.includes(serverId)
        ? prev.filter(id => id !== serverId)
        : [...prev, serverId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedServers.length === servers.length) {
      setSelectedServers([]);
    } else {
      setSelectedServers(servers.map(s => s.id));
    }
  };

  return (
    <Layout title="Servers">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search servers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 bg-input border border-border pl-10 pr-4 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                data-testid="search-servers"
              />
            </div>
            
            <select
              value={osFilter}
              onChange={(e) => setOsFilter(e.target.value)}
              className="bg-input border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="filter-os"
            >
              <option value="">All OS</option>
              <option value="linux">Linux</option>
              <option value="windows">Windows</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-input border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="filter-status"
            >
              <option value="">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchServers} data-testid="refresh-servers-btn">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {user?.role !== 'readonly' && (
              <Button onClick={() => setShowAddModal(true)} data-testid="add-server-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Server
              </Button>
            )}
          </div>
        </div>

        {/* Selected Actions */}
        {selectedServers.length > 0 && (
          <div className="flex items-center gap-4 p-3 bg-primary/10 border border-primary/20 rounded-sm">
            <span className="font-mono text-sm">
              {selectedServers.length} server(s) selected
            </span>
            <Button variant="secondary" size="sm" onClick={() => setSelectedServers([])}>
              Clear Selection
            </Button>
          </div>
        )}

        {/* Servers Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Spinner size="lg" />
              </div>
            ) : servers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Server className="w-12 h-12 mb-4" />
                <p className="font-mono">No servers found</p>
                {user?.role !== 'readonly' && (
                  <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                    Add Your First Server
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedServers.length === servers.length}
                        onChange={toggleSelectAll}
                        className="accent-primary"
                      />
                    </TableHead>
                    <TableHead>Hostname</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>CPU</TableHead>
                    <TableHead>RAM</TableHead>
                    <TableHead>Disk</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servers.map((server) => (
                    <TableRow 
                      key={server.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/servers/${server.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedServers.includes(server.id)}
                          onChange={() => toggleSelectServer(server.id)}
                          className="accent-primary"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {server.os_type === 'linux' ? (
                            <Terminal className="w-4 h-4 text-primary" />
                          ) : (
                            <Monitor className="w-4 h-4 text-blue-400" />
                          )}
                          <span className="font-mono font-medium">{server.hostname}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {server.ip_address}
                      </TableCell>
                      <TableCell>
                        <Badge variant={server.os_type === 'linux' ? 'info' : 'warning'}>
                          {server.os_version || server.os_type}
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
                      <TableCell className="font-mono">
                        {server.metrics?.cpu_percent?.toFixed(1) || '-'}%
                      </TableCell>
                      <TableCell className="font-mono">
                        {server.metrics?.memory_percent?.toFixed(1) || '-'}%
                      </TableCell>
                      <TableCell className="font-mono">
                        {server.metrics?.disk_percent?.toFixed(1) || '-'}%
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {formatRelativeTime(server.last_seen)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {user?.role !== 'readonly' && (
                            <button
                              onClick={() => setEditingServer(server)}
                              className="p-1.5 hover:bg-secondary rounded-sm transition-colors"
                              data-testid={`edit-server-${server.hostname}`}
                            >
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </button>
                          )}
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => handleDeleteServer(server.id)}
                              className="p-1.5 hover:bg-destructive/10 rounded-sm transition-colors"
                              data-testid={`delete-server-${server.hostname}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          )}
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

      {/* Add/Edit Server Modal */}
      <ServerFormModal
        isOpen={showAddModal || !!editingServer}
        onClose={() => {
          setShowAddModal(false);
          setEditingServer(null);
        }}
        server={editingServer}
        onSuccess={() => {
          setShowAddModal(false);
          setEditingServer(null);
          fetchServers();
        }}
      />
    </Layout>
  );
}

const ServerFormModal = ({ isOpen, onClose, server, onSuccess }) => {
  const [formData, setFormData] = useState({
    hostname: '',
    ip_address: '',
    os_type: 'linux',
    os_version: '',
    description: '',
    ssh_port: 22,
    ssh_username: '',
    ssh_password: '',
    tags: []
  });
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (server) {
      setFormData({
        hostname: server.hostname || '',
        ip_address: server.ip_address || '',
        os_type: server.os_type || 'linux',
        os_version: server.os_version || '',
        description: server.description || '',
        ssh_port: server.ssh_port || 22,
        ssh_username: '',
        ssh_password: '',
        tags: server.tags || []
      });
    } else {
      setFormData({
        hostname: '',
        ip_address: '',
        os_type: 'linux',
        os_version: '',
        description: '',
        ssh_port: 22,
        ssh_username: '',
        ssh_password: '',
        tags: []
      });
    }
  }, [server]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (server) {
        await serverAPI.update(server.id, formData);
        showSuccess('Server updated');
      } else {
        await serverAPI.create(formData);
        showSuccess('Server added');
      }
      onSuccess();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to save server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={server ? 'Edit Server' : 'Add Server'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Hostname"
            value={formData.hostname}
            onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
            placeholder="web-server-01"
            required
            data-testid="server-hostname-input"
          />
          <Input
            label="IP Address"
            value={formData.ip_address}
            onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
            placeholder="192.168.1.100"
            required
            data-testid="server-ip-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Operating System"
            value={formData.os_type}
            onChange={(e) => setFormData({ ...formData, os_type: e.target.value })}
            options={[
              { value: 'linux', label: 'Linux' },
              { value: 'windows', label: 'Windows' }
            ]}
            data-testid="server-os-select"
          />
          <Input
            label="OS Version"
            value={formData.os_version}
            onChange={(e) => setFormData({ ...formData, os_version: e.target.value })}
            placeholder="Ubuntu 22.04"
            data-testid="server-os-version-input"
          />
        </div>

        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Production web server"
          data-testid="server-description-input"
        />

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="SSH/RDP Port"
            type="number"
            value={formData.ssh_port}
            onChange={(e) => setFormData({ ...formData, ssh_port: parseInt(e.target.value) })}
            data-testid="server-port-input"
          />
          <Input
            label="Username"
            value={formData.ssh_username}
            onChange={(e) => setFormData({ ...formData, ssh_username: e.target.value })}
            placeholder="root"
            data-testid="server-username-input"
          />
          <Input
            label="Password"
            type="password"
            value={formData.ssh_password}
            onChange={(e) => setFormData({ ...formData, ssh_password: e.target.value })}
            placeholder="••••••••"
            data-testid="server-password-input"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} data-testid="save-server-btn">
            {loading ? <Spinner size="sm" /> : server ? 'Update' : 'Add Server'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
