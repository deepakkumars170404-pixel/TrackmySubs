import http, { IncomingMessage, ServerResponse } from 'node:http';
import { createSettingsSupabaseClient } from './client';
import {
  getUserNotificationSettings,
  updateUserNotificationSettings,
  toggleNotificationPreference,
  resetNotificationSettings,
} from './settingsService';

const PORT = parseInt(process.env.PORT || '5000', 10);

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
  });
  res.end(JSON.stringify(data, null, 2));
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
    });
    return res.end();
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Extract auth token or fallback dev user id
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const devUserId = (req.headers['x-user-id'] as string) || '00000000-0000-0000-0000-000000000001';

  const supabase = createSettingsSupabaseClient({ authToken: token });

  // 1. Health Check
  if (pathname === '/health' || pathname === '/api/health') {
    return sendJson(res, 200, {
      status: 'healthy',
      service: 'settings-backend-supabase',
      table: 'public.user_notification_settings',
      timestamp: new Date().toISOString(),
    });
  }

  // 2. GET /settings or /api/settings
  if (req.method === 'GET' && (pathname === '/settings' || pathname === '/api/settings')) {
    const result = await getUserNotificationSettings(supabase, devUserId);
    if (result.error) {
      return sendJson(res, 500, { success: false, error: result.error.message });
    }
    return sendJson(res, 200, { success: true, data: result.data });
  }

  // 3. PATCH /settings or /api/settings
  if (req.method === 'PATCH' && (pathname === '/settings' || pathname === '/api/settings')) {
    const body = await parseBody(req);
    const result = await updateUserNotificationSettings(supabase, devUserId, body);
    if (result.error) {
      return sendJson(res, 500, { success: false, error: result.error.message });
    }
    return sendJson(res, 200, { success: true, message: 'Settings updated', data: result.data });
  }

  // 4. POST /api/settings/toggle
  if (req.method === 'POST' && (pathname === '/settings/toggle' || pathname === '/api/settings/toggle')) {
    const body = await parseBody(req);
    const key = body.key as any;
    if (!key) {
      return sendJson(res, 400, { success: false, error: 'Missing key in request body' });
    }
    const result = await toggleNotificationPreference(supabase, devUserId, key, body.value as boolean);
    if (result.error) {
      return sendJson(res, 500, { success: false, error: result.error.message });
    }
    return sendJson(res, 200, { success: true, data: result.data });
  }

  // 5. POST /api/settings/reset
  if (req.method === 'POST' && (pathname === '/settings/reset' || pathname === '/api/settings/reset')) {
    const result = await resetNotificationSettings(supabase, devUserId);
    if (result.error) {
      return sendJson(res, 500, { success: false, error: result.error.message });
    }
    return sendJson(res, 200, { success: true, message: 'Settings reset to default', data: result.data });
  }

  return sendJson(res, 404, { success: false, error: `Route not found: ${req.method} ${pathname}` });
});

server.listen(PORT, () => {
  console.log(`======================================================`);
  console.log(`🚀 Settings Service (Supabase) running on port ${PORT}`);
  console.log(`📡 Connected to table: public.user_notification_settings`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api/settings`);
  console.log(`🩺 Health check: http://localhost:${PORT}/health`);
  console.log(`======================================================`);
});

export default server;

