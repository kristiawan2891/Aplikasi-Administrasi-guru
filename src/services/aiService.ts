import type {
  DifficultyLevel,
  LearningObjectiveTP,
  LearningOutcomeCP,
  LKPDType,
  QuestionType,
  SchoolProfile,
  SemesterNumber,
  TeacherProfile,
} from '../types/domain';

export interface AiContext {
  school: SchoolProfile;
  teacher: TeacherProfile;
  academicYearName: string;
  semester: SemesterNumber;
  effectiveWeeksCount?: number;
}

export async function checkAiStatus(): Promise<{ configured: boolean }> {
  try {
    const res = await fetch('/api/gemini/status');
    if (!res.ok) return { configured: false };
    return (await res.json()) as { configured: boolean };
  } catch {
    return { configured: false };
  }
}

async function callGemini<T = string>(params: {
  prompt: string;
  systemInstruction: string;
  jsonMode?: boolean;
}): Promise<T> {
  const res = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: params.prompt,
      systemInstruction: params.systemInstruction,
      responseMimeType: params.jsonMode ? 'application/json' : undefined,
    }),
  });

  const data = (await res.json()) as { text?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memanggil AI Asisten Guru.');
  }
  const text = (data.text ?? '').trim();
  if (!params.jsonMode) {
    return text as unknown as T;
  }

  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

export const KEMENDIKDASMEN_CP_REGULATIONS = [
  {
    id: 'bskap_046_2025',
    label: 'Keputusan Kepala BSKAP Kemendikdasmen No. 046/H/KR/2025',
    shortLabel: 'Kepka BSKAP Kemendikdasmen No. 046/H/KR/2025 (Terbaru)',
    summary:
      'Regulasi terbaru Capaian Pembelajaran PAUD, Dikdas, dan Dikmen (pengganti No. 032/H/KR/2024).',
  },
  {
    id: 'bskap_032_2024',
    label: 'Keputusan Kepala BSKAP No. 032/H/KR/2024',
    shortLabel: 'Kepka BSKAP No. 032/H/KR/2024',
    summary:
      'Capaian Pembelajaran pada Pendidikan Anak Usia Dini, Jenjang Pendidikan Dasar, dan Jenjang Pendidikan Menengah.',
  },
  {
    id: 'custom',
    label: 'Peraturan Kemendikdasmen / BSKAP Lainnya',
    shortLabel: 'Tulis Manual / Regulasi Kemendikdasmen Lainnya',
    summary:
      'Masukkan nomor atau judul peraturan Kemendikdasmen / BSKAP lain yang digunakan satuan pendidikan.',
  },
] as const;

export interface CpAiDraftItem {
  element: string;
  description: string;
  referenceSource: string;
}

const BASE_SYSTEM_INSTRUCTION = `Anda adalah Ahli Pendidikan Indonesia, Pakar Kurikulum Merdeka Kemendikdasmen, dan Konsultan Administrasi Guru Profesional.
Aturan wajib:
1. Selalu gunakan Bahasa Indonesia yang baku, profesional, dan sesuai konteks sekolah Indonesia.
2. Jangan mengarang nomor keputusan resmi pemerintah yang tidak diberikan, dan jangan mengklaim hasil Anda sebagai salinan verbatim dokumen resmi BSKAP tanpa verifikasi guru terhadap lampiran PDF resmi.
3. Jangan pernah mengarang data siswa atau nilai siswa.
4. Keluaran harus langsung terstruktur, praktis, tidak bertele-tele, dan siap diedit oleh guru.`;

