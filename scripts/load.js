// k6 smoke: CRUD p95 target <200ms locally
import http from 'k6/http';
import { check } from 'k6';
export const options = { vus: 10, duration: '30s' };
export default function () {
  const r = http.get('http://localhost:3000/api/v1/health');
  check(r, { 'status 200': (x) => x.status === 200 });
}
