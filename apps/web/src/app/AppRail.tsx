import { NavLink } from 'react-router';

import {
  IconBolt,
  IconCampaign,
  IconHome,
  IconInfo,
  IconMap,
  IconRecords,
  VisuallyHidden,
  cx,
  type IconProps,
} from '@bloomlab/design-system';

import { useFeatureFlags } from './featureFlagsContext';
import styles from './AppRail.module.css';

interface Area {
  to: string;
  label: string;
  icon: (props: IconProps) => React.JSX.Element;
  end?: boolean;
}

/**
 * The compact rail (spec §73, DES-009): the areas that exist today. Simulator, Clients,
 * Portfolio and Playground join it with their phases — nothing inert stands in for them.
 */
const AREAS: Area[] = [
  { to: '/', label: 'Home', icon: IconHome, end: true },
  { to: '/campaign', label: 'Campaign', icon: IconCampaign },
  { to: '/skills', label: 'Skill Map', icon: IconMap },
  { to: '/crm', label: 'CRM', icon: IconRecords },
];

const DEVELOPER: Area[] = [
  { to: '/system', label: 'System', icon: IconInfo },
  { to: '/design', label: 'Design', icon: IconBolt },
];

function Item({ area }: { area: Area }) {
  const Icon = area.icon;
  return (
    <li>
      <NavLink
        to={area.to}
        end={area.end}
        className={({ isActive }) => cx(styles.item, isActive && styles.active)}
      >
        <span className={styles.glyph} aria-hidden="true">
          <Icon size={20} />
        </span>
        <span className={styles.label}>{area.label}</span>
      </NavLink>
    </li>
  );
}

export function AppRail() {
  const flags = useFeatureFlags();
  const developer = DEVELOPER.filter(
    (area) =>
      (area.to === '/system' && flags.system_diagnostics) ||
      (area.to === '/design' && flags.design_gallery),
  );
  return (
    <nav className={styles.rail} aria-label="Primary">
      <span className={styles.brand} aria-hidden="true">
        Bloomlab
      </span>
      <VisuallyHidden>Bloomlab</VisuallyHidden>
      <ul className={styles.list}>
        {AREAS.map((area) => (
          <Item key={area.to} area={area} />
        ))}
      </ul>
      {developer.length > 0 && (
        <ul className={cx(styles.list, styles.developer)} aria-label="Developer surfaces">
          {developer.map((area) => (
            <Item key={area.to} area={area} />
          ))}
        </ul>
      )}
    </nav>
  );
}
