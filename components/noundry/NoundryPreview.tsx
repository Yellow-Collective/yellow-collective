import type {
  PlaygroundArtwork,
  PlaygroundImage,
} from "data/nouns-builder/artwork";
import WalletIdentityLink from "@/components/WalletIdentityLink";
import { getProfilePath } from "@/utils/profile/identity";
import Link from "next/link";
import type React from "react";

export type NoundrySubmission = {
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

const GRID_SIZE = 32;
const EMPTY_PIXEL = "transparent";

const layerLabels: Record<string, string> = {
  accessories: "Accessory",
  backgrounds: "Background",
  bodies: "Body",
  glasses: "Noggles",
  heads: "Head",
};

export const getLayerLabel = (trait: string) =>
  layerLabels[trait] || trait.replace(/[-_]+/g, " ");

export const getSubmissionPreviewTraits = (submission: NoundrySubmission) =>
  Object.keys(submission.previewTraits || {}).length > 0
    ? submission.previewTraits
    : submission.selectedTraits || {};

export const shortenAddress = (address: string) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Unknown artist";

export const getArtistPath = (artist: string) =>
  `/noundry/artists/${encodeURIComponent(artist)}`;

export const getTraitPath = (id: string) =>
  `/noundry/traits/${encodeURIComponent(id)}`;

export const getTraitRoundSubmissionPath = (id: string) =>
  `${getTraitPath(id)}?submitRound=1`;

export const formatRelativeTime = (dateValue: string) => {
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const diffMs = Date.now() - timestamp;
  const diffDays = Math.max(0, Math.floor(diffMs / 86400000));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
};

const getTraitImage = (
  images: PlaygroundImage[],
  trait: string,
  selectedName?: string
) =>
  images.find((image) => image.trait === trait && image.name === selectedName);

export const getArtworkRenderTraits = (artwork: PlaygroundArtwork) => [
  ...artwork.renderLayers,
  ...artwork.orderedLayers
    .map((layer) => layer.trait)
    .filter((trait) => !artwork.renderLayers.includes(trait)),
];

export const getCollectionLayers = (
  artwork: PlaygroundArtwork,
  traits: Record<string, string>
) =>
  getArtworkRenderTraits(artwork)
    .map((trait) => getTraitImage(artwork.images, trait, traits[trait]))
    .filter((image): image is PlaygroundImage => Boolean(image));

const hashSeed = (value: string) =>
  value.split("").reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) >>> 0;
  }, 2166136261);

const seededIndex = (seed: string, max: number) => {
  if (max <= 0) return 0;
  const hash = hashSeed(seed);
  return hash % max;
};

export const buildRandomTraits = (
  artwork: PlaygroundArtwork,
  seed: string,
  overrides: Record<string, string> = {}
) =>
  Object.fromEntries(
    artwork.orderedLayers.map((layer, index) => [
      layer.trait,
      overrides[layer.trait] ||
        layer.properties[
          seededIndex(
            `${seed}-${layer.trait}-${index}`,
            layer.properties.length
          )
        ],
    ])
  );

export const PixelPreview = ({
  submission,
}: {
  submission: NoundrySubmission;
}) => (
  <svg
    viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}
    className="block h-full w-full"
    preserveAspectRatio="none"
    shapeRendering="crispEdges"
    aria-hidden="true"
  >
    {submission.pixels.map((color, index) =>
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

export const FullCharacterPreview = ({
  collectionLayers,
  submission,
  showEditedTrait,
}: {
  collectionLayers: PlaygroundImage[];
  submission: NoundrySubmission;
  showEditedTrait: boolean;
}) => {
  const glassesLayers = collectionLayers.filter(
    (image) =>
      image.trait === "glasses" &&
      (!showEditedTrait || image.trait !== submission.traitType)
  );
  const baseLayers = collectionLayers.filter(
    (image) =>
      image.trait !== "glasses" &&
      (!showEditedTrait || image.trait !== submission.traitType)
  );

  return (
    <div className="relative h-full w-full">
      {baseLayers.map((image) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${image.trait}-${image.name}`}
          src={image.uri}
          alt={`${image.trait} ${image.name}`}
          className="absolute inset-0 h-full w-full object-contain [image-rendering:pixelated]"
        />
      ))}
      {showEditedTrait && (
        <div className="absolute inset-0">
          <PixelPreview submission={submission} />
        </div>
      )}
      {glassesLayers.map((image) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${image.trait}-${image.name}`}
          src={image.uri}
          alt={`${image.trait} ${image.name}`}
          className="absolute inset-0 h-full w-full object-contain [image-rendering:pixelated]"
        />
      ))}
    </div>
  );
};

export const NounPreviewTile = ({
  artwork,
  submission,
  traits,
  showEditedTrait,
}: {
  artwork?: PlaygroundArtwork;
  submission: NoundrySubmission;
  traits: Record<string, string>;
  showEditedTrait: boolean;
}) => {
  const collectionLayers = artwork ? getCollectionLayers(artwork, traits) : [];

  return (
    <div className="aspect-square overflow-hidden bg-[#d7d9e4]">
      {artwork ? (
        <FullCharacterPreview
          collectionLayers={collectionLayers}
          submission={submission}
          showEditedTrait={showEditedTrait}
        />
      ) : (
        <PixelPreview submission={submission} />
      )}
    </div>
  );
};

export const SubmissionGalleryCard = ({
  artwork,
  submission,
  footer,
  compact = false,
  showArtist = true,
  profileTone = false,
  showRoundSubmissionAction = false,
}: {
  artwork?: PlaygroundArtwork;
  submission: NoundrySubmission;
  footer?: React.ReactNode;
  compact?: boolean;
  showArtist?: boolean;
  profileTone?: boolean;
  showRoundSubmissionAction?: boolean;
}) => (
  <div
    className={`yc-dark-yellow-surface overflow-hidden border border-skin-stroke bg-white shadow-sm ${
      compact ? "rounded-xl" : "rounded-2xl"
    }`}
  >
    <Link
      href={getTraitPath(submission.id)}
      className="block aspect-square bg-[#ffcc00] transition hover:brightness-[1.02]"
      aria-label={`View ${submission.title}`}
    >
      <NounPreviewTile
        artwork={artwork}
        submission={submission}
        traits={getSubmissionPreviewTraits(submission)}
        showEditedTrait
      />
    </Link>
    <div className={`border-t border-skin-stroke ${compact ? "p-2 sm:p-3" : "p-4"}`}>
      <Link
        href={getTraitPath(submission.id)}
        className={`font-heading leading-tight transition hover:text-[#b89400] ${
          profileTone ? "text-skin-highlighted" : "text-skin-base"
        } ${
          compact ? "text-sm" : "text-xl"
        }`}
      >
        {submission.title}
      </Link>
      <div
        className={`mt-1 leading-snug ${
          profileTone ? "text-skin-highlighted" : "text-secondary"
        } ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {getLayerLabel(submission.traitType)}
      </div>
      {showArtist && (
        <Link
          href={getProfilePath({ address: submission.artist })}
          className={`mt-2 block truncate font-heading text-skin-base transition hover:text-[#b89400] ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          <WalletIdentityLink address={submission.artist} link={false} />
        </Link>
      )}
      {showRoundSubmissionAction && (
        <Link
          href={getTraitRoundSubmissionPath(submission.id)}
          className="mt-3 flex w-full items-center justify-center rounded-xl border border-[#0f5f99] bg-[#1d9bf0] px-3 py-2 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none"
        >
          Submit to round
        </Link>
      )}
      {footer}
    </div>
  </div>
);
