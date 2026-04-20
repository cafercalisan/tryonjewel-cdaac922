import { query } from './db.js';

export interface ErrorLogEntry {
  userId?: string | null;
  jobId?: string | null;
  endpoint: string;
  model?: string | null;
  attempt?: number | null;
  statusCode?: number | null;
  isOverload?: boolean;
  errorMessage: string;
  context?: Record<string, unknown>;
}

// Fire-and-forget: logging must never break the main flow.
export function logError(entry: ErrorLogEntry): void {
  const msg = (entry.errorMessage || '').substring(0, 2000);
  query(
    `INSERT INTO error_logs
       (user_id, job_id, endpoint, model, attempt, status_code, is_overload, error_message, context)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.userId ?? null,
      entry.jobId ?? null,
      entry.endpoint,
      entry.model ?? null,
      entry.attempt ?? null,
      entry.statusCode ?? null,
      entry.isOverload ?? false,
      msg,
      entry.context ? JSON.stringify(entry.context) : null,
    ],
  ).catch((err: any) => {
    console.error('[error-log] insert failed:', err?.message || err);
  });
}
