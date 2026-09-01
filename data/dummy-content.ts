import type { CommunityProject } from "data/community";
import type { GalleryCoin } from "data/coins";
import type {
  Round,
  RoundAward,
  RoundSubmission,
  RoundVoteActivity,
  RoundWithSubmissions,
} from "data/rounds";
import {
  getBooleanSiteSetting,
  setBooleanSiteSetting,
} from "data/site-settings";
import { getAddress } from "viem";

const DUMMY_CONTENT_SETTING_KEY = "dummy_content_enabled";

const TEST_WALLETS = [
  getAddress("0xdcf37d8aa17142f053aaa7dc56025ab00d897a19"),
  getAddress("0x1111111111111111111111111111111111111111"),
  getAddress("0x2222222222222222222222222222222222222222"),
  getAddress("0x3333333333333333333333333333333333333333"),
  getAddress("0x4444444444444444444444444444444444444444"),
  getAddress("0x5555555555555555555555555555555555555555"),
];

type DummyProjectSeed = {
  slug: string;
  title: string;
  description: string;
  submissionDescription: string;
  category: string;
  image: string;
  walletIndex: number;
};

type DummyRoundSeed = {
  slug: string;
  title: string;
  description: string;
  image: string;
  startsInDays: number;
  submissionsOpenInDays: number;
  votingStartsInDays: number;
  votingEndsInDays: number;
  submissions: Array<{
    projectSlug: string;
    voteCount: number;
    winnerPosition?: number;
  }>;
};

const dummyProjects: DummyProjectSeed[] = [
  {
    slug: "demo-yellow-field-notes",
    title: "Yellow Field Notes",
    description:
      "A lightweight publishing log for documenting experiments, governance ideas, and community work.",
    submissionDescription: `## Project summary

Yellow Field Notes is a recurring editorial post format for turning loose community updates into a durable archive. Each issue combines short notes from builders, links to active proposals, and a clear list of next actions.

## What gets shipped

The first version includes a simple template, a weekly publishing cadence, and reusable sections for governance, artwork, product experiments, and round outcomes.

## Why it helps Yellow

The Collective has work happening across many surfaces. This gives members one scannable artifact that can be coined, shared, submitted to rounds, and referenced later when proposals or project updates need context.`,
    category: "Writing",
    image: "/og-image.png",
    walletIndex: 0,
  },
  {
    slug: "demo-daily-builder-card",
    title: "Daily Builder Card",
    description:
      "A collectible card format for highlighting one builder, artifact, or useful link each day.",
    submissionDescription: `## Project summary

Daily Builder Card is a repeatable visual post for spotlighting one person, artifact, or useful link from the Yellow ecosystem each day. The format is intentionally small enough to publish often without turning into a large editorial lift.

## Format

Each card includes a title, one strong visual, a one-paragraph note, and a link back to the builder or source material. Cards can be minted as content coins and later bundled into recap posts.

## Testing notes

This dummy submission is useful for checking long copy, card previews, creator attribution, and how multiple submissions stack inside an active round.`,
    category: "Art",
    image: "/banner.png",
    walletIndex: 1,
  },
  {
    slug: "demo-round-recap-video",
    title: "Round Recap Video",
    description:
      "A short-form recap template for turning completed rounds into reusable video summaries.",
    submissionDescription: `## Project summary

Round Recap Video turns each completed round into a short, shareable video that explains the prompt, highlights finalists, and shows the winning submission. The goal is to make round outcomes easier to understand outside the website.

## Production plan

The first pass uses a fixed structure: intro card, round prompt, three submission highlights, winner reveal, and a final callout to the next open round.

## Success criteria

This is successful if members can quickly understand what happened in a round and if creators have a polished artifact they can share after participating.`,
    category: "Video",
    image: "/miniapp-hero.png",
    walletIndex: 2,
  },
  {
    slug: "demo-mobile-gallery-pass",
    title: "Mobile Gallery Pass",
    description:
      "A mobile-first gallery card for sharing Yellow artwork and content coins across social clients.",
    submissionDescription: `## Project summary

Mobile Gallery Pass is a compact mobile page for presenting one Yellow artwork, post, or coin with the smallest possible amount of friction. It is designed for links shared from Farcaster, group chats, and proposal updates.

## User flow

Visitors land on the artwork, see the creator and coin context, then choose between viewing the full gallery, opening the coin page, or following the creator profile.

## Why it matters

The current gallery works well as a destination, but individual pieces need a sharper mobile landing surface for discovery and repeated sharing.`,
    category: "Product",
    image: "/miniapp-embed.png",
    walletIndex: 3,
  },
  {
    slug: "demo-noundry-remix-kit",
    title: "Noundry Remix Kit",
    description:
      "A remixable asset pack that helps artists submit traits and derivative Yellow characters.",
    submissionDescription: `## Project summary

Noundry Remix Kit packages sample traits, reference exports, and submission guidance for artists who want to make Yellow-compatible characters or trait concepts.

## Included materials

The kit includes example backgrounds, transparent trait layers, naming guidance, and a checklist for preparing a clean submission to the Noundry gallery or a trait-specific round.

## Round fit

This submission is meant to test how asset-heavy project descriptions appear in round cards, modals, and winner views.`,
    category: "Noundry",
    image: "/noggles.png",
    walletIndex: 4,
  },
  {
    slug: "demo-governance-brief",
    title: "Governance Brief",
    description:
      "A compact brief format for proposals, round requests, and Collective Noun voting context.",
    submissionDescription: `## Project summary

Governance Brief is a concise writeup format for proposals, round requests, and voting context. It gives voters a predictable structure before they decide how to allocate attention or votes.

## Sections

Each brief includes the decision, background, requested action, risks, dependencies, and a short recommendation from the author.

## Testing value

This dummy entry has multiple headings and paragraphs so round submission views can be tested against more realistic copy length and formatting.`,
    category: "Governance",
    image: "/apple-touch-icon.png",
    walletIndex: 5,
  },
];

