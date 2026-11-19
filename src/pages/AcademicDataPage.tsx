import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Copy,
  Download,
  FileSpreadsheet,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  Edit3,
  ArrowRightLeft,
} from 'lucide-react';
import {
  copyAcademicYearStructure,
  createId,
  db,
  deleteAcademicYearCascade,
  getCurrentAcademicYearDefaults,
  switchActiveAcademicYear,
  updateAcademicYearDetails,
} from '../db/database';
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
import { calculateEffectiveWeeks } from '../services/effectiveWeeks';
import {
  downloadStudentImportTemplate,
  exportStudentsToExcel,
  parseStudentExcelFile,
} from '../services/excelService';
import {
  downloadDocxBlob,
  generateEffectiveWeeksDocx,
  generateStudentsDocx,
} from '../services/docxGenerator';
import type {
  CalendarConfig,
  CalendarEvent,
  CalendarEventType,
  ClassGroup,
  Gender,
  SemesterNumber,
  Student,
  StudentStatus,
} from '../types/domain';

export const AcademicDataPage: React.FC = () => {
  const {
    activeSubTab,
    academicYears,
    activeYear,
    school,
    teacher,
    principal,
    settings,
    dataVersion,
    refreshData,
    notify,
    confirm,
  } = useApp();

  const [tab, setTab] = useState<'tahun' | 'kalender' | 'kelas' | 'siswa'>('kelas');

  useEffect(() => {
    if (
      activeSubTab === 'tahun' ||
      activeSubTab === 'kalender' ||
      activeSubTab === 'kelas' ||
      activeSubTab === 'siswa'
    ) {
      setTab(activeSubTab);
    }
  }, [activeSubTab]);

  // Core year-scoped data
  const [calConfig, setCalConfig] = useState<CalendarConfig | null>(null);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Academic Year New/Copy & Edit state
  const currentDef = getCurrentAcademicYearDefaults();
  const [newYearName, setNewYearName] = useState(currentDef.name);
  const [newYearStart, setNewYearStart] = useState(currentDef.startDate);
  const [newYearEnd, setNewYearEnd] = useState(currentDef.endDate);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [editYearName, setEditYearName] = useState('');
  const [editYearStart, setEditYearStart] = useState('');
  const [editYearEnd, setEditYearEnd] = useState('');
  const [copyClassesFlag, setCopyClassesFlag] = useState(true);
  const [promoteGradeLevelFlag, setPromoteGradeLevelFlag] = useState(true);
  const [copyStudentsFlag, setCopyStudentsFlag] = useState(true);
  const [copyPlanningFlag, setCopyPlanningFlag] = useState(true);
  const [copyToolsAndBankFlag, setCopyToolsAndBankFlag] = useState(true);
  const [copyGradesCfgFlag, setCopyGradesCfgFlag] = useState(true);
  const [archiveSourceFlag, setArchiveSourceFlag] = useState(true);
  const [deleteTargetYearId, setDeleteTargetYearId] = useState('');

  // Calendar event form
  const [evTitle, setEvTitle] = useState('');
  const [evStart, setEvStart] = useState('');
  const [evEnd, setEvEnd] = useState('');
  const [evType, setEvType] = useState<CalendarEventType>('Libur Nasional');
  const [evSem, setEvSem] = useState<SemesterNumber>(1);
  const [calViewMode, setCalViewMode] = useState<'tahunan' | 'bulanan'>('tahunan');
  const [selectedCalMonth, setSelectedCalMonth] = useState(0);

  // Class form
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [clsLevel, setClsLevel] = useState('7');
  const [clsName, setClsName] = useState('');
  const [clsSem, setClsSem] = useState<SemesterNumber>(1);
  const [clsHomeroom, setClsHomeroom] = useState('');
  const [clsSubject, setClsSubject] = useState('');
  const [clsNotes, setClsNotes] = useState('');
  const [clsSearch, setClsSearch] = useState('');

  // Student form & filters
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [stOrder, setStOrder] = useState(1);
  const [stNis, setStNis] = useState('');
  const [stNisn, setStNisn] = useState('');
  const [stName, setStName] = useState('');
  const [stGender, setStGender] = useState<Gender>('L');
  const [stStatus, setStStatus] = useState<StudentStatus>('Aktif');
  const [stNotes, setStNotes] = useState('');
  const [stSearch, setStSearch] = useState('');
  const [stSort, setStSort] = useState<'order' | 'name' | 'nis'>('order');
  const [moveStudentTarget, setMoveStudentTarget] = useState<{
    student: Student;
    targetClassId: string;
  } | null>(null);

  useEffect(() => {
    if (!activeYear) return;
    let cancelled = false;
    (async () => {
      const [cfg, evs, clsList, stList] = await Promise.all([
        db.calendarConfigs.where('academicYearId').equals(activeYear.id).first(),
        db.calendarEvents.where('academicYearId').equals(activeYear.id).toArray(),
        db.classGroups.where('academicYearId').equals(activeYear.id).toArray(),
        db.students.where('academicYearId').equals(activeYear.id).toArray(),
      ]);
      if (!cancelled) {
        setCalConfig(cfg ?? null);
        setCalEvents(evs.sort((a, b) => a.startDate.localeCompare(b.startDate)));
        const sortedCls = clsList.sort((a, b) => a.name.localeCompare(b.name));
        setClasses(sortedCls);
        setStudents(stList);
        if (sortedCls.length > 0 && !sortedCls.some((c) => c.id === selectedClassId)) {
          setSelectedClassId(sortedCls[0].id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeYear, dataVersion]);

  useEffect(() => {
    if (!activeYear) return;
    const m = activeYear.name.match(/^(\d{4})\/(\d{4})$/);
    if (m) {
      const nextStart = Number(m[2]);
      const nextEnd = nextStart + 1;
      setNewYearName(`${nextStart}/${nextEnd}`);
      setNewYearStart(`${nextStart}-07-13`);
      setNewYearEnd(`${nextEnd}-06-18`);
    }
  }, [activeYear]);

  const effectiveSummary = useMemo(() => {
    if (!calConfig) return null;
    return calculateEffectiveWeeks(calConfig, calEvents);
  }, [calConfig, calEvents]);

  // ======================== HANDLERS: TAHUN AJARAN ========================
  const handleCreateOrCopyYear = async () => {
    if (!activeYear || !newYearName.trim()) {
      notify('Nama tahun ajaran baru wajib diisi.', 'error');
      return;
    }
    await copyAcademicYearStructure({
      sourceYearId: activeYear.id,
      newYearName: newYearName.trim(),
      startDate: newYearStart,
      endDate: newYearEnd,
      copyClasses: copyClassesFlag,
      promoteGradeLevel: copyClassesFlag && promoteGradeLevelFlag,
      copyStudents: copyClassesFlag && copyStudentsFlag,
      copyPlanning: copyPlanningFlag,
      copyLearningToolsAndBank: copyToolsAndBankFlag,
      copyGradeComponents: copyGradesCfgFlag,
      archiveSource: archiveSourceFlag,
    });
    await refreshData();
    notify(`Tahun ajaran ${newYearName} berhasil dibuat dan diaktifkan. Data tahun sebelumnya tetap tersimpan utuh di arsip.`);
  };

  const handleSwitchYear = async (yearId: string) => {
    await switchActiveAcademicYear(yearId);
    await refreshData();
    notify('Tahun ajaran aktif berhasil diganti.');
  };

  const handleToggleArchive = async (yearId: string, archived: boolean) => {
    await db.academicYears.update(yearId, { isArchived: !archived });
    await refreshData();
    notify(archived ? 'Arsip tahun ajaran dibuka kembali.' : 'Tahun ajaran diarsipkan.');
  };

  const handleChangeSemester = async (sem: SemesterNumber) => {
    if (!activeYear) return;
    await db.academicYears.update(activeYear.id, { activeSemester: sem });
    await db.schoolProfile.update('default', { activeSemester: sem });
    await refreshData();
    notify(`Semester aktif diubah ke Semester ${sem}.`);
  };

  const handleSaveYearEdit = async (yearId: string) => {
    if (!editYearName.trim()) {
      notify('Nama tahun ajaran wajib diisi.', 'error');
      return;
    }
    await updateAcademicYearDetails(yearId, {
      name: editYearName.trim(),
      startDate: editYearStart,
      endDate: editYearEnd,
    });
    setEditingYearId(null);
    await refreshData();
    notify('Data tahun ajaran berhasil diperbarui.');
  };

  const handleSyncToCurrentRunningYear = async () => {
    if (!activeYear) return;
    const def = getCurrentAcademicYearDefaults();
    await updateAcademicYearDetails(activeYear.id, {
      name: def.name,
      startDate: def.startDate,
      endDate: def.endDate,
      activeSemester: def.activeSemester,
    });
    await refreshData();
    notify(
      `Tahun ajaran aktif disesuaikan ke tahun pelajaran berjalan: ${def.name} (Semester ${def.activeSemester}).`
    );
  };

  const handleDeleteAcademicYear = async (yearId: string) => {
    const target = academicYears.find((y) => y.id === yearId);
    if (!target) {
      notify('Pilih tahun ajaran yang akan dihapus.', 'error');
      return;
    }
    if (academicYears.length <= 1) {
      notify(
        'Minimal harus ada 1 tahun ajaran aktif. Buat tahun ajaran lain terlebih dahulu jika ingin menghapus tahun ini.',
        'warning'
      );
      return;
    }
    const ok = await confirm({
      title: `Hapus Tahun Ajaran ${target.name}?`,
      message: `Seluruh kelas, siswa, perencanaan, perangkat, asesmen, presensi, jurnal, dan nilai pada Tahun Ajaran ${target.name} akan dihapus. Snapshot pemulihan otomatis akan dibuat sebelum penghapusan.`,
      confirmLabel: 'Ya, Hapus Tahun Ajaran',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAcademicYearCascade(yearId);
      setDeleteTargetYearId('');
      await refreshData();
      notify(`Tahun ajaran ${target.name} berhasil dihapus.`);
    } catch (err: unknown) {
      notify(
        err instanceof Error ? err.message : 'Gagal menghapus tahun ajaran.',
        'error'
      );
    }
  };

  // ======================== HANDLERS: KALENDER ========================
  const handleSaveCalendarConfig = async () => {
    if (!calConfig) return;
    await db.calendarConfigs.put({
      ...calConfig,
      updatedAt: new Date().toISOString(),
    });
    await refreshData();
    notify('Konfigurasi kalender & minggu efektif disimpan.');
  };

  const handleAddCalendarEvent = async () => {
    if (!activeYear || !evTitle.trim() || !evStart) {
      notify('Nama kegiatan dan tanggal mulai wajib diisi.', 'error');
      return;
    }
    await db.calendarEvents.put({
      id: createId('ev'),
      academicYearId: activeYear.id,
      title: evTitle.trim(),
      startDate: evStart,
      endDate: evEnd || evStart,
      type: evType,
      semester: evSem,
    });
    setEvTitle('');
    setEvStart('');
    setEvEnd('');
    await refreshData();
    notify('Agenda / libur kalender ditambahkan.');
  };

  const handleDeleteCalendarEvent = async (id: string) => {
    await db.calendarEvents.delete(id);
    await refreshData();
    notify('Agenda kalender dihapus.', 'info');
  };

  const handleDownloadCalendarDocx = async () => {
    if (!calConfig || !effectiveSummary || !school || !teacher || !principal) return;
    const blob = await generateEffectiveWeeksDocx(
      { school, teacher, principal, academicYear: activeYear ?? undefined, settings: settings ?? undefined },
      calConfig,
      effectiveSummary,
      calEvents
    );
    await downloadDocxBlob(blob, `Kalender_Minggu_Efektif_${activeYear?.name || ''}.docx`);
    notify('Dokumen DOCX Minggu Efektif berhasil diunduh.');
  };

  // ======================== HANDLERS: KELAS ========================
  const handleSaveClass = async () => {
    if (!activeYear || !clsName.trim()) {
      notify('Nama rombel/kelas wajib diisi (misal: 7A).', 'error');
      return;
    }
    const id = editingClassId || createId('cls');
    await db.classGroups.put({
      id,
      academicYearId: activeYear.id,
      gradeLevel: clsLevel.trim() || '7',
      name: clsName.trim(),
      semester: clsSem,
      homeroomTeacher: clsHomeroom.trim(),
      subject: clsSubject.trim() || teacher?.subjects[0] || '',
      notes: clsNotes.trim(),
      createdAt: new Date().toISOString(),
    });
    setEditingClassId(null);
    setClsName('');
    setClsHomeroom('');
    setClsNotes('');
    setSelectedClassId(id);
    await refreshData();
    notify(editingClassId ? 'Data kelas diperbarui.' : 'Kelas baru ditambahkan.');
  };

  const handleDeleteClass = async (cls: ClassGroup) => {
    const ok = await confirm({
      title: `Hapus Kelas ${cls.name}?`,
      message: `Siswa di kelas ${cls.name} juga akan dihapus dari kelas ini. Pastikan sudah membackup data jika masih diperlukan.`,
      confirmLabel: 'Hapus Kelas',
      danger: true,
    });
    if (!ok) return;
    await db.transaction('rw', [db.classGroups, db.students], async () => {
      await db.students.where('classId').equals(cls.id).delete();
      await db.classGroups.delete(cls.id);
    });
    await refreshData();
    notify(`Kelas ${cls.name} dihapus.`, 'info');
  };

  // ======================== HANDLERS: SISWA ========================
  const activeClass = classes.find((c) => c.id === selectedClassId) ?? null;

  const classStudents = useMemo(() => {
    const filtered = students.filter((s) => s.classId === selectedClassId);
    const searched = stSearch.trim()
      ? filtered.filter(
          (s) =>
            s.fullName.toLowerCase().includes(stSearch.toLowerCase()) ||
            s.nis.toLowerCase().includes(stSearch.toLowerCase()) ||
            s.nisn.toLowerCase().includes(stSearch.toLowerCase())
        )
      : filtered;
    return searched.slice().sort((a, b) => {
      if (stSort === 'name') return a.fullName.localeCompare(b.fullName);
      if (stSort === 'nis') return a.nis.localeCompare(b.nis);
      return a.orderNumber - b.orderNumber;
    });
  }, [students, selectedClassId, stSearch, stSort]);

  const handleSaveStudent = async () => {
    if (!activeYear || !selectedClassId || !stName.trim()) {
      notify('Pilih kelas dan isi nama lengkap siswa.', 'error');
      return;
    }
    const id = editingStudentId || createId('stu');
    await db.students.put({
      id,
      academicYearId: activeYear.id,
      classId: selectedClassId,
      orderNumber: Number(stOrder) || classStudents.length + 1,
      nis: stNis.trim(),
      nisn: stNisn.trim(),
      fullName: stName.trim(),
      gender: stGender,
      status: stStatus,
      notes: stNotes.trim(),
      createdAt: new Date().toISOString(),
    });
    setEditingStudentId(null);
    setStOrder(classStudents.length + 2);
    setStNis('');
    setStNisn('');
    setStName('');
    setStNotes('');
    await refreshData();
    notify(editingStudentId ? 'Data siswa diperbarui.' : 'Siswa ditambahkan.');
  };

  const handleDeleteStudent = async (st: Student) => {
    const ok = await confirm({
      title: `Hapus ${st.fullName}?`,
      message: 'Data siswa akan dihapus dari daftar kelas pada tahun ajaran ini.',
      confirmLabel: 'Hapus Siswa',
      danger: true,
    });
    if (!ok) return;
    await db.students.delete(st.id);
    await refreshData();
    notify('Siswa dihapus.', 'info');
  };

  const handleMoveStudentConfirm = async () => {
    if (!moveStudentTarget || !moveStudentTarget.targetClassId) return;
    await db.students.update(moveStudentTarget.student.id, {
      classId: moveStudentTarget.targetClassId,
    });
    setMoveStudentTarget(null);
    await refreshData();
    notify('Siswa berhasil dipindahkan ke kelas baru.');
  };

  const handleImportStudentsExcel = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeYear || !selectedClassId) return;
    try {
      const parsed = await parseStudentExcelFile(file);
      if (parsed.length === 0) {
        notify('Tidak ada baris siswa valid ditemukan pada file Excel.', 'warning');
        return;
      }
      const now = new Date().toISOString();
      const newStudents: Student[] = parsed.map((row) => ({
        id: createId('stu'),
        academicYearId: activeYear.id,
        classId: selectedClassId,
        orderNumber: row.orderNumber,
        nis: row.nis,
        nisn: row.nisn,
        fullName: row.fullName,
        gender: row.gender,
        status: row.status,
        notes: row.notes,
        createdAt: now,
      }));
      await db.students.bulkPut(newStudents);
      await refreshData();
      notify(`${newStudents.length} siswa berhasil diimpor ke kelas ${activeClass?.name}.`);
    } catch {
      notify('Gagal membaca file Excel. Pastikan menggunakan format .xlsx yang benar.', 'error');
    }
  };

  const handleDownloadStudentsDocx = async () => {
    if (!activeClass || !school || !teacher || !principal) return;
    const blob = await generateStudentsDocx(
      { school, teacher, principal, academicYear: activeYear ?? undefined, settings: settings ?? undefined },
      activeClass,
      classStudents
    );
    await downloadDocxBlob(blob, `Daftar_Siswa_${activeClass.name}.docx`);
    notify('Dokumen DOCX Daftar Siswa berhasil diunduh.');
  };

  const filteredClasses = classes.filter(
    (c) =>
      c.name.toLowerCase().includes(clsSearch.toLowerCase()) ||
      c.subject.toLowerCase().includes(clsSearch.toLowerCase())
  );

  const allEffectiveMonths = effectiveSummary
    ? [...effectiveSummary.semester1.months, ...effectiveSummary.semester2.months]
    : [];

  return (
    <div>
      <PageHeader
        title="Data Akademik, Kalender & Siswa"
        description="Pusat data tahun ajaran, kalender pendidikan, minggu efektif, daftar kelas/rombel, dan data siswa yang terintegrasi ke seluruh aplikasi."
      />

      <SegmentedTabs
        tabs={[
          { id: 'tahun', label: 'Tahun Ajaran & Arsip', count: academicYears.length },
          { id: 'kalender', label: 'Kalender & Minggu Efektif', count: calEvents.length },
          { id: 'kelas', label: 'Data Kelas / Rombel', count: classes.length },
          { id: 'siswa', label: 'Data Siswa', count: students.length },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {/* TAB 1: TAHUN AJARAN */}
      {tab === 'tahun' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Daftar Tahun Ajaran
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Otomatis terisi dari tahun pelajaran berjalan (Juli–Juni), atau ubah manual kapan saja.
                </p>
              </div>
              {activeYear && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSyncToCurrentRunningYear}
                    className="px-2.5 py-1 rounded-md font-medium bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100"
                  >
                    Sesuaikan Tahun Berjalan ({currentDef.name})
                  </button>
                  <span className="text-slate-500 ml-1">Semester:</span>
                  <button
                    type="button"
                    onClick={() => handleChangeSemester(1)}
                    className={`px-2.5 py-1 rounded-md font-medium ${
                      activeYear.activeSemester === 1
                        ? 'bg-blue-800 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Sem 1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeSemester(2)}
                    className={`px-2.5 py-1 rounded-md font-medium ${
                      activeYear.activeSemester === 2
                        ? 'bg-blue-800 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Sem 2
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {academicYears.map((yr) => (
                <div key={yr.id} className="py-3.5">
                  {editingYearId === yr.id ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <FormField label="Nama Tahun Ajaran">
                          <input
                            type="text"
                            className={`${inputClass} font-mono text-xs`}
                            value={editYearName}
                            onChange={(e) => setEditYearName(e.target.value)}
                          />
                        </FormField>
                        <FormField label="Tanggal Mulai">
                          <input
                            type="date"
                            className={`${inputClass} text-xs`}
                            value={editYearStart}
                            onChange={(e) => setEditYearStart(e.target.value)}
                          />
                        </FormField>
                        <FormField label="Tanggal Akhir">
                          <input
                            type="date"
                            className={`${inputClass} text-xs`}
                            value={editYearEnd}
                            onChange={(e) => setEditYearEnd(e.target.value)}
                          />
                        </FormField>
                      </div>
                      <div className="flex items-center gap-2">
                        <PrimaryButton onClick={() => handleSaveYearEdit(yr.id)}>
                          Simpan Perubahan
                        </PrimaryButton>
                        <SecondaryButton onClick={() => setEditingYearId(null)}>
                          Batal
                        </SecondaryButton>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900 font-mono">
                          {yr.name}{' '}
                          {yr.isActive && (
                            <span className="ml-2 text-xs font-sans font-medium text-teal-700">
                              · Aktif
                            </span>
                          )}
                          {yr.isArchived && (
                            <span className="ml-2 text-xs font-sans font-medium text-slate-500">
                              · Diarsipkan
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {yr.startDate} s.d. {yr.endDate} · Semester {yr.activeSemester}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingYearId(yr.id);
                            setEditYearName(yr.name);
                            setEditYearStart(yr.startDate);
                            setEditYearEnd(yr.endDate);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        {!yr.isActive && (
                          <SecondaryButton onClick={() => handleSwitchYear(yr.id)}>
                            Aktifkan Tahun Ini
                          </SecondaryButton>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleArchive(yr.id, yr.isArchived)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>{yr.isArchived ? 'Buka Arsip' : 'Arsipkan'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAcademicYear(yr.id)}
                          disabled={academicYears.length <= 1}
                          title={
                            academicYears.length <= 1
                              ? 'Minimal harus ada 1 tahun ajaran'
                              : `Hapus Tahun Ajaran ${yr.name}`
                          }
                          className="px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Buat Tahun Ajaran Baru
            </h3>
            <p className="text-xs text-slate-500">
              Nilai siswa dan presensi tidak pernah tercampur antar tahun ajaran. Anda dapat menyalin struktur perencanaan secara aman.
            </p>
            <FormField label="Nama Tahun Ajaran" required>
              <input
                type="text"
                className={`${inputClass} font-mono`}
                value={newYearName}
                onChange={(e) => setNewYearName(e.target.value)}
                placeholder="2027/2028"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tanggal Mulai">
                <input
                  type="date"
                  className={inputClass}
                  value={newYearStart}
                  onChange={(e) => setNewYearStart(e.target.value)}
                />
              </FormField>
              <FormField label="Tanggal Akhir">
                <input
                  type="date"
                  className={inputClass}
                  value={newYearEnd}
                  onChange={(e) => setNewYearEnd(e.target.value)}
                />
              </FormField>
            </div>
            <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs text-slate-700">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={copyClassesFlag}
                  onChange={(e) => setCopyClassesFlag(e.target.checked)}
                />
                <span>Salin daftar kelas/rombel ke tahun baru</span>
              </label>
              {copyClassesFlag && (
                <div className="pl-5 space-y-2 border-l-2 border-slate-200">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={promoteGradeLevelFlag}
                      onChange={(e) => setPromoteGradeLevelFlag(e.target.checked)}
                    />
                    <span>Naikkan tingkat kelas otomatis (misal 7A → 8A, X → XI)</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={copyStudentsFlag}
                      onChange={(e) => setCopyStudentsFlag(e.target.checked)}
                    />
                    <span>Salin / naikkan siswa berstatus Aktif (nilai & presensi lama tetap di arsip)</span>
                  </label>
                </div>
              )}
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={copyPlanningFlag}
                  onChange={(e) => setCopyPlanningFlag(e.target.checked)}
                />
                <span>Salin struktur perencanaan (CP, TP, ATP, PROTA, PROMES, Silabus)</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={copyToolsAndBankFlag}
                  onChange={(e) => setCopyToolsAndBankFlag(e.target.checked)}
                />
                <span>Salin Modul Ajar, LKPD, Media, Bank Soal & Paket Asesmen</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={copyGradesCfgFlag}
                  onChange={(e) => setCopyGradesCfgFlag(e.target.checked)}
                />
                <span>Salin komponen & bobot penilaian</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={archiveSourceFlag}
                  onChange={(e) => setArchiveSourceFlag(e.target.checked)}
                />
                <span>Tandai tahun ajaran sebelumnya sebagai Arsip (data tetap dapat dibuka kapan saja)</span>
              </label>
            </div>
            <PrimaryButton className="w-full" onClick={handleCreateOrCopyYear}>
              <Copy className="w-4 h-4" />
              <span>Buat & Aktifkan Tahun Baru</span>
            </PrimaryButton>

            <div className="pt-4 border-t border-slate-200 space-y-2.5">
              <div className="text-xs font-semibold text-slate-800">
                Hapus Tahun Ajaran Salah / Tidak Digunakan
              </div>
              <p className="text-xs text-slate-500">
                Jika salah membuat tahun ajaran, pilih lalu hapus di sini (snapshot pemulihan dibuat otomatis).
              </p>
              <select
                className={`${inputClass} text-xs font-mono`}
                value={deleteTargetYearId}
                onChange={(e) => setDeleteTargetYearId(e.target.value)}
                disabled={academicYears.length <= 1}
              >
                <option value="">
                  {academicYears.length <= 1
                    ? 'Minimal harus ada 1 tahun ajaran'
                    : '-- Pilih tahun ajaran yang akan dihapus --'}
                </option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isActive ? '(Aktif)' : y.isArchived ? '(Arsip)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!deleteTargetYearId || academicYears.length <= 1}
                onClick={() => handleDeleteAcademicYear(deleteTargetYearId)}
                className="w-full px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Tahun Ajaran Terpilih</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KALENDER & MINGGU EFEKTIF */}
      {tab === 'kalender' && calConfig && effectiveSummary && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Parameter Kalender Pendidikan ({activeYear?.name})
                </h3>
                <p className="text-xs text-slate-500">
                  Minggu efektif dihitung otomatis dan menjadi acuan ATP, PROTA, PROMES, dan Silabus.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DocxButton onClick={handleDownloadCalendarDocx} />
                <PrimaryButton onClick={handleSaveCalendarConfig}>
                  Simpan Parameter
                </PrimaryButton>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField label="Awal Tahun Ajaran">
                <input
                  type="date"
                  className={inputClass}
                  value={calConfig.yearStartDate}
                  onChange={(e) =>
                    setCalConfig({ ...calConfig, yearStartDate: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Akhir Tahun Ajaran">
                <input
                  type="date"
                  className={inputClass}
                  value={calConfig.yearEndDate}
                  onChange={(e) =>
                    setCalConfig({ ...calConfig, yearEndDate: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Awal Semester 1">
                <input
                  type="date"
                  className={inputClass}
                  value={calConfig.sem1StartDate}
                  onChange={(e) =>
                    setCalConfig({ ...calConfig, sem1StartDate: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Akhir Semester 1">
                <input
                  type="date"
                  className={inputClass}
                  value={calConfig.sem1EndDate}
                  onChange={(e) =>
                    setCalConfig({ ...calConfig, sem1EndDate: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Awal Semester 2">
                <input
                  type="date"
                  className={inputClass}
                  value={calConfig.sem2StartDate}
                  onChange={(e) =>
                    setCalConfig({ ...calConfig, sem2StartDate: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Akhir Semester 2">
                <input
                  type="date"
                  className={inputClass}
                  value={calConfig.sem2EndDate}
                  onChange={(e) =>
                    setCalConfig({ ...calConfig, sem2EndDate: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Hari Pembelajaran / Minggu">
                <select
                  className={inputClass}
                  value={calConfig.learningDaysPerWeek}
                  onChange={(e) =>
                    setCalConfig({
                      ...calConfig,
                      learningDaysPerWeek: Number(e.target.value) as 5 | 6,
                    })
                  }
                >
                  <option value={5}>5 Hari (Senin–Jumat)</option>
                  <option value={6}>6 Hari (Senin–Sabtu)</option>
                </select>
              </FormField>
              <FormField label="Jam Pelajaran (JP) / Minggu">
                <input
                  type="number"
                  min={1}
                  max={40}
                  className={`${inputClass} font-mono`}
                  value={calConfig.hoursPerWeek}
                  onChange={(e) =>
                    setCalConfig({
                      ...calConfig,
                      hoursPerWeek: Number(e.target.value) || 1,
                    })
                  }
                />
              </FormField>
            </div>

            {/* Summary Metrics */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-5 border-t border-slate-100">
              {[
                { label: 'Hari Kalender', val: effectiveSummary.totalCalendarDays },
                { label: 'Libur / Non-KBM', val: effectiveSummary.totalHolidayDays },
                { label: 'Hari Efektif', val: effectiveSummary.totalEffectiveDays },
                { label: 'Efektif Sem 1', val: `${effectiveSummary.semester1.effectiveWeeks} Mgg` },
                { label: 'Efektif Sem 2', val: `${effectiveSummary.semester2.effectiveWeeks} Mgg` },
                { label: 'Total JP Setahun', val: `${effectiveSummary.totalHoursAvailable} JP` },
              ].map((m) => (
                <div
                  key={m.label}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <div className="text-xs text-slate-500">{m.label}</div>
                  <div className="mt-1 text-base font-bold font-mono text-slate-900 tabular-nums">
                    {m.val}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Table of Effective Weeks */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">
                  Tabel Perhitungan Minggu Efektif
                </h3>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setCalViewMode('tahunan')}
                    className={`px-3 py-1 rounded-md font-medium ${
                      calViewMode === 'tahunan' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Rekap Tahunan
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalViewMode('bulanan')}
                    className={`px-3 py-1 rounded-md font-medium ${
                      calViewMode === 'bulanan' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Detail Bulanan
                  </button>
                </div>
              </div>

              {calViewMode === 'tahunan' ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2 pr-3">Sem</th>
                        <th className="py-2 pr-3">Bulan</th>
                        <th className="py-2 pr-3 text-right">Minggu</th>
                        <th className="py-2 pr-3 text-right">Tdk Efektif</th>
                        <th className="py-2 pr-3 text-right">Efektif</th>
                        <th className="py-2 pr-3 text-right">Alokasi JP</th>
                        <th className="py-2">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allEffectiveMonths.map((m) => (
                        <tr key={`${m.semester}_${m.monthLabel}`} className="hover:bg-slate-50">
                          <td className="py-2.5 pr-3 font-mono text-xs">S{m.semester}</td>
                          <td className="py-2.5 pr-3 font-medium text-slate-900">{m.monthLabel}</td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{m.totalWeeks}</td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-amber-700">{m.ineffectiveWeeks}</td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums font-semibold text-teal-700">{m.effectiveWeeks}</td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{m.hoursAllocation} JP</td>
                          <td className="py-2.5 text-xs text-slate-500">{m.notes.join(', ') || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <select
                    className={inputClass}
                    value={selectedCalMonth}
                    onChange={(e) => setSelectedCalMonth(Number(e.target.value))}
                  >
                    {allEffectiveMonths.map((m, idx) => (
                      <option key={m.monthLabel} value={idx}>
                        {m.monthLabel} (Semester {m.semester})
                      </option>
                    ))}
                  </select>
                  {allEffectiveMonths[selectedCalMonth] && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-sm">
                      <div className="font-semibold text-slate-900">
                        {allEffectiveMonths[selectedCalMonth].monthLabel}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>Total Hari: <span className="font-mono font-semibold">{allEffectiveMonths[selectedCalMonth].totalDays}</span></div>
                        <div>Hari Efektif: <span className="font-mono font-semibold">{allEffectiveMonths[selectedCalMonth].effectiveDays}</span></div>
                        <div>Minggu Efektif: <span className="font-mono font-semibold text-teal-700">{allEffectiveMonths[selectedCalMonth].effectiveWeeks}</span></div>
                        <div>Alokasi Waktu: <span className="font-mono font-semibold">{allEffectiveMonths[selectedCalMonth].hoursAllocation} JP</span></div>
                      </div>
                      <div className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                        Agenda/Libur: {allEffectiveMonths[selectedCalMonth].notes.join(', ') || 'Tidak ada agenda khusus'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Event / Holiday Input */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-900">
                Tambah Libur & Agenda Sekolah
              </h3>
              <FormField label="Nama Kegiatan / Hari Libur" required>
                <input
                  type="text"
                  className={inputClass}
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  placeholder="Contoh: PTS Ganjil / HUT RI"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Mulai" required>
                  <input
                    type="date"
                    className={inputClass}
                    value={evStart}
                    onChange={(e) => setEvStart(e.target.value)}
                  />
                </FormField>
                <FormField label="Selesai">
                  <input
                    type="date"
                    className={inputClass}
                    value={evEnd}
                    onChange={(e) => setEvEnd(e.target.value)}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Kategori">
                  <select
                    className={inputClass}
                    value={evType}
                    onChange={(e) => setEvType(e.target.value as CalendarEventType)}
                  >
                    <option value="Libur Nasional">Libur Nasional</option>
                    <option value="Libur Sekolah">Libur Sekolah</option>
                    <option value="PTS/STS">PTS / STS</option>
                    <option value="PAS/SAS">PAS / SAS</option>
                    <option value="Projek">Projek (P5)</option>
                    <option value="Kegiatan Sekolah">Kegiatan Sekolah</option>
                    <option value="Kegiatan Khusus">Kegiatan Khusus</option>
                  </select>
                </FormField>
                <FormField label="Semester">
                  <select
                    className={inputClass}
                    value={evSem}
                    onChange={(e) => setEvSem(Number(e.target.value) as SemesterNumber)}
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </FormField>
              </div>
              <PrimaryButton className="w-full" onClick={handleAddCalendarEvent}>
                <Plus className="w-4 h-4" />
                <span>Tambah ke Kalender</span>
              </PrimaryButton>

              <div className="pt-3 border-t border-slate-100 max-h-64 overflow-y-auto divide-y divide-slate-100">
                {calEvents.map((ev) => (
                  <div key={ev.id} className="py-2 flex items-start justify-between gap-2 text-xs">
                    <div>
                      <div className="font-medium text-slate-900">{ev.title}</div>
                      <div className="text-slate-500 font-mono">
                        {ev.startDate}{ev.endDate !== ev.startDate ? ` - ${ev.endDate}` : ''} · {ev.type}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCalendarEvent(ev.id)}
                      className="p-1 text-slate-400 hover:text-red-700"
                      aria-label="Hapus agenda"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DATA KELAS */}
      {tab === 'kelas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              {editingClassId ? 'Edit Data Kelas' : 'Tambah Kelas / Rombel'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tingkat" required>
                <input
                  type="text"
                  className={inputClass}
                  value={clsLevel}
                  onChange={(e) => setClsLevel(e.target.value)}
                  placeholder="7 / 8 / X / 4"
                />
              </FormField>
              <FormField label="Nama Rombel" required>
                <input
                  type="text"
                  className={inputClass}
                  value={clsName}
                  onChange={(e) => setClsName(e.target.value)}
                  placeholder="7A, 8B, X-1"
                />
              </FormField>
            </div>
            <FormField label="Mata Pelajaran">
              <input
                type="text"
                className={inputClass}
                value={clsSubject}
                onChange={(e) => setClsSubject(e.target.value)}
                placeholder={teacher?.subjects[0] || 'Contoh: Matematika'}
              />
            </FormField>
            <FormField label="Wali Kelas">
              <input
                type="text"
                className={inputClass}
                value={clsHomeroom}
                onChange={(e) => setClsHomeroom(e.target.value)}
              />
            </FormField>
            <FormField label="Semester">
              <select
                className={inputClass}
                value={clsSem}
                onChange={(e) => setClsSem(Number(e.target.value) as SemesterNumber)}
              >
                <option value={1}>Semester 1</option>
                <option value={2}>Semester 2</option>
              </select>
            </FormField>
            <FormField label="Keterangan">
              <input
                type="text"
                className={inputClass}
                value={clsNotes}
                onChange={(e) => setClsNotes(e.target.value)}
              />
            </FormField>
            <div className="flex items-center gap-2 pt-2">
              <PrimaryButton className="flex-1" onClick={handleSaveClass}>
                {editingClassId ? 'Simpan Perubahan' : 'Tambah Kelas'}
              </PrimaryButton>
              {editingClassId && (
                <SecondaryButton
                  onClick={() => {
                    setEditingClassId(null);
                    setClsName('');
                  }}
                >
                  Batal
                </SecondaryButton>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  className={`${inputClass} pl-9`}
                  placeholder="Cari kelas atau mapel..."
                  value={clsSearch}
                  onChange={(e) => setClsSearch(e.target.value)}
                />
              </div>
              <SecondaryButton onClick={() => window.print()}>
                <Printer className="w-4 h-4" />
                <span>Cetak Daftar Kelas</span>
              </SecondaryButton>
            </div>

            {filteredClasses.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  title="Belum Ada Kelas / Rombel"
                  description="Buat kelas pertama pada formulir di samping (misalnya 7A, 7B, atau X-1) untuk mulai memasukkan data siswa."
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2 pr-3">Kelas</th>
                      <th className="py-2 pr-3">Tingkat</th>
                      <th className="py-2 pr-3">Mata Pelajaran</th>
                      <th className="py-2 pr-3">Wali Kelas</th>
                      <th className="py-2 pr-3 text-right">Siswa</th>
                      <th className="py-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClasses.map((c) => {
                      const count = students.filter((s) => s.classId === c.id).length;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-3 pr-3 font-semibold text-slate-900">{c.name}</td>
                          <td className="py-3 pr-3 font-mono text-xs">{c.gradeLevel}</td>
                          <td className="py-3 pr-3">{c.subject || '-'}</td>
                          <td className="py-3 pr-3 text-slate-600">{c.homeroomTeacher || '-'}</td>
                          <td className="py-3 pr-3 text-right font-mono tabular-nums">{count}</td>
                          <td className="py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedClassId(c.id);
                                setTab('siswa');
                              }}
                              className="text-xs font-medium text-blue-800 hover:underline mr-3"
                            >
                              Kelola Siswa
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingClassId(c.id);
                                setClsLevel(c.gradeLevel);
                                setClsName(c.name);
                                setClsSem(c.semester);
                                setClsHomeroom(c.homeroomTeacher);
                                setClsSubject(c.subject);
                                setClsNotes(c.notes);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-800"
                              aria-label="Edit kelas"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClass(c)}
                              className="p-1.5 text-slate-500 hover:text-red-700"
                              aria-label="Hapus kelas"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DATA SISWA */}
      {tab === 'siswa' && (
        <div className="space-y-6">
          {classes.length === 0 ? (
            <EmptyState
              title="Buat Kelas Terlebih Dahulu"
              description="Data siswa terhubung langsung ke kelas/rombel. Tambahkan kelas terlebih dahulu."
              actionLabel="Buat Kelas"
              onAction={() => setTab('kelas')}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Student Input Form */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-slate-900">
                  {editingStudentId ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
                </h3>
                <FormField label="Kelas / Rombel">
                  <select
                    className={inputClass}
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        Kelas {c.name} ({c.subject || 'Umum'})
                      </option>
                    ))}
                  </select>
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="No. Urut">
                    <input
                      type="number"
                      className={`${inputClass} font-mono`}
                      value={stOrder}
                      onChange={(e) => setStOrder(Number(e.target.value))}
                    />
                  </FormField>
                  <FormField label="Jenis Kelamin">
                    <select
                      className={inputClass}
                      value={stGender}
                      onChange={(e) => setStGender(e.target.value as Gender)}
                    >
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="NIS">
                    <input
                      type="text"
                      className={`${inputClass} font-mono`}
                      value={stNis}
                      onChange={(e) => setStNis(e.target.value)}
                    />
                  </FormField>
                  <FormField label="NISN">
                    <input
                      type="text"
                      className={`${inputClass} font-mono`}
                      value={stNisn}
                      onChange={(e) => setStNisn(e.target.value)}
                    />
                  </FormField>
                </div>
                <FormField label="Nama Lengkap Siswa" required>
                  <input
                    type="text"
                    className={inputClass}
                    value={stName}
                    onChange={(e) => setStName(e.target.value)}
                    placeholder="Nama lengkap sesuai absen"
                  />
                </FormField>
                <FormField label="Status">
                  <select
                    className={inputClass}
                    value={stStatus}
                    onChange={(e) => setStStatus(e.target.value as StudentStatus)}
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Pindah">Pindah</option>
                    <option value="Nonaktif">Nonaktif</option>
                  </select>
                </FormField>
                <FormField label="Keterangan">
                  <input
                    type="text"
                    className={inputClass}
                    value={stNotes}
                    onChange={(e) => setStNotes(e.target.value)}
                  />
                </FormField>
                <div className="flex items-center gap-2 pt-2">
                  <PrimaryButton className="flex-1" onClick={handleSaveStudent}>
                    {editingStudentId ? 'Simpan Perubahan' : 'Tambah Siswa'}
                  </PrimaryButton>
                  {editingStudentId && (
                    <SecondaryButton
                      onClick={() => {
                        setEditingStudentId(null);
                        setStName('');
                        setStNis('');
                        setStNisn('');
                      }}
                    >
                      Batal
                    </SecondaryButton>
                  )}
                </div>
              </div>

              {/* Student Table & Excel Import/Export */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        className={`${inputClass} pl-9 w-52`}
                        placeholder="Cari nama / NIS..."
                        value={stSearch}
                        onChange={(e) => setStSearch(e.target.value)}
                      />
                    </div>
                    <select
                      className={`${inputClass} w-36`}
                      value={stSort}
                      onChange={(e) =>
                        setStSort(e.target.value as 'order' | 'name' | 'nis')
                      }
                    >
                      <option value="order">Urut Nomor</option>
                      <option value="name">Urut Nama A–Z</option>
                      <option value="nis">Urut NIS</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <SecondaryButton onClick={downloadStudentImportTemplate}>
                      <Download className="w-4 h-4" />
                      <span>Template Excel</span>
                    </SecondaryButton>
                    <label className="px-3.5 py-2 text-sm font-medium text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100 rounded-lg cursor-pointer inline-flex items-center gap-2 whitespace-nowrap">
                      <Upload className="w-4 h-4" />
                      <span>Impor Excel</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={handleImportStudentsExcel}
                      />
                    </label>
                    <SecondaryButton
                      onClick={() =>
                        activeClass && exportStudentsToExcel(activeClass, classStudents)
                      }
                      disabled={classStudents.length === 0}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Ekspor Excel</span>
                    </SecondaryButton>
                    <DocxButton
                      onClick={handleDownloadStudentsDocx}
                      disabled={classStudents.length === 0}
                    />
                  </div>
                </div>

                {classStudents.length === 0 ? (
                  <div className="mt-6">
                    <EmptyState
                      title={`Belum Ada Siswa di Kelas ${activeClass?.name || ''}`}
                      description="Tambahkan siswa secara manual di sebelah kiri, atau unduh Template Excel lalu impor seluruh daftar siswa kelas ini sekaligus."
                    />
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs text-slate-500">
                          <th className="py-2 pr-2">No</th>
                          <th className="py-2 pr-3">NIS / NISN</th>
                          <th className="py-2 pr-3">Nama Lengkap</th>
                          <th className="py-2 pr-3">L/P</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {classStudents.map((st, idx) => (
                          <tr key={st.id} className="hover:bg-slate-50">
                            <td className="py-2.5 pr-2 font-mono text-xs tabular-nums">
                              {st.orderNumber || idx + 1}
                            </td>
                            <td className="py-2.5 pr-3 font-mono text-xs text-slate-600 tabular-nums">
                              {st.nis || '-'} / {st.nisn || '-'}
                            </td>
                            <td className="py-2.5 pr-3 font-medium text-slate-900">
                              {st.fullName}
                            </td>
                            <td className="py-2.5 pr-3 font-mono text-xs">{st.gender}</td>
                            <td className="py-2.5 pr-3 text-xs text-slate-700">{st.status}</td>
                            <td className="py-2.5 text-right whitespace-nowrap">
                              {classes.length > 1 && (
                                <button
                                  type="button"
                                  title="Pindah Kelas"
                                  onClick={() =>
                                    setMoveStudentTarget({
                                      student: st,
                                      targetClassId:
                                        classes.find((c) => c.id !== st.classId)?.id ?? '',
                                    })
                                  }
                                  className="p-1.5 text-slate-500 hover:text-blue-800"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                title="Edit Siswa"
                                onClick={() => {
                                  setEditingStudentId(st.id);
                                  setStOrder(st.orderNumber);
                                  setStNis(st.nis);
                                  setStNisn(st.nisn);
                                  setStName(st.fullName);
                                  setStGender(st.gender);
                                  setStStatus(st.status);
                                  setStNotes(st.notes);
                                }}
                                className="p-1.5 text-slate-500 hover:text-blue-800"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                title="Hapus Siswa"
                                onClick={() => handleDeleteStudent(st)}
                                className="p-1.5 text-slate-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
        </div>
      )}

      {/* Move Student Modal */}
      {moveStudentTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Pindah Kelas Siswa
            </h3>
            <p className="text-sm text-slate-600">
              Pindahkan <span className="font-semibold">{moveStudentTarget.student.fullName}</span> ke kelas tujuan:
            </p>
            <select
              className={inputClass}
              value={moveStudentTarget.targetClassId}
              onChange={(e) =>
                setMoveStudentTarget({
                  ...moveStudentTarget,
                  targetClassId: e.target.value,
                })
              }
            >
              {classes
                .filter((c) => c.id !== moveStudentTarget.student.classId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => setMoveStudentTarget(null)}>
                Batal
              </SecondaryButton>
              <PrimaryButton onClick={handleMoveStudentConfirm}>
                Pindahkan Siswa
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
