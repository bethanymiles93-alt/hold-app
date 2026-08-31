/**
 * Research restructured from one long scroll into an index + six concept
 * pages (2026-08-31) — see docs/09-decision-log.md. Content ported from
 * `hold-book/02-research/07-extended-evidence-base.md` (the vetted source
 * of truth for every citation below — do not add a finding here that
 * isn't already in that file) plus the four sections that already
 * existed in the old single-page ResearchContent.tsx.
 *
 * Two partial ports from the old page were completed here, not left as
 * gaps: Bohns (2016) compliance-underestimation was named in the old
 * section's own heading but never actually cited in its body; Lindsay et
 * al. (2019) and Lasgaard et al. were part of the same "Loneliness
 * interventions" source section as Masi et al. but only Masi et al. had
 * been ported. Both are already in the evidence-base file — completing
 * an existing port, not new research.
 *
 * Explicitly excluded per direct instruction, both flagged in the source
 * file as not for app-facing use: chronic-illness therapeutic
 * intervention effect sizes (CBT/ACT/self-management), and the two
 * unsourced "60%/80%" stats confirmed NOT part of this evidence base.
 *
 * Meta/design-process content that doesn't fit any of the six concept
 * pages (what guided Hold's design, low-capacity design, trauma-informed
 * principles, accessibility, where Hold sits among other apps, the
 * guilt-spiral-and-voice rationale) stays as index-page intro content
 * rather than being forced into a citation-heavy page template it
 * doesn't fit — see RESEARCH_INDEX_INTRO below.
 */

export type ResearchTag =
  | "Causal"
  | "Correlational"
  | "Descriptive/qualitative"
  | "Theoretical"
  | "Meta-analysis, mixed designs"
  | "Practitioner-driven, not peer-reviewed";

export interface ResearchReference {
  id: string;
  /** First-author surname, used to alphabetise the page's reference list. */
  surname: string;
  /** The in-text form, e.g. "Holt-Lunstad, Smith & Layton (2010)" — this exact text is the tappable citation. */
  authorDate: string;
  /** Full reference: author(s), year, journal, DOI where the source file gives one. */
  fullCitation: string;
  tag: ResearchTag;
}

export type BodySegment = { type: "text"; text: string } | { type: "citation"; refId: string };

export interface ResearchFinding {
  /** Stable id — the per-finding hide granularity (see researchHiddenService.ts). A finding is one distinct claim/paragraph, which may cite more than one source together. */
  id: string;
  segments: BodySegment[];
}

export interface ResearchPage {
  slug: string;
  title: string;
  intro: string;
  findings: ResearchFinding[];
  /** Pre-sorted alphabetically by surname — do not resort at render time from an arbitrary source order. */
  references: ResearchReference[];
}

const t = (text: string): BodySegment => ({ type: "text", text });
const c = (refId: string): BodySegment => ({ type: "citation", refId });

function sortedReferences(refs: ResearchReference[]): ResearchReference[] {
  return [...refs].sort((a, b) => a.surname.localeCompare(b.surname));
}

export const RESEARCH_INDEX_INTRO = {
  title: "What guided Hold's design",
  body: "Hold's design choices trace back to a set of core research questions: what causes communication withdrawal during periods of reduced capacity, how prolonged silence affects trust and relationship perception, which interface choices reduce cognitive and emotional effort, how to apply trauma-informed principles without presenting as clinical care, what accessibility standards apply to low-capacity interactions, what data is truly necessary, the risks of AI-assisted personal messages, and which outcomes can be measured without turning relationships into scores.\n\nHold has to work when attention, working memory, the ability to start a task, and emotional tolerance are all sharply reduced. That ruled out common sources of avoidable load: too many choices, long onboarding, requiring a complete explanation before acting, ambiguous buttons, dense text, tiny controls, and unclear consequences for an action.\n\nHold isn't a trauma-treatment product, but trauma-informed principles offer useful safeguards for people who may feel ashamed, frightened, exhausted or dysregulated when they open it: safety, trust and transparency, genuine choice, collaboration rather than instruction, empowerment, and respect for context and difference.\n\nHold targets WCAG 2.2 AA as a floor, and tests beyond compliance with people who have cognitive, learning, visual, motor and fatigue-related access needs. This shapes concrete choices throughout the app: labelled icons rather than icon-only navigation, contrast and touch-target minimums, visible focus states, respect for reduced-motion settings, and never communicating status by colour alone.\n\nMost relationship and mental-health apps assume the user still has enough capacity to engage with prompts, tracking, exercises, games or therapy. Hold begins at the point where that assumption fails. The user may still care deeply, but may not be able to start or sustain a conversation. Hold focuses specifically on communication continuity during periods of reduced capacity, not on treatment, tracking or engagement for its own sake.\n\nHold looked to the lived experience of people who deal with the guilt spiral in chronic illness and reduced capacity when deciding how it speaks: gentle, short, genuine statements that validate rather than lengthy reassurance; permission without pressure or commentary; never praising a basic act of communication, which reframes it as an achievement and adds pressure; and never naming or narrating a person's psychology back to them, which reads as clinical rather than caring. This is the research behind the voice used throughout Hold."
};

