{
    let postVars = function () {
        let msg = {
            pardus_bookkeeper: 1,
            loc: typeof userloc === "undefined" ? null : userloc,
            time: typeof milliTime === "undefined" ? null : milliTime,
            player_buy_price:
                typeof player_buy_price === "undefined"
                    ? null
                    : player_buy_price,
            player_sell_price:
                typeof player_sell_price === "undefined"
                    ? null
                    : player_sell_price,
            amount: typeof amount === "undefined" ? null : amount,
            amount_max: typeof amount_max === "undefined" ? null : amount_max,
            amount_min: typeof amount_min === "undefined" ? null : amount_min,
        };
        window.postMessage(msg, window.location.origin);
    };
    if (typeof addUserFunction === "function") {
        addUserFunction(postVars);
    }
    postVars();
}
