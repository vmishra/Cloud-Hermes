import { useState, type CSSProperties, type ReactNode } from 'react';

/**
 * The atom layer — shared presentational primitives in the Cloud Hermes design
 * language: the brand mark and wordmark, the operating-loop rail, status dots,
 * tags and severity badges, buttons, copyable code lines, resource glyphs, and
 * surface containers. Pure presentation, no state beyond a copy affordance.
 */

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

// ── Brand ───────────────────────────────────────────────────────────────
// A winged "H" — two ascending pillars and a lifting crossbar — inside a thin
// circle, with a single messenger dot at the apex.
export function HermesMark({
  size = 28,
  tone = 'ink',
  className,
}: {
  size?: number;
  tone?: 'ink' | 'accent' | 'inverse';
  className?: string;
}) {
  const color =
    tone === 'accent' ? 'var(--accent)' : tone === 'inverse' ? 'var(--bg)' : 'var(--ink)';
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke={color} strokeWidth="1" />
      <rect x="13.5" y="11" width="1.6" height="18" fill={color} />
      <rect x="24.9" y="11" width="1.6" height="18" fill={color} />
      <rect
        x="13.5"
        y="19.2"
        width="13"
        height="1.6"
        fill={color}
        transform="rotate(-12 20 20)"
      />
      <circle cx="32" cy="9" r="1.6" fill={color} />
    </svg>
  );
}

export function Wordmark({
  size = 22,
  showMark = true,
  tone = 'ink',
}: {
  size?: number;
  showMark?: boolean;
  tone?: 'ink' | 'accent' | 'inverse';
}) {
  const color =
    tone === 'accent' ? 'var(--accent)' : tone === 'inverse' ? 'var(--bg)' : 'var(--ink)';
  return (
    <span className="inline-flex items-center gap-2.5">
      {showMark && <HermesMark size={size + 4} tone={tone} />}
      <span className="display leading-none" style={{ fontSize: size, color }}>
        Cloud Hermes
      </span>
    </span>
  );
}

// ── Operating-loop rail ─────────────────────────────────────────────────
export type LoopStage = 'observe' | 'plan' | 'execute' | 'learn';

const LOOP_STAGES: { id: LoopStage; label: string; hint: string }[] = [
  { id: 'observe', label: 'Observe', hint: 'Sync state' },
  { id: 'plan', label: 'Plan', hint: 'Clarify · skills' },
  { id: 'execute', label: 'Execute', hint: 'Validate · run' },
  { id: 'learn', label: 'Learn', hint: 'Memory' },
];

