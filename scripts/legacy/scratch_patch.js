const fs = require('fs');

const code = fs.readFileSync('/Users/rahulr/Desktop/f1manager/screens/myDrivers.tsx', 'utf8');

const newComponent = `
const ResponsiveAccordionSection = ({ title, children, gridColumn, defaultOpen = false }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div style={{ ...glassCard({ padding: 0 }), gridColumn, display: 'flex', flexDirection: 'column' }}>
      <div className="section-header-desktop" style={{ padding: '24px 24px 0', borderBottom: 'none' }}>
        <h3 style={{ fontSize: '14px', color: '#fff', fontFamily: HUB.fontBold, textTransform: 'uppercase', margin: 0 }}>{title}</h3>
      </div>
      <button 
        className="section-header-mobile"
        onClick={() => setIsOpen(!isOpen)}
        style={{ width: '100%', padding: '20px 24px', background: 'transparent', border: 'none', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', color: '#fff', fontSize: '14px', fontFamily: HUB.fontBold, textTransform: 'uppercase' }}
      >
        {title}
        <span style={{ fontSize: '16px', color: HUB.textMuted }}>{isOpen ? '−' : '+'}</span>
      </button>
      <div className={\`section-content \${isOpen ? 'is-open' : ''}\`} style={{ padding: '24px', flex: 1 }}>
        {children}
      </div>
    </div>
  );
};
`;

let replaced = code.replace(
  "ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTitle, Tooltip, Legend, Filler);",
  "ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTitle, Tooltip, Legend, Filler);\n" + newComponent
);

replaced = replaced.replace(
  /<div style={{ gridColumn: 'span 4', ...glassCard\({ padding: '24px' }\), display: 'flex', flexDirection: 'column' }}>[\s\S]*?<h3.*?Car Extraction Index<\/h3>/g,
  `<ResponsiveAccordionSection title="Car Extraction Index" gridColumn="span 4" defaultOpen={true}>\n            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>`
).replace(
  /<\/div>\s*<\/div>\s*<\/div>\s*\{\/\* --- SECTION 2: SEASON PERFORMANCE ---\s*\*\/\}/,
  `</div>\n            </div>\n          </ResponsiveAccordionSection>\n\n          {/* --- SECTION 2: SEASON PERFORMANCE --- */}`
);

// We need to carefully replace the wrappers
fs.writeFileSync('/Users/rahulr/Desktop/f1manager/screens/myDrivers.tsx', replaced);
