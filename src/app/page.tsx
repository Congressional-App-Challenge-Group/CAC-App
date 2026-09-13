import { Brief } from "@/features/brief/brief";
import { Masthead } from "@/features/brief/masthead";
import { getRecentChanges } from "@/server/decisions";

export default async function Home() {
  const changes = await getRecentChanges({ limit: 60 });
  const weekAgo = Date.now() - 7 * 86_400_000;
  const changedThisWeek = changes.filter(
    (change) => new Date(change.changedAt).getTime() >= weekAgo,
  ).length;

  return (
    <>
      <Masthead changedThisWeek={changedThisWeek} />
      <div className="shell py-12 md:py-16">
        <Brief changes={changes} />
      </div>
    </>
  );
}
