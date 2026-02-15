'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, ShieldAlert, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

// On type le score et le JSON
interface Scan {
  id: string;
  repoUrl: string;
  status: string;
  score: number | null; 
  createdAt: Date | string;
}

export function ScanList({ initialScans }: { initialScans: Scan[] }) {
  const router = useRouter();

  // Polling intelligent : ne s'active que si un scan est en cours
  useEffect(() => {
    const hasPending = initialScans.some(s => ['PENDING', 'PROCESSING'].includes(s.status));
    if (hasPending) {
      const interval = setInterval(() => router.refresh(), 3000); // 3s c'est mieux
      return () => clearInterval(interval);
    }
  }, [initialScans, router]);

  const getScoreBadge = (score: number | null) => {
    if (score === null) return <span className="text-gray-400">-</span>;
    if (score >= 90) return <span className="text-green-600 font-bold">A ({score}%)</span>;
    if (score >= 70) return <span className="text-yellow-600 font-bold">B ({score}%)</span>;
    return <span className="text-red-600 font-bold">F ({score}%)</span>;
  };

  return (
    <div className="mt-8 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="px-6 py-3 font-medium">Repository</th>
            <th className="px-6 py-3 font-medium">Statut</th>
            <th className="px-6 py-3 font-medium">Score</th>
            <th className="px-6 py-3 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {initialScans.map((scan) => (
            <tr key={scan.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 font-mono text-xs text-blue-600 truncate max-w-[200px]">
                {scan.repoUrl.replace('https://github.com/', '')}
              </td>
              <td className="px-6 py-4">
                {scan.status === 'COMPLETED' ? (
                   <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                     <CheckCircle size={12} /> Terminé
                   </span>
                ) : scan.status === 'FAILED' ? (
                   <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                     <ShieldAlert size={12} /> Erreur
                   </span>
                ) : (
                   <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 animate-pulse">
                     <Clock size={12} /> En cours...
                   </span>
                )}
              </td>
              <td className="px-6 py-4">
                {getScoreBadge(scan.score)}
              </td>
              <td className="px-6 py-4 text-right">
                {scan.status === 'COMPLETED' && (
                  <Link 
                    href={`/scans/${scan.id}`}
                    className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Eye size={14} className="mr-1" /> Détails
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}