export const microInteractionTransition = {
  duration: 0.18,
  ease: 'easeOut',
} as const;

export const enterEaseTransition = {
  duration: 0.26,
  ease: 'easeOut',
} as const;

export const exitEaseTransition = {
  duration: 0.2,
  ease: 'easeIn',
} as const;

export const springHoverTransition = {
  type: 'spring',
  stiffness: 420,
  damping: 28,
  mass: 0.8,
} as const;

export const pageVariants = {
  enter: {
    opacity: 0,
    y: 14,
    filter: 'blur(6px)',
  },
  center: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: enterEaseTransition,
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: 'blur(4px)',
    transition: exitEaseTransition,
  },
};

export const sidebarVariants = {
  open: {
    width: '280px',
    transition: { type: 'spring', damping: 28, stiffness: 260 },
  },
  closed: {
    width: '80px',
    transition: { type: 'spring', damping: 28, stiffness: 260 },
  },
};

export const sidebarItemVariants = {
  hidden: { opacity: 0, x: -10, y: 4 },
  visible: (custom: number) => ({
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      ...enterEaseTransition,
      delay: custom * 0.03,
    },
  }),
};

export const staggerListVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02,
    },
  },
};

export const blockVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.985 },
  visible: (custom: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...enterEaseTransition,
      delay: custom * 0.02,
    },
  }),
};

export const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', damping: 20 },
  },
  exit: { opacity: 0, scale: 0.95 },
};

export const tooltipVariants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2 },
  },
};

export const buttonHoverVariants = {
  hover: {
    scale: 1.02,
    transition: microInteractionTransition,
  },
  tap: {
    scale: 0.98,
    transition: microInteractionTransition,
  },
};

export const tabVariants = {
  hidden: { opacity: 0, x: 10 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
};
