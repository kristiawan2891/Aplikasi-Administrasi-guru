import { db } from '../db/database';
import type { NavSectionId } from '../context/AppContext';
import type { DocumentStatus } from '../types/domain';

export interface MonitoringItem {
  key: string;
  label: string;
  category:
    | 'Administrasi Identitas'
    | 'Administrasi Kelas'
    | 'Perencanaan'
    | 'Perangkat Pembelajaran'
    | 'Asesmen'
    | 'Presensi & Jurnal'
    | 'Pengolahan Nilai'
    | 'Pelaporan';
  countText: string;
  autoStatus: DocumentStatus;
  effectiveStatus: DocumentStatus;
  navTarget: NavSectionId;
  subTab?: string;
}

export interface MonitoringSummary {
  items: MonitoringItem[];
  completedCount: number;
  inProgressCount: number;
  totalCount: number;
  completionPercentage: number;
  categoryProgress: Array<{
    category: string;
    completed: number;
    total: number;
    percentage: number;
  }>;
  stats: {
    classesCount: number;
    studentsCount: number;
    cpCount: number;
    tpCount: number;
    atpCount: number;
    moduleCount: number;
    lkpdCount: number;
    assessmentCount: number;
    questionBankCount: number;
    journalCount: number;
    attendanceCount: number;
    gradesCount: number;
    reportDescCount: number;
  };
}

