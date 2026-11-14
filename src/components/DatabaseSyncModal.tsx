import React, { useState } from 'react';
import { Database, Download, Upload, RefreshCw, CheckCircle2, ShieldCheck, X, HardDrive, Cpu, Radio, Lock, Server, Link, Settings, AlertTriangle, Wifi } from 'lucide-react';
import { exportDatabaseToJson, importDatabaseFromJson, idbGetAllKeys } from '../utils/indexedDB';
import { AppUser } from '../types';
import { saveSupabaseConfig, isSupabaseConnected } from '../utils/supabase';
import type { LiveOnlineUser } from '../utils/liveSync';
import {
  checkIsFirebaseQuotaExceeded,
  saveToCloud,
  getCloudStatus,
  subscribeCloudStatus,
  CloudStatusInfo,
} from '../utils/firebase';

interface DatabaseSyncModalProps {
  currentUser: AppUser | null;
  onlineUsers?: LiveOnlineUser[];
  onClose: () => void;
  onDataReload: () => void;
  onManualSyncNow?: () => Promise<void>;
  onPublishAllToLive?: () => Promise<boolean>;
}

export const DatabaseSyncModal: React.FC<DatabaseSyncModalProps> = ({
  currentUser,
  onlineUsers = [],
  onClose,
  onDataReload,
  onManualSyncNow,
  onPublishAllToLive,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatusInfo>(() => getCloudStatus());

  React.useEffect(() => {
    return subscribeCloudStatus(setCloudStatus);
  }, []);

  // Supabase Config State
  const metaEnv = (import.meta as any).env || {};
  const [showSupabaseSettings, setShowSupabaseSettings] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('yp_supabase_url') || metaEnv.VITE_SUPABASE_URL || '');
  const [supabaseKey, setSupabaseKey] = useState(() => localStorage.getItem('yp_supabase_key') || metaEnv.VITE_SUPABASE_ANON_KEY || '');
  const [supabaseActive, setSupabaseActive] = useState(() => isSupabaseConnected());

  const isAdmin = currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin';

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setStatusMessage('⚠️ Harap isi URL dan Anon Key Supabase secara lengkap.');
      return;
    }
    saveSupabaseConfig(supabaseUrl, supabaseKey);
    saveToCloud('yp_supabase_config', { url: supabaseUrl, key: supabaseKey });
    setSupabaseActive(true);
    setStatusMessage('✓ Konfigurasi Database Supabase berhasil disimpan & disinkronkan ke seluruh perangkat!');
    setTimeout(() => {
      onDataReload();
    }, 1000);
  };

  // Handle Export Backup JSON File
  const handleExport = async () => {
    if (!isAdmin) {
      setStatusMessage('🔒 Akses Ditolak: Hanya Admin atau Super Admin yang dapat meng-export backup database.');
      return;
    }
    try {
      setIsProcessing(true);
      const jsonStr = await exportDatabaseToJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `YusufProperty_ERP_Backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage('✓ Database ERP berhasil di-export ke file JSON backup.');
    } catch (err) {
      console.error(err);
      setStatusMessage('❌ Gagal melakukan export data.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Import Backup JSON File
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      setStatusMessage('🔒 Akses Ditolak: Hanya Admin atau Super Admin yang dapat meng-import backup database.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const text = await file.text();
      const success = await importDatabaseFromJson(text);
      if (success) {
        setStatusMessage('✓ Berhasil melakukan import database! Memuat ulang data...');
        setTimeout(() => {
          onDataReload();
          onClose();
        }, 1200);
      } else {
        setStatusMessage('❌ Format file JSON backup tidak valid.');
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('❌ Gagal membaca file backup.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full text-white shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Database Cloud & Auto-Sync System</h3>
              <p className="text-[11px] text-slate-400">Firebase Firestore + IndexedDB Realtime Sync Multi-Device</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          
          {/* Storage Technology Banner */}
          <div
            className={`p-3 rounded-xl space-y-2 border ${
              cloudStatus.status === 'permission-denied' || cloudStatus.status === 'error'
                ? 'bg-rose-950/40 border-rose-800/70'
                : cloudStatus.status === 'paused-by-admin' || cloudStatus.status === 'quota-exceeded' || cloudStatus.status === 'offline'
                ? 'bg-amber-950/40 border-amber-800/70'
                : 'bg-emerald-950/40 border-emerald-800/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-extrabold flex items-center gap-1.5 text-xs text-slate-100">
                <Wifi className="w-4 h-4 text-emerald-400" /> Status Live Sync Lintas Perangkat
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                  cloudStatus.status === 'paused-by-admin'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : cloudStatus.status === 'permission-denied' || cloudStatus.status === 'error'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : cloudStatus.status === 'quota-exceeded'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : cloudStatus.status === 'offline'
                    ? 'bg-slate-700 text-slate-300 border-slate-600'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {cloudStatus.status === 'paused-by-admin'
                  ? '⏸ NON-LIVE (DIATUR ADMIN)'
                  : cloudStatus.liveServerConnected
                  ? '✓ LIVE SERVER TERHUBUNG'
                  : cloudStatus.status === 'permission-denied'
                  ? '⚠ AKSES FIRESTORE DITOLAK'
                  : cloudStatus.status === 'quota-exceeded'
                  ? supabaseActive
                    ? '⚡ DIALIHKAN KE SUPABASE CLOUD'
                    : '⚠ KUOTA HARIAN FIRESTORE HABIS'
                  : cloudStatus.status === 'offline'
                  ? '⚠ SEDANG OFFLINE'
                  : cloudStatus.status === 'error'
                  ? '⚠ ERROR KONEKSI CLOUD'
                  : '✓ REAL-TIME CLOUD TERHUBUNG'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Sinkronisasi lintas perangkat berjalan real-time melalui <strong>ERP Live Server (SSE)</strong>
              {!cloudStatus.writeQuotaExceeded ? ' + Cloud Firestore' : ''}
              {supabaseActive ? ' + Supabase Cloud' : ''} serta backup offline di <strong>IndexedDB</strong>.
            </p>

            {onlineUsers.length > 0 && (
              <div className="p-2 bg-slate-900/70 border border-emerald-800/50 rounded-lg space-y-1">
                <div className="text-[10px] font-bold text-emerald-300">
                  User Sedang Online Live ({onlineUsers.length}):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {onlineUsers.map((ou) => (
                    <span
                      key={ou.userId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-200"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {ou.userName} ({ou.userRole})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {cloudStatus.writeQuotaExceeded && cloudStatus.liveServerConnected && (
              <div className="p-2 bg-slate-900/60 border border-slate-700 rounded-lg text-slate-300 text-[10px]">
                Info: Kuota tulis harian gratis Firestore sedang penuh hari ini, namun sinkronisasi real-time antar perangkat tetap berjalan lancar melalui <strong>ERP Live Server</strong>.
              </div>
            )}

            {cloudStatus.lastError && (
              <div className="mt-1 p-2.5 bg-amber-950/70 border border-amber-700/80 rounded-lg text-amber-200 text-[10px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="font-bold">{cloudStatus.lastError}</div>
              </div>
            )}

            <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10px] text-slate-400">
                {cloudStatus.lastSyncAt
                  ? `Sync terakhir: ${new Date(cloudStatus.lastSyncAt).toLocaleTimeString('id-ID')}`
                  : 'Menunggu sinkronisasi...'}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {currentUser?.role === 'Super Admin' && onPublishAllToLive && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={async () => {
                      setIsProcessing(true);
                      try {
                        const ok = await onPublishAllToLive();
                        setStatusMessage(
                          ok
                            ? '✓ Seluruh data di perangkat Admin berhasil dipublikasikan ke Live Server!'
                            : '⚠ Gagal mempublikasikan data ke Live Server.'
                        );
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Push Live ke Semua User</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={async () => {
                    setIsProcessing(true);
                    try {
                      if (onManualSyncNow) {
                        await onManualSyncNow();
                      } else {
                        onDataReload();
                      }
                      setStatusMessage('✓ Data terbaru berhasil ditarik dari Live Server.');
                    } catch {
                      setStatusMessage('⚠ Gagal menarik pembaruan dari Live Server.');
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>Tarik Data Terbaru</span>
                </button>
              </div>
            </div>
          </div>

          {/* Supabase Database Integration Banner */}
          <div className="p-3 bg-emerald-950/50 border border-emerald-700/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                <span className="font-extrabold text-emerald-200 text-xs">Supabase Cloud Database Engine</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${supabaseActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                {supabaseActive ? '✓ TERHUBUNG' : '⚡ DAPAT DIHUBUNGKAN'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Dukungan penuh integrasi Supabase PostgreSQL untuk penyimpanan terpusat, sinkronisasi tabel real-time, dan akses dari berbagai perangkat HP / Komputer.
            </p>
            <button
              type="button"
              onClick={() => setShowSupabaseSettings(!showSupabaseSettings)}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{showSupabaseSettings ? 'Sembunyikan Pengaturan Supabase' : 'Kelola Koneksi & Credentials Supabase'}</span>
            </button>

            {showSupabaseSettings && (
              <form onSubmit={handleSaveSupabase} className="mt-2.5 pt-2 border-t border-emerald-800/60 space-y-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-emerald-300 mb-1">Supabase Project URL:</label>
                  <input
                    type="url"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://your-project.supabase.co"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-emerald-300 mb-1">Supabase Anon Key:</label>
                  <input
                    type="password"
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Link className="w-3.5 h-3.5" />
                  <span>Simpan & Connect Supabase</span>
                </button>
              </form>
            )}
          </div>

          {/* Realtime Cross-Tab Broadcast Banner */}
          <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-indigo-300 font-extrabold">
              <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span>Sistem Auto-Sync Lintas User / Tab Realtime</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Setiap kali Anda atau user lain menginput, mengedit, atau menghapus data (SPR, konsumen, keuangan, proyek), sistem secara otomatis memicu sinyal synchronisasi realtime sehingga data terkoneksi langsung.
            </p>
          </div>

          {/* User Audit Info */}
          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">User Login Terhubung:</span>
              <span className="font-extrabold text-amber-400">{currentUser?.name || 'Administrator'}</span>
              <span className="text-[10px] text-slate-400 block font-mono">Role: {currentUser?.role}</span>
            </div>
            <div className="text-right font-mono text-[10px] text-slate-400">
              <span>Status Cloud:</span>
              <span
                className={`block font-bold ${
                  cloudStatus.status === 'connected'
                    ? 'text-emerald-400'
                    : cloudStatus.status === 'quota-exceeded' || cloudStatus.status === 'offline'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {cloudStatus.status === 'connected'
                  ? '✓ Live Connected'
                  : cloudStatus.status === 'quota-exceeded'
                  ? supabaseActive
                    ? '✓ Supabase Active'
                    : '⚠ Write Quota Full'
                  : cloudStatus.status === 'offline'
                  ? '⚠ Offline'
                  : '⚠ Perlu Cek Koneksi'}
              </span>
            </div>
          </div>

          {/* Backup & Import Controls */}
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 block text-xs">Manajemen Database & Backup File:</span>
              {!isAdmin && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  <Lock className="w-3 h-3" /> Hanya Admin
                </span>
              )}
            </div>
            
            {isAdmin ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isProcessing}
                  className="p-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Backup (.json)</span>
                </button>

                <label className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer text-center">
                  <Upload className="w-4 h-4" />
                  <span>Import Backup (.json)</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    disabled={isProcessing}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-2 text-center">
                <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-xs">
                  <Lock className="w-4 h-4" />
                  <span>Fitur Export Backup Terkunci</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Fitur untuk mengunduh / meng-export backup database JSON hanya dapat diakses oleh pengguna dengan role <strong>Super Admin</strong> atau <strong>Admin</strong>.
                </p>
              </div>
            )}
          </div>

          {statusMessage && (
            <div className="p-2.5 bg-slate-800 border border-slate-700 text-amber-300 rounded-xl font-bold text-center text-xs animate-fadeIn">
              {statusMessage}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-800 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
