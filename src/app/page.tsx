import { Observatory } from "@/features/brief/observatory";
import { getObservatoryStory, getRecentChanges } from "@/server/decisions";

export default async function Home() {
  const [changes, story] = await Promise.all([
    getRecentChanges({ limit: 60 }),
    getObservatoryStory(),
  ]);

  return <Observatory changes={changes} story={story} />;
}
