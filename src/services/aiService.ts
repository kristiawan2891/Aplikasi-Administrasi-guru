import type {
  AssessmentCategory,
  CognitiveLevel,
  CurriculumType,
  DifficultyLevel,
  LearningMediaItem,
  LearningObjectiveTP,
  LearningOutcomeCP,
  LKPDDocument,
  LKPDType,
  QuestionType,
  RubricRow,
  SchoolProfile,
  SemesterNumber,
  SyllabusItem,
  TeacherProfile,
  TeachingModule,
} from '../types/domain';

export interface AiContext {
  school: SchoolProfile;
  teacher: TeacherProfile;
  academicYearName: string;
  semester: SemesterNumber;
  effectiveWeeksCount?: number;
}

export interface GroundingLink {
  uri: string;
  title: string;
}

export interface MediaSourceInput {
  kind: 'Video' | 'Gambar' | 'Tautan';
  title: string;
  urlOrRef: string;
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

function parseRobustJson<T>(rawText: string): T {
  const stripped = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const tryParse = (candidate: string): T => {
    const noTrailingCommas = candidate.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(noTrailingCommas) as T;
  };

  try {
    return tryParse(stripped);
  } catch {
    const firstObj = stripped.indexOf('{');
    const lastObj = stripped.lastIndexOf('}');
    const firstArr = stripped.indexOf('[');
    const lastArr = stripped.lastIndexOf(']');

    const candidates: string[] = [];
    if (firstObj !== -1 && lastObj > firstObj) {
      candidates.push(stripped.slice(firstObj, lastObj + 1));
    }
    if (firstArr !== -1 && lastArr > firstArr) {
      candidates.push(stripped.slice(firstArr, lastArr + 1));
    }
    // Try shortest-first or earliest valid start
    candidates.sort((a, b) => b.length - a.length);
    for (const c of candidates) {
      try {
        return tryParse(c);
      } catch {
        // continue
      }
    }
    throw new Error(
      'Format respons AI tidak terbaca sebagai JSON valid. Silakan klik generate ulang.'
    );
  }
}

async function callGemini<T = string>(params: {
  prompt: string;
  systemInstruction: string;
  jsonMode?: boolean;
  useGoogleSearch?: boolean;
}): Promise<T> {
  const executeFetch = async (extraReminder = '') => {
    const res = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: extraReminder ? `${params.prompt}\n\n${extraReminder}` : params.prompt,
        systemInstruction: params.systemInstruction,
        responseMimeType:
          params.jsonMode && !params.useGoogleSearch
            ? 'application/json'
            : undefined,
        useGoogleSearch: params.useGoogleSearch,
      }),
    });

    const data = (await res.json()) as {
      text?: string;
      groundingLinks?: GroundingLink[];
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || 'Gagal memanggil AI Asisten Guru.');
    }
    return data;
  };

  const first = await executeFetch();
  const text = (first.text ?? '').trim();

  if (params.useGoogleSearch && !params.jsonMode) {
    return {
      text,
      groundingLinks: first.groundingLinks ?? [],
    } as unknown as T;
  }

  if (!params.jsonMode) {
    return text as unknown as T;
  }

  try {
    return parseRobustJson<T>(text);
  } catch {
    // Automatic silent retry once with strict JSON reminder so workflow runs without error
    const retry = await executeFetch(
      'PENTING: Kembalikan HANYA JSON murni yang valid tanpa teks penjelasan atau markdown di luar JSON.'
    );
    return parseRobustJson<T>((retry.text ?? '').trim());
  }
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

const BASE_SYSTEM_INSTRUCTION = `Anda adalah Ahli Pendidikan Indonesia, Pakar Kurikulum Nasional Kemendikdasmen (Kurikulum Merdeka, Kurikulum 2013, dan KTSP), dan Konsultan Administrasi Guru Profesional.
Aturan wajib:
1. Selalu gunakan Bahasa Indonesia yang baku, profesional, dan sesuai konteks sekolah Indonesia.
2. Jangan mengarang nomor keputusan resmi pemerintah yang tidak diberikan, dan jangan mengklaim hasil Anda sebagai salinan verbatim dokumen resmi BSKAP tanpa verifikasi guru.
3. Jangan pernah mengarang data siswa atau nilai siswa.
4. Keluaran harus langsung terstruktur, lengkap, praktis, tidak bertele-tele, dan siap digunakan atau diedit guru.`;

function formatMediaSourcesForPrompt(sources: MediaSourceInput[]): string {
  const valid = sources.filter((s) => s.title.trim() || s.urlOrRef.trim());
  if (valid.length === 0) return 'Belum ada tautan video/gambar khusus dari guru.';
  return valid
    .map(
      (s, i) =>
        `${i + 1}. [${s.kind}] ${s.title.trim() || s.kind} — Sumber/URL: ${s.urlOrRef.trim() || '-'}`
    )
    .join('\n');
}

function appendMediaSourcesText(
  existingText: string,
  sources: MediaSourceInput[],
  heading: string
): string {
  const valid = sources.filter((s) => s.title.trim() || s.urlOrRef.trim());
  if (valid.length === 0) return existingText;
  const existingLower = existingText.toLowerCase();
  const missingLines = valid
    .filter((s) => {
      const ref = s.urlOrRef.trim().toLowerCase();
      return ref ? !existingLower.includes(ref) : true;
    })
    .map((s) => `• [${s.kind}] ${s.title.trim() || s.kind}: ${s.urlOrRef.trim()}`);
  if (missingLines.length === 0) return existingText;
  return `${existingText ? `${existingText.trim()}\n\n` : ''}${heading}:\n${missingLines.join('\n')}`;
}

