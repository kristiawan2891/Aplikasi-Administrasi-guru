import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Link2,
  Plus,
  Search,
  Shuffle,
  Trash2,
  X,
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
import {
  generateFullAssessmentPackAi,
  generateQuestionsDraft,
  type FullAssessmentPackDraft,
} from '../services/aiService';
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
  LearningOutcomeCP,
  LKPDDocument,
  QuestionBankItem,
  QuestionType,
  SemesterNumber,
  TeachingModule,
} from '../types/domain';

const ALL_QUESTION_TYPES: QuestionType[] = [
  'Pilihan Ganda',
  'Pilihan Ganda Kompleks',
  'Benar/Salah',
  'Menjodohkan',
  'Isian',
  'Uraian',
  'Praktik',
];

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

const DEFAULT_COUNTS: Record<QuestionType, number> = {
  'Pilihan Ganda': 5,
  'Pilihan Ganda Kompleks': 0,
  'Benar/Salah': 0,
  Menjodohkan: 0,
  Isian: 0,
  Uraian: 2,
  Praktik: 0,
};

const FALLBACK_ADD_COUNTS: Record<QuestionType, number> = {
  'Pilihan Ganda': 5,
  'Pilihan Ganda Kompleks': 2,
  'Benar/Salah': 3,
  Menjodohkan: 2,
  Isian: 3,
  Uraian: 2,
  Praktik: 1,
};

