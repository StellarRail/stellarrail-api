import { UsersService } from './users.service';
describe('users model hashing', () => {
  it('hashes and omits hash', async () => {
    const s = new UsersService();
    const u: any = await s.create('t1@example.com', 'StrongPass12345!', 'OPERATOR');
    expect((u as any).passwordHash).toBeUndefined();
    const full = s.findByEmail('t1@example.com')!;
    expect(full.passwordHash).not.toContain('StrongPass');
    expect(s.sanitize(full)).not.toHaveProperty('passwordHash');
  });
  it('rejects weak password', async () => {
    const s = new UsersService();
    await expect(s.create('t2@example.com', 'password123', 'OPERATOR')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'WEAK_PASSWORD' }) });
  });
  it('password-policy unit', async () => {
    const s = new UsersService();
    await expect(s.create('pp@example.com', 'short', 'OPERATOR')).rejects.toBeTruthy();
  });
});
