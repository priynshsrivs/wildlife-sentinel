export const fadeUp = {
hidden: {
opacity: 0,
y: 25,
},
visible: {
opacity: 1,
y: 0,
transition: {
duration: 0.55,
ease: [0.22, 1, 0.36, 1],
},
},
};

export const stagger = {
hidden: {
opacity: 0,
},
visible: {
opacity: 1,
transition: {
staggerChildren: 0.08,
},
},
};

