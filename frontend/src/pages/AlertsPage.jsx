import { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  RefreshCw,
  Trash2,
  Settings,
  Plus,
  Server,
  Cpu,
  HardDrive,
  MemoryStick
} from 'lucide-react';
import { Layout } from '../components/layout';
import {
  Card,
  CardHeader,
  CardTitle,
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
import { formatRelativeTime, cn } from '../utils/helpers';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [alertRules, setAlertRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [alertCounts, setAlertCounts] = useState({ total: 0, critical: 0, warning: 0, info: 0 });
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [alertsRes, rulesRes, countsRes] = await Promise.all([
        api.get('/api/alerts?limit=100'),
        api.get('/api/alert-rules'),
        api.get('/api/alerts/active-count')
      ]);
      setAlerts(alertsRes.data);
      setAlertRules(rulesRes.data);
      setAlertCounts(countsRes.data);
    } catch (err) {
      showError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await api.put(`/api/alerts/${alertId}/acknowledge`);
      showSuccess('Alert acknowledged');
      fetchData();
    } catch (err) {
      showError('Failed to acknowledge alert');
    }
  };

  const handleResolve = async (alertId) => {
    try {
      await api.put(`/api/alerts/${alertId}/resolve`);
      showSuccess('Alert resolved');
      fetchData();
    } catch (err) {
      showError('Failed to resolve alert');
    }
  };

  const handleDelete = async (alertId) => {
    if (!window.confirm('Delete this alert?')) return;
    try {
      await api.delete(`/api/alerts/${alertId}`);
      showSuccess('Alert deleted');
      fetchData();
    } catch (err) {
      showError('Failed to delete alert');
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return AlertCircle;
      case 'warning': return AlertTriangle;
      default: return Info;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-destructive bg-destructive/20';
      case 'warning': return 'text-warning bg-warning/20';
      default: return 'text-blue-400 bg-blue-400/20';
    }
  };

  return (
    <Layout title="Alerts">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            title="Total Active" 
            value={alertCounts.total} 
            icon={Bell} 
            color="primary"
          />
          <StatCard 
            title="Critical" 
            value={alertCounts.critical} 
            icon={AlertCircle} 
            color="danger"
          />
          <StatCard 
            title="Warning" 
            value={alertCounts.warning} 
            icon={AlertTriangle} 
            color="warning"
          />
          <StatCard 
            title="Info" 
            value={alertCounts.info} 
            icon={Info} 
            color="info"
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground font-mono text-sm">
            Monitor server alerts and configure notification rules
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchData} data-testid="refresh-alerts-btn">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {user?.role !== 'readonly' && (
              <Button variant="secondary" onClick={() => setShowRulesModal(true)} data-testid="manage-rules-btn">
                <Settings className="w-4 h-4 mr-2" />
                Alert Rules
              </Button>
            )}
          </div>
        </div>

        {/* Alerts List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Spinner size="lg" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mb-4 text-online" />
                <p className="font-mono">All systems operational - No alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {alerts.map((alert) => {
                  const SeverityIcon = getSeverityIcon(alert.severity);
                  return (
                    <div 
                      key={alert.id} 
                      className={cn(
                        'p-4 hover:bg-muted/10 transition-colors',
                        alert.status === 'resolved' && 'opacity-60'
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          'p-2 rounded-sm',
                          getSeverityColor(alert.severity)
                        )}>
                          <SeverityIcon className="w-5 h-5" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold">{alert.hostname}</span>
                            <Badge variant={
                              alert.severity === 'critical' ? 'danger' :
                              alert.severity === 'warning' ? 'warning' : 'info'
                            }>
                              {alert.severity}
                            </Badge>
                            <Badge variant={alert.status === 'resolved' ? 'success' : 'default'}>
                              {alert.status}
                            </Badge>
                            {alert.acknowledged && (
                              <Badge variant="info">Acknowledged</Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-foreground mb-1">{alert.message}</p>
                          
                          <p className="text-xs text-muted-foreground font-mono">
                            {alert.alert_type.replace(/_/g, ' ')} • {formatRelativeTime(alert.created_at)}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {alert.status !== 'resolved' && !alert.acknowledged && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleAcknowledge(alert.id)}
                              data-testid={`ack-alert-${alert.id}`}
                            >
                              Acknowledge
                            </Button>
                          )}
                          {alert.status !== 'resolved' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleResolve(alert.id)}
                              data-testid={`resolve-alert-${alert.id}`}
                            >
                              Resolve
                            </Button>
                          )}
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => handleDelete(alert.id)}
                              className="p-1.5 hover:bg-destructive/10 rounded-sm transition-colors"
                              data-testid={`delete-alert-${alert.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alert Rules Modal */}
      <AlertRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        rules={alertRules}
        onRefresh={fetchData}
      />
    </Layout>
  );
}

