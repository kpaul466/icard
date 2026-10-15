import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { IDCard } from './IDCard';
import { Employee } from '../types';
import { CardSettings, mergeCardSettings } from '../lib/cardSettings';

interface CardSettingsEditorProps {
  initialSettings?: unknown;
  onSave: (settings: CardSettings) => Promise<void>;
  onSaveAsDefault?: (settings: CardSettings) => Promise<void>;
  saving?: boolean;
}

const previewEmployee: Employee = {
  name: 'EMPLOYEE NAME',
  designation: 'AGENCY STAFF',
  agencyName: 'AGENCY NAME',
  createdAt: null,
  createdBy: '',
  issueNo: 'Issue number',
  issueDate: '2026-01-01',
  validUntil: '2027-01-01',
  address: 'Falakata, Alipurduar',
  contactNumber: '9000000000',
  bloodGroup: 'O+',
  workingArea: 'FALAKATA CCC'
};

type FontSettingKey = 'headerLine1FontSize' | 'headerLine2FontSize' | 'headerLine3FontSize' |
  'contactFontSize' | 'emergencyFontSize' | 'employeeNameFontSize' | 'issuingAuthorityFontSize';

const fontSettings: { key: FontSettingKey; label: string }[] = [
  { key: 'headerLine1FontSize', label: 'Header line 1 font size' },
  { key: 'headerLine2FontSize', label: 'Header line 2 font size' },
  { key: 'headerLine3FontSize', label: 'Header line 3 font size' },
  { key: 'contactFontSize', label: 'Phone/email font size' },
  { key: 'emergencyFontSize', label: 'Emergency banner font size' },
  { key: 'employeeNameFontSize', label: 'Employee name font size' },
  { key: 'issuingAuthorityFontSize', label: 'Issuing authority font size' }
];

export function CardSettingsEditor({ initialSettings, onSave, onSaveAsDefault, saving = false }: CardSettingsEditorProps) {
  const [settings, setSettings] = useState<CardSettings>(() => mergeCardSettings(initialSettings));
  const [error, setError] = useState('');

  useEffect(() => setSettings(mergeCardSettings(initialSettings)), [initialSettings]);

  const update = <K extends keyof CardSettings>(key: K, value: CardSettings[K]) => {
    setSettings(current => ({ ...current, [key]: value }));
  };

  const save = async (saveAsDefault: boolean) => {
    setError('');
    try {
      if (saveAsDefault && onSaveAsDefault) await onSaveAsDefault(settings);
      else await onSave(settings);
    } catch (saveError) {
      console.error('Card settings could not be saved:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save card settings.');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_370px] gap-6">
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            ['headerLine1', 'Header line 1'],
            ['headerLine2', 'Header line 2'],
            ['headerLine3', 'Header line 3 (use {{cccName}} for the assigned CCC)']
          ] as const).map(([key, label]) => (
            <label key={key} className="md:col-span-2 text-xs font-black text-slate-500">
              {label}
              <input value={settings[key]} onChange={event => update(key, event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800" />
            </label>
          ))}
          <label className="text-xs font-black text-slate-500">
            Default issue number
            <input value={settings.defaultIssueNo} onChange={event => update('defaultIssueNo', event.target.value)} placeholder="e.g. FKT/CCC/2026/001" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800" />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fontSettings.map(({ key, label }) => (
            <label key={key} className="text-xs font-black text-slate-500">
              {label} ({settings[key]}px)
              <input type="range" min="4" max="20" step="1" value={settings[key]} onChange={event => update(key, Number(event.target.value))} className="mt-3 block w-full accent-indigo-600" />
            </label>
          ))}
          {([
            ['headerBackground', 'Header background'],
            ['emergencyBackground', 'Emergency banner background']
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600">
              {label}
              <input type="color" value={settings[key]} onChange={event => update(key, event.target.value)} className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent" />
            </label>
          ))}
        </div>
        {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={saving} onClick={() => void save(false)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
            <Save size={16} />{saving ? 'Saving...' : 'Save settings'}
          </button>
          {onSaveAsDefault && (
            <button type="button" disabled={saving} onClick={() => void save(true)} className="rounded-xl bg-indigo-50 px-5 py-3 text-sm font-black text-indigo-700 disabled:opacity-50">
              Save as CCC default
            </button>
          )}
        </div>
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-4 text-sm font-black text-slate-800">Live ID card preview</h3>
        <div className="origin-top-left scale-[0.92] sm:scale-100">
          <IDCard
            employee={{ ...previewEmployee, issueNo: settings.defaultIssueNo || previewEmployee.issueNo }}
            settings={{
              cccName: 'Preview CCC',
              officePhone: '9000000000',
              officeEmail: 'office@example.com',
              emergencyTag: 'ON EMERGENCY DUTY',
              issuingAuthority: 'Issuing Authority\nPreview Office',
              cardSettings: settings
            }}
          />
        </div>
        <p className="mt-4 text-xs text-slate-500">The preview updates as you edit. Office contact and authority text come from the assigned profile or CCC settings.</p>
      </aside>
    </div>
  );
}
