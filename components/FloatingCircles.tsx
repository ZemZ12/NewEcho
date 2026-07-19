import { useWindowDimensions, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

type Circle = { x: number; y: number; vx: number; vy: number; r: number; opacity: number };

const RADII = [70, 92, 56, 108, 48, 78];
const OPACITIES = [0.16, 0.1, 0.2, 0.08, 0.18, 0.13];
const SPEED = 16; // px/sec

function initialCircles(width: number, height: number): Circle[] {
  return RADII.map((r, i) => {
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * Math.max(width - r * 2, 1) + r,
      y: Math.random() * Math.max(height - r * 2, 1) + r,
      vx: Math.cos(angle) * SPEED,
      vy: Math.sin(angle) * SPEED,
      r,
      opacity: OPACITIES[i],
    };
  });
}

function CircleView({ circles, index }: { circles: SharedValue<Circle[]>; index: number }) {
  const style = useAnimatedStyle(() => {
    const c = circles.value[index];
    return {
      position: 'absolute',
      width: c.r * 2,
      height: c.r * 2,
      borderRadius: c.r,
      backgroundColor: '#6366f1',
      opacity: c.opacity,
      transform: [{ translateX: c.x - c.r }, { translateY: c.y - c.r }],
    };
  });
  return <Animated.View style={style} />;
}

// Ambient background decoration: a handful of soft accent-colored circles
// that drift around and bounce elastically off each other and the screen
// edges, simulated frame-by-frame on the UI thread.
export function FloatingCircles() {
  const { width, height } = useWindowDimensions();
  const circles = useSharedValue<Circle[]>(initialCircles(width, height));

  useFrameCallback((frame) => {
    'worklet';
    const dt = Math.min((frame.timeSincePreviousFrame ?? 16) / 1000, 0.05);
    const items = circles.value;

    for (const c of items) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.x - c.r < 0) {
        c.x = c.r;
        c.vx = Math.abs(c.vx);
      } else if (c.x + c.r > width) {
        c.x = width - c.r;
        c.vx = -Math.abs(c.vx);
      }
      if (c.y - c.r < 0) {
        c.y = c.r;
        c.vy = Math.abs(c.vy);
      } else if (c.y + c.r > height) {
        c.y = height - c.r;
        c.vy = -Math.abs(c.vy);
      }
    }

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const minDist = a.r + b.r;
        if (dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          // Elastic collision impulse along the collision normal (equal mass).
          const avn = a.vx * nx + a.vy * ny;
          const bvn = b.vx * nx + b.vy * ny;
          a.vx += (bvn - avn) * nx;
          a.vy += (bvn - avn) * ny;
          b.vx += (avn - bvn) * nx;
          b.vy += (avn - bvn) * ny;
        }
      }
    }

    circles.value = [...items];
  });

  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
      {RADII.map((_, i) => (
        <CircleView key={i} circles={circles} index={i} />
      ))}
    </View>
  );
}
