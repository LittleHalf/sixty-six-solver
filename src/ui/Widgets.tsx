interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  prominent?: boolean;
  title?: string;
}

export function Switch({ checked, onChange, label, prominent, title }: SwitchProps) {
  return (
    <label className={`switch${prominent ? ' switch-prominent' : ''}${checked ? ' is-on' : ''}`} title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span className="switch-label">{label}</span>
    </label>
  );
}

interface SegmentedProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  small?: boolean;
}

export function Segmented<T extends string | number>({ value, options, onChange, ariaLabel, small }: SegmentedProps<T>) {
  return (
    <div className={`seg${small ? ' seg-sm' : ''}`} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          className={`seg-btn${o.value === value ? ' is-active' : ''}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
