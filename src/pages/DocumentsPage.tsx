import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  FileDown,
  FolderArchive,
  Trash2,
  Upload,
} from 'lucide-react';
import { createId, db } from '../db/database';
import { useApp } from '../context/AppContext';
import {
  DocxButton,
  EmptyState,
  FormField,
  inputClass,
  PageHeader,
  PrimaryButton,
  SegmentedTabs,
} from '../components/UI';
import {
  downloadDocxBlob,
  extractDocxPlaceholders,
  generateCpTpDocx,
  generateEffectiveWeeksDocx,
  generateIdentityDocx,
  renderCustomDocxTemplate,
} from '../services/docxGenerator';
import { calculateEffectiveWeeks } from '../services/effectiveWeeks';
import {
  generateSupervisionZipPackage,
  triggerZipDownload,
  type SupervisionSectionKey,
} from '../services/zipPackageService';
import type {
  ClassGroup,
  DocumentCategoryKey,
  DocumentTemplate,
  SemesterNumber,
} from '../types/domain';

const PLACEHOLDER_GUIDE = [
  '{{NAMA_SEKOLAH}}',
  '{{NPSN}}',
  '{{NAMA_GURU}}',
  '{{NIP_GURU}}',
  '{{NAMA_KEPALA_SEKOLAH}}',
  '{{NIP_KEPALA_SEKOLAH}}',
  '{{KELAS}}',
  '{{MATA_PELAJARAN}}',
  '{{TAHUN_AJARAN}}',
  '{{SEMESTER}}',
  '{{DAFTAR_SISWA}}',
  '{{DAFTAR_NILAI}}',
];

const SUPERVISION_FOLDERS: Array<{
  key: SupervisionSectionKey;
  part: string;
  label: string;
}> = [
  { key: '01_IDENTITAS', part: 'Bagian 1', label: '01_IDENTITAS (Sekolah, Guru, Kepala Sekolah)' },
  { key: '02_DATA_KELAS', part: 'Bagian 2', label: '02_DATA_KELAS (Data Kelas & Daftar Siswa)' },
  { key: '03_PERENCANAAN', part: 'Bagian 3', label: '03_PERENCANAAN (Kalender, Minggu Efektif, CP, TP, ATP, PROTA, PROMES, Silabus)' },
  { key: '04_MODUL_AJAR', part: 'Bagian 4', label: '04_MODUL_AJAR (Modul Ajar / RPP)' },
  { key: '05_LKPD', part: 'Bagian 4', label: '05_LKPD (Lembar Kerja Peserta Didik)' },
  { key: '06_ASESMEN', part: 'Bagian 5', label: '06_ASESMEN (Naskah Soal, Kisi-Kisi, Kunci Jawaban, Rubrik)' },
  { key: '07_PRESENSI', part: 'Bagian 6', label: '07_PRESENSI (Rekap Presensi Siswa)' },
  { key: '08_JURNAL', part: 'Bagian 4', label: '08_JURNAL (Jurnal Mengajar)' },
  { key: '09_DAFTAR_NILAI', part: 'Bagian 6', label: '09_DAFTAR_NILAI (Daftar Nilai Per Kelas)' },
  { key: '10_REKAP_NILAI', part: 'Bagian 6', label: '10_REKAP_NILAI (Rekap & Analisis Nilai)' },
  { key: '11_RAPOR', part: 'Bagian 7', label: '11_RAPOR (Deskripsi Rapor & Capaian)' },
];

