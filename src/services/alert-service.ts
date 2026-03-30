import { env } from '@/config/env';
import { log } from '@/lib/logger';

export class AlertService {
  async sendEmail(subject: string, body: string): Promise<void> {
    log('info', 'alerts.email', { to: env.GOOGLE_WORKSPACE_ALERT_TO, subject, body });
  }
}
