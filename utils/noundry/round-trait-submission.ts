export const ROUND_TRAIT_MODAL_PREVIEW_COUNT = 6;

export type RoundTraitModalPreviewPlan<T> = {
  generatedTraits: T[];
  collectionTraits: T[];
  generatedEditedIndexes: number[];
  collectionEditedIndexes: number[];
};

export const buildRoundTraitModalPreviewPlan = <T>({
  seedPrefix,
  submittedTraitOverride,
  buildTraits,
}: {
  seedPrefix: string;
  submittedTraitOverride: Record<string, string>;
  buildTraits: (seed: string, overrides: Record<string, string>) => T;
}): RoundTraitModalPreviewPlan<T> => {
  const generatedEditedIndexes = Array.from(
    { length: ROUND_TRAIT_MODAL_PREVIEW_COUNT },
    (_, index) => index
  );
  const collectionEditedIndexes = [0];

  return {
    generatedTraits: generatedEditedIndexes.map((index) =>
      buildTraits(
        `${seedPrefix}-round-generated-${index}`,
        submittedTraitOverride
      )
    ),
    collectionTraits: generatedEditedIndexes.map((index) =>
      buildTraits(
        `${seedPrefix}-round-collection-${index}`,
        collectionEditedIndexes.includes(index) ? submittedTraitOverride : {}
      )
    ),
    generatedEditedIndexes,
    collectionEditedIndexes,
  };
};

const ROUND_TRAIT_TEXT_PADDING = " Submitted from the Noundry Gallery.";

export const fitRoundTraitText = ({
  value,
  fallback,
  minLength,
  maxLength,
}: {
  value?: string;
  fallback: string;
  minLength: number;
  maxLength: number;
}) => {
  const normalizedMax = Math.max(0, Math.floor(maxLength));
  const normalizedMin = Math.min(
    normalizedMax,
    Math.max(0, Math.floor(minLength))
  );
  let text =
    String(value || "").trim() ||
    String(fallback || "").trim() ||
    "Noundry trait";

  if (text.length > normalizedMax) {
    return text.slice(0, normalizedMax);
  }

  while (text.length < normalizedMin) {
    text += ROUND_TRAIT_TEXT_PADDING.slice(0, normalizedMin - text.length);
  }

  return text;
};

export const selectRoundTraitSubmitterLabel = ({
  ensName,
  profileName,
  walletAddress,
}: {
  ensName?: string | null;
  profileName?: string | null;
  walletAddress: string;
}) =>
  String(ensName || "").trim() ||
  String(profileName || "").trim() ||
  walletAddress;

export const isRoundTraitAutoDescription = ({
  submissionType,
  traitType,
  walletAddress,
  description,
  sourcePayload,
}: {
  submissionType: string;
  traitType?: string | null;
  walletAddress: string;
  description: string;
  sourcePayload?: Record<string, unknown> | null;
}) => {
  if (submissionType !== "trait" || !traitType) return false;
  if (sourcePayload?.roundSubmissionAutoDescription === true) return true;

  const prefix = `Noundry ${traitType} trait submitted by `;
  if (!description.startsWith(prefix)) return false;

  const legacyIdentity = description.slice(prefix.length).split(".", 1)[0];
  return Boolean(
    legacyIdentity &&
      walletAddress.toLowerCase().startsWith(legacyIdentity.toLowerCase())
  );
};

const SVG_ATTRIBUTE_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  '"': "&quot;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

export const escapeSvgAttribute = (value: string) =>
  String(value).replace(
    /[&"'<>]/g,
    (character) => SVG_ATTRIBUTE_ENTITIES[character]
  );

export const buildRoundTraitSubmissionPayload = (
  traitId: string,
  description: string
) => {
  const trimmedDescription = description.trim();

  return {
    traitId,
    ...(trimmedDescription ? { description: trimmedDescription } : {}),
  };
};

const TRUSTED_NOUNDRY_SVG_DATA_PATTERN =
  /^data:image\/svg\+xml;base64,[a-zA-Z0-9+/=]+$/;

export const validateDerivedRoundTraitSubmission = ({
  traitId,
  title,
  description,
  image,
  url,
  minTitleLength,
  maxTitleLength,
  minDescriptionLength,
  maxDescriptionLength,
}: {
  traitId: string;
  title: string;
  description: string;
  image: string;
  url: string;
  minTitleLength: number;
  maxTitleLength: number;
  minDescriptionLength: number;
  maxDescriptionLength: number;
}) => {
  if (title.length < minTitleLength || title.length > maxTitleLength) {
    return `Title must be ${minTitleLength}-${maxTitleLength} characters.`;
  }

  if (
    description.length < minDescriptionLength ||
    description.length > maxDescriptionLength
  ) {
    return `Description must be ${minDescriptionLength}-${maxDescriptionLength} characters.`;
  }

  if (!TRUSTED_NOUNDRY_SVG_DATA_PATTERN.test(image)) {
    return "The generated Noundry preview image is invalid.";
  }

  if (url !== `/noundry/traits/${traitId}`) {
    return "The canonical Noundry trait link is invalid.";
  }

  return undefined;
};