const dummyRounds: DummyRoundSeed[] = [
  {
    slug: "demo-upcoming-round",
    title: "Dummy Upcoming Round",
    description:
      "A scheduled test round for checking upcoming round cards and detail pages.",
    image: "/banner.png",
    startsInDays: 3,
    submissionsOpenInDays: 3,
    votingStartsInDays: 10,
    votingEndsInDays: 17,
    submissions: [
      { projectSlug: "demo-yellow-field-notes", voteCount: 0 },
      { projectSlug: "demo-mobile-gallery-pass", voteCount: 0 },
      { projectSlug: "demo-governance-brief", voteCount: 0 },
    ],
  },
  {
    slug: "demo-open-round",
    title: "Dummy Open Round",
    description:
      "An active submission test round for checking project submission and listing states.",
    image: "/og-image.png",
    startsInDays: -3,
    submissionsOpenInDays: -2,
    votingStartsInDays: 5,
    votingEndsInDays: 12,
    submissions: [
      { projectSlug: "demo-daily-builder-card", voteCount: 4 },
      { projectSlug: "demo-round-recap-video", voteCount: 2 },
      { projectSlug: "demo-noundry-remix-kit", voteCount: 1 },
    ],
  },
  {
    slug: "demo-voting-round",
    title: "Dummy Voting Round",
    description:
      "A voting-stage test round with live vote counts and multiple approved submissions.",
    image: "/miniapp-hero.png",
    startsInDays: -12,
    submissionsOpenInDays: -11,
    votingStartsInDays: -2,
    votingEndsInDays: 5,
    submissions: [
      { projectSlug: "demo-yellow-field-notes", voteCount: 18 },
      { projectSlug: "demo-daily-builder-card", voteCount: 12 },
      { projectSlug: "demo-mobile-gallery-pass", voteCount: 8 },
      { projectSlug: "demo-governance-brief", voteCount: 6 },
    ],
  },
  {
    slug: "demo-closed-round",
    title: "Dummy Closed Round",
    description:
      "A completed test round with ranked winners for checking closed-round states.",
    image: "/miniapp-embed.png",
    startsInDays: -28,
    submissionsOpenInDays: -27,
    votingStartsInDays: -14,
    votingEndsInDays: -3,
    submissions: [
      {
        projectSlug: "demo-round-recap-video",
        voteCount: 27,
        winnerPosition: 1,
      },
      {
        projectSlug: "demo-noundry-remix-kit",
        voteCount: 21,
        winnerPosition: 2,
      },
      { projectSlug: "demo-yellow-field-notes", voteCount: 15 },
      { projectSlug: "demo-daily-builder-card", voteCount: 11 },
    ],
  },
];

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const getProjectSeed = (slug: string) =>
  dummyProjects.find((project) => project.slug === slug) || dummyProjects[0];

const getDummyRoundId = (slug: string) => slug;

