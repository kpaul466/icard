import React, { useEffect, useRef, useState } from 'react';
import { Employee } from '../types';
import { IDCard } from './IDCard';
import { useReactToPrint } from 'react-to-print';
import { Printer, Trash2, Search, Filter, Download, Users, FileText, Image as ImageIcon, ChevronDown, Pencil } from 'lucide-react';
import { db } from '../firebase';
import { doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getPhotoUrl } from '../lib/firebaseUtils';
import { EmployeeImport } from './EmployeeImport';

interface EmployeeListProps {
  employees: Employee[];
  onDelete: () => void;
  onEdit: (employee: Employee) => void;
  settings: any;
  isAdmin?: boolean;
  isSuperuser?: boolean;
  isLoading?: boolean;
  canImport?: boolean;
  filterAgency?: string;
  onClearAgencyFilter?: () => void;
  cccId?: string;
  assignedAgency?: string;
}

export function EmployeeList({ employees, onDelete, onEdit, settings, isAdmin, isSuperuser, isLoading, canImport, filterAgency, onClearAgencyFilter, cccId, assignedAgency }: EmployeeListProps) {
  const multiPrintRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [cccIssueNumbers, setCccIssueNumbers] = useState<Record<string, string>>({});

  const cccIdsKey = [...new Set(employees
    .map(employee => employee.cccId || employee.cccName)
    .filter((cccId): cccId is string => Boolean(cccId)))].join('\u0000');

  useEffect(() => {
    if (!cccIdsKey) {
      setCccIssueNumbers({});
      return;
    }

    const unsubscribers = cccIdsKey.split('\u0000').map(cccId =>
      onSnapshot(doc(db, 'cccCardSettings', cccId), snapshot => {
        const issueNo = snapshot.data()?.cardSettings?.defaultIssueNo;
        setCccIssueNumbers(current => ({
          ...current,
          [cccId]: typeof issueNo === 'string' ? issueNo : ''
        }));
      }, error => {
        console.error(`Could not load issue number for CCC "${cccId}":`, error);
      })
    );
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [cccIdsKey]);

  const getConfiguredIssueNo = (employee: Employee) =>
    cccIssueNumbers[employee.cccId || employee.cccName || ''] || settings?.cardSettings?.defaultIssueNo || '';

  useEffect(() => {
    setAgencyFilter(filterAgency || '');
  }, [filterAgency]);

  const agencies = [...new Set(employees.map(employee => employee.agencyName?.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const designations = [...new Set(employees.map(employee => employee.designation?.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || (
      (emp.name && emp.name.toLowerCase().includes(query)) ||
      (emp.agencyName && emp.agencyName.toLowerCase().includes(query)) ||
      (emp.designation && emp.designation.toLowerCase().includes(query)) ||
      (emp.contactNumber && emp.contactNumber.toLowerCase().includes(query)) ||
      (emp.issueNo && emp.issueNo.toLowerCase().includes(query)) ||
      (emp.createdBy && emp.createdBy.toLowerCase().includes(query)) ||
      (emp.creatorEmail && emp.creatorEmail.toLowerCase().includes(query))
    );
    return matchesSearch &&
      (!agencyFilter || emp.agencyName?.trim() === agencyFilter) &&
      (!designationFilter || emp.designation?.trim() === designationFilter);
  });

  const selectedEmployees = employees.filter(employee => employee.id && selectedEmployeeIds.has(employee.id));
  const visibleIds = filteredEmployees.map(employee => employee.id).filter((id): id is string => Boolean(id));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedEmployeeIds.has(id));
  const handlePrintSelected = useReactToPrint({
    contentRef: multiPrintRef,
    documentTitle: 'Employee_ID_Cards_A4',
    pageStyle: `
      @page { size: A4 portrait; margin: 8mm; }
      @media print {
        html, body { width: 194mm; margin: 0 !important; padding: 0 !important; }
        .a4-print-root { display: block !important; position: absolute !important; left: 0; top: 0; width: 100%; visibility: visible !important; }
        .a4-print-root, .a4-print-root * {
          visibility: visible !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .a4-print-page {
          width: 194mm;
          min-height: 281mm;
          display: grid;
          grid-template-columns: repeat(2, 85.6mm);
          grid-auto-rows: 54mm;
          gap: 2mm 10mm;
          justify-content: center;
          align-content: start;
          break-after: page;
          page-break-after: always;
        }
        .a4-print-page:last-child { break-after: auto; page-break-after: auto; }
        .a4-print-card {
          width: 85.6mm;
          height: 54mm;
          overflow: hidden;
          break-inside: avoid;
          page-break-inside: avoid;
        }
      }
    `,
  });

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeeIds(current => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedEmployeeIds(current => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });
  };

  const exportEmployees = () => {
    setExportError('');
    try {
      const columns: { header: string; value: (employee: Employee) => string }[] = [
        { header: 'Name', value: employee => employee.name },
        { header: 'CCC Name', value: employee => employee.cccName || '' },
        { header: 'CCC ID', value: employee => employee.cccId || '' },
        { header: 'Address', value: employee => employee.address || '' },
        { header: 'Designation', value: employee => employee.designation },
        { header: 'Agency Name', value: employee => employee.agencyName },
        { header: 'Blood Group', value: employee => employee.bloodGroup || '' },
        { header: 'Contact Number', value: employee => employee.contactNumber || '' },
        { header: 'Issue Number', value: employee => employee.issueNo || '' },
        { header: 'UID Number (record only)', value: employee => employee.uidNo || '' },
        { header: 'Issue Date', value: employee => employee.issueDate || '' },
        { header: 'Valid Until', value: employee => employee.validUntil || '' },
        { header: 'Working Area', value: employee => employee.workingArea || '' },
      ];
      const escapeCell = (value: string) => {
        const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
        return `"${safeValue.replace(/"/g, '""')}"`;
      };
      const csv = [
        columns.map(column => escapeCell(column.header)).join(','),
        ...filteredEmployees.map(employee => columns.map(column => escapeCell(column.value(employee))).join(',')),
      ].join('\r\n');
      const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'employee-directory.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting employee directory:', error);
      setExportError('Could not export the directory. Please try again.');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setAgencyFilter('');
    setDesignationFilter('');
    onClearAgencyFilter?.();
  };

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
        <div className="flex justify-center mt-6">
          <EmployeeImport settings={settings} cccId={cccId} canImport={canImport} assignedAgency={assignedAgency} canEditIssueNumber={isAdmin} />
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* List Header/Controls */}
      <div className="bg-card-custom p-4 md:p-5 rounded-[24px] md:rounded-[28px] border border-slate-200/60 shadow-sm space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="relative flex-1 w-full xl:max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="search"
              placeholder="Search name, agency, phone, issue number..."
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <button
              type="button"
              onClick={toggleVisibleSelection}
              disabled={!visibleIds.length}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 text-slate-600 rounded-xl md:rounded-2xl text-xs md:text-sm font-black hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              {allVisibleSelected ? 'Deselect visible' : 'Select visible'}
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(open => !open)}
              aria-expanded={showFilters}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-black transition-all ${showFilters || agencyFilter || designationFilter ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              <Filter size={18} />
              Filter
              {(agencyFilter || designationFilter) && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
            </button>
            <button
              type="button"
              onClick={exportEmployees}
              disabled={!filteredEmployees.length}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl md:rounded-2xl text-xs md:text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              <Download size={18} />
              Export CSV
            </button>
            <div className="col-span-2 sm:col-span-1">
              <EmployeeImport settings={settings} cccId={cccId} canImport={canImport} assignedAgency={assignedAgency} canEditIssueNumber={isAdmin} />
            </div>
          </div>
        </div>

        {selectedEmployees.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-indigo-50 border border-indigo-100">
            <p className="text-sm font-bold text-indigo-900">
              {selectedEmployees.length} card{selectedEmployees.length === 1 ? '' : 's'} selected
              <span className="block sm:inline sm:ml-2 text-xs font-medium text-indigo-700">A4 portrait · up to 10 cards per page</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedEmployeeIds(new Set())}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white text-slate-600 text-xs font-black hover:bg-slate-100"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handlePrintSelected()}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700"
              >
                <Printer size={16} />
                Print selected
              </button>
            </div>
          </div>
        )}

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 pt-3 border-t border-slate-100">
            <label className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agency</span>
              <select value={agencyFilter} onChange={event => setAgencyFilter(event.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold">
                <option value="">All agencies</option>
                {agencies.map(agency => <option key={agency} value={agency}>{agency}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Designation</span>
              <select value={designationFilter} onChange={event => setDesignationFilter(event.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold">
                <option value="">All designations</option>
                {designations.map(designation => <option key={designation} value={designation}>{designation}</option>)}
              </select>
            </label>
            <button type="button" onClick={clearFilters} className="self-end px-4 py-2.5 text-xs font-black text-slate-500 hover:text-indigo-600">
              Clear filters
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-400">
          <span>Showing {filteredEmployees.length} of {employees.length} employee{employees.length === 1 ? '' : 's'}</span>
          {(searchQuery || agencyFilter || designationFilter) && (
            <button type="button" onClick={clearFilters} className="text-indigo-600 hover:text-indigo-800">Reset search and filters</button>
          )}
        </div>
        {exportError && <p role="alert" className="text-xs font-bold text-red-700">{exportError}</p>}
      </div>

      {filteredEmployees.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((employee, index) => (
            <EmployeeListItem
              key={employee.id || index}
              employee={employee}
              onDelete={onDelete}
              onEdit={onEdit}
              index={index}
              settings={settings}
              configuredIssueNo={getConfiguredIssueNo(employee)}
              isAdmin={isAdmin}
              canDelete={isSuperuser}
              isSelected={Boolean(employee.id && selectedEmployeeIds.has(employee.id))}
              onToggleSelection={toggleEmployeeSelection}
              onFilterAgency={agency => {
                setAgencyFilter(agency);
                setSearchQuery('');
              }}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card-custom p-10 rounded-[24px] text-center border border-slate-200/60">
          <Search className="mx-auto text-slate-300 mb-3" size={28} />
          <h3 className="font-black text-slate-800">No matching employees</h3>
          <p className="text-sm text-slate-400 mt-1">Try a different search or clear your filters.</p>
          <button type="button" onClick={clearFilters} className="mt-4 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black hover:bg-indigo-100">
            Clear search and filters
          </button>
        </div>
      )}

      <div className="a4-print-root" ref={multiPrintRef} aria-hidden="true">
        {Array.from({ length: Math.ceil(selectedEmployees.length / 10) }, (_, pageIndex) => (
          <div className="a4-print-page" key={pageIndex}>
            {selectedEmployees.slice(pageIndex * 10, (pageIndex + 1) * 10).map(employee => (
              <div className="a4-print-card" key={employee.id}>
                <IDCard employee={employee} settings={settings} configuredIssueNo={getConfiguredIssueNo(employee)} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const EmployeeListItem: React.FC<{
  employee: Employee;
  onDelete: () => void;
  onEdit: (employee: Employee) => void;
  index: number;
  settings: any;
  configuredIssueNo: string;
  isAdmin?: boolean;
  canDelete?: boolean;
  isSelected: boolean;
  onToggleSelection: (employeeId: string) => void;
  onFilterAgency: (agency: string) => void;
}> = ({ employee, onDelete, onEdit, index, settings, configuredIssueNo, isAdmin, canDelete, isSelected, onToggleSelection, onFilterAgency }) => {
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
      className="bg-card-custom p-4 rounded-2xl shadow-sm flex flex-col gap-3 group hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 min-w-0"
    >
      <div className="flex flex-col items-stretch gap-3">
        <div className="flex flex-col items-stretch gap-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              disabled={!employee.id}
              onChange={() => employee.id && onToggleSelection(employee.id)}
              aria-label={`Select ${employee.name} for printing`}
              className="w-4 h-4 accent-indigo-600 shrink-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <button
              type="button"
              aria-expanded={showActions}
              aria-label={`${showActions ? 'Hide' : 'Show'} actions for ${employee.name}`}
              className="flex items-center gap-3 text-left min-w-0 flex-1 group/header"
              onClick={() => setShowActions(!showActions)}
            >
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner shrink-0 group-hover/header:scale-105 transition-transform">
            {getPhotoUrl(employee.photoUrl) ? (
              <img src={getPhotoUrl(employee.photoUrl)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Users size={20} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <h3 className="text-sm font-black text-slate-900 tracking-tight truncate" title={employee.name}>{employee.name}</h3>
              <motion.span
                animate={{ rotate: showActions ? 180 : 0 }}
                className="text-slate-400 shrink-0"
                aria-hidden="true"
              >
                <ChevronDown size={16} />
              </motion.span>
            </div>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wide truncate" title={employee.designation}>{employee.designation}</p>
          </div>
          </button>
          </div>
          <button
            type="button"
            onClick={() => onFilterAgency(employee.agencyName)}
            className="ml-6 max-w-[calc(100%-1.5rem)] text-left text-[10px] font-bold text-slate-500 truncate hover:text-indigo-600 hover:underline"
            title={`Show employees from ${employee.agencyName}`}
          >
            {employee.agencyName}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
          <span className="truncate">{employee.contactNumber || 'No phone number'}</span>
          {isAdmin && employee.creatorEmail && (
            <span className="shrink-0 font-bold text-indigo-400/80" title={`Created by: ${employee.creatorEmail}`}>
              By {employee.creatorEmail.split('@')[0]}
            </span>
          )}
        </div>

        <AnimatePresence>
          {showActions && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-2 gap-2 w-full"
            >
              <button
                type="button"
                onClick={() => onEdit(employee)}
                className="h-10 flex items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 text-xs font-bold text-indigo-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-600 hover:bg-indigo-600 hover:text-white hover:shadow-md"
                title="Edit Record"
              >
                <Pencil size={15} />
                <span>Edit</span>
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                  disabled={isDownloading}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md disabled:opacity-50"
                  title="Download Options"
                  aria-expanded={isDownloadOpen}
                >
                  {isDownloading ? (
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Download size={15} />
                      <span>Download</span>
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
                type="button"
                onClick={() => handlePrint()}
                className="h-10 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-800 hover:bg-slate-800 hover:text-white hover:shadow-md"
                title="Print ID Card"
              >
                <Printer size={15} />
                <span>Print</span>
              </button>
              
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="h-10 flex items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 text-xs font-bold text-rose-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-600 hover:bg-rose-600 hover:text-white hover:shadow-md"
                  title="Delete Record"
                >
                  <Trash2 size={15} />
                  <span>Delete</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex justify-center bg-slate-50/50 p-4 md:p-8 rounded-[24px] md:rounded-[32px] border border-slate-100 relative overflow-hidden group-hover:bg-slate-50 transition-colors duration-500">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2"></div>
              
              <div className="relative z-10 scale-[0.75] transition-transform duration-500 group-hover:scale-[0.78]">
                <IDCard ref={cardRef} employee={employee} settings={settings} configuredIssueNo={configuredIssueNo} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
