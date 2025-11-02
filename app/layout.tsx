import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimSense AI - Automating CPT Coding & Claims Drafting with AI",
  description: "From procedure to reimbursement — streamlined. Reduce billing costs by 50% while eliminating manual coding errors with our AI agent that automates de-identification, CPT code selection, and claim drafting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

