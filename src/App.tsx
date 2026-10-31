import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import {
  ADDITION,
  Brush,
  Evaluator,
} from "three-bvh-csg";
import {
  ContactShadows,
  OrbitControls,
  Outlines,
  TransformControls,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Group } from "three";
import {
  Box,
  Check,
  Combine,
  Contrast,
  ChevronDown,
  ChevronRight,
  Circle,
  Code2,
  Cone,
  Cuboid,
  Diamond,
  Grid2X2,
  Hexagon,
  Layers3,
  Lock,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Move3D,
  Palette,
  Pentagon,
  Plus,
  Plane,
  Rotate3D,
  Ruler,
  Send,
  Shapes,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { useCallback } from "react";

type ShapeType = "cube" | "sphere" | "cylinder" | "cone" | "torus" | "capsule" | "plane" | "pyramid" | "icosphere" | "octahedron" | "ring" | "custom";
type Axis = 0 | 1 | 2;
type TransformMode = "translate" | "rotate" | "scale";
type ViewMode = "Perspective" | "Vue de Haut" | "Vue de Face";
type CodeMode = "blocks" | "text";
type ThemeName = "dark" | "light" | "cyberpunk" | "ocean" | "synthwave";
type Vector3Tuple = [number, number, number];

interface SceneObject {
  id: string;
  name: string;
  type: ShapeType;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
  color: string;
  visible: boolean;
  locked: boolean;
  segments: number;
  geometryData?: { positions: number[]; indices: number[] } | null;
  constructionCode?: string;
  groupId?: string;
}

interface ProjectData {
  name: string;
  objects: SceneObject[];
}

interface ObjectContextMenu {
  objectIds: string[];
  x: number;
  y: number;
}

const storageKey = "kubi-pro-studio-project-v1";
const themeStorageKey = "kubi-pro-studio-theme";

const shapeLibrary: { type: ShapeType; label: string; icon: typeof Box; color: string }[] = [
  { type: "cube", label: "Cube", icon: Box, color: "#8B5CF6" },
  { type: "sphere", label: "Sphère", icon: Circle, color: "#06B6D4" },
  { type: "cylinder", label: "Cylindre", icon: Cuboid, color: "#F59E0B" },
  { type: "cone", label: "Cône", icon: Cone, color: "#F472B6" },
  { type: "torus", label: "Tore", icon: Shapes, color: "#10B981" },
  { type: "capsule", label: "Capsule", icon: Circle, color: "#EC4899" },
  { type: "plane", label: "Plaque", icon: Plane, color: "#94A3B8" },
  { type: "pyramid", label: "Pyramide", icon: Pentagon, color: "#FB7185" },
  { type: "icosphere", label: "Icosphère", icon: Hexagon, color: "#38BDF8" },
  { type: "octahedron", label: "Octaèdre", icon: Diamond, color: "#A3E635" },
  { type: "ring", label: "Anneau", icon: Contrast, color: "#FBBF24" },
];

const objectTypes = new Set<ShapeType>([...shapeLibrary.map(({ type }) => type), "custom"]);
const themes: { id: ThemeName; label: string; color: string; icon: typeof Sun }[] = [
  { id: "dark", label: "Dark mode", color: "#8B5CF6", icon: Contrast },
  { id: "light", label: "Light mode", color: "#06B6D4", icon: Sun },
  { id: "cyberpunk", label: "Cyberpunk", color: "#D946EF", icon: Palette },
  { id: "ocean", label: "Océan", color: "#06B6D4", icon: Palette },
  { id: "synthwave", label: "Synthwave", color: "#F472B6", icon: Palette },
];

function isVector(value: unknown): value is Vector3Tuple {
  return Array.isArray(value) && value.length === 3 && value.every(
    (component) => typeof component === "number" && Number.isFinite(component),
  );
}

function isSceneObject(value: unknown): value is SceneObject {
  if (typeof value !== "object" || value === null) return false;
  const object = value as Record<string, unknown>;
  return (
    typeof object.id === "string" &&
    typeof object.name === "string" &&
    typeof object.type === "string" &&
    objectTypes.has(object.type as ShapeType) &&
    isVector(object.position) &&
    isVector(object.rotation) &&
    isVector(object.scale) &&
    typeof object.color === "string" &&
    typeof object.visible === "boolean" &&
    (object.locked === undefined || typeof object.locked === "boolean") &&
    (object.segments === undefined || (typeof object.segments === "number" && Number.isInteger(object.segments) && object.segments >= 3 && object.segments <= 64)) &&
    (object.geometryData === undefined || object.geometryData === null || (
      typeof object.geometryData === "object" &&
      object.geometryData !== null &&
      "positions" in object.geometryData &&
      Array.isArray(object.geometryData.positions) &&
      object.geometryData.positions.length % 3 === 0 &&
      object.geometryData.positions.every((component) => typeof component === "number" && Number.isFinite(component)) &&
      "indices" in object.geometryData &&
      Array.isArray(object.geometryData.indices) &&
      object.geometryData.indices.every((component) => Number.isInteger(component) && component >= 0)
    )) &&
    (object.constructionCode === undefined || typeof object.constructionCode === "string") &&
    (object.groupId === undefined || typeof object.groupId === "string") &&
    (object.type !== "custom" || (object.geometryData !== undefined && object.geometryData !== null))
  );
}

function loadProject(): ProjectData {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return { name: "Mon_projet", objects: [] };
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "name" in parsed &&
      typeof parsed.name === "string" &&
      "objects" in parsed &&
      Array.isArray(parsed.objects)
    ) {
      return {
        name: parsed.name,
        objects: parsed.objects.filter(isSceneObject).map((object) => ({
          ...object,
          locked: object.locked ?? false,
          segments: object.segments ?? (object.type === "pyramid" ? 4 : 16),
          geometryData: object.geometryData ?? null,
          constructionCode: object.constructionCode,
        })),
      };
    }
  } catch (error) {
    console.error("Impossible de charger le projet enregistré.", error);
    return { name: "Mon_projet", objects: [] };
  }
  return { name: "Mon_projet", objects: [] };
}

function loadTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(themeStorageKey);
    if (themes.some((theme) => theme.id === stored)) return stored as ThemeName;
  } catch (error) {
    console.error("Impossible de charger le thème enregistré.", error);
  }
  return "dark";
}

function createPrimitive(type: ShapeType, objects: SceneObject[]): SceneObject {
  const preset = shapeLibrary.find((shape) => shape.type === type);
  const index = objects.length;
  const existingNames = new Set(objects.map((object) => object.name));
  let nameIndex = 1;
  let name = `${preset?.label ?? "Objet"}_${nameIndex}`;
  while (existingNames.has(name)) {
    nameIndex += 1;
    name = `${preset?.label ?? "Objet"}_${nameIndex}`;
  }
  const slot = index - 1;
  return {
    id: `${type}-${Date.now()}-${index}`,
    name,
    type,
    position: [index === 0 ? 0 : (slot % 3 - 1) * 1.15, 0.35, index === 0 ? 0 : Math.floor(slot / 3) * 1.1 + 1],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: preset?.color ?? "#8B5CF6",
    visible: true,
    locked: false,
    segments: type === "pyramid" ? 4 : 16,
  };
}

