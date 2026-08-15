import { Gesture } from 'react-native-gesture-handler';
import {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const RUBBER_BAND_FACTOR = 0.03;

// Android's FlatList/FlashList have no native elastic bounce (that's
// iOS-only), so it's built by hand — a Pan gesture runs alongside the
// list's own native scrolling (via Gesture.Native()) and only nudges the
// list past its scroll bounds while the drag continues beyond the
// top/bottom edge, springing back on release.
export function useRubberBandList() {
  const listRef = useAnimatedRef<any>();
  const scrollY = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const layoutHeight = useSharedValue(0);
  const bounceY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      const maxScroll = Math.max(0, contentHeight.value - layoutHeight.value);
      const atTop = scrollY.value <= 0;
      const atBottom = scrollY.value >= maxScroll;
      if (atTop && event.translationY > 0) {
        bounceY.value = event.translationY * RUBBER_BAND_FACTOR;
      } else if (atBottom && event.translationY < 0) {
        bounceY.value = event.translationY * RUBBER_BAND_FACTOR;
      } else {
        bounceY.value = 0;
      }
    })
    .onEnd(() => {
      bounceY.value = withSpring(0, { damping: 30, stiffness: 110 });
    });
  const gesture = Gesture.Simultaneous(pan, Gesture.Native());

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounceY.value }],
  }));

  function onContentSizeChange(_width: number, height: number) {
    contentHeight.value = height;
  }

  function onLayout(event: { nativeEvent: { layout: { height: number } } }) {
    layoutHeight.value = event.nativeEvent.layout.height;
  }

  return { listRef, gesture, bounceStyle, onScroll, onContentSizeChange, onLayout };
}
