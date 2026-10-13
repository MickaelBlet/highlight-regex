# AGENTS.md

Guidance for AI coding agents working in this repository.

VS Code extension "Highlight - Regex" (`highlight.regex`): decorates text matched by user-defined regexes, configured in `settings.json`. TypeScript, no runtime dependencies, no bundler.

## Commands

- `npm run compile` — `tsc -p ./` → `out/` (entry `out/extension.js`)
- `npm run watch` — incremental compile
- `./scripts/build.sh X.Y.Z` — regenerate `package.json` + `vsce package` (`INSTALL_VSIX=1` to also install)
- No test suite and no linter are configured; verify by compiling and running the extension (F5 / Extension Development Host).

## package.json is generated

`package.json` (~500 KB) is rendered from `scripts/package.jinja.json` by `scripts/generate.py VERSION NB_RECURSE` (needs `jinja2`). Edit the template, never `package.json` directly, then regenerate.
- The JSON schema for nested `regexes` is unrolled `NB_RECURSE` times (5 in `build.sh`).
- Custom views 1–10 and the visible/active view menus are generated with Jinja loops.

## Architecture

- `src/extension.ts` — `activate()` wires VS Code events (config change, visible editors, text change debounced by `highlight.regex.delay`, active editor) to the manager.
- `src/manager.ts` — singleton `manager` holding all subsystems; imported directly by most modules (beware circular imports).
- `src/core/scope.ts` — `ScopeManager` owns two `Scope`s: `global` (`highlight.regex.regexes`) and `workspace` (`highlight.regex.workspace.regexes`). Each `Scope` has a `Parser`, a settings `TreeDataProvider`, and a `TreeView`; checkbox changes write back to configuration.
- `src/core/parser.ts` — compiles regex config into `RegexEntry`/`LoadedRegex` trees, owns `TextEditorDecorationType`s, applies decorations per editor, and keeps a per-editor match cache (`cacheEditors`, bounded by `cacheLimit`) that the Visible/Active/Custom views read. Global scope uses negative z-index base so workspace decorations win.
  - Child `regexes` run on the text of a parent match/group; capture group positions use the native `d` flag (`indices`), and `g` is always forced.
  - `src/core/named-groups.ts` maps named groups to indexes and extracts group sources for labels.
- `src/settings/` — `Setting` resolves user/remote/workspace `settings.json` URIs and edits them (focus a key, insert snippets); `jsonc-parser.ts` is a hand-written JSONC parser that records each key path's text position. Remote: settings may live in `Machine/settings.json` or `User/settings.json`.
- `src/treeview/` — settings tree for global/workspace views (`tree-item.ts`) and the shared occurrence tree builder (`occurrence-tree.ts`) used by match views.
- `src/views/` — `visible`, `active`, `custom` (10 instances, URI stored in `highlight.regex.customN.uri`) match-navigation views, each with a tree provider and a file-decoration provider; `quickpick` is "Choose by name(s)". `setDetail()` toggles grouping by regex/capture group/child regex.
- `src/commands/` — one `register*Commands()` per area, all called from `commands/index.ts`. New commands must also be declared in `scripts/package.jinja.json`.

## Conventions

- Every source file starts with the MIT license header.
- Logging via `log` (`src/logger.ts`) to the "Highlight regex" output channel; text changes in that channel are ignored to avoid feedback loops.
- User-facing changes go in `CHANGELOG.md` under `[Unreleased]`; examples in `examples.md`, settings docs in `README.md`.