function makeObjectGeometry(object: SceneObject): BufferGeometry {
  const segments = Math.min(64, Math.max(3, Math.round(object.segments)));
  if (object.type === "custom" && object.geometryData) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(object.geometryData.positions), 3));
    geometry.setIndex(object.geometryData.indices.length ? object.geometryData.indices : null);
    const position = geometry.getAttribute("position");
    const uv = new Float32Array(position.count * 2);
    for (let index = 0; index < position.count; index += 1) {
      uv[index * 2] = position.getX(index);
      uv[index * 2 + 1] = position.getY(index);
    }
    geometry.setAttribute("uv", new BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    return geometry;
  }
  switch (object.type) {
    case "cube": return new BoxGeometry(1, 1, 1, segments, segments, segments);
    case "sphere": return new SphereGeometry(0.62, segments, Math.max(4, Math.floor(segments * 0.66)));
    case "cylinder": return new CylinderGeometry(0.5, 0.5, 1, segments);
    case "cone": return new ConeGeometry(0.55, 1, segments);
    case "torus":
    case "ring": return new TorusGeometry(0.42, 0.18, Math.max(3, Math.floor(segments / 2)), segments);
    case "capsule": return new CapsuleGeometry(0.38, 1, 6, segments);
    case "plane": return new BoxGeometry(1.3, 0.08, 1.3, segments, 1, segments);
    case "pyramid": return new ConeGeometry(0.65, 1, Math.min(12, segments));
    case "icosphere": return new IcosahedronGeometry(0.62, Math.min(5, Math.floor(segments / 8)));
    case "octahedron": return new OctahedronGeometry(0.65, Math.min(5, Math.floor(segments / 8)));
    default: throw new Error(`Impossible de créer la géométrie « ${object.type} » sans données de fusion.`);
  }
}

function ObjectGeometry({ object, selected, outlineColor }: { object: SceneObject; selected: boolean; outlineColor: string }) {
  const geometry = useMemo(() => makeObjectGeometry(object), [object.type, object.segments, object.geometryData]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = <meshStandardMaterial color={object.color} roughness={0.55} metalness={0.12} />;
  const outline = selected ? <Outlines thickness={2.2} color={outlineColor} /> : null;

  return (
    <mesh castShadow>
      <primitive object={geometry} attach="geometry" />
      {material}{outline}
    </mesh>
  );
}

const geometryBaseDimensions: Record<Exclude<ShapeType, "custom">, Vector3Tuple> = {
  cube: [1, 1, 1],
  sphere: [1.24, 1.24, 1.24],
  cylinder: [1, 1, 1],
  cone: [1.1, 1, 1.1],
  torus: [1.2, 1.2, 0.36],
  capsule: [0.76, 2.76, 0.76],
  plane: [1.3, 0.08, 1.3],
  pyramid: [1.3, 1, 1.3],
  icosphere: [1.24, 1.24, 1.24],
  octahedron: [1.3, 1.3, 1.3],
  ring: [1.2, 1.2, 0.36],
};

function getObjectDimensions(object: SceneObject): Vector3Tuple {
  const baseDimensions = object.type === "custom" && object.geometryData
    ? getCustomGeometryDimensions(object.geometryData.positions)
    : geometryBaseDimensions[object.type === "custom" ? "cube" : object.type];
  return baseDimensions.map((dimension, axis) => dimension * object.scale[axis]) as Vector3Tuple;
}

function getCustomGeometryDimensions(positions: number[]): Vector3Tuple {
  const min: Vector3Tuple = [Infinity, Infinity, Infinity];
  const max: Vector3Tuple = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[index + axis]);
      max[axis] = Math.max(max[axis], positions[index + axis]);
    }
  }
  if (!positions.length) return [1, 1, 1];
  return max.map((value, axis) => Math.max(0.01, value - min[axis])) as Vector3Tuple;
}

function createWorldBrush(object: SceneObject): Brush {
  const geometry = makeObjectGeometry(object);
  const matrix = new Matrix4().compose(
    new Vector3(...object.position),
    new Quaternion().setFromEuler(new Euler(...object.rotation)),
    new Vector3(...object.scale),
  );
  geometry.applyMatrix4(matrix);
  geometry.computeVertexNormals();
  const brush = new Brush(geometry, new MeshStandardMaterial({ color: "#ffffff" }));
  brush.updateMatrixWorld(true);
  brush.prepareGeometry();
  return brush;
}

function mergeObjects(objects: SceneObject[], ids: string[]): SceneObject {
  const mergedObjects = objects.filter((object) => ids.includes(object.id));
  if (mergedObjects.length < 2) throw new Error("Choisis au moins deux formes pour les assembler.");

  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  let result = createWorldBrush(mergedObjects[0]);
  try {
    for (const object of mergedObjects.slice(1)) {
      const next = createWorldBrush(object);
      try {
        const merged = evaluator.evaluate(result, next, ADDITION);
        result.disposeCacheData();
        result.geometry.dispose();
        result = merged as Brush;
      } finally {
        next.geometry.dispose();
        next.disposeCacheData();
      }
    }

    const flattened = result.geometry.index ? result.geometry.toNonIndexed() : result.geometry.clone();
    let positions: number[];
    try {
      const position = flattened.getAttribute("position");
      const drawCount = Number.isFinite(flattened.drawRange.count)
        ? Math.min(flattened.drawRange.count, position.count)
        : position.count;
      positions = Array.from(position.array.slice(0, drawCount * 3) as ArrayLike<number>);
    } finally {
      flattened.dispose();
    }
    if (positions.length < 9) throw new Error("Les formes ne peuvent pas être fusionnées en un solide.");

    return {
      id: `fusion-${Date.now()}`,
      name: `Assemblage_${objects.filter((object) => object.type === "custom").length + 1}`,
      type: "custom",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: mergedObjects[0].color,
      visible: true,
      locked: mergedObjects.every((object) => object.locked),
      segments: 16,
      geometryData: { positions, indices: [] },
      constructionCode: formatCodeCall(
        "union",
        mergedObjects.map((object, index) => getObjectConstructorCode(object, index)),
      ),
    };
  } finally {
    result.geometry.dispose();
    result.disposeCacheData();
  }
}

function ResizeHandle({
  orientation,
  label,
  onResize,
}: {
  orientation: "vertical" | "horizontal";
  label: string;
  onResize: (delta: number) => void;
}) {
  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    let previous = orientation === "vertical" ? event.clientX : event.clientY;
    document.body.classList.add(`resizing-${orientation}`);
    const move = (pointerEvent: PointerEvent) => {
      const current = orientation === "vertical" ? pointerEvent.clientX : pointerEvent.clientY;
      onResize(current - previous);
      previous = current;
    };
    const stop = () => {
      document.body.classList.remove(`resizing-${orientation}`);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  }

  function resizeByKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const positive = event.key === "ArrowRight" || event.key === "ArrowDown";
    onResize((positive ? 1 : -1) * (event.shiftKey ? 40 : 12));
  }

  return (
    <div
      className={`resize-handle resize-${orientation}`}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      onPointerDown={startResize}
      onKeyDown={resizeByKeyboard}
      title={`${label} — glisse pour ajuster`}
    >
      <span />
    </div>
  );
}