export async function generateCpDraft(params: {
  ctx: AiContext;
  subject: string;
  phase: string;
  gradeLevel: string;
  element?: string;
  regulation: string;
  scope: 'single' | 'all_elements';
  referenceNotes?: string;
  curriculum?: CurriculumType;
}): Promise<{ items: CpAiDraftItem[]; note: string }> {
  const curr = params.curriculum || params.ctx.school.curriculum || 'Kurikulum Merdeka';
  const regLabel =
    params.regulation.trim() ||
    'Keputusan Kepala BSKAP Kemendikdasmen No. 046/H/KR/2025';
  const scopeInstruction =
    params.scope === 'all_elements'
      ? `Susun seluruh Elemen CP / Kompetensi utama (umumnya 2 hingga 5 elemen sesuai struktur mata pelajaran "${params.subject}" pada Fase ${params.phase} / Kelas ${params.gradeLevel} dalam ${curr}).`
      : `Susun 1 item CP / Kompetensi khusus untuk Elemen "${params.element || 'Elemen Utama'}".`;

  const prompt = `Susun DRAFT Capaian Pembelajaran (CP) / Kompetensi berdasarkan kurikulum dan regulasi berikut:
Kurikulum Sekolah: ${curr}
Acuan Regulasi: ${regLabel}
Sekolah: ${params.ctx.school.name || '-'} (Jenjang: ${params.ctx.school.level})
Mata Pelajaran: ${params.subject}
Fase: ${params.phase} | Kelas: ${params.gradeLevel}
Cakupan Pembuatan: ${scopeInstruction}
Catatan / Fokus Materi Esensial dari Guru:
${params.referenceNotes?.trim() || 'Tidak ada catatan khusus; susun kompetensi inti, materi esensial, dan kecakapan yang selaras dengan jenjang/fase serta Dimensi Profil Lulusan.'}

Ketentuan:
- Gunakan redaksi kompetensi operasional + lingkup materi esensial sesuai ${curr}.
- Pada field "note", berikan catatan verifikasi singkat agar guru mencocokkan kembali dengan dokumen resmi ${regLabel}.

Kembalikan JSON dengan format:
{
  "items": [
    {
      "element": "Nama Elemen CP / Kompetensi",
      "description": "Narasi lengkap Capaian Pembelajaran pada elemen ini",
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

  const normalizedItems: CpAiDraftItem[] =
    Array.isArray(raw.items) && raw.items.length > 0
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
      `Draft disusun mengacu pada ${curr} dan kerangka ${regLabel}. Mohon verifikasi redaksi akhir dengan lampiran resmi.`,
  };
}

export async function generateTpDraftsFromCp(params: {
  ctx: AiContext;
  cp: LearningOutcomeCP;
  semester: SemesterNumber;
  count: number;
  totalHoursAvailable: number;
  curriculum?: CurriculumType;
}): Promise<
  Array<{
    code: string;
    objective: string;
    material: string;
    hoursAllocation: number;
    difficulty: DifficultyLevel;
  }>
> {
  const curr = params.curriculum || params.ctx.school.curriculum || 'Kurikulum Merdeka';
  const prompt = `Berdasarkan Capaian Pembelajaran (CP) / Kompetensi (${curr}) berikut, rumuskan ${params.count} Tujuan Pembelajaran (TP) yang jelas, terukur (menggunakan kata kerja operasional), relevan dengan kelas ${params.cp.gradeLevel}, dan total alokasi waktu sekitar ${params.totalHoursAvailable} JP untuk Semester ${params.semester}.

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
    "difficulty": "Mudah"
  }
]`;
  const raw = await callGemini<
    Array<{
      code?: string;
      objective?: string;
      material?: string;
      hoursAllocation?: number;
      difficulty?: DifficultyLevel;
    }>
  >({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });
  const list = Array.isArray(raw) ? raw : [];
  return list.map((d, idx) => ({
    code: String(d.code || `TP.${params.cp.gradeLevel}.${params.semester}.${idx + 1}`),
    objective: String(d.objective || `Memahami materi ${d.material || params.cp.element}`),
    material: String(d.material || params.cp.element),
    hoursAllocation: Math.max(1, Number(d.hoursAllocation) || 4),
    difficulty:
      d.difficulty === 'Mudah' || d.difficulty === 'Sulit' ? d.difficulty : 'Sedang',
  }));
}

export interface FullPlanningPackDraft {
  cps: Array<{
    element: string;
    description: string;
    referenceSource: string;
  }>;
  tps: Array<{
    elementIndex: number;
    code: string;
    material: string;
    objective: string;
    semester: SemesterNumber;
    hoursAllocation: number;
    difficulty: DifficultyLevel;
    plannedMonth: string;
    plannedWeek: number;
    activity: string;
    learningActivities: string;
    method: string;
    media: string;
    resources: string;
    assessment: string;
  }>;
  note: string;
}

export async function generateFullPlanningPackAi(params: {
  ctx: AiContext;
  curriculum: CurriculumType;
  subject: string;
  phase: string;
  gradeLevel: string;
  regulation: string;
  semesterScope: '1' | '2' | 'both';
  sem1Hours: number;
  sem2Hours: number;
  focusTopics?: string;
}): Promise<FullPlanningPackDraft> {
  const regLabel =
    params.regulation.trim() ||
    (params.curriculum === 'Kurikulum Merdeka'
      ? 'Keputusan Kepala BSKAP Kemendikdasmen No. 046/H/KR/2025'
      : params.curriculum === 'Kurikulum 2013'
        ? 'Permendikbud No. 37 Tahun 2018 (KI-KD Kurikulum 2013)'
        : 'Dokumen Kurikulum Tingkat Satuan Pendidikan (KTSP)');

  const semInstruction =
    params.semesterScope === 'both'
      ? `Buat TP untuk Semester 1 (total sekitar ${params.sem1Hours} JP, bulan Juli–November) DAN Semester 2 (total sekitar ${params.sem2Hours} JP, bulan Januari–Mei). Hasilkan total 6–8 TP (3–4 TP per semester).`
      : `Buat 4–5 TP khusus untuk Semester ${params.semesterScope} (total sekitar ${
          params.semesterScope === '1' ? params.sem1Hours : params.sem2Hours
        } JP, bulan ${
          params.semesterScope === '1'
            ? 'Juli, Agustus, September, Oktober, November'
            : 'Januari, Februari, Maret, April, Mei'
        }).`;

  const curriculumGuidance =
    params.curriculum === 'Kurikulum Merdeka'
      ? 'Gunakan struktur Kurikulum Merdeka (Elemen CP, TP terukur, Alur TP, Pembelajaran Mendalam / Dimensi Profil Lulusan, Asesmen Formatif & Sumatif).'
      : params.curriculum === 'Kurikulum 2013'
        ? 'Gunakan struktur Kurikulum 2013: pada field "cps" rumuskan KD Pengetahuan & Keterampilan (KI-3 & KI-4) per lingkup materi, dan pada kegiatan silabus gunakan pendekatan Saintifik 5M.'
        : 'Gunakan struktur KTSP: pada field "cps" rumuskan Standar Kompetensi & Kompetensi Dasar (SK-KD), beserta indikator/TP dan kegiatan pembelajaran aktif.';

  const prompt = `Susun PAKET PERENCANAAN PEMBELAJARAN LENGKAP (dari CP hingga TP, ATP, PROTA, PROMES, dan SILABUS) yang saling terhubung dan siap pakai:
Kurikulum Dipilih: ${params.curriculum}
Acuan Regulasi: ${regLabel}
Sekolah: ${params.ctx.school.name || '-'} (Jenjang: ${params.ctx.school.level})
Mata Pelajaran: ${params.subject}
Fase: ${params.phase} | Kelas: ${params.gradeLevel}
Cakupan Semester: ${semInstruction}
Topik / Fokus Materi Guru: ${params.focusTopics?.trim() || 'Sesuaikan seluruh materi esensial standar mata pelajaran ini secara berurutan dari mudah ke kompleks.'}

