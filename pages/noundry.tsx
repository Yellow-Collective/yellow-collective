import Layout from "@/components/Layout";
import {
  SubmissionGalleryCard,
  getArtistPath,
} from "@/components/noundry/NoundryPreview";
import WalletIdentityLink from "@/components/WalletIdentityLink";
import { getProfilePath } from "@/utils/profile/identity";
import { isAdminAddress } from "@/utils/admin";
import type {
  PlaygroundArtwork,
  PlaygroundImage,
} from "data/nouns-builder/artwork";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import type {
  ChangeEvent,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import useSWR from "swr";

type NoundryTab = "studio" | "gallery";
type EditorTool =
  | "brush"
  | "eraser"
  | "eyedropper"
  | "fill"
  | "line"
  | "rect"
  | "rectFill"
  | "circle"
  | "circleFill"
  | "selectRect"
  | "selectCircle"
  | "move";

type NoundrySubmission = {
  id: string;
  title: string;
  artist: string;
  traitType: string;
  pixels: string[];
  selectedTraits: Record<string, string>;
  previewTraits: Record<string, string>;
  status: "pending" | "approved" | "removed";
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  removedAt?: string;
};

type SubmitDraft = {
  title: string;
  artist: string;
  traitType: string;
  pixels: string[];
  selectedTraits: Record<string, string>;
};
type PreviewLayer =
  | {
      id: string;
      trait: string;
      kind: "image";
      image: PlaygroundImage;
    }
  | {
      id: string;
      trait: string;
      kind: "pixels";
      pixels: string[];
    };
type SelectionBounds = {
  type: "rect" | "circle";
  left: number;
  right: number;
  top: number;
  bottom: number;
};
type EditorViewport = {
  scale: number;
  translateX: number;
  translateY: number;
};
type TouchPointer = {
  pointerId: number;
  clientX: number;
  clientY: number;
};
type ViewportGesture = {
  distance: number;
  midpoint: { x: number; y: number };
  viewport: EditorViewport;
};
type TouchStrokeSnapshot = {
  pixels: string[];
  undoStack: string[][];
  redoStack: string[][];
  selectionBounds: SelectionBounds | null;
  selectedColor: string;
};
type ExportScaleRequest = {
  title: string;
  resolve: (scale: number | null) => void;
};

const GRID_SIZE = 32;
const DEFAULT_COLOR = "#f8d21c";
const EMPTY_PIXEL = "transparent";
const CUSTOM_TRAIT_NAME = "custom";
const EXPORT_SCALES = [1, 2, 4, 8] as const;
const EDITABLE_TRAIT_EXCLUSIONS = new Set(["glasses"]);
const brushSizes = [1, 2, 3, 4, 6, 8];
const starterPalette = [
  "#f8d21c",
  "#181818",
  "#ffffff",
  "#d63c2f",
  "#2f80ed",
  "#27ae60",
  "#9b51e0",
  "#f2994a",
  "#7d5a3c",
  "#bdbdbd",
];

const checkerColors = ["#9a9a9a", "#858585"] as const;
const checkerboardBackground = `conic-gradient(
  ${checkerColors[0]} 25%,
  ${checkerColors[1]} 0 50%,
  ${checkerColors[0]} 0 75%,
  ${checkerColors[1]} 0
)`;

const toolLabels: Record<EditorTool, string> = {
  brush: "Brush",
  eraser: "Eraser",
  eyedropper: "Ink dropper",
  fill: "Fill",
  line: "Line",
  rect: "Square outline",
  rectFill: "Square fill",
  circle: "Circle outline",
  circleFill: "Circle fill",
  selectRect: "Square selection",
  selectCircle: "Circle selection",
  move: "Move",
};
const toolbarTools = Object.keys(toolLabels) as EditorTool[];
const MIN_EDITOR_SCALE = 1;
const MAX_EDITOR_SCALE = 4;
const DEFAULT_EDITOR_VIEWPORT: EditorViewport = {
  scale: 1,
  translateX: 0,
  translateY: 0,
};

const getPointerDistance = (first: TouchPointer, second: TouchPointer) =>
  Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);

const getPointerMidpoint = (
  first: TouchPointer,
  second: TouchPointer,
  container: HTMLDivElement
) => {
  const bounds = container.getBoundingClientRect();

  return {
    x: (first.clientX + second.clientX) / 2 - bounds.left,
    y: (first.clientY + second.clientY) / 2 - bounds.top,
  };
};

const clampValue = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load artwork.");
  }

  return data;
};

const createBlankPixels = () =>
  Array.from({ length: GRID_SIZE * GRID_SIZE }, () => EMPTY_PIXEL);

const getRandomItem = <T,>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)];

const getTraitImage = (
  images: PlaygroundImage[],
  trait: string,
  selectedName?: string
) =>
  images.find((image) => image.trait === trait && image.name === selectedName);

const getArtworkRenderTraits = (artwork: PlaygroundArtwork) => [
  ...artwork.renderLayers,
  ...artwork.orderedLayers
    .map((layer) => layer.trait)
    .filter((trait) => !artwork.renderLayers.includes(trait)),
];

const getPreviewLayers = ({
  artwork,
  traits,
  visibleTraits,
  activeTrait,
  activePixels,
  customTraitPixels,
}: {
  artwork: PlaygroundArtwork;
  traits: Record<string, string>;
  visibleTraits: Record<string, boolean>;
  activeTrait: string;
  activePixels: string[];
  customTraitPixels: Record<string, string[]>;
}) =>
  getArtworkRenderTraits(artwork)
    .filter((trait) => visibleTraits[trait] !== false)
    .map((trait): PreviewLayer | null => {
      if (trait === activeTrait) {
        return {
          id: `${trait}-active-pixels`,
          trait,
          kind: "pixels",
          pixels: activePixels,
        };
      }

      if (traits[trait] === CUSTOM_TRAIT_NAME && customTraitPixels[trait]) {
        return {
          id: `${trait}-custom-pixels`,
          trait,
          kind: "pixels",
          pixels: customTraitPixels[trait],
        };
      }

      const image = getTraitImage(artwork.images, trait, traits[trait]);
      if (!image) return null;

      return {
        id: `${trait}-${image.name}`,
        trait,
        kind: "image",
        image,
      };
    })
    .filter((layer): layer is PreviewLayer => Boolean(layer));

const getSubmissionPreviewTraits = (submission: NoundrySubmission) =>
  Object.keys(submission.previewTraits || {}).length > 0
    ? submission.previewTraits
    : submission.selectedTraits || {};

const layerLabels: Record<string, string> = {
  accessories: "Accessory",
  backgrounds: "Background",
  bodies: "Body",
  glasses: "Noggles",
  heads: "Head",
};

const getLayerLabel = (trait: string) =>
  layerLabels[trait] || trait.replace(/[-_]+/g, " ");

const isEditableLayer = (trait: string) =>
  !EDITABLE_TRAIT_EXCLUSIONS.has(trait);

const getPixelPoint = (index: number) => ({
  x: index % GRID_SIZE,
  y: Math.floor(index / GRID_SIZE),
});