// ============================================================
// PAGE 1 — Reaching out & being heard
// ============================================================
const reachingOutReferences: ResearchReference[] = sortedReferences([
  {
    id: "bohns-2016",
    surname: "Bohns",
    authorDate: "Bohns (2016)",
    fullCitation: "Bohns, V. K. (2016). (Mis)understanding our influence over others: A review of the underestimation-of-compliance effect. Current Directions in Psychological Science. DOI: 10.1177/0963721415628011",
    tag: "Causal"
  },
  {
    id: "boothby-et-al-2018",
    surname: "Boothby",
    authorDate: "Boothby, Cooney, Sandstrom & Clark (2018)",
    fullCitation: "Boothby, E. J., Cooney, G., Sandstrom, G. M., & Clark, M. S. (2018). The liking gap in conversations: Do people like us more than we think? Psychological Science. DOI: 10.1177/0956797618783714",
    tag: "Correlational"
  },
  {
    id: "chaudoir-fisher",
    surname: "Chaudoir",
    authorDate: "Chaudoir & Fisher",
    fullCitation: "Chaudoir, S. R., & Fisher, J. D. Disclosure Decision-Making Model, applied to nonvisible illness. PMC5215027.",
    tag: "Correlational"
  },
  {
    id: "coman-cardon-2026",
    surname: "Coman",
    authorDate: "Coman & Cardon (2026)",
    fullCitation: "Coman, C., & Cardon, P. (2026). Sincerity and caring ratings of AI-generated versus human-generated text.",
    tag: "Causal"
  },
  {
    id: "joachim-acorn-2000",
    surname: "Joachim",
    authorDate: "Joachim & Acorn (2000)",
    fullCitation: "Joachim, G., & Acorn, S. (2000). Stigma of visible and invisible chronic conditions. Journal of Advanced Nursing.",
    tag: "Theoretical"
  },
  {
    id: "liu-rim-min-2022",
    surname: "Liu",
    authorDate: "Liu, Rim & Min (2022)",
    fullCitation: "Liu, P. J., Rim, S., & Min, L. (2022). The surprise of reaching out: Appreciated more than we think. Journal of Personality and Social Psychology. DOI: 10.1037/pspi0000402",
    tag: "Causal"
  },
  {
    id: "reciprocity-review",
    surname: "Reciprocity review",
    authorDate: "a reciprocity review (PubMed 20871667)",
    fullCitation: "Reciprocity and equity in family and friendship relationships — review, PubMed ID 20871667.",
    tag: "Correlational"
  },
  {
    id: "verduyn-2017-2022",
    surname: "Verduyn",
    authorDate: "Verduyn et al. (2017, 2022 extended model)",
    fullCitation: "Verduyn, P., et al. (2017, extended 2022). Do social network sites enhance or undermine subjective wellbeing? A critical review. Current Directions in Psychological Science.",
    tag: "Correlational"
  }
]);

const reachingOutFindings: ResearchFinding[] = [
  {
    id: "reach-out-underestimation",
    segments: [
      t("Across thousands of participants and more than a dozen experiments, people consistently underestimate how much others appreciate being reached out to, an effect that gets stronger the more surprising the message is and the less close the relationship "),
      c("liu-rim-min-2022"),
      t(". A related finding, sometimes called the liking gap, is that after a conversation people also tend to underestimate how much the other person liked them and enjoyed talking with them "),
      c("boothby-et-al-2018"),
      t(". A third, related effect: across studies involving over 14,000 requests to strangers, people underestimate the likelihood others will agree to a direct request for help by an average of 48%, because requesters fail to appreciate how awkward it is for someone to say no "),
      c("bohns-2016"),
      t(". All three point the same way: the gap between how a reach-out message actually lands and how it feels like it will land before you send it is real and consistent, not just something anxious thinking makes up — directly supporting the core hypothesis behind Reconnect and reach-out prompts.")
    ]
  },
  {
    id: "reciprocity",
    segments: [
      t("Family relationships tolerate imbalance better over time than friendships do; friendship continuity depends more on maintained, balanced reciprocity "),
      c("reciprocity-review"),
      t(". This is a possible reason Friends-tier relationships may need more active maintenance during a quiet period than family ties do — consistent with Hold's Close/Friends/Work content-depth guidance, which treats them differently rather than as one undifferentiated list.")
    ]
  },
  {
    id: "active-vs-passive-social-media",
    segments: [
      t("Active use of social platforms — direct messages, comments, genuine exchange — is linked to increased social capital and connectedness. Passive use — scrolling, browsing — is linked instead to upward social comparison, envy, and reduced wellbeing "),
      c("verduyn-2017-2022"),
      t(". This is a further piece of evidence, not the original reason, behind Hold's decision to avoid building any passive-scroll or feed-style surface.")
    ]
  },
  {
    id: "ai-writing-authenticity",
    segments: [
      t("Sincerity and caring ratings measurably dip when text reads as AI-generated "),
      c("coman-cardon-2026"),
      t(". This is relevant context for how Amend with AI is designed — a light-touch blend of the person's own words, not a from-scratch regenerate — since keeping someone's own words as the base supports the sincerity a recipient will actually perceive.")
    ]
  },
  {
    id: "disclosure-decision-making",
    segments: [
      t("A foundational framework links how visible a chronic condition is to the ongoing, situational decision to disclose or conceal it "),
      c("joachim-acorn-2000"),
      t(". A related model found perceived stigma negatively predicts how comfortable someone feels disclosing, while closeness to the recipient positively predicts both that comfort and the likelihood of a positive response "),
      c("chaudoir-fisher"),
      t(". Closeness predicting disclosure comfort and positive reception is the specific finding behind Hold's content-depth-by-Circle-type guidance — what feels natural to share with Close doesn't need to be the same as what's shared with Work.")
    ]
  }
];

