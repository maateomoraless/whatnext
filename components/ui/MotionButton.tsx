"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

const tapSpring = { type: "spring" as const, stiffness: 520, damping: 32 };

export const MotionButton = forwardRef<HTMLButtonElement, HTMLMotionProps<"button">>(function MotionButton(
  { whileTap = { scale: 0.96 }, transition = tapSpring, ...props },
  ref
) {
  return <motion.button ref={ref} whileTap={whileTap} transition={transition} {...props} />;
});
