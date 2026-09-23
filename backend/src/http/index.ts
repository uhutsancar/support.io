// The HTTP layer's shared kernel: how a handler is wrapped, how it fails, and
// how it proves the caller may act.
//
// A route file should need one import from here and then read as its own
// business logic. See `routes/sites.ts` for the shape every route follows:
//
//     router.get('/:siteId', auth, requireOrganization, asyncHandler(async (req, res) => {
//       const site = await loadOwnedSite(req, req.params.siteId);
//       res.json({ site });
//     }));
//
// No try/catch, no `if (!orgId) return`, no manual 404 — each of those is a
// guard that throws, and `errorHandler` turns the throw into the response.

export { asyncHandler, asyncMiddleware } from './asyncHandler';
export { apiNotFound, errorHandler } from './errorHandler';
export {
  HttpError,
  badRequest,
  conflict,
  describeError,
  forbidden,
  notFound,
  unauthorized,
  unavailable
} from './errors';
export {
  callerOrgId,
  findOwnedConversation,
  findOwnedDepartment,
  findOwnedSite,
  loadAccessibleConversation,
  loadOwnedConversation,
  loadOwnedDepartment,
  loadOwnedSite,
  loadOwnedTeamMember,
  mayAccessSite,
  orgId,
  pick,
  pickStrict,
  requireObjectId,
  requireOrganization,
  requireSiteOwnership
} from './guards';
