import React, { useEffect, useState } from 'react';
import { Save, Shield, Trash2 } from 'lucide-react';
import { db, ensureInitialSetup } from '../db/database';
import { useApp } from '../context/AppContext';
import {
  FormField,
  inputClass,
  PageHeader,
  PrimaryButton,
} from '../components/UI';
import type { AppSettings } from '../types/domain';

export const SettingsPage: React.FC = () => {
  const { settings, aiConfigured, refreshData, notify, confirm } = useApp();
  const [form, setForm] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  if (!form) return null;

  const handleSave = async () => {
    await db.appSettings.put({
      ...form,
      updatedAt: new Date().toISOString(),
    });
    await refreshData();
    notify('Pengaturan aplikasi disimpan.');
  };

  const handleWipeAll = async () => {
    const ok = await confirm({
      title: 'Hapus Seluruh Database Lokal?',
      message:
        'PERINGATAN: Seluruh data sekolah, kelas, siswa, CP, TP, nilai, presensi, jurnal, dan modul ajar di perangkat ini akan dihapus permanen. Pastikan Anda sudah mengunduh file Backup JSON terlebih dahulu.',
      confirmLabel: 'Ya, Hapus Semua Data',
      danger: true,
    });
    if (!ok) return;

    await db.delete();
    await db.open();
    await ensureInitialSetup();
    await refreshData();
    notify('Database lokal telah direset ke kondisi awal.', 'info');
  };

  return (
    <div>
      <PageHeader
        title="Pengaturan Sistem"
        description="Konfigurasi batas ketuntasan (KKTP), format standar dokumen Microsoft Word (DOCX), dan keamanan data lokal."
        actions={
          <PrimaryButton onClick={handleSave}>
            <Save className="w-4 h-4" />
            <span>Simpan Pengaturan</span>
          </PrimaryButton>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            Preferensi Penilaian & Dokumen DOCX
          </h3>
          <FormField
            label="Ambang Ketuntasan (KKTP / KKM)"
            hint="Digunakan pada Daftar Nilai, Rekap Nilai, Analisis TP, dan Rapor."
          >
            <input
              type="number"
              min={0}
              max={100}
              className={`${inputClass} font-mono`}
              value={form.kktpThreshold}
              onChange={(e) =>
                setForm({
                  ...form,
                  kktpThreshold: Number(e.target.value) || 75,
                })
              }
            />
          </FormField>

          <FormField label="Ukuran Kertas Default">
            <input
              type="text"
              className={`${inputClass} bg-slate-50 font-mono`}
              readOnly
              value="A4 (210 mm × 297 mm)"
            />
          </FormField>

          <FormField label="Jenis Huruf (Font) Standar DOCX">
            <select
              className={inputClass}
              value={form.defaultFontFamily}
              onChange={(e) =>
                setForm({
                  ...form,
                  defaultFontFamily: e.target.value as AppSettings['defaultFontFamily'],
                })
              }
            >
              <option value="Times New Roman">Times New Roman (Standar Kedinasan)</option>
              <option value="Calibri">Calibri (Modern Office)</option>
              <option value="Arial">Arial (Bersih / Sans-Serif)</option>
            </select>
          </FormField>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Shield className="w-5 h-5 text-teal-700" />
              <span>Privasi Data & Status Layanan AI</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Seluruh data siswa, presensi, jurnal, dan nilai disimpan secara lokal dan persisten di browser perangkat Anda menggunakan IndexedDB (<code>GuruAdminProDB</code>). Tidak ada data siswa atau nilai yang dikirim ke layanan AI secara otomatis tanpa tindakan eksplisit Anda.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
              <strong>Status AI Asisten Guru:</strong>{' '}
              {aiConfigured
                ? 'Aktif (GEMINI_API_KEY terkonfigurasi di sisi server)'
                : 'Belum aktif (atur GEMINI_API_KEY di panel Settings > Secrets untuk mengaktifkan AI)'}
            </div>
          </div>

          <div className="bg-white border border-red-200 rounded-xl p-6 space-y-3">
            <h3 className="text-base font-semibold text-red-900">
              Zona Reset Database Lokal
            </h3>
            <p className="text-xs text-slate-600">
              Gunakan fitur ini hanya jika Anda ingin memulai ulang dari nol. Buat Backup JSON terlebih dahulu sebelum mereset.
            </p>
            <button
              type="button"
              onClick={handleWipeAll}
              className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg inline-flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset Seluruh Data Lokal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
