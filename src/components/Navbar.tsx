import React, { useState, useEffect } from 'react';
import { AppUser } from '../types';
import { Building2, Plus, Calculator, Search, Home, LogOut, Database, Smartphone, Download } from 'lucide-react';
import type { CloudStatusInfo } from '../utils/firebase';

interface NavbarProps {
  currentUser: AppUser | null;
  onLogout: () => void;
  selectedProject: string;
  setSelectedProject: (projId: string) => void;
  projects: { id: string; name: string }[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onOpenNewTransaction?: () => void;
  onOpenNewUnit?: () => void;
  onOpenKprCalc: () => void;
  onOpenDatabaseSync?: () => void;
  cloudStatus?: CloudStatusInfo;
  isMobileFrameActive?: boolean;
  onToggleMobileFrame?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  selectedProject,
  setSelectedProject,
  projects,
  searchTerm,
  setSearchTerm,
  onOpenNewTransaction,
  onOpenNewUnit,
  onOpenKprCalc,
  onOpenDatabaseSync,
  cloudStatus,
  isMobileFrameActive,
  onToggleMobileFrame,
}) => {

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      setShowInstallHelp((prev) => !prev);
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Logo & Brand Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20 ring-2 ring-amber-400/40">
              <Building2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white font-sans">
                  YUSUF <span className="text-amber-400">PROPERTY</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Smartphone className="w-3 h-3" /> APP MOBILE
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Sistem Informasi Management Perumahan & KPR
              </p>
            </div>
          </div>

          {/* Project Filter Dropdown & Global Search */}
          <div className="flex items-center gap-2 flex-1 max-w-xl mx-2">
            <div className="relative w-40 sm:w-56">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Home className="w-4 h-4" />
              </div>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full pl-8 pr-6 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all truncate"
              >
                <option value="all">🏢 Semua Proyek Perumahan</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 hidden md:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Cari unit (A-01), konsumen, SPR..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-800/80 border border-slate-700 text-slate-200 text-xs rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              />
            </div>
          </div>

          {/* Quick Action Buttons & Profile */}
          <div className="flex items-center gap-2">
            
            {onToggleMobileFrame && (
              <button
                type="button"
                onClick={onToggleMobileFrame}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                  isMobileFrameActive
                    ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                }`}
                title="Pilihan Tampilan HP / Smartphone Simulator"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {isMobileFrameActive ? 'Tampilan HP (Aktif)' : 'Tampilan HP'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleInstallApp}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md"
              title="Instal Aplikasi Android di HP"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Instal App</span>
            </button>

            <button
              onClick={onOpenDatabaseSync}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm ${
                cloudStatus?.status === 'permission-denied' || cloudStatus?.status === 'error'
                  ? 'bg-rose-950/90 text-rose-200 hover:bg-rose-900 border-rose-600/70'
                  : cloudStatus?.status === 'paused-by-admin' || cloudStatus?.status === 'quota-exceeded' || cloudStatus?.status === 'offline'
                  ? 'bg-amber-950/90 text-amber-200 hover:bg-amber-900 border-amber-600/70'
                  : 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 border-emerald-700/60'
              }`}
              title={
                cloudStatus?.lastError ||
                'Status Sinkronisasi Live Multi-Perangkat & Database'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  cloudStatus?.status === 'permission-denied' || cloudStatus?.status === 'error'
                    ? 'bg-rose-400 animate-ping'
                    : cloudStatus?.status === 'paused-by-admin' || cloudStatus?.status === 'quota-exceeded' || cloudStatus?.status === 'offline'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-400 animate-pulse'
                }`}
              />
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {cloudStatus?.status === 'paused-by-admin'
                  ? 'Non-Live (Admin)'
                  : cloudStatus?.status === 'quota-exceeded'
                  ? 'Sync Terbatas'
                  : cloudStatus?.status === 'permission-denied' || cloudStatus?.status === 'error'
                  ? 'Sync Bermasalah'
                  : cloudStatus?.status === 'offline'
                  ? 'Offline'
                  : cloudStatus?.liveServerConnected
                  ? `Live Sync${cloudStatus.onlineUsersCount > 0 ? ` (${cloudStatus.onlineUsersCount})` : ''}`
                  : 'Database & Sync'}
              </span>
            </button>

            <button
              onClick={onOpenKprCalc}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-amber-300 hover:bg-slate-700 border border-slate-700 transition-colors"
              title="Kalkulator KPR"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Simulasi KPR</span>
            </button>

            {/* Current User Badge & Logout */}
            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="hidden lg:block text-right">
                  <div className="text-xs font-bold text-white leading-tight">{currentUser.name}</div>
                  <div className="text-[10px] text-amber-400 font-medium">
                    {currentUser.role} {currentUser.marketingType !== '-' ? `(${currentUser.marketingType})` : ''}
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-all"
                  title="Keluar / Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>

        </div>
      </div>

      {showInstallHelp && (
        <div className="bg-slate-800 border-t border-slate-700 px-4 py-2 text-[11px] text-amber-200 flex items-center justify-between gap-3 max-w-7xl mx-auto">
          <span>
            Untuk menginstal di HP Android/iOS: buka link di browser Chrome/Safari HP → pilih menu browser → ketuk <strong>"Instal aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.
          </span>
          <button
            type="button"
            onClick={() => setShowInstallHelp(false)}
            className="text-slate-300 hover:text-white font-bold px-2 py-0.5 rounded bg-slate-700"
          >
            Tutup
          </button>
        </div>
      )}
    </header>
  );
};
