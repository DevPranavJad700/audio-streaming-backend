/**
 * Sanitizes and extracts pagination parameters from an Express request query.
 *
 * @param {object} query - req.query
 * @param {object} [defaults] - optional custom defaults
 * @param {number} [defaults.defaultLimit=10]
 * @param {number} [defaults.maxLimit=50]
 * @returns {{ page: number, limit: number, skip: number }}
 */
function getPagination(query, { defaultLimit = 10, maxLimit = 50 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

module.exports = { getPagination };
