import Dexie, { type Table } from 'dexie';
import type {
  AcademicYear,
  AppSettings,
  Assessment,
  ATPDocument,
  AttendanceSession,
  AutoSnapshot,
  BackupRecord,
  CalendarConfig,
  CalendarEvent,
  ClassGroup,
  DocumentTemplate,
  GradeComponent,
  LearningMediaItem,
  LearningObjectiveTP,
  LearningOutcomeCP,
  LKPDDocument,
  MonitoringOverride,
  PrincipalProfile,
  PromesItem,
  ProtaItem,
  QuestionBankItem,
  ReportDescription,
  SchoolProfile,
  Student,
  StudentGrade,
  SyllabusItem,
  TeacherProfile,
  TeachingJournal,
  TeachingModule,
} from '../types/domain';

export class GuruAdminProDB extends Dexie {
  schoolProfile!: Table<SchoolProfile, string>;
  teacherProfile!: Table<TeacherProfile, string>;
  principalProfile!: Table<PrincipalProfile, string>;
  academicYears!: Table<AcademicYear, string>;
  calendarConfigs!: Table<CalendarConfig, string>;
  calendarEvents!: Table<CalendarEvent, string>;
  classGroups!: Table<ClassGroup, string>;
  students!: Table<Student, string>;
  cps!: Table<LearningOutcomeCP, string>;
  tps!: Table<LearningObjectiveTP, string>;
  atps!: Table<ATPDocument, string>;
  protas!: Table<ProtaItem, string>;
  promes!: Table<PromesItem, string>;
  syllabi!: Table<SyllabusItem, string>;
  modules!: Table<TeachingModule, string>;
  lkpds!: Table<LKPDDocument, string>;
  mediaItems!: Table<LearningMediaItem, string>;
  questionBank!: Table<QuestionBankItem, string>;
  assessments!: Table<Assessment, string>;
  attendanceSessions!: Table<AttendanceSession, string>;
  journals!: Table<TeachingJournal, string>;
  gradeComponents!: Table<GradeComponent, string>;
  studentGrades!: Table<StudentGrade, string>;
  reportDescriptions!: Table<ReportDescription, string>;
  documentTemplates!: Table<DocumentTemplate, string>;
  monitoringOverrides!: Table<MonitoringOverride, string>;
  backupRecords!: Table<BackupRecord, string>;
  autoSnapshots!: Table<AutoSnapshot, string>;
  appSettings!: Table<AppSettings, string>;

  constructor() {
    super('GuruAdminProDB');
    const storesSchema = {
      schoolProfile: 'id',
      teacherProfile: 'id',
      principalProfile: 'id',
      academicYears: 'id, isActive, isArchived',
      calendarConfigs: 'id, academicYearId',
      calendarEvents: 'id, academicYearId, semester, type',
      classGroups: 'id, academicYearId, gradeLevel, name',
      students: 'id, academicYearId, classId, nis, nisn, fullName',
      cps: 'id, academicYearId, subject, phase, gradeLevel',
      tps: 'id, academicYearId, cpId, code, gradeLevel, semester',
      atps: 'id, academicYearId, cpId, gradeLevel, semester',
      protas: 'id, academicYearId, gradeLevel, semester, tpId',
      promes: 'id, academicYearId, gradeLevel, semester, tpId',
      syllabi: 'id, academicYearId, gradeLevel, semester, tpId',
      modules: 'id, academicYearId, classId, gradeLevel, semester',
      lkpds: 'id, academicYearId, classId, tpId, moduleId',
      mediaItems: 'id, academicYearId, gradeLevel, tpId',
      questionBank: 'id, academicYearId, gradeLevel, semester, tpId, questionType',
      assessments: 'id, academicYearId, classId, semester, category',
      attendanceSessions: 'id, academicYearId, classId, semester, date',
      journals: 'id, academicYearId, classId, semester, date',
      gradeComponents: 'id, academicYearId, subject, semester',
      studentGrades: 'id, academicYearId, classId, studentId, semester, componentId',
      reportDescriptions: 'id, academicYearId, classId, studentId, semester',
      documentTemplates: 'id, category, isDefault',
      monitoringOverrides: 'id, academicYearId, itemKey',
      backupRecords: 'id, createdAt',
      appSettings: 'id',
    };

    this.version(1).stores(storesSchema);
    this.version(2).stores({
      ...storesSchema,
      autoSnapshots: 'id, createdAt',
    });
  }
}