Panduan Kurikulum:
${curriculumGuidance}

Kembalikan JSON object dengan format PERSIS:
{
  "cps": [
    {
      "element": "Nama Elemen / KD Utama",
      "description": "Narasi lengkap CP/Kompetensi pada elemen ini",
      "referenceSource": "${regLabel}"
    }
  ],
  "tps": [
    {
      "elementIndex": 0,
      "code": "TP.${params.gradeLevel}.1.1",
      "material": "Judul materi pokok ringkas",
      "objective": "Peserta didik mampu ...",
      "semester": 1,
      "hoursAllocation": 6,
      "difficulty": "Sedang",
      "plannedMonth": "Juli",
      "plannedWeek": 2,
      "activity": "Ringkasan kegiatan PROMES",
      "learningActivities": "Langkah inti kegiatan belajar pada Silabus (mengamati, menanya, eksplorasi, presentasi/refleksi)",
      "method": "Problem Based Learning, Diskusi Kelompok, Tanya Jawab",
      "media": "LKPD, Slide Presentasi, Video Pembelajaran, Alat Peraga",
      "resources": "Buku Paket ${params.curriculum} Kelas ${params.gradeLevel}, Modul Ajar, Lingkungan Sekolah",
      "assessment": "Tes Tertulis, Penilaian Kinerja, Asesmen Formatif"
    }
  ],
  "note": "Ringkasan keterhubungan CP-TP-ATP-PROTA-PROMES-Silabus dan saran peninjauan."
}`;

  const raw = await callGemini<{
    cps?: Array<Partial<CpAiDraftItem>>;
    tps?: Array<Record<string, unknown>>;
    note?: string;
  }>({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });

  const normalizedCps =
    Array.isArray(raw.cps) && raw.cps.length > 0
      ? raw.cps
          .map((c, i) => ({
            element: String(c.element || `Elemen ${i + 1}`).trim(),
            description: String(
              c.description ||
                `Peserta didik memahami dan menerapkan kompetensi ${params.subject} Fase ${params.phase}.`
            ).trim(),
            referenceSource: String(c.referenceSource || regLabel).trim(),
          }))
          .filter((c) => c.description.length > 0)
      : [
          {
            element: 'Elemen Utama',
            description: `Peserta didik menguasai kompetensi esensial ${params.subject} Kelas ${params.gradeLevel} sesuai ${params.curriculum}.`,
            referenceSource: regLabel,
          },
        ];

  const defaultSem: SemesterNumber = params.semesterScope === '2' ? 2 : 1;
  const fallbackMonthsS1 = ['Juli', 'Agustus', 'September', 'Oktober', 'November'];
  const fallbackMonthsS2 = ['Januari', 'Februari', 'Maret', 'April', 'Mei'];

  const rawTps = Array.isArray(raw.tps) ? raw.tps : [];
  const normalizedTps: FullPlanningPackDraft['tps'] =
    rawTps.length > 0
      ? rawTps.map((t, idx) => {
          const semVal: SemesterNumber =
            params.semesterScope === '1'
              ? 1
              : params.semesterScope === '2'
                ? 2
                : Number(t.semester) === 2
                  ? 2
                  : 1;
          const elIdxRaw = Number(t.elementIndex);
          const elementIndex =
            Number.isFinite(elIdxRaw) &&
            elIdxRaw >= 0 &&
            elIdxRaw < normalizedCps.length
              ? elIdxRaw
              : idx % normalizedCps.length;
          const diffRaw = String(t.difficulty || 'Sedang');
          const difficulty: DifficultyLevel =
            diffRaw === 'Mudah' || diffRaw === 'Sulit' ? diffRaw : 'Sedang';
          const fallbackMonths = semVal === 1 ? fallbackMonthsS1 : fallbackMonthsS2;
          const material = String(
            t.material || `Topik ${idx + 1} ${params.subject}`
          ).trim();
          return {
            elementIndex,
            code: String(
              t.code || `TP.${params.gradeLevel}.${semVal}.${idx + 1}`
            ).trim(),
            material,
            objective: String(
              t.objective || `Peserta didik mampu memahami dan menerapkan ${material}.`
            ).trim(),
            semester: semVal,
            hoursAllocation: Math.max(2, Math.min(24, Number(t.hoursAllocation) || 4)),
            difficulty,
            plannedMonth: String(
              t.plannedMonth || fallbackMonths[idx % fallbackMonths.length]
            ).trim(),
            plannedWeek: Math.max(1, Math.min(5, Number(t.plannedWeek) || ((idx % 4) + 1))),
            activity: String(
              t.activity || `Pembelajaran interaktif materi ${material}`
            ).trim(),
            learningActivities: String(
              t.learningActivities ||
                `Mengamati permasalahan kontekstual, mengeksplorasi konsep ${material}, diskusi kelompok, dan presentasi hasil.`
            ).trim(),
            method: String(t.method || 'Diskusi, Eksplorasi, Tanya Jawab').trim(),
            media: String(t.media || 'LKPD, Slide Presentasi, Media Visual').trim(),
            resources: String(
              t.resources || `Buku Siswa ${params.curriculum} Kelas ${params.gradeLevel}`
            ).trim(),
            assessment: String(t.assessment || 'Asesmen Formatif & Sumatif').trim(),
          };
        })
      : [
          {
            elementIndex: 0,
            code: `TP.${params.gradeLevel}.${defaultSem}.1`,
            material: `Konsep Dasar ${params.subject}`,
            objective: `Peserta didik mampu memahami konsep dasar ${params.subject} kelas ${params.gradeLevel}.`,
            semester: defaultSem,
            hoursAllocation: 4,
            difficulty: 'Sedang',
            plannedMonth: defaultSem === 1 ? 'Juli' : 'Januari',
            plannedWeek: 2,
            activity: 'Pembelajaran Tatap Muka',
            learningActivities:
              'Mengamati fenomena, berdiskusi, menyelesaikan masalah, dan refleksi.',
            method: 'Diskusi & Problem Based Learning',
            media: 'LKPD, Slide Presentasi',
            resources: `Buku Paket ${params.curriculum}`,
            assessment: 'Formatif & Sumatif',
          },
        ];

  return {
    cps: normalizedCps,
    tps: normalizedTps,
    note:
      raw.note?.trim() ||
      `Paket perencanaan ${params.curriculum} (${normalizedCps.length} CP, ${normalizedTps.length} TP beserta ATP, PROTA, PROMES, dan Silabus) siap disimpan.`,
  };
}

export async function generateSyllabusBatchAi(params: {
  ctx: AiContext;
  curriculum: CurriculumType;
  tps: LearningObjectiveTP[];
  cps: LearningOutcomeCP[];
}): Promise<
  Array<{
    tpId: string;
    learningActivities: string;
    method: string;
    media: string;
    resources: string;
    assessment: string;
  }>
> {
  const tpSummary = params.tps
    .map((t) => `- ID:${t.id} | ${t.code} | Materi: ${t.material} | TP: ${t.objective}`)
    .join('\n');

  const prompt = `Lengkapi rincian SILABUS berdasarkan daftar Tujuan Pembelajaran (TP) nyata berikut untuk ${params.curriculum} (Jenjang ${params.ctx.school.level}):
