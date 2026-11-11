// ==UserScript==
// @name         Zen Folder Colors
// @description  Pick one of 16 colors for a tab folder: icon, header row and tabs inside
// @author       novik90
// ==/UserScript==
// Toggled by the zen.folder-colors.enabled pref; userChrome.css gates on the same pref.

(function () {
  // Sine re-runs .uc.js on every rebuild: tear down the previous instance first
  window.zenFolderColors?.destroy();

  const PREF_ENABLED = "zen.folder-colors.enabled";
  const PREF_DATA = "zen.folder-colors.data";
  Services.prefs.getDefaultBranch("").setBoolPref(PREF_ENABLED, true);
  Services.prefs.getDefaultBranch("").setCharPref(PREF_DATA, "{}");

  const ATTR = "zfc-color";
  const MENU_ID = "zfc-color-menu";
  const POPUP_ID = "zfc-color-popup";
  const COLORS = [
    "red", "orange", "amber", "yellow",
    "lime", "green", "teal", "cyan",
    "sky", "blue", "indigo", "violet",
    "purple", "pink", "rose", "gray",
  ];

  // ---- Storage ----
  // Zen recreates folder nodes on session restore and resets their state, so the
  // selection cannot live on the element. Folder ids are stable across sessions
  // (they are part of Zen's own folder storage), key the map by them.
  function loadMap() {
    try {
      return JSON.parse(Services.prefs.getCharPref(PREF_DATA, "{}"));
    } catch {
      return {};
    }
  }

  function storeColor(folderId, color) {
    const map = loadMap();
    if (color) {
      map[folderId] = color;
    } else {
      delete map[folderId];
    }
    Services.prefs.setCharPref(PREF_DATA, JSON.stringify(map));
  }

  // ---- Applying colors ----
  function applyStored(folder) {
    if (!folder?.isZenFolder) return;
    const color = loadMap()[folder.id];
    if (color && COLORS.includes(color)) {
      folder.setAttribute(ATTR, color);
    } else {
      folder.removeAttribute(ATTR);
    }
  }

  let rafId = null;
  function applyAll() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      for (const folder of gBrowser.tabContainer.querySelectorAll("zen-folder")) {
        applyStored(folder);
      }
    });
  }

  function setColor(folder, color) {
    storeColor(folder.id, color);
    if (color) {
      folder.setAttribute(ATTR, color);
    } else {
      folder.removeAttribute(ATTR);
    }
  }

  // Drop map entries whose folders no longer exist. Runs once after startup,
  // when session restore has settled.
  function pruneMap() {
    const map = loadMap();
    const alive = new Set(
      [...gBrowser.tabContainer.querySelectorAll("zen-folder")].map(f => f.id)
    );
    let changed = false;
    for (const id of Object.keys(map)) {
      if (!alive.has(id)) {
        delete map[id];
        changed = true;
      }
    }
    if (changed) {
      Services.prefs.setCharPref(PREF_DATA, JSON.stringify(map));
    }
  }

  // ---- Context menu ----
  // Same target resolution Zen uses for #zenFolderActions (ZenFolders.mjs).
  function resolveFolder(popup) {
    const target = popup.triggerNode ?? document.popupNode;
    if (!target) return null;
    if (gBrowser.isTabGroupLabel(target)) return target.group;
    if (gBrowser.isTabGroupLabel(target.parentElement)) {
      return target.parentElement.group;
    }
    if (
      target.parentElement?.isZenFolder &&
      target.classList.contains("tab-group-label-container")
    ) {
      return target.parentElement;
    }
    return null;
  }

  function swatchImage(colorName) {
    const hex =
      getComputedStyle(document.documentElement)
        .getPropertyValue(`--zfc-${colorName}`)
        .trim() || "#888888";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="5" fill="${hex}"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function buildMenu(parentPopup) {
    const fragment = window.MozXULElement.parseXULToFragment(`
      <menuseparator id="zfc-color-separator"/>
      <menu id="${MENU_ID}" label="Folder color" class="menu-iconic">
        <menupopup id="${POPUP_ID}"/>
      </menu>
    `);
    parentPopup.appendChild(fragment);

    const popup = parentPopup.querySelector(`#${POPUP_ID}`);
    for (const color of COLORS) {
      const item = document.createXULElement("menuitem");
      item.setAttribute("type", "radio");
      item.setAttribute("name", "zfc-color");
      item.setAttribute("label", color[0].toUpperCase() + color.slice(1));
      item.setAttribute("image", swatchImage(color));
      item.setAttribute("class", "menuitem-iconic");
      item.dataset.zfcColor = color;
      popup.appendChild(item);
    }
    popup.appendChild(document.createXULElement("menuseparator"));
    const reset = document.createXULElement("menuitem");
    reset.setAttribute("label", "Default (workspace color)");
    reset.dataset.zfcColor = "";
    popup.appendChild(reset);

    popup.addEventListener("command", event => {
      const folder = resolveFolder(parentPopup);
      if (!folder) return;
      setColor(folder, event.target.dataset.zfcColor || null);
    });
    popup.addEventListener("popupshowing", () => {
      const folder = resolveFolder(parentPopup);
      const current = folder?.getAttribute(ATTR) ?? null;
      for (const item of popup.querySelectorAll("menuitem[data-zfc-color]")) {
        if (item.getAttribute("type") === "radio") {
          item.setAttribute(
            "checked",
            item.dataset.zfcColor === current ? "true" : "false"
          );
        }
      }
    });
  }

  // ---- Lifecycle ----
  let running = false;
  let tabObserver = null;
  let pruneTimer = null;

  function start() {
    if (running) return;
    running = true;

    const actionsPopup = document.getElementById("zenFolderActions");
    if (actionsPopup && !actionsPopup.querySelector(`#${MENU_ID}`)) {
      buildMenu(actionsPopup);
    }

    tabObserver = new MutationObserver(applyAll);
    tabObserver.observe(gBrowser.tabContainer, { childList: true, subtree: true });

    applyAll();
    pruneTimer = setTimeout(pruneMap, 10000);
  }

  function stop() {
    if (!running) return;
    running = false;
    tabObserver?.disconnect();
    tabObserver = null;
    if (pruneTimer !== null) {
      clearTimeout(pruneTimer);
      pruneTimer = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    document.getElementById(MENU_ID)?.remove();
    document.getElementById("zfc-color-separator")?.remove();
    for (const folder of gBrowser.tabContainer.querySelectorAll(
      `zen-folder[${ATTR}]`
    )) {
      folder.removeAttribute(ATTR);
    }
  }

  function onPrefChange() {
    if (Services.prefs.getBoolPref(PREF_ENABLED, true)) start();
    else stop();
  }

  let destroyed = false;
  let observingPref = false;
  function init() {
    if (destroyed) return;
    Services.prefs.addObserver(PREF_ENABLED, onPrefChange);
    observingPref = true;
    // The pref service is process-wide: an observer left behind keeps this whole window alive
    window.addEventListener("unload", () => window.zenFolderColors?.destroy(), {
      once: true,
    });
    onPrefChange();
  }

  window.zenFolderColors = {
    destroy() {
      destroyed = true;
      if (observingPref) Services.prefs.removeObserver(PREF_ENABLED, onPrefChange);
      observingPref = false;
      stop();
      if (window.zenFolderColors === this) delete window.zenFolderColors;
    },
  };

  async function bootstrap() {
    if (!window.gBrowser || !window.gZenWorkspaces) {
      document.addEventListener("DOMContentLoaded", () => bootstrap().catch(console.error), { once: true });
      return;
    }
    await customElements.whenDefined("zen-folder");
    if (window.gZenWorkspaces.promiseInitialized) {
      await window.gZenWorkspaces.promiseInitialized;
    }
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootstrap().catch(console.error), { once: true });
  } else {
    queueMicrotask(() => bootstrap().catch(console.error));
  }
})();
