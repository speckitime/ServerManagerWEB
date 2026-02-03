import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Shield, User, Eye } from 'lucide-react';
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
import { userAPI } from '../utils/api';
import { formatRelativeTime, cn } from '../utils/helpers';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../hooks/useAuth';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const { showSuccess, showError } = useToast();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userAPI.list();
      setUsers(response.data);
    } catch (err) {
      showError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await userAPI.delete(userId);
      showSuccess('User deleted');
      fetchUsers();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return Shield;
      case 'user': return User;
      case 'readonly': return Eye;
      default: return User;
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin': return 'danger';
      case 'user': return 'info';
      case 'readonly': return 'default';
      default: return 'default';
    }
  };

  return (
    <Layout title="User Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground font-mono text-sm">
            Manage user accounts and permissions
          </p>
          <Button onClick={() => setShowModal(true)} data-testid="add-user-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Spinner size="lg" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const RoleIcon = getRoleIcon(user.role);
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-sm bg-secondary flex items-center justify-center">
                              <RoleIcon className="w-4 h-4" />
                            </div>
                            <span className="font-mono font-medium">{user.username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadge(user.role)}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {formatRelativeTime(user.created_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {formatRelativeTime(user.last_login)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setShowModal(true);
                              }}
                              className="p-1.5 hover:bg-secondary rounded-sm transition-colors"
                              data-testid={`edit-user-${user.username}`}
                            >
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </button>
                            {user.id !== currentUser?.id && (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1.5 hover:bg-destructive/10 rounded-sm transition-colors"
                                data-testid={`delete-user-${user.username}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Form Modal */}
      <UserFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingUser(null);
        }}
        user={editingUser}
        onSuccess={() => {
          setShowModal(false);
          setEditingUser(null);
          fetchUsers();
        }}
      />
    </Layout>
  );
}

const UserFormModal = ({ isOpen, onClose, user, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    role: 'user'
  });
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        username: user.username || '',
        password: '',
        role: user.role || 'user'
      });
    } else {
      setFormData({
        email: '',
        username: '',
        password: '',
        role: 'user'
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = { ...formData };
      if (user && !data.password) {
        delete data.password;
      }

      if (user) {
        await userAPI.update(user.id, data);
        showSuccess('User updated');
      } else {
        await userAPI.create(data);
        showSuccess('User created');
      }
      onSuccess();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? 'Edit User' : 'Add User'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Username"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          placeholder="johndoe"
          required
          data-testid="user-username-input"
        />

        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="john@example.com"
          required
          data-testid="user-email-input"
        />

        <Input
          label={user ? 'Password (leave blank to keep current)' : 'Password'}
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="••••••••"
          required={!user}
          data-testid="user-password-input"
        />

        <Select
          label="Role"
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          options={[
            { value: 'admin', label: 'Admin - Full access' },
            { value: 'user', label: 'User - Can manage servers' },
            { value: 'readonly', label: 'Read Only - View only' }
          ]}
          data-testid="user-role-select"
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} data-testid="save-user-btn">
            {loading ? <Spinner size="sm" /> : user ? 'Update' : 'Create User'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
