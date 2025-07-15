import { DOMParser } from '@xmldom/xmldom';
import type { CallTemplateFunctionArgs, Context, PluginDefinition } from '@yaakapp/api';
import xpath from 'xpath';

export const plugin: PluginDefinition = {
  templateFunctions: [
    {
      name: 'xml.xpath',
      description: 'Filter XML-formatted text using XPath syntax',
      args: [
        {
          type: 'text',
          name: 'input',
          label: 'Input',
          multiLine: true,
          placeholder: '<foo></foo>',
        },
        { type: 'text', name: 'query', label: 'Query', placeholder: '//foo' },
      ],
      async onRender(_ctx: Context, args: CallTemplateFunctionArgs): Promise<string | null> {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const doc: any = new DOMParser().parseFromString(String(args.values.input), 'text/xml');
          const result = xpath.select(String(args.values.query), doc, false);
          if (Array.isArray(result)) {
            return String(result.map((c) => String(c.firstChild))[0] ?? '');
          } else if (result instanceof Node) {
            return String(result.firstChild);
          } else {
            return String(result);
          }
        } catch {
          return null;
        }
      },
    },
  ],
};
