export async function cleanVideoCandidates(
  rows,
  { apply = false, remove, mark }
) {
  for (const row of rows) {
    // Reject corrupted metadata before any destructive operation.
    if (
      !/^[a-f0-9-]{36}$/.test(row.id) ||
      row.staging_key !== `round-videos/staging/${row.id}.mp4` ||
      row.object_key !== `round-videos/approved/${row.id}.mp4`
    )
      throw new Error("Invalid cleanup candidate");
    if (apply) {
      await remove(row.staging_key);
      await remove(row.object_key);
      await mark(row.id);
    }
  }
  return rows.length;
}

export async function cleanAttachedStagingCandidates(
  rows,
  { apply = false, remove, mark }
) {
  for (const row of rows) {
    if (
      !/^[a-f0-9-]{36}$/.test(row.id) ||
      row.staging_key !== `round-videos/staging/${row.id}.mp4`
    ) {
      throw new Error("Invalid staging cleanup candidate");
    }
    if (apply) {
      await remove(row.staging_key);
      await mark(row.id);
    }
  }
  return rows.length;
}
