import type { PlaygroundArtwork } from "data/nouns-builder/artwork";

export const ORIGINAL_TRAIT_ASSET_CIDS = new Set([
  "bafybeicwsv2lnwjkcru3yfu73vpsp4xcf7ylh35dldybql5xlyks5hl4om",
  "bafybeigrscxoeoj6ydhback4hiygkn343xjzqgadxlcdurty2pnbku6jvi",
]);

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

export type TraitAssetEntry = {
  name: string;
  sourceUrl: string;
};

const toGatewayUrl = (sourceUri: string) => {
  if (!sourceUri.startsWith("ipfs://")) return undefined;

  const [cid, ...pathSegments] = sourceUri.slice("ipfs://".length).split("/");
  if (!cid || !ORIGINAL_TRAIT_ASSET_CIDS.has(cid) || !pathSegments.length) {
    return undefined;
  }

  const safePath = pathSegments.map((segment) => {
    const decoded = decodeURIComponent(segment);
    if (
      !decoded ||
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("\\")
    ) {
      return undefined;
    }

    return encodeURIComponent(decoded);
  });
  if (safePath.some((segment) => !segment)) return undefined;

  return `${IPFS_GATEWAY}/${cid}/${safePath.join("/")}`;
};

export const getOriginalTraitAssetEntries = (
  artwork: PlaygroundArtwork
): TraitAssetEntry[] =>
  artwork.images.flatMap((image) => {
    const sourceUrl = image.sourceUri
      ? toGatewayUrl(image.sourceUri)
      : undefined;
    if (!sourceUrl) return [];

    const name = image
      .sourceUri!.slice("ipfs://".length)
      .split("/")
      .slice(1)
      .join("/");
    return name ? [{ name, sourceUrl }] : [];
  });

export const getTraitRemixHref = (layer: string, trait: string) =>
  `/noundry?remixLayer=${encodeURIComponent(layer)}&remixTrait=${encodeURIComponent(
    trait
  )}`;
