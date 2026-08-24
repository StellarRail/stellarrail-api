import { StateMachine } from './state-machine';
describe('state-machine', () => {
  it('matrix: legal and illegal', () => {
    const sm = new StateMachine();
    expect(sm.can('CREATED', 'LOCKED_IN_ESCROW')).toBe(true);
    expect(sm.can('SETTLED', 'PENDING_APPROVAL')).toBe(false);
    expect(sm.can('PENDING_APPROVAL', 'SETTLING')).toBe(true);
    expect(sm.can('PENDING_APPROVAL', 'REFUNDING')).toBe(true);
    expect(sm.can('EXPIRED', 'REFUNDING')).toBe(true);
    expect(() => sm.assert('SETTLED', 'PENDING_APPROVAL')).toThrow();
  });
});
