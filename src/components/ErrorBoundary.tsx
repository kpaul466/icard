import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let errorDetail = "";

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error) {
            errorMessage = "Security Permission Denied";
            errorDetail = `Operation: ${parsed.operationType} on ${parsed.path}. Error: ${parsed.error}`;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/10 blur-[120px] rounded-full"></div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-xl w-full bg-white/5 backdrop-blur-2xl p-10 rounded-[40px] border border-white/10 text-center shadow-2xl relative z-10"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-red-600 to-orange-600 rounded-[30px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-red-500/20">
              <ShieldAlert size={48} className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-white mb-3 tracking-tight">{errorMessage}</h1>
            <p className="text-slate-400 mb-6 font-medium leading-relaxed">
              The system encountered a problem while processing your request. This is often due to security restrictions or network issues.
            </p>
            
            {errorDetail && (
              <div className="bg-black/40 p-4 rounded-2xl mb-10 text-left border border-white/5">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2">Technical Details</p>
                <p className="text-xs font-mono text-slate-300 break-all">{errorDetail}</p>
              </div>
            )}
            
            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-4 bg-white text-slate-950 font-black py-5 px-8 rounded-[24px] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/5"
            >
              <RefreshCw size={22} />
              Reload Application
            </button>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