const categoryToTab = (
  category: AssessmentCategory
): 'harian' | 'sumatif' | 'ujian' => {
  if (category === 'Quiz' || category === 'Asesmen Harian') return 'harian';
  if (
    category === 'STS/PTS' ||
    category === 'SAS/PAS' ||
    category === 'Ujian Lainnya'
  ) {
    return 'ujian';
  }
  return 'sumatif';
};

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
  const [cps, setCps] = useState<LearningOutcomeCP[]>([]);
  const [tps, setTps] = useState<LearningObjectiveTP[]>([]);
  const [modules, setModules] = useState<TeachingModule[]>([]);
  const [lkpds, setLkpds] = useState<LKPDDocument[]>([]);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  // Bank Soal form
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [qGrade, setQGrade] = useState('7');
  const [qSem, setQSem] = useState<SemesterNumber>(1);
  const [qModuleId, setQModuleId] = useState('');
  const [qTpId, setQTpId] = useState('');
  const [qMaterial, setQMaterial] = useState('');
  const [qType, setQType] = useState<QuestionType>('Pilihan Ganda');
  const [qPgOptionCount, setQPgOptionCount] = useState<3 | 4 | 5>(4);
  const [qDiff, setQDiff] = useState<DifficultyLevel>('Sedang');
  const [qCog, setQCog] = useState<CognitiveLevel>('C2');
  const [qIndicator, setQIndicator] = useState('');
  const [qText, setQText] = useState('');
  const [qOpts, setQOpts] = useState(['', '', '', '', '']);
  const [qAnswer, setQAnswer] = useState('');
  const [qExpl, setQExpl] = useState('');
  const [qScore, setQScore] = useState(10);
  const [qAiCount, setQAiCount] = useState(5);
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

  // Assessment Builder (Manual)
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [asmtName, setAsmtName] = useState('');
  const [asmtCategory, setAsmtCategory] = useState<AssessmentCategory>('Asesmen Harian');
  const [asmtClassId, setAsmtClassId] = useState('');
  const [asmtDate, setAsmtDate] = useState(new Date().toISOString().slice(0, 10));
  const [asmtMaterial, setAsmtMaterial] = useState('');
  const [asmtWeight, setAsmtWeight] = useState(100);
  const [selectedQIds, setSelectedQIds] = useState<string[]>([]);
  const [selectedAsmtId, setSelectedAsmtId] = useState('');

  // Auto Assessment Pack Builder (AI)
  const [showAiPackPanel, setShowAiPackPanel] = useState(false);
  const [packName, setPackName] = useState('');
  const [packCategory, setPackCategory] = useState<AssessmentCategory>('Asesmen Harian');
  const [packClassId, setPackClassId] = useState('');
  const [packSemester, setPackSemester] = useState<SemesterNumber>(1);
  const [packDate, setPackDate] = useState(new Date().toISOString().slice(0, 10));
  const [packModuleId, setPackModuleId] = useState('');
  const [packTpIds, setPackTpIds] = useState<string[]>([]);
  const [packTypeCounts, setPackTypeCounts] =
    useState<Record<QuestionType, number>>(DEFAULT_COUNTS);
  const [packPgOptionCount, setPackPgOptionCount] = useState<3 | 4 | 5>(4);
  const [packDifficultyMode, setPackDifficultyMode] = useState<
    'Proporsional' | DifficultyLevel
  >('Proporsional');
  const [packNotes, setPackNotes] = useState('');
  const [packLoading, setPackLoading] = useState(false);
  const [packSaving, setPackSaving] = useState(false);
  const [packDraft, setPackDraft] = useState<FullAssessmentPackDraft | null>(null);

  useEffect(() => {
    if (!activeYear) return;
    let cancelled = false;
    (async () => {
      const yId = activeYear.id;
      const [clsL, cpL, tpL, modL, lkpdL, qbL, asmtL] = await Promise.all([
        db.classGroups.where('academicYearId').equals(yId).toArray(),
        db.cps.where('academicYearId').equals(yId).toArray(),
        db.tps.where('academicYearId').equals(yId).toArray(),
        db.modules.where('academicYearId').equals(yId).toArray(),
        db.lkpds.where('academicYearId').equals(yId).toArray(),
        db.questionBank.where('academicYearId').equals(yId).toArray(),
        db.assessments.where('academicYearId').equals(yId).toArray(),
      ]);
      if (!cancelled) {
        setClasses(clsL);
        setCps(cpL);
        setTps(tpL);
        setModules(modL);
        setLkpds(lkpdL);
        setQuestions(qbL);
        setAssessments(asmtL);
        setPackSemester(activeYear.activeSemester);
        if (tpL.length > 0 && !qTpId) setQTpId(tpL[0].id);
        if (tpL.length > 0 && packTpIds.length === 0) setPackTpIds([tpL[0].id]);
        if (clsL.length > 0 && !asmtClassId) setAsmtClassId(clsL[0].id);
        if (clsL.length > 0 && !packClassId) setPackClassId(clsL[0].id);
        if (asmtL.length > 0 && !selectedAsmtId) setSelectedAsmtId(asmtL[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeYear, dataVersion]);

  const cpMap = useMemo(() => new Map(cps.map((c) => [c.id, c])), [cps]);
  const tpMap = useMemo(() => new Map(tps.map((t) => [t.id, t])), [tps]);
  const moduleMap = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);

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

  // Sync Modul Ajar choice in Bank Soal
  const handleSelectBankSoalModule = (modId: string) => {
    setQModuleId(modId);
    const mod = modules.find((m) => m.id === modId);
    if (!mod) return;
    setQGrade(mod.gradeLevel);
    setQSem(mod.semester);
    setQMaterial(mod.material);
    if (mod.tpIds.length > 0) {
      setQTpId(mod.tpIds[0]);
    }
  };

  // ======================== BANK SOAL ========================
  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQText('');
    setQOpts(['', '', '', '', '']);
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
    const optCount: 3 | 4 | 5 =
      q.options.length === 3 ? 3 : q.options.length >= 5 ? 5 : 4;
    setQPgOptionCount(optCount);
    const paddedOpts = [
      q.options[0] || '',
      q.options[1] || '',
      q.options[2] || '',
      q.options[3] || '',
      q.options[4] || '',
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
    const isPgType =
      qType === 'Pilihan Ganda' || qType === 'Pilihan Ganda Kompleks';

    await db.questionBank.put({
      id: editingQuestionId || createId('qb'),
      academicYearId: activeYear.id,
      gradeLevel: qGrade,
      subject: teacher?.subjects[0] || 'Umum',
      semester: qSem,
      tpId: qTpId,
      material:
        qMaterial.trim() || tps.find((t) => t.id === qTpId)?.material || 'Umum',
      indicator: qIndicator.trim(),
      questionType: qType,
      cognitiveLevel: qCog,
      difficulty: qDiff,
      questionText: qText.trim(),
      options: isPgType
        ? qOpts.slice(0, qPgOptionCount).filter((o) => o.trim() !== '')
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
    notify(
      wasEditing ? 'Butir soal diperbarui.' : 'Butir soal ditambahkan ke Bank Soal.'
    );
  };

  const handleGenerateQuestionsAi = async () => {
    const tp = tps.find((t) => t.id === qTpId);
    if (!tp || !school || !teacher || !activeYear) {
      notify('Pilih Tujuan Pembelajaran (TP) untuk membuat soal AI.', 'warning');
      return;
    }
    const linkedCp = cpMap.get(tp.cpId);
    const linkedMod =
      moduleMap.get(qModuleId) ??
      modules.find((m) => m.tpIds.includes(tp.id));

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
        cp: linkedCp,
        moduleContext: linkedMod,
        material: qMaterial || tp.material,
        questionType: qType,
        difficulty: qDiff,
        count: Math.max(1, Math.min(20, Number(qAiCount) || 5)),
        pgOptionCount: qPgOptionCount,
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

  // ======================== AI ASSESSMENT PACK BUILDER ========================
  const selectedPackModule = useMemo(
    () => modules.find((m) => m.id === packModuleId),
    [modules, packModuleId]
  );

  const selectedPackTps = useMemo(
    () => tps.filter((t) => packTpIds.includes(t.id)),
    [tps, packTpIds]
  );

  const selectedPackCps = useMemo(() => {
    const ids = new Set(
      selectedPackTps.map((t) => t.cpId).filter((id) => Boolean(id))
    );
    if (selectedPackModule?.cpId) ids.add(selectedPackModule.cpId);
    return cps.filter((c) => ids.has(c.id));
  }, [cps, selectedPackTps, selectedPackModule]);

  const linkedPackLkpd = useMemo(() => {
    if (selectedPackModule) {
      const byMod = lkpds.find((l) => l.moduleId === selectedPackModule.id);
      if (byMod) return byMod;
    }
    if (packTpIds.length > 0) {
      return lkpds.find((l) => packTpIds.includes(l.tpId));
    }
    return undefined;
  }, [lkpds, selectedPackModule, packTpIds]);

  const totalRequestedPackCount = useMemo(
    () =>
      ALL_QUESTION_TYPES.reduce(
        (sum, type) => sum + (Number(packTypeCounts[type]) || 0),
        0
      ),
    [packTypeCounts]
  );

  const handleSelectPackModule = (modId: string) => {
    setPackModuleId(modId);
    const mod = modules.find((m) => m.id === modId);
    if (!mod) return;
    setPackSemester(mod.semester);
    if (mod.classId && classes.some((c) => c.id === mod.classId)) {
      setPackClassId(mod.classId);
    }
    if (mod.tpIds.length > 0) {
      setPackTpIds(mod.tpIds);
    }
    if (!packName.trim()) {
      setPackName(`${packCategory} - ${mod.material}`);
    }
  };

  const handleGenerateAssessmentPackAi = async () => {
    if (!activeYear || !school || !teacher) {
      notify('Identitas sekolah & guru belum siap.', 'warning');
      return;
    }
    if (selectedPackTps.length === 0 && !selectedPackModule) {
      notify(
        'Pilih minimal satu Tujuan Pembelajaran (TP) atau Modul Ajar agar asesmen terhubung dengan perencanaan & perangkat.',
        'warning'
      );
      return;
    }
    const specs = ALL_QUESTION_TYPES.map((type) => ({
      type,
      count: Math.max(0, Number(packTypeCounts[type]) || 0),
    })).filter((s) => s.count > 0);

    if (specs.length === 0) {
      notify('Pilih minimal satu bentuk soal dengan jumlah > 0.', 'warning');
      return;
    }

    const cls = classes.find((c) => c.id === packClassId);
    const gradeLevel =
      cls?.gradeLevel ||
      selectedPackModule?.gradeLevel ||
      selectedPackTps[0]?.gradeLevel ||
      qGrade;
    const subject =
      cls?.subject ||
      selectedPackModule?.subject ||
      teacher.subjects[0] ||
      'Umum';
    const finalName =
      packName.trim() ||
      `${packCategory} ${selectedPackModule?.material || selectedPackTps[0]?.material || subject}`;

    setPackLoading(true);
    try {
      const draft = await generateFullAssessmentPackAi({
        ctx: {
          school,
          teacher,
          academicYearName: activeYear.name,
          semester: packSemester,
        },
        assessmentName: finalName,
        category: packCategory,
        subject,
        gradeLevel,
        semester: packSemester,
        cpList: selectedPackCps,
        tpList: selectedPackTps,
        linkedModule: selectedPackModule,
        linkedLkpd: linkedPackLkpd,
        questionSpecs: specs,
        pgOptionCount: packPgOptionCount,
        difficultyMode: packDifficultyMode,
        extraNotes: packNotes,
      });
      setPackDraft(draft);
      if (!packName.trim()) setPackName(finalName);
      notify(
        `Draft ${draft.questions.length} soal, kisi-kisi, kunci & rubrik siap ditinjau.`
      );
    } catch (err: unknown) {
      notify(
        err instanceof Error
          ? err.message
          : 'Gagal membuat paket asesmen otomatis AI.',
        'error'
      );
    } finally {
      setPackLoading(false);
    }
  };

  const handleSaveAssessmentPack = async () => {
    if (!activeYear || !packDraft || packDraft.questions.length === 0) return;

    setPackSaving(true);
    try {
      const cls = classes.find((c) => c.id === packClassId);
      const gradeLevel =
        cls?.gradeLevel ||
        selectedPackModule?.gradeLevel ||
        selectedPackTps[0]?.gradeLevel ||
        qGrade;
      const subject =
        cls?.subject ||
        selectedPackModule?.subject ||
        teacher?.subjects[0] ||
        'Umum';
      const now = new Date().toISOString();

      const qbItems: QuestionBankItem[] = packDraft.questions.map((dq) => ({
        id: createId('qb'),
        academicYearId: activeYear.id,
        gradeLevel,
        subject,
        semester: packSemester,
        tpId: dq.tpId || selectedPackTps[0]?.id || '',
        material:
          dq.material ||
          selectedPackModule?.material ||
          selectedPackTps[0]?.material ||
          'Umum',
        indicator: dq.indicator,
        questionType: dq.questionType,
        cognitiveLevel: dq.cognitiveLevel,
        difficulty: dq.difficulty,
        questionText: dq.questionText,
        options: dq.options,
        correctAnswer: dq.correctAnswer,
        explanation: dq.explanation,
        maxScore: dq.maxScore,
        isAiDraft: true,
        createdAt: now,
      }));

      await db.questionBank.bulkPut(qbItems);

      const totalScore =
        qbItems.reduce((sum, q) => sum + q.maxScore, 0) || 100;

      const blueprint = qbItems.map((q, idx) => {
        const tp = tpMap.get(q.tpId);
        const cp = tp ? cpMap.get(tp.cpId) : selectedPackCps[0];
        return {
          number: idx + 1,
          cpText: cp ? `${cp.element}: ${cp.description}` : '-',
          tpCode: tp?.code || packDraft.questions[idx]?.tpCode || '-',
          material: q.material,
          indicator: q.indicator || '-',
          cognitiveLevel: q.cognitiveLevel,
          questionType: q.questionType,
          questionNumber: String(idx + 1),
          maxScore: q.maxScore,
        };
      });

      const finalName =
        packName.trim() ||
        `${packCategory} ${selectedPackModule?.material || selectedPackTps[0]?.material || subject}`;
      const newAsmtId = createId('asmt');
      const tpIdSet = Array.from(
        new Set([
          ...packTpIds,
          ...qbItems.map((q) => q.tpId).filter((id) => Boolean(id)),
        ])
      );

      await db.assessments.put({
        id: newAsmtId,
        academicYearId: activeYear.id,
        name: finalName,
        category: packCategory,
        classId: packClassId,
        gradeLevel,
        semester: packSemester,
        subject,
        tpIds: tpIdSet,
        material:
          selectedPackModule?.material ||
          Array.from(new Set(qbItems.map((q) => q.material))).join(', ') ||
          '-',
        date: packDate,
        weight: 100,
        maxScore: totalScore,
        questionIds: qbItems.map((q) => q.id),
        customQuestions: [],
        blueprint,
        scoringGuide: packDraft.scoringGuide,
        rubric: packDraft.rubric,
        remedialPlan: packDraft.remedialPlan,
        enrichmentPlan: packDraft.enrichmentPlan,
        updatedAt: now,
      });

      setPackDraft(null);
      setShowAiPackPanel(false);
      setSelectedAsmtId(newAsmtId);
      setTab(categoryToTab(packCategory));
      await refreshData();
      notify(
        `Paket "${finalName}" (${qbItems.length} soal, Kisi-Kisi, Kunci & Rubrik) berhasil disimpan & terhubung ke TP/Modul.`
      );
    } finally {
      setPackSaving(false);
    }
  };

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
    const totalScore = pickedQs.reduce((s, q) => s + q.maxScore, 0) || 100;

    const blueprint = pickedQs.map((q, idx) => {
      const tp = tpMap.get(q.tpId);
      const cp = tp ? cpMap.get(tp.cpId) : undefined;
      return {
        number: idx + 1,
        cpText: cp ? `${cp.element}: ${cp.description}` : '-',
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

  const openAiPackForCategory = (cat: AssessmentCategory) => {
    setPackCategory(cat);
    setShowAiPackPanel(true);
  };

  const renderAssessmentSection = (
    title: string,
    defaultCats: AssessmentCategory[]
  ) => {
    const list = assessments.filter((a) => defaultCats.includes(a.category));
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              {editingAssessmentId ? `Edit ${title}` : `Buat ${title}`}
            </h3>
            <AiActionButton
              onClick={() => openAiPackForCategory(defaultCats[0])}
              className="text-xs px-3 py-1.5"
            >
              Otomatis AI
            </AiActionButton>
          </div>
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
                  Bank soal masih kosong. Gunakan tombol "Otomatis AI" di atas untuk langsung membuat soal dan paket asesmen sekaligus.
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
              <SecondaryButton onClick={resetAssessmentForm}>Batal</SecondaryButton>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {list.length === 0 ? (
            <EmptyState
              title={`Belum Ada ${title}`}
              description="Buat soal otomatis dengan AI (pilih jenis soal, jumlah, serta opsi PG A-C/D/E yang terhubung ke CP, TP, Modul Ajar, dan LKPD) atau pilih soal manual dari Bank Soal."
              actionLabel={`Buat Paket ${title} Otomatis (AI)`}
              onAction={() => openAiPackForCategory(defaultCats[0])}
            />
          ) : (
            list.map((a) => {
              const linkedQ = a.questionIds
                .map((id) => questions.find((q) => q.id === id))
                .filter((q): q is QuestionBankItem => Boolean(q));
              const linkedTpCodes = a.tpIds
                .map((id) => tpMap.get(id)?.code)
                .filter(Boolean)
                .join(', ');
              const linkedModCount = modules.filter((m) =>
                m.tpIds.some((tpId) => a.tpIds.includes(tpId))
              ).length;

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
                        {linkedTpCodes ? ` · TP: ${linkedTpCodes}` : ''}
                        {linkedModCount > 0 ? ` · ${linkedModCount} Modul Terkait` : ''}
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

  const selectedBankTp = tpMap.get(qTpId);
  const selectedBankCp = selectedBankTp ? cpMap.get(selectedBankTp.cpId) : undefined;
  const matchingModulesForBankTp = selectedBankTp
    ? modules.filter((m) => m.tpIds.includes(selectedBankTp.id))
    : [];

  return (
    <div>
      <PageHeader
        title="Bank Soal & Asesmen"
        description="Kelola Bank Soal, Quiz, Asesmen Harian, Asesmen Sumatif, STS/PTS, SAS/PAS, serta generator paket asesmen otomatis AI yang terhubung dengan Perencanaan (CP/TP) dan Perangkat Pembelajaran (Modul Ajar/LKPD)."
        actions={
          <AiActionButton
            onClick={() => setShowAiPackPanel((prev) => !prev)}
          >
            {showAiPackPanel
              ? 'Tutup Generator Asesmen AI'
              : 'Buat Paket Asesmen Otomatis (AI)'}
            {showAiPackPanel ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </AiActionButton>
        }
      />

      {/* PANEL GENERATOR PAKET ASESMEN OTOMATIS AI */}
      {showAiPackPanel && (
        <div className="bg-gradient-to-br from-rose-50/70 via-white to-pink-50/60 border border-rose-200 rounded-xl overflow-hidden shadow-xs mb-6">
          <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-pink-600" />
          <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-rose-950">
                Generator Paket Asesmen Otomatis (AI Terpadu)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Pilih modul ajar / TP yang diujikan, bentuk & jumlah soal, serta jumlah opsi pilihan ganda (A-C, A-D, atau A-E). Hasil langsung menjadi Soal Bank Soal, Paket Asesmen, Kisi-Kisi, Kunci & Rubrik siap unduh.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-rose-900 font-medium">
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                Terhubung: {selectedPackCps.length} CP · {selectedPackTps.length} TP ·{' '}
                {selectedPackModule ? `Modul "${selectedPackModule.title}"` : 'Modul belum dipilih'} ·{' '}
                {linkedPackLkpd ? `LKPD "${linkedPackLkpd.title}"` : 'Tanpa LKPD'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField label="Nama Paket Asesmen">
              <input
                type="text"
                className={inputClass}
                value={packName}
                onChange={(e) => setPackName(e.target.value)}
                placeholder="Kosongkan untuk judul otomatis"
              />
            </FormField>
            <FormField label="Kategori Asesmen">
              <select
                className={inputClass}
                value={packCategory}
                onChange={(e) => setPackCategory(e.target.value as AssessmentCategory)}
              >
                {[
                  'Quiz',
                  'Asesmen Harian',
                  'Asesmen Sumatif Lingkup Materi',
                  'Asesmen Sumatif Akhir Semester',
                  'Asesmen Sumatif Akhir Tahun',
                  'STS/PTS',
                  'SAS/PAS',
                  'Praktik',
                  'Proyek',
                  'Ujian Lainnya',
                ].map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Kelas">
              <select
                className={inputClass}
                value={packClassId}
                onChange={(e) => setPackClassId(e.target.value)}
              >
                <option value="">Semua Kelas / Umum</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Semester">
                <select
                  className={inputClass}
                  value={packSemester}
                  onChange={(e) =>
                    setPackSemester(Number(e.target.value) as SemesterNumber)
                  }
                >
                  <option value={1}>Sem 1</option>
                  <option value={2}>Sem 2</option>
                </select>
              </FormField>
              <FormField label="Tanggal">
                <input
                  type="date"
                  className={inputClass}
                  value={packDate}
                  onChange={(e) => setPackDate(e.target.value)}
                />
              </FormField>
            </div>
          </div>

          {/* KETERHUBUNGAN MODUL AJAR & TP */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-white border border-teal-200/80 rounded-lg p-4">
            <div className="space-y-3">
              <FormField
                label="Ambil Konteks dari Modul Ajar / Perangkat Pembelajaran"
                hint="Memilih Modul Ajar otomatis menandai TP, CP, serta LKPD terkait agar soal konsisten dengan materi yang diajarkan."
              >
                <select
                  className={inputClass}
                  value={packModuleId}
                  onChange={(e) => handleSelectPackModule(e.target.value)}
                >
                  <option value="">-- Pilih Modul Ajar (Opsional) --</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} (Kls {m.gradeLevel} · {m.material})
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Jumlah Opsi Pilihan Ganda">
                  <select
                    className={inputClass}
                    value={packPgOptionCount}
                    onChange={(e) =>
                      setPackPgOptionCount(Number(e.target.value) as 3 | 4 | 5)
                    }
                  >
                    <option value={3}>3 Opsi (A, B, C)</option>
                    <option value={4}>4 Opsi (A, B, C, D)</option>
                    <option value={5}>5 Opsi (A, B, C, D, E)</option>
                  </select>
                </FormField>
                <FormField label="Sebaran Tingkat Kesulitan">
                  <select
                    className={inputClass}
                    value={packDifficultyMode}
                    onChange={(e) =>
                      setPackDifficultyMode(
                        e.target.value as 'Proporsional' | DifficultyLevel
                      )
                    }
                  >
                    <option value="Proporsional">Proporsional (Mudah-Sulit)</option>
                    <option value="Mudah">Dominan Mudah</option>
                    <option value="Sedang">Dominan Sedang</option>
                    <option value="Sulit">Dominan Sulit (HOTS)</option>
                  </select>
                </FormField>
              </div>
              <FormField label="Catatan / Fokus Tambahan (Opsional)">
                <input
                  type="text"
                  className={inputClass}
                  value={packNotes}
                  onChange={(e) => setPackNotes(e.target.value)}
                  placeholder="Contoh: Sertakan soal cerita kontekstual & stimulus tabel"
                />
              </FormField>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  Pilih Tujuan Pembelajaran (TP) yang Diujikan ({packTpIds.length} dipilih):
                </span>
                {tps.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPackTpIds(tps.map((t) => t.id))}
                      className="text-blue-800 hover:underline font-medium"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setPackTpIds([])}
                      className="text-slate-500 hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 max-h-52 overflow-y-auto border border-slate-200 rounded-lg p-2.5 space-y-2 bg-slate-50">
                {tps.length === 0 ? (
                  <div className="text-xs text-slate-500 p-2">
                    Belum ada TP di Perencanaan Pembelajaran. Buat CP/TP terlebih dahulu pada menu Perencanaan Pembelajaran.
                  </div>
                ) : (
                  tps.map((tp) => {
                    const cp = cpMap.get(tp.cpId);
                    const checked = packTpIds.includes(tp.id);
                    return (
                      <label
                        key={tp.id}
                        className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setPackTpIds((prev) =>
                              e.target.checked
                                ? [...prev, tp.id]
                                : prev.filter((id) => id !== tp.id)
                            )
                          }
                        />
                        <span>
                          <span className="font-mono font-semibold text-blue-900">
                            {tp.code}
                          </span>{' '}
                          · {tp.material}
                          {cp ? ` (${cp.element})` : ''} —{' '}
                          <span className="text-slate-500 line-clamp-1 inline">
                            {tp.objective}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* KOMPOSISI BENTUK & JUMLAH SOAL */}
          <div className="bg-white border border-teal-200/80 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-800">
                Pilih Jenis & Jumlah Soal yang Akan Dibuat AI
              </div>
              <div className="text-xs font-mono font-semibold text-teal-900">
                Total Soal: {totalRequestedPackCount} butir · PG {packPgOptionCount} opsi (
                {OPTION_LETTERS.slice(0, packPgOptionCount).join('-')})
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {ALL_QUESTION_TYPES.map((type) => {
                const count = packTypeCounts[type] || 0;
                const active = count > 0;
                return (
                  <div
                    key={type}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${
                      active
                        ? 'border-teal-400 bg-teal-50/50'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) =>
                          setPackTypeCounts((prev) => ({
                            ...prev,
                            [type]: e.target.checked
                              ? FALLBACK_ADD_COUNTS[type]
                              : 0,
                          }))
                        }
                      />
                      <span>{type}</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      aria-label={`Jumlah soal ${type}`}
                      className="w-16 px-2 py-1 text-xs font-mono text-right bg-white border border-slate-300 rounded-md"
                      value={count}
                      onChange={(e) =>
                        setPackTypeCounts((prev) => ({
                          ...prev,
                          [type]: Math.max(0, Math.min(40, Number(e.target.value) || 0)),
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <AiActionButton
                loading={packLoading}
                onClick={handleGenerateAssessmentPackAi}
              >
                Generate Paket Asesmen + Kisi-Kisi (AI)
              </AiActionButton>
            </div>
          </div>

          {/* PREVIEW HASIL GENERATOR PAKET ASESMEN */}
          {packDraft && (
            <div className="bg-white border border-teal-300 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Pratinjau Draft Paket Asesmen ({packDraft.questions.length} Soal)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Total Skor Maksimal:{' '}
                    <span className="font-mono font-semibold">
                      {packDraft.questions.reduce((s, q) => s + q.maxScore, 0)}
                    </span>{' '}
                    · Rubrik: {packDraft.rubric.length} kriteria · Anda dapat mengedit pertanyaan/kunci atau menghapus butir sebelum menyimpan.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SecondaryButton onClick={() => setPackDraft(null)}>
                    Batal
                  </SecondaryButton>
                  <PrimaryButton
                    loading={packSaving}
                    onClick={handleSaveAssessmentPack}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan ke Bank Soal & Paket Asesmen</span>
                  </PrimaryButton>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 pr-1">
                {packDraft.questions.map((dq, idx) => (
                  <div key={idx} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs font-medium text-blue-900">
                        Soal #{idx + 1} · {dq.questionType} · {dq.cognitiveLevel} ·{' '}
                        {dq.difficulty} · TP {dq.tpCode} · Skor {dq.maxScore}
                      </div>
                      <button
                        type="button"
                        title="Hapus soal dari draft"
                        onClick={() =>
                          setPackDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  questions: prev.questions.filter((_, i) => i !== idx),
                                }
                              : null
                          )
                        }
                        className="p-1 text-slate-400 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      className={`${inputClass} text-xs`}
                      value={dq.questionText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPackDraft((prev) => {
                          if (!prev) return null;
                          const next = [...prev.questions];
                          next[idx] = { ...next[idx], questionText: val };
                          return { ...prev, questions: next };
                        });
                      }}
                    />
                    {dq.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700 pl-1">
                        {dq.options.map((opt, oIdx) => (
                          <div key={oIdx}>
                            <span className="font-semibold">
                              {OPTION_LETTERS[oIdx] || String(oIdx + 1)}.
                            </span>{' '}
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="text-teal-900">
                        <span className="font-semibold">Indikator:</span> {dq.indicator}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700 shrink-0">
                          Kunci:
                        </span>
                        <input
                          type="text"
                          className={`${inputClass} text-xs py-1`}
                          value={dq.correctAnswer}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPackDraft((prev) => {
                              if (!prev) return null;
                              const next = [...prev.questions];
                              next[idx] = { ...next[idx], correctAnswer: val };
                              return { ...prev, questions: next };
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs text-slate-700 bg-slate-50/70 p-3 rounded-lg">
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Pedoman Penskoran
                  </span>
                  {packDraft.scoringGuide}
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Rencana Remedial
                  </span>
                  {packDraft.remedialPlan}
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Rencana Pengayaan
                  </span>
                  {packDraft.enrichmentPlan}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

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

            <FormField label="Modul Ajar Terkait (Opsional)">
              <select
                className={inputClass}
                value={qModuleId}
                onChange={(e) => handleSelectBankSoalModule(e.target.value)}
              >
                <option value="">-- Ambil Konteks dari Modul Ajar --</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.material})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="TP Terkait"
              hint={
                selectedBankTp
                  ? `Terhubung CP: ${selectedBankCp?.element || '-'} · ${matchingModulesForBankTp.length} Modul terkait`
                  : undefined
              }
            >
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
                  {ALL_QUESTION_TYPES.map((t) => (
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

            {(qType === 'Pilihan Ganda' || qType === 'Pilihan Ganda Kompleks') && (
              <FormField label="Jumlah Opsi Pilihan Ganda">
                <select
                  className={inputClass}
                  value={qPgOptionCount}
                  onChange={(e) =>
                    setQPgOptionCount(Number(e.target.value) as 3 | 4 | 5)
                  }
                >
                  <option value={3}>3 Opsi (A, B, C)</option>
                  <option value={4}>4 Opsi (A, B, C, D)</option>
                  <option value={5}>5 Opsi (A, B, C, D, E)</option>
                </select>
              </FormField>
            )}

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
                <div className="text-xs font-semibold text-slate-700">
                  Pilihan Jawaban ({qPgOptionCount} Opsi):
                </div>
                {OPTION_LETTERS.slice(0, qPgOptionCount).map((ltr, idx) => (
                  <input
                    key={ltr}
                    type="text"
                    className={`${inputClass} text-xs`}
                    placeholder={`Opsi ${ltr}`}
                    value={qOpts[idx] || ''}
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
                  <SecondaryButton onClick={resetQuestionForm}>Batal</SecondaryButton>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min={1}
                  max={20}
                  aria-label="Jumlah butir soal AI"
                  title="Jumlah soal AI yang dibuat"
                  className={`${inputClass} w-20 font-mono text-center`}
                  value={qAiCount}
                  onChange={(e) =>
                    setQAiCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                  }
                />
                <AiActionButton
                  loading={qAiLoading}
                  onClick={handleGenerateQuestionsAi}
                  className="flex-1"
                >
                  Generate {qAiCount} Soal (AI)
                </AiActionButton>
              </div>
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
                    {d.options.length > 0 && (
                      <div className="text-slate-600 mt-1 space-y-0.5">
                        {d.options.map((opt, oIdx) => (
                          <div key={oIdx}>
                            {OPTION_LETTERS[oIdx] || oIdx + 1}. {opt}
                          </div>
                        ))}
                      </div>
                    )}
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
                {ALL_QUESTION_TYPES.map((t) => (
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
                  description="Tambahkan butir soal secara manual atau klik tombol Buat Paket Asesmen Otomatis (AI) untuk langsung menghasilkan soal terhubung CP, TP, dan Modul Ajar."
                  actionLabel="Buat Paket Asesmen Otomatis (AI)"
                  onAction={() => setShowAiPackPanel(true)}
                />
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {filteredQuestions.map((q, idx) => {
                  const tp = tpMap.get(q.tpId);
                  return (
                    <div key={q.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-blue-800">
                          #{idx + 1} · {q.questionType} · {q.cognitiveLevel} ·{' '}
                          {q.difficulty} · Skor {q.maxScore} · {q.material}
                          {tp ? ` · ${tp.code}` : ''}
                        </div>
                        <div className="text-sm text-slate-900">{q.questionText}</div>
                        {q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-slate-600 pt-1">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx}>
                                {OPTION_LETTERS[oIdx] || oIdx + 1}. {opt}
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
                  );
                })}
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
              description="Buat paket asesmen otomatis dengan AI atau pada tab Quiz/Harian, Sumatif, dan Ujian Semester untuk menampilkan Kisi-Kisi, Kunci Jawaban, dan Rubrik."
              actionLabel="Buat Paket Asesmen Otomatis (AI)"
              onAction={() => setShowAiPackPanel(true)}
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