export const DocumentsPage: React.FC = () => {
  const {
    activeSubTab,
    academicYears,
    activeYear,
    school,
    teacher,
    principal,
    settings,
    dataVersion,
    refreshData,
    notify,
    navigate,
  } = useApp();

  const [tab, setTab] = useState<'template' | 'generator' | 'supervisi' | 'arsip'>(
    'supervisi'
  );
  useEffect(() => {
    if (
      activeSubTab === 'template' ||
      activeSubTab === 'generator' ||
      activeSubTab === 'supervisi' ||
      activeSubTab === 'arsip'
    ) {
      setTab(activeSubTab);
    }
  }, [activeSubTab]);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  // Template upload form
  const [tplName, setTplName] = useState('');
  const [tplCat, setTplCat] = useState<DocumentCategoryKey>('modul_ajar');
  const [tplClassId, setTplClassId] = useState('');

  // Supervision ZIP state
  const [supSemester, setSupSemester] = useState<SemesterNumber>(1);
  const [supClassIds, setSupClassIds] = useState<string[]>([]);
  const [supFolders, setSupFolders] = useState<SupervisionSectionKey[]>(
    SUPERVISION_FOLDERS.map((f) => f.key)
  );
  const [zipLoading, setZipLoading] = useState(false);

  useEffect(() => {
    if (!activeYear) return;
    setSupSemester(activeYear.activeSemester);
    let cancelled = false;
    (async () => {
      const [clsL, tplL] = await Promise.all([
        db.classGroups.where('academicYearId').equals(activeYear.id).toArray(),
        db.documentTemplates.toArray(),
      ]);
      if (!cancelled) {
        setClasses(clsL);
        setTemplates(tplL);
        setSupClassIds(clsL.map((c) => c.id));
        if (clsL.length > 0 && !tplClassId) setTplClassId(clsL[0].id);
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

  const handleUploadTemplate = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      notify('Format template harus Microsoft Word (.docx).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result || '');
      const placeholders = extractDocxPlaceholders(base64);
      await db.documentTemplates.put({
        id: createId('tpl'),
        name: tplName.trim() || file.name.replace(/\.docx$/i, ''),
        category: tplCat,
        isDefault: false,
        fileName: file.name,
        docxBase64: base64,
        placeholdersFound: placeholders,
        notes: `Terdeteksi ${placeholders.length} placeholder.`,
        updatedAt: new Date().toISOString(),
      });
      setTplName('');
      await refreshData();
      notify(`Template "${file.name}" disimpan (${placeholders.length} placeholder terdeteksi).`);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateFromCustomTemplate = async (tpl: DocumentTemplate) => {
    if (!tpl.docxBase64 || !school || !teacher || !principal || !activeYear) return;
    const cls = classes.find((c) => c.id === tplClassId);
    const students = cls
      ? await db.students.where('classId').equals(cls.id).toArray()
      : [];
    const studentLines = students
      .sort((a, b) => a.orderNumber - b.orderNumber)
      .map((s, idx) => `${idx + 1}. ${s.fullName} (NIS: ${s.nis || '-'})`)
      .join('\n');

    try {
      const blob = renderCustomDocxTemplate(tpl.docxBase64, {
        NAMA_SEKOLAH: school.name || '-',
        NPSN: school.npsn || '-',
        ALAMAT_SEKOLAH: school.address || '-',
        NAMA_GURU: teacher.fullName || '-',
        NIP_GURU: teacher.nip || '-',
        NAMA_KEPALA_SEKOLAH: principal.fullName || '-',
        NIP_KEPALA_SEKOLAH: principal.nip || '-',
        KELAS: cls?.name || '-',
        MATA_PELAJARAN: cls?.subject || teacher.subjects[0] || '-',
        TAHUN_AJARAN: activeYear.name,
        SEMESTER: String(activeYear.activeSemester),
        DAFTAR_SISWA: studentLines || '-',
        DAFTAR_NILAI: 'Gunakan Generator Daftar Nilai untuk tabel nilai rinci.',
      });
      await downloadDocxBlob(blob, `${tpl.name}_${cls?.name || activeYear.name}.docx`);
      notify('Dokumen DOCX dari template sekolah berhasil diunduh.');
    } catch {
      notify(
        'Gagal merender placeholder template DOCX. Pastikan penulisan tag seperti {{NAMA_SEKOLAH}} tidak terpecah format Word.',
        'error'
      );
    }
  };

  const handleGenerateSupervisionZip = async () => {
    if (!activeYear) return;
    if (supFolders.length === 0) {
      notify('Pilih minimal satu bagian administrasi untuk dimasukkan ke ZIP.', 'warning');
      return;
    }
    setZipLoading(true);
    try {
      const { blob, filename, fileCount } = await generateSupervisionZipPackage({
        academicYearId: activeYear.id,
        semester: supSemester,
        classIds: supClassIds,
        selectedFolders: supFolders,
      });
      triggerZipDownload(blob, filename);
      notify(`Paket Supervisi (${fileCount} file DOCX) berhasil diunduh: ${filename}`);
    } catch (err: unknown) {
      notify(
        err instanceof Error ? err.message : 'Gagal menyusun paket ZIP supervisi.',
        'error'
      );
    } finally {
      setZipLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Dokumen, Template Sekolah & Paket Supervisi"
        description="Unggah template DOCX resmi sekolah, unduh dokumen Word A4 siap cetak, atau kemas seluruh administrasi ke dalam paket ZIP Supervisi Kepala Sekolah."
      />

      <SegmentedTabs
        tabs={[
          { id: 'supervisi', label: 'Paket Supervisi (ZIP)' },
          { id: 'template', label: 'Template Dokumen Sekolah', count: templates.length },
          { id: 'generator', label: 'Generator DOCX Cepat' },
          { id: 'arsip', label: 'Arsip Tahun Ajaran', count: academicYears.filter((y) => y.isArchived).length },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {/* TAB 1: PAKET SUPERVISI ZIP */}
      {tab === 'supervisi' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Pilih Folder Dokumen Supervisi ({supFolders.length}/{SUPERVISION_FOLDERS.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Setiap folder berisi file Microsoft Word (.DOCX) terpisah yang siap dibuka, diedit, dan dicetak.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSupFolders(SUPERVISION_FOLDERS.map((f) => f.key))}
                  className="text-blue-800 font-medium hover:underline"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSupFolders([])}
                  className="text-slate-600 hover:underline"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {SUPERVISION_FOLDERS.map((folder) => {
                const checked = supFolders.includes(folder.key);
                return (
                  <label
                    key={folder.key}
                    className="px-4 py-3 flex items-center gap-3 text-sm hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSupFolders((prev) =>
                          e.target.checked
                            ? [...prev, folder.key]
                            : prev.filter((k) => k !== folder.key)
                        )
                      }
                    />
                    <span className="font-mono text-xs text-blue-900 w-20 shrink-0">
                      {folder.part}
                    </span>
                    <span className="text-slate-800">{folder.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 h-fit">
            <h3 className="text-base font-semibold text-slate-900">
              Pengaturan Paket ZIP
            </h3>
            <FormField label="Tahun Ajaran">
              <input
                type="text"
                className={`${inputClass} bg-slate-50 font-mono`}
                readOnly
                value={activeYear?.name || '-'}
              />
            </FormField>
            <FormField label="Semester">
              <select
                className={inputClass}
                value={supSemester}
                onChange={(e) => setSupSemester(Number(e.target.value) as SemesterNumber)}
              >
                <option value={1}>Semester 1</option>
                <option value={2}>Semester 2</option>
              </select>
            </FormField>
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1.5">
                Kelas yang Disertakan:
              </div>
              {classes.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada kelas terdaftar.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  {classes.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-xs text-slate-800">
                      <input
                        type="checkbox"
                        checked={supClassIds.includes(c.id)}
                        onChange={(e) =>
                          setSupClassIds((prev) =>
                            e.target.checked
                              ? [...prev, c.id]
                              : prev.filter((id) => id !== c.id)
                          )
                        }
                      />
                      <span>Kelas {c.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <PrimaryButton
              className="w-full"
              loading={zipLoading}
              onClick={handleGenerateSupervisionZip}
            >
              <FolderArchive className="w-4 h-4" />
              <span>Generate & Unduh Paket ZIP</span>
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* TAB 2: TEMPLATE DOKUMEN SEKOLAH */}
      {tab === 'template' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Unggah Template Sekolah (.DOCX)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pertahankan kop, logo, margin, font, dan posisi tanda tangan format resmi sekolah Anda. Sisipkan tag placeholder berikut di file Word Anda:
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-800 grid grid-cols-1 gap-1">
              {PLACEHOLDER_GUIDE.map((ph) => (
                <div key={ph}>{ph}</div>
              ))}
            </div>
            <FormField label="Nama Template">
              <input
                type="text"
                className={inputClass}
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="Contoh: Format Modul Ajar SMPN 1"
              />
            </FormField>
            <FormField label="Kategori Dokumen">
              <select
                className={inputClass}
                value={tplCat}
                onChange={(e) => setTplCat(e.target.value as DocumentCategoryKey)}
              >
                <option value="modul_ajar">Modul Ajar / RPP</option>
                <option value="identitas">Identitas</option>
                <option value="daftar_siswa">Daftar Siswa</option>
                <option value="presensi">Presensi</option>
                <option value="jurnal">Jurnal Mengajar</option>
                <option value="daftar_nilai">Daftar Nilai</option>
                <option value="atp">ATP / PROTA / PROMES</option>
                <option value="lkpd">LKPD</option>
                <option value="asesmen">Asesmen / Kisi-Kisi</option>
                <option value="rapor">Rapor</option>
              </select>
            </FormField>
            <label className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg cursor-pointer inline-flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              <span>Pilih & Simpan File .DOCX</span>
              <input
                type="file"
                accept=".docx"
                className="hidden"
                onChange={handleUploadTemplate}
              />
            </label>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">
                Daftar Template Tersimpan
              </h3>
              {classes.length > 0 && (
                <select
                  className={`${inputClass} w-44 text-xs`}
                  value={tplClassId}
                  onChange={(e) => setTplClassId(e.target.value)}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Data Kelas {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {templates.length === 0 ? (
              <EmptyState
                title="Menggunakan Template Standar Nasional A4"
                description="Belum ada template sekolah khusus yang diunggah. Anda tetap dapat mengunduh seluruh dokumen DOCX standar kapan saja, atau mengunggah format Word milik sekolah di sebelah kiri."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{tpl.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        File: {tpl.fileName} · Placeholder:{' '}
                        {tpl.placeholdersFound.join(', ') || 'Tidak ada'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DocxButton
                        label="Generate DOCX"
                        onClick={() => handleGenerateFromCustomTemplate(tpl)}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await db.documentTemplates.delete(tpl.id);
                          await refreshData();
                        }}
                        className="p-2 text-slate-400 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: GENERATOR DOCX CEPAT */}
      {tab === 'generator' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: 'Identitas Sekolah, Guru & Kepsek',
              desc: 'Dokumen resmi identitas lengkap dengan logo dan kop sekolah.',
              action: async () => {
                if (!identityBundle) return;
                const blob = await generateIdentityDocx(identityBundle);
                await downloadDocxBlob(blob, '01_Identitas_Guru_Admin_Pro.docx');
              },
            },
            {
              title: 'Kalender & Minggu Efektif',
              desc: 'Rekapitulasi hari efektif, minggu efektif Sem 1 & 2, serta agenda.',
              action: async () => {
                if (!identityBundle || !activeYear) return;
                const cfg = await db.calendarConfigs
                  .where('academicYearId')
                  .equals(activeYear.id)
                  .first();
                const evs = await db.calendarEvents
                  .where('academicYearId')
                  .equals(activeYear.id)
                  .toArray();
                if (!cfg) return;
                const summary = calculateEffectiveWeeks(cfg, evs);
                const blob = await generateEffectiveWeeksDocx(
                  identityBundle,
                  cfg,
                  summary,
                  evs
                );
                await downloadDocxBlob(blob, '02_Minggu_Efektif.docx');
              },
            },
            {
              title: 'Capaian & Tujuan Pembelajaran (CP & TP)',
              desc: 'Dokumen gabungan CP dan seluruh TP tahun ajaran aktif.',
              action: async () => {
                if (!identityBundle || !activeYear) return;
                const cps = await db.cps
                  .where('academicYearId')
                  .equals(activeYear.id)
                  .toArray();
                const tps = await db.tps
                  .where('academicYearId')
                  .equals(activeYear.id)
                  .toArray();
                const blob = await generateCpTpDocx(identityBundle, cps, tps);
                await downloadDocxBlob(blob, '03_CP_dan_TP.docx');
              },
            },
          ].map((card) => (
            <div
              key={card.title}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {card.title}
                </h3>
                <p className="mt-1 text-xs text-slate-600">{card.desc}</p>
              </div>
              <DocxButton onClick={card.action} />
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: ARSIP */}
      {tab === 'arsip' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          {academicYears.filter((y) => y.isArchived).length === 0 ? (
            <EmptyState
              title="Belum Ada Tahun Ajaran yang Diarsipkan"
              description="Anda dapat mengarsipkan tahun ajaran yang sudah selesai melalui menu Data Akademik > Tahun Ajaran & Arsip."
              actionLabel="Kelola Tahun Ajaran"
              onAction={() => navigate('data_akademik', 'tahun')}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {academicYears
                .filter((y) => y.isArchived)
                .map((y) => (
                  <div
                    key={y.id}
                    className="py-3.5 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono font-semibold text-slate-900">
                        <Archive className="w-4 h-4 inline mr-2 text-slate-400" />
                        Tahun Ajaran {y.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {y.startDate} s.d. {y.endDate}
                      </div>
                    </div>
                    <PrimaryButton
                      onClick={() => navigate('data_akademik', 'tahun')}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Kelola Arsip</span>
                    </PrimaryButton>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
