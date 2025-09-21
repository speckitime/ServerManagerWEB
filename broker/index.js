import fs from 'node:fs';
import http from 'node:http';
import process from 'node:process';

import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Client } from 'ssh2';
import { WebSocketServer } from 'ws';

dotenv.config();

const server = http.createServer();
const wss = new WebSocketServer({ server });

const jwtSecret = resolveJwtSecret();

wss.on('connection', async (socket, request) => {
  const { searchParams } = new URL(request.url, 'http://localhost');
  const token = searchParams.get('token');

  if (!token) {
    socket.close(4001, 'Missing token');
    return;
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  } catch (error) {
    console.error('Token verification failed', error);
    socket.close(4003, 'Invalid token');
    return;
  }

  const userId = Number(payload.sub);
  const hostId = Number(payload.host_id);
  if (!userId || !hostId) {
    socket.close(4003, 'Invalid payload');
    return;
  }

  let credentials;
  try {
    credentials = await resolveHostCredentials(hostId);
  } catch (error) {
    console.error('Unable to resolve host credentials', error);
    socket.close(4500, 'Host lookup failed');
    return;
  }

  const ssh = new Client();
  ssh.on('ready', () => {
    ssh.shell((error, stream) => {
      if (error) {
        console.error('Failed to open shell', error);
        socket.close(4501, 'Shell unavailable');
        ssh.end();
        return;
      }

      stream.on('data', (data) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(data.toString('binary'));
        }
      });

      if (stream.stderr) {
        stream.stderr.on('data', (data) => {
          if (socket.readyState === socket.OPEN) {
            socket.send(data.toString('binary'));
          }
        });
      }

      socket.on('message', (data) => {
        if (Buffer.isBuffer(data)) {
          stream.write(data);
        } else {
          stream.write(data.toString());
        }
      });

      socket.on('close', () => {
        stream.end();
        ssh.end();
      });
    });
  });

  ssh.on('error', (error) => {
    console.error('SSH connection error', error);
    socket.close(1011, 'SSH error');
  });

  ssh.connect(credentials);
});

server.listen(Number(process.env.BROKER_PORT || 3001), () => {
  console.log(`Broker listening on port ${server.address().port}`);
});

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.JWT_SECRET_B64 || '';
  if (secret.startsWith('base64:')) {
    const raw = Buffer.from(secret.slice(7), 'base64');
    if (!raw.length) {
      throw new Error('JWT secret base64 decoding failed');
    }

    return raw;
  }

  if (process.env.JWT_SECRET_B64) {
    const raw = Buffer.from(process.env.JWT_SECRET_B64, 'base64');
    if (!raw.length) {
      throw new Error('JWT secret base64 decoding failed');
    }

    return raw;
  }

  if (!secret) {
    throw new Error('JWT secret missing for broker');
  }

  return secret;
}

async function resolveHostCredentials(hostId) {
  if (process.env.BROKER_STATIC_HOST) {
    return readStaticCredentials();
  }

  throw new Error(`Dynamic host lookup not implemented. Cannot resolve host ${hostId}.`);
}

function readStaticCredentials() {
  const host = process.env.BROKER_STATIC_HOST;
  const port = Number(process.env.BROKER_STATIC_PORT || 22);
  const username = process.env.BROKER_STATIC_USERNAME;
  const privateKeyPath = process.env.BROKER_STATIC_KEY_PATH;
  const password = process.env.BROKER_STATIC_PASSWORD;

  if (!host || !username) {
    throw new Error('Static host configuration requires BROKER_STATIC_HOST and BROKER_STATIC_USERNAME');
  }

  const config = { host, port, username };

  if (privateKeyPath) {
    config.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    if (process.env.BROKER_STATIC_KEY_PASSPHRASE) {
      config.passphrase = process.env.BROKER_STATIC_KEY_PASSPHRASE;
    }
  } else if (password) {
    config.password = password;
  } else {
    throw new Error('Provide BROKER_STATIC_KEY_PATH or BROKER_STATIC_PASSWORD for static host configuration');
  }

  return config;
}
