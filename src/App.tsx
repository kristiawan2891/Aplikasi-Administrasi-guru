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
  activeClass: string;
  iconTileClass: string;
  subBorderClass: string;
  subActiveClass: string;
  children?: Array<{ label: string; subTab: string }>;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    activeClass: 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs',
    iconTileClass: 'bg-indigo-50 text-indigo-600',
    subBorderClass: 'border-indigo-200',
    subActiveClass: 'text-indigo-900 bg-indigo-50 font-semibold',
  },
  {
    id: 'identitas',
    label: 'Identitas',
    icon: Building2,
    activeClass: 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-xs',
    iconTileClass: 'bg-blue-50 text-blue-600',
    subBorderClass: 'border-blue-200',
    subActiveClass: 'text-blue-900 bg-blue-50 font-semibold',
  },
  {
    id: 'data_akademik',
    label: 'Data Akademik',
    icon: CalendarDays,
    activeClass: 'bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-xs',
    iconTileClass: 'bg-sky-50 text-sky-600',
    subBorderClass: 'border-sky-200',
    subActiveClass: 'text-sky-900 bg-sky-50 font-semibold',
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
    activeClass: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs',
    iconTileClass: 'bg-emerald-50 text-emerald-600',
    subBorderClass: 'border-emerald-200',
    subActiveClass: 'text-emerald-900 bg-emerald-50 font-semibold',
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
    activeClass: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs',
    iconTileClass: 'bg-amber-50 text-amber-600',
    subBorderClass: 'border-amber-200',
    subActiveClass: 'text-amber-900 bg-amber-50 font-semibold',
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
    activeClass: 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-xs',
    iconTileClass: 'bg-rose-50 text-rose-600',
    subBorderClass: 'border-rose-200',
    subActiveClass: 'text-rose-900 bg-rose-50 font-semibold',
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
    activeClass: 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs',
    iconTileClass: 'bg-violet-50 text-violet-600',
    subBorderClass: 'border-violet-200',
    subActiveClass: 'text-violet-900 bg-violet-50 font-semibold',
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
    activeClass: 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-xs',
    iconTileClass: 'bg-teal-50 text-teal-600',
    subBorderClass: 'border-teal-200',
    subActiveClass: 'text-teal-900 bg-teal-50 font-semibold',
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
    activeClass: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs',
    iconTileClass: 'bg-blue-50 text-blue-600',
    subBorderClass: 'border-blue-200',
    subActiveClass: 'text-blue-900 bg-blue-50 font-semibold',
    children: [
      { label: 'Paket Supervisi (ZIP)', subTab: 'supervisi' },
      { label: 'Template Sekolah', subTab: 'template' },
      { label: 'Generator DOCX', subTab: 'generator' },
      { label: 'Arsip', subTab: 'arsip' },
    ],
  },
  {
    id: 'ai_asisten',
    label: 'AI Asisten Guru',
    icon: Sparkles,
    activeClass: 'bg-gradient-to-r from-teal-500 via-emerald-600 to-cyan-600 text-white shadow-xs',
    iconTileClass: 'bg-teal-50 text-teal-600',
    subBorderClass: 'border-teal-200',
    subActiveClass: 'text-teal-900 bg-teal-50 font-semibold',
  },
  {
    id: 'monitoring',
    label: 'Monitoring Administrasi',
    icon: CheckSquare,
    activeClass: 'bg-gradient-to-r from-emerald-600 to-lime-600 text-white shadow-xs',
    iconTileClass: 'bg-lime-50 text-lime-700',
    subBorderClass: 'border-lime-200',
    subActiveClass: 'text-lime-900 bg-lime-50 font-semibold',
  },
  {
    id: 'backup',
    label: 'Backup & Restore',
    icon: DatabaseBackup,
    activeClass: 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-xs',
    iconTileClass: 'bg-fuchsia-50 text-fuchsia-600',
    subBorderClass: 'border-fuchsia-200',
    subActiveClass: 'text-fuchsia-900 bg-fuchsia-50 font-semibold',
  },
  {
    id: 'pengaturan',
    label: 'Pengaturan',
    icon: Settings,
    activeClass: 'bg-gradient-to-r from-slate-700 to-indigo-700 text-white shadow-xs',
    iconTileClass: 'bg-slate-100 text-slate-600',
    subBorderClass: 'border-slate-200',
    subActiveClass: 'text-slate-900 bg-slate-100 font-semibold',
  },
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
      <div className="min-h-screen flex items-center justify-center text-sm font-medium text-indigo-800">
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
    <div className="min-h-screen flex flex-col text-slate-900">
      {/* Top Color Spectrum Accent Bar */}
      <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-indigo-600 via-emerald-500 via-amber-500 to-rose-500 shrink-0 no-print" />

      <div className="flex-1 flex min-w-0">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden no-print"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white/95 backdrop-blur-md border-r border-indigo-100 flex flex-col transition-transform lg:translate-x-0 lg:static lg:shrink-0 no-print ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-16 px-4 border-b border-indigo-100/80 bg-gradient-to-r from-indigo-50/70 via-white to-sky-50/70 flex items-center justify-between gap-2 shrink-0">
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
                <div className="font-display text-sm font-extrabold tracking-tight bg-gradient-to-r from-indigo-700 via-blue-700 to-teal-600 bg-clip-text text-transparent whitespace-nowrap">
                  GURU ADMIN PRO
                </div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap truncate">
                  Administrasi Satu Tahun Ajaran
                </div>
              </div>
            </button>
            <button
              type="button"
              className="lg:hidden p-1.5 text-slate-500 hover:text-indigo-700"
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
                    className={`w-full px-2.5 py-2 rounded-xl text-sm font-medium flex items-center gap-2.5 transition-all duration-150 text-left ${
                      isActive
                        ? item.activeClass
                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isActive ? 'bg-white/20 text-white' : item.iconTileClass
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>

                  {isActive && item.children && (
                    <div
                      className={`mt-1.5 ml-6 pl-3 border-l ${item.subBorderClass} space-y-0.5`}
                    >
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
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              subActive
                                ? item.subActiveClass
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

          <div className="p-3.5 border-t border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-sky-50/60 to-emerald-50/60 flex items-center gap-3">
            {schoolLogo && (
              <div className="w-9 h-9 rounded-lg bg-white border border-indigo-100 p-1 flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src={schoolLogo}
                  alt="Logo Sekolah"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div className="min-w-0 text-xs">
              <div className="font-semibold text-slate-900 truncate">
                {school?.name || 'Sekolah Belum Diatur'}
              </div>
              <div className="font-mono text-[11px] text-indigo-800 mt-0.5 tabular-nums">
                TA {activeYear?.name || '-'} · Sem {activeYear?.activeSemester || 1}
              </div>
              {lastSyncedAt && (
                <div className="text-[11px] font-medium text-emerald-700 mt-0.5">
                  Tersinkronisasi otomatis
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-16 bg-white/90 backdrop-blur-md border-b border-indigo-100 px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0 no-print">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-indigo-700 hover:bg-indigo-50 rounded-lg"
                aria-label="Buka menu navigasi"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="text-sm text-slate-500 truncate">
                <span className="font-semibold text-indigo-700">GURU ADMIN PRO</span>
                <span className="mx-2 text-slate-300">/</span>
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
                    className="px-2.5 py-1.5 text-xs font-mono font-medium bg-indigo-50/70 border border-indigo-200 rounded-lg text-indigo-950 focus:outline-none focus:border-indigo-500"
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        TA {y.name}
                        {y.isArchived ? ' (Arsip)' : ''}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Pilih Semester Aktif"
                    value={activeYear.activeSemester}
                    onChange={(e) =>
                      switchSemester(Number(e.target.value) as 1 | 2)
                    }
                    className="px-2.5 py-1.5 text-xs font-medium bg-teal-50/70 border border-teal-200 rounded-lg text-teal-950 focus:outline-none focus:border-teal-500"
                  >
                    <option value={1}>Sem 1</option>
                    <option value={2}>Sem 2</option>
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-900 border border-transparent hover:border-indigo-200 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Cari Data...</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('dokumen', 'supervisi')}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-xs whitespace-nowrap shrink-0 transition-all duration-150"
              >
                Paket Supervisi
              </button>
            </div>
          </header>

          {/* Recovery & Archive Banners */}
          {serverRecovery && (
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-200 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-teal-950 no-print">
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
                  className="px-3 py-1.5 font-medium text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-lg whitespace-nowrap"
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
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950 no-print">
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
