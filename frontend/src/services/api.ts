import { env } from '../config/env';
import { BackendHealthResponse } from '../types';

export async function checkBackendHealth(): Promise<{ success: boolean; data?: BackendHealthResponse; error?: string }> {
  try {
    const res = await fetch(`${env.backendUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data: BackendHealthResponse = await res.json();
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backend unreachable';
    return { success: false, error: message };
  }
}