export const REACHING_OUT_PAGE: ResearchPage = {
  slug: "reaching-out",
  title: "Reaching out & being heard",
  intro: "The evidence behind why sending something is usually worth more than it feels like it will be, and what makes a message land.",
  findings: reachingOutFindings,
  references: reachingOutReferences
};

// ============================================================
// PAGE 2 — Connection & why it matters
// ============================================================
const connectionReferences: ResearchReference[] = sortedReferences([
  {
    id: "cornwell-2023",
    surname: "Cornwell",
    authorDate: "Cornwell (2023)",
    fullCitation: "Cornwell, B. (2023). Chronic illness and network bridging. Social Networks. (NSHAP longitudinal data, N=1,555)",
    tag: "Correlational"
  },
  {
    id: "dunbar-2025",
    surname: "Dunbar",
    authorDate: "Dunbar (1992 onward; primary paper 2025)",
    fullCitation: "Dunbar, R. I. M. Layered relationship model. Primary paper: (2025). PLOS One. DOI: 10.1371/journal.pone.0319604",
    tag: "Descriptive/qualitative"
  },
  {
    id: "holt-lunstad-2010",
    surname: "Holt-Lunstad",
    authorDate: "Holt-Lunstad, Smith & Layton (2010)",
    fullCitation: "Holt-Lunstad, J., Smith, T. B., & Layton, J. B. (2010). Social relationships and mortality risk: A meta-analytic review. PLoS Medicine. DOI: 10.1371/journal.pmed.1000316",
    tag: "Correlational"
  },
  {
    id: "holt-lunstad-2015",
    surname: "Holt-Lunstad",
    authorDate: "Holt-Lunstad et al. (2015)",
    fullCitation: "Holt-Lunstad, J., Smith, T. B., Baker, M., Harris, T., & Stephenson, D. (2015). Loneliness and social isolation as risk factors for mortality. Perspectives on Psychological Science. DOI: 10.1177/1745691614568352",
    tag: "Correlational"
  },
  {
    id: "lasa-network",
    surname: "LASA",
    authorDate: "the Longitudinal Aging Study Amsterdam",
    fullCitation: "Longitudinal Aging Study Amsterdam (LASA), N=2,788 — network size and disease status.",
    tag: "Correlational"
  },
  {
    id: "lasgaard",
    surname: "Lasgaard",
    authorDate: "Lasgaard et al.",
    fullCitation: "Lasgaard, M., et al. Meta-analysis of 128 loneliness-intervention studies.",
    tag: "Meta-analysis, mixed designs"
  },
  {
    id: "lindsay-2019",
    surname: "Lindsay",
    authorDate: "Lindsay, Young, Brown, Smyth & Creswell (2019)",
    fullCitation: "Lindsay, E. K., Young, S., Brown, K. W., Smyth, J. M., & Creswell, J. D. (2019). Mindfulness training reduces loneliness and increases social contact in a randomized controlled trial. PNAS. DOI: 10.1073/pnas.1813588116",
    tag: "Causal"
  },
  {
    id: "masi-2011",
    surname: "Masi",
    authorDate: "Masi, Chen, Hawkley & Cacioppo (2011)",
    fullCitation: "Masi, C. M., Chen, H.-Y., Hawkley, L. C., & Cacioppo, J. T. (2011). A meta-analysis of interventions to reduce loneliness. Personality and Social Psychology Review. DOI: 10.1177/1088868310377394",
    tag: "Meta-analysis, mixed designs"
  },
  {
    id: "moreton-2023",
    surname: "Moreton",
    authorDate: "Moreton et al. (2023)",
    fullCitation: "Moreton, et al. (2023). Weak ties in daily social interaction. Social and Personality Psychology Compass.",
    tag: "Descriptive/qualitative"
  },
  {
    id: "sandstrom-dunn-2014a",
    surname: "Sandstrom",
    authorDate: "Sandstrom & Dunn (2014)",
    fullCitation: "Sandstrom, G. M., & Dunn, E. W. (2014). Social interactions and well-being: The surprising power of weak ties. Personality and Social Psychology Bulletin. DOI: 10.1177/0146167214529799",
    tag: "Correlational"
  },
  {
    id: "sandstrom-dunn-2014b",
    surname: "Sandstrom",
    authorDate: "Sandstrom & Dunn (2013/2014)",
    fullCitation: "Sandstrom, G. M., & Dunn, E. W. (2013/2014). Is efficiency overrated? Minimal social interactions lead to belonging and positive affect. Social Psychological and Personality Science. DOI: 10.1177/1948550613502990",
    tag: "Causal"
  }
]);

