export default function ChildrenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-10">
      <main className="mx-auto flex justify-center">{children}</main>
    </div>
  );
}
