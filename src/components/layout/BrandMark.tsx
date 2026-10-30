import React from "react";
import Link from "next/link";
import Image from "next/image";

const MARK_SRC = "/brand/paid-talent-mark.svg";
const LOCKUP_SRC = "/brand/paid-talent-logo.svg";

interface BrandMarkProps {
  href: string;
}

export function BrandMark({ href }: BrandMarkProps): React.ReactElement {
  return (
    <Link
      href={href}
      aria-label="Paid Talent"
      className="inline-flex h-8 shrink-0 items-center"
    >
      <Image
        src={MARK_SRC}
        alt=""
        width={32}
        height={32}
        priority
        unoptimized
        aria-hidden
        className="h-8 w-8 min-[380px]:hidden"
      />
      <Image
        src={LOCKUP_SRC}
        alt=""
        width={200}
        height={32}
        priority
        unoptimized
        aria-hidden
        className="hidden h-7 w-auto max-w-[180px] min-[380px]:block"
      />
    </Link>
  );
}
