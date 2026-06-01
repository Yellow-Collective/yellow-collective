import assert from "node:assert/strict";

const LIVE_SITE_URL = process.env.LIVE_SITE_URL || "http://yellowcollective.art";
const SNAPSHOT_GRAPHQL_URL =
  process.env.SNAPSHOT_GRAPHQL_URL || "https://hub.snapshot.org/graphql";
const SNAPSHOT_SPACE_ID =
  process.env.NEXT_PUBLIC_SNAPSHOT_SPACE_ID || "yellowcollective.eth";
const NOUNS_GRAPHQL_ENDPOINT =
  process.env.NOUNS_GRAPHQL_ENDPOINT ||
  "https://api.goldsky.com/api/public/project_clnbcoajmebxn33wdbt98f439/subgraphs/nouns-mainnet/1.0.0/gn";

const jsonFetch = async (url, options) => {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
};

const graphql = async (url, query, variables) => {
  const { response, payload } = await jsonFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  assert.equal(
    response.ok,
    true,
    `Read-only GraphQL request failed at ${url}: ${response.status}`
  );
  assert.equal(
    Boolean(payload?.errors?.length),
    false,
    `Read-only GraphQL returned errors at ${url}: ${JSON.stringify(payload?.errors)}`
  );
  return payload.data;
};

const getLatestNounsProposalNumber = async () => {
  if (process.env.NOUNS_PROPOSAL_ID) {
    return Number(process.env.NOUNS_PROPOSAL_ID);
  }

  const data = await graphql(
    NOUNS_GRAPHQL_ENDPOINT,
    `
      query LatestNounsProposal {
        proposals(first: 1, orderBy: createdTimestamp, orderDirection: desc) {
          id
          title
          status
        }
      }
    `,
    {}
  );

  const proposalNumber = Number(data.proposals?.[0]?.id);
  assert.equal(Number.isInteger(proposalNumber), true, "No latest Nouns proposal found.");
  return proposalNumber;
};

const proposalNumber = await getLatestNounsProposalNumber();

const settingsUrl = `${LIVE_SITE_URL}/api/nouns/settings`;
const settings = await jsonFetch(settingsUrl);
assert.equal(
  settings.response.ok,
  true,
  `Live site settings endpoint failed: ${settings.response.status}`
);
assert.equal(
  typeof settings.payload?.nounsMetagovEnabled,
  "boolean",
  "Live site settings endpoint did not return nounsMetagovEnabled."
);

const snapshotStatusUrl = `${LIVE_SITE_URL}/api/metagov/snapshot/nouns/${proposalNumber}`;
const snapshotStatus = await jsonFetch(snapshotStatusUrl);
assert.equal(
  snapshotStatus.response.ok,
  true,
  `Live Snapshot status endpoint failed: ${snapshotStatus.response.status}`
);
assert.equal(
  snapshotStatus.payload?.space,
  SNAPSHOT_SPACE_ID,
  "Live Snapshot status endpoint returned the wrong Snapshot space."
);

const botStatusUrl = `${LIVE_SITE_URL}/api/metagov/nouns/${proposalNumber}`;
const botStatus = await jsonFetch(botStatusUrl);
assert.equal(
  botStatus.response.ok,
  true,
  `Live metagov bot-state endpoint failed: ${botStatus.response.status}`
);
assert.equal(
  Object.prototype.hasOwnProperty.call(botStatus.payload || {}, "proposal"),
  true,
  "Live metagov bot-state endpoint did not return a proposal field."
);

const snapshotData = await graphql(
  SNAPSHOT_GRAPHQL_URL,
  `
    query YellowSnapshotProposals($space: String!) {
      proposals(first: 5, where: { space: $space }, orderBy: "created", orderDirection: desc) {
        id
        title
        state
        scores
        scores_total
      }
    }
  `,
  { space: SNAPSHOT_SPACE_ID }
);

assert.equal(
  Array.isArray(snapshotData.proposals),
  true,
  "Snapshot read-only proposal query did not return proposals."
);

console.log(
  JSON.stringify(
    {
      ok: true,
      writeCallsMade: false,
      proposalNumber,
      liveSite: LIVE_SITE_URL,
      nounsMetagovEnabled: settings.payload.nounsMetagovEnabled,
      snapshotProposalFound: Boolean(snapshotStatus.payload.proposal),
      botStateFound: Boolean(botStatus.payload.proposal),
      recentSnapshotProposalCount: snapshotData.proposals.length,
    },
    null,
    2
  )
);
