import React, { useState, useEffect } from 'react';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { Employee } from './types';
import { EmployeeForm } from './components/EmployeeForm';
import { EmployeeList } from './components/EmployeeList';
import { LogIn, LogOut, ShieldCheck, CreditCard, Users, Calendar, Plus, ShieldAlert, UserPlus, Edit2, Trash2, X, Settings as SettingsIcon, Download } from 'lucide-react';
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

import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(true);
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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

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
    }, (error) => {
      console.error("Global Settings Snapshot Error:", error);
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
    }, (error) => {
      console.error("User Settings Snapshot Error:", error);
    });
    return () => unsubscribe();
  }, [user, globalSettings]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setIsAuthorized(false);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const isBootstrapAdmin = user.email === 'kkeshob@gmail.com' && user.emailVerified;

    // Listen to the user's document for role/authorization
    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      let userData = snapshot.data();

      // If not found by UID, check by email (for pre-authorized users)
      if (!userData && user.email) {
        try {
          const q = query(collection(db, 'users'), where('email', '==', user.email.toLowerCase()));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const preAuthDoc = querySnapshot.docs[0];
            userData = preAuthDoc.data();
            
            // Migrate to UID-based document
            await setDoc(doc(db, 'users', user.uid), {
              ...userData,
              updatedAt: new Date()
            });
            await deleteDoc(doc(db, 'users', preAuthDoc.id));
          }
        } catch (error) {
          console.error("Error searching user by email:", error);
        }
      }

      const authorized = isBootstrapAdmin || !!userData;
      const admin = isBootstrapAdmin || userData?.role === 'admin';

      // Auto-create user doc for bootstrap admin if it doesn't exist
      if (isBootstrapAdmin && !userData) {
        try {
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            name: user.displayName,
            role: 'admin',
            createdAt: new Date()
          });
        } catch (error) {
          console.error("Error creating bootstrap admin doc:", error);
        }
      }

      setIsAuthorized(authorized);
      setIsAdmin(admin);
      setLoading(false);
    }, (error) => {
      console.error("User Doc Snapshot Error:", error);
      // Even if snapshot fails (e.g. permission denied because doc doesn't exist yet),
      // we still check bootstrap admin
      if (isBootstrapAdmin) {
        setIsAuthorized(true);
        setIsAdmin(true);
      }
      setLoading(false);
    });

    return () => unsubscribeUser();
  }, [user]);

  useEffect(() => {
    if (!user || !isAuthorized) {
      setEmployees([]);
      return;
    }

    const employeesRef = collection(db, 'employees');
    let q;

    if (isAdmin) {
      // Admins see everything
      q = query(employeesRef, orderBy('createdAt', 'desc'));
    } else {
      // Regular users only see their own
      q = query(
        employeesRef,
        where('createdBy', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    }

    setIsEmployeesLoading(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(emps);
      setIsEmployeesLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setIsEmployeesLoading(false);
      // If index is missing for the filtered query, fallback to a simpler one or show error
      if (error.message.includes('index')) {
        console.warn("Composite index might be missing. Please check Firebase console.");
      }
    });

    return () => unsubscribe();
  }, [user, isAdmin, isAuthorized]);

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
    <div className="min-h-screen bg-page text-slate-900 font-sans">
      {/* Sidebar-style Header */}
      <header className="bg-navbar sticky top-0 z-50 shadow-lg shadow-indigo-900/10">
        <div className="responsive-container h-20 md:h-24 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-white/10 backdrop-blur-md rounded-xl md:rounded-2xl flex items-center justify-center text-white border border-white/10">
              <CreditCard size={20} className="md:hidden" />
              <CreditCard size={28} className="hidden md:block" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black text-white leading-none tracking-tight">
                {settings?.cccName || 'Falakata CCC'}
              </h1>
              <p className="text-[8px] md:text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mt-1 md:mt-1.5">ID Management Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] sm:text-xs md:text-sm font-black text-white truncate max-w-[80px] sm:max-w-none">
                {user.displayName || user.email?.split('@')[0] || 'User'}
              </span>
              <span className="text-[7px] sm:text-[8px] md:text-[10px] font-black text-indigo-300 uppercase tracking-widest mt-0.5">
                {isAdmin ? 'Admin' : 'Staff'}
              </span>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block"></div>
            {isInstallable && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 md:gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl transition-all font-bold text-[10px] md:text-xs"
                title="Install App"
              >
                <Download size={14} className="md:w-4 md:h-4" />
                <span className="hidden sm:inline">Install</span>
              </button>
            )}
            <button
              onClick={logout}
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl md:rounded-2xl transition-all group"
              title="Logout"
            >
              <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      <main className="responsive-container py-6 md:py-10">
        {/* Dashboard Overview */}
        <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-8 md:mb-12">
          <StatCard 
            icon={<Users className="text-indigo-600" />} 
            label="Employees" 
            value={employees.length} 
            color="bg-indigo-50"
          />
          <StatCard 
            icon={<ShieldCheck className="text-emerald-600" />} 
            label="Agencies" 
            value={new Set(employees.map(e => e.agencyName)).size} 
            color="bg-emerald-50"
          />
          <StatCard 
            icon={<Calendar className="text-amber-600" />} 
            label="Recent" 
            value={employees.filter(e => {
              const date = new Date(e.issueDate || '');
              const now = new Date();
              return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            }).length} 
            color="bg-amber-50"
          />
        </div>

        {/* Navigation Tabs */}
        {/* Navigation Tabs - Sticky */}
        <div className="sticky top-20 md:top-24 z-40 py-4 mb-8 md:mb-10 bg-page/80 backdrop-blur-md -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-wrap p-1.5 glass-card rounded-[24px] md:rounded-[32px] w-full lg:w-fit border border-white/50 shadow-xl shadow-indigo-500/5">
              <button
                onClick={() => { setActiveTab('list'); setEditingEmployee(null); }}
                className={`flex-1 lg:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-3.5 rounded-[18px] md:rounded-[24px] text-xs md:text-sm font-black transition-all ${
                  activeTab === 'list' 
                    ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/5' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Users size={18} />
                <span className="hidden sm:inline">Directory</span>
                <span className="sm:hidden">List</span>
              </button>
              <button
                onClick={() => setActiveTab('add')}
                className={`flex-1 lg:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-3.5 rounded-[18px] md:rounded-[24px] text-xs md:text-sm font-black transition-all ${
                  activeTab === 'add' 
                    ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/5' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Plus size={18} />
                <span className="hidden sm:inline">{editingEmployee ? 'Edit Card' : 'Create Card'}</span>
                <span className="sm:hidden">{editingEmployee ? 'Edit' : 'Add'}</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`flex-1 lg:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-3.5 rounded-[18px] md:rounded-[24px] text-xs md:text-sm font-black transition-all ${
                    activeTab === 'users' 
                      ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/5' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <UserPlus size={18} />
                  <span className="hidden sm:inline">Access Control</span>
                  <span className="sm:hidden">Users</span>
                </button>
              )}
              {isAuthorized && (
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 lg:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-3.5 rounded-[18px] md:rounded-[24px] text-xs md:text-sm font-black transition-all ${
                    activeTab === 'settings' 
                      ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/5' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <SettingsIcon size={18} />
                  <span className="hidden sm:inline">Settings</span>
                  <span className="sm:hidden">Setup</span>
                </button>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest glass-card px-4 py-2 rounded-full border border-white/50 shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              System Operational
            </div>
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
                isLoading={isEmployeesLoading}
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
      className="bg-card-custom p-3 sm:p-6 md:p-8 rounded-[20px] sm:rounded-[24px] md:rounded-[32px] shadow-sm flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 sm:gap-4 md:gap-6 aspect-square sm:aspect-auto border border-slate-100/50"
    >
      <div className={`w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 ${color} rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center shrink-0`}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 16, className: (icon as any).props.className + ' sm:hidden' })}
        {React.cloneElement(icon as React.ReactElement<any>, { size: 24, className: (icon as any).props.className + ' hidden sm:block md:hidden' })}
        {React.cloneElement(icon as React.ReactElement<any>, { size: 28, className: (icon as any).props.className + ' hidden md:block' })}
      </div>
      <div className="text-center sm:text-left overflow-hidden w-full">
        <p className="text-[6px] sm:text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1 truncate">{label}</p>
        <p className="text-sm sm:text-xl md:text-3xl font-black text-slate-900">{value}</p>
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
    <div className="bg-form p-6 md:p-10 rounded-[32px] md:rounded-[48px] shadow-xl shadow-indigo-500/5 border border-slate-100">
      <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-6 md:mb-8">
        {saveToGlobal ? 'Global System Defaults' : 'My Office Settings'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        {isAdmin && (
          <div className="flex items-center gap-3 p-3 md:p-4 bg-slate-50 rounded-xl md:rounded-2xl border border-slate-100 mb-4 md:mb-6">
            <input
              type="checkbox"
              id="saveToGlobal"
              checked={saveToGlobal}
              onChange={(e) => setSaveToGlobal(e.target.checked)}
              className="w-4 h-4 md:w-5 md:h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="saveToGlobal" className="text-xs md:text-sm font-bold text-slate-700">
              Update Global System Defaults (Admins Only)
            </label>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Office Phone No.</label>
            <input
              type="text"
              value={formData.officePhone}
              onChange={(e) => setFormData({ ...formData, officePhone: e.target.value })}
              className="w-full px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm"
              placeholder="e.g. 9332789274"
            />
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Office Email</label>
            <input
              type="email"
              value={formData.officeEmail}
              onChange={(e) => setFormData({ ...formData, officeEmail: e.target.value })}
              className="w-full px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm"
              placeholder="e.g. sm.falakata@wbsedcl.in"
            />
          </div>
        </div>
        <div className="space-y-1.5 md:space-y-2">
          <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">CCC Name (Portal Header)</label>
          <input
            type="text"
            value={formData.cccName}
            onChange={(e) => setFormData({ ...formData, cccName: e.target.value })}
            className="w-full px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm"
            placeholder="e.g. Falakata Customer Care Center"
          />
        </div>
        <div className="space-y-1.5 md:space-y-2">
          <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Emergency Tag Details</label>
          <input
            type="text"
            value={formData.emergencyTag}
            onChange={(e) => setFormData({ ...formData, emergencyTag: e.target.value })}
            className="w-full px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm"
            placeholder="e.g. ON EMERGENCY DUTY"
          />
        </div>
        <div className="space-y-1.5 md:space-y-2">
          <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Issuing Authority Details</label>
          <textarea
            value={formData.issuingAuthority}
            onChange={(e) => setFormData({ ...formData, issuingAuthority: e.target.value })}
            className="w-full px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm min-h-[100px] md:min-h-[120px]"
            placeholder="e.g. Asst. Engg & Station Manager&#10;Falakata CCC, WBSEDCL"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white font-black py-4 md:py-5 rounded-xl md:rounded-[24px] hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-xl shadow-indigo-500/20 uppercase tracking-widest text-xs md:text-sm"
        >
          {loading ? 'Saving Settings...' : 'Save Settings'}
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
    <div className="space-y-6 md:space-y-8">
      <div className="bg-form p-6 md:p-10 rounded-[32px] md:rounded-[48px] shadow-xl shadow-indigo-500/5 border border-slate-100">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <h3 className="text-xl md:text-2xl font-black text-slate-900">
            {editingUser ? 'Edit Authorized User' : 'Add Authorized User'}
          </h3>
          {editingUser && (
            <button 
              onClick={cancelEdit}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-xs md:text-sm"
            >
              <X size={16} />
              Cancel
            </button>
          )}
        </div>
        <form onSubmit={handleAddUser} className="flex flex-col md:flex-row gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="User Email Address"
            className="flex-1 px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm"
            required
          />
          <select
            value={role}
            onChange={(e: any) => setRole(e.target.value)}
            className="px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm"
          >
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white font-black px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-[20px] hover:bg-indigo-700 transition-all disabled:opacity-50 text-sm"
          >
            {editingUser ? 'Update' : 'Authorize'}
          </button>
        </form>
      </div>

      <div className="bg-form p-6 md:p-10 rounded-[32px] md:rounded-[48px] shadow-xl shadow-indigo-500/5 border border-slate-100">
        <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-6 md:mb-8">Authorized Directory</h3>
        <div className="space-y-3 md:space-y-4">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-6 bg-white rounded-2xl md:rounded-[24px] border border-slate-100 group gap-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-lg md:rounded-xl flex items-center justify-center border border-slate-200 text-slate-400">
                  <UserPlus size={18} className="md:hidden" />
                  <UserPlus size={20} className="hidden md:block" />
                </div>
                <div>
                  <p className="font-black text-slate-900 text-sm md:text-base">{u.email}</p>
                  <p className="text-[8px] md:text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5 md:mt-1">{u.role}</p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-4">
                <div className="text-left sm:text-right">
                  <p className="text-[8px] md:text-[10px] text-slate-400 font-black uppercase tracking-tighter">Added on</p>
                  <p className="text-[10px] md:text-xs font-bold text-slate-600">
                    {u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
                  </p>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <button
                    onClick={() => handleEdit(u)}
                    className="p-2 md:p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg md:rounded-xl transition-all"
                    title="Edit User"
                  >
                    <Edit2 size={16} className="md:hidden" />
                    <Edit2 size={18} className="hidden md:block" />
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="p-2 md:p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg md:rounded-xl transition-all"
                    title="Remove Access"
                  >
                    <Trash2 size={16} className="md:hidden" />
                    <Trash2 size={18} className="hidden md:block" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-center py-8 md:py-12">
              <p className="text-slate-400 font-bold text-sm">No authorized users found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