${tpSummary}

Kembalikan JSON array (satu objek per TP ID):
[
  {
    "tpId": "ID_TP_ASLI",
    "learningActivities": "Langkah kegiatan pembelajaran spesifik materi",
    "method": "Model/metode pembelajaran",
    "media": "Media pembelajaran relevan",
    "resources": "Sumber belajar relevan",
    "assessment": "Teknik & instrumen asesmen"
  }
]`;

  const raw = await callGemini<Array<Record<string, unknown>>>({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });
  const list = Array.isArray(raw) ? raw : [];
  return params.tps.map((tp, idx) => {
    const match =
      list.find((r) => String(r.tpId || '') === tp.id) ?? list[idx] ?? {};
    return {
      tpId: tp.id,
      learningActivities: String(
        match.learningActivities ||
          `Mengamati konsep, diskusi pemecahan masalah, dan presentasi materi ${tp.material}.`
      ),
      method: String(match.method || 'Problem Based Learning, Diskusi, Penugasan'),
      media: String(match.media || 'LKPD, Slide Presentasi, Media Visual/Video'),
      resources: String(
        match.resources || `Buku Siswa ${params.curriculum}, Modul Ajar`
      ),
      assessment: String(match.assessment || 'Asesmen Formatif & Sumatif'),
    };
  });
}

export async function findEducationalMediaSourcesAi(params: {
  subject: string;
  gradeLevel: string;
  material: string;
  objectives?: string;
}): Promise<{ sources: MediaSourceInput[]; summary: string }> {
  const prompt = `Carikan referensi sumber VIDEO pembelajaran (misal YouTube edukasi / Rumah Belajar / Khan Academy Indonesia) dan sumber GAMBAR / SIMULASI / INFOGRAFIS edukatif nyata yang relevan untuk guru mengajarkan materi berikut:
Mata Pelajaran: ${params.subject}
Kelas: ${params.gradeLevel}
Materi Pokok: ${params.material}
Tujuan Pembelajaran: ${params.objectives || '-'}

Berikan 2–3 rekomendasi video dan 2 rekomendasi gambar/simulasi interaktif beserta judul singkat dan kegunaannya di kelas.`;

  const grounded = await callGemini<{
    text: string;
    groundingLinks: GroundingLink[];
  }>({
    prompt,
    systemInstruction:
      'Anda adalah kurator sumber belajar digital Indonesia. Gunakan pencarian web untuk menemukan sumber edukasi nyata (video pembelajaran, gambar/diagram, simulasi) yang relevan.',
    useGoogleSearch: true,
  });

  const sources: MediaSourceInput[] = (grounded.groundingLinks || [])
    .slice(0, 6)
    .map((link) => {
      const lowerUri = link.uri.toLowerCase();
      const lowerTitle = link.title.toLowerCase();
      const isVideo =
        lowerUri.includes('youtube.com') ||
        lowerUri.includes('youtu.be') ||
        lowerUri.includes('video') ||
        lowerTitle.includes('video');
      const isImage =
        lowerUri.includes('wikimedia') ||
        lowerUri.includes('image') ||
        lowerUri.includes('.png') ||
        lowerUri.includes('.jpg') ||
        lowerTitle.includes('gambar') ||
        lowerTitle.includes('infografis') ||
        lowerTitle.includes('diagram');
      return {
        kind: isVideo ? 'Video' : isImage ? 'Gambar' : 'Tautan',
        title: link.title || `Sumber ${params.material}`,
        urlOrRef: link.uri,
      };
    });

  return {
    sources,
    summary: grounded.text,
  };
}

export async function generateTeachingModuleDraft(params: {
  ctx: AiContext;
  tpList: LearningObjectiveTP[];
  cp?: LearningOutcomeCP;
  syllabusItem?: SyllabusItem;
  gradeLevel: string;
  semester: SemesterNumber;
  subject: string;
  material: string;
  meetingsCount: number;
  hoursAllocation: number;
  learningModel: string;
  studentCharacteristics: string;
  learningNeeds: string;
  mediaSources?: MediaSourceInput[];
}): Promise<Record<string, string>> {
  const tpSummary = params.tpList
    .map((t) => `- ${t.code}: ${t.objective} (Materi: ${t.material})`)
    .join('\n');
  const sourcesText = formatMediaSourcesForPrompt(params.mediaSources || []);

  const prompt = `Susun DRAFT Modul Ajar / RPP lengkap (${params.ctx.school.curriculum}) untuk:
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
${
  params.syllabusItem
    ? `Konteks Silabus: Kegiatan="${params.syllabusItem.learningActivities}", Metode="${params.syllabusItem.method}", Asesmen="${params.syllabusItem.assessment}"`
    : ''
}
Sumber Video / Gambar / Media yang Harus Dimasukkan:
${sourcesText}

Kembalikan JSON object dengan seluruh field string berikut (WAJIB integrasikan sumber Video / Gambar di atas ke field media, resources, openingActivity/coreActivity, dan attachment jika tersedia):
{
  "title": "Judul Modul Ajar",
  "moduleIdentity": "Identitas singkat modul",
  "generalInfo": "Informasi umum pembelajaran",
  "initialCompetency": "Kompetensi awal prasyarat",
  "pancasilaProfile": "Dimensi Profil Pelajar Pancasila / Dimensi Profil Lulusan",
  "facilities": "Sarana dan prasarana termasuk media digital/proyektor",
  "targetStudents": "Target peserta didik",
  "meaningfulUnderstanding": "Pemahaman bermakna",
  "triggerQuestions": "Daftar pertanyaan pemantik",
  "methods": "Metode pembelajaran",
  "media": "Media pembelajaran (termasuk video/gambar/slide yang digunakan)",
  "resources": "Sumber belajar (cantumkan buku paket dan tautan video/gambar)",
  "openingActivity": "Langkah kegiatan pendahuluan terstruktur dengan estimasi menit",
  "coreActivity": "Langkah kegiatan inti sesuai sintaks model ${params.learningModel} (manfaatkan video/gambar bila ada)",
  "closingActivity": "Langkah kegiatan penutup dan refleksi",
  "diagnosticAssessment": "Rencana asesmen diagnostik awal",
  "formativeAssessment": "Rencana asesmen formatif selama proses",
  "summativeAssessment": "Rencana asesmen sumatif",
  "rubric": "Rubrik penilaian ringkas dengan kriteria dan skor",
  "enrichment": "Program pengayaan",
  "remedial": "Program remedial",
  "teacherReflection": "Pertanyaan refleksi guru",
  "studentReflection": "Pertanyaan refleksi peserta didik",
  "attachment": "Daftar lampiran LKPD, bahan bacaan, serta daftar tautan video/gambar"
}`;

  const draft = await callGemini<Record<string, string>>({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });

  if (params.mediaSources && params.mediaSources.length > 0) {
    draft.media = appendMediaSourcesText(
      String(draft.media || ''),
      params.mediaSources,
      'Media Video & Gambar Terintegrasi'
    );
    draft.resources = appendMediaSourcesText(
      String(draft.resources || ''),
      params.mediaSources,
      'Sumber Belajar Video & Gambar'
    );
    draft.attachment = appendMediaSourcesText(
      String(draft.attachment || ''),
      params.mediaSources,
      'Lampiran Tautan Video & Gambar'
    );
  }
  return draft;
}

export async function generateLkpdDraft(params: {
  ctx: AiContext;
  type: LKPDType;
  gradeLevel: string;
  subject: string;
  tp: LearningObjectiveTP;
  material: string;
  mediaSources?: MediaSourceInput[];
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
  const sourcesText = formatMediaSourcesForPrompt(params.mediaSources || []);
  const prompt = `Susun DRAFT LKPD (Lembar Kerja Peserta Didik) jenis "${params.type}" yang siap digunakan dan dicetak:
