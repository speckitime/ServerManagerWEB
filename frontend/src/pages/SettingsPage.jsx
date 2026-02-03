import { Layout } from '../components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/use-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const { showSuccess } = useToast();

  return (
    <Layout title="Settings">
      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Profile Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Username"
              value={user?.username || ''}
              disabled
            />
            <Input
              label="Email"
              value={user?.email || ''}
              disabled
            />
            <Input
              label="Role"
              value={user?.role || ''}
              disabled
            />
          </CardContent>
        </Card>

        {/* Agent Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Agent Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-secondary/50 rounded-sm">
              <p className="font-mono text-sm text-muted-foreground mb-2">
                Linux Agent Installation:
              </p>
              <pre className="bg-background p-3 rounded-sm overflow-x-auto text-xs font-mono text-primary">
{`curl -sSL https://your-server/agents/linux/install.sh | sudo bash`}
              </pre>
            </div>
            <div className="p-4 bg-secondary/50 rounded-sm">
              <p className="font-mono text-sm text-muted-foreground mb-2">
                Windows Agent Installation:
              </p>
              <pre className="bg-background p-3 rounded-sm overflow-x-auto text-xs font-mono text-primary">
{`Invoke-WebRequest -Uri https://your-server/agents/windows/install.ps1 | Invoke-Expression`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span>1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Status</span>
                <span className="text-online">Online</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
