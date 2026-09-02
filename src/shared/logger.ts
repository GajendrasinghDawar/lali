export class Logger {
  static sanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) return obj.map(Logger.sanitize);
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('authorization') || lowerKey.includes('api_key')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = Logger.sanitize(value);
      }
    }
    return sanitized;
  }

  static info(message: string, context?: Record<string, any>) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...Logger.sanitize(context)
    }));
  }

  static error(message: string, error?: any, context?: Record<string, any>) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      ...Logger.sanitize(context)
    }));
  }
}
