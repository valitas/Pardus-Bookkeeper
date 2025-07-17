{
    let postVars = function () {
        let msg = {
            pardus_bookkeeper: 3,
            loc: typeof userloc == "undefined" ? null : userloc,
            time: typeof milliTime == "undefined" ? null : milliTime,
            ship_space: typeof ship_space == "undefined" ? null : ship_space,
            obj_space: typeof obj_space == "undefined" ? null : obj_space,
        };
        window.postMessage(msg, window.location.origin);
    };
    if (typeof addUserFunction === "function") {
        addUserFunction(postVars);
    }
    postVars();
}
