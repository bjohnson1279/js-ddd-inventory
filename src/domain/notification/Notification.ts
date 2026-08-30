export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}
