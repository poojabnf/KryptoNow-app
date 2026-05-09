import React from 'react';

export default function CreateWallet() {
  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center p-4">
      {/* Radial Gradient Background Accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00e6a8] opacity-20 blur-[100px] rounded-full pointer-events-none"></div>

      {/* Main Glassmorphism Card */}
      <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-10 w-full max-w-md shadow-2xl flex flex-col items-center text-center relative z-10">
        
        {/* Header */}
        <h1 className="text-3xl font-extrabold tracking-tight mb-3">
          Your Web3 Wallet
        </h1>
        <p className="text-slate-400 mb-10 text-sm leading-relaxed">
          Create a new wallet to start your journey, or import an existing one using your seed phrase.
        </p>

        {/* Action Buttons */}
        <div className="w-full space-y-4">
          <button className="w-full flex items-center justify-center gap-2 bg-[#00e6a8] hover:bg-[#00c993] text-slate-900 font-bold py-4 px-6 rounded-xl transition-all duration-200 shadow-[0_0_20px_rgba(0,230,168,0.3)] hover:shadow-[0_0_25px_rgba(0,230,168,0.5)] hover:-translate-y-0.5">
            Create New Wallet
          </button>

          <button className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 border-2 border-slate-600 hover:border-slate-400 text-slate-300 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200">
            Import Existing Wallet
          </button>
        </div>

        {/* Footer / Sign Out */}
        <button className="mt-8 text-sm text-slate-500 hover:text-slate-300 transition-colors">
          Sign Out
        </button>

      </div>
    </div>
  );
}
