// This is a generic sortable and filterable table controller. It separates the
// DOM handling faff from our code that actually deals with data.

class SortableTable {
    options;
    doc;
    table;
    thead;
    tbody;
    tfoot;
    onRefresh;
    onSort;
    callbackContext;

    // Some of these maybe should be private
    items;
    spec;
    sorts;
    sortId;
    needFoot;

    // Create a `SortableTable` instance and associate it with a particular
    // document. A reference to the document is kept in the `doc` field. Basic
    // DOM elements for the table are created here, too, and references are kept
    // in fields `table', `thead`, `tbody`, `tfoot`. The table is not attached
    // to the document, though; that should be done by the caller with something
    // like:
    //
    // ```
    // someNode.appendChild(sortableTableInstance.table).
    // ```
    //
    // `options`, if supplied, is an object. Options property `defaultSortId`
    // provides a fallback id to use by `sort()` in case the id passed there is
    // not recognised. Options property `noFooter`, if true, specifies that a
    // table footer will never be needed so no `TFOOT` element should be
    // created.
    //
    // A reference to the options object is kept in the `options` field, so it
    // may be accessed by spec functions (see below).
    //
    // After the table is created, field `onRefresh' can be set on the instance,
    // containing a function to be called when the table refreshes (before any
    // spec functions are called). Field `onSort` can be set on the instance,
    // containing a function to be called after the table is sorted. Field
    // `callbackContext` may be set to any value; it is not used by the instance
    // but it will be available to spec functions.
    constructor(document, options) {
        this.options = options || {};
        this.doc = document;
        this.table = this.doc.createElement("table");
        ((this.thead = this.doc.createElement("thead")),
            (this.tbody = this.doc.createElement("tbody")),
            this.table.appendChild(this.thead));
        this.table.appendChild(this.tbody);

        if (!this.options.noFooter) {
            this.tfoot = this.doc.createElement("tfoot");
            this.table.appendChild(this.tfoot);
        }

        this.thead.addEventListener("click", (event) =>
            this.#onHeaderClick(event),
        );
    }

    // Prepares the table to display a collection of items. This does not
    // construct the DOM table yet, that happens in `sort()`.
    //
    // `spec` is an object one or two properties: `columns`, an array of column
    // specifications; and an optional `foot`, a function that canstructs a
    // table footer. `items` is an array of arbitrary objects.
    //
    // Column specifications are objects with the following properties:
    //
    // `header`: a function that sets up the TH element for the title of the column.
    // This function receives the TH element already created, and should set its
    // textContent, and possibly className and whatever else is needed.  It will be
    // called once when creating the table's header.
    //
    // `cell`: a function that sets up the TD for this column's cell in a row.  When
    // called, this function receives TWO parameters: the item that is being
    // displayed in the row, and the TD element already created.  It should set the
    // TD's textContent, className, whatever else is needed.  This function is
    // called once for every row in the table.
    //
    // `sortId` is an optional string.  If given, the column is sortable, and this
    // column's criterion can be selected by passing the key to
    // SortableTable.prototype.sort.
    //
    // `sort` is a function that compares two Building instances, according to this
    // column's sort criterion.  Return negative, zero, or positive, as usual.
    //
    // `initDesc` is an optional flag that specifies that, when sorting by this
    // column for the first time, the order should be descending.  Further sorts by
    // the same column will switch direction as usual, this just sets the initial
    // direction.
    //
    // All functions in the spec are called with `this` set to the SortableTable
    // instance.  So one can set custom properties in the SortableTable instance,
    // and refer to them from the various spec functions.
    //
    // XXX - move makeHead to sort
    refresh(spec, items) {
        this.items = items;
        this.spec = spec;
        this.sorts = {};
        this.needFoot = !!spec.foot;

        SortableTable.#clearElement(this.tbody);
        SortableTable.#clearElement(this.thead);
        if (!this.options.noFooter) {
            SortableTable.#clearElement(this.tfoot);
        }

        if (this.onRefresh) {
            this.onRefresh.call(this);
        }

        this.#makeHead();
    }

    // Sort the table and rebuild its DOM.  This is the actual function that creates
    // a visible table.  `asc` is optional.
    sort(sortId, asc) {
        let sort = this.sorts[this.sortId];
        if (sort !== undefined) {
            sort.th.classList.remove("asc", "dsc");
        }

        sort = this.sorts[sortId];
        if (sort === undefined) {
            sortId = this.options.defaultSortId;
            sort = this.sorts[sortId];
        }
        if (asc === undefined) {
            if (this.sortId === sortId) {
                this.sortAsc = !this.sortAsc;
            } else {
                this.sortAsc = sort.initAsc;
            }
        } else {
            this.sortAsc = asc;
        }
        this.sortId = sortId;

        let fn;
        if (this.sortAsc) {
            fn = sort.fn;
            sort.th.classList.add("asc");
        } else {
            fn = function (a, b) {
                return -sort.fn.call(this, a, b);
            };
            sort.th.classList.add("dsc");
        }

        this.items.sort(fn.bind(this));

        SortableTable.#clearElement(this.tbody);
        this.#makeRows();

        if (this.needFoot) {
            this.spec.foot.call(this);
            this.needFoot = false;
        }
    }

    // Private methods

    // Make the single row of the table header.  Assume thead is already empty.
    #makeHead() {
        const tr = this.doc.createElement("tr");
        this.spec.columns.forEach((spec) => {
            const th = this.doc.createElement("th");
            spec.header.call(this, th);
            if (spec.sortId) {
                th.classList.add("sort");
                th.dataset.sort = spec.sortId;
                this.sorts[spec.sortId] = {
                    th: th,
                    fn: spec.sort.bind(this),
                    initAsc: !spec.initDesc,
                };
            }
            tr.appendChild(th);
        });
        this.thead.appendChild(tr);
    }

    // Make a row per item, and TD elements for each row according to spec.
    // Assume tbody is already empty.
    #makeRows() {
        this.items.forEach((item) => {
            const tr = this.doc.createElement("tr");
            //tr.dataset.loc = building.loc; // XXX
            this.spec.columns.forEach((colspec) => {
                const td = this.doc.createElement("td");
                colspec.cell.call(this, item, td);
                tr.appendChild(td);
            });
            this.tbody.appendChild(tr);
        });
    }

    #onHeaderClick(event) {
        // The target may be the TH, or it may be an IMG or whatever tucked
        // inside the TH.

        let target = event.target;
        let sortId;
        while (
            (sortId = target.dataset.sort) === undefined &&
            target !== event.currentTarget &&
            target.parentElement !== null
        ) {
            target = target.parentElement;
        }

        if (sortId === undefined) {
            return;
        }

        event.stopPropagation();
        this.sort(sortId);
        if (this.onSort) {
            this.onSort.call(this);
        }
    }

    static #clearElement(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
}
