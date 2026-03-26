import React, { forwardRef } from 'react';
import { Employee } from '../types';

interface IDCardProps {
  employee: Employee;
}

export const IDCard = forwardRef<HTMLDivElement, IDCardProps>(({ employee }, ref) => {
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
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] select-none rotate-[-30deg]">
          <span className="text-[60px] font-black tracking-[0.2em] text-slate-900">WBSEDCL</span>
        </div>

        {/* Holographic Overlay Effect */}
        <div className="absolute inset-0 holographic-overlay opacity-40 z-50"></div>
      </div>

      {/* Header Section - Glassmorphism */}
      <div className="relative z-10 bg-gradient-to-r from-indigo-600/95 via-purple-600/95 to-pink-600/95 backdrop-blur-md text-white p-2 flex flex-col justify-center shadow-lg">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-[8px] font-black leading-tight tracking-tight uppercase drop-shadow-sm text-embossed">West Bengal State Electricity Distribution Co. Ltd.</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[6px] font-extrabold opacity-90 tracking-widest uppercase text-embossed">{employee.cccName || 'Falakata CCC'}</span>
              <span className="w-1 h-1 bg-white/30 rounded-full"></span>
              <span className="text-[5px] font-black bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-widest backdrop-blur-sm border border-white/10 text-embossed">Official ID</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[4px] font-black opacity-60 uppercase tracking-tighter leading-none">Issue No</div>
            <div className="text-[6px] font-black tracking-tight text-embossed">{employee.issueNo || 'FKT/CCC/001'}</div>
          </div>
        </div>
      </div>

      {/* Emergency Banner - High Contrast */}
      <div className="relative z-10 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 bg-[length:200%_100%] animate-gradient-x text-white py-0.5 text-center shadow-md border-y border-white/10">
        <h2 className="text-[9px] font-black uppercase tracking-[0.25em] drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)] text-embossed-heavy">ON EMERGENCY DUTY</h2>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex p-2 gap-3 relative z-10 overflow-hidden">
        {/* Left: Photo & ID */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative">
            {/* Photo Frame with Glow */}
            <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-[14px] blur-[2px] opacity-20"></div>
            <div className="w-[22mm] h-[28mm] bg-white border border-slate-100 rounded-[12px] overflow-hidden shadow-xl flex items-center justify-center relative z-10">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt="Photo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="text-slate-200 text-[7px] text-center px-2 font-black uppercase tracking-widest">No Photo</div>
              )}
            </div>
            {/* ID Badge Overlay */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[5px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest shadow-lg border border-white/10 z-20 whitespace-nowrap">
              ID: {employee.employeeId}
            </div>
          </div>
        </div>

        {/* Right: Details */}
        <div className="flex-1 flex flex-col justify-between py-0.5 overflow-hidden">
          <div className="space-y-1.5">
            <div>
              <div className="text-[14px] font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-800 to-purple-800 uppercase leading-tight tracking-tight text-embossed-heavy line-clamp-1">
                {employee.name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[7px] font-black text-pink-600 uppercase tracking-widest text-embossed">{employee.designation}</span>
                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight text-embossed line-clamp-1">{employee.agencyName}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1">
              <DetailRow label="Residential Address" value={employee.address || 'N/A'} />
              <div className="flex gap-3">
                <DetailRow label="Phone" value={employee.contactNumber || 'N/A'} />
                <DetailRow label="Blood" value={employee.bloodGroup || 'N/A'} />
                <DetailRow label="Area" value={employee.workingArea || 'FALAKATA CCC'} />
              </div>
            </div>
          </div>

          {/* Validity & QR Section */}
          <div className="flex items-end justify-between mt-0.5">
            <div className="bg-indigo-50/40 p-1.5 rounded-[10px] border border-indigo-100/30 flex-1 mr-2 backdrop-blur-sm overflow-hidden">
              <span className="text-[5px] font-black text-indigo-400 uppercase block mb-0.5 tracking-widest">Validity Schedule</span>
              <div className="text-[6px] font-black text-indigo-900 leading-tight space-y-0.5 max-h-[18px] overflow-hidden">
                {employee.validityRanges ? (
                  employee.validityRanges.split('\n').slice(0, 2).map((range, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="w-0.5 h-0.5 bg-indigo-500 rounded-full"></div>
                      {range}
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-1">
                    <div className="w-0.5 h-0.5 bg-indigo-500 rounded-full"></div>
                    {employee.validUntil || 'N/A'}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-end gap-2">
              {/* Premium QR Code */}
              <div className="w-9 h-9 bg-white border border-slate-100 p-1 rounded-[8px] shadow-lg flex items-center justify-center relative group">
                <div className="absolute inset-0 bg-indigo-500/5 rounded-[8px] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-full h-full bg-slate-50 flex flex-wrap gap-[0.5px] p-[0.5px]">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div key={i} className={`w-[15%] h-[15%] ${Math.random() > 0.4 ? 'bg-indigo-600' : 'bg-white'}`}></div>
                  ))}
                </div>
              </div>

              <div className="text-right flex flex-col items-end">
                <div className="w-10 h-6 border-b border-indigo-100/50 mb-0.5 relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent opacity-50"></div>
                </div>
                <span className="text-[6px] font-black text-slate-900 uppercase leading-none tracking-tighter">AE & SM</span>
                <span className="text-[4px] font-black text-slate-400 uppercase tracking-widest">Authority</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar - Glassmorphism */}
      <div className="bg-white/40 backdrop-blur-md border-t border-slate-100 px-3 py-1 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[5px] font-black text-slate-400 uppercase tracking-widest">WBSEDCL Verified Personnel</span>
        </div>
        <span className="text-[5px] font-black text-indigo-600 uppercase italic tracking-widest opacity-80">Official Emergency Duty ID</span>
      </div>
    </div>
  );
});

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[5px] font-bold text-slate-400 uppercase leading-none mb-0.5">{label}</span>
      <span className="text-[7px] font-bold text-slate-800 leading-tight line-clamp-1">{value}</span>
    </div>
  );
}
