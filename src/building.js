class Building {
    // Lazily initialised by methods below
    static #name_ids;
    static #icon_ids;
    static #lcsn_ids; // "lower case short name"

    // Construct a new Building instance.
    //
    // Supply as many parameters as you have data for, and/or use undefined for
    // missing data. Note though: the building will not be fully usable (some
    // instance methods may fail) until at least properties `loc`, `sectorId`,
    // and `typeId`, have been set.
    //
    // `loc`, `sectorId`, `typeId`, `time`, `level`, and `ticksLeft`, if
    // provided, should be integers.
    //
    // `owner`, if provided, should be a string.
    //
    // `selling`, `buying`, `minimum`, `maximum`, `upkeep`, and `production`, if
    // provided, should be arrays of integer values.
    //
    // Note that `time` is expected as a Unix timestamp in *seconds*, not
    // milliseconds. You can use Building.seconds to convert the result of
    // Date.now().
    //
    // If the instance is not initialised fully here, supply the missing
    // properties later using the set* methods.
    //
    // `upkeep` and `production` should only be set when they can't be
    // calculated from the building's level, or the when level cannot be
    // estimated. Usually these two properties won't be read directly; methods
    // getUpkeep and getProduction can be used instead, which will give these
    // values if available, or defer to getNormalUpkeep and getNormalProduction
    // if not.
    constructor(
        loc,
        sectorId,
        typeId,
        time,
        owner,
        level,
        ticksLeft,
        selling,
        buying,
        minimum,
        maximum,
        upkeep,
        production,
        buyAtPrices,
        sellAtPrices,
        credits,
        psb,
        amount,
        tag,
    ) {
        this.loc = Building.#intPropVal(loc);
        this.sectorId = Building.#intPropVal(sectorId);
        this.typeId = Building.#intPropVal(typeId);
        this.time = Building.#intPropVal(time) || Building.now();
        this.owner = owner ? String(owner) : undefined;
        this.level = Building.#intPropVal(level);
        this.ticksLeft = Building.#intPropVal(ticksLeft);
        this.selling = selling || [];
        this.buying = buying || [];
        this.minimum = minimum || [];
        this.maximum = maximum || [];
        this.upkeep = upkeep || [];
        this.production = production || [];
        this.buyAtPrices = buyAtPrices ? buyAtPrices : [];
        this.sellAtPrices = sellAtPrices ? sellAtPrices : [];
        this.credits = credits ? parseInt(credits) : undefined;
        this.psb = psb ? true : false;
        this.amount = amount || [];
        this.tag = this.typeId ? Building.makeTag(typeId) : undefined;

        // These three won't be used until they're needed.  But defining them
        // already anyway so V8 can optimise.
        // https://www.html5rocks.com/en/tutorials/speed/v8/#toc-topic-hiddenclasses
        this.cachedUpkeep = undefined;
        this.cachedProduction = undefined;
        this.projection = undefined;
    }

    // 1. Properties and methods of the Building object.

    // All the building types we care about.
    //
    // Don't change the order of this array; add new types at the bottom. The
    // index of each object in the array is actually a type ID already kept in
    // chrome.storage, so changing this would make a mess of current users'
    // data.
    //
    // `n` is the building name, `s` is the building short name, `i` is the URL
    // of the building image without the image pack prefix and the '.png'
    // suffix. `bu` is the base upkeep for buildings of this type, `bp` is the
    // base production.
    static #catalogue = [
        ,
        // unused index 0
        {
            n: "Alliance Command Station",
            s: "ACS",
            i: "alliance_command_station",
            bu: { 2: 6, 19: 2 },
            bp: {},
        },
        {
            n: "Asteroid Mine",
            s: "AM",
            i: "asteroid_mine",
            bu: { 1: 1, 2: 1, 3: 1 },
            bp: { 5: 9, 14: 2 },
        },
        {
            n: "Battleweapons Factory",
            s: "BWF",
            i: "battleweapons_factory",
            bu: { 1: 1, 2: 2, 3: 1, 6: 3, 7: 3, 18: 4 },
            bp: { 27: 2 },
        },
        {
            n: "Brewery",
            s: "Br",
            i: "brewery",
            bu: { 1: 2, 2: 2, 3: 2, 13: 4 },
            bp: { 15: 4 },
            tag: "drugchain",
        },
        {
            n: "Chemical Laboratory",
            s: "CL",
            i: "chemical_laboratory",
            bu: { 1: 1, 2: 3, 3: 1 },
            bp: { 13: 9 },
            tag: "support",
        },
        {
            n: "Clod Generator",
            s: "CG",
            i: "clod_generator",
            bu: { 2: 4, 13: 4, 21: 18 },
            bp: { 23: 5 },
        },
        {
            n: "Dark Dome",
            s: "DD",
            i: "dark_dome",
            bu: { 2: 1, 50: 2 },
            bp: { 21: 4, 203: 12 },
        },
        {
            n: "Droid Assembly Complex",
            s: "DAC",
            i: "droid_assembly_complex",
            bu: { 1: 1, 2: 3, 3: 1, 8: 2, 19: 3 },
            bp: { 20: 1 },
        },
        {
            n: "Drug Station",
            s: "DS",
            i: "drug_station",
            bu: { 1: 3, 2: 1, 3: 3, 17: 3, 50: 3 },
            bp: { 51: 1 },
            tag: "drugchain",
        },
        {
            n: "Electronics Facility",
            s: "EF",
            i: "electronics_facility",
            bu: { 1: 1, 2: 4, 3: 1, 6: 3, 9: 2 },
            bp: { 7: 6 },
        },
        {
            n: "Energy Well",
            s: "EW",
            i: "energy_well",
            bu: { 1: 1, 3: 1 },
            bp: { 2: 6 },
        },
        {
            n: "Fuel Collector",
            s: "FC",
            i: "fuel_collector",
            bu: { 2: 4, 13: 1 },
            bp: { 16: 30 },
        },
        {
            n: "Gas Collector",
            s: "GC",
            i: "gas_collector",
            bu: { 1: 2, 2: 2, 3: 2 },
            bp: { 12: 20 },
        },
        {
            n: "Handweapons Factory",
            s: "HWF",
            i: "handweapons_factory",
            bu: { 1: 1, 2: 2, 3: 1, 7: 3, 9: 3, 18: 3 },
            bp: { 10: 2 },
        },
        {
            n: "Leech Nursery",
            s: "LN",
            i: "leech_nursery",
            bu: { 1: 2, 2: 6, 3: 10, 19: 6, 23: 40 },
            bp: { 21: 3, 22: 1 },
        },
        {
            n: "Medical Laboratory",
            s: "ML",
            i: "medical_laboratory",
            bu: { 1: 2, 2: 2, 3: 2, 12: 7 },
            bp: { 11: 4 },
            tag: "drugchain",
        },
        {
            n: "Military Outpost",
            s: "MO",
            i: "military_outpost",
            bu: { 2: 5, 16: 5, 19: 0 },
            bp: {},
        },
        {
            n: "Nebula Plant",
            s: "NP",
            i: "nebula_plant",
            bu: { 1: 2, 3: 2, 17: 3 },
            bp: { 2: 35, 12: 4 },
            tag: "support",
        },
        {
            n: "Neural Laboratory",
            s: "NL",
            i: "neural_laboratory",
            bu: { 1: 2, 2: 2, 3: 2, 4: 12, 11: 2 },
            bp: { 28: 16 },
        },
        {
            n: "Optics Research Center",
            s: "ORC",
            i: "optics_research_center",
            bu: { 1: 1, 2: 3, 3: 1, 14: 2 },
            bp: { 18: 10 },
        },
        {
            n: "Plastics Facility",
            s: "PF",
            i: "plastics_facility",
            bu: { 1: 2, 2: 2, 3: 2, 12: 3, 13: 3 },
            bp: { 9: 6 },
        },
        {
            n: "Radiation Collector",
            s: "RC",
            i: "radiation_collector",
            bu: { 1: 1, 2: 3, 3: 1 },
            bp: { 19: 6 },
        },
        {
            n: "Recyclotron",
            s: "Rcy",
            i: "recyclotron",
            bu: { 2: 3, 13: 1, 21: 5 },
            bp: { 1: 7, 3: 5 },
            tag: "support",
        },
        {
            n: "Robot Factory",
            s: "RF",
            i: "robot_factory",
            bu: { 1: 2, 2: 2, 3: 2, 6: 1, 7: 4, 18: 2 },
            bp: { 8: 3 },
        },
        {
            n: "Slave Camp",
            s: "SC",
            i: "slave_camp",
            bu: { 1: 3, 2: 1, 3: 3, 11: 2, 15: 2 },
            bp: { 50: 3 },
            tag: "drugchain",
        },
        {
            n: "Smelting Facility",
            s: "Sm",
            i: "smelting_facility",
            bu: { 1: 2, 2: 2, 3: 2, 5: 4 },
            bp: { 6: 6 },
        },
        {
            n: "Space Farm",
            s: "SF",
            i: "space_farm",
            bu: { 2: 4, 4: 5 },
            bp: { 1: 8, 3: 2, 21: 1 },
            tag: "support",
        },
        {
            n: "Stim Chip Mill",
            s: "SCM",
            i: "stim_chip_mill",
            bu: { 1: 3, 3: 3, 7: 2, 17: 2, 28: 44 },
            bp: { 29: 2 },
        },
        {
            n: "Faction Starbase",
            s: "F",
            i: "starbase_f",
            bu: { 1: 2.5, 3: 1.75 },
            bp: { 2: 4, 4: 1.25 },
        },
        {
            n: "Player Starbase",
            s: "P",
            i: "starbase_p",
            bu: { 1: 3, 3: 2 },
            bp: { 2: 5.25, 4: 1 },
        },
        {
            n: "Class M Planet",
            s: "M",
            i: "planet_m",
            bu: { 2: 7.5 },
            bp: { 1: 3.5, 3: 4 },
        },
        {
            n: "Class A Planet",
            s: "A",
            i: "planet_a",
            bu: { 2: 12.5 },
            bp: { 1: 10, 3: 10 },
        },
        {
            n: "Class D Planet",
            s: "D",
            i: "planet_d",
            bu: { 3: 2.5, 14: 0.5 },
            bp: { 50: 0.15 },
        },
        {
            n: "Class I Planet",
            s: "I",
            i: "planet_i",
            bu: { 2: 7.5 },
            bp: { 1: 8, 4: 0.1 },
        },
        {
            n: "Class G Planet",
            s: "G",
            i: "planet_g",
            bu: { 1: 1.5, 2: 7.5 },
            bp: { 4: 0.75, 12: 5, 13: 0.5 },
        },
        {
            n: "Class R Planet",
            s: "R",
            i: "planet_r",
            bu: { 1: 2.5, 2: 4, 3: 2 },
            bp: { 4: 1, 5: 1.5, 6: 0.5, 19: 0.1 },
        },
        {
            n: "Trading Outpost",
            s: "TO",
            i: "trade_outpost",
            bu: {},
            bp: {},
        },
    ];

    // Convenience for the current time in seconds, so K's heart doesn't break
    // that hard.
    static now() {
        return Building.seconds(Date.now());
    }

    // Convert a time in milliseconds, like Date uses, to seconds, like Building
    // wants.
    static seconds(millis) {
        return Math.floor(millis / 1000);
    }

    // Get the type spec object for the given typeId. Most likely you'll want to
    // use the instance's methods instead, getTypeName etc.
    static getType(typeId) {
        return this.#catalogue[typeId];
    }

    // If you have the name of a building type (e.g. "Medical Laboratory"), this
    // gives you the type id for it. If the name isn't recognisable, returns
    // undefined.
    static getTypeId(name) {
        if (this.#name_ids === undefined) {
            this.#name_ids = this.#catalogue.reduce((name_ids, data, id) => {
                name_ids[data.n] = id;
                return name_ids;
            }, {});
        }
        return this.#name_ids[name];
    }

    // If you have the URL of the building's image, strip the prefix up to the
    // last slash, and the '.png' suffix, then call this for the type id.
    static getTypeIdByIcon(icon) {
        if (this.#icon_ids === undefined) {
            this.#icon_ids = this.#catalogue.reduce((icon_ids, data, id) => {
                icon_ids[data.i] = id;
                return icon_ids;
            }, {});
        }
        return this.#icon_ids[icon];
    }

    // Get the type name from a type id.
    // XXX test this!
    static getTypeName(typeId) {
        const t = this.getType(typeId);
        return t !== undefined ? t.n : undefined;
    }

    // Get the type short name from a type id (e.g. ACS, DAC, etc.).
    static getTypeShortName(typeId) {
        const t = this.getType(typeId);
        return t !== undefined ? t.s : undefined;
    }

    // Get the base upkeep for "normal" buildings of the given type. Return an
    // object where keys are commodity ids encoded as strings, and values are
    // integers.
    static getBaseUpkeep(typeId) {
        const t = this.getType(typeId);
        return t !== undefined ? t.bu : undefined;
    }

    // Get the base production for "normal" buildings of the given type. Return
    // an object where keys are commodity ids encoded as strings, and values are
    // integers.
    static getBaseProduction(typeId) {
        const t = this.getType(typeId);
        return t !== undefined ? t.bp : undefined;
    }

    // Get an array of commodity ids that buildings of the given type consume.
    static getUpkeepCommodities(typeId) {
        const t = this.getType(typeId);
        return t !== undefined ? Object.keys(t.bu).map(parseInt) : undefined;
    }

    // Get an array of commodity ids that buildings of the given type consume.
    // Note that stim chip mills and dark domes (XXX - only those?) can produce
    // things not listed by this.
    static getProductionCommodities(typeId) {
        const t = this.getType(typeId);
        return t !== undefined ? Object.keys(t.bp).map(parseInt) : undefined;
    }

    // Get the "normal" upkeep of a building of the given type and level, before
    // bonuses and penalties that may apply.
    static getNormalUpkeep(typeId, level) {
        return Building.#computeUpPr(this.getType(typeId), "bu", level, 0.4);
    }

    // Get the "normal" production of a building of the given type and level,
    // before bonuses and penalties that may apply.
    static getNormalProduction(typeId, level) {
        return Building.#computeUpPr(this.getType(typeId), "bp", level, 0.5);
    }

    // Return true if the given commodity id is consumed by buildings of the
    // given type.
    static isUpkeep(typeId, commodityId) {
        const t = this.getType(typeId);
        return t !== undefined ? t.bu[commodityId] !== undefined : undefined;
    }

    // Return true if the given commodity id is produced by buildings of the
    // given type (with the SCM, DD caveats).
    static isProduction(typeId, commodityId) {
        const t = this.getType(typeId);
        return t !== undefined ? t.bp[commodityId] !== undefined : undefined;
    }

    // Compute the storage key of a building at the given location and universe.
    static storageKey(universeKey, location) {
        return universeKey + location;
    }

    // Create a Building instance from data obtained from storage. `key` is the
    // storage key used to retrieve the building; `a` is data retrieved from
    // storage.
    //
    // Do not use building data from storage directly; always create an instance
    // with this function, manipulate that, and use its toStorage method if you
    // need to store it back. This lets us change the storage format without
    // having to modify the app anywhere but here.
    static createFromStorage(key, a) {
        // V3.1 format is a 3- to 18-element array.
        const loc = parseInt(key.substr(1));
        return new Building(
            loc,
            v(a[0]), // sectorId
            v(a[1]), // typeId
            v(a[2]), // timeSecs
            v(a[3]), // owner
            v(a[4]), // level
            v(a[5]), // ticksLeft
            Building.#unpackArray(a[6]), // selling
            Building.#unpackArray(a[7]), // buying
            Building.#unpackArray(a[8]), // minimum
            Building.#unpackArray(a[9]), // maximum
            Building.#unpackArray(a[10]), // upkeep
            Building.#unpackArray(a[11]), // production
            Building.#unpackArray(a[12]), // buyAtPrices,
            Building.#unpackArray(a[13]), // sellAtPrices,
            v(a[14]), //credits
            v(a[15]), //psb
            Building.#unpackArray(a[16]), // amount
            v(a[17]), // tag
        );

        // Apparently, we get `null` for items where we set as `undefined` when
        // saving. We want always undefined after load. This is below is a very
        // deliberate ==, don't change to ===.
        function v(val) {
            return val == null ? undefined : val;
        }
    }

    // The number of production ticks elapsed from Unix timestamp `time` to
    // `now`. Both are given in seconds past the epoch. If the latter is
    // omitted, it defaults to the current time.
    static ticksPassed(time, now) {
        return unixToTicks(now) - unixToTicks(time);

        // Building ticks happen every 6 hours, 25 minutes past the hour,
        // starting at 01:25 UTC.
        //
        // Period is 6h (21600 s). Offset is 1h 25m (5100 s)
        //
        // This returns the number of building ticks that have elapsed since the
        // epoch.
        function unixToTicks(sec) {
            return Math.floor((sec - 5100) / 21600);
        }
    }

    // Removes the building at location `loc` from storage. `ukey` is the
    // universe key (a single uppercase letter: A, O, P).
    //
    // This is an unusual function that actually updates `chrome.storage.sync`.
    // Added because removing a single building is in fact a common operation.
    //
    // XXX this should return a promise when the deletion is complete.
    static removeStorage(loc, ukey, callback) {
        const locn = parseInt(loc);
        if (isNaN(locn)) return;

        chrome.storage.sync.get(ukey, removeBuildingListEntry);

        function removeBuildingListEntry(data) {
            const list = data[ukey];
            const index = list.indexOf(locn);
            if (index === -1) removeBuildingData();
            else {
                list.splice(index, 1);
                chrome.storage.sync.set(data, removeBuildingData);
            }
        }

        function removeBuildingData() {
            chrome.storage.sync.remove(ukey + locn, callback);
        }
    }

    static makeTag(typeId) {
        // Puts the tag in tag unless there is no tag then it's blank.
        return this.#catalogue[typeId].tag;
    }

    // Search for a building type whose short name, in lower case, is equal to
    // the given string. If a type is found, return its id; otherwise return
    // undefined. Assume `s` is lower-case.
    static getTypeIdByLCShortName(s) {
        if (this.#lcsn_ids === undefined) {
            this.#lcsn_ids = this.#catalogue.reduce((dict, btype, id) => {
                dict[btype.s.toLowerCase()] = id;
                return dict;
            }, {});
        }
        return this.#lcsn_ids[s];
    }

    // 2.  Methods of Building instances.

    // The following methods do the same as the Building ones, only for the
    // instance.

    getType() {
        return Building.getType(this.typeId);
    }

    getTypeName() {
        return Building.getTypeName(this.typeId);
    }

    getTypeShortName() {
        return Building.getTypeShortName(this.typeId);
    }

    getBaseUpkeep(typeId) {
        return Building.getBaseUpkeep(this.typeId);
    }

    getBaseProduction(typeId) {
        return Building.getBaseProduction(this.typeId);
    }

    getUpkeepCommodities(typeId) {
        return Building.getUpkeepCommodities(this.typeId);
    }

    getProductionCommodities(typeId) {
        return Building.getProductionCommodities(this.typeId);
    }

    getNormalUpkeep(typeId) {
        return Building.getNormalUpkeep(this.typeId, this.level);
    }

    getNormalProduction(typeId) {
        return Building.getNormalProduction(this.typeId, this.level);
    }

    isUpkeep(commodityId) {
        return Building.isUpkeep(this.typeId, commodityId);
    }

    isProduction(commodityId) {
        return Building.isProduction(this.typeId, commodityId);
    }

    getBuyAtPrices() {
        return this.buyAtPrices;
    }

    getSellAtPrices() {
        return this.sellAtPrices;
    }

    getAmount() {
        return this.amount;
    }

    // Return the number of ticks for which this building still has upkeep. If a
    // projection is active, this will return the projected value.
    getTicksLeft() {
        if (this.projection !== undefined) return this.projection.ticksLeft;
        return this.ticksLeft;
    }

    // Return the array of commodities that this building is buying. If a
    // projection is active, this will return the projected values. Note that,
    // if a projection cannot be performed, you'll see NaN values in the array
    // returned.
    getBuying() {
        if (this.projection !== undefined) return this.projection.buying;
        return this.buying;
    }

    // Return the array of commodities that this building is selling. If a
    // projection is active, this will return the projected values. Note that,
    // if a projection cannot be performed, you'll see NaN values in the array
    // returned.
    getSelling() {
        if (this.projection !== undefined) return this.projection.selling;
        return this.selling;
    }

    // Set the Building's projection, so that methods `getTicksLeft`,
    // `getBuying` and `getSelling` return values projected at the given time.
    // If `time` is null, reset the projection, so those methods will return
    // last-updated values.
    project(time) {
        let ticksLeft, elapsed, upkeep, production;

        if (!time) {
            this.projection = undefined;
            return;
        }

        if (this.ticksLeft === undefined) {
            setProjection.call(this, undefined, this.buying, this.selling);
        } else {
            if (this.ticksLeft > 0) {
                ticksLeft = this.ticksNow(time);
                elapsed = this.ticksLeft - ticksLeft;
            } else {
                ticksLeft = 0;
                elapsed = 0;
            }

            if (elapsed === 0) {
                // Could handle below but optimise this common case
                setProjection.call(this, ticksLeft, this.buying, this.selling);
            } else {
                upkeep = this.getUpkeep();
                production = this.getProduction();
                setProjection.call(
                    this,
                    ticksLeft,
                    this.buying.map(projectUpkeep),
                    this.selling.map(projectProduction),
                );
            }
        }

        // Do note: projectUpkeep and projectProduction will return NaN if the
        // id is not in upkeep/production. This happens when
        // getUpkeep/getProduction return an empty array, which in turn happens
        // when there is no level and no stored production/upkeep. We don't
        // check for those things here because the NaN is actually kinda useful:
        // it lets us know which commodities are part of the upkeep and
        // production, just can't be projected.
        function projectUpkeep(amt, id) {
            return amt + elapsed * upkeep[id];
        }

        // XXX - if/when we track building capacity, we can cap this (and could
        // even tell you when the building will dump.
        function projectProduction(amt, id) {
            return amt + elapsed * production[id];
        }

        function setProjection(ticksLeft, buying, selling) {
            this.projection = { ticksLeft, buying, selling };
        }
    }

    getUpkeep() {
        if (this.cachedUpkeep) {
            return this.cachedUpkeep;
        }
        if (this.upkeep.length > 0) {
            this.cachedUpkeep = this.upkeep;
        } else if (this.level !== undefined) {
            this.cachedUpkeep = this.getNormalUpkeep();
        } else {
            this.cachedUpkeep = [];
        }
        return this.cachedUpkeep;
    }

    getProduction() {
        if (this.cachedProduction) {
            return this.cachedProduction;
        }
        if (this.production.length > 0) {
            this.cachedProduction = this.production;
        } else if (this.level !== undefined) {
            this.cachedProduction = this.getNormalProduction();
        } else {
            this.cachedProduction = [];
        }
        return this.cachedProduction;
    }

    // The following methods set instance properties. Prefer these to setting
    // the properties directly.

    setLocation(loc, sectorId) {
        this.loc = Building.#intPropVal(loc);
        this.sectorId = Building.#intPropVal(sectorId);
    }

    setType(typeId) {
        this.typeId = Building.#intPropVal(typeId);
        this.cachedUpkeep = undefined;
        this.cachedProduction = undefined;
    }

    setLevel(level) {
        this.level = Building.#intPropVal(level);
        this.cachedUpkeep = undefined;
        this.cachedProduction = undefined;
    }

    setTime(t) {
        this.time = Building.#intPropVal(t) || Building.now();
    }

    setTicksLeft(n) {
        this.ticksLeft = Building.#intPropVal(n);
    }

    setOwner(owner) {
        if (owner !== undefined) {
            owner = String(owner);
            if (owner.length === 0) {
                owner = undefined;
            }
        }
        this.owner = owner;
    }

    setSelling(a) {
        this.selling = a || [];
    }
    setBuying(a) {
        this.buying = a || [];
    }
    setMinimum(a) {
        this.minimum = a || [];
    }
    setMaximum(a) {
        this.maximum = a || [];
    }
    setPSB(a) {
        this.psb = a || false;
    }
    setCredits(a) {
        this.credits = a || null;
    }

    setUpkeep(a) {
        if (a) {
            this.cachedUpkeep = a;
            this.upkeep = a;
        } else {
            this.cachedUpkeep = undefined;
            this.upkeep = [];
        }
    }

    setProduction(a) {
        if (a) {
            this.cachedProduction = a;
            this.production = a;
        } else {
            this.cachedProduction = undefined;
            this.production = [];
        }
    }

    // Check if this building stores minimums and maximums. That is not often
    // the case: currently bookie only stores that for your own buildings, when
    // it watches you set the limits in the "trade settings" page.
    hasMinMax() {
        return this.minimum.length > 0 && this.maximum.length > 0;
    }

    // Compute how many ticks of upkeep remain at time `now`, which should be
    // after the last time the building was updated. If omitted, it defaults to
    // the current time. `now` is a timestamp in seconds past the epoch.
    //
    // If remaining ticks were unknown at the time the building was last
    // updated, this function will return undefined.
    ticksNow(now) {
        if (this.ticksLeft === undefined) return undefined;

        return Math.max(
            0,
            this.ticksLeft - Building.ticksPassed(this.time, now),
        );
    }

    // Compute the storage key that you'd use to store this building in the
    // given universe.
    storageKey(universeKey) {
        return universeKey + this.loc;
    }

    // Create the object that gets sent to storage when we store a Building. Do
    // not store building data directly; always create a Building instance, use
    // this function to obtain the data to store, and send that to storage. This
    // lets us change the storage format when needed, without having to modify
    // the app anywhere but here.
    toStorage() {
        // V3.1 format is a 3 to 18-element array.
        const a = [
            this.sectorId,
            this.typeId,
            this.time,
            this.owner,
            this.level,
            this.ticksLeft,
            Building.#packArray(this.selling),
            Building.#packArray(this.buying),
            Building.#packArray(this.minimum),
            Building.#packArray(this.maximum),
            Building.#packArray(this.upkeep),
            Building.#packArray(this.production),
            Building.#packArray(this.buyAtPrices),
            Building.#packArray(this.sellAtPrices),
            this.credits,
            this.psb,
            Building.#packArray(this.amount),
            this.tag,
        ];

        // Shave off the last undefined elements of this. a.length should never
        // go below 3 here, but we'll check just in case because if we're wrong
        // things would get ugly.
        while (a.length > 3 && a[a.length - 1] === undefined) {
            a.length = a.length - 1;
        }
        return a;
    }

    // Return an array of commodity ids for commodities that appear in either
    // this.buying or this.selling, in numeric order. Note this is not exactly
    // equivalent to getUpkeepCommodities + getProductionCommodities, because
    // things like stim chip mills and dark domes produce commodities that are
    // not actually listed in the type's base figures.
    getCommoditiesInUse() {
        let seen = [],
            r = [];

        if (this.buying) {
            this.buying.forEach(pushc);
        }
        if (this.selling) {
            this.selling.forEach(pushc);
        }
        return r.sort(compare);

        function pushc(v, i) {
            if (!seen[i]) {
                seen[i] = true;
                r.push(i);
            }
        }
        function compare(a, b) {
            return a - b;
        }
    }

    // Remove this building from storage. This updates `chrome.storage.sync`.
    removeStorage(ukey, callback) {
        Building.removeStorage(this.loc, ukey, callback);
    }

    // Return true if the building was fully stocked at the time it was last
    // updated. This means that it won't buy any of the commodities it consumes.
    // However, if we don't see it buying any commodities at all, then we
    // haven't actually recorded it's stocks, so we can't know if it's fully
    // stocked.
    isFullyStocked() {
        return (
            this.buying.length > 0 &&
            this.getUpkeepCommodities().find(function (commId) {
                return this[commId] > 0;
            }, this.buying) === undefined
        );
    }

    // Returns true if the building has any production commodities to sell.
    hasProduction() {
        let s = this.getSelling();
        let sum = 0;
        for (let i = 1; i < s.length; i++) {
            if (Building.isProduction(this.typeId, i.toString())) {
                sum += s[i];
            }
        }
        return sum > 0;
    }

    // 3. Private functions.

    // We want our integer properties consistently numbers or undefined.
    static #intPropVal(v) {
        if (v !== undefined) {
            if (isNaN((v = parseInt(v)))) v = undefined;
        }
        return v;
    }

    // Convert a sparse array to the form we send to storage.
    static #packArray(a) {
        if (a.length === 0) {
            return undefined;
        }
        return a.reduce(function (scm, val, id) {
            scm.push(id, val);
            return scm;
        }, []);
    }

    // Convert an array from storage to a sparse array.
    static #unpackArray(a) {
        var r, i, end;
        if (!a) {
            return [];
        }
        for (r = [], i = 0, end = a.length; i < end; i += 2) {
            r[a[i]] = a[i + 1];
        }
        return r;
    }

    // Compute a normal building upkeep/production from base values and level,
    // using formulae from http://www.pardus.at/index.php?section=manual_ref020
    static #computeUpPr(spec, prop, level, factor) {
        if (spec === undefined || level === undefined) {
            return undefined;
        }
        const base = spec[prop];
        const r = [];
        for (const k in base) {
            r[k] = Math.round(base[k] * (1 + factor * (level - 1)));
        }
        return r;
    }
}
