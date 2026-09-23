// The domain layer: what the product is made of, independent of how it is
// stored (src/models, src/db) or delivered (src/routes, src/socket).
//
// `types` describes the shapes that live inside `json` columns and are shared
// by more than one model. `constants` holds the vocabulary — statuses,
// priorities, roles, plans — as a single declaration each, with the runtime
// list and the TypeScript union derived from the same literal.
//
// Import from here (`../domain`) rather than reaching into the two files, so a
// value moving between them is not a change every caller has to follow.

export * from './constants';
export * from './types';
