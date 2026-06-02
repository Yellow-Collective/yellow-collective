import Layout from "@/components/Layout";
import type {
  PlaygroundArtwork,
  PlaygroundImage,
} from "data/nouns-builder/artwork";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

type SubmitDraft = {
  title: string;
  artist: string;
  traitType: string;
  pixels: string[];
  selectedTraits: Record<string, string>;
};

const GRID_SIZE = 32;
const EMPTY_PIXEL = "transparent";
const LOCKED_TRAIT = "glasses";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

const layerLabels: Record<string, string> = {
  accessories: "Accessory",
  backgrounds: "Background",
  bodies: "Body",
  glasses: "Noggles",
  heads: "Head",
};

const getLayerLabel = (trait: string) =>
  layerLabels[trait] || trait.replace(/[-_]+/g, " ");

const getRandomItem = <T,>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)];

const getTraitImage = (
  images: PlaygroundImage[],
  trait: string,
  selectedName?: string
) =>
  images.find((image) => image.trait === trait && image.name === selectedName);

export default function NoundrySubmitPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [draft, setDraft] = useState<SubmitDraft | null>(null);
  const [submissionTitle, setSubmissionTitle] = useState("");
  const [artwork, setArtwork] = useState<PlaygroundArtwork | null>(null);
  const [selectedTraits, setSelectedTraits] = useState<Record<string, string>>(
    {}
  );
  const [variations, setVariations] = useState<Record<string, string>[]>([]);
  const [activeTraitPicker, setActiveTraitPicker] = useState<string | null>(
    null
  );
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedDraft = window.sessionStorage.getItem("noundry-submit-draft");
    if (storedDraft) {
      const parsedDraft = JSON.parse(storedDraft) as SubmitDraft;
      setDraft(parsedDraft);
      setSelectedTraits(parsedDraft.selectedTraits);
    }

    fetch("/api/playground/artwork")
      .then((response) => response.json())
      .then((data) => setArtwork(data as PlaygroundArtwork))
      .catch((error) => console.error("Unable to load artwork", error));
  }, []);

  const previewLayers = useMemo(() => {
    if (!artwork || !draft) return [];

    return artwork.renderLayers
      .map((trait) =>
        getTraitImage(artwork.images, trait, selectedTraits[trait])
      )
      .filter((image): image is PlaygroundImage => Boolean(image));
  }, [artwork, draft, selectedTraits]);

  const customizableLayers = useMemo(() => {
    if (!artwork || !draft) return [];

    return artwork.orderedLayers.filter(
      (layer) => layer.trait !== LOCKED_TRAIT && layer.trait !== draft.traitType
    );
  }, [artwork, draft]);

  const generateVariations = () => {
    if (!artwork || !draft) return;

    const nextVariations = Array.from({ length: 100 }, () =>
      Object.fromEntries(
        artwork.orderedLayers.map((layer) => {
          const isLocked =
            layer.trait === LOCKED_TRAIT || layer.trait === draft.traitType;

          return [
            layer.trait,
            isLocked
              ? selectedTraits[layer.trait] || draft.selectedTraits[layer.trait]
              : getRandomItem(layer.properties),
          ];
        })
      )
    );

    setVariations(nextVariations);
    setSelectedTraits(nextVariations[0]);
  };

  const activeTraitImages =
    artwork && activeTraitPicker
      ? artwork.images.filter((image) => image.trait === activeTraitPicker)
      : [];

  const handleSubmit = async () => {
    if (!draft || !address) return;

    setSubmitError("");
    setIsSubmitting(true);

    try {
      const submittedTraits = { ...draft.selectedTraits, ...selectedTraits };
      const response = await fetch("/api/noundry/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: submissionTitle || draft.title,
          artist: address,
          traitType: draft.traitType,
          pixels: draft.pixels,
          selectedTraits: submittedTraits,
          previewTraits: submittedTraits,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to submit trait.");
      }

      window.sessionStorage.removeItem("noundry-submit-draft");
      router.push("/noundry?tab=gallery");
    } catch (error) {
      console.error("Unable to submit Noundry trait", error);
      setSubmitError(
        error instanceof Error ? error.message : "Unable to submit trait."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Submit Noundry Trait | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[620px] flex-col items-center gap-8 pb-12">
        <h1 className="font-heading text-[52px] leading-none text-skin-base">
          Submit{" "}
          {draft ? getLayerLabel(draft.traitType).toLowerCase() : "trait"}
        </h1>

        <section className="relative w-full border border-[#e1e1e1] bg-accent p-8 shadow-sm md:bg-white">
          <div className="flex items-start justify-between gap-4">
            <input
              value={submissionTitle}
              onChange={(event) => setSubmissionTitle(event.target.value)}
              placeholder={draft?.title || "Name goes here"}
              className="yc-dark-noundry-submit-text min-w-0 flex-1 bg-transparent font-heading text-3xl leading-none text-skin-base underline outline-none placeholder:text-skin-base"
            />
            <div className="text-right">
              <div className="ml-auto flex h-12 w-12 items-center justify-center bg-[#d8d8df] text-white">
                <LayerPartIcon
                  trait={draft?.traitType || "heads"}
                  className="h-8 w-8"
                />
              </div>
              <div className="yc-dark-noundry-submit-text mt-2 font-heading text-xl uppercase tracking-wide text-skin-base">
                {draft ? getLayerLabel(draft.traitType) : "Trait"}
              </div>
            </div>
          </div>

          <div className="yc-dark-noundry-submit-preview mt-8 aspect-square bg-[#fff3bf]">
            {draft && (
              <NounPreview
                layers={previewLayers}
                draft={draft}
                className="relative h-full w-full"
              />
            )}
          </div>

          <div className="mt-4 grid grid-cols-[1fr_1fr] gap-6">
            <div>
              <div className="font-heading text-sm uppercase tracking-wide text-skin-base">
                Pick
              </div>
              <button
                type="button"
                onClick={generateVariations}
                className="mt-1 flex h-14 w-14 items-center justify-center rounded-xl bg-[#5e586f] text-white shadow-[0px_4px_0px_0px_#3f3858] transition hover:bg-[#4b465e] active:translate-y-1 active:shadow-none"
                aria-label="Generate 100 randomized preview variations"
              >
                <DiceGlyph />
              </button>
            </div>
            <div>
              <div className="text-right font-heading text-sm uppercase tracking-wide text-skin-base">
                Customize
              </div>
              <div className="mt-1 flex justify-end gap-2">
                {customizableLayers.map((layer) => (
                  <button
                    key={layer.trait}
                    type="button"
                    onClick={() => setActiveTraitPicker(layer.trait)}
                    className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#5e586f] text-white shadow-[0px_4px_0px_0px_#3f3858] transition hover:bg-[#4b465e] active:translate-y-1 active:shadow-none"
                    aria-label={`Customize ${getLayerLabel(layer.trait)}`}
                    title={getLayerLabel(layer.trait)}
                  >
                    <LayerPartIcon trait={layer.trait} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {variations.length > 0 && draft && (
            <div className="mt-5 max-h-72 overflow-y-auto border-t border-[#e1e1e1] pt-4">
              <div className="grid grid-cols-5 gap-2">
                {variations.map((variation, index) => {
                  const variationLayers =
                    artwork?.renderLayers
                      .map((trait) =>
                        getTraitImage(artwork.images, trait, variation[trait])
                      )
                      .filter((image): image is PlaygroundImage =>
                        Boolean(image)
                      ) || [];

                  return (
                    <button
                      key={`variation-${index}`}
                      type="button"
                      onClick={() => setSelectedTraits(variation)}
                      className="aspect-square overflow-hidden rounded-lg bg-[#fff3bf] transition hover:ring-2 hover:ring-[#5e586f]"
                      aria-label={`Use variation ${index + 1}`}
                    >
                      <NounPreview
                        layers={variationLayers}
                        draft={draft}
                        className="relative h-full w-full"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTraitPicker && (
            <TraitPickerPopup
              title={getLayerLabel(activeTraitPicker)}
              images={activeTraitImages}
              value={selectedTraits[activeTraitPicker] || ""}
              onClose={() => setActiveTraitPicker(null)}
              onSelect={(value) => {
                setSelectedTraits((currentTraits) => ({
                  ...currentTraits,
                  [activeTraitPicker]: value,
                }));
                setActiveTraitPicker(null);
              }}
            />
          )}
        </section>

        <div className="grid w-full gap-3">
          {submitError && (
            <div className="rounded-2xl border border-skin-stroke bg-white p-4 text-center text-skin-proposal-danger shadow-sm">
              {submitError}
            </div>
          )}
          <button
            type="button"
            onClick={() => router.push("/noundry")}
            className="rounded-[18px] border border-[#d6d6d6] bg-white px-4 py-4 font-heading text-xl text-[#5e586f] shadow-[0px_4px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:bg-[#f7f7f7] active:translate-y-1 active:shadow-none"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isConnected || !draft || isSubmitting}
            className={`rounded-[18px] px-4 py-4 font-heading text-xl text-white transition active:translate-y-1 active:shadow-none ${
              isConnected && draft && !isSubmitting
                ? "bg-[#1d9bf0] shadow-[0px_4px_0px_0px_#0f5f99] hover:bg-[#45adf5]"
                : "cursor-not-allowed bg-[#9bd3f8] shadow-[0px_4px_0px_0px_#6aa9d2]"
            }`}
          >
            {isSubmitting
              ? "Submitting..."
              : isConnected
                ? "Submit"
                : "Connect wallet to submit"}
          </button>
        </div>
      </div>
    </Layout>
  );
}

const NounPreview = ({
  layers,
  draft,
  className,
}: {
  layers: PlaygroundImage[];
  draft: SubmitDraft;
  className?: string;
}) => {
  const baseLayers = layers.filter(
    (image) => image.trait !== LOCKED_TRAIT && image.trait !== draft.traitType
  );
  const glassesLayers = layers.filter((image) => image.trait === LOCKED_TRAIT);

  return (
    <div className={className}>
      {baseLayers.map((image) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${image.trait}-${image.name}`}
          src={image.uri}
          alt=""
          className="absolute inset-0 h-full w-full object-contain [image-rendering:pixelated]"
        />
      ))}
      <PixelPreview pixels={draft.pixels} />
      {glassesLayers.map((image) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${image.trait}-${image.name}`}
          src={image.uri}
          alt=""
          className="absolute inset-0 h-full w-full object-contain [image-rendering:pixelated]"
        />
      ))}
    </div>
  );
};

const PixelPreview = ({ pixels }: { pixels: string[] }) => (
  <div
    className="absolute inset-0 grid h-full w-full"
    style={{
      gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
    }}
  >
    {pixels.map((color, index) => (
      <div
        key={index}
        className="aspect-square"
        style={{
          backgroundColor: color === EMPTY_PIXEL ? "transparent" : color,
        }}
      />
    ))}
  </div>
);

const layerPartIconSrc: Record<string, string> = {
  accessories: "/noundry-icons/accessory.svg",
  backgrounds: "/noundry-icons/background.svg",
  bodies: "/noundry-icons/body.svg",
  heads: "/noundry-icons/head.svg",
};

const LayerPartIcon = ({
  trait,
  className = "h-8 w-8",
}: {
  trait: string;
  className?: string;
}) => (
  <span
    className={`block bg-current ${className}`}
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

const DiceGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
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

const TraitPickerPopup = ({
  title,
  images,
  value,
  onClose,
  onSelect,
}: {
  title: string;
  images: PlaygroundImage[];
  value: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) => (
  <div className="absolute inset-8 z-20 flex items-center justify-center bg-white/85 p-4">
    <div className="max-h-full w-full overflow-hidden border border-[#d8d8df] bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-[#d8d8df] px-4 py-3">
        <div className="font-heading text-lg text-[#777780]">
          Select {title}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 font-heading text-sm text-[#777780] underline transition hover:bg-[#f4f4f4]"
        >
          Close
        </button>
      </div>
      <div className="grid max-h-[520px] grid-cols-4 gap-3 overflow-y-auto p-4">
        {images.map((image) => (
          <button
            key={image.name}
            type="button"
            onClick={() => onSelect(image.name)}
            className={`rounded-lg bg-[#fff3bf] p-2 text-left transition hover:ring-2 hover:ring-[#5e586f] ${
              image.name === value ? "ring-2 ring-[#5e586f]" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.uri}
              alt={image.name}
              className="aspect-square w-full object-contain [image-rendering:pixelated]"
            />
            <div className="mt-1 truncate text-xs text-[#777780]">
              {image.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>
);
