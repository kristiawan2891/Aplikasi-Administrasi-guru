import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Sparkles } from 'lucide-react';
import { createId, db } from '../db/database';
import { useApp } from '../context/AppContext';
import {
  AiActionButton,
  FormField,
  inputClass,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from '../components/UI';
import { askTeacherAssistant } from '../services/aiService';
import type { LearningObjectiveTP, LearningOutcomeCP } from '../types/domain';

const ASSISTANT_FEATURES = [
  'Rekomendasi Perencanaan Pembelajaran (ATP/PROTA/PROMES)',
  'Penyusunan Draft Silabus & Kegiatan Inti',
  'Ide Diferensiasi Modul Ajar & RPP',
  'Rancangan LKPD Kontekstual',
  'Penyusunan Kisi-Kisi & Soal HOTS',
  'Program Remedial & Pengayaan',
  'Refleksi Jurnal Mengajar',
  'Rekomendasi Tindak Lanjut Hasil Asesmen',
];

export const AiAssistantPage: React.FC = () => {
  const {
    aiConfigured,
    activeYear,
    school,
    teacher,
    refreshData,
    notify,
  } = useApp();

  const [feature, setFeature] = useState(ASSISTANT_FEATURES[0]);
  const [selectedCpId, setSelectedCpId] = useState('');
  const [selectedTpId, setSelectedTpId] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [draftText, setDraftText] = useState('');
  const [loading, setLoading] = useState(false);

  const [cps, setCps] = useState<LearningOutcomeCP[]>([]);
  const [tps, setTps] = useState<LearningObjectiveTP[]>([]);

  useEffect(() => {
    if (!activeYear) return;
    (async () => {
      const [cpL, tpL] = await Promise.all([
        db.cps.where('academicYearId').equals(activeYear.id).toArray(),
        db.tps.where('academicYearId').equals(activeYear.id).toArray(),
      ]);
      setCps(cpL);
      setTps(tpL);
    })();
  }, [activeYear]);

  const handleAsk = async () => {
    if (!school || !teacher || !activeYear || !userPrompt.trim()) {
      notify('Tulis permintaan Anda terlebih dahulu.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const cp = cps.find((c) => c.id === selectedCpId);
      const tp = tps.find((t) => t.id === selectedTpId);
      const contextData = [
        cp ? `CP Terpilih: [${cp.subject} Fase ${cp.phase}] ${cp.description}` : '',
        tp ? `TP Terpilih: [${tp.code}] ${tp.objective} (Materi: ${tp.material}, ${tp.hoursAllocation} JP)` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const result = await askTeacherAssistant({
        ctx: {
          school,
          teacher,
          academicYearName: activeYear.name,
          semester: activeYear.activeSemester,
        },
        featureName: feature,
        userPrompt,
        contextData: contextData || 'Gunakan konteks identitas sekolah & guru di atas.',
      });
      setDraftText(result);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Gagal menghubungi AI.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsLearningMediaNote = async () => {
    if (!activeYear || !draftText.trim()) return;
    await db.mediaItems.put({
      id: createId('med'),
      academicYearId: activeYear.id,
      title: `Catatan AI: ${feature}`,
      type: 'Lainnya',
      subject: teacher?.subjects[0] || 'Umum',
      gradeLevel: '-',
      tpId: selectedTpId || undefined,
      description: draftText.trim(),
      usageGuide: 'Hasil kurasi AI Asisten Guru (telah disetujui guru).',
      linkOrSource: 'AI Asisten Guru',
      updatedAt: new Date().toISOString(),
    });
    await refreshData();
    notify('Draft disetujui & disimpan ke daftar Perangkat / Catatan Pembelajaran.');
  };

  return (
    <div>
      <PageHeader
        title="AI Asisten Guru"
        description="Asisten penyusun administrasi pembelajaran berbasis konteks sekolah, CP, dan TP Anda. Seluruh draft dapat diedit sebelum disetujui dan disimpan."
      />

      {!aiConfigured && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>Layanan AI Belum Aktif:</strong> Variabel <code>GEMINI_API_KEY</code> belum diatur pada menu <strong>Settings &gt; Secrets</strong> server. Seluruh fitur administrasi manual, Excel, DOCX, dan Paket Supervisi ZIP tetap berfungsi penuh.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <FormField label="Pilih Tugas / Fitur AI">
            <select
              className={inputClass}
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
            >
              {ASSISTANT_FEATURES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Konteks CP (Opsional)">
            <select
              className={inputClass}
              value={selectedCpId}
              onChange={(e) => setSelectedCpId(e.target.value)}
            >
              <option value="">-- Tidak dipilih --</option>
              {cps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.subject} · {c.element}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Konteks TP (Opsional)">
            <select
              className={inputClass}
              value={selectedTpId}
              onChange={(e) => setSelectedTpId(e.target.value)}
            >
              <option value="">-- Tidak dipilih --</option>
              {tps.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.material}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Instruksi / Kebutuhan Guru" required>
            <textarea
              rows={5}
              className={inputClass}
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Contoh: Buatkan langkah kegiatan pembelajaran berdiferensiasi untuk materi Persamaan Linear 1 Variabel bagi siswa kelas 7 dengan gaya belajar visual dan kinestetik..."
            />
          </FormField>

          <AiActionButton className="w-full" loading={loading} onClick={handleAsk}>
            Buat Draft AI
          </AiActionButton>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-700" />
              <h3 className="text-base font-semibold text-slate-900">
                Editor & Persetujuan Draft AI
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <SecondaryButton
                disabled={!draftText}
                onClick={() => {
                  navigator.clipboard.writeText(draftText);
                  notify('Teks disalin ke clipboard.');
                }}
              >
                <Copy className="w-4 h-4" />
                <span>Salin Teks</span>
              </SecondaryButton>
              <PrimaryButton
                disabled={!draftText}
                onClick={handleSaveAsLearningMediaNote}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Setujui & Simpan Catatan</span>
              </PrimaryButton>
            </div>
          </div>

          <textarea
            rows={18}
            className={`${inputClass} font-sans leading-relaxed`}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Hasil draft AI akan muncul di sini dan dapat Anda sunting bebas sebelum disimpan..."
          />
        </div>
      </div>
    </div>
  );
};
