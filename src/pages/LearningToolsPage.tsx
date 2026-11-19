import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Edit3, Plus, Trash2, CheckCircle2 } from 'lucide-react';
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
  generateLkpdDraft,
  generateTeachingModuleDraft,
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
  TeachingModule,
} from '../types/domain';

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
  const [modules, setModules] = useState<TeachingModule[]>([]);
  const [lkpds, setLkpds] = useState<LKPDDocument[]>([]);
  const [mediaList, setMediaList] = useState<LearningMediaItem[]>([]);

  // Module Editor
  const [editingMod, setEditingMod] = useState<TeachingModule | null>(null);
  const [modAiLoading, setModAiLoading] = useState(false);

  // LKPD Editor
  const [editingLkpd, setEditingLkpd] = useState<LKPDDocument | null>(null);
  const [lkpdAiLoading, setLkpdAiLoading] = useState(false);

  // Media Editor
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaType, setMediaType] = useState<LearningMediaItem['type']>('Slide/Presentasi');
  const [mediaGrade, setMediaGrade] = useState('7');
  const [mediaDesc, setMediaDesc] = useState('');
  const [mediaGuide, setMediaGuide] = useState('');
  const [mediaSource, setMediaSource] = useState('');

  useEffect(() => {
    if (!activeYear) return;
    let cancelled = false;
    (async () => {
      const yId = activeYear.id;
      const [clsL, cpL, tpL, modL, lkpdL, medL] = await Promise.all([
        db.classGroups.where('academicYearId').equals(yId).toArray(),
        db.cps.where('academicYearId').equals(yId).toArray(),
        db.tps.where('academicYearId').equals(yId).toArray(),
        db.modules.where('academicYearId').equals(yId).toArray(),
        db.lkpds.where('academicYearId').equals(yId).toArray(),
        db.mediaItems.where('academicYearId').equals(yId).toArray(),
      ]);
      if (!cancelled) {
        setClasses(clsL);
        setCps(cpL);
        setTps(tpL);
        setModules(modL);
        setLkpds(lkpdL);
        setMediaList(medL);
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
    resources: 'Buku Paket Kemendikbudristek',
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
      const draft = await generateTeachingModuleDraft({
        ctx: {
          school,
          teacher,
          academicYearName: activeYear.name,
          semester: editingMod.semester,
        },
        tpList: selectedTps,
        cp,
        gradeLevel: editingMod.gradeLevel,
        semester: editingMod.semester,
        subject: editingMod.subject,
        material: editingMod.material || selectedTps[0].material,
        meetingsCount: editingMod.meetingsCount,
        hoursAllocation: editingMod.hoursAllocation,
        learningModel: editingMod.learningModel,
        studentCharacteristics: editingMod.studentCharacteristics,
        learningNeeds: editingMod.learningNeeds,
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

  return (
    <div>
      <PageHeader
        title="Perangkat Pembelajaran"
        description="Susun Modul Ajar / RPP lengkap 24 komponen, LKPD siap cetak, dan inventaris Media Pembelajaran yang terhubung ke CP dan TP."
      />

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
                  description="Buat Modul Ajar lengkap 24 komponen berdasarkan TP yang telah Anda susun."
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
                          {m.subject} · Kelas {m.gradeLevel} · Semester {m.semester} · {m.meetingsCount} Pertemuan ({m.hoursAllocation} JP)
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
            <FormField label="Nama Media" required>
              <input
                type="text"
                className={inputClass}
                value={mediaTitle}
                onChange={(e) => setMediaTitle(e.target.value)}
                placeholder="Contoh: Slide Interaktif Aljabar"
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
            <FormField label="Tautan / Lokasi Penyimpanan">
              <input
                type="text"
                className={inputClass}
                value={mediaSource}
                onChange={(e) => setMediaSource(e.target.value)}
                placeholder="URL atau nama folder lab/perpus"
              />
            </FormField>
            <PrimaryButton className="w-full" onClick={handleSaveMedia}>
              Simpan Media Pembelajaran
            </PrimaryButton>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
            {mediaList.length === 0 ? (
              <EmptyState
                title="Belum Ada Media Pembelajaran"
                description="Catat daftar media ajar, alat peraga, atau tautan sumber digital agar siap dilampirkan pada administrasi pembelajaran."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {mediaList.map((m) => (
                  <div key={m.id} className="py-3.5 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-medium text-blue-800">
                        {m.type} · Kelas {m.gradeLevel}
                      </div>
                      <div className="font-semibold text-slate-900 mt-0.5">{m.title}</div>
                      <p className="text-xs text-slate-600 mt-1">{m.description}</p>
                      {m.linkOrSource && (
                        <div className="text-xs text-slate-500 mt-1">
                          Sumber: {m.linkOrSource}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await db.mediaItems.delete(m.id);
                        await refreshData();
                        notify('Media dihapus.', 'info');
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
