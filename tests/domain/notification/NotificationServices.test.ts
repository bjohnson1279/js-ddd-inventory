import { NotificationDispatcherService, NotificationInboxService } from '../../../src/domain/notification/NotificationServices';
import { Notification, NotificationPreference, NotificationCategory, NotificationSeverity, NotificationChannel } from '../../../src/domain/notification/NotificationEntities';
import { NotificationId } from '../../../src/domain/notification/valueObjects/NotificationId';
import { v4 as uuidv4 } from 'uuid';

describe('Notification Services', () => {
  it('Dispatcher should route based on preferences', () => {
    const dispatcher = new NotificationDispatcherService();
    const prefs = new Map<string, NotificationPreference>();
    prefs.set('u1', new NotificationPreference('p1', 't1', 'u1', NotificationCategory.INVENTORY_LEVEL, [NotificationChannel.EMAIL, NotificationChannel.IN_APP]));
    
    dispatcher.dispatch('t1', ['u1'], NotificationCategory.INVENTORY_LEVEL, NotificationSeverity.WARNING, 'msg', {}, prefs);
    
    expect(dispatcher.inAppNotifications.length).toBe(1);
    expect(dispatcher.outboxEvents.length).toBe(1);
    expect(dispatcher.outboxEvents[0].type).toBe('SEND_EMAIL');
  });

  it('Inbox should track unread and snooze', () => {
    const notif = new Notification(uuidv4(), 't1', 'u1', NotificationCategory.INVENTORY_LEVEL, NotificationSeverity.INFO, 'msg');
    const inbox = new NotificationInboxService([notif]);
    
    expect(inbox.getUnreadCount('u1')).toBe(1);
    
    inbox.snooze(notif.id, 'u1', 24);
    expect(notif.status).toBe('SNOOZED');
    expect(notif.snoozedUntil).toBeDefined();
  });

  it('Inbox should support both NotificationId Value Object and raw string ID', () => {
    const notifId = NotificationId.create('NOTIF-CUSTOM-1');
    const notif = new Notification(notifId, 't1', 'u1', NotificationCategory.INVENTORY_LEVEL, NotificationSeverity.INFO, 'msg');
    const inbox = new NotificationInboxService([notif]);

    expect(notif.id).toBeInstanceOf(NotificationId);
    expect(notif.id.getValue()).toBe('NOTIF-CUSTOM-1');

    // Test with NotificationId instance
    const readSuccess = inbox.markAsRead(notifId, 'u1');
    expect(readSuccess).toBe(true);
    expect(notif.status).toBe('READ');

    // Test with string ID
    const snoozeSuccess = inbox.snooze('NOTIF-CUSTOM-1', 'u1', 2);
    expect(snoozeSuccess).toBe(true);
    expect(notif.status).toBe('SNOOZED');

    // Test escalate with string ID
    const escalated = inbox.escalate('NOTIF-CUSTOM-1', 'u1', 'mgr1');
    expect(escalated).not.toBeNull();
    expect(escalated?.id).toBeInstanceOf(NotificationId);
    expect(escalated?.userId).toBe('mgr1');
  });
});