export const db = new GuruAdminProDB();

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // ignore browser restrictions
  }
  return false;
}

export async function ensureInitialSetup(): Promise<void> {
  const now = new Date().toISOString();

  const existingSchool = await db.schoolProfile.get('default');
  if (!existingSchool) {
    await db.schoolProfile.put({
      id: 'default',
      name: '',
      npsn: '',
      level: 'SMP/MTs',
      address: '',
      village: '',
      district: '',
      city: '',
      province: '',
      academicYearText: '2026/2027',
      activeSemester: 1,
      curriculum: 'Kurikulum Merdeka',
      phone: '',
      email: '',
      additionalInfo: '',
      updatedAt: now,
    });
  }

  const existingTeacher = await db.teacherProfile.get('default');
  if (!existingTeacher) {
    await db.teacherProfile.put({
      id: 'default',
      fullName: '',
      nip: '',
      nuptk: '',
      rankGrade: '',
      position: 'Guru Mata Pelajaran',
      subjects: [],
      classesTaught: [],
      phone: '',
      email: '',
      updatedAt: now,
    });
  }

  const existingPrincipal = await db.principalProfile.get('default');
  if (!existingPrincipal) {
    await db.principalProfile.put({
      id: 'default',
      fullName: '',
      nip: '',
      rankGrade: '',
      position: 'Kepala Sekolah',
      updatedAt: now,
    });
  }

  const existingSettings = await db.appSettings.get('default');
  if (!existingSettings) {
    await db.appSettings.put({
      id: 'default',
      kktpThreshold: 75,
      paperSize: 'A4',
      defaultOrientation: 'portrait',
      defaultFontFamily: 'Times New Roman',
      updatedAt: now,
    });
  }

  const years = await db.academicYears.toArray();
  let activeYearId = years.find((y) => y.isActive)?.id;

  if (years.length === 0) {
    activeYearId = createId('ay');
    await db.academicYears.put({
      id: activeYearId,
      name: '2026/2027',
      startDate: '2026-07-13',
      endDate: '2027-06-18',
      activeSemester: 1,
      isActive: true,
      isArchived: false,
      createdAt: now,
    });
  } else if (!activeYearId) {
    activeYearId = years[0].id;
    await db.academicYears.update(activeYearId, { isActive: true });
  }

  if (activeYearId) {
    const cal = await db.calendarConfigs
      .where('academicYearId')
      .equals(activeYearId)
      .first();
    if (!cal) {
      await db.calendarConfigs.put({
        id: createId('cal'),
        academicYearId: activeYearId,
        yearStartDate: '2026-07-13',
        yearEndDate: '2027-06-18',
        sem1StartDate: '2026-07-13',
        sem1EndDate: '2026-12-18',
        sem2StartDate: '2027-01-04',
        sem2EndDate: '2027-06-18',
        learningDaysPerWeek: 5,
        hoursPerWeek: 4,
        minutesPerHour: 40,
        updatedAt: now,
      });
    }

    const components = await db.gradeComponents
      .where('academicYearId')
      .equals(activeYearId)
      .toArray();
    if (components.length === 0) {
      const defaults: Array<{ name: string; weight: number }> = [
        { name: 'Tugas', weight: 10 },
        { name: 'Quiz', weight: 10 },
        { name: 'UH', weight: 20 },
        { name: 'Praktik', weight: 20 },
        { name: 'Projek', weight: 15 },
        { name: 'STS', weight: 10 },
        { name: 'SAS', weight: 15 },
      ];
      for (const sem of [1, 2] as const) {
        for (let i = 0; i < defaults.length; i++) {
          await db.gradeComponents.put({
            id: createId('gc'),
            academicYearId: activeYearId,
            subject: 'Umum',
            semester: sem,
            name: defaults[i].name,
            weight: defaults[i].weight,
            orderIndex: i + 1,
          });
        }
      }
    }
  }
}

