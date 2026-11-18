import { DigitalSimulationEngine } from './engine';
import type { SimWorkerRequest, SimWorkerResponse } from './worker';
import { CircuitSnapshot, SimulationSnapshot } from '../types/circuit';

/**
 * SimulationRunner manages a dedicated Web Worker in browser environments
 * and falls back seamlessly to synchronous execution if Worker is unavailable.
 */
export class SimulationRunner {
  private worker: Worker | null = null;
  private fallbackEngine = new DigitalSimulationEngine();
  private reqCounter = 0;
  private pending = new Map<number, (snap: SimulationSnapshot | null) => void>();

  constructor() {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
          type: 'module',
        });
        this.worker.onmessage = (ev: MessageEvent<SimWorkerResponse>) => {
          const msg = ev.data;
          const cb = this.pending.get(msg.reqId);
          if (cb) {
            this.pending.delete(msg.reqId);
            cb(msg.type === 'snapshot' ? msg.snapshot : null);
          }
        };
        this.worker.onerror = () => {
          // Degrade gracefully to synchronous engine if worker fails to load
          this.worker?.terminate();
          this.worker = null;
        };
      } catch {
        this.worker = null;
      }
    }
  }

  public async step(circuit: CircuitSnapshot): Promise<SimulationSnapshot> {
    if (!this.worker) {
      return this.fallbackEngine.step(circuit);
    }
    const reqId = ++this.reqCounter;
    return new Promise<SimulationSnapshot>((resolve) => {
      this.pending.set(reqId, (snap) => {
        if (snap) resolve(snap);
        else resolve(this.fallbackEngine.step(circuit));
      });
      const msg: SimWorkerRequest = { type: 'step', reqId, circuit };
      this.worker!.postMessage(msg);
    });
  }

  public async reset(): Promise<void> {
    this.fallbackEngine.resetRuntime();
    if (!this.worker) return;
    const reqId = ++this.reqCounter;
    return new Promise<void>((resolve) => {
      this.pending.set(reqId, () => resolve());
      const msg: SimWorkerRequest = { type: 'reset', reqId };
      this.worker!.postMessage(msg);
    });
  }

  public dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
