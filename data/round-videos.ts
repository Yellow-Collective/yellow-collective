import { randomUUID } from "crypto";
import type { Round } from "./rounds";
import { getRoundsPool, ensureRoundsTables, getRoundById } from "./rounds";
import { getRoundState } from "@/utils/rounds/state";
import { videosEnabled, videoUploadPost } from "@/utils/rounds/video-storage";
import { validateVideoMetadata } from "@/utils/rounds/video-policy";

const checkOpen = (round: Round | null) => {
  if (!round || getRoundState(round) !== "submissions_open")
    throw new Error("This round is not accepting video submissions.");
};
export const reserveRoundVideo = async (round: Round, wallet: string) => {
  if (!videosEnabled()) throw new Error("Video uploads are unavailable.");
  checkOpen(round);
  await ensureRoundsTables();
  const client = await getRoundsPool().connect();
  const id = randomUUID();
  const stagingKey = `round-videos/staging/${id}.mp4`;
  try {
    await client.query("BEGIN");
    // Global and wallet locks serialize admission across instances and image submissions.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('round-video-budget'))"
    );
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `submission:${round.id}:${wallet.toLowerCase()}`,
    ]);
    const counts = await client.query(
      `SELECT
      (SELECT count(*) FROM round_video_uploads WHERE created_at > now() - interval '1 day')::int AS daily,
      (SELECT count(*) FROM round_video_uploads WHERE lower(wallet_address)=lower($2) AND created_at > now()-interval '1 day')::int AS wallet_daily,
      (SELECT count(*) FROM round_video_uploads WHERE round_id=$1 AND lower(wallet_address)=lower($2) AND status IN ('pending','validating','ready') AND expires_at > now())::int AS pending,
      (SELECT count(*) FROM round_submissions WHERE round_id=$1 AND lower(wallet_address)=lower($2) AND deleted_at IS NULL)::int AS active`,
      [round.id, wallet]
    );
    const count = counts.rows[0];
    if (
      count.daily >= 500 ||
      count.wallet_daily >= 10 ||
      count.pending >= 1 ||
      count.active + count.pending >= round.maxSubmissionsPerWallet
    )
      throw new Error(
        "Video upload quota reached. Try later or submit without video."
      );
    const fresh = await client.query(
      "SELECT status,active,starts_at,submissions_open_at,voting_starts_at,voting_ends_at FROM rounds WHERE id=$1 FOR SHARE",
      [round.id]
    );
    const row = fresh.rows[0];
    checkOpen(
      row
        ? {
            ...round,
            status: row.status,
            active: row.active,
            startsAt: row.starts_at,
            submissionsOpenAt: row.submissions_open_at,
            votingStartsAt: row.voting_starts_at,
            votingEndsAt: row.voting_ends_at,
          }
        : null
    );
    await client.query(
      `INSERT INTO round_video_uploads(id,round_id,wallet_address,staging_key,object_key) VALUES($1,$2,$3,$4,$5)`,
      [id, round.id, wallet, stagingKey, `round-videos/approved/${id}.mp4`]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { id, upload: await videoUploadPost(stagingKey) };
};

export const finalizeRoundVideo = async (
  round: Round,
  wallet: string,
  id: string
) => {
  if (!videosEnabled()) throw new Error("Video uploads are unavailable.");
  checkOpen(await getRoundById(round.id));
  await ensureRoundsTables();
  const pool = getRoundsPool();
  const owned = await pool.query(
    `SELECT * FROM round_video_uploads WHERE id=$1 AND round_id=$2 AND lower(wallet_address)=lower($3) AND expires_at>now()`,
    [id, round.id, wallet]
  );
  const upload = owned.rows[0];
  if (!upload) throw new Error("Upload not found or expired.");
  if (upload.status === "ready")
    return { id, video: validateVideoMetadata(upload.metadata) };
  const claim = await pool.query(
    `UPDATE round_video_uploads SET status='validating' WHERE id=$1 AND status='pending' AND expires_at>now() RETURNING id`,
    [id]
  );
  if (!claim.rowCount)
    throw new Error("Upload is being validated or cannot be reused.");
  // Unknown worker outcomes remain quarantined until cleanup; never blindly repeat work.
  const response = await fetch(process.env.ROUND_VIDEO_WORKER_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.ROUND_VIDEO_WORKER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id,
      stagingKey: upload.staging_key,
      objectKey: upload.object_key,
    }),
    signal: AbortSignal.timeout(90000),
    redirect: "error",
  });
  if (!response.ok) {
    if (response.status === 422)
      await pool.query(
        "UPDATE round_video_uploads SET status='rejected' WHERE id=$1 AND status='validating'",
        [id]
      );
    throw new Error(
      response.status === 422
        ? "Video must be a valid MP4, H.264/AAC, up to 100 MiB and 120 seconds."
        : "Video validation did not finish. Cancel and try again later."
    );
  }
  const video = validateVideoMetadata(await response.json());
  if (video.objectKey !== upload.object_key)
    throw new Error("Video validation failed.");
  checkOpen(await getRoundById(round.id));
  const saved = await pool.query(
    `UPDATE round_video_uploads SET status='ready',metadata=$2::jsonb WHERE id=$1 AND status='validating' AND expires_at>now() RETURNING id`,
    [id, JSON.stringify(video)]
  );
  if (!saved.rowCount) throw new Error("Upload expired or was cancelled.");
  return { id, video };
};

export const cancelRoundVideo = async (
  round: Round,
  wallet: string,
  id: string
) => {
  await ensureRoundsTables();
  await getRoundsPool().query(
    `UPDATE round_video_uploads SET status='cancelled' WHERE id=$1 AND round_id=$2 AND lower(wallet_address)=lower($3) AND status IN ('pending','validating','ready')`,
    [id, round.id, wallet]
  );
};
