import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Download,
  Info,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Redo2,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { canInsertIntoZif, getAllICDefinitions, getICDefinition } from '../ic-library';
import {
  describeTerminalEndpoint,
  formatDirectionTag,
  getDisplayedZifPinInfo,
} from '../simulation/netlist';
import { saveProjectFileToDisk } from '../storage/projectStorage';
import { useLabStore } from '../store/useLabStore';
import { WIRE_COLOR_HEX } from '../trainer/boardLayout';
import { ICDefinition, PlacedIC, WireColor, ZIFSocketId } from '../types/circuit';
import { ICInternalDiagram } from './ICInternalDiagram';
import { TrainerBoardSVG } from './TrainerBoardSVG';

/**
 * Crisp miniature DIP IC package symbol displayed beside each IC in the search picker
 * (inspired by the user's reference image, rendered in LogicBench's instrument aesthetic).
 */
const MiniDipChipIcon: React.FC<{ pinCount: number; selected?: boolean }> = ({
  pinCount,
  selected = false,
}) => {
  const pinsPerSide = Math.min(8, Math.floor(pinCount / 2));
  const bodyColor = selected ? '#303840' : '#6D747B';
  const pinColor = selected ? '#456A83' : '#8A9199';

  return (
    <svg
      width={28}
      height={34}
      viewBox="0 0 28 34"
      className="shrink-0"
      aria-hidden="true"
    >
      {Array.from({ length: pinsPerSide }).map((_, idx) => {
        const y = 4 + idx * (26 / Math.max(1, pinsPerSide - 1)) - 1.2;
        return (
          <g key={idx}>
            <rect x={2} y={y} width={5} height={2.4} rx={0.6} fill={pinColor} />
            <rect x={21} y={y} width={5} height={2.4} rx={0.6} fill={pinColor} />
          </g>
        );
      })}
      <rect x={6.5} y={2} width={15} height={30} rx={2} fill={bodyColor} />
      <path d="M 11.5 2 A 2.5 2.5 0 0 0 16.5 2" fill="#EAE9E3" />
    </svg>
  );
};

const BASIC_GATE_PRIORITY: string[] = [
  '7400',
  '7402',
  '7404',
  '7408',
  '7432',
  '7486',
  '4077',
  '7410',
  '7420',
  '7427',
];

const IC_SEARCH_KEYWORDS: Record<string, string[]> = {
  '7400': ['nand', 'quad 2-input nand', 'basic gate', 'universal gate', 'ttl', '74ls00'],
  '7402': ['nor', 'quad 2-input nor', 'basic gate', 'universal gate', 'ttl', '74ls02'],
  '7404': ['not', 'inverter', 'hex inverter', 'complement', 'basic gate', '74ls04'],
  '7408': ['and', 'quad 2-input and', 'basic gate', 'product', '74ls08'],
  '7410': ['nand', '3-input nand', 'triple 3-input nand', 'gate', '74ls10'],
  '7420': ['nand', '4-input nand', 'dual 4-input nand', 'gate', '74ls20'],
  '7427': ['nor', '3-input nor', 'triple 3-input nor', 'gate', '74ls27'],
  '7432': ['or', 'quad 2-input or', 'basic gate', 'sum', '74ls32'],
  '7486': ['xor', 'exor', 'ex-or', 'exclusive or', 'parity', 'half adder', 'basic gate', '74ls86'],
  '4077': ['xnor', 'exnor', 'ex-nor', 'exclusive nor', 'equivalence', 'cmos', 'cd4077'],
  '7483': ['adder', 'full adder', '4-bit binary full adder', 'carry', 'arithmetic', 'sum', '74ls83'],
  '7485': ['comparator', 'magnitude comparator', '4-bit comparator', 'equal', 'greater', 'less', '74ls85'],
  '74138': ['decoder', 'demux', 'demultiplexer', '3-to-8', '3 to 8 decoder', '74ls138'],
  '74139': ['decoder', 'demux', 'dual 2-to-4', '2 to 4 decoder', '74ls139'],
  '74148': ['encoder', 'priority encoder', '8-to-3', '8 to 3 encoder', 'octal', '74ls148'],
  '74151': ['mux', 'multiplexer', 'data selector', '8-to-1', '8 to 1 mux', '74ls151'],
  '74153': ['mux', 'multiplexer', 'dual 4-to-1', '4 to 1 mux', '74ls153'],
  '7446': ['bcd', '7-segment', 'seven segment', 'decoder driver', 'display', '30v', '74ls46'],
  '7447': ['bcd', '7-segment', 'seven segment', 'decoder driver', 'display', 'lts542', '74ls47'],
  '7474': ['flip-flop', 'flip flop', 'd flip-flop', 'dual d', 'register', 'edge triggered', 'sequential', '74ls74'],
  '7476': ['flip-flop', 'flip flop', 'jk flip-flop', 'j-k', 'master-slave', 'toggle', 'sequential', '74ls76'],
  '7490': ['counter', 'decade counter', 'bcd counter', 'mod-10', 'mod 10', 'divide by 10', 'sequential', '74ls90'],
  '7493': ['counter', 'binary counter', '4-bit counter', 'mod-16', 'mod 16', 'ripple counter', 'sequential', '74ls93'],
  '7495': ['shift register', 'shift', 'parallel', 'serial', 'left shift', 'right shift', 'sequential', '74ls95'],
  '74192': ['counter', 'up/down counter', 'synchronous counter', 'decade up down', 'presettable', '74ls192'],
  '6116': ['ram', 'sram', 'memory', 'static ram', '2kx8', 'hm6116', 'read write', '24-pin'],
};

