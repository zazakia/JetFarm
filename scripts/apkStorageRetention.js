/**
 * Retention rules for Supabase Storage bucket `downloads`.
 * Keep only the mutable latest artifact (`jetfarm.apk`).
 * Versioned copies accumulate ~40MB each and must be deleted.
 */

function listObsoleteApkObjectNames(objectNames) {
  if (!Array.isArray(objectNames)) return [];
  return objectNames.filter((name) => typeof name === 'string' && /^jetfarm-v.+\.apk$/i.test(name));
}

module.exports = {
  listObsoleteApkObjectNames,
};
