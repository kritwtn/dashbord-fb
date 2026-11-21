/**
 * Small navigation API on top of React Router (keeps component code router-agnostic).
 * router.refresh() asks mounted data hooks to reload from the database.
 */
import { forwardRef } from "react";
import { Link as RRLink, useLocation, useNavigate, useSearchParams as rrSearchParams } from "react-router-dom";

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };
const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, ...rest }, ref) {
  return <RRLink ref={ref} to={href} {...rest} />;
});
export default Link;
export { Link };

export const usePathname = () => useLocation().pathname;
export const useSearchParams = () => rrSearchParams()[0];

export const REFRESH_EVENT = "data-refresh";
export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (to: string) => navigate(to),
    replace: (to: string) => navigate(to, { replace: true, preventScrollReset: true }),
    refresh: () => window.dispatchEvent(new Event(REFRESH_EVENT)),
  };
}
