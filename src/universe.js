class Universe {
    static #universe_keys = {
        artemis: "A",
        orion: "O",
        pegasus: "P",
    };

    constructor(universe_name) {
        const key = Universe.#universe_keys[universe_name];
        if (!key) {
            throw "Unsupported universe " + universe_name;
        }
        this.name = universe_name;
        this.key = key;
    }

    static fromDocument(doc) {
        const m = /^([^.]+)\.pardus\.at$/.exec(doc.location.hostname);
        if (m) {
            return new Universe(m[1]);
        }
        return null;
    }
}
