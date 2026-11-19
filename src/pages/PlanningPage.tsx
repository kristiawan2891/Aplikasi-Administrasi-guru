import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Edit3,
  Plus,
  Trash2,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { createAutoSnapshot, createId, db } from '../db/database';
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
  KEMENDIKDASMEN_CP_REGULATIONS,
  type CpAiDraftItem,
  generateCpDraft,
  generateTpDraftsFromCp,
} from '../services/aiService';
import { calculateEffectiveWeeks } from '../services/effectiveWeeks';
import {
  downloadDocxBlob,
  generateAtpDocx,
  generateCpTpDocx,
  generatePromesDocx,
  generateProtaDocx,
  generateSyllabusDocx,
} from '../services/docxGenerator';
import type {
  ATPDocument,
  CalendarConfig,
  CalendarEvent,
  DifficultyLevel,
  LearningObjectiveTP,
  LearningOutcomeCP,
  PromesItem,
  ProtaItem,
  SemesterNumber,
  SyllabusItem,
} from '../types/domain';

export const PlanningPage: React.FC = () => {
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

  const [tab, setTab] = useState<'cp' | 'tp' | 'atp' | 'prota' | 'promes' | 'silabus'>('cp');
  useEffect(() => {
    if (
      activeSubTab === 'cp' ||
      activeSubTab === 'tp' ||
      activeSubTab === 'atp' ||
      activeSubTab === 'prota' ||
      activeSubTab === 'promes' ||
      activeSubTab === 'silabus'
    ) {
      setTab(activeSubTab);
    }
  }, [activeSubTab]);

  const [cps, setCps] = useState<LearningOutcomeCP[]>([]);
  const [tps, setTps] = useState<LearningObjectiveTP[]>([]);
  const [atps, setAtps] = useState<ATPDocument[]>([]);
  const [protas, setProtas] = useState<ProtaItem[]>([]);
  const [promes, setPromes] = useState<PromesItem[]>([]);
  const [syllabi, setSyllabi] = useState<SyllabusItem[]>([]);
  const [calConfig, setCalConfig] = useState<CalendarConfig | null>(null);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);

  const defaultSubject = teacher?.subjects[0] || 'Matematika';

  // CP form
  const defaultCpReg = KEMENDIKDASMEN_CP_REGULATIONS[0];
  const [cpInputMode, setCpInputMode] = useState<'manual' | 'ai'>('manual');
  const [editingCpId, setEditingCpId] = useState<string | null>(null);
  const [cpSubject, setCpSubject] = useState(defaultSubject);
  const [cpPhase, setCpPhase] = useState('D');
  const [cpGrade, setCpGrade] = useState('7');
  const [cpElement, setCpElement] = useState('');
  const [cpDesc, setCpDesc] = useState('');
  const [cpRegPreset, setCpRegPreset] = useState<string>(defaultCpReg.id);
  const [cpRef, setCpRef] = useState<string>(defaultCpReg.label);
  const [cpAiScope, setCpAiScope] = useState<'all_elements' | 'single'>('all_elements');
  const [cpAiFocusNotes, setCpAiFocusNotes] = useState('');
  const [cpAiLoading, setCpAiLoading] = useState(false);
  const [cpAiDraft, setCpAiDraft] = useState<{
    items: CpAiDraftItem[];
    note: string;
  } | null>(null);

  // TP form
  const [editingTpId, setEditingTpId] = useState<string | null>(null);
  const [tpCpId, setTpCpId] = useState('');
  const [tpCode, setTpCode] = useState('TP.7.1');
  const [tpObj, setTpObj] = useState('');
  const [tpMaterial, setTpMaterial] = useState('');
  const [tpGrade, setTpGrade] = useState('7');
  const [tpSem, setTpSem] = useState<SemesterNumber>(1);
  const [tpHours, setTpHours] = useState(4);
  const [tpDiff, setTpDiff] = useState<DifficultyLevel>('Sedang');
  const [tpAiLoading, setTpAiLoading] = useState(false);
  const [tpAiDrafts, setTpAiDrafts] = useState<
    Array<{
      code: string;
      objective: string;
      material: string;
      hoursAllocation: number;
      difficulty: DifficultyLevel;
    }>
  >([]);

  // ATP builder state
  const [selectedAtpId, setSelectedAtpId] = useState<string>('');
  const [atpCpSelect, setAtpCpSelect] = useState<string>('');
  const [atpSemSelect, setAtpSemSelect] = useState<SemesterNumber>(1);
  const [atpAddTpId, setAtpAddTpId] = useState<string>('');

  // PROMES filter
  const [promesSem, setPromesSem] = useState<SemesterNumber>(1);

  useEffect(() => {
    if (!activeYear) return;
    let cancelled = false;
    (async () => {
      const yId = activeYear.id;
      const [cpL, tpL, atpL, protaL, promesL, sylL, cfg, evs] = await Promise.all([
        db.cps.where('academicYearId').equals(yId).toArray(),
        db.tps.where('academicYearId').equals(yId).toArray(),
        db.atps.where('academicYearId').equals(yId).toArray(),
        db.protas.where('academicYearId').equals(yId).toArray(),
        db.promes.where('academicYearId').equals(yId).toArray(),
        db.syllabi.where('academicYearId').equals(yId).toArray(),
        db.calendarConfigs.where('academicYearId').equals(yId).first(),
        db.calendarEvents.where('academicYearId').equals(yId).toArray(),
      ]);
      if (!cancelled) {
        setCps(cpL);
        setTps(tpL.sort((a, b) => a.orderIndex - b.orderIndex));
        setAtps(atpL);
        setProtas(protaL.sort((a, b) => a.orderIndex - b.orderIndex));
        setPromes(promesL);
        setSyllabi(sylL.sort((a, b) => a.orderIndex - b.orderIndex));
        setCalConfig(cfg ?? null);
        setCalEvents(evs);
        if (cpL.length > 0 && !tpCpId) setTpCpId(cpL[0].id);
        if (cpL.length > 0 && !atpCpSelect) setAtpCpSelect(cpL[0].id);
        if (atpL.length > 0 && !selectedAtpId) setSelectedAtpId(atpL[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeYear, dataVersion]);

  const effectiveSummary = useMemo(() => {
    if (!calConfig) return null;
    return calculateEffectiveWeeks(calConfig, calEvents);
  }, [calConfig, calEvents]);

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

  // ======================== CP HANDLERS ========================
  const handleSelectRegPreset = (presetId: string) => {
    setCpRegPreset(presetId);
    const found = KEMENDIKDASMEN_CP_REGULATIONS.find((r) => r.id === presetId);
    if (found && presetId !== 'custom') {
      setCpRef(found.label);
    } else if (presetId === 'custom') {
      const isPresetLabel = KEMENDIKDASMEN_CP_REGULATIONS.some(
        (r) => r.id !== 'custom' && r.label === cpRef
      );
      if (isPresetLabel) setCpRef('');
    }
  };

  const resetCpForm = () => {
    setEditingCpId(null);
    setCpElement('');
    setCpDesc('');
    setCpRegPreset(defaultCpReg.id);
    setCpRef(defaultCpReg.label);
    setCpAiDraft(null);
  };

  const handleSaveCp = async (isAi = false, verified = true) => {
    if (!activeYear || !cpElement.trim() || !cpDesc.trim()) {
      notify('Elemen dan deskripsi CP wajib diisi.', 'error');
      return;
    }
    const id = editingCpId || createId('cp');
    const existing = editingCpId ? cps.find((c) => c.id === editingCpId) : undefined;
    await db.cps.put({
      id,
      academicYearId: activeYear.id,
      subject: cpSubject.trim() || defaultSubject,
      phase: cpPhase,
      gradeLevel: cpGrade,
      element: cpElement.trim(),
      description: cpDesc.trim(),
      referenceSource: cpRef.trim(),
      isAiDraft: existing ? existing.isAiDraft : isAi,
      isVerified: verified,
      createdAt: existing?.createdAt || new Date().toISOString(),
    });
    resetCpForm();
    await refreshData();
    notify('Capaian Pembelajaran (CP) disimpan.');
  };

  const handleGenerateCpAi = async () => {
    if (!school || !teacher || !activeYear) return;
    if (cpAiScope === 'single' && !cpElement.trim()) {
      notify('Isi nama Elemen CP terlebih dahulu atau pilih mode Otomatis Elemen Utama.', 'error');
      return;
    }
    setCpAiLoading(true);
    try {
      const regText = cpRef.trim() || defaultCpReg.label;
      const draft = await generateCpDraft({
        ctx: {
          school,
          teacher,
          academicYearName: activeYear.name,
          semester: activeYear.activeSemester,
        },
        subject: cpSubject.trim() || defaultSubject,
        phase: cpPhase,
        gradeLevel: cpGrade,
        element: cpElement.trim() || 'Elemen Utama',
        regulation: regText,
        scope: cpAiScope,
        referenceNotes: cpAiFocusNotes.trim(),
      });
      if (draft.items.length === 0) {
        notify('AI tidak mengembalikan item CP. Silakan coba lagi.', 'error');
        return;
      }
      setCpAiDraft(draft);
      notify(`${draft.items.length} draft CP sesuai acuan Kemendikdasmen berhasil dibuat.`);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Gagal membuat draft CP.', 'error');
    } finally {
      setCpAiLoading(false);
    }
  };

  const handleSaveAiDraftItems = async (verified: boolean) => {
    if (!activeYear || !cpAiDraft || cpAiDraft.items.length === 0) return;
    const validItems = cpAiDraft.items.filter(
      (item) => item.element.trim() && item.description.trim()
    );
    if (validItems.length === 0) {
      notify('Pastikan elemen dan deskripsi CP tidak kosong.', 'error');
      return;
    }
    const now = new Date().toISOString();
    await db.cps.bulkPut(
      validItems.map((item) => ({
        id: createId('cp'),
        academicYearId: activeYear.id,
        subject: cpSubject.trim() || defaultSubject,
        phase: cpPhase,
        gradeLevel: cpGrade,
        element: item.element.trim(),
        description: item.description.trim(),
        referenceSource: item.referenceSource.trim() || cpRef.trim() || defaultCpReg.label,
        isAiDraft: true,
        isVerified: verified,
        createdAt: now,
      }))
    );
    setCpAiDraft(null);
    await refreshData();
    notify(
      verified
        ? `${validItems.length} CP hasil AI diverifikasi dan disimpan.`
        : `${validItems.length} draft CP disimpan untuk ditinjau kembali.`
    );
  };

  const handleVerifyCp = async (cp: LearningOutcomeCP) => {
    await db.cps.put({
      ...cp,
      isVerified: true,
    });
    await refreshData();
    notify(`CP elemen "${cp.element}" ditandai terverifikasi.`);
  };

  const handleDeleteCp = async (cp: LearningOutcomeCP) => {
    const ok = await confirm({
      title: 'Hapus Capaian Pembelajaran?',
      message: `CP elemen "${cp.element}" akan dihapus.`,
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    await db.cps.delete(cp.id);
    if (editingCpId === cp.id) resetCpForm();
    await refreshData();
    notify('CP dihapus.', 'info');
  };

  // ======================== TP HANDLERS ========================
  const handleSaveTp = async () => {
    if (!activeYear || !tpCpId || !tpObj.trim()) {
      notify('Pilih CP terkait dan isi rumusan Tujuan Pembelajaran.', 'error');
      return;
    }
    const relatedCp = cps.find((c) => c.id === tpCpId);
    const id = editingTpId || createId('tp');
    await db.tps.put({
      id,
      academicYearId: activeYear.id,
      cpId: tpCpId,
      code: tpCode.trim() || `TP.${tpGrade}.${tps.length + 1}`,
      element: relatedCp?.element || '-',
      objective: tpObj.trim(),
      material: tpMaterial.trim() || 'Materi Pokok',
      gradeLevel: tpGrade,
      semester: tpSem,
      hoursAllocation: Number(tpHours) || 2,
      difficulty: tpDiff,
      orderIndex: editingTpId
        ? tps.find((t) => t.id === editingTpId)?.orderIndex ?? tps.length + 1
        : tps.length + 1,
      createdAt: new Date().toISOString(),
    });
    setEditingTpId(null);
    setTpObj('');
    setTpMaterial('');
    setTpCode(`TP.${tpGrade}.${tps.length + 2}`);
    await refreshData();
    notify('Tujuan Pembelajaran (TP) disimpan.');
  };

  const handleGenerateTpAi = async () => {
    const cp = cps.find((c) => c.id === tpCpId);
    if (!cp || !school || !teacher || !activeYear) {
      notify('Pilih CP terlebih dahulu untuk membuat TP dengan AI.', 'error');
      return;
    }
    setTpAiLoading(true);
    try {
      const availHours =
        tpSem === 1
          ? effectiveSummary?.semester1.totalHoursAvailable ?? 36
          : effectiveSummary?.semester2.totalHoursAvailable ?? 36;
      const drafts = await generateTpDraftsFromCp({
        ctx: {
          school,
          teacher,
          academicYearName: activeYear.name,
          semester: tpSem,
        },
        cp,
        semester: tpSem,
        count: 4,
        totalHoursAvailable: availHours,
      });
      setTpAiDrafts(drafts);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Gagal membuat draft TP.', 'error');
    } finally {
      setTpAiLoading(false);
    }
  };

  const handleApproveTpDrafts = async () => {
    if (!activeYear || tpAiDrafts.length === 0) return;
    const cp = cps.find((c) => c.id === tpCpId);
    const now = new Date().toISOString();
    const baseIdx = tps.length;
    const newItems: LearningObjectiveTP[] = tpAiDrafts.map((d, idx) => ({
      id: createId('tp'),
      academicYearId: activeYear.id,
      cpId: tpCpId,
      code: d.code,
      element: cp?.element || '-',
      objective: d.objective,
      material: d.material,
      gradeLevel: cp?.gradeLevel || tpGrade,
      semester: tpSem,
      hoursAllocation: Number(d.hoursAllocation) || 4,
      difficulty: d.difficulty || 'Sedang',
      orderIndex: baseIdx + idx + 1,
      isAiDraft: true,
      createdAt: now,
    }));
    await db.tps.bulkPut(newItems);
    setTpAiDrafts([]);
    await refreshData();
    notify(`${newItems.length} Tujuan Pembelajaran disetujui & disimpan.`);
  };

  const handleDuplicateTp = async (tp: LearningObjectiveTP) => {
    await db.tps.put({
      ...tp,
      id: createId('tp'),
      code: `${tp.code}-Salin`,
      orderIndex: tps.length + 1,
      createdAt: new Date().toISOString(),
    });
    await refreshData();
    notify('TP diduplikasi.');
  };

  // ======================== ATP HANDLERS ========================
  const handleAutoBuildAtp = async () => {
    if (!activeYear) return;
    const cp = cps.find((c) => c.id === atpCpSelect);
    const matchingTps = tps.filter(
      (t) =>
        (!atpCpSelect || t.cpId === atpCpSelect) && t.semester === atpSemSelect
    );
    if (matchingTps.length === 0) {
      notify('Belum ada TP pada CP dan Semester yang dipilih.', 'warning');
      return;
    }

    const jpPerWeek = calConfig?.hoursPerWeek || 4;
    let currentWeek = 1;
    const items = matchingTps.map((tp, idx) => {
      const weeksNeeded = Math.max(1, Math.ceil(tp.hoursAllocation / jpPerWeek));
      const startW = currentWeek;
      const endW = currentWeek + weeksNeeded - 1;
      currentWeek = endW + 1;
      return {
        tpId: tp.id,
        orderIndex: idx + 1,
        plannedWeekStart: startW,
        plannedWeekEnd: endW,
        hoursAllocation: tp.hoursAllocation,
        notes: '',
      };
    });

    const id = createId('atp');
    await db.atps.put({
      id,
      academicYearId: activeYear.id,
      subject: cp?.subject || defaultSubject,
      gradeLevel: cp?.gradeLevel || tpGrade,
      phase: cp?.phase || 'D',
      semester: atpSemSelect,
      cpId: atpCpSelect,
      title: `ATP ${cp?.subject || defaultSubject} Kelas ${cp?.gradeLevel || tpGrade} Sem ${atpSemSelect}`,
      items,
      updatedAt: new Date().toISOString(),
    });
    setSelectedAtpId(id);
    await refreshData();
    notify('ATP berhasil disusun otomatis berdasarkan TP dan minggu efektif.');
  };

  const handleMoveAtpItem = async (atp: ATPDocument, index: number, dir: -1 | 1) => {
    const targetIdx = index + dir;
    if (targetIdx < 0 || targetIdx >= atp.items.length) return;
    const updated = [...atp.items];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    const reindexed = updated.map((it, i) => ({ ...it, orderIndex: i + 1 }));
    await db.atps.update(atp.id, {
      items: reindexed,
      updatedAt: new Date().toISOString(),
    });
    await refreshData();
  };

  const handleAddTpToAtp = async (atp: ATPDocument, tpId: string) => {
    if (!tpId) return;
    if (atp.items.some((it) => it.tpId === tpId)) {
      notify('TP tersebut sudah ada dalam ATP ini.', 'warning');
      return;
    }
    const tp = tps.find((t) => t.id === tpId);
    if (!tp) return;
    const jpPerWeek = calConfig?.hoursPerWeek || 4;
    const weeksNeeded = Math.max(1, Math.ceil(tp.hoursAllocation / jpPerWeek));
    const lastWeekEnd = atp.items.reduce(
      (max, it) => Math.max(max, it.plannedWeekEnd),
      0
    );
    const startW = lastWeekEnd + 1;
    const endW = startW + weeksNeeded - 1;
    await db.atps.update(atp.id, {
      items: [
        ...atp.items,
        {
          tpId: tp.id,
          orderIndex: atp.items.length + 1,
          plannedWeekStart: startW,
          plannedWeekEnd: endW,
          hoursAllocation: tp.hoursAllocation,
          notes: '',
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    setAtpAddTpId('');
    await refreshData();
    notify('TP ditambahkan ke ATP tanpa mengubah urutan yang sudah ada.');
  };

  // ======================== PROTA HANDLERS ========================
  const handleGenerateProta = async (replaceAll = false) => {
    if (!activeYear) return;
    if (tps.length === 0) {
      notify('Buat TP terlebih dahulu sebelum menyusun PROTA.', 'warning');
      return;
    }

    if (replaceAll && protas.length > 0) {
      const ok = await confirm({
        title: 'Susun Ulang Seluruh PROTA?',
        message:
          'Susun ulang akan menggantikan catatan dan jadwal minggu yang sudah Anda edit di PROTA. Snapshot pemulihan otomatis akan dibuat sebelum proses ini.',
        confirmLabel: 'Ya, Susun Ulang',
        danger: true,
      });
      if (!ok) return;
      await createAutoSnapshot('Sebelum susun ulang PROTA');
    }

    const existingTpIds = new Set(replaceAll ? [] : protas.map((p) => p.tpId));
    const missingTps = tps.filter((tp) => !existingTpIds.has(tp.id));

    if (!replaceAll && missingTps.length === 0) {
      notify(
        'Semua TP sudah masuk dalam PROTA. Perubahan Anda tetap aman.',
        'info'
      );
      return;
    }

    const jpPerWeek = calConfig?.hoursPerWeek || 4;
    let weekCursorS1 = 1;
    let weekCursorS2 = 1;
    if (!replaceAll) {
      for (const p of protas) {
        const weeks = Math.max(1, Math.ceil(p.hoursAllocation / jpPerWeek));
        if (p.semester === 1) weekCursorS1 += weeks;
        else weekCursorS2 += weeks;
      }
    }

    const baseOrder = replaceAll ? 0 : protas.length;
    const newProtas: ProtaItem[] = missingTps.map((tp, idx) => {
      const weeks = Math.max(1, Math.ceil(tp.hoursAllocation / jpPerWeek));
      const startW = tp.semester === 1 ? weekCursorS1 : weekCursorS2;
      const endW = startW + weeks - 1;
      if (tp.semester === 1) weekCursorS1 = endW + 1;
      else weekCursorS2 = endW + 1;

      const cp = cps.find((c) => c.id === tp.cpId);
      return {
        id: createId('prota'),
        academicYearId: activeYear.id,
        gradeLevel: tp.gradeLevel,
        subject: cp?.subject || defaultSubject,
        semester: tp.semester,
        cpId: tp.cpId,
        tpId: tp.id,
        material: tp.material,
        hoursAllocation: tp.hoursAllocation,
        plannedWeeks: `Minggu ${startW}–${endW}`,
        notes: '',
        orderIndex: baseOrder + idx + 1,
      };
    });

    await db.transaction('rw', db.protas, async () => {
      if (replaceAll) {
        await db.protas.where('academicYearId').equals(activeYear.id).delete();
      }
      await db.protas.bulkPut(newProtas);
    });
    await refreshData();
    notify(
      replaceAll
        ? `PROTA disusun ulang (${newProtas.length} baris).`
        : `${newProtas.length} TP baru ditambahkan ke PROTA tanpa menimpa baris lama.`
    );
  };

  const handleAddManualProta = async () => {
    if (!activeYear) return;
    const refTp = tps[0];
    await db.protas.put({
      id: createId('prota'),
      academicYearId: activeYear.id,
      gradeLevel: refTp?.gradeLevel || cpGrade || '7',
      subject: defaultSubject,
      semester: activeYear.activeSemester,
      cpId: refTp?.cpId || '',
      tpId: refTp?.id || '',
      material: 'Materi Tambahan',
      hoursAllocation: 2,
      plannedWeeks: 'Minggu 1',
      notes: '',
      orderIndex: protas.length + 1,
    });
    await refreshData();
    notify('Baris PROTA baru ditambahkan.');
  };

  // ======================== PROMES HANDLERS ========================
  const handleGeneratePromes = async (replaceAll = false) => {
    if (!activeYear) return;
    const semTps = tps.filter((t) => t.semester === promesSem);
    if (semTps.length === 0) {
      notify(`Belum ada TP untuk Semester ${promesSem}.`, 'warning');
      return;
    }

    const existingSem = promes.filter((p) => p.semester === promesSem);
    if (replaceAll && existingSem.length > 0) {
      const ok = await confirm({
        title: `Susun Ulang PROMES Semester ${promesSem}?`,
        message:
          'Seluruh baris PROMES semester ini akan disusun ulang dari awal. Snapshot pemulihan otomatis akan dibuat sebelumnya.',
        confirmLabel: 'Ya, Susun Ulang',
        danger: true,
      });
      if (!ok) return;
      await createAutoSnapshot(`Sebelum susun ulang PROMES Sem ${promesSem}`);
    }

    const existingTpIds = new Set(replaceAll ? [] : existingSem.map((p) => p.tpId));
    const missingTps = semTps.filter((tp) => !existingTpIds.has(tp.id));
    if (!replaceAll && missingTps.length === 0) {
      notify(
        `Semua TP Semester ${promesSem} sudah masuk di PROMES. Perubahan Anda tetap aman.`,
        'info'
      );
      return;
    }

    const months =
      promesSem === 1
        ? effectiveSummary?.semester1.months ?? []
        : effectiveSummary?.semester2.months ?? [];
    const fallbackMonths =
      promesSem === 1
        ? ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        : ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];

    const offset = replaceAll ? 0 : existingSem.length;
    const newPromes: PromesItem[] = missingTps.map((tp, idx) => {
      const absIdx = offset + idx;
      const mLabel =
        months[absIdx % (months.length || 1)]?.monthLabel ||
        fallbackMonths[absIdx % 6];
      const cp = cps.find((c) => c.id === tp.cpId);
      return {
        id: createId('promes'),
        academicYearId: activeYear.id,
        gradeLevel: tp.gradeLevel,
        subject: cp?.subject || defaultSubject,
        semester: promesSem,
        tpId: tp.id,
        material: tp.material,
        month: mLabel,
        weekNumber: (absIdx % 4) + 1,
        dateRange: '-',
        hoursAllocation: tp.hoursAllocation,
        activity: 'Pembelajaran Tatap Muka / Diskusi',
        assessment: 'Formatif',
        notes: '',
      };
    });

    await db.transaction('rw', db.promes, async () => {
      if (replaceAll) {
        await db.promes.bulkDelete(existingSem.map((e) => e.id));
      }
      await db.promes.bulkPut(newPromes);
    });
    await refreshData();
    notify(
      replaceAll
        ? `PROMES Semester ${promesSem} disusun ulang.`
        : `${newPromes.length} TP baru ditambahkan ke PROMES Semester ${promesSem}.`
    );
  };

  const handleAddManualPromes = async () => {
    if (!activeYear) return;
    const fallbackMonth = promesSem === 1 ? 'Juli' : 'Januari';
    await db.promes.put({
      id: createId('promes'),
      academicYearId: activeYear.id,
      gradeLevel: cpGrade || '7',
      subject: defaultSubject,
      semester: promesSem,
      tpId: tps.find((t) => t.semester === promesSem)?.id || '',
      material: 'Materi / Topik Baru',
      month: fallbackMonth,
      weekNumber: 1,
      dateRange: '-',
      hoursAllocation: 2,
      activity: 'Pembelajaran Tatap Muka',
      assessment: 'Formatif',
      notes: '',
    });
    await refreshData();
    notify('Baris PROMES ditambahkan.');
  };

  const handleShiftPromesWeek = async (item: PromesItem, delta: -1 | 1) => {
    const nextWeek = Math.max(1, Math.min(5, item.weekNumber + delta));
    await db.promes.update(item.id, { weekNumber: nextWeek });
    await refreshData();
  };

  // ======================== SILABUS HANDLERS ========================
  const handleGenerateSyllabus = async (replaceAll = false) => {
    if (!activeYear) return;
    if (tps.length === 0) {
      notify('Buat TP terlebih dahulu untuk menyusun Silabus.', 'warning');
      return;
    }

    if (replaceAll && syllabi.length > 0) {
      const ok = await confirm({
        title: 'Susun Ulang Seluruh Silabus?',
        message:
          'Susun ulang akan menggantikan editan kegiatan, metode, dan asesmen pada Silabus. Snapshot otomatis akan dibuat sebelumnya.',
        confirmLabel: 'Ya, Susun Ulang',
        danger: true,
      });
      if (!ok) return;
      await createAutoSnapshot('Sebelum susun ulang Silabus');
    }

    const existingTpIds = new Set(replaceAll ? [] : syllabi.map((s) => s.tpId));
    const missingTps = tps.filter((tp) => !existingTpIds.has(tp.id));
    if (!replaceAll && missingTps.length === 0) {
      notify('Semua TP sudah masuk dalam Silabus.', 'info');
      return;
    }

    const baseOrder = replaceAll ? 0 : syllabi.length;
    const items: SyllabusItem[] = missingTps.map((tp, idx) => {
      const cp = cps.find((c) => c.id === tp.cpId);
      return {
        id: createId('syl'),
        academicYearId: activeYear.id,
        subject: cp?.subject || defaultSubject,
        gradeLevel: tp.gradeLevel,
        phase: cp?.phase || 'D',
        semester: tp.semester,
        cpId: tp.cpId,
        tpId: tp.id,
        material: tp.material,
        learningActivities: `Mengamati, menanya, mengeksplorasi, dan mempresentasikan materi ${tp.material}.`,
        method: 'Diskusi, Tanya Jawab, Penugasan',
        media: 'LKPD, Papan Tulis, Slide Presentasi',
        resources: 'Buku Paket Kurikulum Merdeka & Modul Guru',
        assessment: 'Asesmen Formatif & Sumatif Lingkup Materi',
        hoursAllocation: tp.hoursAllocation,
        orderIndex: baseOrder + idx + 1,
      };
    });

    await db.transaction('rw', db.syllabi, async () => {
      if (replaceAll) {
        await db.syllabi.where('academicYearId').equals(activeYear.id).delete();
      }
      await db.syllabi.bulkPut(items);
    });
    await refreshData();
    notify(
      replaceAll
        ? `Silabus disusun ulang (${items.length} baris).`
        : `${items.length} TP baru ditambahkan ke Silabus tanpa menimpa baris lama.`
    );
  };

  const selectedAtp = atps.find((a) => a.id === selectedAtpId) ?? atps[0] ?? null;
  const semPromesList = promes.filter((p) => p.semester === promesSem);

  return (
    <div>
      <PageHeader
        title="Perencanaan Pembelajaran (Kurikulum Merdeka)"
        description="Alur terintegrasi dari CP → TP → ATP → PROTA → PROMES → Silabus yang mengacu langsung pada Minggu Efektif."
        actions={
          identityBundle && (cps.length > 0 || tps.length > 0) ? (
            <DocxButton
              label="Unduh CP & TP DOCX"
              onClick={async () => {
                const blob = await generateCpTpDocx(identityBundle, cps, tps);
                await downloadDocxBlob(blob, `CP_TP_${activeYear?.name || ''}.docx`);
                notify('Dokumen CP & TP DOCX diunduh.');
              }}
            />
          ) : null
        }
      />

      <SegmentedTabs
        tabs={[
          { id: 'cp', label: '1. Capaian (CP)', count: cps.length },
          { id: 'tp', label: '2. Tujuan (TP)', count: tps.length },
          { id: 'atp', label: '3. ATP', count: atps.length },
          { id: 'prota', label: '4. PROTA', count: protas.length },
          { id: 'promes', label: '5. PROMES', count: promes.length },
          { id: 'silabus', label: '6. Silabus', count: syllabi.length },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {/* TAB 1: CP */}
      {tab === 'cp' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {editingCpId ? 'Edit Capaian Pembelajaran' : 'Input Capaian Pembelajaran'}
              </h3>
              {editingCpId && (
                <button
                  type="button"
                  onClick={resetCpForm}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Batal Edit
                </button>
              )}
            </div>

            {/* Menu Pilih Cara Pengisian CP */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setCpInputMode('manual')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                  cpInputMode === 'manual'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Isi Manual</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCpId(null);
                  setCpInputMode('ai');
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                  cpInputMode === 'ai'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Buat dengan AI</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <FormField label="Mapel">
                <input
                  type="text"
                  className={inputClass}
                  value={cpSubject}
                  onChange={(e) => setCpSubject(e.target.value)}
                />
              </FormField>
              <FormField label="Fase">
                <select
                  className={inputClass}
                  value={cpPhase}
                  onChange={(e) => setCpPhase(e.target.value)}
                >
                  {['A', 'B', 'C', 'D', 'E', 'F'].map((f) => (
                    <option key={f} value={f}>
                      Fase {f}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Kelas">
                <input
                  type="text"
                  className={inputClass}
                  value={cpGrade}
                  onChange={(e) => setCpGrade(e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Acuan Peraturan Kemendikdasmen">
              <select
                className={inputClass}
                value={cpRegPreset}
                onChange={(e) => handleSelectRegPreset(e.target.value)}
              >
                {KEMENDIKDASMEN_CP_REGULATIONS.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.shortLabel}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label={
                cpRegPreset === 'custom'
                  ? 'Nomor / Judul Peraturan Kemendikdasmen'
                  : 'Referensi Dokumen Resmi (Dapat Diedit)'
              }
            >
              <input
                type="text"
                className={inputClass}
                value={cpRef}
                onChange={(e) => {
                  setCpRef(e.target.value);
                  const matched = KEMENDIKDASMEN_CP_REGULATIONS.find(
                    (r) => r.id !== 'custom' && r.label === e.target.value
                  );
                  setCpRegPreset(matched ? matched.id : 'custom');
                }}
                placeholder="Contoh: Keputusan Kepala BSKAP Kemendikdasmen No. 046/H/KR/2025"
              />
            </FormField>

            {cpInputMode === 'manual' ? (
              <>
                <FormField label="Elemen CP" required>
                  <input
                    type="text"
                    className={inputClass}
                    value={cpElement}
                    onChange={(e) => setCpElement(e.target.value)}
                    placeholder="Contoh: Bilangan / Aljabar / Pemahaman Konsep"
                  />
                </FormField>
                <FormField label="Deskripsi CP" required>
                  <textarea
                    rows={5}
                    className={inputClass}
                    value={cpDesc}
                    onChange={(e) => setCpDesc(e.target.value)}
                    placeholder="Salin atau tulis Capaian Pembelajaran sesuai peraturan Kemendikdasmen..."
                  />
                </FormField>
                <div className="flex flex-col gap-2 pt-1">
                  <PrimaryButton onClick={() => handleSaveCp(false, true)}>
                    {editingCpId ? 'Simpan Perubahan CP' : 'Simpan CP Manual'}
                  </PrimaryButton>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-lg text-xs text-teal-900 leading-relaxed">
                  AI menyusun draft CP sesuai struktur elemen, kompetensi, dan Dimensi Profil
                  Lulusan berdasarkan regulasi Kemendikdasmen yang dipilih.
                </div>

                <FormField label="Cakupan Pembuatan CP">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCpAiScope('all_elements')}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                        cpAiScope === 'all_elements'
                          ? 'bg-teal-50 border-teal-600 text-teal-900'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Otomatis Elemen Utama Mapel & Fase
                    </button>
                    <button
                      type="button"
                      onClick={() => setCpAiScope('single')}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                        cpAiScope === 'single'
                          ? 'bg-teal-50 border-teal-600 text-teal-900'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      1 Elemen Tertentu
                    </button>
                  </div>
                </FormField>

                {cpAiScope === 'single' && (
                  <FormField label="Nama Elemen CP yang Akan Dibuat" required>
                    <input
                      type="text"
                      className={inputClass}
                      value={cpElement}
                      onChange={(e) => setCpElement(e.target.value)}
                      placeholder="Contoh: Bilangan / Pemahaman IPA / Menyimak"
                    />
                  </FormField>
                )}

                <FormField label="Fokus Materi / Catatan Tambahan (Opsional)">
                  <textarea
                    rows={3}
                    className={inputClass}
                    value={cpAiFocusNotes}
                    onChange={(e) => setCpAiFocusNotes(e.target.value)}
                    placeholder="Contoh: Tekankan literasi numerasi, konteks lingkungan sekolah, atau salin potongan catatan BSKAP..."
                  />
                </FormField>

                <AiActionButton loading={cpAiLoading} onClick={handleGenerateCpAi}>
                  Buat Draft CP Sesuai Kemendikdasmen
                </AiActionButton>

                {cpAiDraft && (
                  <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg space-y-3 text-xs">
                    <div className="font-semibold text-teal-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Preview {cpAiDraft.items.length} Draft CP AI — Periksa Sebelum Simpan
                      </span>
                    </div>
                    <p className="text-teal-800 leading-relaxed">{cpAiDraft.note}</p>

                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {cpAiDraft.items.map((item, idx) => (
                        <div
                          key={`${idx}-${item.element}`}
                          className="bg-white border border-teal-200 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700 font-mono">
                              Elemen #{idx + 1}
                            </span>
                            {cpAiDraft.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setCpAiDraft({
                                    ...cpAiDraft,
                                    items: cpAiDraft.items.filter((_, i) => i !== idx),
                                  })
                                }
                                className="text-slate-400 hover:text-red-700"
                                title="Hapus item draft ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            className={inputClass}
                            value={item.element}
                            onChange={(e) => {
                              const next = [...cpAiDraft.items];
                              next[idx] = { ...next[idx], element: e.target.value };
                              setCpAiDraft({ ...cpAiDraft, items: next });
                            }}
                            placeholder="Nama Elemen CP"
                          />
                          <textarea
                            rows={4}
                            className={inputClass}
                            value={item.description}
                            onChange={(e) => {
                              const next = [...cpAiDraft.items];
                              next[idx] = { ...next[idx], description: e.target.value };
                              setCpAiDraft({ ...cpAiDraft, items: next });
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <PrimaryButton onClick={() => handleSaveAiDraftItems(true)}>
                        {cpAiDraft.items.length > 1
                          ? `Verifikasi & Simpan Semua (${cpAiDraft.items.length})`
                          : 'Verifikasi & Simpan CP'}
                      </PrimaryButton>
                      <SecondaryButton onClick={() => handleSaveAiDraftItems(false)}>
                        Simpan sebagai Draft
                      </SecondaryButton>
                      {cpAiDraft.items.length === 1 && (
                        <SecondaryButton
                          onClick={() => {
                            const only = cpAiDraft.items[0];
                            setCpElement(only.element);
                            setCpDesc(only.description);
                            setCpRef(only.referenceSource || cpRef);
                            setCpAiDraft(null);
                            setCpInputMode('manual');
                            notify('Draft dipindahkan ke mode Isi Manual untuk penyempurnaan.');
                          }}
                        >
                          Edit di Form Manual
                        </SecondaryButton>
                      )}
                      <SecondaryButton onClick={() => setCpAiDraft(null)}>
                        Tutup
                      </SecondaryButton>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="lg:col-span-2 space-y-3">
            {cps.length === 0 ? (
              <EmptyState
                title="Belum Ada Capaian Pembelajaran (CP)"
                description="Pilih menu Isi Manual untuk menyalin CP resmi, atau menu Buat dengan AI untuk menyusun CP sesuai peraturan Kemendikdasmen yang berlaku."
              />
            ) : (
              cps.map((cp) => (
                <div
                  key={cp.id}
                  className="bg-white border border-slate-200 rounded-xl p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-medium text-blue-800">
                        {cp.subject} · Fase {cp.phase} · Kelas {cp.gradeLevel} · Elemen:{' '}
                        {cp.element}
                        {cp.isAiDraft
                          ? cp.isVerified
                            ? ' · AI Terverifikasi'
                            : ' · Draft AI (Perlu Verifikasi)'
                          : ' · Input Manual'}
                      </div>
                      <p className="mt-2 text-sm text-slate-800 leading-relaxed">
                        {cp.description}
                      </p>
                      {cp.referenceSource && (
                        <div className="mt-2 text-xs text-slate-500">
                          Acuan: {cp.referenceSource}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {cp.isAiDraft && !cp.isVerified && (
                        <button
                          type="button"
                          onClick={() => handleVerifyCp(cp)}
                          title="Tandai CP Terverifikasi"
                          className="p-1.5 text-teal-700 hover:bg-teal-50 rounded-md"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCpId(cp.id);
                          setCpSubject(cp.subject);
                          setCpPhase(cp.phase);
                          setCpGrade(cp.gradeLevel);
                          setCpElement(cp.element);
                          setCpDesc(cp.description);
                          const refVal = cp.referenceSource || defaultCpReg.label;
                          setCpRef(refVal);
                          const matchedReg = KEMENDIKDASMEN_CP_REGULATIONS.find(
                            (r) => r.id !== 'custom' && r.label === refVal
                          );
                          setCpRegPreset(matchedReg ? matchedReg.id : 'custom');
                          setCpInputMode('manual');
                        }}
                        title="Edit CP"
                        className="p-1.5 text-slate-500 hover:text-blue-800"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCp(cp)}
                        title="Hapus CP"
                        className="p-1.5 text-slate-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TP */}
      {tab === 'tp' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              {editingTpId ? 'Edit Tujuan Pembelajaran' : 'Tambah Tujuan Pembelajaran'}
            </h3>
            <FormField label="CP Terkait" required>
              <select
                className={inputClass}
                value={tpCpId}
                onChange={(e) => setTpCpId(e.target.value)}
              >
                <option value="">-- Pilih CP --</option>
                {cps.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.subject} Kls {c.gradeLevel}] {c.element}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-3 gap-2">
              <FormField label="Kode TP">
                <input
                  type="text"
                  className={`${inputClass} font-mono`}
                  value={tpCode}
                  onChange={(e) => setTpCode(e.target.value)}
                />
              </FormField>
              <FormField label="Kelas">
                <input
                  type="text"
                  className={inputClass}
                  value={tpGrade}
                  onChange={(e) => setTpGrade(e.target.value)}
                />
              </FormField>
              <FormField label="Semester">
                <select
                  className={inputClass}
                  value={tpSem}
                  onChange={(e) => setTpSem(Number(e.target.value) as SemesterNumber)}
                >
                  <option value={1}>Sem 1</option>
                  <option value={2}>Sem 2</option>
                </select>
              </FormField>
            </div>
            <FormField label="Materi Pokok" required>
              <input
                type="text"
                className={inputClass}
                value={tpMaterial}
                onChange={(e) => setTpMaterial(e.target.value)}
                placeholder="Contoh: Bilangan Bulat & Pecahan"
              />
            </FormField>
            <FormField label="Rumusan Tujuan Pembelajaran" required>
              <textarea
                rows={3}
                className={inputClass}
                value={tpObj}
                onChange={(e) => setTpObj(e.target.value)}
                placeholder="Peserta didik mampu..."
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Alokasi (JP)">
                <input
                  type="number"
                  min={1}
                  className={`${inputClass} font-mono`}
                  value={tpHours}
                  onChange={(e) => setTpHours(Number(e.target.value))}
                />
              </FormField>
              <FormField label="Kesulitan">
                <select
                  className={inputClass}
                  value={tpDiff}
                  onChange={(e) => setTpDiff(e.target.value as DifficultyLevel)}
                >
                  <option value="Mudah">Mudah</option>
                  <option value="Sedang">Sedang</option>
                  <option value="Sulit">Sulit</option>
                </select>
              </FormField>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <PrimaryButton onClick={handleSaveTp}>
                {editingTpId ? 'Simpan Perubahan TP' : 'Simpan TP'}
              </PrimaryButton>
              <AiActionButton
                loading={tpAiLoading}
                onClick={handleGenerateTpAi}
                disabled={!tpCpId}
              >
                Rumuskan TP dari CP (AI)
              </AiActionButton>
            </div>

            {tpAiDrafts.length > 0 && (
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg space-y-3 text-xs">
                <div className="font-semibold text-teal-900">
                  Draft AI ({tpAiDrafts.length} TP) — Tinjau Sebelum Simpan:
                </div>
                {tpAiDrafts.map((d, idx) => (
                  <div key={idx} className="p-2.5 bg-white border border-teal-200 rounded">
                    <div className="font-mono font-semibold text-blue-900">
                      {d.code} · {d.material} ({d.hoursAllocation} JP)
                    </div>
                    <div className="mt-1 text-slate-700">{d.objective}</div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <PrimaryButton onClick={handleApproveTpDrafts}>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Setujui & Simpan Semua</span>
                  </PrimaryButton>
                  <SecondaryButton onClick={() => setTpAiDrafts([])}>
                    Batal
                  </SecondaryButton>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
            {tps.length === 0 ? (
              <EmptyState
                title="Belum Ada Tujuan Pembelajaran (TP)"
                description="Pilih CP dan rumuskan TP secara manual atau gunakan AI untuk menurunkan TP terukur sesuai alokasi jam semester."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2 pr-3">Kode</th>
                      <th className="py-2 pr-3">Kls/Sem</th>
                      <th className="py-2 pr-3">Materi & Tujuan Pembelajaran</th>
                      <th className="py-2 pr-3 text-right">JP</th>
                      <th className="py-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tps.map((tp) => (
                      <tr key={tp.id} className="hover:bg-slate-50">
                        <td className="py-3 pr-3 font-mono text-xs font-semibold text-blue-900 whitespace-nowrap">
                          {tp.code}
                        </td>
                        <td className="py-3 pr-3 font-mono text-xs whitespace-nowrap">
                          {tp.gradeLevel} / S{tp.semester}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="font-medium text-slate-900">{tp.material}</div>
                          <div className="text-xs text-slate-600 mt-0.5">{tp.objective}</div>
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums">
                          {tp.hoursAllocation}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            title="Duplikasi TP"
                            onClick={() => handleDuplicateTp(tp)}
                            className="p-1.5 text-slate-500 hover:text-blue-800"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Edit TP"
                            onClick={() => {
                              setEditingTpId(tp.id);
                              setTpCpId(tp.cpId);
                              setTpCode(tp.code);
                              setTpObj(tp.objective);
                              setTpMaterial(tp.material);
                              setTpGrade(tp.gradeLevel);
                              setTpSem(tp.semester);
                              setTpHours(tp.hoursAllocation);
                              setTpDiff(tp.difficulty);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-800"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Hapus TP"
                            onClick={async () => {
                              await db.tps.delete(tp.id);
                              await refreshData();
                              notify('TP dihapus.', 'info');
                            }}
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

      {/* TAB 3: ATP */}
      {tab === 'atp' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <FormField label="Pilih CP">
                <select
                  className={inputClass}
                  value={atpCpSelect}
                  onChange={(e) => setAtpCpSelect(e.target.value)}
                >
                  <option value="">Semua CP</option>
                  {cps.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.subject} · Kelas {c.gradeLevel} · {c.element}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="w-40">
              <FormField label="Semester">
                <select
                  className={inputClass}
                  value={atpSemSelect}
                  onChange={(e) => setAtpSemSelect(Number(e.target.value) as SemesterNumber)}
                >
                  <option value={1}>Semester 1</option>
                  <option value={2}>Semester 2</option>
                </select>
              </FormField>
            </div>
            <PrimaryButton onClick={handleAutoBuildAtp}>
              <Wand2 className="w-4 h-4" />
              <span>Susun ATP Otomatis</span>
            </PrimaryButton>
            {selectedAtp && identityBundle && (
              <DocxButton
                onClick={async () => {
                  const cp = cps.find((c) => c.id === selectedAtp.cpId);
                  const blob = await generateAtpDocx(identityBundle, selectedAtp, cp, tps);
                  await downloadDocxBlob(blob, `${selectedAtp.title}.docx`);
                  notify('Dokumen ATP DOCX diunduh.');
                }}
              />
            )}
          </div>

          {!selectedAtp ? (
            <EmptyState
              title="Belum Ada Dokumen ATP"
              description="Klik 'Susun ATP Otomatis' untuk mengurutkan Tujuan Pembelajaran beserta estimasi minggu efektif."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex-1 min-w-[220px]">
                  <input
                    type="text"
                    className={`${inputClass} font-semibold text-slate-900`}
                    defaultValue={selectedAtp.title}
                    key={selectedAtp.id}
                    onBlur={async (e) => {
                      const val = e.target.value.trim();
                      if (val && val !== selectedAtp.title) {
                        await db.atps.update(selectedAtp.id, {
                          title: val,
                          updatedAt: new Date().toISOString(),
                        });
                        await refreshData();
                      }
                    }}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Gunakan tombol naik/turun untuk mengatur urutan, atau sisipkan TP baru di bawah tanpa mengacak urutan yang sudah ada.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={`${inputClass} w-52 text-xs`}
                    value={atpAddTpId}
                    onChange={(e) => setAtpAddTpId(e.target.value)}
                  >
                    <option value="">-- Sisipkan TP ke ATP --</option>
                    {tps
                      .filter((t) => !selectedAtp.items.some((it) => it.tpId === t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} · {t.material}
                        </option>
                      ))}
                  </select>
                  <SecondaryButton
                    disabled={!atpAddTpId}
                    onClick={() => handleAddTpToAtp(selectedAtp, atpAddTpId)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah TP</span>
                  </SecondaryButton>
                  {atps.length > 1 && (
                    <select
                      className={`${inputClass} w-56`}
                      value={selectedAtp.id}
                      onChange={(e) => setSelectedAtpId(e.target.value)}
                    >
                      {atps.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2 pr-2">Urut</th>
                      <th className="py-2 pr-3">Kode TP</th>
                      <th className="py-2 pr-3">Materi & Tujuan Pembelajaran</th>
                      <th className="py-2 pr-3">Minggu Rencana</th>
                      <th className="py-2 pr-3 text-right">Alokasi JP</th>
                      <th className="py-2 text-right">Ubah Urutan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedAtp.items.map((item, idx) => {
                      const tp = tps.find((t) => t.id === item.tpId);
                      return (
                        <tr key={`${item.tpId}_${idx}`} className="hover:bg-slate-50">
                          <td className="py-3 pr-2 font-mono text-xs font-semibold">
                            {idx + 1}
                          </td>
                          <td className="py-3 pr-3 font-mono text-xs text-blue-900">
                            {tp?.code || '-'}
                          </td>
                          <td className="py-3 pr-3">
                            <div className="font-medium text-slate-900">{tp?.material || '-'}</div>
                            <div className="text-xs text-slate-600">{tp?.objective || '-'}</div>
                          </td>
                          <td className="py-3 pr-3 font-mono text-xs">
                            Minggu {item.plannedWeekStart}–{item.plannedWeekEnd}
                          </td>
                          <td className="py-3 pr-3 text-right font-mono tabular-nums">
                            {item.hoursAllocation} JP
                          </td>
                          <td className="py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveAtpItem(selectedAtp, idx, -1)}
                              className="p-1.5 text-slate-500 hover:text-blue-800 disabled:opacity-30"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === selectedAtp.items.length - 1}
                              onClick={() => handleMoveAtpItem(selectedAtp, idx, 1)}
                              className="p-1.5 text-slate-500 hover:text-blue-800 disabled:opacity-30"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PROTA */}
      {tab === 'prota' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Kapasitas kalender tahun ini:{' '}
              <span className="font-mono font-semibold text-slate-900">
                {effectiveSummary?.totalEffectiveWeeks ?? 0} Minggu Efektif (
                {effectiveSummary?.totalHoursAvailable ?? 0} JP)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SecondaryButton onClick={handleAddManualProta}>
                <Plus className="w-4 h-4" />
                <span>Tambah Baris</span>
              </SecondaryButton>
              <PrimaryButton onClick={() => handleGenerateProta(false)}>
                <Wand2 className="w-4 h-4" />
                <span>{protas.length > 0 ? 'Tambahkan TP Baru ke PROTA' : 'Generate PROTA dari TP'}</span>
              </PrimaryButton>
              {protas.length > 0 && (
                <SecondaryButton onClick={() => handleGenerateProta(true)}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Susun Ulang</span>
                </SecondaryButton>
              )}
              {protas.length > 0 && identityBundle && (
                <DocxButton
                  onClick={async () => {
                    const blob = await generateProtaDocx(
                      identityBundle,
                      protas,
                      tps,
                      protas[0].subject,
                      protas[0].gradeLevel
                    );
                    await downloadDocxBlob(blob, `PROTA_${activeYear?.name || ''}.docx`);
                    notify('Dokumen PROTA DOCX diunduh.');
                  }}
                />
              )}
            </div>
          </div>

          {protas.length === 0 ? (
            <EmptyState
              title="Belum Ada Program Tahunan (PROTA)"
              description="Klik 'Generate PROTA dari TP' untuk membagi seluruh materi dan alokasi JP secara realistis selama 1 tahun ajaran."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 pr-2">No</th>
                    <th className="py-2 pr-3">Sem</th>
                    <th className="py-2 pr-3">Materi & TP</th>
                    <th className="py-2 pr-3">Minggu Rencana</th>
                    <th className="py-2 pr-3">Alokasi (JP)</th>
                    <th className="py-2 pr-3">Keterangan</th>
                    <th className="py-2 text-right">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {protas.map((p, idx) => {
                    const tp = tps.find((t) => t.id === p.tpId);
                    return (
                      <tr key={p.id}>
                        <td className="py-2.5 pr-2 font-mono text-xs">{idx + 1}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs">S{p.semester}</td>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-slate-900">{p.material}</div>
                          <div className="text-xs text-slate-500">{tp?.code} · {tp?.objective}</div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="text"
                            className={`${inputClass} w-36 text-xs`}
                            value={p.plannedWeeks}
                            onChange={async (e) => {
                              await db.protas.update(p.id, { plannedWeeks: e.target.value });
                              await refreshData();
                            }}
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="number"
                            className={`${inputClass} w-20 text-xs font-mono`}
                            value={p.hoursAllocation}
                            onChange={async (e) => {
                              await db.protas.update(p.id, {
                                hoursAllocation: Number(e.target.value) || 0,
                              });
                              await refreshData();
                            }}
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="text"
                            className={`${inputClass} text-xs`}
                            value={p.notes}
                            onChange={async (e) => {
                              await db.protas.update(p.id, { notes: e.target.value });
                              await refreshData();
                            }}
                            placeholder="Catatan..."
                          />
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              await db.protas.delete(p.id);
                              await refreshData();
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-700"
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
      )}

      {/* TAB 5: PROMES */}
      {tab === 'promes' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700">Semester:</span>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setPromesSem(1)}
                  className={`px-3 py-1.5 rounded-md font-medium ${
                    promesSem === 1 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Semester 1
                </button>
                <button
                  type="button"
                  onClick={() => setPromesSem(2)}
                  className={`px-3 py-1.5 rounded-md font-medium ${
                    promesSem === 2 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Semester 2
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SecondaryButton onClick={handleAddManualPromes}>
                <Plus className="w-4 h-4" />
                <span>Tambah Baris</span>
              </SecondaryButton>
              <PrimaryButton onClick={() => handleGeneratePromes(false)}>
                <Wand2 className="w-4 h-4" />
                <span>
                  {semPromesList.length > 0
                    ? `Tambahkan TP Baru (Sem ${promesSem})`
                    : `Generate PROMES Sem ${promesSem}`}
                </span>
              </PrimaryButton>
              {semPromesList.length > 0 && (
                <SecondaryButton onClick={() => handleGeneratePromes(true)}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Susun Ulang</span>
                </SecondaryButton>
              )}
              {semPromesList.length > 0 && identityBundle && (
                <DocxButton
                  onClick={async () => {
                    const blob = await generatePromesDocx(
                      identityBundle,
                      semPromesList,
                      tps,
                      semPromesList[0].subject,
                      semPromesList[0].gradeLevel,
                      promesSem
                    );
                    await downloadDocxBlob(blob, `PROMES_Sem${promesSem}_${activeYear?.name || ''}.docx`);
                    notify('Dokumen PROMES DOCX diunduh.');
                  }}
                />
              )}
            </div>
          </div>

          {semPromesList.length === 0 ? (
            <EmptyState
              title={`Belum Ada PROMES Semester ${promesSem}`}
              description="Generate PROMES secara otomatis dari TP dan minggu efektif semester ini. Mengubah jadwal minggu tidak akan menghapus TP."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 pr-3">Bulan</th>
                    <th className="py-2 pr-3">Minggu</th>
                    <th className="py-2 pr-3">Materi & TP</th>
                    <th className="py-2 pr-3">JP</th>
                    <th className="py-2 pr-3">Kegiatan</th>
                    <th className="py-2 pr-3">Asesmen</th>
                    <th className="py-2 text-right">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {semPromesList.map((pr) => {
                    const tp = tps.find((t) => t.id === pr.tpId);
                    return (
                      <tr key={pr.id}>
                        <td className="py-2.5 pr-3">
                          <input
                            type="text"
                            className={`${inputClass} w-36 text-xs`}
                            value={pr.month}
                            onChange={async (e) => {
                              await db.promes.update(pr.id, { month: e.target.value });
                              await refreshData();
                            }}
                          />
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 font-mono text-xs">
                            <button
                              type="button"
                              onClick={() => handleShiftPromesWeek(pr, -1)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded"
                            >
                              -
                            </button>
                            <span className="w-10 text-center">M{pr.weekNumber}</span>
                            <button
                              type="button"
                              onClick={() => handleShiftPromesWeek(pr, 1)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="text"
                            className={`${inputClass} text-xs font-medium text-slate-900`}
                            value={pr.material}
                            onChange={async (e) => {
                              await db.promes.update(pr.id, { material: e.target.value });
                              await refreshData();
                            }}
                          />
                          <div className="text-xs text-slate-500 mt-0.5">{tp?.code || '-'}</div>
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-xs">{pr.hoursAllocation}</td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="text"
                            className={`${inputClass} text-xs`}
                            value={pr.activity}
                            onChange={async (e) => {
                              await db.promes.update(pr.id, { activity: e.target.value });
                              await refreshData();
                            }}
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="text"
                            className={`${inputClass} w-36 text-xs`}
                            value={pr.assessment}
                            onChange={async (e) => {
                              await db.promes.update(pr.id, { assessment: e.target.value });
                              await refreshData();
                            }}
                          />
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              await db.promes.delete(pr.id);
                              await refreshData();
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-700"
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
      )}

      {/* TAB 6: SILABUS */}
      {tab === 'silabus' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Silabus terintegrasi langsung dengan CP, TP, Metode, Media, Sumber Belajar, dan Asesmen.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PrimaryButton onClick={() => handleGenerateSyllabus(false)}>
                <Wand2 className="w-4 h-4" />
                <span>
                  {syllabi.length > 0 ? 'Tambahkan TP Baru ke Silabus' : 'Generate Silabus dari TP'}
                </span>
              </PrimaryButton>
              {syllabi.length > 0 && (
                <SecondaryButton onClick={() => handleGenerateSyllabus(true)}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Susun Ulang</span>
                </SecondaryButton>
              )}
              {syllabi.length > 0 && identityBundle && (
                <DocxButton
                  onClick={async () => {
                    const blob = await generateSyllabusDocx(
                      identityBundle,
                      syllabi,
                      tps,
                      cps,
                      syllabi[0].subject,
                      syllabi[0].gradeLevel
                    );
                    await downloadDocxBlob(blob, `Silabus_${activeYear?.name || ''}.docx`);
                    notify('Dokumen Silabus DOCX diunduh.');
                  }}
                />
              )}
            </div>
          </div>

          {syllabi.length === 0 ? (
            <EmptyState
              title="Belum Ada Silabus Pembelajaran"
              description="Klik 'Generate Silabus dari TP' untuk menyusun tabel silabus lengkap yang dapat Anda edit dan ekspor ke Word DOCX."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 pr-3">TP & Materi</th>
                    <th className="py-2 pr-3">Kegiatan Pembelajaran</th>
                    <th className="py-2 pr-3">Metode & Media</th>
                    <th className="py-2 pr-3">Asesmen</th>
                    <th className="py-2 text-right">JP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {syllabi.map((s) => {
                    const tp = tps.find((t) => t.id === s.tpId);
                    return (
                      <tr key={s.id}>
                        <td className="py-3 pr-3 align-top max-w-xs">
                          <div className="font-mono text-xs text-blue-900">{tp?.code}</div>
                          <div className="font-medium text-slate-900">{s.material}</div>
                        </td>
                        <td className="py-3 pr-3 align-top">
                          <textarea
                            rows={2}
                            className={`${inputClass} text-xs`}
                            value={s.learningActivities}
                            onChange={async (e) => {
                              await db.syllabi.update(s.id, {
                                learningActivities: e.target.value,
                              });
                              await refreshData();
                            }}
                          />
                        </td>
                        <td className="py-3 pr-3 align-top space-y-1">
                          <input
                            type="text"
                            className={`${inputClass} text-xs`}
                            value={s.method}
                            onChange={async (e) => {
                              await db.syllabi.update(s.id, { method: e.target.value });
                              await refreshData();
                            }}
                          />
                          <input
                            type="text"
                            className={`${inputClass} text-xs`}
                            value={s.media}
                            onChange={async (e) => {
                              await db.syllabi.update(s.id, { media: e.target.value });
                              await refreshData();
                            }}
                          />
                        </td>
                        <td className="py-3 pr-3 align-top">
                          <input
                            type="text"
                            className={`${inputClass} text-xs`}
                            value={s.assessment}
                            onChange={async (e) => {
                              await db.syllabi.update(s.id, { assessment: e.target.value });
                              await refreshData();
                            }}
                          />
                        </td>
                        <td className="py-3 text-right font-mono text-xs align-top">
                          {s.hoursAllocation}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
