import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { db } from '../db/database';
import { calculateEffectiveWeeks } from './effectiveWeeks';
import { computeClassGradeAnalytics } from './gradeEngine';
import {
  generateAnswerKeyDocx,
  generateAssessmentQuestionsDocx,
  generateAtpDocx,
  generateBlueprintDocx,
  generateCpTpDocx,
  generateEffectiveWeeksDocx,
  generateGradesDocx,
  generateIdentityDocx,
  generateJournalsDocx,
  generateLkpdDocx,
  generatePromesDocx,
  generateProtaDocx,
  generateReportDescriptionsDocx,
  generateStudentsDocx,
  generateSyllabusDocx,
  generateTeachingModuleDocx,
  generateAttendanceDocx,
  type DocxIdentityBundle,
} from './docxGenerator';
import type { SemesterNumber } from '../types/domain';

export type SupervisionSectionKey =
  | '01_IDENTITAS'
  | '02_DATA_KELAS'
  | '03_PERENCANAAN'
  | '04_MODUL_AJAR'
  | '05_LKPD'
  | '06_ASESMEN'
  | '07_PRESENSI'
  | '08_JURNAL'
  | '09_DAFTAR_NILAI'
  | '10_REKAP_NILAI'
  | '11_RAPOR';

function sanitizeFileName(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 50) || 'Dokumen';
}

