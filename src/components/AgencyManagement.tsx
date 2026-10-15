import { useEffect, useState } from 'react';
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { Building2, Plus, X } from 'lucide-react';
import { db } from '../firebase';

interface AgencyProfile {
  id: string;
  cccId: string;
  agencyName: string;
  address?: string;
  phone?: string;
  email?: string;
  enlistmentNo?: string;
  vendorCode?: string;
}

interface AgencyManagementProps {
  isSuperuser: boolean;
  assignedCcc: string;
  cccOptions: string[];
}

const emptyProfile = {
  agencyName: '',
  address: '',
  phone: '',
  email: '',
  enlistmentNo: '',
  vendorCode: ''
};

export function AgencyManagement({ isSuperuser, assignedCcc, cccOptions }: AgencyManagementProps) {
  const [selectedCcc, setSelectedCcc] = useState(assignedCcc);
  const [agencies, setAgencies] = useState<AgencyProfile[]>([]);
  const [loadingAgencies, setLoadingAgencies] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingAgency, setEditingAgency] = useState<AgencyProfile | null>(null);
  const [formData, setFormData] = useState(emptyProfile);

  useEffect(() => {
    setSelectedCcc(assignedCcc);
  }, [assignedCcc]);

  useEffect(() => {
    setAgencies([]);
    setLoadError('');
    if (!selectedCcc) return;

    let active = true;
    setLoadingAgencies(true);
    const agencyQuery = query(collection(db, 'agencies'), where('cccId', '==', selectedCcc));
    void getDocs(agencyQuery).then(snapshot => {
      if (!active) return;
      setAgencies(snapshot.docs.map(agencyDoc => ({
        id: agencyDoc.id,
        ...agencyDoc.data()
      } as AgencyProfile)).sort((a, b) => a.agencyName.localeCompare(b.agencyName)));
    }).catch(error => {
      console.error('Agency profiles could not be loaded:', error);
      if (active) {
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : '';
        setLoadError(code === 'permission-denied'
          ? 'Firestore denied access to agency profiles. Deploy the current rules with: npx firebase-tools deploy --only firestore:rules --project icard-8ec36'
          : error instanceof Error ? error.message : 'Could not load agency profiles.');
      }
    }).finally(() => {
      if (active) setLoadingAgencies(false);
    });
    return () => { active = false; };
  }, [selectedCcc]);

  const openCreateForm = () => {
    setEditingAgency(null);
    setFormData(emptyProfile);
    setSaveError('');
    setIsFormOpen(true);
  };

  const openEditForm = (agency: AgencyProfile) => {
    setEditingAgency(agency);
    setFormData({
      agencyName: agency.agencyName || '',
      address: agency.address || '',
      phone: agency.phone || '',
      email: agency.email || '',
      enlistmentNo: agency.enlistmentNo || '',
      vendorCode: agency.vendorCode || ''
    });
    setSaveError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingAgency(null);
    setFormData(emptyProfile);
    setSaveError('');
  };

  const saveAgency = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const agencyName = formData.agencyName.trim();
    if (!agencyName) {
      setSaveError('Agency name is required.');
      return;
    }
    if (!selectedCcc) {
      setSaveError('Select a CCC before saving the agency profile.');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const normalizedName = agencyName.toLocaleLowerCase();
      const duplicate = agencies.find(agency =>
        agency.agencyName.trim().toLocaleLowerCase() === normalizedName &&
        agency.id !== editingAgency?.id
      );
      if (duplicate) {
        setSaveError('An agency with this name already exists for the selected CCC.');
        return;
      }

      if (editingAgency && agencyName !== editingAgency.agencyName) {
        const [employeeRecords, legacyEmployeeRecords, userProfiles] = await Promise.all([
          getDocs(query(collection(db, 'employees'), where('cccId', '==', selectedCcc), where('agencyName', '==', editingAgency.agencyName))),
          getDocs(query(collection(db, 'employees'), where('cccName', '==', selectedCcc), where('agencyName', '==', editingAgency.agencyName))),
          getDocs(query(collection(db, 'users'), where('cccId', '==', selectedCcc), where('agencyName', '==', editingAgency.agencyName)))
        ]);
        if (!employeeRecords.empty || !legacyEmployeeRecords.empty || !userProfiles.empty) {
          setSaveError('This agency name is assigned to employee records or Editors. Keep the name unchanged to preserve those assignments.');
          return;
        }
      }

      const agencyCollection = collection(db, 'agencies');
      const agencyRef = editingAgency ? doc(db, 'agencies', editingAgency.id) : doc(agencyCollection);
      const registryQuery = query(collection(db, 'cccAgencies'), where('cccId', '==', selectedCcc));
      const registrySnapshot = await getDocs(registryQuery);
      const registryDoc = registrySnapshot.docs[0];
      const registryData = registryDoc?.data() || {};
      const currentNames = Array.isArray(registryData.agencyNames)
        ? registryData.agencyNames.filter((name: unknown): name is string => typeof name === 'string')
        : [];
      const oldName = editingAgency?.agencyName;
      const agencyNames = [...new Set([
        ...currentNames.filter(name => name !== oldName),
        agencyName
      ])];
      const registryRef = registryDoc
        ? doc(db, 'cccAgencies', registryDoc.id)
        : doc(db, 'cccAgencies', encodeURIComponent(selectedCcc));
      const batch = writeBatch(db);
      batch.set(agencyRef, {
        ...formData,
        agencyName,
        cccId: selectedCcc,
        updatedAt: serverTimestamp(),
        ...(!editingAgency ? { createdAt: serverTimestamp() } : {})
      }, { merge: true });
      batch.set(registryRef, {
        ...registryData,
        cccId: selectedCcc,
        agencyNames
      }, { merge: true });
      await batch.commit();

      setAgencies(current => {
        const nextAgency = { id: agencyRef.id, ...formData, agencyName, cccId: selectedCcc };
        const updated = editingAgency
          ? current.map(agency => agency.id === editingAgency.id ? nextAgency : agency)
          : [...current, nextAgency];
        return updated.sort((a, b) => a.agencyName.localeCompare(b.agencyName));
      });
      closeForm();
    } catch (error) {
      console.error('Agency profile could not be saved:', error);
      setSaveError(error instanceof Error ? error.message : 'Could not save the agency profile.');
    } finally {
      setSaving(false);
    }
  };

  const removeAgencyProfile = async (agency: AgencyProfile) => {
    setLoadError('');
    try {
      const [employeeRecords, legacyEmployeeRecords, userProfiles] = await Promise.all([
        getDocs(query(collection(db, 'employees'), where('cccId', '==', selectedCcc), where('agencyName', '==', agency.agencyName))),
        getDocs(query(collection(db, 'employees'), where('cccName', '==', selectedCcc), where('agencyName', '==', agency.agencyName))),
        getDocs(query(collection(db, 'users'), where('cccId', '==', selectedCcc), where('agencyName', '==', agency.agencyName)))
      ]);
      if (!employeeRecords.empty || !legacyEmployeeRecords.empty || !userProfiles.empty) {
        setLoadError('This agency is assigned to employees or Editors and cannot be removed.');
        return;
      }
      if (!window.confirm(`Delete the profile for ${agency.agencyName}?`)) return;

      const registryQuery = query(collection(db, 'cccAgencies'), where('cccId', '==', selectedCcc));
      const registrySnapshot = await getDocs(registryQuery);
      const registryDoc = registrySnapshot.docs[0];
      const currentNames = Array.isArray(registryDoc?.data().agencyNames)
        ? registryDoc.data().agencyNames.filter((name: unknown): name is string => typeof name === 'string')
        : [];
      const batch = writeBatch(db);
      batch.delete(doc(db, 'agencies', agency.id));
      if (registryDoc) {
        batch.set(doc(db, 'cccAgencies', registryDoc.id), {
          ...registryDoc.data(),
          agencyNames: currentNames.filter(name => name !== agency.agencyName)
        });
      }
      await batch.commit();
      setAgencies(current => current.filter(item => item.id !== agency.id));
      setLoadError('');
    } catch (error) {
      console.error('Agency profile could not be deleted:', error);
      setLoadError(error instanceof Error ? error.message : 'Could not delete the agency profile.');
    }
  };

  return (
    <section className="bg-form p-6 md:p-10 rounded-[32px] md:rounded-[48px] shadow-xl border border-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">Agency Profiles</h2>
          <p className="mt-1 text-sm text-slate-500">Maintain company details used across this CCC.</p>
        </div>
        <div className="flex gap-2">
          {isSuperuser && (
            <select value={cccOptions.includes(selectedCcc) ? selectedCcc : ''} onChange={event => setSelectedCcc(event.target.value)} className="min-w-0 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm">
              <option value="" disabled>Select CCC</option>
              {cccOptions.map(ccc => <option key={ccc} value={ccc}>{ccc}</option>)}
            </select>
          )}
          <button type="button" onClick={openCreateForm} disabled={!selectedCcc} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-50">
            <Plus size={17} />Add agency
          </button>
        </div>
      </div>

      {loadError && <p role="alert" className="mt-4 text-sm font-bold text-red-700">{loadError}</p>}
      {loadingAgencies ? (
        <p className="py-12 text-center text-sm font-semibold text-slate-500">Loading agency profiles...</p>
      ) : loadError ? (
        <p className="py-8 text-center text-sm font-semibold text-slate-500">Agency profiles are unavailable until Firestore access is restored.</p>
      ) : agencies.length === 0 ? (
        <div className="py-12 text-center">
          <Building2 size={32} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-500">No agency profiles for this CCC yet.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agencies.map(agency => (
            <article key={agency.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 break-words">{agency.agencyName}</h3>
                  {agency.address && <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{agency.address}</p>}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                    {agency.phone && <p>Phone: {agency.phone}</p>}
                    {agency.email && <p>Email: {agency.email}</p>}
                    {agency.enlistmentNo && <p>Enlistment No: {agency.enlistmentNo}</p>}
                    {agency.vendorCode && <p>Vendor Code: {agency.vendorCode}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => openEditForm(agency)} className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">Edit</button>
                  <button type="button" onClick={() => void removeAgencyProfile(agency)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700">Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
          <button type="button" className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={closeForm} aria-label="Close agency profile form" />
          <section role="dialog" aria-modal="true" aria-labelledby="agency-profile-title" className="relative z-10 w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-[32px] bg-form p-6 md:p-10 shadow-2xl">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h3 id="agency-profile-title" className="text-xl font-black text-slate-900">{editingAgency ? 'Update agency profile' : 'Create agency profile'}</h3>
              <button type="button" onClick={closeForm} aria-label="Close" className="rounded-xl bg-slate-100 p-2 text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={event => void saveAgency(event)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="sm:col-span-2 text-xs font-black text-slate-500">Agency name <span className="text-red-600">*</span>
                <input required value={formData.agencyName} onChange={event => setFormData({ ...formData, agencyName: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800" />
              </label>
              <label className="sm:col-span-2 text-xs font-black text-slate-500">Address
                <textarea value={formData.address} onChange={event => setFormData({ ...formData, address: event.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800" />
              </label>
              <label className="text-xs font-black text-slate-500">Phone number
                <input type="tel" value={formData.phone} onChange={event => setFormData({ ...formData, phone: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800" />
              </label>
              <label className="text-xs font-black text-slate-500">Email ID
                <input type="email" value={formData.email} onChange={event => setFormData({ ...formData, email: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800" />
              </label>
              <label className="text-xs font-black text-slate-500">Enlistment number
                <input value={formData.enlistmentNo} onChange={event => setFormData({ ...formData, enlistmentNo: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800" />
              </label>
              <label className="text-xs font-black text-slate-500">Vendor code
                <input value={formData.vendorCode} onChange={event => setFormData({ ...formData, vendorCode: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800" />
              </label>
              {saveError && <p role="alert" className="sm:col-span-2 text-sm font-bold text-red-700">{saveError}</p>}
              <div className="sm:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={closeForm} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? 'Saving...' : editingAgency ? 'Save changes' : 'Create agency'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
