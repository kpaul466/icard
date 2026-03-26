import React, { useState, useEffect } from 'react';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Employee } from './types';
import { EmployeeForm } from './components/EmployeeForm';
import { EmployeeList } from './components/EmployeeList';
import { LogIn, LogOut, ShieldCheck, CreditCard, Users, Calendar, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
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
              <h1 className="text-2xl font-black text-slate-900 leading-none tracking-tight">Falakata CCC</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">ID Management Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-black text-slate-900">{user.displayName}</span>
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">System Admin</span>
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
              />
            </motion.div>
          ) : (
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
              />
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
