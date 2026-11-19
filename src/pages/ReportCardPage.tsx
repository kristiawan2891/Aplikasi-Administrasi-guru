import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { createId, db } from '../db/database';
import { useApp } from '../context/AppContext';
import {
  AiActionButton,
  DocxButton,
  EmptyState,
  inputClass,
  PageHeader,
  PrimaryButton,
  SegmentedTabs,
} from '../components/UI';
import { computeClassGradeAnalytics } from '../services/gradeEngine';
import { generateReportDescriptionDraft } from '../services/aiService';
import {
  downloadDocxBlob,
  generateReportDescriptionsDocx,
} from '../services/docxGenerator';
import type {
  ClassGroup,
  GradeComponent,
  LearningObjectiveTP,
  ReportDescription,
  SemesterNumber,
  Student,
  StudentGrade,
} from '../types/domain';

export const ReportCardPage: React.FC = () => {
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
    navigate,
  } = useApp();

  const [tab, setTab] = useState<'capaian' | 'deskripsi' | 'rekap'>('deskripsi');
  useEffect(() => {
    if (
      activeSubTab === 'capaian' ||
      activeSubTab === 'deskripsi' ||
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
  const [components, setComponents] = useState<GradeComponent[]>([]);
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [descriptions, setDescriptions] = useState<ReportDescription[]>([]);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    if (activeYear) setSemester(activeYear.activeSemester);
  }, [activeYear]);

  useEffect(() => {
    if (!activeYear) return;
    let cancelled = false;
    (async () => {
      const yId = activeYear.id;
      const [clsL, tpL, compL] = await Promise.all([
        db.classGroups.where('academicYearId').equals(yId).toArray(),
        db.tps.where('academicYearId').equals(yId).toArray(),
        db.gradeComponents.where('academicYearId').equals(yId).toArray(),
      ]);
      if (!cancelled) {
        const sortedCls = clsL.sort((a, b) => a.name.localeCompare(b.name));
        setClasses(sortedCls);
        setTps(tpL);
        setComponents(compL.filter((c) => c.semester === semester));
        if (sortedCls.length > 0 && !sortedCls.some((c) => c.id === selectedClassId)) {
          setSelectedClassId(sortedCls[0].id);
        }
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
      const [stL, grL, descL] = await Promise.all([
        db.students.where('classId').equals(selectedClassId).toArray(),
        db.studentGrades.where('classId').equals(selectedClassId).toArray(),
        db.reportDescriptions.where('classId').equals(selectedClassId).toArray(),
      ]);
      if (!cancelled) {
        setStudents(stL.sort((a, b) => a.orderNumber - b.orderNumber));
        setGrades(grL.filter((g) => g.semester === semester));
        setDescriptions(descL.filter((d) => d.semester === semester));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeYear, selectedClassId, semester, dataVersion]);

  const activeClass = classes.find((c) => c.id === selectedClassId) ?? null;

  const analytics = useMemo(() => {
    return computeClassGradeAnalytics({
      students,
      components,
      grades,
      tps,
      kktpThreshold: settings?.kktpThreshold ?? 75,
    });
  }, [students, components, grades, tps, settings]);

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

  const handleGenerateOneStudent = async (studentId: string) => {
    const sum = analytics.studentSummaries.find((s) => s.student.id === studentId);
    if (!sum || !school || !teacher || !activeYear || !activeClass) return;

    if (sum.finalScore === null) {
      notify(
        `Nilai akhir ${sum.student.fullName} belum lengkap. Lengkapi nilai dan bobot (100%) terlebih dahulu.`,
        'warning'
      );
      return;
    }

    setBusyStudentId(studentId);
    try {
      const tpMap = new Map(tps.map((t) => [t.id, t]));
      const achieved = sum.achievedTpIds
        .map((id) => tpMap.get(id))
        .filter((t): t is LearningObjectiveTP => Boolean(t))
        .map((t) => `${t.material}: ${t.objective}`);
      const developing = sum.developingTpIds
        .map((id) => tpMap.get(id))
        .filter((t): t is LearningObjectiveTP => Boolean(t))
        .map((t) => `${t.material}: ${t.objective}`);

      const draft = await generateReportDescriptionDraft({
        ctx: {
          school,
          teacher,
          academicYearName: activeYear.name,
          semester,
        },
        studentName: sum.student.fullName,
        gradeLevel: activeClass.gradeLevel,
        subject: activeClass.subject || teacher.subjects[0] || 'Mata Pelajaran',
        finalScore: sum.finalScore,
        achievedTps: achieved,
        developingTps: developing,
      });

      const existing = descriptions.find((d) => d.studentId === studentId);
      await db.reportDescriptions.put({
        id: existing?.id || createId('rep'),
        academicYearId: activeYear.id,
        classId: activeClass.id,
        studentId,
        semester,
        subject: activeClass.subject || teacher.subjects[0] || 'Umum',
        finalScore: sum.finalScore,
        achievedTpIds: sum.achievedTpIds,
        developingTpIds: sum.developingTpIds,
        descriptionText: draft.descriptionText,
        followUpNote: draft.followUpNote,
        isAiDraft: true,
        isApproved: false,
        updatedAt: new Date().toISOString(),
      });
      await refreshData();
      notify(`Draft deskripsi rapor ${sum.student.fullName} dibuat. Silakan tinjau & setujui.`);
    } catch (err: unknown) {
      notify(
        err instanceof Error ? err.message : 'Gagal membuat deskripsi rapor.',
        'error'
      );
    } finally {
      setBusyStudentId(null);
    }
  };

  const handleGenerateBatch = async () => {
    const eligible = analytics.studentSummaries.filter((s) => s.finalScore !== null);
    if (eligible.length === 0) {
      notify(
        'Tidak ada siswa yang memiliki Nilai Akhir lengkap. Lengkapi Daftar Nilai dan pastikan bobot total 100%.',
        'warning'
      );
      return;
    }
    setBatchLoading(true);
    for (const s of eligible) {
      await handleGenerateOneStudent(s.student.id);
    }
    setBatchLoading(false);
    notify(`Selesai menyusun draft deskripsi untuk ${eligible.length} siswa.`);
  };

  if (classes.length === 0) {
    return (
      <div>
        <PageHeader
          title="Rapor & Deskripsi Capaian Siswa"
          description="Penyusunan deskripsi rapor berbasis data nyata nilai dan ketercapaian TP."
        />
        <EmptyState
          title="Belum Ada Kelas & Siswa"
          description="Tambahkan kelas, siswa, dan nilai terlebih dahulu sebelum menyusun deskripsi rapor."
          actionLabel="Buka Data Kelas"
          onAction={() => navigate('data_akademik', 'kelas')}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Rapor & Deskripsi Capaian Siswa"
        description="Deskripsi capaian disusun hanya berdasarkan nilai nyata dan ketercapaian TP siswa (tanpa mengarang data)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${inputClass} w-40`}
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
            {identityBundle && activeClass && (
              <DocxButton
                label="Unduh Rapor DOCX"
                disabled={students.length === 0}
                onClick={async () => {
                  const blob = await generateReportDescriptionsDocx(
                    identityBundle,
                    activeClass,
                    students,
                    descriptions
                  );
                  await downloadDocxBlob(
                    blob,
                    `Deskripsi_Rapor_${activeClass.name}_Sem${semester}.docx`
                  );
                }}
              />
            )}
          </div>
        }
      />

      <SegmentedTabs
        tabs={[
          { id: 'capaian', label: 'Capaian Pembelajaran Siswa' },
          { id: 'deskripsi', label: 'Deskripsi Rapor Otomatis', count: descriptions.length },
          { id: 'rekap', label: 'Rekap Rapor Kelas' },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {!analytics.weightValidation.isValid && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700" />
          <div>
            <strong>Peringatan Data Nilai:</strong> {analytics.weightValidation.message}{' '}
            Buka menu <strong>Daftar Nilai</strong> untuk melengkapi nilai siswa.
          </div>
        </div>
      )}

      {tab === 'capaian' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2 pr-3">Nama Siswa</th>
                <th className="py-2 pr-3 text-right">Nilai Akhir</th>
                <th className="py-2 pr-3">TP Dikuasai</th>
                <th className="py-2">TP Perlu Bimbingan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.studentSummaries.map((s) => (
                <tr key={s.student.id}>
                  <td className="py-3 pr-3 font-medium text-slate-900">{s.student.fullName}</td>
                  <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums">
                    {s.finalScore ?? '-'}
                  </td>
                  <td className="py-3 pr-3 text-xs text-teal-800">
                    {s.achievedTpIds.length} TP
                  </td>
                  <td className="py-3 text-xs text-amber-700">
                    {s.developingTpIds.length} TP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'deskripsi' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              Siswa dengan Nilai Akhir lengkap:{' '}
              <span className="font-mono font-semibold text-slate-900">
                {analytics.studentSummaries.filter((s) => s.finalScore !== null).length}/
                {students.length}
              </span>
            </div>
            <AiActionButton loading={batchLoading} onClick={handleGenerateBatch}>
              Generate Deskripsi Semua Siswa Siap
            </AiActionButton>
          </div>

          {analytics.studentSummaries.map((sum) => {
            const desc = descriptions.find((d) => d.studentId === sum.student.id);
            const hasScore = sum.finalScore !== null;

            return (
              <div
                key={sum.student.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {sum.student.fullName}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      NIS: {sum.student.nis || '-'} · Nilai Akhir:{' '}
                      {sum.finalScore !== null ? sum.finalScore : 'Belum Lengkap'} · Status:{' '}
                      {sum.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!hasScore || busyStudentId === sum.student.id}
                      onClick={() => handleGenerateOneStudent(sum.student.id)}
                      className="px-3 py-1.5 text-xs font-medium text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100 disabled:opacity-40 rounded-lg inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {busyStudentId === sum.student.id
                          ? 'Menyusun...'
                          : 'Buat Deskripsi AI'}
                      </span>
                    </button>
                    {desc && !desc.isApproved && (
                      <PrimaryButton
                        onClick={async () => {
                          await db.reportDescriptions.update(desc.id, {
                            isApproved: true,
                          });
                          await refreshData();
                          notify(`Deskripsi ${sum.student.fullName} disetujui.`);
                        }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Setujui</span>
                      </PrimaryButton>
                    )}
                  </div>
                </div>

                {!hasScore ? (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Data nilai siswa belum mencukupi untuk menyusun deskripsi rapor otomatis. Input nilai lengkap di menu Daftar Nilai terlebih dahulu.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <textarea
                        rows={3}
                        className={inputClass}
                        placeholder="Tulis atau hasilkan deskripsi capaian kompetensi siswa..."
                        value={desc?.descriptionText ?? ''}
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (!activeYear || !activeClass) return;
                          await db.reportDescriptions.put({
                            id: desc?.id || createId('rep'),
                            academicYearId: activeYear.id,
                            classId: activeClass.id,
                            studentId: sum.student.id,
                            semester,
                            subject: activeClass.subject || 'Umum',
                            finalScore: sum.finalScore,
                            achievedTpIds: sum.achievedTpIds,
                            developingTpIds: sum.developingTpIds,
                            descriptionText: val,
                            followUpNote: desc?.followUpNote || '',
                            isAiDraft: desc?.isAiDraft || false,
                            isApproved: true,
                            updatedAt: new Date().toISOString(),
                          });
                          await refreshData();
                        }}
                      />
                    </div>
                    <div>
                      <textarea
                        rows={3}
                        className={inputClass}
                        placeholder="Catatan tindak lanjut..."
                        value={desc?.followUpNote ?? ''}
                        onChange={async (e) => {
                          if (!desc) return;
                          await db.reportDescriptions.update(desc.id, {
                            followUpNote: e.target.value,
                          });
                          await refreshData();
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'rekap' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2 pr-2">No</th>
                <th className="py-2 pr-3">Nama Siswa</th>
                <th className="py-2 pr-3 text-right">Nilai</th>
                <th className="py-2 pr-3">Deskripsi Rapor</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((st, idx) => {
                const d = descriptions.find((x) => x.studentId === st.id);
                return (
                  <tr key={st.id}>
                    <td className="py-3 pr-2 font-mono text-xs">{idx + 1}</td>
                    <td className="py-3 pr-3 font-medium text-slate-900">{st.fullName}</td>
                    <td className="py-3 pr-3 text-right font-mono font-semibold">
                      {d?.finalScore ?? '-'}
                    </td>
                    <td className="py-3 pr-3 text-xs text-slate-700 max-w-lg">
                      {d?.descriptionText || '(Belum disusun)'}
                    </td>
                    <td className="py-3 text-right text-xs">
                      {d?.isApproved ? (
                        <span className="text-teal-700 font-medium">Disetujui</span>
                      ) : d ? (
                        <span className="text-amber-700 font-medium">Draft</span>
                      ) : (
                        <span className="text-slate-400">Kosong</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
