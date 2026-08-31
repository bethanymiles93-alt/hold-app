import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { ResearchConceptPage } from "@/components/ResearchConceptPage";
import { getResearchPage } from "@/constants/researchContent";

/**
 * One of the six Research concept pages — a real route (not a tab switch),
 * so it gets its own back button and drops the bottom nav / segmented
 * tabs, same as every other Tier 1 screen (see navTier.ts). Reached from
 * Research's own index (ResearchIndex.tsx) or a CitationMarker elsewhere
 * in the app. See docs/09-decision-log.md, 2026-08-31.
 */
export default function ResearchConceptRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const page = getResearchPage(slug);

  if (!page) {
    return (
      <Screen>
        <Text>Not found.</Text>
      </Screen>
    );
  }

  return <ResearchConceptPage page={page} />;
}