const toHexColor = (red: number, green: number, blue: number) =>
  `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;

const loadHtmlImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const imageToPixels = async (src: string) => {
  const image = await loadHtmlImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return createBlankPixels();

  context.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
  context.drawImage(image, 0, 0, GRID_SIZE, GRID_SIZE);
  const imageData = context.getImageData(0, 0, GRID_SIZE, GRID_SIZE).data;

  return Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
    const offset = index * 4;
    const alpha = imageData[offset + 3];
    if (alpha < 16) return EMPTY_PIXEL;

    return toHexColor(
      imageData[offset],
      imageData[offset + 1],
      imageData[offset + 2]
    );
  });
};

const drawPixelsToContext = (
  context: CanvasRenderingContext2D,
  pixels: string[],
  scale: number
) => {
  pixels.forEach((color, index) => {
    if (color === EMPTY_PIXEL) return;
    context.fillStyle = color;
    context.fillRect(
      (index % GRID_SIZE) * scale,
      Math.floor(index / GRID_SIZE) * scale,
      scale,
      scale
    );
  });
};

const collectPreviewColors = async (previewLayers: PreviewLayer[]) => {
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return [];

  context.clearRect(0, 0, GRID_SIZE, GRID_SIZE);

  for (const layer of previewLayers) {
    if (layer.kind === "pixels") {
      drawPixelsToContext(context, layer.pixels, 1);
    } else {
      try {
        const image = await loadHtmlImage(layer.image.uri);
        context.drawImage(image, 0, 0, GRID_SIZE, GRID_SIZE);
      } catch (error) {
        console.error("Unable to read preview layer colors", error);
      }
    }
  }

  const imageData = context.getImageData(0, 0, GRID_SIZE, GRID_SIZE).data;
  const colorCounts = new Map<string, number>();

  for (let offset = 0; offset < imageData.length; offset += 4) {
    if (imageData[offset + 3] < 16) continue;
    const color = toHexColor(
      imageData[offset],
      imageData[offset + 1],
      imageData[offset + 2]
    );
    colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
  }

  return Array.from(colorCounts.entries())
    .sort((first, second) => second[1] - first[1])
    .map(([color]) => color)
    .slice(0, 18);
};

const downloadCanvas = async ({
  fileName,
  previewLayers = [],
  pixels = [],
  scale = 1,
  includePreviewBackground = false,
  circleCrop = false,
  checkerboard = false,
}: {
  fileName: string;
  previewLayers?: PreviewLayer[];
  pixels?: string[];
  scale?: number;
  includePreviewBackground?: boolean;
  circleCrop?: boolean;
  checkerboard?: boolean;
}) => {
  const exportScale = Math.max(1, Math.round(scale));
  const canvasSize = GRID_SIZE * exportScale;
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvasSize, canvasSize);

  if (circleCrop) {
    context.save();
    context.beginPath();
    context.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2, 0, Math.PI * 2);
    context.clip();
  }

  if (includePreviewBackground) {
    if (checkerboard) {
      const tileSize = Math.max(1, exportScale * 2);
      for (let y = 0; y < canvasSize; y += tileSize) {
        for (let x = 0; x < canvasSize; x += tileSize) {
          const checkerIndex = (x / tileSize + y / tileSize) % 2;
          context.fillStyle = checkerColors[checkerIndex];
          context.fillRect(x, y, tileSize, tileSize);
        }
      }
    } else {
      context.fillStyle = "#ffcc00";
      context.fillRect(0, 0, canvasSize, canvasSize);
    }
  }

  if (previewLayers.length > 0) {
    for (const layer of previewLayers) {
      if (layer.kind === "pixels") {
        drawPixelsToContext(context, layer.pixels, exportScale);
      } else {
        const image = await loadHtmlImage(layer.image.uri);
        context.drawImage(image, 0, 0, canvasSize, canvasSize);
      }
    }
  } else {
    drawPixelsToContext(context, pixels, exportScale);
  }

  if (circleCrop) context.restore();

  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png");
  link.click();
};

const NoundryWalletState = ({
  onAddressChange,
}: {
  onAddressChange: (address: string | undefined) => void;
}) => {
  const { address } = useAccount();

  useEffect(() => {
    onAddressChange(address);
  }, [address, onAddressChange]);

  return null;
};

export default function NoundryPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [address, setAddress] = useState<string | undefined>();
  const {
    data: artwork,
    error: artworkError,
    isLoading,
  } = useSWR<PlaygroundArtwork>("/api/playground/artwork", fetcher);
  const { data: submissionData, error: submissionsError } = useSWR<{
    submissions: NoundrySubmission[];
  }>("/api/noundry/submissions", fetcher);
  const [activeTab, setActiveTab] = useState<NoundryTab>("studio");
  const [title, setTitle] = useState("New Yellow Trait");
  const [traitType, setTraitType] = useState("heads");
  const [selectedTraits, setSelectedTraits] = useState<Record<string, string>>(
    {}
  );
  const [visibleTraits, setVisibleTraits] = useState<Record<string, boolean>>(
    {}
  );
  const [tool, setTool] = useState<EditorTool>("brush");
  const [brushSize, setBrushSize] = useState(2);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [pixels, setPixels] = useState(createBlankPixels);
  const [customTraitPixels, setCustomTraitPixelsState] = useState<
    Record<string, string[]>
  >({});
  const [isPainting, setIsPainting] = useState(false);
  const [shapeStart, setShapeStart] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<string[][]>([]);
  const [redoStack, setRedoStack] = useState<string[][]>([]);
  const [previewColors, setPreviewColors] = useState<string[]>([]);
  const [hoveredPixel, setHoveredPixel] = useState<number | null>(null);
  const [selectionBounds, setSelectionBounds] =
    useState<SelectionBounds | null>(null);
  const [isCircleCropEnabled, setIsCircleCropEnabled] = useState(false);
  const [openTraitPicker, setOpenTraitPicker] = useState<string | null>(null);
  const [openLayerMenu, setOpenLayerMenu] = useState<string | null>(null);
  const [layerLoadError, setLayerLoadError] = useState<string | null>(null);
  const [exportScaleRequest, setExportScaleRequest] =
    useState<ExportScaleRequest | null>(null);
  const [editorViewport, setEditorViewport] = useState<EditorViewport>(
    DEFAULT_EDITOR_VIEWPORT
  );
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null);
  const editorGridRef = useRef<HTMLDivElement | null>(null);
  const layerFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingLayerLoadTraitRef = useRef<string | null>(null);
  const uploadedLayerLoadTraitRef = useRef<string | null>(null);
  const customTraitPixelsRef = useRef<Record<string, string[]>>({});
  const activeTouchPointersRef = useRef<Map<number, TouchPointer>>(new Map());
  const viewportGestureRef = useRef<ViewportGesture | null>(null);
  const activeTouchPointerIdRef = useRef<number | null>(null);
  const activeTouchPixelRef = useRef<number | null>(null);
  const touchStrokeSnapshotRef = useRef<TouchStrokeSnapshot | null>(null);
  const suppressTouchDrawRef = useRef(false);
  const selectedTraitName = selectedTraits[traitType];
  const submissions = submissionData?.submissions || [];
  const isAdmin = isMounted && isAdminAddress(address);
  const setCustomTraitPixels = (trait: string, nextPixels: string[]) => {
    const nextCustomTraitPixels = {
      ...customTraitPixelsRef.current,
      [trait]: nextPixels,
    };
    customTraitPixelsRef.current = nextCustomTraitPixels;
    setCustomTraitPixelsState(nextCustomTraitPixels);
  };
  const persistActiveCustomPixels = (nextPixels: string[]) => {
    if (selectedTraits[traitType] !== CUSTOM_TRAIT_NAME) return;
    setCustomTraitPixels(traitType, nextPixels);
  };
  const activateActiveCustomTrait = (nextPixels: string[]) => {
    setCustomTraitPixels(traitType, nextPixels);
    setSelectedTraits((currentTraits) => ({
      ...currentTraits,
      [traitType]: CUSTOM_TRAIT_NAME,
    }));
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const editableLayers = useMemo(
    () =>
      artwork?.orderedLayers.filter((layer) => isEditableLayer(layer.trait)) ||
      [],
    [artwork]
  );

  useEffect(() => {
    if (router.query.tab === "gallery") {
      setActiveTab("gallery");
    }
  }, [router.query.tab]);

  useEffect(() => {
    if (!artwork || Object.keys(selectedTraits).length > 0) return;

    const remixLayer =
      typeof router.query.remixLayer === "string"
        ? router.query.remixLayer
        : undefined;
    const remixTrait =
      typeof router.query.remixTrait === "string"
        ? router.query.remixTrait
        : undefined;
    const remixTarget = artwork.orderedLayers.find(
      (layer) =>
        layer.trait === remixLayer &&
        remixTrait !== undefined &&
        layer.properties.includes(remixTrait)
    );
    const initialTraits = Object.fromEntries(
      artwork.orderedLayers.map((layer) => [layer.trait, layer.properties[0]])
    );
    if (remixTarget && remixTrait)
      initialTraits[remixTarget.trait] = remixTrait;

    setSelectedTraits(initialTraits);
    setVisibleTraits(
      Object.fromEntries(
        artwork.orderedLayers.map((layer) => [layer.trait, true])
      )
    );
    setTraitType(
      (remixTarget && isEditableLayer(remixTarget.trait)
        ? remixTarget.trait
        : undefined) ||
        editableLayers.find((layer) => layer.trait === "heads")?.trait ||
        editableLayers[0]?.trait ||
        "heads"
    );
  }, [
    artwork,
    editableLayers,
    router.query.remixLayer,
    router.query.remixTrait,
    selectedTraits,
  ]);

  useEffect(() => {
    const stopPainting = () => {
      setIsPainting(false);
      setShapeStart(null);
    };
    window.addEventListener("mouseup", stopPainting);
    return () => window.removeEventListener("mouseup", stopPainting);
  }, []);

  useEffect(() => {
    const cancelTouchInteraction = () => {
      activeTouchPointersRef.current.clear();
      viewportGestureRef.current = null;
      activeTouchPointerIdRef.current = null;
      activeTouchPixelRef.current = null;
      touchStrokeSnapshotRef.current = null;
      suppressTouchDrawRef.current = false;
      setIsPainting(false);
      setShapeStart(null);
      setHoveredPixel(null);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") cancelTouchInteraction();
    };

    window.addEventListener("blur", cancelTouchInteraction);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", cancelTouchInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const loadSelectedTrait = async () => {
      if (!artwork || !isEditableLayer(traitType)) return;

      if (uploadedLayerLoadTraitRef.current === traitType) {
        uploadedLayerLoadTraitRef.current = null;
        return;
      }

      if (selectedTraitName === CUSTOM_TRAIT_NAME) {
        setPixels(
          customTraitPixelsRef.current[traitType] || createBlankPixels()
        );
        setUndoStack([]);
        setRedoStack([]);
        return;
      }

      const selectedImage = getTraitImage(
        artwork.images,
        traitType,
        selectedTraitName
      );
      if (!selectedImage) {
        setPixels(createBlankPixels());
        return;
      }

      try {
        const nextPixels = await imageToPixels(selectedImage.uri);
        setPixels(nextPixels);
        setUndoStack([]);
        setRedoStack([]);
      } catch (error) {
        console.error("Unable to load trait into editor", error);
      }
    };

    loadSelectedTrait();
  }, [artwork, selectedTraitName, traitType]);

  const usedColors = useMemo(
    () => (previewColors.length ? previewColors : starterPalette.slice(0, 8)),
    [previewColors]
  );
  const previewLayers = useMemo(() => {
    if (!artwork) return [];

    return getPreviewLayers({
      artwork,
      traits: selectedTraits,
      visibleTraits,
      activeTrait: traitType,
      activePixels: pixels,
      customTraitPixels,
    });
  }, [
    artwork,
    customTraitPixels,
    pixels,
    selectedTraits,
    traitType,
    visibleTraits,
  ]);
  useEffect(() => {
    let isCurrent = true;

    collectPreviewColors(previewLayers)
      .then((colors) => {
        if (isCurrent) setPreviewColors(colors);
      })
      .catch((error) => {
        console.error("Unable to collect preview colors", error);
        if (isCurrent) {
          setPreviewColors(
            Array.from(
              new Set(pixels.filter((color) => color !== EMPTY_PIXEL))
            ).slice(0, 18)
          );
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [previewLayers, pixels]);
  const workingSubmission = useMemo<NoundrySubmission>(
    () => ({
      id: "draft",
      title,
      artist: address || "",
      traitType,
      pixels,
      selectedTraits,
      previewTraits: selectedTraits,
      status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    [address, pixels, selectedTraits, title, traitType]
  );
  const previewSelectionBounds = useMemo(() => {
    if (
      shapeStart === null ||
      hoveredPixel === null ||
      !isPainting ||
      (tool !== "selectRect" && tool !== "selectCircle")
    ) {
      return null;
    }

    return getSelectionBounds(
      shapeStart,
      hoveredPixel,
      tool === "selectRect" ? "rect" : "circle"
    );
  }, [hoveredPixel, isPainting, shapeStart, tool]);
  const displayedSelectionBounds = previewSelectionBounds || selectionBounds;

  const commitPixels = (nextPixels: string[]) => {
    setUndoStack((currentStack) => [...currentStack.slice(-24), pixels]);
    setRedoStack([]);
    activateActiveCustomTrait(nextPixels);
    setPixels(nextPixels);
  };

  const applyDrawingTool = (currentPixels: string[], index: number) => {
    if (tool === "fill") return fillPixels(currentPixels, index, selectedColor);

    const nextPixels = [...currentPixels];
    const centerX = index % GRID_SIZE;
    const centerY = Math.floor(index / GRID_SIZE);
    const radius = Math.max(0, Math.floor(brushSize / 2));
    const color = tool === "eraser" ? EMPTY_PIXEL : selectedColor;

    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) continue;
        nextPixels[y * GRID_SIZE + x] = color;
      }
    }

    return nextPixels;
  };

  const beginPixelAction = (index: number) => {
    if (tool === "eyedropper") {
      const color = pixels[index];
      if (color !== EMPTY_PIXEL) setSelectedColor(color);
      return;
    }

    if (isShapeTool(tool)) {
      if (tool === "selectRect" || tool === "selectCircle") {
        setSelectionBounds(null);
      }
      setShapeStart(index);
      setIsPainting(true);
      return;
    }

    setSelectionBounds(null);
    setIsPainting(true);
    commitPixels(applyDrawingTool(pixels, index));
  };

  const continuePixelAction = (index: number) => {
    if (!isPainting || isShapeTool(tool) || tool === "eyedropper") return;
    setPixels((currentPixels) => {
      const nextPixels = applyDrawingTool(currentPixels, index);
      setCustomTraitPixels(traitType, nextPixels);
      return nextPixels;
    });
  };

  const endPixelAction = (index: number) => {
    setIsPainting(false);

    if (!isShapeTool(tool) || shapeStart === null) return;

    if (tool === "selectRect" || tool === "selectCircle") {
      setSelectionBounds(
        getSelectionBounds(
          shapeStart,
          index,
          tool === "selectRect" ? "rect" : "circle"
        )
      );
      setShapeStart(null);
      return;
    }

    if (tool === "move") {
      commitPixels(movePixels(pixels, shapeStart, index, selectionBounds));
      setSelectionBounds(null);
      setShapeStart(null);
      return;
    }

    setSelectionBounds(null);
    commitPixels(drawShape(pixels, shapeStart, index, tool, selectedColor));
    setShapeStart(null);
  };

  const undoCanvas = () => {
    const previousPixels = undoStack[undoStack.length - 1];
    if (!previousPixels) return;

    setRedoStack((currentStack) => [...currentStack, pixels]);
    persistActiveCustomPixels(previousPixels);
    setPixels(previousPixels);
    setUndoStack((currentStack) => currentStack.slice(0, -1));
  };

  const redoCanvas = () => {
    const nextPixels = redoStack[redoStack.length - 1];
    if (!nextPixels) return;

    setUndoStack((currentStack) => [...currentStack, pixels]);
    persistActiveCustomPixels(nextPixels);
    setPixels(nextPixels);
    setRedoStack((currentStack) => currentStack.slice(0, -1));
  };

  const clearCanvas = () => commitPixels(createBlankPixels());

  const requestExportScale = (title: string) =>
    new Promise<number | null>((resolve) => {
      setExportScaleRequest({ title, resolve });
    });

  const resolveExportScale = (scale: number | null) => {
    exportScaleRequest?.resolve(scale);
    setExportScaleRequest(null);
  };

  const exportEditedTrait = async (trait = traitType) => {
    const scale = await requestExportScale(
      `Export ${getLayerLabel(trait).toLowerCase()}`
    );
    if (!scale) return;

    let exportPixels = pixels;
    const exportedTraitName = selectedTraits[trait] || "draft";

    if (trait !== traitType && artwork) {
      if (selectedTraits[trait] === CUSTOM_TRAIT_NAME) {
        exportPixels = customTraitPixels[trait] || createBlankPixels();
      } else {
        const selectedImage = getTraitImage(
          artwork.images,
          trait,
          selectedTraits[trait]
        );
        exportPixels = selectedImage
          ? await imageToPixels(selectedImage.uri)
          : createBlankPixels();
      }
    }

    downloadCanvas({
      fileName: `${getLayerLabel(trait).toLowerCase()}-${exportedTraitName}.png`,
      pixels: exportPixels,
      scale,
    }).catch((error) => console.error("Unable to export trait", error));
  };

  const exportFullPreview = async () => {
    const scale = await requestExportScale("Export preview");
    if (!scale) return;

    downloadCanvas({
      fileName: "yellow-collective-noundry-preview.png",
      previewLayers,
      scale,
      includePreviewBackground: true,
      circleCrop: isCircleCropEnabled,
      checkerboard: visibleTraits.backgrounds === false,
    }).catch((error) => console.error("Unable to export preview", error));
  };

  const updateCollectionTrait = (trait: string, value: string) => {
    setSelectedTraits((currentTraits) => ({
      ...currentTraits,
      [trait]: value,
    }));
  };

  const randomizeTrait = (trait: string) => {
    const layer = artwork?.orderedLayers.find((item) => item.trait === trait);
    if (!layer) return;
    updateCollectionTrait(trait, getRandomItem(layer.properties));
  };

  const randomizeAllTraits = () => {
    if (!artwork) return;

    setSelectedTraits(
      Object.fromEntries(
        artwork.orderedLayers.map((layer) => [
          layer.trait,
          getRandomItem(layer.properties),
        ])
      )
    );
  };

  const requestLayerFileLoad = (trait: string) => {
    pendingLayerLoadTraitRef.current = trait;
    setLayerLoadError(null);
    setTraitType(trait);
    setOpenLayerMenu(null);

    if (layerFileInputRef.current) {
      layerFileInputRef.current.value = "";
      layerFileInputRef.current.click();
    }
  };

  const handleLayerFileLoad = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const trait = pendingLayerLoadTraitRef.current;
    pendingLayerLoadTraitRef.current = null;

    if (!file || !trait) return;

    if (!file.type.startsWith("image/")) {
      setLayerLoadError("Load an image file for that trait layer.");
      console.error("Unsupported Noundry layer file type", file.type);
      event.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    try {
      const nextPixels = await imageToPixels(objectUrl);
      uploadedLayerLoadTraitRef.current = trait;
      setCustomTraitPixels(trait, nextPixels);
      setTraitType(trait);
      setSelectedTraits((currentTraits) => ({
        ...currentTraits,
        [trait]: CUSTOM_TRAIT_NAME,
      }));
      setPixels(nextPixels);
      setUndoStack([]);
      setRedoStack([]);
      setLayerLoadError(null);
    } catch (error) {
      setLayerLoadError("Unable to load that image into the trait layer.");
      console.error("Unable to load trait layer file", error);
    } finally {
      URL.revokeObjectURL(objectUrl);
      event.target.value = "";
    }
  };

  const loadCollectiveNounById = async () => {
    if (!artwork) return;

    const requestedId = window.prompt("Collective Noun ID");
    if (!requestedId) return;

    try {
      const response = await fetch("/api/probe/tokens");
      const data = await response.json();
      const token = data.tokens?.find(
        (item: { id: number }) => String(item.id) === requestedId.trim()
      );

      if (!response.ok || !token) return;

      setSelectedTraits((currentTraits) => {
        const nextTraits = { ...currentTraits };

        artwork.orderedLayers.forEach((layer) => {
          const tokenValue =
            token.attributes?.[layer.trait] ||
            token.attributes?.[getLayerLabel(layer.trait)] ||
            token.attributes?.[getLayerLabel(layer.trait).toLowerCase()];

          if (tokenValue && layer.properties.includes(tokenValue)) {
            nextTraits[layer.trait] = tokenValue;
          }
        });

        return nextTraits;
      });
    } catch (error) {
      console.error("Unable to load Collective Noun by ID", error);
    }
  };

  const loadSubmission = (submission: NoundrySubmission) => {
    setTitle(`Remix: ${submission.title}`);
    setCustomTraitPixels(submission.traitType, submission.pixels);
    setTraitType(submission.traitType);
    setPixels(submission.pixels);
    setSelectedTraits(getSubmissionPreviewTraits(submission));
    setActiveTab("studio");
  };

  const submitToGallery = () => {
    const draft: SubmitDraft = {
      title,
      artist: address || "",
      traitType,
      pixels,
      selectedTraits,
    };

    window.sessionStorage.setItem(
      "noundry-submit-draft",
      JSON.stringify(draft)
    );
    router.push("/noundry/submit");
  };

  const clampEditorViewport = (viewport: EditorViewport): EditorViewport => {
    const surface = editorSurfaceRef.current;
    const grid = editorGridRef.current;
    const scale = clampValue(
      viewport.scale,
      MIN_EDITOR_SCALE,
      MAX_EDITOR_SCALE
    );

    if (!surface || !grid || scale <= MIN_EDITOR_SCALE) {
      return { ...DEFAULT_EDITOR_VIEWPORT, scale };
    }

    const surfaceWidth = surface.clientWidth;
    const surfaceHeight = surface.clientHeight;
    const contentWidth = grid.offsetWidth * scale;
    const contentHeight = grid.offsetHeight * scale;
    const xPadding = Math.min(96, surfaceWidth * 0.25);
    const yPadding = Math.min(96, surfaceHeight * 0.25);
    const translateX =
      contentWidth <= surfaceWidth
        ? (surfaceWidth - contentWidth) / 2
        : clampValue(
            viewport.translateX,
            surfaceWidth - contentWidth - xPadding,
            xPadding
          );
    const translateY =
      contentHeight <= surfaceHeight
        ? (surfaceHeight - contentHeight) / 2
        : clampValue(
            viewport.translateY,
            surfaceHeight - contentHeight - yPadding,
            yPadding
          );

    return {
      scale: Number(scale.toFixed(3)),
      translateX: Number(translateX.toFixed(2)),
      translateY: Number(translateY.toFixed(2)),
    };
  };

  const getPixelIndexFromPoint = (clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY);
    const pixelElement = target?.closest?.("[data-noundry-pixel]");

    if (!pixelElement || !editorGridRef.current?.contains(pixelElement)) {
      return null;
    }

    const pixelIndex = Number((pixelElement as HTMLElement).dataset.pixelIndex);

    return Number.isInteger(pixelIndex) ? pixelIndex : null;
  };

  const getGesturePointers = () =>
    Array.from(activeTouchPointersRef.current.values()).slice(0, 2);

  const startViewportGesture = () => {
    const surface = editorSurfaceRef.current;
    const [firstPointer, secondPointer] = getGesturePointers();

    if (!surface || !firstPointer || !secondPointer) return;

    viewportGestureRef.current = {
      distance: getPointerDistance(firstPointer, secondPointer),
      midpoint: getPointerMidpoint(firstPointer, secondPointer, surface),
      viewport: editorViewport,
    };
  };

  const restoreTouchStrokeSnapshot = () => {
    const snapshot = touchStrokeSnapshotRef.current;
    if (!snapshot) return;

    persistActiveCustomPixels(snapshot.pixels);
    setPixels(snapshot.pixels);
    setUndoStack(snapshot.undoStack);
    setRedoStack(snapshot.redoStack);
    setSelectionBounds(snapshot.selectionBounds);
    setSelectedColor(snapshot.selectedColor);
    setIsPainting(false);
    setShapeStart(null);
    setHoveredPixel(null);
    activeTouchPointerIdRef.current = null;
    activeTouchPixelRef.current = null;
    touchStrokeSnapshotRef.current = null;
  };

  const handleEditorPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (event.pointerType === "mouse") return;

    event.preventDefault();
    activeTouchPointersRef.current.set(event.pointerId, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (error) {
      console.error("Unable to capture Noundry editor pointer", error);
    }

    if (activeTouchPointersRef.current.size >= 2) {
      restoreTouchStrokeSnapshot();
      suppressTouchDrawRef.current = true;
      startViewportGesture();
      return;
    }

    if (suppressTouchDrawRef.current) return;

    const pixelIndex = getPixelIndexFromPoint(event.clientX, event.clientY);
    if (pixelIndex === null) return;

    touchStrokeSnapshotRef.current = {
      pixels,
      undoStack,
      redoStack,
      selectionBounds,
      selectedColor,
    };
    activeTouchPointerIdRef.current = event.pointerId;
    activeTouchPixelRef.current = pixelIndex;
    setHoveredPixel(pixelIndex);
    beginPixelAction(pixelIndex);
  };

  const handleEditorPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (
      event.pointerType === "mouse" ||
      !activeTouchPointersRef.current.has(event.pointerId)
    ) {
      return;
    }

    event.preventDefault();
    activeTouchPointersRef.current.set(event.pointerId, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (activeTouchPointersRef.current.size >= 2) {
      const surface = editorSurfaceRef.current;
      const [firstPointer, secondPointer] = getGesturePointers();
      if (!surface || !firstPointer || !secondPointer) return;
      if (!viewportGestureRef.current) startViewportGesture();
      const gesture = viewportGestureRef.current;
      if (!gesture || !gesture.distance) return;

      const distance = getPointerDistance(firstPointer, secondPointer);
      const midpoint = getPointerMidpoint(firstPointer, secondPointer, surface);
      const nextScale = clampValue(
        gesture.viewport.scale * (distance / gesture.distance),
        MIN_EDITOR_SCALE,
        MAX_EDITOR_SCALE
      );
      const contentX =
        (gesture.midpoint.x - gesture.viewport.translateX) /
        gesture.viewport.scale;
      const contentY =
        (gesture.midpoint.y - gesture.viewport.translateY) /
        gesture.viewport.scale;

      setEditorViewport(
        clampEditorViewport({
          scale: nextScale,
          translateX: midpoint.x - contentX * nextScale,
          translateY: midpoint.y - contentY * nextScale,
        })
      );
      return;
    }

    if (
      suppressTouchDrawRef.current ||
      activeTouchPointerIdRef.current !== event.pointerId ||
      activeTouchPixelRef.current === null
    ) {
      return;
    }

    const pixelIndex = getPixelIndexFromPoint(event.clientX, event.clientY);
    if (pixelIndex === null) return;

    activeTouchPixelRef.current = pixelIndex;
    setHoveredPixel(pixelIndex);
    continuePixelAction(pixelIndex);
  };

  const finishEditorPointer = (
    event: ReactPointerEvent<HTMLDivElement>,
    shouldCommitTouchDraw: boolean
  ) => {
    if (event.pointerType === "mouse") return;

    event.preventDefault();
    const wasViewportGesture =
      viewportGestureRef.current !== null ||
      activeTouchPointersRef.current.size >= 2 ||
      suppressTouchDrawRef.current;

    if (
      shouldCommitTouchDraw &&
      !wasViewportGesture &&
      activeTouchPointerIdRef.current === event.pointerId &&
      activeTouchPixelRef.current !== null
    ) {
      endPixelAction(
        getPixelIndexFromPoint(event.clientX, event.clientY) ??
          activeTouchPixelRef.current
      );
    } else if (
      !shouldCommitTouchDraw &&
      activeTouchPointerIdRef.current === event.pointerId
    ) {
      setIsPainting(false);
      setShapeStart(null);
      setHoveredPixel(null);
    } else if (wasViewportGesture) {
      setIsPainting(false);
      setShapeStart(null);
      setHoveredPixel(null);
    }

    activeTouchPointersRef.current.delete(event.pointerId);

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch (error) {
      console.error("Unable to release Noundry editor pointer", error);
    }

    if (activeTouchPointersRef.current.size < 2) {
      viewportGestureRef.current = null;
    }

    if (activeTouchPointersRef.current.size === 0) {
      activeTouchPointerIdRef.current = null;
      activeTouchPixelRef.current = null;
      touchStrokeSnapshotRef.current = null;
      suppressTouchDrawRef.current = false;
    }
  };

  return (
    <Layout>
      {isMounted ? <NoundryWalletState onAddressChange={setAddress} /> : null}
      <Head>
        <title>Noundry | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 pb-12">
        <section className="yc-dark-yellow-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="text-center lg:text-left">
              <h1 className="font-heading text-[42px] leading-none text-skin-base md:text-[58px]">
                Noundry
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-snug text-[#212529] md:text-lg">
                Create fresh Yellow Collective traits, remix submissions, and
                assemble them against the live collection.
              </p>
            </div>
            <div className="flex w-full gap-1.5 rounded-xl border border-[rgb(var(--color-selector-stroke))] bg-[#f1f1f1] p-1 shadow-[0px_4px_0px_0px_rgb(var(--color-selector-stroke))] lg:w-fit">
              {(["studio", "gallery"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-lg px-5 py-3 font-heading text-base capitalize transition lg:flex-none ${
                    activeTab === tab
                      ? "translate-y-[-1px] bg-accent text-skin-base shadow-[0px_3px_0px_0px_#b89400]"
                      : "text-secondary hover:bg-[#fff7bf] hover:text-skin-base"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </section>

        {isLoading && (
          <section className="yc-dark-yellow-surface rounded-2xl border border-skin-stroke bg-white p-6 text-secondary shadow-sm">
            Loading artwork...
          </section>
        )}

        {artworkError && (
          <section className="yc-dark-yellow-surface rounded-2xl border border-skin-stroke bg-white p-6 text-skin-proposal-danger shadow-sm">
            {artworkError.message}
          </section>
        )}

        {activeTab === "studio" && artwork && (
          <section className="grid items-stretch gap-6 xl:grid-cols-[118px_minmax(420px,1fr)_380px]">
            <div className="order-2 xl:order-1">
              <ToolRail
                tool={tool}
                brushSize={brushSize}
                selectedColor={selectedColor}
                usedColors={usedColors}
                canUndo={undoStack.length > 0}
                canRedo={redoStack.length > 0}
                onToolChange={setTool}
                onBrushSizeChange={setBrushSize}
                onColorChange={setSelectedColor}
                onUndo={undoCanvas}
                onRedo={redoCanvas}
              />
            </div>

            <div className="yc-dark-yellow-surface relative order-1 h-full rounded-2xl border border-skin-stroke bg-white p-3 shadow-sm sm:p-5 xl:order-2">
              <div
                ref={editorSurfaceRef}
                className="max-h-[72vh] overflow-auto rounded-xl"
                onPointerDown={handleEditorPointerDown}
                onPointerMove={handleEditorPointerMove}
                onPointerUp={(event) => finishEditorPointer(event, true)}
                onPointerCancel={(event) => finishEditorPointer(event, false)}
                onLostPointerCapture={(event) =>
                  finishEditorPointer(event, false)
                }
                style={
                  {
                    touchAction: "none",
                    overscrollBehavior: "contain",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
                  } as CSSProperties & { WebkitTouchCallout: "none" }
                }
              >
                <div
                  className="min-w-full"
                  style={{
                    transform: `translate3d(${editorViewport.translateX}px, ${editorViewport.translateY}px, 0) scale(${editorViewport.scale})`,
                    transformOrigin: "top left",
                    willChange: "transform",
                  }}
                >
                  <div
                    ref={editorGridRef}
                    className="grid aspect-square w-full overflow-hidden rounded-xl border border-skin-stroke bg-[#909090]"
                    style={{
                      gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                      backgroundImage: checkerboardBackground,
                      backgroundSize: `${200 / GRID_SIZE}% ${200 / GRID_SIZE}%`,
                    }}
                    onMouseLeave={() => setHoveredPixel(null)}
                  >
                    {pixels.map((color, index) => (
                      <button
                        key={index}
                        type="button"
                        data-noundry-pixel
                        data-pixel-index={index}
                        aria-label={`Pixel ${index + 1}`}
                        onMouseDown={() => {
                          beginPixelAction(index);
                        }}
                        onMouseEnter={() => {
                          setHoveredPixel(index);
                          continuePixelAction(index);
                        }}
                        onMouseUp={() => endPixelAction(index)}
                        className="relative min-h-0 min-w-0 appearance-none overflow-hidden p-0"
                        style={{
                          backgroundColor:
                            color === EMPTY_PIXEL ? "transparent" : color,
                        }}
                      >
                        {displayedSelectionBounds &&
                          isPixelInSelection(
                            index,
                            displayedSelectionBounds
                          ) && (
                            <span
                              className="pointer-events-none absolute inset-0 bg-[#d9d9d9]/55"
                              style={getSelectionEdgeStyle(
                                index,
                                displayedSelectionBounds
                              )}
                            />
                          )}
                        {hoveredPixel === index && (
                          <span className="pointer-events-none absolute inset-0 bg-[#e6e6e6]/95" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {(editorViewport.scale > 1 ||
                editorViewport.translateX !== 0 ||
                editorViewport.translateY !== 0) && (
                <button
                  type="button"
                  onClick={() => setEditorViewport(DEFAULT_EDITOR_VIEWPORT)}
                  className="mt-3 rounded-full border border-skin-stroke bg-white px-3 py-1 font-heading text-xs text-skin-base shadow-[0px_2px_0px_0px_rgb(var(--color-shadow-neutral))]"
                >
                  Reset zoom
                </button>
              )}
            </div>

            <div className="yc-dark-yellow-surface order-3 flex h-full flex-col rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm">
              <div className="flex items-center justify-center gap-3 xl:justify-between">
                <h2 className="text-center font-heading text-2xl leading-none text-skin-base xl:text-left">
                  Preview
                </h2>
              </div>
              <div
                className={`mt-5 aspect-square overflow-hidden border border-skin-stroke ${
                  visibleTraits.backgrounds === false
                    ? "bg-[#909090]"
                    : "bg-[#ffcc00]"
                } ${isCircleCropEnabled ? "rounded-full" : "rounded-xl"}`}
                style={{
                  ...(visibleTraits.backgrounds === false
                    ? {
                        backgroundImage: checkerboardBackground,
                        backgroundSize: "32px 32px",
                      }
                    : undefined),
                }}
              >
                <FullCharacterPreview
                  layers={previewLayers}
                  fallbackSubmission={workingSubmission}
                />
              </div>
              <PreviewActionBar
                isCircleCropEnabled={isCircleCropEnabled}
                onRandomizeAll={randomizeAllTraits}
                onLoadById={loadCollectiveNounById}
                onToggleCircleCrop={() =>
                  setIsCircleCropEnabled((isEnabled) => !isEnabled)
                }
                onExport={exportFullPreview}
              />
              <div className="relative z-10 mt-5 rounded-xl border border-[#b89400] bg-accent shadow-[0px_4px_0px_0px_#b89400]">
                <input
                  ref={layerFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={handleLayerFileLoad}
                />
                {editableLayers.map((layer) => (
                  <LayerControl
                    key={layer.trait}
                    layer={layer}
                    images={artwork.images.filter(
                      (image) => image.trait === layer.trait
                    )}
                    value={selectedTraits[layer.trait] || ""}
                    isVisible={visibleTraits[layer.trait] !== false}
                    isEditing={traitType === layer.trait}
                    isMenuOpen={openLayerMenu === layer.trait}
                    onEdit={() => setTraitType(layer.trait)}
                    onTogglePicker={() =>
                      setOpenTraitPicker((currentTrait) =>
                        currentTrait === layer.trait ? null : layer.trait
                      )
                    }
                    onToggleMenu={() =>
                      setOpenLayerMenu((currentTrait) =>
                        currentTrait === layer.trait ? null : layer.trait
                      )
                    }
                    onToggleVisible={() =>
                      setVisibleTraits((currentTraits) => ({
                        ...currentTraits,
                        [layer.trait]: currentTraits[layer.trait] === false,
                      }))
                    }
                    onRandomize={() => randomizeTrait(layer.trait)}
                    onChange={(value) =>
                      updateCollectionTrait(layer.trait, value)
                    }
                    onClear={() => {
                      setTraitType(layer.trait);
                      clearCanvas();
                    }}
                    onLoad={() => requestLayerFileLoad(layer.trait)}
                    onExport={() => {
                      setOpenLayerMenu(null);
                      exportEditedTrait(layer.trait);
                    }}
                  />
                ))}
              </div>
              {layerLoadError && (
                <div className="mt-3 rounded-xl border border-skin-stroke bg-white px-3 py-2 text-sm text-skin-proposal-danger">
                  {layerLoadError}
                </div>
              )}
              <button
                type="button"
                onClick={submitToGallery}
                className="mt-5 w-full rounded-[18px] bg-[#1d9bf0] px-4 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:bg-[#45adf5] active:translate-y-1 active:shadow-none"
              >
                Submit to gallery
              </button>
            </div>
          </section>
        )}

        {activeTab === "gallery" && (
          <GalleryView
            address={address}
            artwork={artwork}
            submissions={submissions}
            error={submissionsError?.message}
            onRemix={loadSubmission}
            isAdmin={isAdmin}
          />
        )}

        {exportScaleRequest && (
          <ExportScaleDialog
            title={exportScaleRequest.title}
            onSelect={resolveExportScale}
          />
        )}

        {openTraitPicker && artwork && (
          <TraitPickerOverlay
            layer={editableLayers.find(
              (layer) => layer.trait === openTraitPicker
            )}
            images={artwork.images.filter(
              (image) => image.trait === openTraitPicker
            )}
            value={selectedTraits[openTraitPicker] || ""}
            onClose={() => setOpenTraitPicker(null)}
            onSelect={(value) => {
              updateCollectionTrait(openTraitPicker, value);
              setTraitType(openTraitPicker);
              setOpenTraitPicker(null);
            }}
          />
        )}
      </div>
    </Layout>
  );
}

const fillPixels = (pixels: string[], index: number, color: string) => {
  const targetColor = pixels[index];
  if (targetColor === color) return pixels;

  const nextPixels = [...pixels];
  const queue = [index];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const currentIndex = queue.shift();
    if (currentIndex === undefined || visited.has(currentIndex)) continue;
    if (nextPixels[currentIndex] !== targetColor) continue;

    visited.add(currentIndex);
    nextPixels[currentIndex] = color;

    const x = currentIndex % GRID_SIZE;
    const y = Math.floor(currentIndex / GRID_SIZE);
    if (x > 0) queue.push(currentIndex - 1);
    if (x < GRID_SIZE - 1) queue.push(currentIndex + 1);
    if (y > 0) queue.push(currentIndex - GRID_SIZE);
    if (y < GRID_SIZE - 1) queue.push(currentIndex + GRID_SIZE);
  }

  return nextPixels;
};

const isShapeTool = (tool: EditorTool) =>
  [
    "line",
    "rect",
    "rectFill",
    "circle",
    "circleFill",
    "selectRect",
    "selectCircle",
    "move",
  ].includes(tool);

const getSelectionBounds = (
  startIndex: number,
  endIndex: number,
  type: SelectionBounds["type"]
) => {
  const start = getPixelPoint(startIndex);
  const end = getPixelPoint(endIndex);

  return {
    type,
    left: Math.min(start.x, end.x),
    right: Math.max(start.x, end.x),
    top: Math.min(start.y, end.y),
    bottom: Math.max(start.y, end.y),
  };
};

const isPixelInSelection = (index: number, selection: SelectionBounds) => {
  const { x, y } = getPixelPoint(index);
  if (
    x < selection.left ||
    x > selection.right ||
    y < selection.top ||
    y > selection.bottom
  ) {
    return false;
  }

  if (selection.type === "rect") return true;

  const radiusX = Math.max(1, (selection.right - selection.left) / 2);
  const radiusY = Math.max(1, (selection.bottom - selection.top) / 2);
  const centerX = selection.left + radiusX;
  const centerY = selection.top + radiusY;

  return (
    Math.pow((x - centerX) / radiusX, 2) +
      Math.pow((y - centerY) / radiusY, 2) <=
    1
  );
};

const getSelectionEdgeStyle = (
  index: number,
  selection: SelectionBounds
): CSSProperties => {
  const { x, y } = getPixelPoint(index);
  const border = "2px solid #111827";
  const style: CSSProperties = {};
  const hasNeighbor = (nextX: number, nextY: number) =>
    nextX >= 0 &&
    nextX < GRID_SIZE &&
    nextY >= 0 &&
    nextY < GRID_SIZE &&
    isPixelInSelection(nextY * GRID_SIZE + nextX, selection);

  if (!hasNeighbor(x, y - 1)) style.borderTop = border;
  if (!hasNeighbor(x + 1, y)) style.borderRight = border;
  if (!hasNeighbor(x, y + 1)) style.borderBottom = border;
  if (!hasNeighbor(x - 1, y)) style.borderLeft = border;

  return style;
};

const movePixels = (
  pixels: string[],
  startIndex: number,
  endIndex: number,
  selection: SelectionBounds | null
) => {
  const start = getPixelPoint(startIndex);
  const end = getPixelPoint(endIndex);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  if (deltaX === 0 && deltaY === 0) return pixels;

  const nextPixels = [...pixels];
  const selectedIndexes = pixels
    .map((color, index) => ({ color, index }))
    .filter(
      ({ color, index }) =>
        color !== EMPTY_PIXEL &&
        (!selection || isPixelInSelection(index, selection))
    );

  selectedIndexes.forEach(({ index }) => {
    nextPixels[index] = EMPTY_PIXEL;
  });

  selectedIndexes.forEach(({ color, index }) => {
    const { x, y } = getPixelPoint(index);
    const nextX = x + deltaX;
    const nextY = y + deltaY;
    if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
      return;
    }
    nextPixels[nextY * GRID_SIZE + nextX] = color;
  });

  return nextPixels;
};

const drawShape = (
  pixels: string[],
  startIndex: number,
  endIndex: number,
  tool: EditorTool,
  color: string
) => {
  const nextPixels = [...pixels];
  const setPixel = (x: number, y: number) => {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
    nextPixels[y * GRID_SIZE + x] = color;
  };
  const startX = startIndex % GRID_SIZE;
  const startY = Math.floor(startIndex / GRID_SIZE);
  const endX = endIndex % GRID_SIZE;
  const endY = Math.floor(endIndex / GRID_SIZE);
  const left = Math.min(startX, endX);
  const right = Math.max(startX, endX);
  const top = Math.min(startY, endY);
  const bottom = Math.max(startY, endY);

  if (tool === "line") {
    const distanceX = Math.abs(endX - startX);
    const distanceY = -Math.abs(endY - startY);
    const stepX = startX < endX ? 1 : -1;
    const stepY = startY < endY ? 1 : -1;
    let error = distanceX + distanceY;
    let x = startX;
    let y = startY;

    while (true) {
      setPixel(x, y);
      if (x === endX && y === endY) break;
      const doubledError = error * 2;
      if (doubledError >= distanceY) {
        error += distanceY;
        x += stepX;
      }
      if (doubledError <= distanceX) {
        error += distanceX;
        y += stepY;
      }
    }

    return nextPixels;
  }

  if (tool === "rect" || tool === "rectFill") {
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const isEdge = x === left || x === right || y === top || y === bottom;
        if (tool === "rectFill" || isEdge) setPixel(x, y);
      }
    }

    return nextPixels;
  }

  const radiusX = Math.max(1, (right - left) / 2);
  const radiusY = Math.max(1, (bottom - top) / 2);
  const centerX = left + radiusX;
  const centerY = top + radiusY;

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const normalized =
        Math.pow((x - centerX) / radiusX, 2) +
        Math.pow((y - centerY) / radiusY, 2);
      if (tool === "circleFill" && normalized <= 1) setPixel(x, y);
      if (tool === "circle" && normalized <= 1 && normalized >= 0.72) {
        setPixel(x, y);
      }
    }
  }

  return nextPixels;
};

const ToolRail = ({
  tool,
  brushSize,
  selectedColor,
  usedColors,
  canUndo,
  canRedo,
  onToolChange,
  onBrushSizeChange,
  onColorChange,
  onUndo,
  onRedo,
}: {
  tool: EditorTool;
  brushSize: number;
  selectedColor: string;
  usedColors: string[];
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: EditorTool) => void;
  onBrushSizeChange: (size: number) => void;
  onColorChange: (color: string) => void;
  onUndo: () => void;
  onRedo: () => void;
}) => (
  <div className="yc-dark-yellow-surface h-full rounded-2xl border border-skin-stroke bg-white p-3 shadow-[0px_4px_0px_0px_rgb(var(--color-shadow-neutral))]">
    <div className="grid grid-cols-6 items-end justify-items-center gap-1.5 xl:grid-cols-3 xl:gap-2">
      {brushSizes.map((size) => (
        <button
          key={size}
          type="button"
          aria-label={`Brush size ${size}`}
          onClick={() => onBrushSizeChange(size)}
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition xl:h-10 xl:w-10 ${
            brushSize === size
              ? "border-transparent bg-[#fff2a3] shadow-[0px_3px_0px_0px_#d8c25f]"
              : "border-transparent hover:bg-[#f3f4f6]"
          }`}
        >
          <span
            className="block aspect-square bg-[#5f6368]"
            style={{ width: size * 4, height: size * 4 }}
          />
        </button>
      ))}
    </div>

    <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-8 xl:mt-5 xl:grid-cols-2 xl:gap-3">
      {toolbarTools.map((toolId) => (
        <button
          key={toolId}
          type="button"
          title={toolLabels[toolId]}
          onClick={() => onToolChange(toolId)}
          className={`flex h-9 items-center justify-center rounded-lg border text-xl transition xl:h-11 xl:text-2xl ${
            tool === toolId
              ? "border-transparent bg-[#fff2a3] text-skin-base shadow-[0px_3px_0px_0px_#d8c25f]"
              : "border-transparent text-[#5f6368] hover:bg-[#f3f4f6] hover:text-skin-base"
          }`}
        >
          <ToolIcon tool={toolId} />
        </button>
      ))}
    </div>

    <div className="mt-3 grid grid-cols-2 gap-2 xl:mt-4 xl:gap-3">
      <button
        type="button"
        title="Undo"
        disabled={!canUndo}
        onClick={onUndo}
        className="flex h-8 items-center justify-center rounded-lg text-[#5f6368] transition hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-35 xl:h-10"
      >
        <UndoGlyph />
      </button>
      <button
        type="button"
        title="Redo"
        disabled={!canRedo}
        onClick={onRedo}
        className="flex h-8 items-center justify-center rounded-lg text-[#5f6368] transition hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-35 xl:h-10"
      >
        <RedoGlyph />
      </button>
    </div>

    <label className="mt-4 block xl:mt-6">
      <span className="block font-heading text-xs uppercase text-secondary xl:text-right">
        Color
      </span>
      <input
        type="color"
        value={selectedColor === EMPTY_PIXEL ? "#000000" : selectedColor}
        onChange={(event) => onColorChange(event.target.value)}
        className="mt-2 block h-12 w-full cursor-pointer rounded-md border border-[#d1d5db] bg-white p-1 shadow-[inset_0px_0px_0px_3px_#f3f4f6] xl:aspect-square xl:h-20 xl:w-20 xl:rounded-none"
      />
    </label>

    <div className="mt-4 border-t border-skin-stroke pt-3 xl:mt-5 xl:pt-4">
      <div className="font-heading text-xs uppercase text-secondary">Used</div>
      <div className="mt-2 grid grid-cols-8 gap-1 xl:grid-cols-4">
        {(usedColors.length ? usedColors : starterPalette.slice(0, 8)).map(
          (color) => (
            <button
              key={color}
              type="button"
              aria-label={`Use color ${color}`}
              onClick={() => onColorChange(color)}
              className="aspect-square border border-[#d1d5db] shadow-[0px_1px_0px_0px_rgb(var(--color-shadow-neutral))]"
              style={{ backgroundColor: color }}
            />
          )
        )}
      </div>
    </div>
  </div>
);

