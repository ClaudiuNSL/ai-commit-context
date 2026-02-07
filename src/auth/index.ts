import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const ACC_DIR = path.join(os.homedir(), '.acc');
const AUTH_PATH = path.join(ACC_DIR, 'auth.json');

interface AuthConfig {
  apiKey: string;
  username: string;
  userId: string;
  authenticatedAt: string;
}

interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

interface PollResponse {
  status: 'pending' | 'authorized' | 'expired';
  apiKey?: string;
  username?: string;
  userId?: string;
}

function ensureAccDir(): void {
  if (!fs.existsSync(ACC_DIR)) {
    fs.mkdirSync(ACC_DIR, { recursive: true });
  }
}

/**
 * Save authentication credentials
 */
export function saveAuth(auth: AuthConfig): void {
  ensureAccDir();
  fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2));
}

/**
 * Load authentication credentials
 */
export function loadAuth(): AuthConfig | null {
  if (!fs.existsSync(AUTH_PATH)) {
    return null;
  }

  try {
    const content = fs.readFileSync(AUTH_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Clear authentication credentials
 */
export function clearAuth(): void {
  if (fs.existsSync(AUTH_PATH)) {
    fs.unlinkSync(AUTH_PATH);
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const auth = loadAuth();
  return auth !== null && !!auth.apiKey;
}

/**
 * Get API key
 */
export function getApiKey(): string | null {
  const auth = loadAuth();
  return auth?.apiKey || null;
}

/**
 * Make HTTPS request
 */
function makeRequest<T>(
  method: string,
  url: string,
  data?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = httpModule.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error || `Request failed: ${res.statusCode}`));
          }
        } catch {
          reject(new Error(`Invalid response: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Request a device code for authentication
 */
export async function requestDeviceCode(baseUrl: string): Promise<DeviceCodeResponse> {
  return makeRequest<DeviceCodeResponse>('POST', `${baseUrl}/api/auth/device-code`);
}

/**
 * Poll for authentication completion
 */
export async function pollDeviceCode(
  baseUrl: string,
  deviceCode: string
): Promise<PollResponse> {
  return makeRequest<PollResponse>(
    'GET',
    `${baseUrl}/api/auth/device-code/poll?device_code=${deviceCode}`
  );
}

/**
 * Start the device code authentication flow
 */
export async function startDeviceFlow(
  baseUrl: string,
  onUrl: (url: string, userCode: string) => void,
  onPending: () => void
): Promise<{ success: boolean; username?: string; error?: string }> {
  try {
    // Request device code
    const deviceCode = await requestDeviceCode(baseUrl);

    // Show URL to user
    onUrl(deviceCode.verificationUrl, deviceCode.userCode);

    // Poll for completion
    const expiresAt = Date.now() + deviceCode.expiresIn * 1000;
    const interval = (deviceCode.interval || 5) * 1000;

    while (Date.now() < expiresAt) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      onPending();

      try {
        const result = await pollDeviceCode(baseUrl, deviceCode.deviceCode);

        if (result.status === 'authorized' && result.apiKey) {
          // Save credentials
          saveAuth({
            apiKey: result.apiKey,
            username: result.username || '',
            userId: result.userId || '',
            authenticatedAt: new Date().toISOString(),
          });

          return { success: true, username: result.username };
        }

        if (result.status === 'expired') {
          return { success: false, error: 'Authentication expired' };
        }
      } catch (err) {
        // Continue polling on error
      }
    }

    return { success: false, error: 'Authentication timed out' };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
