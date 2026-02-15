import { ScanForm } from "@/components/scan-form";
import { ScanList } from "@/components/scan-list";
import { getUserScans } from "@/app/actions";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

export default async function Home() {
  const scans = await getUserScans();

  return (
    <div className="container mx-auto flex flex-col items-center justify-center py-12">
      <div className="w-full max-w-lg text-center">
        <h1 className="text-5xl font-extrabold tracking-tighter text-black">
          🛡️ Secure <span className="text-blue-600">Scanner</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Analysez vos dépôts GitHub contre les vulnérabilités OWASP en un clic.
        </p>
      </div>

      <div className="mt-10 w-full max-w-lg">
        <SignedIn>
          <ScanForm />
          <ScanList initialScans={scans} />
        </SignedIn>

        <SignedOut>
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
            <p className="mb-6 text-gray-500">Connectez-vous pour commencer à scanner vos projets.</p>
            <SignInButton mode="modal">
              <button className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all">
                Se connecter maintenant
              </button>
            </SignInButton>
          </div>
        </SignedOut>
      </div>
    </div>
  );
}