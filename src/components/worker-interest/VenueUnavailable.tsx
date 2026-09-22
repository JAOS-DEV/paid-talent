import React from "react";
import { Card, CardContent } from "@/components/ui";
import { EMPTY_STATE_COPY } from "@/lib/interests/copy";

export function VenueUnavailable(): React.ReactElement {
  return (
    <Card padding="lg">
      <CardContent>
        <p className="text-center text-white py-10" role="status">
          {EMPTY_STATE_COPY.workerVenueUnavailable}
        </p>
      </CardContent>
    </Card>
  );
}
