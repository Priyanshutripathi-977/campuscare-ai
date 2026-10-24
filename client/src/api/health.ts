import { apiFetch } from './client';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'connected' | 'connecting' | 'disconnected' | 'disconnecting';
  uptimeSeconds: number;
  aiConfigured: boolean;
  time: string;
}

// 503 still carries a useful JSON body ("server up, database down"), so accept it.
export const getHealth = () => apiFetch<HealthResponse>('/health', {}, [503]);
