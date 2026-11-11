# Zen Folder Colors

A [Sine](https://github.com/CosmoCreeper/Sine) mod for [Zen Browser](https://zen-browser.app)
that lets you pick one of **16 colors** for any tab folder. The color tints the
folder icon, the folder header row and the tabs inside the folder.

## Requirements

- Zen Browser
- [Sine](https://github.com/CosmoCreeper/Sine) mod manager

## Installation

1. Open Zen settings → **Sine** → **Mods**.
2. Install from GitHub URL: `https://github.com/novik90/zen-folder-colors`
   (or install from a local folder with this repository cloned).
3. Restart the browser when Sine asks to rebuild.

## Usage

Right-click a folder in the tab sidebar → **Folder color** → pick a color.
Choose **Default (workspace color)** to return to the workspace-tinted look.

The selection is stored per folder id in the `zen.folder-colors.data` pref
(JSON), so colors survive browser restarts. To reset everything, clear that
pref in `about:config`.

## Customizing the palette

The 16 colors are plain CSS variables at the top of
[`userChrome.css`](userChrome.css):

```css
:root {
  --zfc-red: #ef4444;
  ...
}
```

Edit the hex values to taste — the icon, header and tab tints are derived from
them automatically and adapt to light/dark mode.

## How it works

- `folder-colors.uc.js` injects a **Folder color** submenu into the folder
  context menu (`#zenFolderActions`) and records the choice keyed by the
  folder's stable id. When folders appear in the DOM (startup, session
  restore), the stored color is applied back as a `zfc-color` attribute.
- `userChrome.css` maps `zen-folder[zfc-color="…"]` to the palette and
  restyles the folder through Zen's own `--zen-folder-*-bgcolor` /
  `--zen-folder-stroke` variables, plus soft tints for the header row and the
  tabs inside.
