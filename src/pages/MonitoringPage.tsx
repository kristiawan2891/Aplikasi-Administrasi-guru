import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { db } from '../db/database';
import { useApp } from '../context/AppContext';
import { PageHeader, StatusText } from '../components/UI';
import {
  computeMonitoringSummary,
  type MonitoringSummary,
} from '../services/monitoringService';
import type { DocumentStatus } from '../types/domain';

export const MonitoringPage: React.FC = () => {
  const { activeYear, dataVersion, refreshData, navigate, notify } = useApp();
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);

  useEffect(() => {
    if (!activeYear) return;
    let cancelled = false;
    computeMonitoringSummary(activeYear.id).then((res) => {
      if (!cancelled) setSummary(res);
    });
    return () => {
      cancelled = true;
    };
  }, [activeYear, dataVersion]);

  const handleStatusChange = async (itemKey: string, status: DocumentStatus) => {
    if (!activeYear) return;
    await db.monitoringOverrides.put({
      id: `${activeYear.id}_${itemKey}`,
      academicYearId: activeYear.id,
      itemKey,
      status,
      notes: '',
      updatedAt: new Date().toISOString(),
    });
    await refreshData();
    notify('Status checklist diperbarui.');
  };

  return (
    <div>
      <PageHeader
        title="Monitoring Kelengkapan Administrasi"
        description="Pantau kesiapan 22 komponen administrasi pembelajaran sepanjang satu tahun ajaran."
      />

      {summary && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">
                Tahun Ajaran {activeYear?.name}
              </div>
              <div className="text-2xl font-bold font-mono text-blue-900 mt-1 tabular-nums">
                {summary.completionPercentage}% Selesai
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {summary.completedCount} selesai · {summary.inProgressCount} dalam proses · dari {summary.totalCount} dokumen administrasi
              </div>
            </div>
            <div className="w-full sm:w-72 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-700 transition-all"
                style={{ width: `${summary.completionPercentage}%` }}
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 px-4">Komponen Administrasi</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Data Terdeteksi</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Ubah Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.items.map((item) => (
                  <tr key={item.key} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {item.label}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {item.category}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      {item.countText}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={item.effectiveStatus} />
                    </td>
                    <td className="py-3 px-4">
                      <select
                        className="px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                        value={item.effectiveStatus}
                        onChange={(e) =>
                          handleStatusChange(
                            item.key,
                            e.target.value as DocumentStatus
                          )
                        }
                      >
                        <option value="Belum dibuat">Belum dibuat</option>
                        <option value="Dalam proses">Dalam proses</option>
                        <option value="Selesai">Selesai</option>
                        <option value="Perlu diperbaiki">Perlu diperbaiki</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(item.navTarget, item.subTab || '')}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-800 hover:underline whitespace-nowrap"
                      >
                        <span>Buka Menu</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
