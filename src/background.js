// The background service. Handles app initialisation stuff, and responds to
// requests sent by content scripts.

importScripts("building.js");

chrome.runtime.onInstalled.addListener(onInstall);
chrome.runtime.onMessage.addListener(onMessage);

// End of script execution, function definitions below.

async function setDefaultConfig() {
    const config = {
        BookkeeperOptions: {
            AenableOwnBuildings: true,
            OenableOwnBuildings: true,
            PenableOwnBuildings: true,
            autoKey: 103,
            enableAutoKey: false,
            enablePSB: false,
        },
    };
    await chrome.storage.sync.set(config);
}

async function onInstall(details) {
    if (details.reason === "install") {
        await setDefaultConfig();
        return;
    }

    if (details.reason === "update") {
        let maj, min, patch;
        {
            const v = details.previousVersion.split(".").map(parseInt);
            while (v.length < 3) {
                v.push(0);
            }
            maj = v[0];
            min = v[1];
            patch = v[2];
        }

        if (maj < 2 || (maj === 2 && min < 1)) {
            // This would be a Bookkeeper installation from like 2019, maybe
            // earlier, that is suddenly being upgraded to the current version
            // in 2025. I am positive that this never is going to happen.
            console.warn(
                `Bookkeeper version ${details.previousVersion} is ancient and not supported anymore. Resetting the configuration. Apologies to the user, they will have to track their buildings again.`,
            );
            await chrome.storage.sync.clear();
            await setDefaultConfig();
            console.info("Configuration reset.");
            return;
        }
    }
}

// The function below is called when a content script asks the background page
// to do some work for it.
//
// The idea is: when a content script needs something, it builds an object with
// a property `op`, which contains a string naming one of the "op handlers"
// defined further down.  Other properties are added to that object, as required
// by the particular handler.  The object is then sent as a message with
// `chrome.runtime.sendMessage`, and is received by the handler below, who
// dispatches it to the appropriate handler.
//
// Some handlers do not respond anything to the content script.  These can take
// a single parameter, the message, and should always return false.
//
// Some handlers may need to deliver data back to the content script, and this
// data may not be immediately available.  These should accept three parameters;
// the third will be a callback function; they should return true immediately
// and arrange for the callback to be called when the response can be delivered.
//
// If a handler returns true, MAKE SURE THE CALLBACK IS CALLED EVENTUALLY,
// otherwise the content script may just sit there waiting for a response that
// will never arrive.  And Chrome will leak a connection to the background page
// indefinitely, keeping it from unloading when the extension is idle.  We want
// none of this.
function onMessage(message, sender, sendResponse) {
    const handler = OpHandlers[message.op];
    if (handler) {
        return handler(message, sendResponse, sender);
    }
    return false;
}

const OpHandlers = {
    showNotification: function (message) {
        const options = {
            type: "basic",
            title: "Pardus Bookkeeper",
            message: message.text,
            iconUrl: "icons/48.png",
        };
        chrome.notifications.create(message.id, options);
        return false;
    },

    queryTicksLeft: function (message, sendResponse) {
        const keys = message.ids.map((id) => message.ukey + id);
        chrome.storage.sync.get(keys, onData);
        return true;

        function onData(data) {
            const r = {};
            const now = Building.now();
            for (const key in data) {
                const building = Building.createFromStorage(key, data[key]);
                if (Building.getTypeShortName(building.typeId) === "TO") {
                    //skip TOs
                    continue;
                }
                const ticksNow = building.ticksNow(now);
                r[building.loc] = {
                    t: ticksNow,
                    f:
                        ticksNow === building.ticksLeft &&
                        building.isFullyStocked(),
                    p: building.hasProduction(),
                    b: building.buying,
                };
            }

            sendResponse(r);
        }
    },

    // This is magic.
    injectMeHard: function (message, sendResponse, sender) {
        const results = [];
        const injectionTarget = {
            tabId: sender.tab.id,
            frameIds: [sender.frameId],
        };

        if (message.stylesheets) {
            results.push(
                chrome.scripting.insertCSS({
                    target: injectionTarget,
                    files: message.stylesheets,
                }),
            );
        }

        if (message.scripts) {
            results.push(
                chrome.scripting.executeScript({
                    target: injectionTarget,
                    files: message.scripts,
                }),
            );
        }

        Promise.all(results).then(() => sendResponse());

        return true;
    },
};
