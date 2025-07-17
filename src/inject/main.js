{
    let postVars = function () {
        let msg = {
            pardus_bookkeeper: 2,
            loc: typeof userloc == "undefined" ? null : userloc,
        };
        window.postMessage(msg, window.location.origin);
    };
    if (typeof addUserFunction === "function") {
        addUserFunction(postVars);
    }
    postVars();
}
