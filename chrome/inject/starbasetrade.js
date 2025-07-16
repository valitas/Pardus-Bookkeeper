{
    let postVars = function () {
        let msg = {
            pardus_bookkeeper: 1,
            loc: typeof userloc === "undefined" ? null : userloc,
            time: typeof milliTime === "undefined" ? null : milliTime,
            psbCredits: typeof obj_credits === "undefined" ? null : obj_credits,
        };
        window.postMessage(msg, window.location.origin);
    };
    if (typeof addUserFunction === "function") {
        addUserFunction(postVars);
    }
    postVars();
}
