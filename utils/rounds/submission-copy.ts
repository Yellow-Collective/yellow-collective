export type RoundSubmissionPlaceholders = {
  title: string;
  url: string;
  image: string;
  description: string;
};

export const getRoundSubmissionPlaceholders = (
  roundTitle: string
): RoundSubmissionPlaceholders => {
  const title = roundTitle.trim();

  return {
    title: title
      ? `Enter a submission title for ${title}`
      : "Enter a submission title",
    url: "Enter your submission URL",
    image: title ? `Enter an image URL for ${title}` : "Enter an image URL",
    description: title
      ? `Describe your submission for ${title}.`
      : "Describe your submission for this round.",
  };
};
