export type SchoolLevel = 'SD/MI' | 'SMP/MTs' | 'SMA/MA' | 'SMK/MAK' | 'SLB';
export type CurriculumType = 'Kurikulum Merdeka' | 'Kurikulum 2013' | 'KTSP / Sekolah';
export type SemesterNumber = 1 | 2;
export type Gender = 'L' | 'P';
export type StudentStatus = 'Aktif' | 'Pindah' | 'Nonaktif';
export type DifficultyLevel = 'Mudah' | 'Sedang' | 'Sulit';
export type CognitiveLevel = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';

export type QuestionType =
  | 'Pilihan Ganda'
  | 'Pilihan Ganda Kompleks'
  | 'Benar/Salah'
  | 'Menjodohkan'
  | 'Isian'
  | 'Uraian'
  | 'Praktik';

export type AssessmentCategory =
  | 'Quiz'
  | 'Asesmen Harian'
  | 'Asesmen Sumatif Lingkup Materi'
  | 'Asesmen Sumatif Akhir Semester'
  | 'Asesmen Sumatif Akhir Tahun'
  | 'STS/PTS'
  | 'SAS/PAS'
  | 'Praktik'
  | 'Proyek'
  | 'Ujian Lainnya';

export type AttendanceStatus = 'H' | 'S' | 'I' | 'A';

export type LKPDType =
  | 'Individu'
  | 'Kelompok'
  | 'Proyek'
  | 'Praktik'
  | 'Literasi'
  | 'Pemecahan Masalah';

export type DocumentStatus =
  | 'Belum dibuat'
  | 'Dalam proses'
  | 'Selesai'
  | 'Perlu diperbaiki';

export interface SchoolProfile {
  id: string; // 'default'
  name: string;
  npsn: string;
  level: SchoolLevel;
  address: string;
  village: string;
  district: string;
  city: string;
  province: string;
  academicYearText: string;
  activeSemester: SemesterNumber;
  curriculum: CurriculumType;
  logoBase64?: string;
  phone: string;
  email: string;
  additionalInfo: string;
  updatedAt: string;
}

export interface TeacherProfile {
  id: string; // 'default'
  fullName: string;
  nip: string;
  nuptk: string;
  rankGrade: string;
  position: string;
  subjects: string[];
  classesTaught: string[];
  phone: string;
  email: string;
  updatedAt: string;
}

export interface PrincipalProfile {
  id: string; // 'default'
  fullName: string;
  nip: string;
  rankGrade: string;
  position: string;
  updatedAt: string;
}

export interface AcademicYear {
  id: string;
  name: string; // e.g. '2026/2027'
  startDate: string;
  endDate: string;
  activeSemester: SemesterNumber;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
}

export type CalendarEventType =
  | 'Libur Nasional'
  | 'Libur Sekolah'
  | 'Kegiatan Sekolah'
  | 'PTS/STS'
  | 'PAS/SAS'
  | 'Projek'
  | 'Kegiatan Khusus';

export interface CalendarEvent {
  id: string;
  academicYearId: string;
  title: string;
  startDate: string;
  endDate: string;
  type: CalendarEventType;
  semester: SemesterNumber;
  notes?: string;
}

export interface CalendarConfig {
  id: string;
  academicYearId: string;
  yearStartDate: string;
  yearEndDate: string;
  sem1StartDate: string;
  sem1EndDate: string;
  sem2StartDate: string;
  sem2EndDate: string;
  learningDaysPerWeek: 5 | 6; // Senin-Jumat or Senin-Sabtu
  hoursPerWeek: number; // JP per minggu untuk mapel
  minutesPerHour: number; // e.g. 40 menit SMP, 45 SMA, 35 SD
  updatedAt: string;
}

export interface ClassGroup {
  id: string;
  academicYearId: string;
  gradeLevel: string; // e.g. '7', '8', '9', 'X', 'XI', 'XII', '4', '5', '6'
  name: string; // e.g. '7A', '8B'
  semester: SemesterNumber;
  homeroomTeacher: string;
  subject: string;
  notes: string;
  createdAt: string;
}

export interface Student {
  id: string;
  academicYearId: string;
  classId: string;
  orderNumber: number;
  nis: string;
  nisn: string;
  fullName: string;
  gender: Gender;
  status: StudentStatus;
  notes: string;
  createdAt: string;
}

export interface LearningOutcomeCP {
  id: string;
  academicYearId: string;
  subject: string;
  phase: string; // 'A', 'B', 'C', 'D', 'E', 'F'
  gradeLevel: string;
  element: string;
  description: string;
  referenceSource: string;
  isAiDraft: boolean;
  isVerified: boolean;
  createdAt: string;
}

