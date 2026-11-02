import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { formatDayMonth, formatRupees, todayInIndia } from '../lib/format';
import { useT } from '../lib/i18n';

const DAY = 86_400_000;

/** Days since 1970 on India's calendar. */
function indiaDay(iso: string): number {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso));
  return Math.floor(Date.parse(`${ymd}T00:00:00Z`) / DAY);
}

/** The Monday a day falls in: 1 January 1970 was a Thursday. */
const mondayOf = (day: number) => day - ((day + 3) % 7);

/** A round top for the axis: 1, 2, 2.5 or 5 times a power of ten. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= value) return step * power;
  return 10 * power;
}

/** A bar with a 4px round top and a square foot on the baseline. */
function barPath(x: number, y: number, width: number, base: number): string {
  const r = Math.min(4, width / 2, base - y);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${base}Z`;
}

const H = 200;
const PAD = { left: 44, right: 8, top: 14, bottom: 28 };

/**
 * What a driver was paid in each of the last weeks, one bar a week, the current week last.
 * One series, so no legend: the title names it. Every value is also in the table below it.
 */
export function WeeklyPayoutChart({ payouts, weeks = 8 }: { payouts: { amount: number; createdAt: string }[]; weeks?: number }) {
  const t = useT();
  const [hovered, setHovered] = useState<number | null>(null);
  // Drawn in real pixels at whatever width it has, so its text stays the same size on every screen.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const thisWeek = mondayOf(indiaDay(`${todayInIndia()}T12:00:00Z`));
  const starts = Array.from({ length: weeks }, (_, i) => thisWeek - 7 * (weeks - 1 - i));
  const totals = starts.map((start) =>
    payouts.filter((payout) => mondayOf(indiaDay(payout.createdAt)) === start).reduce((sum, payout) => sum + payout.amount, 0),
  );
  const top = niceCeiling(Math.max(...totals));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / weeks;
  const barW = Math.min(24, band * 0.55);
  const base = PAD.top + plotH;
  const yOf = (value: number) => base - (value / top) * plotH;
  const ticks = [0, top / 2, top];
  // On a narrow screen every other week is named, so the dates never run into each other.
  const labelEvery = band < 46 ? 2 : 1;
  const weekLabel = (start: number) => t('Week of {date}', { date: formatDayMonth(new Date(start * DAY).toISOString()) });

  return (
    <figure className="relative">
      <figcaption className="text-sm font-semibold text-slate-900">{t('Paid to you each week (₹)')}</figcaption>
      <div ref={box} className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="overflow-visible" role="group" aria-label={t('Paid to you each week (₹)')}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yOf(tick)} y2={yOf(tick)} className="stroke-slate-200" strokeWidth={1} />
              <text x={PAD.left - 8} y={yOf(tick)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px] tabular-nums">
                {Math.round(tick).toLocaleString('en-IN')}
              </text>
            </g>
          ))}
          {starts.map((start, i) => {
            const x = PAD.left + band * i + (band - barW) / 2;
            const value = totals[i];
            return (
              <g key={start}>
                {value > 0 && (
                  <motion.path
                    d={barPath(x, yOf(value), barW, base)}
                    className="fill-teal-600 transition-opacity duration-150"
                    style={{ transformBox: 'fill-box', transformOrigin: 'bottom', opacity: hovered === null || hovered === i ? 1 : 0.45 }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 26, delay: i * 0.04 }}
                  />
                )}
                {(weeks - 1 - i) % labelEvery === 0 && (
                  <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
                    {formatDayMonth(new Date(start * DAY).toISOString())}
                  </text>
                )}
                {/* The hit target is the whole column, wider and taller than the bar. */}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${weekLabel(start)}: ${formatRupees(value)}`}
                  className="cursor-default outline-none"
                  onPointerEnter={() => setHovered(i)}
                  onPointerLeave={() => setHovered(null)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                />
              </g>
            );
          })}
        </svg>
        {hovered !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full animate-fade-in whitespace-nowrap rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-canvas shadow-float"
            style={{
              left: `${((PAD.left + band * hovered + band / 2) / W) * 100}%`,
              top: `${(Math.min(yOf(totals[hovered]), base - 8) / H) * 100}%`,
              marginTop: -8,
            }}
          >
            <span className="block font-semibold">{weekLabel(starts[hovered])}</span>
            <span className="tabular-nums">{formatRupees(totals[hovered])}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
