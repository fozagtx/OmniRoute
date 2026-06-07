import { notFound } from "next/navigation";
import ClipBountyApp from "../../ClipBountyApp";

const taskBySection = {
  clippers: "submit",
  brands: "create",
  verify: "verify",
  funds: "funds",
} as const;

type DashboardSection = keyof typeof taskBySection;

export function generateStaticParams() {
  return Object.keys(taskBySection).map((section) => ({ workspace: "dashboard", section }));
}

export default async function WorkspaceSectionPage({
  params,
}: {
  params: Promise<{ workspace: string; section: string }>;
}) {
  const { workspace, section } = await params;
  const task = taskBySection[section as DashboardSection];

  if (workspace !== "dashboard" || !task) notFound();

  return <ClipBountyApp initialTask={task} />;
}
