import createMiddleware from "next-intl/middleware";
import { routing } from "./navigation";

export const intlMiddleware = createMiddleware(routing);

export { routing };
