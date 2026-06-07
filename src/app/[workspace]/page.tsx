import { notFound, redirect } from "next/navigation";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;

  if (workspace !== "dashboard") notFound();

  redirect("/dashboard/clippers");
}
