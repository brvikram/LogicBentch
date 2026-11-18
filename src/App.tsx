import React, { useEffect, useState } from 'react';
import { DashboardView } from './components/DashboardView';
import { DiagnosticsAdvisorModal } from './components/DiagnosticsAdvisorModal';
import { ExperimentsView } from './components/ExperimentsView';
import { ICLibraryView } from './components/ICLibraryView';
import { TopNav } from './components/TopNav';
import { TrainerWorkspace } from './components/TrainerWorkspace';
import { getProjectFileName, saveProjectFileToDisk } from './storage/projectStorage';
import { useLabStore } from './store/useLabStore';

export default function App() {
  const activeView = useLabStore((s) => s.activeView);
  const saveCurrentProject = useLabStore((s) => s.saveCurrentProject);
  const refreshRecentProjects = useLabStore((s) => s.refreshRecentProjects);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);

  useEffect(() => {
    void refreshRecentProjects();
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [refreshRecentProjects]);

  const handleSave = async () => {
    await saveCurrentProject();
    const currentProject = useLabStore.getState().project;
    const diskStatus = await saveProjectFileToDisk(currentProject);
    setSaveToast(
      diskStatus === 'saved'
        ? `Saved ${getProjectFileName(currentProject)} to your computer`
        : 'Saved to browser storage (file save cancelled)'
    );
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setSaveToast(null), 3200);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#F1F0EB] text-[#20252B]">
      <TopNav onSaveAndExport={() => void handleSave()} />

      {activeView === 'dashboard' && <DashboardView />}
      {activeView === 'workspace' && <TrainerWorkspace />}
      {activeView === 'library' && <ICLibraryView />}
      {activeView === 'experiments' && <ExperimentsView />}

      <DiagnosticsAdvisorModal />

      {saveToast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 bg-[#20252B] text-[#F1F0EB] border border-[#456A83] px-4 py-2 rounded text-xs font-mono shadow-lg"
        >
          {saveToast}
        </div>
      )}
    </div>
  );
}
