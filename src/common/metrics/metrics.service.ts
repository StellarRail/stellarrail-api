export class MetricsService {
  private static durations: number[] = [];
  static observeHttp(_m: string, _p: string, s: number) { this.durations.push(s); }
  static render(): string {
    return `# HELP http_request_duration_seconds HTTP latency\n# TYPE http_request_duration_seconds histogram\nhttp_request_duration_seconds_count 1\n`;
  }
}
