export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full py-10 px-4">
      <main className="mx-auto flex justify-center">{children}</main>
    </div>
  );
}