Mata Pelajaran: ${params.subject}
Kelas: ${params.gradeLevel}
Tujuan Pembelajaran: ${params.tp.code} - ${params.tp.objective}
Materi: ${params.material}
Sumber Video / Gambar yang Tersedia:
${sourcesText}

Catatan: Jika ada sumber video atau gambar di atas, integrasikan langsung ke bagian "toolsAndMaterials", "materialSummary", dan "workSteps" agar siswa mengamati video/gambar tersebut saat mengerjakan LKPD.

Kembalikan JSON object:
{
  "title": "Judul LKPD menarik",
  "activityGoal": "Tujuan kegiatan bagi siswa",
  "instructions": "Petunjuk pengerjaan langkah demi langkah",
  "toolsAndMaterials": "Alat, bahan, serta sumber video/gambar yang digunakan",
  "materialSummary": "Ringkasan materi pengantar 1-2 paragraf",
  "workSteps": "Langkah kerja bernomor (mencakup pengamatan video/gambar jika ada)",
  "activities": "Deskripsi aktivitas utama siswa",
  "questions": "Daftar 3-5 pertanyaan diskusi/analisis",
  "tasks": "Tugas utama yang harus diselesaikan",
  "observationTableHeaders": ["No", "Aspek Pengamatan", "Hasil Pengamatan", "Keterangan"],
  "observationTableRows": [["1", "", "", ""], ["2", "", "", ""], ["3", "", "", ""]],
  "conclusionPrompt": "Panduan siswa menuliskan kesimpulan",
  "reflectionPrompt": "Pertanyaan refleksi diri siswa",
  "rubric": "Rubrik penilaian LKPD"
}`;

  const draft = await callGemini<{
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
  }>({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });

  if (params.mediaSources && params.mediaSources.length > 0) {
    draft.toolsAndMaterials = appendMediaSourcesText(
      String(draft.toolsAndMaterials || ''),
      params.mediaSources,
      'Sumber Video / Gambar Pendukung'
    );
    draft.workSteps = appendMediaSourcesText(
      String(draft.workSteps || ''),
      params.mediaSources,
      'Rujukan Pengamatan Video / Gambar'
    );
  }
  return draft;
}

export interface LearningToolsPackDraft {
  module: Record<string, string>;
  lkpd: {
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
  };
  mediaItems: Array<{
    title: string;
    type: LearningMediaItem['type'];
    description: string;
    usageGuide: string;
    linkOrSource: string;
  }>;
}

export async function generateLearningToolsPackAi(params: {
  ctx: AiContext;
  tpList: LearningObjectiveTP[];
  cp?: LearningOutcomeCP;
  syllabusItem?: SyllabusItem;
  gradeLevel: string;
  semester: SemesterNumber;
  subject: string;
  material: string;
  meetingsCount: number;
  hoursAllocation: number;
  learningModel: string;
  lkpdType: LKPDType;
  mediaSources: MediaSourceInput[];
}): Promise<LearningToolsPackDraft> {
  const tpSummary = params.tpList
    .map((t) => `- ${t.code}: ${t.objective} (Materi: ${t.material})`)
    .join('\n');
  const sourcesText = formatMediaSourcesForPrompt(params.mediaSources);

  const prompt = `Susun PAKET PERANGKAT PEMBELAJARAN TERPADU (Modul Ajar lengkap 24 komponen + LKPD + Media Pembelajaran) yang saling terhubung dengan perencanaan berikut:
Sekolah: ${params.ctx.school.name || '-'} (${params.ctx.school.level}, ${params.ctx.school.curriculum})
Mata Pelajaran: ${params.subject}
Kelas / Semester: ${params.gradeLevel} / Semester ${params.semester}
Materi Pokok: ${params.material}
Alokasi: ${params.meetingsCount} Pertemuan (${params.hoursAllocation} JP)
Model Pembelajaran: ${params.learningModel}
Jenis LKPD: ${params.lkpdType}
CP: ${params.cp?.description || '-'}
TP:
${tpSummary}
${
  params.syllabusItem
    ? `Silabus Terkait: Kegiatan="${params.syllabusItem.learningActivities}", Metode="${params.syllabusItem.method}"`
    : ''
}
Sumber Video / Gambar / Media dari Guru & Pencarian:
${sourcesText}

INSTRUKSI PENTING:
1. Semua sumber Video/Gambar di atas HARUS langsung tercantum dan dimanfaatkan di dalam Modul Ajar (media, resources, coreActivity, attachment), LKPD (toolsAndMaterials, materialSummary, workSteps), dan daftar Media Pembelajaran.
2. Pada "mediaItems", buatkan 2–4 item Media Pembelajaran praktis (misalnya Slide Presentasi utama + kartu/alat peraga + setiap Video/Gambar di atas lengkap dengan link/sumbernya).