export async function switchActiveAcademicYear(yearId: string): Promise<void> {
  const all = await db.academicYears.toArray();
  await db.transaction('rw', db.academicYears, db.schoolProfile, async () => {
    for (const y of all) {
      await db.academicYears.update(y.id, { isActive: y.id === yearId });
    }
    const target = all.find((y) => y.id === yearId);
    if (target) {
      await db.schoolProfile.update('default', {
        academicYearText: target.name,
        activeSemester: target.activeSemester,
      });
    }
  });
}

function promoteGradeAndClassName(
  gradeLevel: string,
  className: string
): { gradeLevel: string; name: string } {
  const g = gradeLevel.trim();
  const romanMap: Record<string, string> = {
    X: 'XI',
    XI: 'XII',
    XII: 'XII',
  };
  let nextGrade = g;
  if (romanMap[g.toUpperCase()]) {
    nextGrade = romanMap[g.toUpperCase()];
  } else if (/^\d+$/.test(g)) {
    const n = Number(g);
    if (n >= 1 && n <= 5) nextGrade = String(n + 1);
    else if (n >= 7 && n <= 8) nextGrade = String(n + 1);
    else if (n >= 10 && n <= 11) nextGrade = String(n + 1);
  }

  let nextName = className.trim();
  if (g && nextGrade !== g && nextName.toUpperCase().startsWith(g.toUpperCase())) {
    nextName = `${nextGrade}${nextName.slice(g.length)}`;
  }
  return { gradeLevel: nextGrade, name: nextName };
}

