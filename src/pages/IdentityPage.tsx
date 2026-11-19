import React, { useEffect, useState } from 'react';
import { Upload, RotateCcw, Eye, Save } from 'lucide-react';
import {
  DEFAULT_SCHOOL_LOGO_URL,
  db,
  getCurrentAcademicYearDefaults,
} from '../db/database';
import { useApp } from '../context/AppContext';
import {
  DocxButton,
  FormField,
  inputClass,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SegmentedTabs,
} from '../components/UI';
import {
  downloadDocxBlob,
  generateIdentityDocx,
} from '../services/docxGenerator';
import type {
  CurriculumType,
  PrincipalProfile,
  SchoolLevel,
  SchoolProfile,
  TeacherProfile,
} from '../types/domain';

export const IdentityPage: React.FC = () => {
  const {
    school,
    teacher,
    principal,
    activeYear,
    settings,
    refreshData,
    notify,
    confirm,
  } = useApp();

  const [tab, setTab] = useState<'sekolah' | 'guru' | 'kepsek' | 'pratinjau'>('sekolah');
  const [schForm, setSchForm] = useState<SchoolProfile | null>(null);
  const [tchForm, setTchForm] = useState<TeacherProfile | null>(null);
  const [prnForm, setPrnForm] = useState<PrincipalProfile | null>(null);
  const [subjectsText, setSubjectsText] = useState('');
  const [classesText, setClassesText] = useState('');

  useEffect(() => {
    if (school) {
      setSchForm({
        ...school,
        logoBase64:
          school.logoBase64 === undefined
            ? DEFAULT_SCHOOL_LOGO_URL
            : school.logoBase64,
      });
    }
    if (teacher) {
      setTchForm({ ...teacher });
      setSubjectsText(teacher.subjects.join(', '));
      setClassesText(teacher.classesTaught.join(', '));
    }
    if (principal) setPrnForm({ ...principal });
  }, [school, teacher, principal]);

  if (!schForm || !tchForm || !prnForm) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify('Ukuran logo maksimal 2 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setSchForm((prev) => (prev ? { ...prev, logoBase64: result } : prev));
      notify('Logo sekolah dimuat. Klik Simpan untuk menerapkan.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAll = async () => {
    const now = new Date().toISOString();
    const cleanedYearName =
      schForm.academicYearText.trim() ||
      activeYear?.name ||
      getCurrentAcademicYearDefaults().name;
    const updatedSchool: SchoolProfile = {
      ...schForm,
      academicYearText: cleanedYearName,
      updatedAt: now,
    };
    const updatedTeacher: TeacherProfile = {
      ...tchForm,
      subjects: subjectsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      classesTaught: classesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      updatedAt: now,
    };
    const updatedPrincipal: PrincipalProfile = { ...prnForm, updatedAt: now };

    await db.transaction(
      'rw',
      [db.schoolProfile, db.teacherProfile, db.principalProfile, db.academicYears],
      async () => {
        await db.schoolProfile.put(updatedSchool);
        await db.teacherProfile.put(updatedTeacher);
        await db.principalProfile.put(updatedPrincipal);
        if (activeYear) {
          await db.academicYears.update(activeYear.id, {
            name: cleanedYearName,
            activeSemester: updatedSchool.activeSemester,
          });
        }
      }
    );
    await refreshData();
    notify('Identitas sekolah, guru, kepala sekolah, dan tahun ajaran aktif berhasil disimpan.');
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Reset Data Identitas?',
      message:
        'Tindakan ini akan mengosongkan formulir identitas sekolah, guru, dan kepala sekolah. Dokumen yang sudah dibuat sebelumnya tidak terhapus.',
      confirmLabel: 'Ya, Reset Identitas',
      danger: true,
    });
    if (!ok) return;

    const now = new Date().toISOString();
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
      academicYearText: activeYear?.name || '2026/2027',
      activeSemester: activeYear?.activeSemester || 1,
      curriculum: 'Kurikulum Merdeka',
      logoBase64: DEFAULT_SCHOOL_LOGO_URL,
      phone: '',
      email: '',
      additionalInfo: '',
      updatedAt: now,
    });
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
    await db.principalProfile.put({
      id: 'default',
      fullName: '',
      nip: '',
      rankGrade: '',
      position: 'Kepala Sekolah',
      updatedAt: now,
    });
    await refreshData();
    notify('Data identitas berhasil direset.', 'info');
  };

  const handleDownloadDocx = async () => {
    const blob = await generateIdentityDocx({
      school: schForm,
      teacher: {
        ...tchForm,
        subjects: subjectsText.split(',').map((s) => s.trim()).filter(Boolean),
        classesTaught: classesText.split(',').map((s) => s.trim()).filter(Boolean),
      },
      principal: prnForm,
      academicYear: activeYear ?? undefined,
      settings: settings ?? undefined,
    });
    await downloadDocxBlob(blob, `Identitas_Administrasi_${schForm.name || 'Sekolah'}.docx`);
    notify('Dokumen DOCX Identitas berhasil diunduh.');
  };

  return (
    <div>
      <PageHeader
        title="Identitas dan Pengaturan Kop Dokumen"
        description="Isi satu kali untuk digunakan otomatis pada ATP, PROTA, PROMES, Silabus, Modul Ajar, LKPD, Asesmen, Presensi, Jurnal, Daftar Nilai, Rapor, dan Paket Supervisi."
        actions={
          <>
            <SecondaryButton onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </SecondaryButton>
            <DocxButton onClick={handleDownloadDocx} />
            <PrimaryButton onClick={handleSaveAll}>
              <Save className="w-4 h-4" />
              <span>Simpan Semua Identitas</span>
            </PrimaryButton>
          </>
        }
      />

      <SegmentedTabs
        tabs={[
          { id: 'sekolah', label: 'Identitas Sekolah' },
          { id: 'guru', label: 'Identitas Guru' },
          { id: 'kepsek', label: 'Kepala Sekolah' },
          { id: 'pratinjau', label: 'Pratinjau Kop & Tanda Tangan' },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {tab === 'sekolah' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-slate-100">
            <div className="w-20 h-20 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
              {schForm.logoBase64 ? (
                <img
                  src={schForm.logoBase64}
                  alt="Logo Sekolah"
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <span className="text-xs text-slate-400 text-center px-2">
                  Belum Ada Logo
                </span>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Logo Sekolah / Instansi
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Format PNG atau JPG (maks. 2 MB). Otomatis tampil pada kop dokumen Word DOCX.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="px-3.5 py-2 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg cursor-pointer inline-flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Unggah Logo Lain</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </label>
                {schForm.logoBase64 !== DEFAULT_SCHOOL_LOGO_URL && (
                  <button
                    type="button"
                    onClick={() =>
                      setSchForm({ ...schForm, logoBase64: DEFAULT_SCHOOL_LOGO_URL })
                    }
                    className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    Gunakan Logo Sekolah Bawaan
                  </button>
                )}
                {schForm.logoBase64 && (
                  <button
                    type="button"
                    onClick={() => setSchForm({ ...schForm, logoBase64: '' })}
                    className="px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg"
                  >
                    Hapus Logo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Nama Sekolah" required>
              <input
                type="text"
                className={inputClass}
                value={schForm.name}
                onChange={(e) => setSchForm({ ...schForm, name: e.target.value })}
                placeholder="Contoh: SMP Negeri 1 Nusantara"
              />
            </FormField>
            <FormField label="NPSN">
              <input
                type="text"
                className={`${inputClass} font-mono`}
                value={schForm.npsn}
                onChange={(e) => setSchForm({ ...schForm, npsn: e.target.value })}
                placeholder="8 digit NPSN"
              />
            </FormField>
            <FormField label="Jenjang Sekolah">
              <select
                className={inputClass}
                value={schForm.level}
                onChange={(e) =>
                  setSchForm({ ...schForm, level: e.target.value as SchoolLevel })
                }
              >
                <option value="SD/MI">SD / MI</option>
                <option value="SMP/MTs">SMP / MTs</option>
                <option value="SMA/MA">SMA / MA</option>
                <option value="SMK/MAK">SMK / MAK</option>
                <option value="SLB">SLB</option>
              </select>
            </FormField>
            <FormField label="Kurikulum">
              <select
                className={inputClass}
                value={schForm.curriculum}
                onChange={(e) =>
                  setSchForm({
                    ...schForm,
                    curriculum: e.target.value as CurriculumType,
                  })
                }
              >
                <option value="Kurikulum Merdeka">Kurikulum Merdeka</option>
                <option value="Kurikulum 2013">Kurikulum 2013</option>
                <option value="KTSP / Sekolah">KTSP / Kurikulum Sekolah</option>
              </select>
            </FormField>
            <FormField
              label="Tahun Ajaran Aktif"
              hint="Terisi otomatis dari tahun pelajaran berjalan, atau ubah manual lalu klik Simpan."
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className={`${inputClass} font-mono flex-1`}
                  value={schForm.academicYearText}
                  onChange={(e) =>
                    setSchForm({ ...schForm, academicYearText: e.target.value })
                  }
                  placeholder="2026/2027"
                />
                <button
                  type="button"
                  onClick={() => {
                    const def = getCurrentAcademicYearDefaults();
                    setSchForm({
                      ...schForm,
                      academicYearText: def.name,
                      activeSemester: def.activeSemester,
                    });
                    notify(
                      `Disesuaikan ke tahun pelajaran berjalan (${def.name} Sem ${def.activeSemester}). Klik Simpan untuk menerapkan.`,
                      'info'
                    );
                  }}
                  className="px-2.5 py-2 text-xs font-medium text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg whitespace-nowrap shrink-0"
                  title="Deteksi otomatis tahun pelajaran berjalan dari tanggal saat ini"
                >
                  Tahun Berjalan
                </button>
              </div>
            </FormField>
            <FormField label="Semester Aktif">
              <select
                className={inputClass}
                value={schForm.activeSemester}
                onChange={(e) =>
                  setSchForm({
                    ...schForm,
                    activeSemester: Number(e.target.value) as 1 | 2,
                  })
                }
              >
                <option value={1}>Semester 1 (Ganjil)</option>
                <option value={2}>Semester 2 (Genap)</option>
              </select>
            </FormField>
            <div className="md:col-span-2 lg:col-span-3">
              <FormField label="Alamat Jalan / Dusun">
                <input
                  type="text"
                  className={inputClass}
                  value={schForm.address}
                  onChange={(e) => setSchForm({ ...schForm, address: e.target.value })}
                  placeholder="Jl. Pendidikan No. 10"
                />
              </FormField>
            </div>
            <FormField label="Desa / Kelurahan">
              <input
                type="text"
                className={inputClass}
                value={schForm.village}
                onChange={(e) => setSchForm({ ...schForm, village: e.target.value })}
              />
            </FormField>
            <FormField label="Kecamatan">
              <input
                type="text"
                className={inputClass}
                value={schForm.district}
                onChange={(e) => setSchForm({ ...schForm, district: e.target.value })}
              />
            </FormField>
            <FormField label="Kabupaten / Kota">
              <input
                type="text"
                className={inputClass}
                value={schForm.city}
                onChange={(e) => setSchForm({ ...schForm, city: e.target.value })}
              />
            </FormField>
            <FormField label="Provinsi">
              <input
                type="text"
                className={inputClass}
                value={schForm.province}
                onChange={(e) => setSchForm({ ...schForm, province: e.target.value })}
              />
            </FormField>
            <FormField label="Nomor Telepon Sekolah">
              <input
                type="text"
                className={`${inputClass} font-mono`}
                value={schForm.phone}
                onChange={(e) => setSchForm({ ...schForm, phone: e.target.value })}
              />
            </FormField>
            <FormField label="Email Sekolah">
              <input
                type="email"
                className={inputClass}
                value={schForm.email}
                onChange={(e) => setSchForm({ ...schForm, email: e.target.value })}
              />
            </FormField>
            <div className="md:col-span-2 lg:col-span-3">
              <FormField label="Informasi Tambahan (Akreditasi / Slogan / Website)">
                <input
                  type="text"
                  className={inputClass}
                  value={schForm.additionalInfo}
                  onChange={(e) =>
                    setSchForm({ ...schForm, additionalInfo: e.target.value })
                  }
                />
              </FormField>
            </div>
          </div>
        </div>
      )}

      {tab === 'guru' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Nama Lengkap & Gelar" required>
              <input
                type="text"
                className={inputClass}
                value={tchForm.fullName}
                onChange={(e) => setTchForm({ ...tchForm, fullName: e.target.value })}
                placeholder="Contoh: Budi Santoso, S.Pd."
              />
            </FormField>
            <FormField label="NIP / NI PPPK">
              <input
                type="text"
                className={`${inputClass} font-mono`}
                value={tchForm.nip}
                onChange={(e) => setTchForm({ ...tchForm, nip: e.target.value })}
              />
            </FormField>
            <FormField label="NUPTK">
              <input
                type="text"
                className={`${inputClass} font-mono`}
                value={tchForm.nuptk}
                onChange={(e) => setTchForm({ ...tchForm, nuptk: e.target.value })}
              />
            </FormField>
            <FormField label="Pangkat / Golongan">
              <input
                type="text"
                className={inputClass}
                value={tchForm.rankGrade}
                onChange={(e) => setTchForm({ ...tchForm, rankGrade: e.target.value })}
                placeholder="Contoh: Penata Muda Tk. I / III.b"
              />
            </FormField>
            <FormField label="Jabatan">
              <input
                type="text"
                className={inputClass}
                value={tchForm.position}
                onChange={(e) => setTchForm({ ...tchForm, position: e.target.value })}
              />
            </FormField>
            <FormField
              label="Mata Pelajaran yang Diampu"
              hint="Pisahkan dengan koma jika lebih dari satu"
            >
              <input
                type="text"
                className={inputClass}
                value={subjectsText}
                onChange={(e) => setSubjectsText(e.target.value)}
                placeholder="Contoh: Matematika, Informatika"
              />
            </FormField>
            <FormField
              label="Kelas yang Diajar"
              hint="Pisahkan dengan koma (contoh: 7A, 7B, 8A)"
            >
              <input
                type="text"
                className={inputClass}
                value={classesText}
                onChange={(e) => setClassesText(e.target.value)}
              />
            </FormField>
            <FormField label="Nomor Telepon / WhatsApp">
              <input
                type="text"
                className={`${inputClass} font-mono`}
                value={tchForm.phone}
                onChange={(e) => setTchForm({ ...tchForm, phone: e.target.value })}
              />
            </FormField>
            <FormField label="Email Guru">
              <input
                type="email"
                className={inputClass}
                value={tchForm.email}
                onChange={(e) => setTchForm({ ...tchForm, email: e.target.value })}
              />
            </FormField>
          </div>
        </div>
      )}

      {tab === 'kepsek' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            <FormField label="Nama Lengkap Kepala Sekolah & Gelar" required>
              <input
                type="text"
                className={inputClass}
                value={prnForm.fullName}
                onChange={(e) => setPrnForm({ ...prnForm, fullName: e.target.value })}
                placeholder="Contoh: Dra. Siti Aminah, M.Pd."
              />
            </FormField>
            <FormField label="NIP Kepala Sekolah">
              <input
                type="text"
                className={`${inputClass} font-mono`}
                value={prnForm.nip}
                onChange={(e) => setPrnForm({ ...prnForm, nip: e.target.value })}
              />
            </FormField>
            <FormField label="Pangkat / Golongan">
              <input
                type="text"
                className={inputClass}
                value={prnForm.rankGrade}
                onChange={(e) => setPrnForm({ ...prnForm, rankGrade: e.target.value })}
              />
            </FormField>
            <FormField label="Jabatan">
              <input
                type="text"
                className={inputClass}
                value={prnForm.position}
                onChange={(e) => setPrnForm({ ...prnForm, position: e.target.value })}
              />
            </FormField>
          </div>
        </div>
      )}

      {tab === 'pratinjau' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-4xl mx-auto shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
            <Eye className="w-4 h-4" />
            <span>Pratinjau Kop Surat dan Blok Tanda Tangan Resmi pada Dokumen DOCX</span>
          </div>

          <div className="border border-slate-300 p-8 rounded-lg bg-white font-serif">
            {/* Kop Surat */}
            <div className="flex items-center gap-6 pb-4 border-b-4 border-double border-blue-900">
              {schForm.logoBase64 && (
                <img
                  src={schForm.logoBase64}
                  alt="Logo"
                  className="w-20 h-20 object-contain shrink-0"
                />
              )}
              <div className="flex-1 text-center">
                <div className="text-xl font-bold uppercase tracking-wide text-slate-900">
                  {schForm.name || 'NAMA SEKOLAH / MADRASAH'}
                </div>
                <div className="text-xs text-slate-700 mt-1">
                  Jenjang: {schForm.level} · NPSN: {schForm.npsn || '-'} · Kurikulum: {schForm.curriculum}
                </div>
                <div className="text-xs text-slate-700">
                  {[schForm.address, schForm.village, schForm.district, schForm.city, schForm.province]
                    .filter(Boolean)
                    .join(', ') || 'Alamat Lengkap Sekolah'}
                </div>
                <div className="text-xs text-slate-600">
                  Telp: {schForm.phone || '-'} · Email: {schForm.email || '-'}
                </div>
              </div>
            </div>

            <div className="my-8 text-center text-sm text-slate-400 italic">
              [ Isi Dokumen Administrasi Pembelajaran (ATP / PROTA / Modul Ajar / Daftar Nilai / Rapor) ]
            </div>

            {/* Tanda Tangan */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-sm text-slate-900">
              <div>
                <div>Mengetahui,</div>
                <div className="font-semibold">{prnForm.position || 'Kepala Sekolah'}</div>
                <div className="h-16" />
                <div className="font-bold underline">
                  {prnForm.fullName || '........................................'}
                </div>
                <div className="text-xs">NIP. {prnForm.nip || '-'}</div>
              </div>
              <div>
                <div>
                  {schForm.city || '................'},{' '}
                  {new Date().toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                <div className="font-semibold">{tchForm.position || 'Guru Mata Pelajaran'}</div>
                <div className="h-16" />
                <div className="font-bold underline">
                  {tchForm.fullName || '........................................'}
                </div>
                <div className="text-xs">NIP. {tchForm.nip || '-'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
