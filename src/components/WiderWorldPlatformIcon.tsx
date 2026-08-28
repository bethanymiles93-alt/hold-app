import { Ionicons, FontAwesome6 } from "@expo/vector-icons";
import type { WiderWorldPresetPlatform } from "@/constants/widerWorldPresets";

interface WiderWorldPlatformIconProps {
  icon: WiderWorldPresetPlatform["icon"];
  size: number;
  color: string;
}

/**
 * Renders whichever bundled icon family a preset names — no icon prop
 * means the platform (e.g. Substack) has no bundled brand glyph available,
 * text-only, per the fallback rule; callers should just not render this
 * component in that case rather than pass an empty icon.
 */
export function WiderWorldPlatformIcon({ icon, size, color }: WiderWorldPlatformIconProps) {
  if (!icon) return null;

  if (icon.family === "fa6") {
    return <FontAwesome6 name={icon.name} brand size={size} color={color} />;
  }

  return <Ionicons name={icon.name as never} size={size} color={color} />;
}
