import React, { useState, useRef, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, Bytes, getDocFromServer, getDocs, query, where } from 'firebase/firestore';
import { Employee } from '../types';
import { getPhotoUrl } from '../lib/firebaseUtils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
import {
  Plus,
  User,
  Briefcase,
  Building,
  Hash,
  Droplets,
  Phone,
  Calendar,
  MapPin,
  Camera,
  Upload,
  X,
  ShieldCheck,
  CheckCircle2,
  Map,
  Globe,
  Save,
  ArrowLeft,
  Edit2
} from 'lucide-react';

import { motion } from 'motion/react';

import { ImageEditor } from './ImageEditor';
import { AnimatePresence } from 'motion/react';

interface EmployeeFormProps {
  onSuccess: () => void;
  editingEmployee?: Employee | null;
  onCancel?: () => void;
  settings?: any;
  cccId?: string;
  assignedAgency?: string;
  canEditIssueNumber?: boolean;
}

export function EmployeeForm({ onSuccess, editingEmployee, onCancel, settings, cccId, assignedAgency, canEditIssueNumber = false }: EmployeeFormProps) {
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(editingEmployee?.photoUrl ? getPhotoUrl(editingEmployee.photoUrl) || null : null);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const [agencyNames, setAgencyNames] = useState<string[]>([]);
  const [agencyOptionsError, setAgencyOptionsError] = useState('');
  const [issueNumberError, setIssueNumberError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cccId || assignedAgency) {
      setAgencyNames([]);
      setAgencyOptionsError('');
      return;
    }
    let active = true;
    setAgencyOptionsError('');
    void getDocs(query(collection(db, 'cccAgencies'), where('cccId', '==', cccId))).then(snapshot => {
      if (!active) return;
      const names = snapshot.docs.flatMap(agencyDoc => {
        const savedNames = agencyDoc.data().agencyNames;
        return Array.isArray(savedNames)
          ? savedNames.filter((name: unknown): name is string => typeof name === 'string').map((name: string) => name.trim()).filter(Boolean)
          : [];
      });
      setAgencyNames([...new Set(names)]);
    }).catch(error => {
      console.error('Could not load agency options for employee form:', error);
      if (active) setAgencyOptionsError('Could not load agency options. Check Firestore access or ask an Admin to manage agency profiles.');
    });
    return () => { active = false; };
  }, [cccId, assignedAgency]);

  const [formData, setFormData] = useState({
    name: editingEmployee?.name || '',
    address: editingEmployee?.address || '',
    designation: editingEmployee?.designation || 'AGENCY STAFF',
    agencyName: editingEmployee?.agencyName || '',
    cccName: editingEmployee?.cccName ?? (settings?.cccName !== undefined ? settings.cccName : 'Falakata Customer Care Center, Falakata, Alipurduar'),
    officePhone: editingEmployee?.officePhone ?? (settings?.officePhone !== undefined ? settings.officePhone : '9332789274'),
    officeEmail: editingEmployee?.officeEmail ?? (settings?.officeEmail !== undefined ? settings.officeEmail : 'sm.falakata@wbsedcl.in'),
    issuingAuthority: editingEmployee?.issuingAuthority ?? (settings?.issuingAuthority !== undefined ? settings.issuingAuthority : 'Asst. Engg & Station Manager\nFalakata CCC, WBSEDCL'),
    emergencyTag: editingEmployee?.emergencyTag ?? (settings?.emergencyTag !== undefined ? settings.emergencyTag : 'ON EMERGENCY DUTY'),
    bloodGroup: editingEmployee?.bloodGroup || '',
    contactNumber: editingEmployee?.contactNumber || '',
    photoUrl: editingEmployee?.photoUrl || '',
    validityRanges: editingEmployee?.validityRanges || '',
    validUntil: editingEmployee?.validUntil || '',
    workingArea: editingEmployee?.workingArea || 'FALAKATA CCC',
    issueNo: editingEmployee?.issueNo || settings?.cardSettings?.defaultIssueNo || '',
    uidNo: editingEmployee?.uidNo || '',
    issueDate: editingEmployee?.issueDate || new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        } else if (error instanceof Error && error.message.includes('permission')) {
          // This is expected if rules are not yet updated for 'test' collection
          console.log("Firestore connection test: Permission denied (expected if rules not updated)");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    if (editingEmployee) {
      setFormData({
        name: editingEmployee.name,
        address: editingEmployee.address || '',
        designation: editingEmployee.designation,
        agencyName: editingEmployee.agencyName,
        cccName: editingEmployee.cccName ?? (settings?.cccName !== undefined ? settings.cccName : 'Falakata Customer Care Center, Falakata, Alipurduar'),
        officePhone: editingEmployee.officePhone ?? (settings?.officePhone !== undefined ? settings.officePhone : '9332789274'),
        officeEmail: editingEmployee.officeEmail ?? (settings?.officeEmail !== undefined ? settings.officeEmail : 'sm.falakata@wbsedcl.in'),
        issuingAuthority: editingEmployee.issuingAuthority ?? (settings?.issuingAuthority !== undefined ? settings.issuingAuthority : 'Asst. Engg & Station Manager\nFalakata CCC, WBSEDCL'),
        emergencyTag: editingEmployee.emergencyTag ?? (settings?.emergencyTag !== undefined ? settings.emergencyTag : 'ON EMERGENCY DUTY'),
        bloodGroup: editingEmployee.bloodGroup || '',
        contactNumber: editingEmployee.contactNumber || '',
        photoUrl: editingEmployee.photoUrl || '',
        validityRanges: editingEmployee.validityRanges || '',
        validUntil: editingEmployee.validUntil || '',
        workingArea: editingEmployee.workingArea || 'FALAKATA CCC',
        issueNo: editingEmployee.issueNo || settings?.cardSettings?.defaultIssueNo || '',
        uidNo: editingEmployee.uidNo || '',
        issueDate: editingEmployee.issueDate || new Date().toISOString().split('T')[0],
      });
      setPhotoPreview(getPhotoUrl(editingEmployee.photoUrl) || null);
    }
  }, [editingEmployee]);

  useEffect(() => {
    if (!editingEmployee && !canEditIssueNumber) {
      setFormData(current => ({
        ...current,
        issueNo: current.issueNo || settings?.cardSettings?.defaultIssueNo || ''
      }));
    }
  }, [canEditIssueNumber, editingEmployee, settings?.cardSettings?.defaultIssueNo]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setOriginalPhoto(base64String);
        setIsEditingPhoto(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEditedImage = (editedImage: string) => {
    setPhotoPreview(editedImage);
    setIsEditingPhoto(false);

    // Convert base64 to Bytes for Firestore
    const base64Data = editedImage.split(',')[1];
    const bytes = Bytes.fromBase64String(base64Data);
    setFormData(prev => ({ ...prev, photoUrl: bytes as any }));
  };

  const removePhoto = () => {
    setPhotoPreview(null);
    setFormData(prev => ({ ...prev, photoUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const issueNo = canEditIssueNumber
      ? formData.issueNo
      : editingEmployee?.issueNo || settings?.cardSettings?.defaultIssueNo || '';
    if (!issueNo.trim()) {
      setIssueNumberError(canEditIssueNumber
        ? 'Enter an issue number or configure the default from Card Design.'
        : 'Ask an Admin to configure the default issue number before creating employee cards.');
      return;
    }
    setIssueNumberError('');
    setLoading(true);
    try {
      if (editingEmployee?.id) {
        const employeeRef = doc(db, 'employees', editingEmployee.id);
        try {
          await updateDoc(employeeRef, {
            ...formData,
            issueNo,
            cardSettings: editingEmployee.cardSettings ?? settings?.cardSettings,
            agencyName: assignedAgency || formData.agencyName,
            cccId: editingEmployee.cccId || cccId || settings?.cccName || '',
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `employees/${editingEmployee.id}`);
        }
      } else {
        try {
          await addDoc(collection(db, 'employees'), {
            ...formData,
            issueNo,
            cardSettings: settings?.cardSettings,
            agencyName: assignedAgency || formData.agencyName,
            cccId: cccId || settings?.cccName || '',
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.uid,
            creatorEmail: auth.currentUser.email,
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'employees');
        }
      }

      if (!editingEmployee) {
        setFormData({
          name: '',
          address: '',
          designation: 'AGENCY STAFF',
          agencyName: '',
          cccName: settings?.cccName !== undefined ? settings.cccName : 'Falakata Customer Care Center, Falakata, Alipurduar',
          officePhone: settings?.officePhone !== undefined ? settings.officePhone : '9332789274',
          officeEmail: settings?.officeEmail !== undefined ? settings.officeEmail : 'sm.falakata@wbsedcl.in',
          issuingAuthority: settings?.issuingAuthority !== undefined ? settings.issuingAuthority : 'Asst. Engg & Station Manager\nFalakata CCC, WBSEDCL',
          emergencyTag: settings?.emergencyTag !== undefined ? settings.emergencyTag : 'ON EMERGENCY DUTY',
          bloodGroup: '',
          contactNumber: '',
          photoUrl: '',
          validityRanges: '',
          validUntil: '',
          workingArea: 'FALAKATA CCC',
          issueNo: settings?.cardSettings?.defaultIssueNo || '',
          uidNo: '',
          issueDate: new Date().toISOString().split('T')[0],
        });
        setPhotoPreview(null);
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving employee:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'issueNo') setIssueNumberError('');
  };

  return (
    <>
      <AnimatePresence>
        {isEditingPhoto && originalPhoto && (
          <ImageEditor
            image={originalPhoto}
            onSave={handleSaveEditedImage}
            onCancel={() => setIsEditingPhoto(false)}
          />
        )}
      </AnimatePresence>

      <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="bg-form p-6 md:p-10 rounded-[32px] md:rounded-[48px] shadow-2xl shadow-indigo-500/5 space-y-8 md:space-y-10 max-w-5xl mx-auto relative overflow-hidden"
    >
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-4 md:gap-5">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl md:rounded-2xl text-white flex items-center justify-center shadow-xl shadow-indigo-500/20">
            {editingEmployee ? <Save size={24} className="md:hidden" /> : <Plus size={24} className="md:hidden" />}
            {editingEmployee ? <Save size={28} className="hidden md:block" /> : <Plus size={28} className="hidden md:block" />}
          </div>
          <div>
            <h2 id="employee-edit-dialog-title" className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">
              {editingEmployee ? 'Edit Personnel' : 'Register Personnel'}
            </h2>
            <p className="text-slate-400 text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] mt-1 md:mt-1.5">Emergency Duty ID System</p>
          </div>
        </div>

        {editingEmployee && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-slate-100 text-slate-600 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black hover:bg-slate-200 transition-all"
          >
            <ArrowLeft size={14} className="md:hidden" />
            <ArrowLeft size={16} className="hidden md:block" />
            Close editor
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 relative z-10">
        {/* Photo Upload Section */}
        <div className="lg:col-span-4 flex flex-col items-center">
          <div className="relative group w-full max-w-[200px] md:max-w-[240px]">
            <div className={`aspect-[3/4] rounded-[24px] md:rounded-[32px] border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center overflow-hidden bg-slate-50/50 ${photoPreview ? 'border-indigo-500 shadow-2xl shadow-indigo-500/10' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`}>
              {photoPreview ? (
                <div className="relative w-full h-full group">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOriginalPhoto(photoPreview);
                          setIsEditingPhoto(true);
                        }}
                        className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl hover:bg-indigo-700 transition-all hover:scale-110"
                      >
                        <Edit2 size={24} />
                      </button>
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="p-3 bg-red-500 text-white rounded-2xl shadow-xl hover:bg-red-600 transition-all hover:scale-110"
                      >
                        <X size={24} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-slate-400 p-6 text-center">
                  <div className="w-20 h-20 bg-white rounded-[24px] shadow-sm flex items-center justify-center border border-slate-100 group-hover:scale-110 transition-transform duration-500">
                    <Camera size={36} className="text-slate-300" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Upload Photo</p>
                    <p className="text-[10px] font-medium text-slate-400">Drag & drop or click to browse</p>
                  </div>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center gap-4">
            {photoPreview && (
              <button
                type="button"
                onClick={() => {
                  setOriginalPhoto(photoPreview);
                  setIsEditingPhoto(true);
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
              >
                <Edit2 size={14} />
                Edit Photo
              </button>
            )}
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-center">Passport Size (3:4 ratio)</p>
            <div className="h-1 w-12 bg-slate-100 rounded-full"></div>
            <p className="text-[10px] text-slate-300 font-medium">Max File Size: 500KB</p>
          </div>
        </div>

        {/* Form Fields Section */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
          <InputGroup icon={<User size={18} />} label="Full Name" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. Rahul Sharma" />
          <InputGroup icon={<Droplets size={18} />} label="Blood Group" name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} placeholder="e.g. B+ Positive" />

          <div className="md:col-span-2">
            <InputGroup icon={<MapPin size={18} />} label="Residential Address" name="address" value={formData.address} onChange={handleChange} placeholder="Village, P.O, District, PIN Code" />
          </div>

          <InputGroup icon={<Briefcase size={18} />} label="Designation" name="designation" value={formData.designation} onChange={handleChange} required placeholder="AGENCY STAFF" />
          {assignedAgency ? (
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                <span className="text-indigo-400"><Building size={18} /></span>Assigned Agency
              </label>
              <input value={assignedAgency} readOnly className="w-full px-6 py-4 bg-slate-100 border border-slate-200 rounded-[20px] text-sm font-bold text-slate-600" />
            </div>
          ) : (
            <div className="space-y-3">
              <label htmlFor="employee-agency-name" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                <span className="text-indigo-400"><Building size={18} /></span>Agency Name
              </label>
              <select
                id="employee-agency-name"
                name="agencyName"
                value={formData.agencyName}
                onChange={handleChange}
                required
                className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[20px] text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="" disabled>Select an agency</option>
                {formData.agencyName && !agencyNames.includes(formData.agencyName) && (
                  <option value={formData.agencyName}>{formData.agencyName} (current record)</option>
                )}
                {agencyNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              {agencyOptionsError
                ? <p role="alert" className="text-xs font-semibold text-red-700">{agencyOptionsError}</p>
                : agencyNames.length === 0 && <p className="text-xs font-semibold text-amber-700">Add an agency from Agency Profiles or User Creation first.</p>}
            </div>
          )}
          
          <InputGroup icon={<Phone size={18} />} label="Contact Number" name="contactNumber" value={formData.contactNumber} onChange={handleChange} placeholder="10-digit mobile number" />

          <InputGroup icon={<MapPin size={18} />} label="Working Area" name="workingArea" value={formData.workingArea} onChange={handleChange} placeholder="FALAKATA CCC" />

          <InputGroup icon={<Hash size={18} />} label="Issue Number" name="issueNo" value={formData.issueNo} onChange={handleChange} placeholder="Set by Admin" readOnly={!canEditIssueNumber} />
          {issueNumberError && <p role="alert" className="md:col-span-2 -mt-4 text-xs font-bold text-red-700">{issueNumberError}</p>}
          <InputGroup icon={<Hash size={18} />} label="UID Number (record only; not printed)" name="uidNo" value={formData.uidNo} onChange={handleChange} placeholder="Enter UID number" />
          <InputGroup icon={<Calendar size={18} />} label="Issue Date" name="issueDate" type="date" value={formData.issueDate} onChange={handleChange} />
          <InputGroup icon={<Calendar size={18} />} label="Valid Until" name="validUntil" type="date" value={formData.validUntil} onChange={handleChange} />

          {/* Card Header Customization (Fixed Data) */}
          <div className="md:col-span-2 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-6 mt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                <ShieldCheck size={18} />
              </div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Card Header & Purpose (Fixed for this Card)</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Building size={12} /> CCC Name / Header
                </label>
                <input
                  type="text"
                  value={formData.cccName}
                  onChange={(e) => setFormData({ ...formData, cccName: e.target.value })}
                  className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm transition-all"
                  placeholder="e.g. Falakata CCC"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 size={12} /> Card Purpose / Tag
                </label>
                <input
                  type="text"
                  value={formData.emergencyTag}
                  onChange={(e) => setFormData({ ...formData, emergencyTag: e.target.value })}
                  className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm transition-all"
                  placeholder="e.g. ON EMERGENCY DUTY"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Phone size={12} /> Office Phone
                </label>
                <input
                  type="text"
                  value={formData.officePhone}
                  onChange={(e) => setFormData({ ...formData, officePhone: e.target.value })}
                  className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Globe size={12} /> Office Email
                </label>
                <input
                  type="text"
                  value={formData.officeEmail}
                  onChange={(e) => setFormData({ ...formData, officeEmail: e.target.value })}
                  className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm transition-all"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Edit2 size={12} /> Issuing Authority
                </label>
                <textarea
                  value={formData.issuingAuthority}
                  onChange={(e) => setFormData({ ...formData, issuingAuthority: e.target.value })}
                  className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm transition-all min-h-[80px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-10 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">

        <button
          type="submit"
          disabled={loading}
          className="w-full md:w-auto min-w-[280px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black py-5 px-10 rounded-[24px] shadow-2xl shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 uppercase tracking-[0.2em] text-sm"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Processing...
            </>
          ) : (
            <>             Submit
            </>
          )}
        </button>
      </div>
      </motion.form>
    </>
  );
}

function InputGroup({ icon, label, name, value, onChange, required, placeholder, type = 'text', readOnly = false }: any) {
  return (
    <div className="space-y-3 group">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3 group-focus-within:text-indigo-600 transition-colors">
        <span className="text-indigo-400 group-focus-within:text-indigo-600 transition-colors">{icon}</span>
        {label} {required && <span className="text-pink-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full px-6 py-4 bg-slate-50/50 border border-slate-200 rounded-[20px] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold placeholder:text-slate-300 read-only:bg-slate-100 read-only:text-slate-500"
      />
    </div>
  );
}
