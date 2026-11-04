import crypto from 'crypto';

export function generateTotpHash(secret: string, timeStepSeconds: number = 10, timestamp: number = Date.now()): string {
  const timeBucket = Math.floor(timestamp / 1000 / timeStepSeconds);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(Buffer.from(timeBucket.toString()));
  return hmac.digest('hex').substring(0, 8).toUpperCase();
}