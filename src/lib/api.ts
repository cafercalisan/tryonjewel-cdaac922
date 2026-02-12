import { supabase } from '@/integrations/supabase/client';

/**
 * Invoke a Vercel serverless function at /api/<name>.
 * Mirrors the interface of supabase.functions.invoke() for easier migration.
 */
export async function invokeApi(
  name: string,
  options: { body?: any } = {}
): Promise<{ data: any; error: any }> {
  try {
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(options.body || {}),
    });

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
