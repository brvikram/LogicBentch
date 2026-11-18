import { CircuitSnapshot, ProjectDocument } from '../types/circuit';

const DB_NAME = 'LogicBenchDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const LS_FALLBACK_KEY = 'logicbench_projects_v1';

export function createEmptyCircuit(): CircuitSnapshot {
  return {
    powerOn: true,
    switches: Array(16).fill(0) as (0 | 1)[],
    clock: {
      mode: 'manual',
      autoRunning: false,
      frequencyHz: 1,
      dutyCyclePercent: 50,
      level: 0,
    },
    pulse: {
      running: false,
      frequencyHz: 2,
      dutyCyclePercent: 50,
      level: 0,
    },
    placedICs: [],
    wires: [],
  };
}

export function createNewProject(
  name = 'Untitled Trainer Circuit',
  description = 'DT-1004 digital laboratory workspace'
): ProjectDocument {
  const now = new Date().toISOString();
  return {
    schema: 'logicbench-project/v1',
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    description,
    createdAt: now,
    updatedAt: now,
    circuit: createEmptyCircuit(),
    experimentNotes: {},
  };
}

export function serializeProject(project: ProjectDocument): string {
  return JSON.stringify(project, null, 2);
}

export function parseAndValidateProject(jsonText: string): {
  ok: boolean;
  project?: ProjectDocument;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText) as Partial<ProjectDocument>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Invalid JSON object.' };
    }
    if (parsed.schema !== 'logicbench-project/v1') {
      return {
        ok: false,
        error: `Unsupported project schema: ${String(parsed.schema ?? 'missing')}. Expected logicbench-project/v1.`,
      };
    }
    if (!parsed.circuit || !Array.isArray(parsed.circuit.switches) || parsed.circuit.switches.length !== 16) {
      return { ok: false, error: 'Project circuit data is malformed (missing 16 switches).' };
    }
    if (!Array.isArray(parsed.circuit.placedICs) || !Array.isArray(parsed.circuit.wires)) {
      return { ok: false, error: 'Project circuit data is missing placedICs or wires.' };
    }
    const now = new Date().toISOString();
    const normalized: ProjectDocument = {
      schema: 'logicbench-project/v1',
      id: parsed.id || `proj_${Date.now()}`,
      name: parsed.name || 'Imported Circuit',
      description: parsed.description || '',
      createdAt: parsed.createdAt || now,
      updatedAt: parsed.updatedAt || now,
      circuit: {
        powerOn: Boolean(parsed.circuit.powerOn),
        switches: parsed.circuit.switches.map((s) => (s === 1 ? 1 : 0)) as (0 | 1)[],
        clock: parsed.circuit.clock ?? createEmptyCircuit().clock,
        pulse: parsed.circuit.pulse ?? createEmptyCircuit().pulse,
        placedICs: parsed.circuit.placedICs,
        wires: parsed.circuit.wires,
      },
      activeExperimentId: parsed.activeExperimentId,
      experimentNotes: parsed.experimentNotes ?? {},
    };
    return { ok: true, project: normalized };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to parse project JSON.',
    };
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getLocalFallbackProjects(): ProjectDocument[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function setLocalFallbackProjects(list: ProjectDocument[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

export function getProjectFileName(project: ProjectDocument): string {
  const slug = project.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'logicbench-circuit'}.logicbench.json`;
}

export async function saveProjectFileToDisk(
  project: ProjectDocument
): Promise<'saved' | 'cancelled'> {
  const json = serializeProject(project);
  const fileName = getProjectFileName(project);

  if (typeof window === 'undefined') return 'cancelled';

  const pickerWin = window as Window & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: string) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };

  if (typeof pickerWin.showSaveFilePicker === 'function') {
    try {
      const handle = await pickerWin.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'LogicBench Circuit Project (.logicbench.json)',
            accept: { 'application/json': ['.logicbench.json', '.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return 'saved';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
      // Fall through to browser download if blocked (e.g. iframe SecurityError)
    }
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return 'saved';
}

export async function saveProjectToStorage(project: ProjectDocument): Promise<void> {
  const stamped: ProjectDocument = {
    ...project,
    updatedAt: new Date().toISOString(),
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).put(stamped);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    const existing = getLocalFallbackProjects().filter((p) => p.id !== stamped.id);
    existing.unshift(stamped);
    setLocalFallbackProjects(existing.slice(0, 25));
  }
}

export async function listStoredProjects(): Promise<ProjectDocument[]> {
  let localList: ProjectDocument[] = [];
  try {
    const db = await openDB();
    localList = await new Promise<ProjectDocument[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).getAll();
      req.onsuccess = () => resolve((req.result as ProjectDocument[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    localList = getLocalFallbackProjects();
  }

  return localList.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadProjectById(id: string): Promise<ProjectDocument | null> {
  try {
    const db = await openDB();
    const found = await new Promise<ProjectDocument | null>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).get(id);
      req.onsuccess = () => resolve((req.result as ProjectDocument) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (found) return found;
  } catch {
    const fallback = getLocalFallbackProjects().find((p) => p.id === id) ?? null;
    if (fallback) return fallback;
  }

  return null;
}

export async function deleteProjectById(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    const filtered = getLocalFallbackProjects().filter((p) => p.id !== id);
    setLocalFallbackProjects(filtered);
  }
}