export async function copyAcademicYearStructure(options: {
  sourceYearId: string;
  newYearName: string;
  startDate: string;
  endDate: string;
  copyClasses: boolean;
  promoteGradeLevel?: boolean;
  copyStudents?: boolean;
  copyPlanning: boolean; // CP, TP, ATP, Prota, Promes, Silabus
  copyLearningToolsAndBank?: boolean; // Modul Ajar, LKPD, Media, Bank Soal, Asesmen
  copyGradeComponents: boolean;
  archiveSource: boolean;
}): Promise<string> {
  await createAutoSnapshot(`Sebelum membuat Tahun Ajaran ${options.newYearName}`);
  const now = new Date().toISOString();
  const newYearId = createId('ay');

  await db.transaction(
    'rw',
    [
      db.academicYears,
      db.schoolProfile,
      db.calendarConfigs,
      db.classGroups,
      db.students,
      db.cps,
      db.tps,
      db.atps,
      db.protas,
      db.promes,
      db.syllabi,
      db.modules,
      db.lkpds,
      db.mediaItems,
      db.questionBank,
      db.assessments,
      db.gradeComponents,
    ],
    async () => {
      const allYears = await db.academicYears.toArray();
      for (const y of allYears) {
        await db.academicYears.update(y.id, {
          isActive: false,
          isArchived:
            y.id === options.sourceYearId && options.archiveSource
              ? true
              : y.isArchived,
        });
      }

      await db.academicYears.put({
        id: newYearId,
        name: options.newYearName,
        startDate: options.startDate,
        endDate: options.endDate,
        activeSemester: 1,
        isActive: true,
        isArchived: false,
        createdAt: now,
      });

      await db.schoolProfile.update('default', {
        academicYearText: options.newYearName,
        activeSemester: 1,
      });

      // Calendar config
      const srcCal = await db.calendarConfigs
        .where('academicYearId')
        .equals(options.sourceYearId)
        .first();
      await db.calendarConfigs.put({
        id: createId('cal'),
        academicYearId: newYearId,
        yearStartDate: options.startDate,
        yearEndDate: options.endDate,
        sem1StartDate: options.startDate,
        sem1EndDate: `${options.startDate.slice(0, 4)}-12-18`,
        sem2StartDate: `${options.endDate.slice(0, 4)}-01-05`,
        sem2EndDate: options.endDate,
        learningDaysPerWeek: srcCal?.learningDaysPerWeek ?? 5,
        hoursPerWeek: srcCal?.hoursPerWeek ?? 4,
        minutesPerHour: srcCal?.minutesPerHour ?? 40,
        updatedAt: now,
      });

      const classMap = new Map<string, string>();
      if (options.copyClasses) {
        const srcClasses = await db.classGroups
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const cls of srcClasses) {
          const newClsId = createId('cls');
          classMap.set(cls.id, newClsId);
          const promoted = options.promoteGradeLevel
            ? promoteGradeAndClassName(cls.gradeLevel, cls.name)
            : { gradeLevel: cls.gradeLevel, name: cls.name };

          await db.classGroups.put({
            ...cls,
            id: newClsId,
            academicYearId: newYearId,
            gradeLevel: promoted.gradeLevel,
            name: promoted.name,
            semester: 1,
            createdAt: now,
          });
        }

        if (options.copyStudents) {
          const srcStudents = await db.students
            .where('academicYearId')
            .equals(options.sourceYearId)
            .toArray();
          for (const st of srcStudents) {
            if (st.status !== 'Aktif') continue;
            const targetClassId = classMap.get(st.classId);
            if (!targetClassId) continue;
            await db.students.put({
              ...st,
              id: createId('stu'),
              academicYearId: newYearId,
              classId: targetClassId,
              createdAt: now,
            });
          }
        }
      }

      const cpMap = new Map<string, string>();
      const tpMap = new Map<string, string>();

      if (options.copyPlanning) {
        const srcCps = await db.cps
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const cp of srcCps) {
          const newCpId = createId('cp');
          cpMap.set(cp.id, newCpId);
          await db.cps.put({
            ...cp,
            id: newCpId,
            academicYearId: newYearId,
            createdAt: now,
          });
        }

        const srcTps = await db.tps
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const tp of srcTps) {
          const newTpId = createId('tp');
          tpMap.set(tp.id, newTpId);
          await db.tps.put({
            ...tp,
            id: newTpId,
            academicYearId: newYearId,
            cpId: cpMap.get(tp.cpId) ?? tp.cpId,
            createdAt: now,
          });
        }

        const srcAtps = await db.atps
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const atp of srcAtps) {
          await db.atps.put({
            ...atp,
            id: createId('atp'),
            academicYearId: newYearId,
            cpId: cpMap.get(atp.cpId) ?? atp.cpId,
            items: atp.items.map((it) => ({
              ...it,
              tpId: tpMap.get(it.tpId) ?? it.tpId,
            })),
            updatedAt: now,
          });
        }

        const srcProtas = await db.protas
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const p of srcProtas) {
          await db.protas.put({
            ...p,
            id: createId('prota'),
            academicYearId: newYearId,
            cpId: cpMap.get(p.cpId) ?? p.cpId,
            tpId: tpMap.get(p.tpId) ?? p.tpId,
          });
        }

        const srcPromes = await db.promes
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const pr of srcPromes) {
          await db.promes.put({
            ...pr,
            id: createId('promes'),
            academicYearId: newYearId,
            tpId: tpMap.get(pr.tpId) ?? pr.tpId,
          });
        }

        const srcSyllabi = await db.syllabi
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const s of srcSyllabi) {
          await db.syllabi.put({
            ...s,
            id: createId('syl'),
            academicYearId: newYearId,
            cpId: cpMap.get(s.cpId) ?? s.cpId,
            tpId: tpMap.get(s.tpId) ?? s.tpId,
          });
        }
      }

      if (options.copyLearningToolsAndBank) {
        const modMap = new Map<string, string>();
        const srcMods = await db.modules
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const m of srcMods) {
          const newModId = createId('mod');
          modMap.set(m.id, newModId);
          await db.modules.put({
            ...m,
            id: newModId,
            academicYearId: newYearId,
            classId: classMap.get(m.classId) ?? '',
            cpId: cpMap.get(m.cpId) ?? m.cpId,
            tpIds: m.tpIds.map((id) => tpMap.get(id) ?? id),
            updatedAt: now,
          });
        }

        const srcLkpds = await db.lkpds
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const l of srcLkpds) {
          await db.lkpds.put({
            ...l,
            id: createId('lkpd'),
            academicYearId: newYearId,
            classId: classMap.get(l.classId) ?? '',
            cpId: cpMap.get(l.cpId) ?? l.cpId,
            tpId: tpMap.get(l.tpId) ?? l.tpId,
            moduleId: l.moduleId ? (modMap.get(l.moduleId) ?? l.moduleId) : undefined,
            updatedAt: now,
          });
        }

        const srcMedia = await db.mediaItems
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const med of srcMedia) {
          await db.mediaItems.put({
            ...med,
            id: createId('med'),
            academicYearId: newYearId,
            tpId: med.tpId ? (tpMap.get(med.tpId) ?? med.tpId) : undefined,
            moduleId: med.moduleId ? (modMap.get(med.moduleId) ?? med.moduleId) : undefined,
            updatedAt: now,
          });
        }

        const qbMap = new Map<string, string>();
        const srcQb = await db.questionBank
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const q of srcQb) {
          const newQId = createId('qb');
          qbMap.set(q.id, newQId);
          await db.questionBank.put({
            ...q,
            id: newQId,
            academicYearId: newYearId,
            tpId: tpMap.get(q.tpId) ?? q.tpId,
            createdAt: now,
          });
        }

        const srcAsmts = await db.assessments
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const a of srcAsmts) {
          await db.assessments.put({
            ...a,
            id: createId('asmt'),
            academicYearId: newYearId,
            classId: classMap.get(a.classId) ?? '',
            tpIds: a.tpIds.map((id) => tpMap.get(id) ?? id),
            questionIds: a.questionIds.map((id) => qbMap.get(id) ?? id),
            updatedAt: now,
          });
        }
      }

      if (options.copyGradeComponents) {
        const srcComps = await db.gradeComponents
          .where('academicYearId')
          .equals(options.sourceYearId)
          .toArray();
        for (const gc of srcComps) {
          await db.gradeComponents.put({
            ...gc,
            id: createId('gc'),
            academicYearId: newYearId,
          });
        }
      }
    }
  );

  return newYearId;
}

