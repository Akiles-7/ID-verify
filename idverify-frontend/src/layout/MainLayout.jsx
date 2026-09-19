import React from 'react';
import Sidebar from './Sidebar';
import { HelpCircle } from 'lucide-react';

export function TopBar({ title, subtitle, actionButton }) {
  return (
    <div className="bg-[#2563EB] bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] rounded-2xl px-7 py-5 mb-7 shadow-lg shadow-blue-500/15 border border-blue-400/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-xs">{title}</h1>
        {subtitle && <p className="text-xs text-blue-100 font-medium mt-1">{subtitle}</p>}
      </div>
      {actionButton && <div className="flex items-center gap-3">{actionButton}</div>}
    </div>
  );
}

export function MainLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#F4F6FA]">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0">
        <div className="p-8 flex-1">
          {children}
        </div>

        {/* Global Footer Caption */}
        <footer className="py-4 text-center text-[11px] font-mono tracking-wider text-gray-400 border-t border-gray-200">
          IDVERIFY FORENSIC SYSTEM · FOR AUTHORISED OFFICER USE ONLY · AI ASSESSMENT IS ADVISORY — HUMAN DECISION IS FINAL
        </footer>
      </main>

      {/* Floating Help Button */}
      <button className="fixed bottom-6 right-6 w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center shadow-lg hover:bg-gray-700 transition-colors">
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>
  );
}

export default MainLayout;