export async function generateCpDraft(params: {
  ctx: AiContext;
  subject: string;
  phase: string;
  gradeLevel: string;
  element?: string;
  regulation: string;
  scope: 'single' | 'all_elements';
  referenceNotes?: string;
}): Promise<{ items: CpAiDraftItem[]; note: string }> {
  const regLabel =
    params.regulation.trim() ||
    'Keputusan Kepala BSKAP Kemendikdasmen No. 046/H/KR/2025';
  const scopeInstruction =
    params.scope === 'all_elements'
      ? `Susun seluruh Elemen CP utama (umumnya 2 hingga 5 elemen sesuai struktur mata pelajaran "${params.subject}" pada Fase ${params.phase}) lengkap dengan narasi Capaian Pembelajaran per elemen.`
      : `Susun 1 item CP khusus untuk Elemen "${params.element || 'Elemen Utama'}".`;

  const prompt = `Susun DRAFT Capaian Pembelajaran (CP) Kurikulum Merdeka yang mengacu pada kerangka peraturan Kemendikdasmen berikut:
Acuan Regulasi: ${regLabel}
Sekolah: ${params.ctx.school.name || '-'} (Jenjang: ${params.ctx.school.level}, Kurikulum: ${params.ctx.school.curriculum})
Mata Pelajaran: ${params.subject}
Fase: ${params.phase} | Kelas: ${params.gradeLevel}
Cakupan Pembuatan: ${scopeInstruction}
Catatan / Fokus Materi Esensial dari Guru:
${params.referenceNotes?.trim() || 'Tidak ada catatan khusus; susun kompetensi inti, materi esensial, dan kecakapan yang selaras dengan jenjang/fase serta Dimensi Profil Lulusan.'}

Ketentuan penyusunan CP:
- Gunakan redaksi khas Capaian Pembelajaran Kurikulum Merdeka (kompetensi operasional + lingkup materi esensial pada akhir Fase ${params.phase}).
- Selaraskan dengan pembagian elemen resmi mata pelajaran "${params.subject}" dan semangat pembelajaran mendalam / Dimensi Profil Lulusan sesuai regulasi Kemendikdasmen yang dipilih.
- Pada field "note", berikan catatan verifikasi singkat agar guru mencocokkan kembali redaksi akhir dengan lampiran resmi ${regLabel}.

Kembalikan JSON dengan format PERSIS seperti berikut:
{
  "items": [
    {
      "element": "Nama Elemen CP",
      "description": "Narasi lengkap Capaian Pembelajaran pada elemen ini dalam 1-2 paragraf",
      "referenceSource": "${regLabel}"
    }
  ],
  "note": "Catatan verifikasi untuk guru"
}`;

  const raw = await callGemini<{
    items?: Array<Partial<CpAiDraftItem>>;
    description?: string;
    note?: string;
  }>({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });

  const normalizedItems: CpAiDraftItem[] = Array.isArray(raw.items) && raw.items.length > 0
    ? raw.items
        .map((item) => ({
          element: String(item.element || params.element || 'Elemen Utama').trim(),
          description: String(item.description || '').trim(),
          referenceSource: String(item.referenceSource || regLabel).trim(),
        }))
        .filter((item) => item.description.length > 0)
    : raw.description
      ? [
          {
            element: (params.element || 'Elemen Utama').trim(),
            description: String(raw.description).trim(),
            referenceSource: regLabel,
          },
        ]
      : [];

  return {
    items: normalizedItems,
    note:
      raw.note?.trim() ||
      `Draft disusun mengacu pada kerangka ${regLabel}. Mohon verifikasi redaksi akhir dengan lampiran resmi Kemendikdasmen.`,
  };
}

export async function generateTpDraftsFromCp(params: {
  ctx: AiContext;
  cp: LearningOutcomeCP;
  semester: SemesterNumber;
  count: number;
  totalHoursAvailable: number;
}): Promise<
  Array<{
    code: string;
    objective: string;
    material: string;
    hoursAllocation: number;
    difficulty: DifficultyLevel;
  }>
> {
  const prompt = `Berdasarkan Capaian Pembelajaran (CP) berikut, rumuskan ${params.count} Tujuan Pembelajaran (TP) yang jelas, terukur (menggunakan kata kerja operasional), relevan dengan kelas ${params.cp.gradeLevel}, dan total alokasi waktu sekitar ${params.totalHoursAvailable} JP untuk Semester ${params.semester}.

Mata Pelajaran: ${params.cp.subject}
Fase: ${params.cp.phase} | Kelas: ${params.cp.gradeLevel}
Elemen: ${params.cp.element}
Deskripsi CP:
${params.cp.description}

Kembalikan JSON array of objects:
[
  {
    "code": "TP.${params.cp.gradeLevel}.${params.semester}.1",
    "objective": "Peserta didik mampu ...",
    "material": "Topik/materi pokok ringkas",
    "hoursAllocation": 4,
    "difficulty": "Mudah" | "Sedang" | "Sulit"
  }
]`;
  return callGemini({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });
}

