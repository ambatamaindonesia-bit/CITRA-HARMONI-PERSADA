import React, { useState, useEffect, useRef } from 'react';
import {
  HousingProject,
  Unit,
  SalesTransaction,
  ConstructionMilestone,
  FinancialRecord,
  UnitStatus,
  KprStatus,
  AppUser,
  CustomerProfile,
  getUserAllowedTabs,
  TabType,
  MaterialItem,
  MaterialUsageRecord,
  ProgressDocumentation,
  AttendanceRecord,
  ProspectRecord,
} from './types';
import {
  INITIAL_USERS,
  INITIAL_PROJECTS,
  INITIAL_UNITS,
  INITIAL_SALES,
  INITIAL_CONSTRUCTION,
  INITIAL_FINANCE,
  INITIAL_CUSTOMERS,
  INITIAL_MATERIALS,
  INITIAL_MATERIAL_USAGES,
  INITIAL_PROGRESS_DOCS,
  INITIAL_ATTENDANCE,
  INITIAL_PROSPECTS,
} from './data/initialData';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { DashboardOverview } from './components/DashboardOverview';
import { ProjectsManager } from './components/ProjectsManager';
import { SiteplanViewer } from './components/SiteplanViewer';
import { SalesKprManager } from './components/SalesKprManager';
import { KprCalculator } from './components/KprCalculator';
import { ConstructionManager } from './components/ConstructionManager';
import { FinanceManager } from './components/FinanceManager';
import { ReportsManager } from './components/ReportsManager';
import { EmployeeMarketingManager } from './components/EmployeeMarketingManager';
import { AttendanceManager } from './components/AttendanceManager';
import { UserAccessManager } from './components/UserAccessManager';
import { UserDataManager, DEFAULT_DOCUMENT_TEMPLATES } from './components/UserDataManager';
import { ProspectsManager } from './components/ProspectsManager';
import { ProspectReportsManager } from './components/ProspectReportsManager';
import { NewTransactionModal } from './components/NewTransactionModal';
import { NewUnitModal } from './components/NewUnitModal';
import { DatabaseSyncModal } from './components/DatabaseSyncModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileFrame } from './components/MobileFrame';
import { idbGet, idbSet, migrateLocalStorageToIndexedDB } from './utils/indexedDB';
import { broadcastDataUpdate, getSyncChannel, BroadcastMessage } from './utils/broadcastChannel';
import {
  saveToCloud,
  loadFromCloud,
  loadFromCloudWithStatus,
  subscribeToCloudKey,
  subscribeCloudStatus,
  getCloudStatus,
  CloudStatusInfo,
  CLIENT_TAB_ID,
  CloudSyncMeta,
} from './utils/firebase';
import { fetchUsersFromSupabase, saveUsersToSupabase, isSupabaseConnected, saveSupabaseConfig } from './utils/supabase';
import { formatRupiah } from './utils/formatters';
import { Building2, RefreshCw, Radio, X } from 'lucide-react';

