import { useState, useEffect } from 'react';
import { Mail, Check, Send, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Layout } from '../components/layout';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  Button, 
  Input,
  Spinner,
  Badge
} from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/use-toast';
import api from '../utils/api';

export default function SettingsPage() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [smtpConfig, setSmtpConfig] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_from: '',
    alert_email_to: ''
  });
  const [smtpStatus, setSmtpStatus] = useState({ configured: false, loading: true });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchSMTPConfig();
  }, []);

  const fetchSMTPConfig = async () => {
    try {
      const response = await api.get('/api/settings/smtp');
      setSmtpConfig({
        smtp_host: response.data.smtp_host || '',
        smtp_port: response.data.smtp_port || 587,
        smtp_user: response.data.smtp_user || '',
        smtp_password: '',
        smtp_from: response.data.smtp_from || '',
        alert_email_to: response.data.alert_email_to || ''
      });
      setSmtpStatus({ configured: response.data.configured, loading: false });
    } catch (err) {
      setSmtpStatus({ configured: false, loading: false });
    }
  };

  const handleSaveSMTP = async () => {
    if (!smtpConfig.smtp_host || !smtpConfig.smtp_user || !smtpConfig.alert_email_to) {
      showError('Bitte füllen Sie alle erforderlichen Felder aus');
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/settings/smtp', smtpConfig);
      showSuccess('SMTP-Konfiguration gespeichert');
      setSmtpStatus({ configured: true, loading: false });
    } catch (err) {
      showError('Fehler beim Speichern der SMTP-Konfiguration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSMTP = async () => {
    setTesting(true);
    try {
      await api.post('/api/settings/smtp/test');
      showSuccess('Test-E-Mail erfolgreich gesendet!');
    } catch (err) {
      showError(err.response?.data?.detail || 'Test-E-Mail konnte nicht gesendet werden');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Layout title="Einstellungen">
      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Profil-Einstellungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Benutzername"
              value={user?.username || ''}
              disabled
            />
            <Input
              label="E-Mail"
              value={user?.email || ''}
              disabled
            />
            <Input
              label="Rolle"
              value={user?.role || ''}
              disabled
            />
          </CardContent>
        </Card>

        {/* SMTP Configuration */}
        {user?.role === 'admin' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  SMTP / E-Mail-Konfiguration
                </CardTitle>
                {smtpStatus.loading ? (
                  <Spinner size="sm" />
                ) : (
                  <Badge variant={smtpStatus.configured ? 'success' : 'warning'}>
                    {smtpStatus.configured ? 'Konfiguriert' : 'Nicht konfiguriert'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground font-mono">
                Konfigurieren Sie Ihren SMTP-Server für Alert-E-Mails.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="SMTP-Host *"
                  placeholder="smtp.example.com"
                  value={smtpConfig.smtp_host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_host: e.target.value })}
                  data-testid="smtp-host-input"
                />
                <Input
                  label="SMTP-Port"
                  type="number"
                  placeholder="587"
                  value={smtpConfig.smtp_port}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_port: parseInt(e.target.value) || 587 })}
                  data-testid="smtp-port-input"
                />
              </div>

              <Input
                label="SMTP-Benutzer *"
                placeholder="user@example.com"
                value={smtpConfig.smtp_user}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_user: e.target.value })}
                data-testid="smtp-user-input"
              />

              <div className="relative">
                <Input
                  label="SMTP-Passwort"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={smtpConfig.smtp_password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_password: e.target.value })}
                  data-testid="smtp-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-8 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Input
                label="Absender-Adresse (From)"
                placeholder="alerts@example.com"
                value={smtpConfig.smtp_from}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_from: e.target.value })}
                data-testid="smtp-from-input"
              />

              <div className="border-t border-border pt-4 mt-4">
                <Input
                  label="Alert-Empfänger E-Mail *"
                  placeholder="admin@example.com"
                  value={smtpConfig.alert_email_to}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, alert_email_to: e.target.value })}
                  data-testid="smtp-alert-email-input"
                />
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  An diese Adresse werden Alert-Benachrichtigungen gesendet.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button 
                  onClick={handleSaveSMTP} 
                  disabled={saving}
                  data-testid="smtp-save-btn"
                >
                  {saving ? <Spinner size="sm" /> : <Check className="w-4 h-4 mr-2" />}
                  Speichern
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={handleTestSMTP}
                  disabled={testing || !smtpStatus.configured}
                  data-testid="smtp-test-btn"
                >
                  {testing ? <Spinner size="sm" /> : <Send className="w-4 h-4 mr-2" />}
                  Test-E-Mail senden
                </Button>
              </div>

              {!smtpStatus.configured && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-sm border border-warning/30">
                  <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                  <p className="text-xs text-warning font-mono">
                    SMTP ist noch nicht konfiguriert. Alert-E-Mails werden nicht versendet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Agent Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Agent-Konfiguration</CardTitle>
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
            <CardTitle className="text-sm">System-Informationen</CardTitle>
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
