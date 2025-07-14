import { atomWithKVStorage } from '../../lib/atoms/atomWithKVStorage';

export const showGraphQLDocExplorerAtom = atomWithKVStorage<boolean>('show_graphql_docs', false);
