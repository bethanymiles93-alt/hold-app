import { useEffect, useMemo, useRef, type RefObject } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

const RESEARCH_SECTIONS = [
  {
    id: "what-guided-holds-design",
    title: "What guided Hold's design",
    body: "Hold's design choices trace back to a set of core research questions: what causes communication withdrawal during periods of reduced capacity, how prolonged silence affects trust and relationship perception, which interface choices reduce cognitive and emotional effort, how to apply trauma-informed principles without presenting as clinical care, what accessibility standards apply to low-capacity interactions, what data is truly necessary, the risks of AI-assisted personal messages, and which outcomes can be measured without turning relationships into scores."
  },
  {
    id: "designing-for-low-capacity",
    title: "Designing for low capacity",
    body: "Hold has to work when attention, working memory, the ability to start a task, and emotional tolerance are all sharply reduced. That ruled out common sources of avoidable load: too many choices, long onboarding, requiring a complete explanation before acting, ambiguous buttons, dense text, tiny controls, and unclear consequences for an action."
  },
  {
    id: "trauma-informed-principles",
    title: "Trauma-informed principles",
    body: "Hold isn't a trauma-treatment product, but trauma-informed principles offer useful safeguards for people who may feel ashamed, frightened, exhausted or dysregulated when they open it: safety, trust and transparency, genuine choice, collaboration rather than instruction, empowerment, and respect for context and difference."
  },
  {
    id: "accessibility",
    title: "Accessibility",
    body: "Hold targets WCAG 2.2 AA as a floor, and tests beyond compliance with people who have cognitive, learning, visual, motor and fatigue-related access needs. This shapes concrete choices throughout the app: labelled icons rather than icon-only navigation, contrast and touch-target minimums, visible focus states, respect for reduced-motion settings, and never communicating status by colour alone."
  },
  {
    id: "where-hold-sits",
    title: "Where Hold sits among other apps",
    body: "Most relationship and mental-health apps assume the user still has enough capacity to engage with prompts, tracking, exercises, games or therapy. Hold begins at the point where that assumption fails. The user may still care deeply, but may not be able to start or sustain a conversation. Hold focuses specifically on communication continuity during periods of reduced capacity, not on treatment, tracking or engagement for its own sake."
  },
  {
    id: "guilt-spiral-and-voice",
    title: "The guilt spiral, and how Hold speaks",
    body: "Hold looked to the lived experience of people who deal with the guilt spiral in chronic illness and reduced capacity when deciding how it speaks: gentle, short, genuine statements that validate rather than lengthy reassurance; permission without pressure or commentary; never praising a basic act of communication, which reframes it as an achievement and adds pressure; and never naming or narrating a person's psychology back to them, which reads as clinical rather than caring. This is the research behind the voice used throughout Hold."
  },
  {
    id: "why-core-groups-close-and-friends",
    title: "Why \"Core\" groups Close and Friends together",
    body: "Dunbar's layered model of personal relationships describes an innermost \"support clique\" of roughly five closest attachment figures, and a wider \"sympathy group\" of around fifteen close friends just beyond it — together forming the core layer of someone's personal network, before the much larger, looser circles further out. Your Circles' \"Core\" heading reflects that same natural clustering: your closest few, and the close friends around them, tend to function as one connected group rather than two separate tiers."
  },
  {
    id: "connection-and-loneliness",
    title: "Staying connected, even briefly, matters more than it might feel like",
    body: "Long-running studies that track people's health and relationships over years have found that staying socially connected is tied to health outcomes on roughly the same scale as other major, well-studied risk factors, not a soft or secondary one (Holt-Lunstad, Smith & Layton, 2010; Holt-Lunstad et al., 2015). Separately, research reviewing loneliness interventions found that the most effective ones weren't the ones that simply created more chances to be in contact. They were the ones that helped people work through the anxious thinking that gets in the way of reaching out in the first place (Masi, Chen, Hawkley & Cacioppo, 2011). Taken together, this is part of why Hold treats taking time and letting people down as genuinely separate things: staying in touch during a hard stretch is worth doing, and what usually helps most isn't more opportunities to do it, it's easing the thinking that makes reaching out feel harder than it is."
  },
  {
    id: "reach-out-underestimation",
    title: "People welcome a message more than you'd expect",
    body: "Across thousands of participants and more than a dozen experiments, people consistently underestimated how much others appreciate being reached out to, an effect that gets stronger the more surprising the message is and the less close the relationship (Liu, Rim & Min, 2022). A related finding, sometimes called the liking gap, is that after a conversation people also tend to underestimate how much the other person liked them and enjoyed talking with them (Boothby, Cooney, Sandstrom & Clark, 2018). Both point the same way: the gap between how a reach-out message actually lands and how it feels like it will land before you send it is real and consistent, not just something anxious thinking makes up."
  },
  {
    id: "shame-and-self-compassion",
    title: "Shame, guilt, and why Hold's language avoids one and allows the other",
    body: "Guilt and shame aren't the same thing, even though they can feel similar in the moment. Guilt is a judgment about one specific thing you did; shame is a judgment about who you are. Guilt tends to motivate repair; shame tends to motivate hiding (Tangney et al.). Hold's language is built to stay on the guilt side of that line, since narrating someone's character back to them, even kindly, risks feeding the withdrawal shame produces rather than easing it. Brené Brown's Shame Resilience Theory names reaching out and speaking the feeling out loud as two of the concrete ways through shame, not just around it (Brown, 2006). Hold's Transition screen draws on a related, more clinically tested exercise, the Self-Compassion Break, built around naming the feeling, recognising it as something other people go through too, and offering yourself the same kindness you'd offer someone else (Neff, 2003; Neff & Germer, 2013)."
  }
];

