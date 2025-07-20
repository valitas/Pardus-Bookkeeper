class ToggleMaker {
    static #makeToggleSwitch(switchClass, sliderClass, square) {
        var container, input, slider;

        container = document.createElement("label");
        input = document.createElement("input");
        slider = document.createElement("span");

        container.className = switchClass;
        input.type = "checkbox";
        slider.className = sliderClass;
        if (!square) slider.classList.add("bookkeeper-round");

        container.appendChild(input);
        container.appendChild(slider);

        return container;
    }

    static make() {
        return this.#makeToggleSwitch("bookkeeper-switch", "bookkeeper-slider");
    }
    static makeSmall() {
        return this.#makeToggleSwitch(
            "bookkeeper-switch-small",
            "bookkeeper-slider-small",
        );
    }
}
