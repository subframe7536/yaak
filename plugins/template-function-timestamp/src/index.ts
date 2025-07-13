import type { PluginDefinition } from "@yaakapp/api";

export const plugin: PluginDefinition = {
  templateFunctions: [
    {
      name: "timestamp",
      description: "Get the current timestamp in milliseconds",
      args: [],
      onRender: async () => {
        return String(Date.now());
      },
    },
  ],
};
