import { getAddresses } from "data/nouns-builder/manager";
import { TOKEN_CONTRACT, TOKEN_NETWORK } from "constants/addresses";
import { IPFS_GATEWAY } from "constants/urls";
import DefaultProvider from "@/utils/DefaultProvider";
import { BigNumber, ethers } from "@/utils/ethers-compat";
import fs from "fs/promises";
import path from "path";

type ItemWithReferenceSlot = {
  referenceSlot: number;
  name: string;
};

type PropertyWithReferenceSlot = {
  name: string;
  items: ItemWithReferenceSlot[];
};

export type PlaygroundImage = {
  name: string;
  trait: string;
  uri: string;
  sourceUri?: string;
};

export type PlaygroundLayer = {
  trait: string;
  properties: string[];
};

export type PlaygroundArtwork = {
  images: PlaygroundImage[];
  orderedLayers: PlaygroundLayer[];
  renderLayers: string[];
};

const METADATA_RENDERER_PROPERTIES_SLOT = BigNumber.from(6);

const metadataAbi = [
  "function propertiesCount() view returns (uint256)",
  "function itemsCount(uint256 propertyId) view returns (uint256)",
  "function properties(uint256 propertyId) view returns (string)",
  "function ipfsData(uint256 referenceSlot) view returns (string baseUri,string extension)",
];

const localManifestPath = path.join(
  process.cwd(),
  "public",
  "playground",
  "yellow-collective",
  "manifest.json"
);

const stripLayerPrefix = (value: string) =>
  value.replace(/^\d+[-_ ]*/, "").replace(/[-_]+/g, " ");

export const normalizeArtworkUri = (uri: string) => {
  if (uri.startsWith("ipfs://")) {
    return `${IPFS_GATEWAY}${uri.replace("ipfs://", "")}`;
  }

  return uri;
};

const encodeSlot = (slot: BigNumber) =>
  ethers.utils.defaultAbiCoder.encode(["uint256"], [slot]);

const addToSlot = (slotHex: string, value: number) =>
  ethers.utils.hexZeroPad(BigNumber.from(slotHex).add(value).toHexString(), 32);

const decodeStringFromStorage = async (
  contractAddress: string,
  slotHex: string,
  rawValue: string
) => {
  if (!rawValue || rawValue === "0x") return "";

  const value = BigNumber.from(rawValue);
  const isShortString = value.and(1).isZero();

  if (isShortString) {
    const length = value.and(0xff).toNumber() / 2;
    if (!length) return "";
    return ethers.utils.toUtf8String(`0x${rawValue.slice(2, 2 + length * 2)}`);
  }

  const length = value.sub(1).div(2).toNumber();
  const dataStart = BigNumber.from(ethers.utils.keccak256(slotHex));
  const slots = Math.ceil(length / 32);
  let hexData = "";

  for (let index = 0; index < slots; index += 1) {
    const chunk = await DefaultProvider.getStorageAt(
      contractAddress,
      ethers.utils.hexZeroPad(dataStart.add(index).toHexString(), 32)
    );
    if (chunk && chunk !== "0x") hexData += chunk.slice(2);
  }

  return ethers.utils.toUtf8String(`0x${hexData.slice(0, length * 2)}`);
};

const getItemFromStorage = async (
  contractAddress: string,
  propertyIndex: number,
  itemIndex: number
): Promise<ItemWithReferenceSlot> => {
  const baseSlot = ethers.utils.keccak256(
    encodeSlot(METADATA_RENDERER_PROPERTIES_SLOT)
  );
  const propertySlot = addToSlot(baseSlot, propertyIndex * 2);
  const itemsSlot = addToSlot(propertySlot, 1);
  const itemsBase = ethers.utils.keccak256(itemsSlot);
  const itemBaseSlot = addToSlot(itemsBase, itemIndex * 2);
  const nameSlot = addToSlot(itemBaseSlot, 1);

  const [referenceSlotHex, namePointer] = await Promise.all([
    DefaultProvider.getStorageAt(contractAddress, itemBaseSlot),
    DefaultProvider.getStorageAt(contractAddress, nameSlot),
  ]);

  return {
    referenceSlot: BigNumber.from(referenceSlotHex).and(0xffff).toNumber(),
    name: await decodeStringFromStorage(contractAddress, nameSlot, namePointer),
  };
};

export const getYellowCollectiveArtwork =
  async (): Promise<PlaygroundArtwork> => {
    try {
      const manifest = await fs.readFile(localManifestPath, "utf8");
      return JSON.parse(manifest) as PlaygroundArtwork;
    } catch {
      console.warn(
        "Local playground manifest unavailable; falling back to RPC"
      );
    }

    const addresses = await getAddresses({
      tokenAddress: TOKEN_CONTRACT as `0x${string}`,
    });
    const metadata = new ethers.Contract(
      addresses.metadata,
      metadataAbi,
      DefaultProvider
    );
    const propertiesCount = Number(await metadata.propertiesCount());
    const itemCounts = await Promise.all(
      Array.from({ length: propertiesCount }, (_, index) =>
        metadata.itemsCount(index).then((count: BigNumber) => Number(count))
      )
    );
    const propertyNames = await Promise.all(
      Array.from({ length: propertiesCount }, (_, index) =>
        metadata.properties(index)
      )
    );
    const properties: PropertyWithReferenceSlot[] = await Promise.all(
      propertyNames.map(async (name, propertyIndex) => ({
        name,
        items: await Promise.all(
          Array.from({ length: itemCounts[propertyIndex] }, (_, itemIndex) =>
            getItemFromStorage(addresses.metadata, propertyIndex, itemIndex)
          )
        ),
      }))
    );
    const referenceSlots = Array.from(
      new Set(
        properties.flatMap((property) =>
          property.items.map((item) => item.referenceSlot)
        )
      )
    );
    const ipfsData = await Promise.all(
      referenceSlots.map(async (referenceSlot) => {
        const [baseUri, extension] = await metadata.ipfsData(referenceSlot);
        return [referenceSlot, { baseUri, extension }] as const;
      })
    );
    const ipfsByReferenceSlot = Object.fromEntries(ipfsData);
    const renderLayers = properties.map((property) =>
      stripLayerPrefix(property.name)
    );
    const images = properties.flatMap((property) => {
      const trait = stripLayerPrefix(property.name);

      return property.items.map((item) => {
        const ipfs = ipfsByReferenceSlot[item.referenceSlot];

        return {
          name: item.name,
          trait,
          uri: normalizeArtworkUri(
            `${ipfs.baseUri}${encodeURIComponent(
              property.name
            )}/${encodeURIComponent(item.name)}${ipfs.extension}`
          ),
        };
      });
    });

    return {
      images,
      renderLayers,
      orderedLayers: renderLayers
        .map((trait) => ({
          trait,
          properties: images
            .filter((image) => image.trait === trait)
            .map((image) => image.name),
        }))
        .reverse(),
    };
  };

export const getYellowCollectiveArtworkLabel = () =>
  TOKEN_NETWORK === "8453" ? "Yellow Collective on Base" : "Yellow Collective";
