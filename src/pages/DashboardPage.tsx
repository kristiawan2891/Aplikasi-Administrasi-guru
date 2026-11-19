import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileDown,
  FileSpreadsheet,
  FolderKanban,
  GraduationCap,
  Layers,
  NotebookPen,
  School,
  Search,
  Target,
} from 'lucide-react';
import { DEFAULT_SCHOOL_LOGO_URL, db } from '../db/database';
import { useApp } from '../context/AppContext';
import {
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusText,
} from '../components/UI';
import type { Assessment, CalendarEvent } from '../types/domain';

const PROGRESS_BAR_GRADIENTS = [
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-indigo-500 to-cyan-600',
];

export const DashboardPage: React.FC<{ onOpenSearch: () => void }> = ({
  onOpenSearch,
}) => {
  const { school, teacher, activeYear, dataVersion, navigate } = useApp();
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [effWeeks, setEffWeeks] = useState<FullEffectiveSummary | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeYear) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [mon, calConfig, calEvents, asmtList] = await Promise.all([
        computeMonitoringSummary(activeYear.id),
        db.calendarConfigs.where('academicYearId').equals(activeYear.id).first(),
        db.calendarEvents.where('academicYearId').equals(activeYear.id).toArray(),
        db.assessments.where('academicYearId').equals(activeYear.id).toArray(),
      ]);
      if (!cancelled) {
        setSummary(mon);
        if (calConfig) {
          setEffWeeks(calculateEffectiveWeeks(calConfig, calEvents));
        }
        setEvents(calEvents.sort((a, b) => a.startDate.localeCompare(b.startDate)));
        setAssessments(asmtList.sort((a, b) => a.date.localeCompare(b.date)));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeYear, dataVersion]);

  const activeSubjectText =
    teacher?.subjects && teacher.subjects.length > 0
      ? teacher.subjects.join(', ')
      : 'Belum diatur';

  const pendingTasks =
    summary?.items.filter((i) => i.effectiveStatus !== 'Selesai') ?? [];

  const schoolLogo =
    school?.logoBase64 === '' ? '' : school?.logoBase64 || DEFAULT_SCHOOL_LOGO_URL;

  const statCards = summary
    ? [
        {
          label: 'Kelas / Rombel',
          value: summary.stats.classesCount,
          nav: 'data_akademik' as const,
          sub: 'kelas',
          icon: School,
          topBar: 'from-sky-400 to-cyan-500',
          iconBox: 'bg-sky-50 text-sky-600',
          linkColor: 'text-sky-700',
          hoverBorder: 'hover:border-sky-300',
        },
        {
          label: 'Total Siswa',
          value: summary.stats.studentsCount,
          nav: 'data_akademik' as const,
          sub: 'siswa',
          icon: GraduationCap,
          topBar: 'from-blue-500 to-indigo-600',
          iconBox: 'bg-blue-50 text-blue-600',
          linkColor: 'text-blue-700',
          hoverBorder: 'hover:border-blue-300',
        },
        {
          label: 'Capaian (CP)',
          value: summary.stats.cpCount,
          nav: 'perencanaan' as const,
          sub: 'cp',
          icon: Award,
          topBar: 'from-emerald-500 to-teal-500',
          iconBox: 'bg-emerald-50 text-emerald-600',
          linkColor: 'text-emerald-700',
          hoverBorder: 'hover:border-emerald-300',
        },
        {
          label: 'Tujuan (TP)',
          value: summary.stats.tpCount,
          nav: 'perencanaan' as const,
          sub: 'tp',
          icon: Target,
          topBar: 'from-teal-500 to-cyan-600',
          iconBox: 'bg-teal-50 text-teal-600',
          linkColor: 'text-teal-700',
          hoverBorder: 'hover:border-teal-300',
        },
        {
          label: 'Dokumen ATP',
          value: summary.stats.atpCount,
          nav: 'perencanaan' as const,
          sub: 'atp',
          icon: FolderKanban,
          topBar: 'from-lime-500 to-emerald-600',
          iconBox: 'bg-lime-50 text-lime-700',
          linkColor: 'text-lime-700',
          hoverBorder: 'hover:border-lime-300',
        },
        {
          label: 'Modul Ajar',
          value: summary.stats.moduleCount,
          nav: 'perangkat_pembelajaran' as const,
          sub: 'modul',
          icon: BookOpen,
          topBar: 'from-amber-400 to-orange-500',
          iconBox: 'bg-amber-50 text-amber-600',
          linkColor: 'text-amber-700',
          hoverBorder: 'hover:border-amber-300',
        },
        {
          label: 'LKPD',
          value: summary.stats.lkpdCount,
          nav: 'perangkat_pembelajaran' as const,
          sub: 'lkpd',
          icon: Layers,
          topBar: 'from-orange-500 to-rose-500',
          iconBox: 'bg-orange-50 text-orange-600',
          linkColor: 'text-orange-700',
          hoverBorder: 'hover:border-orange-300',
        },
        {
          label: 'Asesmen & Soal',
          value: summary.stats.assessmentCount,
          nav: 'asesmen' as const,
          sub: 'harian',
          icon: ClipboardList,
          topBar: 'from-rose-500 to-pink-600',
          iconBox: 'bg-rose-50 text-rose-600',
          linkColor: 'text-rose-700',
          hoverBorder: 'hover:border-rose-300',
        },
        {
          label: 'Jurnal Mengajar',
          value: summary.stats.journalCount,
          nav: 'administrasi_kelas' as const,
          sub: 'jurnal',
          icon: NotebookPen,
          topBar: 'from-violet-500 to-purple-600',
          iconBox: 'bg-violet-50 text-violet-600',
          linkColor: 'text-violet-700',
          hoverBorder: 'hover:border-violet-300',
        },
        {
          label: 'Nilai Terinput',
          value: summary.stats.gradesCount,
          nav: 'administrasi_kelas' as const,
          sub: 'nilai',
          icon: FileSpreadsheet,
          topBar: 'from-indigo-500 to-fuchsia-600',
          iconBox: 'bg-indigo-50 text-indigo-600',
          linkColor: 'text-indigo-700',
          hoverBorder: 'hover:border-indigo-300',
        },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Dashboard Administrasi Guru"
        description="Semua Administrasi Guru dalam Satu Sistem, Satu Tahun Pembelajaran."
        actions={
          <>
            <SecondaryButton onClick={onOpenSearch}>
              <Search className="w-4 h-4 text-indigo-600" />
              <span>Pencarian Global</span>
            </SecondaryButton>
            <PrimaryButton onClick={() => navigate('dokumen', 'supervisi')}>
              <FileDown className="w-4 h-4" />
              <span>Paket Supervisi ZIP</span>
            </PrimaryButton>
          </>
        }
      />

      {/* Colorful Active Context Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-blue-700 to-teal-600 text-white rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            {schoolLogo && (
              <div className="w-16 h-16 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src={schoolLogo}
                  alt="Logo Sekolah"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-medium text-sky-100">
                {school?.name || 'Nama Sekolah Belum Diisi'} ·{' '}
                {school?.curriculum || 'Kurikulum Merdeka'}
              </div>
              <h2 className="mt-1 font-display text-xl font-bold text-white truncate">
                {teacher?.fullName || 'Lengkapi Identitas Guru'}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sky-100">
                <span>Tahun Ajaran {activeYear?.name || '-'}</span>
                <span aria-hidden="true">·</span>
                <span>Semester {activeYear?.activeSemester || 1}</span>
                <span aria-hidden="true">·</span>
                <span>Mata Pelajaran: {activeSubjectText}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0 bg-white/10 border border-white/20 rounded-xl px-4 py-3">
            <div>
              <div className="text-xs text-sky-100">Kelengkapan Administrasi</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold font-mono text-white tabular-nums">
                  {summary?.completionPercentage ?? 0}%
                </span>
                <span className="text-xs text-sky-100 tabular-nums">
                  ({summary?.completedCount ?? 0}/{summary?.totalCount ?? 0} dokumen)
                </span>
              </div>
              <div className="mt-2 w-48 h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-300 via-lime-300 to-emerald-300 transition-all"
                  style={{ width: `${summary?.completionPercentage ?? 0}%` }}
                />
              </div>
            </div>
            {(!school?.name || !teacher?.fullName) && (
              <button
                type="button"
                onClick={() => navigate('identitas')}
                className="px-3.5 py-2 text-xs font-semibold text-indigo-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors whitespace-nowrap"
              >
                Lengkapi Identitas
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Colorful Statistics Grid */}
      {loading || !summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className="h-28 bg-white/80 border border-slate-200 rounded-xl"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.label}
                type="button"
                onClick={() => navigate(stat.nav, stat.sub)}
                className={`bg-white/95 border border-slate-200/90 ${stat.hoverBorder} rounded-xl overflow-hidden text-left transition-all duration-150 shadow-xs hover:-translate-y-0.5`}
              >
                <div className={`h-1 w-full bg-gradient-to-r ${stat.topBar}`} />
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600 truncate">
                      {stat.label}
                    </span>
                    <span
                      className={`w-8 h-8 rounded-lg ${stat.iconBox} flex items-center justify-center shrink-0`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2 font-display text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {stat.value}
                  </div>
                  <div
                    className={`mt-1 text-xs font-semibold ${stat.linkColor} inline-flex items-center gap-1`}
                  >
                    <span>Kelola</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Two-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress per Kategori */}
        <div className="lg:col-span-2 bg-white/95 border border-indigo-100 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Progres Kelengkapan per Kategori
              </h3>
              <p className="text-xs text-slate-500">
                Dihitung otomatis dari data nyata pada tahun ajaran {activeYear?.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('monitoring')}
              className="text-xs font-semibold text-indigo-700 hover:underline whitespace-nowrap"
            >
              Lihat Checklist Lengkap
            </button>
          </div>

          <div className="mt-4 space-y-3.5">
            {summary?.categoryProgress.map((cat, idx) => {
              const barGrad =
                PROGRESS_BAR_GRADIENTS[idx % PROGRESS_BAR_GRADIENTS.length];
              return (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{cat.category}</span>
                    <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
                      {cat.completed}/{cat.total} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all bg-gradient-to-r ${
                        cat.percentage > 0 ? barGrad : 'from-slate-300 to-slate-300'
                      }`}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pending checklist highlights */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">
              Tugas Administrasi & Pengingat Dokumen
            </h4>
            {pendingTasks.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-900 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Seluruh dokumen administrasi utama telah selesai dilengkapi.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {pendingTasks.slice(0, 6).map((item) => (
                  <div
                    key={item.key}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-sm hover:bg-indigo-50/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">
                        {item.label}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.category} · {item.countText}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusText status={item.effectiveStatus} />
                      <button
                        type="button"
                        onClick={() => navigate(item.navTarget, item.subTab || '')}
                        className="text-xs font-semibold text-indigo-700 hover:underline whitespace-nowrap"
                      >
                        Buka
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Minggu Efektif, Agenda, Jadwal Asesmen */}
        <div className="space-y-6">
          {/* Minggu Efektif */}
          <div className="bg-white/95 border border-sky-100 rounded-xl overflow-hidden shadow-xs">
            <div className="h-1 w-full bg-gradient-to-r from-sky-500 to-teal-500" />
            <div className="p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">
                  Minggu Efektif
                </h3>
                <button
                  type="button"
                  onClick={() => navigate('data_akademik', 'kalender')}
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  Atur Kalender
                </button>
              </div>
              {effWeeks ? (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-sky-50/80 border border-sky-200/80 rounded-lg">
                      <div className="text-xs font-medium text-sky-900">Semester 1</div>
                      <div className="mt-1 font-display text-lg font-bold font-mono text-sky-950 tabular-nums">
                        {effWeeks.semester1.effectiveWeeks} Minggu
                      </div>
                      <div className="text-xs font-mono text-sky-800 tabular-nums">
                        {effWeeks.semester1.totalHoursAvailable} JP efektif
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-lg">
                      <div className="text-xs font-medium text-emerald-900">
                        Semester 2
                      </div>
                      <div className="mt-1 font-display text-lg font-bold font-mono text-emerald-950 tabular-nums">
                        {effWeeks.semester2.effectiveWeeks} Minggu
                      </div>
                      <div className="text-xs font-mono text-emerald-800 tabular-nums">
                        {effWeeks.semester2.totalHoursAvailable} JP efektif
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-700 flex justify-between pt-2 border-t border-slate-100">
                    <span>Total Hari Efektif Setahun</span>
                    <span className="font-mono font-semibold text-indigo-900 tabular-nums">
                      {effWeeks.totalEffectiveDays} hari
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  Konfigurasi kalender pendidikan belum diatur.
                </p>
              )}
            </div>
          </div>

          {/* Agenda Sekolah */}
          <div className="bg-white/95 border border-amber-100 rounded-xl overflow-hidden shadow-xs">
            <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-orange-500" />
            <div className="p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">
                  Agenda & Libur Kalender
                </h3>
                <Calendar className="w-4 h-4 text-amber-600" />
              </div>
              {events.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  Belum ada agenda atau hari libur tercatat. Tambahkan di menu Kalender Pendidikan.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {events.slice(0, 5).map((ev) => (
                    <li key={ev.id} className="py-2 text-xs">
                      <div className="font-medium text-slate-900">{ev.title}</div>
                      <div className="text-amber-800 font-mono tabular-nums mt-0.5">
                        {ev.startDate} · {ev.type}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Jadwal Asesmen */}
          <div className="bg-white/95 border border-rose-100 rounded-xl overflow-hidden shadow-xs">
            <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-pink-500" />
            <div className="p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-rose-600" />
                  <h3 className="text-base font-semibold text-slate-900">
                    Asesmen Terbaru
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('asesmen', 'harian')}
                  className="text-xs font-semibold text-rose-700 hover:underline"
                >
                  Semua Asesmen
                </button>
              </div>
              {assessments.length === 0 ? (
                <div className="mt-3 flex items-start gap-2 text-xs text-slate-500">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Belum ada asesmen terjadwal pada tahun ajaran ini.</span>
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {assessments.slice(0, 5).map((a) => (
                    <li key={a.id} className="py-2 text-xs">
                      <div className="font-medium text-slate-900">{a.name}</div>
                      <div className="text-rose-800 mt-0.5">
                        {a.category} · Kelas {a.gradeLevel} · {a.date || 'Belum bertanggal'}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import {
  computeMonitoringSummary,
  type MonitoringSummary,
} from '../services/monitoringService';
import {
  calculateEffectiveWeeks,
  type FullEffectiveSummary,
} from '../services/effectiveWeeks';
