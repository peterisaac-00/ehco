import Svg, { Circle } from "react-native-svg";
import { Image, StyleSheet, Text, View } from "react-native";

const QUIZ_SCENE_URL = "/manus-storage/ehco-quiz-learning-scene_45df277b.png";

const COLORS = {
  ivory: "#FDF9F4",
  cream: "#F7EDE0",
  forest: "#254631",
  sage: "#8EA18A",
  border: "#E9DFD3",
} as const;

/** A quiet shared Ehco learning scene used without exposing quiz data. */
export function QuizLifestyleScene({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.sceneFrame, compact && styles.sceneCompact]}>
      <Image source={{ uri: QUIZ_SCENE_URL }} resizeMode="cover" style={styles.sceneImage} />
      <View pointerEvents="none" style={styles.sceneOverlay} />
      <View pointerEvents="none" style={styles.botanicalStem} />
      <View pointerEvents="none" style={[styles.botanicalLeaf, styles.botanicalLeafOne]} />
      <View pointerEvents="none" style={[styles.botanicalLeaf, styles.botanicalLeafTwo]} />
    </View>
  );
}

/** A server-score-only visual ring. It does not calculate grading or reveal answer keys. */
export function QuizScoreRing({ score }: { score: number }) {
  const size = 132;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - safeScore / 100);

  return (
    <View style={styles.scoreRing} accessibilityLabel={`نتيجة الاختبار ${safeScore}%`}>
      <Svg width={size} height={size} style={styles.scoreSvg}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={COLORS.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.forest}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.scoreCenter}>
        <Text style={styles.scoreValue}>{safeScore}%</Text>
        <Text style={styles.scoreCaption}>نتيجة الاختبار</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sceneFrame: { height: 116, overflow: "hidden", borderRadius: 20, backgroundColor: COLORS.cream, marginBottom: 4 },
  sceneCompact: { height: 92, width: "100%" },
  sceneImage: { width: "100%", height: "100%", opacity: 0.88 },
  sceneOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(253,249,244,0.14)" },
  botanicalStem: { position: "absolute", bottom: -14, left: 30, width: 3, height: 58, backgroundColor: COLORS.forest, borderRadius: 4, transform: [{ rotate: "-14deg" }] },
  botanicalLeaf: { position: "absolute", width: 20, height: 10, backgroundColor: COLORS.sage, borderRadius: 16 },
  botanicalLeafOne: { bottom: 29, left: 13, transform: [{ rotate: "-28deg" }] },
  botanicalLeafTwo: { bottom: 42, left: 30, transform: [{ rotate: "28deg" }] },
  scoreRing: { width: 132, height: 132, alignItems: "center", justifyContent: "center" },
  scoreSvg: { position: "absolute" },
  scoreCenter: { alignItems: "center", gap: 0 },
  scoreValue: { color: COLORS.forest, fontSize: 34, fontWeight: "800" },
  scoreCaption: { color: "#506452", fontSize: 11, fontWeight: "700" },
});
