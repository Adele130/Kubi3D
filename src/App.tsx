import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  OrbitControls,
  Outlines,
  RoundedBox,
  TransformControls,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Group } from "three";
import {
  Box,
  Check,
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
  Move3D,
  Palette,
  Pentagon,
  Plane,
  Rotate3D,
  Ruler,
  Send,
  Settings2,
  Shapes,
  Sparkles,
  Square,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useCallback } from "react";

type ShapeType = "cube" | "sphere" | "cylinder" | "cone" | "torus" | "capsule" | "plane" | "pyramid" | "icosphere" | "octahedron" | "ring";
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
}

interface ProjectData {
  name: string;
  objects: SceneObject[];
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

const objectTypes = new Set<ShapeType>(shapeLibrary.map(({ type }) => type));
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
    typeof object.visible === "boolean"
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
      return { name: parsed.name, objects: parsed.objects.filter(isSceneObject) };
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

function createPrimitive(type: ShapeType, index: number): SceneObject {
  const preset = shapeLibrary.find((shape) => shape.type === type);
  const slot = index - 1;
  return {
    id: `${type}-${Date.now()}-${index}`,
    name: `${preset?.label ?? "Objet"}_${index + 1}`,
    type,
    position: [index === 0 ? 0 : (slot % 3 - 1) * 1.15, 0.35, index === 0 ? 0 : Math.floor(slot / 3) * 1.1 + 1],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: preset?.color ?? "#8B5CF6",
    visible: true,
  };
}

function ObjectGeometry({ object, selected, outlineColor }: { object: SceneObject; selected: boolean; outlineColor: string }) {
  const material = <meshStandardMaterial color={object.color} roughness={0.55} metalness={0.12} />;
  const outline = selected ? <Outlines thickness={2.2} color={outlineColor} /> : null;

  if (object.type === "cube") {
    return (
      <RoundedBox args={[1, 1, 1]} radius={0.08} smoothness={3} castShadow>
        {material}{outline}
      </RoundedBox>
    );
  }
  return (
    <mesh castShadow>
      {object.type === "sphere" && <sphereGeometry args={[0.62, 24, 16]} />}
      {object.type === "cylinder" && <cylinderGeometry args={[0.5, 0.5, 1, 16]} />}
      {object.type === "cone" && <coneGeometry args={[0.55, 1, 8]} />}
      {object.type === "torus" && <torusGeometry args={[0.42, 0.18, 8, 20]} />}
      {object.type === "capsule" && <capsuleGeometry args={[0.38, 1, 6, 12]} />}
      {object.type === "plane" && <boxGeometry args={[1.3, 0.08, 1.3]} />}
      {object.type === "pyramid" && <coneGeometry args={[0.65, 1, 4]} />}
      {object.type === "icosphere" && <icosahedronGeometry args={[0.62, 1]} />}
      {object.type === "octahedron" && <octahedronGeometry args={[0.65]} />}
      {object.type === "ring" && <ringGeometry args={[0.32, 0.65, 24]} />}
      {material}{outline}
    </mesh>
  );
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
  mode,
  outlineColor,
  onSelect,
  onTransforming,
  onCommit,
}: {
  object: SceneObject;
  selected: boolean;
  mode: TransformMode;
  outlineColor: string;
  onSelect: (id: string) => void;
  onTransforming: (active: boolean) => void;
  onCommit: (id: string, position: Vector3Tuple, rotation: Vector3Tuple, scale: Vector3Tuple) => void;
}) {
  const group = useRef<Group>(null);
  const commitTransform = useCallback(() => {
    if (!group.current) return;
    const { position, rotation, scale } = group.current;
    onCommit(
      object.id,
      [position.x, position.y, position.z],
      [rotation.x, rotation.y, rotation.z],
      [scale.x, scale.y, scale.z],
    );
  }, [object.id, onCommit]);

  const content = (
    <group
      ref={group}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      visible={object.visible}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
    >
      <ObjectGeometry object={object} selected={selected} outlineColor={outlineColor} />
    </group>
  );

  if (!selected || !object.visible) return content;
  return (
    <TransformControls
      mode={mode}
      onMouseDown={() => onTransforming(true)}
      onMouseUp={() => {
        commitTransform();
        onTransforming(false);
      }}
    >
      {content}
    </TransformControls>
  );
}

