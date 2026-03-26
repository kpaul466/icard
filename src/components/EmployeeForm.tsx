import React, { useState, useRef, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, Bytes, getDocFromServer } from 'firebase/firestore';
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
}

export function EmployeeForm({ onSuccess, editingEmployee, onCancel, settings }: EmployeeFormProps) {
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(editingEmployee?.photoUrl ? getPhotoUrl(editingEmployee.photoUrl) || null : null);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: editingEmployee?.name || '',
    address: editingEmployee?.address || '',
    designation: editingEmployee?.designation || 'AGENCY STAFF',
    agencyName: editingEmployee?.agencyName || '',
    cccName: editingEmployee?.cccName || 'Falakata Customer Care Center, Falakata, Alipurduar',
    bloodGroup: editingEmployee?.bloodGroup || '',
    contactNumber: editingEmployee?.contactNumber || '',
    photoUrl: editingEmployee?.photoUrl || '',
    validityRanges: editingEmployee?.validityRanges || '',
    validUntil: editingEmployee?.validUntil || '',
    workingArea: editingEmployee?.workingArea || 'FALAKATA CCC',
    issueNo: editingEmployee?.issueNo || '',
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
        cccName: editingEmployee.cccName || 'Falakata Customer Care Center, Falakata, Alipurduar',
        bloodGroup: editingEmployee.bloodGroup || '',
        contactNumber: editingEmployee.contactNumber || '',
        photoUrl: editingEmployee.photoUrl || '',
        validityRanges: editingEmployee.validityRanges || '',
        validUntil: editingEmployee.validUntil || '',
        workingArea: editingEmployee.workingArea || 'FALAKATA CCC',
        issueNo: editingEmployee.issueNo || '',
        issueDate: editingEmployee.issueDate || new Date().toISOString().split('T')[0],
      });
      setPhotoPreview(getPhotoUrl(editingEmployee.photoUrl) || null);
    }
  }, [editingEmployee]);

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

    setLoading(true);
    try {
      if (editingEmployee?.id) {
        const employeeRef = doc(db, 'employees', editingEmployee.id);
        try {
          await updateDoc(employeeRef, {
            ...formData,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `employees/${editingEmployee.id}`);
        }
      } else {
        try {
          await addDoc(collection(db, 'employees'), {
            ...formData,
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.uid,
            // Capture current settings snapshot
            officePhone: settings?.officePhone || '',
            officeEmail: settings?.officeEmail || '',
            issuingAuthority: settings?.issuingAuthority || '',
            emergencyTag: settings?.emergencyTag || '',
            cccName: settings?.cccName || '',
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
          cccName: 'Falakata Customer Care Center, Falakata, Alipurduar',
          bloodGroup: '',
          contactNumber: '',
          photoUrl: '',
          validityRanges: '',
          validUntil: '',
          workingArea: 'FALAKATA CCC',
          issueNo: '',
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
      className="bg-white p-10 rounded-[48px] shadow-2xl shadow-indigo-500/5 border border-slate-100 space-y-10 max-w-5xl mx-auto relative overflow-hidden"
    >
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl text-white flex items-center justify-center shadow-xl shadow-indigo-500/20">
            {editingEmployee ? <Save size={28} /> : <Plus size={28} />}
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {editingEmployee ? 'Edit Personnel' : 'Register Personnel'}
            </h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1.5">Emergency Duty ID System</p>
          </div>
        </div>

        {editingEmployee && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black hover:bg-slate-200 transition-all"
          >
            <ArrowLeft size={16} />
            Back to Directory
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
        {/* Photo Upload Section */}
        <div className="lg:col-span-4 flex flex-col items-center">
          <div className="relative group w-full max-w-[240px]">
            <div className={`aspect-[3/4] rounded-[32px] border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center overflow-hidden bg-slate-50/50 ${photoPreview ? 'border-indigo-500 shadow-2xl shadow-indigo-500/10' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`}>
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
          <div className="mt-6 flex flex-col items-center gap-3">
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
          <InputGroup icon={<Building size={18} />} label="Agency Name" name="agencyName" value={formData.agencyName} onChange={handleChange} required placeholder="e.g. DAS ELECTRICAL" />
          <InputGroup icon={<Building size={18} />} label="CCC Name" name="cccName" value={formData.cccName} onChange={handleChange} required placeholder="e.g. Falakata CCC" />
          
          <InputGroup icon={<Phone size={18} />} label="Contact Number" name="contactNumber" value={formData.contactNumber} onChange={handleChange} placeholder="10-digit mobile number" />

          <InputGroup icon={<MapPin size={18} />} label="Working Area" name="workingArea" value={formData.workingArea} onChange={handleChange} placeholder="FALAKATA CCC" />

          <InputGroup icon={<Hash size={18} />} label="Issue Number" name="issueNo" value={formData.issueNo} onChange={handleChange} placeholder="FKT/CCC/..." />
          <InputGroup icon={<Calendar size={18} />} label="Issue Date" name="issueDate" type="date" value={formData.issueDate} onChange={handleChange} />
          <InputGroup icon={<Calendar size={18} />} label="Valid Until" name="validUntil" type="date" value={formData.validUntil} onChange={handleChange} />

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

function InputGroup({ icon, label, name, value, onChange, required, placeholder, type = 'text' }: any) {
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
        className="w-full px-6 py-4 bg-slate-50/50 border border-slate-200 rounded-[20px] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold placeholder:text-slate-300"
      />
    </div>
  );
}
