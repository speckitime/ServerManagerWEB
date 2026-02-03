import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button, Input, Card, CardContent, Spinner } from '../components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1680992046617-e2e35451bcdb?crop=entropy&cs=srgb&fm=jpg&q=85)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />
      
      {/* Login Card */}
      <Card className="relative z-10 w-full max-w-md border-border/50" data-testid="login-card">
        <CardContent className="p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <Terminal className="w-10 h-10 text-primary glow-green" />
            <div>
              <h1 className="font-mono font-bold text-2xl tracking-tight">
                NEXUS<span className="text-primary">CMD</span>
              </h1>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                Server Management
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-6 bg-destructive/10 border border-destructive/20 rounded-sm">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <p className="text-sm font-mono text-destructive">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@nexuscommand.local"
              required
              data-testid="login-email"
            />
            
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              data-testid="login-password"
            />

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="login-submit-btn"
            >
              {loading ? <Spinner size="sm" /> : 'Access System'}
            </Button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 p-3 bg-muted/30 border border-border rounded-sm">
            <p className="font-mono text-xs text-muted-foreground text-center">
              Demo: admin@nexuscommand.local
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
