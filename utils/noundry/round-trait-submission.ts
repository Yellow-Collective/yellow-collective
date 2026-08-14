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