export interface BackupPayload {
  app: 'GURU_ADMIN_PRO';
  version: number;
  exportedAt: string;
  scope: 'Semua Data' | 'Per Tahun Ajaran' | 'Per Kelas';
  academicYearName: string;
  summary?: Record<string, number>;
  data: Record<string, unknown[]>;
}

export async function buildFullSnapshotPayload(): Promise<BackupPayload> {
  const years = await db.academicYears.toArray();
  const activeYear = years.find((y) => y.isActive) ?? years[0];
  const data: Record<string, unknown[]> = {
    schoolProfile: await db.schoolProfile.toArray(),
    teacherProfile: await db.teacherProfile.toArray(),
    principalProfile: await db.principalProfile.toArray(),
    appSettings: await db.appSettings.toArray(),
    documentTemplates: await db.documentTemplates.toArray(),
    academicYears: years,
    calendarConfigs: await db.calendarConfigs.toArray(),
    calendarEvents: await db.calendarEvents.toArray(),
    classGroups: await db.classGroups.toArray(),
    students: await db.students.toArray(),
    cps: await db.cps.toArray(),
    tps: await db.tps.toArray(),
    atps: await db.atps.toArray(),
    protas: await db.protas.toArray(),
    promes: await db.promes.toArray(),
    syllabi: await db.syllabi.toArray(),
    modules: await db.modules.toArray(),
    lkpds: await db.lkpds.toArray(),
    mediaItems: await db.mediaItems.toArray(),
    questionBank: await db.questionBank.toArray(),
    assessments: await db.assessments.toArray(),
    attendanceSessions: await db.attendanceSessions.toArray(),
    journals: await db.journals.toArray(),
    gradeComponents: await db.gradeComponents.toArray(),
    studentGrades: await db.studentGrades.toArray(),
    reportDescriptions: await db.reportDescriptions.toArray(),
    monitoringOverrides: await db.monitoringOverrides.toArray(),
  };

  const summary: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    summary[k] = Array.isArray(v) ? v.length : 0;
  }

  return {
    app: 'GURU_ADMIN_PRO',
    version: 2,
    exportedAt: new Date().toISOString(),
    scope: 'Semua Data',
    academicYearName: activeYear?.name ?? 'Semua',
    summary,
    data,
  };
}

export async function createAutoSnapshot(reason: string): Promise<void> {
  try {
    const payload = await buildFullSnapshotPayload();
    const itemCount = Object.values(payload.summary ?? {}).reduce((a, b) => a + b, 0);
    await db.autoSnapshots.put({
      id: createId('snap'),
      createdAt: payload.exportedAt,
      reason,
      academicYearName: payload.academicYearName,
      itemCount,
      payloadJson: JSON.stringify(payload),
    });

    // Keep latest 10 rolling snapshots
    const all = await db.autoSnapshots.orderBy('createdAt').reverse().toArray();
    if (all.length > 10) {
      const toRemove = all.slice(10).map((s) => s.id);
      await db.autoSnapshots.bulkDelete(toRemove);
    }
  } catch {
    // non-fatal
  }
}

