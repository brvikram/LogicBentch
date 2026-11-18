import { create } from 'zustand';
import {
  canInsertIntoZif,
  canPlaceOnBreadboard,
  getICDefinition,
} from '../ic-library';
import { SimulationRunner } from '../simulation/runner';
import {
  createEmptyCircuit,
  createNewProject,
  deleteProjectById,
  listStoredProjects,
  loadProjectById,
  saveProjectToStorage,
} from '../storage/projectStorage';
import {
  CircuitSnapshot,
  ICPlacementTarget,
  PlacedIC,
  ProjectDocument,
  SimulationSnapshot,
  TerminalId,
  Wire,
  WireColor,
  ZIFSocketId,
} from '../types/circuit';

export type AppView = 'dashboard' | 'workspace' | 'library' | 'experiments';

interface LabState {
  activeView: AppView;
  project: ProjectDocument;
  recentProjects: ProjectDocument[];
  simulation: SimulationSnapshot;
  undoStack: CircuitSnapshot[];
  redoStack: CircuitSnapshot[];

  // Interactive wiring & placement tools
  selectedWireColor: WireColor;
  wiringFrom: TerminalId | null;
  selectedWireId: string | null;
  selectedWireIds: string[];
  pendingInsertIC: string | null; // Part number chosen from IC library ready to insert
  selectedICInstanceId: string | null;
  placementError: string | null;
  activeExperimentId: string;
  advisorOpen: boolean;

  // Actions
  setActiveView: (view: AppView) => void;
  setAdvisorOpen: (open: boolean) => void;
  setSelectedWireColor: (color: WireColor) => void;
  setPendingInsertIC: (partNumber: string | null) => void;
  setSelectedICInstanceId: (id: string | null) => void;
  setSelectedWireId: (id: string | null) => void;
  setSelectedWireIds: (ids: string[]) => void;
  toggleSelectedWireId: (id: string) => void;
  clearPlacementError: () => void;

  // Circuit & Hardware Actions
  togglePower: () => void;
  toggleSwitch: (index: number) => void;
  setSwitchesBatch: (updates: Record<number, 0 | 1>) => void;

  // Clock & Pulse Controls
  setClockMode: (mode: 'manual' | 'auto' | 'single-step') => void;
  setClockFrequency: (hz: number) => void;
  setClockDutyCycle: (pct: number) => void;
  triggerManualClockPress: (pressed: boolean) => void;
  triggerSingleStepClock: () => void;
  toggleAutoClock: () => void;
  tickAutoClockLevel: (nextLevel: 0 | 1) => void;

  togglePulseGenerator: () => void;
  setPulseFrequency: (hz: number) => void;
  setPulseDutyCycle: (pct: number) => void;
  tickPulseLevel: (nextLevel: 0 | 1) => void;

  // IC Placement
  insertIC: (partNumber: string, target: ICPlacementTarget) => { ok: boolean; error?: string };
  moveICToSocket: (instanceId: string, targetSocketId: ZIFSocketId) => { ok: boolean; error?: string };
  removeIC: (instanceId: string) => void;

  // Patch cords & jumpers
  startOrCompleteWiring: (terminalId: TerminalId) => void;
  cancelWiring: () => void;
  removeWire: (wireId: string) => void;
  removeWires: (wireIds: string[]) => void;
  updateWireOffset: (wireId: string, dx: number, dy: number) => void;

  // History & Project Management
  undo: () => void;
  redo: () => void;
  resetCircuit: () => void;
  newProject: (name?: string) => void;
  renameProject: (name: string) => void;
  saveCurrentProject: () => Promise<void>;
  refreshRecentProjects: () => Promise<void>;
  openProjectById: (id: string) => Promise<void>;
  importProjectDocument: (doc: ProjectDocument) => Promise<void>;
  deleteStoredProject: (id: string) => Promise<void>;
  setActiveExperimentId: (id: string) => void;
  updateExperimentNotes: (expId: string, observedNotes: string, finalResult: string) => void;
}

const simRunner = new SimulationRunner();

function cloneCircuit(c: CircuitSnapshot): CircuitSnapshot {
  return {
    powerOn: c.powerOn,
    switches: [...c.switches],
    clock: { ...c.clock },
    pulse: { ...c.pulse },
    placedICs: c.placedICs.map((ic) => ({
      ...ic,
      placement: { ...ic.placement },
    })),
    wires: c.wires.map((w) => ({
      ...w,
      controlOffset: w.controlOffset ? { ...w.controlOffset } : undefined,
    })),
  };
}

