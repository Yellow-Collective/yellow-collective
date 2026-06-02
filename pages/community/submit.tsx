import Layout from "@/components/Layout";
import ProjectMemberSelector from "@/components/community/ProjectMemberSelector";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import type { CommunityProject } from "data/community";
import type { DaoMemberSummary } from "data/members";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAccount } from "wagmi";
import { areSameWalletAddress } from "@/utils/profile/identity";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const initialValues = {
  title: "",
  description: "",
  details: "",
  artist: "",
  category: "Art",
  date: "",
  href: "",
  image: "",
  galleryImages: [""],
  links: [{ title: "", href: "" }],
};

type UploadedImage = {
  name: string;
  type: string;
  dataUrl: string;
};

const MAX_GALLERY_UPLOADS = 6;

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) throw new Error(data.error || "Unable to load data.");
  return data;
};

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function SubmitCommunityProjectPage() {
  const { address: connectedAddress } = useAccount();
  const { data: membersData, error: membersError } = useSWR<{
    members: DaoMemberSummary[];
  }>("/api/members", fetcher);
  const members = useMemo(() => membersData?.members || [], [membersData]);
  const [values, setValues] = useState(initialValues);
  const [memberAddresses, setMemberAddresses] = useState<string[]>([]);
  const [defaultedAddress, setDefaultedAddress] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(
    null
  );
  const [uploadedGalleryImages, setUploadedGalleryImages] = useState<
    UploadedImage[]
  >([]);
  const [submissionError, setSubmissionError] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slug = slugify(values.title);
  const details = values.details
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const galleryImages = values.galleryImages
    .map((image) => image.trim())
    .filter(Boolean);
  const galleryImageUploads = uploadedGalleryImages.map(
    (image) => image.dataUrl
  );
  const links = values.links
    .map((link) => ({ title: link.title.trim(), href: link.href.trim() }))
    .filter((link) => link.title && link.href);
  const imageValue = uploadedImage?.dataUrl || values.image.trim();
  const projectData: CommunityProject = {
    slug,
    title: values.title.trim(),
    description: values.description.trim(),
    details,
    artist: values.artist.trim(),
    memberAddresses,
    category: values.category.trim(),
    date: values.date.trim(),
    href: values.href.trim(),
    image: imageValue,
    galleryImages: [...galleryImages, ...galleryImageUploads],
    links,
  };
  const isResolvingConnectedMember = Boolean(
    connectedAddress && !membersData && !membersError
  );
  const canSubmit = Boolean(
    slug &&
      projectData.title &&
      projectData.description &&
      details.length &&
      projectData.artist &&
      projectData.category &&
      projectData.date &&
      projectData.href &&
      projectData.image &&
      !isResolvingConnectedMember
  );

  const updateValue = (field: keyof typeof values, value: string) => {
    setSubmissionError("");
    setSubmissionMessage("");
    setValues((currentValues) => ({ ...currentValues, [field]: value }));
  };
  const updateGalleryImage = (index: number, value: string) => {
    setSubmissionError("");
    setSubmissionMessage("");
    setValues((currentValues) => {
      const nextImages = [...currentValues.galleryImages];
      nextImages[index] = value;
      return { ...currentValues, galleryImages: nextImages };
    });
  };
  const addGalleryImage = () => {
    setValues((currentValues) => ({
      ...currentValues,
      galleryImages: [...currentValues.galleryImages, ""],
    }));
  };
  const updateLink = (
    index: number,
    field: keyof (typeof initialValues.links)[number],
    value: string
  ) => {
    setSubmissionError("");
    setSubmissionMessage("");
    setValues((currentValues) => {
      const nextLinks = [...currentValues.links];
      nextLinks[index] = { ...nextLinks[index], [field]: value };
      return { ...currentValues, links: nextLinks };
    });
  };
  const addLink = () => {
    setValues((currentValues) => ({
      ...currentValues,
      links: [...currentValues.links, { title: "", href: "" }],
    }));
  };
  const validateImageFile = (file: File) => {
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type
      )
    ) {
      throw new Error("Upload a PNG, JPG, WEBP, or GIF image.");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Image uploads must be smaller than 5MB.");
    }
  };
  const readImageFile = (file: File) =>
    new Promise<UploadedImage>((resolve, reject) => {
      validateImageFile(file);

      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          name: file.name,
          type: file.type,
          dataUrl: String(reader.result),
        });
      };
      reader.onerror = () => reject(new Error("Unable to read image file."));
      reader.readAsDataURL(file);
    });
  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSubmissionError("");
    setSubmissionMessage("");

    if (!file) {
      setUploadedImage(null);
      return;
    }

    try {
      setUploadedImage(await readImageFile(file));
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Unable to read image file."
      );
      event.target.value = "";
    }
  };
  const handleGalleryImageUpload = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    setSubmissionError("");
    setSubmissionMessage("");

    if (!files.length) return;

    if (uploadedGalleryImages.length + files.length > MAX_GALLERY_UPLOADS) {
      setSubmissionError(
        `Upload ${MAX_GALLERY_UPLOADS} additional images or fewer.`
      );
      event.target.value = "";
      return;
    }

    try {
      const uploadedImages = await Promise.all(files.map(readImageFile));
      setUploadedGalleryImages((currentImages) => [
        ...currentImages,
        ...uploadedImages,
      ]);
      event.target.value = "";
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Unable to read image files."
      );
      event.target.value = "";
    }
  };
  const removeUploadedGalleryImage = (index: number) => {
    setSubmissionError("");
    setSubmissionMessage("");
    setUploadedGalleryImages((currentImages) =>
      currentImages.filter((_, imageIndex) => imageIndex !== index)
    );
  };
  const resetForm = () => {
    setValues(initialValues);
    setMemberAddresses([]);
    setDefaultedAddress(null);
    setUploadedImage(null);
    setUploadedGalleryImages([]);
  };

  useEffect(() => {
    if (!connectedAddress || defaultedAddress === connectedAddress) return;

    const connectedMember = members.find((member) =>
      areSameWalletAddress(member.address, connectedAddress)
    );

    if (!connectedMember) return;

    setMemberAddresses((currentAddresses) =>
      currentAddresses.some((address) =>
        areSameWalletAddress(address, connectedMember.address)
      )
        ? currentAddresses
        : [...currentAddresses, connectedMember.address]
    );
    setDefaultedAddress(connectedAddress);
  }, [connectedAddress, defaultedAddress, members]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmissionError("");
    setSubmissionMessage("");

    try {
      const response = await fetch("/api/community/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: {
            ...projectData,
            galleryImages,
          },
          image: uploadedImage,
          galleryImageUploads: uploadedGalleryImages,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Submission failed.");
      }

      setSubmissionMessage(
        "Submission received. An admin will review it before it appears in the gallery."
      );
      resetForm();
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Submission failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Submit Project | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-7 pb-12">
        <Link
          href="/projects"
          className="flex w-fit items-center gap-2 font-heading text-lg text-skin-base transition hover:opacity-80"
        >
          <span className="yc-dark-yellow-button flex h-10 w-10 items-center justify-center rounded-full border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] active:translate-y-1 active:shadow-none">
            <ArrowLeftIcon className="h-4 text-skin-base" />
          </span>
          Projects
        </Link>

        <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:p-8">
          <h1 className="font-heading text-[34px] leading-none md:text-[42px]">
            Submit a project
          </h1>
          <p className="mt-4 text-base leading-snug text-secondary md:text-lg">
            Submissions are stored for admin review. Approved projects appear
            in the projects gallery.
          </p>
        </section>

        <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:p-8">
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              label="Project title"
              value={values.title}
              onChange={(value) => updateValue("title", value)}
              placeholder="Collective Nouns Trait Contests"
            />
            <FormField
              label="Artist"
              value={values.artist}
              onChange={(value) => updateValue("artist", value)}
              placeholder="Artist or creator name"
            />
            <div className="md:col-span-2">
              <ProjectMemberSelector
                members={members}
                selectedAddresses={memberAddresses}
                onChange={setMemberAddresses}
                isLoading={!membersData && !membersError}
                error={
                  membersError
                    ? "Members could not be loaded. You can still submit without linked members."
                    : undefined
                }
              />
            </div>
            <div>
              <label className="font-heading text-base text-skin-base">
                Category
              </label>
              <select
                value={values.category}
                onChange={(event) =>
                  updateValue("category", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
              >
                <option value="Art">Art</option>
                <option value="Event">Event</option>
                <option value="Tech">Tech</option>
                <option value="Media">Media</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <FormField
              label="Date"
              value={values.date}
              onChange={(value) => updateValue("date", value)}
              placeholder="2026"
            />
            <FormField
              label="Source link"
              value={values.href}
              onChange={(value) => updateValue("href", value)}
              placeholder="example.com"
            />
          </div>

          <div className="mt-5">
            <label className="block font-heading text-base text-skin-base">
              Additional links
            </label>
            <div className="mt-2 flex flex-col gap-3">
              {values.links.map((link, index) => (
                <div key={index} className="grid gap-3 md:grid-cols-2">
                  <input
                    value={link.title}
                    onChange={(event) =>
                      updateLink(index, "title", event.target.value)
                    }
                    placeholder="Link title"
                    className="w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
                  />
                  <input
                    value={link.href}
                    onChange={(event) =>
                      updateLink(index, "href", event.target.value)
                    }
                    placeholder="example.com/context"
                    className="w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLink}
              className="mt-3 font-heading text-base text-skin-base underline"
            >
              Add another link
            </button>
          </div>

          <label className="mt-5 block font-heading text-base text-skin-base">
            Short description
          </label>
          <textarea
            value={values.description}
            onChange={(event) => updateValue("description", event.target.value)}
            rows={3}
            placeholder="One short sentence that explains the project."
            className="mt-2 w-full resize-none rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
          />

          <label className="mt-5 block font-heading text-base text-skin-base">
            Detail paragraphs
          </label>
          <textarea
            value={values.details}
            onChange={(event) => updateValue("details", event.target.value)}
            rows={5}
            placeholder="Add one paragraph per line."
            className="mt-2 w-full resize-none rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
          />

          <FormField
            label="Banner image URL"
            value={values.image}
            onChange={(value) => updateValue("image", value)}
            placeholder="example.com/banner.png"
            className="mt-5"
          />

          <div className="mt-5 rounded-xl border border-skin-stroke bg-skin-muted p-4">
            <label className="block font-heading text-base text-skin-base">
              Or upload banner image
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleImageUpload}
              className="mt-2 block w-full text-base text-skin-base file:mr-4 file:rounded-xl file:border-0 file:bg-accent file:px-4 file:py-2 file:font-heading file:text-skin-base"
            />
            {uploadedImage && (
              <div className="mt-3 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedImage.dataUrl}
                  alt="Uploaded banner preview"
                  className="h-20 w-20 rounded-xl border border-skin-stroke object-cover"
                />
                <div className="text-sm text-secondary">
                  This image will be stored with the submitted project for
                  admin review.
                </div>
              </div>
            )}
          </div>

          <div className="mt-5">
            <label className="block font-heading text-base text-skin-base">
              Additional images
            </label>
            <p className="mt-1 text-sm text-secondary">
              Add image URLs, upload image files, or use both.
            </p>
            <div className="mt-2 flex flex-col gap-3">
              {values.galleryImages.map((image, index) => (
                <input
                  key={index}
                  value={image}
                  onChange={(event) =>
                    updateGalleryImage(index, event.target.value)
                  }
                  placeholder="example.com/gallery-image.png"
                  className="w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addGalleryImage}
              className="mt-3 font-heading text-base text-skin-base underline"
            >
              Add another image URL
            </button>
            <div className="mt-4 rounded-xl border border-skin-stroke bg-skin-muted p-4">
              <label className="block font-heading text-base text-skin-base">
                Upload additional images
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                onChange={handleGalleryImageUpload}
                className="mt-2 block w-full text-base text-skin-base file:mr-4 file:rounded-xl file:border-0 file:bg-accent file:px-4 file:py-2 file:font-heading file:text-skin-base"
              />
              {uploadedGalleryImages.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {uploadedGalleryImages.map((image, index) => (
                    <div
                      key={`${image.name}-${index}`}
                      className="rounded-xl border border-skin-stroke bg-white p-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.dataUrl}
                        alt={`${image.name} preview`}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-xs text-secondary">
                          {image.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeUploadedGalleryImage(index)}
                          className="shrink-0 font-heading text-xs text-skin-base underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 md:flex-row">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className={`yc-dark-submit-blue yc-project-submit-button flex items-center justify-center rounded-[18px] px-5 py-3 font-heading text-lg shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:shadow-[0px_6px_0px_0px_#0f5f99] active:translate-y-1 active:shadow-none ${
                canSubmit && !isSubmitting
                  ? "bg-accent text-skin-base hover:bg-[#ffd84d]"
                  : "bg-skin-button-muted text-skin-inverted opacity-70"
              }`}
            >
              {isSubmitting
                ? "Submitting..."
                : isResolvingConnectedMember
                  ? "Loading members..."
                  : "Submit for review"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="yc-project-submit-reset-button flex items-center justify-center rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-lg text-white shadow-[0px_4.02px_0px_0px_#7f1d1d] transition hover:-translate-y-0.5 hover:shadow-[0px_6px_0px_0px_#7f1d1d] active:translate-y-1 active:shadow-none"
            >
              Reset
            </button>
          </div>
          {submissionError && (
            <p className="mt-4 rounded-xl border border-skin-proposal-danger bg-skin-proposal-danger bg-opacity-10 p-3 text-sm text-skin-proposal-danger">
              {submissionError}
            </p>
          )}
          {submissionMessage && (
            <p className="yc-project-submit-success-alert mt-4 rounded-xl border border-skin-proposal-success bg-skin-proposal-success bg-opacity-10 p-3 text-sm text-skin-proposal-success">
              {submissionMessage}
            </p>
          )}
        </section>
      </div>
    </Layout>
  );
}

const FormField = ({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) => (
  <div className={className}>
    <label className="font-heading text-base text-skin-base">{label}</label>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="mt-2 w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
    />
  </div>
);
