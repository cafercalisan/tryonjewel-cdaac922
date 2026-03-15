import { authClient } from '@/lib/auth-client';

/**
 * Invoke an API endpoint at /api/<name>.
 */
export async function invokeApi(
  name: string,
  options: { body?: any; method?: string } = {}
): Promise<{ data: any; error: any }> {
  try {
    let token = authClient.getAccessToken();

    const makeRequest = async (t: string | null) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (t) headers['Authorization'] = `Bearer ${t}`;
      return fetch(`/api/${name}`, {
        method: options.method || 'POST',
        headers,
        body: JSON.stringify(options.body || {}),
      });
    };

    let response = await makeRequest(token);

    // Auto-refresh on 401 and retry once
    if (response.status === 401) {
      await authClient.refreshSession();
      token = authClient.getAccessToken();
      if (token) response = await makeRequest(token);
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        data,
        error: {
          message: data.error || `API error: ${response.status}`,
          status: response.status,
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'Network error',
        status: 0,
      },
    };
  }
}

/**
 * Helper to make authenticated GET requests.
 */
export async function fetchApi(
  name: string,
  query?: Record<string, string>
): Promise<{ data: any; error: any }> {
  try {
    let token = authClient.getAccessToken();

    const makeRequest = async (t: string | null) => {
      const headers: Record<string, string> = {};
      if (t) headers['Authorization'] = `Bearer ${t}`;
      const qs = query ? '?' + new URLSearchParams(query).toString() : '';
      return fetch(`/api/${name}${qs}`, { headers });
    };

    let response = await makeRequest(token);

    // Auto-refresh on 401 and retry once
    if (response.status === 401) {
      const refreshed = await authClient.refreshSession?.();
      token = authClient.getAccessToken();
      if (token) {
        response = await makeRequest(token);
      }
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        data,
        error: {
          message: data.error || `API error: ${response.status}`,
          status: response.status,
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'Network error',
        status: 0,
      },
    };
  }
}

/**
 * Upload a file via the /api/upload endpoint.
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: File | Blob,
  contentType?: string,
): Promise<{ error: any }> {
  try {
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), '')
    );

    const { error } = await invokeApi('upload', {
      body: { bucket, path, data: base64, contentType: contentType || file.type },
    });

    return { error };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Upload failed' } };
  }
}

/**
 * Get a signed URL for a file in storage.
 */
export async function getStorageSignedUrl(
  bucket: string,
  path: string,
  expiresIn?: number,
): Promise<{ signedUrl: string | null; error: any }> {
  try {
    const { data, error } = await invokeApi('signed-url', {
      body: { bucket, path, expiresIn },
    });

    if (error) return { signedUrl: null, error };
    return { signedUrl: data.signedUrl, error: null };
  } catch (err) {
    return { signedUrl: null, error: { message: err instanceof Error ? err.message : 'Failed' } };
  }
}