export async function generateTeachingModuleDraft(params: {
  ctx: AiContext;
  tpList: LearningObjectiveTP[];
  cp?: LearningOutcomeCP;
  gradeLevel: string;
  semester: SemesterNumber;
  subject: string;
  material: string;
  meetingsCount: number;
  hoursAllocation: number;
  learningModel: string;
  studentCharacteristics: string;
  learningNeeds: string;
}): Promise<Record<string, string>> {
  const tpSummary = params.tpList
    .map((t) => `- ${t.code}: ${t.objective} (Materi: ${t.material})`)
    .join('\n');

  const prompt = `Susun DRAFT Modul Ajar / RPP lengkap Kurikulum Merdeka untuk:
Sekolah: ${params.ctx.school.name || '-'} (${params.ctx.school.level})
Guru: ${params.ctx.teacher.fullName || '-'}
Mata Pelajaran: ${params.subject}
Kelas / Semester: ${params.gradeLevel} / Semester ${params.semester}
Tahun Ajaran: ${params.ctx.academicYearName}
Materi Pokok: ${params.material}
Pertemuan: ${params.meetingsCount} pertemuan (${params.hoursAllocation} JP)
Model Pembelajaran: ${params.learningModel}
Karakteristik Siswa: ${params.studentCharacteristics || 'Reguler / beragam'}
Kebutuhan Belajar: ${params.learningNeeds || 'Diferensiasi konten dan proses'}
CP: ${params.cp?.description || '-'}
TP Terkait:
${tpSummary}

Kembalikan JSON object dengan seluruh field string berikut (isi spesifik sesuai materi, bukan teks generik):
{
  "title": "Judul Modul Ajar",
  "moduleIdentity": "Identitas singkat modul",
  "generalInfo": "Informasi umum pembelajaran",
  "initialCompetency": "Kompetensi awal prasyarat",
  "pancasilaProfile": "Dimensi Profil Pelajar Pancasila/Lulusan yang dituju",
  "facilities": "Sarana dan prasarana",
  "targetStudents": "Target peserta didik",
  "meaningfulUnderstanding": "Pemahaman bermakna",
  "triggerQuestions": "Daftar pertanyaan pemantik",
  "methods": "Metode pembelajaran",
  "media": "Media pembelajaran",
  "resources": "Sumber belajar",
  "openingActivity": "Langkah kegiatan pendahuluan terstruktur dengan estimasi menit",
  "coreActivity": "Langkah kegiatan inti sesuai sintaks model pembelajaran ${params.learningModel}",
  "closingActivity": "Langkah kegiatan penutup dan refleksi",
  "diagnosticAssessment": "Rencana asesmen diagnostik awal",
  "formativeAssessment": "Rencana asesmen formatif selama proses",
  "summativeAssessment": "Rencana asesmen sumatif",
  "rubric": "Rubrik penilaian ringkas dengan kriteria dan skor",
  "enrichment": "Program pengayaan",
  "remedial": "Program remedial",
  "teacherReflection": "Pertanyaan refleksi guru",
  "studentReflection": "Pertanyaan refleksi peserta didik",
  "attachment": "Daftar lampiran / bahan bacaan ringkas"
}`;

  return callGemini({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });
}

export async function generateLkpdDraft(params: {
  ctx: AiContext;
  type: LKPDType;
  gradeLevel: string;
  subject: string;
  tp: LearningObjectiveTP;
  material: string;
}): Promise<{
  title: string;
  activityGoal: string;
  instructions: string;
  toolsAndMaterials: string;
  materialSummary: string;
  workSteps: string;
  activities: string;
  questions: string;
  tasks: string;
  observationTableHeaders: string[];
  observationTableRows: string[][];
  conclusionPrompt: string;
  reflectionPrompt: string;
  rubric: string;
}> {
  const prompt = `Susun DRAFT LKPD (Lembar Kerja Peserta Didik) jenis "${params.type}" yang siap digunakan dan dicetak:
Mata Pelajaran: ${params.subject}
Kelas: ${params.gradeLevel}
Tujuan Pembelajaran: ${params.tp.code} - ${params.tp.objective}
Materi: ${params.material}

Kembalikan JSON object:
{
  "title": "Judul LKPD menarik",
  "activityGoal": "Tujuan kegiatan bagi siswa",
  "instructions": "Petunjuk pengerjaan langkah demi langkah",
  "toolsAndMaterials": "Alat dan bahan yang dibutuhkan",
  "materialSummary": "Ringkasan materi pengantar 1-2 paragraf",
  "workSteps": "Langkah kerja bernomor",
  "activities": "Deskripsi aktivitas utama siswa",
  "questions": "Daftar 3-5 pertanyaan diskusi/analisis",
  "tasks": "Tugas utama yang harus diselesaikan",
  "observationTableHeaders": ["No", "Aspek Pengamatan", "Hasil Pengamatan", "Keterangan"],
  "observationTableRows": [["1", "", "", ""], ["2", "", "", ""], ["3", "", "", ""]],
  "conclusionPrompt": "Panduan siswa menuliskan kesimpulan",
  "reflectionPrompt": "Pertanyaan refleksi diri siswa",
  "rubric": "Rubrik penilaian LKPD"
}`;

  return callGemini({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });
}