function scoreICForQuery(ic: ICDefinition, rawQuery: string, matchedCategories: Set<string>): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 0;

  const part = ic.partNumber.toLowerCase();
  const partLs = part.startsWith('74') ? `74ls${part.slice(2)}` : part;
  const name = ic.name.toLowerCase();
  const desc = ic.description.toLowerCase();
  const keywords = IC_SEARCH_KEYWORDS[ic.partNumber] ?? [];

  let score = 0;

  if (part === q || partLs === q) score += 200;
  else if (part.startsWith(q) || partLs.startsWith(q)) score += 140;
  else if (part.includes(q) || partLs.includes(q)) score += 100;

  if (name === q) score += 160;
  else if (name.includes(q)) score += 110;

  for (const kw of keywords) {
    if (kw === q) score += 120;
    else if (kw.startsWith(q)) score += 85;
    else if (kw.includes(q)) score += 60;
  }

  // Multi-token search support
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const haystack = `${part} ${partLs} ${name} ${desc} ${keywords.join(' ')}`;
    const allPresent = tokens.every((t) => haystack.includes(t));
    if (allPresent) score += 90;
  }

  if (desc.includes(q)) score += 35;

  // Boost related ICs in the same category as the primary search hits
  if (score === 0 && matchedCategories.has(ic.category)) {
    score += 20;
  }

  return score;
}

function formatTerminalDisplay(terminalId: string, placedICs: PlacedIC[]): string {
  if (terminalId.startsWith('PWR:+5V:')) {
    const idx = Number(terminalId.split(':')[2]);
    return `ZIF-${idx + 1}:+5V`;
  }
  if (terminalId.startsWith('PWR:GND:')) {
    const idx = Number(terminalId.split(':')[2]);
    return `ZIF-${idx + 1}:GND`;
  }
  if (terminalId.startsWith('ZIF')) {
    const [sock, pinStr] = terminalId.split(':');
    const physPin = Number(pinStr);
    const info = getDisplayedZifPinInfo(sock as ZIFSocketId, physPin, placedICs);
    if (info.icPinName) {
      const dirTag = formatDirectionTag(info.icPinDirection);
      return `${sock}:Pin ${info.displayedPin} (${info.icPinName} · ${dirTag})`;
    }
    return `${sock}:Pin ${info.displayedPin}`;
  }
  return terminalId;
}

