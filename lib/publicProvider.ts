import type { Provider } from "./types";

/** Strip private fields before anything leaves the server. */
export function publicProvider(p: Provider): Provider {
  const { contact: _contact, ...rest } = p;
  void _contact;
  return rest;
}
