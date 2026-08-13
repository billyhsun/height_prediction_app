export default function ResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-slate-100 py-10 px-4">
      <main className="mx-auto flex justify-center">{children}</main>
    </div>
  );
}