function ViewportScene({
  objects,
  selectedId,
  mode,
  viewMode,
  theme,
  transforming,
  onSelect,
  onTransforming,
  onCommit,
}: {
  objects: SceneObject[];
  selectedId: string | null;
  mode: TransformMode;
  viewMode: ViewMode;
  theme: ThemeName;
  transforming: boolean;
  onSelect: (id: string) => void;
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
          selected={object.id === selectedId}
          mode={mode}
          outlineColor={viewportTheme.accent}
          onSelect={onSelect}
          onTransforming={onTransforming}
          onCommit={onCommit}
        />
      ))}
      <ContactShadows position={[0, -1.26, 0]} opacity={0.4} scale={16} blur={2.5} far={5} color="#020617" />
      <OrbitControls ref={controls} makeDefault enabled={!transforming} enablePan enableDamping dampingFactor={0.08} />
    </>
  );
}

function VectorEditor({
  label,
  values,
  suffix,
  step,
  min,
  onChange,
}: {
  label: string;
  values: Vector3Tuple;
  suffix?: string;
  step?: number;
  min?: number;
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
  onUpdate,
}: {
  object: SceneObject | undefined;
  onUpdate: (id: string, field: "position" | "rotation" | "scale", axis: Axis, value: number) => void;
}) {
  return (
    <section className="inspector-section">
      <div className="panel-title-row">
        <div><span className="panel-kicker">PROPRIÉTÉS</span><h2>Inspecteur</h2></div>
        <Settings2 size={17} />
      </div>
      {!object ? (
        <div className="empty-selection"><Square size={20} /><span>Sélectionne un objet dans la scène.</span></div>
      ) : (
        <>
          <div className="selected-object-name">
            <span className="object-color-dot" style={{ backgroundColor: object.color }} />
            <strong>{object.name}</strong><span className="selected-tag">SÉLECTIONNÉ</span>
          </div>
          <VectorEditor label="Position" values={object.position} suffix="m" onChange={(axis, value) => onUpdate(object.id, "position", axis, value)} />
          <VectorEditor
            label="Rotation"
            values={object.rotation.map((radians) => radians * 180 / Math.PI) as Vector3Tuple}
            suffix="°"
            step={1}
            onChange={(axis, value) => onUpdate(object.id, "rotation", axis, value * Math.PI / 180)}
          />
          <VectorEditor label="Échelle" values={object.scale} step={0.1} min={0.1} onChange={(axis, value) => onUpdate(object.id, "scale", axis, Math.max(0.1, value))} />
        </>
      )}
      <div className="inspector-note"><span className="note-dot" /> Les valeurs se mettent à jour avec le Gizmo.</div>
    </section>
  );
}

