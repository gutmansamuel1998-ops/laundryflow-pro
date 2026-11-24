import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { focusPageHeading, pageTitleFor } from "@/lib/routeA11y";

// P8.11: renders nothing. On every move to another screen it sets a title that names the screen and puts focus on the new
// page's main heading, so keyboard and screen-reader users start at the top of the new page. It does nothing on the first
// load (the browser handles that), for in-page links such as the skip link (the path does not change), or for the browser's
// own scroll restoration (Back and Forward keep the scroll position; only the title and focus are updated).
export default function RouteA11y() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef(null);

  useEffect(() => {
    document.title = pageTitleFor(pathname);
    const before = previous.current;
    previous.current = pathname;
    if (before === null || before === pathname) return undefined;
    return focusPageHeading({ preventScroll: navigationType === "POP" });
  }, [pathname, navigationType]);

  return null;
}
