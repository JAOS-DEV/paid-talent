"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui";

export function VenueUnavailable(): React.ReactElement {
  const t = useTranslations("worker.interests");

  return (
    <Card padding="lg">
      <CardContent>
        <p className="text-center text-white py-10" role="status">
          {t("unavailable")}
        </p>
      </CardContent>
    </Card>
  );
}
