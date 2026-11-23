declare const __BUILD__: { count: string; commit: string; at: number };

/** v1.{number of commits}: goes up by itself with every commit. */
export const VERSION = `v1.${__BUILD__.count || "0"}`;
export const COMMIT = __BUILD__.commit;
/** When this bundle was built for deploy (epoch ms). */
export const BUILT_AT = __BUILD__.at;
