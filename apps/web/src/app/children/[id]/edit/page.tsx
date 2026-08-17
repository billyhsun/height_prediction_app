import { ChildForm } from "@/components/ChildForm";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditChildPage({ params }: PageProps) {
  const { id } = await params;
  return <ChildForm childId={id} />;
}
