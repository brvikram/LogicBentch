import React, { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';

export const DiagnosticsAdvisorModal: React.FC = () => {
  const open = useLabStore((s) => s.advisorOpen);
  const setOpen = useLabStore((s) => s.setAdvisorOpen);
  const project = useLabStore((s) => s.project);
  const simulation = useLabStore((s) => s.simulation);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const circuitSummary = {
        powerOn: project.circuit.powerOn,
        placedICs: project.circuit.placedICs,
        wireCount: project.circuit.wires.length,
        wires: project.circuit.wires.map((w) => ({
          from: w.from,
          to: w.to,
          color: w.color,
        })),
        activeDiagnostics: simulation.diagnostics.map((d) => ({
          code: d.code,
          severity: d.severity,
          title: d.title,
          detail: d.detail,
        })),
        clock: project.circuit.clock,
      };

      const res = await fetch('/api/diagnostics/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), circuitSummary }),
      });

      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
      } else {
        setAnswer(data.answer ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error reaching advisor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Engineering Circuit Diagnostics Advisor"
      className="fixed inset-0 z-50 bg-[#20252B]/60 flex items-center justify-center p-4"
    >
      <div className="bg-[#F1F0EB] border border-[#20252B] rounded-md w-full max-w-2xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="px-5 py-3.5 bg-[#303840] text-[#F1F0EB] flex items-center justify-between border-b border-[#20252B]">
          <div>
            <h2 className="text-sm font-semibold">Circuit Diagnostics & Datasheet Advisor</h2>
            <p className="text-xs text-[#A5ACB2]">
              Deep-reasoning circuit troubleshooting for your current DT-1004 wiring
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Diagnostics Advisor"
            onClick={() => setOpen(false)}
            className="p-1 text-[#A5ACB2] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="bg-[#E5E5E1] border border-[#C9C9C3] rounded p-3 text-xs text-[#303840] space-y-1">
            <div className="font-medium">Current Bench Context Sent with Query</div>
            <div className="font-mono text-[#555C62]">
              Power: {project.circuit.powerOn ? 'ON' : 'OFF'} · ICs:{' '}
              {project.circuit.placedICs.map((i) => i.partNumber).join(', ') || 'None'} · Wires:{' '}
              {project.circuit.wires.length} · Warnings: {simulation.diagnostics.length}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5">
            <label htmlFor="advisor-query" className="block text-xs font-medium text-[#303840]">
              Ask a troubleshooting or wiring question
            </label>
            <textarea
              id="advisor-query"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., Why is my 7490 counter only toggling QA and not advancing QB..QD?"
              className="w-full px-3 py-2 text-sm bg-white border border-[#B8B8B1] rounded text-[#20252B] focus:outline-none focus:border-[#456A83]"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setQuestion('Check my current wiring and diagnostics for pinout or power errors.')
                  }
                  className="text-xs text-[#456A83] hover:underline cursor-pointer"
                >
                  Check current wiring
                </button>
                <span className="text-xs text-[#A5ACB2]">·</span>
                <button
                  type="button"
                  onClick={() =>
                    setQuestion('Explain how to cascade 7490 QA to CKB and wire 7447 to DISP1.')
                  }
                  className="text-xs text-[#456A83] hover:underline cursor-pointer"
                >
                  7490 + 7447 cascade guide
                </button>
              </div>
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#456A83] text-[#F1F0EB] rounded hover:bg-[#527B96] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Analyze Circuit
                  </>
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="bg-[#BD8B43]/15 border border-[#BD8B43] rounded p-3 text-xs text-[#20252B]">
              <span className="font-semibold">Diagnostics Service Notice: </span>
              {error}
            </div>
          )}

          {answer && (
            <div className="bg-white border border-[#C9C9C3] rounded p-4 text-xs text-[#20252B] leading-relaxed whitespace-pre-wrap font-sans">
              {answer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