function SceneObjectView({
  object,
  selected,
  active,
  mode,
  outlineColor,
  onSelect,
  onContextMenu,
  onTransforming,
  onCommit,
}: {
  object: SceneObject;
  selected: boolean;
  active: boolean;
  mode: TransformMode;
  outlineColor: string;
  onSelect: (id: string, additive?: boolean) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
  onTransforming: (active: boolean) => void;
  onCommit: (id: string, position: Vector3Tuple, rotation: Vector3Tuple, scale: Vector3Tuple) => void;
}) {
  const [group, setGroup] = useState<Group | null>(null);
  const commitTransform = useCallback(() => {
    if (!group) return;
    const { position, rotation, scale } = group;
    onCommit(
      object.id,
      [position.x, position.y, position.z],
      [rotation.x, rotation.y, rotation.z],
      [scale.x, scale.y, scale.z],
    );
  }, [group, object.id, onCommit]);

  const content = (
    <group
      ref={setGroup}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      visible={object.visible}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id, event.nativeEvent.ctrlKey || event.nativeEvent.metaKey);
      }}
      onContextMenu={(event) => {
        event.stopPropagation();
        event.nativeEvent.preventDefault();
        onContextMenu(object.id, event.nativeEvent.clientX, event.nativeEvent.clientY);
      }}
    >
      <ObjectGeometry object={object} selected={selected} outlineColor={outlineColor} />
    </group>
  );

  if (!active || !object.visible || object.locked) return content;
  return (
    <>
      {group && (
        <TransformControls
          object={group}
          mode={mode}
          onMouseDown={() => onTransforming(true)}
          onMouseUp={() => {
            commitTransform();
            onTransforming(false);
          }}
        />
      )}
      {content}
    </>
  );
}

function ViewportScene({
  objects,
  selectedId,
  selectedIds,
  mode,
  viewMode,
  theme,
  viewLocked,
  transforming,
  onSelect,
  onContextMenu,
  onTransforming,
  onCommit,
}: {
  objects: SceneObject[];
  selectedId: string | null;
  selectedIds: string[];
  mode: TransformMode;
  viewMode: ViewMode;
  theme: ThemeName;
  viewLocked: boolean;
  transforming: boolean;
  onSelect: (id: string, additive?: boolean) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
  onTransforming: (active: boolean) => void;
  onCommit: (id: string, position: Vector3Tuple, rotation: Vector3Tuple, scale: Vector3Tuple) => void;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const viewportTheme = {
    dark: { background: "#0F172A", grid: "#475569", minor: "#263449", accent: "#A78BFA", glow: "#06B6D4" },
    light: { background: "#DCE5F0", grid: "#7C8DA5", minor: "#B7C5D6", accent: "#6D28D9", glow: "#0891B2" },
    cyberpunk: { background: "#160D24", grid: "#75447A", minor: "#34213F", accent: "#F0ABFC", glow: "#22D3EE" },
    ocean: { background: "#0B1D2A", grid: "#2F6E83", minor: "#193647", accent: "#67E8F9", glow: "#22D3EE" },
    synthwave: { background: "#1C102A", grid: "#6E477D", minor: "#362044", accent: "#F0ABFC", glow: "#F472B6" },
  }[theme];

  useEffect(() => {
    if (viewMode === "Vue de Haut") camera.position.set(0, 10, 0.01);
    else if (viewMode === "Vue de Face") camera.position.set(0, 1.5, 10);
    else camera.position.set(7, 6, 9);
    camera.lookAt(0, 0, 0);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
  }, [camera, viewMode]);

  return (
    <>
      <color attach="background" args={[viewportTheme.background]} />
      <fog attach="fog" args={[viewportTheme.background, 16, 34]} />
      <ambientLight intensity={0.7} />
      <directionalLight castShadow position={[5, 9, 6]} intensity={2.1} shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-4, 3, 4]} intensity={18} color={viewportTheme.accent} />
      <pointLight position={[4, 4, -3]} intensity={12} color={viewportTheme.glow} />
      <gridHelper args={[24, 48, viewportTheme.grid, viewportTheme.minor]} position={[0, -1.28, 0]} />
      <axesHelper args={[2]} position={[0, -1.26, 0]} />
      {objects.map((object) => (
        <SceneObjectView
          key={object.id}
          object={object}
          selected={selectedIds.includes(object.id)}
          active={object.id === selectedId}
          mode={mode}
          outlineColor={viewportTheme.accent}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          onTransforming={onTransforming}
          onCommit={onCommit}
        />
      ))}
      <ContactShadows position={[0, -1.26, 0]} opacity={0.4} scale={16} blur={2.5} far={5} color="#020617" />
      <OrbitControls ref={controls} makeDefault enabled={!viewLocked && !transforming} enablePan enableDamping dampingFactor={0.08} />
    </>
  );
}

