import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  canInsertIntoZif,
  CATEGORY_LABELS,
  filterICDefinitions,
  getICDefinition,
} from '../ic-library';
import { useLabStore } from '../store/useLabStore';
import { ICCategory, ICDefinition } from '../types/circuit';
import { ICInternalDiagram } from './ICInternalDiagram';

/**
 * Draws a small IEEE/ANSI logic gate symbol centered at (cx, cy) inside the DIP package body.
 * dir = 'left' means inputs enter from the right and output exits toward the left;
 * dir = 'right' means inputs enter from the left and output exits toward the right;
 * dir = 'down' means inputs enter from top/sides and output exits at the bottom.
 */
function renderMiniGateInPackage(
  gateType: 'NAND' | 'NOR' | 'NOT' | 'AND' | 'OR' | 'XOR' | 'XNOR',
  cx: number,
  cy: number,
  pointing: 'left' | 'right'
): React.ReactNode {
  const s = pointing === 'right' ? 1 : -1;
  const stroke = '#20252B';
  const fill = '#FFFFFF';
  const sw = 1.65;
  const hasBubble =
    gateType === 'NAND' || gateType === 'NOR' || gateType === 'NOT' || gateType === 'XNOR';
  const isOrFamily =
    gateType === 'OR' || gateType === 'NOR' || gateType === 'XOR' || gateType === 'XNOR';
  const isXorFamily = gateType === 'XOR' || gateType === 'XNOR';

  if (gateType === 'NOT') {
    const xBack = cx - s * 11;
    const xTip = cx + s * 9;
    const xBub = cx + s * 12.5;
    return (
      <g>
        <path
          d={`M ${xBack} ${cy - 9} L ${xTip} ${cy} L ${xBack} ${cy + 9} Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
        <circle cx={xBub} cy={cy} r={3.2} fill={fill} stroke={stroke} strokeWidth={sw} />
      </g>
    );
  }

  if (!isOrFamily) {
    // AND / NAND
    const xBack = cx - s * 13;
    const xMid = cx - s * 1;
    const xTip = cx + s * 11;
    const sweep = pointing === 'right' ? 1 : 0;
    return (
      <g>
        <path
          d={`M ${xBack} ${cy - 11} L ${xMid} ${cy - 11} A 11 11 0 0 ${sweep} ${xMid} ${cy + 11} L ${xBack} ${cy + 11} Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
        {hasBubble && (
          <circle
            cx={xTip + s * 3.4}
            cy={cy}
            r={3.2}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        )}
      </g>
    );
  }

  // OR / NOR / XOR / XNOR
  const xBack = cx - s * 13;
  const xTip = cx + s * 12;
  return (
    <g>
      {isXorFamily && (
        <path
          d={`M ${xBack - s * 4.5} ${cy - 11} Q ${xBack + s * 2} ${cy} ${xBack - s * 4.5} ${cy + 11}`}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      )}
      <path
        d={`M ${xBack} ${cy - 11} L ${cx - s * 3} ${cy - 11} Q ${cx + s * 7} ${cy - 10} ${xTip} ${cy} Q ${cx + s * 7} ${cy + 10} ${cx - s * 3} ${cy + 11} L ${xBack} ${cy + 11} Q ${xBack + s * 5.5} ${cy} ${xBack} ${cy - 11} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {hasBubble && (
        <circle
          cx={xTip + s * 3.4}
          cy={cy}
          r={3.2}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      )}
    </g>
  );
}

/**
 * Reusable IEEE Flip-Flop symbol (D, JK, SR, T) with dynamic clock indicator (>CK),
 * optional negative-edge clock bubble, active-low preset (~PRE) / clear (~CLR) bubbles,
 * non-overlapping center labels, and Q / ~Q output terminals for inside-package schematics.
 */
function renderFlipFlopSymbol(
  x: number,
  y: number,
  w: number,
  h: number,
  typeLabel: string,
  opts?: {
    negEdgeClk?: boolean;
    hasPre?: boolean;
    hasClr?: boolean;
    swapPreClr?: boolean;
    mirrored?: boolean;
    subLabel?: string;
    inLabels?: Array<{ text: string; yOff: number }>;
  }
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const mirrored = Boolean(opts?.mirrored);
  const topIsClr = Boolean(opts?.swapPreClr);
  const topLabel = topIsClr ? '~CLR' : '~PRE';
  const botLabel = topIsClr ? '~PRE' : '~CLR';
  const showTop = topIsClr ? opts?.hasClr : opts?.hasPre;
  const showBot = topIsClr ? opts?.hasPre : opts?.hasClr;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        fill="#FFFFFF"
        stroke="#20252B"
        strokeWidth={1.6}
      />
      {/* Top & Bottom Async Control Bubbles (~PRE / ~CLR) */}
      {showTop && (
        <g>
          <circle cx={cx - 14} cy={y - 3} r={2.8} fill="#FFFFFF" stroke="#20252B" strokeWidth={1.3} />
          <text
            x={cx - 14}
            y={y + 10.5}
            textAnchor="middle"
            fill="#7A4848"
            fontSize={6.5}
            fontWeight={700}
            fontFamily="IBM Plex Mono, monospace"
          >
            {topLabel}
          </text>
        </g>
      )}
      {showBot && (
        <g>
          <circle cx={cx + 14} cy={y + h + 3} r={2.8} fill="#FFFFFF" stroke="#20252B" strokeWidth={1.3} />
          <text
            x={cx + 14}
            y={y + h - 4}
            textAnchor="middle"
            fill="#7A4848"
            fontSize={6.5}
            fontWeight={700}
            fontFamily="IBM Plex Mono, monospace"
          >
            {botLabel}
          </text>
        </g>
      )}
      {/* Clock Triangle on Input Edge */}
      {!mirrored ? (
        <>
          {opts?.negEdgeClk && (
            <circle cx={x - 3} cy={cy} r={2.8} fill="#FFFFFF" stroke="#20252B" strokeWidth={1.3} />
          )}
          <polygon
            points={`${x},${cy - 4.5} ${x + 6.5},${cy} ${x},${cy + 4.5}`}
            fill="none"
            stroke="#20252B"
            strokeWidth={1.3}
          />
        </>
      ) : (
        <>
          {opts?.negEdgeClk && (
            <circle cx={x + w + 3} cy={cy} r={2.8} fill="#FFFFFF" stroke="#20252B" strokeWidth={1.3} />
          )}
          <polygon
            points={`${x + w},${cy - 4.5} ${x + w - 6.5},${cy} ${x + w},${cy + 4.5}`}
            fill="none"
            stroke="#20252B"
            strokeWidth={1.3}
          />
        </>
      )}
      {/* Optional Input Terminal Labels */}
      {opts?.inLabels?.map((lbl) => (
        <text
          key={lbl.text}
          x={mirrored ? x + w - 6 : x + 6}
          y={y + lbl.yOff + 3}
          textAnchor={mirrored ? 'end' : 'start'}
          fill="#2C5E8A"
          fontSize={7.2}
          fontWeight={700}
          fontFamily="IBM Plex Mono, monospace"
        >
          {lbl.text}
        </text>
      ))}
      {/* Center Flip-Flop Identifier */}
      <text
        x={cx}
        y={opts?.subLabel ? cy - 2 : cy + 3}
        textAnchor="middle"
        fill="#20252B"
        fontSize={8.2}
        fontWeight={700}
        fontFamily="IBM Plex Mono, monospace"
      >
        {typeLabel}
      </text>
      {opts?.subLabel && (
        <text
          x={cx}
          y={cy + 9}
          textAnchor="middle"
          fill="#456A83"
          fontSize={6.5}
          fontWeight={700}
          fontFamily="IBM Plex Mono, monospace"
        >
          {opts.subLabel}
        </text>
      )}
      {/* Q and ~Q Output Indicators */}
      <text
        x={mirrored ? x + 5 : x + w - 5}
        y={y + 15}
        textAnchor={mirrored ? 'start' : 'end'}
        fill="#3B5746"
        fontSize={7.4}
        fontWeight={700}
        fontFamily="IBM Plex Mono, monospace"
      >
        Q
      </text>
      <circle
        cx={mirrored ? x - 2.8 : x + w + 2.8}
        cy={y + h - 12}
        r={2.6}
        fill="#FFFFFF"
        stroke="#20252B"
        strokeWidth={1.3}
      />
      <text
        x={mirrored ? x + 5 : x + w - 5}
        y={y + h - 9}
        textAnchor={mirrored ? 'start' : 'end'}
        fill="#3B5746"
        fontSize={7.2}
        fontWeight={700}
        fontFamily="IBM Plex Mono, monospace"
      >
        Q̄
      </text>
    </g>
  );
}

interface ArchStageBox {
  heading: string;
  subline: string;
  footer?: string;
  y: number;
  h: number;
}

interface ArchPinLink {
  pin: number;
  stageIdx: number;
  role: 'in' | 'out' | 'ctl' | 'bidir';
}

/**
 * Renders clean, datasheet-grade architectural functional stage blocks (matching ICInternalDiagram's
 * visual polish) connected by nested, collision-free orthogonal Manhattan traces inside the DIP cavity.
 */
function renderArchStagePackage(
  stages: ArchStageBox[],
  links: ArchPinLink[],
  half: number,
  bodyX: number,
  bodyRight: number,
  cx: number,
  pinY: (p: number) => number,
  interStageArrows = true
): React.ReactNode {
  const gutter = 64;
  const stageX = bodyX + gutter;
  const stageW = bodyRight - bodyX - gutter * 2;
  const stageRight = stageX + stageW;

  const strokeForRole = (role: ArchPinLink['role']) =>
    role === 'out' || role === 'bidir' ? '#3B5746' : role === 'ctl' ? '#456A83' : '#2C5E8A';

  const leftLinks = links.filter((l) => l.pin <= half);
  const rightLinks = links.filter((l) => l.pin > half);

  const routeSideLinks = (sideLinks: ArchPinLink[], side: 'left' | 'right') => {
    const pinEdgeX = side === 'left' ? bodyX : bodyRight;
    const blockEdgeX = side === 'left' ? stageX : stageRight;

    // Classify every link as direct horizontal (within stage body below the 21px header),
    // routing downward into top ports, or routing upward into bottom ports.
    const aboveByStage = new Map<number, ArchPinLink[]>();
    const belowByStage = new Map<number, ArchPinLink[]>();
    const directLinks: Array<{ lnk: ArchPinLink; py: number }> = [];

    for (const lnk of sideLinks) {
      const st = stages[lnk.stageIdx] ?? stages[0];
      const py = pinY(lnk.pin);
      const minPortY = st.y + 28;
      const maxPortY = st.y + st.h - 10;
      if (py >= minPortY && py <= maxPortY) {
        directLinks.push({ lnk, py });
      } else if (py < minPortY) {
        const list = aboveByStage.get(lnk.stageIdx) ?? [];
        list.push(lnk);
        aboveByStage.set(lnk.stageIdx, list);
      } else {
        const list = belowByStage.get(lnk.stageIdx) ?? [];
        list.push(lnk);
        belowByStage.set(lnk.stageIdx, list);
      }
    }

    const totalJogs =
      Array.from(aboveByStage.values()).reduce((acc, a) => acc + a.length, 0) +
      Array.from(belowByStage.values()).reduce((acc, a) => acc + a.length, 0);

    const usableGutter = gutter - 20; // keep lanes strictly outside stage border
    const laneStep = totalJogs > 1 ? Math.min(7.5, usableGutter / (totalJogs - 1)) : 0;

    type RoutedTrace = { lnk: ArchPinLink; py: number; portY: number; d: string };
    const traces: RoutedTrace[] = [];
    let globalJogIdx = 0;

    // 1. Direct horizontal traces
    for (const { lnk, py } of directLinks) {
      traces.push({
        lnk,
        py,
        portY: py,
        d: `M ${pinEdgeX} ${py} L ${blockEdgeX} ${py}`,
      });
    }

    // 2. Above-stage traces: sort top-to-bottom so highest pin gets outermost lane & topmost port (zero crossing)
    const stageIndices = Array.from(new Set([...aboveByStage.keys(), ...belowByStage.keys()])).sort(
      (a, b) => a - b
    );
    for (const sIdx of stageIndices) {
      const st = stages[sIdx] ?? stages[0];
      const minPortY = st.y + 28;
      const maxPortY = st.y + st.h - 10;

      const above = (aboveByStage.get(sIdx) ?? []).sort((a, b) => pinY(a.pin) - pinY(b.pin));
      const aboveSpacing = above.length > 1 ? Math.min(9, (maxPortY - minPortY) * 0.45 / above.length) : 0;
      above.forEach((lnk, idx) => {
        const py = pinY(lnk.pin);
        const portY = minPortY + idx * aboveSpacing;
        const laneOffset = 12 + globalJogIdx * laneStep;
        globalJogIdx += 1;
        const laneX = side === 'left' ? bodyX + laneOffset : bodyRight - laneOffset;
        traces.push({
          lnk,
          py,
          portY,
          d: `M ${pinEdgeX} ${py} L ${laneX} ${py} L ${laneX} ${portY} L ${blockEdgeX} ${portY}`,
        });
      });

      const below = (belowByStage.get(sIdx) ?? []).sort((a, b) => pinY(b.pin) - pinY(a.pin));
      const belowSpacing = below.length > 1 ? Math.min(9, (maxPortY - minPortY) * 0.45 / below.length) : 0;
      below.forEach((lnk, idx) => {
        const py = pinY(lnk.pin);
        const portY = maxPortY - idx * belowSpacing;
        const laneOffset = 12 + globalJogIdx * laneStep;
        globalJogIdx += 1;
        const laneX = side === 'left' ? bodyX + laneOffset : bodyRight - laneOffset;
        traces.push({
          lnk,
          py,
          portY,
          d: `M ${pinEdgeX} ${py} L ${laneX} ${py} L ${laneX} ${portY} L ${blockEdgeX} ${portY}`,
        });
      });
    }

    return traces.map(({ lnk, py, portY, d }) => {
      const wireColor = strokeForRole(lnk.role);
      return (
        <g key={`${side}-${lnk.pin}`}>
          <path d={d} fill="none" stroke={wireColor} strokeWidth={1.45} />
          <circle cx={blockEdgeX} cy={portY} r={2.3} fill={wireColor} />
          {lnk.role === 'bidir' && (
            <polygon
              points={
                side === 'left'
                  ? `${bodyX + 12},${py - 3.6} ${bodyX + 12},${py + 3.6} ${bodyX + 5},${py}`
                  : `${bodyRight - 12},${py - 3.6} ${bodyRight - 12},${py + 3.6} ${bodyRight - 5},${py}`
              }
              fill="#FFFFFF"
              stroke={wireColor}
              strokeWidth={1.1}
            />
          )}
        </g>
      );
    });
  };

  return (
    <g>
      {/* Clean Nested Orthogonal Pin Traces */}
      {routeSideLinks(leftLinks, 'left')}
      {routeSideLinks(rightLinks, 'right')}

      {/* Inter-Stage Flow Arrows */}
      {interStageArrows &&
        stages.slice(0, -1).map((st, idx) => {
          const next = stages[idx + 1];
          const y1 = st.y + st.h;
          const y2 = next.y;
          if (y2 - y1 < 8) return null;
          return (
            <g key={`flow-${idx}`}>
              <line x1={cx} y1={y1} x2={cx} y2={y2 - 3} stroke="#456A83" strokeWidth={1.6} />
              <polygon points={`${cx - 3.5},${y2 - 5} ${cx + 3.5},${y2 - 5} ${cx},${y2}`} fill="#456A83" />
            </g>
          );
        })}

      {/* Structured Functional Stage Cards */}
      {stages.map((st, idx) => (
        <g key={`stage-${idx}`}>
          <rect
            x={stageX}
            y={st.y}
            width={stageW}
            height={st.h}
            rx={4}
            fill="#FFFFFF"
            stroke="#303840"
            strokeWidth={1.4}
          />
          <rect
            x={stageX}
            y={st.y}
            width={stageW}
            height={21}
            rx={3.5}
            fill="#E8ECEF"
          />
          <line
            x1={stageX}
            y1={st.y + 21}
            x2={stageRight}
            y2={st.y + 21}
            stroke="#C9C9C3"
            strokeWidth={1}
          />
          <text
            x={cx}
            y={st.y + 13.5}
            textAnchor="middle"
            fill="#20252B"
            fontSize={7.6}
            fontWeight={700}
            fontFamily="IBM Plex Mono, monospace"
          >
            {st.heading}
          </text>
          <text
            x={cx}
            y={st.footer ? st.y + 21 + (st.h - 21) * 0.42 : st.y + 21 + (st.h - 21) * 0.56}
            textAnchor="middle"
            fill="#303840"
            fontSize={6.8}
            fontWeight={600}
            fontFamily="IBM Plex Mono, monospace"
          >
            {st.subline}
          </text>
          {st.footer && (
            <text
              x={cx}
              y={st.y + 21 + (st.h - 21) * 0.74}
              textAnchor="middle"
              fill="#456A83"
              fontSize={6.6}
              fontWeight={700}
              fontFamily="IBM Plex Mono, monospace"
            >
              {st.footer}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

/**
 * Full-height DIP Package Pinout & Internal Pin-Wired Diagram rendered right beside the
 * Pin Configuration Table so both cards have balanced visual weight and show cleanly how
 * every physical pin maps inside the IC.
 */
const DIPPinoutDiagram: React.FC<{ ic: ICDefinition }> = ({ ic }) => {
  const half = ic.pinCount / 2;
  const rowH = 58;
  const topPad = 36;
  const botPad = 34;
  const bodyH = (half - 1) * rowH + 56;
  const svgH = bodyH + topPad + botPad;
  const svgW = 548;
  const bodyX = 104;
  const bodyW = 340;
  const bodyRight = bodyX + bodyW; // 444
  const cx = svgW / 2; // 274

  const pinY = (pinNum: number): number => {
    if (pinNum <= half) {
      return topPad + 28 + (pinNum - 1) * rowH;
    }
    const rightIdx = ic.pinCount - pinNum;
    return topPad + 28 + rightIdx * rowH;
  };

  const pinColor = (dir: string) =>
    dir === 'power-vcc'
      ? '#B83A32'
      : dir === 'power-gnd'
      ? '#20252B'
      : dir === 'output' || dir === 'open-collector' || dir === 'bidirectional'
      ? '#3B5746'
      : '#2C5E8A';

  // Render internal gate-level, flip-flop, or datasheet stage schematics for all 25 ICs
  const renderInternalGateWiring = () => {
    const p = ic.partNumber;
    const wireIn = '#2C5E8A';
    const wireOut = '#3B5746';
    const wireInternal = '#456A83';

    // 1. Standard Quad 2-Input Gates: 7400 (NAND), 7408 (AND), 7432 (OR), 7486 (XOR)
    if (p === '7400' || p === '7408' || p === '7432' || p === '7486') {
      const gType =
        p === '7400' ? 'NAND' : p === '7408' ? 'AND' : p === '7432' ? 'OR' : 'XOR';
      const hasBub = p === '7400';
      const inBackOff = p === '7486' ? 15 : 13;
      const leftPairs = [
        { inA: 1, inB: 2, outY: 3, gx: bodyX + 80, gy: (pinY(1) + pinY(2)) / 2 + 8 },
        { inA: 4, inB: 5, outY: 6, gx: bodyX + 80, gy: (pinY(4) + pinY(5)) / 2 + 8 },
      ];
      const rightPairs = [
        { inA: 13, inB: 12, outY: 11, gx: bodyRight - 80, gy: (pinY(13) + pinY(12)) / 2 + 8 },
        { inA: 10, inB: 9, outY: 8, gx: bodyRight - 80, gy: (pinY(10) + pinY(9)) / 2 + 8 },
      ];

      return (
        <g>
          {leftPairs.map((g, idx) => {
            const yA = pinY(g.inA);
            const yB = pinY(g.inB);
            const yOut = pinY(g.outY);
            const inX = g.gx - inBackOff;
            const outX = g.gx + (hasBub ? 16 : 12);
            return (
              <g key={`lg-${idx}`}>
                <path
                  d={`M ${bodyX} ${yA} L ${bodyX + 32} ${yA} L ${bodyX + 32} ${g.gy - 5} L ${inX} ${g.gy - 5}`}
                  fill="none"
                  stroke={wireIn}
                  strokeWidth={1.6}
                />
                <path
                  d={`M ${bodyX} ${yB} L ${bodyX + 20} ${yB} L ${bodyX + 20} ${g.gy + 5} L ${inX} ${g.gy + 5}`}
                  fill="none"
                  stroke={wireIn}
                  strokeWidth={1.6}
                />
                <path
                  d={`M ${outX} ${g.gy} L ${g.gx + 34} ${g.gy} L ${g.gx + 34} ${yOut} L ${bodyX} ${yOut}`}
                  fill="none"
                  stroke={wireOut}
                  strokeWidth={1.75}
                />
                {renderMiniGateInPackage(gType, g.gx, g.gy, 'right')}
              </g>
            );
          })}

          {rightPairs.map((g, idx) => {
            const yA = pinY(g.inA);
            const yB = pinY(g.inB);
            const yOut = pinY(g.outY);
            const inX = g.gx + inBackOff;
            const outX = g.gx - (hasBub ? 16 : 12);
            return (
              <g key={`rg-${idx}`}>
                <path
                  d={`M ${bodyRight} ${yA} L ${bodyRight - 32} ${yA} L ${bodyRight - 32} ${g.gy - 5} L ${inX} ${g.gy - 5}`}
                  fill="none"
                  stroke={wireIn}
                  strokeWidth={1.6}
                />
                <path
                  d={`M ${bodyRight} ${yB} L ${bodyRight - 20} ${yB} L ${bodyRight - 20} ${g.gy + 5} L ${inX} ${g.gy + 5}`}
                  fill="none"
                  stroke={wireIn}
                  strokeWidth={1.6}
                />
                <path
                  d={`M ${outX} ${g.gy} L ${g.gx - 34} ${g.gy} L ${g.gx - 34} ${yOut} L ${bodyRight} ${yOut}`}
                  fill="none"
                  stroke={wireOut}
                  strokeWidth={1.75}
                />
                {renderMiniGateInPackage(gType, g.gx, g.gy, 'left')}
              </g>
            );
          })}
        </g>
      );
    }

    // 2. 7402 Quad 2-Input NOR (Reversed pinout: 2,3->1; 5,6->4; 12,11->13; 9,8->10)
    if (p === '7402') {
      const leftPairs = [
        { inA: 2, inB: 3, outY: 1, gx: bodyX + 80, gy: (pinY(2) + pinY(3)) / 2 - 8 },
        { inA: 5, inB: 6, outY: 4, gx: bodyX + 80, gy: (pinY(5) + pinY(6)) / 2 - 8 },
      ];
      const rightPairs = [
        { inA: 12, inB: 11, outY: 13, gx: bodyRight - 80, gy: (pinY(12) + pinY(11)) / 2 - 8 },
        { inA: 9, inB: 8, outY: 10, gx: bodyRight - 80, gy: (pinY(9) + pinY(8)) / 2 - 8 },
      ];
      return (
        <g>
          {leftPairs.map((g, idx) => {
            const yA = pinY(g.inA);
            const yB = pinY(g.inB);
            const yOut = pinY(g.outY);
            const inX = g.gx - 12;
            const outX = g.gx + 16;
            return (
              <g key={`nor-l-${idx}`}>
                <path
                  d={`M ${bodyX} ${yA} L ${bodyX + 20} ${yA} L ${bodyX + 20} ${g.gy - 5} L ${inX} ${g.gy - 5}`}
                  fill="none"
                  stroke={wireIn}
                  strokeWidth={1.6}
                />
                <path
                  d={`M ${bodyX} ${yB} L ${bodyX + 32} ${yB} L ${bodyX + 32} ${g.gy + 5} L ${inX} ${g.gy + 5}`}
                  fill="none"
                  stroke={wireIn}
                  strokeWidth={1.6}
                />
                <path
                  d={`M ${outX} ${g.gy} L ${g.gx + 34} ${g.gy} L ${g.gx + 34} ${yOut} L ${bodyX} ${yOut}`}
                  fill="none"
                  stroke={wireOut}
                  strokeWidth={1.75}
                />
                {renderMiniGateInPackage('NOR', g.gx, g.gy, 'right')}
              </g>
            );
          })}
          {rightPairs.map((g, idx) => {
            const yA = pinY(g.inA);
            const yB = pinY(g.inB);
            const yOut = pinY(g.outY);
            const inX = g.gx + 12;
            const outX = g.gx - 16;
            return (
              <g key={`nor-r-${idx}`}>
                <path
                  d={`M ${bodyRight} ${yA} L ${bodyRight - 20} ${yA} L ${bodyRight - 20} ${g.gy - 5} L ${inX} ${g.gy - 5}`}
                  fill="none"
                  stroke={wireIn}
                  strokeWidth={1.6}
                />
                <path
                  d={`M ${bodyRight} ${yB} L ${bodyRight - 32} ${yB} L ${bodyRight - 32} ${g.gy + 5} L ${inX} ${g.gy + 5}`}
                  fill="none"
                  stroke={wireIn}
                  strokeWidth={1.6}
                />
                <path
                  d={`M ${outX} ${g.gy} L ${g.gx - 34} ${g.gy} L ${g.gx - 34} ${yOut} L ${bodyRight} ${yOut}`}
                  fill="none"
                  stroke={wireOut}
                  strokeWidth={1.75}
                />
                {renderMiniGateInPackage('NOR', g.gx, g.gy, 'left')}
              </g>
            );
          })}
        </g>
      );
    }

    // 3. 4077 Quad CMOS XNOR (G1: 1,2->3; G2: 5,6->4; G3: 8,9->10; G4: 12,13->11)
    if (p === '4077') {
      const leftGates = [
        { inA: 1, inB: 2, outY: 3, gx: bodyX + 80, gy: (pinY(1) + pinY(2)) / 2 + 8 },
        { inA: 5, inB: 6, outY: 4, gx: bodyX + 80, gy: (pinY(5) + pinY(6)) / 2 - 8 },
      ];
      const rightGates = [
        { inA: 13, inB: 12, outY: 11, gx: bodyRight - 80, gy: (pinY(13) + pinY(12)) / 2 + 8 },
        { inA: 9, inB: 8, outY: 10, gx: bodyRight - 80, gy: (pinY(9) + pinY(8)) / 2 - 8 },
      ];
      return (
        <g>
          {leftGates.map((g, idx) => (
            <g key={`xnor-l-${idx}`}>
              <path
                d={`M ${bodyX} ${pinY(g.inA)} L ${bodyX + 22} ${pinY(g.inA)} L ${bodyX + 22} ${g.gy - 5} L ${g.gx - 15} ${g.gy - 5}`}
                fill="none"
                stroke={wireIn}
                strokeWidth={1.6}
              />
              <path
                d={`M ${bodyX} ${pinY(g.inB)} L ${bodyX + 34} ${pinY(g.inB)} L ${bodyX + 34} ${g.gy + 5} L ${g.gx - 15} ${g.gy + 5}`}
                fill="none"
                stroke={wireIn}
                strokeWidth={1.6}
              />
              <path
                d={`M ${g.gx + 16} ${g.gy} L ${g.gx + 34} ${g.gy} L ${g.gx + 34} ${pinY(g.outY)} L ${bodyX} ${pinY(g.outY)}`}
                fill="none"
                stroke={wireOut}
                strokeWidth={1.75}
              />
              {renderMiniGateInPackage('XNOR', g.gx, g.gy, 'right')}
            </g>
          ))}
          {rightGates.map((g, idx) => (
            <g key={`xnor-r-${idx}`}>
              <path
                d={`M ${bodyRight} ${pinY(g.inA)} L ${bodyRight - 22} ${pinY(g.inA)} L ${bodyRight - 22} ${g.gy - 5} L ${g.gx + 15} ${g.gy - 5}`}
                fill="none"
                stroke={wireIn}
                strokeWidth={1.6}
              />
              <path
                d={`M ${bodyRight} ${pinY(g.inB)} L ${bodyRight - 34} ${pinY(g.inB)} L ${bodyRight - 34} ${g.gy + 5} L ${g.gx + 15} ${g.gy + 5}`}
                fill="none"
                stroke={wireIn}
                strokeWidth={1.6}
              />
              <path
                d={`M ${g.gx - 16} ${g.gy} L ${g.gx - 34} ${g.gy} L ${g.gx - 34} ${pinY(g.outY)} L ${bodyRight} ${pinY(g.outY)}`}
                fill="none"
                stroke={wireOut}
                strokeWidth={1.75}
              />
              {renderMiniGateInPackage('XNOR', g.gx, g.gy, 'left')}
            </g>
          ))}
        </g>
      );
    }

    // 4. 7404 Hex Inverter (6 NOT gates)
    if (p === '7404') {
      const leftNot = [
        { inP: 1, outP: 2 },
        { inP: 3, outP: 4 },
        { inP: 5, outP: 6 },
      ];
      const rightNot = [
        { inP: 13, outP: 12 },
        { inP: 11, outP: 10 },
        { inP: 9, outP: 8 },
      ];
      return (
        <g>
          {leftNot.map((g, idx) => {
            const yIn = pinY(g.inP);
            const yOut = pinY(g.outP);
            const gy = (yIn + yOut) / 2;
            const gx = bodyX + 78;
            return (
              <g key={`not-l-${idx}`}>
                <path
                  d={`M ${bodyX} ${yIn} L ${gx - 28} ${yIn} L ${gx - 28} ${gy} L ${gx - 11} ${gy}`}
                  fill="none"
                  stroke={wireIn}
                  strokeWidth={1.6}
                />
                <path
                  d={`M ${gx + 16} ${gy} L ${gx + 34} ${gy} L ${gx + 34} ${yOut} L ${bodyX} ${yOut}`}
                  fill="none"
                  stroke={wireOut}
                  strokeWidth={1.75}
                />
                {renderMiniGateInPackage('NOT', gx, gy, 'right')}
              </g>
            );
          })}
          {rightNot.map((g, idx) => {
            const yIn = pinY(g.inP);
            const yOut = pinY(g.outP);
            const gy = (yIn + yOut) / 2;
            const gx = bodyRight - 78;
            return (
              <g key={`not-r-${idx}`}>
                <path
                  d={`M ${bodyRight} ${yIn} L ${gx + 28} ${yIn} L ${gx + 28} ${gy} L ${gx + 11} ${gy}`}
                  fill="none"
                  stroke={wireIn}
                  strokeWidth={1.6}
                />
                <path
                  d={`M ${gx - 16} ${gy} L ${gx - 34} ${gy} L ${gx - 34} ${yOut} L ${bodyRight} ${yOut}`}
                  fill="none"
                  stroke={wireOut}
                  strokeWidth={1.75}
                />
                {renderMiniGateInPackage('NOT', gx, gy, 'left')}
              </g>
            );
          })}
        </g>
      );
    }

    // 5. 7410 (Triple 3-Input NAND) & 7427 (Triple 3-Input NOR)
    // G1 placed at y=(pinY(1)+pinY(2))/2 so Pin 13 routes cleanly below G1 without colliding with G1->12 output trace
    if (p === '7410' || p === '7427') {
      const gType = p === '7410' ? 'NAND' : 'NOR';
      const g1x = cx;
      const g1y = (pinY(1) + pinY(2)) / 2; // 93 (strictly above Pin 13 at 122)
      const g2x = bodyX + 80;
      const g2y = pinY(4);
      const g3x = bodyRight - 80;
      const g3y = pinY(10);
      return (
        <g>
          {/* Gate 1: Pins 1, 2 (left) + Pin 13 (right) -> Pin 12 (right) */}
          <path
            d={`M ${bodyX} ${pinY(1)} L ${g1x - 32} ${pinY(1)} L ${g1x - 32} ${g1y - 6} L ${g1x - 13} ${g1y - 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.6}
          />
          <path
            d={`M ${bodyX} ${pinY(2)} L ${g1x - 32} ${pinY(2)} L ${g1x - 32} ${g1y} L ${g1x - 13} ${g1y}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.6}
          />
          <path
            d={`M ${bodyRight} ${pinY(13)} L ${g1x - 24} ${pinY(13)} L ${g1x - 24} ${g1y + 6} L ${g1x - 13} ${g1y + 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.6}
          />
          <path
            d={`M ${g1x + 16} ${g1y} L ${g1x + 48} ${g1y} L ${g1x + 48} ${pinY(12)} L ${bodyRight} ${pinY(12)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.75}
          />
          {renderMiniGateInPackage(gType, g1x, g1y, 'right')}

          {/* Gate 2: Pins 3, 4, 5 (left) -> Pin 6 (left) */}
          <path
            d={`M ${bodyX} ${pinY(3)} L ${bodyX + 28} ${pinY(3)} L ${bodyX + 28} ${g2y - 6} L ${g2x - 13} ${g2y - 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.6}
          />
          <path
            d={`M ${bodyX} ${pinY(4)} L ${g2x - 13} ${pinY(4)}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.6}
          />
          <path
            d={`M ${bodyX} ${pinY(5)} L ${bodyX + 28} ${pinY(5)} L ${bodyX + 28} ${g2y + 6} L ${g2x - 13} ${g2y + 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.6}
          />
          <path
            d={`M ${g2x + 16} ${g2y} L ${g2x + 34} ${g2y} L ${g2x + 34} ${pinY(6)} L ${bodyX} ${pinY(6)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.75}
          />
          {renderMiniGateInPackage(gType, g2x, g2y, 'right')}

          {/* Gate 3: Pins 11, 10, 9 (right) -> Pin 8 (right) */}
          <path
            d={`M ${bodyRight} ${pinY(11)} L ${bodyRight - 28} ${pinY(11)} L ${bodyRight - 28} ${g3y - 6} L ${g3x + 13} ${g3y - 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.6}
          />
          <path
            d={`M ${bodyRight} ${pinY(10)} L ${g3x + 13} ${pinY(10)}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.6}
          />
          <path
            d={`M ${bodyRight} ${pinY(9)} L ${bodyRight - 28} ${pinY(9)} L ${bodyRight - 28} ${g3y + 6} L ${g3x + 13} ${g3y + 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.6}
          />
          <path
            d={`M ${g3x - 16} ${g3y} L ${g3x - 34} ${g3y} L ${g3x - 34} ${pinY(8)} L ${bodyRight} ${pinY(8)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.75}
          />
          {renderMiniGateInPackage(gType, g3x, g3y, 'left')}
        </g>
      );
    }

    // 6. 7420 Dual 4-Input NAND
    if (p === '7420') {
      const g1x = bodyX + 82;
      const g1y = pinY(3);
      const g2x = bodyRight - 82;
      const g2y = pinY(11);
      return (
        <g>
          {[1, 2, 4, 5].map((pin, idx) => {
            const offsets = [-7.5, -2.5, 2.5, 7.5];
            const xTurn = bodyX + 18 + idx * 7;
            return (
              <path
                key={pin}
                d={`M ${bodyX} ${pinY(pin)} L ${xTurn} ${pinY(pin)} L ${xTurn} ${g1y + offsets[idx]} L ${g1x - 13} ${g1y + offsets[idx]}`}
                fill="none"
                stroke={wireIn}
                strokeWidth={1.5}
              />
            );
          })}
          <path
            d={`M ${g1x + 16} ${g1y} L ${g1x + 34} ${g1y} L ${g1x + 34} ${pinY(6)} L ${bodyX} ${pinY(6)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.75}
          />
          {renderMiniGateInPackage('NAND', g1x, g1y, 'right')}

          {[13, 12, 10, 9].map((pin, idx) => {
            const offsets = [-7.5, -2.5, 2.5, 7.5];
            const xTurn = bodyRight - 18 - idx * 7;
            return (
              <path
                key={pin}
                d={`M ${bodyRight} ${pinY(pin)} L ${xTurn} ${pinY(pin)} L ${xTurn} ${g2y + offsets[idx]} L ${g2x + 13} ${g2y + offsets[idx]}`}
                fill="none"
                stroke={wireIn}
                strokeWidth={1.5}
              />
            );
          })}
          <path
            d={`M ${g2x - 16} ${g2y} L ${g2x - 34} ${g2y} L ${g2x - 34} ${pinY(8)} L ${bodyRight} ${pinY(8)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.75}
          />
          {renderMiniGateInPackage('NAND', g2x, g2y, 'left')}
        </g>
      );
    }

    // 7. 7474 Dual D Positive-Edge Flip-Flop — Zero-crossing symmetric half-chip architecture
    if (p === '7474') {
      const ffW = 90;
      const ffH = 104;
      const ff1X = bodyX + 54; // 158..248
      const ff1Y = topPad + 46; // 82..186
      const ff1Cx = ff1X + ffW / 2;

      const ff2X = bodyRight - 54 - ffW; // 300..390
      const ff2Y = topPad + 180; // 216..320
      const ff2Cx = ff2X + ffW / 2;

      return (
        <g>
          {/* D-FF 1 (Top-Left, pins 1..6): ~CLR top, D/CLK left, ~PRE bottom, Q/~Q exit right and loop cleanly */}
          <path
            d={`M ${bodyX} ${pinY(1)} L ${ff1Cx - 14} ${pinY(1)} L ${ff1Cx - 14} ${ff1Y - 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.5}
          />
          <path
            d={`M ${bodyX} ${pinY(2)} L ${ff1X - 20} ${pinY(2)} L ${ff1X - 20} ${ff1Y + 26} L ${ff1X} ${ff1Y + 26}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.55}
          />
          <path
            d={`M ${bodyX} ${pinY(3)} L ${ff1X - 12} ${pinY(3)} L ${ff1X - 12} ${ff1Y + ffH / 2} L ${ff1X} ${ff1Y + ffH / 2}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.55}
          />
          <path
            d={`M ${bodyX} ${pinY(4)} L ${ff1Cx + 14} ${pinY(4)} L ${ff1Cx + 14} ${ff1Y + ffH + 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.5}
          />
          <path
            d={`M ${ff1X + ffW} ${ff1Y + 13} L ${ff1X + ffW + 10} ${ff1Y + 13} L ${ff1X + ffW + 10} ${ff1Y + ffH + 74} L ${bodyX + 26} ${ff1Y + ffH + 74} L ${bodyX + 26} ${pinY(5)} L ${bodyX} ${pinY(5)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.6}
          />
          <path
            d={`M ${ff1X + ffW + 6} ${ff1Y + ffH - 12} L ${ff1X + ffW + 18} ${ff1Y + ffH - 12} L ${ff1X + ffW + 18} ${pinY(6)} L ${bodyX} ${pinY(6)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.6}
          />
          {renderFlipFlopSymbol(ff1X, ff1Y, ffW, ffH, 'D-FF 1', {
            hasPre: true,
            hasClr: true,
            swapPreClr: true,
            subLabel: 'POS-EDGE',
            inLabels: [{ text: '1D', yOff: 26 }],
          })}

          {/* D-FF 2 (Bottom-Right mirrored, pins 13..8): ~CLR top, D/CLK right, ~PRE bottom, Q/~Q exit left */}
          <path
            d={`M ${bodyRight} ${pinY(13)} L ${ff2Cx - 14} ${pinY(13)} L ${ff2Cx - 14} ${ff2Y - 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.5}
          />
          <path
            d={`M ${bodyRight} ${pinY(12)} L ${ff2X + ffW + 14} ${pinY(12)} L ${ff2X + ffW + 14} ${ff2Y + 26} L ${ff2X + ffW} ${ff2Y + 26}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.55}
          />
          <path
            d={`M ${bodyRight} ${pinY(11)} L ${ff2X + ffW + 24} ${pinY(11)} L ${ff2X + ffW + 24} ${ff2Y + ffH / 2} L ${ff2X + ffW} ${ff2Y + ffH / 2}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.55}
          />
          <path
            d={`M ${bodyRight} ${pinY(10)} L ${ff2X + ffW + 34} ${pinY(10)} L ${ff2X + ffW + 34} ${ff2Y + ffH + 14} L ${ff2Cx + 14} ${ff2Y + ffH + 14} L ${ff2Cx + 14} ${ff2Y + ffH + 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.5}
          />
          <path
            d={`M ${ff2X} ${ff2Y + 13} L ${ff2X - 12} ${ff2Y + 13} L ${ff2X - 12} ${pinY(9) + 14} L ${bodyRight - 28} ${pinY(9) + 14} L ${bodyRight - 28} ${pinY(9)} L ${bodyRight} ${pinY(9)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.6}
          />
          <path
            d={`M ${ff2X - 6} ${ff2Y + ffH - 12} L ${ff2X - 20} ${ff2Y + ffH - 12} L ${ff2X - 20} ${pinY(8)} L ${bodyRight} ${pinY(8)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.6}
          />
          {renderFlipFlopSymbol(ff2X, ff2Y, ffW, ffH, 'D-FF 2', {
            hasPre: true,
            hasClr: true,
            swapPreClr: true,
            mirrored: true,
            subLabel: 'POS-EDGE',
            inLabels: [{ text: '2D', yOff: 26 }],
          })}
        </g>
      );
    }

    // 8. 7476 Dual JK Master-Slave Flip-Flop — Clean orthogonal channels around JK-FF 1 & JK-FF 2
    if (p === '7476') {
      const ffW = 94;
      const ffH = 114;
      const ffX = cx - ffW / 2; // 227..321
      const ff1Y = topPad + 56; // 92..206
      const ff2Y = topPad + 270; // 306..420
      return (
        <g>
          {/* JK-FF 1: 1CLK(1), ~1PRE(2), ~1CLR(3), 1J(4), 1K(16) -> 1Q(15), 1~Q(14) */}
          <path
            d={`M ${bodyX} ${pinY(1)} L ${ffX - 72} ${pinY(1)} L ${ffX - 72} ${ff1Y + ffH / 2} L ${ffX - 6} ${ff1Y + ffH / 2}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.55}
          />
          <path
            d={`M ${bodyX} ${pinY(2)} L ${ffX - 88} ${pinY(2)} L ${ffX - 88} ${ff1Y - 12} L ${cx - 14} ${ff1Y - 12} L ${cx - 14} ${ff1Y - 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.45}
          />
          <path
            d={`M ${bodyX} ${pinY(3)} L ${ffX - 88} ${pinY(3)} L ${ffX - 88} ${ff1Y + ffH + 12} L ${cx + 14} ${ff1Y + ffH + 12} L ${cx + 14} ${ff1Y + ffH + 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.45}
          />
          <path
            d={`M ${bodyX} ${pinY(4)} L ${ffX - 54} ${pinY(4)} L ${ffX - 54} ${ff1Y + 26} L ${ffX} ${ff1Y + 26}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.55}
          />
          <path
            d={`M ${bodyRight} ${pinY(16)} L ${bodyRight - 32} ${pinY(16)} L ${bodyRight - 32} ${ff1Y - 36} L ${ffX - 36} ${ff1Y - 36} L ${ffX - 36} ${ff1Y + ffH - 26} L ${ffX} ${ff1Y + ffH - 26}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.45}
          />
          <path
            d={`M ${ffX + ffW} ${ff1Y + 13} L ${ffX + ffW + 24} ${ff1Y + 13} L ${ffX + ffW + 24} ${pinY(15)} L ${bodyRight} ${pinY(15)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.6}
          />
          <path
            d={`M ${ffX + ffW + 6} ${ff1Y + ffH - 12} L ${ffX + ffW + 34} ${ff1Y + ffH - 12} L ${ffX + ffW + 34} ${pinY(14)} L ${bodyRight} ${pinY(14)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.6}
          />
          {renderFlipFlopSymbol(ffX, ff1Y, ffW, ffH, 'JK-FF 1', {
            negEdgeClk: true,
            hasPre: true,
            hasClr: true,
            subLabel: 'NEG-EDGE',
            inLabels: [
              { text: '1J', yOff: 26 },
              { text: '1K', yOff: ffH - 26 },
            ],
          })}

          {/* JK-FF 2: 2CLK(6), ~2PRE(7), ~2CLR(8), 2J(9), 2K(12) -> 2Q(11), 2~Q(10) */}
          <path
            d={`M ${bodyX} ${pinY(6)} L ${ffX - 18} ${pinY(6)} L ${ffX - 18} ${ff2Y + ffH / 2} L ${ffX - 6} ${ff2Y + ffH / 2}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.55}
          />
          <path
            d={`M ${bodyX} ${pinY(7)} L ${ffX - 88} ${pinY(7)} L ${ffX - 88} ${ff2Y - 12} L ${cx - 14} ${ff2Y - 12} L ${cx - 14} ${ff2Y - 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.45}
          />
          <path
            d={`M ${bodyX} ${pinY(8)} L ${ffX - 88} ${pinY(8)} L ${ffX - 88} ${ff2Y + ffH + 12} L ${cx + 14} ${ff2Y + ffH + 12} L ${cx + 14} ${ff2Y + ffH + 6}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.45}
          />
          <path
            d={`M ${bodyRight} ${pinY(9)} L ${bodyRight - 30} ${pinY(9)} L ${bodyRight - 30} ${ff2Y + ffH + 24} L ${ffX - 54} ${ff2Y + ffH + 24} L ${ffX - 54} ${ff2Y + 26} L ${ffX} ${ff2Y + 26}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.45}
          />
          <path
            d={`M ${bodyRight} ${pinY(12)} L ${bodyRight - 30} ${pinY(12)} L ${bodyRight - 30} ${ff2Y - 24} L ${ffX - 36} ${ff2Y - 24} L ${ffX - 36} ${ff2Y + ffH - 26} L ${ffX} ${ff2Y + ffH - 26}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.45}
          />
          <path
            d={`M ${ffX + ffW} ${ff2Y + 13} L ${ffX + ffW + 24} ${ff2Y + 13} L ${ffX + ffW + 24} ${pinY(11)} L ${bodyRight} ${pinY(11)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.6}
          />
          <path
            d={`M ${ffX + ffW + 6} ${ff2Y + ffH - 12} L ${ffX + ffW + 34} ${ff2Y + ffH - 12} L ${ffX + ffW + 34} ${pinY(10)} L ${bodyRight} ${pinY(10)}`}
            fill="none"
            stroke={wireOut}
            strokeWidth={1.6}
          />
          {renderFlipFlopSymbol(ffX, ff2Y, ffW, ffH, 'JK-FF 2', {
            negEdgeClk: true,
            hasPre: true,
            hasClr: true,
            subLabel: 'NEG-EDGE',
            inLabels: [
              { text: '2J', yOff: 26 },
              { text: '2K', yOff: ffH - 26 },
            ],
          })}
        </g>
      );
    }

    // 9. 7490 BCD Decade Counter — Datasheet ÷2 + ÷5 Stages, Non-Overlapping Outputs, Connected R0 CLR & R9 SET-9 Buses
    if (p === '7490') {
      const ffW = 82;
      const ffH = 50;
      const ffX = 254; // 254..336
      const ffs = [
        { name: 'FF-A', sub: '÷2', y: 92, hasPre: true, hasClr: true },
        { name: 'FF-B', sub: '÷5 B0', y: 154, hasPre: false, hasClr: true },
        { name: 'FF-C', sub: '÷5 B1', y: 248, hasPre: false, hasClr: true },
        { name: 'FF-D', sub: '÷5 B2', y: 328, hasPre: true, hasClr: true },
      ];
      const r0GateX = 148;
      const r0GateY = (pinY(2) + pinY(3)) / 2; // 151
      const r9GateX = 148;
      const r9GateY = (pinY(6) + pinY(7)) / 2; // 383
      const clrRailX = 186;
      const preRailX = 198;
      const ckbX = 212;
      const cascadeX = 228;

      return (
        <g>
          {/* CKA(14) -> routes cleanly at y=72 over FF-A to FF-A Clock */}
          <path
            d={`M ${bodyRight} ${pinY(14)} L ${bodyRight - 30} ${pinY(14)} L ${bodyRight - 30} 72 L ${ffX - 16} 72 L ${ffX - 16} ${ffs[0].y + ffH / 2} L ${ffX - 6} ${ffs[0].y + ffH / 2}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.55}
          />

          {/* CKB(1) -> drives FF-B Clock AND FF-D Clock (authentic 7490 ÷5 clocking) */}
          <path
            d={`M ${bodyX} ${pinY(1)} L ${ckbX} ${pinY(1)} L ${ckbX} ${ffs[3].y + ffH / 2} L ${ffX - 6} ${ffs[3].y + ffH / 2}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.55}
          />
          <line x1={ckbX} y1={ffs[1].y + ffH / 2} x2={ffX - 6} y2={ffs[1].y + ffH / 2} stroke={wireIn} strokeWidth={1.55} />
          <circle cx={ckbX} cy={ffs[1].y + ffH / 2} r={2} fill={wireIn} />

          {/* R0(1)(2) & R0(2)(3) -> Master Reset NAND Gate -> Continuous CLR Bus to All 4 FFs */}
          <path
            d={`M ${bodyX} ${pinY(2)} L ${r0GateX - 24} ${pinY(2)} L ${r0GateX - 24} ${r0GateY - 5} L ${r0GateX - 13} ${r0GateY - 5}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.45}
          />
          <path
            d={`M ${bodyX} ${pinY(3)} L ${r0GateX - 24} ${pinY(3)} L ${r0GateX - 24} ${r0GateY + 5} L ${r0GateX - 13} ${r0GateY + 5}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.45}
          />
          {renderMiniGateInPackage('NAND', r0GateX, r0GateY, 'right')}
          <line x1={r0GateX + 16} y1={r0GateY} x2={clrRailX} y2={r0GateY} stroke="#7A4848" strokeWidth={1.35} />
          <circle cx={clrRailX} cy={r0GateY} r={2} fill="#7A4848" />
          <line
            x1={clrRailX}
            y1={ffs[0].y + ffH + 8}
            x2={clrRailX}
            y2={ffs[3].y + ffH + 8}
            stroke="#7A4848"
            strokeWidth={1.35}
            strokeDasharray="3 1.5"
          />
          {ffs.map((f) => (
            <path
              key={`clr-${f.name}`}
              d={`M ${clrRailX} ${f.y + ffH + 8} L ${ffX + ffW / 2 + 14} ${f.y + ffH + 8} L ${ffX + ffW / 2 + 14} ${f.y + ffH + 6}`}
              fill="none"
              stroke="#7A4848"
              strokeWidth={1.25}
              strokeDasharray="2.5 1.5"
            />
          ))}

          {/* R9(1)(6) & R9(2)(7) -> Set-to-9 NAND Gate -> ~PRE Bus to FF-A (QA=1) & FF-D (QD=1) */}
          <path
            d={`M ${bodyX} ${pinY(6)} L ${r9GateX - 24} ${pinY(6)} L ${r9GateX - 24} ${r9GateY - 5} L ${r9GateX - 13} ${r9GateY - 5}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.45}
          />
          <path
            d={`M ${bodyX} ${pinY(7)} L ${r9GateX - 24} ${pinY(7)} L ${r9GateX - 24} ${r9GateY + 5} L ${r9GateX - 13} ${r9GateY + 5}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.45}
          />
          {renderMiniGateInPackage('NAND', r9GateX, r9GateY, 'right')}
          <path
            d={`M ${r9GateX + 16} ${r9GateY} L ${preRailX} ${r9GateY} L ${preRailX} ${ffs[0].y - 10} L ${ffX + ffW / 2 - 14} ${ffs[0].y - 10} L ${ffX + ffW / 2 - 14} ${ffs[0].y - 6}`}
            fill="none"
            stroke="#7A4848"
            strokeWidth={1.3}
            strokeDasharray="2.5 1.5"
          />
          <path
            d={`M ${preRailX} ${ffs[3].y - 10} L ${ffX + ffW / 2 - 14} ${ffs[3].y - 10} L ${ffX + ffW / 2 - 14} ${ffs[3].y - 6}`}
            fill="none"
            stroke="#7A4848"
            strokeWidth={1.3}
            strokeDasharray="2.5 1.5"
          />
          <circle cx={preRailX} cy={ffs[3].y - 10} r={2} fill="#7A4848" />

          {/* Internal ÷5 Cascade: QB -> FF-C Clock, and QC -> FF-D Steering */}
          <path
            d={`M ${ffX + ffW} ${ffs[1].y + 12} L ${ffX + ffW + 10} ${ffs[1].y + 12} L ${ffX + ffW + 10} 226 L ${cascadeX} 226 L ${cascadeX} ${ffs[2].y + ffH / 2} L ${ffX - 6} ${ffs[2].y + ffH / 2}`}
            fill="none"
            stroke={wireInternal}
            strokeWidth={1.35}
            strokeDasharray="3 1.5"
          />
          <path
            d={`M ${ffX + ffW} ${ffs[2].y + 12} L ${ffX + ffW + 10} ${ffs[2].y + 12} L ${ffX + ffW + 10} 310 L ${cascadeX} 310 L ${cascadeX} ${ffs[3].y + 13} L ${ffX} ${ffs[3].y + 13}`}
            fill="none"
            stroke={wireInternal}
            strokeWidth={1.35}
            strokeDasharray="3 1.5"
          />

          {/* Non-Overlapping Right Output Tracks: QA(12), QD(11), QB(9), QC(8) */}
          <path d={`M ${ffX + ffW} ${ffs[0].y + 12} L 352 ${ffs[0].y + 12} L 352 ${pinY(12)} L ${bodyRight} ${pinY(12)}`} fill="none" stroke={wireOut} strokeWidth={1.6} />
          <path d={`M ${ffX + ffW} ${ffs[1].y + 12} L 366 ${ffs[1].y + 12} L 366 ${pinY(9)} L ${bodyRight} ${pinY(9)}`} fill="none" stroke={wireOut} strokeWidth={1.6} />
          <path d={`M ${ffX + ffW} ${ffs[2].y + 12} L 380 ${ffs[2].y + 12} L 380 ${pinY(8)} L ${bodyRight} ${pinY(8)}`} fill="none" stroke={wireOut} strokeWidth={1.6} />
          <path d={`M ${ffX + ffW} ${ffs[3].y + 12} L 352 ${ffs[3].y + 12} L 352 ${pinY(11)} L ${bodyRight} ${pinY(11)}`} fill="none" stroke={wireOut} strokeWidth={1.6} />

          {ffs.map((f) => (
            <g key={f.name}>
              {renderFlipFlopSymbol(ffX, f.y, ffW, ffH, f.name, {
                negEdgeClk: true,
                hasPre: f.hasPre,
                hasClr: f.hasClr,
                subLabel: f.sub,
              })}
            </g>
          ))}
        </g>
      );
    }

    // 10. 7495 4-Bit Parallel-Access Shift Register — Authentic 2:1 S/P MUX Stages + AND-OR Clock Steering
    if (p === '7495') {
      const muxX = 204;
      const muxW = 34;
      const muxH = 28;
      const xMode = 221;
      const clkBusX = 264;
      const ffX = 280;
      const ffW = 78;
      const ffH = 40;
      const xSer = 186;
      const xTap = 374;

      const stages = [
        { name: 'SR-A', inPin: 2, outPin: 13, py: pinY(2) },
        { name: 'SR-B', inPin: 3, outPin: 12, py: pinY(3) },
        { name: 'SR-C', inPin: 4, outPin: 11, py: pinY(4) },
        { name: 'SR-D', inPin: 5, outPin: 10, py: pinY(5) },
      ];

      return (
        <g>
          {/* Serial Input SER(1) -> MUX-A S Port */}
          <path
            d={`M ${bodyX} ${pinY(1)} L ${xSer} ${pinY(1)} L ${xSer} ${stages[0].py - 8} L ${muxX} ${stages[0].py - 8}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.5}
          />

          {/* MODE(6) Vertical Select Rail -> Feeds all 4 S/P MUXes + Bottom Clock Steering */}
          <path
            d={`M ${bodyX} ${pinY(6)} L ${xMode} ${pinY(6)} L ${xMode} ${stages[0].py + muxH / 2}`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.45}
          />
          <circle cx={xMode} cy={pinY(6)} r={2} fill={wireIn} />

          {/* Clock Steering: CLK = (~MODE · ~CLK1) + (MODE · ~CLK2) */}
          <path
            d={`M ${xMode} ${pinY(6)} L ${xMode} 428 L 398 428 L 398 364 L 393 364`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.35}
          />
          <path
            d={`M 368 428 L 368 407 L 359 407`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.35}
          />
          <circle cx={368} cy={428} r={2} fill={wireIn} />
          {renderMiniGateInPackage('NOT', 382, 364, 'left')}
          <path
            d={`M 366.5 364 L 363 364 L 363 359 L 359 359`}
            fill="none"
            stroke={wireInternal}
            strokeWidth={1.35}
          />
          <path
            d={`M ${bodyRight} ${pinY(9)} L ${bodyRight - 36} ${pinY(9)} L ${bodyRight - 36} 349 L 359 349`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.4}
          />
          <path
            d={`M ${bodyRight} ${pinY(8)} L ${bodyRight - 36} ${pinY(8)} L ${bodyRight - 36} 417 L 359 417`}
            fill="none"
            stroke={wireIn}
            strokeWidth={1.4}
          />
          {renderMiniGateInPackage('AND', 346, 354, 'left')}
          {renderMiniGateInPackage('AND', 346, 412, 'left')}
          <path d={`M 335 354 L 316 354 L 316 378 L 300 378`} fill="none" stroke={wireInternal} strokeWidth={1.35} />
          <path d={`M 335 412 L 316 412 L 316 388 L 300 388`} fill="none" stroke={wireInternal} strokeWidth={1.35} />
          {renderMiniGateInPackage('OR', 290, 383, 'left')}
          <path
            d={`M 277 383 L ${clkBusX} 383 L ${clkBusX} ${stages[0].py}`}
            fill="none"
            stroke={wireInternal}
            strokeWidth={1.45}
          />

          {/* 4 Aligned MUX + Flip-Flop Stages */}
          {stages.map((st, idx) => {
            const muxY = st.py - muxH / 2;
            const ffY = st.py - ffH / 2;
            return (
              <g key={st.name}>
                {/* Parallel Input A..D straight into MUX P port */}
                <line x1={bodyX} y1={st.py} x2={muxX} y2={st.py} stroke={wireIn} strokeWidth={1.5} />

                {/* 2:1 S/P MUX Box */}
                <rect x={muxX} y={muxY} width={muxW} height={muxH} rx={2.5} fill="#FFFFFF" stroke="#303840" strokeWidth={1.35} />
                <text x={muxX + 4} y={st.py - 5} fill="#456A83" fontSize={6.5} fontWeight={700} fontFamily="IBM Plex Mono, monospace">S</text>
                <text x={muxX + 4} y={st.py + 3} fill="#2C5E8A" fontSize={6.5} fontWeight={700} fontFamily="IBM Plex Mono, monospace">P</text>
                <text x={muxX + muxW - 4} y={st.py + 2.5} textAnchor="end" fill="#20252B" fontSize={6.3} fontWeight={700} fontFamily="IBM Plex Mono, monospace">MUX</text>
                <circle cx={xMode} cy={muxY + muxH} r={1.8} fill={wireIn} />

                {/* MUX -> FF D Input (cleanly above >CLK) */}
                <path
                  d={`M ${muxX + muxW} ${st.py} L ${muxX + muxW + 12} ${st.py} L ${muxX + muxW + 12} ${ffY + 10} L ${ffX} ${ffY + 10}`}
                  fill="none"
                  stroke={wireInternal}
                  strokeWidth={1.35}
                />

                {/* Clock Bus Tap -> FF Negative-Edge Clock */}
                <line x1={clkBusX} y1={st.py} x2={ffX - 6} y2={st.py} stroke={wireInternal} strokeWidth={1.35} />
                {idx > 0 && <circle cx={clkBusX} cy={st.py} r={1.8} fill={wireInternal} />}

                {/* Q Output -> Right Output Pin */}
                <line x1={ffX + ffW} y1={st.py} x2={bodyRight} y2={st.py} stroke={wireOut} strokeWidth={1.6} />

                {/* Serial Cascade Q[i] -> MUX[i+1] S Port via Clean Inter-Row Channel */}
                {idx < 3 && (
                  <g>
                    <path
                      d={`M ${xTap} ${st.py} L ${xTap} ${st.py + 29} L ${xSer} ${st.py + 29} L ${xSer} ${stages[idx + 1].py - 8} L ${muxX} ${stages[idx + 1].py - 8}`}
                      fill="none"
                      stroke={wireInternal}
                      strokeWidth={1.25}
                      strokeDasharray="3 1.5"
                    />
                    <circle cx={xTap} cy={st.py} r={1.8} fill={wireOut} />
                  </g>
                )}

                {renderFlipFlopSymbol(ffX, ffY, ffW, ffH, st.name, { negEdgeClk: true })}
              </g>
            );
          })}
        </g>
      );
    }

    // 11. 74138 3-to-8 Line Decoder / Demultiplexer — Authentic Enable AND Gate + Select Buses + 8 IEEE NAND Gates
    if (p === '74138') {
      const xA = cx - 72; // 202 (all rails cleanly left of central notch 256..292)
      const xB = cx - 58; // 216
      const xC = cx - 44; // 230
      const xEN = cx - 30; // 244
      const enGateX = bodyX + 64; // 168
      const enGateY = pinY(5); // 296
      const gateRX = bodyRight - 72; // 372
      const gateLX = bodyX + 64; // 168

      return (
        <g>
          {/* Bus Labels (placed cleanly clear of top notch and pin wires) */}
          <text x={xA} y={topPad + 19} textAnchor="middle" fill={wireIn} fontSize={7} fontWeight={700} fontFamily="IBM Plex Mono, monospace">A</text>
          <text x={xB} y={topPad + 19} textAnchor="middle" fill={wireIn} fontSize={7} fontWeight={700} fontFamily="IBM Plex Mono, monospace">B</text>
          <text x={xC} y={topPad + 19} textAnchor="middle" fill={wireIn} fontSize={7} fontWeight={700} fontFamily="IBM Plex Mono, monospace">C</text>
          <text x={xEN} y={pinY(15) - 12} textAnchor="middle" fill={wireInternal} fontSize={6.8} fontWeight={700} fontFamily="IBM Plex Mono, monospace">EN</text>

          {/* Select Buses A(1), B(2), C(3) ending cleanly at bottom tap and reaching top ~Y0 taps */}
          <path d={`M ${bodyX} ${pinY(1)} L ${xA} ${pinY(1)} L ${xA} ${pinY(9) - 6}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
          <path d={`M ${bodyX} ${pinY(2)} L ${xB} ${pinY(2)}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
          <line x1={xB} y1={pinY(15) - 2} x2={xB} y2={pinY(9) - 2} stroke={wireIn} strokeWidth={1.45} />
          <path d={`M ${bodyX} ${pinY(3)} L ${xC} ${pinY(3)}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
          <line x1={xC} y1={pinY(15) + 2} x2={xC} y2={pinY(9) + 2} stroke={wireIn} strokeWidth={1.45} />

          {/* Enable Gating: ~G2A(4), ~G2B(5), G1(6) -> AND Gate -> Vertical EN Bus */}
          <path d={`M ${bodyX} ${pinY(4)} L ${enGateX - 28} ${pinY(4)} L ${enGateX - 28} ${enGateY - 6} L ${enGateX - 13} ${enGateY - 6}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
          <path d={`M ${bodyX} ${pinY(5)} L ${enGateX - 13} ${pinY(5)}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
          <path d={`M ${bodyX} ${pinY(6)} L ${enGateX - 28} ${pinY(6)} L ${enGateX - 28} ${enGateY + 6} L ${enGateX - 13} ${enGateY + 6}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
          <path d={`M ${enGateX + 11} ${enGateY} L ${xEN} ${enGateY}`} fill="none" stroke={wireInternal} strokeWidth={1.45} />
          <line x1={xEN} y1={pinY(15) + 6} x2={xEN} y2={pinY(9) + 6} stroke={wireInternal} strokeWidth={1.45} />
          {renderMiniGateInPackage('AND', enGateX, enGateY, 'right')}

          {/* 7 Right-Side Active-Low NAND Decoders (~Y0=15 .. ~Y6=9) */}
          {[15, 14, 13, 12, 11, 10, 9].map((outPin) => {
            const py = pinY(outPin);
            return (
              <g key={outPin}>
                <line x1={xA} y1={py - 6} x2={gateRX - 13} y2={py - 6} stroke={wireInternal} strokeWidth={1.15} />
                <line x1={xB} y1={py - 2} x2={gateRX - 13} y2={py - 2} stroke={wireInternal} strokeWidth={1.15} />
                <line x1={xC} y1={py + 2} x2={gateRX - 13} y2={py + 2} stroke={wireInternal} strokeWidth={1.15} />
                <line x1={xEN} y1={py + 6} x2={gateRX - 13} y2={py + 6} stroke={wireInternal} strokeWidth={1.15} />
                <circle cx={xA} cy={py - 6} r={1.8} fill={wireInternal} />
                <circle cx={xB} cy={py - 2} r={1.8} fill={wireInternal} />
                <circle cx={xC} cy={py + 2} r={1.8} fill={wireInternal} />
                <circle cx={xEN} cy={py + 6} r={1.8} fill={wireInternal} />
                <line x1={gateRX + 16} y1={py} x2={bodyRight} y2={py} stroke={wireOut} strokeWidth={1.65} />
                {renderMiniGateInPackage('NAND', gateRX, py, 'right')}
              </g>
            );
          })}

          {/* Left-Side Decoder Gate 8 (~Y7 = Pin 7) */}
          {(() => {
            const py = pinY(7);
            return (
              <g>
                <line x1={xA} y1={py - 6} x2={gateLX + 13} y2={py - 6} stroke={wireInternal} strokeWidth={1.15} />
                <line x1={xB} y1={py - 2} x2={gateLX + 13} y2={py - 2} stroke={wireInternal} strokeWidth={1.15} />
                <line x1={xC} y1={py + 2} x2={gateLX + 13} y2={py + 2} stroke={wireInternal} strokeWidth={1.15} />
                <line x1={xEN} y1={py + 6} x2={gateLX + 13} y2={py + 6} stroke={wireInternal} strokeWidth={1.15} />
                <circle cx={xA} cy={py - 6} r={1.8} fill={wireInternal} />
                <circle cx={xB} cy={py - 2} r={1.8} fill={wireInternal} />
                <circle cx={xC} cy={py + 2} r={1.8} fill={wireInternal} />
                <circle cx={xEN} cy={py + 6} r={1.8} fill={wireInternal} />
                <line x1={gateLX - 16} y1={py} x2={bodyX} y2={py} stroke={wireOut} strokeWidth={1.65} />
                {renderMiniGateInPackage('NAND', gateLX, py, 'left')}
              </g>
            );
          })()}
        </g>
      );
    }

    // 12. 74139 Dual 2-to-4 Line Decoder — Clean orthogonal input rails + 8 NAND gates
    if (p === '74139') {
      const busL1 = cx - 58; // ~1G
      const busL2 = cx - 45; // 1A
      const busL3 = cx - 32; // 1B
      const gateLX = bodyX + 68; // 172 (points left to pins 4..7)

      const busR1 = cx + 32; // 2B
      const busR2 = cx + 45; // 2A
      const busR3 = cx + 58; // ~2G
      const gateRX = bodyRight - 68; // 376 (points right to pins 12..9)

      return (
        <g>
          {/* Rail Identifiers (cleanly separated from top central notch) */}
          <text x={busL1} y={topPad + 19} textAnchor="middle" fill={wireIn} fontSize={6.3} fontWeight={700} fontFamily="IBM Plex Mono, monospace">1G</text>
          <text x={busL2} y={topPad + 19} textAnchor="middle" fill={wireIn} fontSize={6.5} fontWeight={700} fontFamily="IBM Plex Mono, monospace">1A</text>
          <text x={busL3} y={topPad + 19} textAnchor="middle" fill={wireIn} fontSize={6.5} fontWeight={700} fontFamily="IBM Plex Mono, monospace">1B</text>
          <text x={busR1} y={topPad + 19} textAnchor="middle" fill={wireIn} fontSize={6.5} fontWeight={700} fontFamily="IBM Plex Mono, monospace">2B</text>
          <text x={busR2} y={topPad + 19} textAnchor="middle" fill={wireIn} fontSize={6.5} fontWeight={700} fontFamily="IBM Plex Mono, monospace">2A</text>
          <text x={busR3} y={topPad + 19} textAnchor="middle" fill={wireIn} fontSize={6.3} fontWeight={700} fontFamily="IBM Plex Mono, monospace">2G</text>

          {/* Decoder 1 Vertical Rails (~1G=1, 1A=2, 1B=3) */}
          <path d={`M ${bodyX} ${pinY(1)} L ${busL1} ${pinY(1)} L ${busL1} ${pinY(7) - 5}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
          <path d={`M ${bodyX} ${pinY(2)} L ${busL2} ${pinY(2)} L ${busL2} ${pinY(7)}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
          <path d={`M ${bodyX} ${pinY(3)} L ${busL3} ${pinY(3)} L ${busL3} ${pinY(7) + 5}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
          {[4, 5, 6, 7].map((outPin) => {
            const py = pinY(outPin);
            return (
              <g key={outPin}>
                <line x1={busL1} y1={py - 5} x2={gateLX + 13} y2={py - 5} stroke={wireInternal} strokeWidth={1.2} />
                <line x1={busL2} y1={py} x2={gateLX + 13} y2={py} stroke={wireInternal} strokeWidth={1.2} />
                <line x1={busL3} y1={py + 5} x2={gateLX + 13} y2={py + 5} stroke={wireInternal} strokeWidth={1.2} />
                <circle cx={busL1} cy={py - 5} r={1.8} fill={wireInternal} />
                <circle cx={busL2} cy={py} r={1.8} fill={wireInternal} />
                <circle cx={busL3} cy={py + 5} r={1.8} fill={wireInternal} />
                <line x1={gateLX - 16} y1={py} x2={bodyX} y2={py} stroke={wireOut} strokeWidth={1.65} />
                {renderMiniGateInPackage('NAND', gateLX, py, 'left')}
              </g>
            );
          })}

          {/* Decoder 2 Vertical Rails (~2G=15, 2A=14, 2B=13) */}
          <path d={`M ${bodyRight} ${pinY(15)} L ${busR3} ${pinY(15)} L ${busR3} ${pinY(9) - 5}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
          <path d={`M ${bodyRight} ${pinY(14)} L ${busR2} ${pinY(14)} L ${busR2} ${pinY(9)}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
          <path d={`M ${bodyRight} ${pinY(13)} L ${busR1} ${pinY(13)} L ${busR1} ${pinY(9) + 5}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
          {[12, 11, 10, 9].map((outPin) => {
            const py = pinY(outPin);
            return (
              <g key={outPin}>
                <line x1={busR3} y1={py - 5} x2={gateRX - 13} y2={py - 5} stroke={wireInternal} strokeWidth={1.2} />
                <line x1={busR2} y1={py} x2={gateRX - 13} y2={py} stroke={wireInternal} strokeWidth={1.2} />
                <line x1={busR1} y1={py + 5} x2={gateRX - 13} y2={py + 5} stroke={wireInternal} strokeWidth={1.2} />
                <circle cx={busR3} cy={py - 5} r={1.8} fill={wireInternal} />
                <circle cx={busR2} cy={py} r={1.8} fill={wireInternal} />
                <circle cx={busR1} cy={py + 5} r={1.8} fill={wireInternal} />
                <line x1={gateRX + 16} y1={py} x2={bodyRight} y2={py} stroke={wireOut} strokeWidth={1.65} />
                {renderMiniGateInPackage('NAND', gateRX, py, 'right')}
              </g>
            );
          })}
        </g>
      );
    }

    // 13. 74153 Dual 4-to-1 Multiplexer — Central True/Complement Select Decoder (B, ~B, A, ~A) + Zero Dangling Tails
    if (p === '74153') {
      const xB = 253;
      const xBn = 267;
      const xA = 281;
      const xAn = 295;
      const railEndY = pinY(10) + 19; // 431 (exact bottom select tap)

      const xG1 = 128;
      const andLX = 184;
      const trunkLX = 216;
      const orLX = 178;

      const xG2 = 420;
      const andRX = 364;
      const trunkRX = 332;
      const orRX = 370;

      const mux1Rows = [
        { pin: 3, selB: xB, selA: xA },   // 1C3: B·A
        { pin: 4, selB: xB, selA: xAn },  // 1C2: B·~A
        { pin: 5, selB: xBn, selA: xA },  // 1C1: ~B·A
        { pin: 6, selB: xBn, selA: xAn }, // 1C0: ~B·~A
      ];
      const mux2Rows = [
        { pin: 13, selB: xB, selA: xA },   // 2C3: B·A
        { pin: 12, selB: xB, selA: xAn },  // 2C2: B·~A
        { pin: 11, selB: xBn, selA: xA },  // 2C1: ~B·A
        { pin: 10, selB: xBn, selA: xAn }, // 2C0: ~B·~A
      ];

      return (
        <g>
          {/* Central Select Decoder: B(2) -> B & ~B rails; A(14) -> A & ~A rails */}
          <path d={`M ${bodyX} ${pinY(2)} L ${xB} ${pinY(2)} L ${xB} ${railEndY}`} fill="none" stroke={wireIn} strokeWidth={1.4} />
          <path d={`M 218 ${pinY(2)} L 218 98 L 225 98`} fill="none" stroke={wireIn} strokeWidth={1.35} />
          <circle cx={218} cy={pinY(2)} r={2} fill={wireIn} />
          {renderMiniGateInPackage('NOT', 236, 98, 'right')}
          <path d={`M 251.5 98 L ${xBn} 98 L ${xBn} ${railEndY}`} fill="none" stroke={wireInternal} strokeWidth={1.35} strokeDasharray="3 1.5" />

          <path d={`M ${bodyRight} ${pinY(14)} L 332 ${pinY(14)} L 332 138 L ${xA} 138 L ${xA} ${railEndY}`} fill="none" stroke={wireIn} strokeWidth={1.4} />
          <path d={`M 332 138 L 332 108 L 325 108`} fill="none" stroke={wireIn} strokeWidth={1.35} />
          <circle cx={332} cy={138} r={2} fill={wireIn} />
          {renderMiniGateInPackage('NOT', 314, 108, 'left')}
          <path d={`M 298.5 108 L ${xAn} 108 L ${xAn} ${railEndY}`} fill="none" stroke={wireInternal} strokeWidth={1.35} strokeDasharray="3 1.5" />

          {/* Clean Rail Identifiers below Select Bus */}
          <text x={xB} y={railEndY + 14} textAnchor="middle" fill={wireIn} fontSize={7} fontWeight={700} fontFamily="IBM Plex Mono, monospace">B</text>
          <text x={xBn} y={railEndY + 14} textAnchor="middle" fill={wireInternal} fontSize={7} fontWeight={700} fontFamily="IBM Plex Mono, monospace">B̄</text>
          <text x={xA} y={railEndY + 14} textAnchor="middle" fill={wireIn} fontSize={7} fontWeight={700} fontFamily="IBM Plex Mono, monospace">A</text>
          <text x={xAn} y={railEndY + 14} textAnchor="middle" fill={wireInternal} fontSize={7} fontWeight={700} fontFamily="IBM Plex Mono, monospace">Ā</text>

          {/* Strobe Rails ~1G(1) & ~2G(15) terminating cleanly at bottom gate tap */}
          <path d={`M ${bodyX} ${pinY(1)} L ${xG1} ${pinY(1)} L ${xG1} ${pinY(6) - 2}`} fill="none" stroke={wireIn} strokeWidth={1.4} />
          <path d={`M ${bodyRight} ${pinY(15)} L ${xG2} ${pinY(15)} L ${xG2} ${pinY(10) - 2}`} fill="none" stroke={wireIn} strokeWidth={1.4} />

          {/* MUX 1: 4 Decoded Product AND Gates (1C3..1C0) -> OR Gate -> 1Y(7) */}
          {mux1Rows.map(({ pin, selB, selA }) => {
            const py = pinY(pin);
            return (
              <g key={pin}>
                <path d={`M ${bodyX} ${py} L 116 ${py} L 116 ${py - 6} L ${andLX - 13} ${py - 6}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
                <line x1={xG1} y1={py - 2} x2={andLX - 13} y2={py - 2} stroke={wireIn} strokeWidth={1.15} />
                <circle cx={xG1} cy={py - 2} r={1.8} fill={wireIn} />
                <path d={`M ${selB} ${py + 14} L 158 ${py + 14} L 158 ${py + 2} L ${andLX - 13} ${py + 2}`} fill="none" stroke={wireInternal} strokeWidth={1.15} />
                <circle cx={selB} cy={py + 14} r={1.8} fill={wireInternal} />
                <path d={`M ${selA} ${py + 19} L 164 ${py + 19} L 164 ${py + 6} L ${andLX - 13} ${py + 6}`} fill="none" stroke={wireInternal} strokeWidth={1.15} />
                <circle cx={selA} cy={py + 19} r={1.8} fill={wireInternal} />
                <line x1={andLX + 11} y1={py} x2={trunkLX} y2={py} stroke={wireOut} strokeWidth={1.45} />
                {renderMiniGateInPackage('AND', andLX, py, 'right')}
              </g>
            );
          })}
          <line x1={trunkLX} y1={pinY(3)} x2={trunkLX} y2={pinY(7)} stroke={wireOut} strokeWidth={1.65} />
          <line x1={trunkLX} y1={pinY(7)} x2={orLX + 10} y2={pinY(7)} stroke={wireOut} strokeWidth={1.65} />
          <line x1={orLX - 12} y1={pinY(7)} x2={bodyX} y2={pinY(7)} stroke={wireOut} strokeWidth={1.75} />
          {renderMiniGateInPackage('OR', orLX, pinY(7), 'left')}

          {/* MUX 2: 4 Decoded Product AND Gates (2C3..2C0) -> OR Gate -> 2Y(9) */}
          {mux2Rows.map(({ pin, selB, selA }) => {
            const py = pinY(pin);
            return (
              <g key={pin}>
                <path d={`M ${bodyRight} ${py} L ${bodyRight - 12} ${py} L ${bodyRight - 12} ${py - 6} L ${andRX + 13} ${py - 6}`} fill="none" stroke={wireIn} strokeWidth={1.45} />
                <line x1={xG2} y1={py - 2} x2={andRX + 13} y2={py - 2} stroke={wireIn} strokeWidth={1.15} />
                <circle cx={xG2} cy={py - 2} r={1.8} fill={wireIn} />
                <path d={`M ${selB} ${py + 14} L 390 ${py + 14} L 390 ${py + 2} L ${andRX + 13} ${py + 2}`} fill="none" stroke={wireInternal} strokeWidth={1.15} />
                <circle cx={selB} cy={py + 14} r={1.8} fill={wireInternal} />
                <path d={`M ${selA} ${py + 19} L 384 ${py + 19} L 384 ${py + 6} L ${andRX + 13} ${py + 6}`} fill="none" stroke={wireInternal} strokeWidth={1.15} />
                <circle cx={selA} cy={py + 19} r={1.8} fill={wireInternal} />
                <line x1={andRX - 11} y1={py} x2={trunkRX} y2={py} stroke={wireOut} strokeWidth={1.45} />
                {renderMiniGateInPackage('AND', andRX, py, 'left')}
              </g>
            );
          })}
          <line x1={trunkRX} y1={pinY(13)} x2={trunkRX} y2={pinY(9)} stroke={wireOut} strokeWidth={1.65} />
          <line x1={trunkRX} y1={pinY(9)} x2={orRX - 10} y2={pinY(9)} stroke={wireOut} strokeWidth={1.65} />
          <line x1={orRX + 12} y1={pinY(9)} x2={bodyRight} y2={pinY(9)} stroke={wireOut} strokeWidth={1.75} />
          {renderMiniGateInPackage('OR', orRX, pinY(9), 'right')}
        </g>
      );
    }

    // 14. 7483 4-Bit Binary Full Adder — Crisp 3-stage datasheet blocks with aligned orthogonal pin wiring
    if (p === '7483') {
      return renderArchStagePackage(
        [
          {
            heading: 'FA4 & FA3 ADDERS',
            subline: 'FA4(A4,B4,C3)->Σ4,C4 · FA3->Σ3',
            footer: 'XOR Half-Sum + Carry Propagate',
            y: topPad + 16,
            h: 196,
          },
          {
            heading: 'FAST LOOKAHEAD CARRY',
            subline: 'C0(13) -> Internal C1..C4',
            y: topPad + 224,
            h: 62,
          },
          {
            heading: 'FA2 & FA1 ADDERS',
            subline: 'FA2(A2,B2,C1)->Σ2 · FA1->Σ1',
            footer: 'Σ = A ⊕ B ⊕ C_in',
            y: topPad + 298,
            h: 158,
          },
        ],
        [
          { pin: 1, stageIdx: 0, role: 'in' },
          { pin: 2, stageIdx: 0, role: 'out' },
          { pin: 3, stageIdx: 0, role: 'in' },
          { pin: 4, stageIdx: 0, role: 'in' },
          { pin: 16, stageIdx: 0, role: 'in' },
          { pin: 15, stageIdx: 0, role: 'out' },
          { pin: 14, stageIdx: 0, role: 'out' },
          { pin: 13, stageIdx: 1, role: 'in' },
          { pin: 6, stageIdx: 2, role: 'out' },
          { pin: 7, stageIdx: 2, role: 'in' },
          { pin: 8, stageIdx: 2, role: 'in' },
          { pin: 11, stageIdx: 2, role: 'in' },
          { pin: 10, stageIdx: 2, role: 'in' },
          { pin: 9, stageIdx: 2, role: 'out' },
        ],
        half,
        bodyX,
        bodyRight,
        cx,
        pinY,
        true
      );
    }

    // 15. 74192 Presettable Decade Up/Down Counter — Structured datasheet stages with nested orthogonal routing
    if (p === '74192') {
      return renderArchStagePackage(
        [
          {
            heading: 'LOWER STAGES (FF-A, FF-B)',
            subline: 'A(15)->QA(3) · B(1)->QB(2)',
            footer: 'Sync Load + Async CLR(14)',
            y: topPad + 16,
            h: 144,
          },
          {
            heading: 'UP / DOWN & CARRY LOGIC',
            subline: 'UP(5), DOWN(4) -> Clock Steering',
            footer: 'Terminal ~BO(13) · ~CO(12)',
            y: topPad + 176,
            h: 108,
          },
          {
            heading: 'UPPER BCD (FF-C, FF-D)',
            subline: 'C(10)->QC(6) · D(9)->QD(7)',
            footer: 'Mod-10 BCD (0..9) · ~LOAD(11)',
            y: topPad + 300,
            h: 156,
          },
        ],
        [
          { pin: 1, stageIdx: 0, role: 'in' },
          { pin: 2, stageIdx: 0, role: 'out' },
          { pin: 3, stageIdx: 0, role: 'out' },
          { pin: 15, stageIdx: 0, role: 'in' },
          { pin: 14, stageIdx: 0, role: 'ctl' },
          { pin: 4, stageIdx: 1, role: 'ctl' },
          { pin: 5, stageIdx: 1, role: 'ctl' },
          { pin: 13, stageIdx: 1, role: 'out' },
          { pin: 12, stageIdx: 1, role: 'out' },
          { pin: 6, stageIdx: 2, role: 'out' },
          { pin: 7, stageIdx: 2, role: 'out' },
          { pin: 11, stageIdx: 2, role: 'ctl' },
          { pin: 10, stageIdx: 2, role: 'in' },
          { pin: 9, stageIdx: 2, role: 'in' },
        ],
        half,
        bodyX,
        bodyRight,
        cx,
        pinY,
        true
      );
    }

    // 16. 7485 4-Bit Magnitude Comparator — Datasheet Bitwise XNOR + Cascade Priority Tree
    if (p === '7485') {
      return renderArchStagePackage(
        [
          {
            heading: 'MSB EQUALITY (A3=B3, A2=B2)',
            subline: 'XNOR Bitwise Equality Comparators',
            y: topPad + 16,
            h: 120,
          },
          {
            heading: 'PRIORITY & CASCADE LOGIC',
            subline: 'IA<B(2), IA=B(3), IA>B(4)->OA..',
            footer: 'Combinational A>B / A=B / A<B',
            y: topPad + 154,
            h: 162,
          },
          {
            heading: 'LSB EQUALITY (A1=B1, A0=B0)',
            subline: 'XNOR Bitwise Equality Comparators',
            y: topPad + 334,
            h: 120,
          },
        ],
        [
          { pin: 1, stageIdx: 0, role: 'in' },
          { pin: 15, stageIdx: 0, role: 'in' },
          { pin: 14, stageIdx: 0, role: 'in' },
          { pin: 13, stageIdx: 0, role: 'in' },
          { pin: 2, stageIdx: 1, role: 'in' },
          { pin: 3, stageIdx: 1, role: 'in' },
          { pin: 4, stageIdx: 1, role: 'in' },
          { pin: 5, stageIdx: 1, role: 'out' },
          { pin: 6, stageIdx: 1, role: 'out' },
          { pin: 7, stageIdx: 1, role: 'out' },
          { pin: 12, stageIdx: 2, role: 'in' },
          { pin: 11, stageIdx: 2, role: 'in' },
          { pin: 10, stageIdx: 2, role: 'in' },
          { pin: 9, stageIdx: 2, role: 'in' },
        ],
        half,
        bodyX,
        bodyRight,
        cx,
        pinY,
        true
      );
    }

    // 17. 74148 8-to-3 Priority Encoder
    if (p === '74148') {
      return renderArchStagePackage(
        [
          {
            heading: 'HIGH PRIORITY (~I4..~I7)',
            subline: 'Enable ~EI(5) & High Requests',
            footer: 'Outputs ~GS(14), ~EO(15)',
            y: topPad + 16,
            h: 204,
          },
          {
            heading: 'PRIORITY & BINARY ENCODE',
            subline: '~I0(10)..~I3(13) Priority Mask',
            footer: 'Code Out ~A2(6), ~A1(7), ~A0(9)',
            y: topPad + 238,
            h: 216,
          },
        ],
        [
          { pin: 1, stageIdx: 0, role: 'in' },
          { pin: 2, stageIdx: 0, role: 'in' },
          { pin: 3, stageIdx: 0, role: 'in' },
          { pin: 4, stageIdx: 0, role: 'in' },
          { pin: 5, stageIdx: 0, role: 'ctl' },
          { pin: 15, stageIdx: 0, role: 'out' },
          { pin: 14, stageIdx: 0, role: 'out' },
          { pin: 13, stageIdx: 1, role: 'in' },
          { pin: 12, stageIdx: 1, role: 'in' },
          { pin: 11, stageIdx: 1, role: 'in' },
          { pin: 10, stageIdx: 1, role: 'in' },
          { pin: 9, stageIdx: 1, role: 'out' },
          { pin: 7, stageIdx: 1, role: 'out' },
          { pin: 6, stageIdx: 1, role: 'out' },
        ],
        half,
        bodyX,
        bodyRight,
        cx,
        pinY,
        true
      );
    }

    // 18. 74151 8-to-1 Data Multiplexer
    if (p === '74151') {
      return renderArchStagePackage(
        [
          {
            heading: 'DATA CHANNELS D0..D7',
            subline: 'D0(4)..D3(1), D4(15)..D7(12)',
            footer: '8× AND Product Steering Gates',
            y: topPad + 16,
            h: 196,
          },
          {
            heading: 'SELECT DECODE & OUTPUT',
            subline: 'Sel A(11), B(10), C(9) · ~G(7)',
            footer: 'OR -> Y(5) & Inverted ~W(6)',
            y: topPad + 230,
            h: 224,
          },
        ],
        [
          { pin: 1, stageIdx: 0, role: 'in' },
          { pin: 2, stageIdx: 0, role: 'in' },
          { pin: 3, stageIdx: 0, role: 'in' },
          { pin: 4, stageIdx: 0, role: 'in' },
          { pin: 15, stageIdx: 0, role: 'in' },
          { pin: 14, stageIdx: 0, role: 'in' },
          { pin: 13, stageIdx: 0, role: 'in' },
          { pin: 12, stageIdx: 0, role: 'in' },
          { pin: 5, stageIdx: 1, role: 'out' },
          { pin: 6, stageIdx: 1, role: 'out' },
          { pin: 7, stageIdx: 1, role: 'ctl' },
          { pin: 11, stageIdx: 1, role: 'in' },
          { pin: 10, stageIdx: 1, role: 'in' },
          { pin: 9, stageIdx: 1, role: 'in' },
        ],
        half,
        bodyX,
        bodyRight,
        cx,
        pinY,
        true
      );
    }

    // 19. 7446 & 7447 BCD-to-7-Segment Decoders / Drivers
    if (p === '7446' || p === '7447') {
      return renderArchStagePackage(
        [
          {
            heading: 'BCD INPUT & BLANKING',
            subline: 'BCD D(6), C(2), B(1), A(7)',
            footer: '~LT(3) · ~BI/~RBO(4) · ~RBI(5)',
            y: topPad + 16,
            h: 204,
          },
          {
            heading: '7-SEG DECODE DRIVERS',
            subline: 'NAND Matrix (0..9 + Symbols)',
            footer: 'Open-Collector Out ~a..~g',
            y: topPad + 238,
            h: 216,
          },
        ],
        [
          { pin: 1, stageIdx: 0, role: 'in' },
          { pin: 2, stageIdx: 0, role: 'in' },
          { pin: 3, stageIdx: 0, role: 'ctl' },
          { pin: 4, stageIdx: 0, role: 'ctl' },
          { pin: 5, stageIdx: 0, role: 'ctl' },
          { pin: 6, stageIdx: 0, role: 'in' },
          { pin: 7, stageIdx: 0, role: 'in' },
          { pin: 15, stageIdx: 1, role: 'out' },
          { pin: 14, stageIdx: 1, role: 'out' },
          { pin: 13, stageIdx: 1, role: 'out' },
          { pin: 12, stageIdx: 1, role: 'out' },
          { pin: 11, stageIdx: 1, role: 'out' },
          { pin: 10, stageIdx: 1, role: 'out' },
          { pin: 9, stageIdx: 1, role: 'out' },
        ],
        half,
        bodyX,
        bodyRight,
        cx,
        pinY,
        true
      );
    }

    // 20. 6116 2K × 8 Static CMOS RAM (DIP-24)
    if (p === '6116') {
      return renderArchStagePackage(
        [
          {
            heading: 'ADDRESS ROW/COL DECODERS',
            subline: 'A0..A10 -> 2,048 Byte Words',
            footer: 'Pins 1..8, 23, 22, 19',
            y: topPad + 12,
            h: 168,
          },
          {
            heading: '16K-BIT 6T CMOS MATRIX',
            subline: '128 × 128 Static Latch Array',
            footer: 'Cross-Coupled CMOS SRAM Cells',
            y: topPad + 198,
            h: 146,
          },
          {
            heading: 'BUS CONTROL & TRI-STATE',
            subline: '~CS(18), ~RE(20), ~WR(21)',
            footer: 'Bidirectional I/O0..I/O7',
            y: topPad + 362,
            h: 288,
          },
        ],
        [
          { pin: 1, stageIdx: 0, role: 'in' },
          { pin: 2, stageIdx: 0, role: 'in' },
          { pin: 3, stageIdx: 0, role: 'in' },
          { pin: 4, stageIdx: 0, role: 'in' },
          { pin: 5, stageIdx: 0, role: 'in' },
          { pin: 6, stageIdx: 0, role: 'in' },
          { pin: 7, stageIdx: 0, role: 'in' },
          { pin: 8, stageIdx: 0, role: 'in' },
          { pin: 23, stageIdx: 0, role: 'in' },
          { pin: 22, stageIdx: 0, role: 'in' },
          { pin: 19, stageIdx: 0, role: 'in' },
          { pin: 21, stageIdx: 2, role: 'ctl' },
          { pin: 20, stageIdx: 2, role: 'ctl' },
          { pin: 18, stageIdx: 2, role: 'ctl' },
          { pin: 9, stageIdx: 2, role: 'bidir' },
          { pin: 10, stageIdx: 2, role: 'bidir' },
          { pin: 11, stageIdx: 2, role: 'bidir' },
          { pin: 13, stageIdx: 2, role: 'bidir' },
          { pin: 14, stageIdx: 2, role: 'bidir' },
          { pin: 15, stageIdx: 2, role: 'bidir' },
          { pin: 16, stageIdx: 2, role: 'bidir' },
          { pin: 17, stageIdx: 2, role: 'bidir' },
        ],
        half,
        bodyX,
        bodyRight,
        cx,
        pinY,
        true
      );
    }

    return null;
  };

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      data-testid="package-pinout-svg"
      className="w-full h-full block"
    >
      {/* Top Package Header */}
      <text
        x={cx}
        y={17}
        textAnchor="middle"
        fill="#20252B"
        fontSize={10.4}
        fontWeight={700}
        fontFamily="IBM Plex Mono, monospace"
      >
        {ic.partNumber} ({ic.packageType}) — INTERNAL GATE &amp; PIN WIRING DIAGRAM
      </text>

      {/* DIP IC Molded Package Outline */}
      <rect
        x={bodyX}
        y={topPad}
        width={bodyW}
        height={bodyH}
        rx={5}
        fill="#F4F3EE"
        stroke="#20252B"
        strokeWidth={2.2}
      />

      {/* Inner Die Cavity Border */}
      <rect
        x={bodyX + 6}
        y={topPad + 6}
        width={bodyW - 12}
        height={bodyH - 12}
        rx={3}
        fill="none"
        stroke="#C9C9C3"
        strokeWidth={1}
        strokeDasharray="4 3"
      />

      {/* Top Pin-1 Orientation Half-Moon Notch */}
      <path
        d={`M ${cx - 18} ${topPad} A 18 18 0 0 0 ${cx + 18} ${topPad}`}
        fill="#DAD9D3"
        stroke="#20252B"
        strokeWidth={1.8}
      />
      <circle cx={bodyX + 16} cy={topPad + 14} r={3.5} fill="#20252B" />

      {/* Internal Gate / Flip-Flop / Architectural Stage Wiring */}
      {renderInternalGateWiring()}

      {/* Left & Right Numbered DIP Pin Boxes and Signal Labels */}
      {Array.from({ length: half }).map((_, idx) => {
        const leftPin = ic.pins.find((p) => p.pin === idx + 1)!;
        const rightPin = ic.pins.find((p) => p.pin === ic.pinCount - idx)!;
        const py = pinY(idx + 1);

        const leftIsActiveLow = leftPin.name.startsWith('~') || leftPin.name.includes('~');
        const rightIsActiveLow = rightPin.name.startsWith('~') || rightPin.name.includes('~');

        return (
          <g key={idx}>
            <rect
              x={bodyX - 24}
              y={py - 10}
              width={24}
              height={20}
              rx={2}
              fill="#E5E5E1"
              stroke="#20252B"
              strokeWidth={1.4}
            />
            <text
              x={bodyX - 12}
              y={py + 3.8}
              textAnchor="middle"
              fill="#20252B"
              fontSize={10.5}
              fontWeight={700}
              fontFamily="IBM Plex Mono, monospace"
            >
              {leftPin.pin}
            </text>
            {leftIsActiveLow && (
              <circle
                cx={bodyX + 4}
                cy={py}
                r={3}
                fill="#FFFFFF"
                stroke="#20252B"
                strokeWidth={1.3}
              />
            )}
            <text
              x={bodyX - 30}
              y={py + 3.8}
              textAnchor="end"
              fill={pinColor(leftPin.direction)}
              fontSize={10.5}
              fontWeight={700}
              fontFamily="IBM Plex Mono, monospace"
            >
              {leftPin.name}
            </text>

            <rect
              x={bodyRight}
              y={py - 10}
              width={24}
              height={20}
              rx={2}
              fill="#E5E5E1"
              stroke="#20252B"
              strokeWidth={1.4}
            />
            <text
              x={bodyRight + 12}
              y={py + 3.8}
              textAnchor="middle"
              fill="#20252B"
              fontSize={10.5}
              fontWeight={700}
              fontFamily="IBM Plex Mono, monospace"
            >
              {rightPin.pin}
            </text>
            {rightIsActiveLow && (
              <circle
                cx={bodyRight - 4}
                cy={py}
                r={3}
                fill="#FFFFFF"
                stroke="#20252B"
                strokeWidth={1.3}
              />
            )}
            <text
              x={bodyRight + 30}
              y={py + 3.8}
              textAnchor="start"
              fill={pinColor(rightPin.direction)}
              fontSize={10.5}
              fontWeight={700}
              fontFamily="IBM Plex Mono, monospace"
            >
              {rightPin.name}
            </text>
          </g>
        );
      })}

      {/* Bottom Legend Strip */}
      <text
        x={cx}
        y={svgH - 10}
        textAnchor="middle"
        fill="#555C62"
        fontSize={8.2}
        fontWeight={600}
        fontFamily="IBM Plex Mono, monospace"
      >
        Blue: Inputs/Controls · Green: Outputs/I/O · Red: Supply ({ic.supplyVoltage})
      </text>
    </svg>
  );
};

export const ICLibraryView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ICCategory | 'all'>('all');
  const [selectedPart, setSelectedPart] = useState('7400');

  const insertIC = useLabStore((s) => s.insertIC);
  const setPendingInsertIC = useLabStore((s) => s.setPendingInsertIC);
  const setActiveView = useLabStore((s) => s.setActiveView);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filtered = useMemo(() => filterICDefinitions(query, category), [query, category]);
  const selectedIC = getICDefinition(selectedPart) ?? filtered[0] ?? getICDefinition('7400')!;
  const zifCompat16 = canInsertIntoZif(selectedIC.partNumber, 'ZIF1');
  const zifCompat24 = canInsertIntoZif(selectedIC.partNumber, 'ZIF5');

  const categories: Array<{ id: ICCategory | 'all'; label: string }> = [
    { id: 'all', label: 'All (25)' },
    { id: 'logic-gates', label: 'Logic Gates (10)' },
    { id: 'combinational', label: 'Combinational (9)' },
    { id: 'sequential', label: 'Sequential (5)' },
    { id: 'memory', label: 'Memory (1)' },
  ];

  const handleDirectInsert = (socketId: 'ZIF1' | 'ZIF2' | 'ZIF3' | 'ZIF4' | 'ZIF5') => {
    const res = insertIC(selectedIC.partNumber, { kind: 'zif', socketId });
    if (res.ok) {
      setPendingInsertIC(null);
      setFeedback(null);
      setActiveView('workspace');
    } else {
      setFeedback(res.error ?? 'Cannot insert IC into socket.');
    }
  };

  return (
    <main className="flex-1 overflow-hidden bg-[#F1F0EB] text-[#20252B] flex flex-col lg:flex-row">
      {/* Left Catalog List */}
      <section className="w-full lg:w-88 border-b lg:border-b-0 lg:border-r border-[#C9C9C3] bg-[#E5E5E1] flex flex-col h-72 lg:h-full shrink-0">
        <div className="p-4 border-b border-[#C9C9C3] space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#747C82] absolute left-3 top-2.5" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 7400, 7447, 4077, 6116..."
              aria-label="Search IC library"
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-[#F1F0EB] border border-[#B8B8B1] rounded text-[#20252B] focus:outline-none focus:border-[#456A83]"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  category === cat.id
                    ? 'bg-[#20252B] text-[#F1F0EB]'
                    : 'bg-[#F1F0EB] text-[#555C62] hover:text-[#20252B]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#C9C9C3]">
          {filtered.map((ic) => {
            const active = ic.partNumber === selectedIC.partNumber;
            return (
              <button
                key={ic.partNumber}
                type="button"
                onClick={() => {
                  setSelectedPart(ic.partNumber);
                  setFeedback(null);
                }}
                className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                  active ? 'bg-[#303840] text-[#F1F0EB]' : 'hover:bg-[#DAD9D3] text-[#20252B]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold">{ic.partNumber}</span>
                  <span
                    className={`font-mono text-xs ${
                      active ? 'text-[#A5ACB2]' : 'text-[#747C82]'
                    }`}
                  >
                    {ic.family} · {ic.packageType}
                  </span>
                </div>
                <div
                  className={`text-xs mt-0.5 truncate ${
                    active ? 'text-[#D6D5CE]' : 'text-[#555C62]'
                  }`}
                >
                  {ic.name}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-6 text-center text-xs text-[#747C82]">
              No IC models match &quot;{query}&quot;.
            </div>
          )}
        </div>
      </section>

      {/* Right Datasheet & Pinout Detail */}
      <section className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#C9C9C3] pb-5">
            <div>
              <div className="text-xs font-mono text-[#747C82]">
                {CATEGORY_LABELS[selectedIC.category]} · {selectedIC.family} · {selectedIC.packageType}
              </div>
              <h1 className="text-2xl font-semibold text-[#20252B] mt-1">
                {selectedIC.partNumber} — {selectedIC.name}
              </h1>
              <p className="text-sm text-[#555C62] mt-1.5 max-w-2xl">{selectedIC.description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['ZIF1', 'ZIF2', 'ZIF3', 'ZIF4'] as const).map((sockId, idx) => (
                <button
                  key={sockId}
                  type="button"
                  disabled={!zifCompat16.ok}
                  onClick={() => handleDirectInsert(sockId)}
                  className="px-3 py-2 text-xs font-medium bg-[#303840] text-[#F1F0EB] rounded hover:bg-[#414B56] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Insert in ZIF-{idx + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={!zifCompat24.ok}
                onClick={() => handleDirectInsert('ZIF5')}
                className="px-3.5 py-2 text-xs font-medium bg-[#456A83] text-[#F1F0EB] rounded hover:bg-[#527B96] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Insert in ZIF-5 (24-Pin RAM)
              </button>
            </div>
          </div>

          {feedback && (
            <div className="p-3 bg-[#BD8B43]/15 border border-[#BD8B43] rounded text-xs text-[#20252B]">
              {feedback}
            </div>
          )}

          {/* Specs Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#E5E5E1] border border-[#C9C9C3] rounded p-3">
              <div className="text-xs text-[#747C82]">Package</div>
              <div className="text-sm font-mono font-semibold mt-0.5">{selectedIC.packageType}</div>
            </div>
            <div className="bg-[#E5E5E1] border border-[#C9C9C3] rounded p-3">
              <div className="text-xs text-[#747C82]">Supply Voltage</div>
              <div className="text-sm font-mono font-semibold mt-0.5">{selectedIC.supplyVoltage}</div>
            </div>
            <div className="bg-[#E5E5E1] border border-[#C9C9C3] rounded p-3">
              <div className="text-xs text-[#747C82]">Typ. Prop. Delay</div>
              <div className="text-sm font-mono font-semibold mt-0.5">{selectedIC.propagationDelayNs} ns</div>
            </div>
            <div className="bg-[#E5E5E1] border border-[#C9C9C3] rounded p-3">
              <div className="text-xs text-[#747C82]">Socket Fit</div>
              <div className="text-sm font-mono font-semibold mt-0.5">
                {zifCompat16.ok ? 'ZIF-1 .. ZIF-4 (16p)' : 'ZIF-5 (24-Pin RAM)'}
              </div>
            </div>
          </div>

          {/* Datasheet Summary */}
          <div className="bg-white border border-[#C9C9C3] rounded p-4 text-xs text-[#303840] space-y-1">
            <div className="font-semibold text-[#20252B]">Datasheet Reference</div>
            <div>{selectedIC.datasheetSummary}</div>
          </div>

          {/* Internal Gate-Level / Functional Block Structure Diagram (Preserved as requested) */}
          <div className="bg-white border border-[#C9C9C3] rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#20252B]">
                Datasheet Internal Logic &amp; Gate-Level Structure
              </h2>
              <span className="text-xs font-mono text-[#747C82]">
                IEEE/ANSI Functional Schematic
              </span>
            </div>
            <ICInternalDiagram ic={selectedIC} />
          </div>

          {/* Equal-Height Package Pinout (with Internal Gate/Cascaded Wiring) + Pin Configuration Table */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
            <div
              data-testid="package-pinout-card"
              className="xl:col-span-6 bg-white border border-[#C9C9C3] rounded p-4 flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-[#E5E5E1] pb-2.5 mb-3 shrink-0">
                <h2 className="text-sm font-semibold text-[#20252B]">
                  Package Pinout &amp; Internal Pin Wiring
                </h2>
                <span className="text-xs font-mono text-[#555C62]">
                  {selectedIC.partNumber} ({selectedIC.packageType})
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <DIPPinoutDiagram ic={selectedIC} />
              </div>
            </div>

            <div
              data-testid="pin-config-table-card"
              className="xl:col-span-6 bg-white border border-[#C9C9C3] rounded overflow-hidden flex flex-col"
            >
              <table className="w-full h-full text-left text-xs">
                <thead className="bg-[#E5E5E1] text-[#303840] border-b border-[#C9C9C3]">
                  <tr>
                    <th className="py-2.5 px-3 font-mono">Pin</th>
                    <th className="py-2.5 px-3 font-mono">Symbol</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Function</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E1]">
                  {selectedIC.pins.map((pin) => (
                    <tr key={pin.pin}>
                      <td className="py-2 px-3 font-mono font-semibold">{pin.pin}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-[#456A83]">
                        {pin.name}
                      </td>
                      <td className="py-2 px-3 font-mono text-[#747C82]">{pin.direction}</td>
                      <td className="py-2 px-3 text-[#303840]">{pin.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Truth Table Preview */}
          {selectedIC.truthTablePreview.length > 0 && (
            <div className="bg-white border border-[#C9C9C3] rounded p-4 space-y-2">
              <h2 className="text-sm font-semibold text-[#20252B]">Functional Truth Table Summary</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#C9C9C3] text-[#747C82]">
                      <th className="py-1.5 pr-4">Inputs</th>
                      <th className="py-1.5">Outputs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E1]">
                    {selectedIC.truthTablePreview.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 pr-4 text-[#20252B]">
                          {Object.entries(row.inputs)
                            .map(([k, v]) => `${k}=${v}`)
                            .join('  ')}
                        </td>
                        <td className="py-1.5 text-[#587965] font-semibold">
                          {Object.entries(row.outputs)
                            .map(([k, v]) => `${k}=${v}`)
                            .join('  ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};