const initialProject = createNewProject('Lab Bench 01', 'DT-1004 Digital Trainer Circuit');

const emptySimulation: SimulationSnapshot = {
  simTimeNs: 0,
  powerOn: true,
  terminalStates: {},
  ledStates: Array(16).fill('Z'),
  displays: {
    DISP1: {
      caLevel: 1,
      segments: { a: false, b: false, c: false, d: false, e: false, f: false, g: false, dp: false },
      pinLevels: { a: 'Z', b: 'Z', c: 'Z', d: 'Z', e: 'Z', f: 'Z', g: 'Z', dp: 'Z', CA: 1 },
    },
    DISP2: {
      caLevel: 1,
      segments: { a: false, b: false, c: false, d: false, e: false, f: false, g: false, dp: false },
      pinLevels: { a: 'Z', b: 'Z', c: 'Z', d: 'Z', e: 'Z', f: 'Z', g: 'Z', dp: 'Z', CA: 1 },
    },
  },
  icStates: {},
  diagnostics: [],
  netCount: 0,
};

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutoSave(getState: () => LabState) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const st = getState();
    void saveProjectToStorage(st.project);
  }, 800);
}

async function runSimulationStep(getState: () => LabState, setState: (partial: Partial<LabState>) => void) {
  const snapshot = await simRunner.step(getState().project.circuit);
  setState({ simulation: snapshot });
}

