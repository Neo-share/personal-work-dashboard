import type {
  MetricEvent,
  MetricsLedger,
} from '@project-manager/shared';

/** 内存环形缓冲，第一版 MetricsLedger 实现 */
export class InMemoryMetricsLedger implements MetricsLedger {
  private readonly maxSize: number;
  private events: MetricEvent[] = [];

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  record(event: MetricEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxSize) {
      this.events = this.events.slice(-this.maxSize);
    }
  }

  queryRecent(filter?: { name?: string; limit?: number }): MetricEvent[] {
    let list = [...this.events];
    if (filter?.name) {
      list = list.filter((event) => event.name === filter.name);
    }
    if (filter?.limit && filter.limit > 0) {
      list = list.slice(-filter.limit);
    }
    return list;
  }
}

export const inMemoryMetricsLedger = new InMemoryMetricsLedger();
