import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  db,
  ensureInitialSetup,
  fetchServerLatestSnapshot,
  fetchServerStorageStatus,
  hasSubstantialLocalData,
  requestPersistentStorage,
  restoreBackupPayload,
  switchActiveAcademicYear,
  syncToServer,
} from '../db/database';
import { checkAiStatus } from '../services/aiService';
import type {
  AcademicYear,
  AppSettings,
  PrincipalProfile,
  SchoolProfile,
  SemesterNumber,
  TeacherProfile,
} from '../types/domain';

export type NavSectionId =
  | 'dashboard'
  | 'identitas'
  | 'data_akademik'
  | 'perencanaan'
  | 'perangkat_pembelajaran'
  | 'asesmen'
  | 'administrasi_kelas'
  | 'rapor'
  | 'dokumen'
  | 'ai_asisten'
  | 'monitoring'
  | 'backup'
  | 'pengaturan';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ServerSnapshotBannerInfo {
  updatedAt: string;
  academicYearName: string;
}

interface AppContextValue {
  ready: boolean;
  dataVersion: number;
  refreshData: () => Promise<void>;
  school: SchoolProfile | null;
  teacher: TeacherProfile | null;
  principal: PrincipalProfile | null;
  academicYears: AcademicYear[];
  activeYear: AcademicYear | null;
  settings: AppSettings | null;
  aiConfigured: boolean;
  storagePersisted: boolean;
  lastSyncedAt: string | null;
  serverRecovery: ServerSnapshotBannerInfo | null;
  dismissServerRecovery: () => void;
  restoreFromServer: () => Promise<void>;
  switchYear: (yearId: string) => Promise<void>;
  switchSemester: (sem: SemesterNumber) => Promise<void>;
  activeNav: NavSectionId;
  activeSubTab: string;
  navigate: (nav: NavSectionId, subTab?: string) => void;
  notify: (message: string, type?: ToastMessage['type']) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [ready, setReady] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [principal, setPrincipal] = useState<PrincipalProfile | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [storagePersisted, setStoragePersisted] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [serverRecovery, setServerRecovery] =
    useState<ServerSnapshotBannerInfo | null>(null);
  const [activeNav, setActiveNav] = useState<NavSectionId>('dashboard');
  const [activeSubTab, setActiveSubTab] = useState<string>('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmState, setConfirmState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const syncTimerRef = useRef<number | null>(null);

  const loadCore = useCallback(async () => {
    await ensureInitialSetup();
    const [sch, tch, prn, yrs, stg] = await Promise.all([
      db.schoolProfile.get('default'),
      db.teacherProfile.get('default'),
      db.principalProfile.get('default'),
      db.academicYears.toArray(),
      db.appSettings.get('default'),
    ]);
    setSchool(sch ?? null);
    setTeacher(tch ?? null);
    setPrincipal(prn ?? null);
    setAcademicYears(yrs.sort((a, b) => a.name.localeCompare(b.name)));
    setSettings(stg ?? null);
  }, []);

  const scheduleServerSync = useCallback(() => {
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(async () => {
      const hasData = await hasSubstantialLocalData();
      if (!hasData) return;
      const res = await syncToServer();
      if (res?.syncedAt) {
        setLastSyncedAt(res.syncedAt);
      }
    }, 1200);
  }, []);

  const refreshData = useCallback(async () => {
    await loadCore();
    setDataVersion((v) => v + 1);
    scheduleServerSync();
  }, [loadCore, scheduleServerSync]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const persisted = await requestPersistentStorage();
      await loadCore();
      const [aiRes, hasLocal, srvStatus] = await Promise.all([
        checkAiStatus(),
        hasSubstantialLocalData(),
        fetchServerStorageStatus(),
      ]);

      if (mounted) {
        setStoragePersisted(persisted);
        setAiConfigured(aiRes.configured);
        if (!hasLocal && srvStatus.hasSnapshot && srvStatus.updatedAt) {
          setServerRecovery({
            updatedAt: srvStatus.updatedAt,
            academicYearName: srvStatus.academicYearName || '-',
          });
        } else if (hasLocal) {
          // Ensure server snapshot stays up to date on startup
          const res = await syncToServer();
          if (mounted && res?.syncedAt) {
            setLastSyncedAt(res.syncedAt);
          }
        }
        setReady(true);
      }
    })();
    return () => {
      mounted = false;
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
    };
  }, [loadCore]);

  const navigate = useCallback((nav: NavSectionId, subTab = '') => {
    setActiveNav(nav);
    setActiveSubTab(subTab);
  }, []);

  const notify = useCallback(
    (message: string, type: ToastMessage['type'] = 'success') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ opts, resolve });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  const switchYear = useCallback(
    async (yearId: string) => {
      await switchActiveAcademicYear(yearId);
      await refreshData();
      notify('Tahun ajaran aktif diganti. Data tahun lain tetap tersimpan aman.', 'info');
    },
    [refreshData, notify]
  );

  const activeYear =
    academicYears.find((y) => y.isActive) ?? academicYears[0] ?? null;

  const switchSemester = useCallback(
    async (sem: SemesterNumber) => {
      if (!activeYear) return;
      await db.academicYears.update(activeYear.id, { activeSemester: sem });
      await db.schoolProfile.update('default', { activeSemester: sem });
      await refreshData();
      notify(`Semester aktif diubah ke Semester ${sem}.`, 'info');
    },
    [activeYear, refreshData, notify]
  );

  const restoreFromServer = useCallback(async () => {
    const payload = await fetchServerLatestSnapshot();
    if (!payload) {
      notify('Gagal mengambil cadangan data dari server.', 'error');
      return;
    }
    await restoreBackupPayload(payload, 'replace');
    setServerRecovery(null);
    await loadCore();
    setDataVersion((v) => v + 1);
    notify('Seluruh data sebelumnya berhasil dipulihkan otomatis.');
  }, [loadCore, notify]);

  const dismissServerRecovery = useCallback(() => {
    setServerRecovery(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        ready,
        dataVersion,
        refreshData,
        school,
        teacher,
        principal,
        academicYears,
        activeYear,
        settings,
        aiConfigured,
        storagePersisted,
        lastSyncedAt,
        serverRecovery,
        dismissServerRecovery,
        restoreFromServer,
        switchYear,
        switchSemester,
        activeNav,
        activeSubTab,
        navigate,
        notify,
        confirm,
      }}
    >
      {children}

      {/* Toast Stack */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm no-print"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const palette =
            t.type === 'error'
              ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-500'
              : t.type === 'warning'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400'
                : t.type === 'info'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-500'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500';
          return (
            <div
              key={t.id}
              className={`px-4 py-3 rounded-xl border shadow-lg text-sm font-medium flex items-start justify-between gap-3 ${palette}`}
            >
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() =>
                  setToasts((prev) => prev.filter((x) => x.id !== t.id))
                }
                className="text-xs opacity-80 hover:opacity-100 shrink-0"
              >
                Tutup
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmState && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-indigo-100 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div
              className={`h-1.5 w-full bg-gradient-to-r ${
                confirmState.opts.danger
                  ? 'from-rose-500 to-red-600'
                  : 'from-blue-600 to-indigo-600'
              }`}
            />
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                {confirmState.opts.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {confirmState.opts.message}
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleConfirmClose(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  {confirmState.opts.cancelLabel || 'Batal'}
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmClose(true)}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-all whitespace-nowrap ${
                    confirmState.opts.danger
                      ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                  }`}
                >
                  {confirmState.opts.confirmLabel || 'Ya, Lanjutkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
