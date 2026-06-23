import type {
  MetricEvent,
  MetricsLedger,
} from '@project-manager/shared';
import {
  insertMetricEvent,
  queryRecentMetricEvents,
} from '../services/metric-event-service.js';

/** 内存环形缓冲（热路径查询与测试回退） */
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

/** 内存 + SQLite 双写，查询优先读库 */
export class PersistingMetricsLedger implements MetricsLedger {
  private readonly memory: InMemoryMetricsLedger;

  constructor(memoryMaxSize = 500) {
    this.memory = new InMemoryMetricsLedger(memoryMaxSize);
  }

  record(event: MetricEvent): void {
    this.memory.record(event);
    try {
      insertMetricEvent(event);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[metrics] 落库失败: ${detail}`);
    }
  }

  queryRecent(filter?: { name?: string; limit?: number }): MetricEvent[] {
    try {
      return queryRecentMetricEvents(filter);
    } catch {
      return this.memory.queryRecent(filter);
    }
  }
}

export const inMemoryMetricsLedger = new PersistingMetricsLedger();