export const useLabStore = create<LabState>((set, get) => {
  const commitCircuitChange = (
    updater: (prev: CircuitSnapshot) => CircuitSnapshot,
    pushHistory = true
  ) => {
    const st = get();
    const prevCircuit = st.project.circuit;
    const nextCircuit = updater(cloneCircuit(prevCircuit));
    const nextProject: ProjectDocument = {
      ...st.project,
      updatedAt: new Date().toISOString(),
      circuit: nextCircuit,
    };

    set({
      project: nextProject,
      undoStack: pushHistory ? [...st.undoStack.slice(-39), cloneCircuit(prevCircuit)] : st.undoStack,
      redoStack: pushHistory ? [] : st.redoStack,
    });

    void runSimulationStep(get, set);
    scheduleAutoSave(get);
  };

  return {
    activeView: typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1'
      ? 'workspace'
      : 'dashboard',
    project: initialProject,
    recentProjects: [],
    simulation: emptySimulation,
    undoStack: [],
    redoStack: [],

    selectedWireColor: 'yellow',
    wiringFrom: null,
    selectedWireId: null,
    selectedWireIds: [],
    pendingInsertIC: null,
    selectedICInstanceId: null,
    placementError: null,
    activeExperimentId: 'exp-example-7400-nand',
    advisorOpen: false,

    setActiveView: (view) => set({ activeView: view }),
    setAdvisorOpen: (open) => set({ advisorOpen: open }),
    setSelectedWireColor: (color) => set({ selectedWireColor: color }),
    setPendingInsertIC: (partNumber) => set({ pendingInsertIC: partNumber, placementError: null }),
    setSelectedICInstanceId: (id) => set({ selectedICInstanceId: id }),
    setSelectedWireId: (id) => set({ selectedWireId: id, selectedWireIds: id ? [id] : [] }),
    setSelectedWireIds: (ids) => {
      const unique = Array.from(new Set(ids));
      set({ selectedWireIds: unique, selectedWireId: unique[0] ?? null });
    },
    toggleSelectedWireId: (id) => {
      const st = get();
      const exists = st.selectedWireIds.includes(id);
      const next = exists
        ? st.selectedWireIds.filter((wId) => wId !== id)
        : [...st.selectedWireIds, id];
      set({ selectedWireIds: next, selectedWireId: next[0] ?? null });
    },
    clearPlacementError: () => set({ placementError: null }),

    togglePower: () => {
      commitCircuitChange((c) => {
        c.powerOn = !c.powerOn;
        if (!c.powerOn) {
          c.clock.autoRunning = false;
          c.pulse.running = false;
        }
        return c;
      }, false);
    },

    toggleSwitch: (index) => {
      if (index < 0 || index >= 16) return;
      commitCircuitChange((c) => {
        c.switches[index] = c.switches[index] === 1 ? 0 : 1;
        return c;
      });
    },

    setSwitchesBatch: (updates) => {
      commitCircuitChange((c) => {
        for (const [k, v] of Object.entries(updates)) {
          const idx = Number(k);
          if (idx >= 0 && idx < 16) c.switches[idx] = v;
        }
        return c;
      });
    },

    setClockMode: (mode) => {
      commitCircuitChange((c) => {
        c.clock.mode = mode;
        if (mode !== 'auto') c.clock.autoRunning = false;
        return c;
      }, false);
    },

    setClockFrequency: (hz) => {
      commitCircuitChange((c) => {
        c.clock.frequencyHz = Math.max(0.25, Math.min(20, hz));
        return c;
      }, false);
    },

    setClockDutyCycle: (pct) => {
      commitCircuitChange((c) => {
        c.clock.dutyCyclePercent = Math.max(10, Math.min(90, pct));
        return c;
      }, false);
    },

    triggerManualClockPress: (pressed) => {
      commitCircuitChange((c) => {
        if (!c.powerOn) return c;
        c.clock.level = pressed ? 1 : 0;
        return c;
      }, false);
    },

    triggerSingleStepClock: () => {
      commitCircuitChange((c) => {
        if (!c.powerOn) return c;
        c.clock.level = c.clock.level === 1 ? 0 : 1;
        return c;
      }, false);
    },

    toggleAutoClock: () => {
      commitCircuitChange((c) => {
        if (!c.powerOn) return c;
        c.clock.mode = 'auto';
        c.clock.autoRunning = !c.clock.autoRunning;
        return c;
      }, false);
    },

    tickAutoClockLevel: (nextLevel) => {
      const st = get();
      if (!st.project.circuit.powerOn || !st.project.circuit.clock.autoRunning) return;
      if (st.project.circuit.clock.level === nextLevel) return;
      commitCircuitChange((c) => {
        c.clock.level = nextLevel;
        return c;
      }, false);
    },

    togglePulseGenerator: () => {
      commitCircuitChange((c) => {
        if (!c.powerOn) return c;
        c.pulse.running = !c.pulse.running;
        if (!c.pulse.running) c.pulse.level = 0;
        return c;
      }, false);
    },

    setPulseFrequency: (hz) => {
      commitCircuitChange((c) => {
        c.pulse.frequencyHz = Math.max(0.5, Math.min(25, hz));
        return c;
      }, false);
    },

    setPulseDutyCycle: (pct) => {
      commitCircuitChange((c) => {
        c.pulse.dutyCyclePercent = Math.max(10, Math.min(90, pct));
        return c;
      }, false);
    },

    tickPulseLevel: (nextLevel) => {
      const st = get();
      if (!st.project.circuit.powerOn || !st.project.circuit.pulse.running) return;
      if (st.project.circuit.pulse.level === nextLevel) return;
      commitCircuitChange((c) => {
        c.pulse.level = nextLevel;
        return c;
      }, false);
    },

    insertIC: (partNumber, target) => {
      const def = getICDefinition(partNumber);
      if (!def) {
        const error = `Unknown IC part number: ${partNumber}`;
        set({ placementError: error });
        return { ok: false, error };
      }

      const st = get();
      if (target.kind === 'zif') {
        const compat = canInsertIntoZif(partNumber, target.socketId);
        if (!compat.ok) {
          set({ placementError: compat.reason ?? 'Incompatible socket.' });
          return { ok: false, error: compat.reason };
        }
        const occupied = st.project.circuit.placedICs.find(
          (p) => p.placement.kind === 'zif' && p.placement.socketId === target.socketId
        );
        if (occupied) {
          const error = `${target.socketId} already holds ${occupied.partNumber}. Remove it first before inserting ${partNumber}.`;
          set({ placementError: error });
          return { ok: false, error };
        }
      } else {
        const existingBB = st.project.circuit.placedICs
          .filter((p): p is PlacedIC & { placement: { kind: 'breadboard'; startCol: number } } =>
            p.placement.kind === 'breadboard'
          )
          .map((p) => ({
            instanceId: p.instanceId,
            partNumber: p.partNumber,
            startCol: p.placement.startCol,
          }));
        const compat = canPlaceOnBreadboard(partNumber, target.startCol, existingBB);
        if (!compat.ok) {
          set({ placementError: compat.reason ?? 'Invalid breadboard placement.' });
          return { ok: false, error: compat.reason };
        }
      }

      const instanceId = `ic_${partNumber}_${Date.now().toString(36)}`;
      commitCircuitChange((c) => {
        c.placedICs.push({
          instanceId,
          partNumber,
          placement: target,
        });
        return c;
      });
      set({
        pendingInsertIC: null,
        selectedICInstanceId: instanceId,
        placementError: null,
      });
      return { ok: true };
    },

    moveICToSocket: (instanceId, targetSocketId) => {
      const st = get();
      const ic = st.project.circuit.placedICs.find((p) => p.instanceId === instanceId);
      if (!ic) return { ok: false, error: 'IC not found.' };
      if (ic.placement.kind === 'zif' && ic.placement.socketId === targetSocketId) {
        return { ok: true };
      }
      const compat = canInsertIntoZif(ic.partNumber, targetSocketId);
      if (!compat.ok) {
        set({ placementError: compat.reason ?? 'Incompatible socket.' });
        return { ok: false, error: compat.reason };
      }
      const occupied = st.project.circuit.placedICs.find(
        (p) => p.instanceId !== instanceId && p.placement.kind === 'zif' && p.placement.socketId === targetSocketId
      );
      if (occupied) {
        const error = `${targetSocketId} already holds ${occupied.partNumber}.`;
        set({ placementError: error });
        return { ok: false, error };
      }
      commitCircuitChange((c) => {
        const target = c.placedICs.find((p) => p.instanceId === instanceId);
        if (target) {
          target.placement = { kind: 'zif', socketId: targetSocketId };
        }
        return c;
      });
      set({ selectedICInstanceId: instanceId, placementError: null });
      return { ok: true };
    },

    removeIC: (instanceId) => {
      commitCircuitChange((c) => {
        c.placedICs = c.placedICs.filter((ic) => ic.instanceId !== instanceId);
        return c;
      });
      if (get().selectedICInstanceId === instanceId) {
        set({ selectedICInstanceId: null });
      }
    },

    startOrCompleteWiring: (terminalId) => {
      const st = get();
      if (!st.wiringFrom) {
        set({ wiringFrom: terminalId, selectedWireId: null, selectedWireIds: [], placementError: null });
        return;
      }
      if (st.wiringFrom === terminalId) {
        set({ wiringFrom: null });
        return;
      }

      const from = st.wiringFrom;
      const to = terminalId;
      // Check if exact identical wire already exists
      const duplicate = st.project.circuit.wires.find(
        (w) => (w.from === from && w.to === to) || (w.from === to && w.to === from)
      );
      if (duplicate) {
        set({ wiringFrom: null, selectedWireId: duplicate.id, selectedWireIds: [duplicate.id] });
        return;
      }

      const kind: Wire['kind'] =
        from.startsWith('BB:') && to.startsWith('BB:') ? 'jumper' : 'patch-cord';

      const newWire: Wire = {
        id: `wire_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        from,
        to,
        color: st.selectedWireColor,
        kind,
      };

      commitCircuitChange((c) => {
        c.wires.push(newWire);
        return c;
      });
      set({ wiringFrom: null, selectedWireId: newWire.id, selectedWireIds: [newWire.id] });
    },

    cancelWiring: () => set({ wiringFrom: null }),

    removeWire: (wireId) => {
      commitCircuitChange((c) => {
        c.wires = c.wires.filter((w) => w.id !== wireId);
        return c;
      });
      const st = get();
      const nextIds = st.selectedWireIds.filter((id) => id !== wireId);
      set({
        selectedWireIds: nextIds,
        selectedWireId: nextIds[0] ?? null,
      });
    },

    removeWires: (wireIds) => {
      if (wireIds.length === 0) return;
      const idSet = new Set(wireIds);
      commitCircuitChange((c) => {
        c.wires = c.wires.filter((w) => !idSet.has(w.id));
        return c;
      });
      const st = get();
      const nextIds = st.selectedWireIds.filter((id) => !idSet.has(id));
      set({
        selectedWireIds: nextIds,
        selectedWireId: nextIds[0] ?? null,
      });
    },

    updateWireOffset: (wireId, dx, dy) => {
      commitCircuitChange((c) => {
        const target = c.wires.find((w) => w.id === wireId);
        if (target) {
          target.controlOffset = { dx, dy };
        }
        return c;
      }, false);
    },

    undo: () => {
      const st = get();
      if (st.undoStack.length === 0) return;
      const previous = st.undoStack[st.undoStack.length - 1];
      const nextUndo = st.undoStack.slice(0, -1);
      const nextRedo = [...st.redoStack, cloneCircuit(st.project.circuit)];
      set({
        project: {
          ...st.project,
          updatedAt: new Date().toISOString(),
          circuit: previous,
        },
        undoStack: nextUndo,
        redoStack: nextRedo,
        wiringFrom: null,
        selectedWireId: null,
        selectedWireIds: [],
      });
      void runSimulationStep(get, set);
      scheduleAutoSave(get);
    },

    redo: () => {
      const st = get();
      if (st.redoStack.length === 0) return;
      const next = st.redoStack[st.redoStack.length - 1];
      const nextRedo = st.redoStack.slice(0, -1);
      const nextUndo = [...st.undoStack, cloneCircuit(st.project.circuit)];
      set({
        project: {
          ...st.project,
          updatedAt: new Date().toISOString(),
          circuit: next,
        },
        undoStack: nextUndo,
        redoStack: nextRedo,
        wiringFrom: null,
        selectedWireId: null,
        selectedWireIds: [],
      });
      void runSimulationStep(get, set);
      scheduleAutoSave(get);
    },

    resetCircuit: () => {
      void simRunner.reset();
      commitCircuitChange(() => createEmptyCircuit());
      set({
        wiringFrom: null,
        selectedWireId: null,
        selectedWireIds: [],
        selectedICInstanceId: null,
        pendingInsertIC: null,
        placementError: null,
      });
    },

    newProject: (name) => {
      void simRunner.reset();
      const doc = createNewProject(name);
      set({
        project: doc,
        undoStack: [],
        redoStack: [],
        wiringFrom: null,
        selectedWireId: null,
        selectedWireIds: [],
        selectedICInstanceId: null,
        pendingInsertIC: null,
        placementError: null,
        activeView: 'workspace',
      });
      void runSimulationStep(get, set);
      void saveProjectToStorage(doc).then(() => get().refreshRecentProjects());
    },

    renameProject: (name) => {
      const st = get();
      const updated = { ...st.project, name, updatedAt: new Date().toISOString() };
      set({ project: updated });
      scheduleAutoSave(get);
    },

    saveCurrentProject: async () => {
      const st = get();
      await saveProjectToStorage(st.project);
      await st.refreshRecentProjects();
    },

    refreshRecentProjects: async () => {
      const list = await listStoredProjects();
      set({ recentProjects: list });
    },

    openProjectById: async (id) => {
      const loaded = await loadProjectById(id);
      if (!loaded) return;
      await simRunner.reset();
      set({
        project: loaded,
        undoStack: [],
        redoStack: [],
        wiringFrom: null,
        selectedWireId: null,
        selectedICInstanceId: null,
        activeView: 'workspace',
      });
      await runSimulationStep(get, set);
    },

    importProjectDocument: async (doc) => {
      await simRunner.reset();
      set({
        project: doc,
        undoStack: [],
        redoStack: [],
        wiringFrom: null,
        selectedWireId: null,
        selectedICInstanceId: null,
        activeView: 'workspace',
      });
      await saveProjectToStorage(doc);
      await get().refreshRecentProjects();
      await runSimulationStep(get, set);
    },

    deleteStoredProject: async (id) => {
      await deleteProjectById(id);
      await get().refreshRecentProjects();
    },

    setActiveExperimentId: (id) => set({ activeExperimentId: id }),

    updateExperimentNotes: (expId, observedNotes, finalResult) => {
      const st = get();
      const updated: ProjectDocument = {
        ...st.project,
        updatedAt: new Date().toISOString(),
        experimentNotes: {
          ...(st.project.experimentNotes ?? {}),
          [expId]: { observedNotes, finalResult },
        },
      };
      set({ project: updated });
      scheduleAutoSave(get);
    },
  };
});

export function getZifOccupant(placedICs: PlacedIC[], socketId: ZIFSocketId): PlacedIC | undefined {
  return placedICs.find(
    (p) => p.placement.kind === 'zif' && p.placement.socketId === socketId
  );
}
