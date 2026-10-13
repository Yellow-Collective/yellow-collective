import {
  cleanVideoCandidates,
  cleanAttachedStagingCandidates,
} from "../workers/round-video/cleanup.mjs";
// Dry-run is the default. --apply is an explicitly authorized operator action.
import pg from "pg";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
const apply = process.argv.includes("--apply");
const connectionString =
  process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("Database configuration required");
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes("railway.internal")
    ? undefined
    : { rejectUnauthorized: false },
});
const s3 = new S3Client({
  endpoint: process.env.ROUND_VIDEO_S3_ENDPOINT,
  region: process.env.ROUND_VIDEO_S3_REGION,
  forcePathStyle: process.env.ROUND_VIDEO_S3_FORCE_PATH_STYLE === "true",
  maxAttempts: 2,
  credentials: {
    accessKeyId: process.env.ROUND_VIDEO_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.ROUND_VIDEO_S3_SECRET_ACCESS_KEY,
  },
});
try {
  // Wait two hours past expiry: signed POST and in-flight worker requests have ended.
  // Retain attached video bytes until the submission is deleted; preserve audit metadata.
  const candidates =
    await pool.query(`SELECT u.id,u.staging_key,u.object_key,u.status FROM round_video_uploads u LEFT JOIN round_submissions s ON s.id=u.submission_id
    WHERE u.status<>'cleaned' AND u.expires_at < now()-interval '2 hours' AND (u.status<>'attached' OR s.id IS NULL OR s.deleted_at<now()-interval '24 hours') ORDER BY u.created_at LIMIT 100`);
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      candidates: candidates.rowCount,
    })
  );
  await cleanVideoCandidates(candidates.rows, {
    apply,
    remove: (key) =>
      s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.ROUND_VIDEO_S3_BUCKET,
          Key: key,
        })
      ),
    mark: (id) =>
      pool.query(
        "UPDATE round_video_uploads SET status='cleaned' WHERE id=$1",
        [id]
      ),
  });
  // Attached staging copies also expire; permanent playback bytes stay intact.
  const staging = await pool.query(
    "SELECT id,staging_key FROM round_video_uploads WHERE status='attached' AND staging_cleaned_at IS NULL AND expires_at<now()-interval '2 hours' ORDER BY created_at,id LIMIT 100"
  );
  console.log(JSON.stringify({ attachedStagingCandidates: staging.rowCount }));
  await cleanAttachedStagingCandidates(staging.rows, {
    apply,
    remove: (key) =>
      s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.ROUND_VIDEO_S3_BUCKET,
          Key: key,
        })
      ),
    mark: (id) =>
      pool.query(
        "UPDATE round_video_uploads SET staging_cleaned_at=now() WHERE id=$1",
        [id]
      ),
  });
} finally {
  await pool.end();
}
