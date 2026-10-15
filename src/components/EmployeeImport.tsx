import { useRef, useState } from 'react';
import { auth, db } from '../firebase';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import type { Workbook } from 'exceljs';

const employeeColumns = [
  { header: 'Name', key: 'name' },
  { header: 'Address', key: 'address' },
  { header: 'Designation', key: 'designation' },
  { header: 'Agency Name', key: 'agencyName' },
  { header: 'Blood Group', key: 'bloodGroup' },
  { header: 'Contact Number', key: 'contactNumber' },
  { header: 'Valid Until', key: 'validUntil' },
  { header: 'Validity Ranges', key: 'validityRanges' },
  { header: 'Working Area', key: 'workingArea' },
  { header: 'Issue Number', key: 'issueNo' },
  { header: 'UID Number (record only)', key: 'uidNo' },
  { header: 'Issue Date', key: 'issueDate' },
] as const;

type ImportedEmployee = {
  name: string;
  address: string;
  designation: string;
  agencyName: string;
  bloodGroup: string;
  contactNumber: string;
  validUntil: string;
  validityRanges: string;
  workingArea: string;
  issueNo: string;
  uidNo: string;
  issueDate: string;
};

function cellText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && value !== null) {
    if ('text' in value) return String(value.text ?? '').trim();
    if ('result' in value) return cellText(value.result);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map(part => cellText(part)).join('').trim();
    }
  }
  return String(value ?? '').trim();
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && value > 0) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  }

  const text = cellText(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseEmployees(workbook: Workbook): ImportedEmployee[] {
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('The workbook does not contain a worksheet.');

  const headers = sheet.getRow(1).values as unknown[];
  const headerIndexes = new Map<string, number>();
  headers.forEach((header, index) => {
    if (index > 0) {
      headerIndexes.set(cellText(header).toLowerCase().replace(/[^a-z0-9]/g, ''), index);
    }
  });

  const requiredHeaders = ['name', 'designation', 'agencyname'];
  const missingHeaders = requiredHeaders.filter(header => !headerIndexes.has(header));
  if (missingHeaders.length) {
    const labels = employeeColumns
      .filter(column => missingHeaders.includes(column.key))
      .map(column => column.header);
    throw new Error(`Missing required column headers: ${labels.join(', ')}. Use the downloadable template.`);
  }

  const rows: ImportedEmployee[] = [];
  const rowErrors: string[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = Object.fromEntries(employeeColumns.map(({ header, key }) => {
      const index = headerIndexes.get(header.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const value = index ? row.getCell(index).value : '';
      return [key, key === 'issueDate' || key === 'validUntil' ? normalizeDate(value) : cellText(value)];
    })) as ImportedEmployee;

    if (Object.values(values).every(value => !value)) continue;
    if (!values.name || !values.designation || !values.agencyName) {
      rowErrors.push(`Row ${rowNumber}: Name, Designation, and Agency Name are required.`);
      continue;
    }
    if ((values.issueDate && !isValidDate(values.issueDate)) ||
        (values.validUntil && !isValidDate(values.validUntil))) {
      rowErrors.push(`Row ${rowNumber}: Issue Date and Valid Until must be valid dates (YYYY-MM-DD).`);
      continue;
    }
    rows.push({
      ...values,
      issueDate: values.issueDate || new Date().toISOString().slice(0, 10),
    });
  }

  if (rowErrors.length) {
    const shownErrors = rowErrors.slice(0, 10).join('\n');
    const remaining = rowErrors.length > 10 ? `\nAnd ${rowErrors.length - 10} more invalid row(s).` : '';
    throw new Error(`${shownErrors}${remaining} No rows were imported.`);
  }
  if (!rows.length) throw new Error('No employee records were found in the first worksheet.');
  return rows;
}

async function downloadTemplate(canEditIssueNumber: boolean) {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Employees');
  const columns = canEditIssueNumber
    ? employeeColumns
    : employeeColumns.filter(column => column.key !== 'issueNo');
  sheet.columns = columns.map(column => ({ header: column.header, key: column.key, width: 22 }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRows([
    ['Employee Import Template'],
    ['Fill in the Employees sheet, keeping its header row unchanged.'],
    ['Name, Designation, and Agency Name are required for every employee.'],
    ['Dates must use YYYY-MM-DD format. Leave optional values blank if not applicable.'],
    ['Import adds new employee records; it does not update or remove existing records.'],
    ['Photos are not imported. Add or edit photos from the app after importing.'],
  ]);
  instructions.getRow(1).font = { bold: true, size: 14 };
  instructions.getColumn(1).width = 100;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'employee-import-template.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}

export function EmployeeImport({ settings, cccId, canImport = true, assignedAgency, canEditIssueNumber = false }: { settings?: Record<string, any> | null; cccId?: string; canImport?: boolean; assignedAgency?: string; canEditIssueNumber?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleImport = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    setMessage('');
    setError('');
    let importedCount = 0;

    try {
      if (!/\.xlsx$/i.test(file.name)) {
        throw new Error('Choose an Excel workbook in .xlsx format. Save legacy .xls files as .xlsx first.');
      }
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Sign in again before importing employee records.');

      const { Workbook } = await import('exceljs');
      const workbook = new Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const employees = parseEmployees(workbook);
      if (!canEditIssueNumber && !settings?.cardSettings?.defaultIssueNo?.trim()) {
        throw new Error('Ask an Admin to configure the issue number for this CCC before importing employee records.');
      }
      if (assignedAgency) {
        const mismatchedRows = employees.filter(employee => employee.agencyName !== assignedAgency);
        if (mismatchedRows.length) {
          throw new Error(`All imported rows must use your assigned agency: ${assignedAgency}. ${mismatchedRows.length} row(s) have a different agency name.`);
        }
      }
      if (!window.confirm(`Import ${employees.length} employee record(s)? Existing records will not be changed.`)) return;

      for (let start = 0; start < employees.length; start += 500) {
        const batch = writeBatch(db);
        const chunk = employees.slice(start, start + 500);

        chunk.forEach(employee => {
          const employeeRef = doc(collection(db, 'employees'));
          batch.set(employeeRef, {
            ...employee,
            agencyName: assignedAgency || employee.agencyName,
            cardSettings: settings?.cardSettings || {},
            cccId: cccId || settings?.cccName || '',
            address: employee.address || '',
            bloodGroup: employee.bloodGroup || '',
            contactNumber: employee.contactNumber || '',
            validUntil: employee.validUntil || '',
            validityRanges: employee.validityRanges || '',
            workingArea: employee.workingArea || 'FALAKATA CCC',
            issueNo: canEditIssueNumber ? employee.issueNo || '' : settings?.cardSettings?.defaultIssueNo || '',
            photoUrl: '',
            cccName: settings?.cccName || '',
            officePhone: settings?.officePhone || '',
            officeEmail: settings?.officeEmail || '',
            issuingAuthority: settings?.issuingAuthority || '',
            emergencyTag: settings?.emergencyTag || '',
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid,
            creatorEmail: currentUser.email,
          });
        });

        await batch.commit();
        importedCount += chunk.length;
      }
      setMessage(`Imported ${importedCount} employee record(s).`);
    } catch (importError) {
      const reason = importError instanceof Error ? importError.message : String(importError);
      setError(importedCount
        ? `${reason} ${importedCount} record(s) were imported before the failure.`
        : reason);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const disabled = isImporting || !canImport;

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={event => void handleImport(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl md:rounded-2xl text-xs md:text-sm font-black hover:bg-emerald-700 transition-all disabled:opacity-50"
        >
          <Upload size={18} />
          {isImporting ? 'Importing...' : 'Import Excel'}
        </button>
        <button
          type="button"
          onClick={() => void downloadTemplate(canEditIssueNumber).catch(downloadError => {
            setError(downloadError instanceof Error ? downloadError.message : String(downloadError));
          })}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 text-slate-600 rounded-xl md:rounded-2xl text-xs md:text-sm font-black hover:bg-slate-100 transition-all"
        >
          <Download size={18} />
          Template
        </button>
      </div>
      {!canImport && <p className="text-xs font-bold text-amber-700">Your Admin must assign your CCC before importing records.</p>}
      {message && <p role="status" className="text-xs font-bold text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-xs font-bold text-red-700 whitespace-pre-line">{error}</p>}
      <p className="flex items-center gap-1 text-[10px] text-slate-400">
        <FileSpreadsheet size={12} />
        Excel import appends records. Required columns: Name, Designation, Agency Name.
      </p>
    </div>
  );
}
