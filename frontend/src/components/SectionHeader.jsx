export default function SectionHeader({ title, subtitle, icon, action }) {
  return (
    <div className="section-header">
      <div className="section-header-row">
        <div>
          <div className="section-heading">
            {icon && <span className="section-icon">{icon}</span>}
            <h2>{title}</h2>
          </div>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