const makeAward = (
  roundSlug: string,
  position: number,
  title: string
): RoundAward => ({
  id: `${roundSlug}-award-${position}`,
  roundId: getDummyRoundId(roundSlug),
  position,
  title,
  description: "Dummy award for testing winner display and award copy.",
  value: position === 1 ? "1,000 $YELLOW" : "500 $YELLOW",
  createdAt: daysFromNow(-30),
  updatedAt: daysFromNow(-1),
});

const makeSubmission = (
  round: DummyRoundSeed,
  submission: DummyRoundSeed["submissions"][number],
  index: number
): RoundSubmission => {
  const project = getProjectSeed(submission.projectSlug);
  const walletAddress = TEST_WALLETS[project.walletIndex] || TEST_WALLETS[0];

  return {
    id: `${round.slug}-submission-${index + 1}`,
    roundId: getDummyRoundId(round.slug),
    walletAddress,
    title: project.title,
    description: project.submissionDescription,
    image: project.image,
    images: [project.image],
    url: `/projects/${project.slug}`,
    submissionType: "project",
    traitId: null,
    traitType: null,
    source: "project",
    sourcePayload: {
      projectSlug: project.slug,
      dummy: true,
    },
    status: "approved",
    createdAt: daysFromNow(round.submissionsOpenInDays + index),
    updatedAt: daysFromNow(round.submissionsOpenInDays + index),
    approvedAt: daysFromNow(round.submissionsOpenInDays + index),
    rejectedAt: null,
    hiddenAt: null,
    deletedAt: null,
    voteCount: submission.voteCount,
    winnerPosition: submission.winnerPosition || null,
  };
};

const makeRound = (round: DummyRoundSeed): Round => {
  const submissions = round.submissions.map((submission, index) =>
    makeSubmission(round, submission, index)
  );
  const totalVotes = submissions.reduce(
    (sum, submission) => sum + submission.voteCount,
    0
  );

  return {
    id: getDummyRoundId(round.slug),
    slug: round.slug,
    title: round.title,
    description: round.description,
    content:
      "This is dummy testing content controlled by the admin dashboard toggle. It is safe to disable without touching production records.",
    image: round.image,
    startsAt: daysFromNow(round.startsInDays),
    submissionsOpenAt: daysFromNow(round.submissionsOpenInDays),
    votingStartsAt: daysFromNow(round.votingStartsInDays),
    votingEndsAt: daysFromNow(round.votingEndsInDays),
    endsAt: daysFromNow(round.votingEndsInDays),
    active: true,
    featured: round.slug === "demo-open-round",
    isTraitContest: false,
    traitSubmissionsEnabled: false,
    status: "published",
    votingStrategy: "fixed_per_wallet",
    votesPerWallet: 3,
    votingSnapshotMode: "voting_start",
    votingSnapshotAt: null,
    votingSnapshotBlock: null,
    winnerCount: 2,
    maxSubmissionsPerWallet: 3,
    minTitleLength: 3,
    maxTitleLength: 120,
    minDescriptionLength: 20,
    maxDescriptionLength: 2000,
    createdAt: daysFromNow(round.startsInDays - 2),
    updatedAt: daysFromNow(-1),
    deletedAt: null,
    submissionCount: submissions.length,
    approvedSubmissionCount: submissions.length,
    totalVotes,
    awards: [
      makeAward(round.slug, 1, "First place"),
      makeAward(round.slug, 2, "Runner up"),
    ],
  };
};

const makeVoteActivity = (
  round: DummyRoundSeed,
  submissions: RoundSubmission[]
): RoundVoteActivity[] =>
  submissions
    .filter((submission) => submission.voteCount > 0)
    .map((submission, index) => ({
      id: `${round.slug}-vote-${index + 1}`,
      walletAddress: TEST_WALLETS[index % TEST_WALLETS.length],
      submissionId: submission.id,
      submissionTitle: submission.title,
      voteCount: submission.voteCount,
      createdAt: daysFromNow(Math.min(round.votingStartsInDays + index, -1)),
      updatedAt: daysFromNow(Math.min(round.votingStartsInDays + index, -1)),
    }));

export const getDummyContentEnabled = () =>
  getBooleanSiteSetting(DUMMY_CONTENT_SETTING_KEY, false);

export const setDummyContentEnabled = (enabled: boolean) =>
  setBooleanSiteSetting(DUMMY_CONTENT_SETTING_KEY, enabled);

export const getDummyPublicRounds = async (): Promise<Round[]> => {
  if (!(await getDummyContentEnabled())) return [];

  return dummyRounds.map(makeRound);
};