function CodeEditor({ object }: { object: SceneObject | undefined }) {
  const [mode, setMode] = useState<CodeMode>("blocks");
  return (
    <section className="code-section">
      <div className="code-heading">
        <div><span className="panel-kicker">APPRENTISSAGE</span><h2>Mon code</h2></div>
        <div className="code-tabs" role="tablist" aria-label="Mode de programmation">
          <button type="button" className={mode === "blocks" ? "code-tab-active" : ""} onClick={() => setMode("blocks")} role="tab" aria-selected={mode === "blocks"}>Blocs</button>
          <button type="button" className={mode === "text" ? "code-tab-active" : ""} onClick={() => setMode("text")} role="tab" aria-selected={mode === "text"}>Code Texte</button>
        </div>
      </div>
      {mode === "blocks" ? (
        <div className="block-workspace" role="tabpanel">
          <div className="block-block block-event"><span className="block-notch" />Quand je lance mon bolide</div>
          <div className="block-block block-add"><span className="block-notch" />Ajouter <strong>{object?.type ?? "cube"}</strong> à la scène</div>
          <div className="block-block block-move"><span className="block-notch" />Déplacer sur <strong>X</strong> de <strong>5</strong></div>
          <div className="block-hint"><Sparkles size={13} /> Assemble les blocs pour coder ton objet.</div>
        </div>
      ) : (
        <div className="text-editor" role="tabpanel" aria-label="Éditeur de code texte">
          <div className="editor-file"><Code2 size={14} /><span>mon_bolide.py</span><span className="editor-dot" /></div>
          <pre><code>
            <span className="code-line"><i>1</i><b className="syntax-variable">voiture</b> <em>=</em> <b className="syntax-type">Object3D</b>(<b className="syntax-string">&quot;Mon_Bolide&quot;</b>)</span>
            <span className="code-line"><i>2</i><b className="syntax-variable">voiture</b>.<b className="syntax-function">add</b>(<b className="syntax-function">cube</b>(<b className="syntax-number">10</b>, <b className="syntax-number">5</b>, <b className="syntax-number">2</b>))</span>
            <span className="code-line"><i>3</i><b className="syntax-variable">voiture</b>.<b className="syntax-function">move_x</b>(<b className="syntax-number">5</b>)</span>
            <span className="code-line"><i>4</i><b className="syntax-comment"># à toi de jouer !</b></span>
          </code></pre>
          <div className="code-status"><span /> Python junior <span className="code-status-right">3 lignes</span></div>
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
  const [selectedId, setSelectedId] = useState<string | null>(initialProject.objects[0]?.id ?? null);
  const [mode, setMode] = useState<TransformMode>("translate");
  const [viewMode, setViewMode] = useState<ViewMode>("Perspective");
  const [theme, setTheme] = useState<ThemeName>(loadTheme);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(250);
  const [rightPanelWidth, setRightPanelWidth] = useState(340);
  const [inspectorHeight, setInspectorHeight] = useState(390);
  const [saveNotice, setSaveNotice] = useState("");
  const [isTransforming, setIsTransforming] = useState(false);

  const selectedObject = objects.find((object) => object.id === selectedId);

  function addObject(type: ShapeType) {
    const object = createPrimitive(type, objects.length);
    setObjects((current) => [...current, object]);
    setSelectedId(object.id);
  }

  function updateObjectField(id: string, field: "position" | "rotation" | "scale", axis: Axis, value: number) {
    setObjects((current) => current.map((object) => {
      if (object.id !== id) return object;
      const next = [...object[field]] as Vector3Tuple;
      next[axis] = value;
      return { ...object, [field]: next };
    }));
    setSaveNotice("");
  }

  const commitTransform = useCallback((id: string, position: Vector3Tuple, rotation: Vector3Tuple, scale: Vector3Tuple) => {
    setObjects((current) => current.map((object) => object.id === id ? { ...object, position, rotation, scale } : object));
    setSaveNotice("");
  }, []);

  function toggleVisibility(id: string) {
    setObjects((current) => current.map((object) => object.id === id ? { ...object, visible: !object.visible } : object));
  }

  function deleteObject(id: string) {
    setObjects((current) => current.filter((object) => object.id !== id));
    if (selectedId === id) setSelectedId(objects.find((object) => object.id !== id)?.id ?? null);
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

  function resizeSidePanel(side: "left" | "right", delta: number) {
    if (side === "left") setLeftPanelWidth((width) => Math.min(420, Math.max(190, width + delta)));
    else setRightPanelWidth((width) => Math.min(500, Math.max(280, width - delta)));
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
      if (event.key === "Delete" && selectedId) {
        deleteObject(selectedId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, objects]);

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
            <div className="tree-root"><ChevronDown size={14} /><Box size={15} /><span>{projectName || "Ma scène"}</span></div>
            <div className="hierarchy-list">
              {objects.map((object, index) => {
                const Icon = shapeLibrary.find((shape) => shape.type === object.type)?.icon ?? Box;
                return (
                  <div key={object.id} className={`hierarchy-row ${object.id === selectedId ? "hierarchy-row-selected" : ""}`}>
                    <span className="tree-indent" />
                    <input type="checkbox" checked={object.visible} onChange={() => toggleVisibility(object.id)} aria-label={`${object.visible ? "Masquer" : "Afficher"} ${object.name}`} />
                    <button className="hierarchy-select" type="button" onClick={() => setSelectedId(object.id)} aria-pressed={object.id === selectedId}>
                      <Icon size={15} style={{ color: object.color }} />
                      <span>{object.name || `${object.type}_${index + 1}`}</span>
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
                mode={mode}
                viewMode={viewMode}
                theme={theme}
                transforming={isTransforming}
                onSelect={setSelectedId}
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
            <div className="viewport-footer"><span><span className="live-dot" /> Scène active</span><span>Grille 1 m</span><span>Perspective · 100%</span></div>
          </div>
        </section>

        <ResizeHandle orientation="vertical" label="Ajuster le panneau droit" onResize={(delta) => resizeSidePanel("right", delta)} />

        <aside
          className="right-panel"
          aria-label="Inspecteur et éditeur de code"
          style={{ "--inspector-height": `${inspectorHeight}px` } as CSSProperties}
        >
          <Inspector
            object={selectedObject}
            onUpdate={updateObjectField}
          />
          <ResizeHandle orientation="horizontal" label="Ajuster la hauteur de l’inspecteur" onResize={resizeInspector} />
          <CodeEditor object={selectedObject} />
        </aside>
      </div>
      {saveNotice && <div className="studio-toast" role="status">{saveNotice}</div>}
      <Assistant />
    </main>
  );
}

export default App;
