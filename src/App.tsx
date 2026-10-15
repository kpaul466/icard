import React, { useState, useEffect } from 'react';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, doc, setDoc, deleteDoc, updateDoc, deleteField, writeBatch, getDocs, serverTimestamp } from 'firebase/firestore';
import { Employee } from './types';
import { EmployeeForm } from './components/EmployeeForm';
import { EmployeeList } from './components/EmployeeList';
import { AgencyManagement } from './components/AgencyManagement';
import { CardDesignSettings } from './components/CardDesignSettings';
import { CardSettingsEditor } from './components/CardSettingsEditor';
import { CardSettings, defaultCardSettings, mergeCardSettings } from './lib/cardSettings';
import { LogIn, LogOut, ShieldCheck, CreditCard, Users, Calendar, Plus, ShieldAlert, UserPlus, Edit2, Trash2, X, Settings as SettingsIcon, Download, Menu, Building2, Paintbrush } from 'lucide-react';
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
  const [isSuperuser, setIsSuperuser] = useState<boolean>(false);
  const [userDocId, setUserDocId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [cccCardLayout, setCccCardLayout] = useState<CardSettings>(defaultCardSettings);
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'users' | 'agencies' | 'card-design' | 'settings'>('list');
  const [dashboardView, setDashboardView] = useState<'employees' | 'agencies' | 'recent' | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);
  const [directoryAgencyFilter, setDirectoryAgencyFilter] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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
        setGlobalSettings({
          ...data,
          cccList: Array.isArray(data.cccList) ? data.cccList : [data.cccName || defaultSettings.cccName]
        });
      } else {
        setGlobalSettings({ ...defaultSettings, cccList: [defaultSettings.cccName] });
      }
    }, (error) => {
      console.error("Global Settings Snapshot Error:", error);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const assignedCcc = userProfile.assignedCcc || userProfile.cccId;
    if (!assignedCcc) {
      setCccCardLayout(mergeCardSettings(globalSettings?.cardSettings));
      return;
    }
    const settingsRef = doc(db, 'cccCardSettings', assignedCcc);
    return onSnapshot(settingsRef, snapshot => {
      setCccCardLayout(mergeCardSettings(snapshot.data()?.cardSettings ?? globalSettings?.cardSettings));
    }, error => {
      console.error('CCC card settings snapshot failed:', error);
    });
  }, [userProfile.assignedCcc, userProfile.cccId, globalSettings?.cardSettings]);

  useEffect(() => {
    if (!user) {
      setSettings(globalSettings || defaultSettings);
      return;
    }

    if (!userDocId) return;
    const unsubscribe = onSnapshot(doc(db, 'users', userDocId), (snapshot) => {
      const userData = snapshot.data();
      let newSettings;
      
      // If admin, prioritize global settings for a consistent "Master" view
      if (isAdmin) {
        const adminSettings = userData || {};
        newSettings = {
          ...defaultSettings,
          ...(globalSettings || {}),
          officePhone: adminSettings.officePhone ?? globalSettings?.officePhone ?? defaultSettings.officePhone,
          officeEmail: adminSettings.officeEmail ?? globalSettings?.officeEmail ?? defaultSettings.officeEmail,
          issuingAuthority: adminSettings.issuingAuthority ?? globalSettings?.issuingAuthority ?? defaultSettings.issuingAuthority,
          emergencyTag: adminSettings.emergencyTag ?? globalSettings?.emergencyTag ?? defaultSettings.emergencyTag,
          cccName: typeof adminSettings.assignedCcc === 'string'
            ? adminSettings.assignedCcc
            : typeof adminSettings.cccName === 'string' ? adminSettings.cccName : ''
        };
      } else if (userData && ('officePhone' in userData || 'officeEmail' in userData || 'issuingAuthority' in userData || 'emergencyTag' in userData || 'cccName' in userData)) {
        newSettings = {
          officePhone: userData.officePhone !== undefined ? userData.officePhone : (globalSettings?.officePhone || defaultSettings.officePhone),
          officeEmail: userData.officeEmail !== undefined ? userData.officeEmail : (globalSettings?.officeEmail || defaultSettings.officeEmail),
          issuingAuthority: userData.issuingAuthority !== undefined ? userData.issuingAuthority : (globalSettings?.issuingAuthority || defaultSettings.issuingAuthority),
          emergencyTag: userData.emergencyTag !== undefined ? userData.emergencyTag : (globalSettings?.emergencyTag || defaultSettings.emergencyTag),
          cccName: userData.cccName !== undefined ? userData.cccName : (globalSettings?.cccName || defaultSettings.cccName)
        };
      } else {
        newSettings = { ...defaultSettings, ...(globalSettings || {}) };
      }
      setSettings(newSettings);
    }, (error) => {
      console.error("User Settings Snapshot Error:", error);
    });
    return () => unsubscribe();
  }, [user, userDocId, globalSettings, isAdmin]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setIsAuthorized(false);
        setIsAdmin(false);
        setIsSuperuser(false);
        setUserDocId(null);
        setUserProfile({});
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user?.email) return;

    setLoading(true);
    const userQuery = query(collection(db, 'users'), where('email', '==', user.email.toLowerCase()));
    const unsubscribeUser = onSnapshot(userQuery, (snapshot) => {
      const userDoc = snapshot.docs.find(candidate => candidate.id === user.uid) || snapshot.docs[0];
      const userData = userDoc?.data();
      const superuserProfileId = user.email.toLowerCase();
      const superuser = Boolean(
        userDoc &&
        (userDoc.id === user.uid || userDoc.id === superuserProfileId) &&
        userData?.email?.toLowerCase() === superuserProfileId &&
        userData?.role === 'admin' &&
        userData?.isSuperuser === true &&
        user.emailVerified
      );
      const admin = superuser || userData?.role === 'admin';
      const authorized = Boolean(userData);

      if (userDoc) {
        setUserDocId(userDoc.id);
        setUserProfile(userData || {});
      } else {
        setUserDocId(null);
        setUserProfile({});
      }

      setIsAuthorized(authorized);
      setIsAdmin(admin);
      setIsSuperuser(superuser);
      setLoading(false);
    }, (error) => {
      console.error('User profile lookup error:', error);
      setIsAuthorized(false);
      setIsAdmin(false);
      setIsSuperuser(false);
      setLoading(false);
    });

    return () => unsubscribeUser();
  }, [user]);

  useEffect(() => {
    if (!user || !isAuthorized) {
      setEmployees([]);
      setIsEmployeesLoading(false);
      return;
    }

    const employeesRef = collection(db, 'employees');
    const assignedCcc = userProfile.assignedCcc || userProfile.cccId || '';
    const assignedAgency = userProfile.agencyName || '';
    const employeeQueries = [];
    if (isSuperuser) {
      employeeQueries.push(query(employeesRef, orderBy('createdAt', 'desc')));
    } else if (isAdmin && assignedCcc) {
      employeeQueries.push(query(employeesRef, where('cccId', '==', assignedCcc)));
      employeeQueries.push(query(employeesRef, where('cccName', '==', assignedCcc)));
    } else if (isAdmin) {
      setEmployees([]);
      setIsEmployeesLoading(false);
      return;
    } else {
      if (!assignedCcc || !assignedAgency) {
        setEmployees([]);
        setIsEmployeesLoading(false);
        return;
      }
      employeeQueries.push(query(
        employeesRef,
        where('agencyName', '==', assignedAgency),
        where('cccId', '==', assignedCcc)
      ));
      employeeQueries.push(query(
        employeesRef,
        where('agencyName', '==', assignedAgency),
        where('cccName', '==', assignedCcc)
      ));
    }

    setIsEmployeesLoading(true);
    const sourceRecords = new Map<number, Employee[]>();
    const initialSources = new Set<number>();
    const unsubscribe = employeeQueries.map((employeeQuery, sourceIndex) => onSnapshot(employeeQuery, snapshot => {
      const isLegacyQuery = !isSuperuser && sourceIndex % 2 === 1;
      sourceRecords.set(sourceIndex, snapshot.docs.map(employeeDoc => {
        const data = employeeDoc.data() as Employee;
        return {
          ...data,
          id: employeeDoc.id,
          ...(isLegacyQuery && !data.cccId ? { cccId: assignedCcc } : {})
        };
      }));
      initialSources.add(sourceIndex);

      const byId = new Map<string, Employee>();
      sourceRecords.forEach(records => records.forEach(employee => {
        if (employee.id) byId.set(employee.id, { ...byId.get(employee.id), ...employee });
      }));
      const orderedEmployees = [...byId.values()].sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      setEmployees(orderedEmployees);
      if (initialSources.size === employeeQueries.length) setIsEmployeesLoading(false);
    }, error => {
      console.error('Firestore employee query failed:', error);
      initialSources.add(sourceIndex);
      if (initialSources.size === employeeQueries.length) setIsEmployeesLoading(false);
    }));

    return () => unsubscribe.forEach(stop => stop());
  }, [user, userProfile, isAdmin, isSuperuser, isAuthorized]);

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    if (activeTab === 'add') setActiveTab('list');
  };

  const navigateToTab = (tab: 'list' | 'add' | 'users' | 'agencies' | 'card-design' | 'settings') => {
    if (tab === 'add') setEditingEmployee(null);
    setActiveTab(tab);
    setIsMobileNavOpen(false);
  };
  const cardDisplaySettings = {
    ...settings,
    cardSettings: mergeCardSettings(userProfile.cardSettings ?? cccCardLayout)
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
          <h1 className="text-4xl font-black text-white mb-3 tracking-tight">iCard Generation Software</h1>
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
        <div className="responsive-container h-[4.5rem] md:h-[4.5rem] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="md:hidden -ml-2 w-10 h-10 shrink-0 flex items-center justify-center text-indigo-100 hover:bg-white/10 rounded-xl"
              aria-label="Open navigation"
              aria-expanded={isMobileNavOpen}
            >
              <Menu size={22} />
            </button>
            <div className="hidden md:flex w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl items-center justify-center text-white border border-white/10">
              <CreditCard size={28} />
            </div>
            <div className="min-w-0 flex-1 md:flex-none">
              <h1 title={userProfile.cccName || userProfile.assignedCcc || userProfile.cccId || settings?.cccName || 'iCard Generation Software'} className="truncate whitespace-nowrap text-xs sm:text-sm md:text-2xl font-black text-white leading-tight tracking-tight">
                {userProfile.cccName || userProfile.assignedCcc || userProfile.cccId || settings?.cccName || 'iCard Generation Software'}
              </h1>
              <p className="hidden md:block text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mt-1.5">ID Management Portal</p>
              <p className="md:hidden truncate text-[10px] font-bold text-indigo-200 leading-tight">
                {userProfile.name || userProfile.displayName || user.displayName || user.email?.split('@')[0] || 'User'}
                <span className="ml-1 text-[8px] font-black uppercase tracking-wider text-indigo-300">
                  · {isSuperuser ? 'Superuser' : isAdmin ? 'Admin' : 'Staff'}
                </span>
              </p>
            </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] sm:text-xs md:text-sm font-black text-white truncate max-w-[80px] sm:max-w-none">
                {userProfile.name || userProfile.displayName || user.displayName || user.email?.split('@')[0] || 'User'}
              </span>
              <span className="text-[7px] sm:text-[8px] md:text-[10px] font-black text-indigo-300 uppercase tracking-widest mt-0.5">
                {isSuperuser ? 'Superuser' : isAdmin ? 'Admin' : 'Staff'}
                {userProfile.phone && ` · ${userProfile.phone}`}
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
        <nav aria-label="Main navigation" className="hidden md:block border-t border-white/10">
          <div className="responsive-container flex items-center gap-2 py-2">
            {([
              ['list', 'Directory', <Users size={17} />],
              ['add', 'Create Card', <Plus size={17} />],
              ...(isAdmin ? [
                ['users', isSuperuser ? 'Admin & User Creation' : 'User Creation', <UserPlus size={17} />] as const,
                ['agencies', 'Agency Profiles', <Building2 size={17} />] as const,
                  ['card-design', 'Card Design', <Paintbrush size={17} />] as const
              ] : []),
              ['settings', 'Settings', <SettingsIcon size={17} />]
            ] as const).map(([tab, label, icon]) => (
              <button key={tab} type="button" onClick={() => navigateToTab(tab)}
                aria-current={activeTab === tab ? 'page' : undefined}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-100 hover:bg-white/10 hover:text-white'}`}>
                {icon}{label}
              </button>
            ))}
            <span className="ml-auto text-xs font-semibold text-indigo-200 truncate max-w-64">
              {isSuperuser ? 'All CCCs' : userProfile.assignedCcc || userProfile.cccId || settings?.cccName || 'CCC not assigned'}
            </span>
          </div>
        </nav>
        {isMobileNavOpen && (
          <div className="fixed inset-0 z-[60] md:hidden">
            <button type="button" className="absolute inset-0 bg-slate-950/50" aria-label="Close navigation" onClick={() => setIsMobileNavOpen(false)} />
            <aside className="relative h-full w-[min(20rem,85vw)] bg-white shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div className="min-w-0">
                  <p className="font-black text-slate-900 truncate">{userProfile.name || user.displayName || user.email}</p>
                  <p className="text-xs font-semibold text-slate-500">{isSuperuser ? 'Superuser · All CCCs' : `${isAdmin ? 'Admin' : 'Editor'} · ${userProfile.assignedCcc || userProfile.cccId || settings?.cccName || 'CCC not assigned'}`}</p>
                </div>
                <button type="button" onClick={() => setIsMobileNavOpen(false)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" aria-label="Close navigation"><X size={20} /></button>
              </div>
              <nav aria-label="Mobile navigation" className="p-3 space-y-1">
                {([
                  ['list', 'iCard View', <CreditCard size={19} />],
                  ['add', 'Create employee card', <Plus size={19} />],
                  ...(isAdmin ? [
                    ['users', isSuperuser ? 'Admin & User Creation' : 'User Creation', <UserPlus size={19} />] as const,
                    ['agencies', 'Agency Profiles', <Building2 size={19} />] as const,
                    ['card-design', 'Card Design', <Paintbrush size={19} />] as const
                  ] : []),
                  ['settings', 'Office settings', <SettingsIcon size={19} />]
                ] as const).map(([tab, label, icon]) => (
                  <button key={tab} type="button" onClick={() => navigateToTab(tab)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left ${activeTab === tab ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                    {icon}{label}
                  </button>
                ))}
              </nav>
              <div className="mt-auto p-4 border-t border-slate-100 space-y-2">
                {isInstallable && <button type="button" onClick={handleInstallClick} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-indigo-700 hover:bg-indigo-50"><Download size={19} />Install app</button>}
                <button type="button" onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-700 hover:bg-red-50"><LogOut size={19} />Sign out</button>
              </div>
            </aside>
          </div>
        )}
      </header>

      <main className="responsive-container py-6 md:py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5 md:mb-7">
          <div>
            <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.18em]">Overview</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">Dashboard</h2>
            <p className="text-sm text-slate-500 mt-1">Manage employee cards and agency records.</p>
          </div>
          <button
            type="button"
            onClick={() => { setEditingEmployee(null); setActiveTab('add'); }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
            Create employee card
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-5 mb-7 md:mb-9">
          <StatCard 
            icon={<Users className="text-indigo-600" />} 
            label="Employees" 
            value={employees.length} 
            color="bg-indigo-50"
            onClick={() => {
              setDashboardView(null);
              setSelectedAgency(null);
              setDirectoryAgencyFilter('');
              setActiveTab('list');
            }}
          />
          <StatCard 
            icon={<ShieldCheck className="text-emerald-600" />} 
            label="Agencies" 
            value={new Set(employees.map(e => e.agencyName)).size} 
            color="bg-emerald-50"
            onClick={() => { setDashboardView('agencies'); setSelectedAgency(null); }}
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
            onClick={() => { setDashboardView('recent'); setSelectedAgency(null); }}
          />
        </div>

        {dashboardView && (
          <DashboardDetails
            view={dashboardView}
            employees={employees}
            selectedAgency={selectedAgency}
            onSelectAgency={setSelectedAgency}
            onShowAgencyEmployees={agency => {
              setDirectoryAgencyFilter(agency);
              setSelectedAgency(null);
              setDashboardView(null);
              setActiveTab('list');
            }}
            onBack={() => {
              if (dashboardView === 'agencies' && selectedAgency) {
                setSelectedAgency(null);
              } else {
                setDashboardView(null);
              }
            }}
          />
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {!isAdmin && !userProfile.agencyName ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-800">
                  Your Admin must assign an agency to your account before you can view or manage employee records.
                </div>
              ) : <EmployeeList
                employees={employees} 
                onDelete={() => {}} 
                onEdit={handleEdit}
                settings={cardDisplaySettings}
                isAdmin={isAdmin}
                isSuperuser={isSuperuser}
                isLoading={isEmployeesLoading}
                canImport={isAdmin ? isSuperuser || Boolean(userProfile.assignedCcc || userProfile.cccId) : Boolean(userProfile.agencyName)}
                filterAgency={directoryAgencyFilter}
                onClearAgencyFilter={() => setDirectoryAgencyFilter('')}
                cccId={userProfile.assignedCcc || userProfile.cccId || settings?.cccName || ''}
                assignedAgency={!isAdmin ? userProfile.agencyName || '' : ''}
              />}
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
              <div className="sr-only">Employee creation is open in a dialog.</div>
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
              <UserManagement
                isSuperuser={isSuperuser}
                assignedCcc={userProfile.assignedCcc || userProfile.cccId || settings?.cccName || ''}
                cccOptions={globalSettings?.cccList || []}
                cccCardLayout={cccCardLayout}
              />
            </motion.div>
          ) : activeTab === 'agencies' && isAdmin ? (
            <motion.div
              key="agencies"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="max-w-5xl mx-auto"
            >
              <AgencyManagement
                isSuperuser={isSuperuser}
                assignedCcc={userProfile.assignedCcc || userProfile.cccId || settings?.cccName || ''}
                cccOptions={globalSettings?.cccList || []}
              />
            </motion.div>
          ) : activeTab === 'card-design' && isAdmin ? (
            <motion.div
              key="card-design"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="max-w-7xl mx-auto"
            >
              <CardDesignSettings
                isSuperuser={isSuperuser}
                assignedCcc={userProfile.assignedCcc || userProfile.cccId || settings?.cccName || ''}
                cccOptions={globalSettings?.cccList || []}
              />
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
              <div className="sr-only">Settings are open in a dialog.</div>
            </motion.div>
          )}
        </AnimatePresence>
        {(editingEmployee || activeTab === 'add') && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={handleCancelEdit}
              aria-label="Close employee form"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="employee-edit-dialog-title"
              className="relative z-10 w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-[32px] shadow-2xl"
            >
              {isAdmin && !isSuperuser && !userProfile.assignedCcc && !userProfile.cccId ? (
                <div role="dialog" aria-modal="true" className="bg-form p-8 rounded-[32px] shadow-xl text-center">
                  <h2 className="text-xl font-black text-slate-900 mb-3">CCC assignment required</h2>
                  <p className="text-sm text-slate-500 mb-5">Ask the Superuser to assign your account to a CCC before creating employee cards.</p>
                  <button type="button" onClick={handleCancelEdit} className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold">Close</button>
                </div>
              ) : !isAdmin && !userProfile.agencyName ? (
                <div role="dialog" aria-modal="true" className="bg-form p-8 rounded-[32px] shadow-xl text-center">
                  <h2 className="text-xl font-black text-slate-900 mb-3">Agency assignment required</h2>
                  <p className="text-sm text-slate-500 mb-5">Ask your CCC Admin to assign an agency before creating employee cards.</p>
                  <button type="button" onClick={handleCancelEdit} className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold">Close</button>
                </div>
              ) : (
                <EmployeeForm
                  onSuccess={() => {
                    setActiveTab('list');
                    setEditingEmployee(null);
                  }}
                  editingEmployee={editingEmployee}
                  onCancel={handleCancelEdit}
                  settings={cardDisplaySettings}
                  cccId={userProfile.assignedCcc || userProfile.cccId || settings?.cccName || ''}
                  assignedAgency={!isAdmin ? userProfile.agencyName || '' : ''}
                  canEditIssueNumber={isAdmin}
                />
              )}
            </div>
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
            <button type="button" className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setActiveTab('list')} aria-label="Close settings" />
            <div role="dialog" aria-modal="true" aria-label="Settings" className="relative z-10 w-full max-w-4xl max-h-[94vh] overflow-y-auto">
              <div className="flex justify-end mb-3">
                <button type="button" onClick={() => setActiveTab('list')} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow">Close settings</button>
              </div>
              <SettingsForm settings={settings} globalSettings={globalSettings} isAdmin={isAdmin} isSuperuser={isSuperuser} assignedCcc={userProfile.assignedCcc || userProfile.cccId || ''} userId={userDocId || user?.uid || ''} />
            </div>
          </div>
        )}
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

function StatCard({ icon, label, value, color, onClick }: { icon: React.ReactNode, label: string, value: number, color: string, onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={`Show ${label.toLowerCase()} data`}
      whileHover={{ y: -5 }}
      className="bg-card-custom p-4 md:p-5 rounded-2xl md:rounded-3xl shadow-sm flex items-center gap-4 border border-slate-100/50 text-left cursor-pointer hover:border-indigo-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-shadow"
    >
      <div className={`w-12 h-12 md:w-14 md:h-14 ${color} rounded-xl md:rounded-2xl flex items-center justify-center shrink-0`}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 24 })}
      </div>
      <div className="overflow-hidden">
        <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
        <p className="text-2xl md:text-3xl font-black text-slate-900">{value}</p>
      </div>
      <span className="ml-auto text-xs font-bold text-indigo-600">View <span aria-hidden="true">→</span></span>
    </motion.button>
  );
}