const ToolIcon = ({ tool }: { tool: EditorTool }) => {
  switch (tool) {
    case "brush":
      return <BrushGlyph />;
    case "eraser":
      return <EraserGlyph />;
    case "eyedropper":
      return <DropperGlyph />;
    case "fill":
      return <BucketGlyph />;
    case "line":
      return <LineGlyph />;
    case "rect":
      return <SquareGlyph filled={false} />;
    case "rectFill":
      return <SquareGlyph filled />;
    case "circle":
      return <CircleGlyph filled={false} />;
    case "circleFill":
      return <CircleGlyph filled />;
    case "selectRect":
      return <SelectionGlyph shape="rect" />;
    case "selectCircle":
      return <SelectionGlyph shape="circle" />;
    case "move":
      return <MoveGlyph />;
    default:
      return <PixelToolIcon kind={tool} />;
  }
};

const pixelIconPatterns: Record<string, string[]> = {
  brush: ["00001", "00010", "00110", "01100", "11000"],
  eraser: ["01110", "11110", "11100", "11000", "00000"],
  eyedropper: ["00011", "00110", "01100", "11000", "10000"],
  fill: ["00110", "01110", "11100", "01100", "00110"],
  line: ["00001", "00010", "00100", "01000", "10000"],
  rect: ["11111", "10001", "10001", "10001", "11111"],
  rectFill: ["11111", "11111", "11111", "11111", "11111"],
  circle: ["01110", "10001", "10001", "10001", "01110"],
  circleFill: ["01110", "11111", "11111", "11111", "01110"],
  selectRect: ["11111", "10000", "10101", "00001", "11111"],
  selectCircle: ["01110", "10000", "10101", "00001", "01110"],
  move: ["00100", "01110", "11111", "01110", "00100"],
  dice: ["11111", "10101", "11011", "10101", "11111"],
  load: ["11111", "10001", "10101", "10001", "11111"],
  crop: ["00111", "00100", "11100", "10100", "11100"],
  export: ["11111", "10001", "10101", "10001", "11111"],
  trait: ["11111", "10001", "10111", "10001", "11111"],
  dots: ["00000", "10001", "00000", "10001", "00000"],
  clear: ["11000", "11100", "01110", "00111", "00011"],
  folder: ["11000", "11111", "10001", "10001", "11111"],
  save: ["11111", "10101", "11111", "10001", "11111"],
};