export async function syncToServer(): Promise<{ syncedAt: string } | null> {
  try {
    const payload = await buildFullSnapshotPayload();
    const res = await fetch('/api/storage/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return (await res.json()) as { syncedAt: string };
  } catch {
    return null;
  }
}

export async function fetchServerStorageStatus(): Promise<{
  hasSnapshot: boolean;
  updatedAt?: string;
  academicYearName?: string;
  summary?: Record<string, number>;
}> {
  try {
    const res = await fetch('/api/storage/status');
    if (!res.ok) return { hasSnapshot: false };
    return await res.json();
  } catch {
    return { hasSnapshot: false };
  }
}

export async function fetchServerLatestSnapshot(): Promise<BackupPayload | null> {
  try {
    const res = await fetch('/api/storage/latest');
    if (!res.ok) return null;
    return (await res.json()) as BackupPayload;
  } catch {
    return null;
  }
}

export async function hasSubstantialLocalData(): Promise<boolean> {
  const [sch, cls, cps, students] = await Promise.all([
    db.schoolProfile.get('default'),
    db.classGroups.count(),
    db.cps.count(),
    db.students.count(),
  ]);
  return Boolean(sch?.name || cls > 0 || cps > 0 || students > 0);
}

export async function exportBackupPayload(options: {
  scope: 'Semua Data' | 'Per Tahun Ajaran' | 'Per Kelas';
  academicYearId?: string;
  classId?: string;
}): Promise<BackupPayload> {
  const years = await db.academicYears.toArray();
  const targetYear =
    years.find((y) => y.id === options.academicYearId) ??
    years.find((y) => y.isActive);

  let payload: BackupPayload;
  if (options.scope === 'Semua Data') {
    payload = await buildFullSnapshotPayload();
  } else {
    const data: Record<string, unknown[]> = {
      schoolProfile: await db.schoolProfile.toArray(),
      teacherProfile: await db.teacherProfile.toArray(),
      principalProfile: await db.principalProfile.toArray(),
      appSettings: await db.appSettings.toArray(),
      documentTemplates: await db.documentTemplates.toArray(),
    };

    if (options.scope === 'Per Tahun Ajaran' && targetYear) {
      const yId = targetYear.id;
      data.academicYears = [targetYear];
      data.calendarConfigs = await db.calendarConfigs.where('academicYearId').equals(yId).toArray();
      data.calendarEvents = await db.calendarEvents.where('academicYearId').equals(yId).toArray();
      data.classGroups = await db.classGroups.where('academicYearId').equals(yId).toArray();
      data.students = await db.students.where('academicYearId').equals(yId).toArray();
      data.cps = await db.cps.where('academicYearId').equals(yId).toArray();
      data.tps = await db.tps.where('academicYearId').equals(yId).toArray();
      data.atps = await db.atps.where('academicYearId').equals(yId).toArray();
      data.protas = await db.protas.where('academicYearId').equals(yId).toArray();
      data.promes = await db.promes.where('academicYearId').equals(yId).toArray();
      data.syllabi = await db.syllabi.where('academicYearId').equals(yId).toArray();
      data.modules = await db.modules.where('academicYearId').equals(yId).toArray();
      data.lkpds = await db.lkpds.where('academicYearId').equals(yId).toArray();
      data.mediaItems = await db.mediaItems.where('academicYearId').equals(yId).toArray();
      data.questionBank = await db.questionBank.where('academicYearId').equals(yId).toArray();
      data.assessments = await db.assessments.where('academicYearId').equals(yId).toArray();
      data.attendanceSessions = await db.attendanceSessions.where('academicYearId').equals(yId).toArray();
      data.journals = await db.journals.where('academicYearId').equals(yId).toArray();
      data.gradeComponents = await db.gradeComponents.where('academicYearId').equals(yId).toArray();
      data.studentGrades = await db.studentGrades.where('academicYearId').equals(yId).toArray();
      data.reportDescriptions = await db.reportDescriptions.where('academicYearId').equals(yId).toArray();
      data.monitoringOverrides = await db.monitoringOverrides.where('academicYearId').equals(yId).toArray();
    } else if (options.scope === 'Per Kelas' && options.classId) {
      const cls = await db.classGroups.get(options.classId);
      data.classGroups = cls ? [cls] : [];
      data.students = await db.students.where('classId').equals(options.classId).toArray();
      data.modules = await db.modules.where('classId').equals(options.classId).toArray();
      data.lkpds = await db.lkpds.where('classId').equals(options.classId).toArray();
      data.assessments = await db.assessments.where('classId').equals(options.classId).toArray();
      data.attendanceSessions = await db.attendanceSessions.where('classId').equals(options.classId).toArray();
      data.journals = await db.journals.where('classId').equals(options.classId).toArray();
      data.studentGrades = await db.studentGrades.where('classId').equals(options.classId).toArray();
      data.reportDescriptions = await db.reportDescriptions.where('classId').equals(options.classId).toArray();
    }

    payload = {
      app: 'GURU_ADMIN_PRO',
      version: 2,
      exportedAt: new Date().toISOString(),
      scope: options.scope,
      academicYearName: targetYear?.name ?? 'Semua',
      data,
    };
  }

  const totalItems = Object.values(payload.data).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0
  );

  const now = payload.exportedAt;
  await db.backupRecords.put({
    id: createId('bkp'),
    createdAt: now,
    scope: options.scope,
    academicYearName: targetYear?.name ?? 'Semua',
    label: `Backup ${options.scope} (${targetYear?.name ?? 'Semua'})`,
    itemCount: totalItems,
  });
  await db.appSettings.update('default', { lastBackupAt: now });

  return payload;
}

