import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ChatFusion",
  description: "Aggregate and analyze live chat from multiple streaming platforms",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} antialiased bg-gray-950 min-h-screen flex flex-col`}>
        <header className="bg-gray-900 border-b border-purple-600/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded flex items-center justify-center text-white font-bold text-lg">CF</div>
              <h1 className="text-xl font-bold text-white">
                <span className="text-purple-400">Chat</span>
                <span className="text-indigo-400">Fusion</span>
              </h1>
            </div>
            <div className="text-sm text-gray-400">
              Your Multi-Stream Chat Solution
            </div>
          </div>
        </header>
        <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
        <footer className="bg-gray-900 border-t border-purple-600/30 py-5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-gray-400 text-sm">
            <p>ChatFusion © {new Date().getFullYear()} • All Rights Reserved</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
