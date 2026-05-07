import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Canvas, Path, Rect, Skia, SkPath,
  useCanvasRef, ImageFormat,
} from '@shopify/react-native-skia';
import { decode } from 'base64-arraybuffer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { useApp } from '../../contexts/AppContext';
import { C, SHADOW } from '../../constants/theme';

type DrawPath = { path: SkPath; lightPath?: SkPath; midPath?: SkPath; color: string; lightColor?: string; midColor?: string; hexColor: string; width: number; cap: 'round' | 'square'; tool: Tool };
type Point = { x: number; y: number };
type Tool = 'pencil' | 'crayon' | 'thick' | 'eraser';

function jitter(v: number, amount: number): number {
  return v + (Math.random() - 0.5) * amount;
}

const COLORS = [
  '#1a1a1a', '#6b7280', '#ffffff',
  '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#3b82f6',
  '#8b5cf6', '#ec4899', '#f43f5e',
  '#a16207', '#84cc16', '#06b6d4',
  '#6366f1',
];

const BG_OPTIONS = [
  { color: '#FFFFFF', label: 'White' },
  { color: '#FFFBEB', label: 'Cream' },
  { color: '#F0F9FF', label: 'Sky' },
  { color: '#1C1C2E', label: 'Night' },
];

const BRUSH_SIZES = [3, 6, 10, 16, 24];

const PROMPT_LABEL: Record<string, string> = {
  self: 'Draw Yourself',
  house: 'Draw Your House',
};

// Pencil 3-layer graphite brush
const PENCIL_STEP_PX = 1.5;
const PENCIL_DOTS_LIGHT = 7;
const PENCIL_DOTS_MID = 13;
const PENCIL_DOTS_DARK = 5;
const PENCIL_BRUSH_MUL = 0.62;
const PENCIL_ALPHA_LIGHT = 0.10;
const PENCIL_ALPHA_MID = 0.35;
const PENCIL_ALPHA_DARK = 0.70;
const PENCIL_DOT_MAX_R = 1.4;
const PENCIL_JITTER = 1.5;