const connectionFindings: ResearchFinding[] = [
  {
    id: "connection-and-loneliness",
    segments: [
      t("Long-running studies that track people's health and relationships over years have found that staying socially connected is tied to health outcomes on roughly the same scale as other major, well-studied risk factors, not a soft or secondary one "),
      c("holt-lunstad-2010"),
      t("; "),
      c("holt-lunstad-2015"),
      t(". Separately, a two-week randomised trial of smartphone mindfulness training reduced daily loneliness by 22% and increased social contact by roughly two interactions a day "),
      c("lindsay-2019"),
      t(". A broader review of loneliness interventions found the most effective ones weren't the ones that simply created more chances to be in contact — they were the ones that helped people work through the anxious thinking that gets in the way of reaching out in the first place "),
      c("masi-2011"),
      t(", a pattern a later, larger review of 128 studies found broadly consistent "),
      c("lasgaard"),
      t(". Taken together, this is part of why Hold treats taking time and letting people down as genuinely separate things: staying in touch during a hard stretch is worth doing, and what usually helps most isn't more opportunities to do it, it's easing the thinking that makes reaching out feel harder than it is.")
    ]
  },
  {
    id: "dunbar-layered-relationships",
    segments: [
      t("Personal networks nest in layers: an innermost \"support clique\" of roughly five closest attachment figures, and a wider \"sympathy group\" of around fifteen close friends just beyond it — together forming the core layer of someone's personal network, before the much larger, looser circles further out "),
      c("dunbar-2025"),
      t(". Your Circles' \"Core\" heading reflects that same natural clustering: your closest few, and the close friends around them, tend to function as one connected group rather than two separate tiers.")
    ]
  },
  {
    id: "weak-ties",
    segments: [
      t("\"Weak tie\" — acquaintance-level — interactions are linked to greater daily belonging and wellbeing, an effect present even after accounting for close-tie interactions "),
      c("sandstrom-dunn-2014a"),
      t(". Brief, genuine interactions with strangers produced more positive affect than maximally efficient, minimal exchanges "),
      c("sandstrom-dunn-2014b"),
      t(", and weak ties account for roughly 60% of people's daily social interactions in tracked-diary studies "),
      c("moreton-2023"),
      t(". This supports treating Friends/Work-tier Circles as genuinely valuable to maintain, not just a lesser version of Close Circle contact.")
    ]
  },
  {
    id: "network-bridging-narrowing",
    segments: [
      t("Chronic illness is associated with lower network \"bridging\" — more frequent contact with close ties, fewer neighbours, friends or colleagues "),
      c("cornwell-2023"),
      t(". A separate longitudinal study found network size itself wasn't associated with disease status, but loneliness and instrumental support were — illness narrows the outer layer more than it shrinks the network overall "),
      c("lasa-network"),
      t(". This supports designing for multiple Circles of differing closeness rather than treating \"your network\" as one undifferentiated group — the outer layers are specifically what's at risk during a hard period, which is exactly what Hold's per-Circle messaging addresses.")
    ]
  }
];

export const CONNECTION_PAGE: ResearchPage = {
  slug: "connection",
  title: "Connection & why it matters",
  intro: "Why staying in touch, even briefly and even with people you're not closest to, carries more real weight than it can feel like it does.",
  findings: connectionFindings,
  references: connectionReferences
};