export async function generateQuestionsDraft(params: {
  ctx: AiContext;
  gradeLevel: string;
  subject: string;
  tp: LearningObjectiveTP;
  material: string;
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  count: number;
}): Promise<
  Array<{
    indicator: string;
    cognitiveLevel: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
    questionText: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    maxScore: number;
  }>
> {
  const prompt = `Buat ${params.count} butir soal ${params.questionType} tingkat kesulitan ${params.difficulty}:
Mata Pelajaran: ${params.subject}
Kelas: ${params.gradeLevel}
TP: ${params.tp.code} - ${params.tp.objective}
Materi: ${params.material}

Aturan:
- Untuk "Pilihan Ganda" atau "Pilihan Ganda Kompleks", berikan 4 opsi pada array "options" (tanpa huruf A/B/C/D di depan karena sistem akan menomori otomatis, atau teks opsi bersih).
- Untuk "Benar/Salah", options = ["Benar", "Salah"].
- Untuk "Isian", "Uraian", "Praktik", options = [].

Kembalikan JSON array:
[
  {
    "indicator": "Disajikan ..., peserta didik dapat ...",
    "cognitiveLevel": "C2",
    "questionText": "Teks pertanyaan lengkap",
    "options": ["Opsi 1", "Opsi 2", "Opsi 3", "Opsi 4"],
    "correctAnswer": "Jawaban benar (untuk PG sebutkan teks opsi atau huruf A/B/C/D)",
    "explanation": "Pembahasan singkat",
    "maxScore": 10
  }
]`;

  return callGemini({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });
}

export async function generateReportDescriptionDraft(params: {
  ctx: AiContext;
  studentName: string;
  gradeLevel: string;
  subject: string;
  finalScore: number;
  achievedTps: string[];
  developingTps: string[];
  extraNotes?: string;
}): Promise<{ descriptionText: string; followUpNote: string }> {
  const prompt = `Buatkan deskripsi capaian rapor Kurikulum Merdeka untuk SATU siswa berdasarkan data nyata berikut (JANGAN mengarang nilai atau kompetensi di luar data):
Nama Siswa: ${params.studentName}
Mata Pelajaran: ${params.subject} | Kelas: ${params.gradeLevel}
Nilai Akhir Nyata: ${params.finalScore}
TP / Kompetensi yang Sudah Dikuasai:
${params.achievedTps.length > 0 ? params.achievedTps.map((t) => `- ${t}`).join('\n') : '- (Belum ada TP spesifik yang ditandai tuntas, dasarkan secara hati-hati pada nilai akhir)'}
TP / Kompetensi yang Masih Perlu Ditingkatkan:
${params.developingTps.length > 0 ? params.developingTps.map((t) => `- ${t}`).join('\n') : '- Tidak ada TP tertinggal secara khusus; fokus pada pengayaan dan konsistensi'}
Catatan Tambahan Guru: ${params.extraNotes || '-'}

Ketentuan penulisan:
- Bahasa Indonesia baku, positif, empatik, dan profesional (diawali "Ananda ${params.studentName}...").
- Tidak menghakimi dan tidak sekadar mengulang angka nilai.
- Menjelaskan kompetensi yang dikuasai, kompetensi yang perlu ditingkatkan, dan saran pengembangan yang unik.

Kembalikan JSON object:
{
  "descriptionText": "Paragraf deskripsi rapor siap salin",
  "followUpNote": "Saran tindak lanjut singkat untuk guru/orang tua"
}`;

  return callGemini({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });
}

export async function askTeacherAssistant(params: {
  ctx: AiContext;
  featureName: string;
  userPrompt: string;
  contextData: string;
}): Promise<string> {
  const prompt = `Fitur yang diminta: ${params.featureName}
Identitas Sekolah: ${params.ctx.school.name || '-'} (${params.ctx.school.level}, ${params.ctx.school.curriculum})
Guru: ${params.ctx.teacher.fullName || '-'} | Tahun Ajaran: ${params.ctx.academicYearName} (Semester ${params.ctx.semester})

Konteks Data Terkait dari Database Aplikasi:
${params.contextData}

Permintaan Guru:
${params.userPrompt}`;

  return callGemini<string>({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: false,
  });
}