export default function App() {
  // Mobile View Frame State
  const [isMobileFrameActive, setIsMobileFrameActive] = useState<boolean>(() => {
    return localStorage.getItem('yp_erp_mobile_frame') === 'true';
  });

  const toggleMobileFrame = () => {
    setIsMobileFrameActive((prev) => {
      const next = !prev;
      localStorage.setItem('yp_erp_mobile_frame', String(next));
      return next;
    });
  };

  // Users and Auth State
  const [users, setUsers] = useState<AppUser[]>(() => {
    const saved = localStorage.getItem('yp_erp_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('yp_erp_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null; // Force login screen on initial load
  });

  // Data persistence via localStorage
  const [projects, setProjects] = useState<HousingProject[]>(() => {
    const saved = localStorage.getItem('yp_erp_projects');
    return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
  });

  const [units, setUnits] = useState<Unit[]>(() => {
    const saved = localStorage.getItem('yp_erp_units');
    return saved ? JSON.parse(saved) : INITIAL_UNITS;
  });

  const [sales, setSales] = useState<SalesTransaction[]>(() => {
    const saved = localStorage.getItem('yp_erp_sales');
    return saved ? JSON.parse(saved) : INITIAL_SALES;
  });

  const [construction, setConstruction] = useState<ConstructionMilestone[]>(() => {
    const saved = localStorage.getItem('yp_erp_construction');
    return saved ? JSON.parse(saved) : INITIAL_CONSTRUCTION;
  });

  const [finances, setFinances] = useState<FinancialRecord[]>(() => {
    const saved = localStorage.getItem('yp_erp_finances');
    return saved ? JSON.parse(saved) : INITIAL_FINANCE;
  });

  const [customers, setCustomers] = useState<CustomerProfile[]>(() => {
    const saved = localStorage.getItem('yp_erp_customers');
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  const [materials, setMaterials] = useState<MaterialItem[]>(() => {
    const saved = localStorage.getItem('yp_erp_materials');
    return saved ? JSON.parse(saved) : INITIAL_MATERIALS;
  });

  const [materialUsages, setMaterialUsages] = useState<MaterialUsageRecord[]>(() => {
    const saved = localStorage.getItem('yp_erp_material_usages');
    return saved ? JSON.parse(saved) : INITIAL_MATERIAL_USAGES;
  });

  const [progressDocs, setProgressDocs] = useState<ProgressDocumentation[]>(() => {
    const saved = localStorage.getItem('yp_erp_progress_docs');
    return saved ? JSON.parse(saved) : INITIAL_PROGRESS_DOCS;
  });

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('yp_erp_attendance');
    return saved ? JSON.parse(saved) : INITIAL_ATTENDANCE;
  });

  const [prospects, setProspects] = useState<ProspectRecord[]>(() => {
    const saved = localStorage.getItem('yp_erp_prospects');
    return saved ? JSON.parse(saved) : INITIAL_PROSPECTS;
  });

  // Navigation & Search State
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [showNewTransactionModal, setShowNewTransactionModal] = useState<boolean>(false);
  const [showNewUnitModal, setShowNewUnitModal] = useState<boolean>(false);
  const [unitForSpr, setUnitForSpr] = useState<Unit | null>(null);

  // Database Initialized Flag
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);
  const [syncGeneration, setSyncGeneration] = useState<number>(0);
  const [showDatabaseSyncModal, setShowDatabaseSyncModal] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<{ id: string; message: string } | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatusInfo>(() => getCloudStatus());

  // Refs to prevent echo loops between Cloud/Broadcast updates and local persistence effects
  const lastRemoteJsonRef = useRef<Record<string, string>>({});
  const skipCloudWriteJsonRef = useRef<Record<string, string>>({});
  const lastResumePullRef = useRef<number>(0);

  useEffect(() => {
    return subscribeCloudStatus(setCloudStatus);
  }, []);

  const DATA_SYNC_LABELS: Record<string, string> = {
    yp_erp_users: 'Data User & Akses ERP diperbarui',
    yp_erp_projects: 'Data Proyek Perumahan diperbarui',
    yp_erp_units: 'Stok Unit & Site Plan diperbarui',
    yp_erp_sales: 'Data Penjualan & SPR/KPR diperbarui',
    yp_erp_construction: 'Progress Konstruksi & Mandor diperbarui',
    yp_erp_finances: 'Jurnal Transaksi Keuangan & Saldo diperbarui',
    yp_erp_customers: 'Data Konsumen & Berkas KPR diperbarui',
    yp_erp_materials: 'Stok Material Konstruksi diperbarui',
    yp_erp_material_usages: 'Pemakaian Material Proyek diperbarui',
    yp_erp_progress_docs: 'Dokumentasi Progress Lapangan diperbarui',
    yp_erp_attendance: 'Data Absensi Karyawan diperbarui',
    yp_erp_prospects: 'Database Prospek (Leads) diperbarui',
  };

  useEffect(() => {
    if (!syncNotice) return;
    const timer = setTimeout(() => setSyncNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [syncNotice]);

  // Helper to apply incoming remote state (Cloud or Broadcast) without triggering echo writes back to Cloud
  const applyRemoteState = <T,>(
    key: string,
    data: T,
    setter: React.Dispatch<React.SetStateAction<T>>,
    meta?: CloudSyncMeta & { senderUser?: string }
  ) => {
    if (meta?.updatedByClientId && meta.updatedByClientId === CLIENT_TAB_ID) {
      return;
    }
    const json = JSON.stringify(data);
    if (lastRemoteJsonRef.current[key] === json) {
      return;
    }
    lastRemoteJsonRef.current[key] = json;
    skipCloudWriteJsonRef.current[key] = json;
    setter(data);
    idbSet(key, data);
    try {
      localStorage.setItem(key, json);
    } catch (e) {
      console.warn(`localStorage set failed for ${key}:`, e);
    }

    const actor = meta?.updatedBy || meta?.senderUser;
    const detail = meta?.actionDetail || DATA_SYNC_LABELS[key];
    if (detail) {
      setSyncNotice({
        id: `${Date.now()}-${key}`,
        message: actor ? `${detail} (oleh ${actor})` : detail,
      });
    }
  };

  // Initial Load from Cloud Firestore (Fallback to IndexedDB if offline or empty)
  const reloadAllFromDatabase = async () => {
    try {
      await migrateLocalStorageToIndexedDB();

      // Helper to merge user lists across sources so no added user is lost
      const mergeUserLists = (...sources: (AppUser[] | null | undefined)[]): AppUser[] | null => {
        const map = new Map<string, AppUser>();
        for (const src of sources) {
          if (src && Array.isArray(src)) {
            for (const u of src) {
              if (!u) continue;
              const key = (u.username ? u.username.trim().toLowerCase() : '') || (u.id || '');
              if (key && !map.has(key)) {
                map.set(key, u);
              }
            }
          }
        }
        return map.size > 0 ? Array.from(map.values()) : null;
      };

      // Cloud-first selector: trusts Cloud whenever it exists (even if shorter/empty after deletions)
      const pickCloudFirst = <T,>(
        cloudVal: T[] | null | undefined,
        idbVal: T[] | null | undefined
      ): T[] | null => {
        if (cloudVal !== null && cloudVal !== undefined && Array.isArray(cloudVal)) {
          return cloudVal;
        }
        if (idbVal !== null && idbVal !== undefined && Array.isArray(idbVal)) {
          return idbVal;
        }
        return null;
      };

      // Auto-connect Supabase if configured in Cloud but not locally present
      if (!isSupabaseConnected()) {
        try {
          const cloudSupaCfg = await loadFromCloud<{ url: string; key: string }>('yp_supabase_config');
          if (cloudSupaCfg && cloudSupaCfg.url && cloudSupaCfg.key) {
            saveSupabaseConfig(cloudSupaCfg.url, cloudSupaCfg.key, true);
          }
        } catch (err) {
          console.warn('Could not auto-fetch Supabase config from Cloud:', err);
        }
      }

      // Load from Supabase "users" table & Cloud Firestore (with explicit status to prevent offline overwrite)
      const supabaseUsers = await fetchUsersFromSupabase();

      const [
        cloudUsersRes,
        cloudProjectsRes,
        cloudUnitsRes,
        cloudSalesRes,
        cloudConstructionRes,
        cloudFinancesRes,
        cloudCustomersRes,
        cloudMaterialsRes,
        cloudUsagesRes,
        cloudDocsRes,
        cloudAttendanceRes,
        cloudProspectsRes,
      ] = await Promise.all([
        loadFromCloudWithStatus<AppUser[]>('yp_erp_users'),
        loadFromCloudWithStatus<HousingProject[]>('yp_erp_projects'),
        loadFromCloudWithStatus<Unit[]>('yp_erp_units'),
        loadFromCloudWithStatus<SalesTransaction[]>('yp_erp_sales'),
        loadFromCloudWithStatus<ConstructionMilestone[]>('yp_erp_construction'),
        loadFromCloudWithStatus<FinancialRecord[]>('yp_erp_finances'),
        loadFromCloudWithStatus<CustomerProfile[]>('yp_erp_customers'),
        loadFromCloudWithStatus<MaterialItem[]>('yp_erp_materials'),
        loadFromCloudWithStatus<MaterialUsageRecord[]>('yp_erp_material_usages'),
        loadFromCloudWithStatus<ProgressDocumentation[]>('yp_erp_progress_docs'),
        loadFromCloudWithStatus<AttendanceRecord[]>('yp_erp_attendance'),
        loadFromCloudWithStatus<ProspectRecord[]>('yp_erp_prospects'),
      ]);

      const cloudUsers = cloudUsersRes.data;
      const cloudProjects = cloudProjectsRes.data;
      const cloudUnits = cloudUnitsRes.data;
      const cloudSales = cloudSalesRes.data;
      const cloudConstruction = cloudConstructionRes.data;
      const cloudFinances = cloudFinancesRes.data;
      const cloudCustomers = cloudCustomersRes.data;
      const cloudMaterials = cloudMaterialsRes.data;
      const cloudUsages = cloudUsagesRes.data;
      const cloudDocs = cloudDocsRes.data;
      const cloudAttendance = cloudAttendanceRes.data;
      const cloudProspects = cloudProspectsRes.data;

      // IndexedDB fallbacks
      const [
        idbUsers,
        idbCurrentUser,
        idbProjects,
        idbUnits,
        idbSales,
        idbConstruction,
        idbFinances,
        idbCustomers,
        idbMaterials,
        idbUsages,
        idbDocs,
        idbAttendance,
        idbProspects,
      ] = await Promise.all([
        idbGet<AppUser[]>('yp_erp_users'),
        idbGet<AppUser>('yp_erp_current_user'),
        idbGet<HousingProject[]>('yp_erp_projects'),
        idbGet<Unit[]>('yp_erp_units'),
        idbGet<SalesTransaction[]>('yp_erp_sales'),
        idbGet<ConstructionMilestone[]>('yp_erp_construction'),
        idbGet<FinancialRecord[]>('yp_erp_finances'),
        idbGet<CustomerProfile[]>('yp_erp_customers'),
        idbGet<MaterialItem[]>('yp_erp_materials'),
        idbGet<MaterialUsageRecord[]>('yp_erp_material_usages'),
        idbGet<ProgressDocumentation[]>('yp_erp_progress_docs'),
        idbGet<AttendanceRecord[]>('yp_erp_attendance'),
        idbGet<ProspectRecord[]>('yp_erp_prospects'),
      ]);

      const finalUsers = mergeUserLists(supabaseUsers, cloudUsers, idbUsers, INITIAL_USERS);
      const finalProjects = pickCloudFirst(cloudProjects, idbProjects);
      const finalUnits = pickCloudFirst(cloudUnits, idbUnits);
      const finalSales = pickCloudFirst(cloudSales, idbSales);
      const finalConstruction = pickCloudFirst(cloudConstruction, idbConstruction);
      const finalFinances = pickCloudFirst(cloudFinances, idbFinances);
      const finalCustomers = pickCloudFirst(cloudCustomers, idbCustomers);
      const finalMaterials = pickCloudFirst(cloudMaterials, idbMaterials);
      const finalUsages = pickCloudFirst(cloudUsages, idbUsages);
      const finalDocs = pickCloudFirst(cloudDocs, idbDocs);
      const finalAttendance = pickCloudFirst(cloudAttendance, idbAttendance);
      const finalProspects = pickCloudFirst(cloudProspects, idbProspects);

      // Guard against overwriting Cloud with initial/stale state on error or already-loaded data
      const markSkipWrite = (key: string, val: unknown) => {
        if (val !== null && val !== undefined) {
          const json = JSON.stringify(val);
          lastRemoteJsonRef.current[key] = json;
          skipCloudWriteJsonRef.current[key] = json;
        }
      };

      const applyLoadedDataset = <T,>(
        key: string,
        _cloudRes: { data: T | null; existsInCloud: boolean; error?: string },
        finalVal: T | null,
        initialFallback: T,
        setter: React.Dispatch<React.SetStateAction<T>>
      ) => {
        if (finalVal !== null) {
          markSkipWrite(key, finalVal);
          setter(finalVal);
        } else {
          markSkipWrite(key, initialFallback);
          setter(initialFallback);
        }
      };

      if (finalUsers) {
        markSkipWrite('yp_erp_users', finalUsers);
        setUsers(finalUsers);
        if (idbCurrentUser) {
          const freshUser = finalUsers.find(
            (u) => u.id === idbCurrentUser.id || u.username.toLowerCase() === idbCurrentUser.username.toLowerCase()
          );
          if (freshUser) {
            if (freshUser.status === 'Nonaktif') {
              setCurrentUser(null);
            } else {
              setCurrentUser(freshUser);
            }
          } else {
            setCurrentUser(idbCurrentUser);
          }
        }
      } else if (idbCurrentUser) {
        setCurrentUser(idbCurrentUser);
      }

      applyLoadedDataset('yp_erp_projects', cloudProjectsRes, finalProjects, INITIAL_PROJECTS, setProjects);
      applyLoadedDataset('yp_erp_units', cloudUnitsRes, finalUnits, INITIAL_UNITS, setUnits);
      applyLoadedDataset('yp_erp_sales', cloudSalesRes, finalSales, INITIAL_SALES, setSales);
      applyLoadedDataset('yp_erp_construction', cloudConstructionRes, finalConstruction, INITIAL_CONSTRUCTION, setConstruction);
      applyLoadedDataset('yp_erp_finances', cloudFinancesRes, finalFinances, INITIAL_FINANCE, setFinances);
      applyLoadedDataset('yp_erp_customers', cloudCustomersRes, finalCustomers, INITIAL_CUSTOMERS, setCustomers);
      applyLoadedDataset('yp_erp_materials', cloudMaterialsRes, finalMaterials, INITIAL_MATERIALS, setMaterials);
      applyLoadedDataset('yp_erp_material_usages', cloudUsagesRes, finalUsages, INITIAL_MATERIAL_USAGES, setMaterialUsages);
      applyLoadedDataset('yp_erp_progress_docs', cloudDocsRes, finalDocs, INITIAL_PROGRESS_DOCS, setProgressDocs);
      applyLoadedDataset('yp_erp_attendance', cloudAttendanceRes, finalAttendance, INITIAL_ATTENDANCE, setAttendanceRecords);
      applyLoadedDataset('yp_erp_prospects', cloudProspectsRes, finalProspects, INITIAL_PROSPECTS, setProspects);

    } catch (e) {
      console.error('Error loading data from Cloud/IndexedDB:', e);
    } finally {
      setSyncGeneration((prev) => prev + 1);
      setIsDbLoaded(true);
    }
  };

  // Throttled server pull when another device wakes from sleep, regains tab focus, or reconnects online
  const syncLatestFromCloud = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastResumePullRef.current < 4000) return;
    lastResumePullRef.current = now;

    try {
      const pulls: Array<{
        key: string;
        setter: React.Dispatch<React.SetStateAction<any>>;
        requireNonEmpty?: boolean;
      }> = [
        { key: 'yp_erp_users', setter: setUsers, requireNonEmpty: true },
        { key: 'yp_erp_projects', setter: setProjects },
        { key: 'yp_erp_units', setter: setUnits },
        { key: 'yp_erp_sales', setter: setSales },
        { key: 'yp_erp_construction', setter: setConstruction },
        { key: 'yp_erp_finances', setter: setFinances },
        { key: 'yp_erp_customers', setter: setCustomers },
        { key: 'yp_erp_materials', setter: setMaterials },
        { key: 'yp_erp_material_usages', setter: setMaterialUsages },
        { key: 'yp_erp_progress_docs', setter: setProgressDocs },
        { key: 'yp_erp_attendance', setter: setAttendanceRecords },
        { key: 'yp_erp_prospects', setter: setProspects },
      ];

      const results = await Promise.all(pulls.map((p) => loadFromCloudWithStatus<any[]>(p.key)));
      results.forEach((res, idx) => {
        const target = pulls[idx];
        if (res.existsInCloud && Array.isArray(res.data)) {
          if (target.requireNonEmpty && res.data.length === 0) return;
          applyRemoteState(target.key, res.data, target.setter);
        }
      });
    } catch (err) {
      console.warn('Background resume pull notice:', err);
    }
  };

  useEffect(() => {
    reloadAllFromDatabase();
  }, []);

  useEffect(() => {
    if (!isDbLoaded) return;

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncLatestFromCloud(false);
      }
    };
    const onOnline = () => {
      syncLatestFromCloud(true);
    };
    const onFocus = () => {
      syncLatestFromCloud(false);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
    };
  }, [isDbLoaded]);

  // Subscribe to Realtime Cloud Firestore Changes across all devices
  useEffect(() => {
    if (!isDbLoaded) return;

    const unsubs = [
      subscribeToCloudKey<AppUser[]>('yp_erp_users', (data, meta) => {
        if (data && Array.isArray(data) && data.length > 0) applyRemoteState('yp_erp_users', data, setUsers, meta);
      }),
      subscribeToCloudKey<HousingProject[]>('yp_erp_projects', (data, meta) => {
        if (data && Array.isArray(data)) applyRemoteState('yp_erp_projects', data, setProjects, meta);
      }),
      subscribeToCloudKey<Unit[]>('yp_erp_units', (data, meta) => {
        if (data && Array.isArray(data)) applyRemoteState('yp_erp_units', data, setUnits, meta);
      }),
      subscribeToCloudKey<SalesTransaction[]>('yp_erp_sales', (data, meta) => {
        if (data && Array.isArray(data)) applyRemoteState('yp_erp_sales', data, setSales, meta);
      }),
      subscribeToCloudKey<ConstructionMilestone[]>('yp_erp_construction', (data, meta) => {
        if (data && Array.isArray(data)) applyRemoteState('yp_erp_construction', data, setConstruction, meta);
      }),
      subscribeToCloudKey<FinancialRecord[]>('yp_erp_finances', (data, meta) => {
        if (data && Array.isArray(data)) applyRemoteState('yp_erp_finances', data, setFinances, meta);
      }),
      subscribeToCloudKey<CustomerProfile[]>('yp_erp_customers', (data, meta) => {
        if (data && Array.isArray(data)) applyRemoteState('yp_erp_customers', data, setCustomers, meta);
      }),
      subscribeToCloudKey<MaterialItem[]>('yp_erp_materials', (data, meta) => {
        if (data && Array.isArray(data)) applyRemoteState('yp_erp_materials', data, setMaterials, meta);
      }),
      subscribeToCloudKey<MaterialUsageRecord[]>('yp_erp_material_usages', (data, meta) => {
        if (data && Array.isArray(data)) applyRemoteState('yp_erp_material_usages', data, setMaterialUsages, meta);
      }),
      subscribeToCloudKey<ProgressDocumentation[]>('yp_erp_progress_docs', (data, meta) => {
        if (data && Array.isArray(data)) applyRemoteState('yp_erp_progress_docs', data, setProgressDocs, meta);
      }),
      subscribeToCloudKey<AttendanceRecord[]>('yp_erp_attendance', (data, meta) => {
        if (data && Array.isArray(data)) applyRemoteState('yp_erp_attendance', data, setAttendanceRecords, meta);
      }),
      subscribeToCloudKey<ProspectRecord[]>('yp_erp_prospects', (data, meta) => {
        if (data && Array.isArray(data)) applyRemoteState('yp_erp_prospects', data, setProspects, meta);
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub && unsub());
    };
  }, [isDbLoaded, syncGeneration]);

  // Real-time synchronization of currentUser permissions/menus whenever users array updates
  useEffect(() => {
    if (!currentUser) return;

    const matchedUser = users.find(
      (u) => u.id === currentUser.id || u.username.toLowerCase() === currentUser.username.toLowerCase()
    );

    if (matchedUser) {
      if (matchedUser.status === 'Nonaktif') {
        setSyncNotice({
          id: `${Date.now()}-disabled`,
          message: `Akun (${matchedUser.name}) telah dinonaktifkan oleh Administrator.`,
        });
        setCurrentUser(null);
        return;
      }

      const isDifferent = JSON.stringify(matchedUser) !== JSON.stringify(currentUser);
      if (isDifferent) {
        console.log('Realtime user settings/permissions updated from Cloud:', matchedUser);
        setCurrentUser(matchedUser);
      }
    }
  }, [users, currentUser]);

  // Active Tab security protection (redirect if active tab is no longer permitted)
  const currentAllowedTabs = getUserAllowedTabs(currentUser);
  useEffect(() => {
    if (currentUser && currentAllowedTabs.length > 0 && !currentAllowedTabs.includes(activeTab)) {
      setActiveTab(currentAllowedTabs[0]);
    }
  }, [currentUser, currentAllowedTabs, activeTab]);

  // Listen for Realtime Broadcast Messages & Storage Events from Other Tabs/Windows on same device
  useEffect(() => {
    const dispatchRemoteByKey = (key: string, payload: any, senderUser?: string) => {
      switch (key) {
        case 'yp_erp_users':
          if (Array.isArray(payload) && payload.length > 0) applyRemoteState(key, payload, setUsers, { senderUser });
          break;
        case 'yp_erp_projects':
          if (Array.isArray(payload)) applyRemoteState(key, payload, setProjects, { senderUser });
          break;
        case 'yp_erp_units':
          if (Array.isArray(payload)) applyRemoteState(key, payload, setUnits, { senderUser });
          break;
        case 'yp_erp_sales':
          if (Array.isArray(payload)) applyRemoteState(key, payload, setSales, { senderUser });
          break;
        case 'yp_erp_construction':
          if (Array.isArray(payload)) applyRemoteState(key, payload, setConstruction, { senderUser });
          break;
        case 'yp_erp_finances':
          if (Array.isArray(payload)) applyRemoteState(key, payload, setFinances, { senderUser });
          break;
        case 'yp_erp_customers':
          if (Array.isArray(payload)) applyRemoteState(key, payload, setCustomers, { senderUser });
          break;
        case 'yp_erp_materials':
          if (Array.isArray(payload)) applyRemoteState(key, payload, setMaterials, { senderUser });
          break;
        case 'yp_erp_material_usages':
          if (Array.isArray(payload)) applyRemoteState(key, payload, setMaterialUsages, { senderUser });
          break;
        case 'yp_erp_progress_docs':
          if (Array.isArray(payload)) applyRemoteState(key, payload, setProgressDocs, { senderUser });
          break;
        case 'yp_erp_attendance':
          if (Array.isArray(payload)) applyRemoteState(key, payload, setAttendanceRecords, { senderUser });
          break;
        case 'yp_erp_prospects':
          if (Array.isArray(payload)) applyRemoteState(key, payload, setProspects, { senderUser });
          break;
      }
    };

    const channel = getSyncChannel();
    const handleBroadcastMessage = (event: MessageEvent<BroadcastMessage>) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'SYNC_KEY' && msg.key && msg.payload !== undefined) {
        dispatchRemoteByKey(msg.key, msg.payload, msg.senderUser);
      } else if (msg.type === 'SYNC_ALL') {
        reloadAllFromDatabase();
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (!event.key || !event.key.startsWith('yp_erp_') || event.newValue === null) return;
      if (event.key === 'yp_erp_current_user' || event.key === 'yp_erp_mobile_frame') return;
      try {
        const parsed = JSON.parse(event.newValue);
        dispatchRemoteByKey(event.key, parsed);
      } catch (e) {
        console.warn(`Storage sync parse error for ${event.key}:`, e);
      }
    };

    if (channel) {
      channel.addEventListener('message', handleBroadcastMessage);
    }
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      if (channel) {
        channel.removeEventListener('message', handleBroadcastMessage);
      }
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // Helper for local state persistence without echoing back remote updates
  const persistLocalMutation = <T,>(key: string, data: T, alsoSaveSupabaseUsers = false) => {
    const json = JSON.stringify(data);
    idbSet(key, data);
    try {
      localStorage.setItem(key, json);
    } catch (e) {
      console.warn(`localStorage write failed for ${key}:`, e);
    }

    if (skipCloudWriteJsonRef.current[key] === json || lastRemoteJsonRef.current[key] === json) {
      lastRemoteJsonRef.current[key] = json;
      return;
    }

    delete skipCloudWriteJsonRef.current[key];
    lastRemoteJsonRef.current[key] = json;
    if (alsoSaveSupabaseUsers && Array.isArray(data)) {
      saveUsersToSupabase(data);
    }
    saveToCloud(key, data, true, {
      updatedBy: currentUser?.name,
      actionDetail: DATA_SYNC_LABELS[key],
    });
    broadcastDataUpdate(key, data, currentUser?.name);
  };

  // Auto Persistence to IndexedDB + LocalStorage Cache + Supabase Users Table + Realtime Broadcast
  useEffect(() => {
    if (!isDbLoaded) return;
    persistLocalMutation('yp_erp_users', users, true);
  }, [users, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    if (currentUser) {
      idbSet('yp_erp_current_user', currentUser);
      localStorage.setItem('yp_erp_current_user', JSON.stringify(currentUser));
    } else {
      idbSet('yp_erp_current_user', null);
      localStorage.removeItem('yp_erp_current_user');
    }
  }, [currentUser, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    persistLocalMutation('yp_erp_projects', projects);
  }, [projects, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    persistLocalMutation('yp_erp_units', units);
  }, [units, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    persistLocalMutation('yp_erp_sales', sales);
  }, [sales, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    persistLocalMutation('yp_erp_construction', construction);
  }, [construction, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    persistLocalMutation('yp_erp_finances', finances);
  }, [finances, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    persistLocalMutation('yp_erp_customers', customers);
  }, [customers, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    persistLocalMutation('yp_erp_materials', materials);
  }, [materials, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    persistLocalMutation('yp_erp_material_usages', materialUsages);
  }, [materialUsages, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    persistLocalMutation('yp_erp_progress_docs', progressDocs);
  }, [progressDocs, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    persistLocalMutation('yp_erp_attendance', attendanceRecords);
  }, [attendanceRecords, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    persistLocalMutation('yp_erp_prospects', prospects);
  }, [prospects, isDbLoaded]);

  // Prospect Handlers
  const handleAddProspect = (record: ProspectRecord) => {
    setProspects((prev) => [record, ...prev]);
  };

  const handleUpdateProspect = (updated: ProspectRecord) => {
    setProspects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  // Attendance Handlers
  const handleAddAttendance = (record: AttendanceRecord) => {
    setAttendanceRecords((prev) => [record, ...prev]);
  };

  const handleUpdateAttendance = (record: AttendanceRecord) => {
    setAttendanceRecords((prev) => prev.map((r) => (r.id === record.id ? record : r)));
  };

  const handleDeleteAttendance = (id: string) => {
    setAttendanceRecords((prev) => prev.filter((r) => r.id !== id));
  };

  // Construction & Material Handlers
  const handleAddMaterial = (newMat: MaterialItem) => {
    setMaterials((prev) => [newMat, ...prev]);
  };

  const handleUpdateMaterial = (updatedMat: MaterialItem) => {
    setMaterials((prev) => prev.map((m) => (m.id === updatedMat.id ? updatedMat : m)));
  };

  const handleDeleteMaterial = (matId: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== matId));
  };

  const handleAddMaterialUsage = (usageRecord: MaterialUsageRecord) => {
    // 1. Add usage record
    setMaterialUsages((prev) => [usageRecord, ...prev]);
    // 2. Reduce stock quantity in materials
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id === usageRecord.materialId) {
          const newQty = Math.max(0, m.stockQty - usageRecord.quantityUsed);
          return { ...m, stockQty: newQty, lastUpdated: new Date().toISOString().split('T')[0] };
        }
        return m;
      })
    );
  };

  const handleUpdateMaterialUsage = (updatedRecord: MaterialUsageRecord, oldQty: number) => {
    // 1. Update record with history
    setMaterialUsages((prev) => prev.map((u) => (u.id === updatedRecord.id ? updatedRecord : u)));
    // 2. Adjust stock quantity difference
    const qtyDiff = updatedRecord.quantityUsed - oldQty; // e.g. from 10 to 12 -> diff +2 (reduce stock by 2)
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id === updatedRecord.materialId) {
          const newQty = Math.max(0, m.stockQty - qtyDiff);
          return { ...m, stockQty: newQty, lastUpdated: new Date().toISOString().split('T')[0] };
        }
        return m;
      })
    );
  };

  const handleDeleteMaterialUsage = (usageId: string) => {
    const targetUsage = materialUsages.find((u) => u.id === usageId);
    if (targetUsage) {
      // Restore stock quantity
      setMaterials((prev) =>
        prev.map((m) => {
          if (m.id === targetUsage.materialId) {
            return { ...m, stockQty: m.stockQty + targetUsage.quantityUsed };
          }
          return m;
        })
      );
    }
    setMaterialUsages((prev) => prev.filter((u) => u.id !== usageId));
  };

  const handleAddProgressDoc = (newDoc: ProgressDocumentation) => {
    setProgressDocs((prev) => [newDoc, ...prev]);
    // Also update unit progressPercent in units if matching unitId exists
    if (newDoc.unitId) {
      setUnits((prev) =>
        prev.map((u) => {
          if (u.id === newDoc.unitId) {
            return { ...u, progressPercent: newDoc.progressPercent };
          }
          return u;
        })
      );
    }
  };

  const handleDeleteProgressDoc = (docId: string) => {
    setProgressDocs((prev) => prev.filter((d) => d.id !== docId));
  };

  // Customer Management Handlers
  const handleAddCustomer = (newCustomer: CustomerProfile) => {
    setCustomers((prev) => [newCustomer, ...prev]);
  };

  const handleUpdateCustomer = (updatedCustomer: CustomerProfile) => {
    setCustomers((prev) => prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c)));
  };

  const handleDeleteCustomer = (customerId: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
  };

  // Immediate Cloud + Broadcast commit helper for Finance & linked Sales updates
  const commitFinancesChange = (
    nextFinances: FinancialRecord[],
    meta?: { updatedBy?: string; lastAction?: string; actionDetail?: string }
  ) => {
    const json = JSON.stringify(nextFinances);
    skipCloudWriteJsonRef.current['yp_erp_finances'] = json;
    lastRemoteJsonRef.current['yp_erp_finances'] = json;
    setFinances(nextFinances);
    idbSet('yp_erp_finances', nextFinances);
    try {
      localStorage.setItem('yp_erp_finances', json);
    } catch (e) {
      console.warn('localStorage write failed for yp_erp_finances:', e);
    }
    saveToCloud('yp_erp_finances', nextFinances, true, meta);
    broadcastDataUpdate('yp_erp_finances', nextFinances, meta?.updatedBy || currentUser?.name);
  };

  // Sync linked SalesTransaction (UTJ / DP paid) when a linked FinanceRecord is deleted, restored, or edited
  const applyFinanceDeltaToLinkedSales = (
    record: FinancialRecord,
    deltaAmount: number,
    actionNote: string,
    actorName: string
  ) => {
    if (deltaAmount === 0) return;
    if (record.category !== 'booking_fee' && record.category !== 'dp_pembayaran') return;

    let changed = false;
    const nowStr = new Date().toLocaleString('id-ID');
    const nextSales = sales.map((sale) => {
      const sprMatch = Boolean(sale.sprNumber && record.title && record.title.includes(sale.sprNumber));
      const unitAndBuyerMatch = Boolean(
        record.projectName &&
          record.unitCode &&
          sale.projectName.toLowerCase() === record.projectName.toLowerCase() &&
          sale.unitCode.toLowerCase() === record.unitCode.toLowerCase() &&
          (!record.payerName || sale.buyer.name.toLowerCase() === record.payerName.toLowerCase())
      );

      if (!sprMatch && !unitAndBuyerMatch) return sale;

      changed = true;
      const newStatusLog = {
        timestamp: nowStr,
        user: actorName,
        oldStatus: sale.kprStatus || 'pemberkasan',
        newStatus: sale.kprStatus || 'pemberkasan',
        notes: actionNote,
      };

      if (record.category === 'booking_fee') {
        return {
          ...sale,
          bookingFeePaid: Math.max(0, (sale.bookingFeePaid || 0) + deltaAmount),
          updatedBy: actorName,
          updatedAt: nowStr,
          statusLogs: [...(sale.statusLogs || []), newStatusLog],
        };
      }

      return {
        ...sale,
        dpPaid: Math.max(0, (sale.dpPaid || 0) + deltaAmount),
        updatedBy: actorName,
        updatedAt: nowStr,
        statusLogs: [...(sale.statusLogs || []), newStatusLog],
      };
    });

    if (changed) {
      const json = JSON.stringify(nextSales);
      skipCloudWriteJsonRef.current['yp_erp_sales'] = json;
      lastRemoteJsonRef.current['yp_erp_sales'] = json;
      setSales(nextSales);
      idbSet('yp_erp_sales', nextSales);
      try {
        localStorage.setItem('yp_erp_sales', json);
      } catch (e) {
        console.warn('localStorage write failed for yp_erp_sales:', e);
      }
      saveToCloud('yp_erp_sales', nextSales, true, {
        updatedBy: actorName,
        lastAction: 'SYNC_SALES_FROM_FINANCE',
        actionDetail: actionNote,
      });
      broadcastDataUpdate('yp_erp_sales', nextSales, actorName);
    }
  };

  // Finance Update, Soft Delete, Restore & Permanent Delete Handlers (Immediately Synced to All Users)
  const handleUpdateFinanceRecord = (updatedRecord: FinancialRecord) => {
    const original = finances.find((f) => f.id === updatedRecord.id);
    const actor = currentUser?.name || updatedRecord.recordedBy || 'Admin Keuangan';
    const nextFinances = finances.map((f) => (f.id === updatedRecord.id ? updatedRecord : f));

    commitFinancesChange(nextFinances, {
      updatedBy: actor,
      lastAction: 'EDIT_FINANCE',
      actionDetail: `Transaksi "${updatedRecord.title}" (${formatRupiah(updatedRecord.amount)}) diperbarui`,
    });

    if (original && !original.isDeleted && !updatedRecord.isDeleted && original.amount !== updatedRecord.amount) {
      const delta = updatedRecord.amount - original.amount;
      applyFinanceDeltaToLinkedSales(
        updatedRecord,
        delta,
        `Penyesuaian otomatis nominal transaksi keuangan "${updatedRecord.title}" (${delta > 0 ? '+' : ''}${formatRupiah(delta)})`,
        actor
      );
    }
  };

  const handleDeleteFinanceRecord = (id: string, reason: string, user: string) => {
    const target = finances.find((f) => f.id === id);
    if (!target || target.isDeleted) return;

    const nowStr = new Date().toLocaleString('id-ID');
    const deleteAuditLog = {
      id: `log-${Date.now()}`,
      timestamp: nowStr,
      action: 'DELETE' as const,
      user,
      reason,
      changesSummary: `Transaksi senilai ${formatRupiah(target.amount)} dihapus dari jurnal aktif.`,
    };

    const deletedRecord: FinancialRecord = {
      ...target,
      isDeleted: true,
      deletedAt: nowStr,
      deletedBy: user,
      deleteReason: reason,
      auditLogs: target.auditLogs ? [...target.auditLogs, deleteAuditLog] : [deleteAuditLog],
    };

    const nextFinances = finances.map((f) => (f.id === id ? deletedRecord : f));
    commitFinancesChange(nextFinances, {
      updatedBy: user,
      lastAction: 'DELETE_FINANCE',
      actionDetail: `Transaksi "${target.title}" (${formatRupiah(target.amount)}) dihapus`,
    });

    applyFinanceDeltaToLinkedSales(
      target,
      -target.amount,
      `Sinkronisasi otomatis: Transaksi "${target.title}" dihapus di Keuangan (${reason})`,
      user
    );
  };

  const handleRestoreFinanceRecord = (id: string, reason: string, user: string) => {
    const target = finances.find((f) => f.id === id);
    if (!target || !target.isDeleted) return;

    const nowStr = new Date().toLocaleString('id-ID');
    const restoreAuditLog = {
      id: `log-${Date.now()}`,
      timestamp: nowStr,
      action: 'RESTORE' as const,
      user,
      reason: reason || 'Pemulihan transaksi ke jurnal aktif',
      changesSummary: `Transaksi senilai ${formatRupiah(target.amount)} dipulihkan ke jurnal aktif.`,
    };

    const restoredRecord: FinancialRecord = {
      ...target,
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
      deleteReason: undefined,
      auditLogs: target.auditLogs ? [...target.auditLogs, restoreAuditLog] : [restoreAuditLog],
    };

    const nextFinances = finances.map((f) => (f.id === id ? restoredRecord : f));
    commitFinancesChange(nextFinances, {
      updatedBy: user,
      lastAction: 'RESTORE_FINANCE',
      actionDetail: `Transaksi "${target.title}" (${formatRupiah(target.amount)}) dipulihkan`,
    });

    applyFinanceDeltaToLinkedSales(
      target,
      target.amount,
      `Sinkronisasi otomatis: Transaksi "${target.title}" dipulihkan di Keuangan`,
      user
    );
  };

  const handlePermanentDeleteFinanceRecord = (id: string, user: string) => {
    const target = finances.find((f) => f.id === id);
    if (!target) return;

    const nextFinances = finances.filter((f) => f.id !== id);
    commitFinancesChange(nextFinances, {
      updatedBy: user,
      lastAction: 'PERMANENT_DELETE_FINANCE',
      actionDetail: `Transaksi "${target.title}" (${formatRupiah(target.amount)}) dihapus permanen`,
    });

    if (!target.isDeleted) {
      applyFinanceDeltaToLinkedSales(
        target,
        -target.amount,
        `Sinkronisasi otomatis: Transaksi "${target.title}" dihapus permanen di Keuangan`,
        user
      );
    }
  };

  // Clean Reset Function
  const handleResetData = () => {
    setProjects([]);
    setUnits([]);
    setSales([]);
    setConstruction([]);
    setFinances([]);
  };

  // User Management Handlers (Persisted via persistLocalMutation -> Supabase users table & Cloud Firestore)
  const handleAddUser = (newUser: AppUser) => {
    setUsers((prev) => [newUser, ...prev.filter((u) => u.id !== newUser.id)]);
  };

  const handleUpdateUser = (updatedUser: AppUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // Project Management Handlers
  const handleAddProject = (newProject: HousingProject) => {
    setProjects((prev) => [newProject, ...prev]);
  };

  const handleUpdateProject = (updatedProject: HousingProject) => {
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setUnits((prev) => prev.filter((u) => u.projectId !== projectId));
    if (selectedProjectId === projectId) {
      setSelectedProjectId('all');
    }
  };

  // Transaction Handlers
  const handleCreateTransaction = (newSales: SalesTransaction) => {
    setSales((prev) => [newSales, ...prev]);

    setUnits((prevUnits) =>
      prevUnits.map((u) => {
        if (u.id === newSales.unitId) {
          return {
            ...u,
            status: newSales.paymentType === 'cash_keras' ? 'sold' : 'booking',
            notes: `Booking SPR ${newSales.sprNumber} oleh ${newSales.buyer.name}`,
          };
        }
        return u;
      })
    );

    const nowStr = new Date().toLocaleString('id-ID');
    const recordedBy = currentUser ? currentUser.name : 'System Auto-ERP';

    // Auto record Booking Fee (UTJ) to financial journal
    if (newSales.bookingFeePaid > 0) {
      const bookingRecord: FinancialRecord = {
        id: `fin-${Date.now()}-utj`,
        date: newSales.transactionDate,
        type: 'income',
        category: 'booking_fee',
        title: `Penerimaan UTJ / Booking Fee SPR ${newSales.sprNumber} - Unit ${newSales.unitCode} a.n. ${newSales.buyer.name}`,
        amount: newSales.bookingFeePaid,
        projectName: newSales.projectName,
        unitCode: newSales.unitCode,
        paymentMethod: 'Transfer Bank BTN',
        payerName: newSales.buyer.name,
        payerRelationship: 'Konsumen Langsung (Pribadi)',
        refNumber: `UTJ/YP/${newSales.sprNumber.split('/').pop()}`,
        recordedBy,
        auditLogs: [
          {
            id: `log-${Date.now()}-1`,
            timestamp: nowStr,
            action: 'CREATE',
            user: recordedBy,
            reason: 'Otomatisasi pencatatan UTJ dari transaksi SPR baru',
            changesSummary: `Penerimaan UTJ Rp ${newSales.bookingFeePaid.toLocaleString('id-ID')}`,
          },
        ],
      };
      setFinances((prev) => [bookingRecord, ...prev]);
    }

    // Auto record DP to financial journal if paid
    if (newSales.dpPaid > 0) {
      const dpRecord: FinancialRecord = {
        id: `fin-${Date.now()}-dp`,
        date: newSales.transactionDate,
        type: 'income',
        category: 'dp_pembayaran',
        title: `Penerimaan Uang Muka (DP) SPR ${newSales.sprNumber} - Unit ${newSales.unitCode} a.n. ${newSales.buyer.name}`,
        amount: newSales.dpPaid,
        projectName: newSales.projectName,
        unitCode: newSales.unitCode,
        paymentMethod: 'Transfer Bank BTN',
        payerName: newSales.buyer.name,
        payerRelationship: 'Konsumen Langsung (Pribadi)',
        refNumber: `DP/YP/${newSales.sprNumber.split('/').pop()}`,
        recordedBy,
        auditLogs: [
          {
            id: `log-${Date.now()}-2`,
            timestamp: nowStr,
            action: 'CREATE',
            user: recordedBy,
            reason: 'Otomatisasi pencatatan DP dari transaksi SPR baru',
            changesSummary: `Penerimaan DP Rp ${newSales.dpPaid.toLocaleString('id-ID')}`,
          },
        ],
      };
      setFinances((prev) => [dpRecord, ...prev]);
    }

    // Auto sync Customer Profile in User Data Manager with SPR status & Audit info
    setCustomers((prevCusts) => {
      const existing = prevCusts.find(
        (c) => c.nik === newSales.buyer.nik || c.name.toLowerCase() === newSales.buyer.name.toLowerCase()
      );
      const nowStr = `${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`;
      const userAuditInfo = currentUser
        ? `${currentUser.name} (${currentUser.role})`
        : 'System Auto-ERP';

      if (existing) {
        return prevCusts.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                unitCode: newSales.unitCode,
                projectName: newSales.projectName,
                kprBankTarget: newSales.kprBank || c.kprBankTarget || 'Bank BTN Syariah',
                kprPlafonRequest: newSales.agreedPrice - newSales.dpPaid,
                statusPemberkasan: 'Lengkap & Terverifikasi',
                sprNumber: newSales.sprNumber,
                sprPrintedAt: nowStr,
                sprPrintedBy: userAuditInfo,
                notes: `✓ [SPR DICETAK] No. SPR: ${newSales.sprNumber} | Unit: ${newSales.unitCode} (${newSales.projectName}) | Tgl Cetak: ${nowStr} oleh ${userAuditInfo}${c.notes ? ' || ' + c.notes : ''}`,
                updatedBy: userAuditInfo,
                updatedAt: nowStr,
              }
            : c
        );
      } else {
        const newCustomer: CustomerProfile = {
          id: `cust-${Date.now()}`,
          name: newSales.buyer.name,
          nik: newSales.buyer.nik,
          phone: newSales.buyer.phone,
          email: newSales.buyer.email,
          address: newSales.buyer.address,
          maritalStatus: 'Menikah',
          jobTitle: newSales.buyer.job || 'Karyawan',
          companyName: '-',
          monthlyIncome: newSales.buyer.monthlyIncome || 10000000,
          projectName: newSales.projectName,
          unitCode: newSales.unitCode,
          kprBankTarget: newSales.kprBank || 'Bank BTN Syariah',
          kprPlafonRequest: newSales.agreedPrice - newSales.dpPaid,
          statusPemberkasan: 'Lengkap & Terverifikasi',
          marketingAgent: newSales.marketingAgent,
          documents: DEFAULT_DOCUMENT_TEMPLATES.map((tmpl, idx) => ({
            id: `doc-${Date.now()}-${idx}`,
            code: tmpl.code,
            name: tmpl.name,
            category: tmpl.category,
            isRequired: tmpl.isRequired,
            status: 'belum_ada',
            notes: tmpl.notes,
          })),
          sprNumber: newSales.sprNumber,
          sprPrintedAt: nowStr,
          sprPrintedBy: userAuditInfo,
          notes: `✓ [SPR DICETAK] No. SPR: ${newSales.sprNumber} | Unit: ${newSales.unitCode} (${newSales.projectName}) | Tgl Cetak: ${nowStr} oleh ${userAuditInfo}`,
          createdBy: userAuditInfo,
          createdAt: nowStr,
          updatedBy: userAuditInfo,
          updatedAt: nowStr,
        };
        return [newCustomer, ...prevCusts];
      }
    });

    setShowNewTransactionModal(false);
    setUnitForSpr(null);
  };

  const handleCreateUnit = (newUnit: Unit) => {
    setUnits((prev) => [newUnit, ...prev]);
    setShowNewUnitModal(false);
  };

  const handleUpdateKprStatus = (saleId: string, nextStatus: KprStatus) => {
    setSales((prev) =>
      prev.map((s) => {
        if (s.id === saleId) {
          return {
            ...s,
            kprStatus: nextStatus,
          };
        }
        return s;
      })
    );
  };

  const handleUpdateUnitStatus = (unitId: string, newStatus: UnitStatus) => {
    setUnits((prev) =>
      prev.map((u) => (u.id === unitId ? { ...u, status: newStatus } : u))
    );
  };

  const handleUpdateUnit = (updatedUnit: Unit) => {
    setUnits((prev) =>
      prev.map((u) => (u.id === updatedUnit.id ? updatedUnit : u))
    );
  };

  const handleUpdateConstructionProgress = (id: string, newProgress: number) => {
    setConstruction((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            progressPercent: newProgress,
            status: newProgress >= 100 ? 'completed' : 'in_progress',
            lastUpdated: new Date().toISOString().split('T')[0],
          };
        }
        return c;
      })
    );

    const milestone = construction.find((c) => c.id === id);
    if (milestone) {
      setUnits((prevUnits) =>
        prevUnits.map((u) => (u.id === milestone.unitId ? { ...u, progressPercent: newProgress } : u))
      );
    }
  };

  const handleAddFinanceRecord = (record: FinancialRecord) => {
    const nextFinances = [record, ...finances];
    const actor = record.recordedBy || currentUser?.name || 'Admin Keuangan';
    commitFinancesChange(nextFinances, {
      updatedBy: actor,
      lastAction: 'ADD_FINANCE',
      actionDetail: `Transaksi baru "${record.title}" (${formatRupiah(record.amount)}) dicatat`,
    });
  };

  // Database Loading Splash Screen
  if (!isDbLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 ring-4 ring-amber-400/30 animate-pulse">
          <Building2 className="w-9 h-9" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-black text-amber-400 tracking-tight">YUSUF PROPERTY ERP</h2>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-2 font-medium">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            Menghubungkan & Menyinkronkan Database Cloud Firestore...
          </p>
        </div>
      </div>
    );
  }

  // If not logged in, display Login Screen
  if (!currentUser) {
    return (
      <LoginScreen
        users={users}
        onLoginSuccess={(u) => setCurrentUser(u)}
        onUpdateUsersList={(newUsers) => setUsers(newUsers)}
      />
    );
  }

  // Stock counters
  const totalUnitsCount = units.length;
  const availableUnitsCount = units.filter((u) => u.status === 'available').length;
  const bookingUnitsCount = units.filter((u) => u.status === 'booking').length;
  const soldUnitsCount = units.filter((u) => u.status === 'sold').length;

  const allowedTabs = getUserAllowedTabs(currentUser);

  return (
    <MobileFrame
      isActive={isMobileFrameActive}
      onToggleActive={toggleMobileFrame}
    >
      <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col pb-16 md:pb-0">
        
        {/* Top Header */}
        <Navbar
          currentUser={currentUser}
          onLogout={() => setCurrentUser(null)}
          selectedProject={selectedProjectId}
          setSelectedProject={setSelectedProjectId}
          projects={projects}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onOpenNewTransaction={() => {
            setUnitForSpr(null);
            setShowNewTransactionModal(true);
          }}
          onOpenNewUnit={() => setShowNewUnitModal(true)}
          onOpenKprCalc={() => setActiveTab('kpr_calc')}
          onOpenDatabaseSync={() => setShowDatabaseSyncModal(true)}
          cloudStatus={cloudStatus}
          isMobileFrameActive={isMobileFrameActive}
          onToggleMobileFrame={toggleMobileFrame}
        />

        {/* Main Layout Container */}
        <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
          
          {/* Sidebar Navigation */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            unitsCount={{
              total: totalUnitsCount,
              available: availableUnitsCount,
              booking: bookingUnitsCount,
              sold: soldUnitsCount,
            }}
            isMobileFrameActive={isMobileFrameActive}
            onToggleMobileFrame={toggleMobileFrame}
          />

          {/* Dynamic Content View */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
            
            {activeTab === 'dashboard' && (
              <DashboardOverview
                projects={projects}
                units={units}
                sales={sales}
                construction={construction}
                finances={finances}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onOpenNewTransaction={() => setShowNewTransactionModal(true)}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectsManager
                projects={projects}
                onAddProject={handleAddProject}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
                onSelectProjectForSiteplan={(pId) => {
                  setSelectedProjectId(pId);
                  setActiveTab('siteplan');
                }}
              />
            )}

            {activeTab === 'siteplan' && (
              <SiteplanViewer
                projects={projects}
                units={units}
                selectedProjectId={selectedProjectId}
                setSelectedProjectId={setSelectedProjectId}
                onSelectUnitForSpr={(unit) => {
                  setUnitForSpr(unit);
                  setShowNewTransactionModal(true);
                }}
                onOpenNewUnitModal={() => setShowNewUnitModal(true)}
                onUpdateUnitStatus={handleUpdateUnitStatus}
                onUpdateUnit={handleUpdateUnit}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'sales' && (
              <SalesKprManager
                sales={sales}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                onOpenNewTransaction={() => setShowNewTransactionModal(true)}
                onUpdateKprStatus={handleUpdateKprStatus}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'user_data' && (
              <UserDataManager
                customers={customers}
                sales={sales}
                finances={finances}
                units={units}
                projects={projects}
                onAddCustomer={handleAddCustomer}
                onUpdateCustomer={handleUpdateCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onAddFinanceRecord={handleAddFinanceRecord}
                onUpdateUnitStatus={handleUpdateUnitStatus}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'prospects' && (
              <ProspectsManager
                prospects={prospects}
                onAddProspect={handleAddProspect}
                onUpdateProspect={handleUpdateProspect}
                projects={projects}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'prospect_reports' && (
              <ProspectReportsManager
                prospects={prospects}
                projects={projects}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'employees' && (
              <EmployeeMarketingManager
                users={users}
                sales={sales}
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceManager
                attendanceRecords={attendanceRecords}
                users={users}
                projects={projects}
                currentUser={currentUser}
                onAddAttendance={handleAddAttendance}
                onUpdateAttendance={handleUpdateAttendance}
                onDeleteAttendance={handleDeleteAttendance}
              />
            )}

            {activeTab === 'user_access' && (
              <UserAccessManager
                users={users}
                currentUser={currentUser}
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
              />
            )}

            {activeTab === 'kpr_calc' && <KprCalculator />}

            {activeTab === 'construction' && (
              <ConstructionManager
                construction={construction}
                projects={projects}
                units={units}
                materials={materials}
                materialUsages={materialUsages}
                progressDocs={progressDocs}
                onUpdateProgress={handleUpdateConstructionProgress}
                onAddMaterial={handleAddMaterial}
                onUpdateMaterial={handleUpdateMaterial}
                onDeleteMaterial={handleDeleteMaterial}
                onAddMaterialUsage={handleAddMaterialUsage}
                onUpdateMaterialUsage={handleUpdateMaterialUsage}
                onDeleteMaterialUsage={handleDeleteMaterialUsage}
                onAddProgressDoc={handleAddProgressDoc}
                onDeleteProgressDoc={handleDeleteProgressDoc}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'finance' && (
              <FinanceManager
                finances={finances}
                onAddFinanceRecord={handleAddFinanceRecord}
                onUpdateFinanceRecord={handleUpdateFinanceRecord}
                onDeleteFinanceRecord={handleDeleteFinanceRecord}
                onRestoreFinanceRecord={handleRestoreFinanceRecord}
                onPermanentDeleteFinanceRecord={handlePermanentDeleteFinanceRecord}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsManager
                projects={projects}
                units={units}
                sales={sales}
                finances={finances}
              />
            )}

          </main>

        </div>

        {/* Global Modals */}
        {showNewTransactionModal && (
          <NewTransactionModal
            units={units}
            customers={customers}
            currentUser={currentUser}
            preselectedUnit={unitForSpr}
            onClose={() => {
              setShowNewTransactionModal(false);
              setUnitForSpr(null);
            }}
            onSubmit={handleCreateTransaction}
          />
        )}

        {showNewUnitModal && (
          <NewUnitModal
            projects={projects}
            onClose={() => setShowNewUnitModal(false)}
            onSubmit={handleCreateUnit}
          />
        )}

        {showDatabaseSyncModal && (
          <DatabaseSyncModal
            currentUser={currentUser}
            onClose={() => setShowDatabaseSyncModal(false)}
            onDataReload={reloadAllFromDatabase}
            onManualSyncNow={() => syncLatestFromCloud(true)}
          />
        )}

        {/* Fixed Touch-Optimized Mobile Bottom Navigation Bar */}
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={(tab) => setActiveTab(tab as TabType)}
          currentUser={currentUser}
          onLogout={() => setCurrentUser(null)}
          onOpenKprCalc={() => setActiveTab('kpr_calc')}
          onOpenDatabaseSync={() => setShowDatabaseSyncModal(true)}
          allowedTabs={allowedTabs}
          isMobileFrameActive={isMobileFrameActive}
          onToggleMobileFrame={toggleMobileFrame}
        />

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-center py-4 text-xs font-medium">
          <p>© 2026 PT Yusuf Property Indonesia. All rights reserved. — Sistem ERP Developer Perumahan Terpadu</p>
        </footer>

        {/* Live Realtime Sync Notification Toast */}
        {syncNotice && (
          <div className="fixed bottom-20 md:bottom-5 right-4 z-50 max-w-sm bg-slate-900 text-white border border-emerald-500/50 shadow-2xl rounded-2xl p-3.5 flex items-start gap-3 animate-in fade-in duration-200">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div className="flex-1 text-xs space-y-0.5">
              <div className="font-extrabold text-emerald-400">Update Real-Time Lintas User</div>
              <div className="text-slate-200 leading-snug">{syncNotice.message}</div>
            </div>
            <button
              type="button"
              onClick={() => setSyncNotice(null)}
              className="text-slate-400 hover:text-white p-0.5"
              title="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </MobileFrame>
  );
}