// ============================================================
// PAGE 3 — Shame, guilt, self-compassion & rejection sensitivity
// ============================================================
const shameReferences: ResearchReference[] = sortedReferences([
  {
    id: "brown-2006",
    surname: "Brown",
    authorDate: "Brown (2006)",
    fullCitation: "Brown, B. (2006). Shame Resilience Theory: A grounded theory study on women and shame.",
    tag: "Theoretical"
  },
  {
    id: "dodson-2024",
    surname: "Dodson",
    authorDate: "Dodson et al. (2024)",
    fullCitation: "Dodson, W., et al. (2024). Rejection Sensitive Dysphoria — case studies.",
    tag: "Descriptive/qualitative"
  },
  {
    id: "kaufman-1974",
    surname: "Kaufman",
    authorDate: "Kaufman (1974)",
    fullCitation: "Kaufman, G. (1974). The shame spiral. Journal of Counseling Psychology.",
    tag: "Theoretical"
  },
  {
    id: "neff-2003",
    surname: "Neff",
    authorDate: "Neff (2003)",
    fullCitation: "Neff, K. D. (2003a). The development and validation of a scale to measure self-compassion. Self and Identity, 2, 223–250. Neff, K. D. (2003b). Self-compassion: An alternative conceptualization of a healthy attitude toward oneself. Self and Identity, 2, 85–102.",
    tag: "Theoretical"
  },
  {
    id: "neff-germer-2013",
    surname: "Neff",
    authorDate: "Neff & Germer (2013)",
    fullCitation: "Neff, K. D., & Germer, C. K. (2013). A pilot study and randomized controlled trial of the Mindful Self-Compassion program. Journal of Clinical Psychology, 69(1), 28–44.",
    tag: "Causal"
  },
  {
    id: "sandland-2025",
    surname: "Sandland",
    authorDate: "Sandland (2025)",
    fullCitation: "Sandland, (2025). Rejection Sensitive Dysphoria in neurodivergent adults — qualitative study of 7 participants.",
    tag: "Descriptive/qualitative"
  },
  {
    id: "tangney",
    surname: "Tangney",
    authorDate: "Tangney et al.",
    fullCitation: "Tangney, J. P., et al. Shame vs. guilt — attributional and self-report framework.",
    tag: "Correlational"
  }
]);

const shameFindings: ResearchFinding[] = [
  {
    id: "shame-and-self-compassion",
    segments: [
      t("Guilt and shame aren't the same thing, even though they can feel similar in the moment. Guilt is a judgment about one specific thing you did; shame is a judgment about who you are. Guilt tends to motivate repair; shame tends to motivate hiding "),
      c("tangney"),
      t(". Hold's language is built to stay on the guilt side of that line, since narrating someone's character back to them, even kindly, risks feeding the withdrawal shame produces rather than easing it. Brené Brown's Shame Resilience Theory names reaching out and speaking the feeling out loud as two of the concrete ways through shame, not just around it "),
      c("brown-2006"),
      t(". Hold's Transition screen draws on a related, more clinically tested exercise, the Self-Compassion Break, built around naming the feeling, recognising it as something other people go through too, and offering yourself the same kindness you'd offer someone else "),
      c("neff-2003"),
      t("; "),
      c("neff-germer-2013"),
      t(".")
    ]
  },
  {
    id: "the-shame-spiral",
    segments: [
      t("A triggering event leads to shame feelings that \"flow in a circle, endlessly triggering each other\" "),
      c("kaufman-1974"),
      t(" — a real academic origin, though most further elaboration available today is wellness-blog content rather than peer-reviewed research, so detailed staged models beyond the original concept should be treated as illustrative rather than clinically validated. The core pattern — shame triggering more shame, making withdrawal self-reinforcing — is the mechanism Hold's guilt-not-shame voice choices are built to interrupt.")
    ]
  },
  {
    id: "adhd-rsd",
    segments: [
      t("Rejection Sensitive Dysphoria (RSD) isn't a formal diagnosis, but is a growing, real research area "),
      c("dodson-2024"),
      t("; "),
      c("sandland-2025"),
      t(", described as episodic, intense shame and feeling ostracised triggered by perceived or actual rejection or criticism, frequently leading to self-silencing or avoidance — the same withdrawal signature as the general shame spiral above. This is consistent with Hold's diagnosis-agnostic design, informed by but not built around any one condition: RSD's withdrawal pattern is a plausible mechanism behind some people's communication freeze, alongside every other reason capacity can drop, not a separate feature or a separate page of its own.")
    ]
  }
];

export const SHAME_PAGE: ResearchPage = {
  slug: "shame-guilt-rejection",
  title: "Shame, guilt, self-compassion & rejection sensitivity",
  intro: "Why Hold's language draws a hard line between guilt and shame, and what the research says about what actually helps on the shame side of that line.",
  findings: shameFindings,
  references: shameReferences
};