export function validateBackupPayload(raw: unknown): {
  valid: boolean;
  error?: string;
  summary?: {
    scope: string;
    exportedAt: string;
    academicYearName: string;
    counts: Record<string, number>;
  };
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Format file backup bukan JSON valid.' };
  }
  const obj = raw as Partial<BackupPayload>;
  if (obj.app !== 'GURU_ADMIN_PRO' || !obj.data || typeof obj.data !== 'object') {
    return {
      valid: false,
      error: 'File ini bukan backup resmi dari aplikasi GURU ADMIN PRO.',
    };
  }
  const counts: Record<string, number> = {};
  for (const [key, val] of Object.entries(obj.data)) {
    if (Array.isArray(val)) {
      counts[key] = val.length;
    }
  }
  return {
    valid: true,
    summary: {
      scope: obj.scope ?? 'Semua Data',
      exportedAt: obj.exportedAt ?? '-',
      academicYearName: obj.academicYearName ?? '-',
      counts,
    },
  };
}

export async function restoreBackupPayload(
  payload: BackupPayload,
  mode: 'replace' | 'merge'
): Promise<void> {
  await createAutoSnapshot(`Sebelum restore backup (${mode})`);
  const tableMap: Record<string, Table<any, any>> = {
    schoolProfile: db.schoolProfile,
    teacherProfile: db.teacherProfile,
    principalProfile: db.principalProfile,
    academicYears: db.academicYears,
    calendarConfigs: db.calendarConfigs,
    calendarEvents: db.calendarEvents,
    classGroups: db.classGroups,
    students: db.students,
    cps: db.cps,
    tps: db.tps,
    atps: db.atps,
    protas: db.protas,
    promes: db.promes,
    syllabi: db.syllabi,
    modules: db.modules,
    lkpds: db.lkpds,
    mediaItems: db.mediaItems,
    questionBank: db.questionBank,
    assessments: db.assessments,
    attendanceSessions: db.attendanceSessions,
    journals: db.journals,
    gradeComponents: db.gradeComponents,
    studentGrades: db.studentGrades,
    reportDescriptions: db.reportDescriptions,
    documentTemplates: db.documentTemplates,
    monitoringOverrides: db.monitoringOverrides,
    appSettings: db.appSettings,
  };

  await db.transaction('rw', Object.values(tableMap), async () => {
    if (mode === 'replace') {
      for (const table of Object.values(tableMap)) {
        await table.clear();
      }
    }
    for (const [key, rows] of Object.entries(payload.data)) {
      const table = tableMap[key];
      if (table && Array.isArray(rows) && rows.length > 0) {
        await table.bulkPut(rows);
      }
    }
  });
  await ensureInitialSetup();
}
