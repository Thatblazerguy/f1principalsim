"use client";

import * as React from "react";
import XScroll from "./x-scroll";

function Demo() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="mx-auto w-[50vw] rounded-md border border-dashed">
        <XScroll>
          <div className="flex gap-4 p-6">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className="grid size-32 shrink-0 place-items-center rounded-md bg-gray-200 shadow-md"
              >
                {i}
              </div>
            ))}
          </div>
        </XScroll>
      </div>
    </div>
  );
}

export { Demo };
