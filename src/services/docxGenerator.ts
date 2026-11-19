import {
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import type {
  AcademicYear,
  AppSettings,
  Assessment,
  ATPDocument,
  AttendanceSession,
  CalendarConfig,
  CalendarEvent,
  ClassGroup,
  GradeComponent,
  LearningObjectiveTP,
  LearningOutcomeCP,
  LKPDDocument,
  PrincipalProfile,
  PromesItem,
  ProtaItem,
  QuestionBankItem,
  ReportDescription,
  SchoolProfile,
  Student,
  SyllabusItem,
  TeacherProfile,
  TeachingJournal,
  TeachingModule,
} from '../types/domain';
import type { FullEffectiveSummary } from './effectiveWeeks';
import type { ClassGradeAnalytics } from './gradeEngine';

export interface DocxIdentityBundle {
  school: SchoolProfile;
  teacher: TeacherProfile;
  principal: PrincipalProfile;
  academicYear?: AcademicYear;
  settings?: AppSettings;
}

const FONT_SIZE_TITLE = 26; // 13pt
const FONT_SIZE_SUBTITLE = 24; // 12pt
const FONT_SIZE_BODY = 22; // 11pt
const FONT_SIZE_SMALL = 18; // 9pt

function getFont(bundle: DocxIdentityBundle): string {
  return bundle.settings?.defaultFontFamily || 'Times New Roman';
}

function base64ToUint8Array(dataUrl: string): { bytes: Uint8Array; type: 'png' | 'jpg' } | null {
  try {
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
    if (!match) return null;
    const rawExt = match[1].toLowerCase();
    const type: 'png' | 'jpg' = rawExt === 'png' ? 'png' : 'jpg';
    const b64 = match[2];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return { bytes, type };
  } catch {
    return null;
  }
}

function pText(
  text: string,
  font: string,
  opts?: {
    bold?: boolean;
    italic?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spaceBefore?: number;
    spaceAfter?: number;
  }
): Paragraph {
  const lines = String(text ?? '').split('\n');
  return new Paragraph({
    alignment: opts?.align ?? AlignmentType.LEFT,
    spacing: {
      before: opts?.spaceBefore ?? 0,
      after: opts?.spaceAfter ?? 80,
      line: 276,
    },
    children: lines.flatMap((line, i) => [
      new TextRun({
        text: line,
        font,
        bold: opts?.bold ?? false,
        italics: opts?.italic ?? false,
        size: opts?.size ?? FONT_SIZE_BODY,
        break: i > 0 ? 1 : undefined,
      }),
    ]),
  });
}

function buildKopSurat(bundle: DocxIdentityBundle, font: string): Array<Paragraph | Table> {
  const { school } = bundle;
  const imgData = school.logoBase64 ? base64ToUint8Array(school.logoBase64) : null;

  const textRuns: Paragraph[] = [
    pText((school.name || 'NAMA SEKOLAH / MADRASAH').toUpperCase(), font, {
      bold: true,
      size: 28,
      align: AlignmentType.CENTER,
      spaceAfter: 20,
    }),
    pText(
      `Jenjang: ${school.level} · NPSN: ${school.npsn || '-'} · Kurikulum: ${school.curriculum}`,
      font,
      { size: 18, align: AlignmentType.CENTER, spaceAfter: 20 }
    ),
    pText(
      [school.address, school.village, school.district, school.city, school.province]
        .filter(Boolean)
        .join(', ') || 'Alamat Sekolah',
      font,
      { size: 18, align: AlignmentType.CENTER, spaceAfter: 20 }
    ),
    pText(
      `Telp: ${school.phone || '-'} · Email: ${school.email || '-'}`,
      font,
      { size: 18, align: AlignmentType.CENTER, spaceAfter: 0 }
    ),
  ];

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.DOUBLE, size: 18, color: '1E3A8A' },
    },
    rows: [
      new TableRow({
        children: [
          ...(imgData
            ? [
                new TableCell({
                  width: { size: 15, type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.CENTER,
                  borders: {
                    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    bottom: { style: BorderStyle.DOUBLE, size: 18, color: '1E3A8A' },
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          type: imgData.type,
                          data: imgData.bytes,
                          transformation: { width: 58, height: 58 },
                        }),
                      ],
                    }),
                  ],
                }),
              ]
            : []),
          new TableCell({
            width: { size: imgData ? 85 : 100, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              bottom: { style: BorderStyle.DOUBLE, size: 18, color: '1E3A8A' },
            },
            children: textRuns,
          }),
        ],
      }),
    ],
  });

  return [headerTable, pText('', font, { spaceAfter: 80 })];
}

function buildInfoGrid(
  rows: Array<[string, string]>,
  font: string
): Table {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
    rows: rows.map(
      ([label, val]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
              children: [pText(label, font, { bold: true, size: 20, spaceAfter: 40 })],
            }),
            new TableCell({
              width: { size: 3, type: WidthType.PERCENTAGE },
              borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
              children: [pText(':', font, { size: 20, spaceAfter: 40 })],
            }),
            new TableCell({
              width: { size: 69, type: WidthType.PERCENTAGE },
              borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
              children: [pText(val || '-', font, { size: 20, spaceAfter: 40 })],
            }),
          ],
        })
    ),
  });
}

function buildDataTable(
  headers: string[],
  rows: string[][],
  font: string,
  colWidthsPct?: number[]
): Table {
  const border = { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const defaultWidth = Math.floor(100 / headers.length);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(
          (h, idx) =>
            new TableCell({
              width: {
                size: colWidthsPct?.[idx] ?? defaultWidth,
                type: WidthType.PERCENTAGE,
              },
              shading: {
                type: ShadingType.CLEAR,
                fill: 'E2E8F0',
              },
              verticalAlign: VerticalAlign.CENTER,
              borders: cellBorders,
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                pText(h, font, {
                  bold: true,
                  size: 19,
                  align: AlignmentType.CENTER,
                  spaceAfter: 0,
                }),
              ],
            })
        ),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: headers.map(
              (_, idx) =>
                new TableCell({
                  width: {
                    size: colWidthsPct?.[idx] ?? defaultWidth,
                    type: WidthType.PERCENTAGE,
                  },
                  verticalAlign: VerticalAlign.TOP,
                  borders: cellBorders,
                  margins: { top: 70, bottom: 70, left: 100, right: 100 },
                  children: [
                    pText(r[idx] ?? '-', font, {
                      size: 19,
                      spaceAfter: 0,
                    }),
                  ],
                })
            ),
          })
      ),
    ],
  });
}

