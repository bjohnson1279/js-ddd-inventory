export interface NotificationPreference {
  id: string;
  userId: string;
  tenantId: string;
  channel: 'EMAIL' | 'SMS' | 'IN_APP' | 'WEBHOOK';
  eventType: string;
  isEnabled: boolean;
}