export const getDummyPublicRoundBySlug = async (
  slug: string
): Promise<RoundWithSubmissions | null> => {
  const roundSeed = dummyRounds.find((round) => round.slug === slug);
  if (!roundSeed || !(await getDummyContentEnabled())) return null;

  const submissions = roundSeed.submissions.map((submission, index) =>
    makeSubmission(roundSeed, submission, index)
  );

  return {
    ...makeRound(roundSeed),
    submissions,
    voteActivity: makeVoteActivity(roundSeed, submissions),
  };
};

export const getDummyCommunityProjects = async (): Promise<
  CommunityProject[]
> => {
  if (!(await getDummyContentEnabled())) return [];

  return dummyProjects.map((project) => ({
    slug: project.slug,
    title: project.title,
    description: project.description,
    details: [
      "Visible only while dummy testing content is enabled.",
      "Connected to dummy rounds, submissions, and content coin posts.",
      "Safe to turn off without deleting production records.",
    ],
    artist: "Yellow Testing",
    memberAddresses: [TEST_WALLETS[project.walletIndex] || TEST_WALLETS[0]],
    category: project.category,
    date: "Admin testing",
    href: `/projects/${project.slug}`,
    image: project.image,
    galleryImages: [
      {
        src: project.image,
        caption: "Primary dummy project image.",
        sourceHref: `/projects/${project.slug}`,
        sourceLabel: "Project page",
      },
      { src: "/banner.png" },
      { src: "/og-image.png" },
    ],
    links: [
      {
        title: "Open testing round",
        href: "/rounds/demo-open-round",
      },
      {
        title: "Voting testing round",
        href: "/rounds/demo-voting-round",
      },
    ],
  }));
};

export const getDummyGalleryCoins = async (): Promise<GalleryCoin[]> => {
  if (!(await getDummyContentEnabled())) return [];

  return [
    {
      address: getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
      slug: "dummy-field-notes-coin",
      title: "Field Notes Coin",
      coinName: "Field Notes",
      symbol: "FIELD",
      description:
        "A dummy content coin for checking gallery cards and detail metadata.",
      mediaUrl: "/og-image.png",
      imageUrl: "/og-image.png",
      ownerAddress: TEST_WALLETS[0],
      payoutRecipient: TEST_WALLETS[0],
      hidden: false,
      creatorAddress: TEST_WALLETS[0],
      createdAt: daysFromNow(-1),
      roundSlug: "demo-open-round",
    },
    {
      address: getAddress("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
      slug: "dummy-builder-card-coin",
      title: "Builder Card Coin",
      coinName: "Builder Card",
      symbol: "BUILDER",
      description:
        "A dummy post coin tied to the voting-stage round and project detail flow.",
      mediaUrl: "/banner.png",
      imageUrl: "/banner.png",
      ownerAddress: TEST_WALLETS[1],
      payoutRecipient: TEST_WALLETS[1],
      hidden: false,
      creatorAddress: TEST_WALLETS[1],
      createdAt: daysFromNow(-2),
      roundSlug: "demo-voting-round",
    },
    {
      address: getAddress("0xcccccccccccccccccccccccccccccccccccccccc"),
      slug: "dummy-recap-video-coin",
      title: "Recap Video Coin",
      coinName: "Recap Video",
      symbol: "RECAP",
      description:
        "A dummy content coin for checking closed-round links and creator labels.",
      mediaUrl: "/miniapp-hero.png",
      imageUrl: "/miniapp-hero.png",
      ownerAddress: TEST_WALLETS[2],
      payoutRecipient: TEST_WALLETS[2],
      hidden: false,
      creatorAddress: TEST_WALLETS[2],
      createdAt: daysFromNow(-3),
      roundSlug: "demo-closed-round",
    },
    {
      address: getAddress("0xdddddddddddddddddddddddddddddddddddddddd"),
      slug: "dummy-gallery-pass-coin",
      title: "Gallery Pass Coin",
      coinName: "Gallery Pass",
      symbol: "GPASS",
      description:
        "A dummy coin post for checking multiple gallery rows and owner profiles.",
      mediaUrl: "/miniapp-embed.png",
      imageUrl: "/miniapp-embed.png",
      ownerAddress: TEST_WALLETS[3],
      payoutRecipient: TEST_WALLETS[3],
      hidden: false,
      creatorAddress: TEST_WALLETS[3],
      createdAt: daysFromNow(-4),
      roundSlug: "demo-upcoming-round",
    },
  ];
};