Kembalikan JSON object:
{
  "module": {
    "title": "Modul Ajar ${params.material}",
    "moduleIdentity": "...",
    "generalInfo": "...",
    "initialCompetency": "...",
    "pancasilaProfile": "...",
    "facilities": "...",
    "targetStudents": "...",
    "methods": "...",
    "media": "...",
    "resources": "...",
    "meaningfulUnderstanding": "...",
    "triggerQuestions": "...",
    "openingActivity": "...",
    "coreActivity": "...",
    "closingActivity": "...",
    "diagnosticAssessment": "...",
    "formativeAssessment": "...",
    "summativeAssessment": "...",
    "rubric": "...",
    "enrichment": "...",
    "remedial": "...",
    "teacherReflection": "...",
    "studentReflection": "...",
    "attachment": "..."
  },
  "lkpd": {
    "title": "LKPD ${params.material}",
    "activityGoal": "...",
    "instructions": "...",
    "toolsAndMaterials": "...",
    "materialSummary": "...",
    "workSteps": "...",
    "activities": "...",
    "questions": "...",
    "tasks": "...",
    "observationTableHeaders": ["No", "Aspek Pengamatan", "Hasil Pengamatan", "Keterangan"],
    "observationTableRows": [["1", "", "", ""], ["2", "", "", ""], ["3", "", "", ""]],
    "conclusionPrompt": "...",
    "reflectionPrompt": "...",
    "rubric": "..."
  },
  "mediaItems": [
    {
      "title": "Judul Media",
      "type": "Slide/Presentasi",
      "description": "Deskripsi isi media",
      "usageGuide": "Panduan penggunaan di kelas",
      "linkOrSource": "URL atau lokasi penyimpanan"
    }
  ]
}`;

  const raw = await callGemini<Partial<LearningToolsPackDraft>>({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });

  const mod = (raw.module || {}) as Record<string, string>;
  mod.title = String(mod.title || `Modul Ajar ${params.material}`).trim();
  mod.media = appendMediaSourcesText(
    String(mod.media || 'Slide Presentasi, LKPD'),
    params.mediaSources,
    'Media Video & Gambar Terintegrasi'
  );
  mod.resources = appendMediaSourcesText(
    String(mod.resources || `Buku Paket ${params.ctx.school.curriculum}`),
    params.mediaSources,
    'Sumber Video & Gambar Pembelajaran'
  );
  mod.attachment = appendMediaSourcesText(
    String(mod.attachment || 'LKPD, Bahan Bacaan Siswa, Rubrik Penilaian'),
    params.mediaSources,
    'Lampiran Tautan Video & Gambar'
  );

  const lkpdRaw = (raw.lkpd || {}) as Partial<LearningToolsPackDraft['lkpd']>;
  const lkpd: LearningToolsPackDraft['lkpd'] = {
    title: String(lkpdRaw.title || `LKPD ${params.material}`).trim(),
    activityGoal: String(lkpdRaw.activityGoal || params.tpList[0]?.objective || '-'),
    instructions: String(
      lkpdRaw.instructions || 'Bacalah petunjuk dengan cermat dan ikuti langkah kerja.'
    ),
    toolsAndMaterials: appendMediaSourcesText(
      String(lkpdRaw.toolsAndMaterials || 'Alat tulis, LKPD'),
      params.mediaSources,
      'Sumber Video / Gambar Pendukung'
    ),
    materialSummary: String(
      lkpdRaw.materialSummary || `Ringkasan konsep inti ${params.material}.`
    ),
    workSteps: appendMediaSourcesText(
      String(lkpdRaw.workSteps || '1. Amati materi.\n2. Diskusikan.\n3. Simpulkan.'),
      params.mediaSources,
      'Rujukan Video / Gambar untuk Diamati'
    ),
    activities: String(lkpdRaw.activities || 'Aktivitas diskusi dan pemecahan masalah.'),
    questions: String(lkpdRaw.questions || '1. Jelaskan konsep utama materi ini!'),
    tasks: String(lkpdRaw.tasks || 'Selesaikan tabel pengamatan dan soal diskusi.'),
    observationTableHeaders:
      Array.isArray(lkpdRaw.observationTableHeaders) &&
      lkpdRaw.observationTableHeaders.length > 0
        ? lkpdRaw.observationTableHeaders
        : ['No', 'Aspek Pengamatan', 'Hasil Pengamatan', 'Keterangan'],
    observationTableRows:
      Array.isArray(lkpdRaw.observationTableRows) &&
      lkpdRaw.observationTableRows.length > 0
        ? lkpdRaw.observationTableRows
        : [
            ['1', '', '', ''],
            ['2', '', '', ''],
            ['3', '', '', ''],
          ],
    conclusionPrompt: String(
      lkpdRaw.conclusionPrompt || 'Tuliskan kesimpulan utama berdasarkan hasil kegiatan.'
    ),
    reflectionPrompt: String(
      lkpdRaw.reflectionPrompt || 'Apa hal terpenting yang kamu pelajari hari ini?'
    ),
    rubric: String(lkpdRaw.rubric || 'Ketepatan konsep (40%), Proses (30%), Presentasi (30%).'),
  };

  const allowedMediaTypes: LearningMediaItem['type'][] = [
    'Slide/Presentasi',
    'Video',
    'Alat Peraga',
    'Simulasi/Digital',
    'Audio',
    'Lembar Gambar',
    'Lainnya',
  ];

  const aiMediaItems = Array.isArray(raw.mediaItems)
    ? raw.mediaItems.map((m) => ({
        title: String(m.title || `Media ${params.material}`).trim(),
        type: allowedMediaTypes.includes(m.type) ? m.type : 'Slide/Presentasi',
        description: String(m.description || '').trim(),
        usageGuide: String(m.usageGuide || '').trim(),
        linkOrSource: String(m.linkOrSource || '').trim(),
      }))
    : [];

  // Ensure every explicit teacher/grounded Video/Gambar source is directly registered in Media Pembelajaran
  const existingSourcesLower = new Set(
    aiMediaItems.map((m) => m.linkOrSource.toLowerCase()).filter(Boolean)
  );
  for (const src of params.mediaSources) {
    const cleanRef = src.urlOrRef.trim();
    if (!cleanRef && !src.title.trim()) continue;
    if (cleanRef && existingSourcesLower.has(cleanRef.toLowerCase())) continue;
    aiMediaItems.push({
      title: src.title.trim() || `${src.kind} ${params.material}`,
      type:
        src.kind === 'Video'
          ? 'Video'
          : src.kind === 'Gambar'
            ? 'Lembar Gambar'
            : 'Simulasi/Digital',
      description: `Sumber ${src.kind.toLowerCase()} pembelajaran untuk materi ${params.material}, terintegrasi di Modul Ajar dan LKPD.`,
      usageGuide: `Tampilkan atau bagikan sumber ${src.kind.toLowerCase()} ini pada kegiatan inti pembelajaran & pengamatan LKPD.`,
      linkOrSource: cleanRef || '-',
    });
  }

  return {
    module: mod,
    lkpd,
    mediaItems: aiMediaItems,
  };
}

export async function generateQuestionsDraft(params: {
  ctx: AiContext;
  gradeLevel: string;
  subject: string;
  tp: LearningObjectiveTP;
  cp?: LearningOutcomeCP;
  moduleContext?: TeachingModule;
  material: string;
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  count: number;
  pgOptionCount?: 3 | 4 | 5;
}): Promise<
  Array<{
    indicator: string;
    cognitiveLevel: CognitiveLevel;
    questionText: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    maxScore: number;
  }>
> {
  const optCount = params.pgOptionCount || 4;
  const optionLetters = ['A', 'B', 'C', 'D', 'E'].slice(0, optCount).join('/');
  const prompt = `Buat ${params.count} butir soal "${params.questionType}" tingkat kesulitan "${params.difficulty}":