// ============================================================
// PAGE 4 — Being unwell & feeling like a burden
// ============================================================
const burdenReferences: ResearchReference[] = sortedReferences([
  {
    id: "moensted-2023",
    surname: "Moensted",
    authorDate: "Moensted et al. (2023)",
    fullCitation: "Moensted, M. L., et al. (2023). Friendship, loneliness and chronic illness: a qualitative study. SSM – Qualitative Research in Health.",
    tag: "Descriptive/qualitative"
  },
  {
    id: "odonnell-2022",
    surname: "O'Donnell",
    authorDate: "O'Donnell et al. (2022)",
    fullCitation: "O'Donnell, et al. (2022). Internalized stigma and illness self-concept in concealable chronic illness. British Journal of Health Psychology.",
    tag: "Correlational"
  },
  {
    id: "ogden-2024",
    surname: "Ogden",
    authorDate: "Ogden et al. (2024)",
    fullCitation: "Ogden, et al. (2024). Time perception distortion in chronic pain. European Journal of Pain. DOI: 10.1002/ejp.2211",
    tag: "Correlational"
  },
  {
    id: "wilson-2017",
    surname: "Wilson",
    authorDate: "Wilson, Kowal, Caird, Castillo, McWilliams & Heenan (2017)",
    fullCitation: "Wilson, K. G., Kowal, J., Caird, S., Castillo, D., McWilliams, L. A., & Heenan, A. (2017). Self-perceived burden in chronic pain. Canadian Journal of Pain.",
    tag: "Correlational"
  }
]);

const burdenFindings: ResearchFinding[] = [
  {
    id: "self-perceived-burden",
    segments: [
      t("\"Being a burden to others\" is a recognised, studied source of guilt and distress in chronic pain and illness research, not an unusual or exaggerated fear "),
      c("wilson-2017"),
      t(". Naming the specific fear behind so much of the guilt around going quiet is exactly what Hold's reassurance copy is designed to counter, distinct from general guilt about not replying.")
    ]
  },
  {
    id: "friendship-navigation",
    segments: [
      t("Interviews with chronically ill people experiencing loneliness found that maintaining friendship required significant \"personal labour\" — an ongoing negotiation between concealment and authenticity to preserve social dignity "),
      c("moensted-2023"),
      t(". That labour of managing what to disclose, and when, is exactly the labour Hold is trying to reduce at the point of going quiet or reconnecting.")
    ]
  },
  {
    id: "denial-self-esteem",
    segments: [
      t("Internalised and anticipated stigma is positively associated with illness becoming a preoccupying part of someone's self-concept, in conditions that can be concealed "),
      c("odonnell-2022"),
      t(". This is part of why Hold never asks someone to explain or justify a quiet period — the less pressure there is to account for what's happening, the less illness has to become the whole story of who someone is.")
    ]
  },
  {
    id: "time-perception-chronic-pain",
    segments: [
      t("People with chronic pain associate distortions in their own sense of time passing with increased negative affect and greater impairment — notably situation-specific, not reliably tied to depression or anxiety scores in the numbers, even though people's own accounts consistently linked it to feeling worse "),
      c("ogden-2024"),
      t(". This supports allowing \"I don't know\" and no fixed end date for a quiet period — time can genuinely feel distorted during the exact periods Hold is designed for.")
    ]
  }
];

export const BURDEN_PAGE: ResearchPage = {
  slug: "burden",
  title: "Being unwell & feeling like a burden",
  intro: "Research on what it actually costs to manage friendships and self-image while chronically unwell, and why Hold is built to lower that cost rather than add to it.",
  findings: burdenFindings,
  references: burdenReferences
};

// ============================================================
// PAGE 5 — Low energy & getting things done
// ============================================================
const lowEnergyReferences: ResearchReference[] = sortedReferences([
  {
    id: "gollwitzer-sheeran-2006",
    surname: "Gollwitzer",
    authorDate: "Gollwitzer & Sheeran (2006)",
    fullCitation: "Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. Advances in Experimental Social Psychology.",
    tag: "Meta-analysis, mixed designs"
  },
  {
    id: "hibbard-2004",
    surname: "Hibbard",
    authorDate: "Hibbard, Stockard, Mahoney & Tusler (2004)",
    fullCitation: "Hibbard, J. H., Stockard, J., Mahoney, E. R., & Tusler, M. (2004). Development of the Patient Activation Measure (PAM). Health Services Research, 39(4 Pt 1), 1005–1026. DOI: 10.1111/j.1475-6773.2004.00269.x",
    tag: "Correlational"
  },
  {
    id: "lally-2010",
    surname: "Lally",
    authorDate: "Lally, van Jaarsveld, Potts & Wardle (2010)",
    fullCitation: "Lally, P., van Jaarsveld, C. H. M., Potts, H. W. W., & Wardle, J. (2010). How are habits formed: Modelling habit formation in the real world. European Journal of Social Psychology. DOI: 10.1002/ejsp.674",
    tag: "Correlational"
  },
  {
    id: "masicampo-baumeister-2011",
    surname: "Masicampo",
    authorDate: "Masicampo & Baumeister (2011)",
    fullCitation: "Masicampo, E. J., & Baumeister, R. F. (2011). Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals. Journal of Personality and Social Psychology. DOI: 10.1037/a0024192",
    tag: "Causal"
  },
  {
    id: "ng-2012",
    surname: "Ng",
    authorDate: "Ng et al. (2012)",
    fullCitation: "Ng, J. Y. Y., Ntoumanis, N., Thøgersen-Ntoumani, C., Deci, E. L., Ryan, R. M., Duda, J. L., & Williams, G. C. (2012). Self-Determination Theory Applied to Health Contexts: A Meta-Analysis. Perspectives on Psychological Science, 7(4), 325–340. DOI: 10.1177/1745691612447309",
    tag: "Correlational"
  },
  {
    id: "ntoumanis-2021",
    surname: "Ntoumanis",
    authorDate: "Ntoumanis et al. (2021)",
    fullCitation: "Ntoumanis, N., Ng, J. Y. Y., Prestwich, A., Quested, E., Hancox, J. E., Thøgersen-Ntoumani, C., Deci, E. L., Ryan, R. M., Lonsdale, C., & Williams, G. C. (2021). A meta-analysis of self-determination theory-informed intervention studies in the health domain. Health Psychology Review, 15(2), 214–244.",
    tag: "Causal"
  },
  {
    id: "sirois-2014",
    surname: "Sirois",
    authorDate: "Sirois (2014)",
    fullCitation: "Sirois, F. M. (2014). Procrastination and stress: Exploring the role of self-compassion. Self and Identity, 13(2), 128–145.",
    tag: "Correlational"
  },
  {
    id: "sirois-2015",
    surname: "Sirois",
    authorDate: "Sirois, Molnar & Hirsch (2015)",
    fullCitation: "Sirois, F. M., Molnar, D. S., & Hirsch, J. K. (2015). Self-compassion, stress and coping in the context of chronic illness. Self and Identity, 14, 334–347.",
    tag: "Correlational"
  }
]);

