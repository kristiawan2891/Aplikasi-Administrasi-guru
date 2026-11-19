import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  FileDown,
  Search,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { db } from '../db/database';
import { useApp } from '../context/AppContext';
import {
  computeMonitoringSummary,
  type MonitoringSummary,
} from '../services/monitoringService';
import {
  calculateEffectiveWeeks,
  type FullEffectiveSummary,
} from '../services/effectiveWeeks';
import {
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusText,
} from '../components/UI';
import type { Assessment, CalendarEvent } from '../types/domain';

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

  return (
    <div>
      <PageHeader
        title="Dashboard Administrasi Guru"
        description="Semua Administrasi Guru dalam Satu Sistem, Satu Tahun Pembelajaran."
        actions={
          <>
            <SecondaryButton onClick={onOpenSearch}>
              <Search className="w-4 h-4" />
              <span>Pencarian Global</span>
            </SecondaryButton>
            <PrimaryButton onClick={() => navigate('dokumen', 'supervisi')}>
              <FileDown className="w-4 h-4" />
              <span>Paket Supervisi ZIP</span>
            </PrimaryButton>
          </>
        }
      />

      {/* Active Context Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-slate-500">
              {school?.name || 'Nama Sekolah Belum Diisi'} · {school?.curriculum || 'Kurikulum Merdeka'}
            </div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {teacher?.fullName || 'Lengkapi Identitas Guru'}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span>Tahun Ajaran {activeYear?.name || '-'}</span>
              <span aria-hidden="true">·</span>
              <span>Semester {activeYear?.activeSemester || 1}</span>
              <span aria-hidden="true">·</span>
              <span>Mata Pelajaran: {activeSubjectText}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div>
              <div className="text-xs text-slate-500">Kelengkapan Administrasi</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-blue-900 tabular-nums">
                  {summary?.completionPercentage ?? 0}%
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  ({summary?.completedCount ?? 0}/{summary?.totalCount ?? 0} dokumen)
                </span>
              </div>
              <div className="mt-2 w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-700 transition-all"
                  style={{ width: `${summary?.completionPercentage ?? 0}%` }}
                />
              </div>
            </div>
            {(!school?.name || !teacher?.fullName) && (
              <SecondaryButton onClick={() => navigate('identitas')}>
                Lengkapi Identitas
              </SecondaryButton>
            )}
          </div>
        </div>
      </div>

      {/* Real Statistics Grid */}
      {loading || !summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Kelas / Rombel', value: summary.stats.classesCount, nav: 'data_akademik' as const, sub: 'kelas' },
            { label: 'Total Siswa', value: summary.stats.studentsCount, nav: 'data_akademik' as const, sub: 'siswa' },
            { label: 'Capaian (CP)', value: summary.stats.cpCount, nav: 'perencanaan' as const, sub: 'cp' },
            { label: 'Tujuan (TP)', value: summary.stats.tpCount, nav: 'perencanaan' as const, sub: 'tp' },
            { label: 'Dokumen ATP', value: summary.stats.atpCount, nav: 'perencanaan' as const, sub: 'atp' },
            { label: 'Modul Ajar', value: summary.stats.moduleCount, nav: 'perangkat_pembelajaran' as const, sub: 'modul' },
            { label: 'LKPD', value: summary.stats.lkpdCount, nav: 'perangkat_pembelajaran' as const, sub: 'lkpd' },
            { label: 'Asesmen & Soal', value: summary.stats.assessmentCount, nav: 'asesmen' as const, sub: 'harian' },
            { label: 'Jurnal Mengajar', value: summary.stats.journalCount, nav: 'administrasi_kelas' as const, sub: 'jurnal' },
            { label: 'Nilai Terinput', value: summary.stats.gradesCount, nav: 'administrasi_kelas' as const, sub: 'nilai' },
          ].map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={() => navigate(stat.nav, stat.sub)}
              className="bg-white border border-slate-200 hover:border-blue-800/40 rounded-xl p-4 text-left transition-colors"
            >
              <div className="text-xs font-medium text-slate-500">{stat.label}</div>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {stat.value}
              </div>
              <div className="mt-1 text-xs text-blue-800 inline-flex items-center gap-1">
                <span>Kelola</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main Two-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress per Kategori */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
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
              className="text-xs font-medium text-blue-800 hover:underline whitespace-nowrap"
            >
              Lihat Checklist Lengkap
            </button>
          </div>

          <div className="mt-4 space-y-3.5">
            {summary?.categoryProgress.map((cat) => (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{cat.category}</span>
                  <span className="font-mono text-xs text-slate-600 tabular-nums">
                    {cat.completed}/{cat.total} ({cat.percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      cat.percentage === 100
                        ? 'bg-teal-700'
                        : cat.percentage > 0
                          ? 'bg-blue-800'
                          : 'bg-slate-300'
                    }`}
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Pending checklist highlights */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">
              Tugas Administrasi & Pengingat Dokumen
            </h4>
            {pendingTasks.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Seluruh dokumen administrasi utama telah selesai dilengkapi.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {pendingTasks.slice(0, 6).map((item) => (
                  <div
                    key={item.key}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-sm"
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
                        className="text-xs font-medium text-blue-800 hover:underline whitespace-nowrap"
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
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">
                Minggu Efektif
              </h3>
              <button
                type="button"
                onClick={() => navigate('data_akademik', 'kalender')}
                className="text-xs font-medium text-blue-800 hover:underline"
              >
                Atur Kalender
              </button>
            </div>
            {effWeeks ? (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-xs text-slate-500">Semester 1</div>
                    <div className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
                      {effWeeks.semester1.effectiveWeeks} Minggu
                    </div>
                    <div className="text-xs font-mono text-slate-600 tabular-nums">
                      {effWeeks.semester1.totalHoursAvailable} JP efektif
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-xs text-slate-500">Semester 2</div>
                    <div className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
                      {effWeeks.semester2.effectiveWeeks} Minggu
                    </div>
                    <div className="text-xs font-mono text-slate-600 tabular-nums">
                      {effWeeks.semester2.totalHoursAvailable} JP efektif
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-600 flex justify-between pt-2 border-t border-slate-100">
                  <span>Total Hari Efektif Setahun</span>
                  <span className="font-mono font-semibold tabular-nums">
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

          {/* Agenda Sekolah */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">
                Agenda & Libur Kalender
              </h3>
              <Calendar className="w-4 h-4 text-slate-400" />
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
                    <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                      {ev.startDate} · {ev.type}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Jadwal Asesmen */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">
                Asesmen Terbaru
              </h3>
              <button
                type="button"
                onClick={() => navigate('asesmen', 'harian')}
                className="text-xs font-medium text-blue-800 hover:underline"
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
                    <div className="text-slate-500 mt-0.5">
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
  );
};