export async function generateSupervisionZipPackage(params: {
  academicYearId: string;
  semester: SemesterNumber;
  classIds: string[];
  selectedFolders: SupervisionSectionKey[];
}): Promise<{ blob: Blob; filename: string; fileCount: number }> {
  const zip = new JSZip();
  let fileCount = 0;

  const school = await db.schoolProfile.get('default');
  const teacher = await db.teacherProfile.get('default');
  const principal = await db.principalProfile.get('default');
  const academicYear = await db.academicYears.get(params.academicYearId);
  const settings = await db.appSettings.get('default');

  if (!school || !teacher || !principal || !academicYear) {
    throw new Error('Data identitas atau tahun ajaran belum tersedia.');
  }

  const bundle: DocxIdentityBundle = {
    school,
    teacher,
    principal,
    academicYear,
    settings,
  };

  const allClasses = (
    await db.classGroups.where('academicYearId').equals(params.academicYearId).toArray()
  ).filter((c) => params.classIds.length === 0 || params.classIds.includes(c.id));

  const cps = await db.cps.where('academicYearId').equals(params.academicYearId).toArray();
  const tps = await db.tps.where('academicYearId').equals(params.academicYearId).toArray();
  const atps = await db.atps.where('academicYearId').equals(params.academicYearId).toArray();
  const protas = await db.protas.where('academicYearId').equals(params.academicYearId).toArray();
  const promes = await db.promes.where('academicYearId').equals(params.academicYearId).toArray();
  const syllabi = await db.syllabi.where('academicYearId').equals(params.academicYearId).toArray();
  const modules = await db.modules.where('academicYearId').equals(params.academicYearId).toArray();
  const lkpds = await db.lkpds.where('academicYearId').equals(params.academicYearId).toArray();
  const assessments = await db.assessments.where('academicYearId').equals(params.academicYearId).toArray();
  const questionBank = await db.questionBank.where('academicYearId').equals(params.academicYearId).toArray();
  const components = (
    await db.gradeComponents.where('academicYearId').equals(params.academicYearId).toArray()
  ).filter((c) => c.semester === params.semester);

  const selected = new Set(params.selectedFolders);

  // 01_IDENTITAS
  if (selected.has('01_IDENTITAS')) {
    const f = zip.folder('01_IDENTITAS')!;
    const blob = await generateIdentityDocx(bundle);
    f.file('01_Identitas_Sekolah_Guru_Kepsek.docx', blob);
    fileCount++;
  }

  // 02_DATA_KELAS
  if (selected.has('02_DATA_KELAS')) {
    const f = zip.folder('02_DATA_KELAS')!;
    for (const cls of allClasses) {
      const students = await db.students.where('classId').equals(cls.id).toArray();
      const blob = await generateStudentsDocx(bundle, cls, students);
      f.file(`Daftar_Siswa_${sanitizeFileName(cls.name)}.docx`, blob);
      fileCount++;
    }
  }

  // 03_PERENCANAAN
  if (selected.has('03_PERENCANAAN')) {
    const f = zip.folder('03_PERENCANAAN')!;
    const calConfig = await db.calendarConfigs
      .where('academicYearId')
      .equals(params.academicYearId)
      .first();
    const calEvents = await db.calendarEvents
      .where('academicYearId')
      .equals(params.academicYearId)
      .toArray();
    if (calConfig) {
      const summary = calculateEffectiveWeeks(calConfig, calEvents);
      f.file(
        '01_Kalender_dan_Minggu_Efektif.docx',
        await generateEffectiveWeeksDocx(bundle, calConfig, summary, calEvents)
      );
      fileCount++;
    }
    if (cps.length > 0 || tps.length > 0) {
      f.file('02_Capaian_dan_Tujuan_Pembelajaran.docx', await generateCpTpDocx(bundle, cps, tps));
      fileCount++;
    }
    for (const atp of atps) {
      const cp = cps.find((c) => c.id === atp.cpId);
      f.file(
        `03_ATP_${sanitizeFileName(atp.subject)}_Kls${sanitizeFileName(atp.gradeLevel)}.docx`,
        await generateAtpDocx(bundle, atp, cp, tps)
      );
      fileCount++;
    }
    if (protas.length > 0) {
      const subj = protas[0].subject || teacher.subjects[0] || 'Mapel';
      const gr = protas[0].gradeLevel || '-';
      f.file('04_PROTA_Program_Tahunan.docx', await generateProtaDocx(bundle, protas, tps, subj, gr));
      fileCount++;
    }
    const semPromes = promes.filter((p) => p.semester === params.semester);
    if (semPromes.length > 0) {
      const subj = semPromes[0].subject || teacher.subjects[0] || 'Mapel';
      const gr = semPromes[0].gradeLevel || '-';
      f.file(
        `05_PROMES_Semester_${params.semester}.docx`,
        await generatePromesDocx(bundle, semPromes, tps, subj, gr, params.semester)
      );
      fileCount++;
    }
    if (syllabi.length > 0) {
      const subj = syllabi[0].subject || teacher.subjects[0] || 'Mapel';
      const gr = syllabi[0].gradeLevel || '-';
      f.file(
        '06_Silabus_Pembelajaran.docx',
        await generateSyllabusDocx(bundle, syllabi, tps, cps, subj, gr)
      );
      fileCount++;
    }
  }

  // 04_MODUL_AJAR
  if (selected.has('04_MODUL_AJAR')) {
    const f = zip.folder('04_MODUL_AJAR')!;
    for (const mod of modules) {
      const cp = cps.find((c) => c.id === mod.cpId);
      const relTps = tps.filter((t) => mod.tpIds.includes(t.id));
      f.file(
        `Modul_Ajar_${sanitizeFileName(mod.title)}.docx`,
        await generateTeachingModuleDocx(bundle, mod, relTps, cp)
      );
      fileCount++;
    }
  }

  // 05_LKPD
  if (selected.has('05_LKPD')) {
    const f = zip.folder('05_LKPD')!;
    for (const l of lkpds) {
      const tp = tps.find((t) => t.id === l.tpId);
      f.file(`LKPD_${sanitizeFileName(l.title)}.docx`, await generateLkpdDocx(bundle, l, tp));
      fileCount++;
    }
  }

  // 06_ASESMEN
  if (selected.has('06_ASESMEN')) {
    const f = zip.folder('06_ASESMEN')!;
    for (const asmt of assessments) {
      const linkedQ = [
        ...questionBank.filter((q) => asmt.questionIds.includes(q.id)),
        ...asmt.customQuestions,
      ];
      const baseName = sanitizeFileName(asmt.name);
      f.file(`Soal_${baseName}.docx`, await generateAssessmentQuestionsDocx(bundle, asmt, linkedQ));
      f.file(`Kisi_Kisi_${baseName}.docx`, await generateBlueprintDocx(bundle, asmt, linkedQ, tps));
      f.file(`Kunci_Jawaban_${baseName}.docx`, await generateAnswerKeyDocx(bundle, asmt, linkedQ));
      fileCount += 3;
    }
  }

  // Per-class administration folders
  for (const cls of allClasses) {
    const students = await db.students.where('classId').equals(cls.id).toArray();
    const clsName = sanitizeFileName(cls.name);

    if (selected.has('07_PRESENSI')) {
      const f = zip.folder('07_PRESENSI')!;
      const sessions = (await db.attendanceSessions.where('classId').equals(cls.id).toArray()).filter(
        (s) => s.semester === params.semester
      );
      f.file(`Presensi_${clsName}_Sem${params.semester}.docx`, await generateAttendanceDocx(bundle, cls, students, sessions));
      fileCount++;
    }

    if (selected.has('08_JURNAL')) {
      const f = zip.folder('08_JURNAL')!;
      const journals = (await db.journals.where('classId').equals(cls.id).toArray()).filter(
        (j) => j.semester === params.semester
      );
      f.file(`Jurnal_Mengajar_${clsName}_Sem${params.semester}.docx`, await generateJournalsDocx(bundle, cls, journals, tps));
      fileCount++;
    }

    if (selected.has('09_DAFTAR_NILAI') || selected.has('10_REKAP_NILAI')) {
      const grades = (await db.studentGrades.where('classId').equals(cls.id).toArray()).filter(
        (g) => g.semester === params.semester
      );
      const analytics = computeClassGradeAnalytics({
        students,
        components,
        grades,
        tps,
        kktpThreshold: settings?.kktpThreshold ?? 75,
      });
      const blob = await generateGradesDocx(bundle, cls, components, analytics);
      if (selected.has('09_DAFTAR_NILAI')) {
        zip.folder('09_DAFTAR_NILAI')!.file(`Daftar_Nilai_${clsName}_Sem${params.semester}.docx`, blob);
        fileCount++;
      }
      if (selected.has('10_REKAP_NILAI')) {
        zip.folder('10_REKAP_NILAI')!.file(`Rekap_Analisis_Nilai_${clsName}_Sem${params.semester}.docx`, blob);
        fileCount++;
      }
    }

    if (selected.has('11_RAPOR')) {
      const f = zip.folder('11_RAPOR')!;
      const descs = (await db.reportDescriptions.where('classId').equals(cls.id).toArray()).filter(
        (d) => d.semester === params.semester
      );
      f.file(
        `Deskripsi_Rapor_${clsName}_Sem${params.semester}.docx`,
        await generateReportDescriptionsDocx(bundle, cls, students, descs)
      );
      fileCount++;
    }
  }

  const teacherSlug = sanitizeFileName(teacher.fullName || 'GURU');
  const yearSlug = sanitizeFileName(academicYear.name);
  const filename = `ADMINISTRASI_GURU_${teacherSlug}_${yearSlug}.zip`;
  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, filename, fileCount };
}

export function triggerZipDownload(blob: Blob, filename: string): void {
  saveAs(blob, filename);
}
