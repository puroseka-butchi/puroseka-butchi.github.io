# Graph Report - E:\Blog_PJSK\Blog  (2026-08-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 118 nodes · 121 edges · 15 communities
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0fd2898e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dependencies
- package.json
- hexo-live-server.js
- scripts
- prune-public-assets.js
- library.js
- dialogue.js
- translation-player.js

## God Nodes (most connected - your core abstractions)
1. `scripts` - 13 edges
2. `renderLibraryFeature()` - 7 edges
3. `keywords` - 4 edges
4. `startServer()` - 3 edges
5. `scheduleRestart()` - 3 edges
6. `escapeHtml()` - 3 edges
7. `stripQuotes()` - 3 edges
8. `parsePipeArguments()` - 3 edges
9. `renderMultilineTitle()` - 3 edges
10. `updateUi()` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (15 total, 0 thin omitted)

### Community 0 - "dependencies"
Cohesion: 0.08
Nodes (25): hexo-generator-archive, hexo-generator-category, hexo-generator-index, hexo-generator-searchdb, hexo-generator-tag, hexo-renderer-ejs, hexo-renderer-marked, hexo-renderer-stylus (+17 more)

### Community 1 - "package.json"
Cohesion: 0.13
Nodes (14): hexo, author, hexo, description, hexo, version, keywords, license (+6 more)

### Community 2 - "hexo-live-server.js"
Cohesion: 0.18
Nodes (12): cleanCache(), forwardedArgs, fs, hexoCli, path, root, scheduleRestart(), { spawn, spawnSync } (+4 more)

### Community 3 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, admin, build, clean, convert, import:media, new, new:interview (+5 more)

### Community 4 - "prune-public-assets.js"
Cohesion: 0.18
Nodes (7): fs, htmlFiles, path, publicDir, publicImagesDir, referenced, root

### Community 5 - "library.js"
Cohesion: 0.40
Nodes (9): escapeHtml(), headingId(), libraryIsVisible(), parsePipeArguments(), plainTitle(), renderInlineMarkdown(), renderLibraryFeature(), renderMultilineTitle() (+1 more)

### Community 6 - "dialogue.js"
Cohesion: 0.40
Nodes (3): hexToRgba(), normalizeHex(), warnedCharacterIds

### Community 7 - "translation-player.js"
Cohesion: 0.47
Nodes (3): loadTrack(), play(), updateUi()

## Knowledge Gaps
- **50 isolated node(s):** `fs`, `path`, `{ spawn, spawnSync }`, `root`, `hexoCli` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `{ spawn, spawnSync }` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._