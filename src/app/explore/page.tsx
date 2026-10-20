import { ExploreClient } from "@/features/search/explore-client";
import { PageHeader } from "@/components/ui/section";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const initialTopic = typeof params.topic === "string" ? params.topic : "";
  const initialQuick = typeof params.quick === "string" ? params.quick : "";

  return (
    <div className="explore-page">
      <div className="shell">
        <PageHeader
          eyebrow="The public index · 01"
          title="Find the decision behind the change."
          description="Search Charlotte and Mecklenburg records by place, project, or issue. Every result leads back to what the government actually published."
        />
        <ExploreClient initialQuery={initialQuery} initialTopic={initialTopic} initialQuick={initialQuick} />
      </div>
    </div>
  );
}