const StatCard = ({ title, value, icon: Icon, color }) => {
  const colors = {
    primary: 'text-primary',
    danger: 'text-destructive',
    warning: 'text-warning',
    info: 'text-blue-400'
  };

  return (
    <Card className="metric-card">
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

const AlertRulesModal = ({ isOpen, onClose, rules, onRefresh }) => {
  const [editingRule, setEditingRule] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Delete this alert rule?')) return;
    try {
      await api.delete(`/api/alert-rules/${ruleId}`);
      showSuccess('Alert rule deleted');
      onRefresh();
    } catch (err) {
      showError('Failed to delete alert rule');
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      await api.put(`/api/alert-rules/${rule.id}`, { enabled: !rule.enabled });
      showSuccess(`Rule ${rule.enabled ? 'disabled' : 'enabled'}`);
      onRefresh();
    } catch (err) {
      showError('Failed to update rule');
    }
  };

  const getMetricIcon = (type) => {
    switch (type) {
      case 'cpu': return Cpu;
      case 'memory': return MemoryStick;
      case 'disk': return HardDrive;
      default: return Server;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Alert Rules" size="lg">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Configure when alerts should be triggered
          </p>
          {user?.role !== 'readonly' && (
            <Button size="sm" onClick={() => { setEditingRule(null); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {rules.map((rule) => {
            const MetricIcon = getMetricIcon(rule.metric_type);
            return (
              <div 
                key={rule.id}
                className={cn(
                  'p-3 bg-secondary/30 rounded-sm border border-border/50',
                  !rule.enabled && 'opacity-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MetricIcon className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-mono font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {rule.metric_type.toUpperCase()} {rule.comparison === 'gt' ? '>' : rule.comparison === 'lt' ? '<' : '='} {rule.threshold}%
                        <span className="ml-2">• Severity: {rule.severity}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={rule.enabled ? 'success' : 'default'}>
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                    {user?.role !== 'readonly' && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleToggleRule(rule)}
                        >
                          {rule.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => { setEditingRule(rule); setShowForm(true); }}
                        >
                          Edit
                        </Button>
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 hover:bg-destructive/10 rounded-sm"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showForm && (
          <AlertRuleForm
            rule={editingRule}
            onClose={() => setShowForm(false)}
            onSuccess={() => { setShowForm(false); onRefresh(); }}
          />
        )}
      </div>
    </Modal>
  );
};

const AlertRuleForm = ({ rule, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    metric_type: rule?.metric_type || 'cpu',
    comparison: rule?.comparison || 'gt',
    threshold: rule?.threshold || 90,
    severity: rule?.severity || 'warning',
    enabled: rule?.enabled !== false
  });
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (rule) {
        await api.put(`/api/alert-rules/${rule.id}`, formData);
        showSuccess('Alert rule updated');
      } else {
        await api.post('/api/alert-rules', formData);
        showSuccess('Alert rule created');
      }
      onSuccess();
    } catch (err) {
      showError('Failed to save alert rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-border pt-4 mt-4">
      <h4 className="font-mono text-sm mb-4">{rule ? 'Edit Rule' : 'New Alert Rule'}</h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Rule Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="High CPU Usage"
          required
        />

        <div className="grid grid-cols-3 gap-4">
          <Select
            label="Metric"
            value={formData.metric_type}
            onChange={(e) => setFormData({ ...formData, metric_type: e.target.value })}
            options={[
              { value: 'cpu', label: 'CPU' },
              { value: 'memory', label: 'Memory' },
              { value: 'disk', label: 'Disk' }
            ]}
          />
          <Select
            label="Condition"
            value={formData.comparison}
            onChange={(e) => setFormData({ ...formData, comparison: e.target.value })}
            options={[
              { value: 'gt', label: 'Greater than' },
              { value: 'lt', label: 'Less than' },
              { value: 'eq', label: 'Equal to' }
            ]}
          />
          <Input
            label="Threshold (%)"
            type="number"
            value={formData.threshold}
            onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
            min={0}
            max={100}
          />
        </div>

        <Select
          label="Severity"
          value={formData.severity}
          onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
          options={[
            { value: 'info', label: 'Info' },
            { value: 'warning', label: 'Warning' },
            { value: 'critical', label: 'Critical' }
          ]}
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="accent-primary"
          />
          <label htmlFor="enabled" className="font-mono text-sm">Enable rule</label>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Spinner size="sm" /> : rule ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  );
};
