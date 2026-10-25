// ---- repro: ship-merge-refusal-loop (appended to a throwaway copy of scripts/agento.test.mjs @ bea012b) ----
// 1. gh refuses the merge of a MERGEABLE-but-BLOCKED PR (soshiki#541: required check "Vercel" never reported)
//    with "is not mergeable: the base branch policy prohibits the merge." — ship calls it pr-conflicting and reopens.
test("REPRO ship-merge-refusal-loop: a BLOCKED merge refusal is reported as a conflict", () => {
  const fixture = makeWorktreeRepo();
  const { repo } = fixture;
  const { branch, dir } = shippable(fixture, "widget", { extra: writeFile("src.js", "code\n") });
  const stub = shipStub({ product: { prs: { [branch]: { rollups: PASSING, mergeable: "MERGEABLE", mergeStateStatus: "BLOCKED", refuseMerge: "X Pull request #15 is not mergeable: the base branch policy prohibits the merge." } } } });
  const token = shipRun(repo, stub.env, "feature", "widget").json.confirmToken;
  const { code, json } = shipRun(repo, stub.env, "feature", "widget", "--confirm", token, "--wait", "0");
  git(repo, "fetch", "-q", "origin");
  const roadmap = git(repo, "show", `origin/${branch}:${dir}/roadmap.md`);
  console.log("REPRO BLOCKED: " + JSON.stringify({ exit: code, status: json.status, reason: json.reason, hard: json.gaps ? codes(json.gaps.hard) : null, rejectTo: json.rejectTo, allowed: json.allowed, reopened: stepsOf(json).includes("roadmap-reopened"), roadmapStatus: roadmap.match(/^status: (.*)$/m)[1], nextStep: roadmap.match(/^next-step: (.*)$/m)[1], prDraft: stub.state().product.prs[branch].isDraft }));
  assert.ok(!(json.gaps && codes(json.gaps.hard).includes("pr-conflicting")), "BLOCKED refusal misreported as pr-conflicting");
  assert.ok(!stepsOf(json).includes("roadmap-reopened"), "BLOCKED refusal reopened the roadmap");
});

// 2. After ship reopens for a (real or misreported) conflict, the build window never routes to the Builder:
//    continue derives /agento ship (approve fresh) or /agento review-feature (approve stale), and its allowed[] lacks build-feature.
test("REPRO ship-merge-refusal-loop: build window derivation after the reopen", () => {
  const fixture = makeWorktreeRepo();
  const { repo } = fixture;
  const { branch, owner } = shippable(fixture, "widget", { extra: writeFile("src.js", "code\n") });
  const stub = shipStub({ product: { prs: { [branch]: { rollups: PASSING, refuseMerge: "X Pull request #15 is not mergeable: the merge commit cannot be cleanly created." } } } });
  const token = shipRun(repo, stub.env, "feature", "widget").json.confirmToken;
  const shipped = shipRun(repo, stub.env, "feature", "widget", "--confirm", token, "--wait", "0");
  const next = runWith({ cwd: owner, env: stub.env }, "next");
  const session = runWith({ cwd: owner, env: stub.env }, "session");
  console.log("REPRO LOOP: " + JSON.stringify({ shipHard: codes(shipped.json.gaps.hard), shipRejectTo: shipped.json.rejectTo, shipAllowed: shipped.json.allowed, buildWindowLifecycle: session.json.lifecycle, buildWindowAllowed: session.json.allowed, buildWindowElsewhere: (session.json.elsewhere || []).map((e) => e.command), continueDerives: next.json.next && next.json.next.invocation, continueReason: next.json.next && next.json.next.reason }));
  assert.equal(next.json.next && next.json.next.invocation, "/agento build-feature widget", "the build window does not route a reopened conflict to the Builder");
  assert.ok(session.json.allowed.includes("/agento build-feature widget"), "the build window does not allow the command ship told the user to run");
});