export interface LearningObjectiveTP {
  id: string;
  academicYearId: string;
  cpId: string;
  code: string; // e.g. 'TP.7.1'
  element: string;
  objective: string;
  material: string;
  gradeLevel: string;
  semester: SemesterNumber;
  hoursAllocation: number; // JP
  difficulty: DifficultyLevel;
  orderIndex: number;
  isAiDraft?: boolean;
  createdAt: string;
}

export interface ATPItem {
  tpId: string;
  orderIndex: number;
  plannedWeekStart: number;
  plannedWeekEnd: number;
  hoursAllocation: number;
  notes: string;
}

export interface ATPDocument {
  id: string;
  academicYearId: string;
  subject: string;
  gradeLevel: string;
  phase: string;
  semester: SemesterNumber;
  cpId: string;
  title: string;
  items: ATPItem[];
  updatedAt: string;
}

export interface ProtaItem {
  id: string;
  academicYearId: string;
  gradeLevel: string;
  subject: string;
  semester: SemesterNumber;
  cpId: string;
  tpId: string;
  material: string;
  hoursAllocation: number;
  plannedWeeks: string; // e.g. 'Minggu 1 - 3'
  notes: string;
  orderIndex: number;
}

export interface PromesItem {
  id: string;
  academicYearId: string;
  gradeLevel: string;
  subject: string;
  semester: SemesterNumber;
  protaId?: string;
  tpId: string;
  material: string;
  month: string; // e.g. 'Juli', 'Agustus'
  weekNumber: number; // 1..5 in month or semester week
  dateRange: string;
  hoursAllocation: number;
  activity: string;
  assessment: string;
  notes: string;
}

export interface SyllabusItem {
  id: string;
  academicYearId: string;
  subject: string;
  gradeLevel: string;
  phase: string;
  semester: SemesterNumber;
  cpId: string;
  tpId: string;
  material: string;
  learningActivities: string;
  method: string;
  media: string;
  resources: string;
  assessment: string;
  hoursAllocation: number;
  orderIndex: number;
}

export interface TeachingModule {
  id: string;
  academicYearId: string;
  title: string;
  classId: string;
  gradeLevel: string;
  semester: SemesterNumber;
  subject: string;
  cpId: string;
  tpIds: string[];
  material: string;
  meetingsCount: number;
  hoursAllocation: number;
  learningModel: string;
  methods: string;
  media: string;
  resources: string;
  studentCharacteristics: string;
  learningNeeds: string;
  // 24-section Kurikulum Merdeka fields
  moduleIdentity: string;
  generalInfo: string;
  initialCompetency: string;
  pancasilaProfile: string;
  facilities: string;
  targetStudents: string;
  meaningfulUnderstanding: string;
  triggerQuestions: string;
  openingActivity: string;
  coreActivity: string;
  closingActivity: string;
  diagnosticAssessment: string;
  formativeAssessment: string;
  summativeAssessment: string;
  rubric: string;
  enrichment: string;
  remedial: string;
  teacherReflection: string;
  studentReflection: string;
  attachment: string;
  isAiDraft?: boolean;
  updatedAt: string;
}

export interface LKPDDocument {
  id: string;
  academicYearId: string;
  title: string;
  type: LKPDType;
  classId: string;
  gradeLevel: string;
  subject: string;
  cpId: string;
  tpId: string;
  moduleId?: string;
  material: string;
  date: string;
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
  resultNotes: string;
  conclusionPrompt: string;
  reflectionPrompt: string;
  rubric: string;
  isAiDraft?: boolean;
  updatedAt: string;
}

export interface LearningMediaItem {
  id: string;
  academicYearId: string;
  title: string;
  type: 'Slide/Presentasi' | 'Video' | 'Alat Peraga' | 'Simulasi/Digital' | 'Audio' | 'Lembar Gambar' | 'Lainnya';
  subject: string;
  gradeLevel: string;
  tpId?: string;
  moduleId?: string;
  description: string;
  usageGuide: string;
  linkOrSource: string;
  updatedAt: string;
}

export interface QuestionBankItem {
  id: string;
  academicYearId: string;
  gradeLevel: string;
  subject: string;
  semester: SemesterNumber;
  tpId: string;
  material: string;
  indicator: string;
  questionType: QuestionType;
  cognitiveLevel: CognitiveLevel;
  difficulty: DifficultyLevel;
  questionText: string;
  options: string[]; // For PG, PG Kompleks, Benar/Salah, Menjodohkan
  correctAnswer: string;
  explanation: string;
  maxScore: number;
  isAiDraft?: boolean;
  createdAt: string;
}