export const TrainerWorkspace: React.FC = () => {
  const project = useLabStore((s) => s.project);
  const simulation = useLabStore((s) => s.simulation);
  const undoStack = useLabStore((s) => s.undoStack);
  const redoStack = useLabStore((s) => s.redoStack);

  const selectedWireColor = useLabStore((s) => s.selectedWireColor);
  const wiringFrom = useLabStore((s) => s.wiringFrom);
  const selectedWireId = useLabStore((s) => s.selectedWireId);
  const selectedWireIds = useLabStore((s) => s.selectedWireIds);
  const pendingInsertIC = useLabStore((s) => s.pendingInsertIC);
  const selectedICInstanceId = useLabStore((s) => s.selectedICInstanceId);
  const placementError = useLabStore((s) => s.placementError);

  const setSelectedWireColor = useLabStore((s) => s.setSelectedWireColor);
  const setSelectedWireIds = useLabStore((s) => s.setSelectedWireIds);
  const toggleSelectedWireId = useLabStore((s) => s.toggleSelectedWireId);
  const setPendingInsertIC = useLabStore((s) => s.setPendingInsertIC);
  const clearPlacementError = useLabStore((s) => s.clearPlacementError);
  const cancelWiring = useLabStore((s) => s.cancelWiring);
  const insertIC = useLabStore((s) => s.insertIC);
  const removeIC = useLabStore((s) => s.removeIC);
  const removeWire = useLabStore((s) => s.removeWire);
  const removeWires = useLabStore((s) => s.removeWires);
  const undo = useLabStore((s) => s.undo);
  const redo = useLabStore((s) => s.redo);
  const resetCircuit = useLabStore((s) => s.resetCircuit);
  const renameProject = useLabStore((s) => s.renameProject);
  const setAdvisorOpen = useLabStore((s) => s.setAdvisorOpen);

  const setClockFrequency = useLabStore((s) => s.setClockFrequency);
  const setClockDutyCycle = useLabStore((s) => s.setClockDutyCycle);
  const tickAutoClockLevel = useLabStore((s) => s.tickAutoClockLevel);
  const setPulseFrequency = useLabStore((s) => s.setPulseFrequency);
  const setPulseDutyCycle = useLabStore((s) => s.setPulseDutyCycle);
  const tickPulseLevel = useLabStore((s) => s.tickPulseLevel);

  const [quickICPart, setQuickICPart] = useState('7400');
  const [icSearchOpen, setIcSearchOpen] = useState(false);
  const [icSearchQuery, setIcSearchQuery] = useState('');
  const icSearchContainerRef = useRef<HTMLDivElement>(null);
  const icSearchInputRef = useRef<HTMLInputElement>(null);

  const [inspectorTab, setInspectorTab] = useState<'diagnostics' | 'ic' | 'wires' | 'clock'>(
    'diagnostics'
  );
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  const allICs = getAllICDefinitions();
  const selectedQuickICDef = getICDefinition(quickICPart) ?? allICs[0];
  const { circuit } = project;

  // Close IC search popover when clicking outside
  useEffect(() => {
    if (!icSearchOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        icSearchContainerRef.current &&
        !icSearchContainerRef.current.contains(e.target as Node)
      ) {
        setIcSearchOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [icSearchOpen]);

  // Compute organized IC cards for the search picker:
  // - When query is empty: show Default Basic Logic Gates on top + MSI/Sequential/Memory below
  // - When searching: rank exact/keyword matches at the very top followed by related ICs in the same category
  const searchResults = useMemo(() => {
    const q = icSearchQuery.trim();
    if (!q) {
      const basicGates = BASIC_GATE_PRIORITY.map((p) => allICs.find((ic) => ic.partNumber === p)).filter(
        (ic): ic is ICDefinition => Boolean(ic)
      );
      const advancedICs = allICs.filter((ic) => !BASIC_GATE_PRIORITY.includes(ic.partNumber));
      return {
        mode: 'default' as const,
        basicGates,
        advancedICs,
        ranked: [] as Array<{ ic: ICDefinition; isRelated: boolean }>,
      };
    }

    // First pass: direct matches
    const directCategories = new Set<string>();
    const directScores = new Map<string, number>();
    for (const ic of allICs) {
      const s = scoreICForQuery(ic, q, new Set());
      if (s > 0) {
        directScores.set(ic.partNumber, s);
        directCategories.add(ic.category);
      }
    }

    // Second pass: include related ICs from the matched categories below direct matches
    const scoredList: Array<{ ic: ICDefinition; score: number; isRelated: boolean }> = [];
    for (const ic of allICs) {
      const direct = directScores.get(ic.partNumber) ?? 0;
      if (direct > 0) {
        scoredList.push({ ic, score: direct, isRelated: false });
      } else if (directCategories.has(ic.category)) {
        scoredList.push({ ic, score: 20, isRelated: true });
      }
    }

    scoredList.sort((a, b) => b.score - a.score || a.ic.partNumber.localeCompare(b.ic.partNumber));

    return {
      mode: 'search' as const,
      basicGates: [] as ICDefinition[],
      advancedICs: [] as ICDefinition[],
      ranked: scoredList.map((item) => ({ ic: item.ic, isRelated: item.isRelated })),
    };
  }, [allICs, icSearchQuery]);

  // Escape key cancels active patch cord routing, pending IC placement, IC search popover, or reset confirmation popup;
  // Delete / Backspace deletes all selected wires
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        cancelWiring();
        setPendingInsertIC(null);
        setShowResetConfirmModal(false);
        setIcSearchOpen(false);
        setSelectedWireIds([]);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditable) {
        if (selectedWireIds.length > 0) {
          e.preventDefault();
          removeWires(selectedWireIds);
        } else if (selectedWireId) {
          e.preventDefault();
          removeWire(selectedWireId);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !isEditable) {
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    cancelWiring,
    setPendingInsertIC,
    setSelectedWireIds,
    selectedWireIds,
    selectedWireId,
    removeWires,
    removeWire,
    undo,
    redo,
  ]);

  // Automatic Clock Generator Timer (respects frequencyHz & dutyCyclePercent)
  useEffect(() => {
    if (!circuit.powerOn || !circuit.clock.autoRunning) return;
    const periodMs = 1000 / Math.max(0.25, circuit.clock.frequencyHz);
    const highMs = Math.max(20, periodMs * (circuit.clock.dutyCyclePercent / 100));
    const lowMs = Math.max(20, periodMs - highMs);
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const scheduleNext = (currentLevel: 0 | 1) => {
      const wait = currentLevel === 1 ? highMs : lowMs;
      timer = setTimeout(() => {
        if (!active) return;
        const next: 0 | 1 = currentLevel === 1 ? 0 : 1;
        tickAutoClockLevel(next);
        scheduleNext(next);
      }, wait);
    };

    scheduleNext(circuit.clock.level);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    circuit.powerOn,
    circuit.clock.autoRunning,
    circuit.clock.frequencyHz,
    circuit.clock.dutyCyclePercent,
    circuit.clock.level,
    tickAutoClockLevel,
  ]);

  // Pulse Generator Timer
  useEffect(() => {
    if (!circuit.powerOn || !circuit.pulse.running) return;
    const periodMs = 1000 / Math.max(0.5, circuit.pulse.frequencyHz);
    const highMs = Math.max(15, periodMs * (circuit.pulse.dutyCyclePercent / 100));
    const lowMs = Math.max(15, periodMs - highMs);
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const scheduleNext = (currentLevel: 0 | 1) => {
      const wait = currentLevel === 1 ? highMs : lowMs;
      timer = setTimeout(() => {
        if (!active) return;
        const next: 0 | 1 = currentLevel === 1 ? 0 : 1;
        tickPulseLevel(next);
        scheduleNext(next);
      }, wait);
    };

    scheduleNext(circuit.pulse.level);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    circuit.powerOn,
    circuit.pulse.running,
    circuit.pulse.frequencyHz,
    circuit.pulse.dutyCyclePercent,
    circuit.pulse.level,
    tickPulseLevel,
  ]);

  const handleExportJson = async () => {
    await useLabStore.getState().saveCurrentProject();
    await saveProjectFileToDisk(useLabStore.getState().project);
  };

  const quickCompat16 = canInsertIntoZif(quickICPart, 'ZIF1');
  const quickCompat24 = canInsertIntoZif(quickICPart, 'ZIF5');

  const inspectedIC =
    circuit.placedICs.find((p) => p.instanceId === selectedICInstanceId) ??
    circuit.placedICs[0] ??
    null;
  const inspectedICDef = inspectedIC ? getICDefinition(inspectedIC.partNumber) : null;
  const inspectedICRt = inspectedIC ? simulation.icStates[inspectedIC.instanceId] : undefined;

  const wireColors: WireColor[] = ['red', 'black', 'yellow', 'blue', 'green'];

  const errorCount = simulation.diagnostics.filter((d) => d.severity === 'error').length;
  const warnCount = simulation.diagnostics.filter((d) => d.severity === 'warning').length;

  const renderICPickerCard = (ic: ICDefinition, isRelated = false) => {
    const isSelected = ic.partNumber === quickICPart;
    return (
      <button
        key={ic.partNumber}
        type="button"
        data-testid={`ic-card-${ic.partNumber}`}
        onClick={() => {
          setQuickICPart(ic.partNumber);
          setIcSearchOpen(false);
        }}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-md border text-left transition-all cursor-pointer ${
          isSelected
            ? 'bg-[#E5EEF5] border-[#456A83] ring-1 ring-[#456A83] shadow-xs'
            : isRelated
            ? 'bg-[#F4F3EE]/80 border-[#D4D3CD] hover:border-[#8A9199] hover:bg-white'
            : 'bg-[#F8F7F4] border-[#C9C9C3] hover:border-[#456A83] hover:bg-white'
        }`}
      >
        <MiniDipChipIcon pinCount={ic.pinCount} selected={isSelected} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-mono font-bold text-[#20252B] truncate">
              {ic.partNumber}
            </span>
            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-[#E5E5E1] text-[#555C62] shrink-0">
              {ic.pinCount}P
            </span>
          </div>
          <div className="text-[11px] text-[#555C62] truncate mt-0.5" title={ic.name}>
            {ic.name}
          </div>
        </div>
      </button>
    );
  };

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-[#F1F0EB] text-[#20252B]">
      {/* Instrument Bench Toolbar */}
      <div className="bg-[#E5E5E1] border-b border-[#C9C9C3] px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Project & IC Search + Insertion Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            aria-label="Current project name"
            value={project.name}
            onChange={(e) => renameProject(e.target.value)}
            className="px-2.5 py-1 text-xs font-medium bg-[#F1F0EB] border border-[#B8B8B1] rounded text-[#20252B] w-36 sm:w-40 focus:outline-none focus:border-[#456A83]"
          />

          <div className="h-5 w-px bg-[#C9C9C3]" />

          <span className="text-xs font-medium text-[#303840]">IC:</span>

          {/* Interactive IC Search Bar + Visual DIP Card Popover */}
          <div ref={icSearchContainerRef} className="relative" data-testid="ic-search-container">
            <div
              onClick={() => {
                setIcSearchOpen(true);
                setTimeout(() => icSearchInputRef.current?.focus(), 10);
              }}
              className={`flex items-center gap-2 px-2.5 py-1 bg-[#F1F0EB] border rounded text-xs cursor-pointer transition-colors w-[250px] sm:w-[285px] ${
                icSearchOpen
                  ? 'border-[#456A83] ring-1 ring-[#456A83]'
                  : 'border-[#B8B8B1] hover:border-[#456A83]'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-[#555C62] shrink-0" />
              {icSearchOpen ? (
                <input
                  ref={icSearchInputRef}
                  type="text"
                  data-testid="ic-search-input"
                  value={icSearchQuery}
                  onChange={(e) => setIcSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const topMatch =
                        searchResults.mode === 'search'
                          ? searchResults.ranked[0]?.ic
                          : searchResults.basicGates[0];
                      if (topMatch) {
                        setQuickICPart(topMatch.partNumber);
                        setIcSearchOpen(false);
                      }
                    }
                  }}
                  placeholder="Search 7400, NAND, Adder, Counter, RAM..."
                  className="w-full bg-transparent text-xs font-mono text-[#20252B] focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  data-testid="ic-search-trigger"
                  className="flex items-center justify-between gap-2 w-full text-left font-mono text-xs text-[#20252B] truncate cursor-pointer"
                >
                  <span className="truncate">
                    <strong>{selectedQuickICDef.partNumber}</strong> — {selectedQuickICDef.name} (
                    {selectedQuickICDef.pinCount}p)
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#555C62] shrink-0" />
                </button>
              )}
              {icSearchOpen && icSearchQuery && (
                <button
                  type="button"
                  aria-label="Clear IC search query"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIcSearchQuery('');
                    icSearchInputRef.current?.focus();
                  }}
                  className="p-0.5 text-[#747C82] hover:text-[#20252B] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {icSearchOpen && (
              <div
                data-testid="ic-search-popover"
                className="absolute left-0 top-full mt-1.5 z-50 w-[92vw] max-w-[760px] max-h-[440px] overflow-y-auto bg-[#EAE9E3] border border-[#303840] rounded-md shadow-xl p-3.5 space-y-3"
              >
                {searchResults.mode === 'default' ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-[#C9C9C3] pb-1">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#303840]">
                          Essential Basic Logic Gates (Default)
                        </span>
                        <span className="text-[10px] font-mono text-[#555C62]">
                          Click any IC card to select, then click + ZIF socket
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {searchResults.basicGates.map((ic) => renderICPickerCard(ic, false))}
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between border-b border-[#C9C9C3] pb-1">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#303840]">
                          Combinational, Sequential &amp; Static RAM ICs
                        </span>
                        <span className="text-[10px] font-mono text-[#555C62]">
                          Adders · Decoders · MUX · Flip-Flops · Counters · 6116 RAM
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {searchResults.advancedICs.map((ic) => renderICPickerCard(ic, false))}
                      </div>
                    </div>
                  </>
                ) : searchResults.ranked.length === 0 ? (
                  <div className="py-6 text-center text-xs font-mono text-[#555C62]">
                    No matching IC found for &ldquo;{icSearchQuery}&rdquo;. Try searching 7400, NAND,
                    Adder, Counter, Decoder, MUX, or 6116.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-[#C9C9C3] pb-1">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#303840]">
                        Top Search Matches &amp; Related ICs ({searchResults.ranked.length})
                      </span>
                      <span className="text-[10px] font-mono text-[#555C62]">
                        Press Enter to select top match
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {searchResults.ranked.map(({ ic, isRelated }) =>
                        renderICPickerCard(ic, isRelated)
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {(['ZIF1', 'ZIF2', 'ZIF3', 'ZIF4'] as const).map((sockId, idx) => (
            <button
              key={sockId}
              type="button"
              disabled={!quickCompat16.ok}
              onClick={() => insertIC(quickICPart, { kind: 'zif', socketId: sockId })}
              className="px-2 py-1 text-xs font-medium bg-[#303840] text-[#F1F0EB] rounded hover:bg-[#414B56] disabled:opacity-35 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              + ZIF-{idx + 1}
            </button>
          ))}

          <button
            type="button"
            disabled={!quickCompat24.ok}
            onClick={() => insertIC(quickICPart, { kind: 'zif', socketId: 'ZIF5' })}
            className="px-2.5 py-1 text-xs font-medium bg-[#456A83] text-[#F1F0EB] rounded hover:bg-[#527B96] disabled:opacity-35 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
          >
            + ZIF-5 (24P RAM)
          </button>
        </div>

        {/* Patch Cord Color & Bench Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#F1F0EB] border border-[#C9C9C3] rounded px-2 py-1">
            <span className="text-[11px] font-medium text-[#555C62] mr-1">Cord:</span>
            {wireColors.map((c) => {
              const active = selectedWireColor === c;
              return (
                <button
                  key={c}
                  type="button"
                  title={WIRE_COLOR_HEX[c].label}
                  aria-label={`Select ${WIRE_COLOR_HEX[c].label} patch cord`}
                  onClick={() => setSelectedWireColor(c)}
                  className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                    active ? 'scale-115 ring-2 ring-[#456A83] border-white' : 'border-[#20252B]/40'
                  }`}
                  style={{ backgroundColor: WIRE_COLOR_HEX[c].stroke }}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0}
            aria-label="Undo circuit edit"
            title="Undo (Ctrl+Z)"
            className="p-1.5 bg-[#F1F0EB] border border-[#B8B8B1] rounded text-[#20252B] hover:bg-[#DAD9D3] disabled:opacity-40 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStack.length === 0}
            aria-label="Redo circuit edit"
            title="Redo (Ctrl+Shift+Z)"
            className="p-1.5 bg-[#F1F0EB] border border-[#B8B8B1] rounded text-[#20252B] hover:bg-[#DAD9D3] disabled:opacity-40 cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            aria-label="Export project JSON"
            title="Export Project JSON"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#F1F0EB] border border-[#B8B8B1] rounded text-[#20252B] hover:bg-[#DAD9D3] whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setShowResetConfirmModal(true)}
            aria-label="Reset trainer circuit"
            title="Reset Trainer Circuit"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#F1F0EB] border border-[#B8B8B1] rounded text-[#20252B] hover:bg-[#DAD9D3] whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={() => setAdvisorOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#456A83] text-[#F1F0EB] rounded hover:bg-[#527B96] whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Advisor
          </button>
        </div>
      </div>

      {/* Contextual Status Banners (No wire selection popup so canvas never shifts during marquee drag) */}
      {(wiringFrom || pendingInsertIC || placementError) && (
        <div className="bg-[#303840] text-[#F1F0EB] px-4 py-1.5 text-xs flex items-center justify-between gap-4 border-b border-[#20252B] shrink-0">
          <div className="flex items-center gap-3 font-mono">
            {wiringFrom && (
              <span>
                Routing patch cord from{' '}
                <strong>{formatTerminalDisplay(wiringFrom, circuit.placedICs)}</strong> — click
                destination terminal or press Esc to cancel.
              </span>
            )}
            {pendingInsertIC && !wiringFrom && (
              <span>
                Placing <strong>{pendingInsertIC}</strong> — click a compatible ZIF socket on the
                trainer board.
              </span>
            )}
            {placementError && <span className="text-[#E8A45C]">{placementError}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                cancelWiring();
                setPendingInsertIC(null);
                clearPlacementError();
              }}
              className="p-0.5 text-[#A5ACB2] hover:text-white cursor-pointer"
              aria-label="Dismiss active tool message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Split: Trainer Canvas + Horizontally Minimizable Right Engineering Inspector */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row">
        {/* DT-1004 Hardware Board Stage (dynamically expands to fill freed horizontal space) */}
        <div
          data-testid="trainer-board-stage"
          className="flex-1 min-w-0 min-h-0 overflow-auto p-2 lg:p-3 flex items-start justify-center bg-[#DFDDD6] transition-all duration-200 ease-out"
        >
          <div
            data-testid="trainer-board-container"
            className={`w-full transition-all duration-200 ease-out ${
              inspectorCollapsed ? 'max-w-[1760px]' : 'max-w-[1440px]'
            }`}
          >
            <TrainerBoardSVG />
          </div>
        </div>

        {/* Right Engineering Inspector — Horizontally Minimizable & Retractable */}
        <aside
          data-testid="inspector-panel"
          data-collapsed={inspectorCollapsed ? 'true' : 'false'}
          aria-label={inspectorCollapsed ? 'Minimized Engineering Inspector' : 'Engineering Inspector'}
          className={`shrink-0 border-t lg:border-t-0 lg:border-l border-[#C9C9C3] flex flex-col overflow-hidden transition-all duration-200 ease-out ${
            inspectorCollapsed
              ? 'w-full h-11 lg:w-11 lg:h-full bg-[#DAD9D3]'
              : 'w-full h-72 lg:w-80 lg:h-full bg-[#E5E5E1]'
          }`}
        >
          {inspectorCollapsed ? (
            <div className="w-full h-full flex lg:flex-col items-center justify-between lg:justify-start py-1.5 lg:py-2.5 px-3 lg:px-1.5 gap-3">
              <button
                type="button"
                data-testid="expand-inspector-btn"
                onClick={() => setInspectorCollapsed(false)}
                title="Expand Utility Panel"
                aria-label="Expand Inspector Panel"
                className="p-1.5 rounded bg-[#303840] text-[#F1F0EB] hover:bg-[#456A83] transition-colors cursor-pointer shrink-0"
              >
                <PanelRightOpen className="w-4 h-4" />
              </button>

              <div className="flex lg:flex-col items-center gap-1.5 text-[10px] font-mono text-[#303840]">
                <button
                  type="button"
                  onClick={() => {
                    setInspectorTab('diagnostics');
                    setInspectorCollapsed(false);
                  }}
                  title={`Checks (${errorCount + warnCount})`}
                  className="px-1.5 py-1 rounded bg-[#F1F0EB] border border-[#B8B8B1] hover:border-[#456A83] font-semibold cursor-pointer"
                >
                  C:{errorCount + warnCount}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInspectorTab('ic');
                    setInspectorCollapsed(false);
                  }}
                  title={`ICs (${circuit.placedICs.length})`}
                  className="px-1.5 py-1 rounded bg-[#F1F0EB] border border-[#B8B8B1] hover:border-[#456A83] font-semibold cursor-pointer"
                >
                  IC:{circuit.placedICs.length}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInspectorTab('wires');
                    setInspectorCollapsed(false);
                  }}
                  title={`Wires (${circuit.wires.length})`}
                  className="px-1.5 py-1 rounded bg-[#F1F0EB] border border-[#B8B8B1] hover:border-[#456A83] font-semibold cursor-pointer"
                >
                  W:{circuit.wires.length}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInspectorTab('clock');
                    setInspectorCollapsed(false);
                  }}
                  title="Timing Parameters"
                  className="px-1.5 py-1 rounded bg-[#F1F0EB] border border-[#B8B8B1] hover:border-[#456A83] font-semibold cursor-pointer"
                >
                  CLK
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full lg:w-80 h-full flex flex-col">
            {/* Inspector Tabs + Horizontal Collapse Button */}
            <div className="flex items-center border-b border-[#C9C9C3] bg-[#DAD9D3] text-xs font-medium shrink-0">
              <div className="grid grid-cols-4 flex-1">
                <button
                  type="button"
                  onClick={() => setInspectorTab('diagnostics')}
                  className={`py-2 px-1 text-center border-b-2 transition-colors cursor-pointer ${
                    inspectorTab === 'diagnostics'
                      ? 'border-[#456A83] bg-[#E5E5E1] text-[#20252B]'
                      : 'border-transparent text-[#555C62] hover:text-[#20252B]'
                  }`}
                >
                  Checks ({errorCount + warnCount})
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('ic')}
                  className={`py-2 px-1 text-center border-b-2 transition-colors cursor-pointer ${
                    inspectorTab === 'ic'
                      ? 'border-[#456A83] bg-[#E5E5E1] text-[#20252B]'
                      : 'border-transparent text-[#555C62] hover:text-[#20252B]'
                  }`}
                >
                  ICs ({circuit.placedICs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('wires')}
                  className={`py-2 px-1 text-center border-b-2 transition-colors cursor-pointer ${
                    inspectorTab === 'wires'
                      ? 'border-[#456A83] bg-[#E5E5E1] text-[#20252B]'
                      : 'border-transparent text-[#555C62] hover:text-[#20252B]'
                  }`}
                >
                  Wires ({circuit.wires.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('clock')}
                  className={`py-2 px-1 text-center border-b-2 transition-colors cursor-pointer ${
                    inspectorTab === 'clock'
                      ? 'border-[#456A83] bg-[#E5E5E1] text-[#20252B]'
                      : 'border-transparent text-[#555C62] hover:text-[#20252B]'
                  }`}
                >
                  Timing
                </button>
              </div>

              <button
                type="button"
                data-testid="collapse-inspector-btn"
                onClick={() => setInspectorCollapsed(true)}
                title="Minimize Inspector Horizontally"
                aria-label="Minimize Inspector Horizontally"
                className="px-2 py-2 text-[#303840] hover:bg-[#C9C9C3] hover:text-[#20252B] border-l border-[#C9C9C3] transition-colors cursor-pointer"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {/* TAB 1: DIAGNOSTICS */}
              {inspectorTab === 'diagnostics' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono text-[#555C62]">
                    <span>Sim Time: {simulation.simTimeNs} ns</span>
                    <span>Nets: {simulation.netCount}</span>
                  </div>

                  {simulation.diagnostics.length === 0 ? (
                    <div className="bg-[#F1F0EB] border border-[#587965]/40 rounded p-3 flex items-start gap-2.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-[#587965] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-[#20252B]">Electrical Checks Nominal</div>
                        <div className="text-[#555C62] mt-0.5">
                          All placed ICs have valid +5V/GND rails and no bus conflicts detected.
                        </div>
                      </div>
                    </div>
                  ) : (
                    simulation.diagnostics.map((d) => (
                      <div
                        key={d.id}
                        className={`bg-[#F1F0EB] border rounded p-2.5 flex items-start gap-2 text-xs ${
                          d.severity === 'error'
                            ? 'border-[#B83A32]'
                            : d.severity === 'warning'
                            ? 'border-[#BD8B43]'
                            : 'border-[#C9C9C3]'
                        }`}
                      >
                        {d.severity === 'error' || d.severity === 'warning' ? (
                          <AlertTriangle
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              d.severity === 'error' ? 'text-[#B83A32]' : 'text-[#BD8B43]'
                            }`}
                          />
                        ) : (
                          <Info className="w-4 h-4 text-[#456A83] shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-[#20252B]">{d.title}</div>
                          <div className="text-[#555C62] mt-0.5 leading-snug">{d.detail}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: PLACED ICs & PIN STATES + 6116 MEMORY INSPECTOR */}
              {inspectorTab === 'ic' && (
                <div className="space-y-3">
                  {circuit.placedICs.length === 0 ? (
                    <div className="bg-[#F1F0EB] border border-[#C9C9C3] rounded p-4 text-center text-xs text-[#747C82]">
                      No ICs installed. Select an IC in the toolbar above and insert it into ZIF-1..4
                      (14/16-pin) or ZIF-5 (24-pin RAM).
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        {circuit.placedICs.map((ic) => {
                          const rt = simulation.icStates[ic.instanceId];
                          const loc =
                            ic.placement.kind === 'zif'
                              ? ic.placement.socketId
                              : `Col ${ic.placement.startCol}`;
                          const active = inspectedIC?.instanceId === ic.instanceId;
                          return (
                            <div
                              key={ic.instanceId}
                              className={`p-2.5 rounded border flex items-center justify-between gap-2 text-xs ${
                                active
                                  ? 'bg-[#303840] text-[#F1F0EB] border-[#20252B]'
                                  : 'bg-[#F1F0EB] text-[#20252B] border-[#C9C9C3]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  useLabStore.getState().setSelectedICInstanceId(ic.instanceId)
                                }
                                className="text-left flex-1 min-w-0 cursor-pointer"
                              >
                                <div className="font-mono font-semibold flex items-center gap-1.5">
                                  <Cpu className="w-3.5 h-3.5 shrink-0" />
                                  {ic.partNumber} ({loc})
                                </div>
                                <div
                                  className={`text-[11px] font-mono ${
                                    active ? 'text-[#A5ACB2]' : 'text-[#747C82]'
                                  }`}
                                >
                                  {rt?.powered ? 'Powered (+5V/GND OK)' : 'Unpowered'}
                                </div>
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove ${ic.partNumber}`}
                                onClick={() => removeIC(ic.instanceId)}
                                className="p-1 text-[#B83A32] hover:bg-[#B83A32]/10 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {inspectedIC && inspectedICDef && (
                        <>
                          <div className="bg-[#F1F0EB] border border-[#C9C9C3] rounded overflow-hidden">
                            <div className="px-3 py-2 bg-[#DAD9D3] border-b border-[#C9C9C3] text-xs font-mono font-semibold">
                              {inspectedICDef.partNumber} Internal Logic Structure
                            </div>
                            <div className="p-2">
                              <ICInternalDiagram
                                ic={inspectedICDef}
                                pinStates={inspectedICRt?.pinStates}
                                compact
                              />
                            </div>
                          </div>

                          <div className="bg-[#F1F0EB] border border-[#C9C9C3] rounded overflow-hidden">
                            <div className="px-3 py-2 bg-[#DAD9D3] border-b border-[#C9C9C3] text-xs font-mono font-semibold">
                              {inspectedICDef.partNumber} Live Pin States
                            </div>
                            <div className="max-h-52 overflow-y-auto divide-y divide-[#E5E5E1]">
                              {inspectedICDef.pins.map((pin) => {
                                const lvl = inspectedICRt?.pinStates[pin.pin] ?? 'Z';
                                return (
                                  <div
                                    key={pin.pin}
                                    className="px-3 py-1 flex items-center justify-between text-[11px] font-mono"
                                  >
                                    <span>
                                      {pin.pin}. {pin.name}{' '}
                                      <span className="text-[10px] text-[#747C82]">
                                        ({formatDirectionTag(pin.direction)})
                                      </span>
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-semibold ${
                                        lvl === 1
                                          ? 'bg-[#587965]/20 text-[#3B5746]'
                                          : lvl === 0
                                          ? 'bg-[#20252B]/10 text-[#20252B]'
                                          : lvl === 'X'
                                          ? 'bg-[#BD8B43]/20 text-[#8A6124]'
                                          : 'text-[#747C82]'
                                      }`}
                                    >
                                      {String(lvl)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}

                      {/* 6116 Memory Inspector */}
                      {inspectedIC?.partNumber === '6116' && inspectedICRt?.internalMemory && (
                        <div className="bg-[#F1F0EB] border border-[#C9C9C3] rounded overflow-hidden">
                          <div className="px-3 py-2 bg-[#DAD9D3] border-b border-[#C9C9C3] text-xs font-mono font-semibold">
                            6116 SRAM Contents (0x00–0x1F)
                          </div>
                          <div className="p-2 font-mono text-[11px] grid grid-cols-4 gap-1">
                            {Array.from({ length: 32 }).map((_, addr) => {
                              const val = inspectedICRt.internalMemory![addr] ?? 0;
                              return (
                                <div
                                  key={addr}
                                  className={`px-1.5 py-0.5 rounded border ${
                                    val !== 0
                                      ? 'bg-[#456A83]/15 border-[#456A83] font-semibold'
                                      : 'bg-white border-[#E5E5E1] text-[#747C82]'
                                  }`}
                                >
                                  {addr.toString(16).padStart(2, '0').toUpperCase()}:
                                  {val.toString(16).padStart(2, '0').toUpperCase()}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: WIRES LIST WITH MULTI-SELECT & CONNECTION CLASSIFICATION */}
              {inspectorTab === 'wires' && (
                <div className="space-y-2.5">
                  {circuit.wires.length === 0 ? (
                    <div className="bg-[#F1F0EB] border border-[#C9C9C3] rounded p-4 text-center text-xs text-[#747C82]">
                      Click any circular terminal socket on the trainer, then click a second
                      terminal to route a patch cord. You can also drag a selection box on the
                      board to select and delete multiple wires at once.
                    </div>
                  ) : (
                    <>
                      {/* Batch Selection & Multi-Delete Toolbar */}
                      <div className="bg-[#F1F0EB] border border-[#C9C9C3] rounded p-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedWireIds(circuit.wires.map((w) => w.id))}
                            className="px-2 py-0.5 rounded bg-[#E5E5E1] border border-[#B8B8B1] text-[#20252B] hover:border-[#456A83] cursor-pointer"
                          >
                            Select All ({circuit.wires.length})
                          </button>
                          {selectedWireIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedWireIds([])}
                              className="px-2 py-0.5 rounded bg-[#E5E5E1] border border-[#B8B8B1] text-[#555C62] hover:text-[#20252B] cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          data-testid="inspector-delete-selected-wires"
                          disabled={selectedWireIds.length === 0}
                          onClick={() => removeWires(selectedWireIds)}
                          className="px-2 py-0.5 rounded bg-[#B83A32] text-white font-semibold hover:bg-[#9E2F28] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Delete Selected ({selectedWireIds.length})
                        </button>
                      </div>

                      <div className="text-[10px] font-mono text-[#555C62] leading-snug">
                        Tip: Drag a box across patch cords on the trainer panel (or Shift+Click) to
                        select multiple wires and press Delete.
                      </div>

                      {circuit.wires.map((w) => {
                        const fromLabel = formatTerminalDisplay(w.from, circuit.placedICs);
                        const toLabel = formatTerminalDisplay(w.to, circuit.placedICs);
                        const isChecked =
                          selectedWireIds.includes(w.id) || selectedWireId === w.id;

                        return (
                          <div
                            key={w.id}
                            className={`rounded border px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs font-mono transition-colors ${
                              isChecked
                                ? 'bg-[#456A83]/15 border-[#456A83]'
                                : 'bg-[#F1F0EB] border-[#C9C9C3]'
                            }`}
                          >
                            <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectedWireId(w.id)}
                                aria-label={`Select wire ${fromLabel} to ${toLabel}`}
                                className="accent-[#456A83] cursor-pointer"
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: WIRE_COLOR_HEX[w.color].stroke }}
                              />
                              <span
                                className="text-[11px] text-[#20252B] font-semibold truncate"
                                title={`${fromLabel} → ${toLabel}`}
                              >
                                {fromLabel} → {toLabel}
                              </span>
                            </label>
                            <button
                              type="button"
                              aria-label={`Disconnect ${w.from} to ${w.to}`}
                              onClick={() => removeWire(w.id)}
                              className="p-1 text-[#747C82] hover:text-[#B83A32] shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {/* TAB 4: CLOCK & PULSE PARAMETERS */}
              {inspectorTab === 'clock' && (
                <div className="space-y-4">
                  <div className="bg-[#F1F0EB] border border-[#C9C9C3] rounded p-3 space-y-3">
                    <div className="text-xs font-semibold text-[#20252B]">
                      Automatic Clock Parameters
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <label htmlFor="clk-freq">Frequency</label>
                        <span>{circuit.clock.frequencyHz.toFixed(1)} Hz</span>
                      </div>
                      <input
                        id="clk-freq"
                        type="range"
                        min={0.5}
                        max={15}
                        step={0.5}
                        value={circuit.clock.frequencyHz}
                        onChange={(e) => setClockFrequency(Number(e.target.value))}
                        className="w-full accent-[#456A83]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <label htmlFor="clk-duty">Duty Cycle</label>
                        <span>{circuit.clock.dutyCyclePercent}%</span>
                      </div>
                      <input
                        id="clk-duty"
                        type="range"
                        min={10}
                        max={90}
                        step={5}
                        value={circuit.clock.dutyCyclePercent}
                        onChange={(e) => setClockDutyCycle(Number(e.target.value))}
                        className="w-full accent-[#456A83]"
                      />
                    </div>
                  </div>

                  <div className="bg-[#F1F0EB] border border-[#C9C9C3] rounded p-3 space-y-3">
                    <div className="text-xs font-semibold text-[#20252B]">
                      Auxiliary Pulse Generator
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <label htmlFor="pulse-freq">Frequency</label>
                        <span>{circuit.pulse.frequencyHz.toFixed(1)} Hz</span>
                      </div>
                      <input
                        id="pulse-freq"
                        type="range"
                        min={0.5}
                        max={20}
                        step={0.5}
                        value={circuit.pulse.frequencyHz}
                        onChange={(e) => setPulseFrequency(Number(e.target.value))}
                        className="w-full accent-[#456A83]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <label htmlFor="pulse-duty">Duty Cycle</label>
                        <span>{circuit.pulse.dutyCyclePercent}%</span>
                      </div>
                      <input
                        id="pulse-duty"
                        type="range"
                        min={10}
                        max={90}
                        step={5}
                        value={circuit.pulse.dutyCyclePercent}
                        onChange={(e) => setPulseDutyCycle(Number(e.target.value))}
                        className="w-full accent-[#456A83]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </aside>
      </div>

      {/* Reset Caution Confirmation Modal Popup */}
      {showResetConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-caution-title"
          data-testid="reset-confirm-modal"
          className="fixed inset-0 z-50 bg-[#181C20]/65 flex items-center justify-center p-4"
          onClick={() => setShowResetConfirmModal(false)}
        >
          <div
            className="bg-[#F1F0EB] border-2 border-[#303840] rounded-md shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#303840] text-[#F1F0EB] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#E8A45C]" />
                <h2 id="reset-caution-title" className="text-sm font-semibold font-mono">
                  CAUTION — RESET TRAINER KIT
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close reset confirmation popup"
                onClick={() => setShowResetConfirmModal(false)}
                className="text-[#A5ACB2] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-[#303840]">
              <p className="leading-relaxed">
                Are you sure you want to reset the <strong>DT-1004 Digital Trainer Kit</strong>? This
                action will clear all inserted ICs from sockets <strong>ZIF-1..ZIF-5</strong>,
                disconnect all patch cords, and return all input switches and clock generators to
                their default laboratory state.
              </p>
              <div className="bg-[#E5E5E1] border border-[#C9C9C3] rounded px-3 py-2 font-mono text-[11px] flex items-center justify-between">
                <span>Placed ICs: {circuit.placedICs.length}</span>
                <span>Patch Cords: {circuit.wires.length}</span>
              </div>
              <p className="text-[11px] text-[#555C62]">
                Tip: Even after confirming a reset, you can press <strong>Ctrl+Z (Undo)</strong> if
                you need to restore your previous wiring.
              </p>
            </div>

            <div className="bg-[#E5E5E1] border-t border-[#C9C9C3] px-4 py-2.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-3 py-1.5 text-xs font-medium bg-[#F1F0EB] border border-[#B8B8B1] rounded text-[#20252B] hover:bg-[#DAD9D3] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-reset-btn"
                onClick={() => {
                  resetCircuit();
                  setShowResetConfirmModal(false);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#B83A32] text-white rounded hover:bg-[#9E2F28] cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
