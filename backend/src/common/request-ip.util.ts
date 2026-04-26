import { createHmac } from 'crypto';
import { Request } from 'express';

export function getRequestIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff[0]) {
    return xff[0].trim();
  }
  const rip = (req as any).socket?.remoteAddress || (req as any).ip;
  return typeof rip === 'string' && rip.length > 0 ? rip : 'unknown';
}

export function hashRequestIp(req: Request): string {
  const ip = getRequestIp(req);
  const salt = process.env.USAGE_IP_SALT || 'dev-local-anon-usage-salt';
  return createHmac('sha256', salt).update(ip).digest('hex');
}
