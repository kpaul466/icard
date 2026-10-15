import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CardSettingsEditor } from './CardSettingsEditor';
import { CardSettings, defaultCardSettings, mergeCardSettings } from '../lib/cardSettings';

interface CardDesignSettingsProps {
  isSuperuser: boolean;
  assignedCcc: string;
  cccOptions: string[];
}

export function CardDesignSettings({ isSuperuser, assignedCcc, cccOptions }: CardDesignSettingsProps) {
  const [selectedCcc, setSelectedCcc] = useState(assignedCcc);
  const [cardSettings, setCardSettings] = useState<CardSettings>(defaultCardSettings);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => setSelectedCcc(assignedCcc), [assignedCcc]);

  useEffect(() => {
    setCardSettings(defaultCardSettings);
    setLoadError('');
    if (!selectedCcc) return;
    const settingsRef = doc(db, 'cccCardSettings', selectedCcc);
    return onSnapshot(settingsRef, snapshot => {
      setCardSettings(mergeCardSettings(snapshot.data()?.cardSettings));
    }, error => {
      console.error('CCC card settings could not be loaded:', error);
      setLoadError(error.message);
    });
  }, [selectedCcc]);

  const saveDefaults = async (nextSettings: CardSettings) => {
    if (!selectedCcc) throw new Error('Select a CCC before saving card defaults.');
    setSaving(true);
    try {
      await setDoc(doc(db, 'cccCardSettings', selectedCcc), {
        cccId: selectedCcc,
        cardSettings: nextSettings,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-form p-6 md:p-10 rounded-[32px] md:rounded-[48px] shadow-xl border border-slate-100">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">Default ID Card Settings</h2>
          <p className="mt-1 text-sm text-slate-500">Defaults apply to users who do not have a personal card layout.</p>
        </div>
        {isSuperuser && (
          <select value={cccOptions.includes(selectedCcc) ? selectedCcc : ''} onChange={event => setSelectedCcc(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">
            <option value="" disabled>Select CCC</option>
            {cccOptions.map(ccc => <option key={ccc} value={ccc}>{ccc}</option>)}
          </select>
        )}
      </div>
      {loadError && <p role="alert" className="mb-4 text-sm font-bold text-red-700">Could not load card defaults: {loadError}</p>}
      <CardSettingsEditor initialSettings={cardSettings} onSave={saveDefaults} saving={saving} />
    </section>
  );
}
