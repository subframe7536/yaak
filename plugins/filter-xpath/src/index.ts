import { DOMParser } from '@xmldom/xmldom';
import type { PluginDefinition } from '@yaakapp/api';
import xpath from 'xpath';

export const plugin: PluginDefinition = {
  filter: {
    name: 'XPath',
    description: 'Filter XPath',
    onFilter(_ctx, args) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc: any = new DOMParser().parseFromString(args.payload, 'text/xml');
      try {
        const result = xpath.select(args.filter, doc, false);
        if (Array.isArray(result)) {
          return { content: result.map((r) => String(r)).join('\n') };
        } else {
          // Not sure what cases this happens in (?)
          return { content: String(result) };
        }
      } catch (err) {
        return { content: '', error: `Invalid filter: ${err}` };
      }
    },
  },
};
