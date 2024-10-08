import { PluginOption, defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { nodeExternals } from "rollup-plugin-node-externals";

// vite.config.js
import { resolve } from "path";

function externals(): PluginOption {
  return {
    ...nodeExternals(),
    name: "node-externals",
    enforce: "pre",
    apply: "build",
  };
}

export default defineConfig({
  plugins: [
    externals(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    rollupOptions: {
      input: [
        resolve(__dirname, "src/index.ts"),
        resolve(__dirname, "src/cli.ts"),
      ],
      output: {
        preserveModules: false,
        inlineDynamicImports: false,
        entryFileNames: "[name].js",
      },
    },
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "migrate",
      formats: ["es"],
      fileName: "index",
    },
  },
});
