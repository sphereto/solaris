import { useEffect, useRef, useState, type ReactNode } from 'react';
import { type KeyTest, nasaKey, testNasaKey } from '../discover/nasa';
import { type Settings, settingsCore } from '../state/settingsCore';
import { clearSavedPictures, countSavedPictures } from '../state/savedData';
import { useSettings } from '../state/useSettings';

interface Props {
  onClose: () => void;
  onOpenCredits: () => void;
  /** True while a dialog is on top, so Esc belongs to it. */
  suspended: boolean;
}

const set = settingsCore.set;

function Toggle({ label, help, value, onChange }: { label: string; help: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="s-row">
      <div>
        <div className="s-lbl">{label}</div>
        <div className="s-help">{help}</div>
      </div>
      <button className={`s-tg${value ? ' on' : ''}`} role="switch" aria-checked={value} aria-label={label} onClick={() => onChange(!value)} />
    </div>
  );
}

function Choice<T extends string>({
  label,
  help,
  value,
  options,
  onChange,
}: {
  label: string;
  help?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="s-row s-col">
      <div>
        <div className="s-lbl">{label}</div>
        {help && <div className="s-help">{help}</div>}
      </div>
      <div className="s-seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="s-sec">{title}</h2>
      {children}
    </section>
  );
}

const KEY_PATTERN = /^[A-Za-z0-9_-]*$/;

