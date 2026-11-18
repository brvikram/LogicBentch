import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, Plus, Trash2, ArrowRight } from 'lucide-react';
import { getAllICDefinitions } from '../ic-library';
import { parseAndValidateProject } from '../storage/projectStorage';
import { useLabStore } from '../store/useLabStore';

export const DashboardView: React.FC = () => {
  const recentProjects = useLabStore((s) => s.recentProjects);
  const refreshRecentProjects = useLabStore((s) => s.refreshRecentProjects);
  const newProject = useLabStore((s) => s.newProject);
  const openProjectById = useLabStore((s) => s.openProjectById);
  const importProjectDocument = useLabStore((s) => s.importProjectDocument);
  const deleteStoredProject = useLabStore((s) => s.deleteStoredProject);
  const setActiveView = useLabStore((s) => s.setActiveView);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    void refreshRecentProjects();
  }, [refreshRecentProjects]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim() || `Lab Circuit ${recentProjects.length + 1}`;
    newProject(clean);
    setNewName('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = parseAndValidateProject(text);
    if (!res.ok || !res.project) {
      setImportError(res.error ?? 'Invalid project file.');
      return;
    }
    await importProjectDocument(res.project);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalICs = getAllICDefinitions().length;

  return (
    <main className="flex-1 overflow-y-auto bg-[#F1F0EB] text-[#20252B] px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Instrument Header */}
        <section className="bg-[#303840] text-[#F1F0EB] border border-[#20252B] rounded-md p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-[#A5ACB2]">
              DT-1004 Universal Digital Circuit Trainer
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#F1F0EB]">
              LogicBench Virtual Laboratory
            </h1>
            <p className="text-sm text-[#D6D5CE] leading-relaxed max-w-2xl">
              Build and verify real digital electronics circuits manually. Insert TTL, CMOS, and
              static RAM packages into the five ZIF sockets, route physical patch cords, apply
              clock transitions, and observe authentic IC-level behavior.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveView('workspace')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#456A83] text-[#F1F0EB] rounded hover:bg-[#527B96] transition-colors cursor-pointer"
              >
                Open Virtual Laboratory
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#20252B] text-[#F1F0EB] border border-[#47505A] rounded hover:bg-[#3A434D] transition-colors cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                Open Project File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.logicbench.json"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Import LogicBench project JSON file"
              />
            </div>
            {importError && (
              <p className="text-xs font-mono text-[#E8A45C] pt-1">{importError}</p>
            )}
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-3 border-t lg:border-t-0 lg:border-l border-[#47505A] pt-6 lg:pt-0 lg:pl-8">
            <div className="bg-[#20252B] border border-[#47505A] rounded p-3.5">
              <div className="text-xs text-[#A5ACB2]">IC Library</div>
              <div className="text-2xl font-mono font-semibold tabular-nums mt-1">
                {totalICs} ICs
              </div>
              <div className="text-xs text-[#747C82] mt-0.5">74xx · 4077 · 6116</div>
            </div>
            <div className="bg-[#20252B] border border-[#47505A] rounded p-3.5">
              <div className="text-xs text-[#A5ACB2]">Digital I/O</div>
              <div className="text-2xl font-mono font-semibold tabular-nums mt-1">16 / 16</div>
              <div className="text-xs text-[#747C82] mt-0.5">Switches · LEDs</div>
            </div>
            <div className="bg-[#20252B] border border-[#47505A] rounded p-3.5">
              <div className="text-xs text-[#A5ACB2]">Display Hardware</div>
              <div className="text-2xl font-mono font-semibold tabular-nums mt-1">1 × CA</div>
              <div className="text-xs text-[#747C82] mt-0.5">Onboard LTS542</div>
            </div>
            <div className="bg-[#20252B] border border-[#47505A] rounded p-3.5">
              <div className="text-xs text-[#A5ACB2]">ZIF IC Sockets</div>
              <div className="text-2xl font-mono font-semibold tabular-nums mt-1">5 ZIF</div>
              <div className="text-xs text-[#747C82] mt-0.5">4×16-pin + 1×24-pin RAM</div>
            </div>
          </div>
        </section>

        {/* New Circuit & Recent Projects */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* New Circuit Form */}
          <div className="lg:col-span-4 bg-[#E5E5E1] border border-[#C9C9C3] rounded-md p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#20252B]">New Circuit Project</h2>
            <p className="text-xs text-[#555C62] leading-relaxed">
              Initialize a clean DT-1004 trainer bench with five empty ZIF sockets (four 16-pin
              logic sockets + one 24-pin RAM socket) and integrated socket power.
            </p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label
                  htmlFor="new-project-name"
                  className="block text-xs font-medium text-[#303840] mb-1"
                >
                  Project Name
                </label>
                <input
                  id="new-project-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., 7490 Decade Counter Lab"
                  className="w-full px-3 py-2 text-sm bg-[#F1F0EB] border border-[#B8B8B1] rounded text-[#20252B] focus:outline-none focus:border-[#456A83]"
                />
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-[#20252B] text-[#F1F0EB] rounded hover:bg-[#303840] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create New Circuit
              </button>
            </form>

            <div className="pt-3 border-t border-[#C9C9C3] space-y-1.5 text-xs text-[#555C62]">
              <button
                type="button"
                onClick={() => setActiveView('library')}
                className="block text-[#456A83] hover:underline font-medium cursor-pointer"
              >
                Browse all 25 IC datasheets and pinouts
              </button>
              <button
                type="button"
                onClick={() => setActiveView('experiments')}
                className="block text-[#456A83] hover:underline font-medium cursor-pointer"
              >
                Open Experiment Laboratory framework
              </button>
            </div>
          </div>

          {/* Recent Projects */}
          <div className="lg:col-span-8 bg-[#E5E5E1] border border-[#C9C9C3] rounded-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#20252B]">Recent Saved Projects</h2>
              <span className="text-xs font-mono text-[#747C82]">
                Local Browser Storage · {recentProjects.length} saved
              </span>
            </div>

            {recentProjects.length === 0 ? (
              <div className="bg-[#F1F0EB] border border-[#D4D3CD] rounded p-6 text-center space-y-2">
                <p className="text-sm font-medium text-[#303840]">No saved circuits yet</p>
                <p className="text-xs text-[#747C82]">
                  Open the Virtual Laboratory or create a new circuit project above. Changes
                  auto-save to local browser storage, and clicking Save Project downloads a{' '}
                  <code>.logicbench.json</code> file directly to your computer.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#C9C9C3] bg-[#F1F0EB] border border-[#C9C9C3] rounded">
                {recentProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3.5 flex items-center justify-between gap-4 hover:bg-[#EAE9E3] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#20252B] truncate">
                        {proj.name}
                      </div>
                      <div className="text-xs font-mono text-[#747C82] mt-0.5 flex items-center gap-2">
                        <span>{proj.circuit.placedICs.length} ICs</span>
                        <span>·</span>
                        <span>{proj.circuit.wires.length} wires</span>
                        <span>·</span>
                        <span>{new Date(proj.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void openProjectById(proj.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-[#456A83] text-[#F1F0EB] rounded hover:bg-[#527B96] transition-colors cursor-pointer"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete project ${proj.name}`}
                        onClick={() => void deleteStoredProject(proj.id)}
                        className="p-1.5 text-[#747C82] hover:text-[#B83A32] rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};
