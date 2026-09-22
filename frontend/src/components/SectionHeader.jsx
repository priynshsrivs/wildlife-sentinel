import { COLORS } from "../constants/theme";
export default function SectionHeader({ title, subtitle, icon }) {
return (
<div
style={{
display: "flex",
alignItems: "flex-start",
justifyContent: "space-between",
gap: 20,
marginBottom: 22,
}}
>
<div>
<div
style={{
display: "flex",
alignItems: "center",
gap: 9,
marginBottom: 6,
}}
>
{icon}
<h2
style={{
margin: 0,
fontSize: 19,
fontWeight: 700,
}}
>
{title}
</h2>
</div>

    {subtitle && (
      <p
        style={{
          margin: 0,
          color: COLORS.muted,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {subtitle}
      </p>
    )}
  </div>
</div>

);
}