function VectorEditor({
  label,
  values,
  suffix,
  step,
  min,
  disabled = false,
  onChange,
}: {
  label: string;
  values: Vector3Tuple;
  suffix?: string;
  step?: number;
  min?: number;
  disabled?: boolean;
  onChange: (axis: Axis, value: number) => void;
}) {
  return (
    <div className="vector-editor">
      <div className="vector-label">{label}</div>
      <div className="vector-inputs">
        {values.map((value, index) => {
          const axis = ["X", "Y", "Z"][index];
          return (
            <label className={`axis-input axis-${axis.toLowerCase()}`} key={axis}>
              <span>{axis}</span>
              <input
                type="number"
                step={step ?? 0.1}
                min={min}
                disabled={disabled}
                value={Number(value.toFixed(2))}
                aria-label={`${label} ${axis}`}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) onChange(index as Axis, next);
                }}
              />
              {suffix && <small>{suffix}</small>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Inspector({
  object,
  selectedObjects,
  collapsed,
  onUpdate,
  onUpdateSegments,
  onColorChange,
  onToggleLock,
  onExpand,
  onCollapse,
}: {
  object: SceneObject | undefined;
  selectedObjects: SceneObject[];
  collapsed: boolean;
  onUpdate: (id: string, field: "position" | "rotation" | "scale", axis: Axis, value: number) => void;
  onUpdateSegments: (id: string, segments: number) => void;
  onColorChange: (ids: string[], color: string) => void;
  onToggleLock: (ids: string[]) => void;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const dimensions = object ? getObjectDimensions(object) : [1, 1, 1] as Vector3Tuple;
  const sharedColor = selectedObjects.length > 0 && selectedObjects.every((item) => item.color === selectedObjects[0].color)
    ? selectedObjects[0].color
    : "#8B5CF6";
  const allLocked = selectedObjects.length > 0 && selectedObjects.every((item) => item.locked);

  return (
    <section className={`inspector-section ${collapsed ? "inspector-collapsed" : ""}`}>
      <div className="panel-title-row">
        <div className="inspector-title"><span className="panel-kicker">PROPRIÉTÉS</span><h2>Inspecteur</h2></div>
        {collapsed
          ? <button className="expand-inspector-button" type="button" onClick={onExpand} title="Afficher l’inspecteur" aria-label="Afficher l’inspecteur"><Plus size={16} /></button>
          : <button className="collapse-inspector-button" type="button" onClick={onCollapse} title="Replier l’inspecteur" aria-label="Replier l’inspecteur"><Minimize2 size={14} /></button>}
      </div>
      {collapsed ? null : selectedObjects.length > 1 ? (
        <>
          <div className="multi-selection-summary">{selectedObjects.length} pièces sélectionnées</div>
          <div className="inspector-actions">
            <button type="button" className={`object-lock-button ${allLocked ? "object-locked" : ""}`} onClick={() => onToggleLock(selectedObjects.map((item) => item.id))}>
              {allLocked ? <Lock size={14} /> : <Unlock size={14} />}
              {allLocked ? "Déverrouiller" : "Verrouiller"}
            </button>
            <label className="color-control" title="Changer la couleur des pièces sélectionnées">
              <span>Couleur</span>
              <input type="color" value={sharedColor} onChange={(event) => onColorChange(selectedObjects.map((item) => item.id), event.target.value)} aria-label="Couleur des formes sélectionnées" disabled={selectedObjects.some((item) => item.locked)} />
            </label>
          </div>
        </>
      ) : !object ? (
        <div className="empty-selection"><Square size={20} /><span>Sélectionne un objet dans la scène.</span></div>
      ) : (
        <>
          <div className="selected-object-name">
            <span className="object-color-dot" style={{ backgroundColor: object.color }} />
            <strong>{object.name}</strong><span className="selected-tag">{object.locked ? "VERROUILLÉ" : "SÉLECTIONNÉ"}</span>
          </div>
          <div className="inspector-actions">
            <button type="button" className={`object-lock-button ${object.locked ? "object-locked" : ""}`} onClick={() => onToggleLock([object.id])}>
              {object.locked ? <Lock size={14} /> : <Unlock size={14} />}
              {object.locked ? "Déverrouiller" : "Verrouiller"}
            </button>
            <label className="color-control" title="Changer la couleur">
              <span>Couleur</span>
              <input type="color" value={object.color} onChange={(event) => onColorChange([object.id], event.target.value)} aria-label="Couleur de la forme" disabled={object.locked} />
            </label>
          </div>
          <VectorEditor label="Position" values={object.position} suffix="m" disabled={object.locked} onChange={(axis, value) => onUpdate(object.id, "position", axis, value)} />
          <VectorEditor
            label="Rotation"
            values={object.rotation.map((radians) => radians * 180 / Math.PI) as Vector3Tuple}
            suffix="°"
            step={1}
            disabled={object.locked}
            onChange={(axis, value) => onUpdate(object.id, "rotation", axis, value * Math.PI / 180)}
          />
          <VectorEditor
            label="Dimensions"
            values={dimensions}
            suffix="m"
            step={0.1}
            min={0.1}
            disabled={object.locked}
            onChange={(axis, value) => {
              const base = object.type === "custom" && object.geometryData
                ? getCustomGeometryDimensions(object.geometryData.positions)
                : geometryBaseDimensions[object.type === "custom" ? "cube" : object.type];
              onUpdate(object.id, "scale", axis, Math.max(0.1, value) / Math.max(0.01, base[axis]));
            }}
          />
          {object.type !== "custom" && (
            <label className="segments-control">
              <span>{object.type === "cube" || object.type === "plane" ? "Détail des faces" : "Nombre de côtés"}</span>
              <input
                type="number"
                min={3}
                max={64}
                step={1}
                value={object.segments}
                aria-label="Détail de la forme"
                disabled={object.locked}
                onChange={(event) => {
                  const segments = Math.min(64, Math.max(3, Math.round(Number(event.target.value))));
                  if (Number.isFinite(segments)) onUpdateSegments(object.id, segments);
                }}
              />
            </label>
          )}
        </>
      )}
      {!collapsed && <div className="inspector-note"><span className="note-dot" /> Modifie la pièce dans la vue ou ici.</div>}
    </section>
  );
}

function formatCodeNumber(value: number): string {
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return normalized.toFixed(2).replace(/\.?0+$/, "");
}

function getCodeName(object: SceneObject, index: number): string {
  const normalized = object.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safeName = /^[a-zA-Z_]/.test(normalized) ? normalized : `objet_${normalized}`;
  return safeName || `${object.type}_${index + 1}`;
}

function formatCodeCall(name: string, argumentsList: string[]): string {
  const nestedArguments = argumentsList
    .map((argument) => `  ${argument.replace(/\n/g, "\n  ")}`)
    .join(",\n");
  return `${name}(\n${nestedArguments}\n)`;
}

function getGroupName(groupId: string): string {
  const suffix = groupId.replace(/\D/g, "").slice(-4);
  return `Groupe_${suffix || "1"}`;
}

function getObjectConstructorCode(object: SceneObject, index: number): string {
  const position = object.position.map(formatCodeNumber).join(", ");
  const rotation = object.rotation.map((radians) => formatCodeNumber(radians * 180 / Math.PI)).join(", ");
  const scale = object.scale.map(formatCodeNumber).join(", ");
  const properties = [
    `name=${JSON.stringify(getCodeName(object, index))}`,
    `position=(${position})`,
    `rotation_deg=(${rotation})`,
    `scale=(${scale})`,
    `segments=${object.segments}`,
    `color=${JSON.stringify(object.color)}`,
    `visible=${String(object.visible).toLowerCase()}`,
    `locked=${String(object.locked).toLowerCase()}`,
    ...(object.groupId ? [`group=${JSON.stringify(getGroupName(object.groupId))}`] : []),
  ];
  if (object.type === "custom" && object.constructionCode) {
    return formatCodeCall("union", [object.constructionCode, ...properties]);
  }
  return formatCodeCall(object.type, properties);
}

function getObjectCode(object: SceneObject, index: number): string {
  return formatCodeCall("scene.add", [getObjectConstructorCode(object, index)]);
}

function CodeEditor({ objects, expanded, onToggleExpand }: { objects: SceneObject[]; expanded: boolean; onToggleExpand: () => void }) {
  const [mode, setMode] = useState<CodeMode>("blocks");
  const codeLines = objects.flatMap((object, index) => getObjectCode(object, index).split("\n"));

  function renderCode(line: string) {
    const parts = line.split(/(#.*|"(?:[^"\\]|\\.)*"|\b\d+(?:\.\d+)?\b|\b(?:scene|add|cube|sphere|cylinder|cone|torus|capsule|plane|pyramid|icosphere|octahedron|ring)\b)/g);
    return parts.map((part, index) => {
      let className = "";
      if (part.startsWith("#")) className = "syntax-comment";
      else if (part.startsWith('"')) className = "syntax-string";
      else if (/^\d/.test(part)) className = "syntax-number";
      else if (part && /^(cube|sphere|cylinder|cone|torus|capsule|plane|pyramid|icosphere|octahedron|ring|add)$/.test(part)) className = "syntax-function";
      else if (part === "scene") className = "syntax-variable";
      return className ? <b className={className} key={`${part}-${index}`}>{part}</b> : part;
    });
  }

  return (
    <section className="code-section">
      <div className="code-heading">
        <div><span className="panel-kicker">APPRENTISSAGE</span><h2>Mon code</h2></div>
        <div className="code-heading-actions">
          <div className="code-tabs" role="tablist" aria-label="Mode de programmation">
            <button type="button" className={mode === "blocks" ? "code-tab-active" : ""} onClick={() => setMode("blocks")} role="tab" aria-selected={mode === "blocks"}>Blocs</button>
            <button type="button" className={mode === "text" ? "code-tab-active" : ""} onClick={() => setMode("text")} role="tab" aria-selected={mode === "text"}>Code Texte</button>
          </div>
          <button type="button" className="code-expand-button" onClick={onToggleExpand} title={expanded ? "Réafficher l’inspecteur" : "Agrandir le code"} aria-label={expanded ? "Réafficher l’inspecteur" : "Agrandir le code"}>
            {expanded ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
        </div>
      </div>
      {mode === "blocks" ? (
        <div className="block-workspace" role="tabpanel">
          {objects.length === 0 ? (
            <div className="block-empty"><Sparkles size={14} /> Ajoute une forme dans la scène pour voir ses blocs ici.</div>
          ) : (
            <div className="block-object-list">
              {objects.map((object) => (
                <div className="block-object" key={object.id}>
                  <div className={`block-block ${object.type === "custom" ? "block-union" : "block-add"}`}><span className="block-notch" />{object.type === "custom" ? "Assembler" : "Créer"} <strong>{object.type === "custom" ? "solide" : object.type}</strong> <span>« {object.name} »</span></div>
                  {object.groupId && <div className="block-block block-group"><span className="block-notch" />Groupe <strong>{getGroupName(object.groupId)}</strong> · pièce modifiable</div>}
                  <div className="block-block block-move"><span className="block-notch" />Position <strong>X {formatCodeNumber(object.position[0])}</strong> <strong>Y {formatCodeNumber(object.position[1])}</strong> <strong>Z {formatCodeNumber(object.position[2])}</strong></div>
                  <div className="block-block block-rotate"><span className="block-notch" />Rotation <strong>X {formatCodeNumber(object.rotation[0] * 180 / Math.PI)}°</strong> <strong>Y {formatCodeNumber(object.rotation[1] * 180 / Math.PI)}°</strong> <strong>Z {formatCodeNumber(object.rotation[2] * 180 / Math.PI)}°</strong></div>
                  <div className="block-block block-scale"><span className="block-notch" />Taille <strong>X {formatCodeNumber(object.scale[0])}</strong> <strong>Y {formatCodeNumber(object.scale[1])}</strong> <strong>Z {formatCodeNumber(object.scale[2])}</strong></div>
                  {object.type !== "custom" && <div className="block-block block-detail"><span className="block-notch" />Détail <strong>{object.segments} côtés</strong></div>}
                  <div className="block-block block-color"><span className="block-notch" />Couleur <strong><i style={{ backgroundColor: object.color }} />{object.color}</strong></div>
                  <div className="block-block block-visibility"><span className="block-notch" />{object.visible ? "Afficher" : "Masquer"} <strong>{object.name}</strong> · {object.locked ? "Verrouillé" : "Déverrouillé"}</div>
                </div>
              ))}
            </div>
          )}
          {objects.length > 0 && <div className="block-hint"><Sparkles size={13} /> Les blocs suivent les formes de ta scène.</div>}
        </div>
      ) : (
        <div className="text-editor" role="tabpanel" aria-label="Éditeur de code texte">
          <div className="editor-file"><Code2 size={14} /><span>scene.py</span><span className="editor-dot" /></div>
          <pre><code>
            {codeLines.length === 0
              ? <span className="code-line"><i>1</i><b className="syntax-comment"># Ajoute une forme pour voir le code de ta scène.</b></span>
              : codeLines.map((line, index) => <span className="code-line" key={`${index}-${line}`}><i>{index + 1}</i>{renderCode(line)}</span>)}
          </code></pre>
          <div className="code-status"><span /> Code de la scène <span className="code-status-right">{objects.length} objet{objects.length > 1 ? "s" : ""} · {codeLines.length} lignes</span></div>
        </div>
      )}
    </section>
  );
}

function Assistant() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    setMessages((current) => [...current, message]);
    setDraft("");
  }

  return (
    <div className="assistant-dock">
      {open && (
        <section className="assistant-card" aria-label="Kubi Copilot">
          <header className="assistant-header">
            <div className="assistant-avatar">K<span /></div>
            <div><strong>Kubi Copilot</strong><small><span /> En ligne · donne des indices, pas les réponses</small></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer Kubi Copilot" title="Fermer"><X size={16} /></button>
          </header>
          <div className="assistant-messages">
            <div className="assistant-message">
              Ton fichier est étanche et stable pour l’impression ! Tu as un surplomb de 45° sur le bras gauche, as-tu pensé à ajouter un bloc de support ?
            </div>
            {messages.map((message, index) => <div className="assistant-user-message" key={`${message}-${index}`}>{message}</div>)}
            <div className="assistant-disclaimer"><Sparkles size={13} /> Je t’aide à trouver tes propres solutions.</div>
          </div>
          <form className="assistant-composer" onSubmit={sendMessage}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Demande un indice à l’IA..." aria-label="Demande un indice à l’IA" />
            <button type="submit" disabled={!draft.trim()} aria-label="Envoyer"><Send size={15} /></button>
          </form>
        </section>
      )}
      <button className={`assistant-toggle ${open ? "assistant-toggle-open" : ""}`} onClick={() => setOpen((value) => !value)} type="button" aria-label={open ? "Fermer Kubi Copilot" : "Ouvrir Kubi Copilot"} title="Kubi Copilot">
        {open ? <X size={23} /> : <span className="assistant-kubi">K<span /><i /><b /></span>}
        {!open && <span className="assistant-online" />}
      </button>
    </div>
  );
}

function App() {
  const initialProject = useMemo(loadProject, []);
  const [projectName, setProjectName] = useState(initialProject.name);
  const [objects, setObjects] = useState(initialProject.objects);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialProject.objects[0] ? [initialProject.objects[0].id] : []);
  const selectedId = selectedIds[selectedIds.length - 1] ?? null;
  const [mode, setMode] = useState<TransformMode>("translate");
  const [viewMode, setViewMode] = useState<ViewMode>("Perspective");
  const [theme, setTheme] = useState<ThemeName>(loadTheme);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(250);
  const [rightPanelWidth, setRightPanelWidth] = useState(420);
  const [inspectorHeight, setInspectorHeight] = useState(390);
  const [sceneViewLocked, setSceneViewLocked] = useState(false);
  const [codeMaximized, setCodeMaximized] = useState(true);
  const [isTransforming, setIsTransforming] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [objectContextMenu, setObjectContextMenu] = useState<ObjectContextMenu | null>(null);

  const selectedObject = objects.find((object) => object.id === selectedId);
  const selectedObjects = objects.filter((object) => selectedIds.includes(object.id));
  const contextObjects = objectContextMenu
    ? objects.filter((object) => objectContextMenu.objectIds.includes(object.id))
    : [];
  const contextGroupId = contextObjects[0]?.groupId;
  const canUngroupContextSelection = Boolean(contextGroupId) &&
    contextObjects.every((object) => object.groupId === contextGroupId);

  function selectObject(id: string, additive = false) {
    const clickedObject = objects.find((object) => object.id === id);
    const relatedIds = clickedObject?.groupId
      ? objects.filter((object) => object.groupId === clickedObject.groupId).map((object) => object.id)
      : [id];
    const orderedRelatedIds = [...relatedIds.filter((relatedId) => relatedId !== id), id];
    setSelectedIds((current) => {
      if (!additive) return orderedRelatedIds;
      if (orderedRelatedIds.every((relatedId) => current.includes(relatedId))) {
        return current.filter((selected) => !orderedRelatedIds.includes(selected));
      }
      return [...new Set([...current, ...orderedRelatedIds.filter((relatedId) => relatedId !== id), id])];
    });
  }

  function openObjectContextMenu(id: string, x: number, y: number) {
    const clickedObject = objects.find((object) => object.id === id);
    if (!clickedObject) return;
    const selectedTargetIds = selectedIds.includes(id)
      ? clickedObject.groupId && selectedIds.length === 1
        ? objects.filter((object) => object.groupId === clickedObject.groupId).map((object) => object.id)
        : selectedIds
      : clickedObject.groupId
        ? objects.filter((object) => object.groupId === clickedObject.groupId).map((object) => object.id)
        : [id];
    setSelectedIds(selectedTargetIds);
    setObjectContextMenu({
      objectIds: selectedTargetIds,
      x: Math.max(8, Math.min(x, window.innerWidth - 250)),
      y: Math.max(8, Math.min(y, window.innerHeight - 230)),
    });
  }

  function addObject(type: ShapeType) {
    const object = createPrimitive(type, objects);
    setObjects((current) => [...current, object]);
    selectObject(object.id);
  }

  function updateObjectField(id: string, field: "position" | "rotation" | "scale", axis: Axis, value: number) {
    setObjects((current) => current.map((object) => {
      if (object.id !== id || object.locked) return object;
      const next = [...object[field]] as Vector3Tuple;
      next[axis] = value;
      return { ...object, [field]: next };
    }));
    setSaveNotice("");
  }

  const commitTransform = useCallback((id: string, position: Vector3Tuple, rotation: Vector3Tuple, scale: Vector3Tuple) => {
    setObjects((current) => {
      const activeObject = current.find((object) => object.id === id);
      if (!activeObject || activeObject.locked) return current;
      if (!activeObject.groupId) {
        return current.map((object) => object.id === id ? { ...object, position, rotation, scale } : object);
      }

      const previousPosition = new Vector3(...activeObject.position);
      const nextPosition = new Vector3(...position);
      const previousRotation = new Quaternion().setFromEuler(new Euler(...activeObject.rotation));
      const nextRotation = new Quaternion().setFromEuler(new Euler(...rotation));
      const rotationDelta = nextRotation.clone().multiply(previousRotation.clone().invert());
      const scaleRatio = scale.map((value, axis) => value / Math.max(activeObject.scale[axis], 0.0001)) as Vector3Tuple;

      return current.map((object) => {
        if (object.groupId !== activeObject.groupId || object.locked) return object;
        if (object.id === id) return { ...object, position, rotation, scale };

        const relativePosition = new Vector3(...object.position)
          .sub(previousPosition)
          .applyQuaternion(previousRotation.clone().invert());
        relativePosition.set(
          relativePosition.x * scaleRatio[0],
          relativePosition.y * scaleRatio[1],
          relativePosition.z * scaleRatio[2],
        );
        relativePosition.applyQuaternion(nextRotation).add(nextPosition);

        const objectRotation = new Quaternion().setFromEuler(new Euler(...object.rotation));
        const nextObjectRotation = rotationDelta.clone().multiply(objectRotation);
        const nextEuler = new Euler().setFromQuaternion(nextObjectRotation);

        return {
          ...object,
          position: [relativePosition.x, relativePosition.y, relativePosition.z],
          rotation: [nextEuler.x, nextEuler.y, nextEuler.z],
          scale: [
            object.scale[0] * scaleRatio[0],
            object.scale[1] * scaleRatio[1],
            object.scale[2] * scaleRatio[2],
          ],
        };
      });
    });
    setSaveNotice("");
  }, []);

  function toggleVisibility(id: string) {
    setObjects((current) => current.map((object) => object.id === id ? { ...object, visible: !object.visible } : object));
  }

  function toggleLock(ids: string[]) {
    const shouldUnlock = objects.filter((object) => ids.includes(object.id)).every((object) => object.locked);
    setObjects((current) => current.map((object) => ids.includes(object.id) ? { ...object, locked: !shouldUnlock } : object));
  }

  function updateColor(ids: string[], color: string) {
    setObjects((current) => current.map((object) => ids.includes(object.id) ? { ...object, color } : object));
  }

  function updateSegments(id: string, segments: number) {
    setObjects((current) => current.map((object) => object.id === id && !object.locked ? { ...object, segments } : object));
  }

  function deleteObject(id: string) {
    setObjects((current) => current.filter((object) => object.id !== id));
    setSelectedIds((current) => current.filter((selected) => selected !== id));
  }

  function mergeSelectedObjects(ids = selectedObjects.map((object) => object.id)) {
    const mergeIds = ids;
    try {
      const merged = mergeObjects(objects, mergeIds);
      setObjects((current) => [...current.filter((object) => !mergeIds.includes(object.id)), merged]);
      setSelectedIds([merged.id]);
      setObjectContextMenu(null);
      setSaveNotice("Les formes sont fusionnées en un seul solide.");
    } catch (error) {
      console.error("Impossible de fusionner ces formes.", error);
      setSaveNotice(error instanceof Error ? error.message : "Impossible de fusionner ces formes.");
    }
  }

  function groupObjects(ids: string[]) {
    if (ids.length < 2) return;
    const groupId = `group-${Date.now()}`;
    setObjects((current) => current.map((object) => ids.includes(object.id) ? { ...object, groupId } : object));
    setObjectContextMenu(null);
    setSaveNotice("Pièces assemblées : elles restent modifiables.");
  }

  function ungroupObjects(ids: string[]) {
    const groupIds = new Set(
      objects
        .filter((object) => ids.includes(object.id))
        .map((object) => object.groupId)
        .filter((groupId): groupId is string => Boolean(groupId)),
    );
    setObjects((current) => current.map((object) => {
      if (!object.groupId || !groupIds.has(object.groupId)) return object;
      const { groupId: _groupId, ...ungroupedObject } = object;
      return ungroupedObject;
    }));
    setObjectContextMenu(null);
    setSaveNotice("Les pièces du groupe sont séparées.");
  }

  function saveProject() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ name: projectName, objects }));
      setSaveNotice("Projet enregistré sur cet appareil.");
      window.setTimeout(() => setSaveNotice(""), 2400);
    } catch (error) {
      console.error("Impossible d’enregistrer le projet.", error);
      setSaveNotice("Enregistrement impossible : vérifie l’espace disponible.");
    }
  }

  function printProject() {
    setSaveNotice("L’export pour imprimante 3D sera disponible bientôt.");
    window.setTimeout(() => setSaveNotice(""), 3000);
  }

  useEffect(() => {
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch (error) {
      console.error("Impossible d’enregistrer le thème.", error);
    }
  }, [theme]);

  useEffect(() => {
    if (!objectContextMenu) return;
    function dismissContextMenu(event: PointerEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setObjectContextMenu(null);
        return;
      }
      if (event instanceof PointerEvent && event.target instanceof Element && !event.target.closest(".object-context-menu")) {
        setObjectContextMenu(null);
      }
    }
    document.addEventListener("pointerdown", dismissContextMenu);
    document.addEventListener("keydown", dismissContextMenu);
    return () => {
      document.removeEventListener("pointerdown", dismissContextMenu);
      document.removeEventListener("keydown", dismissContextMenu);
    };
  }, [objectContextMenu]);

  function resizeSidePanel(side: "left" | "right", delta: number) {
    if (side === "left") setLeftPanelWidth((width) => Math.min(420, Math.max(190, width + delta)));
    else setRightPanelWidth((width) => Math.min(560, Math.max(300, width - delta)));
  }

  function resizeInspector(delta: number) {
    setInspectorHeight((height) => Math.min(620, Math.max(250, height + delta)));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable='true']")) return;
      if (event.key.toLowerCase() === "w") setMode("translate");
      if (event.key.toLowerCase() === "e") setMode("rotate");
      if (event.key.toLowerCase() === "r") setMode("scale");
      if (event.key === "Delete" && selectedIds.length) {
        selectedIds.forEach(deleteObject);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, objects]);

  return (
    <main className="pro-studio" data-theme={theme}>
      <header className="studio-header">
        <div className="studio-brand">
          <div className="brand-symbol"><Grid2X2 size={18} /></div>
          <span>KUBI<span className="brand-muted"> / STUDIO</span></span>
          <span className="junior-badge">JUNIOR</span>
        </div>
        <div className="project-name-bar">
          <span className="project-breadcrumb">MES PROJETS <ChevronRight size={13} /></span>
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} aria-label="Nom du projet" />
        </div>
        <div className="header-actions">
          <span className="save-state"><span /> Sauvegarde manuelle</span>
          <button className="save-action" type="button" onClick={saveProject} title="Enregistrer le projet"><Check size={16} /> Enregistrer</button>
          <div className="theme-picker">
            <button
              type="button"
              className="theme-picker-trigger"
              aria-label={`Thème : ${themes.find((item) => item.id === theme)?.label}`}
              aria-expanded={themeMenuOpen}
              title="Changer de thème"
              onClick={() => setThemeMenuOpen((open) => !open)}
            >
              <Palette size={15} />
              <span className="current-theme-dot" style={{ backgroundColor: themes.find((item) => item.id === theme)?.color }} />
            </button>
            {themeMenuOpen && (
              <div className="theme-menu" role="menu" aria-label="Choisir un thème">
                <span className="theme-menu-title">THÈME DU STUDIO</span>
                {themes.map(({ id, label, color, icon: Icon }) => (
                  <button
                    type="button"
                    key={id}
                    role="menuitemradio"
                    aria-checked={theme === id}
                    className={theme === id ? "theme-option theme-option-active" : "theme-option"}
                    onClick={() => {
                      setTheme(id);
                      setThemeMenuOpen(false);
                    }}
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                    <i style={{ backgroundColor: color }} />
                    {theme === id && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div
        className="editor-layout"
        style={{
          "--left-panel-width": `${leftPanelWidth}px`,
          "--right-panel-width": `${rightPanelWidth}px`,
        } as CSSProperties}
      >
        <aside className="left-panel" aria-label="Hiérarchie de scène et bibliothèque de formes">
          <section className="hierarchy-section">
            <div className="section-heading">
              <div><Layers3 size={15} /><h2>Objets de la scène</h2></div>
              <span className="count-badge">{objects.length}</span>
            </div>
            {selectedObjects.length > 1 && (
              <button type="button" className="merge-selection-button" onClick={() => mergeSelectedObjects()} title="Fusionner les pièces sélectionnées en un seul solide">
                <Combine size={14} /> Fusionner {selectedObjects.length} pièces
              </button>
            )}
            <div className="tree-root"><ChevronDown size={14} /><Box size={15} /><span>{projectName || "Ma scène"}</span></div>
            <div className="hierarchy-list">
              {objects.map((object, index) => {
                const Icon = shapeLibrary.find((shape) => shape.type === object.type)?.icon ?? Box;
                return (
                  <div
                    key={object.id}
                    className={`hierarchy-row ${selectedIds.includes(object.id) ? "hierarchy-row-selected" : ""}`}
                    onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) => {
                      event.preventDefault();
                      openObjectContextMenu(object.id, event.clientX, event.clientY);
                    }}
                  >
                    <span className="tree-indent" />
                    <input type="checkbox" checked={object.visible} onChange={() => toggleVisibility(object.id)} aria-label={`${object.visible ? "Masquer" : "Afficher"} ${object.name}`} />
                    <button className="hierarchy-select" type="button" onClick={(event) => selectObject(object.id, event.ctrlKey || event.metaKey)} aria-pressed={selectedIds.includes(object.id)} title="Ctrl+clic pour sélectionner plusieurs formes">
                      <Icon size={15} style={{ color: object.color }} />
                      <span>{object.name || `${object.type}_${index + 1}`}</span>
                      {object.groupId && <small className="hierarchy-group-badge">{getGroupName(object.groupId)}</small>}
                    </button>
                    <button type="button" className={`object-row-lock ${object.locked ? "object-row-locked" : ""}`} onClick={() => toggleLock([object.id])} aria-label={object.locked ? `Déverrouiller ${object.name}` : `Verrouiller ${object.name}`} title={object.locked ? "Déverrouiller" : "Verrouiller"}>
                      {object.locked ? <Lock size={13} /> : <Unlock size={13} />}
                    </button>
                  </div>
                );
              })}
              {objects.length === 0 && <p className="empty-hierarchy">Ta scène est vide.<br />Ajoute une forme pour démarrer.</p>}
            </div>
            {selectedObject && (
              <button type="button" className="delete-object-button" onClick={() => deleteObject(selectedObject.id)}><Trash2 size={13} /> Supprimer la sélection <kbd>Suppr</kbd></button>
            )}
          </section>

          <section className="library-section">
            <div className="section-heading">
              <div><Shapes size={15} /><h2>Banque de formes</h2></div>
              <button className="small-icon-button" type="button" title="Formes primitives" aria-label="Formes primitives"><ChevronDown size={14} /></button>
            </div>
            <div className="shape-library-grid">
              {shapeLibrary.map(({ type, label, icon: Icon, color }) => (
                <button className="library-tile" key={type} onClick={() => addObject(type)} type="button" title={`Ajouter ${label} à la scène`}>
                  <span className="library-icon" style={{ color }}><Icon size={20} strokeWidth={1.8} /></span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <p className="library-tip"><Sparkles size={13} /> Clique une forme pour l’ajouter.</p>
          </section>
        </aside>

        <ResizeHandle orientation="vertical" label="Ajuster le panneau gauche" onResize={(delta) => resizeSidePanel("left", delta)} />

        <section className="viewport-panel" aria-label="Vue 3D">
          <div className="viewport-toolbar">
            <div className="view-tabs" aria-label="Modes de vue">
              {(["Perspective", "Vue de Haut", "Vue de Face"] as const).map((view) => (
                <button key={view} type="button" className={viewMode === view ? "view-tab-active" : ""} onClick={() => setViewMode(view)}>{view}</button>
              ))}
            </div>
            <div className="viewport-tools">
              <span className="viewport-label"><span /> VIEWPORT 3D</span>
              <button className="print-action" type="button" onClick={printProject}><Check size={16} /> IMPRIMER EN 3D</button>
            </div>
          </div>

          <div className="transform-toolbar" role="group" aria-label="Outils de transformation">
            <span>TRANSFORMER</span>
            <button type="button" className={mode === "translate" ? "transform-active" : ""} onClick={() => setMode("translate")} title="Déplacer (W)"><Move3D size={15} /><kbd>W</kbd></button>
            <button type="button" className={mode === "rotate" ? "transform-active" : ""} onClick={() => setMode("rotate")} title="Tourner (E)"><Rotate3D size={15} /><kbd>E</kbd></button>
            <button type="button" className={mode === "scale" ? "transform-active" : ""} onClick={() => setMode("scale")} title="Redimensionner (R)"><Ruler size={15} /><kbd>R</kbd></button>
          </div>

          <div className="canvas-wrap">
            <Canvas shadows camera={{ position: [7, 6, 9], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: false }}>
              <ViewportScene
                objects={objects}
                selectedId={selectedId}
                selectedIds={selectedIds}
                mode={mode}
                viewMode={viewMode}
                theme={theme}
                viewLocked={sceneViewLocked}
                transforming={isTransforming}
                onSelect={selectObject}
                onContextMenu={openObjectContextMenu}
                onTransforming={setIsTransforming}
                onCommit={commitTransform}
              />
            </Canvas>
            {objects.length === 0 && (
              <div className="viewport-empty">
                <div><Box size={24} /></div>
                <strong>Ta scène est prête</strong>
                <span>Choisis une forme dans la banque pour commencer.</span>
              </div>
            )}
            <div className="axis-legend" aria-label="Axes 3D">
              <span><i className="axis-x-line" />X</span><span><i className="axis-y-line" />Y</span><span><i className="axis-z-line" />Z</span>
              <small>AXES</small>
            </div>
            <button
              type="button"
              className={`view-lock-button ${sceneViewLocked ? "view-locked" : ""}`}
              onClick={() => setSceneViewLocked((locked) => !locked)}
              aria-pressed={sceneViewLocked}
              title={sceneViewLocked ? "Déverrouiller la caméra de la scène" : "Verrouiller la caméra de la scène"}
            >
              {sceneViewLocked ? <LockKeyhole size={14} /> : <Unlock size={14} />}
              <span>{sceneViewLocked ? "Vue verrouillée" : "Verrouiller la vue"}</span>
            </button>
            <div className="viewport-footer"><span><span className="live-dot" /> Scène active</span><span>Grille 1 m</span><span>Perspective · 100%</span></div>
          </div>
        </section>

        <ResizeHandle orientation="vertical" label="Ajuster le panneau droit" onResize={(delta) => resizeSidePanel("right", delta)} />

        <aside
          className={`right-panel ${codeMaximized ? "code-only" : ""}`}
          aria-label="Inspecteur et éditeur de code"
          style={{ "--inspector-height": `${inspectorHeight}px` } as CSSProperties}
        >
          <Inspector
            object={selectedObject}
            selectedObjects={selectedObjects}
            collapsed={codeMaximized}
            onUpdate={updateObjectField}
            onUpdateSegments={updateSegments}
            onColorChange={updateColor}
            onToggleLock={toggleLock}
            onExpand={() => setCodeMaximized(false)}
            onCollapse={() => setCodeMaximized(true)}
          />
          {!codeMaximized && <ResizeHandle orientation="horizontal" label="Ajuster la hauteur de l’inspecteur" onResize={resizeInspector} />}
          <CodeEditor objects={objects} expanded={codeMaximized} onToggleExpand={() => setCodeMaximized((maximized) => !maximized)} />
        </aside>
      </div>
      {objectContextMenu && contextObjects.length > 0 && (
        <div
          className="object-context-menu"
          role="menu"
          aria-label="Actions sur les objets sélectionnés"
          style={{ left: objectContextMenu.x, top: objectContextMenu.y }}
        >
          <div className="context-menu-title">
            {contextObjects.length > 1 ? `${contextObjects.length} pièces sélectionnées` : contextObjects[0].name}
          </div>
          <label className="context-menu-color" title="Changer la couleur">
            <Palette size={15} />
            <span>Changer la couleur</span>
            <input
              type="color"
              value={contextObjects.every((object) => object.color === contextObjects[0].color) ? contextObjects[0].color : "#8B5CF6"}
              aria-label="Choisir la couleur"
              disabled={contextObjects.some((object) => object.locked)}
              onChange={(event) => {
                updateColor(objectContextMenu.objectIds, event.target.value);
                setObjectContextMenu(null);
              }}
            />
          </label>
          {contextObjects.length > 1 && (
            <>
              <button
                type="button"
                role="menuitem"
                className="context-menu-action context-menu-merge"
                onClick={() => mergeSelectedObjects(objectContextMenu.objectIds)}
              >
                <Combine size={15} /> Fusionner en une seule pièce
              </button>
              {canUngroupContextSelection ? (
                <button
                  type="button"
                  role="menuitem"
                  className="context-menu-action"
                  onClick={() => ungroupObjects(objectContextMenu.objectIds)}
                >
                  <Layers3 size={15} /> Dissocier le groupe
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className="context-menu-action"
                  disabled={contextObjects.some((object) => object.locked)}
                  onClick={() => groupObjects(objectContextMenu.objectIds)}
                  title="Les pièces restent séparées et modifiables, mais se déplacent ensemble."
                >
                  <Layers3 size={15} /> Grouper / assembler
                </button>
              )}
              <p className="context-menu-hint">Le groupe garde chaque pièce modifiable.</p>
            </>
          )}
        </div>
      )}
      {saveNotice && <div className="studio-toast" role="status">{saveNotice}</div>}
      <Assistant />
    </main>
  );
}

export default App;
