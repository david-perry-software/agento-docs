// Reproduction for issue session-doctor-detached-companion.
// Feeds the compiled Session & Doctor model the exact `agento.mjs session` shape a
// detached plan-mode window reports (companion.branch: null), as captured from
// plan-20261002-155631 on 2026-10-02 before its branch was created.
import { createSessionDoctorModel } from "/home/david/DP/agento-worktrees/plan-20261002-155631/extension/out/sessionDoctorModel.js";

const session = {
  status: "ok",
  role: "plan",
  lifecycle: "no-delivery",
  delivery: null,
  worktree: { path: "/home/david/DP/agento-worktrees/plan-20261002-155631", branch: null, detached: true },
  workspace: { path: "/home/david/DP/agento-worktrees/plan-20261002-155631.code-workspace", exists: true },
  companion: {
    path: "/home/david/DP/agento-docs-worktrees/plan-20261002-155631",
    branch: null,
    detached: true,
    dirty: false,
    ahead: 0,
    behind: 0,
    registered: true,
  },
  warnings: [],
  allowed: ["/agento continue", "/agento new-feature", "/agento new-issue", "/agento delivery-status"],
  elsewhere: [],
};
const doctor = { status: "ok", checks: [{ id: "node", status: "ok", detail: "node v22.23.2", fallback: null }] };
const status = { status: "ok", resumable: [] };

console.log(JSON.stringify(createSessionDoctorModel(session, doctor, status), null, 2));
