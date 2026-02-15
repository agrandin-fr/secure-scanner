import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton
} from '@clerk/nextjs';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Secure Scanner",
  description: "A SaaS for securing your applications.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <header className="flex items-center justify-between p-4 bg-white shadow-md">
            <div className="font-bold text-lg">
              🛡️ Secure Scanner
            </div>
            <div className="flex items-center gap-4">
              <SignedOut>
                <div className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">
                  <SignInButton />
                </div>
                <div className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">
                  <SignUpButton />
                </div>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </div>
          </header>
          <main className="p-8">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}