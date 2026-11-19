import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  DatabaseBackup,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { AppProvider, useApp, type NavSectionId } from './context/AppContext';
import { DEFAULT_SCHOOL_LOGO_URL } from './db/database';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { DashboardPage } from './pages/DashboardPage';
import { IdentityPage } from './pages/IdentityPage';
import { AcademicDataPage } from './pages/AcademicDataPage';
import { PlanningPage } from './pages/PlanningPage';
import { LearningToolsPage } from './pages/LearningToolsPage';
import { AssessmentPage } from './pages/AssessmentPage';
import { ClassAdminPage } from './pages/ClassAdminPage';
import { ReportCardPage } from './pages/ReportCardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { BackupPage } from './pages/BackupPage';
import { SettingsPage } from './pages/SettingsPage';

interface NavItemConfig {
  id: NavSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: Array<{ label: string; subTab: string }>;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    id: 'identitas',
    label: 'Identitas',
    icon: Building2,
  },
  {
    id: 'data_akademik',
    label: 'Data Akademik',
    icon: CalendarDays,
    children: [
      { label: 'Tahun Ajaran', subTab: 'tahun' },
      { label: 'Kalender & Minggu Efektif', subTab: 'kalender' },
      { label: 'Data Kelas', subTab: 'kelas' },
      { label: 'Data Siswa', subTab: 'siswa' },
    ],
  },
  {
    id: 'perencanaan',
    label: 'Perencanaan',
    icon: FolderKanban,
    children: [
      { label: 'CP', subTab: 'cp' },
      { label: 'TP', subTab: 'tp' },
      { label: 'ATP', subTab: 'atp' },
      { label: 'PROTA', subTab: 'prota' },
      { label: 'PROMES', subTab: 'promes' },
      { label: 'Silabus', subTab: 'silabus' },
    ],
  },
  {
    id: 'perangkat_pembelajaran',
    label: 'Perangkat Pembelajaran',
    icon: BookOpen,
    children: [
      { label: 'Modul Ajar / RPP', subTab: 'modul' },
      { label: 'LKPD', subTab: 'lkpd' },
      { label: 'Media Pembelajaran', subTab: 'media' },
    ],
  },
  {
    id: 'asesmen',
    label: 'Asesmen',
    icon: ClipboardList,
    children: [
      { label: 'Bank Soal', subTab: 'bank_soal' },
      { label: 'Quiz & Harian', subTab: 'harian' },
      { label: 'Asesmen Sumatif', subTab: 'sumatif' },
      { label: 'STS/PTS & SAS/PAS', subTab: 'ujian' },
      { label: 'Kisi-Kisi & Kunci', subTab: 'kisi' },
    ],
  },
  {
    id: 'administrasi_kelas',
    label: 'Administrasi Kelas',
    icon: Users,
    children: [
      { label: 'Presensi', subTab: 'presensi' },
      { label: 'Jurnal Mengajar', subTab: 'jurnal' },
      { label: 'Daftar Nilai', subTab: 'nilai' },
      { label: 'Rekap & Analisis TP', subTab: 'rekap' },
    ],
  },
  {
    id: 'rapor',
    label: 'Rapor',
    icon: Award,
    children: [
      { label: 'Capaian Pembelajaran', subTab: 'capaian' },
      { label: 'Deskripsi Rapor', subTab: 'deskripsi' },
      { label: 'Rekap Rapor', subTab: 'rekap' },
    ],
  },
  {
    id: 'dokumen',
    label: 'Dokumen & Supervisi',
    icon: FileText,
    children: [
      { label: 'Paket Supervisi (ZIP)', subTab: 'supervisi' },
      { label: 'Template Sekolah', subTab: 'template' },
      { label: 'Generator DOCX', subTab: 'generator' },
      { label: 'Arsip', subTab: 'arsip' },
    ],
  },
  { id: 'ai_asisten', label: 'AI Asisten Guru', icon: Sparkles },
  { id: 'monitoring', label: 'Monitoring Administrasi', icon: CheckSquare },
  { id: 'backup', label: 'Backup & Restore', icon: DatabaseBackup },
  { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
];

