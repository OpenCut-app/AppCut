"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "motion/react";
import { type PropsWithChildren, useEffect, useRef, useState } from "react";

type HandlebarsProps = PropsWithChildren;

export function Handlebars({ children }: HandlebarsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(0);

  const [leftHandle, setLeftHandle] = useState(0);
  const [rightHandle, setRightHandle] = useState(width);

  const leftHandleX = useMotionValue(0);
  const rightHandleX = useMotionValue(width);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      setWidth(el.offsetWidth);
      setRightHandle(el.offsetWidth);
      rightHandleX.set(el.offsetWidth);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [rightHandleX.set]);

  useMotionValueEvent(leftHandleX, "change", () => {
    setLeftHandle(leftHandleX.get());
  });
  useMotionValueEvent(rightHandleX, "change", () => {
    setRightHandle(rightHandleX.get());
  });
  const leftGradient = useTransform(leftHandleX, [0, width - 10], [0, 100]);
  const rightGradient = useTransform(rightHandleX, [0, width + 10], [0, 100]);

  return (
    <div className="flex justify-center gap-4 leading-16">
      <div ref={containerRef} className="relative -rotate-[2.76deg] mt-0.5">
        <div className="absolute inset-0 w-full h-full rounded-2xl border border-yellow-500 flex justify-between z-1">
          <motion.div
            className="absolute z-10 left-0 h-full border border-yellow-500 w-7 rounded-full bg-background flex items-center justify-center select-none"
            style={{
              x: leftHandleX,
            }}
            drag="x"
            dragConstraints={{ left: 0, right: rightHandle - 60 }}
            dragElastic={0}
            dragMomentum={false}
            whileHover={{ scale: 1.05, cursor: "grab" }}
            whileDrag={{ scale: 1.1, cursor: "grabbing" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="w-2 h-8 rounded-full bg-yellow-500" />
          </motion.div>

          <motion.div
            className="absolute z-10 -left-[30px] h-full border border-yellow-500 w-7 rounded-full bg-background flex items-center justify-center select-none"
            style={{
              x: rightHandleX,
            }}
            drag="x"
            dragConstraints={{
              left: leftHandle + 60,
              right: width,
            }}
            dragElastic={0}
            dragMomentum={false}
            whileHover={{ scale: 1.05, cursor: "grab" }}
            whileDrag={{ scale: 1.1, cursor: "grabbing" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="w-2 h-8 rounded-full bg-yellow-500" />
          </motion.div>
        </div>

        <motion.span
          className="inline-flex items-center justify-center w-full h-full px-9 relative rounded-2xl will-change-auto"
          style={{
            mask: useMotionTemplate`linear-gradient(90deg,
            rgba(255, 255, 255, 0) 0%, 
            rgba(255, 255, 255, 0) ${leftGradient}%, 
            rgba(0, 0, 0) ${leftGradient}%, 
            rgba(0, 0, 0) ${rightGradient}%, 
            rgba(255, 255, 255, 0) ${rightGradient}%, 
            rgba(255, 255, 255, 0) 100%)`,
          }}
        >
          {children}
        </motion.span>
      </div>
    </div>
  );
}