const lowEnergyFindings: ResearchFinding[] = [
  {
    id: "habit-formation",
    segments: [
      t("In a real-world habit-formation study, time to reach near-full automaticity ranged from 18 to 254 days, with huge individual variation. Critically: missing a single opportunity did not materially disrupt the habit-formation process "),
      c("lally-2010"),
      t(". The finding that missing a day doesn't break it is directly relevant to Hold's no-streaks, no-guilt design — evidence for a decision already made, not a new one.")
    ]
  },
  {
    id: "plan-making-zeigarnik",
    segments: [
      t("Unfinished goals cause intrusive thoughts and reduced performance on unrelated tasks; forming a specific plan eliminated this effect, but only when the plan was genuine enough to be later executed — a vague or unwritten \"plan,\" like drafting a reply mentally, doesn't provide real closure "),
      c("masicampo-baumeister-2011"),
      t(". Separately, specific \"if-then\" implementation intentions — concrete when/where/how plans — had a medium-to-large effect on actually following through, replicated across hundreds of tests "),
      c("gollwitzer-sheeran-2006"),
      t(". Together these support the value of Hold's structured, specific flows — a real plan: who, roughly what, via which route — over an open-ended \"I'll reach out at some point\" intention, and are a caution that a half-finished draft saved without being sent may not provide the closure a fully sent one would.")
    ]
  },
  {
    id: "perfectionism-procrastination",
    segments: [
      t("Guilt and self-criticism are what maintain procrastination, not what interrupt it — low self-compassion predicts both more procrastination and more stress from it "),
      c("sirois-2014"),
      t(", a relationship that extends specifically to a chronic-illness population "),
      c("sirois-2015"),
      t(". This supports \"never imply failure\" and the broader no-guilt voice rules throughout Hold — guilt-based framing is the thing this research says keeps people stuck, not the thing that motivates them to act.")
    ]
  },
  {
    id: "patient-activation",
    segments: [
      t("The foundational, most-cited paper defining and measuring \"patient activation\" — a person's own knowledge, skill and confidence in managing their health "),
      c("hibbard-2004"),
      t(" — underpins the idea that confidence and capability, not just information, determine whether someone follows through on managing their own situation, including something as small as sending a message.")
    ]
  },
  {
    id: "autonomy-support-sdt",
    segments: [
      t("Across 184 independent datasets, when the people supporting someone's health respect their autonomy rather than prescribing to them, it correlates with better psychological need satisfaction, which in turn correlates with better mental and physical health outcomes "),
      c("ng-2012"),
      t(". A later meta-analysis of 73 experimental studies found autonomy-supportive interventions have real, if modest and varied, effects on motivation and follow-through "),
      c("ntoumanis-2021"),
      t(". This is the same instinct behind Hold's own \"invitation, not obligation\" register — offering rather than prescribing is the autonomy-supportive framing this literature studies, and the same thing that makes a person more likely to actually follow through, not just feel better about not following through.")
    ]
  }
];

export const LOW_ENERGY_PAGE: ResearchPage = {
  slug: "low-energy",
  title: "Low energy & getting things done",
  intro: "What actually helps someone follow through on a small, difficult task when energy and motivation are both in short supply — and what doesn't.",
  findings: lowEnergyFindings,
  references: lowEnergyReferences
};

