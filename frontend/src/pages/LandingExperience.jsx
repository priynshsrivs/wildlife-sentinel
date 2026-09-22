import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import rhinoIntro from '../assets/rhino-intro.png';

import { COLORS } from '../constants/theme';
import { fadeUp } from '../constants/animations';
import GlobalStyles from '../components/GlobalStyles';


export default function LandingExperience({ onEnter, analytics }) {
const heroRef = useRef(null);
const rhinoRef = useRef(null);
const firstTitleRef = useRef(null);
const secondTitleRef = useRef(null);
const copyRef = useRef(null);
const sensorCameraRef = useRef(null);
const sensorAudioRef = useRef(null);
const protectRef = useRef(null);
const protectTitleRef = useRef(null);
const protectCopyRef = useRef(null);
const protectGlowRef = useRef(null);
const reserveRef = useRef(null);

useEffect(() => {
const section = heroRef.current;
if (!section) return;

let frame = null;

const handleScroll = () => {
  if (frame) cancelAnimationFrame(frame);

  frame = requestAnimationFrame(() => {
    const rect = section.getBoundingClientRect();
    const travel = Math.max(
      section.offsetHeight - window.innerHeight,
      1
    );
    const raw = -rect.top / travel;
    const progress = Math.min(1, Math.max(0, raw));

    if (rhinoRef.current) {
      // Keep the Rhino visible for most of the hero, then
      // let it glide toward the next section.
      const x =
        progress *
        Math.min(window.innerWidth * 0.38, 560);
      const y = progress * 34;
      const scale = 1 + progress * 0.13;
      const blur = progress * 8;
      const tilt = progress * -2.5;

      rhinoRef.current.style.transform =
        `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${tilt}deg)`;
      rhinoRef.current.style.filter =
        `blur(${blur}px)`;
      rhinoRef.current.style.opacity =
        `${1 - progress * 0.72}`;
    }

    if (firstTitleRef.current) {
      firstTitleRef.current.style.transform =
        `translate3d(${-progress * 170}px, ${-progress * 18}px, 0)`;
      firstTitleRef.current.style.opacity =
        `${1 - progress * 0.92}`;
    }

    if (secondTitleRef.current) {
      secondTitleRef.current.style.transform =
        `translate3d(${progress * 170}px, ${-progress * 18}px, 0)`;
      secondTitleRef.current.style.opacity =
        `${1 - progress * 0.92}`;
    }

    if (copyRef.current) {
      copyRef.current.style.transform =
        `translate3d(0, ${-progress * 55}px, 0)`;
      copyRef.current.style.opacity =
        `${1 - progress * 0.95}`;
    }

    if (sensorCameraRef.current) {
      sensorCameraRef.current.style.transform =
        `translate3d(${-progress * 40}px, ${-progress * 20}px, 0)`;
      sensorCameraRef.current.style.opacity =
        `${1 - progress * 0.9}`;
    }

    if (sensorAudioRef.current) {
      sensorAudioRef.current.style.transform =
        `translate3d(${-progress * 35}px, ${progress * 25}px, 0)`;
      sensorAudioRef.current.style.opacity =
        `${1 - progress * 0.9}`;
    }
  });
};

window.addEventListener("scroll", handleScroll, {
  passive: true,
});

handleScroll();

return () => {
  if (frame) cancelAnimationFrame(frame);
  window.removeEventListener(
    "scroll",
    handleScroll
  );
};
}, []);

useEffect(() => {
const section = protectRef.current;
if (!section) return;

let frame = null;

const handleProtectScroll = () => {
  if (frame) cancelAnimationFrame(frame);

  frame = requestAnimationFrame(() => {
    const rect = section.getBoundingClientRect();

    // 0 = section just entering the viewport
    // 1 = section has fully travelled through the sticky scene
    const travel = Math.max(
      section.offsetHeight - window.innerHeight,
      1
    );

    const raw = -rect.top / travel;
    const progress = Math.min(
      1,
      Math.max(0, raw)
    );

    // Ease the main motion, but keep the statement visually dark
    // while it sits in the middle of the viewport. The stronger glow
    // only arrives near the end of the section.
    const eased =
      progress * progress * (3 - 2 * progress);

    const exitGlow = Math.min(
      1,
      Math.max(0, (progress - 0.72) / 0.28)
    );

    if (protectTitleRef.current) {
      const scale = 0.80 + eased * 0.28;
      const y = 78 - eased * 78;
      // Keep the statement clearly readable while it is in the viewport.
      // It fades in early and only eases down slightly near the end.
      const opacity =
        Math.min(0.96, Math.max(0, (progress - 0.04) / 0.16)) *
        (1 - exitGlow * 0.10);

      protectTitleRef.current.style.transform =
        `translate3d(0, ${y}px, 0) scale(${scale})`;
      protectTitleRef.current.style.opacity =
        `${opacity}`;
    }

    // Keep the atmosphere subtle throughout the section rather than
    // making it suddenly glow only at the exit.
    if (protectGlowRef.current) {
      const ambient = 0.12 + exitGlow * 0.08;
      protectGlowRef.current.style.opacity =
        `${ambient}`;
      protectGlowRef.current.style.boxShadow =
        `0 0 ${70 + exitGlow * 35}px rgba(74,222,128,${
          0.018 + exitGlow * 0.018
        })`;
      protectGlowRef.current.style.transform =
        `scale(${0.98 + exitGlow * 0.03})`;
    }

    if (protectCopyRef.current) {
      const y = 44 - eased * 44;
      const opacity = Math.min(
        0.92,
        Math.max(0, (progress - 0.08) / 0.30)
      );

      protectCopyRef.current.style.transform =
        `translate3d(-50%, ${y}px, 0)`;
      protectCopyRef.current.style.opacity =
        `${opacity}`;
    }
  });
};

window.addEventListener(
  "scroll",
  handleProtectScroll,
  { passive: true }
);

handleProtectScroll();

return () => {
  if (frame) cancelAnimationFrame(frame);
  window.removeEventListener(
    "scroll",
    handleProtectScroll
  );
};
}, []);

const speciesList = analytics?.species_distribution
  ? Object.entries(analytics.species_distribution)
  : [];

const protectLines = [
  {
    text: "PROTECT",
    color: "#f8fafc",
  },
  {
    text: "WHAT CAN’T",
    color: "rgba(226,232,240,.82)",
  },
  {
    text: "SPEAK.",
    color: "#f8fafc",
  },
];

const interactiveWord = (
  text,
  color
) =>
  text.split("").map((char, index) => (
    <motion.span
      key={`${text}-${index}`}
      whileHover={{
        scale: 1.14,
        y: -7,
        color:
          color === "#f8fafc"
            ? "#4ade80"
            : "#f8fafc",
        textShadow:
          "0 0 22px rgba(74,222,128,.22)",
      }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 22,
        mass: 0.35,
      }}
      style={{
        display: "inline-block",
        color,
        transformOrigin:
          "center bottom",
        cursor: "default",
        willChange:
          "transform, color",
      }}
    >
      {char === " " ? "\u00A0" : char}
    </motion.span>
  ));

