"use client";

import Link from "next/link";
import { motion, type HTMLMotionProps } from "framer-motion";

const MotionNextLink = motion(Link);

const tapSpring = { type: "spring" as const, stiffness: 520, damping: 32 };

type MotionLinkProps = Omit<HTMLMotionProps<"a">, "href"> & {
  href: string;
};

export function MotionLink({ whileTap = { scale: 0.96 }, transition = tapSpring, ...props }: MotionLinkProps) {
  return <MotionNextLink whileTap={whileTap} transition={transition} {...props} />;
}
