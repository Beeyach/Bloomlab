import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';

import {
  IconBolt,
  IconCalendar,
  IconCampaign,
  IconChat,
  IconIncident,
  IconFunnel,
  IconHome,
  IconInfo,
  IconMap,
  IconMore,
  IconRecords,
  IconReport,
  IconSandbox,
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
 * The compact rail (spec §73, DES-009): the areas that exist today. Clients and Portfolio join
 * it with their phases — nothing inert stands in for them.
 *
 * Tablet and desktop: one labelled column of every area, drawn from `--bl-size-rail`. Phones: a
 * bottom bar of the first four areas, each with its name showing, plus a labelled **More** that
 * opens the remaining areas as a small labelled list above the bar. Every area keeps its name in
 * every composition; nothing is icon-only, nothing is dropped, and the developer surfaces (flag
 * gated) sit in the same list on phones.
 */
const AREAS: Area[] = [
  { to: '/', label: 'Home', icon: IconHome, end: true },
  { to: '/campaign', label: 'Campaign', icon: IconCampaign },
  { to: '/skills', label: 'Skill Map', icon: IconMap },
  { to: '/workflow', label: 'Workflow', icon: IconBolt },
  { to: '/crm', label: 'CRM', icon: IconRecords },
  { to: '/funnel', label: 'Funnel', icon: IconFunnel },
  { to: '/calendar', label: 'Calendar', icon: IconCalendar },
  { to: '/conversations', label: 'Inbox', icon: IconChat },
  { to: '/reporting', label: 'Reporting', icon: IconReport },
  { to: '/incident', label: 'Incidents', icon: IconIncident },
  { to: '/playground', label: 'Playground', icon: IconSandbox },
];

/** How many areas the phone bar shows beside More; the rest live in the More list. */
const PHONE_PRIMARY = 4;

const DEVELOPER: Area[] = [
  { to: '/system', label: 'System', icon: IconInfo },
  { to: '/design', label: 'Design', icon: IconMore },
];

function Item({
  area,
  className,
  onNavigate,
}: {
  area: Area;
  className?: string;
  onNavigate?: () => void;
}) {
  const Icon = area.icon;
  return (
    <li className={className}>
      <NavLink
        to={area.to}
        end={area.end}
        className={({ isActive }) => cx(styles.item, isActive && styles.active)}
        onClick={onNavigate}
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
  const location = useLocation();
  const menuId = useId();
  const nav = useRef<HTMLElement>(null);
  // The More list is open for one page only: navigating anywhere reads as closed, with no effect
  // needed to close it.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === location.pathname;
  const close = () => setOpenFor(null);
  const developer = DEVELOPER.filter(
    (area) =>
      (area.to === '/system' && flags.system_diagnostics) ||
      (area.to === '/design' && flags.design_gallery),
  );
  const more = [...AREAS.slice(PHONE_PRIMARY), ...developer];
  const moreActive = more.some((area) =>
    area.end ? location.pathname === area.to : location.pathname.startsWith(area.to),
  );

  // Light dismiss: Escape, or a press anywhere outside the rail.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenFor(null);
    };
    const onPress = (event: PointerEvent) => {
      if (nav.current && !nav.current.contains(event.target as Node)) setOpenFor(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPress);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress);
    };
  }, [open]);

  return (
    <nav ref={nav} className={styles.rail} aria-label="Primary">
      <span className={styles.brand} aria-hidden="true">
        Bloomlab
      </span>
      <VisuallyHidden>Bloomlab</VisuallyHidden>
      <ul className={styles.list}>
        {AREAS.map((area, index) => (
          <Item
            key={area.to}
            area={area}
            className={index >= PHONE_PRIMARY ? styles.secondary : undefined}
          />
        ))}
        <li className={styles.moreItem}>
          <button
            type="button"
            className={cx(styles.item, moreActive && styles.active)}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpenFor(open ? null : location.pathname)}
            data-testid="rail-more"
          >
            <span className={styles.glyph} aria-hidden="true">
              <IconMore size={20} />
            </span>
            <span className={styles.label}>More</span>
          </button>
        </li>
      </ul>
      {developer.length > 0 && (
        <ul className={cx(styles.list, styles.developer)} aria-label="Developer surfaces">
          {developer.map((area) => (
            <Item key={area.to} area={area} />
          ))}
        </ul>
      )}
      <div id={menuId} className={styles.moreMenu} hidden={!open} data-testid="rail-more-menu">
        <ul className={styles.moreList} aria-label="More areas">
          {more.map((area) => (
            <Item key={area.to} area={area} className={styles.moreEntry} onNavigate={close} />
          ))}
        </ul>
      </div>
    </nav>
  );
}
