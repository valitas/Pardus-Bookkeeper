class Filter {
    constructor() {
        this.#reset();
        this.filtering = false;
    }

    // Class methods.

    // Utility function to compute Manhattan distances between two points. If
    // you need to do that, might as well use this and know you're doing it just
    // like the filter (not that this is a hard function to implement, ha).
    static distance(x1, y1, x2, y2) {
        return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    }

    static quoteIfNeeded(s) {
        const m = /(['"\s])/.exec(s);
        if (!m) {
            return s;
        }
        const q = m[1] === '"' ? "'" : '"';
        return `${q}${s}${q}`;
    }

    // Instance methods.

    // Parse a query. Return true if the query was understood.
    //
    // A query is a string of tokens separated by white space. Tokens can be:
    //
    // * A coordinate pair: 8,23. Spaces are allowed around the comma; it's
    //   still a single token.
    // * A number: 123.
    // * A tag: #x, where x is any sequence of non-space characters.
    // * A word: any sequence of non-space characters.
    // * A quoted string: "hello world" or 'bla bla'
    //
    // Words and strings of length one are ignored.
    //
    // The matching rules are:
    //
    // * Coordinates don't actually match or reject anything but, if supplied,
    //   they can be used by the overview code to display a "distance" column.
    //   Only one coordinate pair is used in a query; if more are given, all but
    //   one are ignored. If a query matches buildings in more than one sector,
    //   all coordinates are ignored.
    //
    // * Numbers are assumed to be a search for buildings with ticks remaining
    //   now less or equal than the number. If more than one number is given,
    //   then the largest one is used.
    //
    // * Searches that include tags match only buildings thusly tagged.
    //
    // * Strings and words that exactly match the short name of a building type,
    //   case insensitive, are assumed to be searches for buildings of that
    //   type. If more than one type is given, the filter matches buildings of
    //   any of the given types.
    //
    // * Strings and words that are not building types are assumed to be either
    //   sector or owner searches. The filter will match any building where
    //   either the sector name or the owner's name contain any of the given
    //   strings, case insensitive.
    parseQuery(q) {
        this.#reset();
        const numbers = [];

        while (q.length > 0) {
            const m = Filter.#queryTokenRE.exec(q);
            if (!m) {
                break;
            }

            if (m[1]) {
                this.coords = coords(m[1], m[2]);
            } else if (m[3]) {
                numbers.push(parseInt(m[3]));
            } else if (m[4]) {
                this.tags.push(m[4]);
            } else if (m[5]) {
                pushstr.call(this, m[5]);
            } else if (m[6]) {
                pushstr.call(this, m[6]);
            } else {
                pushstr.call(this, m[7]);
            }

            q = q.substr(m[0].length);
        }

        if (numbers.length > 0) {
            this.ticks = Math.max.apply(null, numbers);
        }

        this.filtering =
            this.coords !== undefined ||
            this.ticks !== undefined ||
            this.tags.length > 0 ||
            this.btypes.length > 0 ||
            this.strings.length > 0;
        return this.filtering;

        function coords(x, y) {
            return { x: parseInt(x), y: parseInt(y) };
        }
        function pushstr(s) {
            if (s.length < 2) return;
            s = s.toLowerCase();
            const id = Building.getTypeIdByLCShortName(s);
            if (id !== undefined) {
                this.btypes.push(id);
            } else {
                this.strings.push(s);
            }
        }
    }

    // Scan a list of buildings and figure out which match the filter.
    filter(buildings, now) {
        let result;
        if (!this.filtering) {
            result = buildings;
        } else {
            result = buildings.filter(testBuilding.bind(this));
        }

        this.resultCount = result.length;
        this.matchedOwners = dedupe(this.matchedOwners);
        this.matchedSectors = dedupe(this.matchedSectors);
        this.singleSector = singleSector(result);
        if (!this.singleSector) {
            this.coords = undefined;
        }

        return result;

        // end of function execution, below are inner function defs

        function testBuilding(building) {
            let match;

            // We check the filter conditions here.  Note we keep looking
            // until we know for sure that a building is rejected.

            if (this.ticks !== undefined) {
                match = building.ticksNow(now) <= this.ticks;
            }
            if (match !== false && this.tags.length > 0) {
                match = this.tags.includes(building.tag);
            }
            if (match !== false && this.btypes.length > 0) {
                match = this.btypes.includes(building.typeId);
            }
            if (match !== false && this.strings.length > 0) {
                match = testStrings.call(this);
            }

            // Include the building if it was accepted by some rule.

            return match;

            function testStrings() {
                let ownerMatch, sectorMatch;
                const sector = Sector.getName(building.sectorId);
                this.strings.forEach(testString.bind(this));

                return ownerMatch || sectorMatch;

                function testString(s) {
                    if (
                        building.owner !== undefined &&
                        building.owner.toLowerCase().includes(s)
                    ) {
                        this.matchedOwners.push(building.owner);
                        ownerMatch = true;
                    }

                    if (
                        sector !== undefined &&
                        sector.toLowerCase().includes(s)
                    ) {
                        this.matchedSectors.push(sector);
                        sectorMatch = true;
                    }
                }
            }
        }

        function dedupe(a) {
            const dic = {};
            a.forEach((item) => {
                dic[item] = true;
            });
            return Object.keys(dic);
        }

        // Test if all buildings in the collection are in the same sector.
        function singleSector(buildings) {
            if (buildings.length === 0) {
                return false;
            }
            const id = buildings[0].sectorId;
            return buildings.every((b) => b.sectorId === id);
        }
    }

    // Construct an English description of the last filter operation.
    makeHumanDescription() {
        if (!this.filtering) {
            return "Showing all tracked objects.";
        }

        const parts = ["Showing"];

        if (this.btypes.length === 0) {
            parts.push("buildings");
        } else {
            parts.push(humanBTypes(this.btypes));
        }

        if (this.resultCount > 0) {
            // If we found results, and there were strings to match, then each
            // string must have matched at least one sector or building.
            if (this.strings.length > 0) {
                parts.push(ownerSectorPart.call(this));
            }
        } else {
            // If nothing matched, and there were strings to search, then add
            // that so the user knows why their query had no matches.
            if (this.strings.length > 0) {
                const e = humanEnumeration(this.strings.map((s) => quote(s)));
                parts.push(`matching ${e}`);
            }
        }

        if (this.ticks !== undefined) {
            parts.push(humanTicks(this.ticks));
        }

        return parts.join(" ") + ".";

        function ownerSectorPart() {
            var parts = [];

            // XXX this will change with coords
            if (this.matchedSectors.length > 0) {
                const e = humanEnumeration(this.matchedSectors, "or");
                parts.push(`in ${e}`);
            }

            if (this.matchedOwners.length > 0) {
                const e = humanEnumeration(this.matchedOwners, "or");
                parts.push(`owned by ${e}`);
            }

            return parts.join(" or ");
        }

        function humanTicks(n) {
            if (n === 0) {
                return "without upkeep";
            }
            if (n === 1) {
                return "without upkeep or with one tick of upkeep remaining";
            }
            return `with ${n} or fewer ticks of upkeep remaining`;
        }

        function humanBTypes(btypes) {
            const types = btypes.map((id) => plural(Building.getTypeName(id)));
            return humanEnumeration(types);
        }

        function plural(s) {
            const p = Filter.#plurals[s];
            if (p) {
                return p;
            }
            return s + "s";
        }

        function humanEnumeration(things, conjunction) {
            if (things.length === 0) {
                return null;
            }
            if (things.length === 1) {
                return things[0];
            }

            if (conjunction === undefined) {
                conjunction = " and ";
            } else {
                conjunction = ` ${conjunction} `;
            }

            if (things.length === 2) {
                return things.join(conjunction);
            }

            const a = [
                things.slice(0, -1).join(", "),
                things[things.length - 1],
            ];
            return a.join(`,${conjunction}`);
        }

        // Add quotes to a string. This is flaky and just for display, not for
        // parsing.
        function quote(s) {
            const q = s.indexOf('"') === -1 ? '"' : "'";
            return `${q}${s}${q}`;
        }
    }

    // If the Filter has coordinates, then return the Manhattan distance from the
    // filter coords to the given point.  It'll error if no coords, so check first.
    distance(x, y) {
        return Filter.distance(this.coords.x, this.coords.y, x, y);
    }

    // Private methods and utilities.

    // Set all instance properties to initial values, except `filtering`. That one
    // is set in either constructor or parseQuery.
    #reset() {
        this.coords = undefined;
        this.ticks = undefined;
        this.tags = [];
        this.btypes = [];
        this.strings = [];
        this.matchedSectors = [];
        this.matchedOwners = [];
        this.resultCount = NaN;
        this.singleSector = undefined;
    }

    // This hideous regexp matches tokens in a query. See doc comment for
    // `parseQuery` above.
    static #queryTokenRE =
        /^\s*(?:(\d+)\s*,\s*(\d+)|(\d+)|#(\S+)|"([^"]*)"|'([^']*)'|(\S+))/;

    // Because we don't want to say factorys in public.
    static #plurals = {
        "Battleweapons Factory": "Battleweapons Factories",
        Brewery: "Breweries",
        "Chemical Laboratory": "Chemical Laboratories",
        "Droid Assembly Complex": "Droid Assembly Complexes",
        "Electronics Facility": "Electronics Facilities",
        "Handweapons Factory": "Handweapons Factories",
        "Leech Nursery": "Leech Nurseries",
        "Medical Laboratory": "Medical Laboratories",
        "Neural Laboratory": "Neural Laboratories",
        "Plastics Facility": "Plastics Facilities",
        "Robot Factory": "Robot Factories",
        "Smelting Facility": "Smelting Facilities",
    };
}
