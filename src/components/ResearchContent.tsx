import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

const RESEARCH_SECTIONS = [
  {
    title: "What guided Hold's design",
    body: "Hold's design choices trace back to a set of core research questions: what causes communication withdrawal during periods of reduced capacity, how prolonged silence affects trust and relationship perception, which interface choices reduce cognitive and emotional effort, how to apply trauma-informed principles without presenting as clinical care, what accessibility standards apply to low-capacity interactions, what data is truly necessary, the risks of AI-assisted personal messages, and which outcomes can be measured without turning relationships into scores."
  },
  {
    title: "Designing for low capacity",
    body: "Hold has to work when attention, working memory, the ability to start a task, and emotional tolerance are all sharply reduced. That ruled out common sources of avoidable load: too many choices, long onboarding, requiring a complete explanation before acting, ambiguous buttons, dense text, tiny controls, and unclear consequences for an action."
  },
  {
    title: "Trauma-informed principles",
    body: "Hold isn't a trauma-treatment product, but trauma-informed principles offer useful safeguards for people who may feel ashamed, frightened, exhausted or dysregulated when they open it: safety, trust and transparency, genuine choice, collaboration rather than instruction, empowerment, and respect for context and difference."
  },
  {
    title: "Accessibility",
    body: "Hold targets WCAG 2.2 AA as a floor, and tests beyond compliance with people who have cognitive, learning, visual, motor and fatigue-related access needs. This shapes concrete choices throughout the app: labelled icons rather than icon-only navigation, contrast and touch-target minimums, visible focus states, respect for reduced-motion settings, and never communicating status by colour alone."
  },
  {
    title: "Where Hold sits among other apps",
    body: "Most relationship and mental-health apps assume the user still has enough capacity to engage with prompts, tracking, exercises, games or therapy. Hold begins at the point where that assumption fails. The user may still care deeply, but may not be able to start or sustain a conversation. Hold focuses specifically on communication continuity during periods of reduced capacity, not on treatment, tracking or engagement for its own sake."
  },
  {
    title: "The guilt spiral, and how Hold speaks",
    body: "Hold looked to the lived experience of people who deal with the guilt spiral in chronic illness and reduced capacity when deciding how it speaks: gentle, short, genuine statements that validate rather than lengthy reassurance; permission without pressure or commentary; never praising a basic act of communication, which reframes it as an achievement and adds pressure; and never naming or narrating a person's psychology back to them, which reads as clinical rather than caring. This is the research behind the voice used throughout Hold."
  },
  {
    title: "Why \"Core\" groups Close and Friends together",
    body: "Dunbar's layered model of personal relationships describes an innermost \"support clique\" of roughly five closest attachment figures, and a wider \"sympathy group\" of around fifteen close friends just beyond it — together forming the core layer of someone's personal network, before the much larger, looser circles further out. Your Circles' \"Core\" heading reflects that same natural clustering: your closest few, and the close friends around them, tend to function as one connected group rather than two separate tiers."
  }
];

/**
 * Shared between Library's Research tab (primary entry point) and the
 * Settings drawer's Research row (secondary — redirects into the same tab
 * rather than keeping its own screen/copy of this content). One Research
 * page, two entry points. See docs/09-decision-log.md, 2026-08-13.
 */
export function ResearchContent() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        The evidence base behind how Hold is designed and how it speaks, surfaced honestly rather
        than left as internal documentation only.
      </Text>

      <View style={styles.sections}>
        {RESEARCH_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.title}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.xl
    },
    intro: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 26
    },
    sections: {
      gap: theme.spacing.md
    },
    section: {
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surface,
      gap: theme.spacing.sm
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600"
    },
    body: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 23
    }
  });
}
