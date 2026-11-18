// Used by the commitlint job in CI. Without this file the job uses the same
// conventional rules by default.
export default {
  extends: ['@commitlint/config-conventional'],
  // Dependabot commit bodies contain links longer than the 100-character
  // body line limit, so skip commits that Dependabot signed off and whose
  // subject matches the prefixes set in .github/dependabot.yml. The PR
  // title, which becomes the squash-merge commit, is still conventional.
  ignores: [
    (message) =>
      /^(ci|build)\(deps(-dev)?\): bump /.test(message) &&
      /^Signed-off-by: dependabot\[bot\] <support@github\.com>$/m.test(message),
  ],
}
