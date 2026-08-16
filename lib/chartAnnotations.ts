import firestore, { type FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

import type { StockRange } from './marketData';

// Coordinates are normalized 0-1 relative to the chart's own width/height,
// so a shape drawn on one device's chart still lines up on another's
// regardless of screen size. Scoped by range too, since a line's position
// only makes sense against the timeframe of candles it was drawn on.
export type LineShape = {
  id: string;
  type: 'line';
  channelId: string;
  symbol: string;
  range: StockRange;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  createdBy: string;
  createdAt: FirebaseFirestoreTypes.Timestamp | null;
};

export type NoteShape = {
  id: string;
  type: 'note';
  channelId: string;
  symbol: string;
  range: StockRange;
  x: number;
  y: number;
  text: string;
  color: string;
  createdBy: string;
  createdAt: FirebaseFirestoreTypes.Timestamp | null;
};

export type ChartShape = LineShape | NoteShape;

export function subscribeToChartShapes(
  channelId: string,
  symbol: string,
  range: StockRange,
  onNext: (shapes: ChartShape[]) => void,
  onError?: (error: Error) => void,
) {
  return firestore()
    .collection('chartShapes')
    .where('channelId', '==', channelId)
    .where('symbol', '==', symbol)
    .where('range', '==', range)
    .onSnapshot(
      (snapshot) => {
        onNext(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ChartShape));
      },
      (err) => onError?.(err),
    );
}

export async function addLineShape(params: {
  channelId: string;
  symbol: string;
  range: StockRange;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  createdBy: string;
}): Promise<string> {
  const doc = await firestore()
    .collection('chartShapes')
    .add({ type: 'line', ...params, createdAt: firestore.FieldValue.serverTimestamp() });
  return doc.id;
}

export async function addNoteShape(params: {
  channelId: string;
  symbol: string;
  range: StockRange;
  x: number;
  y: number;
  text: string;
  color: string;
  createdBy: string;
}): Promise<string> {
  const doc = await firestore()
    .collection('chartShapes')
    .add({ type: 'note', ...params, createdAt: firestore.FieldValue.serverTimestamp() });
  return doc.id;
}

export async function deleteChartShape(shapeId: string): Promise<void> {
  await firestore().collection('chartShapes').doc(shapeId).delete();
}
