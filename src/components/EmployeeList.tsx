import React, { useRef, useState } from 'react';
import { Employee } from '../types';
import { IDCard } from './IDCard';
import { useReactToPrint } from 'react-to-print';
import { Printer, Trash2, Search, Filter, Download, Users, FileText, Image as ImageIcon, ChevronDown, Plus } from 'lucide-react';
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getPhotoUrl } from '../lib/firebaseUtils';

interface EmployeeListProps {
  employees: Employee[];
  onDelete: () => void;
  onEdit: (employee: Employee) => void;
  settings: any;
  isAdmin?: boolean;
  isLoading?: boolean;
}

export function EmployeeList({ employees, onDelete, onEdit, settings, isAdmin, isLoading }: EmployeeListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.agencyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.createdBy?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.creatorEmail && emp.creatorEmail.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading records...</p>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card-custom p-10 md:p-20 rounded-[32px] md:rounded-[40px] border border-dashed border-slate-200 text-center shadow-sm"
      >
        <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Users size={28} className="text-slate-300 md:hidden" />
          <Users size={32} className="text-slate-300 hidden md:block" />
        </div>
        <h3 className="text-lg md:text-xl font-black text-slate-900 mb-2">
          {isAdmin ? 'No Records Found' : 'Your Personal Directory is Empty'}
        </h3>
        <p className="text-slate-400 text-xs md:text-sm font-medium max-w-xs mx-auto">
          {isAdmin 
            ? 'Start by generating a new ID card for your employees or contractors.' 
            : 'You haven\'t created any ID cards yet. As a staff member, you can only see records you have personally generated.'}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* List Header/Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card-custom p-4 rounded-[24px] md:rounded-[28px] border border-slate-200/60 shadow-sm">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, ID or agency..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl md:rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-5 py-3 bg-slate-50 text-slate-600 rounded-xl md:rounded-2xl text-xs md:text-sm font-black hover:bg-slate-100 transition-all">
            <Filter size={18} />
            Filter
          </button>
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-5 py-3 bg-indigo-600 text-white rounded-xl md:rounded-2xl text-xs md:text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {filteredEmployees.map((employee, index) => (
          <EmployeeListItem key={employee.id || index} employee={employee} onDelete={onDelete} onEdit={onEdit} index={index} settings={settings} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  );
}

const EmployeeListItem: React.FC<{ employee: Employee; onDelete: () => void; onEdit: (employee: Employee) => void; index: number; settings: any; isAdmin?: boolean }> = ({ employee, onDelete, onEdit, index, settings, isAdmin }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showActions, setShowActions] = useState(false);
  
  const handlePrint = useReactToPrint({
    contentRef: cardRef,
    documentTitle: `ID_Card_${employee.name.replace(/\s+/g, '_')}`,
  });

  const downloadImage = async (format: 'png' | 'jpg') => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const options = {
        pixelRatio: 4, // HD Quality
        backgroundColor: 'transparent',
      };
      
      let dataUrl;
      if (format === 'png') {
        dataUrl = await toPng(cardRef.current, options);
      } else {
        dataUrl = await toJpeg(cardRef.current, { ...options, quality: 1 });
      }
      
      const link = document.createElement('a');
      link.download = `ID_Card_${employee.name.replace(/\s+/g, '_')}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error downloading image:', err);
    } finally {
      setIsDownloading(false);
      setIsDownloadOpen(false);
    }
  };

  const downloadPdf = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 4 });
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'cm',
        format: [8.56, 5.4]
      });
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, 8.56, 5.4);
      pdf.save(`ID_Card_${employee.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Error downloading PDF:', err);
    } finally {
      setIsDownloading(false);
      setIsDownloadOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!employee.id) return;
    if (!window.confirm(`Are you sure you want to delete ${employee.name}?`)) return;

    try {
      await deleteDoc(doc(db, 'employees', employee.id));
      onDelete();
    } catch (error) {
      console.error('Error deleting employee:', error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card-custom p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-sm flex flex-col gap-6 md:gap-8 group hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div 
          className="flex items-center gap-4 md:gap-5 cursor-pointer select-none group/header"
          onClick={() => setShowActions(!showActions)}
        >
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner shrink-0 group-hover/header:scale-105 transition-transform">
            {getPhotoUrl(employee.photoUrl) ? (
              <img src={getPhotoUrl(employee.photoUrl)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Users size={20} className="md:hidden" />
                <Users size={24} className="hidden md:block" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">{employee.name}</h3>
              <motion.div
                animate={{ rotate: showActions ? 180 : 0 }}
                className="text-slate-400"
              >
                <ChevronDown size={18} />
              </motion.div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-[8px] md:text-[10px] font-black text-indigo-500 uppercase tracking-widest">{employee.designation}</span>
              <span className="hidden sm:block w-1 h-1 bg-slate-200 rounded-full"></span>
              <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tight">{employee.agencyName}</span>
              {isAdmin && employee.creatorEmail && (
                <>
                  <span className="hidden sm:block w-1 h-1 bg-slate-200 rounded-full"></span>
                  <span className="text-[8px] md:text-[10px] font-bold text-indigo-400/60 uppercase tracking-tight" title={`Created by: ${employee.creatorEmail}`}>
                    By: {employee.creatorEmail.split('@')[0]}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <AnimatePresence>
          {showActions && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-wrap gap-2 w-full sm:w-auto"
            >
              <button
                onClick={() => onEdit(employee)}
                className="flex-1 sm:flex-none w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl md:rounded-2xl hover:bg-amber-600 hover:text-white transition-all duration-300 shadow-sm"
                title="Edit Record"
              >
                <Plus size={18} className="rotate-45 md:hidden" />
                <Plus size={20} className="rotate-45 hidden md:block" />
              </button>
              <div className="relative flex-1 sm:flex-none">
                <button
                  onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                  disabled={isDownloading}
                  className="w-full sm:w-12 h-10 md:h-12 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl md:rounded-2xl hover:bg-indigo-600 hover:text-white transition-all duration-300 shadow-sm disabled:opacity-50"
                  title="Download Options"
                >
                  {isDownloading ? (
                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Download size={18} className="md:hidden" />
                      <Download size={20} className="hidden md:block" />
                    </>
                  )}
                </button>
                
                <AnimatePresence>
                  {isDownloadOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 mt-3 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50"
                    >
                      <div className="px-3 py-2 border-b border-slate-50 mb-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Standard Size</p>
                        <p className="text-[10px] font-bold text-slate-600">8.56cm x 5.4cm</p>
                      </div>
                      <button
                        onClick={() => downloadPdf()}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"
                      >
                        <FileText size={16} />
                        Download PDF (HD)
                      </button>
                      <button
                        onClick={() => downloadImage('png')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"
                      >
                        <ImageIcon size={16} />
                        Download PNG (HD)
                      </button>
                      <button
                        onClick={() => downloadImage('jpg')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"
                      >
                        <ImageIcon size={16} />
                        Download JPG (HD)
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => handlePrint()}
                className="flex-1 sm:flex-none w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-slate-50 text-slate-600 rounded-xl md:rounded-2xl hover:bg-slate-900 hover:text-white transition-all duration-300 shadow-sm"
                title="Print ID Card"
              >
                <Printer size={18} className="md:hidden" />
                <Printer size={20} className="hidden md:block" />
              </button>
              
              <button
                onClick={handleDelete}
                className="flex-1 sm:flex-none w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-red-50 text-red-600 rounded-xl md:rounded-2xl hover:bg-red-600 hover:text-white transition-all duration-300 shadow-sm"
                title="Delete Record"
              >
                <Trash2 size={18} className="md:hidden" />
                <Trash2 size={20} className="hidden md:block" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-center bg-slate-50/50 p-4 md:p-8 rounded-[24px] md:rounded-[32px] border border-slate-100 relative overflow-hidden group-hover:bg-slate-50 transition-colors duration-500">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2"></div>
        
        <div className="relative z-10 scale-[0.75] sm:scale-90 md:scale-100 transition-transform duration-500 group-hover:scale-[1.02]">
          <IDCard ref={cardRef} employee={employee} settings={settings} />
        </div>
      </div>
    </motion.div>
  );
}
