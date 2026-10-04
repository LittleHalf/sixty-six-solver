import { DEFAULT_RULES, RULE_DESCRIPTIONS, withRules, type Rules } from '../engine/index.ts';
import { Switch } from './Widgets.tsx';

interface Props {
  rules: Partial<Rules>;
  onChange: (rules: Partial<Rules>) => void;
}

export function RulesPanel({ rules, onChange }: Props) {
  const current = withRules(rules);
  const changed = Object.keys(rules).length > 0;

  function set(key: keyof Rules, value: unknown) {
    const next: Record<string, unknown> = { ...rules };
    if (value === DEFAULT_RULES[key]) delete next[key];
    else next[key] = value;
    onChange(next as Partial<Rules>);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Rules</h2>
        {changed && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange({})}>
            Reset to defaults
          </button>
        )}
      </div>
      <div className="panel-body rules-list">
        {RULE_DESCRIPTIONS.map((d) => {
          const value = current[d.key];
          const isDefault = !(d.key in rules);
          return (
            <div key={d.key} className={`rule${isDefault ? '' : ' is-changed'}`}>
              <div className="rule-text">
                <span className="rule-label">{d.label}</span>
                <span className="rule-help">{d.help}</span>
              </div>
              <div className="rule-control">
                {d.kind === 'boolean' && (
                  <Switch checked={value as boolean} onChange={(v) => set(d.key, v)} label="" />
                )}
                {d.kind === 'number' && (
                  <input
                    type="number"
                    className="input input-num"
                    min={0}
                    value={value as number}
                    onChange={(e) => set(d.key, Math.max(0, Number(e.target.value) || 0))}
                  />
                )}
                {d.kind === 'choice' && (
                  <select className="input" value={String(value)} onChange={(e) => set(d.key, e.target.value)}>
                    {d.choices?.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
