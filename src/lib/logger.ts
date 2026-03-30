export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMeta {
  [key: string]: unknown;
}

export function log(level: LogLevel, event: string, meta: LogMeta = {}): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}
