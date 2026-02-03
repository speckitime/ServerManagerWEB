import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2 } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Button, Modal, Input, Spinner } from '../ui';
import { cn } from '../../utils/helpers';
import { useToast } from '../../hooks/use-toast';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const SSHTerminal = ({ isOpen, onClose, server }) => {
  const terminalRef = useRef(null);
  const terminalInstance = useRef(null);
  const fitAddon = useRef(null);
  const wsRef = useRef(null);
  const [connectionId, setConnectionId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [credentials, setCredentials] = useState({ username: 'root', password: '' });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { showSuccess, showError } = useToast();

  // Initialize terminal
  useEffect(() => {
    if (!isOpen || !terminalRef.current || terminalInstance.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 14,
      theme: {
        background: '#0c0c0c',
        foreground: '#22C55E',
        cursor: '#22C55E',
        cursorAccent: '#0c0c0c',
        selection: 'rgba(34, 197, 94, 0.3)',
        black: '#0c0c0c',
        red: '#EF4444',
        green: '#22C55E',
        yellow: '#EAB308',
        blue: '#3B82F6',
        magenta: '#A855F7',
        cyan: '#06B6D4',
        white: '#E4E4E7',
        brightBlack: '#71717A',
        brightRed: '#F87171',
        brightGreen: '#4ADE80',
        brightYellow: '#FDE047',
        brightBlue: '#60A5FA',
        brightMagenta: '#C084FC',
        brightCyan: '#22D3EE',
        brightWhite: '#FFFFFF'
      }
    });

    fitAddon.current = new FitAddon();
    term.loadAddon(fitAddon.current);
    term.open(terminalRef.current);
    fitAddon.current.fit();

    term.writeln('\x1b[32m╔═══════════════════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[32m║     \x1b[1mNEXUS COMMAND SSH TERMINAL\x1b[0m\x1b[32m                        ║\x1b[0m');
    term.writeln('\x1b[32m╚═══════════════════════════════════════════════════════╝\x1b[0m');
    term.writeln('');
    term.writeln(`Connecting to: \x1b[33m${server?.hostname}\x1b[0m (${server?.ip_address})`);
    term.writeln('Enter credentials to connect...');
    term.writeln('');

    terminalInstance.current = term;

    // Handle resize
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, server]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
        terminalInstance.current = null;
      }
      setConnected(false);
      setConnectionId(null);
    }
  }, [isOpen]);

  const connect = async () => {
    if (!credentials.username || !credentials.password) {
      showError('Please enter username and password');
      return;
    }

    setConnecting(true);
    const term = terminalInstance.current;

    try {
      term.writeln('\x1b[33mConnecting...\x1b[0m');

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/servers/${server.id}/ssh/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(credentials)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Connection failed');
      }

      const data = await response.json();
      setConnectionId(data.connection_id);

      // Connect WebSocket
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = API_URL ? new URL(API_URL).host : window.location.host;
      const ws = new WebSocket(`${wsProtocol}//${wsHost}/api/ws/ssh/${data.connection_id}`);

      ws.onopen = () => {
        term.writeln('\x1b[32mConnected!\x1b[0m');
        term.writeln('');
        setConnected(true);
        
        // Send initial resize
        ws.send(JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows
        }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'output') {
          term.write(message.data);
        } else if (message.type === 'disconnected') {
          term.writeln('\r\n\x1b[31mConnection closed by server\x1b[0m');
          setConnected(false);
        }
      };

      ws.onerror = () => {
        term.writeln('\x1b[31mWebSocket error\x1b[0m');
      };

      ws.onclose = () => {
        setConnected(false);
        term.writeln('\r\n\x1b[33mDisconnected\x1b[0m');
      };

      wsRef.current = ws;

      // Handle terminal input
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });

      showSuccess('SSH connection established');

    } catch (err) {
      term.writeln(`\x1b[31mError: ${err.message}\x1b[0m`);
      showError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (connectionId) {
      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/api/ssh/${connectionId}/disconnect`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {
        // Ignore
      }
    }
    setConnected(false);
    setConnectionId(null);
    terminalInstance.current?.writeln('\r\n\x1b[33mDisconnected\x1b[0m');
  };

  const handleClose = () => {
    disconnect();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={cn(
      'fixed z-50 bg-background border border-border rounded-sm shadow-2xl',
      isFullscreen 
        ? 'inset-4' 
        : 'bottom-4 right-4 w-[800px] h-[500px]'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm">
            SSH: {server?.hostname}
          </span>
          {connected && (
            <span className="w-2 h-2 rounded-full bg-online animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:bg-secondary rounded-sm transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-destructive/20 rounded-sm transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Credentials form (if not connected) */}
      {!connected && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-card border border-border p-4 rounded-sm shadow-lg w-80">
          <h3 className="font-mono text-sm mb-4 text-center">SSH Credentials</h3>
          <div className="space-y-3">
            <Input
              label="Username"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              placeholder="root"
              data-testid="ssh-username"
            />
            <Input
              label="Password"
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && connect()}
              data-testid="ssh-password"
            />
            <Button 
              onClick={connect} 
              disabled={connecting}
              className="w-full"
              data-testid="ssh-connect-btn"
            >
              {connecting ? <Spinner size="sm" /> : 'Connect'}
            </Button>
          </div>
        </div>
      )}

      {/* Disconnect button */}
      {connected && (
        <div className="absolute top-16 right-4 z-10">
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={disconnect}
            data-testid="ssh-disconnect-btn"
          >
            Disconnect
          </Button>
        </div>
      )}

      {/* Terminal */}
      <div 
        ref={terminalRef} 
        className="h-[calc(100%-48px)] bg-[#0c0c0c] p-2"
        style={{ opacity: connected ? 1 : 0.5 }}
      />
    </div>
  );
};