function DashboardDetails({
  view,
  employees,
  selectedAgency,
  onSelectAgency,
  onShowAgencyEmployees,
  onBack,
}: {
  view: 'employees' | 'agencies' | 'recent';
  employees: Employee[];
  selectedAgency: string | null;
  onSelectAgency: (agency: string | null) => void;
  onShowAgencyEmployees: (agency: string) => void;
  onBack: () => void;
}) {
  const agencies = Array.from(new Map(
    employees
      .map(employee => employee.agencyName?.trim())
      .filter((agency): agency is string => Boolean(agency))
      .map(agency => [agency.toLocaleLowerCase(), agency])
  ).values()).sort((a, b) => a.localeCompare(b));

  const recentEmployees = employees.filter(employee => {
    if (!employee.issueDate) return false;
    const issueDate = new Date(employee.issueDate);
    const now = new Date();
    return issueDate.getMonth() === now.getMonth() && issueDate.getFullYear() === now.getFullYear();
  });

  const agencyEmployees = selectedAgency
    ? employees.filter(employee => employee.agencyName?.trim().toLocaleLowerCase() === selectedAgency.toLocaleLowerCase())
    : [];
  const title = view === 'agencies' && selectedAgency
    ? selectedAgency
    : view === 'employees' ? 'All Employees' : view === 'agencies' ? 'Agencies' : 'Recent Employees';
  const shownEmployees = view === 'employees' ? employees : view === 'recent' ? recentEmployees : agencyEmployees;

  return (
    <section className="bg-card-custom rounded-[24px] md:rounded-[32px] border border-slate-200/60 shadow-sm p-5 md:p-8 mb-8" aria-live="polite">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Dashboard details</p>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-1">{title}</h2>
          <p className="text-xs text-slate-400 mt-1">Shared employee directory visible to all Admins.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black hover:bg-slate-200"
        >
          {view === 'agencies' && selectedAgency ? 'All agencies' : 'Close'}
        </button>
      </div>

      {view === 'agencies' && !selectedAgency ? (
        agencies.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {agencies.map(agency => {
              const count = employees.filter(employee => employee.agencyName?.trim().toLocaleLowerCase() === agency.toLocaleLowerCase()).length;
              return (
                <button
                  key={agency}
                  type="button"
                  onClick={() => onShowAgencyEmployees(agency)}
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-100 bg-white text-left hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                >
                  <span className="font-black text-slate-800">{agency}</span>
                  <span className="text-xs font-bold text-slate-400">{count} employee{count === 1 ? '' : 's'}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm font-bold text-slate-400">No agency records found.</p>
        )
      ) : shownEmployees.length ? (
        <div className="space-y-2">
          {shownEmployees.map((employee, index) => (
            <div key={employee.id || `${employee.name}-${index}`} className="grid gap-1 sm:grid-cols-2 p-4 rounded-2xl border border-slate-100 bg-white">
              <div>
                <p className="font-black text-slate-900">{employee.name}</p>
                <p className="text-xs font-bold text-indigo-500">{employee.designation}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-bold text-slate-600">{employee.agencyName}</p>
                <p className="text-xs text-slate-400">
                  {[employee.contactNumber, employee.issueDate].filter(Boolean).join(' · ') || 'No contact or issue date'}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm font-bold text-slate-400">
          {view === 'recent' ? 'No employees issued cards this month.' : 'No employees found for this agency.'}
        </p>
      )}
    </section>
  );
}

function SettingsForm({ settings, globalSettings, isAdmin, isSuperuser, assignedCcc, userId }: { settings: any, globalSettings: any, isAdmin: boolean, isSuperuser: boolean, assignedCcc: string, userId: string }) {
  const [formData, setFormData] = useState({
    officePhone: '',
    officeEmail: '',
    issuingAuthority: '',
    emergencyTag: '',
    cccName: ''
  });
  const [saveToGlobal, setSaveToGlobal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cccList, setCccList] = useState<string[]>([]);
  const [newCcc, setNewCcc] = useState('');
  const [savingCccList, setSavingCccList] = useState(false);
  const [cccListError, setCccListError] = useState('');

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

  useEffect(() => {
    const storedList = globalSettings?.cccList;
    const sourceList = Array.isArray(storedList)
      ? storedList
      : [globalSettings?.cccName || settings?.cccName].filter(Boolean);
    setCccList([...new Set(sourceList.filter((name: unknown): name is string => typeof name === 'string').map((name: string) => name.trim()).filter(Boolean))]);
  }, [globalSettings, settings]);

  const handleAddCcc = () => {
    const trimmed = newCcc.trim();
    if (!trimmed) return;
    if (cccList.some(name => name.toLowerCase() === trimmed.toLowerCase())) {
      setCccListError('That CCC is already in the list.');
      return;
    }
    setCccList([...cccList, trimmed]);
    setNewCcc('');
    setCccListError('');
  };

  const handleRemoveCcc = async (cccName: string) => {
    setCccListError('');
    try {
      const [admins, editors, legacyProfiles, employees, legacyEmployees] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('cccId', '==', cccName))),
        getDocs(query(collection(db, 'users'), where('assignedCcc', '==', cccName))),
        getDocs(query(collection(db, 'users'), where('cccName', '==', cccName))),
        getDocs(query(collection(db, 'employees'), where('cccId', '==', cccName))),
        getDocs(query(collection(db, 'employees'), where('cccName', '==', cccName)))
      ]);
      if (!admins.empty || !editors.empty || !legacyProfiles.empty || !employees.empty || !legacyEmployees.empty) {
        setCccListError('This CCC is assigned to users or employee records and cannot be removed.');
        return;
      }
      setCccList(current => current.filter(name => name !== cccName));
    } catch (error) {
      console.error('Failed to check CCC assignments:', error);
      setCccListError(error instanceof Error ? error.message : 'Could not verify whether this CCC is assigned.');
    }
  };

  const handleSaveCccList = async () => {
    const normalized = [...new Set(cccList.map(name => name.trim()).filter(Boolean))];
    if (normalized.length === 0) {
      setCccListError('Keep at least one CCC in the list.');
      return;
    }
    setSavingCccList(true);
    setCccListError('');
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...(globalSettings || settings),
        cccList: normalized
      }, { merge: true });
    } catch (error) {
      console.error('Failed to save CCC list:', error);
      setCccListError(error instanceof Error ? error.message : 'Could not save the CCC list.');
    } finally {
      setSavingCccList(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdmin && !isSuperuser && !assignedCcc) {
      alert('Ask the Superuser to assign your account to a CCC before saving settings.');
      return;
    }
    setLoading(true);
    try {
      if (saveToGlobal && isSuperuser) {
        const { cccName, ...globalDefaults } = formData;
        const batch = writeBatch(db);
        batch.set(doc(db, 'settings', 'global'), {
          ...globalDefaults,
          cccName: globalSettings?.cccName || 'Falakata Customer Care Center',
          cccList
        });
        batch.set(doc(db, 'users', userId), {
          cccName: assignedCcc || cccName,
          officePhone: deleteField(),
          officeEmail: deleteField(),
          issuingAuthority: deleteField(),
          emergencyTag: deleteField()
        }, { merge: true });
        await batch.commit();
      } else {
        await setDoc(doc(db, 'users', userId), {
          ...formData,
          ...(isAdmin && !isSuperuser ? { cccName: assignedCcc } : {})
        }, { merge: true });
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
        {isSuperuser && (
          <div className="flex items-center gap-3 p-3 md:p-4 bg-slate-50 rounded-xl md:rounded-2xl border border-slate-100 mb-4 md:mb-6">
            <input
              type="checkbox"
              id="saveToGlobal"
              checked={saveToGlobal}
              onChange={(e) => setSaveToGlobal(e.target.checked)}
              className="w-4 h-4 md:w-5 md:h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="saveToGlobal" className="text-xs md:text-sm font-bold text-slate-700">
              Update Global System Defaults
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
          <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isSuperuser ? 'Office Name' : isAdmin ? 'Assigned CCC' : 'CCC Name (Portal Header)'}
          </label>
          <input
            type="text"
            value={isAdmin && !isSuperuser ? assignedCcc : formData.cccName}
            onChange={(e) => setFormData({ ...formData, cccName: e.target.value })}
            readOnly={isAdmin && !isSuperuser}
            className="w-full px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm"
            placeholder={isAdmin && !isSuperuser ? 'Assigned by the Superuser' : 'e.g. Falakata Customer Care Center'}
            required={isAdmin}
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
      {isSuperuser && (
        <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby="ccc-list-heading">
          <h4 id="ccc-list-heading" className="text-lg font-black text-slate-900">CCC options</h4>
          <p className="mt-1 mb-4 text-sm text-slate-500">Admins must be assigned to one of these CCCs. Only listed CCCs can be assigned.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newCcc}
              onChange={event => setNewCcc(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); handleAddCcc(); } }}
              placeholder="CCC name"
              className="min-w-0 flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm"
            />
            <button type="button" onClick={handleAddCcc} className="px-5 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-black text-sm hover:bg-indigo-100">Add CCC</button>
          </div>
          <ul className="mt-4 space-y-2">
            {cccList.map(ccc => (
              <li key={ccc} className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-bold text-slate-700">{ccc}</span>
                <button type="button" onClick={() => void handleRemoveCcc(ccc)} className="text-xs font-black text-red-600 hover:text-red-800">Remove</button>
              </li>
            ))}
          </ul>
          {cccListError && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{cccListError}</p>}
          <button type="button" disabled={savingCccList} onClick={() => void handleSaveCccList()} className="mt-5 w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 disabled:opacity-50">
            {savingCccList ? 'Saving CCC list...' : 'Save CCC list'}
          </button>
        </section>
      )}
    </div>
  );
}

