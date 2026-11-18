import React from 'react';
import { Download } from 'lucide-react';
import { AppView, useLabStore } from '../store/useLabStore';

interface TopNavProps {
  onSaveAndExport: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onSaveAndExport }) => {
  const activeView = useLabStore((s) => s.activeView);
  const setActiveView = useLabStore((s) => s.setActiveView);

  const links: Array<{ id: AppView; label: string }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'workspace', label: 'Trainer Lab' },
    { id: 'library', label: 'IC Library' },
    { id: 'experiments', label: 'Experiments' },
  ];

  return (
    <header className="min-h-14 bg-[#20252B] text-[#F1F0EB] border-b border-[#303840] px-3 sm:px-6 py-2 sm:py-0 flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-4 gap-y-2 shrink-0">
      {/* Zone 1: Single-line Brand Wordmark */}
      <button
        type="button"
        onClick={() => setActiveView('dashboard')}
        className="text-base sm:text-lg font-semibold tracking-tight text-[#F1F0EB] whitespace-nowrap shrink-0 hover:text-white transition-colors cursor-pointer"
      >
        LogicBench
      </button>

      {/* Zone 2: Concise single-line navigation links */}
      <nav
        aria-label="Primary navigation"
        className="order-3 sm:order-2 w-full sm:w-auto flex items-center justify-between sm:justify-center gap-3 sm:gap-6 border-t sm:border-t-0 border-[#303840] pt-1.5 sm:pt-0"
      >
        {links.map((link) => {
          const isActive = activeView === link.id;
          return (
            <button
              key={link.id}
              type="button"
              onClick={() => setActiveView(link.id)}
              className={`text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#F1F0EB] border-[#456A83]'
                  : 'text-[#A5ACB2] border-transparent hover:text-[#F1F0EB]'
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Primary Local Save & Computer File Download */}
      <div className="order-2 sm:order-3 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onSaveAndExport}
          title="Save project locally & download .logicbench.json file to your computer"
          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs font-medium bg-[#456A83] text-[#F1F0EB] rounded hover:bg-[#527B96] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Save Project
        </button>
      </div>
    </header>
  );
};
