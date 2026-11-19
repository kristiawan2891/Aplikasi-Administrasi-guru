import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { createId, db } from '../db/database';
import { useApp } from '../context/AppContext';
import {
  AiActionButton,
  DocxButton,
  EmptyState,
  FormField,
  inputClass,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SegmentedTabs,
} from '../components/UI';
import { generateQuestionsDraft } from '../services/aiService';
import {
  downloadDocxBlob,
  generateAnswerKeyDocx,
  generateAssessmentQuestionsDocx,
  generateBlueprintDocx,
} from '../services/docxGenerator';
import type {
  Assessment,
  AssessmentCategory,
  ClassGroup,
  CognitiveLevel,
  DifficultyLevel,
  LearningObjectiveTP,
  QuestionBankItem,
  QuestionType,
  SemesterNumber,
} from '../types/domain';

export const AssessmentPage: React.FC = () => {
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
  } = useApp();

  const [tab, setTab] = useState<'bank_soal' | 'harian' | 'sumatif' | 'ujian' | 'kisi'>(
    'bank_soal'
  );
  useEffect(() => {
    if (
      activeSubTab === 'bank_soal' ||
      activeSubTab === 'harian' ||
      activeSubTab === 'sumatif' ||
      activeSubTab === 'ujian' ||
      activeSubTab === 'kisi'
    ) {
      setTab(activeSubTab);
    }
  }, [activeSubTab]);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [tps, setTps] = useState<LearningObjectiveTP[]>([]);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  // Bank Soal form
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [qGrade, setQGrade] = useState('7');
  const [qSem, setQSem] = useState<SemesterNumber>(1);
  const [qTpId, setQTpId] = useState('');
  const [qMaterial, setQMaterial] = useState('');
  const [qType, setQType] = useState<QuestionType>('Pilihan Ganda');
  const [qDiff, setQDiff] = useState<DifficultyLevel>('Sedang');
  const [qCog, setQCog] = useState<CognitiveLevel>('C2');
  const [qIndicator, setQIndicator] = useState('');
  const [qText, setQText] = useState('');
  const [qOpts, setQOpts] = useState(['', '', '', '']);
  const [qAnswer, setQAnswer] = useState('');
  const [qExpl, setQExpl] = useState('');
  const [qScore, setQScore] = useState(10);
  const [qSearch, setQSearch] = useState('');
  const [qFilterType, setQFilterType] = useState('Semua');
  const [qAiLoading, setQAiLoading] = useState(false);
  const [qAiDrafts, setQAiDrafts] = useState<
    Array<{
      indicator: string;
      cognitiveLevel: CognitiveLevel;
      questionText: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
      maxScore: number;
    }>
  >([]);

  // Assessment Builder
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [asmtName, setAsmtName] = useState('');
  const [asmtCategory, setAsmtCategory] = useState<AssessmentCategory>('Asesmen Harian');
  const [asmtClassId, setAsmtClassId] = useState('');
  const [asmtDate, setAsmtDate] = useState(new Date().toISOString().slice(0, 10));
  const [asmtMaterial, setAsmtMaterial] = useState('');
  const [asmtWeight, setAsmtWeight] = useState(100);
  const [selectedQIds, setSelectedQIds] = useState<string[]>([]);
  const [selectedAsmtId, setSelectedAsmtId] = useState('');

  useEffect(() => {
    if (!activeYear) return;
    let cancelled = false;
    (async () => {
      const yId = activeYear.id;
      const [clsL, tpL, qbL, asmtL] = await Promise.all([
        db.classGroups.where('academicYearId').equals(yId).toArray(),
        db.tps.where('academicYearId').equals(yId).toArray(),
        db.questionBank.where('academicYearId').equals(yId).toArray(),
        db.assessments.where('academicYearId').equals(yId).toArray(),
      ]);
      if (!cancelled) {
        setClasses(clsL);
        setTps(tpL);
        setQuestions(qbL);
        setAssessments(asmtL);
        if (tpL.length > 0 && !qTpId) setQTpId(tpL[0].id);
        if (clsL.length > 0 && !asmtClassId) setAsmtClassId(clsL[0].id);
        if (asmtL.length > 0 && !selectedAsmtId) setSelectedAsmtId(asmtL[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeYear, dataVersion]);

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

  // ======================== BANK SOAL ========================
  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQText('');
    setQOpts(['', '', '', '']);
    setQAnswer('');
    setQExpl('');
    setQIndicator('');
  };

  const handleEditQuestion = (q: QuestionBankItem) => {
    setEditingQuestionId(q.id);
    setQGrade(q.gradeLevel);
    setQSem(q.semester);
    setQCog(q.cognitiveLevel);
    setQTpId(q.tpId);
    setQType(q.questionType);
    setQDiff(q.difficulty);
    setQMaterial(q.material);
    setQIndicator(q.indicator);
    setQText(q.questionText);
    const paddedOpts = [
      q.options[0] || '',
      q.options[1] || '',
      q.options[2] || '',
      q.options[3] || '',
    ];
    setQOpts(paddedOpts);
    setQAnswer(q.correctAnswer);
    setQScore(q.maxScore);
    setQExpl(q.explanation);
  };

  const handleSaveQuestion = async () => {
    if (!activeYear || !qText.trim()) {
      notify('Teks pertanyaan wajib diisi.', 'error');
      return;
    }
    const existing = editingQuestionId
      ? questions.find((q) => q.id === editingQuestionId)
      : undefined;
    await db.questionBank.put({
      id: editingQuestionId || createId('qb'),
      academicYearId: activeYear.id,
      gradeLevel: qGrade,
      subject: teacher?.subjects[0] || 'Umum',
      semester: qSem,
      tpId: qTpId,
      material: qMaterial.trim() || tps.find((t) => t.id === qTpId)?.material || 'Umum',
      indicator: qIndicator.trim(),
      questionType: qType,
      cognitiveLevel: qCog,
      difficulty: qDiff,
      questionText: qText.trim(),
      options:
        qType === 'Pilihan Ganda' || qType === 'Pilihan Ganda Kompleks'
          ? qOpts.filter((o) => o.trim() !== '')
          : qType === 'Benar/Salah'
            ? ['Benar', 'Salah']
            : [],
      correctAnswer: qAnswer.trim(),
      explanation: qExpl.trim(),
      maxScore: Number(qScore) || 10,
      isAiDraft: existing?.isAiDraft,
      createdAt: existing?.createdAt || new Date().toISOString(),
    });
    const wasEditing = Boolean(editingQuestionId);
    resetQuestionForm();
    await refreshData();
    notify(wasEditing ? 'Butir soal diperbarui.' : 'Butir soal ditambahkan ke Bank Soal.');
  };

  const handleGenerateQuestionsAi = async () => {
    const tp = tps.find((t) => t.id === qTpId);
    if (!tp || !school || !teacher || !activeYear) {
      notify('Pilih Tujuan Pembelajaran (TP) untuk membuat soal AI.', 'warning');
      return;
    }
    setQAiLoading(true);
    try {
      const drafts = await generateQuestionsDraft({
        ctx: {
          school,
          teacher,
          academicYearName: activeYear.name,
          semester: qSem,
        },
        gradeLevel: qGrade,
        subject: teacher.subjects[0] || 'Umum',
        tp,
        material: qMaterial || tp.material,
        questionType: qType,
        difficulty: qDiff,
        count: 3,
      });
      setQAiDrafts(drafts);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Gagal membuat soal AI.', 'error');
    } finally {
      setQAiLoading(false);
    }
  };

  const handleApproveQuestionsAi = async () => {
    if (!activeYear || qAiDrafts.length === 0) return;
    const tp = tps.find((t) => t.id === qTpId);
    const now = new Date().toISOString();
    const items: QuestionBankItem[] = qAiDrafts.map((d) => ({
      id: createId('qb'),
      academicYearId: activeYear.id,
      gradeLevel: qGrade,
      subject: teacher?.subjects[0] || 'Umum',
      semester: qSem,
      tpId: qTpId,
      material: qMaterial || tp?.material || 'Umum',
      indicator: d.indicator,
      questionType: qType,
      cognitiveLevel: d.cognitiveLevel || 'C2',
      difficulty: qDiff,
      questionText: d.questionText,
      options: d.options || [],
      correctAnswer: d.correctAnswer,
      explanation: d.explanation,
      maxScore: Number(d.maxScore) || 10,
      isAiDraft: true,
      createdAt: now,
    }));
    await db.questionBank.bulkPut(items);
    setQAiDrafts([]);
    await refreshData();
    notify(`${items.length} soal AI disetujui & masuk ke Bank Soal.`);
  };

  const filteredQuestions = questions.filter((q) => {
    const matchType = qFilterType === 'Semua' || q.questionType === qFilterType;
    const matchSearch =
      !qSearch.trim() ||
      q.questionText.toLowerCase().includes(qSearch.toLowerCase()) ||
      q.material.toLowerCase().includes(qSearch.toLowerCase());
    return matchType && matchSearch;
  });

  // ======================== CREATE / EDIT ASSESSMENT ========================
  const resetAssessmentForm = () => {
    setEditingAssessmentId(null);
    setAsmtName('');
    setAsmtMaterial('');
    setSelectedQIds([]);
  };

  const handleEditAssessment = (a: Assessment) => {
    setEditingAssessmentId(a.id);
    setAsmtName(a.name);
    setAsmtCategory(a.category);
    setAsmtClassId(a.classId);
    setAsmtDate(a.date);
    setAsmtMaterial(a.material);
    setAsmtWeight(a.weight);
    setSelectedQIds(a.questionIds);
  };

  const handleCreateAssessment = async (categoryOverride?: AssessmentCategory) => {
    if (!activeYear || !asmtName.trim()) {
      notify('Nama asesmen wajib diisi.', 'error');
      return;
    }
    const existing = editingAssessmentId
      ? assessments.find((a) => a.id === editingAssessmentId)
      : undefined;
    const cls = classes.find((c) => c.id === asmtClassId);
    const pickedQs = questions.filter((q) => selectedQIds.includes(q.id));
    const tpMap = new Map(tps.map((t) => [t.id, t]));
    const totalScore = pickedQs.reduce((s, q) => s + q.maxScore, 0) || 100;

    const blueprint = pickedQs.map((q, idx) => {
      const tp = tpMap.get(q.tpId);
      return {
        number: idx + 1,
        cpText: '-',
        tpCode: tp?.code || '-',
        material: q.material,
        indicator: q.indicator || '-',
        cognitiveLevel: q.cognitiveLevel,
        questionType: q.questionType,
        questionNumber: String(idx + 1),
        maxScore: q.maxScore,
      };
    });

    const id = editingAssessmentId || createId('asmt');
    await db.assessments.put({
      id,
      academicYearId: activeYear.id,
      name: asmtName.trim(),
      category: categoryOverride || asmtCategory,
      classId: asmtClassId,
      gradeLevel: cls?.gradeLevel || existing?.gradeLevel || qGrade,
      semester: existing?.semester ?? activeYear.activeSemester,
      subject: cls?.subject || existing?.subject || teacher?.subjects[0] || 'Umum',
      tpIds: Array.from(new Set(pickedQs.map((q) => q.tpId).filter(Boolean))),
      material: asmtMaterial.trim() || pickedQs[0]?.material || '-',
      date: asmtDate,
      weight: Number(asmtWeight) || 100,
      maxScore: totalScore,
      questionIds: selectedQIds,
      customQuestions: existing?.customQuestions ?? [],
      blueprint,
      scoringGuide: `Skor Maksimal = ${totalScore}. Nilai Akhir = (Skor Perolehan / ${totalScore}) × 100`,
      rubric: existing?.rubric ?? [
        {
          criteria: 'Ketepatan Jawaban & Konsep',
          excellent: 'Menjawab seluruh bagian dengan tepat dan sistematis',
          good: 'Menjawab sebagian besar dengan tepat',
          fair: 'Menjawab cukup tepat namun kurang lengkap',
          needsGuidance: 'Jawaban belum sesuai konsep',
          maxScore: totalScore,
        },
      ],
      remedialPlan:
        existing?.remedialPlan ??
        'Pembelajaran ulang terbimbing & latihan soal sejenis bagi peserta didik di bawah KKTP.',
      enrichmentPlan:
        existing?.enrichmentPlan ??
        'Penugasan pemecahan masalah tingkat lanjut (HOTS) bagi peserta didik tuntas.',
      isShuffled: existing?.isShuffled,
      updatedAt: new Date().toISOString(),
    });
    const wasEditing = Boolean(editingAssessmentId);
    resetAssessmentForm();
    setSelectedAsmtId(id);
    await refreshData();
    notify(
      wasEditing
        ? 'Perubahan paket asesmen disimpan.'
        : 'Paket asesmen & kisi-kisi berhasil dibuat.'
    );
  };

  const handleShuffleAssessmentQuestions = async (asmt: Assessment) => {
    const shuffled = [...asmt.questionIds].sort(() => Math.random() - 0.5);
    await db.assessments.update(asmt.id, {
      questionIds: shuffled,
      isShuffled: true,
      updatedAt: new Date().toISOString(),
    });
    await refreshData();
    notify('Urutan soal asesmen diacak.');
  };

  const activeCategoryFilter = (t: typeof tab): AssessmentCategory[] => {
    if (t === 'harian') return ['Quiz', 'Asesmen Harian'];
    if (t === 'sumatif')
      return [
        'Asesmen Sumatif Lingkup Materi',
        'Asesmen Sumatif Akhir Semester',
        'Asesmen Sumatif Akhir Tahun',
        'Praktik',
        'Proyek',
      ];
    if (t === 'ujian') return ['STS/PTS', 'SAS/PAS', 'Ujian Lainnya'];
    return [];
  };

  const renderAssessmentSection = (
    title: string,
    defaultCats: AssessmentCategory[]
  ) => {
    const list = assessments.filter((a) => defaultCats.includes(a.category));
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            {editingAssessmentId ? `Edit ${title}` : `Buat ${title}`}
          </h3>
          <FormField label="Nama Asesmen" required>
            <input
              type="text"
              className={inputClass}
              value={asmtName}
              onChange={(e) => setAsmtName(e.target.value)}
              placeholder={`Contoh: ${defaultCats[0]} Bab 1`}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Jenis">
              <select
                className={inputClass}
                value={defaultCats.includes(asmtCategory) ? asmtCategory : defaultCats[0]}
                onChange={(e) =>
                  setAsmtCategory(e.target.value as AssessmentCategory)
                }
              >
                {defaultCats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Kelas">
              <select
                className={inputClass}
                value={asmtClassId}
                onChange={(e) => setAsmtClassId(e.target.value)}
              >
                <option value="">Semua / Umum</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tanggal">
              <input
                type="date"
                className={inputClass}
                value={asmtDate}
                onChange={(e) => setAsmtDate(e.target.value)}
              />
            </FormField>
            <FormField label="Bobot / Skor">
              <input
                type="number"
                className={`${inputClass} font-mono`}
                value={asmtWeight}
                onChange={(e) => setAsmtWeight(Number(e.target.value))}
              />
            </FormField>
          </div>
          <FormField label="Materi Pokok">
            <input
              type="text"
              className={inputClass}
              value={asmtMaterial}
              onChange={(e) => setAsmtMaterial(e.target.value)}
            />
          </FormField>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1.5">
              Pilih Soal dari Bank Soal ({selectedQIds.length} dipilih):
            </div>
            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg p-2.5 space-y-2 bg-slate-50">
              {questions.length === 0 ? (
                <div className="text-xs text-slate-500 p-2">
                  Bank soal masih kosong. Buat soal di tab Bank Soal terlebih dahulu.
                </div>
              ) : (
                questions.map((q) => (
                  <label
                    key={q.id}
                    className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedQIds.includes(q.id)}
                      onChange={(e) =>
                        setSelectedQIds((prev) =>
                          e.target.checked
                            ? [...prev, q.id]
                            : prev.filter((id) => id !== q.id)
                        )
                      }
                    />
                    <span className="line-clamp-2">
                      [{q.questionType}] {q.questionText}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PrimaryButton
              className="flex-1"
              onClick={() =>
                handleCreateAssessment(
                  defaultCats.includes(asmtCategory) ? asmtCategory : defaultCats[0]
                )
              }
            >
              <Plus className="w-4 h-4" />
              <span>
                {editingAssessmentId ? 'Simpan Perubahan Paket' : `Simpan Paket ${title}`}
              </span>
            </PrimaryButton>
            {editingAssessmentId && (
              <SecondaryButton onClick={resetAssessmentForm}>
                Batal
              </SecondaryButton>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {list.length === 0 ? (
            <EmptyState
              title={`Belum Ada ${title}`}
              description="Pilih soal dari Bank Soal dan simpan paket asesmen untuk langsung menghasilkan Naskah Soal, Kisi-Kisi, dan Kunci Jawaban DOCX terpisah."
            />
          ) : (
            list.map((a) => {
              const linkedQ = a.questionIds
                .map((id) => questions.find((q) => q.id === id))
                .filter((q): q is QuestionBankItem => Boolean(q));
              return (
                <div
                  key={a.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-blue-800">
                        {a.category} · Kelas {a.gradeLevel} · {a.date} · {linkedQ.length} Soal
                      </div>
                      <h4 className="text-base font-semibold text-slate-900 mt-0.5">
                        {a.name}
                      </h4>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Materi: {a.material} · Skor Maks: {a.maxScore}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <SecondaryButton onClick={() => handleShuffleAssessmentQuestions(a)}>
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>Acak Soal</span>
                      </SecondaryButton>
                      <button
                        type="button"
                        onClick={() => handleEditAssessment(a)}
                        title="Edit paket asesmen"
                        className="p-2 text-slate-500 hover:text-blue-800 border border-slate-200 rounded-lg"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Hapus ${a.name}?`,
                            message: 'Paket asesmen ini akan dihapus.',
                            confirmLabel: 'Hapus',
                            danger: true,
                          });
                          if (!ok) return;
                          await db.assessments.delete(a.id);
                          if (editingAssessmentId === a.id) resetAssessmentForm();
                          await refreshData();
                        }}
                        className="p-2 text-slate-400 hover:text-red-700 border border-slate-200 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {identityBundle && (
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                      <DocxButton
                        label="Naskah Soal (.DOCX)"
                        onClick={async () => {
                          const blob = await generateAssessmentQuestionsDocx(
                            identityBundle,
                            a,
                            linkedQ
                          );
                          await downloadDocxBlob(blob, `Soal_${a.name}.docx`);
                          notify('Naskah Soal DOCX diunduh.');
                        }}
                      />
                      <DocxButton
                        label="Kisi-Kisi (.DOCX)"
                        onClick={async () => {
                          const blob = await generateBlueprintDocx(
                            identityBundle,
                            a,
                            linkedQ,
                            tps
                          );
                          await downloadDocxBlob(blob, `Kisi_Kisi_${a.name}.docx`);
                          notify('Kisi-Kisi DOCX diunduh.');
                        }}
                      />
                      <DocxButton
                        label="Kunci & Rubrik (.DOCX)"
                        onClick={async () => {
                          const blob = await generateAnswerKeyDocx(
                            identityBundle,
                            a,
                            linkedQ
                          );
                          await downloadDocxBlob(blob, `Kunci_Jawaban_${a.name}.docx`);
                          notify('Kunci Jawaban & Rubrik DOCX diunduh.');
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const selectedBlueprintAsmt =
    assessments.find((a) => a.id === selectedAsmtId) ?? assessments[0] ?? null;

  return (
    <div>
      <PageHeader
        title="Bank Soal & Asesmen"
        description="Kelola Bank Soal, Quiz, Asesmen Harian, Asesmen Sumatif, STS/PTS, SAS/PAS, serta cetak terpisah Naskah Soal, Kisi-Kisi, dan Kunci Jawaban DOCX."
      />

      <SegmentedTabs
        tabs={[
          { id: 'bank_soal', label: 'Bank Soal', count: questions.length },
          { id: 'harian', label: 'Quiz & Harian' },
          { id: 'sumatif', label: 'Asesmen Sumatif' },
          { id: 'ujian', label: 'STS/PTS & SAS/PAS' },
          { id: 'kisi', label: 'Kisi-Kisi & Kunci', count: assessments.length },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {/* TAB 1: BANK SOAL */}
      {tab === 'bank_soal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              {editingQuestionId ? 'Edit Butir Soal' : 'Tambah Butir Soal'}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <FormField label="Kelas">
                <input
                  type="text"
                  className={inputClass}
                  value={qGrade}
                  onChange={(e) => setQGrade(e.target.value)}
                />
              </FormField>
              <FormField label="Sem">
                <select
                  className={inputClass}
                  value={qSem}
                  onChange={(e) => setQSem(Number(e.target.value) as SemesterNumber)}
                >
                  <option value={1}>S1</option>
                  <option value={2}>S2</option>
                </select>
              </FormField>
              <FormField label="Level">
                <select
                  className={inputClass}
                  value={qCog}
                  onChange={(e) => setQCog(e.target.value as CognitiveLevel)}
                >
                  {['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="TP Terkait">
              <select
                className={inputClass}
                value={qTpId}
                onChange={(e) => setQTpId(e.target.value)}
              >
                <option value="">-- Pilih TP --</option>
                {tps.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.code} · {tp.material}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Bentuk Soal">
                <select
                  className={inputClass}
                  value={qType}
                  onChange={(e) => setQType(e.target.value as QuestionType)}
                >
                  {[
                    'Pilihan Ganda',
                    'Pilihan Ganda Kompleks',
                    'Benar/Salah',
                    'Menjodohkan',
                    'Isian',
                    'Uraian',
                    'Praktik',
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Kesulitan">
                <select
                  className={inputClass}
                  value={qDiff}
                  onChange={(e) => setQDiff(e.target.value as DifficultyLevel)}
                >
                  <option value="Mudah">Mudah</option>
                  <option value="Sedang">Sedang</option>
                  <option value="Sulit">Sulit</option>
                </select>
              </FormField>
            </div>
            <FormField label="Materi">
              <input
                type="text"
                className={inputClass}
                value={qMaterial}
                onChange={(e) => setQMaterial(e.target.value)}
                placeholder="Topik soal"
              />
            </FormField>
            <FormField label="Indikator Soal (untuk Kisi-Kisi)">
              <input
                type="text"
                className={inputClass}
                value={qIndicator}
                onChange={(e) => setQIndicator(e.target.value)}
                placeholder="Disajikan..., siswa mampu..."
              />
            </FormField>
            <FormField label="Pertanyaan" required>
              <textarea
                rows={3}
                className={inputClass}
                value={qText}
                onChange={(e) => setQText(e.target.value)}
              />
            </FormField>

            {(qType === 'Pilihan Ganda' || qType === 'Pilihan Ganda Kompleks') && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-700">Pilihan Jawaban:</div>
                {['A', 'B', 'C', 'D'].map((ltr, idx) => (
                  <input
                    key={ltr}
                    type="text"
                    className={`${inputClass} text-xs`}
                    placeholder={`Opsi ${ltr}`}
                    value={qOpts[idx]}
                    onChange={(e) => {
                      const next = [...qOpts];
                      next[idx] = e.target.value;
                      setQOpts(next);
                    }}
                  />
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <FormField label="Kunci Jawaban">
                  <input
                    type="text"
                    className={inputClass}
                    value={qAnswer}
                    onChange={(e) => setQAnswer(e.target.value)}
                  />
                </FormField>
              </div>
              <FormField label="Skor">
                <input
                  type="number"
                  className={`${inputClass} font-mono`}
                  value={qScore}
                  onChange={(e) => setQScore(Number(e.target.value))}
                />
              </FormField>
            </div>

            <FormField label="Pembahasan">
              <textarea
                rows={2}
                className={inputClass}
                value={qExpl}
                onChange={(e) => setQExpl(e.target.value)}
              />
            </FormField>

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center gap-2">
                <PrimaryButton className="flex-1" onClick={handleSaveQuestion}>
                  {editingQuestionId ? 'Simpan Perubahan Soal' : 'Simpan ke Bank Soal'}
                </PrimaryButton>
                {editingQuestionId && (
                  <SecondaryButton onClick={resetQuestionForm}>
                    Batal
                  </SecondaryButton>
                )}
              </div>
              <AiActionButton
                loading={qAiLoading}
                onClick={handleGenerateQuestionsAi}
              >
                Generate 3 Soal (AI)
              </AiActionButton>
            </div>

            {qAiDrafts.length > 0 && (
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg space-y-2 text-xs">
                <div className="font-semibold text-teal-900">
                  Draft Soal AI ({qAiDrafts.length} butir) — Tinjau:
                </div>
                {qAiDrafts.map((d, idx) => (
                  <div key={idx} className="p-2 bg-white border border-teal-200 rounded">
                    <div className="font-medium text-slate-900">
                      {idx + 1}. {d.questionText}
                    </div>
                    <div className="text-teal-800 mt-1">
                      Kunci: {d.correctAnswer} ({d.cognitiveLevel})
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <PrimaryButton onClick={handleApproveQuestionsAi}>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Setujui & Simpan</span>
                  </PrimaryButton>
                  <SecondaryButton onClick={() => setQAiDrafts([])}>
                    Batal
                  </SecondaryButton>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  className={`${inputClass} pl-9`}
                  placeholder="Cari soal atau materi..."
                  value={qSearch}
                  onChange={(e) => setQSearch(e.target.value)}
                />
              </div>
              <select
                className={`${inputClass} w-48`}
                value={qFilterType}
                onChange={(e) => setQFilterType(e.target.value)}
              >
                <option value="Semua">Semua Bentuk Soal</option>
                {[
                  'Pilihan Ganda',
                  'Pilihan Ganda Kompleks',
                  'Benar/Salah',
                  'Menjodohkan',
                  'Isian',
                  'Uraian',
                  'Praktik',
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {filteredQuestions.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  title="Bank Soal Masih Kosong"
                  description="Tambahkan butir soal secara manual atau gunakan AI untuk menghasilkan soal beserta indikator, kunci jawaban, dan pembahasan."
                />
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {filteredQuestions.map((q, idx) => (
                  <div key={q.id} className="py-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-blue-800">
                        #{idx + 1} · {q.questionType} · {q.cognitiveLevel} · {q.difficulty} · Skor {q.maxScore} · {q.material}
                      </div>
                      <div className="text-sm text-slate-900">{q.questionText}</div>
                      {q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-slate-600 pt-1">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx}>
                              {['A', 'B', 'C', 'D', 'E'][oIdx]}. {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-teal-800 pt-1">
                        Kunci: <span className="font-semibold">{q.correctAnswer || '-'}</span>
                        {q.explanation ? ` — ${q.explanation}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditQuestion(q)}
                        title="Edit butir soal"
                        className="p-1.5 text-slate-500 hover:text-blue-800"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Hapus Butir Soal?',
                            message: 'Butir soal ini akan dihapus dari Bank Soal.',
                            confirmLabel: 'Hapus',
                            danger: true,
                          });
                          if (!ok) return;
                          await db.questionBank.delete(q.id);
                          if (editingQuestionId === q.id) resetQuestionForm();
                          await refreshData();
                          notify('Soal dihapus.', 'info');
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-700"
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

      {tab === 'harian' &&
        renderAssessmentSection('Quiz / Asesmen Harian', activeCategoryFilter('harian'))}
      {tab === 'sumatif' &&
        renderAssessmentSection('Asesmen Sumatif', activeCategoryFilter('sumatif'))}
      {tab === 'ujian' &&
        renderAssessmentSection('Ujian Semester (STS/SAS)', activeCategoryFilter('ujian'))}

      {/* TAB 5: KISI-KISI & KUNCI */}
      {tab === 'kisi' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          {!selectedBlueprintAsmt ? (
            <EmptyState
              title="Belum Ada Paket Asesmen"
              description="Buat paket asesmen pada tab Quiz/Harian, Sumatif, atau Ujian Semester untuk menampilkan Kisi-Kisi, Kunci Jawaban, dan Rubrik."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <select
                  className={`${inputClass} max-w-sm`}
                  value={selectedBlueprintAsmt.id}
                  onChange={(e) => setSelectedAsmtId(e.target.value)}
                >
                  {assessments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.category})
                    </option>
                  ))}
                </select>
                {identityBundle && (
                  <div className="flex items-center gap-2">
                    <DocxButton
                      label="Unduh Kisi-Kisi DOCX"
                      onClick={async () => {
                        const linkedQ = selectedBlueprintAsmt.questionIds
                          .map((id) => questions.find((q) => q.id === id))
                          .filter((q): q is QuestionBankItem => Boolean(q));
                        const blob = await generateBlueprintDocx(
                          identityBundle,
                          selectedBlueprintAsmt,
                          linkedQ,
                          tps
                        );
                        await downloadDocxBlob(
                          blob,
                          `Kisi_Kisi_${selectedBlueprintAsmt.name}.docx`
                        );
                      }}
                    />
                    <DocxButton
                      label="Unduh Kunci & Rubrik DOCX"
                      onClick={async () => {
                        const linkedQ = selectedBlueprintAsmt.questionIds
                          .map((id) => questions.find((q) => q.id === id))
                          .filter((q): q is QuestionBankItem => Boolean(q));
                        const blob = await generateAnswerKeyDocx(
                          identityBundle,
                          selectedBlueprintAsmt,
                          linkedQ
                        );
                        await downloadDocxBlob(
                          blob,
                          `Kunci_Rubrik_${selectedBlueprintAsmt.name}.docx`
                        );
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2 pr-2">No</th>
                      <th className="py-2 pr-3">Kode TP</th>
                      <th className="py-2 pr-3">Materi</th>
                      <th className="py-2 pr-3">Indikator Soal</th>
                      <th className="py-2 pr-3">Level</th>
                      <th className="py-2 pr-3">Bentuk</th>
                      <th className="py-2 text-right">Skor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedBlueprintAsmt.blueprint.map((b) => (
                      <tr key={b.number}>
                        <td className="py-2.5 pr-2 font-mono text-xs">{b.number}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-blue-900">
                          {b.tpCode}
                        </td>
                        <td className="py-2.5 pr-3">{b.material}</td>
                        <td className="py-2.5 pr-3 text-xs text-slate-600">{b.indicator}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs">{b.cognitiveLevel}</td>
                        <td className="py-2.5 pr-3 text-xs">{b.questionType}</td>
                        <td className="py-2.5 text-right font-mono text-xs">{b.maxScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