Kurikulum: ${params.ctx.school.curriculum}
Mata Pelajaran: ${params.subject}
Kelas: ${params.gradeLevel}
${params.cp ? `CP: ${params.cp.element} - ${params.cp.description}` : ''}
TP: ${params.tp.code} - ${params.tp.objective}
Materi: ${params.material}
${
  params.moduleContext
    ? `Konteks Modul Ajar: "${params.moduleContext.title}" (Model: ${params.moduleContext.learningModel}, Media/Sumber: ${params.moduleContext.media})`
    : ''
}

Aturan WAJIB:
- Untuk "Pilihan Ganda" atau "Pilihan Ganda Kompleks", berikan TEPAT ${optCount} opsi (${optionLetters}) pada array "options" (teks opsi bersih tanpa prefix A./B.).
- Untuk "Benar/Salah", options = ["Benar", "Salah"].
- Untuk "Menjodohkan", "Isian", "Uraian", "Praktik", options = [].

Kembalikan JSON array:
[
  {
    "indicator": "Disajikan ..., peserta didik dapat ...",
    "cognitiveLevel": "C2",
    "questionText": "Teks pertanyaan lengkap",
    "options": [${Array.from({ length: optCount }, (_, i) => `"Opsi ${i + 1}"`).join(', ')}],
    "correctAnswer": "Kunci jawaban lengkap (misal A. Teks opsi)",
    "explanation": "Pembahasan singkat",
    "maxScore": 10
  }
]`;

  const raw = await callGemini<Array<Record<string, unknown>>>({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });
  const list = Array.isArray(raw) ? raw : [];
  const validCogs: CognitiveLevel[] = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
  const isPg =
    params.questionType === 'Pilihan Ganda' ||
    params.questionType === 'Pilihan Ganda Kompleks';

  return list.map((q) => {
    const cog = String(q.cognitiveLevel || 'C2').toUpperCase() as CognitiveLevel;
    let opts = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
    if (isPg) {
      opts = opts.slice(0, optCount);
      while (opts.length < optCount) {
        opts.push(`Pilihan ${opts.length + 1}`);
      }
    } else if (params.questionType === 'Benar/Salah') {
      opts = ['Benar', 'Salah'];
    } else {
      opts = [];
    }
    return {
      indicator: String(q.indicator || `Siswa mampu menjawab soal tentang ${params.material}`),
      cognitiveLevel: validCogs.includes(cog) ? cog : 'C2',
      questionText: String(q.questionText || '').trim(),
      options: opts,
      correctAnswer: String(q.correctAnswer || '').trim(),
      explanation: String(q.explanation || '').trim(),
      maxScore: Math.max(1, Number(q.maxScore) || 10),
    };
  });
}

export interface GeneratedAssessmentQuestionItem {
  tpId: string;
  tpCode: string;
  material: string;
  indicator: string;
  questionType: QuestionType;
  cognitiveLevel: CognitiveLevel;
  difficulty: DifficultyLevel;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  maxScore: number;
}

export interface FullAssessmentPackDraft {
  questions: GeneratedAssessmentQuestionItem[];
  scoringGuide: string;
  rubric: RubricRow[];
  remedialPlan: string;
  enrichmentPlan: string;
}

export async function generateFullAssessmentPackAi(params: {
  ctx: AiContext;
  assessmentName: string;
  category: AssessmentCategory;
  subject: string;
  gradeLevel: string;
  semester: SemesterNumber;
  cpList: LearningOutcomeCP[];
  tpList: LearningObjectiveTP[];
  linkedModule?: TeachingModule;
  linkedLkpd?: LKPDDocument;
  questionSpecs: Array<{ type: QuestionType; count: number }>;
  pgOptionCount: 3 | 4 | 5;
  difficultyMode: 'Proporsional' | DifficultyLevel;
  extraNotes?: string;
}): Promise<FullAssessmentPackDraft> {
  const activeSpecs = params.questionSpecs.filter((s) => s.count > 0);
  const totalCount = activeSpecs.reduce((sum, s) => sum + s.count, 0);
  const specText = activeSpecs
    .map((s) => `- ${s.count} soal berbentuk "${s.type}"`)
    .join('\n');

  const tpContext =
    params.tpList.length > 0
      ? params.tpList
          .map(
            (t) =>
              `- TP_ID:${t.id} | Kode:${t.code} | Materi:${t.material} | Tujuan:${t.objective}`
          )
          .join('\n')
      : '- TP umum sesuai materi';

  const cpContext =
    params.cpList.length > 0
      ? params.cpList.map((c) => `- ${c.element}: ${c.description}`).join('\n')
      : '-';

  const optionLetters = ['A', 'B', 'C', 'D', 'E']
    .slice(0, params.pgOptionCount)
    .join(', ');

  const prompt = `Susun PAKET ASESMEN LENGKAP (${params.category}: "${params.assessmentName}") yang saling terhubung dengan Perencanaan & Perangkat Pembelajaran berikut:
Kurikulum: ${params.ctx.school.curriculum}
Mata Pelajaran: ${params.subject}
Kelas / Semester: ${params.gradeLevel} / Semester ${params.semester}
Capaian Pembelajaran (CP):
${cpContext}
Tujuan Pembelajaran (TP) yang Diujikan:
${tpContext}
${
  params.linkedModule
    ? `Modul Ajar Terkait: "${params.linkedModule.title}" | Materi: ${params.linkedModule.material} | Model: ${params.linkedModule.learningModel} | Media: ${params.linkedModule.media}`
    : ''
}
${
  params.linkedLkpd
    ? `LKPD Terkait: "${params.linkedLkpd.title}" | Aktivitas: ${params.linkedLkpd.activities}`
    : ''
}
Catatan Guru: ${params.extraNotes?.trim() || '-'}

SPESIFIKASI KOMPOSISI SOAL WAJIB (Total TEPAT ${totalCount} soal):
${specText}

Aturan Keras Format Soal:
1. Total item dalam array "questions" harus TEPAT ${totalCount} soal sesuai komposisi jenis soal di atas.
2. Untuk setiap soal bertipe "Pilihan Ganda" atau "Pilihan Ganda Kompleks", array "options" HARUS berisi TEPAT ${params.pgOptionCount} pilihan bersih (${optionLetters}) tanpa awalan huruf "A."/"B.".
3. Untuk "Benar/Salah", options = ["Benar", "Salah"].
4. Untuk "Isian", "Uraian", "Menjodohkan", "Praktik", options = [].
5. Sebaran kesulitan: ${
    params.difficultyMode === 'Proporsional'
      ? 'Campuran proporsional (Mudah ~30%, Sedang ~50%, Sulit ~20% HOTS)'
      : `Dominan tingkat kesulitan "${params.difficultyMode}"`
  }.