export interface BlueprintRow {
  number: number;
  cpText: string;
  tpCode: string;
  material: string;
  indicator: string;
  cognitiveLevel: CognitiveLevel;
  questionType: QuestionType;
  questionNumber: string;
  maxScore: number;
}

export interface RubricRow {
  criteria: string;
  excellent: string;
  good: string;
  fair: string;
  needsGuidance: string;
  maxScore: number;
}

export interface Assessment {
  id: string;
  academicYearId: string;
  name: string;
  category: AssessmentCategory;
  classId: string;
  gradeLevel: string;
  semester: SemesterNumber;
  subject: string;
  tpIds: string[];
  material: string;
  date: string;
  weight: number;
  maxScore: number;
  questionIds: string[];
  customQuestions: QuestionBankItem[];
  blueprint: BlueprintRow[];
  scoringGuide: string;
  rubric: RubricRow[];
  remedialPlan: string;
  enrichmentPlan: string;
  isShuffled?: boolean;
  updatedAt: string;
}

export interface AttendanceRecordItem {
  studentId: string;
  status: AttendanceStatus;
  note?: string;
}

export interface AttendanceSession {
  id: string;
  academicYearId: string;
  classId: string;
  subject: string;
  date: string; // YYYY-MM-DD
  meetingNumber: number;
  lessonHours: string; // e.g. '1-2'
  semester: SemesterNumber;
  records: AttendanceRecordItem[];
  updatedAt: string;
}

export interface TeachingJournal {
  id: string;
  academicYearId: string;
  classId: string;
  subject: string;
  semester: SemesterNumber;
  date: string;
  dayName: string;
  meetingNumber: number;
  lessonHours: string;
  tpId: string;
  moduleId?: string;
  material: string;
  activities: string;
  method: string;
  attendanceSummary: string;
  notes: string;
  reflection: string;
  followUp: string;
  updatedAt: string;
}

export interface GradeComponent {
  id: string;
  academicYearId: string;
  subject: string;
  semester: SemesterNumber;
  name: string; // Tugas, Quiz, UH, Praktik, Projek, STS, SAS
  weight: number; // 0..100
  orderIndex: number;
}

export interface StudentGrade {
  id: string;
  academicYearId: string;
  classId: string;
  studentId: string;
  semester: SemesterNumber;
  componentId: string;
  assessmentId?: string;
  tpId?: string;
  score: number | null; // null means belum dinilai
  notes?: string;
  updatedAt: string;
}

export interface ReportDescription {
  id: string;
  academicYearId: string;
  classId: string;
  studentId: string;
  semester: SemesterNumber;
  subject: string;
  finalScore: number | null;
  achievedTpIds: string[];
  developingTpIds: string[];
  descriptionText: string;
  followUpNote: string;
  isAiDraft: boolean;
  isApproved: boolean;
  updatedAt: string;
}

export type DocumentCategoryKey =
  | 'identitas'
  | 'daftar_siswa'
  | 'presensi'
  | 'jurnal'
  | 'daftar_nilai'
  | 'rekap_nilai'
  | 'atp'
  | 'prota'
  | 'promes'
  | 'silabus'
  | 'modul_ajar'
  | 'lkpd'
  | 'asesmen'
  | 'kisi_kisi'
  | 'kunci_jawaban'
  | 'rapor'
  | 'administrasi_kelas';

export interface DocumentTemplate {
  id: string;
  name: string;
  category: DocumentCategoryKey;
  isDefault: boolean;
  fileName?: string;
  docxBase64?: string; // Uploaded custom DOCX school template
  placeholdersFound: string[];
  notes: string;
  updatedAt: string;
}

export interface MonitoringOverride {
  id: string; // `${academicYearId}_${itemKey}`
  academicYearId: string;
  itemKey: string;
  status: DocumentStatus;
  notes: string;
  updatedAt: string;
}

export interface BackupRecord {
  id: string;
  createdAt: string;
  scope: 'Semua Data' | 'Per Tahun Ajaran' | 'Per Kelas';
  academicYearName: string;
  label: string;
  itemCount: number;
}

export interface AutoSnapshot {
  id: string;
  createdAt: string;
  reason: string;
  academicYearName: string;
  itemCount: number;
  payloadJson: string;
}

export interface AppSettings {
  id: string; // 'default'
  kktpThreshold: number; // default 75
  paperSize: 'A4';
  defaultOrientation: 'portrait' | 'landscape';
  defaultFontFamily: 'Times New Roman' | 'Calibri' | 'Arial';
  lastBackupAt?: string;
  updatedAt: string;
}

