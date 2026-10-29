(() => {
    "use strict";

    const BASE = "/websitem-koteka-digital";

    document.addEventListener("click", function (event) {
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }

        const anchor = event.target.closest("a[href]");

        if (
            !anchor ||
            anchor.target === "_blank" ||
            anchor.hasAttribute("download")
        ) {
            return;
        }

        const url = new URL(anchor.href, window.location.href);

        if (
            url.origin !== window.location.origin ||
            url.pathname.startsWith(BASE + "/")
        ) {
            return;
        }

        const allowedPath =
            /^\/(?:$|layanan(?:\/|$)|portofolio(?:\/|$)|blog(?:\/|$)|privacy-policy(?:\/|$)|admin(?:\/|$))/;

        if (!allowedPath.test(url.pathname)) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        window.location.assign(
            BASE + url.pathname + url.search + url.hash
        );
    }, true);
})();
