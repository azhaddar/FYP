import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

const C = {
  o: '#2d1f20',           // dark brown outline
  p: '#e694a4',           // pink body
  w: '#ffffff',           // white
  d: '#c6577b',           // dark magenta wings
  s: 'rgba(0,0,0,0.15)', // shadow
} as const;

type Col = keyof typeof C;

// [x, y, width, color]  — all heights are 1 grid unit
type Px = [number, number, number, Col];

const FEET: Px[] = [
  [2, 20, 11, 's'],
  [2, 18,  2, 'o'], [4, 18, 2, 'p'], [6, 18, 1, 'o'],
  [7, 18,  1, 'o'], [8, 18, 2, 'p'], [10, 18, 2, 'o'],
  [3, 19,  2, 'o'], [8, 19, 2, 'o'],
];

const BODY: Px[] = [
  // y=1 – ears
  [4,1,1,'o'],[11,1,1,'o'],
  // y=2
  [3,2,1,'o'],[4,2,1,'p'],[5,2,1,'o'],[11,2,1,'o'],[12,2,1,'p'],[13,2,1,'o'],
  // y=3
  [3,3,1,'o'],[4,3,1,'p'],[5,3,1,'o'],[10,3,1,'o'],[11,3,1,'p'],[12,3,1,'o'],
  // y=4
  [3,4,1,'o'],[4,4,2,'p'],[6,4,1,'o'],[9,4,1,'o'],[10,4,2,'p'],[12,4,1,'o'],
  // y=5
  [4,5,1,'o'],[5,5,6,'p'],[11,5,1,'o'],
  // y=6
  [4,6,1,'o'],[5,6,7,'p'],[12,6,1,'o'],
  // y=7 – eyes
  [3,7,1,'o'],[4,7,1,'p'],[5,7,3,'o'],
  [8,7,3,'p'],[11,7,1,'w'],[12,7,1,'p'],[13,7,1,'o'],
  // y=8
  [3,8,1,'o'],[4,8,1,'p'],[5,8,1,'o'],[6,8,1,'w'],[7,8,1,'o'],
  [8,8,2,'p'],[10,8,3,'w'],[13,8,1,'o'],
  // y=9
  [4,9,1,'o'],[5,9,1,'p'],[6,9,3,'o'],
  [9,9,1,'p'],[10,9,3,'w'],[13,9,1,'o'],
  // y=10
  [4,10,1,'o'],[5,10,2,'p'],[7,10,7,'o'],
  // y=11 – wing start
  [2,11,1,'o'],[3,11,1,'d'],[4,11,1,'o'],
  [5,11,7,'p'],[12,11,1,'o'],[13,11,1,'d'],[14,11,1,'o'],
  // y=12
  [1,12,1,'o'],[2,12,2,'d'],[4,12,1,'o'],
  [5,12,1,'p'],[6,12,3,'w'],[9,12,2,'p'],
  [11,12,1,'o'],[12,12,2,'d'],[14,12,1,'o'],
  // y=13
  [1,13,1,'o'],[2,13,3,'d'],[5,13,1,'o'],
  [6,13,4,'w'],[10,13,1,'p'],
  [11,13,1,'o'],[12,13,2,'d'],[14,13,1,'o'],
  // y=14
  [2,14,1,'o'],[3,14,2,'d'],[5,14,1,'o'],
  [6,14,1,'p'],[7,14,3,'w'],[10,14,1,'p'],
  [11,14,1,'o'],[12,14,1,'d'],[13,14,1,'o'],
  // y=15
  [2,15,3,'o'],[5,15,5,'p'],[10,15,2,'o'],
  // y=16
  [1,16,2,'o'],[3,16,7,'p'],[10,16,1,'o'],
  // y=17
  [3,17,2,'p'],[8,17,2,'p'],
];

interface Props {
  /** dp per grid unit — default 8 gives a 128×176dp sprite */
  scale?: number;
}

export function PixelMonster({ scale = 8 }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 3, duration: 700, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const W = 16 * scale;
  const H = 22 * scale;

  return (
    <View style={{ width: W, height: H }}>
      {/* Static feet */}
      {FEET.map(([x, y, w, c], i) => (
        <View
          key={`f${i}`}
          style={{
            position: 'absolute',
            left: x * scale, top: y * scale,
            width: w * scale, height: scale,
            backgroundColor: C[c],
          }}
        />
      ))}

      {/* Breathing body — explicit dimensions so the View doesn't collapse */}
      <Animated.View
        style={{
          position: 'absolute',
          width: W,
          height: H,
          transform: [{ translateY: anim }],
        }}
      >
        {BODY.map(([x, y, w, c], i) => (
          <View
            key={`b${i}`}
            style={{
              position: 'absolute',
              left: x * scale, top: y * scale,
              width: w * scale, height: scale,
              backgroundColor: C[c],
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}