const AppShell: React.FC = () => {
  const {
    ready,
    activeNav,
    activeSubTab,
    navigate,
    academicYears,
    activeYear,
    school,
    switchYear,
    switchSemester,
    serverRecovery,
    restoreFromServer,
    dismissServerRecovery,
    lastSyncedAt,
  } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Memuat database GURU ADMIN PRO...
      </div>
    );
  }

  const activeNavConfig = NAV_ITEMS.find((n) => n.id === activeNav);

  const schoolLogo =
    school?.logoBase64 === '' ? '' : school?.logoBase64 || DEFAULT_SCHOOL_LOGO_URL;

  const renderPage = () => {
    switch (activeNav) {
      case 'dashboard':
        return <DashboardPage onOpenSearch={() => setSearchOpen(true)} />;
      case 'identitas':
        return <IdentityPage />;
      case 'data_akademik':
        return <AcademicDataPage />;
      case 'perencanaan':
        return <PlanningPage />;
      case 'perangkat_pembelajaran':
        return <LearningToolsPage />;
      case 'asesmen':
        return <AssessmentPage />;
      case 'administrasi_kelas':
        return <ClassAdminPage />;
      case 'rapor':
        return <ReportCardPage />;
      case 'dokumen':
        return <DocumentsPage />;
      case 'ai_asisten':
        return <AiAssistantPage />;
      case 'monitoring':
        return <MonitoringPage />;
      case 'backup':
        return <BackupPage />;
      case 'pengaturan':
        return <SettingsPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden no-print"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform lg:translate-x-0 lg:static lg:shrink-0 no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="flex items-center gap-2.5 text-left min-w-0"
          >
            {schoolLogo && (
              <img
                src={schoolLogo}
                alt="Logo Sekolah"
                className="w-9 h-9 object-contain shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-blue-950 whitespace-nowrap">
                GURU ADMIN PRO
              </div>
              <div className="text-[11px] text-slate-500 whitespace-nowrap truncate">
                Administrasi Satu Tahun Ajaran
              </div>
            </div>
          </button>
          <button
            type="button"
            className="lg:hidden p-1.5 text-slate-500"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    navigate(item.id, item.children?.[0]?.subTab || '');
                    setSidebarOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors text-left ${
                    isActive
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>

                {isActive && item.children && (
                  <div className="mt-1 ml-6 pl-3 border-l border-slate-200 space-y-0.5">
                    {item.children.map((sub) => {
                      const subActive = activeSubTab === sub.subTab;
                      return (
                        <button
                          key={sub.subTab}
                          type="button"
                          onClick={() => {
                            navigate(item.id, sub.subTab);
                            setSidebarOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                            subActive
                              ? 'text-blue-900 bg-blue-50'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-600 bg-slate-50 flex items-center gap-3">
          {schoolLogo && (
            <img
              src={schoolLogo}
              alt="Logo Sekolah"
              className="w-8 h-8 object-contain shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="font-semibold text-slate-800 truncate">
              {school?.name || 'Sekolah Belum Diatur'}
            </div>
            <div className="font-mono text-[11px] text-slate-500 mt-0.5">
              TA {activeYear?.name || '-'} · Sem {activeYear?.activeSemester || 1}
            </div>
            {lastSyncedAt && (
              <div className="text-[11px] text-teal-700 mt-0.5">
                Tersinkronisasi otomatis
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500 truncate">
              <span>GURU ADMIN PRO</span>
              <span className="mx-2">/</span>
              <span className="font-semibold text-slate-900">
                {activeNavConfig?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {academicYears.length > 0 && activeYear && (
              <div className="hidden md:flex items-center gap-1.5">
                <select
                  aria-label="Pilih Tahun Ajaran Aktif"
                  value={activeYear.id}
                  onChange={(e) => switchYear(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-mono font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      TA {y.name}{y.isArchived ? ' (Arsip)' : ''}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Pilih Semester Aktif"
                  value={activeYear.activeSemester}
                  onChange={(e) =>
                    switchSemester(Number(e.target.value) as 1 | 2)
                  }
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value={1}>Sem 1</option>
                  <option value={2}>Sem 2</option>
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cari Data...</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('dokumen', 'supervisi')}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg whitespace-nowrap shrink-0"
            >
              Paket Supervisi
            </button>
          </div>
        </header>

        {/* Recovery & Archive Banners */}
        {serverRecovery && (
          <div className="bg-teal-50 border-b border-teal-200 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-teal-950 no-print">
            <div>
              <strong>Ditemukan cadangan data tersimpan di server</strong> (Tahun Ajaran{' '}
              <span className="font-mono font-semibold">
                {serverRecovery.academicYearName}
              </span>
              , diperbarui{' '}
              {new Date(serverRecovery.updatedAt).toLocaleString('id-ID')}). Pulihkan agar pekerjaan sebelumnya langsung berlanjut tanpa mengetik ulang.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={restoreFromServer}
                className="px-3 py-1.5 font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
              >
                Pulihkan Data Sekarang
              </button>
              <button
                type="button"
                onClick={dismissServerRecovery}
                className="px-3 py-1.5 font-medium text-teal-900 hover:underline whitespace-nowrap"
              >
                Mulai Baru
              </button>
            </div>
          </div>
        )}

        {activeYear?.isArchived && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 no-print">
            <span>
              Anda sedang membuka <strong>Arsip Tahun Ajaran {activeYear.name}</strong>. Data tahun ini tetap tersimpan aman dan dapat dilihat atau diunduh kapan saja.
            </span>
            <button
              type="button"
              onClick={() => navigate('data_akademik', 'tahun')}
              className="font-semibold text-amber-950 underline whitespace-nowrap"
            >
              Kelola Tahun Ajaran
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">
          {renderPage()}
        </main>
      </div>

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
