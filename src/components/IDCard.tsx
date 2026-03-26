import React, { forwardRef } from 'react';
import { Employee } from '../types';
import { getPhotoUrl } from '../lib/firebaseUtils';

interface IDCardProps {
  employee: Employee;
}

export const IDCard = forwardRef<HTMLDivElement, IDCardProps>(({ employee }, ref) => {
  const photoUrl = getPhotoUrl(employee.photoUrl);

  return (
    <div
      ref={ref}
      className="w-[85.6mm] h-[54mm] bg-white border border-slate-200 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.1)] relative flex flex-col font-sans text-slate-800 print:shadow-none print:border-slate-200"
      style={{
        boxSizing: 'border-box',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8faff 100%)',
      }}
    >
      {/* Premium Mesh Gradient Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-from)_0%,_transparent_50%)] from-indigo-500/10 via-transparent to-transparent"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-from)_0%,_transparent_50%)] from-pink-500/10 via-transparent to-transparent"></div>
        <div className="absolute top-[20%] left-[20%] w-[60%] h-[60%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-purple-500/5 via-transparent to-transparent"></div>

        {/* Subtle Grid Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }}></div>

        {/* WBSEDCL Watermark */}
        <div className="w-70 absolute inset-15 flex items-center justify-center pointer-events-none opacity-[0.06] select-none rotate-[-20deg]">
          <span className="text-[35px] font-black tracking-[0.2em] text-slate-900">WBSEDCL</span>
        </div>

        {/* Holographic Overlay Effect */}
        <div className="absolute inset-0 holographic-overlay opacity-40 z-50"></div>
      </div>

      {/* Header Section - Glassmorphism */}
      <div className="relative z-10 bg-gradient-to-r from-indigo-600/95 via-purple-600/95 to-pink-600/95 backdrop-blur-md text-white p-2 flex flex-col justify-center shadow-lg">
        <div className="flex flex-col items-center justify-center text-center">
          <h1 className="text-[9px] font-extrabold leading-tight tracking-wide uppercase drop-shadow-sm ">West Bengal State Electricity Distribution Co. Ltd.</h1>
          <h2 className="text-[7px] font-bold leading-tight tracking-tight drop-shadow-sm ">(A Government Of West Bengal Enterprise)</h2>
          <div className="text-[7px] font-medium leading-tight tracking-tight drop-shadow-sm ">{employee.cccName || 'Falakata CCC'}</div>
        </div>
        <div className="w-full" style={{ marginTop: '-8px' }}>
          <div className="w-full flex justify-between items-center text-[5px] font-medium mb-1">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-2 h-2 text-white/95" viewBox="0 0 24 24" fill="white" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.09 4.18 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72c.12 1.05.37 2.07.73 3.03a2 2 0 0 1-.45 2.11L8.91 10.91a16 16 0 0 0 6 6l1.05-1.05a2 2 0 0 1 2.11-.45c.96.36 1.98.61 3.03.73A2 2 0 0 1 22 16.92z" />
              </svg>
              <span className="text-white/95">9332789274</span>
            </div>

            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-2 h-2 text-white/95" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8.5v7A2.5 2.5 0 0 0 5.5 18h13a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 18.5 6h-13A2.5 2.5 0 0 0 3 8.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 8.5l-9 6-9-6" />
              </svg>
              <a href={`mailto:${'sm.falakata@wbsedcl.in'}`} className="underline-offset-2 hover:underline text-white/95">sm.falakata@wbsedcl.in</a>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Banner - High Contrast */}
      <div style={{ marginTop: '-5px' }} className="relative z-10 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 bg-[length:200%_100%] animate-gradient-x text-white text-center shadow-md border-y border-white/10">
        <h2 className="text-[9px] font-black uppercase tracking-[0.25em] drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)] ">ON EMERGENCY DUTY</h2>
      </div>




      {/* Main Content */}
      <div className="flex-1 flex p-2 gap-3 relative z-20 overflow-visible">
        {/* Left: Photo & ID */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative">
            {/* Photo Frame with Glow */}
            <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-[14px] blur-[2px] opacity-20"></div>
            <div className="w-[21mm] h-[25mm] bg-white border border-slate-100 rounded-[10px] overflow-hidden shadow-xl flex items-center justify-center relative z-10">
              {photoUrl ? (
                <img src={photoUrl} alt="Photo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="text-slate-200 text-[7px] text-center px-2 font-black uppercase tracking-widest">No Photo</div>
              )}
            </div>
            {/* Agency Badge Overlay */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[5px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest shadow-lg border border-white/10 z-20 whitespace-nowrap overflow-hidden text-ellipsis max-w-[90%] ">
              {employee.agencyName}
            </div>
          </div>
        </div>

        {/* Right: Details */}
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          <div className="space-y-1">
            <div>
              <div className="text-[14px] font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-800 to-purple-800 uppercase leading-tight tracking-tight">
                {employee.name}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[7px] font-black text-pink-600 uppercase tracking-widest">{employee.designation}</span>
                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                <span className="text-[7px] font-bold text-slate-600 uppercase tracking-tight">Agency: {employee.agencyName}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 mt-[-2px]">
              <DetailRow label="Residential Address" value={employee.address || 'N/A'} />
              <div className="flex gap-5 mt-[-5px]">
                <DetailRow label="Phone" value={employee.contactNumber || 'N/A'} />
                <DetailRow label="Blood Group" value={employee.bloodGroup || 'N/A'} />
                <DetailRow label="Working Area" value={employee.workingArea || 'FALAKATA CCC'} />
              </div>
              <div className="flex gap-5 mt-[-5px]">
                <DetailRow label="Issue No." value={employee.issueNo || 'N/A'} />
                <DetailRow label="Issue Date" value={employee.issueDate || 'N/A'} />
                <DetailRow label="Valid Upto" value={employee.validUntil || 'N/A'} />
              </div>
            </div>
          </div>


        </div>
      </div>




      <div className="w-full flex flex-row flex-1 items-end mt-[-22px] relative z-20">
        {/* Left: Authorised Signatory */}
        <div className="w-1/2  px-2 py-1 text-left">
          <div className="text-[7px] text-black font-bold font-black uppercase tracking-tighter">Authorised Signatory From Agency</div>
        </div>

        {/* Right: Manager (aligned to bottom) */}
        <div className="w-1/2 flex justify-end">
          <div className="px-2 py-1 text-center">
            <div className="text-[6px] font-black text-indigo-700 leading-tight tracking-tighter">Asst. Engg & Station Manager</div>
            <div className="text-[6px] font-black uppercase tracking-widest text-indigo-700">Falakata CCC, WBSEDCL</div>
            <div className="text-[7px] text-black font-bold font-black uppercase italic tracking-widest">Issuing Authority</div>
          </div>
        </div>
      </div>





    </div>
  );
});

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[6px] font-bold text-slate-600 uppercase leading-none mb-0.5">{label}</span>
      <span className="text-[8px] font-bold text-slate-1000 leading-tight line-clamp-1">{value}</span>
    </div>
  );
}
