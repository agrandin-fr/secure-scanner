import { getScanDetails } from '@/app/actions';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, AlertTriangle, Check } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ScanPage({ params }: { params: { id: string } }) {
const { id } = await params;

  const scan = await getScanDetails(id);

  if (!scan) return notFound();
  // On simule un rapport si le JSON est vide pour l'exemple
  const report = (scan.owaspReport as any) || { 
    vulnerabilities: [], 
    summary: "Aucune donnée brute disponible." 
  };

  return (
    <div className="container mx-auto max-w-4xl py-12">
      <Link href="/" className="flex items-center text-sm text-gray-500 hover:text-black mb-6">
        <ArrowLeft size={16} className="mr-2" /> Retour au Dashboard
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        {/* En-tête Global */}
        <div className="md:col-span-3 rounded-xl border bg-white p-6 shadow-sm flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{scan.repoUrl}</h1>
            <p className="text-gray-500 text-sm">Scan ID: {scan.id}</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black text-blue-600">{scan.score ?? '?'}%</div>
            <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Score de sécurité</div>
          </div>
        </div>

        {/* Détails du rapport (JSON) */}
        <div className="md:col-span-3 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield size={20} /> Rapport de Vulnérabilités
          </h2>
          
          {/* Ici on peut mapper sur le tableau de vulnérabilités contenu dans le JSON */}
          <div className="space-y-4">
             {/* Exemple d'affichage si le JSON contient une liste 'issues' */}
             {report.issues && report.issues.length > 0 ? (
                report.issues.map((issue: any, i: number) => (
                  <div key={i} className="flex gap-4 p-4 rounded-lg bg-red-50 border border-red-100">
                    <AlertTriangle className="text-red-500 shrink-0" />
                    <div>
                      <h3 className="font-bold text-red-900">{issue.title || "Vulnérabilité détectée"}</h3>
                      <p className="text-sm text-red-700 mt-1">{issue.description}</p>
                    </div>
                  </div>
                ))
             ) : (
               <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                 <Check className="h-10 w-10 text-green-500 mb-2" />
                 <p>Aucune vulnérabilité majeure détectée dans le rapport brut.</p>
               </div>
             )}
          </div>

          {/* Affichage Brut pour Debug (Temporaire) */}
          <div className="mt-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Données Brutes (Debug)</h3>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
              {JSON.stringify(scan.owaspReport, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}