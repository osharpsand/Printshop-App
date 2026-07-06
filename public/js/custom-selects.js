(function () {
    const SELECT_SELECTOR = 'select.enhanced-select';

    class CustomSelect {
        constructor(select) {
            this.select = select;
            this.wrapper = document.createElement('div');
            this.wrapper.className = 'custom-select';

            this.select.parentNode.insertBefore(this.wrapper, this.select);
            this.wrapper.appendChild(this.select);
            this.select.hidden = true;

            this.trigger = document.createElement('button');
            this.trigger.type = 'button';
            this.trigger.className = 'custom-select__trigger';
            this.trigger.innerHTML = '<span class="custom-select__value"></span><span class="custom-select__caret">▾</span>';
            this.wrapper.appendChild(this.trigger);

            this.menu = document.createElement('div');
            this.menu.className = 'custom-select__menu';
            this.wrapper.appendChild(this.menu);

            this.trigger.addEventListener('click', (event) => {
                event.stopPropagation();
                this.toggle();
            });

            this.trigger.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                    event.preventDefault();
                    this.toggle();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    this.close();
                }
            });

            this.wrapper.addEventListener('click', (event) => {
                event.stopPropagation();
            });

            document.addEventListener('click', () => this.close());

            this.select.addEventListener('change', () => this.render());

            this.observer = new MutationObserver(() => this.render());
            this.observer.observe(this.select, { childList: true });

            this.render();
        }

        render() {
            const options = Array.from(this.select.options);
            this.menu.innerHTML = '';

            options.forEach((option) => {
                const optionButton = document.createElement('button');
                optionButton.type = 'button';
                optionButton.className = 'custom-select__option';

                if (option.selected) {
                    optionButton.classList.add('is-selected');
                }

                optionButton.dataset.value = option.value;
                optionButton.innerHTML = option.innerHTML || option.textContent;

                optionButton.addEventListener('click', () => {
                    this.select.value = option.value;
                    this.select.dispatchEvent(new Event('change', { bubbles: true }));
                    this.render();
                    this.close();
                });

                this.menu.appendChild(optionButton);
            });

            const selectedOption = options.find((option) => option.value === this.select.value) || options[0];
            const valueElement = this.trigger.querySelector('.custom-select__value');

            if (valueElement) {
                valueElement.innerHTML = selectedOption && selectedOption.innerHTML
                    ? selectedOption.innerHTML
                    : (selectedOption ? selectedOption.textContent : '');
            }

            this.trigger.setAttribute('aria-expanded', String(this.wrapper.classList.contains('is-open')));
        }

        toggle() {
            this.wrapper.classList.contains('is-open') ? this.close() : this.open();
        }

        open() {
            this.wrapper.classList.add('is-open');
            this.trigger.setAttribute('aria-expanded', 'true');
        }

        close() {
            this.wrapper.classList.remove('is-open');
            this.trigger.setAttribute('aria-expanded', 'false');
        }
    }

    function initializeCustomSelects(root = document) {
        const selects = [];
        const rootElement = root || document;

        if (rootElement.matches && rootElement.matches(SELECT_SELECTOR)) {
            selects.push(rootElement);
        }

        if (rootElement.querySelectorAll) {
            rootElement.querySelectorAll(SELECT_SELECTOR).forEach((select) => selects.push(select));
        }

        const uniqueSelects = [...new Set(selects)];

        uniqueSelects.forEach((select) => {
            if (select.dataset.customSelectInitialized === 'true') {
                return;
            }

            select.dataset.customSelectInitialized = 'true';
            new CustomSelect(select);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initializeCustomSelects());
    } else {
        initializeCustomSelects();
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type !== 'childList') {
                return;
            }

            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) {
                    return;
                }

                initializeCustomSelects(node);
            });
        });
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    window.CustomSelects = {
        init: initializeCustomSelects
    };
})();