export async function computeMonitoringSummary(
  academicYearId: string
): Promise<MonitoringSummary> {
  const [
    school,
    teacher,
    principal,
    calConfig,
    calEvents,
    classes,
    students,
    cps,
    tps,
    atps,
    protas,
    promes,
    syllabi,
    modules,
    lkpds,
    questionBank,
    assessments,
    attendance,
    journals,
    grades,
    reports,
    backups,
    overrides,
  ] = await Promise.all([
    db.schoolProfile.get('default'),
    db.teacherProfile.get('default'),
    db.principalProfile.get('default'),
    db.calendarConfigs.where('academicYearId').equals(academicYearId).first(),
    db.calendarEvents.where('academicYearId').equals(academicYearId).toArray(),
    db.classGroups.where('academicYearId').equals(academicYearId).toArray(),
    db.students.where('academicYearId').equals(academicYearId).toArray(),
    db.cps.where('academicYearId').equals(academicYearId).toArray(),
    db.tps.where('academicYearId').equals(academicYearId).toArray(),
    db.atps.where('academicYearId').equals(academicYearId).toArray(),
    db.protas.where('academicYearId').equals(academicYearId).toArray(),
    db.promes.where('academicYearId').equals(academicYearId).toArray(),
    db.syllabi.where('academicYearId').equals(academicYearId).toArray(),
    db.modules.where('academicYearId').equals(academicYearId).toArray(),
    db.lkpds.where('academicYearId').equals(academicYearId).toArray(),
    db.questionBank.where('academicYearId').equals(academicYearId).toArray(),
    db.assessments.where('academicYearId').equals(academicYearId).toArray(),
    db.attendanceSessions.where('academicYearId').equals(academicYearId).toArray(),
    db.journals.where('academicYearId').equals(academicYearId).toArray(),
    db.studentGrades.where('academicYearId').equals(academicYearId).toArray(),
    db.reportDescriptions.where('academicYearId').equals(academicYearId).toArray(),
    db.backupRecords.toArray(),
    db.monitoringOverrides.where('academicYearId').equals(academicYearId).toArray(),
  ]);

  const overrideMap = new Map(overrides.map((o) => [o.itemKey, o.status]));

  const identityDone = Boolean(
    school?.name && teacher?.fullName && principal?.fullName
  );
  const identityPartial = Boolean(
    school?.name || teacher?.fullName || principal?.fullName
  );

  const rawItems: Array<Omit<MonitoringItem, 'effectiveStatus'>> = [
    {
      key: 'identitas',
      label: 'Identitas Sekolah, Guru & Kepala Sekolah',
      category: 'Administrasi Identitas',
      countText: identityDone ? 'Lengkap' : identityPartial ? 'Sebagian terisi' : 'Belum diisi',
      autoStatus: identityDone ? 'Selesai' : identityPartial ? 'Dalam proses' : 'Belum dibuat',
      navTarget: 'identitas',
    },
    {
      key: 'data_kelas',
      label: 'Data Kelas / Rombel',
      category: 'Administrasi Kelas',
      countText: `${classes.length} kelas`,
      autoStatus: classes.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'data_akademik',
      subTab: 'kelas',
    },
    {
      key: 'data_siswa',
      label: 'Data Siswa',
      category: 'Administrasi Kelas',
      countText: `${students.length} siswa`,
      autoStatus: students.length > 0 ? 'Selesai' : classes.length > 0 ? 'Dalam proses' : 'Belum dibuat',
      navTarget: 'data_akademik',
      subTab: 'siswa',
    },
    {
      key: 'kalender',
      label: 'Kalender Pendidikan',
      category: 'Perencanaan',
      countText: `${calEvents.length} agenda/libur`,
      autoStatus: calConfig && calEvents.length > 0 ? 'Selesai' : calConfig ? 'Dalam proses' : 'Belum dibuat',
      navTarget: 'data_akademik',
      subTab: 'kalender',
    },
    {
      key: 'minggu_efektif',
      label: 'Perhitungan Minggu Efektif',
      category: 'Perencanaan',
      countText: calConfig ? `${calConfig.hoursPerWeek} JP/minggu` : 'Belum diatur',
      autoStatus: calConfig ? 'Selesai' : 'Belum dibuat',
      navTarget: 'data_akademik',
      subTab: 'kalender',
    },
    {
      key: 'cp',
      label: 'Capaian Pembelajaran (CP)',
      category: 'Perencanaan',
      countText: `${cps.length} CP`,
      autoStatus: cps.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'perencanaan',
      subTab: 'cp',
    },
    {
      key: 'tp',
      label: 'Tujuan Pembelajaran (TP)',
      category: 'Perencanaan',
      countText: `${tps.length} TP`,
      autoStatus: tps.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'perencanaan',
      subTab: 'tp',
    },
    {
      key: 'atp',
      label: 'Alur Tujuan Pembelajaran (ATP)',
      category: 'Perencanaan',
      countText: `${atps.length} ATP`,
      autoStatus: atps.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'perencanaan',
      subTab: 'atp',
    },
    {
      key: 'prota',
      label: 'Program Tahunan (PROTA)',
      category: 'Perencanaan',
      countText: `${protas.length} entri`,
      autoStatus: protas.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'perencanaan',
      subTab: 'prota',
    },
    {
      key: 'promes',
      label: 'Program Semester (PROMES)',
      category: 'Perencanaan',
      countText: `${promes.length} entri`,
      autoStatus: promes.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'perencanaan',
      subTab: 'promes',
    },
    {
      key: 'silabus',
      label: 'Silabus Pembelajaran',
      category: 'Perencanaan',
      countText: `${syllabi.length} baris`,
      autoStatus: syllabi.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'perencanaan',
      subTab: 'silabus',
    },
    {
      key: 'modul_ajar',
      label: 'Modul Ajar / RPP',
      category: 'Perangkat Pembelajaran',
      countText: `${modules.length} modul`,
      autoStatus: modules.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'perangkat_pembelajaran',
      subTab: 'modul',
    },
    {
      key: 'lkpd',
      label: 'Lembar Kerja Peserta Didik (LKPD)',
      category: 'Perangkat Pembelajaran',
      countText: `${lkpds.length} LKPD`,
      autoStatus: lkpds.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'perangkat_pembelajaran',
      subTab: 'lkpd',
    },
    {
      key: 'bank_soal',
      label: 'Bank Soal',
      category: 'Asesmen',
      countText: `${questionBank.length} butir soal`,
      autoStatus: questionBank.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'asesmen',
      subTab: 'bank_soal',
    },
    {
      key: 'asesmen',
      label: 'Asesmen Harian / Sumatif / STS / SAS',
      category: 'Asesmen',
      countText: `${assessments.length} paket asesmen`,
      autoStatus: assessments.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'asesmen',
      subTab: 'harian',
    },
    {
      key: 'kisi_kunci',
      label: 'Kisi-Kisi, Kunci Jawaban & Rubrik',
      category: 'Asesmen',
      countText: `${assessments.filter((a) => a.blueprint.length > 0 || a.questionIds.length > 0 || a.customQuestions.length > 0).length} perangkat`,
      autoStatus: assessments.some((a) => a.questionIds.length > 0 || a.customQuestions.length > 0)
        ? 'Selesai'
        : assessments.length > 0
          ? 'Dalam proses'
          : 'Belum dibuat',
      navTarget: 'asesmen',
      subTab: 'kisi',
    },
    {
      key: 'presensi',
      label: 'Presensi Siswa',
      category: 'Presensi & Jurnal',
      countText: `${attendance.length} sesi`,
      autoStatus: attendance.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'administrasi_kelas',
      subTab: 'presensi',
    },
    {
      key: 'jurnal',
      label: 'Jurnal Mengajar',
      category: 'Presensi & Jurnal',
      countText: `${journals.length} entri`,
      autoStatus: journals.length > 0 ? 'Selesai' : 'Belum dibuat',
      navTarget: 'administrasi_kelas',
      subTab: 'jurnal',
    },
    {
      key: 'daftar_nilai',
      label: 'Daftar Nilai',
      category: 'Pengolahan Nilai',
      countText: `${grades.filter((g) => g.score !== null).length} nilai terinput`,
      autoStatus: grades.some((g) => g.score !== null) ? 'Selesai' : 'Belum dibuat',
      navTarget: 'administrasi_kelas',
      subTab: 'nilai',
    },
    {
      key: 'rekap_nilai',
      label: 'Rekap Nilai & Analisis Ketercapaian TP',
      category: 'Pengolahan Nilai',
      countText: grades.some((g) => g.score !== null) ? 'Tersedia' : 'Menunggu nilai',
      autoStatus: grades.some((g) => g.score !== null) ? 'Selesai' : 'Belum dibuat',
      navTarget: 'administrasi_kelas',
      subTab: 'rekap',
    },
    {
      key: 'deskripsi_rapor',
      label: 'Deskripsi Rapor Siswa',
      category: 'Pelaporan',
      countText: `${reports.length} deskripsi`,
      autoStatus:
        students.length > 0 && reports.length >= students.length
          ? 'Selesai'
          : reports.length > 0
            ? 'Dalam proses'
            : 'Belum dibuat',
      navTarget: 'rapor',
      subTab: 'deskripsi',
    },
    {
      key: 'paket_supervisi',
      label: 'Paket Administrasi Supervisi & Backup',
      category: 'Pelaporan',
      countText: `${backups.length} riwayat backup`,
      autoStatus: backups.length > 0 ? 'Selesai' : 'Dalam proses',
      navTarget: 'dokumen',
      subTab: 'supervisi',
    },
  ];

  const items: MonitoringItem[] = rawItems.map((it) => ({
    ...it,
    effectiveStatus: overrideMap.get(it.key) ?? it.autoStatus,
  }));

  const completedCount = items.filter((i) => i.effectiveStatus === 'Selesai').length;
  const inProgressCount = items.filter(
    (i) => i.effectiveStatus === 'Dalam proses'
  ).length;
  const totalCount = items.length;
  const completionPercentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const categories = Array.from(new Set(items.map((i) => i.category)));
  const categoryProgress = categories.map((cat) => {
    const catItems = items.filter((i) => i.category === cat);
    const done = catItems.filter((i) => i.effectiveStatus === 'Selesai').length;
    return {
      category: cat,
      completed: done,
      total: catItems.length,
      percentage:
        catItems.length > 0 ? Math.round((done / catItems.length) * 100) : 0,
    };
  });

  return {
    items,
    completedCount,
    inProgressCount,
    totalCount,
    completionPercentage,
    categoryProgress,
    stats: {
      classesCount: classes.length,
      studentsCount: students.length,
      cpCount: cps.length,
      tpCount: tps.length,
      atpCount: atps.length,
      moduleCount: modules.length,
      lkpdCount: lkpds.length,
      assessmentCount: assessments.length,
      questionBankCount: questionBank.length,
      journalCount: journals.length,
      attendanceCount: attendance.length,
      gradesCount: grades.filter((g) => g.score !== null).length,
      reportDescCount: reports.length,
    },
  };
}
