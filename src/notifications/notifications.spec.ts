import { NotificationsService } from './notifications.service';
describe('notifications', () => {
  it('queues PAYMENT_PENDING on approve trigger', () => {
    const n = new NotificationsService();
    n.enqueue('PAYMENT_PENDING', { paymentId: 'p1' });
    expect(n.queued.length).toBe(1);
    expect(n.list()[0].type).toBe('PAYMENT_PENDING');
  });
});
