import type { PluginDefinition } from '@yaakapp/api';
import dayjs, { ManipulateType } from 'dayjs';

dayjs.extend(require('dayjs/plugin/customParseFormat'));

export async function formatDatetime(args: {
  date?: string;
  calc?: string;
  fmtInput?: string;
  fmtOutput?: string;
}): Promise<string> {
  const { date, calc, fmtInput = 'YYYY-MM-DD HH:mm:ss', fmtOutput = 'YYYY-MM-DD HH:mm:ss' } = args;
  let d = date ? dayjs(String(date), String(fmtInput)) : dayjs();
  if (calc) {
    const ops = String(calc)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const op of ops) {
      const match = op.match(/^([+-])(\d+)([a-zA-Z]+)$/);
      if (match) {
        const [, sign, amount, unit] = match;
        if (!unit || !['d', 'D', 'M', 'y', 'h', 'm', 's', 'ms'].includes(unit)) {
          throw new Error(`Invalid unit: ${unit}`);
        }
        if (sign === '-') {
          d = d.subtract(Number(amount), unit as ManipulateType);
        } else {
          d = d.add(Number(amount), unit as ManipulateType);
        }
      }
    }
  }
  return d.format(String(fmtOutput));
}

export const plugin: PluginDefinition = {
  templateFunctions: [
    {
      name: 'datetime.timestamp',
      description: 'Get the current timestamp in milliseconds',
      args: [],
      onRender: async () => {
        return String(Date.now());
      },
    },
    {
      name: 'datetime.iso',
      description: 'Get the current date in ISO format',
      args: [],
      onRender: async () => {
        return new Date().toISOString();
      },
    },
    {
      name: 'datetime.format',
      description: 'Format a date using a specified format string',
      args: [
        {
          name: 'date',
          label: 'Date String',
          description: 'The date to format, can be a timestamp or ISO string',
          type: 'text',
          optional: true,
          placeholder: 'Default: current date',
        },
        {
          name: 'calc',
          label: 'Calculate Expression',
          description: "The calculate expression in dayjs format, split by commas: '-5d, +2h, 3m'.",
          optional: true,
          placeholder: 'Example: -5d, +2h, 3m',
          type: 'text',
        },
        {
          name: 'fmtInput',
          label: 'Input Format String',
          description: "The input format string in dayjs format, e.g., 'YYYY-MM-DD HH:mm:ss'",
          optional: true,
          placeholder: 'Default: YYYY-MM-DD HH:mm:ss. Empty if Date String is not provided',
          type: 'text',
        },
        {
          name: 'fmtOutput',
          label: 'Output Format String',
          description: "The output format string in dayjs format, e.g., 'YYYY-MM-DD HH:mm:ss'",
          optional: true,
          placeholder: 'Default: YYYY-MM-DD HH:mm:ss',
          type: 'text',
        },
      ],
      onRender: async ({toast}, args) => {
        try {
          return await formatDatetime(args.values);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          toast.show({
            icon: 'alert_triangle',
            color: 'warning',
            message:`Error formatting date: ${msg}`
          });
          return null;
        }
      },
    },
  ],
};