export function LoopRail({
  stage,
  compact = false,
  animated = true,
}: {
  stage: LoopStage;
  compact?: boolean;
  animated?: boolean;
}) {
  const activeIndex = LOOP_STAGES.findIndex((entry) => entry.id === stage);
  return (
    <div className="flex items-center" style={{ gap: compact ? 6 : 10 }}>
      {LOOP_STAGES.map((entry, index) => {
        const active = index === activeIndex;
        const done = index < activeIndex;
        return (
          <div key={entry.id} className="flex items-center" style={{ gap: compact ? 6 : 10 }}>
            <div className="flex items-center gap-1.5">
              <span
                className="shrink-0 rounded-full"
                style={{
                  width: 7,
                  height: 7,
                  background: active
                    ? 'var(--accent)'
                    : done
                      ? 'var(--ink-3)'
                      : 'var(--ink-5)',
                  boxShadow: active ? '0 0 0 3px var(--accent-soft)' : 'none',
                }}
              />
              <span
                className="eyebrow"
                style={{
                  color: active ? 'var(--ink)' : done ? 'var(--ink-3)' : 'var(--ink-4)',
                  letterSpacing: '0.18em',
                }}
              >
                {entry.label}
              </span>
            </div>
            {index < LOOP_STAGES.length - 1 && (
              <svg width={compact ? 18 : 24} height={6} aria-hidden="true">
                <line
                  x1="0"
                  y1="3"
                  x2={compact ? 18 : 24}
                  y2="3"
                  stroke={index < activeIndex ? 'var(--ink-3)' : 'var(--hairline)'}
                  strokeWidth="1"
                  className={index === activeIndex && animated ? 'flow-dash' : ''}
                />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Status atoms ────────────────────────────────────────────────────────
const TONE_COLOR: Record<Tone, string> = {
  neutral: 'var(--ink-4)',
  accent: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
};

export function StatusDot({
  tone = 'neutral',
  pulse = false,
  size = 7,
}: {
  tone?: Tone;
  pulse?: boolean;
  size?: number;
}) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: TONE_COLOR[tone] }}
      />
      {pulse && (
        <span
          className="pulse-ring absolute inset-0 rounded-full"
          style={{ background: TONE_COLOR[tone], opacity: 0.4 }}
        />
      )}
    </span>
  );
}

export function Tag({
  children,
  tone = 'neutral',
  mono = false,
}: {
  children: ReactNode;
  tone?: Tone;
  mono?: boolean;
}) {
  const palette: Record<Tone, { fg: string; bg: string; bd: string }> = {
    neutral: { fg: 'var(--ink-2)', bg: 'var(--elev-2)', bd: 'var(--hairline)' },
    accent: { fg: 'var(--accent)', bg: 'var(--accent-soft)', bd: 'var(--accent-line)' },
    success: { fg: 'var(--success)', bg: 'var(--success-soft)', bd: 'var(--success)' },
    warning: { fg: 'var(--warning)', bg: 'var(--warning-soft)', bd: 'var(--warning)' },
    danger: { fg: 'var(--danger)', bg: 'var(--danger-soft)', bd: 'var(--danger)' },
    info: { fg: 'var(--info)', bg: 'var(--info-soft)', bd: 'var(--info)' },
  };
  const t = palette[tone];
  return (
    <span
      className={mono ? 'mono' : ''}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '1px 6px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 500,
        textTransform: mono ? 'none' : 'uppercase',
        letterSpacing: mono ? '0' : '0.1em',
        color: t.fg,
        background: t.bg,
        boxShadow: `inset 0 0 0 1px ${t.bd}`,
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  );
}

const SEVERITY_TONE: Record<string, Tone> = {
  READ: 'neutral',
  CREATE: 'accent',
  UPDATE: 'warning',
  DELETE: 'danger',
  BLOCKED: 'danger',
  info: 'info',
  advisory: 'neutral',
  warning: 'warning',
};

export function Severity({ kind }: { kind: string }) {
  return <Tag tone={SEVERITY_TONE[kind] ?? 'neutral'}>{kind}</Tag>;
}

// ── Buttons ─────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg';

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: 'bg-accent text-accent-ink border border-transparent',
  secondary: 'bg-surface text-ink border border-border',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-elev-1',
  quiet: 'bg-elev-1 text-ink-2 border border-hairline hover:border-border-strong',
  danger: 'bg-danger-soft text-danger border border-danger',
};

const BTN_SIZE: Record<BtnSize, string> = {
  sm: 'h-6 px-2 text-[11px] gap-1.5',
  md: 'h-7 px-2.5 text-[12px] gap-1.5',
  lg: 'h-8 px-3.5 text-[13px] gap-2',
};

export function Btn({
  children,
  variant = 'ghost',
  size = 'md',
  icon,
  onClick,
  disabled = false,
  title,
  type = 'button',
  className = '',
  style,
}: {
  children: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={style}
      className={`inline-flex items-center justify-center rounded-[var(--radius-2)] font-medium transition-[filter,background-color,border-color] duration-150 hover:brightness-[1.03] active:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${className}`}
    >
      {icon !== undefined && <span className="inline-flex">{icon}</span>}
      {children}
    </button>
  );
}

// ── Copyable mono code line ─────────────────────────────────────────────
export function CodeLine({
  children,
  copyable = false,
  prefix,
}: {
  children: string;
  copyable?: boolean;
  prefix?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mono flex items-center gap-2 rounded-[var(--radius-2)] border border-code-border bg-code-bg px-2.5 py-1.5 text-[12px]">
      {prefix !== undefined && <span className="select-none text-ink-4">{prefix}</span>}
      <span className="flex-1 overflow-x-auto whitespace-nowrap text-ink">{children}</span>
      {copyable && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="eyebrow shrink-0 border-0 bg-transparent p-0"
          style={{ color: copied ? 'var(--success)' : 'var(--ink-4)', cursor: 'pointer' }}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      )}
    </div>
  );
}

// ── Resource glyph — a lightweight abstract marker ──────────────────────
export function ResourceGlyph({
  kind,
  size = 14,
  color = 'currentColor',
}: {
  kind: string;
  size?: number;
  color?: string;
}) {
  const s = size;
  const c = s / 2;
  switch (kind) {
    case 'network':
    case 'vpc':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
          <rect x="1" y="1" width={s - 2} height={s - 2} fill="none" stroke={color} strokeWidth="1" rx="2" />
          <rect x="4" y="4" width={s - 8} height={s - 8} fill={color} opacity="0.18" />
        </svg>
      );
    case 'subnet':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
          <rect x="1" y="3.5" width={s - 2} height={s - 7} fill="none" stroke={color} strokeWidth="1" rx="1" />
          <line x1="4" y1={c} x2={s - 4} y2={c} stroke={color} strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      );
    case 'instance':
    case 'vm':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
          <rect x="2" y="3" width={s - 4} height={s - 6} fill={color} opacity="0.18" stroke={color} strokeWidth="1" rx="1.5" />
          <line x1="4" y1={s - 1} x2={s - 4} y2={s - 1} stroke={color} strokeWidth="1" />
        </svg>
      );
    case 'firewall-rule':
    case 'firewall':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
          <path
            d={`M${c} 1.5 L${s - 2} 4 L${s - 2} ${c} Q${s - 2} ${s - 2} ${c} ${s - 1.5} Q2 ${s - 2} 2 ${c} L2 4 Z`}
            fill={color}
            opacity="0.18"
            stroke={color}
            strokeWidth="1"
          />
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
          <circle cx={c} cy={c} r={c - 1.5} fill="none" stroke={color} strokeWidth="1" />
        </svg>
      );
  }
}

// ── Surface container ───────────────────────────────────────────────────
export function Surface({
  children,
  raised = false,
  className = '',
}: {
  children: ReactNode;
  raised?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--radius-4)] border border-hairline ${raised ? 'bg-surface' : 'bg-elev-1'} ${className}`}
    >
      {children}
    </div>
  );
}

// ── Section header ──────────────────────────────────────────────────────
export function SectionHead({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <div>
        {eyebrow !== undefined && <div className="eyebrow mb-0.5">{eyebrow}</div>}
        <div className="text-[13px] font-medium text-ink">{title}</div>
      </div>
      {right}
    </div>
  );
}

// ── Key / value readout ─────────────────────────────────────────────────
export function KeyVal({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2.5 text-[12px]">
      <span className="min-w-22 text-ink-4">{k}</span>
      <span className={`text-ink ${mono ? 'mono' : ''}`}>{v}</span>
    </div>
  );
}
