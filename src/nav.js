// This is a content script, it runs on main.php.

// Note that this is self-contained, it doesn't include any other script; nav is
// a page that needs to load fast so we try to keep this as small as it can be.
// Any heavy-lifting is sent to the extension's background page if possible.

const COORDS_RX = /\[(\d+),(\d+)\]/;

// Fetches A elements in TDs of class "navBuilding"
//
// The last step is "descendant", rather than "direct child", to deal with a DIV
// that pardus inserts when you're on blue stims.
const BLDGTILE_XPATH = document.createExpression(
    './tbody/tr/td[@class="navBuilding"]//a[@onclick or @id="stdCommand"]',
    null,
);

// Match the onclick attribute of a tile.  If partial refresh is enabled, this
// will be ""navAjax(142080)"; if it's disabled, it will be "nav(142080)".
const TILEID_RX = /^nav(?:Ajax)?\((\d+)\)$/;

// Global state of the nav page
var bldgTileCache,
    ticksToggle,
    ticksEnabled,
    userloc,
    overviewToggle,
    overview;

chrome.storage.local.get("navticks", configure);

// End of content script execution.

function configure(data) {
    ticksEnabled = data.navticks === true;
    bldgTileCache = {};

    // Insert a bit of script to execute in the page's context and
    // send us what we need. And add a listener to receive the call.
    window.addEventListener("message", onMessage, false);
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("inject/main.js");
    (document.head || document.documentElement).appendChild(script);

    // Find the Cargo box and append our UI to it.
    const cargoBox = document.getElementById("cargo_content");
    if (!cargoBox) {
        return;
    }

    const ui = document.createElement("div");
    ui.id = "bookkeeper-ui";
    const img = document.createElement("img");
    img.title = "Pardus Bookkeeper";
    img.src = chrome.runtime.getURL("icons/16.png");
    ui.appendChild(img);
    ticksToggle = document.createElement("button");
    ticksToggle.id = "bookkeeper-navticks-switch";
    ticksToggle.textContent = "TICKS";
    ticksToggle.addEventListener("click", onToggleTicks, false);
    ui.appendChild(ticksToggle);

    overviewToggle = document.createElement("button");
    overviewToggle.id = "bookkeeper-overview-toggle";
    overviewToggle.textContent = "OPEN";
    overviewToggle.addEventListener("click", onToggleOverview, false);
    ui.appendChild(overviewToggle);

    // Wish we could insert directly in the cargo box, but partial refresh
    // does nasty things to it.

    const ctd = cargoBox.parentElement;
    const ctr = ctd.parentElement;
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.style.cssText = ctd.style.cssText;
    td.appendChild(ui);
    tr.appendChild(td);
    ctr.parentElement.insertBefore(tr, ctr.nextElementSibling);

    updateTicksToggle();
}

function updateTicksToggle() {
    if (ticksEnabled) {
        ticksToggle.classList.add("on");
    } else {
        ticksToggle.classList.remove("on");
    }
}

function onToggleTicks() {
    ticksEnabled = !ticksEnabled;
    ticksToggle.disabled = true;
    chrome.storage.local.set({ navticks: ticksEnabled }, onSaved);

    function onSaved() {
        updateTicksToggle();
        if (ticksEnabled) {
            showTicks();
        } else {
            hideTicks();
        }
        ticksToggle.disabled = false;
    }
}

// This is called when the page loads, and again whenever a partial refresh
// completes.

function onMessage(event) {
    const data = event.data;
    if (data.pardus_bookkeeper !== 2) {
        return;
    }

    event.stopPropagation();
    userloc = data.loc;

    // The stuff below, up to the local.set, shouldn't really be needed
    // anymore, because now we can get coordinates straight from the tile
    // id.  So XXX remove when possible.
    let sector, x, y;
    let element = document.getElementById("tdStatusSector");
    if (element) {
        sector = element.textContent.trim();
    }
    element = document.getElementById("tdStatusCoords");
    if (element) {
        const m = COORDS_RX.exec(element.textContent);
        if (m) {
            x = parseInt(m[1]);
            y = parseInt(m[2]);
        }
    }

    chrome.storage.local.set({ sector: sector, x: x, y: y });

    // This is needed.
    if (ticksEnabled) {
        showTicks();
    }
}

