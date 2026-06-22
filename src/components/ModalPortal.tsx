import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Randează conținutul direct în <body>, în afara containerului de scroll
 * `.main-content`. Pe iOS Safari, un element `position: fixed` aflat în
 * interiorul unui container cu `overflow: auto` + `-webkit-overflow-scrolling`
 * este „prins" de acel container: apare sub header, dispare în spatele barei
 * de jos și se scrolează odată cu pagina, în loc să acopere tot ecranul.
 * Portarea în <body> îl scoate din acel container → modalul acoperă corect
 * tot viewportul, cu butoanele de închidere/trimitere mereu vizibile.
 *
 * Cât timp modalul e montat, blocăm și scroll-ul din fundal (body +
 * .main-content), ca pagina de dedesubt să nu se mai miște.
 */
export default function ModalPortal({ children }: { children: ReactNode }) {
  useEffect(() => {
    const main = document.querySelector(
      ".main-content",
    ) as HTMLElement | null;
    const prevBody = document.body.style.overflow;
    const prevMain = main ? main.style.overflow : "";
    document.body.style.overflow = "hidden";
    if (main) main.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      if (main) main.style.overflow = prevMain;
    };
  }, []);

  return createPortal(children, document.body);
}
