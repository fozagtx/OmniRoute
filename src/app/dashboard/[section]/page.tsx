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
  return Object.keys(taskBySection).map((section) => ({ section }));
}

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const task = taskBySection[section as DashboardSection];

  if (!task) notFound();

  return <ClipBountyApp initialTask={task} />;
}