function showTicks() {
    const navTable = getNavArea();
    if (!navTable) {
        return;
    }

    const ukey = document.location.hostname[0].toUpperCase();
    const newCache = {};
    const needed = [];
    const needTicksDisplay = [];
    const xpr = BLDGTILE_XPATH.evaluate(
        navTable,
        XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
        null,
    );

    let a;
    while ((a = xpr.iterateNext()) !== null) {
        const onclkstr = a.getAttribute("onclick");
        let loc;
        if (onclkstr) {
            const m = TILEID_RX.exec(onclkstr);
            if (!m) {
                continue;
            }
            loc = parseInt(m[1]);
        } else if (a.id === "stdCommand") {
            // If "standard command" is enabled in Pardus settings, then the
            // tile you're on doesn't get an "onclick" thing, but a regular
            // href. It's still a building, though, and we have the loc.
            loc = userloc;
        } else {
            continue;
        }

        // Note: when high on Capri EPS scum cookies, the parent element of the
        // A node will be a div, not the TD itself. This is fine for us (and
        // better, we won't try to use the cached elements when the chip's
        // effect suddenly wears off).
        const td = a.parentElement;

        let cached = bldgTileCache[loc];
        if (cached) {
            cached.td = td;
            if (cached.ticks >= 0) {
                // This tile is cached and we already know its ticks, so we
                // won't request it again. But it's a new element created by
                // Pardus' partial refresh code, so we need to inject our little
                // marker again.
                needTicksDisplay.push(cached);
            }
        } else {
            needed.push(loc);
            cached = { loc: loc, td: td, ticks: -1 };
        }
        newCache[loc] = cached;
    }

    // Preserve in a global variable
    bldgTileCache = newCache;

    for (let i = 0, end = needTicksDisplay.length; i < end; i++) {
        const cached = needTicksDisplay[i];
        addSkittles(cached);
    }

    if (needed.length === 0) {
        return;
    }

    const op = {
        op: "queryTicksLeft",
        ids: needed,
        ukey: ukey,
    };

    chrome.runtime.sendMessage(op, onHaveTicks);
}

function onHaveTicks(r) {
    for (const key in r) {
        const ticks = r[key].t;
        const stocked = r[key].f;
        const prod = r[key].p;
        const buying = r[key].b;
        const cached = bldgTileCache[key];
        cached.ticks = ticks;
        cached.stocked = stocked;
        cached.prod = prod;
        cached.buying = buying;
        addSkittles(cached);
    }
}

function addSkittles(cached) {
    const elt = document.createElement("div");
    elt.className = "bookkeeper-ticks";
    elt.dataset.bookkeeperLoc = cached.loc;

    if (cached.ticks === 0) {
        elt.classList.add("red");
    } else if (cached.ticks === 1) {
        elt.classList.add("yellow");
    }
    if (cached.stocked) {
        elt.classList.add("grey");
    }
    if (cached.prod) {
        elt.classList.add("grtext");
    }

    // Check if our cargo has anything the buildings want.
    let cargo = document.getElementById("tableCargoRes"),
        cargoCommMatch = false;
    // XXX this caused an error when cargo was undefined. How did that happen?
    cargo = cargo.getElementsByTagName("td");

    for (var i = 0; i < cargo.length; i++) {
        if (cached.buying[parseInt(cargo[i].id.split(/Res/)[1])]) {
            cargoCommMatch = true;
            break; //one match'll do.
        }
    }
    // If we have cargo for that building, let it know on nav.
    if (cargoCommMatch) {
        elt.classList.add("bluecirc");
    }

    elt.textContent = cached.ticks;
    cached.td.appendChild(elt);
    //elt.addEventListener( 'click', onSkittleClick, false );
}

function hideTicks() {
    var elts = getNavArea().getElementsByClassName("bookkeeper-ticks");
    while (elts.length > 0) elts[0].remove();
    bldgTileCache = {};
}

function getNavArea() {
    // Yes, Pardus is a mess.
    var navTable = document.getElementById("navareatransition");
    if (!navTable) navTable = document.getElementById("navarea");
    return navTable;
}

// XXX - The following two handlers are too similar, combine common
// functionality in one call.

function onToggleOverview(event) {
    // Right. So you want the whole enchilada then. Fair enough, bring it
    // in.

    var op;

    event.preventDefault();

    // We will never handle these clicks again, it'll be handled in navov.js
    overviewToggle.removeEventListener("click", onToggleOverview, false);

    op = {
        op: "injectMeHard",
        stylesheets: ["/bookkeeper.css"],
        scripts: [
            "/universe.js",
            "/calendar.js",
            "/commodity.js",
            "/sector.js",
            "/building.js",
            "/table.js",
            "/filter.js",
            "/overview.js",
            "/overlay.js",
            "/navov.js",
        ],
    };
    // Empty function is actually needed.
    chrome.runtime.sendMessage(op, () => {});
}
