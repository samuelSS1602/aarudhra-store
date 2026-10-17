"use client";

import { motion } from "framer-motion";

export function Celebrate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
      {children}
    </motion.div>
  );
}
