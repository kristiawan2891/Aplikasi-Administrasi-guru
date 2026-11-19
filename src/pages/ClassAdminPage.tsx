import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Printer,
  Trash2,
  Upload,
} from 'lucide-react';
import { createId, db } from '../db/database';
import { useApp } from '../context/AppContext';
import {
  DocxButton,
  EmptyState,
  FormField,
  inputClass,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SegmentedTabs,
} from '../components/UI';
import { computeClassGradeAnalytics } from '../services/gradeEngine';
import {
  downloadGradeImportTemplate,
  exportAttendanceToExcel,
  exportGradesToExcel,
  parseGradeExcelFile,
} from '../services/excelService';
import {
  downloadDocxBlob,
  generateAttendanceDocx,
  generateGradesDocx,
  generateJournalsDocx,
} from '../services/docxGenerator';
import type {
  AttendanceSession,
  AttendanceStatus,
  ClassGroup,
  GradeComponent,
  LearningObjectiveTP,
  SemesterNumber,
  Student,
  StudentGrade,
  TeachingJournal,
  TeachingModule,
} from '../types/domain';

export const ClassAdminPage: React.FC = () => {
  const {
    activeSubTab,
    activeYear,
    school,
    teacher,
    principal,
    settings,
    dataVersion,
    refreshData,
    notify,
    confirm,
    navigate,
  } = useApp();

  const [tab, setTab] = useState<'presensi' | 'jurnal' | 'nilai' | 'rekap'>(
    'presensi'
  );
  useEffect(() => {
    if (
      activeSubTab === 'presensi' ||
      activeSubTab === 'jurnal' ||
      activeSubTab === 'nilai' ||
      activeSubTab === 'rekap'
    ) {
      setTab(activeSubTab);
    }
  }, [activeSubTab]);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [semester, setSemester] = useState<SemesterNumber>(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [tps, setTps] = useState<LearningObjectiveTP[]>([]);
  const [modules, setModules] = useState<TeachingModule[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [components, setComponents] = useState<GradeComponent[]>([]);
  const [grades, setGrades] = useState<StudentGrade[]>([]);

  // Presensi state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attMeeting, setAttMeeting] = useState(1);
  const [attHours, setAttHours] = useState('1-2');
  const [attDraft, setAttDraft] = useState<Record<string, AttendanceStatus>>({});

  // Journal state
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [jDate, setJDate] = useState(new Date().toISOString().slice(0, 10));
  const [jMeeting, setJMeeting] = useState(1);
  const [jHours, setJHours] = useState('1-2');
  const [jTpId, setJTpId] = useState('');
  const [jMaterial, setJMaterial] = useState('');
  const [jActivities, setJActivities] = useState('');
  const [jMethod, setJMethod] = useState('Diskusi & Latihan');
  const [jReflection, setJReflection] = useState('');
  const [jFollowUp, setJFollowUp] = useState('');

  // Grade Component Editor
  const [newCompName, setNewCompName] = useState('');
  const [newCompWeight, setNewCompWeight] = useState(10);
  const [selectedTpForGrade, setSelectedTpForGrade] = useState('');

  useEffect(() => {
    if (activeYear) setSemester(activeYear.activeSemester);
  }, [activeYear]);

  useEffect(() => {
    if (!activeYear) return;
    let cancelled = false;
    (async () => {
      const yId = activeYear.id;
      const [clsL, tpL, modL, compL] = await Promise.all([
        db.classGroups.where('academicYearId').equals(yId).toArray(),
        db.tps.where('academicYearId').equals(yId).toArray(),
        db.modules.where('academicYearId').equals(yId).toArray(),
        db.gradeComponents.where('academicYearId').equals(yId).toArray(),
      ]);
      if (!cancelled) {
        const sortedCls = clsL.sort((a, b) => a.name.localeCompare(b.name));
        setClasses(sortedCls);
        setTps(tpL);
        setModules(modL);
        setComponents(
          compL
            .filter((c) => c.semester === semester)
            .sort((a, b) => a.orderIndex - b.orderIndex)
        );
        if (sortedCls.length > 0 && !sortedCls.some((c) => c.id === selectedClassId)) {
          setSelectedClassId(sortedCls[0].id);
        }
        if (tpL.length > 0 && !jTpId) setJTpId(tpL[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeYear, semester, dataVersion]);

  useEffect(() => {
    if (!activeYear || !selectedClassId) return;
    let cancelled = false;
    (async () => {
      const [stL, attL, jL, grL] = await Promise.all([
        db.students.where('classId').equals(selectedClassId).toArray(),
        db.attendanceSessions.where('classId').equals(selectedClassId).toArray(),
        db.journals.where('classId').equals(selectedClassId).toArray(),
        db.studentGrades.where('classId').equals(selectedClassId).toArray(),
      ]);
      if (!cancelled) {
        const sortedSt = stL.sort((a, b) => a.orderNumber - b.orderNumber);
        setStudents(sortedSt);
        setSessions(
          attL
            .filter((s) => s.semester === semester)
            .sort((a, b) => a.date.localeCompare(b.date))
        );
        setJournals(
          jL
            .filter((j) => j.semester === semester)
            .sort((a, b) => a.date.localeCompare(b.date))
        );
        setGrades(grL.filter((g) => g.semester === semester));

        const initialDraft: Record<string, AttendanceStatus> = {};
        for (const s of sortedSt) initialDraft[s.id] = 'H';
        setAttDraft(initialDraft);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeYear, selectedClassId, semester, dataVersion]);

  const activeClass = classes.find((c) => c.id === selectedClassId) ?? null;

  const identityBundle = useMemo(
    () =>
      school && teacher && principal
        ? {
            school,
            teacher,
            principal,
            academicYear: activeYear ?? undefined,
            settings: settings ?? undefined,
          }
        : null,
    [school, teacher, principal, activeYear, settings]
  );

  const gradeAnalytics = useMemo(() => {
    return computeClassGradeAnalytics({
      students,
      components,
      grades,
      tps,
      kktpThreshold: settings?.kktpThreshold ?? 75,
    });
  }, [students, components, grades, tps, settings]);

  // ======================== PRESENSI HANDLERS ========================
  const resetAttendanceDraft = () => {
    setEditingSessionId(null);
    const allH: Record<string, AttendanceStatus> = {};
    students.forEach((s) => (allH[s.id] = 'H'));
    setAttDraft(allH);
  };

  const handleEditAttendanceSession = (sess: AttendanceSession) => {
    setEditingSessionId(sess.id);
    setAttDate(sess.date);
    setAttMeeting(sess.meetingNumber);
    setAttHours(sess.lessonHours);
    const loaded: Record<string, AttendanceStatus> = {};
    students.forEach((st) => {
      const rec = sess.records.find((r) => r.studentId === st.id);
      loaded[st.id] = rec?.status ?? 'H';
    });
    setAttDraft(loaded);
  };

  const handleDeleteAttendanceSession = async (sess: AttendanceSession) => {
    const ok = await confirm({
      title: `Hapus Presensi Pertemuan ${sess.meetingNumber}?`,
      message: `Data presensi tanggal ${sess.date} akan dihapus.`,
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    await db.attendanceSessions.delete(sess.id);
    if (editingSessionId === sess.id) resetAttendanceDraft();
    await refreshData();
    notify('Sesi presensi dihapus.', 'info');
  };

  const handleSaveAttendance = async () => {
    if (!activeYear || !selectedClassId || students.length === 0) return;
    const isEditing = Boolean(editingSessionId);
    await db.attendanceSessions.put({
      id: editingSessionId || createId('att'),
      academicYearId: activeYear.id,
      classId: selectedClassId,
      subject: activeClass?.subject || teacher?.subjects[0] || 'Umum',
      date: attDate,
      meetingNumber: Number(attMeeting) || 1,
      lessonHours: attHours,
      semester,
      records: students.map((s) => ({
        studentId: s.id,
        status: attDraft[s.id] || 'H',
      })),
      updatedAt: new Date().toISOString(),
    });
    if (isEditing) {
      resetAttendanceDraft();
    } else {
      setAttMeeting((m) => m + 1);
    }
    await refreshData();
    notify(
      isEditing
        ? `Perubahan presensi Pertemuan ${attMeeting} disimpan.`
        : `Presensi Pertemuan ${attMeeting} kelas ${activeClass?.name} disimpan.`
    );
  };

  // ======================== JURNAL HANDLERS ========================
  const handlePullFromModule = (modId: string) => {
    const mod = modules.find((m) => m.id === modId);
    if (!mod) return;
    setJMaterial(mod.material || mod.title);
    setJActivities(
      `${mod.openingActivity}\n${mod.coreActivity}`.slice(0, 300)
    );
    setJMethod(mod.methods || 'Diskusi');
    if (mod.tpIds[0]) setJTpId(mod.tpIds[0]);
  };

  const resetJournalForm = () => {
    setEditingJournalId(null);
    setJMaterial('');
    setJActivities('');
    setJReflection('');
    setJFollowUp('');
  };

  const handleEditJournal = (j: TeachingJournal) => {
    setEditingJournalId(j.id);
    setJDate(j.date);
    setJMeeting(j.meetingNumber);
    setJHours(j.lessonHours);
    setJTpId(j.tpId);
    setJMaterial(j.material);
    setJActivities(j.activities);
    setJMethod(j.method);
    setJReflection(j.reflection);
    setJFollowUp(j.followUp);
  };

  const handleSaveJournal = async () => {
    if (!activeYear || !selectedClassId || !jMaterial.trim()) {
      notify('Materi pembelajaran wajib diisi pada Jurnal Mengajar.', 'error');
      return;
    }
    const isEditing = Boolean(editingJournalId);
    const d = new Date(jDate);
    const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
    const latestAtt = sessions.find((s) => s.date === jDate);
    let attSummary = `${students.length} siswa terdaftar`;
    if (latestAtt) {
      const h = latestAtt.records.filter((r) => r.status === 'H').length;
      const s = latestAtt.records.filter((r) => r.status === 'S').length;
      const i = latestAtt.records.filter((r) => r.status === 'I').length;
      const a = latestAtt.records.filter((r) => r.status === 'A').length;
      attSummary = `Hadir: ${h}, Sakit: ${s}, Izin: ${i}, Alpa: ${a}`;
    }

    await db.journals.put({
      id: editingJournalId || createId('jrn'),
      academicYearId: activeYear.id,
      classId: selectedClassId,
      subject: activeClass?.subject || teacher?.subjects[0] || 'Umum',
      semester,
      date: jDate,
      dayName,
      meetingNumber: Number(jMeeting) || 1,
      lessonHours: jHours,
      tpId: jTpId,
      material: jMaterial.trim(),
      activities: jActivities.trim(),
      method: jMethod.trim(),
      attendanceSummary: attSummary,
      notes: '',
      reflection: jReflection.trim(),
      followUp: jFollowUp.trim(),
      updatedAt: new Date().toISOString(),
    });
    if (!isEditing) {
      setJMeeting((m) => m + 1);
    }
    resetJournalForm();
    await refreshData();
    notify(isEditing ? 'Perubahan jurnal mengajar disimpan.' : 'Jurnal mengajar disimpan.');
  };

  // ======================== NILAI HANDLERS ========================
  const handleUpsertGrade = async (
    studentId: string,
    componentId: string,
    rawValue: string
  ) => {
    if (!activeYear || !selectedClassId) return;
    const trimmed = rawValue.trim();
    const numeric = trimmed === '' ? null : Number(trimmed);
    if (numeric !== null && (!Number.isFinite(numeric) || numeric < 0 || numeric > 100)) {
      notify('Nilai harus berupa angka 0–100.', 'warning');
      return;
    }
    const existing = grades.find(
      (g) =>
        g.studentId === studentId &&
        g.componentId === componentId &&
        (selectedTpForGrade ? g.tpId === selectedTpForGrade : !g.tpId)
    );
    await db.studentGrades.put({
      id: existing?.id || createId('grd'),
      academicYearId: activeYear.id,
      classId: selectedClassId,
      studentId,
      semester,
      componentId,
      tpId: selectedTpForGrade || undefined,
      score: numeric,
      updatedAt: new Date().toISOString(),
    });
    await refreshData();
  };

  const handleImportGradesExcel = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeYear || !selectedClassId) return;
    try {
      const parsed = await parseGradeExcelFile(file, students, components);
      if (parsed.length === 0) {
        notify('Tidak ada nilai yang cocok dengan nama/NIS siswa dan komponen.', 'warning');
        return;
      }
      const now = new Date().toISOString();
      const rows: StudentGrade[] = parsed.map((p) => {
        const ex = grades.find(
          (g) => g.studentId === p.studentId && g.componentId === p.componentId
        );
        return {
          id: ex?.id || createId('grd'),
          academicYearId: activeYear.id,
          classId: selectedClassId,
          studentId: p.studentId,
          semester,
          componentId: p.componentId,
          tpId: selectedTpForGrade || undefined,
          score: p.score,
          updatedAt: now,
        };
      });
      await db.studentGrades.bulkPut(rows);
      await refreshData();
      notify(`${rows.length} nilai berhasil diimpor dari Excel.`);
    } catch {
      notify('Gagal membaca file Excel nilai.', 'error');
    }
  };

  if (classes.length === 0) {
    return (
      <div>
        <PageHeader
          title="Administrasi Kelas"
          description="Presensi, Jurnal Mengajar, Daftar Nilai, dan Analisis Ketercapaian TP."
        />
        <EmptyState
          title="Belum Ada Kelas / Rombel"
          description="Tambahkan kelas dan daftar siswa di menu Data Akademik agar dapat mencatat presensi, jurnal, dan nilai."
          actionLabel="Buka Data Kelas & Siswa"
          onAction={() => navigate('data_akademik', 'kelas')}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Administrasi Kelas & Pengolahan Nilai"
        description="Presensi siswa, jurnal mengajar, daftar nilai berbobot transparan, dan analisis ketercapaian TP."
        actions={
          <div className="flex items-center gap-2">
            <select
              className={`${inputClass} w-44`}
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.name}
                </option>
              ))}
            </select>
            <select
              className={`${inputClass} w-36`}
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value) as SemesterNumber)}
            >
              <option value={1}>Semester 1</option>
              <option value={2}>Semester 2</option>
            </select>
          </div>
        }
      />

      <SegmentedTabs
        tabs={[
          { id: 'presensi', label: 'Presensi Siswa', count: sessions.length },
          { id: 'jurnal', label: 'Jurnal Mengajar', count: journals.length },
          { id: 'nilai', label: 'Daftar Nilai' },
          { id: 'rekap', label: 'Rekap & Analisis TP' },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {/* TAB 1: PRESENSI */}
      {tab === 'presensi' && (
        <div className="space-y-6">
          {students.length === 0 ? (
            <EmptyState
              title={`Belum Ada Siswa di Kelas ${activeClass?.name}`}
              description="Tambahkan data siswa terlebih dahulu agar daftar presensi muncul otomatis."
              actionLabel="Input Data Siswa"
              onAction={() => navigate('data_akademik', 'siswa')}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                {editingSessionId && (
                  <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between gap-2">
                    <span>
                      Sedang mengedit presensi Pertemuan {attMeeting} ({attDate}).
                    </span>
                    <button
                      type="button"
                      onClick={resetAttendanceDraft}
                      className="font-semibold text-amber-900 underline"
                    >
                      Batal Edit
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="grid grid-cols-3 gap-2 flex-1">
                    <FormField label="Tanggal">
                      <input
                        type="date"
                        className={inputClass}
                        value={attDate}
                        onChange={(e) => setAttDate(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Pertemuan Ke-">
                      <input
                        type="number"
                        className={`${inputClass} font-mono`}
                        value={attMeeting}
                        onChange={(e) => setAttMeeting(Number(e.target.value))}
                      />
                    </FormField>
                    <FormField label="Jam Ke-">
                      <input
                        type="text"
                        className={`${inputClass} font-mono`}
                        value={attHours}
                        onChange={(e) => setAttHours(e.target.value)}
                      />
                    </FormField>
                  </div>
                  <div className="flex items-center gap-2">
                    <SecondaryButton
                      onClick={() => {
                        const allH: Record<string, AttendanceStatus> = {};
                        students.forEach((s) => (allH[s.id] = 'H'));
                        setAttDraft(allH);
                      }}
                    >
                      Tandai Semua Hadir
                    </SecondaryButton>
                    <PrimaryButton onClick={handleSaveAttendance}>
                      {editingSessionId ? 'Simpan Perubahan' : 'Simpan Presensi'}
                    </PrimaryButton>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2 pr-2">No</th>
                        <th className="py-2 pr-3">Nama Siswa</th>
                        <th className="py-2 text-right">Status Kehadiran (H / S / I / A)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((st, idx) => (
                        <tr key={st.id}>
                          <td className="py-2 pr-2 font-mono text-xs">{idx + 1}</td>
                          <td className="py-2 pr-3 font-medium text-slate-900">
                            {st.fullName}
                          </td>
                          <td className="py-2 text-right">
                            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                              {(['H', 'S', 'I', 'A'] as AttendanceStatus[]).map(
                                (status) => (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() =>
                                      setAttDraft((prev) => ({
                                        ...prev,
                                        [st.id]: status,
                                      }))
                                    }
                                    className={`px-2.5 py-1 text-xs font-mono font-semibold rounded transition-colors ${
                                      attDraft[st.id] === status
                                        ? status === 'H'
                                          ? 'bg-teal-700 text-white'
                                          : status === 'A'
                                            ? 'bg-red-700 text-white'
                                            : 'bg-amber-600 text-white'
                                        : 'text-slate-600 hover:bg-white'
                                    }`}
                                  >
                                    {status}
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recap Column */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-base font-semibold text-slate-900">
                    Rekap Kehadiran ({sessions.length} Sesi)
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton
                    disabled={sessions.length === 0}
                    onClick={() =>
                      activeClass &&
                      exportAttendanceToExcel(activeClass, students, sessions)
                    }
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Ekspor Excel</span>
                  </SecondaryButton>
                  {identityBundle && activeClass && (
                    <DocxButton
                      disabled={sessions.length === 0}
                      onClick={async () => {
                        const blob = await generateAttendanceDocx(
                          identityBundle,
                          activeClass,
                          students,
                          sessions
                        );
                        await downloadDocxBlob(
                          blob,
                          `Rekap_Presensi_${activeClass.name}_Sem${semester}.docx`
                        );
                      }}
                    />
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {students.map((st) => {
                    let h = 0, s = 0, i = 0, a = 0;
                    sessions.forEach((sess) => {
                      const r = sess.records.find((x) => x.studentId === st.id);
                      if (r?.status === 'H') h++;
                      else if (r?.status === 'S') s++;
                      else if (r?.status === 'I') i++;
                      else if (r?.status === 'A') a++;
                    });
                    const tot = h + s + i + a;
                    const pct = tot > 0 ? Math.round((h / tot) * 100) : 0;
                    return (
                      <div key={st.id} className="py-2 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800 truncate pr-2">
                          {st.fullName}
                        </span>
                        <span className="font-mono text-slate-600 tabular-nums shrink-0">
                          H:{h} S:{s} I:{i} A:{a} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>

                {sessions.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <div className="text-xs font-semibold text-slate-700">
                      Riwayat Sesi Tersimpan (Klik Edit untuk Perbarui)
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {sessions
                        .slice()
                        .reverse()
                        .map((sess) => (
                          <div
                            key={sess.id}
                            className="py-2 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="font-mono text-slate-700">
                              P{sess.meetingNumber} · {sess.date}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditAttendanceSession(sess)}
                                className="px-2 py-1 text-blue-800 hover:bg-blue-50 rounded font-medium"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAttendanceSession(sess)}
                                className="p-1 text-slate-400 hover:text-red-700"
                                title="Hapus sesi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: JURNAL MENGAJAR */}
      {tab === 'jurnal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              {editingJournalId ? 'Edit Jurnal Mengajar' : 'Catat Jurnal Mengajar'}
            </h3>
            {modules.length > 0 && (
              <FormField label="Ambil Data dari Modul Ajar (Opsional)">
                <select
                  className={inputClass}
                  defaultValue=""
                  onChange={(e) => handlePullFromModule(e.target.value)}
                >
                  <option value="">-- Pilih Modul Ajar --</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <div className="grid grid-cols-3 gap-2">
              <FormField label="Tanggal">
                <input
                  type="date"
                  className={inputClass}
                  value={jDate}
                  onChange={(e) => setJDate(e.target.value)}
                />
              </FormField>
              <FormField label="Pertemuan">
                <input
                  type="number"
                  className={`${inputClass} font-mono`}
                  value={jMeeting}
                  onChange={(e) => setJMeeting(Number(e.target.value))}
                />
              </FormField>
              <FormField label="Jam Ke-">
                <input
                  type="text"
                  className={`${inputClass} font-mono`}
                  value={jHours}
                  onChange={(e) => setJHours(e.target.value)}
                />
              </FormField>
            </div>
            <FormField label="TP Terkait">
              <select
                className={inputClass}
                value={jTpId}
                onChange={(e) => {
                  setJTpId(e.target.value);
                  const tp = tps.find((t) => t.id === e.target.value);
                  if (tp && !jMaterial) setJMaterial(tp.material);
                }}
              >
                <option value="">-- Pilih TP --</option>
                {tps.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.code} · {tp.material}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Materi Pokok" required>
              <input
                type="text"
                className={inputClass}
                value={jMaterial}
                onChange={(e) => setJMaterial(e.target.value)}
              />
            </FormField>
            <FormField label="Kegiatan Pembelajaran">
              <textarea
                rows={3}
                className={inputClass}
                value={jActivities}
                onChange={(e) => setJActivities(e.target.value)}
              />
            </FormField>
            <FormField label="Metode">
              <input
                type="text"
                className={inputClass}
                value={jMethod}
                onChange={(e) => setJMethod(e.target.value)}
              />
            </FormField>
            <FormField label="Refleksi Guru">
              <textarea
                rows={2}
                className={inputClass}
                value={jReflection}
                onChange={(e) => setJReflection(e.target.value)}
              />
            </FormField>
            <FormField label="Tindak Lanjut">
              <input
                type="text"
                className={inputClass}
                value={jFollowUp}
                onChange={(e) => setJFollowUp(e.target.value)}
              />
            </FormField>
            <div className="flex items-center gap-2">
              <PrimaryButton className="flex-1" onClick={handleSaveJournal}>
                {editingJournalId ? 'Simpan Perubahan Jurnal' : 'Simpan Jurnal Mengajar'}
              </PrimaryButton>
              {editingJournalId && (
                <SecondaryButton onClick={resetJournalForm}>
                  Batal
                </SecondaryButton>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">
                Riwayat Jurnal Kelas {activeClass?.name}
              </h3>
              <div className="flex items-center gap-2">
                <SecondaryButton onClick={() => window.print()}>
                  <Printer className="w-4 h-4" />
                  <span>Cetak</span>
                </SecondaryButton>
                {identityBundle && activeClass && (
                  <DocxButton
                    disabled={journals.length === 0}
                    onClick={async () => {
                      const blob = await generateJournalsDocx(
                        identityBundle,
                        activeClass,
                        journals,
                        tps
                      );
                      await downloadDocxBlob(
                        blob,
                        `Jurnal_Mengajar_${activeClass.name}_Sem${semester}.docx`
                      );
                    }}
                  />
                )}
              </div>
            </div>

            {journals.length === 0 ? (
              <EmptyState
                title="Belum Ada Catatan Jurnal"
                description="Isi jurnal mengajar setiap selesai pertemuan. Kehadiran siswa dapat ditarik otomatis dari presensi tanggal yang sama."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {journals.map((j) => (
                  <div key={j.id} className="py-3.5 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-mono text-blue-800">
                        {j.date} ({j.dayName}) · Pertemuan {j.meetingNumber} · Jam {j.lessonHours}
                      </div>
                      <div className="font-semibold text-slate-900">{j.material}</div>
                      <div className="text-xs text-slate-600">{j.activities}</div>
                      <div className="text-xs text-slate-500">
                        Kehadiran: {j.attendanceSummary} · Metode: {j.method}
                      </div>
                      {j.reflection && (
                        <div className="text-xs text-teal-800">
                          Refleksi: {j.reflection} {j.followUp ? `· Tindak lanjut: ${j.followUp}` : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditJournal(j)}
                        className="p-1.5 text-slate-500 hover:text-blue-800"
                        title="Edit jurnal"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Hapus Catatan Jurnal?',
                            message: `Jurnal pertemuan ${j.meetingNumber} (${j.date}) akan dihapus.`,
                            confirmLabel: 'Hapus',
                            danger: true,
                          });
                          if (!ok) return;
                          await db.journals.delete(j.id);
                          if (editingJournalId === j.id) resetJournalForm();
                          await refreshData();
                          notify('Jurnal dihapus.', 'info');
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-700"
                        title="Hapus jurnal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DAFTAR NILAI */}
      {tab === 'nilai' && (
        <div className="space-y-6">
          {/* Komponen & Bobot Transparan */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Komponen & Bobot Penilaian (Semester {semester})
                </h3>
                <p className="text-xs text-slate-500">
                  Formula transparan: Nilai Akhir = Σ (Nilai Komponen × Bobot%). Total bobot wajib tepat 100%.
                </p>
              </div>
              <div
                className={`text-sm font-mono font-bold tabular-nums ${
                  gradeAnalytics.weightValidation.isValid
                    ? 'text-teal-700'
                    : 'text-red-700'
                }`}
              >
                Total Bobot: {gradeAnalytics.weightValidation.totalWeight}%
              </div>
            </div>

            {!gradeAnalytics.weightValidation.isValid && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{gradeAnalytics.weightValidation.message}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {components.map((comp) => (
                <div
                  key={comp.id}
                  className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <span className="font-semibold text-slate-800">{comp.name}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-14 px-2 py-1 border border-slate-300 rounded font-mono text-right bg-white"
                    value={comp.weight}
                    onChange={async (e) => {
                      await db.gradeComponents.update(comp.id, {
                        weight: Number(e.target.value) || 0,
                      });
                      await refreshData();
                    }}
                  />
                  <span className="text-slate-500">%</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await db.gradeComponents.delete(comp.id);
                      await refreshData();
                    }}
                    className="text-slate-400 hover:text-red-700 ml-1"
                    title="Hapus komponen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  className={`${inputClass} w-32 text-xs`}
                  placeholder="Komponen baru"
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                />
                <input
                  type="number"
                  className={`${inputClass} w-16 text-xs font-mono`}
                  value={newCompWeight}
                  onChange={(e) => setNewCompWeight(Number(e.target.value))}
                />
                <SecondaryButton
                  onClick={async () => {
                    if (!activeYear || !newCompName.trim()) return;
                    await db.gradeComponents.put({
                      id: createId('gc'),
                      academicYearId: activeYear.id,
                      subject: activeClass?.subject || 'Umum',
                      semester,
                      name: newCompName.trim(),
                      weight: Number(newCompWeight) || 0,
                      orderIndex: components.length + 1,
                    });
                    setNewCompName('');
                    await refreshData();
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </SecondaryButton>
              </div>
            </div>
          </div>

          {/* Input Nilai Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">
                  Kaitkan ke TP (Opsional):
                </span>
                <select
                  className={`${inputClass} w-64 text-xs`}
                  value={selectedTpForGrade}
                  onChange={(e) => setSelectedTpForGrade(e.target.value)}
                >
                  <option value="">Umum (Seluruh Komponen)</option>
                  {tps.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.code} · {tp.material}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SecondaryButton
                  onClick={() =>
                    activeClass &&
                    downloadGradeImportTemplate(activeClass, students, components)
                  }
                >
                  <Download className="w-4 h-4" />
                  <span>Template Excel</span>
                </SecondaryButton>
                <label className="px-3.5 py-2 text-sm font-medium text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100 rounded-lg cursor-pointer inline-flex items-center gap-2 whitespace-nowrap">
                  <Upload className="w-4 h-4" />
                  <span>Impor Excel</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleImportGradesExcel}
                  />
                </label>
                <SecondaryButton
                  onClick={() =>
                    activeClass &&
                    exportGradesToExcel({
                      classGroup: activeClass,
                      components,
                      summaries: gradeAnalytics.studentSummaries,
                    })
                  }
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Ekspor Excel</span>
                </SecondaryButton>
                {identityBundle && activeClass && (
                  <DocxButton
                    onClick={async () => {
                      const blob = await generateGradesDocx(
                        identityBundle,
                        activeClass,
                        components,
                        gradeAnalytics
                      );
                      await downloadDocxBlob(
                        blob,
                        `Daftar_Nilai_${activeClass.name}_Sem${semester}.docx`
                      );
                    }}
                  />
                )}
              </div>
            </div>

            {students.length === 0 ? (
              <EmptyState
                title="Belum Ada Siswa di Kelas Ini"
                description="Tambahkan siswa di Data Akademik untuk menginput nilai."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2 pr-2">No</th>
                      <th className="py-2 pr-3">Nama Siswa</th>
                      {components.map((c) => (
                        <th key={c.id} className="py-2 px-2 text-center whitespace-nowrap">
                          {c.name} ({c.weight}%)
                        </th>
                      ))}
                      <th className="py-2 pl-3 text-right">Nilai Akhir</th>
                      <th className="py-2 pl-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gradeAnalytics.studentSummaries.map((sum, idx) => (
                      <tr key={sum.student.id} className="hover:bg-slate-50">
                        <td className="py-2 pr-2 font-mono text-xs">{idx + 1}</td>
                        <td className="py-2 pr-3 font-medium text-slate-900 whitespace-nowrap">
                          {sum.student.fullName}
                        </td>
                        {components.map((c) => {
                          const existingRow = grades.find(
                            (g) =>
                              g.studentId === sum.student.id &&
                              g.componentId === c.id &&
                              (selectedTpForGrade
                                ? g.tpId === selectedTpForGrade
                                : !g.tpId)
                          );
                          return (
                            <td key={c.id} className="py-1.5 px-1.5 text-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                className="w-16 px-2 py-1 text-xs font-mono text-center border border-slate-300 rounded bg-white focus:outline-none focus:border-blue-800"
                                defaultValue={
                                  existingRow?.score !== null &&
                                  existingRow?.score !== undefined
                                    ? String(existingRow.score)
                                    : ''
                                }
                                onBlur={(e) =>
                                  handleUpsertGrade(
                                    sum.student.id,
                                    c.id,
                                    e.target.value
                                  )
                                }
                                placeholder="-"
                              />
                            </td>
                          );
                        })}
                        <td className="py-2 pl-3 text-right font-mono font-bold tabular-nums text-slate-900">
                          {sum.finalScore !== null ? sum.finalScore : '-'}
                        </td>
                        <td className="py-2 pl-3 text-right text-xs font-medium whitespace-nowrap">
                          <span
                            className={
                              sum.status === 'Tuntas'
                                ? 'text-teal-700'
                                : sum.status === 'Perlu Remedial'
                                  ? 'text-red-700'
                                  : 'text-slate-400'
                            }
                          >
                            {sum.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: REKAP & ANALISIS TP */}
      {tab === 'rekap' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Rata-rata Kelas', val: gradeAnalytics.classAverage ?? '-' },
              { label: 'Nilai Tertinggi', val: gradeAnalytics.highestScore ?? '-' },
              { label: 'Nilai Terendah', val: gradeAnalytics.lowestScore ?? '-' },
              { label: 'Siswa Tuntas', val: `${gradeAnalytics.tuntasCount} (${gradeAnalytics.passPercentage}%)` },
              { label: 'Perlu Remedial', val: gradeAnalytics.remedialCount },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white border border-slate-200 rounded-xl p-4"
              >
                <div className="text-xs text-slate-500">{stat.label}</div>
                <div className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
                  {stat.val}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sebaran Nilai */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-900">
                Sebaran Nilai & Tindak Lanjut
              </h3>
              <div className="space-y-3">
                {Object.entries(gradeAnalytics.distribution).map(([range, count]) => {
                  const pct =
                    students.length > 0
                      ? Math.round((count / students.length) * 100)
                      : 0;
                  return (
                    <div key={range} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="font-semibold text-slate-700">
                          Rentang {range}
                        </span>
                        <span>
                          {count} siswa ({pct}%)
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-800"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-semibold text-red-700 mb-1">
                    Daftar Remedial (&lt; KKTP {settings?.kktpThreshold ?? 75}):
                  </div>
                  {gradeAnalytics.studentSummaries.filter(
                    (s) => s.status === 'Perlu Remedial'
                  ).length === 0 ? (
                    <span className="text-slate-500">Tidak ada siswa remedial.</span>
                  ) : (
                    <ul className="space-y-1 text-slate-700">
                      {gradeAnalytics.studentSummaries
                        .filter((s) => s.status === 'Perlu Remedial')
                        .map((s) => (
                          <li key={s.student.id}>
                            • {s.student.fullName} ({s.finalScore})
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-teal-700 mb-1">
                    Daftar Pengayaan (≥ 90):
                  </div>
                  {gradeAnalytics.studentSummaries.filter(
                    (s) => (s.finalScore ?? 0) >= 90
                  ).length === 0 ? (
                    <span className="text-slate-500">Belum ada siswa di rentang ≥ 90.</span>
                  ) : (
                    <ul className="space-y-1 text-slate-700">
                      {gradeAnalytics.studentSummaries
                        .filter((s) => (s.finalScore ?? 0) >= 90)
                        .map((s) => (
                          <li key={s.student.id}>
                            • {s.student.fullName} ({s.finalScore})
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Analisis Ketercapaian TP */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-900">
                Analisis Ketercapaian Tujuan Pembelajaran (TP)
              </h3>
              {gradeAnalytics.tpMastery.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Belum ada TP yang dibuat atau dikaitkan dengan nilai siswa.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {gradeAnalytics.tpMastery.map((item) => (
                    <div key={item.tp.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-blue-900">
                          {item.tp.code} · {item.tp.material}
                        </span>
                        <span className="font-mono text-slate-600 tabular-nums">
                          {item.evaluatedCount > 0
                            ? `Rata-rata ${item.averageScore} · ${item.masteryRate}% Tuntas`
                            : 'Belum ada nilai terkait TP ini'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{item.tp.objective}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
