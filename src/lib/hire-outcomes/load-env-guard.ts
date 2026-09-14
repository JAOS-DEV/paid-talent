import "../db/load-env";
import { assertLocalDatabase, describeDatabaseTarget } from "../db/safety";

const parsed = assertLocalDatabase(process.env.DATABASE_URL, {
  action: "validate hire confirmation",
});
console.log(`LOCAL_DB_HOST=${parsed.host}`);
console.log(`LOCAL_DB_TARGET=${describeDatabaseTarget(process.env.DATABASE_URL)}`);
