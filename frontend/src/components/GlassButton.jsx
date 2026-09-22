export default function GlassButton({
children,
onClick,
active = false,
danger = false,
success = false,
disabled = false,
icon,
style = {},
}) {
return (
<button
disabled={disabled}
onClick={onClick}
style={{
display: "inline-flex",
alignItems: "center",
justifyContent: "center",
gap: 8,
padding: "10px 14px",
borderRadius: 9,
border: `1px solid ${
  danger
    ? "rgba(239,68,68,0.35)"
    : active
    ? "rgba(74,222,128,0.45)"
    : "rgba(255,255,255,0.08)"
}`,
background: danger
? "rgba(239,68,68,0.08)"
: success
? "rgba(74,222,128,0.12)"
: active
? "rgba(74,222,128,0.10)"
: "rgba(255,255,255,0.045)",
color: danger ? "#f87171" : success ? "#4ade80" : "#fff",
cursor: disabled ? "not-allowed" : "pointer",
opacity: disabled ? 0.55 : 1,
fontSize: 13,
fontWeight: 600,
transition: "all .2s ease",
...style,
}}
>
{icon}
{children}
</button>
);
}