/** Every setting in one scrolling page. Changes apply and save immediately. */
export function SettingsPage({ onClose, onOpenCredits, suspended }: Props) {
  const s = useSettings();
  const root = useRef<HTMLDivElement>(null);
  const [keyDraft, setKeyDraft] = useState(s.nasaKey);
  const [keyTest, setKeyTest] = useState<KeyTest | 'testing' | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>('.s-close')?.focus();
    return () => before?.focus?.();
  }, []);

  useEffect(() => {
    if (suspended) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, suspended]);

  useEffect(() => {
    countSavedPictures().then(setSaved);
  }, []);

  useEffect(() => {
    if (!confirmReset) return;
    const id = setTimeout(() => setConfirmReset(false), 3500);
    return () => clearTimeout(id);
  }, [confirmReset]);

  const keyValid = KEY_PATTERN.test(keyDraft.trim());
  const commitKey = () => {
    if (keyValid) set({ nasaKey: keyDraft.trim() });
  };
  const runKeyTest = async () => {
    if (keyValid) set({ nasaKey: keyDraft.trim() });
    setKeyTest('testing');
    setKeyTest(await testNasaKey(keyDraft.trim() || nasaKey()));
  };

  const on = <K extends keyof Settings>(key: K) => (value: Settings[K]) => set({ [key]: value } as Partial<Settings>);

  return (
    <div className="settings" role="region" aria-label="Settings" ref={root}>
      <div className="s-top">
        <button className="s-close" onClick={onClose} aria-label="Close settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="s-body">
        <h1>Settings</h1>

        <Section title="Look">
          <Toggle label="Atmosphere glow" help="A soft halo around Earth, Venus and Neptune" value={s.glow} onChange={on('glow')} />
          <Toggle label="Saturn's ring shadows" help="The rings and the planet shade each other" value={s.ringShadows} onChange={on('ringShadows')} />
          <Toggle label="Twinkling stars and Milky Way" help="An animated sky behind the planets" value={s.skyEffects} onChange={on('skyEffects')} />
          <Choice
            label="Planet labels"
            value={s.labels}
            onChange={on('labels')}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'tilt', label: 'When tilted' },
              { value: 'always', label: 'Always' },
            ]}
          />
          <Choice
            label="Graphics quality"
            help="Auto lowers detail if your phone struggles. Saver turns the extra effects off."
            value={s.quality}
            onChange={on('quality')}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'high', label: 'High' },
              { value: 'saver', label: 'Saver' },
            ]}
          />
        </Section>

        <Section title="Motion">
          <div className="s-row s-col">
            <div>
              <div className="s-lbl">Planet spin speed</div>
              <div className="s-help">How fast planets turn on screen</div>
            </div>
            <input type="range" min={0} max={100} step={5} value={s.spinSpeed} aria-label="Planet spin speed" onChange={(e) => set({ spinSpeed: Number(e.target.value) })} />
          </div>
          <Choice
            label="Dial speed"
            help="How many days one drag covers"
            value={s.dialSpeed}
            onChange={on('dialSpeed')}
            options={[
              { value: 'slow', label: 'Slow' },
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
            ]}
          />
          <Choice
            label="Start view"
            help="Where the camera begins"
            value={s.startView}
            onChange={on('startView')}
            options={[
              { value: 'overhead', label: 'Overhead' },
              { value: 'angled', label: 'Angled' },
              { value: 'low', label: 'Low' },
            ]}
          />
          <Toggle label="Tap empty space to tilt" help="Double-tap still returns overhead" value={s.tapToTilt} onChange={on('tapToTilt')} />
          <Choice
            label="Reduce motion"
            help="On stops animations. Off keeps the 3D view moving even if your phone asks for less."
            value={s.reduceMotion}
            onChange={on('reduceMotion')}
            options={[
              { value: 'auto', label: 'Follow phone' },
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Section>

        <Section title="Time">
          <Choice
            label="Date format"
            value={s.dateFormat}
            onChange={on('dateFormat')}
            options={[
              { value: 'mdy', label: 'MM/DD/YY' },
              { value: 'dmy', label: 'DD/MM/YY' },
              { value: 'iso', label: 'YYYY-MM-DD' },
            ]}
          />
          <Choice
            label="Clock"
            value={s.clock}
            onChange={on('clock')}
            options={[
              { value: '24', label: '24 hour' },
              { value: '12', label: '12 hour' },
            ]}
          />
        </Section>

        <Section title="NASA data">
          <div className="s-row s-col">
            <div>
              <label className="s-lbl" htmlFor="nasa-key">
                Your NASA key
              </label>
              <div className="s-help">Stays on this device. Without one, Solaris uses a shared key that runs out quickly.</div>
            </div>
            <div className="s-keyrow">
              <input
                id="nasa-key"
                className="s-field"
                type="password"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Paste your key"
                value={keyDraft}
                onChange={(e) => {
                  setKeyDraft(e.target.value);
                  setKeyTest(null);
                }}
                onBlur={commitKey}
                aria-invalid={!keyValid}
              />
              <button className="s-btn" onClick={runKeyTest} disabled={keyTest === 'testing' || !keyValid}>
                {keyTest === 'testing' ? 'Testing' : 'Test'}
              </button>
            </div>
            {!keyValid && <div className="s-note bad">Keys only use letters, numbers, dashes and underscores.</div>}
            {keyTest && keyTest !== 'testing' && (
              <div className={`s-note ${keyTest.state === 'ok' ? 'good' : keyTest.state === 'limited' ? '' : 'bad'}`} role="status">
                {keyTest.message}
              </div>
            )}
          </div>
          <Choice
            label="Units"
            help="For distances and sizes"
            value={s.units}
            onChange={on('units')}
            options={[
              { value: 'metric', label: 'Kilometres' },
              { value: 'miles', label: 'Miles' },
            ]}
          />
          <Toggle label="Save data" help="Smaller pictures, and no auto-playing Earth days" value={s.saveData} onChange={on('saveData')} />
          <div className="s-row">
            <div>
              <div className="s-lbl">Saved pictures</div>
              <div className="s-help">{saved === null ? 'Checking…' : saved === 0 ? 'Nothing saved yet' : `${saved} kept for offline use`}</div>
            </div>
            <button
              className="s-btn"
              disabled={!saved}
              onClick={async () => {
                await clearSavedPictures();
                setSaved(await countSavedPictures());
              }}
            >
              Clear
            </button>
          </div>
        </Section>

        <Section title="About">
          <button className="s-row s-link" onClick={onOpenCredits}>
            <span className="s-lbl">Credits and licences</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <div className="s-row">
            <span className="s-lbl">Version</span>
            <span className="s-help">{__APP_VERSION__}</span>
          </div>
          <button
            className="s-reset"
            onClick={() => {
              if (!confirmReset) return setConfirmReset(true);
              settingsCore.reset();
              setKeyDraft('');
              setKeyTest(null);
              setConfirmReset(false);
            }}
          >
            {confirmReset ? 'Tap again to reset everything' : 'Reset all settings'}
          </button>
          <p className="s-foot">Settings are saved on this device only.</p>
        </Section>
      </div>
    </div>
  );
}
