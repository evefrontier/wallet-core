# Contributing Guidelines

There are many ways to contribute to wallet-core.

## Troubleshooting

You can help other users in the community to solve their issues in the [Discord].

[Discord]: https://discord.com/invite/evefrontier

## Opening an issue

You can [open an issue] to suggest a feature or report a minor bug.

Before opening an issue, be sure to search through the existing open and closed issues, and consider posting a comment in one of those instead.

When requesting a new feature, include as many details as you can, especially around the use cases that motivate it. Features are prioritized according to the impact they may have on the ecosystem, so we appreciate information showing that the impact could be high.

[open an issue]: https://github.com/evefrontier/wallet-core/issues

## Submitting a pull request

If you would like to contribute code or documentation you may do so by forking the repository and submitting a pull request.

Make sure to run linter and tests to make sure your pull request is good before submitting it.

Please keep the scope of your PR small. It's better to open multiple small PRs than one huge PR, as smaller PRs are easier to review and merge.

When opening the pull request you will be presented with a template and a series of instructions. Read through it carefully and follow all the steps. Expect a review and feedback from the maintainers afterwards.

## Code Contribution Guidelines

When contributing code to wallet-core, please follow these guidelines:

### Commits and PR titles

Make sure that your commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). We enforce this in CI by using [wagoid/commitlint-github-action](https://github.com/wagoid/commitlint-github-action).

### Architecture

Check the [Architecture ADR](https://github.com/evefrontier/architecture-decision-log/blob/main/adr/0008-zklogin-implementation-auth-flow.md) for architecture reference and design decisions.

### Tooling

This is a [Bun](https://bun.sh) repo. Use `bun`, not `npm` or `pnpm`.

| Task | Command |
| --- | --- |
| Setup Node | `nvm use` |
| Install deps | `bun install` |
| Install testing deps | `bunx playwright install --with-deps chromium` |
| Lint & format (Biome) | `bun run lint` / `bun run lint:fix` |
| Unit tests | `bun run test` (all tests, headless) / `bun run test:coverage` (CI) |

Formatting and linting are enforced by [Biome](https://biomejs.dev): single quotes, no semicolons, 2-space indent, auto-organized imports. Use `bun run lint:fix`.

A pre-commit hook runs `bun run lint:fix` and `bun run test`; a pre-push hook runs `bun audit` and the full test suite.

### Tests

- Locate tests under `tests/` using the suffix that matches the runtime environment:
  `*.node.test.ts` for Node, `*.browser.test.ts` for browser/jsdom. Shared helpers go in `tests/`.
- Cover edge cases and varied inputs, not just the happy path with default values.
- New behavior must ship with tests; `bun run test` must pass before pushing.