function UserManagement({ isSuperuser, assignedCcc, cccOptions, cccCardLayout }: { isSuperuser: boolean; assignedCcc: string; cccOptions: string[]; cccCardLayout: CardSettings }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [userCcc, setUserCcc] = useState(assignedCcc);
  const [agencyName, setAgencyName] = useState('');
  const [agencyNames, setAgencyNames] = useState<string[]>([]);
  const [savedAgencyNames, setSavedAgencyNames] = useState<string[]>([]);
  const [agencyListDocumentId, setAgencyListDocumentId] = useState<string | null>(null);
  const [agencyListLoaded, setAgencyListLoaded] = useState(false);
  const [newAgency, setNewAgency] = useState('');
  const [agencyError, setAgencyError] = useState('');
  const [savingAgencies, setSavingAgencies] = useState(false);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isAgencyManagerOpen, setIsAgencyManagerOpen] = useState(false);
  const [role, setRole] = useState<'admin' | 'editor'>('editor');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [cardSettingsUser, setCardSettingsUser] = useState<any | null>(null);
  const [savingCardSettings, setSavingCardSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [managementLoadError, setManagementLoadError] = useState('');
  const managementCcc = isSuperuser ? userCcc : assignedCcc;

  const saveUserCardSettings = async (cardSettings: CardSettings) => {
    if (!cardSettingsUser?.id) throw new Error('Choose a user profile before saving card settings.');
    setSavingCardSettings(true);
    try {
      await updateDoc(doc(db, 'users', cardSettingsUser.id), { cardSettings, updatedAt: serverTimestamp() });
    } finally {
      setSavingCardSettings(false);
    }
  };

  const resetUserCardSettings = async () => {
    if (!cardSettingsUser?.id) return;
    setSavingCardSettings(true);
    try {
      await updateDoc(doc(db, 'users', cardSettingsUser.id), { cardSettings: deleteField(), updatedAt: serverTimestamp() });
      setCardSettingsUser(null);
    } catch (error) {
      console.error('Could not reset the user card settings:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not reset personal card settings.');
    } finally {
      setSavingCardSettings(false);
    }
  };

  useEffect(() => {
    setAgencyNames([]);
    setSavedAgencyNames([]);
    setAgencyListDocumentId(null);
    setAgencyListLoaded(false);
    setAgencyError('');
    if (!managementCcc) {
      return;
    }
    let active = true;
    const agenciesQuery = query(collection(db, 'cccAgencies'), where('cccId', '==', managementCcc));
    void getDocs(agenciesQuery).then(snapshot => {
      if (!active) return;
      const agencyDocument = snapshot.docs[0];
      const savedAgencyNames = agencyDocument?.data().agencyNames;
      const savedNames: string[] = Array.isArray(savedAgencyNames)
        ? [...new Set(savedAgencyNames.filter((name: unknown): name is string => typeof name === 'string').map((name: string) => name.trim()).filter(Boolean))]
        : [];
      setAgencyListDocumentId(agencyDocument?.id || null);
      setAgencyNames(savedNames);
      setSavedAgencyNames(savedNames);
      setAgencyListLoaded(true);
    }).catch(error => {
      console.error('Agency list load failed:', error);
      setAgencyError(isSuperuser
        ? 'Could not load the agency list. Verify this account has a verified Admin profile with isSuperuser: true and that the current Firestore rules are deployed.'
        : 'Could not load the agency list for this CCC.');
    });
    return () => { active = false; };
  }, [isSuperuser, managementCcc]);

  useEffect(() => {
    if (!isSuperuser && !assignedCcc) {
      setUsers([]);
      setManagementLoadError('');
      return;
    }
    setManagementLoadError('');
    const usersQuery = isSuperuser
      ? collection(db, 'users')
      : query(collection(db, 'users'), where('cccId', '==', assignedCcc));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("User Management Snapshot Error:", error);
      setManagementLoadError(isSuperuser
        ? 'Could not load authorized users. Verify this account has a verified Admin profile with isSuperuser: true and that the current Firestore rules are deployed.'
        : 'Could not load authorized users. Please check access and try again.');
    });
    return () => unsubscribe();
  }, [isSuperuser, assignedCcc]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const nextCcc = (isSuperuser ? userCcc : assignedCcc).trim();
    const nextRole = isSuperuser ? role : 'editor';
    if (!nextCcc) {
      setErrorMessage('A CCC assignment is required.');
      return;
    }
    if (!cccOptions.includes(nextCcc)) {
      setErrorMessage('Choose a CCC from the Superuser-managed list.');
      return;
    }
    const nextAgency = agencyName.trim();
    if (nextRole === 'editor' && !agencyNames.includes(nextAgency)) {
      setErrorMessage('Choose an agency from this CCC’s Admin-managed agency list.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    const userData = {
      email: email.trim().toLowerCase(),
      name: displayName.trim(),
      phone: phone.trim(),
      role: nextRole,
      cccId: nextCcc,
      cccName: nextCcc,
      updatedAt: new Date()
    };
    try {
      if (editingUser) {
        const profileUpdate = {
          ...userData,
          assignedCcc: nextRole === 'admin' ? nextCcc : deleteField(),
          agencyName: nextRole === 'editor' ? nextAgency : deleteField()
        };
        const canonicalId = email.trim().toLowerCase();
        const canonicalRef = doc(db, 'users', canonicalId);
        const batch = writeBatch(db);
        if (editingUser.id === canonicalId) {
          batch.update(canonicalRef, profileUpdate);
        } else {
          const legacyProfile = { ...editingUser };
          delete legacyProfile.id;
          const migratedProfile = { ...legacyProfile, ...userData, createdAt: editingUser.createdAt || new Date() };
          if (nextRole === 'admin') {
            migratedProfile.assignedCcc = nextCcc;
            delete migratedProfile.agencyName;
          } else {
            migratedProfile.agencyName = nextAgency;
            delete migratedProfile.assignedCcc;
          }
          batch.set(canonicalRef, migratedProfile);
          batch.delete(doc(db, 'users', editingUser.id));
        }
        await batch.commit();
        setEditingUser(null);
      } else {
        await setDoc(doc(db, 'users', email.trim().toLowerCase()), {
          ...userData,
          ...(nextRole === 'admin' ? { assignedCcc: nextCcc } : { agencyName: nextAgency }),
          createdAt: new Date(),
          addedBy: auth.currentUser?.email
        });
      }
      setEmail('');
      setDisplayName('');
      setPhone('');
      setUserCcc(assignedCcc);
      setAgencyName('');
      setRole('editor');
      setIsUserFormOpen(false);
    } catch (error) {
      console.error("Error saving user:", error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not save this user.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: any) => {
    if (user.isSuperuser === true) return;
    setEditingUser(user);
    setEmail(user.email);
    setDisplayName(user.name || '');
    setPhone(user.phone || '');
    setUserCcc(user.assignedCcc || user.cccId || '');
    setAgencyName(user.agencyName || '');
    setRole(user.role);
  };

  const handleDelete = async (id: string) => {
    const target = users.find(user => user.id === id);
    if (!target || target.isSuperuser === true) return;
    if (!window.confirm("Are you sure you want to remove this user's access?")) return;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (error) {
      console.error("Error deleting user:", error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not remove this user.');
    }
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEmail('');
    setDisplayName('');
    setPhone('');
    setUserCcc(assignedCcc);
    setAgencyName('');
    setRole('editor');
    setErrorMessage('');
    setIsUserFormOpen(false);
  };

  const addAgencyToList = () => {
    const name = newAgency.trim();
    if (!name) return;
    if (agencyNames.some(existing => existing.toLowerCase() === name.toLowerCase())) {
      setAgencyError('That agency is already in the list.');
      return;
    }
    setAgencyNames(current => [...current, name]);
    setNewAgency('');
    setAgencyError('');
  };

  const removeAgencyFromList = async (name: string) => {
    if (!managementCcc) return;
    setAgencyError('');
    try {
      const [employees, legacyEmployees, users] = await Promise.all([
        getDocs(query(collection(db, 'employees'), where('agencyName', '==', name), where('cccId', '==', managementCcc))),
        getDocs(query(collection(db, 'employees'), where('agencyName', '==', name), where('cccName', '==', managementCcc))),
        getDocs(query(collection(db, 'users'), where('agencyName', '==', name), where('cccId', '==', managementCcc)))
      ]);
      if (!employees.empty || !legacyEmployees.empty || !users.empty) {
        setAgencyError('This agency is assigned to employee records or users and cannot be removed.');
        return;
      }
      setAgencyNames(current => current.filter(agency => agency !== name));
    } catch (error) {
      console.error('Could not check agency assignments:', error);
      setAgencyError(error instanceof Error ? error.message : 'Could not verify whether the agency is assigned.');
    }
  };

  const saveAgencyList = async () => {
    if (!agencyListLoaded) {
      setAgencyError('The agency list could not be loaded. Resolve the access error before saving to avoid overwriting existing agencies.');
      return;
    }
    if (!managementCcc) {
      setAgencyError('Select a CCC before managing its agencies.');
      return;
    }
    setSavingAgencies(true);
    setAgencyError('');
    try {
      const normalizedAgencyNames = [...new Set(agencyNames.map(name => name.trim()).filter(Boolean))];
      const documentId = agencyListDocumentId || encodeURIComponent(managementCcc);
      await setDoc(doc(db, 'cccAgencies', documentId), {
        cccId: managementCcc,
        agencyNames: normalizedAgencyNames
      });
      setAgencyListDocumentId(documentId);
      setAgencyNames(normalizedAgencyNames);
      setSavedAgencyNames(normalizedAgencyNames);
      setIsAgencyManagerOpen(false);
    } catch (error) {
      console.error('Could not save CCC agencies:', error);
      setAgencyError(error instanceof Error ? error.message : 'Could not save the agency list.');
    } finally {
      setSavingAgencies(false);
    }
  };

  const closeAgencyManager = () => {
    setAgencyNames(savedAgencyNames);
    setNewAgency('');
    setAgencyError('');
    setIsAgencyManagerOpen(false);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-slate-500">Create accounts and assign CCC access.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setIsAgencyManagerOpen(true)} className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-black hover:bg-slate-50">
            Manage agencies
          </button>
          <button type="button" onClick={() => { cancelEdit(); setIsUserFormOpen(true); }} className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700">
            {isSuperuser ? 'Create user' : 'Create Editor'}
          </button>
        </div>
      </div>
      {managementLoadError && <p role="alert" className="text-sm font-bold text-red-700">{managementLoadError}</p>}
      {(editingUser || isUserFormOpen) && (
        <button
          type="button"
          className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm"
          onClick={cancelEdit}
          aria-label="Close user editor"
        />
      )}
      {(editingUser || isUserFormOpen) && <div className="fixed inset-0 z-[71] flex items-center justify-center p-3 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-edit-dialog-title"
          className="bg-form p-6 md:p-10 rounded-[32px] md:rounded-[48px] shadow-xl shadow-indigo-500/5 border border-slate-100 relative w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h3 id="user-edit-dialog-title" className="text-xl md:text-2xl font-black text-slate-900">
              {editingUser ? 'Manage User Profile' : isSuperuser ? 'Create Admin or Editor' : 'Create CCC Editor'}
            </h3>
            {(editingUser || isUserFormOpen) && (
              <button
                onClick={cancelEdit}
                type="button"
                className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-xs md:text-sm"
              >
                <X size={16} />
                Close
              </button>
            )}
          </div>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="User Email Address"
            className="px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm"
            readOnly={Boolean(editingUser)}
            required
          />
          <input type="text" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Display name" className="px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm" />
          <input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="Phone number" className="px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm" />
          {isSuperuser ? (
            <>
              <select value={role} onChange={event => setRole(event.target.value as 'admin' | 'editor')} className="px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm">
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
              <select value={cccOptions.includes(userCcc) ? userCcc : ''} onChange={event => setUserCcc(event.target.value)} className="px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm" required>
                <option value="" disabled>Select assigned CCC</option>
                {cccOptions.map(ccc => <option key={ccc} value={ccc}>{ccc}</option>)}
              </select>
            </>
          ) : (
            <div className="flex items-center px-4 md:px-6 py-3 bg-slate-50 border border-slate-200 rounded-xl md:rounded-[20px] text-sm font-bold text-slate-500">
              Assigned CCC: {assignedCcc || 'Not assigned'}
            </div>
          )}
          {role === 'editor' && (
            <select
              value={agencyNames.includes(agencyName) ? agencyName : ''}
              onChange={event => setAgencyName(event.target.value)}
              className="px-4 md:px-6 py-3 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-[20px] outline-none focus:border-indigo-500 font-bold text-sm"
              required
            >
              <option value="" disabled>Select assigned agency</option>
              {agencyNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          )}
          <button
            type="submit"
            disabled={loading}
            className="md:col-span-2 bg-indigo-600 text-white font-black px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-[20px] hover:bg-indigo-700 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'Saving...' : editingUser ? 'Save Profile' : 'Authorize User'}
          </button>
          </form>
          {errorMessage && <p role="alert" className="mt-4 text-sm font-bold text-red-700">{errorMessage}</p>}
        </div>
      </div>}

      {isAgencyManagerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm"
          onClick={closeAgencyManager}
          aria-label="Close agency manager"
        />
      )}
      {isAgencyManagerOpen && (
        <div className="fixed inset-0 z-[71] flex items-center justify-center p-3 sm:p-6">
        <section role="dialog" aria-modal="true" aria-labelledby="agency-list-title" className="bg-form p-6 md:p-10 rounded-[32px] md:rounded-[48px] shadow-2xl border border-slate-100 relative w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-3">
            <h3 id="agency-list-title" className="text-xl md:text-2xl font-black text-slate-900">Agencies for {managementCcc || 'selected CCC'}</h3>
            <button type="button" onClick={closeAgencyManager} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold">Close</button>
          </div>
          {isSuperuser && (
            <select value={cccOptions.includes(userCcc) ? userCcc : ''} onChange={event => setUserCcc(event.target.value)} className="mt-4 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm">
              <option value="" disabled>Select a CCC to manage</option>
              {cccOptions.map(ccc => <option key={ccc} value={ccc}>{ccc}</option>)}
            </select>
          )}
          <p className="mt-2 text-sm text-slate-500">Add agency names here. Editors can only be assigned to an agency in this list.</p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newAgency}
              onChange={event => setNewAgency(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addAgencyToList(); } }}
              placeholder="Agency name"
              className="min-w-0 flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm"
            />
            <button type="button" onClick={addAgencyToList} disabled={!managementCcc || !agencyListLoaded} className="px-5 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-black text-sm hover:bg-indigo-100 disabled:opacity-50">Add agency</button>
          </div>
          {!agencyListLoaded && !agencyError && <p role="status" className="mt-3 text-sm font-bold text-slate-500">Loading agency list...</p>}
          <ul className="mt-4 space-y-2">
            {agencyNames.map(name => (
              <li key={name} className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-bold text-slate-700">{name}</span>
                <button type="button" onClick={() => void removeAgencyFromList(name)} className="text-xs font-black text-red-600 hover:text-red-800">Remove</button>
              </li>
            ))}
          </ul>
          {agencyError && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{agencyError}</p>}
          <button type="button" disabled={savingAgencies || !managementCcc || !agencyListLoaded} onClick={() => void saveAgencyList()} className="mt-5 w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 disabled:opacity-50">
            {savingAgencies ? 'Saving agencies...' : 'Save agency list'}
          </button>
        </section>
        </div>
      )}

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
                  <p className="font-black text-slate-900 text-sm md:text-base">{u.name || u.email}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                  <p className="text-[8px] md:text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5 md:mt-1">
                    {u.role} · {u.assignedCcc || u.cccId || 'CCC not assigned'}{u.agencyName ? ` · ${u.agencyName}` : ''}{u.phone ? ` · ${u.phone}` : ''}
                  </p>
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
                    type="button"
                    onClick={() => setCardSettingsUser(u)}
                    className="p-2 md:p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg md:rounded-xl transition-all"
                    title="Set user card settings"
                    aria-label={`Set card settings for ${u.name || u.email}`}
                  >
                    <Paintbrush size={16} className="md:hidden" />
                    <Paintbrush size={18} className="hidden md:block" />
                  </button>
                  <button
                    onClick={() => handleEdit(u)}
                    disabled={u.isSuperuser === true || (!isSuperuser && u.role !== 'editor')}
                    className="p-2 md:p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg md:rounded-xl transition-all"
                    title="Edit User"
                  >
                    <Edit2 size={16} className="md:hidden" />
                    <Edit2 size={18} className="hidden md:block" />
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    disabled={u.isSuperuser === true || (!isSuperuser && u.role !== 'editor')}
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
      {cardSettingsUser && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
          <button type="button" className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setCardSettingsUser(null)} aria-label="Close user card settings" />
          <section role="dialog" aria-modal="true" aria-labelledby="user-card-settings-title" className="relative z-10 w-full max-w-7xl max-h-[94vh] overflow-y-auto rounded-[32px] bg-white p-5 md:p-8 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 id="user-card-settings-title" className="text-xl font-black text-slate-900">Card settings: {cardSettingsUser.name || cardSettingsUser.email}</h3>
                <p className="text-sm text-slate-500">This personal design overrides the CCC default for this user.</p>
              </div>
              <button type="button" onClick={() => setCardSettingsUser(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">Close</button>
            </div>
            <CardSettingsEditor
              initialSettings={cardSettingsUser.cardSettings ?? cccCardLayout}
              onSave={saveUserCardSettings}
              saving={savingCardSettings}
            />
            {cardSettingsUser.cardSettings && (
              <button type="button" disabled={savingCardSettings} onClick={() => void resetUserCardSettings()} className="mt-5 rounded-xl bg-amber-50 px-5 py-3 text-sm font-black text-amber-800 disabled:opacity-50">
                Reset to CCC default
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
