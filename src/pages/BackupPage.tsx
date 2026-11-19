import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  Download,
  History,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import {
  db,
  exportBackupPayload,
  restoreBackupPayload,
  syncToServer,
  validateBackupPayload,
  type BackupPayload,
} from '../db/database';
import { useApp } from '../context/AppContext';
import {
  FormField,
  inputClass,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from '../components/UI';
import type { AutoSnapshot, BackupRecord, ClassGroup } from '../types/domain';

export const BackupPage: React.FC = () => {
  const {
    academicYears,
    activeYear,
    settings,
    storagePersisted,
    lastSyncedAt,
    restoreFromServer,
    dataVersion,
    refreshData,
    notify,
    confirm,
  } = useApp();

  const [scope, setScope] = useState<'Semua Data' | 'Per Tahun Ajaran' | 'Per Kelas'>(
    'Semua Data'
  );
  const [targetYearId, setTargetYearId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [snapshots, setSnapshots] = useState<AutoSnapshot[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Restore preview state
  const [pendingRestore, setPendingRestore] = useState<{
    payload: BackupPayload;
    summary: {
      scope: string;
      exportedAt: string;
      academicYearName: string;
      counts: Record<string, number>;
    };
  } | null>(null);

  useEffect(() => {
    if (activeYear && !targetYearId) setTargetYearId(activeYear.id);
    (async () => {
      const [clsL, histL, snapL] = await Promise.all([
        activeYear
          ? db.classGroups.where('academicYearId').equals(activeYear.id).toArray()
          : db.classGroups.toArray(),
        db.backupRecords.orderBy('createdAt').reverse().toArray(),
        db.autoSnapshots.orderBy('createdAt').reverse().toArray(),
      ]);
      setClasses(clsL);
      setHistory(histL);
      setSnapshots(snapL);
      if (clsL.length > 0 && !targetClassId) setTargetClassId(clsL[0].id);
    })();
  }, [activeYear, dataVersion]);

  const handleDownloadBackup = async () => {
    const payload = await exportBackupPayload({
      scope,
      academicYearId: targetYearId || activeYear?.id,
      classId: targetClassId,
    });
    const dateStamp = new Date().toISOString().slice(0, 10);
    const slug =
      scope === 'Semua Data'
        ? 'SEMUA_DATA'
        : scope === 'Per Tahun Ajaran'
          ? `TA_${payload.academicYearName.replace(/\//g, '-')}`
          : 'PER_KELAS';
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    saveAs(blob, `Backup_GuruAdminPro_${slug}_${dateStamp}.json`);
    await refreshData();
    notify('File backup JSON berhasil diunduh.');
  };

  const handleSelectRestoreFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const check = validateBackupPayload(parsed);
      if (!check.valid || !check.summary) {
        notify(check.error || 'File backup tidak valid.', 'error');
        return;
      }
      setPendingRestore({
        payload: parsed as BackupPayload,
        summary: check.summary,
      });
    } catch {
      notify('Gagal membaca file JSON backup.', 'error');
    }
  };

  const handleConfirmRestore = async (mode: 'replace' | 'merge') => {
    if (!pendingRestore) return;
    const ok = await confirm({
      title:
        mode === 'replace'
          ? 'Timpa Seluruh Data dengan Backup?'
          : 'Gabungkan Data Backup?',
      message:
        mode === 'replace'
          ? 'Seluruh data lokal saat ini akan digantikan oleh data dari file backup. Pastikan Anda sudah membuat cadangan data terbaru jika masih dibutuhkan.'
          : 'Data dari file backup akan ditambahkan atau diperbarui ke database saat ini berdasarkan ID.',
      confirmLabel: mode === 'replace' ? 'Ya, Pulihkan & Timpa' : 'Ya, Gabungkan Data',
      danger: mode === 'replace',
    });
    if (!ok) return;

    await restoreBackupPayload(pendingRestore.payload, mode);
    setPendingRestore(null);
    await refreshData();
    notify('Data berhasil dipulihkan dari file backup.');
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await syncToServer();
      if (res?.syncedAt) {
        await refreshData();
        notify('Seluruh data berhasil disinkronkan ke penyimpanan server.');
      } else {
        notify('Sinkronisasi ke server gagal. Coba lagi.', 'error');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleRestoreFromServerConfirm = async () => {
    const ok = await confirm({
      title: 'Pulihkan Data dari Cadangan Server?',
      message:
        'Database lokal saat ini akan digantikan oleh salinan terakhir yang tersimpan di server. Snapshot keamanan otomatis akan dibuat terlebih dahulu.',
      confirmLabel: 'Ya, Pulihkan dari Server',
      danger: true,
    });
    if (!ok) return;
    await restoreFromServer();
  };

  const handleRestoreSnapshot = async (snap: AutoSnapshot) => {
    const ok = await confirm({
      title: 'Pulihkan Titik Pemulihan Otomatis?',
      message: `Data akan dikembalikan ke kondisi "${snap.reason}" (${new Date(
        snap.createdAt
      ).toLocaleString('id-ID')}). Snapshot terbaru juga akan disimpan otomatis sebelumnya.`,
      confirmLabel: 'Ya, Pulihkan Titik Ini',
      danger: true,
    });
    if (!ok) return;
    try {
      const parsed = JSON.parse(snap.payloadJson) as BackupPayload;
      await restoreBackupPayload(parsed, 'replace');
      await refreshData();
      notify('Data berhasil dipulihkan ke titik pemulihan yang dipilih.');
    } catch {
      notify('Gagal membaca data snapshot.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Backup dan Restore Data"
        description="Penyimpanan berkelanjutan multi-tahun: database browser permanen, sinkronisasi otomatis ke server, titik pemulihan otomatis, dan ekspor file JSON."
      />

      {/* Continuous Persistence & Server Sync Status */}
      <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0" />
            <span className="font-semibold text-slate-900">
              Penyimpanan Berkelanjutan Aktif
            </span>
          </div>
          <div className="text-xs text-slate-600 pl-7.5 space-y-0.5">
            <div>
              Penyimpanan Browser:{' '}
              <span className="font-medium text-slate-800">
                {storagePersisted ? 'Permanen (Persistent IndexedDB)' : 'IndexedDB Lokal'}
              </span>
              {' · '}
              Sinkronisasi Server:{' '}
              <span className="font-mono text-slate-800">
                {lastSyncedAt
                  ? new Date(lastSyncedAt).toLocaleString('id-ID')
                  : 'Otomatis setiap ada perubahan'}
              </span>
            </div>
            <div>
              Backup JSON Terakhir:{' '}
              <span className="font-mono text-slate-800">
                {settings?.lastBackupAt
                  ? new Date(settings.lastBackupAt).toLocaleString('id-ID')
                  : 'Belum diunduh secara manual'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton onClick={handleManualSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan ke Server'}</span>
          </SecondaryButton>
          <SecondaryButton onClick={handleRestoreFromServerConfirm}>
            <Cloud className="w-4 h-4" />
            <span>Pulihkan dari Server</span>
          </SecondaryButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Backup */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            1. Buat & Unduh File Backup (.JSON)
          </h3>
          <FormField label="Cakupan Backup">
            <select
              className={inputClass}
              value={scope}
              onChange={(e) =>
                setScope(
                  e.target.value as 'Semua Data' | 'Per Tahun Ajaran' | 'Per Kelas'
                )
              }
            >
              <option value="Semua Data">Semua Data (Seluruh Tahun Ajaran & Template)</option>
              <option value="Per Tahun Ajaran">Per Tahun Ajaran</option>
              <option value="Per Kelas">Per Kelas / Rombel</option>
            </select>
          </FormField>

          {scope === 'Per Tahun Ajaran' && (
            <FormField label="Pilih Tahun Ajaran">
              <select
                className={inputClass}
                value={targetYearId}
                onChange={(e) => setTargetYearId(e.target.value)}
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          {scope === 'Per Kelas' && (
            <FormField label="Pilih Kelas">
              <select
                className={inputClass}
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <PrimaryButton className="w-full" onClick={handleDownloadBackup}>
            <Download className="w-4 h-4" />
            <span>Unduh Backup JSON</span>
          </PrimaryButton>
        </div>

        {/* Restore Backup */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            2. Pulihkan Data (Restore)
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Pilih file backup <code>.json</code> resmi GURU ADMIN PRO. Sistem akan memeriksa isi data dan meminta konfirmasi Anda sebelum menimpa atau menggabungkan database.
          </p>

          <label className="w-full px-4 py-3 text-sm font-medium text-blue-900 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg cursor-pointer inline-flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" />
            <span>Pilih File Backup (.JSON)</span>
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleSelectRestoreFile}
            />
          </label>

          {pendingRestore && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3 text-xs">
              <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Pratinjau Data yang Akan Dipulihkan</span>
              </div>
              <div className="text-slate-700 space-y-0.5">
                <div>Cakupan: <strong>{pendingRestore.summary.scope}</strong></div>
                <div>Tahun Ajaran: <strong>{pendingRestore.summary.academicYearName}</strong></div>
                <div>
                  Tanggal Backup:{' '}
                  <strong>
                    {new Date(pendingRestore.summary.exportedAt).toLocaleString('id-ID')}
                  </strong>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 bg-white p-2.5 rounded border border-amber-200 font-mono">
                {Object.entries(pendingRestore.summary.counts)
                  .filter(([, count]) => count > 0)
                  .map(([k, count]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}:</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <PrimaryButton onClick={() => handleConfirmRestore('merge')}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Gabungkan Data</span>
                </PrimaryButton>
                <button
                  type="button"
                  onClick={() => handleConfirmRestore('replace')}
                  className="px-3.5 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg"
                >
                  Timpa Semua Data
                </button>
                <SecondaryButton onClick={() => setPendingRestore(null)}>
                  Batal
                </SecondaryButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Auto Snapshots Rolling Restore Points */}
      <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <History className="w-4 h-4 text-blue-800" />
          <h3 className="text-base font-semibold text-slate-900">
            Titik Pemulihan Otomatis (10 Snapshot Terakhir)
          </h3>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Sistem otomatis menyimpan titik pemulihan sebelum perubahan besar (seperti membuat tahun ajaran baru, menyusun ulang perencanaan, atau restore data).
        </p>
        {snapshots.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            Belum ada titik pemulihan otomatis tercatat.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-medium text-slate-900">{snap.reason}</div>
                  <div className="text-slate-500 font-mono mt-0.5">
                    {new Date(snap.createdAt).toLocaleString('id-ID')} · TA {snap.academicYearName} · {snap.itemCount} entitas
                  </div>
                </div>
                <SecondaryButton onClick={() => handleRestoreSnapshot(snap)}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Pulihkan Titik Ini</span>
                </SecondaryButton>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup History */}
      <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
          Riwayat Unduhan File Backup JSON
        </h3>
        {history.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            Belum ada riwayat unduhan backup JSON tercatat di perangkat ini.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100">
            {history.slice(0, 10).map((h) => (
              <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium text-slate-900">{h.label}</span>
                  <span className="text-slate-500 ml-2 font-mono">
                    ({h.itemCount} entitas)
                  </span>
                </div>
                <span className="font-mono text-slate-500">
                  {new Date(h.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
