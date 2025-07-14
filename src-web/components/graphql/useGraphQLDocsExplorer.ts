import EventEmitter from 'eventemitter3';
import type { DependencyList } from 'react';
import { useEffect } from 'react';
import { jotaiStore } from '../../lib/jotai';
import { sleep } from '../../lib/sleep';
import { showGraphQLDocExplorerAtom } from './graphqlAtoms';

type EventDataMap = {
  'gql_docs_explorer.show_in_docs': { field?: string; type?: string; parentType?: string };
  'gql_docs_explorer.focus_tab': undefined;
};

export function useGraphQLDocsExplorerEvent<
  Event extends keyof EventDataMap,
  Data extends EventDataMap[Event],
>(event: Event, fn: (data: Data) => void, deps?: DependencyList) {
  useEffect(() => {
    emitter.on(event, fn);
    return () => {
      emitter.off(event, fn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export async function showInGraphQLDocsExplorer(
  field: string | undefined,
  type: string | undefined,
  parentType: string | undefined,
) {
  const isVisible = jotaiStore.get(showGraphQLDocExplorerAtom);
  if (!isVisible) {
    // Show and give some time for the explorer to start listening for events
    jotaiStore.set(showGraphQLDocExplorerAtom, true);
    await sleep(100);
  }
  emitter.emit('gql_docs_explorer.show_in_docs', { field, type, parentType });
}

const emitter = new (class GraphQLDocsExplorerEventEmitter {
  #emitter: EventEmitter = new EventEmitter();

  emit<Event extends keyof EventDataMap, Data extends EventDataMap[Event]>(
    event: Event,
    data: Data,
  ) {
    this.#emitter.emit(event, data);
  }

  on<Event extends keyof EventDataMap, Data extends EventDataMap[Event]>(
    event: Event,
    fn: (data: Data) => void,
  ) {
    this.#emitter.on(event, fn);
  }

  off<Event extends keyof EventDataMap, Data extends EventDataMap[Event]>(
    event: Event,
    fn: (data: Data) => void,
  ) {
    this.#emitter.off(event, fn);
  }
})();