const PixelToolIcon = ({
  kind,
  size = 22,
}: {
  kind: string;
  size?: number;
}) => {
  const pattern = pixelIconPatterns[kind] || pixelIconPatterns.trait;

  return (
    <span
      className="grid"
      style={{
        gridTemplateColumns: `repeat(5, ${size / 5}px)`,
        gridAutoRows: `${size / 5}px`,
      }}
    >
      {pattern.flatMap((row, y) =>
        row
          .split("")
          .map((cell, x) => (
            <span
              key={`${kind}-${x}-${y}`}
              className={cell === "1" ? "bg-current" : "bg-transparent"}
            />
          ))
      )}
    </span>
  );
};

const ExportScaleDialog = ({
  title,
  onSelect,
}: {
  title: string;
  onSelect: (scale: number | null) => void;
}) => (
  <div
    className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 px-4 py-8 sm:items-center"
    role="dialog"
    aria-modal="true"
    aria-labelledby="export-scale-title"
    onClick={() => onSelect(null)}
  >
    <div
      className="w-full max-w-sm rounded-2xl border border-skin-stroke bg-skin-muted p-5 text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))]"
      onClick={(event) => event.stopPropagation()}
    >
      <h3
        id="export-scale-title"
        className="font-heading text-2xl leading-none text-skin-base"
      >
        {title}
      </h3>
      <p className="mt-2 text-base leading-snug text-secondary">
        Download at the original 32px size or scale it up with crisp pixel
        edges.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {EXPORT_SCALES.map((scale) => (
          <button
            key={scale}
            type="button"
            onClick={() => onSelect(scale)}
            className={`rounded-[18px] border border-skin-stroke px-4 py-3 font-heading text-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none ${
              scale === 1
                ? "yc-force-white bg-white text-skin-base"
                : "bg-accent text-[#212529] hover:bg-[#ffd84d]"
            }`}
          >
            {scale === 1 ? "Exact 32px" : `${GRID_SIZE * scale}px`}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="yc-force-white mt-4 w-full rounded-[18px] border border-skin-stroke bg-white px-4 py-3 font-heading text-base text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none"
      >
        Cancel
      </button>
    </div>
  </div>
);

const PreviewActionBar = ({
  isCircleCropEnabled,
  onRandomizeAll,
  onLoadById,
  onToggleCircleCrop,
  onExport,
}: {
  isCircleCropEnabled: boolean;
  onRandomizeAll: () => void;
  onLoadById: () => void;
  onToggleCircleCrop: () => void;
  onExport: () => void;
}) => {
  const actions = [
    ["dice", "Randomize entire noun", onRandomizeAll],
    ["load", "Load Collective Noun by ID", onLoadById],
    ["crop", "Circle crop", onToggleCircleCrop],
    ["export", "Export", onExport],
  ] as const;

  return (
    <div className="yc-dark-force-white mt-3 flex justify-center gap-3 rounded-xl bg-accent px-3 py-2 shadow-[0px_4px_0px_0px_rgb(var(--color-shadow-accent))]">
      {actions.map(([kind, label, onClick]) => (
        <button
          key={kind}
          type="button"
          title={label}
          aria-label={label}
          onClick={onClick}
          className={`flex h-8 w-8 items-center justify-center rounded-sm text-[#212529] transition hover:bg-[#fff7bf] ${
            kind === "crop" && isCircleCropEnabled ? "bg-[#fff2a3]" : ""
          }`}
        >
          <ActionIcon kind={kind} />
        </button>
      ))}
    </div>
  );
};

const BrushGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
    <path
      d="M7 20c2.9 0 5-1.9 5-4.6 0-1.4-1.1-2.5-2.6-2.5C6.9 12.9 5 14.8 5 17.3c0 .9-.8 1.5-2 1.7 1.1.7 2.5 1 4 1Zm4.9-7.9 7.9-7.9c.5-.5.5-1.2 0-1.7l-.3-.3c-.5-.5-1.2-.5-1.7 0L9.9 10.1l2 2Z"
      fill="currentColor"
    />
  </svg>
);

const EraserGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
    <path
      d="M16.2 3.3 21 8.1c.8.8.8 2 0 2.8l-8.8 8.8H6.4L3 16.3c-.8-.8-.8-2 0-2.8L13.4 3.3c.8-.8 2-.8 2.8 0Zm-7 14.4h2.1l4.2-4.2-4.8-4.8-5.6 5.6 4.1 3.4Z"
      fill="currentColor"
    />
  </svg>
);

const DropperGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
    <path
      d="M15.2 2.8a2.1 2.1 0 0 1 3 0l3 3a2.1 2.1 0 0 1 0 3l-2 2 1.2 1.2-2.1 2.1L9.9 5.7 12 3.6l1.2 1.2 2-2Z"
      fill="currentColor"
    />
    <path
      d="m8.6 7 8.4 8.4-6.6 6.6H3v-7.4L8.6 7Zm.1 11.8 4.1-4.1-3.5-3.5-4.1 4.1v3.5h3.5Z"
      fill="currentColor"
    />
  </svg>
);

const BucketGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
    <path
      d="M7.8 3 18 13.2 11.2 20H4.4L2 17.6V10.8l6.2-6.2L7.8 3Zm1.7 4.8-4.8 4.8v3.8l.9.9h4.2l5.4-5.4-5.7-4.1Z"
      fill="currentColor"
    />
    <path d="M4.8 13h11.4l-5.4 5.4H6.4l-1.6-1.6V13Z" fill="currentColor" />
    <path
      d="M19 15.4c1.4 1.6 2.2 2.9 2.2 4 0 1.4-1 2.4-2.2 2.4s-2.2-1-2.2-2.4c0-1.1.8-2.4 2.2-4Z"
      fill="currentColor"
    />
  </svg>
);

const LineGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
    <path d="M5 19 19 5" stroke="currentColor" strokeWidth="2.5" />
  </svg>
);

const SquareGlyph = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
    <rect
      x="5"
      y="5"
      width="14"
      height="14"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

const CircleGlyph = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="7"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

const SelectionGlyph = ({ shape }: { shape: "rect" | "circle" }) => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
    {shape === "rect" ? (
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeDasharray="2 2"
        strokeWidth="2"
        shapeRendering="crispEdges"
      />
    ) : (
      <circle
        cx="12"
        cy="12"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeDasharray="3 2"
        strokeWidth="2"
      />
    )}
  </svg>
);

const MoveGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
    <path
      d="M12 3 8 7h3v4H7V8l-4 4 4 4v-3h4v4H8l4 4 4-4h-3v-4h4v3l4-4-4-4v3h-4V7h3l-4-4Z"
      fill="currentColor"
    />
  </svg>
);

const UndoGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
    <path
      d="M12 5c-3 0-5.7 1.4-7.4 3.6L2 6v7h7L6.8 10.8A6.9 6.9 0 0 1 12 8c3.2 0 5.8 2.1 6.7 5l2.8-.9C20.1 7.9 16.3 5 12 5Z"
      fill="currentColor"
    />
  </svg>
);

const RedoGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
    <path
      d="M12 5c3 0 5.7 1.4 7.4 3.6L22 6v7h-7l2.2-2.2A6.9 6.9 0 0 0 12 8c-3.2 0-5.8 2.1-6.7 5l-2.8-.9C3.9 7.9 7.7 5 12 5Z"
      fill="currentColor"
    />
  </svg>
);

const DiceGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <rect
      x="4"
      y="4"
      width="16"
      height="16"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    />
    <circle cx="8.5" cy="8.5" r="1.6" fill="currentColor" />
    <circle cx="15.5" cy="8.5" r="1.6" fill="currentColor" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <circle cx="8.5" cy="15.5" r="1.6" fill="currentColor" />
    <circle cx="15.5" cy="15.5" r="1.6" fill="currentColor" />
  </svg>
);

const LoadNounGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <rect
      x="4"
      y="4"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <rect x="7" y="7" width="4" height="4" fill="currentColor" />
    <rect x="13" y="7" width="4" height="4" fill="currentColor" />
    <rect x="7" y="13" width="10" height="4" fill="currentColor" />
  </svg>
);

const CropMaskGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="7"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

const SaveGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path
      d="M5 3h12l2 2v16H5V3Zm3 2v5h8V5H8Zm0 10v4h8v-4H8Z"
      fill="currentColor"
    />
  </svg>
);

const FolderGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path d="M3 6h7l2 2h9v3H3V6Zm0 6h18l-2 7H5l-2-7Z" fill="currentColor" />
  </svg>
);

const DotsGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <circle cx="6" cy="12" r="2" fill="currentColor" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <circle cx="18" cy="12" r="2" fill="currentColor" />
  </svg>
);

const ActionIcon = ({ kind }: { kind: string }) => {
  switch (kind) {
    case "dice":
      return <DiceGlyph />;
    case "load":
      return <LoadNounGlyph />;
    case "crop":
      return <CropMaskGlyph />;
    case "export":
    case "save":
      return <SaveGlyph />;
    case "folder":
      return <FolderGlyph />;
    case "clear":
      return <EraserGlyph />;
    case "dots":
      return <DotsGlyph />;
    default:
      return <PixelToolIcon kind={kind} size={20} />;
  }
};

const EyeGlyph = ({ isVisible }: { isVisible: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path
      d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    {!isVisible && (
      <path d="M4 20 20 4" stroke="currentColor" strokeWidth="2.5" />
    )}
  </svg>
);

const FullCharacterPreview = ({
  layers,
  fallbackSubmission,
}: {
  layers: PreviewLayer[];
  fallbackSubmission: NoundrySubmission;
}) => (
  <div className="relative h-full w-full">
    {layers.length > 0 ? (
      layers.map((layer) =>
        layer.kind === "pixels" ? (
          <div key={layer.id} className="absolute inset-0">
            <PixelPreview pixels={layer.pixels} />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={layer.id}
            src={layer.image.uri}
            alt={`${layer.image.trait} ${layer.image.name}`}
            className="absolute inset-0 h-full w-full object-contain [image-rendering:pixelated]"
          />
        )
      )
    ) : (
      <PixelPreview pixels={fallbackSubmission.pixels} />
    )}
  </div>
);

const PixelPreview = ({ pixels }: { pixels: string[] }) => (
  <svg
    viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}
    className="block h-full w-full"
    preserveAspectRatio="none"
    shapeRendering="crispEdges"
    aria-hidden="true"
  >
    {pixels.map((color, index) =>
      color === EMPTY_PIXEL ? null : (
        <rect
          key={index}
          x={index % GRID_SIZE}
          y={Math.floor(index / GRID_SIZE)}
          width="1"
          height="1"
          fill={color}
        />
      )
    )}
  </svg>
);

const layerPartIconSrc: Record<string, string> = {
  accessories: "/noundry-icons/accessory.svg",
  backgrounds: "/noundry-icons/background.svg",
  bodies: "/noundry-icons/body.svg",
  glasses: "/noundry-icons/noggles.svg",
  heads: "/noundry-icons/head.svg",
};

const LayerPartIcon = ({ trait }: { trait: string }) => (
  <span
    className="block h-7 w-7 bg-current"
    aria-hidden="true"
    style={{
      maskImage: `url(${layerPartIconSrc[trait] || layerPartIconSrc.accessories})`,
      maskPosition: "center",
      maskRepeat: "no-repeat",
      maskSize: "contain",
      WebkitMaskImage: `url(${
        layerPartIconSrc[trait] || layerPartIconSrc.accessories
      })`,
      WebkitMaskPosition: "center",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskSize: "contain",
    }}
  />
);

