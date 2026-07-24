import { StyleSheet, View } from "react-native";
import { theme } from "@/constants/theme";

interface HistoryIconProps {
  size?: number;
}

/** CSS-only placeholder "history" glyph: a simple clock face. */
export function HistoryIcon({ size = 20 }: HistoryIconProps) {
  const hourHand = size * 0.26;
  const minuteHand = size * 0.36;

  return (
    <View
      accessibilityElementsHidden
      style={[
        styles.face,
        { width: size, height: size, borderRadius: size / 2 }
      ]}
    >
      <View style={styles.handWrapper}>
        <View
          style={[
            styles.hand,
            { height: hourHand, marginTop: size / 2 - hourHand }
          ]}
        />
      </View>
      <View style={[styles.handWrapper, styles.minuteWrapper]}>
        <View
          style={[
            styles.hand,
            { height: minuteHand, marginTop: size / 2 - minuteHand }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    borderWidth: 1.5,
    borderColor: theme.colors.text
  },
  handWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center"
  },
  minuteWrapper: {
    transform: [{ rotate: "90deg" }]
  },
  hand: {
    width: 1.5,
    backgroundColor: theme.colors.text,
    borderRadius: 1
  }
});
