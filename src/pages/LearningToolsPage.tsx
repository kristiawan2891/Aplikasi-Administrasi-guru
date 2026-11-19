import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Plus,
  Search,
  Trash2,
  Video,
  Wand2,
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
  findEducationalMediaSourcesAi,
  generateLearningToolsPackAi,
  generateLkpdDraft,
  generateTeachingModuleDraft,
  type LearningToolsPackDraft,
  type MediaSourceInput,
} from '../services/aiService';
import {
  downloadDocxBlob,
  generateLkpdDocx,
  generateTeachingModuleDocx,
} from '../services/docxGenerator';
import type {
  ClassGroup,
  LearningMediaItem,
  LearningObjectiveTP,
  LearningOutcomeCP,
  LKPDDocument,
  LKPDType,
  SemesterNumber,
  SyllabusItem,
  TeachingModule,
} from '../types/domain';

function isHttpUrl(val: string): boolean {
  return /^https?:\/\//i.test(val.trim());
}

function isImagePreviewable(val: string): boolean {
  const s = val.trim();
  if (s.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(s);
}

export const LearningToolsPage: React.FC = () => {
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

  const [tab, setTab] = useState<'modul' | 'lkpd' | 'media'>('modul');
  useEffect(() => {
    if (
      activeSubTab === 'modul' ||
      activeSubTab === 'lkpd' ||
      activeSubTab === 'media'
    ) {
      setTab(activeSubTab);
    }
  }, [activeSubTab]);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [cps, setCps] = useState<LearningOutcomeCP[]>([]);
  const [tps, setTps] = useState<LearningObjectiveTP[]>([]);
  const [syllabi, setSyllabi] = useState<SyllabusItem[]>([]);
  const [modules, setModules] = useState<TeachingModule[]>([]);
  const [lkpds, setLkpds] = useState<LKPDDocument[]>([]);
  const [mediaList, setMediaList] = useState<LearningMediaItem[]>([]);

  // Full Learning Tools Auto-Pack AI State
  const [packOpen, setPackOpen] = useState(false);
  const [packTpId, setPackTpId] = useState('');
  const [packModel, setPackModel] = useState('Problem Based Learning (PBL)');
  const [packLkpdType, setPackLkpdType] = useState<LKPDType>('Kelompok');
  const [packMeetings, setPackMeetings] = useState(2);
  const [packHours, setPackHours] = useState(4);
  const [mediaSources, setMediaSources] = useState<MediaSourceInput[]>([]);
  const [newSrcKind, setNewSrcKind] = useState<'Video' | 'Gambar' | 'Tautan'>('Video');
  const [newSrcTitle, setNewSrcTitle] = useState('');
  const [newSrcUrl, setNewSrcUrl] = useState('');
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [packAiLoading, setPackAiLoading] = useState(false);
  const [packDraft, setPackDraft] = useState<LearningToolsPackDraft | null>(null);

  // Module Editor
  const [editingMod, setEditingMod] = useState<TeachingModule | null>(null);
  const [modAiLoading, setModAiLoading] = useState(false);

  // LKPD Editor
  const [editingLkpd, setEditingLkpd] = useState<LKPDDocument | null>(null);
  const [lkpdAiLoading, setLkpdAiLoading] = useState(false);

  // Media Editor
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaType, setMediaType] =
    useState<LearningMediaItem['type']>('Slide/Presentasi');
  const [mediaGrade, setMediaGrade] = useState('7');
  const [mediaTpId, setMediaTpId] = useState('');
  const [mediaDesc, setMediaDesc] = useState('');
  const [mediaGuide, setMediaGuide] = useState('');
  const [mediaSource, setMediaSource] = useState('');
  const [mediaAiLoading, setMediaAiLoading] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activeYear) return;
    let cancelled = false;
    (async () => {
      const yId = activeYear.id;
      const [clsL, cpL, tpL, sylL, modL, lkpdL, medL] = await Promise.all([
        db.classGroups.where('academicYearId').equals(yId).toArray(),
        db.cps.where('academicYearId').equals(yId).toArray(),
        db.tps.where('academicYearId').equals(yId).toArray(),
        db.syllabi.where('academicYearId').equals(yId).toArray(),
        db.modules.where('academicYearId').equals(yId).toArray(),
        db.lkpds.where('academicYearId').equals(yId).toArray(),
        db.mediaItems.where('academicYearId').equals(yId).toArray(),
      ]);
      if (!cancelled) {
        const sortedTps = tpL.sort((a, b) => a.orderIndex - b.orderIndex);
        setClasses(clsL);
        setCps(cpL);
        setTps(sortedTps);
        setSyllabi(sylL);
        setModules(modL);
        setLkpds(lkpdL);
        setMediaList(medL);
        if (sortedTps.length > 0 && !packTpId) {
          setPackTpId(sortedTps[0].id);
          setPackHours(sortedTps[0].hoursAllocation || 4);
        }
        if (sortedTps.length > 0 && !mediaTpId) {
          setMediaTpId(sortedTps[0].id);
        }
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

  const selectedPackTp = tps.find((t) => t.id === packTpId) ?? tps[0] ?? null;
  const selectedPackCp = selectedPackTp
    ? cps.find((c) => c.id === selectedPackTp.cpId)
    : undefined;
  const selectedPackSyllabus = selectedPackTp
    ? syllabi.find((s) => s.tpId === selectedPackTp.id)
    : undefined;

  const handleAddMediaSource = () => {
    if (!newSrcTitle.trim() && !newSrcUrl.trim()) {
      notify('Isi judul atau tautan video/gambar terlebih dahulu.', 'error');
      return;
    }
    setMediaSources((prev) => [
      ...prev,
      {
        kind: newSrcKind,
        title: newSrcTitle.trim() || `${newSrcKind} Pembelajaran`,
        urlOrRef: newSrcUrl.trim(),
      },
    ]);
    setNewSrcTitle('');
    setNewSrcUrl('');
  };

  const handleUploadImageSource = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 1_200_000) {
      notify('Ukuran gambar maksimal 1.2 MB agar tetap ringan disimpan.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) return;
      setMediaSources((prev) => [
        ...prev,
        {
          kind: 'Gambar',
          title: newSrcTitle.trim() || file.name.replace(/\.[^.]+$/, ''),
          urlOrRef: dataUrl,
        },
      ]);
      setNewSrcTitle('');
      notify(`Gambar "${file.name}" ditambahkan ke daftar sumber paket.`);
    };
    reader.readAsDataURL(file);
  };

  const handleFindMediaSourcesAi = async (targetTp?: LearningObjectiveTP | null) => {
    const tp = targetTp ?? selectedPackTp;
    const subj =
      (tp ? cps.find((c) => c.id === tp.cpId)?.subject : undefined) ||
      teacher?.subjects[0] ||
      'Umum';
    const mat = tp?.material || mediaTitle || 'Materi Pembelajaran';
    const grade = tp?.gradeLevel || mediaGrade || '7';

    setSourceSearchLoading(true);
    try {
      const res = await findEducationalMediaSourcesAi({
        subject: subj,
        gradeLevel: grade,
        material: mat,
        objectives: tp?.objective,
      });
      if (res.sources.length === 0) {
        notify('AI tidak menemukan tautan baru; Anda dapat menambahkannya manual.', 'info');
        return;
      }
      setMediaSources((prev) => [...prev, ...res.sources]);
      notify(`${res.sources.length} sumber video/gambar relevan ditemukan dan siap disisipkan.`);
    } catch (err: unknown) {
      notify(
        err instanceof Error ? err.message : 'Gagal mencari sumber video/gambar.',
        'error'
      );
    } finally {
      setSourceSearchLoading(false);
    }
  };

  const handleGenerateToolsPack = async () => {
    if (!school || !teacher || !activeYear || !selectedPackTp) {
      notify(
        'Pilih Tujuan Pembelajaran (TP) dari Perencanaan terlebih dahulu.',
        'warning'
      );
      return;
    }
    setPackAiLoading(true);
    try {
      const subj =
        selectedPackCp?.subject ||
        classes[0]?.subject ||
        teacher.subjects[0] ||
        'Matematika';

      const draft = await generateLearningToolsPackAi({
        ctx: {
          school,
          teacher,
          academicYearName: activeYear.name,
          semester: selectedPackTp.semester,
        },
        tpList: [selectedPackTp],
        cp: selectedPackCp,
        syllabusItem: selectedPackSyllabus,
        gradeLevel: selectedPackTp.gradeLevel,
        semester: selectedPackTp.semester,
        subject: subj,
        material: selectedPackTp.material,
        meetingsCount: packMeetings,
        hoursAllocation: packHours,
        learningModel: packModel,
        lkpdType: packLkpdType,
        mediaSources,
      });
      setPackDraft(draft);
      notify(
        'Paket Modul Ajar, LKPD, dan Media Pembelajaran berhasil disusun AI. Periksa lalu simpan.'
      );
    } catch (err: unknown) {
      notify(
        err instanceof Error ? err.message : 'Gagal menyusun paket perangkat AI.',
        'error'
      );
    } finally {
      setPackAiLoading(false);
    }
  };

  const handleSaveToolsPack = async () => {
    if (!activeYear || !packDraft || !selectedPackTp) return;
    const now = new Date().toISOString();
    const subj =
      selectedPackCp?.subject ||
      classes[0]?.subject ||
      teacher?.subjects[0] ||
      'Matematika';
    const targetCls = classes.find(
      (c) => c.gradeLevel === selectedPackTp.gradeLevel
    );

    const modId = createId('mod');
    const lkpdId = createId('lkpd');

    const newModule: TeachingModule = {
      id: modId,
      academicYearId: activeYear.id,
      title: packDraft.module.title || `Modul Ajar ${selectedPackTp.material}`,
      classId: targetCls?.id || classes[0]?.id || '',
      gradeLevel: selectedPackTp.gradeLevel,
      semester: selectedPackTp.semester,
      subject: subj,
      cpId: selectedPackTp.cpId,
      tpIds: [selectedPackTp.id],
      material: selectedPackTp.material,
      meetingsCount: packMeetings,
      hoursAllocation: packHours,
      learningModel: packModel,
      methods: packDraft.module.methods || 'Diskusi, Tanya Jawab',
      media: packDraft.module.media || 'LKPD, Slide, Video',
      resources: packDraft.module.resources || 'Buku Paket & Sumber Digital',
      studentCharacteristics: 'Peserta didik reguler dengan gaya belajar beragam',
      learningNeeds: 'Diferensiasi konten, proses, dan produk',
      moduleIdentity: packDraft.module.moduleIdentity || '',
      generalInfo: packDraft.module.generalInfo || '',
      initialCompetency: packDraft.module.initialCompetency || '',
      pancasilaProfile: packDraft.module.pancasilaProfile || '',
      facilities: packDraft.module.facilities || '',
      targetStudents: packDraft.module.targetStudents || '',
      meaningfulUnderstanding: packDraft.module.meaningfulUnderstanding || '',
      triggerQuestions: packDraft.module.triggerQuestions || '',
      openingActivity: packDraft.module.openingActivity || '',
      coreActivity: packDraft.module.coreActivity || '',
      closingActivity: packDraft.module.closingActivity || '',
      diagnosticAssessment: packDraft.module.diagnosticAssessment || '',
      formativeAssessment: packDraft.module.formativeAssessment || '',
      summativeAssessment: packDraft.module.summativeAssessment || '',
      rubric: packDraft.module.rubric || '',
      enrichment: packDraft.module.enrichment || '',
      remedial: packDraft.module.remedial || '',
      teacherReflection: packDraft.module.teacherReflection || '',
      studentReflection: packDraft.module.studentReflection || '',
      attachment: packDraft.module.attachment || '',
      isAiDraft: true,
      updatedAt: now,
    };

    const newLkpd: LKPDDocument = {
      id: lkpdId,
      academicYearId: activeYear.id,
      title: packDraft.lkpd.title || `LKPD ${selectedPackTp.material}`,
      type: packLkpdType,
      classId: targetCls?.id || classes[0]?.id || '',
      gradeLevel: selectedPackTp.gradeLevel,
      subject: subj,
      cpId: selectedPackTp.cpId,
      tpId: selectedPackTp.id,
      moduleId: modId,
      material: selectedPackTp.material,
      date: now.slice(0, 10),
      activityGoal: packDraft.lkpd.activityGoal,
      instructions: packDraft.lkpd.instructions,
      toolsAndMaterials: packDraft.lkpd.toolsAndMaterials,
      materialSummary: packDraft.lkpd.materialSummary,
      workSteps: packDraft.lkpd.workSteps,
      activities: packDraft.lkpd.activities,
      questions: packDraft.lkpd.questions,
      tasks: packDraft.lkpd.tasks,
      observationTableHeaders: packDraft.lkpd.observationTableHeaders,
      observationTableRows: packDraft.lkpd.observationTableRows,
      resultNotes: '',
      conclusionPrompt: packDraft.lkpd.conclusionPrompt,
      reflectionPrompt: packDraft.lkpd.reflectionPrompt,
      rubric: packDraft.lkpd.rubric,
      isAiDraft: true,
      updatedAt: now,
    };

    const newMediaItems: LearningMediaItem[] = packDraft.mediaItems.map((m) => ({
      id: createId('med'),
      academicYearId: activeYear.id,
      title: m.title,
      type: m.type,
      subject: subj,
      gradeLevel: selectedPackTp.gradeLevel,
      tpId: selectedPackTp.id,
      moduleId: modId,
      description: m.description,
      usageGuide: m.usageGuide,
      linkOrSource: m.linkOrSource,
      updatedAt: now,
    }));

    await db.transaction('rw', [db.modules, db.lkpds, db.mediaItems], async () => {
      await db.modules.put(newModule);
      await db.lkpds.put(newLkpd);
      if (newMediaItems.length > 0) {
        await db.mediaItems.bulkPut(newMediaItems);
      }
    });

    setPackDraft(null);
    setPackOpen(false);
    await refreshData();
    notify(
      `Berhasil menyimpan 1 Modul Ajar, 1 LKPD, dan ${newMediaItems.length} Media Pembelajaran secara terhubung!`
    );
  };

  const createBlankModule = (): TeachingModule => ({
    id: createId('mod'),
    academicYearId: activeYear?.id || '',
    title: '',
    classId: classes[0]?.id || '',
    gradeLevel: classes[0]?.gradeLevel || tps[0]?.gradeLevel || '7',
    semester: activeYear?.activeSemester || 1,
    subject: classes[0]?.subject || teacher?.subjects[0] || 'Matematika',
    cpId: cps[0]?.id || '',
    tpIds: tps[0] ? [tps[0].id] : [],
    material: tps[0]?.material || '',
    meetingsCount: 2,
    hoursAllocation: 4,
    learningModel: 'Problem Based Learning (PBL)',
    methods: 'Diskusi, Tanya Jawab, Presentasi',
    media: 'LKPD, Papan Tulis, Proyektor',
    resources: 'Buku Paket Kemendikdasmen',
    studentCharacteristics: 'Peserta didik reguler dengan gaya belajar beragam',
    learningNeeds: 'Diferensiasi konten dan proses sesuai kesiapan belajar',
    moduleIdentity: '',
    generalInfo: '',
    initialCompetency: '',
    pancasilaProfile: 'Bernalar Kritis, Mandiri, Bergotong Royong',
    facilities: 'Ruang kelas, papan tulis, gawai/proyektor',
    targetStudents: 'Peserta didik reguler',
    meaningfulUnderstanding: '',
    triggerQuestions: '',
    openingActivity: '',
    coreActivity: '',
    closingActivity: '',
    diagnosticAssessment: '',
    formativeAssessment: '',
    summativeAssessment: '',
    rubric: '',
    enrichment: '',
    remedial: '',
    teacherReflection: '',
    studentReflection: '',
    attachment: '',
    updatedAt: new Date().toISOString(),
  });

  const handleGenerateModuleAi = async () => {
    if (!editingMod || !school || !teacher || !activeYear) return;
    const selectedTps = tps.filter((t) => editingMod.tpIds.includes(t.id));
    if (selectedTps.length === 0) {
      notify('Pilih minimal 1 Tujuan Pembelajaran (TP) terlebih dahulu.', 'warning');
      return;
    }
    setModAiLoading(true);
    try {
      const cp = cps.find((c) => c.id === editingMod.cpId);
      const syl = syllabi.find((s) => editingMod.tpIds.includes(s.tpId));
      const relatedMedia: MediaSourceInput[] = [
        ...mediaSources,
        ...mediaList
          .filter((m) => m.moduleId === editingMod.id || (m.tpId && editingMod.tpIds.includes(m.tpId)))
          .map((m) => ({
            kind: (m.type === 'Video' ? 'Video' : m.type === 'Lembar Gambar' ? 'Gambar' : 'Tautan') as MediaSourceInput['kind'],
            title: m.title,
            urlOrRef: m.linkOrSource,
          })),
      ];
      const draft = await generateTeachingModuleDraft({
        ctx: {
          school,
          teacher,
          academicYearName: activeYear.name,
          semester: editingMod.semester,
        },
        tpList: selectedTps,
        cp,
        syllabusItem: syl,
        gradeLevel: editingMod.gradeLevel,
        semester: editingMod.semester,
        subject: editingMod.subject,
        material: editingMod.material || selectedTps[0].material,
        meetingsCount: editingMod.meetingsCount,
        hoursAllocation: editingMod.hoursAllocation,
        learningModel: editingMod.learningModel,
        studentCharacteristics: editingMod.studentCharacteristics,
        learningNeeds: editingMod.learningNeeds,
        mediaSources: relatedMedia,
      });
      setEditingMod({
        ...editingMod,
        ...draft,
        isAiDraft: true,
      });
      notify('Draft Modul Ajar AI selesai disusun. Silakan periksa & edit sebelum klik Simpan.');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Gagal membuat Modul Ajar AI.', 'error');
    } finally {
      setModAiLoading(false);
    }
  };

  const handleSaveModule = async () => {
    if (!editingMod || !editingMod.title.trim()) {
      notify('Judul Modul Ajar wajib diisi.', 'error');
      return;
    }
    await db.modules.put({
      ...editingMod,
      updatedAt: new Date().toISOString(),
    });
    setEditingMod(null);
    await refreshData();
    notify('Modul Ajar / RPP berhasil disimpan.');
  };

  const createBlankLkpd = (): LKPDDocument => ({
    id: createId('lkpd'),
    academicYearId: activeYear?.id || '',
    title: '',
    type: 'Kelompok',
    classId: classes[0]?.id || '',
    gradeLevel: classes[0]?.gradeLevel || tps[0]?.gradeLevel || '7',
    subject: classes[0]?.subject || teacher?.subjects[0] || 'Matematika',
    cpId: cps[0]?.id || '',
    tpId: tps[0]?.id || '',
    material: tps[0]?.material || '',
    date: new Date().toISOString().slice(0, 10),
    activityGoal: '',
    instructions: '',
    toolsAndMaterials: '',
    materialSummary: '',
    workSteps: '',
    activities: '',
    questions: '',
    tasks: '',
    observationTableHeaders: ['No', 'Aspek Pengamatan', 'Hasil Pengamatan', 'Keterangan'],
    observationTableRows: [
      ['1', '', '', ''],
      ['2', '', '', ''],
    ],
    resultNotes: '',
    conclusionPrompt: '',
    reflectionPrompt: '',
    rubric: '',
    updatedAt: new Date().toISOString(),
  });

  const handleGenerateLkpdAi = async () => {
    if (!editingLkpd || !school || !teacher || !activeYear) return;
    const tp = tps.find((t) => t.id === editingLkpd.tpId);
    if (!tp) {
      notify('Pilih Tujuan Pembelajaran (TP) terlebih dahulu.', 'warning');
      return;
    }
    setLkpdAiLoading(true);
    try {
      const relatedMedia: MediaSourceInput[] = [
        ...mediaSources,
        ...mediaList
          .filter(
            (m) =>
              (editingLkpd.moduleId && m.moduleId === editingLkpd.moduleId) ||
              m.tpId === tp.id
          )
          .map((m) => ({
            kind: (m.type === 'Video' ? 'Video' : m.type === 'Lembar Gambar' ? 'Gambar' : 'Tautan') as MediaSourceInput['kind'],
            title: m.title,
            urlOrRef: m.linkOrSource,
          })),
      ];
      const draft = await generateLkpdDraft({
        ctx: {
          school,
          teacher,
          academicYearName: activeYear.name,
          semester: activeYear.activeSemester,
        },
        type: editingLkpd.type,
        gradeLevel: editingLkpd.gradeLevel,
        subject: editingLkpd.subject,
        tp,
        material: editingLkpd.material || tp.material,
        mediaSources: relatedMedia,
      });
      setEditingLkpd({
        ...editingLkpd,
        ...draft,
        isAiDraft: true,
      });
      notify('Draft LKPD AI siap ditinjau dan disimpan.');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Gagal membuat draft LKPD.', 'error');
    } finally {
      setLkpdAiLoading(false);
    }
  };

  const handleSaveLkpd = async () => {
    if (!editingLkpd || !editingLkpd.title.trim()) {
      notify('Judul LKPD wajib diisi.', 'error');
      return;
    }
    await db.lkpds.put({
      ...editingLkpd,
      updatedAt: new Date().toISOString(),
    });
    setEditingLkpd(null);
    await refreshData();
    notify('LKPD berhasil disimpan.');
  };

  const handleSaveMedia = async () => {
    if (!activeYear || !mediaTitle.trim()) {
      notify('Judul media pembelajaran wajib diisi.', 'error');
      return;
    }
    await db.mediaItems.put({
      id: createId('med'),
      academicYearId: activeYear.id,
      title: mediaTitle.trim(),
      type: mediaType,
      subject: teacher?.subjects[0] || 'Umum',
      gradeLevel: mediaGrade,
      tpId: mediaTpId || undefined,
      description: mediaDesc.trim(),
      usageGuide: mediaGuide.trim(),
      linkOrSource: mediaSource.trim(),
      updatedAt: new Date().toISOString(),
    });
    setMediaTitle('');
    setMediaDesc('');
    setMediaGuide('');
    setMediaSource('');
    await refreshData();
    notify('Media pembelajaran ditambahkan.');
  };

  const handleAutoCreateMediaFromAi = async () => {
    if (!activeYear) return;
    const tp = tps.find((t) => t.id === mediaTpId) ?? tps[0];
    if (!tp) {
      notify('Buat Tujuan Pembelajaran (TP) terlebih dahulu atau isi nama media manual.', 'warning');
      return;
    }
    setMediaAiLoading(true);
    try {
      const subj =
        cps.find((c) => c.id === tp.cpId)?.subject ||
        teacher?.subjects[0] ||
        'Umum';
      const found = await findEducationalMediaSourcesAi({
        subject: subj,
        gradeLevel: tp.gradeLevel,
        material: tp.material,
        objectives: tp.objective,
      });
      const now = new Date().toISOString();
      const created: LearningMediaItem[] = found.sources.map((src) => ({
        id: createId('med'),
        academicYearId: activeYear.id,
        title: src.title,
        type:
          src.kind === 'Video'
            ? 'Video'
            : src.kind === 'Gambar'
              ? 'Lembar Gambar'
              : 'Simulasi/Digital',
        subject: subj,
        gradeLevel: tp.gradeLevel,
        tpId: tp.id,
        description: `Sumber ${src.kind.toLowerCase()} pembelajaran untuk materi ${tp.material}.`,
        usageGuide: `Gunakan pada kegiatan eksplorasi konsep ${tp.code}.`,
        linkOrSource: src.urlOrRef,
        updatedAt: now,
      }));
      if (created.length === 0) {
        notify('Tidak ada tautan video/gambar otomatis yang ditemukan. Anda dapat mengisi manual.', 'info');
        return;
      }
      await db.mediaItems.bulkPut(created);
      await refreshData();
      notify(`${created.length} media pembelajaran (Video/Gambar/Tautan) otomatis disimpan.`);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Gagal membuat media AI.', 'error');
    } finally {
      setMediaAiLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Perangkat Pembelajaran"
        description="Susun Modul Ajar / RPP 24 komponen, LKPD, dan Media Pembelajaran secara otomatis dari AI dengan integrasi sumber Video & Gambar."
        actions={
          <SecondaryButton onClick={() => setPackOpen((prev) => !prev)}>
            <Wand2 className="w-4 h-4 text-teal-700" />
            <span>
              {packOpen
                ? 'Tutup Generator Paket AI'
                : 'Buat Otomatis Modul → Media (AI)'}
            </span>
          </SecondaryButton>
        }
      />

      {/* GENERATOR PAKET PERANGKAT PEMBELAJARAN OTOMATIS (MODUL AJAR + LKPD + MEDIA + VIDEO/GAMBAR) */}
      {(packOpen || (modules.length === 0 && tps.length > 0)) && (
        <div className="mb-6 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/60 border border-amber-200 rounded-xl overflow-hidden shadow-xs">
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-amber-950">
                Generator Paket Perangkat Pembelajaran Otomatis (Modul Ajar + LKPD + Media)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Terhubung langsung ke Perencanaan (CP, TP, Silabus). Tambahkan atau cari tautan Video/Gambar agar otomatis masuk ke Modul Ajar, LKPD, dan Media Pembelajaran.
              </p>
            </div>
            {modules.length > 0 && (
              <button
                type="button"
                onClick={() => setPackOpen(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Sembunyikan
              </button>
            )}
          </div>

          {tps.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              Belum ada Tujuan Pembelajaran (TP) pada Tahun Ajaran ini. Silakan buat CP & TP terlebih dahulu di menu <strong>Perencanaan</strong> agar perangkat pembelajaran otomatis terhubung.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <FormField label="Pilih TP / Materi dari Perencanaan" required>
                    <select
                      className={inputClass}
                      value={packTpId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPackTpId(val);
                        const tp = tps.find((t) => t.id === val);
                        if (tp) setPackHours(tp.hoursAllocation || 4);
                      }}
                    >
                      {tps.map((tp) => (
                        <option key={tp.id} value={tp.id}>
                          {tp.code} (Kls {tp.gradeLevel} S{tp.semester}) · {tp.material}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <FormField label="Model Pembelajaran">
                  <select
                    className={inputClass}
                    value={packModel}
                    onChange={(e) => setPackModel(e.target.value)}
                  >
                    <option value="Problem Based Learning (PBL)">Problem Based Learning (PBL)</option>
                    <option value="Project Based Learning (PjBL)">Project Based Learning (PjBL)</option>
                    <option value="Discovery Learning">Discovery Learning</option>
                    <option value="Inquiry Learning">Inquiry Learning</option>
                    <option value="Contextual Teaching and Learning (CTL)">Contextual Teaching & Learning</option>
                  </select>
                </FormField>
                <div className="grid grid-cols-3 gap-2">
                  <FormField label="Jenis LKPD">
                    <select
                      className={inputClass}
                      value={packLkpdType}
                      onChange={(e) => setPackLkpdType(e.target.value as LKPDType)}
                    >
                      {['Kelompok', 'Individu', 'Proyek', 'Praktik', 'Literasi', 'Pemecahan Masalah'].map(
                        (t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        )
                      )}
                    </select>
                  </FormField>
                  <FormField label="Pert.">
                    <input
                      type="number"
                      min={1}
                      className={`${inputClass} font-mono`}
                      value={packMeetings}
                      onChange={(e) => setPackMeetings(Number(e.target.value) || 1)}
                    />
                  </FormField>
                  <FormField label="JP">
                    <input
                      type="number"
                      min={1}
                      className={`${inputClass} font-mono`}
                      value={packHours}
                      onChange={(e) => setPackHours(Number(e.target.value) || 2)}
                    />
                  </FormField>
                </div>
              </div>

              {selectedPackTp && (
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
                  <span className="font-semibold text-blue-900">Keterhubungan Perencanaan:</span>{' '}
                  {selectedPackCp ? `CP Elemen ${selectedPackCp.element} · ` : ''}
                  {selectedPackTp.code}: {selectedPackTp.objective}
                  {selectedPackSyllabus ? ` · Silabus: ${selectedPackSyllabus.method}` : ''}
                </div>
              )}

              {/* Sumber Video / Gambar */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      Sumber Video & Gambar (Otomatis Masuk ke Modul Ajar, LKPD & Media Pembelajaran)
                    </div>
                    <div className="text-xs text-slate-500">
                      Tempel tautan video YouTube / URL gambar, unggah gambar, atau cari otomatis via AI.
                    </div>
                  </div>
                  <AiActionButton
                    loading={sourceSearchLoading}
                    onClick={() => handleFindMediaSourcesAi(selectedPackTp)}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Carikan Video & Gambar Otomatis (AI)</span>
                  </AiActionButton>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-2">
                    <FormField label="Jenis">
                      <select
                        className={inputClass}
                        value={newSrcKind}
                        onChange={(e) =>
                          setNewSrcKind(e.target.value as 'Video' | 'Gambar' | 'Tautan')
                        }
                      >
                        <option value="Video">Video</option>
                        <option value="Gambar">Gambar</option>
                        <option value="Tautan">Tautan Web</option>
                      </select>
                    </FormField>
                  </div>
                  <div className="sm:col-span-4">
                    <FormField label="Judul Video / Gambar">
                      <input
                        type="text"
                        className={inputClass}
                        value={newSrcTitle}
                        onChange={(e) => setNewSrcTitle(e.target.value)}
                        placeholder="Contoh: Video Konsep Bilangan / Diagram Sel"
                      />
                    </FormField>
                  </div>
                  <div className="sm:col-span-4">
                    <FormField label="Tautan / URL Sumber">
                      <input
                        type="text"
                        className={inputClass}
                        value={newSrcUrl}
                        onChange={(e) => setNewSrcUrl(e.target.value)}
                        placeholder="https://youtube.com/... atau URL gambar"
                      />
                    </FormField>
                  </div>
                  <div className="sm:col-span-2 flex gap-1.5">
                    <SecondaryButton className="flex-1" onClick={handleAddMediaSource}>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </SecondaryButton>
                    <label
                      title="Unggah Gambar dari Perangkat"
                      className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer inline-flex items-center justify-center shrink-0"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadImageSource}
                      />
                    </label>
                  </div>
                </div>

                {mediaSources.length > 0 && (
                  <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-lg">
                    {mediaSources.map((src, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {src.kind === 'Video' ? (
                            <Video className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                          ) : src.kind === 'Gambar' ? (
                            <ImageIcon className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                          ) : (
                            <Link2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-800 shrink-0">
                            [{src.kind}]
                          </span>
                          <span className="font-medium text-slate-900 truncate">
                            {src.title}
                          </span>
                          <span className="text-slate-500 truncate font-mono">
                            {src.urlOrRef.startsWith('data:image/')
                              ? '(Gambar terunggah)'
                              : src.urlOrRef}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setMediaSources((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-slate-400 hover:text-red-700 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <AiActionButton loading={packAiLoading} onClick={handleGenerateToolsPack}>
                  Buat Otomatis Modul Ajar + LKPD + Media (AI)
                </AiActionButton>
              </div>

              {packDraft && (
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-teal-900">
                      Preview Paket Perangkat Pembelajaran Siap Simpan:
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <PrimaryButton onClick={handleSaveToolsPack}>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Simpan Modul + LKPD + {packDraft.mediaItems.length} Media</span>
                      </PrimaryButton>
                      <SecondaryButton onClick={() => setPackDraft(null)}>
                        Tutup
                      </SecondaryButton>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white border border-teal-200 rounded-lg p-3 space-y-1">
                      <div className="font-semibold text-blue-900">1. Modul Ajar (24 Komponen)</div>
                      <div className="font-medium text-slate-900">{packDraft.module.title}</div>
                      <div className="text-slate-600 line-clamp-3">{packDraft.module.coreActivity}</div>
                      <div className="text-teal-800 pt-1 line-clamp-2">
                        Media: {packDraft.module.media}
                      </div>
                    </div>
                    <div className="bg-white border border-teal-200 rounded-lg p-3 space-y-1">
                      <div className="font-semibold text-blue-900">2. LKPD ({packLkpdType})</div>
                      <div className="font-medium text-slate-900">{packDraft.lkpd.title}</div>
                      <div className="text-slate-600 line-clamp-3">{packDraft.lkpd.workSteps}</div>
                      <div className="text-teal-800 pt-1 line-clamp-2">
                        Alat & Sumber: {packDraft.lkpd.toolsAndMaterials}
                      </div>
                    </div>
                    <div className="bg-white border border-teal-200 rounded-lg p-3 space-y-1">
                      <div className="font-semibold text-blue-900">
                        3. Media Pembelajaran ({packDraft.mediaItems.length} item)
                      </div>
                      {packDraft.mediaItems.map((m, idx) => (
                        <div key={idx} className="text-slate-700 border-t border-slate-100 pt-1">
                          <span className="font-semibold">[{m.type}]</span> {m.title}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      )}

      <SegmentedTabs
        tabs={[
          { id: 'modul', label: 'Modul Ajar / RPP', count: modules.length },
          { id: 'lkpd', label: 'LKPD', count: lkpds.length },
          { id: 'media', label: 'Media Pembelajaran', count: mediaList.length },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {/* TAB 1: MODUL AJAR */}
      {tab === 'modul' && (
        <div>
          {!editingMod ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <PrimaryButton onClick={() => setEditingMod(createBlankModule())}>
                  <Plus className="w-4 h-4" />
                  <span>Buat Modul Ajar Baru</span>
                </PrimaryButton>
              </div>
              {modules.length === 0 ? (
                <EmptyState
                  title="Belum Ada Modul Ajar / RPP"
                  description="Gunakan Generator Paket Otomatis AI di atas atau buat Modul Ajar baru secara manual berdasarkan TP yang telah Anda susun."
                  actionLabel="Buat Modul Ajar Pertama"
                  onAction={() => setEditingMod(createBlankModule())}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modules.map((m) => (
                    <div
                      key={m.id}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="text-xs font-medium text-blue-800">
                          {m.subject} · Kelas {m.gradeLevel} · Semester {m.semester} ·{' '}
                          {m.meetingsCount} Pertemuan ({m.hoursAllocation} JP)
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-slate-900">
                          {m.title}
                        </h3>
                        <div className="mt-1 text-xs text-slate-600">
                          Materi: {m.material || '-'} · Model: {m.learningModel}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-1">
                          <SecondaryButton onClick={() => setEditingMod({ ...m })}>
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </SecondaryButton>
                          <button
                            type="button"
                            title="Gunakan sebagai template / duplikasi"
                            onClick={async () => {
                              await db.modules.put({
                                ...m,
                                id: createId('mod'),
                                title: `${m.title} (Salinan)`,
                                updatedAt: new Date().toISOString(),
                              });
                              await refreshData();
                              notify('Modul diduplikasi sebagai template.');
                            }}
                            className="p-2 text-slate-500 hover:text-blue-800 rounded-lg border border-slate-200"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await confirm({
                                title: `Hapus ${m.title}?`,
                                message: 'Modul ajar ini akan dihapus.',
                                confirmLabel: 'Hapus',
                                danger: true,
                              });
                              if (!ok) return;
                              await db.modules.delete(m.id);
                              await refreshData();
                              notify('Modul ajar dihapus.', 'info');
                            }}
                            className="p-2 text-slate-500 hover:text-red-700 rounded-lg border border-slate-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {identityBundle && (
                          <DocxButton
                            onClick={async () => {
                              const cp = cps.find((c) => c.id === m.cpId);
                              const relTps = tps.filter((t) => m.tpIds.includes(t.id));
                              const blob = await generateTeachingModuleDocx(
                                identityBundle,
                                m,
                                relTps,
                                cp
                              );
                              await downloadDocxBlob(blob, `Modul_Ajar_${m.title}.docx`);
                              notify('Modul Ajar DOCX diunduh.');
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Editor Modul Ajar / RPP (24 Komponen)
                  </h3>
                  {editingMod.isAiDraft && (
                    <p className="text-xs text-teal-700 font-medium mt-0.5">
                      Draft dihasilkan AI — silakan sesuaikan sebelum klik Simpan Modul.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AiActionButton
                    loading={modAiLoading}
                    onClick={handleGenerateModuleAi}
                  >
                    Susun Isi Modul dengan AI
                  </AiActionButton>
                  <SecondaryButton onClick={() => setEditingMod(null)}>
                    Kembali
                  </SecondaryButton>
                  <PrimaryButton onClick={handleSaveModule}>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Setujui & Simpan Modul</span>
                  </PrimaryButton>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <FormField label="Judul Modul Ajar" required>
                    <input
                      type="text"
                      className={inputClass}
                      value={editingMod.title}
                      onChange={(e) =>
                        setEditingMod({ ...editingMod, title: e.target.value })
                      }
                      placeholder="Contoh: Modul Ajar Aljabar Linear Kelas 7"
                    />
                  </FormField>
                </div>
                <FormField label="Mata Pelajaran">
                  <input
                    type="text"
                    className={inputClass}
                    value={editingMod.subject}
                    onChange={(e) =>
                      setEditingMod({ ...editingMod, subject: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Kelas">
                  <input
                    type="text"
                    className={inputClass}
                    value={editingMod.gradeLevel}
                    onChange={(e) =>
                      setEditingMod({ ...editingMod, gradeLevel: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Semester">
                  <select
                    className={inputClass}
                    value={editingMod.semester}
                    onChange={(e) =>
                      setEditingMod({
                        ...editingMod,
                        semester: Number(e.target.value) as SemesterNumber,
                      })
                    }
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </FormField>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Pertemuan">
                    <input
                      type="number"
                      className={`${inputClass} font-mono`}
                      value={editingMod.meetingsCount}
                      onChange={(e) =>
                        setEditingMod({
                          ...editingMod,
                          meetingsCount: Number(e.target.value) || 1,
                        })
                      }
                    />
                  </FormField>
                  <FormField label="Total JP">
                    <input
                      type="number"
                      className={`${inputClass} font-mono`}
                      value={editingMod.hoursAllocation}
                      onChange={(e) =>
                        setEditingMod({
                          ...editingMod,
                          hoursAllocation: Number(e.target.value) || 2,
                        })
                      }
                    />
                  </FormField>
                </div>
                <FormField label="Materi Pokok">
                  <input
                    type="text"
                    className={inputClass}
                    value={editingMod.material}
                    onChange={(e) =>
                      setEditingMod({ ...editingMod, material: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Model Pembelajaran">
                  <input
                    type="text"
                    className={inputClass}
                    value={editingMod.learningModel}
                    onChange={(e) =>
                      setEditingMod({
                        ...editingMod,
                        learningModel: e.target.value,
                      })
                    }
                  />
                </FormField>
                <FormField label="CP Terkait">
                  <select
                    className={inputClass}
                    value={editingMod.cpId}
                    onChange={(e) =>
                      setEditingMod({ ...editingMod, cpId: e.target.value })
                    }
                  >
                    <option value="">-- Pilih CP --</option>
                    {cps.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.subject} · {c.element}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* TP Checkboxes */}
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">
                  Pilih Tujuan Pembelajaran (TP) yang Dicakup:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  {tps.map((tp) => {
                    const checked = editingMod.tpIds.includes(tp.id);
                    return (
                      <label
                        key={tp.id}
                        className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextIds = e.target.checked
                              ? [...editingMod.tpIds, tp.id]
                              : editingMod.tpIds.filter((x) => x !== tp.id);
                            setEditingMod({ ...editingMod, tpIds: nextIds });
                          }}
                        />
                        <span>
                          <span className="font-mono font-semibold text-blue-900">
                            {tp.code}
                          </span>{' '}
                          · {tp.objective}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 24-section fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                {(
                  [
                    ['moduleIdentity', '1. Identitas Modul'],
                    ['generalInfo', '2. Informasi Umum'],
                    ['initialCompetency', '3. Kompetensi Awal'],
                    ['pancasilaProfile', '4. Profil Pelajar / Karakter'],
                    ['facilities', '5. Sarana & Prasarana'],
                    ['targetStudents', '6. Target Peserta Didik'],
                    ['methods', '7. Metode Pembelajaran'],
                    ['media', '8. Media Pembelajaran'],
                    ['resources', '9. Sumber Belajar'],
                    ['meaningfulUnderstanding', '10. Pemahaman Bermakna'],
                    ['triggerQuestions', '11. Pertanyaan Pemantik'],
                    ['openingActivity', '12. Kegiatan Pendahuluan'],
                    ['coreActivity', '13. Kegiatan Inti'],
                    ['closingActivity', '14. Kegiatan Penutup'],
                    ['diagnosticAssessment', '15. Asesmen Diagnostik'],
                    ['formativeAssessment', '16. Asesmen Formatif'],
                    ['summativeAssessment', '17. Asesmen Sumatif'],
                    ['rubric', '18. Rubrik Penilaian'],
                    ['enrichment', '19. Pengayaan'],
                    ['remedial', '20. Remedial'],
                    ['teacherReflection', '21. Refleksi Guru'],
                    ['studentReflection', '22. Refleksi Siswa'],
                    ['attachment', '23. Lampiran'],
                  ] as Array<[keyof TeachingModule, string]>
                ).map(([key, label]) => (
                  <FormField key={key} label={label}>
                    <textarea
                      rows={key === 'coreActivity' ? 4 : 2}
                      className={inputClass}
                      value={String(editingMod[key] ?? '')}
                      onChange={(e) =>
                        setEditingMod({ ...editingMod, [key]: e.target.value })
                      }
                    />
                  </FormField>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LKPD */}
      {tab === 'lkpd' && (
        <div>
          {!editingLkpd ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <PrimaryButton onClick={() => setEditingLkpd(createBlankLkpd())}>
                  <Plus className="w-4 h-4" />
                  <span>Buat LKPD Baru</span>
                </PrimaryButton>
              </div>
              {lkpds.length === 0 ? (
                <EmptyState
                  title="Belum Ada LKPD"
                  description="Susun Lembar Kerja Peserta Didik (Individu, Kelompok, Proyek, Praktik, Literasi, Pemecahan Masalah) yang terhubung ke TP."
                  actionLabel="Buat LKPD Pertama"
                  onAction={() => setEditingLkpd(createBlankLkpd())}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lkpds.map((l) => (
                    <div
                      key={l.id}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="text-xs font-medium text-blue-800">
                          LKPD {l.type} · {l.subject} · Kelas {l.gradeLevel}
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-slate-900">
                          {l.title}
                        </h3>
                        <div className="mt-1 text-xs text-slate-600">
                          Materi: {l.material || '-'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-1">
                          <SecondaryButton onClick={() => setEditingLkpd({ ...l })}>
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </SecondaryButton>
                          <button
                            type="button"
                            onClick={async () => {
                              await db.lkpds.delete(l.id);
                              await refreshData();
                              notify('LKPD dihapus.', 'info');
                            }}
                            className="p-2 text-slate-500 hover:text-red-700 rounded-lg border border-slate-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {identityBundle && (
                          <DocxButton
                            onClick={async () => {
                              const tp = tps.find((t) => t.id === l.tpId);
                              const blob = await generateLkpdDocx(identityBundle, l, tp);
                              await downloadDocxBlob(blob, `LKPD_${l.title}.docx`);
                              notify('Dokumen LKPD DOCX diunduh.');
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">
                  Editor Lembar Kerja Peserta Didik (LKPD)
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <AiActionButton
                    loading={lkpdAiLoading}
                    onClick={handleGenerateLkpdAi}
                  >
                    Susun Draft LKPD (AI)
                  </AiActionButton>
                  <SecondaryButton onClick={() => setEditingLkpd(null)}>
                    Kembali
                  </SecondaryButton>
                  <PrimaryButton onClick={handleSaveLkpd}>
                    Simpan LKPD
                  </PrimaryButton>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <FormField label="Judul LKPD" required>
                    <input
                      type="text"
                      className={inputClass}
                      value={editingLkpd.title}
                      onChange={(e) =>
                        setEditingLkpd({ ...editingLkpd, title: e.target.value })
                      }
                    />
                  </FormField>
                </div>
                <FormField label="Jenis LKPD">
                  <select
                    className={inputClass}
                    value={editingLkpd.type}
                    onChange={(e) =>
                      setEditingLkpd({
                        ...editingLkpd,
                        type: e.target.value as LKPDType,
                      })
                    }
                  >
                    {[
                      'Individu',
                      'Kelompok',
                      'Proyek',
                      'Praktik',
                      'Literasi',
                      'Pemecahan Masalah',
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Tujuan Pembelajaran (TP)">
                  <select
                    className={inputClass}
                    value={editingLkpd.tpId}
                    onChange={(e) => {
                      const tp = tps.find((t) => t.id === e.target.value);
                      setEditingLkpd({
                        ...editingLkpd,
                        tpId: e.target.value,
                        material: tp?.material || editingLkpd.material,
                      });
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
                <FormField label="Materi Pokok">
                  <input
                    type="text"
                    className={inputClass}
                    value={editingLkpd.material}
                    onChange={(e) =>
                      setEditingLkpd({ ...editingLkpd, material: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Kelas">
                  <input
                    type="text"
                    className={inputClass}
                    value={editingLkpd.gradeLevel}
                    onChange={(e) =>
                      setEditingLkpd({ ...editingLkpd, gradeLevel: e.target.value })
                    }
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    ['activityGoal', 'Tujuan Kegiatan'],
                    ['instructions', 'Petunjuk Belajar'],
                    ['toolsAndMaterials', 'Alat dan Bahan'],
                    ['materialSummary', 'Ringkasan Materi'],
                    ['workSteps', 'Langkah Kerja'],
                    ['activities', 'Aktivitas Siswa'],
                    ['questions', 'Pertanyaan Diskusi'],
                    ['tasks', 'Tugas'],
                    ['conclusionPrompt', 'Panduan Kesimpulan'],
                    ['reflectionPrompt', 'Refleksi Siswa'],
                    ['rubric', 'Rubrik Penilaian LKPD'],
                  ] as Array<[keyof LKPDDocument, string]>
                ).map(([key, label]) => (
                  <FormField key={key} label={label}>
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={String(editingLkpd[key] ?? '')}
                      onChange={(e) =>
                        setEditingLkpd({ ...editingLkpd, [key]: e.target.value })
                      }
                    />
                  </FormField>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MEDIA PEMBELAJARAN */}
      {tab === 'media' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Tambah Media Pembelajaran
            </h3>
            <FormField label="TP Terkait (Opsional)">
              <select
                className={inputClass}
                value={mediaTpId}
                onChange={(e) => setMediaTpId(e.target.value)}
              >
                <option value="">-- Umum / Semua TP --</option>
                {tps.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.code} · {tp.material}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Nama Media" required>
              <input
                type="text"
                className={inputClass}
                value={mediaTitle}
                onChange={(e) => setMediaTitle(e.target.value)}
                placeholder="Contoh: Slide Interaktif / Video Pembelajaran"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Jenis Media">
                <select
                  className={inputClass}
                  value={mediaType}
                  onChange={(e) =>
                    setMediaType(e.target.value as LearningMediaItem['type'])
                  }
                >
                  {[
                    'Slide/Presentasi',
                    'Video',
                    'Alat Peraga',
                    'Simulasi/Digital',
                    'Audio',
                    'Lembar Gambar',
                    'Lainnya',
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Kelas">
                <input
                  type="text"
                  className={inputClass}
                  value={mediaGrade}
                  onChange={(e) => setMediaGrade(e.target.value)}
                />
              </FormField>
            </div>
            <FormField label="Deskripsi Media">
              <textarea
                rows={2}
                className={inputClass}
                value={mediaDesc}
                onChange={(e) => setMediaDesc(e.target.value)}
              />
            </FormField>
            <FormField label="Panduan Penggunaan di Kelas">
              <textarea
                rows={2}
                className={inputClass}
                value={mediaGuide}
                onChange={(e) => setMediaGuide(e.target.value)}
              />
            </FormField>
            <FormField label="Tautan Video / Gambar / Lokasi Penyimpanan">
              <input
                type="text"
                className={inputClass}
                value={mediaSource}
                onChange={(e) => setMediaSource(e.target.value)}
                placeholder="URL YouTube, URL gambar, atau folder sekolah"
              />
            </FormField>
            <div className="flex flex-col gap-2">
              <PrimaryButton className="w-full" onClick={handleSaveMedia}>
                Simpan Media Pembelajaran
              </PrimaryButton>
              <AiActionButton
                loading={mediaAiLoading}
                onClick={handleAutoCreateMediaFromAi}
              >
                Cari & Tambahkan Video/Gambar AI
              </AiActionButton>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
            {mediaList.length === 0 ? (
              <EmptyState
                title="Belum Ada Media Pembelajaran"
                description="Catat daftar media ajar, alat peraga, video, atau gambar, atau klik 'Cari & Tambahkan Video/Gambar AI' untuk mengisi otomatis dari TP."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {mediaList.map((m) => {
                  const tp = tps.find((t) => t.id === m.tpId);
                  const showImg =
                    m.linkOrSource &&
                    isImagePreviewable(m.linkOrSource) &&
                    !failedImages[m.id];
                  return (
                    <div
                      key={m.id}
                      className="py-4 flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {showImg && (
                          <img
                            src={m.linkOrSource}
                            alt={m.title}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedImages((prev) => ({ ...prev, [m.id]: true }))
                            }
                            className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-blue-800">
                            {m.type} · Kelas {m.gradeLevel}
                            {tp ? ` · ${tp.code}` : ''}
                          </div>
                          <div className="font-semibold text-slate-900 mt-0.5">
                            {m.title}
                          </div>
                          {m.description && (
                            <p className="text-xs text-slate-600 mt-1">
                              {m.description}
                            </p>
                          )}
                          {m.usageGuide && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              Panduan: {m.usageGuide}
                            </p>
                          )}
                          {m.linkOrSource && (
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                              {isHttpUrl(m.linkOrSource) ? (
                                <a
                                  href={m.linkOrSource}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-teal-700 hover:underline inline-flex items-center gap-1 truncate max-w-md"
                                >
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{m.linkOrSource}</span>
                                </a>
                              ) : m.linkOrSource.startsWith('data:image/') ? (
                                <span>Gambar tersimpan di aplikasi</span>
                              ) : (
                                <span>Sumber: {m.linkOrSource}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await db.mediaItems.delete(m.id);
                          await refreshData();
                          notify('Media dihapus.', 'info');
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-700 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