6. Cantumkan "tpCode" sesuai salah satu Kode TP di atas agar kisi-kisi otomatis terhubung.

Kembalikan JSON object:
{
  "questions": [
    {
      "tpCode": "TP.7.1",
      "material": "Nama materi pokok",
      "indicator": "Disajikan ..., peserta didik mampu ...",
      "questionType": "Pilihan Ganda",
      "cognitiveLevel": "C3",
      "difficulty": "Sedang",
      "questionText": "Pertanyaan lengkap...",
      "options": ["Opsi 1", "Opsi 2", ...],
      "correctAnswer": "Jawaban benar (untuk PG sertakan huruf & teks jawaban, misal B. ...)",
      "explanation": "Pembahasan langkah penyelesaian",
      "maxScore": 10
    }
  ],
  "scoringGuide": "Rumus nilai akhir & bobot per bentuk soal",
  "rubric": [
    {
      "criteria": "Ketepatan Konsep & Langkah Penyelesaian",
      "excellent": "...",
      "good": "...",
      "fair": "...",
      "needsGuidance": "...",
      "maxScore": 100
    }
  ],
  "remedialPlan": "Rencana tindak lanjut remedial",
  "enrichmentPlan": "Rencana tindak lanjut pengayaan HOTS"
}`;

  const raw = await callGemini<{
    questions?: Array<Record<string, unknown>>;
    scoringGuide?: string;
    rubric?: Array<Partial<RubricRow>>;
    remedialPlan?: string;
    enrichmentPlan?: string;
  }>({
    prompt,
    systemInstruction: BASE_SYSTEM_INSTRUCTION,
    jsonMode: true,
  });

  const validCogs: CognitiveLevel[] = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
  const validDiffs: DifficultyLevel[] = ['Mudah', 'Sedang', 'Sulit'];
  const validTypes: QuestionType[] = [
    'Pilihan Ganda',
    'Pilihan Ganda Kompleks',
    'Benar/Salah',
    'Menjodohkan',
    'Isian',
    'Uraian',
    'Praktik',
  ];

  // Expand expected type slots so even if AI shifts one item type, we match requested distribution smoothly
  const expectedSlots: QuestionType[] = [];
  for (const s of activeSpecs) {
    for (let i = 0; i < s.count; i++) expectedSlots.push(s.type);
  }

  const rawList = Array.isArray(raw.questions) ? raw.questions : [];
  const normalizedQuestions: GeneratedAssessmentQuestionItem[] = rawList.map(
    (q, idx) => {
      const qTypeRaw = String(q.questionType || expectedSlots[idx] || 'Pilihan Ganda');
      const questionType: QuestionType = validTypes.includes(qTypeRaw as QuestionType)
        ? (qTypeRaw as QuestionType)
        : expectedSlots[idx] || 'Pilihan Ganda';

      const tpCodeStr = String(q.tpCode || '').trim();
      const matchedTp =
        params.tpList.find(
          (t) =>
            t.code.toLowerCase() === tpCodeStr.toLowerCase() ||
            (tpCodeStr && t.code.toLowerCase().includes(tpCodeStr.toLowerCase()))
        ) ?? params.tpList[idx % Math.max(1, params.tpList.length)];

      const cogRaw = String(q.cognitiveLevel || 'C2').toUpperCase() as CognitiveLevel;
      const diffRaw = String(q.difficulty || 'Sedang') as DifficultyLevel;
      const isPg =
        questionType === 'Pilihan Ganda' || questionType === 'Pilihan Ganda Kompleks';

      let opts = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
      if (isPg) {
        opts = opts.slice(0, params.pgOptionCount);
        while (opts.length < params.pgOptionCount) {
          opts.push(`Pilihan ${opts.length + 1}`);
        }
      } else if (questionType === 'Benar/Salah') {
        opts = ['Benar', 'Salah'];
      } else {
        opts = [];
      }

      return {
        tpId: matchedTp?.id || '',
        tpCode: matchedTp?.code || tpCodeStr || '-',
        material: String(
          q.material || matchedTp?.material || params.linkedModule?.material || 'Materi Pokok'
        ).trim(),
        indicator: String(
          q.indicator ||
            `Disajikan permasalahan ${matchedTp?.material || params.subject}, peserta didik mampu menyelesaikannya.`
        ).trim(),
        questionType,
        cognitiveLevel: validCogs.includes(cogRaw) ? cogRaw : 'C2',
        difficulty: validDiffs.includes(diffRaw) ? diffRaw : 'Sedang',
        questionText: String(q.questionText || `Soal ${idx + 1}`).trim(),
        options: opts,
        correctAnswer: String(q.correctAnswer || '-').trim(),
        explanation: String(q.explanation || '-').trim(),
        maxScore: Math.max(1, Number(q.maxScore) || (questionType === 'Uraian' ? 20 : 10)),
      };
    }
  );

  const totalScore = normalizedQuestions.reduce((s, q) => s + q.maxScore, 0) || 100;
  const rubric: RubricRow[] =
    Array.isArray(raw.rubric) && raw.rubric.length > 0
      ? raw.rubric.map((r) => ({
          criteria: String(r.criteria || 'Ketepatan Konsep'),
          excellent: String(r.excellent || 'Menjawab tepat dan lengkap'),
          good: String(r.good || 'Menjawab sebagian besar tepat'),
          fair: String(r.fair || 'Cukup tepat namun kurang lengkap'),
          needsGuidance: String(r.needsGuidance || 'Perlu bimbingan konsep dasar'),
          maxScore: Number(r.maxScore) || totalScore,
        }))
      : [
          {
            criteria: 'Ketepatan Jawaban & Penguasaan TP',
            excellent: 'Menjawab seluruh bagian dengan tepat dan sistematis',
            good: 'Menjawab sebagian besar dengan tepat',
            fair: 'Menjawab cukup tepat namun kurang lengkap',
            needsGuidance: 'Jawaban belum sesuai konsep TP',
            maxScore: totalScore,
          },
        ];

  return {
    questions: normalizedQuestions,
    scoringGuide:
      raw.scoringGuide?.trim() ||
      `Skor Maksimal = ${totalScore}. Nilai Akhir = (Total Skor Perolehan / ${totalScore}) × 100`,
    rubric,
    remedialPlan:
      raw.remedialPlan?.trim() ||
      'Pembelajaran ulang terbimbing & latihan soal sejenis pada TP yang belum tuntas.',
    enrichmentPlan:
      raw.enrichmentPlan?.trim() ||
      'Penugasan pemecahan masalah tingkat lanjut (HOTS) bagi peserta didik tuntas.',
  };
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
