#!/usr/bin/env node

import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 3000;
export const APP_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
export const SHARED_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'shared');

export const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.map': 'application/json; charset=utf-8',
};

const MIN_PORT = 0;
const MAX_PORT = 65535;
const PORT_INVALID_MESSAGE = `invalid port value: expected integer in range ${MIN_PORT}-${MAX_PORT}`;

function normalizeRequestPath(pathname) {
  try {
    const decoded = decodeURIComponent(pathname).replace(/\\/g, '/');

    if (decoded.includes('\0')) return null;

    const clean = decoded
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .split('/')
      .filter((segment) => segment !== '' && segment !== '.');

    if (!clean.length) return '';

    if (clean.includes('..')) return null;

    return clean.join('/');
  } catch {
    return null;
  }
}

function isSubPath(basePath, candidatePath) {
  const baseResolved = path.resolve(basePath);
  const candidateResolved = path.resolve(candidatePath);

  const baseCompare = process.platform === 'win32'
    ? baseResolved.toLowerCase()
    : baseResolved;
  const candidateCompare = process.platform === 'win32'
    ? candidateResolved.toLowerCase()
    : candidateResolved;
  const basePrefix = baseCompare.endsWith(path.sep)
    ? baseCompare
    : `${baseCompare}${path.sep}`;

  return (
    candidateCompare === baseCompare
    || candidateCompare.startsWith(basePrefix)
  );
}

function resolveSafeFile(rootPath, requestedPath) {
  const normalized = normalizeRequestPath(requestedPath);

  if (normalized === null || normalized === '/') return null;

  const candidatePath = path.resolve(rootPath, normalized);

  if (!isSubPath(rootPath, candidatePath)) return null;

  return candidatePath;
}

function mapRequestPath(pathname, appPath, sharedPath) {
  if (pathname === '/') return path.resolve(appPath, 'index.html');

  if (pathname === '/shared' || pathname === '/shared/') {
    return null;
  }

  if (pathname.startsWith('/shared/')) {
    return resolveSafeFile(sharedPath, pathname.slice('/shared/'.length));
  }

  return resolveSafeFile(appPath, pathname);
}

function parsePortInput(input, sourceLabel, fallbackPort) {
  if (input === undefined || input === null || input === '') {
    return fallbackPort;
  }

  if (
    typeof input === 'number'
    && Number.isInteger(input)
    && input >= MIN_PORT
    && input <= MAX_PORT
  ) {
    return input;
  }

  const trimmed = String(input).trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${PORT_INVALID_MESSAGE} (${sourceLabel}: ${trimmed})`);
  }

  const port = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(`${PORT_INVALID_MESSAGE} (${sourceLabel}: ${trimmed})`);
  }

  return port;
}

export function parsePortArgv(argv, env = process.env) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--port' && i + 1 < argv.length) {
      return parsePortInput(argv[i + 1], '--port', NaN);
    }

    const match = /^--port=(.+)$/.exec(arg);

    if (match) return parsePortInput(match[1], `--port=${match[1]}`, NaN);
  }

  if (env.RIVERLINE_DEV_PORT !== undefined) {
    return parsePortInput(env.RIVERLINE_DEV_PORT, 'RIVERLINE_DEV_PORT', NaN);
  }

  return parsePortInput(env.PORT, 'PORT', DEFAULT_PORT);
}

function setResponseHeaders(response, headers = {}) {
  response.writeHead(
    headers.status || 200,
    {
      'Cache-Control': 'no-store',
      ...(headers.headers || {}),
    },
  );
}

export function createDevWebServer({ appDirectory = APP_DIRECTORY, sharedDirectory = SHARED_DIRECTORY } = {}) {
  const appPath = path.resolve(appDirectory);
  const sharedPath = path.resolve(sharedDirectory);

  return http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${DEFAULT_HOST}`);
    const filePath = mapRequestPath(url.pathname, appPath, sharedPath);

    if (!filePath) {
      setResponseHeaders(response, { status: 404 });
      response.end('Not Found');
      return;
    }

    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        setResponseHeaders(response, { status: 404 });
        response.end('Not Found');
        return;
      }

      const data = await fs.readFile(filePath);
      const extension = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[extension] || 'application/octet-stream';

      setResponseHeaders(response, {
        headers: {
          'Content-Type': contentType,
        },
      });
      response.end(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        setResponseHeaders(response, { status: 404 });
        response.end('Not Found');
        return;
      }

      console.error('Dev server read error:', error);
      setResponseHeaders(response, { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      response.end('Internal Server Error');
    }
  });
}

export async function closeDevWebServer(server) {
  if (!server.listening) return;

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function startDevWebServer({
  port,
  host = DEFAULT_HOST,
  appDirectory = APP_DIRECTORY,
  sharedDirectory = SHARED_DIRECTORY,
} = {}) {
  const server = createDevWebServer({ appDirectory, sharedDirectory });
  const selectedPort = port === undefined
    ? parsePortArgv([])
    : port;
  const resolvedPort = parsePortInput(selectedPort, 'startDevWebServer', DEFAULT_PORT);

  const portValue = await new Promise((resolve, reject) => {
    server.listen(resolvedPort, host, () => {
      const address = server.address();

      if (address && typeof address === 'object') {
        resolve(address.port);
      } else {
        reject(new Error('Unable to read listening port.'));
      }
    });
    server.once('error', reject);
  });

  return {
    server,
    host,
    port: portValue,
    url: `http://${host}:${portValue}`,
    close: () => closeDevWebServer(server),
  };
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '')) {
  try {
    const requestedPort = parsePortArgv(process.argv.slice(2));
    const runtime = await startDevWebServer({ port: requestedPort });
    console.log(`Riverline dev server running at ${runtime.url}`);

    const shutdown = async () => {
      await runtime.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error(`Unable to start dev server: ${error.message}`);
    process.exit(1);
  }
}