function buildSignatureBlock(bundle: DocxIdentityBundle, font: string): Array<Paragraph | Table> {
  const { school, teacher, principal } = bundle;
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const city = school.city || '................';
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

  return [
    pText('', font, { spaceBefore: 160, spaceAfter: 80 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: noBorder,
        bottom: noBorder,
        left: noBorder,
        right: noBorder,
        insideHorizontal: noBorder,
        insideVertical: noBorder,
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
              children: [
                pText('Mengetahui,', font, { size: 20, spaceAfter: 20 }),
                pText(principal.position || 'Kepala Sekolah', font, {
                  bold: true,
                  size: 20,
                  spaceAfter: 700,
                }),
                pText(principal.fullName || '........................................', font, {
                  bold: true,
                  size: 20,
                  spaceAfter: 20,
                }),
                pText(`NIP. ${principal.nip || '-'}`, font, { size: 19, spaceAfter: 0 }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
              children: [
                pText(`${city}, ${dateStr}`, font, { size: 20, spaceAfter: 20 }),
                pText(teacher.position || 'Guru Mata Pelajaran', font, {
                  bold: true,
                  size: 20,
                  spaceAfter: 700,
                }),
                pText(teacher.fullName || '........................................', font, {
                  bold: true,
                  size: 20,
                  spaceAfter: 20,
                }),
                pText(`NIP. ${teacher.nip || '-'}`, font, { size: 19, spaceAfter: 0 }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}

async function createA4DocumentBlob(
  bundle: DocxIdentityBundle,
  docTitle: string,
  children: Array<Paragraph | Table>,
  landscape = false
): Promise<Blob> {
  const font = getFont(bundle);
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
              orientation: landscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertMillimetersToTwip(18),
              bottom: convertMillimetersToTwip(18),
              left: convertMillimetersToTwip(22),
              right: convertMillimetersToTwip(18),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              pText(
                `${bundle.school.name || 'GURU ADMIN PRO'} · ${docTitle}`,
                font,
                { size: 16, italic: true, align: AlignmentType.RIGHT, spaceAfter: 0 }
              ),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Tahun Ajaran ${bundle.academicYear?.name || bundle.school.academicYearText} · Halaman `,
                    font,
                    size: 16,
                  }),
                  new TextRun({ children: [PageNumber.CURRENT], font, size: 16 }),
                  new TextRun({ text: ' dari ', font, size: 16 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font, size: 16 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function downloadDocxBlob(blob: Blob, filename: string): Promise<void> {
  const safeName = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  saveAs(blob, safeName);
}

// =========================================================
// INDIVIDUAL DOCUMENT GENERATORS (All return Blob for both single download & ZIP!)
// =========================================================

export async function generateIdentityDocx(bundle: DocxIdentityBundle): Promise<Blob> {
  const font = getFont(bundle);
  const { school, teacher, principal } = bundle;
  return createA4DocumentBlob(bundle, 'Identitas Sekolah, Guru & Kepala Sekolah', [
    ...buildKopSurat(bundle, font),
    pText('DATA IDENTITAS ADMINISTRASI PEMBELAJARAN', font, {
      bold: true,
      size: FONT_SIZE_TITLE,
      align: AlignmentType.CENTER,
      spaceAfter: 160,
    }),
    pText('1. IDENTITAS SEKOLAH', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceAfter: 60 }),
    buildInfoGrid(
      [
        ['Nama Sekolah', school.name],
        ['NPSN', school.npsn],
        ['Jenjang', school.level],
        ['Alamat', `${school.address}, ${school.village}, ${school.district}, ${school.city}, ${school.province}`],
        ['Tahun Ajaran / Semester', `${bundle.academicYear?.name || school.academicYearText} / Semester ${school.activeSemester}`],
        ['Kurikulum', school.curriculum],
        ['Telepon / Email', `${school.phone || '-'} / ${school.email || '-'}`],
      ],
      font
    ),
    pText('2. IDENTITAS GURU', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 160, spaceAfter: 60 }),
    buildInfoGrid(
      [
        ['Nama Lengkap', teacher.fullName],
        ['NIP / NUPTK', `${teacher.nip || '-'} / ${teacher.nuptk || '-'}`],
        ['Pangkat / Golongan', teacher.rankGrade],
        ['Jabatan', teacher.position],
        ['Mata Pelajaran', teacher.subjects.join(', ')],
        ['Kelas yang Diajar', teacher.classesTaught.join(', ')],
        ['Telepon / Email', `${teacher.phone || '-'} / ${teacher.email || '-'}`],
      ],
      font
    ),
    pText('3. IDENTITAS KEPALA SEKOLAH', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 160, spaceAfter: 60 }),
    buildInfoGrid(
      [
        ['Nama Lengkap', principal.fullName],
        ['NIP', principal.nip],
        ['Pangkat / Golongan', principal.rankGrade],
        ['Jabatan', principal.position],
      ],
      font
    ),
    ...buildSignatureBlock(bundle, font),
  ]);
}

export async function generateStudentsDocx(
  bundle: DocxIdentityBundle,
  classGroup: ClassGroup,
  students: Student[]
): Promise<Blob> {
  const font = getFont(bundle);
  const sorted = students.slice().sort((a, b) => a.orderNumber - b.orderNumber);
  return createA4DocumentBlob(bundle, `Daftar Siswa ${classGroup.name}`, [
    ...buildKopSurat(bundle, font),
    pText(`DAFTAR PESERTA DIDIK KELAS ${classGroup.name.toUpperCase()}`, font, {
      bold: true,
      size: FONT_SIZE_TITLE,
      align: AlignmentType.CENTER,
      spaceAfter: 120,
    }),
    buildInfoGrid(
      [
        ['Kelas / Rombel', `${classGroup.name} (Tingkat ${classGroup.gradeLevel})`],
        ['Wali Kelas', classGroup.homeroomTeacher || '-'],
        ['Mata Pelajaran', classGroup.subject || bundle.teacher.subjects.join(', ')],
        ['Tahun Ajaran / Semester', `${bundle.academicYear?.name || '-'} / Semester ${classGroup.semester}`],
      ],
      font
    ),
    pText('', font, { spaceAfter: 80 }),
    buildDataTable(
      ['No', 'NIS', 'NISN', 'Nama Lengkap', 'L/P', 'Status', 'Keterangan'],
      sorted.map((s, idx) => [
        String(s.orderNumber || idx + 1),
        s.nis || '-',
        s.nisn || '-',
        s.fullName,
        s.gender,
        s.status,
        s.notes || '-',
      ]),
      font,
      [7, 13, 15, 32, 7, 11, 15]
    ),
    ...buildSignatureBlock(bundle, font),
  ]);
}

export async function generateEffectiveWeeksDocx(
  bundle: DocxIdentityBundle,
  config: CalendarConfig,
  summary: FullEffectiveSummary,
  events: CalendarEvent[]
): Promise<Blob> {
  const font = getFont(bundle);
  const allMonths = [...summary.semester1.months, ...summary.semester2.months];
  return createA4DocumentBlob(bundle, 'Kalender & Minggu Efektif', [
    ...buildKopSurat(bundle, font),
    pText('RINCIAN MINGGU EFEKTIF PEMBELAJARAN', font, {
      bold: true,
      size: FONT_SIZE_TITLE,
      align: AlignmentType.CENTER,
      spaceAfter: 120,
    }),
    buildInfoGrid(
      [
        ['Tahun Ajaran', bundle.academicYear?.name || bundle.school.academicYearText],
        ['Hari Belajar / Minggu', `${config.learningDaysPerWeek} Hari`],
        ['Alokasi JP / Minggu', `${config.hoursPerWeek} JP (${config.minutesPerHour} menit/JP)`],
        ['Total Minggu Efektif', `Semester 1: ${summary.semester1.effectiveWeeks} Minggu (${summary.semester1.totalHoursAvailable} JP) | Semester 2: ${summary.semester2.effectiveWeeks} Minggu (${summary.semester2.totalHoursAvailable} JP)`],
      ],
      font
    ),
    pText('', font, { spaceAfter: 80 }),
    buildDataTable(
      ['Semester', 'Bulan', 'Jml Minggu', 'Tidak Efektif', 'Minggu Efektif', 'JP Tersedia', 'Keterangan / Kegiatan'],
      allMonths.map((m) => [
        `Sem ${m.semester}`,
        m.monthLabel,
        String(m.totalWeeks),
        String(m.ineffectiveWeeks),
        String(m.effectiveWeeks),
        `${m.hoursAllocation} JP`,
        m.notes.join(', ') || '-',
      ]),
      font,
      [10, 18, 11, 12, 12, 12, 25]
    ),
    pText('DAFTAR HARI LIBUR & KEGIATAN KHUSUS', font, {
      bold: true,
      size: FONT_SIZE_SUBTITLE,
      spaceBefore: 160,
      spaceAfter: 60,
    }),
    buildDataTable(
      ['Tanggal', 'Kategori', 'Semester', 'Nama Kegiatan / Libur'],
      events.map((e) => [
        e.endDate && e.endDate !== e.startDate ? `${e.startDate} s.d. ${e.endDate}` : e.startDate,
        e.type,
        `Semester ${e.semester}`,
        e.title,
      ]),
      font,
      [25, 22, 15, 38]
    ),
    ...buildSignatureBlock(bundle, font),
  ]);
}

export async function generateCpTpDocx(
  bundle: DocxIdentityBundle,
  cps: LearningOutcomeCP[],
  tps: LearningObjectiveTP[]
): Promise<Blob> {
  const font = getFont(bundle);
  return createA4DocumentBlob(bundle, 'Capaian & Tujuan Pembelajaran', [
    ...buildKopSurat(bundle, font),
    pText('CAPAIAN PEMBELAJARAN (CP) DAN TUJUAN PEMBELAJARAN (TP)', font, {
      bold: true,
      size: FONT_SIZE_TITLE,
      align: AlignmentType.CENTER,
      spaceAfter: 120,
    }),
    pText('A. CAPAIAN PEMBELAJARAN (CP)', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceAfter: 60 }),
    buildDataTable(
      ['No', 'Mapel / Fase / Kelas', 'Elemen', 'Deskripsi CP'],
      cps.map((c, idx) => [
        String(idx + 1),
        `${c.subject}\nFase ${c.phase} · Kelas ${c.gradeLevel}`,
        c.element,
        c.description,
      ]),
      font,
      [7, 22, 18, 53]
    ),
    pText('B. TUJUAN PEMBELAJARAN (TP)', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 160, spaceAfter: 60 }),
    buildDataTable(
      ['Kode TP', 'Kelas / Sem', 'Materi Pokok', 'Rumusan Tujuan Pembelajaran', 'Alokasi'],
      tps.map((t) => [
        t.code,
        `Kls ${t.gradeLevel} / S${t.semester}`,
        t.material,
        t.objective,
        `${t.hoursAllocation} JP`,
      ]),
      font,
      [12, 13, 20, 45, 10]
    ),
    ...buildSignatureBlock(bundle, font),
  ]);
}

export async function generateAtpDocx(
  bundle: DocxIdentityBundle,
  atp: ATPDocument,
  cp: LearningOutcomeCP | undefined,
  tps: LearningObjectiveTP[]
): Promise<Blob> {
  const font = getFont(bundle);
  const tpMap = new Map(tps.map((t) => [t.id, t]));
  return createA4DocumentBlob(
    bundle,
    `ATP ${atp.subject} Kelas ${atp.gradeLevel}`,
    [
      ...buildKopSurat(bundle, font),
      pText('ALUR TUJUAN PEMBELAJARAN (ATP)', font, {
        bold: true,
        size: FONT_SIZE_TITLE,
        align: AlignmentType.CENTER,
        spaceAfter: 120,
      }),
      buildInfoGrid(
        [
          ['Mata Pelajaran', atp.subject],
          ['Fase / Kelas / Semester', `Fase ${atp.phase} / Kelas ${atp.gradeLevel} / Semester ${atp.semester}`],
          ['Tahun Ajaran', bundle.academicYear?.name || '-'],
          ['Capaian Pembelajaran', cp?.description || '-'],
        ],
        font
      ),
      pText('', font, { spaceAfter: 80 }),
      buildDataTable(
        ['Urutan', 'Kode TP', 'Tujuan Pembelajaran', 'Materi', 'Minggu Rencana', 'Alokasi JP', 'Catatan'],
        atp.items
          .slice()
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((item, idx) => {
            const tp = tpMap.get(item.tpId);
            return [
              String(idx + 1),
              tp?.code ?? '-',
              tp?.objective ?? '-',
              tp?.material ?? '-',
              `Minggu ${item.plannedWeekStart}–${item.plannedWeekEnd}`,
              `${item.hoursAllocation} JP`,
              item.notes || '-',
            ];
          }),
        font,
        [8, 11, 32, 18, 12, 9, 10]
      ),
      ...buildSignatureBlock(bundle, font),
    ],
    true
  );
}

export async function generateProtaDocx(
  bundle: DocxIdentityBundle,
  items: ProtaItem[],
  tps: LearningObjectiveTP[],
  subject: string,
  gradeLevel: string
): Promise<Blob> {
  const font = getFont(bundle);
  const tpMap = new Map(tps.map((t) => [t.id, t]));
  return createA4DocumentBlob(
    bundle,
    `PROTA ${subject} Kelas ${gradeLevel}`,
    [
      ...buildKopSurat(bundle, font),
      pText('PROGRAM TAHUNAN (PROTA)', font, {
        bold: true,
        size: FONT_SIZE_TITLE,
        align: AlignmentType.CENTER,
        spaceAfter: 120,
      }),
      buildInfoGrid(
        [
          ['Mata Pelajaran', subject],
          ['Kelas / Tahun Ajaran', `Kelas ${gradeLevel} / ${bundle.academicYear?.name || '-'}`],
          ['Guru Pengampu', bundle.teacher.fullName || '-'],
        ],
        font
      ),
      pText('', font, { spaceAfter: 80 }),
      buildDataTable(
        ['No', 'Semester', 'Kode & Tujuan Pembelajaran', 'Materi Pokok', 'Minggu Rencana', 'Alokasi Waktu', 'Keterangan'],
        items.map((it, idx) => {
          const tp = tpMap.get(it.tpId);
          return [
            String(idx + 1),
            `Sem ${it.semester}`,
            tp ? `${tp.code}: ${tp.objective}` : '-',
            it.material,
            it.plannedWeeks,
            `${it.hoursAllocation} JP`,
            it.notes || '-',
          ];
        }),
        font,
        [6, 9, 34, 20, 12, 9, 10]
      ),
      ...buildSignatureBlock(bundle, font),
    ],
    true
  );
}

export async function generatePromesDocx(
  bundle: DocxIdentityBundle,
  items: PromesItem[],
  tps: LearningObjectiveTP[],
  subject: string,
  gradeLevel: string,
  semester: 1 | 2
): Promise<Blob> {
  const font = getFont(bundle);
  const tpMap = new Map(tps.map((t) => [t.id, t]));
  return createA4DocumentBlob(
    bundle,
    `PROMES ${subject} Kelas ${gradeLevel} Sem ${semester}`,
    [
      ...buildKopSurat(bundle, font),
      pText(`PROGRAM SEMESTER (PROMES) - SEMESTER ${semester}`, font, {
        bold: true,
        size: FONT_SIZE_TITLE,
        align: AlignmentType.CENTER,
        spaceAfter: 120,
      }),
      buildInfoGrid(
        [
          ['Mata Pelajaran', subject],
          ['Kelas / Semester', `Kelas ${gradeLevel} / Semester ${semester}`],
          ['Tahun Ajaran', bundle.academicYear?.name || '-'],
        ],
        font
      ),
      pText('', font, { spaceAfter: 80 }),
      buildDataTable(
        ['No', 'Bulan / Minggu', 'Tanggal', 'Materi & TP', 'JP', 'Kegiatan Pembelajaran', 'Asesmen', 'Ket'],
        items.map((it, idx) => {
          const tp = tpMap.get(it.tpId);
          return [
            String(idx + 1),
            `${it.month} (M${it.weekNumber})`,
            it.dateRange || '-',
            `${it.material}\n(${tp?.code ?? '-'})`,
            `${it.hoursAllocation}`,
            it.activity || '-',
            it.assessment || '-',
            it.notes || '-',
          ];
        }),
        font,
        [5, 13, 12, 24, 6, 17, 13, 10]
      ),
      ...buildSignatureBlock(bundle, font),
    ],
    true
  );
}

export async function generateSyllabusDocx(
  bundle: DocxIdentityBundle,
  items: SyllabusItem[],
  tps: LearningObjectiveTP[],
  cps: LearningOutcomeCP[],
  subject: string,
  gradeLevel: string
): Promise<Blob> {
  const font = getFont(bundle);
  const tpMap = new Map(tps.map((t) => [t.id, t]));
  const cpMap = new Map(cps.map((c) => [c.id, c]));
  return createA4DocumentBlob(
    bundle,
    `Silabus ${subject} Kelas ${gradeLevel}`,
    [
      ...buildKopSurat(bundle, font),
      pText('SILABUS PEMBELAJARAN', font, {
        bold: true,
        size: FONT_SIZE_TITLE,
        align: AlignmentType.CENTER,
        spaceAfter: 120,
      }),
      buildInfoGrid(
        [
          ['Mata Pelajaran', subject],
          ['Kelas / Tahun Ajaran', `Kelas ${gradeLevel} / ${bundle.academicYear?.name || '-'}`],
          ['Guru Mata Pelajaran', bundle.teacher.fullName || '-'],
        ],
        font
      ),
      pText('', font, { spaceAfter: 80 }),
      buildDataTable(
        ['No', 'CP & TP', 'Materi', 'Kegiatan Pembelajaran', 'Metode & Media', 'Sumber Belajar', 'Asesmen', 'JP'],
        items.map((it, idx) => {
          const tp = tpMap.get(it.tpId);
          const cp = cpMap.get(it.cpId);
          return [
            String(idx + 1),
            `${cp ? `Elemen: ${cp.element}\n` : ''}${tp ? `${tp.code}: ${tp.objective}` : '-'}`,
            it.material,
            it.learningActivities,
            `Metode: ${it.method}\nMedia: ${it.media}`,
            it.resources,
            it.assessment,
            `${it.hoursAllocation}`,
          ];
        }),
        font,
        [5, 20, 13, 22, 13, 11, 11, 5]
      ),
      ...buildSignatureBlock(bundle, font),
    ],
    true
  );
}

export async function generateTeachingModuleDocx(
  bundle: DocxIdentityBundle,
  mod: TeachingModule,
  tpList: LearningObjectiveTP[],
  cp?: LearningOutcomeCP
): Promise<Blob> {
  const font = getFont(bundle);
  const sections: Array<[string, string]> = [
    ['1. Identitas Modul', mod.moduleIdentity || mod.title],
    ['2. Informasi Umum', mod.generalInfo],
    ['3. Kompetensi Awal', mod.initialCompetency],
    ['4. Profil Pelajar / Karakter yang Dituju', mod.pancasilaProfile],
    ['5. Sarana dan Prasarana', mod.facilities],
    ['6. Target Peserta Didik', mod.targetStudents],
    ['7. Model Pembelajaran', `${mod.learningModel} (Metode: ${mod.methods})`],
    ['8. Capaian Pembelajaran (CP)', cp?.description || '-'],
    ['9. Tujuan Pembelajaran (TP)', tpList.map((t) => `• ${t.code}: ${t.objective}`).join('\n') || '-'],
    ['10. Pemahaman Bermakna', mod.meaningfulUnderstanding],
    ['11. Pertanyaan Pemantik', mod.triggerQuestions],
    ['12. Materi Pokok', mod.material],
    ['13. Kegiatan Pendahuluan', mod.openingActivity],
    ['14. Kegiatan Inti', mod.coreActivity],
    ['15. Kegiatan Penutup', mod.closingActivity],
    ['16. Asesmen Diagnostik', mod.diagnosticAssessment],
    ['17. Asesmen Formatif', mod.formativeAssessment],
    ['18. Asesmen Sumatif', mod.summativeAssessment],
    ['19. Rubrik Penilaian', mod.rubric],
    ['20. Pengayaan', mod.enrichment],
    ['21. Remedial', mod.remedial],
    ['22. Refleksi Guru', mod.teacherReflection],
    ['23. Refleksi Peserta Didik', mod.studentReflection],
    ['24. Lampiran', mod.attachment],
  ];

  const paragraphs: Array<Paragraph | Table> = [
    ...buildKopSurat(bundle, font),
    pText(`MODUL AJAR / RPP: ${mod.title.toUpperCase()}`, font, {
      bold: true,
      size: FONT_SIZE_TITLE,
      align: AlignmentType.CENTER,
      spaceAfter: 120,
    }),
    buildInfoGrid(
      [
        ['Mata Pelajaran', mod.subject],
        ['Kelas / Semester', `Kelas ${mod.gradeLevel} / Semester ${mod.semester}`],
        ['Alokasi Waktu', `${mod.meetingsCount} Pertemuan (${mod.hoursAllocation} JP)`],
        ['Media & Sumber Belajar', `${mod.media || '-'} | ${mod.resources || '-'}`],
      ],
      font
    ),
    pText('', font, { spaceAfter: 80 }),
  ];

  for (const [heading, content] of sections) {
    paragraphs.push(
      pText(heading, font, {
        bold: true,
        size: FONT_SIZE_SUBTITLE,
        spaceBefore: 120,
        spaceAfter: 40,
      })
    );
    paragraphs.push(pText(content || '-', font, { size: FONT_SIZE_BODY, spaceAfter: 60 }));
  }

  paragraphs.push(...buildSignatureBlock(bundle, font));
  return createA4DocumentBlob(bundle, `Modul Ajar - ${mod.title}`, paragraphs);
}

export async function generateLkpdDocx(
  bundle: DocxIdentityBundle,
  lkpd: LKPDDocument,
  tp?: LearningObjectiveTP
): Promise<Blob> {
  const font = getFont(bundle);
  const children: Array<Paragraph | Table> = [
    ...buildKopSurat(bundle, font),
    pText(`LEMBAR KERJA PESERTA DIDIK (LKPD - ${lkpd.type.toUpperCase()})`, font, {
      bold: true,
      size: FONT_SIZE_TITLE,
      align: AlignmentType.CENTER,
      spaceAfter: 40,
    }),
    pText(lkpd.title, font, {
      bold: true,
      size: FONT_SIZE_SUBTITLE,
      align: AlignmentType.CENTER,
      spaceAfter: 120,
    }),
    buildInfoGrid(
      [
        ['Nama Siswa / Kelompok', '........................................................................'],
        ['Kelas / Tanggal', `Kelas ${lkpd.gradeLevel} / ${lkpd.date || '....................'}`],
        ['Mata Pelajaran', lkpd.subject],
        ['Materi Pokok', lkpd.material],
        ['Tujuan Pembelajaran', tp ? `${tp.code}: ${tp.objective}` : '-'],
      ],
      font
    ),
    pText('A. Tujuan Kegiatan', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 120, spaceAfter: 40 }),
    pText(lkpd.activityGoal || '-', font),
    pText('B. Petunjuk Belajar', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 100, spaceAfter: 40 }),
    pText(lkpd.instructions || '-', font),
    pText('C. Alat dan Bahan', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 100, spaceAfter: 40 }),
    pText(lkpd.toolsAndMaterials || '-', font),
    pText('D. Ringkasan Materi', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 100, spaceAfter: 40 }),
    pText(lkpd.materialSummary || '-', font),
    pText('E. Langkah Kerja & Aktivitas', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 100, spaceAfter: 40 }),
    pText(`${lkpd.workSteps}\n${lkpd.activities}`, font),
    pText('F. Tabel Pengamatan', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 100, spaceAfter: 40 }),
    buildDataTable(
      lkpd.observationTableHeaders.length > 0
        ? lkpd.observationTableHeaders
        : ['No', 'Aspek Pengamatan', 'Hasil', 'Keterangan'],
      lkpd.observationTableRows.length > 0
        ? lkpd.observationTableRows
        : [['1', '', '', ''], ['2', '', '', '']],
      font
    ),
    pText('G. Pertanyaan & Tugas', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 120, spaceAfter: 40 }),
    pText(`${lkpd.questions}\n\n${lkpd.tasks}`, font),
    pText('H. Kesimpulan & Refleksi', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 100, spaceAfter: 40 }),
    pText(`${lkpd.conclusionPrompt}\n\nRefleksi: ${lkpd.reflectionPrompt}`, font),
    pText('I. Rubrik Penilaian Guru', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 100, spaceAfter: 40 }),
    pText(lkpd.rubric || '-', font),
    ...buildSignatureBlock(bundle, font),
  ];

  return createA4DocumentBlob(bundle, `LKPD - ${lkpd.title}`, children);
}

export async function generateAssessmentQuestionsDocx(
  bundle: DocxIdentityBundle,
  assessment: Assessment,
  questions: QuestionBankItem[]
): Promise<Blob> {
  const font = getFont(bundle);
  const children: Array<Paragraph | Table> = [
    ...buildKopSurat(bundle, font),
    pText(`NASKAH SOAL ${assessment.category.toUpperCase()}`, font, {
      bold: true,
      size: FONT_SIZE_TITLE,
      align: AlignmentType.CENTER,
      spaceAfter: 40,
    }),
    pText(assessment.name, font, {
      bold: true,
      size: FONT_SIZE_SUBTITLE,
      align: AlignmentType.CENTER,
      spaceAfter: 120,
    }),
    buildInfoGrid(
      [
        ['Mata Pelajaran', assessment.subject],
        ['Kelas / Semester', `Kelas ${assessment.gradeLevel} / Semester ${assessment.semester}`],
        ['Tanggal Pelaksanaan', assessment.date || '-'],
        ['Materi', assessment.material || '-'],
        ['Nama Siswa / NIS', '.......................................................... / ....................'],
      ],
      font
    ),
    pText('PETUNJUK: Bacalah setiap butir soal dengan cermat dan jawablah sesuai perintah.', font, {
      italic: true,
      size: FONT_SIZE_SMALL,
      spaceBefore: 100,
      spaceAfter: 120,
    }),
  ];

  questions.forEach((q, idx) => {
    children.push(
      pText(`${idx + 1}. [${q.questionType}] ${q.questionText}`, font, {
        bold: false,
        size: FONT_SIZE_BODY,
        spaceBefore: 80,
        spaceAfter: 40,
      })
    );
    if (q.options && q.options.length > 0) {
      const letters = ['A', 'B', 'C', 'D', 'E'];
      q.options.forEach((opt, oIdx) => {
        children.push(
          pText(`    ${letters[oIdx] || oIdx + 1}. ${opt}`, font, {
            size: FONT_SIZE_BODY,
            spaceAfter: 20,
          })
        );
      });
    }
  });

  return createA4DocumentBlob(bundle, `Naskah Soal - ${assessment.name}`, children);
}

export async function generateBlueprintDocx(
  bundle: DocxIdentityBundle,
  assessment: Assessment,
  questions: QuestionBankItem[],
  tps: LearningObjectiveTP[]
): Promise<Blob> {
  const font = getFont(bundle);
  const tpMap = new Map(tps.map((t) => [t.id, t]));
  const rows =
    assessment.blueprint.length > 0
      ? assessment.blueprint.map((b) => [
          String(b.number),
          b.tpCode,
          b.material,
          b.indicator,
          b.cognitiveLevel,
          b.questionType,
          b.questionNumber,
          String(b.maxScore),
        ])
      : questions.map((q, idx) => {
          const tp = tpMap.get(q.tpId);
          return [
            String(idx + 1),
            tp?.code ?? '-',
            q.material,
            q.indicator || '-',
            q.cognitiveLevel,
            q.questionType,
            String(idx + 1),
            String(q.maxScore),
          ];
        });

  return createA4DocumentBlob(
    bundle,
    `Kisi-Kisi ${assessment.name}`,
    [
      ...buildKopSurat(bundle, font),
      pText(`KISI-KISI PENULISAN SOAL: ${assessment.name.toUpperCase()}`, font, {
        bold: true,
        size: FONT_SIZE_TITLE,
        align: AlignmentType.CENTER,
        spaceAfter: 120,
      }),
      buildInfoGrid(
        [
          ['Mata Pelajaran', assessment.subject],
          ['Kelas / Semester', `Kelas ${assessment.gradeLevel} / Semester ${assessment.semester}`],
          ['Jenis Asesmen', assessment.category],
        ],
        font
      ),
      pText('', font, { spaceAfter: 80 }),
      buildDataTable(
        ['No', 'Kode TP', 'Materi', 'Indikator Soal', 'Level', 'Bentuk Soal', 'No Soal', 'Skor'],
        rows,
        font,
        [6, 11, 17, 32, 8, 12, 7, 7]
      ),
      ...buildSignatureBlock(bundle, font),
    ],
    true
  );
}

export async function generateAnswerKeyDocx(
  bundle: DocxIdentityBundle,
  assessment: Assessment,
  questions: QuestionBankItem[]
): Promise<Blob> {
  const font = getFont(bundle);
  return createA4DocumentBlob(bundle, `Kunci Jawaban ${assessment.name}`, [
    ...buildKopSurat(bundle, font),
    pText(`KUNCI JAWABAN & PEDOMAN PENSKORAN: ${assessment.name.toUpperCase()}`, font, {
      bold: true,
      size: FONT_SIZE_TITLE,
      align: AlignmentType.CENTER,
      spaceAfter: 120,
    }),
    buildDataTable(
      ['No Soal', 'Bentuk Soal', 'Kunci Jawaban', 'Pembahasan', 'Skor Maks'],
      questions.map((q, idx) => [
        String(idx + 1),
        q.questionType,
        q.correctAnswer || '-',
        q.explanation || '-',
        String(q.maxScore),
      ]),
      font,
      [9, 16, 22, 43, 10]
    ),
    pText('Pedoman Penskoran:', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 140, spaceAfter: 40 }),
    pText(assessment.scoringGuide || 'Nilai Akhir = (Total Skor Perolehan / Total Skor Maksimal) × 100', font),
    ...(assessment.rubric.length > 0
      ? [
          pText('Rubrik Penilaian:', font, { bold: true, size: FONT_SIZE_SUBTITLE, spaceBefore: 120, spaceAfter: 40 }),
          buildDataTable(
            ['Kriteria', 'Sangat Baik', 'Baik', 'Cukup', 'Perlu Bimbingan', 'Skor'],
            assessment.rubric.map((r) => [
              r.criteria,
              r.excellent,
              r.good,
              r.fair,
              r.needsGuidance,
              String(r.maxScore),
            ]),
            font
          ),
        ]
      : []),
    ...buildSignatureBlock(bundle, font),
  ]);
}

export async function generateAttendanceDocx(
  bundle: DocxIdentityBundle,
  classGroup: ClassGroup,
  students: Student[],
  sessions: AttendanceSession[]
): Promise<Blob> {
  const font = getFont(bundle);
  const sortedStudents = students.slice().sort((a, b) => a.orderNumber - b.orderNumber);
  const sortedSessions = sessions.slice().sort((a, b) => a.date.localeCompare(b.date));

  const rows = sortedStudents.map((st, idx) => {
    let h = 0, s = 0, i = 0, a = 0;
    for (const sess of sortedSessions) {
      const rec = sess.records.find((r) => r.studentId === st.id);
      if (rec?.status === 'H') h++;
      else if (rec?.status === 'S') s++;
      else if (rec?.status === 'I') i++;
      else if (rec?.status === 'A') a++;
    }
    const total = h + s + i + a;
    const pct = total > 0 ? `${Math.round((h / total) * 1000) / 10}%` : '-';
    return [
      String(idx + 1),
      st.nis || '-',
      st.fullName,
      String(h),
      String(s),
      String(i),
      String(a),
      pct,
    ];
  });

  return createA4DocumentBlob(bundle, `Rekap Presensi ${classGroup.name}`, [
    ...buildKopSurat(bundle, font),
    pText(`REKAPITULASI PRESENSI SISWA KELAS ${classGroup.name.toUpperCase()}`, font, {
      bold: true,
      size: FONT_SIZE_TITLE,
      align: AlignmentType.CENTER,
      spaceAfter: 120,
    }),
    buildInfoGrid(
      [
        ['Kelas / Mata Pelajaran', `${classGroup.name} / ${classGroup.subject || '-'}`],
        ['Jumlah Pertemuan Tercatat', `${sortedSessions.length} Pertemuan`],
        ['Tahun Ajaran / Semester', `${bundle.academicYear?.name || '-'} / Semester ${classGroup.semester}`],
      ],
      font
    ),
    pText('', font, { spaceAfter: 80 }),
    buildDataTable(
      ['No', 'NIS', 'Nama Siswa', 'Hadir', 'Sakit', 'Izin', 'Alpa', '% Kehadiran'],
      rows,
      font,
      [7, 13, 35, 8, 8, 8, 8, 13]
    ),
    ...buildSignatureBlock(bundle, font),
  ]);
}

export async function generateJournalsDocx(
  bundle: DocxIdentityBundle,
  classGroup: ClassGroup,
  journals: TeachingJournal[],
  tps: LearningObjectiveTP[]
): Promise<Blob> {
  const font = getFont(bundle);
  const tpMap = new Map(tps.map((t) => [t.id, t]));
  const sorted = journals.slice().sort((a, b) => a.date.localeCompare(b.date));

  return createA4DocumentBlob(
    bundle,
    `Jurnal Mengajar ${classGroup.name}`,
    [
      ...buildKopSurat(bundle, font),
      pText(`JURNAL MENGAJAR GURU - KELAS ${classGroup.name.toUpperCase()}`, font, {
        bold: true,
        size: FONT_SIZE_TITLE,
        align: AlignmentType.CENTER,
        spaceAfter: 120,
      }),
      buildInfoGrid(
        [
          ['Mata Pelajaran', classGroup.subject || bundle.teacher.subjects.join(', ')],
          ['Guru Pengampu', bundle.teacher.fullName || '-'],
          ['Tahun Ajaran', bundle.academicYear?.name || '-'],
        ],
        font
      ),
      pText('', font, { spaceAfter: 80 }),
      buildDataTable(
        ['No', 'Tanggal / Hari', 'Pertemuan & Jam', 'TP & Materi', 'Kegiatan & Metode', 'Kehadiran', 'Refleksi & Tindak Lanjut'],
        sorted.map((j, idx) => {
          const tp = tpMap.get(j.tpId);
          return [
            String(idx + 1),
            `${j.date}\n(${j.dayName})`,
            `P${j.meetingNumber}\nJam ${j.lessonHours}`,
            `${tp ? `${tp.code}\n` : ''}${j.material}`,
            `${j.activities}\n[Metode: ${j.method}]`,
            j.attendanceSummary || '-',
            `${j.reflection}\nTindak lanjut: ${j.followUp}`,
          ];
        }),
        font,
        [5, 13, 11, 18, 22, 12, 19]
      ),
      ...buildSignatureBlock(bundle, font),
    ],
    true
  );
}

export async function generateGradesDocx(
  bundle: DocxIdentityBundle,
  classGroup: ClassGroup,
  components: GradeComponent[],
  analytics: ClassGradeAnalytics
): Promise<Blob> {
  const font = getFont(bundle);
  const headers = [
    'No',
    'NIS',
    'Nama Siswa',
    ...components.map((c) => `${c.name} (${c.weight}%)`),
    'Nilai Akhir',
    'Status',
  ];

  const rows = analytics.studentSummaries.map((s, idx) => [
    String(idx + 1),
    s.student.nis || '-',
    s.student.fullName,
    ...components.map((c) =>
      s.componentScores[c.id] !== null ? String(s.componentScores[c.id]) : '-'
    ),
    s.finalScore !== null ? String(s.finalScore) : '-',
    s.status,
  ]);

  return createA4DocumentBlob(
    bundle,
    `Daftar & Rekap Nilai ${classGroup.name}`,
    [
      ...buildKopSurat(bundle, font),
      pText(`DAFTAR NILAI DAN REKAP CAPAIAN - KELAS ${classGroup.name.toUpperCase()}`, font, {
        bold: true,
        size: FONT_SIZE_TITLE,
        align: AlignmentType.CENTER,
        spaceAfter: 120,
      }),
      buildInfoGrid(
        [
          ['Mata Pelajaran', classGroup.subject || bundle.teacher.subjects.join(', ')],
          ['Rata-rata Kelas', analytics.classAverage !== null ? String(analytics.classAverage) : '-'],
          ['Nilai Tertinggi / Terendah', `${analytics.highestScore ?? '-'} / ${analytics.lowestScore ?? '-'}`],
          ['Ketuntasan', `${analytics.tuntasCount} Tuntas, ${analytics.remedialCount} Perlu Remedial (${analytics.passPercentage}%)`],
        ],
        font
      ),
      pText('', font, { spaceAfter: 80 }),
      buildDataTable(headers, rows, font),
      ...buildSignatureBlock(bundle, font),
    ],
    true
  );
}

export async function generateReportDescriptionsDocx(
  bundle: DocxIdentityBundle,
  classGroup: ClassGroup,
  students: Student[],
  descriptions: ReportDescription[]
): Promise<Blob> {
  const font = getFont(bundle);
  const descMap = new Map(descriptions.map((d) => [d.studentId, d]));
  const sorted = students.slice().sort((a, b) => a.orderNumber - b.orderNumber);

  return createA4DocumentBlob(
    bundle,
    `Deskripsi Rapor ${classGroup.name}`,
    [
      ...buildKopSurat(bundle, font),
      pText(`REKAP DESKRIPSI CAPAIAN RAPOR - KELAS ${classGroup.name.toUpperCase()}`, font, {
        bold: true,
        size: FONT_SIZE_TITLE,
        align: AlignmentType.CENTER,
        spaceAfter: 120,
      }),
      buildInfoGrid(
        [
          ['Mata Pelajaran', classGroup.subject || bundle.teacher.subjects.join(', ')],
          ['Tahun Ajaran / Semester', `${bundle.academicYear?.name || '-'} / Semester ${classGroup.semester}`],
        ],
        font
      ),
      pText('', font, { spaceAfter: 80 }),
      buildDataTable(
        ['No', 'NIS', 'Nama Siswa', 'Nilai Akhir', 'Deskripsi Capaian Kompetensi', 'Tindak Lanjut'],
        sorted.map((s, idx) => {
          const d = descMap.get(s.id);
          return [
            String(idx + 1),
            s.nis || '-',
            s.fullName,
            d?.finalScore !== null && d?.finalScore !== undefined ? String(d.finalScore) : '-',
            d?.descriptionText || '(Belum disusun)',
            d?.followUpNote || '-',
          ];
        }),
        font,
        [6, 11, 20, 9, 38, 16]
      ),
      ...buildSignatureBlock(bundle, font),
    ],
    true
  );
}

// =========================================================
// CUSTOM SCHOOL TEMPLATE ENGINE (.docx with {{PLACEHOLDERS}})
// =========================================================

export function extractDocxPlaceholders(base64: string): string[] {
  try {
    const clean = base64.includes(',') ? base64.split(',')[1] : base64;
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const zip = new PizZip(bytes);
    const xml = zip.files['word/document.xml']?.asText() || '';
    const stripped = xml.replace(/<[^>]+>/g, '');
    const matches = stripped.match(/\{\{([A-Z0-9_]+)\}\}/g) ?? [];
    return Array.from(new Set(matches.map((m) => m.replace(/\{|\}/g, ''))));
  } catch {
    return [];
  }
}

export function renderCustomDocxTemplate(
  base64: string,
  dataMap: Record<string, string | number>
): Blob {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const zip = new PizZip(bytes);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });
  doc.render(dataMap);
  return doc.getZip().generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
