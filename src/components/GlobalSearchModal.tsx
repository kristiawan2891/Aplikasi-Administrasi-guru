import React, { useEffect, useState } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import { db } from '../db/database';
import { useApp, type NavSectionId } from '../context/AppContext';

interface SearchHit {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  nav: NavSectionId;
  subTab?: string;
}

export const GlobalSearchModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { activeYear, navigate } = useApp();
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('Semua');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !activeYear) return;
    const q = query.trim().toLowerCase();
    if (!q) {
      setHits([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      const yId = activeYear.id;
      const [classes, students, cps, tps, modules, lkpds, questions, assessments, journals] =
        await Promise.all([
          db.classGroups.where('academicYearId').equals(yId).toArray(),
          db.students.where('academicYearId').equals(yId).toArray(),
          db.cps.where('academicYearId').equals(yId).toArray(),
          db.tps.where('academicYearId').equals(yId).toArray(),
          db.modules.where('academicYearId').equals(yId).toArray(),
          db.lkpds.where('academicYearId').equals(yId).toArray(),
          db.questionBank.where('academicYearId').equals(yId).toArray(),
          db.assessments.where('academicYearId').equals(yId).toArray(),
          db.journals.where('academicYearId').equals(yId).toArray(),
        ]);

      const classMap = new Map(classes.map((c) => [c.id, c.name]));
      const results: SearchHit[] = [];

      for (const s of students) {
        if (
          s.fullName.toLowerCase().includes(q) ||
          s.nis.toLowerCase().includes(q) ||
          s.nisn.toLowerCase().includes(q)
        ) {
          results.push({
            id: s.id,
            category: 'Siswa',
            title: s.fullName,
            subtitle: `Kelas ${classMap.get(s.classId) || '-'} · NIS ${s.nis || '-'}`,
            nav: 'data_akademik',
            subTab: 'siswa',
          });
        }
      }

      for (const c of classes) {
        if (
          c.name.toLowerCase().includes(q) ||
          c.subject.toLowerCase().includes(q)
        ) {
          results.push({
            id: c.id,
            category: 'Kelas',
            title: `Kelas ${c.name}`,
            subtitle: `Tingkat ${c.gradeLevel} · ${c.subject || '-'}`,
            nav: 'data_akademik',
            subTab: 'kelas',
          });
        }
      }

      for (const cp of cps) {
        if (
          cp.element.toLowerCase().includes(q) ||
          cp.description.toLowerCase().includes(q)
        ) {
          results.push({
            id: cp.id,
            category: 'CP',
            title: `${cp.subject} · ${cp.element}`,
            subtitle: cp.description.slice(0, 90),
            nav: 'perencanaan',
            subTab: 'cp',
          });
        }
      }

      for (const tp of tps) {
        if (
          tp.code.toLowerCase().includes(q) ||
          tp.objective.toLowerCase().includes(q) ||
          tp.material.toLowerCase().includes(q)
        ) {
          results.push({
            id: tp.id,
            category: 'TP',
            title: `${tp.code} — ${tp.material}`,
            subtitle: tp.objective.slice(0, 90),
            nav: 'perencanaan',
            subTab: 'tp',
          });
        }
      }

      for (const m of modules) {
        if (
          m.title.toLowerCase().includes(q) ||
          m.material.toLowerCase().includes(q)
        ) {
          results.push({
            id: m.id,
            category: 'Modul Ajar',
            title: m.title,
            subtitle: `Kelas ${m.gradeLevel} · ${m.material}`,
            nav: 'perangkat_pembelajaran',
            subTab: 'modul',
          });
        }
      }

      for (const l of lkpds) {
        if (
          l.title.toLowerCase().includes(q) ||
          l.material.toLowerCase().includes(q)
        ) {
          results.push({
            id: l.id,
            category: 'LKPD',
            title: l.title,
            subtitle: `${l.type} · Kelas ${l.gradeLevel}`,
            nav: 'perangkat_pembelajaran',
            subTab: 'lkpd',
          });
        }
      }

      for (const qb of questions) {
        if (
          qb.questionText.toLowerCase().includes(q) ||
          qb.material.toLowerCase().includes(q)
        ) {
          results.push({
            id: qb.id,
            category: 'Bank Soal',
            title: qb.questionText.slice(0, 75),
            subtitle: `${qb.questionType} · ${qb.material}`,
            nav: 'asesmen',
            subTab: 'bank_soal',
          });
        }
      }

      for (const a of assessments) {
        if (
          a.name.toLowerCase().includes(q) ||
          a.material.toLowerCase().includes(q)
        ) {
          results.push({
            id: a.id,
            category: 'Asesmen',
            title: a.name,
            subtitle: `${a.category} · Kelas ${a.gradeLevel}`,
            nav: 'asesmen',
            subTab: 'harian',
          });
        }
      }

      for (const j of journals) {
        if (
          j.material.toLowerCase().includes(q) ||
          j.activities.toLowerCase().includes(q)
        ) {
          results.push({
            id: j.id,
            category: 'Jurnal',
            title: `Jurnal ${j.date} · ${j.material}`,
            subtitle: `Kelas ${classMap.get(j.classId) || '-'} · Pertemuan ${j.meetingNumber}`,
            nav: 'administrasi_kelas',
            subTab: 'jurnal',
          });
        }
      }

      if (!cancelled) {
        setHits(
          catFilter === 'Semua'
            ? results
            : results.filter((r) => r.category === catFilter)
        );
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, query, catFilter, activeYear]);

  if (!open) return null;

  const categories = [
    'Semua',
    'Siswa',
    'Kelas',
    'CP',
    'TP',
    'Modul Ajar',
    'LKPD',
    'Bank Soal',
    'Asesmen',
    'Jurnal',
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center pt-16 p-4 no-print"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari siswa, kelas, CP, TP, materi, modul, LKPD, soal, atau jurnal..."
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
            aria-label="Tutup pencarian"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCatFilter(cat)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                catFilter === cat
                  ? 'bg-blue-800 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {!query.trim() ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Ketik kata kunci untuk mencari di seluruh database tahun ajaran{' '}
              <span className="font-semibold text-slate-700">
                {activeYear?.name}
              </span>
              .
            </div>
          ) : loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Mencari data...
            </div>
          ) : hits.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Tidak ditemukan data yang cocok dengan "{query}".
            </div>
          ) : (
            hits.slice(0, 40).map((hit) => (
              <button
                key={`${hit.category}_${hit.id}`}
                type="button"
                onClick={() => {
                  navigate(hit.nav, hit.subTab || '');
                  onClose();
                }}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-xs text-blue-800 font-medium">
                    {hit.category}
                  </div>
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {hit.title}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {hit.subtitle}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
