import React, { useState } from 'react';
import { Check, ArrowUpRight } from 'lucide-react';
import { EXPERIMENT_TEMPLATES } from '../experiments/templates';
import { useLabStore } from '../store/useLabStore';
import { LogicLevel } from '../types/circuit';

export const ExperimentsView: React.FC = () => {
  const activeExperimentId = useLabStore((s) => s.activeExperimentId);
  const setActiveExperimentId = useLabStore((s) => s.setActiveExperimentId);
  const project = useLabStore((s) => s.project);
  const simulation = useLabStore((s) => s.simulation);
  const setSwitchesBatch = useLabStore((s) => s.setSwitchesBatch);
  const setActiveView = useLabStore((s) => s.setActiveView);
  const updateExperimentNotes = useLabStore((s) => s.updateExperimentNotes);

  const [recordedRows, setRecordedRows] = useState<
    Record<string, { observed: Record<string, LogicLevel>; passed: boolean }>
  >({});

  const exp =
    EXPERIMENT_TEMPLATES.find((e) => e.id === activeExperimentId) ?? EXPERIMENT_TEMPLATES[0];
  const savedNote = project.experimentNotes?.[exp.id] ?? {
    observedNotes: '',
    finalResult: '',
  };

  const handleApplyAndSampleRow = (rowId: string, inputs: Record<string, 0 | 1>, expected: Record<string, LogicLevel>) => {
    const swUpdates: Record<number, 0 | 1> = {};
    for (const [k, v] of Object.entries(inputs)) {
      if (k.startsWith('SW')) {
        const idx = Number(k.slice(2));
        if (!Number.isNaN(idx)) swUpdates[idx] = v;
      }
    }
    setSwitchesBatch(swUpdates);

    // Wait briefly for worker simulation step to reflect applied switches
    setTimeout(() => {
      const latestSim = useLabStore.getState().simulation;
      const observed: Record<string, LogicLevel> = {};
      let allMatch = Object.keys(expected).length > 0;
      for (const [k, expVal] of Object.entries(expected)) {
        if (k.startsWith('LED')) {
          const idx = Number(k.slice(3));
          const actual = latestSim.ledStates[idx] ?? 'Z';
          observed[k] = actual;
          if (actual !== expVal) allMatch = false;
        }
      }
      setRecordedRows((prev) => ({
        ...prev,
        [`${exp.id}:${rowId}`]: { observed, passed: allMatch },
      }));
    }, 60);
  };

  return (
    <main className="flex-1 overflow-hidden bg-[#F1F0EB] text-[#20252B] flex flex-col lg:flex-row">
      {/* Left Experiment Selector */}
      <aside className="w-full lg:w-84 border-b lg:border-b-0 lg:border-r border-[#C9C9C3] bg-[#E5E5E1] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#C9C9C3]">
          <h2 className="text-sm font-semibold text-[#20252B]">Experiment Laboratory</h2>
          <p className="text-xs text-[#555C62] mt-1">
            Extensible DDHDL framework. Templates below are labeled reference test examples; build
            each circuit manually on the DT-1004 trainer.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[#C9C9C3]">
          {EXPERIMENT_TEMPLATES.map((t) => {
            const active = t.id === exp.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveExperimentId(t.id)}
                className={`w-full text-left p-3.5 transition-colors cursor-pointer ${
                  active ? 'bg-[#303840] text-[#F1F0EB]' : 'hover:bg-[#DAD9D3] text-[#20252B]'
                }`}
              >
                <div
                  className={`text-[11px] font-mono ${
                    active ? 'text-[#A5ACB2]' : 'text-[#747C82]'
                  }`}
                >
                  {t.category}
                </div>
                <div className="text-xs font-semibold mt-0.5 leading-snug">{t.title}</div>
                <div
                  className={`text-[11px] font-mono mt-1 ${
                    active ? 'text-[#D6D5CE]' : 'text-[#456A83]'
                  }`}
                >
                  ICs: {t.requiredICs.join(', ')}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Right Structured Lab Sheet */}
      <section className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#C9C9C3] pb-4">
            <div>
              <div className="text-xs font-mono text-[#747C82]">{exp.category}</div>
              <h1 className="text-xl font-semibold text-[#20252B] mt-1">{exp.title}</h1>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('workspace')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#456A83] text-[#F1F0EB] rounded hover:bg-[#527B96] cursor-pointer"
            >
              Build on Trainer
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Aim & Required ICs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-white border border-[#C9C9C3] rounded p-4">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#747C82]">Aim</h2>
              <p className="text-sm text-[#20252B] mt-1.5 leading-relaxed">{exp.aim}</p>
            </div>
            <div className="bg-white border border-[#C9C9C3] rounded p-4">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#747C82]">
                Required ICs
              </h2>
              <div className="mt-2 font-mono text-sm font-semibold text-[#20252B]">
                {exp.requiredICs.join(' · ')}
              </div>
              <div className="text-xs text-[#555C62] mt-1">
                Currently installed:{' '}
                {project.circuit.placedICs.map((i) => i.partNumber).join(', ') || 'None'}
              </div>
            </div>
          </div>

          {/* Construction & Pin Connections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-[#C9C9C3] rounded p-4 space-y-2">
              <h2 className="text-sm font-semibold text-[#20252B]">Circuit Construction Notes</h2>
              <ul className="list-disc pl-4 space-y-1.5 text-xs text-[#303840] leading-relaxed">
                {exp.constructionNotes.map((n, idx) => (
                  <li key={idx}>{n}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-[#C9C9C3] rounded overflow-hidden">
              <div className="px-4 py-2.5 bg-[#E5E5E1] border-b border-[#C9C9C3] text-sm font-semibold">
                Manual Pin Connections
              </div>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E5E5E1] text-[#747C82] font-mono">
                  <tr>
                    <th className="py-1.5 px-3">From</th>
                    <th className="py-1.5 px-3">To</th>
                    <th className="py-1.5 px-3">Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E1] font-mono text-[11px]">
                  {exp.pinConnections.map((pc, i) => (
                    <tr key={i}>
                      <td className="py-1.5 px-3">{pc.from}</td>
                      <td className="py-1.5 px-3">{pc.to}</td>
                      <td className="py-1.5 px-3 font-sans text-[#555C62]">{pc.signal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Procedure */}
          <div className="bg-white border border-[#C9C9C3] rounded p-4 space-y-2">
            <h2 className="text-sm font-semibold text-[#20252B]">Laboratory Procedure</h2>
            <ol className="list-decimal pl-4 space-y-1 text-xs text-[#303840] leading-relaxed">
              {exp.procedure.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          {/* Truth Table Verification */}
          <div className="bg-white border border-[#C9C9C3] rounded overflow-hidden">
            <div className="px-4 py-2.5 bg-[#E5E5E1] border-b border-[#C9C9C3] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#20252B]">
                Truth Table Verification (Live Circuit Check)
              </h2>
              <span className="text-xs font-mono text-[#555C62]">
                Power: {simulation.powerOn ? 'ON' : 'OFF'}
              </span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#C9C9C3] text-[#747C82] font-mono">
                <tr>
                  <th className="py-2 px-3">Test Case</th>
                  <th className="py-2 px-3">Switch Inputs</th>
                  <th className="py-2 px-3">Expected</th>
                  <th className="py-2 px-3">Observed (Actual Circuit)</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E1] font-mono">
                {exp.truthTable.map((row) => {
                  const rec = recordedRows[`${exp.id}:${row.id}`];
                  return (
                    <tr key={row.id}>
                      <td className="py-2 px-3 font-sans font-medium text-[#20252B]">
                        {row.label}
                      </td>
                      <td className="py-2 px-3">
                        {Object.entries(row.inputs)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(', ')}
                      </td>
                      <td className="py-2 px-3">
                        {Object.entries(row.expected)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(', ') || 'See 7-Seg'}
                      </td>
                      <td className="py-2 px-3">
                        {rec ? (
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              rec.passed ? 'text-[#587965]' : 'text-[#BD8B43]'
                            }`}
                          >
                            {rec.passed && <Check className="w-3.5 h-3.5" />}
                            {Object.entries(rec.observed)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(', ') || 'Applied'}
                          </span>
                        ) : (
                          <span className="text-[#747C82]">Not tested</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleApplyAndSampleRow(row.id, row.inputs, row.expected)
                          }
                          className="px-2.5 py-1 text-[11px] font-sans font-medium bg-[#303840] text-[#F1F0EB] rounded hover:bg-[#456A83] cursor-pointer"
                        >
                          Test Row
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expected / Observed / Final Result */}
          <div className="bg-white border border-[#C9C9C3] rounded p-4 space-y-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-[#747C82]">
                Expected Result
              </div>
              <p className="text-xs text-[#303840] mt-1">{exp.expectedResult}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="exp-observed"
                  className="block text-xs font-medium text-[#303840] mb-1"
                >
                  Observed Result Notes
                </label>
                <textarea
                  id="exp-observed"
                  rows={3}
                  value={savedNote.observedNotes}
                  onChange={(e) =>
                    updateExperimentNotes(exp.id, e.target.value, savedNote.finalResult)
                  }
                  placeholder="Record observed LED / 7-segment readings..."
                  className="w-full px-3 py-2 text-xs bg-[#F1F0EB] border border-[#B8B8B1] rounded focus:outline-none focus:border-[#456A83]"
                />
              </div>
              <div>
                <label
                  htmlFor="exp-final"
                  className="block text-xs font-medium text-[#303840] mb-1"
                >
                  Final Conclusion
                </label>
                <textarea
                  id="exp-final"
                  rows={3}
                  value={savedNote.finalResult}
                  onChange={(e) =>
                    updateExperimentNotes(exp.id, savedNote.observedNotes, e.target.value)
                  }
                  placeholder="e.g., Truth table verified successfully on DT-1004."
                  className="w-full px-3 py-2 text-xs bg-[#F1F0EB] border border-[#B8B8B1] rounded focus:outline-none focus:border-[#456A83]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