interface ResearchContentProps {
  /**
   * Passed straight through from Screen's own scrollRef — lets a citation
   * marker elsewhere in the app land directly on the section it cites,
   * rather than the top of an undifferentiated page. See docs/09-decision-log.md,
   * 2026-08-30.
   */
  scrollRef?: RefObject<ScrollView | null>;
  /** Section id to jump to and highlight once this mounts (or this prop changes) — e.g. from `?section=` on the Library route. */
  anchorSectionId?: string | null;
}

/**
 * Shared between Library's Research tab (primary entry point) and the
 * Settings drawer's Research row (secondary — redirects into the same tab
 * rather than keeping its own screen/copy of this content). One Research
 * page, two entry points. See docs/09-decision-log.md, 2026-08-13.
 */
export function ResearchContent({ scrollRef, anchorSectionId }: ResearchContentProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sectionRefs = useRef<Record<string, View | null>>({});

  useEffect(() => {
    if (!anchorSectionId) return;

    // A short delay, not an immediate call: the section refs' native layout
    // isn't guaranteed settled the instant this effect fires, particularly
    // right after switching tabs into Research for the first time. measureLayout
    // silently no-ops against a not-yet-laid-out node rather than erroring, so an
    // early call would fail quietly with no fallback — this delay is the cheap
    // way to avoid that, not a precisely-tuned animation timing.
    const timer = setTimeout(() => {
      const sectionNode = sectionRefs.current[anchorSectionId];
      const scrollView = scrollRef?.current;
      const innerViewNode = scrollView?.getInnerViewNode?.();
      if (!sectionNode || !scrollView || innerViewNode == null) return;

      sectionNode.measureLayout(
        innerViewNode,
        (_x, y) => scrollView.scrollTo({ y: Math.max(y - theme.spacing.lg, 0), animated: true }),
        () => {
          // Measurement can fail transiently right after a tab switch — not
          // worth a retry loop for a "land roughly near the right place"
          // affordance; the section is still reachable by scrolling normally.
        }
      );
    }, 150);

    return () => clearTimeout(timer);
  }, [anchorSectionId, scrollRef]);

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        The evidence base behind how Hold is designed and how it speaks, surfaced honestly rather
        than left as internal documentation only.
      </Text>

      <View style={styles.sections}>
        {RESEARCH_SECTIONS.map((section) => (
          <View
            key={section.id}
            ref={(node) => {
              sectionRefs.current[section.id] = node;
            }}
            style={[styles.section, section.id === anchorSectionId && styles.sectionAnchored]}
          >
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
      borderWidth: 1.5,
      borderColor: "transparent",
      gap: theme.spacing.sm
    },
    sectionAnchored: {
      borderColor: colors.primary
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
