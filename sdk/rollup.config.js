import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { terser } from "rollup-plugin-terser";

export default {
  input: "src/index.js",
  output: [
    {
      file: "dist/session-replay.js",
      format: "iife",
      name: "SessionReplay",
    },
    {
      file: "dist/session-replay.min.js",
      format: "iife",
      name: "SessionReplay",
      plugins: [terser()],
    },
  ],
  plugins: [
    replace({
      "process.env.NODE_ENV": JSON.stringify("production"),
      preventAssignment: true,
    }),
    nodeResolve({
      browser: true,
    }),
    commonjs(),
    json(),
  ],
};
