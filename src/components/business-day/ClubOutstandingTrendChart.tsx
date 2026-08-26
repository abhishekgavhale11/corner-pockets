"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  formatBusinessDayDate,
  formatBusinessDayDateShort,
} from "@/lib/business-day/format";
import { formatCurrency } from "@/lib/utils/format";
import type { OutstandingMovementPointDTO } from "@/types";

interface ClubOutstandingTrendChartProps {
  series: OutstandingMovementPointDTO[];
}

const PLOT_HEIGHT = 188;
const Y_AXIS_WIDTH = 46;
const PAD_TOP = 14;
const PAD_RIGHT = 18;
const PAD_BOTTOM = 34;
const MIN_SLOT = 64;

function chartDate(date: string): Date {
  return new Date(`${date}T12:00:00+05:30`);
}

function niceCeiling(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function formatAxisAmount(value: number): string {
  if (value >= 100000) {
    const lakhs = value / 100000;
    const label = Number.isInteger(lakhs) ? String(lakhs) : lakhs.toFixed(1);
    return `₹${label}L`;
  }
  if (value >= 1000) {
    return `₹${Math.round(value / 1000)}k`;
  }
  return formatCurrency(value);
}

export function ClubOutstandingTrendChart({
  series,
}: ClubOutstandingTrendChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setContainerWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const lastIndex = Math.max(series.length - 1, 0);
  const activeIndex = hoveredIndex ?? lastIndex;
  const active = series[activeIndex];

  const maxValue = niceCeiling(
    Math.max(...series.map((point) => point.closingOutstanding), 0)
  );
  const availableWidth = Math.max(containerWidth, 320) - Y_AXIS_WIDTH - PAD_RIGHT;
  const slotWidth =
    series.length > 1
      ? Math.max(MIN_SLOT, Math.floor(availableWidth / (series.length - 1)))
      : Math.max(MIN_SLOT, availableWidth);
  const plotWidth = Math.max(
    availableWidth,
    series.length > 1 ? (series.length - 1) * slotWidth : slotWidth
  );
  const svgWidth = Y_AXIS_WIDTH + plotWidth + PAD_RIGHT;
  const innerHeight = PLOT_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const yAt = (value: number) =>
    PAD_TOP + innerHeight - (value / maxValue) * innerHeight;
  const xAt = (index: number) =>
    Y_AXIS_WIDTH + (series.length === 1 ? plotWidth / 2 : index * slotWidth);

  const coords = series.map((point, index) => ({
    x: xAt(index),
    y: yAt(point.closingOutstanding),
  }));
  const linePoints = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: maxValue * ratio,
    y: yAt(maxValue * ratio),
  }));
  const labelStep = Math.max(
    1,
    Math.ceil(series.length / Math.max(4, Math.floor(plotWidth / 72)))
  );

  function setActiveFromClientX(clientX: number) {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = svgWidth / Math.max(rect.width, 1);
    const x = (clientX - rect.left) * scale;
    let nearest = 0;
    let best = Infinity;
    coords.forEach((coord, index) => {
      const distance = Math.abs(coord.x - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setHoveredIndex(nearest);
  }

  const activeCoord = coords[activeIndex];
  const tooltipLeft = activeCoord
    ? Math.min(Math.max(activeCoord.x - 80, 8), Math.max(svgWidth - 168, 8))
    : 8;
  const tooltipTop = activeCoord ? Math.max(activeCoord.y - 72, 8) : 8;

  function pointLabel(point: OutstandingMovementPointDTO): string {
    return point.isToday ? "Today" : formatBusinessDayDateShort(chartDate(point.date));
  }

  function pointTitle(point: OutstandingMovementPointDTO): string {
    return point.isToday
      ? "Today"
      : formatBusinessDayDate(chartDate(point.date));
  }

  return (
    <div ref={containerRef}>
      <div className="overflow-x-auto">
        <div className="relative" style={{ width: svgWidth }}>
          <svg
            width={svgWidth}
            height={PLOT_HEIGHT}
            viewBox={`0 0 ${svgWidth} ${PLOT_HEIGHT}`}
            className="block cursor-crosshair"
            role="img"
            aria-label="Daily running Club Outstanding balance"
            onPointerMove={(event) => {
              if (event.pointerType === "mouse") {
                setActiveFromClientX(event.clientX);
              }
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setHoveredIndex(null);
            }}
            onPointerDown={(event) => setActiveFromClientX(event.clientX)}
          >
            <defs>
              <linearGradient
                id={`cot-fill-${gradientId}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={Y_AXIS_WIDTH}
                  x2={svgWidth - PAD_RIGHT}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <text
                  x={Y_AXIS_WIDTH - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="fill-gray-400"
                  fontSize="10"
                >
                  {formatAxisAmount(tick.value)}
                </text>
              </g>
            ))}

            {coords.length > 1 ? (
              <polygon
                points={`${coords[0].x},${yAt(0)} ${linePoints} ${coords[coords.length - 1].x},${yAt(0)}`}
                fill={`url(#cot-fill-${gradientId})`}
              />
            ) : null}

            {coords.length > 1 ? (
              <polyline
                points={linePoints}
                fill="none"
                stroke="#ea580c"
                strokeWidth="2.25"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}

            {series.map((point, index) => {
              const showLabel =
                index === 0 ||
                index === series.length - 1 ||
                index % labelStep === 0;
              const coord = coords[index];
              const isActive = activeIndex === index;
              return (
                <g key={point.date}>
                  <rect
                    x={coord.x - slotWidth / 2}
                    y={PAD_TOP}
                    width={slotWidth}
                    height={innerHeight}
                    fill="transparent"
                  />
                  {isActive ? (
                    <line
                      x1={coord.x}
                      x2={coord.x}
                      y1={PAD_TOP}
                      y2={PAD_TOP + innerHeight}
                      stroke="#fdba74"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  ) : null}
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r={isActive ? 5.5 : 4.25}
                    fill={point.isToday ? "#fff" : "#ea580c"}
                    stroke="#c2410c"
                    strokeWidth="1.75"
                  />
                  {showLabel ? (
                    <text
                      x={coord.x}
                      y={PLOT_HEIGHT - 10}
                      textAnchor="middle"
                      className="fill-gray-500"
                      fontSize="10"
                      fontWeight={point.isToday ? 600 : 400}
                    >
                      {pointLabel(point)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {hoveredIndex != null && active ? (
            <div
              className="pointer-events-none absolute z-10 hidden w-[180px] rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg shadow-gray-900/10 sm:block"
              style={{ left: tooltipLeft, top: tooltipTop }}
            >
              <p className="text-[11px] font-semibold text-gray-900">
                {pointTitle(active)}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500">
                Closing balance for this date
              </p>
              <p className="mt-1 text-[13px] font-bold tabular-nums text-orange-800">
                {formatCurrency(active.closingOutstanding)}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {active ? (
        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5 sm:hidden">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-semibold text-gray-900">
              {pointTitle(active)}
            </p>
            <p className="text-[15px] font-bold tabular-nums text-orange-800">
              {formatCurrency(active.closingOutstanding)}
            </p>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Closing balance for this date
          </p>
        </div>
      ) : null}
    </div>
  );
}