const MAX_ZOOM = 4;

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function DrawScreen() {
  const { activeChild } = useApp();
  const router = useRouter();
  const { promptType, preMood } = useLocalSearchParams<{ promptType: string; preMood: string }>();
  const canvasRef = useCanvasRef();
  const canvasSize = useRef({ width: 0, height: 0 });
  const [canvasReady, setCanvasReady] = useState(false);

  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [redoStack, setRedoStack] = useState<DrawPath[]>([]);
  const [livePath, setLivePath] = useState<SkPath | null>(null);
  const [liveMidPath, setLiveMidPath] = useState<SkPath | null>(null);
  const [liveLightPath, setLiveLightPath] = useState<SkPath | null>(null);
  const livePathRef = useRef<SkPath | null>(null);
  const liveMidPathRef = useRef<SkPath | null>(null);
  const liveLightPathRef = useRef<SkPath | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const lastPointTimeRef = useRef<number>(0);

  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedSize, setSelectedSize] = useState(BRUSH_SIZES[1]);
  const [tool, setTool] = useState<Tool>('pencil');
  const [bgColor, setBgColor] = useState(BG_OPTIONS[1].color);
  const [analyzing, setAnalyzing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(true);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);

  // Zoom / pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Stable refs for gestures (always up-to-date without closure staleness)
  const colorRef = useRef(selectedColor);
  const sizeRef = useRef(selectedSize);
  const toolRef = useRef<Tool>('pencil');
  const bgColorRef = useRef(bgColor);
  const zoomRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  // Base values captured at gesture start
  const baseZoomRef = useRef(1);
  const basePanXRef = useRef(0);
  const basePanYRef = useRef(0);

  colorRef.current = selectedColor;
  sizeRef.current = selectedSize;
  toolRef.current = tool;
  bgColorRef.current = bgColor;
  zoomRef.current = zoom;
  panXRef.current = panX;
  panYRef.current = panY;

  // ── Coordinate helpers ────────────────────────────────────────
  // RN applies transform array R→L: translateX is applied to the point first, then scale.
  // So: screen_x = S*(local_x + panX) + cx*(1-S)  →  local_x = (screen_x - cx)/S + cx - panX
  function toCanvas(ex: number, ey: number): Point {
    const S = zoomRef.current;
    const cx = canvasSize.current.width / 2;
    const cy = canvasSize.current.height / 2;
    return {
      x: (ex - cx) / S + cx - panXRef.current,
      y: (ey - cy) / S + cy - panYRef.current,
    };
  }

  function clampPan(px: number, py: number, S: number) {
    const w = canvasSize.current.width;
    const h = canvasSize.current.height;
    // Max pan so canvas edges never go inside the viewport
    const maxX = (w * (S - 1)) / (2 * S);
    const maxY = (h * (S - 1)) / (2 * S);
    return {
      x: Math.max(-maxX, Math.min(maxX, px)),
      y: Math.max(-maxY, Math.min(maxY, py)),
    };
  }

  // ── Stroke helpers ────────────────────────────────────────────
  function strokeColor() {
    if (toolRef.current === 'eraser') return bgColorRef.current;
    if (toolRef.current === 'thick') return hexToRgba(colorRef.current, 0.5);
    return hexToRgba(colorRef.current, 0.88);
  }
  function pencilLayerColors(hex: string) {
    return {
      light: hexToRgba(hex, PENCIL_ALPHA_LIGHT),
      mid:   hexToRgba(hex, PENCIL_ALPHA_MID),
      dark:  hexToRgba(hex, PENCIL_ALPHA_DARK),
    };
  }
  function strokeWidth() {
    if (toolRef.current === 'eraser') return sizeRef.current + 18;
    if (toolRef.current === 'thick') return sizeRef.current * 2.8;
    return sizeRef.current * 1.35;
  }
  function strokeCap(): 'round' | 'square' {
    return toolRef.current === 'thick' ? 'square' : 'round';
  }

  // 3-layer graphite stamp: light edge, mid body, dark core
  function stampPencilDots(
    pLight: SkPath, pMid: SkPath, pDark: SkPath,
    x0: number, y0: number, x1: number, y1: number,
    pressure: number = 1.0,
  ) {
    const brushR = sizeRef.current * PENCIL_BRUSH_MUL;
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const steps = Math.max(1, Math.ceil(dist / PENCIL_STEP_PX));
    for (let s = 0; s < steps; s++) {
      const t = steps === 1 ? 0.5 : s / (steps - 1);
      const cx = x0 + dx * t + (Math.random() - 0.5) * PENCIL_JITTER * 0.4;
      const cy = y0 + dy * t + (Math.random() - 0.5) * PENCIL_JITTER * 0.4;
      // Light edge layer — wide scatter, simulates paper grain / rough boundary
      const lightCount = Math.max(1, Math.round(PENCIL_DOTS_LIGHT * pressure));
      for (let d = 0; d < lightCount; d++) {
        const angle = Math.random() * Math.PI * 2;
        const r = (0.3 + Math.random() * 0.7) * brushR;
        const dotR = 0.15 + Math.random() * 0.55;
        if (Math.random() > 0.25) // paper resistance: skip some spots
          pLight.addCircle(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, dotR);
      }
      // Mid layer — r² distribution, main graphite body
      const midCount = Math.max(1, Math.round(PENCIL_DOTS_MID * pressure));
      for (let d = 0; d < midCount; d++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * Math.random() * brushR;
        const dotR = 0.25 + Math.random() * PENCIL_DOT_MAX_R;
        pMid.addCircle(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, dotR);
      }
      // Dark core — tight center, dense graphite
      const darkCount = Math.max(1, Math.round(PENCIL_DOTS_DARK * pressure));
      for (let d = 0; d < darkCount; d++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * Math.random() * brushR * 0.45;
        const dotR = 0.3 + Math.random() * (PENCIL_DOT_MAX_R * 0.9);
        pDark.addCircle(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, dotR);
      }
    }
  }

  // ── Drawing ────────────────────────────────────────────────────
  function beginStroke(x: number, y: number) {
    if (toolRef.current === 'pencil') {
      const pLight = Skia.Path.Make();
      const pMid   = Skia.Path.Make();
      const pDark  = Skia.Path.Make();
      stampPencilDots(pLight, pMid, pDark, x, y, x, y, 1.0);
      livePathRef.current      = pDark;
      liveMidPathRef.current   = pMid;
      liveLightPathRef.current = pLight;
      lastPointTimeRef.current = Date.now();
      setLivePath(pDark);
      setLiveMidPath(pMid);
      setLiveLightPath(pLight);
    } else {
      const p = Skia.Path.Make();
      p.moveTo(x, y);
      livePathRef.current = p;
      setLivePath(p);
    }
    lastPointRef.current = { x, y };
  }

  function continueStroke(x: number, y: number) {
    if (!livePathRef.current || !lastPointRef.current) return;
    const last = lastPointRef.current;

    if (toolRef.current === 'pencil') {
      const dx = x - last.x, dy = y - last.y;
      if (dx * dx + dy * dy < PENCIL_STEP_PX * PENCIL_STEP_PX) return;
      const now = Date.now();
      const dt = Math.max(now - lastPointTimeRef.current, 8);
      const vel = Math.sqrt(dx * dx + dy * dy) / dt;
      const pressure = Math.max(0.5, Math.min(1.5, 1.3 - vel * 12));
      lastPointTimeRef.current = now;
      const nextDark  = livePathRef.current.copy();
      const nextMid   = liveMidPathRef.current!.copy();
      const nextLight = liveLightPathRef.current!.copy();
      stampPencilDots(nextLight, nextMid, nextDark, last.x, last.y, x, y, pressure);
      livePathRef.current      = nextDark;
      liveMidPathRef.current   = nextMid;
      liveLightPathRef.current = nextLight;
      lastPointRef.current = { x, y };
      setLivePath(nextDark);
      setLiveMidPath(nextMid);
      setLiveLightPath(nextLight);
    } else {
      const isCrayon = toolRef.current === 'crayon';
      const px = isCrayon ? jitter(x, 3.5) : x;
      const py = isCrayon ? jitter(y, 3.5) : y;
      const dx = px - last.x, dy = py - last.y;
      if (dx * dx + dy * dy < 4) return;
      const next = livePathRef.current.copy();
      next.quadTo(last.x, last.y, (last.x + px) / 2, (last.y + py) / 2);
      livePathRef.current = next;
      lastPointRef.current = { x: px, y: py };
      setLivePath(next);
    }
  }

  function endStroke() {
    if (!livePathRef.current) return;
    if (toolRef.current !== 'pencil' && lastPointRef.current) {
      livePathRef.current.lineTo(lastPointRef.current.x, lastPointRef.current.y);
    }
    const done = livePathRef.current;
    if (toolRef.current === 'pencil') {
      const colors = pencilLayerColors(colorRef.current);
      setPaths(prev => [...prev, {
        path: done,
        lightPath: liveLightPathRef.current ?? undefined,
        midPath:   liveMidPathRef.current ?? undefined,
        color:      colors.dark,
        lightColor: colors.light,
        midColor:   colors.mid,
        hexColor: colorRef.current,
        width: strokeWidth(),
        cap: strokeCap(),
        tool: 'pencil',
      }]);
    } else {
      setPaths(prev => [...prev, {
        path: done,
        color: strokeColor(),
        hexColor: colorRef.current,
        width: strokeWidth(),
        cap: strokeCap(),
        tool: toolRef.current,
      }]);
    }
    setRedoStack([]);
    livePathRef.current      = null;
    liveMidPathRef.current   = null;
    liveLightPathRef.current = null;
    lastPointRef.current = null;
    setLivePath(null);
    setLiveMidPath(null);
    setLiveLightPath(null);
    setCursorPos(null);
  }

  // ── Gestures ───────────────────────────────────────────────────
  const drawGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .runOnJS(true)
    .onBegin(e => {
      const pt = toCanvas(e.x, e.y);
      beginStroke(pt.x, pt.y);
      setCursorPos({ x: e.x, y: e.y });
    })
    .onUpdate(e => {
      const pt = toCanvas(e.x, e.y);
      continueStroke(pt.x, pt.y);
      setCursorPos({ x: e.x, y: e.y });
    })
    .onEnd(() => endStroke())
    .onFinalize(() => endStroke());

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => {
      baseZoomRef.current = zoomRef.current;
    })
    .onUpdate(e => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(1, baseZoomRef.current * e.scale));
      const clamped = clampPan(panXRef.current, panYRef.current, newZoom);
      zoomRef.current = newZoom;
      panXRef.current = clamped.x;
      panYRef.current = clamped.y;
      setZoom(newZoom);
      setPanX(clamped.x);
      setPanY(clamped.y);
    });

  const panNavGesture = Gesture.Pan()
    .minPointers(2)
    .runOnJS(true)
    .onBegin(() => {
      basePanXRef.current = panXRef.current;
      basePanYRef.current = panYRef.current;
    })
    .onUpdate(e => {
      const clamped = clampPan(
        basePanXRef.current + e.translationX,
        basePanYRef.current + e.translationY,
        zoomRef.current,
      );
      panXRef.current = clamped.x;
      panYRef.current = clamped.y;
      setPanX(clamped.x);
      setPanY(clamped.y);
    });

  const composed = Gesture.Simultaneous(drawGesture, pinchGesture, panNavGesture);

  // ── Undo / Redo / Clear ───────────────────────────────────────
  function handleUndo() {
    setPaths(prev => {
      if (!prev.length) return prev;
      const popped = prev[prev.length - 1];
      setRedoStack(r => [popped, ...r]);
      return prev.slice(0, -1);
    });
  }
  function handleRedo() {
    setRedoStack(prev => {
      if (!prev.length) return prev;
      const [top, ...rest] = prev;
      setPaths(p => [...p, top]);
      return rest;
    });
  }
  function handleClear() {
    if (!paths.length) return;
    Alert.alert('Clear canvas?', 'This will erase your whole drawing.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { setPaths([]); setRedoStack([]); } },
    ]);
  }
  function resetZoom() {
    setZoom(1); setPanX(0); setPanY(0);
    zoomRef.current = 1; panXRef.current = 0; panYRef.current = 0;
  }

  // ── Analysis ──────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!paths.length) { Alert.alert('Nothing to analyze', 'Draw something first!'); return; }
    setAnalyzing(true);
    try {
      const snapshot = canvasRef.current?.makeImageSnapshot();
      if (!snapshot) throw new Error('Could not capture your drawing. Please try again.');
      const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, 85);
      const filename = `${activeChild?.id ?? 'unknown'}/${Date.now()}.jpg`;

      const [uploadResult, analyzeResult] = await Promise.all([
        supabase.storage.from('sketch-images').upload(filename, decode(base64), { contentType: 'image/jpeg' }),
        supabase.functions.invoke('analyze-sketch', {
          body: { imageBase64: base64, promptType: promptType ?? 'self', preMood: preMood || null },
        }),
      ]);

      if (uploadResult.error) throw uploadResult.error;
      if (analyzeResult.error) throw analyzeResult.error;

      if (analyzeResult.data?.valid === false) {
        Alert.alert('Wrong Drawing Topic', analyzeResult.data.message, [{ text: 'Try Again' }]);
        setAnalyzing(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('sketch-images').getPublicUrl(filename);
      const emotion: string = analyzeResult.data?.emotion ?? 'happy';
      const scores = analyzeResult.data?.scores ?? null;

      if (activeChild) {
        await supabase.from('sketches').insert({
          patient_id: activeChild.id,
          emotion,
          notes: null,
          image_url: urlData.publicUrl,
          scores: scores ?? null,
          therapist_message: analyzeResult.data?.therapistMessage ?? null,
          pre_mood: preMood || null,
        });
      }

      router.replace({
        pathname: '/child/result',
        params: {
          emotion,
          scores: scores ? JSON.stringify(scores) : '',
          preMood: preMood || '',
          therapistMessage: analyzeResult.data?.therapistMessage ?? '',
        },
      });
    } catch (e: any) {
      Alert.alert('Analysis failed', e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  const isDark = bgColor === '#1C1C2E';

  return (
    <View style={styles.root}>

      {/* ── Top bar ───────────────────────────────────────────── */}
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.toolbarTitle} numberOfLines={1}>
          {PROMPT_LABEL[promptType ?? 'self']}
        </Text>
        <View style={styles.toolbarRight}>
          <TouchableOpacity onPress={handleUndo} style={[styles.iconBtn, !paths.length && styles.iconBtnDisabled]} disabled={!paths.length}>
            <Ionicons name="arrow-undo" size={18} color={C.textSub} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRedo} style={[styles.iconBtn, !redoStack.length && styles.iconBtnDisabled]} disabled={!redoStack.length}>
            <Ionicons name="arrow-redo" size={18} color={C.textSub} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClear} style={[styles.iconBtn, styles.iconBtnDanger, !paths.length && styles.iconBtnDisabled]} disabled={!paths.length}>
            <Ionicons name="trash-outline" size={18} color={C.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Canvas ───────────────────────────────────────────── */}
      <GestureDetector gesture={composed}>
        <View
          style={styles.canvasWrapper}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            canvasSize.current = { width: Math.floor(width), height: Math.floor(height) };
            setCanvasReady(true);
          }}
        >
          {/* Transformed canvas layer */}
          <View style={[
            StyleSheet.absoluteFill,
            { transform: [{ scale: zoom }, { translateX: panX }, { translateY: panY }] },
          ]}>
            {canvasReady && (
              <Canvas ref={canvasRef} style={StyleSheet.absoluteFill}>
                <Rect
                  x={0} y={0}
                  width={canvasSize.current.width}
                  height={canvasSize.current.height}
                  color={bgColor}
                />
                {paths.flatMap((p, i) => {
                  if (p.tool === 'pencil') {
                    const el = [];
                    if (p.lightPath) el.push(<Path key={`${i}-l`} path={p.lightPath} color={p.lightColor!} style="fill" />);
                    if (p.midPath)   el.push(<Path key={`${i}-m`} path={p.midPath}   color={p.midColor!}   style="fill" />);
                    el.push(<Path key={i} path={p.path} color={p.color} style="fill" />);
                    return el;
                  }
                  return [<Path key={i} path={p.path} color={p.color} style="stroke" strokeWidth={p.width} strokeCap={p.cap} strokeJoin="round" />];
                })}
                {livePath && tool === 'pencil' ? (
                  <>
                    {liveLightPath && <Path path={liveLightPath} color={pencilLayerColors(selectedColor).light} style="fill" />}
                    {liveMidPath   && <Path path={liveMidPath}   color={pencilLayerColors(selectedColor).mid}   style="fill" />}
                    <Path path={livePath} color={pencilLayerColors(selectedColor).dark} style="fill" />
                  </>
                ) : livePath ? (
                  <Path
                    path={livePath}
                    color={strokeColor()}
                    style="stroke"
                    strokeWidth={strokeWidth()}
                    strokeCap={strokeCap()}
                    strokeJoin="round"
                  />
                ) : null}
              </Canvas>
            )}
          </View>

          {/* Placeholder — shown unscaled so it stays centered */}
          {!paths.length && !livePath && (
            <View style={[StyleSheet.absoluteFill, styles.placeholder]} pointerEvents="none">
              <Ionicons name="pencil-outline" size={56} color={isDark ? 'rgba(255,255,255,0.12)' : C.borderMed} />
              <Text style={[styles.placeholderText, isDark && { color: 'rgba(255,255,255,0.18)' }]}>
                Start drawing!
              </Text>
            </View>
          )}

          {/* Touch cursor — in screen space */}
          {cursorPos && (() => {
            const isEraser = tool === 'eraser';
            const isThick = tool === 'thick';
            const isPencil = tool === 'pencil';
            const baseSize = isPencil
              ? selectedSize * PENCIL_BRUSH_MUL * 2 * zoom
              : isEraser
                ? (selectedSize + 18) * zoom
                : strokeWidth() * zoom;
            const size = Math.max(baseSize, 8);
            const half = size / 2;
            return (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: cursorPos.x - half,
                  top: cursorPos.y - half,
                  width: size,
                  height: size,
                  borderRadius: isThick ? 3 : half,
                  backgroundColor: isEraser
                    ? 'rgba(255,255,255,0.85)'
                    : hexToRgba(selectedColor, isPencil ? 0.30 : isThick ? 0.35 : 0.55),
                  borderWidth: isEraser ? 1.5 : 1,
                  borderColor: isEraser ? 'rgba(100,100,100,0.5)' : 'rgba(255,255,255,0.5)',
                }}
              />
            );
          })()}

          {/* Zoom badge — tap to reset */}
          {zoom > 1.05 && (
            <TouchableOpacity style={styles.zoomBadge} onPress={resetZoom}>
              <Text style={styles.zoomBadgeText}>{(Math.round(zoom * 10) / 10).toFixed(1)}×  ↺</Text>
            </TouchableOpacity>
          )}
        </View>
      </GestureDetector>

      {/* ── Color picker modal ───────────────────────────────── */}
      <Modal visible={showColorPicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerEmoji}>✏️</Text>
            <Text style={styles.pickerTitle}>Choose Your Color!</Text>
            <Text style={styles.pickerSub}>Tap a color to start drawing</Text>
            <View style={styles.pickerGrid}>
              {COLORS.map(color => {
                const active = selectedColor === color;
                return (
                  <TouchableOpacity
                    key={color}
                    onPress={() => setSelectedColor(color)}
                    style={[
                      styles.pickerDot,
                      { backgroundColor: color },
                      color === '#ffffff' && styles.pickerDotWhite,
                      active && styles.pickerDotActive,
                      active && { shadowColor: color === '#1a1a1a' ? '#000' : color },
                    ]}
                  />
                );
              })}
            </View>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowColorPicker(false)}>
              <Text style={styles.pickerBtnText}>Let's Draw! →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Bottom controls ──────────────────────────────────── */}
      <View style={styles.controls}>

        {/* Row 1 — Tool pills + brush sizes */}
        <View style={styles.toolRow}>
          <View style={styles.toolPills}>
            <TouchableOpacity style={[styles.pill, tool === 'pencil' && styles.pillPencil]} onPress={() => setTool('pencil')}>
              <MaterialCommunityIcons name="pencil" size={14} color={tool === 'pencil' ? C.white : C.textMuted} />
              <Text style={[styles.pillLabel, tool === 'pencil' && styles.pillLabelActive]}>Pencil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pill, tool === 'crayon' && styles.pillCrayon]} onPress={() => setTool('crayon')}>
              <MaterialCommunityIcons name="lead-pencil" size={14} color={tool === 'crayon' ? C.white : C.textMuted} />
              <Text style={[styles.pillLabel, tool === 'crayon' && styles.pillLabelActive]}>Crayon</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pill, tool === 'thick' && styles.pillThick]} onPress={() => setTool('thick')}>
              <MaterialCommunityIcons name="marker" size={14} color={tool === 'thick' ? C.white : C.textMuted} />
              <Text style={[styles.pillLabel, tool === 'thick' && styles.pillLabelActive]}>Thick</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pill, tool === 'eraser' && styles.pillEraser]} onPress={() => setTool('eraser')}>
              <MaterialCommunityIcons name="eraser" size={14} color={tool === 'eraser' ? C.white : C.textMuted} />
              <Text style={[styles.pillLabel, tool === 'eraser' && styles.pillLabelActive]}>Eraser</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rowDivider} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sizeRow} style={styles.sizeFlex}>
            {BRUSH_SIZES.map(sz => {
              const active = selectedSize === sz;
              const visual = Math.min(Math.max(sz * 1.5, 6), 30);
              return (
                <TouchableOpacity key={sz} style={[styles.sizeBtn, active && styles.sizeBtnActive]} onPress={() => setSelectedSize(sz)}>
                  <View style={[styles.sizeDot, {
                    width: visual, height: visual, borderRadius: visual / 2,
                    backgroundColor: active ? (tool === 'eraser' ? C.textMuted : selectedColor) : C.borderMed,
                  }]} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Row 2 — Color palette + BG chips */}
        <View style={styles.colorBgRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow} style={styles.colorFlex}>
            {COLORS.map(color => {
              const active = selectedColor === color && tool !== 'eraser';
              return (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    color === '#ffffff' && styles.colorDotWhite,
                    active && styles.colorDotSelected,
                    active && { borderColor: (color === '#1a1a1a' || color === '#ffffff') ? C.textMuted : color },
                  ]}
                  onPress={() => { setSelectedColor(color); if (tool === 'eraser') setTool('pencil'); }}
                />
              );
            })}
          </ScrollView>

          <View style={styles.bgSection}>
            <Text style={styles.bgLabel}>BG</Text>
            <View style={styles.bgRow}>
              {BG_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.color}
                  style={[
                    styles.bgChip,
                    { backgroundColor: opt.color },
                    opt.color === '#FFFFFF' && styles.bgChipBorder,
                    bgColor === opt.color && styles.bgChipActive,
                  ]}
                  onPress={() => setBgColor(opt.color)}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Analyze */}
        <TouchableOpacity style={[styles.analyzeBtn, analyzing && { opacity: 0.8 }]} onPress={handleAnalyze} disabled={analyzing} activeOpacity={0.85}>
          {analyzing ? (
            <><ActivityIndicator color={C.white} size="small" /><Text style={styles.analyzeBtnText}>Analyzing your drawing...</Text></>
          ) : (
            <><Ionicons name="scan-outline" size={20} color={C.white} /><Text style={styles.analyzeBtnText}>Analyze My Drawing!</Text></>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },

  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
    zIndex: 10,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 60 },
  backText: { fontSize: 15, color: C.primary, fontWeight: '600' },
  toolbarTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: C.text },
  toolbarRight: { flexDirection: 'row', gap: 6, alignItems: 'center', minWidth: 80, justifyContent: 'flex-end' },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.base, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  iconBtnDanger: { backgroundColor: '#fff5f5', borderColor: '#fecaca' },
  iconBtnDisabled: { opacity: 0.3 },

  canvasWrapper: { flex: 1, overflow: 'hidden' },
  placeholder: { justifyContent: 'center', alignItems: 'center', gap: 8 },
  placeholderText: { fontSize: 18, color: C.borderMed, fontWeight: '600' },

  zoomBadge: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  zoomBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  controls: {
    backgroundColor: C.white,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 22,
    gap: 10,
    borderTopWidth: 1, borderTopColor: C.border,
    ...SHADOW.lg,
  },

  toolRow: { flexDirection: 'row', alignItems: 'center' },
  toolPills: { flexDirection: 'row', gap: 5 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.base, borderWidth: 1, borderColor: C.border,
  },
  pillPencil: { backgroundColor: '#6b7280', borderColor: '#6b7280' },
  pillCrayon: { backgroundColor: C.primary, borderColor: C.primary },
  pillThick:  { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  pillEraser: { backgroundColor: C.text,    borderColor: C.text },
  pillLabel:       { fontSize: 12, fontWeight: '700', color: C.textMuted },
  pillLabelActive: { color: C.white },

  rowDivider: { width: 1, height: 22, backgroundColor: C.border, marginHorizontal: 8 },
  sizeFlex: { flex: 1 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  sizeBtn: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sizeBtnActive: { backgroundColor: C.primaryLight },
  sizeDot: {},

  colorBgRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorFlex: { flex: 1 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 },
  colorDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2.5, borderColor: 'transparent',
  },
  colorDotWhite: { borderColor: C.border, borderWidth: 1.5 },
  colorDotSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.18 }],
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, elevation: 3,
  },

  bgSection: { alignItems: 'center', gap: 4 },
  bgLabel: { fontSize: 9, fontWeight: '800', color: C.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  bgRow: { flexDirection: 'row', gap: 5 },
  bgChip: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: 'transparent' },
  bgChipBorder: { borderColor: C.borderMed },
  bgChipActive: { borderColor: C.primary, borderWidth: 2.5 },

  analyzeBtn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  analyzeBtnText: { fontSize: 16, fontWeight: '700', color: C.white },

  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  pickerCard: {
    backgroundColor: C.white, borderRadius: 24,
    paddingHorizontal: 28, paddingVertical: 32,
    alignItems: 'center', gap: 10, width: 320,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 10,
  },
  pickerEmoji: { fontSize: 36 },
  pickerTitle: { fontSize: 22, fontWeight: '800', color: C.text },
  pickerSub: { fontSize: 14, color: C.textSub, marginBottom: 4 },
  pickerGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 12, marginVertical: 8,
  },
  pickerDot: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 2.5, borderColor: 'transparent',
  },
  pickerDotWhite: { borderColor: C.borderMed },
  pickerDotActive: {
    borderColor: C.primary, borderWidth: 3,
    transform: [{ scale: 1.2 }],
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  pickerBtn: {
    marginTop: 8, backgroundColor: C.primary,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40,
  },
  pickerBtnText: { fontSize: 16, fontWeight: '700', color: C.white },
});
