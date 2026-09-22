import React from "react";
import { LanguageToggle } from "./LanguageToggle";

export function AuthLocaleBar(): React.ReactElement {
  return (
    <div className="fixed top-0 right-0 z-30 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
      <LanguageToggle />
    </div>
  );
}