// ============================================================
// PAGE 6 — Mood, colour & environment
// ============================================================
const moodReferences: ResearchReference[] = sortedReferences([
  {
    id: "bast",
    surname: "British Academy of Sound Therapy",
    authorDate: "sound-therapy practitioner sources (e.g. the British Academy of Sound Therapy)",
    fullCitation: "British Academy of Sound Therapy (BAST), London/Monmouth — practitioner/training organisation, founded 2000, not a peer-reviewed research body.",
    tag: "Practitioner-driven, not peer-reviewed"
  },
  {
    id: "jonauskaite-mohr",
    surname: "Jonauskaite",
    authorDate: "Jonauskaite & Mohr",
    fullCitation: "Jonauskaite, D., & Mohr, C. Systematic review of colour-emotion associations. Psychonomic Bulletin & Review. (132 studies, 42,266 participants, 64 countries, 1895–2022.)",
    tag: "Correlational"
  },
  {
    id: "saarikallio",
    surname: "Saarikallio",
    authorDate: "Saarikallio",
    fullCitation: "Saarikallio, S. Body of work on music as active emotion-regulation and coping, adolescence to late adulthood.",
    tag: "Theoretical"
  }
]);

const moodFindings: ResearchFinding[] = [
  {
    id: "colour-mood",
    segments: [
      t("A systematic review spanning 132 peer-reviewed studies, over 42,000 participants and 64 countries found colour-emotion associations are driven mainly by lightness and chroma, not hue — lighter, higher-chroma colours read as happier, darker and lower-chroma read as sadder "),
      c("jonauskaite-mohr"),
      t(". This is relevant context for Hold's existing palette choices: lightness and chroma, not hue alone, are the more evidenced lever for the emotional tone a colour scheme carries.")
    ]
  },
  {
    id: "music-emotion-regulation",
    segments: [
      t("There's a well-established body of research on music as an active emotion-regulation and coping strategy across the lifespan "),
      c("saarikallio"),
      t(". Two further claims sometimes made about music are more mixed: whether listening measurably lowers physiological stress markers like cortisol and heart rate is genuinely contested, with different meta-analyses reaching different conclusions, while music's role as a \"social surrogate\" that reduces felt loneliness has real experimental and qualitative support behind it. If a future music or playlist feature is ever built, the emotion-regulation and loneliness findings support general music-listening as a plausible category — the contested physiological-stress claim shouldn't be used as a specific promised benefit.")
    ]
  },
  {
    id: "sound-frequency-somatic",
    segments: [
      t("Claims that specific sound frequencies directly affect the vagus nerve or nervous system are sourced mainly from sound-therapy practitioner and training organisations "),
      c("bast"),
      t(", not from peer-reviewed consensus. This is included here because it circulates widely, but it needs its own, separately-flagged confidence level from the general music-listening research above — the two evidence bases are not equivalent, and shouldn't be presented with the same weight.")
    ]
  }
];

export const MOOD_PAGE: ResearchPage = {
  slug: "mood-colour-environment",
  title: "Mood, colour & environment",
  intro: "What the evidence actually supports about how colour and sound relate to mood — including where the evidence runs out.",
  findings: moodFindings,
  references: moodReferences
};

export const RESEARCH_PAGES: ResearchPage[] = [
  REACHING_OUT_PAGE,
  CONNECTION_PAGE,
  SHAME_PAGE,
  BURDEN_PAGE,
  LOW_ENERGY_PAGE,
  MOOD_PAGE
];

export function getResearchPage(slug: string): ResearchPage | undefined {
  return RESEARCH_PAGES.find((page) => page.slug === slug);
}

/** Which page a given finding id lives on — powers CitationMarker's navigation target. */
export function findPageForFinding(findingId: string): ResearchPage | undefined {
  return RESEARCH_PAGES.find((page) => page.findings.some((finding) => finding.id === findingId));
}

/** Page + finding together, for the index's "hidden findings" list, which needs both. */
export function findFindingWithPage(findingId: string): { page: ResearchPage; finding: ResearchFinding } | undefined {
  for (const page of RESEARCH_PAGES) {
    const finding = page.findings.find((candidate) => candidate.id === findingId);
    if (finding) return { page, finding };
  }
  return undefined;
}

/** Plain-text rendering of a page (title + every finding's text, citations inline) — used by the share button. */
export function pageToPlainText(page: ResearchPage): string {
  const body = page.findings
    .map((finding) =>
      finding.segments
        .map((segment) => {
          if (segment.type === "text") return segment.text;
          const reference = page.references.find((candidate) => candidate.id === segment.refId);
          return reference ? reference.authorDate : "";
        })
        .join("")
    )
    .join("\n\n");
  return `${page.title}\n\n${body}`;
}
