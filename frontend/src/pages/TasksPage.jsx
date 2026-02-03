import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Play, Pause, Clock, Server, RefreshCw } from 'lucide-react';
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
  Textarea,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../components/ui';
import { taskAPI, serverAPI } from '../utils/api';
import { formatRelativeTime, parseCronExpression, cn } from '../utils/helpers';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../hooks/useAuth';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksRes, serversRes] = await Promise.all([
        taskAPI.list(),
        serverAPI.list()
      ]);
      setTasks(tasksRes.data);
      setServers(serversRes.data);
    } catch (err) {
      showError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await taskAPI.delete(taskId);
      showSuccess('Task deleted');
      fetchData();
    } catch (err) {
      showError('Failed to delete task');
    }
  };

  const handleExecuteTask = async (taskId) => {
    try {
      await taskAPI.execute(taskId);
      showSuccess('Task execution queued');
    } catch (err) {
      showError('Failed to execute task');
    }
  };

  return (
    <Layout title="Tasks">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground font-mono text-sm">
            Schedule and manage automated tasks across your servers
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchData} data-testid="refresh-tasks-btn">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {user?.role !== 'readonly' && (
              <Button onClick={() => setShowModal(true)} data-testid="create-task-btn">
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            )}
          </div>
        </div>

        {/* Tasks List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Spinner size="lg" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Clock className="w-12 h-12 mb-4" />
                <p className="font-mono">No tasks configured</p>
                {user?.role !== 'readonly' && (
                  <Button className="mt-4" onClick={() => setShowModal(true)}>
                    Create Your First Task
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Servers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono font-medium">{task.name}</TableCell>
                      <TableCell>
                        <Badge variant={
                          task.task_type === 'update' ? 'info' :
                          task.task_type === 'reboot' ? 'warning' : 'default'
                        }>
                          {task.task_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {parseCronExpression(task.schedule)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Server className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono">{task.server_ids?.length || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.enabled ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="default">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {formatRelativeTime(task.last_run)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {user?.role !== 'readonly' && (
                            <>
                              <button
                                onClick={() => handleExecuteTask(task.id)}
                                className="p-1.5 hover:bg-primary/10 rounded-sm transition-colors"
                                title="Run Now"
                                data-testid={`run-task-${task.name}`}
                              >
                                <Play className="w-4 h-4 text-primary" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTask(task);
                                  setShowModal(true);
                                }}
                                className="p-1.5 hover:bg-secondary rounded-sm transition-colors"
                                data-testid={`edit-task-${task.name}`}
                              >
                                <Edit className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </>
                          )}
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 hover:bg-destructive/10 rounded-sm transition-colors"
                              data-testid={`delete-task-${task.name}`}
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

      {/* Task Form Modal */}
      <TaskFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingTask(null);
        }}
        task={editingTask}
        servers={servers}
        onSuccess={() => {
          setShowModal(false);
          setEditingTask(null);
          fetchData();
        }}
      />
    </Layout>
  );
}

const TaskFormModal = ({ isOpen, onClose, task, servers, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    task_type: 'update',
    command: '',
    schedule: '0 3 * * *',
    server_ids: [],
    enabled: true
  });
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name || '',
        task_type: task.task_type || 'update',
        command: task.command || '',
        schedule: task.schedule || '0 3 * * *',
        server_ids: task.server_ids || [],
        enabled: task.enabled !== false
      });
    } else {
      setFormData({
        name: '',
        task_type: 'update',
        command: '',
        schedule: '0 3 * * *',
        server_ids: [],
        enabled: true
      });
    }
  }, [task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (task) {
        await taskAPI.update(task.id, formData);
        showSuccess('Task updated');
      } else {
        await taskAPI.create(formData);
        showSuccess('Task created');
      }
      onSuccess();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const toggleServer = (serverId) => {
    setFormData(prev => ({
      ...prev,
      server_ids: prev.server_ids.includes(serverId)
        ? prev.server_ids.filter(id => id !== serverId)
        : [...prev.server_ids, serverId]
    }));
  };

  const schedulePresets = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every day at 3 AM', value: '0 3 * * *' },
    { label: 'Every week (Sunday 3 AM)', value: '0 3 * * 0' },
    { label: 'Every month (1st at 3 AM)', value: '0 3 1 * *' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? 'Edit Task' : 'Create Task'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Task Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Daily system updates"
          required
          data-testid="task-name-input"
        />

        <Select
          label="Task Type"
          value={formData.task_type}
          onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
          options={[
            { value: 'update', label: 'Auto Update' },
            { value: 'reboot', label: 'Reboot' },
            { value: 'custom', label: 'Custom Command' }
          ]}
          data-testid="task-type-select"
        />

        {formData.task_type === 'custom' && (
          <Textarea
            label="Command"
            value={formData.command}
            onChange={(e) => setFormData({ ...formData, command: e.target.value })}
            placeholder="apt update && apt upgrade -y"
            rows={3}
            data-testid="task-command-input"
          />
        )}

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Schedule (Cron Expression)
          </label>
          <div className="flex gap-2 mb-2">
            {schedulePresets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setFormData({ ...formData, schedule: preset.value })}
                className={cn(
                  'px-2 py-1 text-xs font-mono rounded-sm transition-colors',
                  formData.schedule === preset.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Input
            value={formData.schedule}
            onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
            placeholder="0 3 * * *"
            data-testid="task-schedule-input"
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Target Servers
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-input border border-border">
            {servers.map((server) => (
              <label
                key={server.id}
                className="flex items-center gap-2 p-2 hover:bg-muted/30 cursor-pointer rounded-sm"
              >
                <input
                  type="checkbox"
                  checked={formData.server_ids.includes(server.id)}
                  onChange={() => toggleServer(server.id)}
                  className="accent-primary"
                />
                <span className="font-mono text-sm">{server.hostname}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {formData.server_ids.length} server(s) selected
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="accent-primary"
          />
          <label htmlFor="enabled" className="font-mono text-sm">Enable task</label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} data-testid="save-task-btn">
            {loading ? <Spinner size="sm" /> : task ? 'Update' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