const TraitPickerOverlay = ({
  layer,
  images,
  value,
  onClose,
  onSelect,
}: {
  layer?: PlaygroundArtwork["orderedLayers"][number];
  images: PlaygroundImage[];
  value: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) => {
  if (!layer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="max-h-[min(82vh,720px)] w-full max-w-[720px] overflow-hidden rounded-xl border border-[#555] bg-[#303030] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#555] px-4 py-3">
          <div className="font-heading text-lg text-[#d8d8d8]">
            Select {getLayerLabel(layer.trait)}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-heading text-sm text-[#9a9a9a] transition hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="grid max-h-[min(64vh,600px)] grid-cols-3 gap-3 overflow-y-auto p-4 sm:grid-cols-5 md:grid-cols-6">
          {images.map((image) => (
            <button
              key={image.name}
              type="button"
              onClick={() => onSelect(image.name)}
              className={`rounded-sm border bg-[#4a4a4a] p-2 text-left transition hover:border-white ${
                image.name === value ? "border-white" : "border-[#555]"
              }`}
              title={image.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.uri}
                alt={image.name}
                className="aspect-square w-full object-contain [image-rendering:pixelated]"
              />
              <div className="mt-1 truncate text-xs text-[#d8d8d8]">
                {image.name}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const LayerControl = ({
  layer,
  images,
  value,
  isVisible,
  isEditing,
  isMenuOpen,
  onEdit,
  onTogglePicker,
  onToggleMenu,
  onToggleVisible,
  onRandomize,
  onChange,
  onClear,
  onLoad,
  onExport,
}: {
  layer: PlaygroundArtwork["orderedLayers"][number];
  images: PlaygroundImage[];
  value: string;
  isVisible: boolean;
  isEditing: boolean;
  isMenuOpen: boolean;
  onEdit: () => void;
  onTogglePicker: () => void;
  onToggleMenu: () => void;
  onToggleVisible: () => void;
  onRandomize: () => void;
  onChange: (value: string) => void;
  onClear: () => void;
  onLoad: () => void;
  onExport: () => void;
}) => {
  const selectedImage = images.find((image) => image.name === value);

  return (
    <div
      className={`relative border-b border-[#b89400]/50 first:rounded-t-xl last:rounded-b-xl last:border-b-0 ${
        isEditing ? "bg-[#fff2a3]" : "bg-[#ffd84d]"
      }`}
    >
      <div className="grid grid-cols-[34px_42px_1fr_34px_34px] items-center gap-2 p-2">
        <button
          type="button"
          onClick={onToggleVisible}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-[#7d6500] transition hover:bg-[#ffef8a] hover:text-skin-base"
          aria-label={isVisible ? "Hide layer" : "Show layer"}
        >
          <EyeGlyph isVisible={isVisible} />
        </button>
        <button
          type="button"
          onClick={() => {
            onEdit();
            onTogglePicker();
          }}
          className="flex h-10 w-10 items-center justify-center border border-[#b89400] bg-[#fff7bf] text-[#7d6500] transition hover:bg-white hover:text-skin-base"
          aria-label={`Choose ${getLayerLabel(layer.trait)}`}
        >
          {selectedImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedImage.uri}
              alt=""
              className="h-full w-full object-contain [image-rendering:pixelated]"
            />
          ) : (
            <LayerPartIcon trait={layer.trait} />
          )}
        </button>
        <button type="button" onClick={onEdit} className="min-w-0 text-left">
          <div className="font-heading text-base leading-tight text-skin-base transition hover:text-[#6a5400]">
            {getLayerLabel(layer.trait)}
          </div>
          <div className="truncate text-sm text-[#6a5400]">{value}</div>
        </button>
        <button
          type="button"
          onClick={onRandomize}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-[#7d6500] transition hover:bg-[#ffef8a] hover:text-skin-base"
          aria-label={`Randomize ${layer.trait}`}
        >
          <ActionIcon kind="dice" />
        </button>
        <button
          type="button"
          onClick={onToggleMenu}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-skin-base transition hover:bg-[#ffef8a]"
          aria-label={`${getLayerLabel(layer.trait)} menu`}
        >
          <ActionIcon kind="dots" />
        </button>
      </div>

      {isMenuOpen && (
        <div className="absolute right-3 top-10 z-50 w-44 rounded-2xl border border-skin-stroke bg-skin-muted p-2 shadow-lg">
          {[
            ["clear", "Clear", onClear],
            ["folder", "Load", onLoad],
            ["save", "Export", onExport],
          ].map(([kind, label, onClick]) => (
            <button
              key={label as string}
              type="button"
              onClick={onClick as () => void}
              className="grid w-full grid-cols-[32px_1fr] items-center gap-3 rounded-xl px-3 py-2.5 text-left font-heading text-sm text-primary transition hover:bg-[#fff7bf] hover:text-[#212529] focus-visible:bg-[#fff7bf] focus-visible:text-[#212529]"
            >
              <ActionIcon kind={kind as string} />
              {label as string}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const GalleryView = ({
  address,
  artwork,
  submissions,
  error,
  onRemix,
  isAdmin,
}: {
  address?: string;
  artwork?: PlaygroundArtwork;
  submissions: NoundrySubmission[];
  error?: string;
  onRemix: (submission: NoundrySubmission) => void;
  isAdmin: boolean;
}) => {
  const [activeGalleryTab, setActiveGalleryTab] = useState<
    "traits" | "artists"
  >("traits");
  const artists = useMemo(
    () =>
      Object.values(
        submissions.reduce<
          Record<
            string,
            {
              address: string;
              submissions: NoundrySubmission[];
              traitTypes: Set<string>;
            }
          >
        >((artistMap, submission) => {
          const address = submission.artist;
          const key = address.toLowerCase();
          if (!artistMap[key]) {
            artistMap[key] = {
              address,
              submissions: [],
              traitTypes: new Set<string>(),
            };
          }

          artistMap[key].submissions.push(submission);
          artistMap[key].traitTypes.add(submission.traitType);
          return artistMap;
        }, {})
      ).sort(
        (first, second) =>
          second.submissions.length - first.submissions.length ||
          first.address.localeCompare(second.address)
      ),
    [submissions]
  );

  if (error) {
    return (
      <section className="yc-dark-yellow-surface rounded-2xl border border-skin-stroke bg-white p-6 text-skin-proposal-danger shadow-sm">
        {error}
      </section>
    );
  }

  const galleryTabs = [
    ["traits", `Trait submissions (${submissions.length})`],
    ["artists", `Artists (${artists.length})`],
  ] as const;

  if (submissions.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <div className="yc-dark-text-black flex w-full gap-1.5 rounded-xl border border-[rgb(var(--color-selector-stroke))] bg-[#f1f1f1] p-1 shadow-[0px_4px_0px_0px_rgb(var(--color-selector-stroke))] sm:w-fit">
          {galleryTabs.map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveGalleryTab(tab)}
              className={`flex-1 rounded-lg px-4 py-2 font-heading text-sm transition sm:flex-none ${
                activeGalleryTab === tab
                  ? "translate-y-[-1px] bg-accent text-skin-base shadow-[0px_3px_0px_0px_#b89400]"
                  : "text-secondary hover:bg-[#fff7bf] hover:text-skin-base"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="yc-dark-yellow-surface rounded-2xl border border-dashed border-skin-stroke bg-white p-10 text-center shadow-sm">
          <h2 className="font-heading text-3xl leading-none text-skin-base">
            No submissions yet
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-snug text-secondary">
            The gallery is fresh. Submit a trait from the studio to add the
            first draft here for review and remixing.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="yc-dark-text-black flex w-full gap-1.5 rounded-xl border border-[rgb(var(--color-selector-stroke))] bg-[#f1f1f1] p-1 shadow-[0px_4px_0px_0px_rgb(var(--color-selector-stroke))] sm:w-fit">
        {galleryTabs.map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveGalleryTab(tab)}
            className={`flex-1 rounded-lg px-4 py-2 font-heading text-sm transition sm:flex-none ${
              activeGalleryTab === tab
                ? "translate-y-[-1px] bg-accent text-skin-base shadow-[0px_3px_0px_0px_#b89400]"
                : "text-secondary hover:bg-[#fff7bf] hover:text-skin-base"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeGalleryTab === "traits" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {submissions.map((submission) => (
            <SubmissionGalleryCard
              key={submission.id}
              artwork={artwork}
              submission={submission}
              showRoundSubmissionAction={
                address?.toLowerCase() === submission.artist.toLowerCase()
              }
              footer={
                <>
                  <button
                    type="button"
                    onClick={() => onRemix(submission)}
                    className="yc-dark-force-white mt-4 w-full rounded-xl border border-[rgb(var(--color-selector-stroke))] bg-accent px-3 py-2 font-heading text-sm text-skin-base !shadow-[0px_3px_0px_0px_rgb(var(--color-selector-stroke))] transition hover:-translate-y-0.5 hover:bg-[#ffd84d] active:translate-y-1 active:!shadow-none"
                  >
                    Remix
                  </button>
                  {isAdmin && (
                    <Link
                      href={`/admin/dashboard?section=noundry&submission=${submission.id}`}
                      className="mt-3 flex w-full items-center justify-center rounded-xl border border-[#a90f0c] bg-skin-proposal-danger px-3 py-2 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#a90f0c] transition hover:-translate-y-0.5 hover:bg-[#f43a35] active:translate-y-1 active:shadow-none"
                    >
                      Admin edit
                    </Link>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}

      {activeGalleryTab === "artists" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {artists.map((artist) => {
            const latestSubmission = artist.submissions[0];

            return (
              <Link
                key={artist.address}
                href={getProfilePath({ address: artist.address })}
                className="yc-dark-yellow-surface grid gap-4 rounded-2xl border border-skin-stroke bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[108px_1fr]"
              >
                <div className="aspect-square rounded-xl bg-[#ffcc00] p-3">
                  {latestSubmission && (
                    <PixelPreview pixels={latestSubmission.pixels} />
                  )}
                </div>
                <div className="min-w-0 self-center">
                  <div className="truncate font-heading text-2xl leading-none text-skin-base">
                    <WalletIdentityLink address={artist.address} link={false} />
                  </div>
                  <div className="mt-2 text-sm leading-snug text-secondary">
                    {artist.submissions.length} trait
                    {artist.submissions.length === 1 ? "" : "s"} submitted
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.from(artist.traitTypes)
                      .slice(0, 4)
                      .map((traitType) => (
                        <span
                          key={traitType}
                          className="rounded-full bg-[#fff7bf] px-2.5 py-1 font-heading text-xs text-skin-base"
                        >
                          {getLayerLabel(traitType)}
                        </span>
                      ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
};
