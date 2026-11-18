import { DigitalSimulationEngine } from './engine';
import { CircuitSnapshot, SimulationSnapshot } from '../types/circuit';

const engine = new DigitalSimulationEngine();

export type SimWorkerRequest =
  | { type: 'step'; reqId: number; circuit: CircuitSnapshot }
  | { type: 'reset'; reqId: number };

export type SimWorkerResponse =
  | { type: 'snapshot'; reqId: number; snapshot: SimulationSnapshot }
  | { type: 'reset_done'; reqId: number };

self.onmessage = (event: MessageEvent<SimWorkerRequest>) => {
  const msg = event.data;
  if (msg.type === 'reset') {
    engine.resetRuntime();
    const res: SimWorkerResponse = { type: 'reset_done', reqId: msg.reqId };
    self.postMessage(res);
  } else if (msg.type === 'step') {
    const snapshot = engine.step(msg.circuit);
    const res: SimWorkerResponse = { type: 'snapshot', reqId: msg.reqId, snapshot };
    self.postMessage(res);
  }
};