return (
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  style={{
    minHeight: "100vh",
    background: "#020604",
    color: "#f8fafc",
    position: "relative",
  }}
>
  <GlobalStyles />

  {/* =====================================================
      INTRO / HERO
  ===================================================== */}
  <section
    ref={heroRef}
    style={{
      height: "180vh",
      position: "relative",
      background:
        "radial-gradient(circle at 54% 44%, rgba(74,222,128,.055), transparent 30%), #020604",
      overflow: "hidden",
    }}
  >
    <div
      className="grid-background"
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        minHeight: 720,
        overflow: "hidden",
      }}
    >
      {/* Subtle ambient glow */}
      <div
        className="ambient-glow"
        style={{
          width: 620,
          height: 620,
          top: "8%",
          left: "27%",
          opacity: 0.8,
        }}
      />

      {/* Top brand */}
      <nav
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "28px 5.5vw",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          zIndex: 30,
        }}
      >
        <div>
          <div
            style={{
              fontFamily:
                "Georgia, 'Times New Roman', serif",
              fontSize: 21,
              letterSpacing: "-.02em",
            }}
          >
            SENTINEL
          </div>

          <div
            style={{
              marginTop: 5,
              color: "#6d7b73",
              fontSize: 9,
              letterSpacing: ".16em",
            }}
          >
            AI-POWERED CONSERVATION
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingTop: 2,
            color: "#4ade80",
            fontSize: 10,
            letterSpacing: ".12em",
          }}
        >
          <span
            className="status-dot"
            style={{
              background: "#4ade80",
              boxShadow:
                "0 0 12px #4ade80",
            }}
          />
          WILDLIFE SENTINEL
        </div>
      </nav>

      {/* Hero typography */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 4,
          pointerEvents: "none",
        }}
      >
        <div
          ref={firstTitleRef}
          style={{
            position: "absolute",
            top: "16vh",
            left: "18vw",
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize:
              "clamp(58px, 8.6vw, 128px)",
            lineHeight: 0.9,
            letterSpacing: "-.055em",
            whiteSpace: "nowrap",
            willChange:
              "transform, opacity",
          }}
        >
          WILDLIFE,
        </div>

        <div
          ref={secondTitleRef}
          style={{
            position: "absolute",
            top: "30vh",
            left: "41vw",
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize:
              "clamp(58px, 8.6vw, 128px)",
            lineHeight: 0.9,
            letterSpacing: "-.055em",
            color: "#4ade80",
            whiteSpace: "nowrap",
            willChange:
              "transform, opacity",
          }}
        >
          UNFILTERED.
        </div>
      </div>

      {/* Rhino */}
      <div
        ref={rhinoRef}
        style={{
          position: "absolute",
          zIndex: 8,
          left: "7vw",
          top: "31vh",
          width:
            "clamp(300px, 34vw, 495px)",
          willChange:
            "transform, filter, opacity",
          transformOrigin:
            "center center",
        }}
      >
        {/* Soft halo keeps the Rhino visually anchored
            and prevents it from disappearing into the dark UI. */}
        <div
          style={{
            position: "absolute",
            width: "74%",
            height: "74%",
            left: "13%",
            top: "13%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(74,222,128,.11) 0%, rgba(74,222,128,.045) 34%, transparent 72%)",
            filter: "blur(22px)",
            zIndex: -1,
            pointerEvents: "none",
          }}
        />

        <img
          src={rhinoIntro}
          alt="Rhinoceros"
          draggable="false"
          loading="eager"
          style={{
            width: "100%",
            display: "block",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />

        {/* Sensor callout — camera */}
        <div
          ref={sensorCameraRef}
          style={{
            position:
              "absolute",
            left: "-3%",
            top: "-10%",
            width: 245,
            height: 145,
            willChange:
              "transform, opacity",
          }}
        >
          <div
            style={{
              position:
                "absolute",
              left: 0,
              top: 0,
              width: 47,
              height: 47,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "#0b2d1d",
              border:
                "1px solid rgba(74,222,128,.32)",
              boxShadow:
                "0 0 35px rgba(74,222,128,.08)",
              color: "#4ade80",
              fontSize: 18,
            }}
          >
            ▣
          </div>

          <div
            style={{
              position:
                "absolute",
              left: 39,
              top: 39,
              width: 155,
              borderTop:
                "1px dotted rgba(248,250,252,.55)",
              transform:
                "rotate(18deg)",
              transformOrigin:
                "left center",
            }}
          />

          <div
            style={{
              position:
                "absolute",
              left: 94,
              top: 86,
              color: "#64748b",
              fontSize: 9,
              letterSpacing: ".14em",
            }}
          >
            CAMERA NODE 03
          </div>
        </div>

        {/* Sensor callout — audio */}
        <div
          ref={sensorAudioRef}
          style={{
            position:
              "absolute",
            left: "-8%",
            bottom: "-11%",
            width: 245,
            height: 125,
            willChange:
              "transform, opacity",
          }}
        >
          <div
            style={{
              position:
                "absolute",
              left: 0,
              bottom: 0,
              width: 47,
              height: 47,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "#0b2d1d",
              border:
                "1px solid rgba(74,222,128,.32)",
              color: "#4ade80",
              fontSize: 15,
              letterSpacing: "-2px",
            }}
          >
            )))
          </div>

          <div
            style={{
              position:
                "absolute",
              left: 38,
              bottom: 22,
              width: 160,
              borderTop:
                "1px dotted rgba(248,250,252,.55)",
              transform:
                "rotate(-20deg)",
              transformOrigin:
                "left center",
            }}
          />

          <div
            style={{
              position:
                "absolute",
              left: 91,
              bottom: 82,
              color: "#64748b",
              fontSize: 9,
              letterSpacing: ".14em",
            }}
          >
            ACOUSTIC NODE 02
          </div>
        </div>

        {/* Detection labels */}
        <div
          style={{
            position:
              "absolute",
            left: "19%",
            top: "40%",
            display: "flex",
            flexDirection:
              "column",
            gap: 7,
          }}
        >
          {[
            ["ILLUSTRATIVE SPECIES", "#4ade80"],
            ["RHINOCEROS", "#f8fafc"],
            ["ILLUSTRATIVE PREVIEW", "#4ade80"],
          ].map(
            ([label, color], index) => (
              <span
                key={label}
                style={{
                  width: "max-content",
                  padding:
                    "6px 10px",
                  borderRadius: 999,
                  background:
                    "rgba(5,16,10,.78)",
                  border:
                    "1px solid rgba(74,222,128,.22)",
                  color,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  marginLeft:
                    index === 1
                      ? 17
                      : 0,
                  backdropFilter:
                    "blur(8px)",
                }}
              >
                {label}
              </span>
            )
          )}
        </div>
      </div>

      {/* Right-side copy */}
      <div
        ref={copyRef}
        style={{
          position:
            "absolute",
          zIndex: 10,
          left: "57%",
          top: "54%",
          width:
            "min(410px, 34vw)",
          willChange:
            "transform, opacity",
        }}
      >
        <div
          style={{
            color: "#4ade80",
            fontSize: 9,
            letterSpacing: ".18em",
            marginBottom: 15,
          }}
        >
          ILLUSTRATIVE WILDLIFE PREVIEW
        </div>

        <p
          style={{
            margin: 0,
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize:
              "clamp(18px, 1.7vw, 24px)",
            lineHeight: 1.42,
            color: "#f8fafc",
          }}
        >
          Real-time intelligence for the world's most vulnerable
          ecosystems.
        </p>

        <button
          onClick={onEnter}
          style={{
            marginTop: 24,
            display:
              "inline-flex",
            alignItems:
              "center",
            gap: 10,
            padding:
              "12px 19px",
            borderRadius: 999,
            border:
              "1px solid rgba(255,255,255,.12)",
            background: "#f8fafc",
            color: "#020604",
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize: 15,
            cursor: "pointer",
            boxShadow:
              "0 15px 45px rgba(0,0,0,.18)",
          }}
        >
          Enter Sentinel
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Bottom scroll cue */}
      <div
        style={{
          position:
            "absolute",
          left: "50%",
          bottom: 25,
          transform:
            "translateX(-50%)",
          zIndex: 20,
          color: "#56615b",
          fontSize: 9,
          letterSpacing: ".2em",
          whiteSpace: "nowrap",
        }}
      >
        SCROLL TO EXPLORE
        <span
          style={{
            marginLeft: 9,
            color: "#4ade80",
          }}
        >
          ↓
        </span>
      </div>

      {/* Tiny coordinate marker */}
      <div
        style={{
          position:
            "absolute",
          right: 32,
          bottom: 24,
          zIndex: 20,
          color: "#3e4944",
          fontSize: 8,
          letterSpacing: ".1em",
          textAlign: "right",
        }}
      >
        RESERVE 04
        <br />
        12.9698° N / 79.1559° E
      </div>
    </div>
  </section>

  {/* =====================================================
      PROTECT STATEMENT
  ===================================================== */}
  <section
    ref={protectRef}
    style={{
      height: "165vh",
      position: "relative",
      background: "#010503",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        minHeight: 720,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Fine atmospheric rings */}
      <div
        ref={protectGlowRef}
        style={{
          position: "absolute",
          width: "68vw",
          height: "68vw",
          maxWidth: 960,
          maxHeight: 960,
          borderRadius: "50%",
          border:
            "1px solid rgba(74,222,128,.07)",
          boxShadow:
            "0 0 120px rgba(74,222,128,.035)",
        }}
      />

      <div
        style={{
          position: "absolute",
          width: "42vw",
          height: "42vw",
          maxWidth: 620,
          maxHeight: 620,
          borderRadius: "50%",
          border:
            "1px solid rgba(255,255,255,.035)",
        }}
      />

      {/* Statement */}
      <div
        ref={protectTitleRef}
        style={{
          position: "relative",
          zIndex: 5,
          width: "min(1100px, 88vw)",
          textAlign: "center",
          willChange:
            "transform, opacity",
          transform:
            "translate3d(0, 90px, 0) scale(.78)",
          opacity: 0.18,
        }}
      >
        {protectLines.map(
          ({ text, color }) => (
            <div
              key={text}
              style={{
                display: "flex",
                justifyContent:
                  "center",
                alignItems:
                  "center",
                lineHeight: 0.82,
                letterSpacing:
                  "-.065em",
                fontSize:
                  "clamp(64px, 10.3vw, 165px)",
                fontWeight: 800,
                whiteSpace: "nowrap",
                overflow: "visible",
              }}
            >
              {interactiveWord(
                text,
                color
              )}
            </div>
          )
        )}
      </div>

      {/* Supporting copy */}
      <div
        ref={protectCopyRef}
        style={{
          position: "absolute",
          left: "50%",
          bottom: "9vh",
          transform:
            "translate3d(-50%, 70px, 0)",
          opacity: 0,
          width: "min(760px, 82vw)",
          textAlign: "center",
          zIndex: 8,
          willChange:
            "transform, opacity",
        }}
      >
        <div
          style={{
            color: "#4ade80",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: ".2em",
            marginBottom: 12,
          }}
        >
          SENTINEL / FIELD INTELLIGENCE
        </div>

        <p
          style={{
            margin: 0,
            color:
              "rgba(248,250,252,.82)",
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize:
              "clamp(16px, 1.45vw, 21px)",
            lineHeight: 1.5,
            maxWidth: 720,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Every signal becomes another layer of protection
          for the species that cannot speak for themselves.
        </p>

        <div
          style={{
            marginTop: 18,
            color: "#47534c",
            fontSize: 8,
            letterSpacing: ".18em",
          }}
        >
          KEEP SCROLLING ↓
        </div>
      </div>
    </div>
  </section>

  {/* =====================================================
      BIODIVERSITY
  ===================================================== */}
  <section
    ref={reserveRef}
    style={{
      padding: "110px 8vw 130px",
      background:
        "linear-gradient(180deg, #030a06 0%, #020604 100%)",
    }}
  >
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{
          once: true,
          margin: "-100px",
        }}
      >
        <div
          style={{
            color: "#4ade80",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".2em",
          }}
        >
          SPECIES INTELLIGENCE
        </div>

        <h2
          style={{
            margin:
              "12px 0 10px",
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontWeight: 500,
            fontSize:
              "clamp(40px, 5vw, 68px)",
            letterSpacing: "-.045em",
          }}
        >
          Biodiversity Detected
        </h2>

        <p
          style={{
            maxWidth: 650,
            margin: 0,
            color: COLORS.muted,
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          {speciesList.length ? "Recorded detections describe the" : "No analytics data available for the"}
          reserve — species, confidence and sensor provenance in one layer.
        </p>
      </motion.div>

      <div
        style={{
          marginTop: 48,
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {speciesList.map(
          ([species, count], index) => (
            <motion.div
              key={species}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{
                once: true,
              }}
              transition={{
                delay: index * 0.06,
              }}
              className="glass-panel"
              style={{
                minHeight: 150,
                padding: 22,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position:
                    "absolute",
                  right: -8,
                  top: -16,
                  fontSize: 78,
                  color: "#4ade80",
                  opacity: 0.035,
                }}
              >
                ◌
              </div>

              <div
                style={{
                  color:
                    COLORS.dim,
                  fontSize: 9,
                  letterSpacing: ".13em",
                }}
              >
                DETECTION{" "}
                {String(
                  index + 1
                ).padStart(2, "0")}
              </div>

              <div
                style={{
                  marginTop: 22,
                  fontSize: 18,
                  fontWeight: 700,
                  textTransform:
                    "capitalize",
                }}
              >
                {species}
              </div>

              <div
                style={{
                  marginTop: 8,
                  color: "#4ade80",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ✓ {count} sightings logged
              </div>
            </motion.div>
          )
        )}
      </div>
    </div>
  </section>
</motion.div>
);
}

/* =========================================================
CAMERA FEED
========================================================= */

