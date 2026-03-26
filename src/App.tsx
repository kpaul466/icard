import React, { useState, useEffect } from 'react';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { Employee } from './types';
import { EmployeeForm } from './components/EmployeeForm';
import { EmployeeList } from './components/EmployeeList';
import { LogIn, LogOut, ShieldCheck, CreditCard, Users, Calendar, Plus, ShieldAlert, UserPlus, Edit2, Trash2, X, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<any>(() => {
    const cached = localStorage.getItem('id-portal-user-settings');
    return cached ? JSON.parse(cached) : null;
  });
  const [globalSettings, setGlobalSettings] = useState<any>(() => {
    const cached = localStorage.getItem('id-portal-global-settings');
    return cached ? JSON.parse(cached) : null;
  });
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'users' | 'settings'>('list');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Default hardcoded settings
  const defaultSettings = {
    officePhone: '9332789274',
    officeEmail: 'sm.falakata@wbsedcl.in',
    issuingAuthority: 'Asst. Engg & Station Manager\nFalakata CCC, WBSEDCL',
    emergencyTag: 'ON EMERGENCY DUTY',
    cccName: 'Falakata Customer Care Center'
  };

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGlobalSettings(data);
        localStorage.setItem('id-portal-global-settings', JSON.stringify(data));
      } else {
        setGlobalSettings(defaultSettings);
        localStorage.setItem('id-portal-global-settings', JSON.stringify(defaultSettings));
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSettings(globalSettings || defaultSettings);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      const userData = snapshot.data();
      let newSettings;
      if (userData && (userData.officePhone || userData.officeEmail || userData.issuingAuthority || userData.emergencyTag || userData.cccName)) {
        newSettings = {
          officePhone: userData.officePhone || globalSettings?.officePhone || defaultSettings.officePhone,
          officeEmail: userData.officeEmail || globalSettings?.officeEmail || defaultSettings.officeEmail,
          issuingAuthority: userData.issuingAuthority || globalSettings?.issuingAuthority || defaultSettings.issuingAuthority,
          emergencyTag: userData.emergencyTag || globalSettings?.emergencyTag || defaultSettings.emergencyTag,
          cccName: userData.cccName || globalSettings?.cccName || defaultSettings.cccName
        };
      } else {
        newSettings = globalSettings || defaultSettings;
      }
      setSettings(newSettings);
      localStorage.setItem('id-portal-user-settings', JSON.stringify(newSettings));
    });
    return () => unsubscribe();
  }, [user, globalSettings]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Bootstrap admin check
        const isBootstrapAdmin = u.email === 'kkeshob@gmail.com' && u.emailVerified;
        
        // Check Firestore for user role
        let userDoc = await getDoc(doc(db, 'users', u.uid));
        let userData = userDoc.data();
        
        // If not found by UID, check by email (for pre-authorized users)
        if (!userData && u.email) {
          const q = query(collection(db, 'users'), where('email', '==', u.email.toLowerCase()));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const preAuthDoc = querySnapshot.docs[0];
            userData = preAuthDoc.data();
            
            // Migrate to UID-based document for future efficiency
            try {
              await setDoc(doc(db, 'users', u.uid), {
                ...userData,
                updatedAt: new Date()
              });
              // Optionally delete the old random-ID doc
              await deleteDoc(doc(db, 'users', preAuthDoc.id));
            } catch (e) {
              console.error("Error migrating user doc:", e);
            }
          }
        }

        const authorized = isBootstrapAdmin || !!userData;
        const admin = isBootstrapAdmin || userData?.role === 'admin';

        // Auto-create user doc for bootstrap admin if it doesn't exist
        if (isBootstrapAdmin && !userData) {
          try {
            await setDoc(doc(db, 'users', u.uid), {
              email: u.email,
              name: u.displayName,
              role: 'admin',
              createdAt: new Date()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `users/${u.uid}`);
          }
        }

        setIsAuthorized(authorized);
        setIsAdmin(admin);
        setUser(u);
      } else {
        setUser(null);
        setIsAuthorized(false);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthorized) {
      setEmployees([]);
      return;
    }

    const q = query(
      collection(db, 'employees'),
      where('createdBy', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(emps);
    }, (error) => {
      console.error("Firestore Error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setActiveTab('add');
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    setActiveTab('list');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-12 w-12 border-t-2 border-b-2 border-indigo-500 rounded-full"
        ></motion.div>
      </div>
    );
  }

  if (user && !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/10 blur-[120px] rounded-full"></div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/5 backdrop-blur-2xl p-10 rounded-[40px] border border-white/10 text-center shadow-2xl relative z-10"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-red-600 to-orange-600 rounded-[30px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-red-500/20">
            <ShieldAlert size={48} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-3 tracking-tight">Access Denied</h1>
          <p className="text-slate-400 mb-10 font-medium leading-relaxed">
            Your account ({user.email}) is not authorized to access this system. Please contact the administrator for access.
          </p>
          
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-4 bg-white/10 text-white font-black py-5 px-8 rounded-[24px] transition-all hover:bg-white/20 active:scale-[0.98] border border-white/10"
          >
            <LogOut size={22} />
            Sign Out
          </button>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/5 backdrop-blur-2xl p-10 rounded-[40px] border border-white/10 text-center shadow-2xl relative z-10"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-[30px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/20">
            <ShieldCheck size={48} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white mb-3 tracking-tight">Falakata CCC</h1>
          <p className="text-slate-400 mb-10 font-medium leading-relaxed">
            Premium Employee ID Generation System for WBSEDCL Contractors & Agencies
          </p>
          
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-4 bg-white text-slate-950 font-black py-5 px-8 rounded-[24px] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/5 group"
          >
            <LogIn size={22} className="group-hover:translate-x-1 transition-transform" />
            Sign in with Google
          </button>
          
          <div className="mt-10 flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-white/10"></div>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black">
              Authorized Access
            </p>
            <div className="h-px w-8 bg-white/10"></div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faff] text-slate-900 font-sans">
      {/* Sidebar-style Header */}
      <header className="bg-white border-b border-slate-200/60 sticky top-0 z-50 backdrop-blur-xl bg-white/80">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
              <CreditCard size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 leading-none tracking-tight">
                {settings?.cccName || 'Falakata CCC'}
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">ID Management Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-black text-slate-900">{user.displayName}</span>
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">
                {isAdmin ? 'System Administrator' : 'Authorized Personnel'}
              </span>
            </div>
            <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
            <button
              onClick={logout}
              className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all group"
              title="Logout"
            >
              <LogOut size={22} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Dashboard Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard 
            icon={<Users className="text-indigo-600" />} 
            label="Total Employees" 
            value={employees.length} 
            color="bg-indigo-50"
          />
          <StatCard 
            icon={<ShieldCheck className="text-emerald-600" />} 
            label="Active Agencies" 
            value={new Set(employees.map(e => e.agencyName)).size} 
            color="bg-emerald-50"
          />
          <StatCard 
            icon={<Calendar className="text-amber-600" />} 
            label="Recent Issues" 
            value={employees.filter(e => {
              const date = new Date(e.issueDate || '');
              const now = new Date();
              return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            }).length} 
            color="bg-amber-50"
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex p-1.5 bg-slate-200/50 rounded-[24px] w-fit backdrop-blur-sm border border-slate-200/50">
            <button
              onClick={() => { setActiveTab('list'); setEditingEmployee(null); }}
              className={`flex items-center gap-3 px-8 py-3.5 rounded-[18px] text-sm font-black transition-all ${
                activeTab === 'list' 
                  ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-500/5' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users size={20} />
              Directory
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={`flex items-center gap-3 px-8 py-3.5 rounded-[18px] text-sm font-black transition-all ${
                activeTab === 'add' 
                  ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-500/5' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Plus size={20} />
              {editingEmployee ? 'Edit Card' : 'Create Card'}
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-3 px-8 py-3.5 rounded-[18px] text-sm font-black transition-all ${
                  activeTab === 'users' 
                    ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-500/5' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <UserPlus size={20} />
                Access Control
              </button>
            )}
            {isAuthorized && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-3 px-8 py-3.5 rounded-[18px] text-sm font-black transition-all ${
                  activeTab === 'settings' 
                    ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-500/5' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <SettingsIcon size={20} />
                Settings
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            System Operational
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <EmployeeList 
                employees={employees} 
                onDelete={() => {}} 
                onEdit={handleEdit}
                settings={settings}
              />
            </motion.div>
          ) : activeTab === 'add' ? (
            <motion.div
              key="add"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="max-w-4xl mx-auto"
            >
              <EmployeeForm 
                onSuccess={() => {
                  setActiveTab('list');
                  setEditingEmployee(null);
                }} 
                editingEmployee={editingEmployee}
                onCancel={handleCancelEdit}
                settings={settings}
              />
            </motion.div>
          ) : activeTab === 'users' ? (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="max-w-4xl mx-auto"
            >
              <UserManagement />
            </motion.div>
          ) : (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="max-w-4xl mx-auto"
            >
              <SettingsForm settings={settings} isAdmin={isAdmin} userId={user?.uid || ''} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-16 text-center">
        <div className="h-px w-20 bg-slate-200 mx-auto mb-8"></div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">
          &copy; 2026 WBSEDCL Falakata Customer Care Center
        </p>
      </footer>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-8 rounded-[32px] border border-slate-200/60 shadow-sm flex items-center gap-6"
    >
      <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center`}>
        {React.cloneElement(icon as React.ReactElement, { size: 28 })}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-black text-slate-900">{value}</p>
      </div>
    </motion.div>
  );
}

function SettingsForm({ settings, isAdmin, userId }: { settings: any, isAdmin: boolean, userId: string }) {
  const [formData, setFormData] = useState({
    officePhone: '',
    officeEmail: '',
    issuingAuthority: '',
    emergencyTag: '',
    cccName: ''
  });
  const [saveToGlobal, setSaveToGlobal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        officePhone: settings.officePhone || '',
        officeEmail: settings.officeEmail || '',
        issuingAuthority: settings.issuingAuthority || '',
        emergencyTag: settings.emergencyTag || '',
        cccName: settings.cccName || ''
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (saveToGlobal && isAdmin) {
        await setDoc(doc(db, 'settings', 'global'), formData);
      } else {
        await updateDoc(doc(db, 'users', userId), formData);
      }
      alert('Settings updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, saveToGlobal ? 'settings/global' : `users/${userId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-10 rounded-[48px] shadow-2xl shadow-indigo-500/5 border border-slate-100">
      <h3 className="text-2xl font-black text-slate-900 mb-8">
        {saveToGlobal ? 'Global System Defaults' : 'My Office Settings'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        {isAdmin && (
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
            <input
              type="checkbox"
              id="saveToGlobal"
              checked={saveToGlobal}
              onChange={(e) => setSaveToGlobal(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="saveToGlobal" className="text-sm font-bold text-slate-700">
              Update Global System Defaults (Admins Only)
            </label>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Office Phone No.</label>
            <input
              type="text"
              value={formData.officePhone}
              onChange={(e) => setFormData({ ...formData, officePhone: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:border-indigo-500 font-bold"
              placeholder="e.g. 9332789274"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Office Email</label>
            <input
              type="email"
              value={formData.officeEmail}
              onChange={(e) => setFormData({ ...formData, officeEmail: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:border-indigo-500 font-bold"
              placeholder="e.g. sm.falakata@wbsedcl.in"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CCC Name (Portal Header)</label>
          <input
            type="text"
            value={formData.cccName}
            onChange={(e) => setFormData({ ...formData, cccName: e.target.value })}
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:border-indigo-500 font-bold"
            placeholder="e.g. Falakata Customer Care Center"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Emergency Tag Details</label>
          <input
            type="text"
            value={formData.emergencyTag}
            onChange={(e) => setFormData({ ...formData, emergencyTag: e.target.value })}
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:border-indigo-500 font-bold"
            placeholder="e.g. ON EMERGENCY DUTY"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Issuing Authority Details</label>
          <textarea
            value={formData.issuingAuthority}
            onChange={(e) => setFormData({ ...formData, issuingAuthority: e.target.value })}
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:border-indigo-500 font-bold min-h-[120px]"
            placeholder="e.g. Asst. Engg & Station Manager&#10;Falakata CCC, WBSEDCL"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white font-black py-5 rounded-[24px] hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-xl shadow-indigo-500/20 uppercase tracking-widest text-sm"
        >
          {loading ? 'Saving Settings...' : 'Save Global Settings'}
        </button>
      </form>
    </div>
  );
}

function UserManagement() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'editor'>('editor');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("User Management Snapshot Error:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      if (editingUser) {
        try {
          await updateDoc(doc(db, 'users', editingUser.id), {
            email: email.toLowerCase(),
            role,
            updatedAt: new Date()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${editingUser.id}`);
        }
        setEditingUser(null);
      } else {
        try {
          await addDoc(collection(db, 'users'), {
            email: email.toLowerCase(),
            role,
            createdAt: new Date(),
            addedBy: auth.currentUser?.email
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'users');
        }
      }
      setEmail('');
      setRole('editor');
    } catch (error) {
      console.error("Error saving user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setEmail(user.email);
    setRole(user.role);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this user's access?")) return;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEmail('');
    setRole('editor');
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-10 rounded-[48px] shadow-2xl shadow-indigo-500/5 border border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-black text-slate-900">
            {editingUser ? 'Edit Authorized User' : 'Add Authorized User'}
          </h3>
          {editingUser && (
            <button 
              onClick={cancelEdit}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-sm"
            >
              <X size={16} />
              Cancel Edit
            </button>
          )}
        </div>
        <form onSubmit={handleAddUser} className="flex flex-col md:flex-row gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="User Email Address"
            className="flex-1 px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:border-indigo-500 font-bold"
            required
          />
          <select
            value={role}
            onChange={(e: any) => setRole(e.target.value)}
            className="px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:border-indigo-500 font-bold"
          >
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white font-black px-8 py-4 rounded-[20px] hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            {editingUser ? 'Update Access' : 'Authorize User'}
          </button>
        </form>
      </div>

      <div className="bg-white p-10 rounded-[48px] shadow-2xl shadow-indigo-500/5 border border-slate-100">
        <h3 className="text-2xl font-black text-slate-900 mb-8">Authorized Directory</h3>
        <div className="space-y-4">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[24px] border border-slate-100 group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 text-slate-400">
                  <UserPlus size={20} />
                </div>
                <div>
                  <p className="font-black text-slate-900">{u.email}</p>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">{u.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden md:block text-right mr-4">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Added on</p>
                  <p className="text-xs font-bold text-slate-600">
                    {u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(u)}
                    className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    title="Edit User"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="Remove Access"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400 font-bold">No authorized users found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
