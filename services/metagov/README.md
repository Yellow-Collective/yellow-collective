# Yellow Metagov Bot

Standalone Railway service that mirrors Nouns DAO proposals into the
`yellowcollective.eth` Snapshot space, watches the Snapshot results, and casts
the final vote on-chain.

## Railway setup

Set the Railway service root directory to this folder:

```txt
services/metagov
```

Add a persistent volume and mount it at:

```txt
/data
```

Required variables:

```bash
BOT_PRIVATE_KEY=""
SAFE_ADDRESS="0x00EC9615Ab4f45cBeb66b5FA36bcEd3D79f38Bb3"
SNAPSHOT_SPACE_ID="yellowcollective.eth"
ETHEREUM_RPC_URL=""
SNAPSHOT_RPC_URL="https://mainnet.base.org"
DATA_DIR="/data"
DRY_RUN="true"
```

Recommended variables:

```bash
NOUNS_GRAPHQL_ENDPOINT="https://api.goldsky.com/api/public/project_clnbcoajmebxn33wdbt98f439/subgraphs/nouns-mainnet/1.0.0/gn"
NOUNS_DAO_ADDRESS="0x6f3E6272A167e8AcCb32072d08E0957F9c79223d"
SNAPSHOT_GRAPHQL_URL="https://hub.snapshot.org/graphql"
SNAPSHOT_SEQUENCER_URL="https://seq.snapshot.org"
SNAPSHOT_CHAIN_ID="8453"
PROPOSAL_LINK_TEMPLATE="https://nouns.game/proposals/{id}"
SITE_PROPOSAL_LINK_TEMPLATE="https://yellowcollective.art/proposals/nouns/{id}"
VOTING_DURATION_DAYS="5"
NO_VOTES_ACTION="abstain"
MIN_PROPOSAL_ID="0"
LOOKBACK_DAYS="7"
PROPOSAL_POLL_MINUTES="1"
VOTE_POLL_MINUTES="5"
MAX_GAS_PRICE_GWEI="100"
MAX_RETRIES="3"
```

## Final vote execution

- Final Nouns votes always execute through `SAFE_ADDRESS`.
- `BOT_PRIVATE_KEY` is only used as the Safe owner signer/executor.
- The bot does not fall back to direct voting from `BOT_PRIVATE_KEY`.
- Safe owner and threshold checks are required at startup. The bot wallet must
  be a Safe owner, and the Safe threshold must be `1` for unattended execution.
- Safe voting power is checked only as a startup warning. A Safe with 0 delegated
  Nouns votes can still cast a zero-weight on-chain vote.
- Start with `DRY_RUN=true`; only switch to `false` after the first dry-run
  cycle creates the expected state.

## Endpoints

```txt
GET /health
GET /state
GET /state/:nounsProposalId
```
