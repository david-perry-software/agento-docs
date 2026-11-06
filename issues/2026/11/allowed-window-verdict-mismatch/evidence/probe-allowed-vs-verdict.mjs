// Every deriveAllowed row (role × lifecycle) run through windowVerdict with realistic
// records; slugs passed only for the commands brief passes a slug to.
import { deriveAllowed, windowVerdict } from "<agento-checkout>/scripts/session-state.mjs";
const SLUG_COMMANDS = new Set(["ap", "build-feature", "build-issue", "review-feature", "review-issue", "ship", "continue"]);
const lifecycles = ["no-delivery","planned","building","paused","in-review","approved","shipped","post-ship-pending"];
const rec = { primary: { branch: "main" }, plan: { branch: null }, build: { branch: "issue/demo" }, freehand: { branch: "changes/demo" } };
let n = 0, bad = 0;
for (const role of ["primary","plan","build","freehand"]) for (const lifecycle of (role === "freehand" ? ["no-delivery"] : lifecycles)) {
  const delivery = lifecycle === "no-delivery" ? null : { slug: "demo", type: "issue" };
  const { branch } = rec[role];
  const worktree = { path: `/x/${role}`, branch, detached: !branch, id: "demo" };
  for (const inv of deriveAllowed({ role, lifecycle, delivery, worktree }).allowed) {
    const [, name, arg] = inv.match(/^\/agento (\S+)\s*(\S*)/);
    const slug = SLUG_COMMANDS.has(name) && arg && !arg.includes("/") ? arg : null;
    const v = windowVerdict({ command: name, record: { role, worktree, delivery }, slug, clean: true, defaultBranch: "main" });
    n++; if (!v.match) { bad++; console.log(`MISMATCH role=${role} lifecycle=${lifecycle} "${inv}" -> ${v.reason}`); }
  }
}
console.log(`checked ${n} allowed entries; ${bad} mismatches`);
