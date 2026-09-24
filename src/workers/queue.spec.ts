import { QueueService } from './queue.service';
import { WorkersService } from './workers.service';
describe('queue', () => {
  it('enqueue/dequeue smoke', async () => {
    const q = new QueueService();
    await q.enqueue('payments', { id: '1' });
    expect(q.depths().payments).toBe(1);
  });
  it('graceful drain flag', async () => {
    const s = new WorkersService();
    await s.onModuleDestroy();
    expect(s.drained).toBe(true);
  });
});
