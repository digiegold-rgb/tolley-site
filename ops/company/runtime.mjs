// Dedicated Node worker: server-only is a Next.js bundle boundary marker.
// Keep normal React conditions for next-auth's imports; this process has no browser bundle.
import Module from "node:module";
const load = Module._load;
Module._load = function (request, ...args) {
  return request === "server-only" ? {} : load.call(this, request, ...args);
};
