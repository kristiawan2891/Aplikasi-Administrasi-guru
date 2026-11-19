import * as XLSX from 'xlsx';
import type {
  AttendanceSession,
  ClassGroup,
  Gender,
  GradeComponent,
  Student,
  StudentGrade,
  StudentStatus,
} from '../types/domain';
import type { StudentGradeSummary } from './gradeEngine';

export function downloadStudentImportTemplate(): void {
  const wb = XLSX.utils.book_new();
  const sampleData = [
    {
      'No Urut': 1,
      NIS: '2026001',
      NISN: '0123456789',
      'Nama Lengkap': 'Contoh Nama Siswa',
      'Jenis Kelamin (L/P)': 'L',
      'Status (Aktif/Pindah/Nonaktif)': 'Aktif',
      Keterangan: '',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 32 },
    { wch: 20 },
    { wch: 28 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Data_Siswa');

  const infoSheet = XLSX.utils.aoa_to_sheet([
    ['PANDUAN IMPOR DATA SISWA - GURU ADMIN PRO'],
    ['1. Isi data mulai baris ke-2 pada sheet Data_Siswa (ganti baris contoh).'],
    ['2. Kolom Wajib: Nama Lengkap.'],
    ['3. Jenis Kelamin diisi L atau P.'],
    ['4. Status diisi Aktif, Pindah, atau Nonaktif (default Aktif).'],
    ['5. Jangan mengubah nama header kolom pada baris pertama.'],
  ]);
  infoSheet['!cols'] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(wb, infoSheet, 'Panduan');

  XLSX.writeFile(wb, 'Template_Impor_Siswa_GuruAdminPro.xlsx');
}

export interface ParsedStudentRow {
  orderNumber: number;
  nis: string;
  nisn: string;
  fullName: string;
  gender: Gender;
  status: StudentStatus;
  notes: string;
}

export async function parseStudentExcelFile(
  file: File
): Promise<ParsedStudentRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  const result: ParsedStudentRow[] = [];
  rows.forEach((row, idx) => {
    const normalizeKey = (candidates: string[]) => {
      for (const k of Object.keys(row)) {
        const lower = k.trim().toLowerCase();
        if (candidates.some((c) => lower.includes(c))) {
          return String(row[k] ?? '').trim();
        }
      }
      return '';
    };

    const fullName = normalizeKey(['nama lengkap', 'nama siswa', 'nama']);
    if (!fullName || fullName.toLowerCase() === 'contoh nama siswa') {
      return;
    }

    const rawGender = normalizeKey(['jenis kelamin', 'kelamin', 'jk', 'gender']).toUpperCase();
    const gender: Gender =
      rawGender.startsWith('P') || rawGender === 'PEREMPUAN' || rawGender === 'W'
        ? 'P'
        : 'L';

    const rawStatus = normalizeKey(['status']);
    let status: StudentStatus = 'Aktif';
    if (rawStatus.toLowerCase().includes('pindah')) status = 'Pindah';
    else if (rawStatus.toLowerCase().includes('non')) status = 'Nonaktif';

    const orderNumRaw = Number(normalizeKey(['no urut', 'no', 'urut']));
    result.push({
      orderNumber: Number.isFinite(orderNumRaw) && orderNumRaw > 0 ? orderNumRaw : idx + 1,
      nis: normalizeKey(['nis']),
      nisn: normalizeKey(['nisn']),
      fullName,
      gender,
      status,
      notes: normalizeKey(['keterangan', 'catatan']),
    });
  });

  return result;
}

export function exportStudentsToExcel(
  classGroup: ClassGroup,
  students: Student[]
): void {
  const rows = students
    .slice()
    .sort((a, b) => a.orderNumber - b.orderNumber)
    .map((s, idx) => ({
      'No Urut': s.orderNumber || idx + 1,
      NIS: s.nis,
      NISN: s.nisn,
      'Nama Lengkap': s.fullName,
      'L/P': s.gender,
      Kelas: classGroup.name,
      Status: s.status,
      Keterangan: s.notes,
    }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 32 },
    { wch: 6 },
    { wch: 10 },
    { wch: 12 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, `Siswa_${classGroup.name}`);
  XLSX.writeFile(wb, `Daftar_Siswa_${classGroup.name}.xlsx`);
}

export function exportAttendanceToExcel(
  classGroup: ClassGroup,
  students: Student[],
  sessions: AttendanceSession[]
): void {
  const sortedStudents = students
    .slice()
    .sort((a, b) => a.orderNumber - b.orderNumber);
  const sortedSessions = sessions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const rows = sortedStudents.map((st, idx) => {
    const row: Record<string, string | number> = {
      No: idx + 1,
      NIS: st.nis,
      'Nama Siswa': st.fullName,
    };
    let h = 0;
    let s = 0;
    let i = 0;
    let a = 0;
    sortedSessions.forEach((sess, sIdx) => {
      const rec = sess.records.find((r) => r.studentId === st.id);
      const val = rec?.status ?? '-';
      row[`P${sess.meetingNumber || sIdx + 1} (${sess.date})`] = val;
      if (val === 'H') h++;
      else if (val === 'S') s++;
      else if (val === 'I') i++;
      else if (val === 'A') a++;
    });
    const total = h + s + i + a;
    row['Hadir'] = h;
    row['Sakit'] = s;
    row['Izin'] = i;
    row['Alpa'] = a;
    row['Persentase Hadir (%)'] = total > 0 ? Math.round((h / total) * 1000) / 10 : 0;
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, `Presensi_${classGroup.name}`);
  XLSX.writeFile(wb, `Rekap_Presensi_${classGroup.name}.xlsx`);
}

export function downloadGradeImportTemplate(
  classGroup: ClassGroup,
  students: Student[],
  components: GradeComponent[]
): void {
  const sortedStudents = students
    .slice()
    .sort((a, b) => a.orderNumber - b.orderNumber);

  const rows = sortedStudents.map((st, idx) => {
    const row: Record<string, string | number> = {
      No: idx + 1,
      NIS: st.nis,
      'Nama Lengkap': st.fullName,
    };
    for (const c of components) {
      row[c.name] = '';
    }
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, `Nilai_${classGroup.name}`);
  XLSX.writeFile(wb, `Template_Nilai_${classGroup.name}.xlsx`);
}

export async function parseGradeExcelFile(
  file: File,
  students: Student[],
  components: GradeComponent[]
): Promise<Array<{ studentId: string; componentId: string; score: number }>> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
  });

  const results: Array<{ studentId: string; componentId: string; score: number }> =
    [];

  for (const row of rows) {
    const nisVal = String(row['NIS'] ?? row['nis'] ?? '').trim();
    const nameVal = String(
      row['Nama Lengkap'] ?? row['Nama Siswa'] ?? row['Nama'] ?? ''
    )
      .trim()
      .toLowerCase();

    const matchedStudent = students.find(
      (s) =>
        (nisVal && s.nis.trim() === nisVal) ||
        (nameVal && s.fullName.trim().toLowerCase() === nameVal)
    );
    if (!matchedStudent) continue;

    for (const comp of components) {
      const rawKey = Object.keys(row).find(
        (k) => k.trim().toLowerCase() === comp.name.trim().toLowerCase()
      );
      if (!rawKey) continue;
      const rawVal = row[rawKey];
      if (rawVal === '' || rawVal === null || rawVal === undefined) continue;
      const num = Number(rawVal);
      if (Number.isFinite(num) && num >= 0 && num <= 100) {
        results.push({
          studentId: matchedStudent.id,
          componentId: comp.id,
          score: num,
        });
      }
    }
  }

  return results;
}

export function exportGradesToExcel(params: {
  classGroup: ClassGroup;
  components: GradeComponent[];
  summaries: StudentGradeSummary[];
}): void {
  const { classGroup, components, summaries } = params;
  const rows = summaries.map((s, idx) => {
    const row: Record<string, string | number> = {
      No: idx + 1,
      NIS: s.student.nis,
      NISN: s.student.nisn,
      'Nama Lengkap': s.student.fullName,
    };
    for (const comp of components) {
      const val = s.componentScores[comp.id];
      row[`${comp.name} (${comp.weight}%)`] = val !== null ? val : '-';
    }
    row['Nilai Akhir'] = s.finalScore !== null ? s.finalScore : '-';
    row['Status'] = s.status;
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, `Nilai_${classGroup.name}`);
  XLSX.writeFile(wb, `Daftar_Nilai_${classGroup.name}.xlsx`);
}
