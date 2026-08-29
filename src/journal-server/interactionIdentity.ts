import { createHmac } from 'node:crypto';

export function journalVisitorClientHash(visitorId: string, secret: string): string {
  return createHmac('sha256', secret).update(visitorId).digest('hex');
}
