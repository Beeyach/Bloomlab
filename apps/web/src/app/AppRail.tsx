import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';

import {
  IconBolt,
  IconChevronLeft,
  IconChevronRight,
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
  IconReceipt,
  IconSandbox,
  IconSearch,
  VisuallyHidden,
  cx,
  type IconProps,
} from '@bloomlab/design-system';

import { NavigationHint } from './NavigationHint';
import { useFeatureFlags } from './featureFlagsContext';
import styles from './AppRail.module.css';

interface Area {
  to: string;
  label: string;
  icon: (props: IconProps) => React.JSX.Element;
  end?: boolean;
}

/** Current destinations only. Desktop groups learning, Labs and client work; phones keep
 * Home/Campaign/Skill Map/Workflow plus More regardless of desktop ordering. */
const AREAS: Area[] = [
  { to: '/', label: 'Home', icon: IconHome, end: true },
  { to: '/campaign', label: 'Campaign', icon: IconCampaign },
  { to: '/skills', label: 'Skill Map', icon: IconMap },
  { to: '/search', label: 'Search', icon: IconSearch },
  { to: '/workflow', label: 'Workflow', icon: IconBolt },
  { to: '/crm', label: 'CRM', icon: IconRecords },
  { to: '/funnel', label: 'Funnel', icon: IconFunnel },
  { to: '/calendar', label: 'Calendar', icon: IconCalendar },
  { to: '/conversations', label: 'Inbox', icon: IconChat },
  { to: '/reporting', label: 'Reporting', icon: IconReport },
  { to: '/payments', label: 'Payments', icon: IconReceipt },
  { to: '/incident', label: 'Incidents', icon: IconIncident },
  { to: '/clients', label: 'Clients', icon: IconRecords },
  { to: '/portfolio', label: 'Portfolio', icon: IconRecords },
  { to: '/playground', label: 'Playground', icon: IconSandbox },
];

/** How many areas the phone bar shows beside More; the rest live in the More list. */
const PHONE_PRIMARY = ['/', '/campaign', '/skills', '/workflow'];
const GROUP_STARTS = ['/workflow', '/clients', '/playground'];

const DEVELOPER: Area[] = [
  { to: '/system', label: 'System', icon: IconInfo },
  { to: '/design', label: 'Design', icon: IconMore },
];

function Item({
  area,
  className,
  onNavigate,
  collapsed = false,
}: {
  area: Area;
  className?: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const Icon = area.icon;
  return (
    <li className={className}>
      <NavigationHint label={area.label} enabled={collapsed}>
        <NavLink
          aria-label={area.label}
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
      </NavigationHint>
    </li>
  );
}

export function AppRail({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const flags = useFeatureFlags();
  const location = useLocation();
  const menuId = useId();
  const destinationsId = useId();
  const nav = useRef<HTMLElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
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
  const more = [...AREAS.filter((area) => !PHONE_PRIMARY.includes(area.to)), ...developer];
  const moreActive = more.some((area) =>
    area.end ? location.pathname === area.to : location.pathname.startsWith(area.to),
  );

  // Light dismiss: Escape, or a press anywhere outside the rail.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenFor(null);
        moreButton.current?.focus();
      }
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
      <div className={styles.header}>
        <span className={styles.brand} aria-hidden="true">
          {collapsed ? 'B' : 'Bloomlab'}
        </span>
        <NavigationHint
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          enabled={collapsed}
        >
          <button
            type="button"
            className={styles.toggle}
            data-testid="rail-toggle"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-controls={destinationsId}
            onClick={onToggle}
          >
            {collapsed ? <IconChevronRight size={20} /> : <IconChevronLeft size={20} />}
          </button>
        </NavigationHint>
      </div>
      <VisuallyHidden>Bloomlab</VisuallyHidden>
      <div id={destinationsId} className={styles.destinations} data-testid="rail-destinations">
        <ul className={styles.list}>
          {AREAS.map((area) => (
            <Item
              key={area.to}
              area={area}
              collapsed={collapsed}
              className={cx(
                !PHONE_PRIMARY.includes(area.to) && styles.secondary,
                GROUP_STARTS.includes(area.to) && styles.groupStart,
              )}
            />
          ))}
          <li className={styles.moreItem}>
            <button
              ref={moreButton}
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
              <Item key={area.to} area={area} collapsed={collapsed} />
            ))}
          </ul>
        )}
      </div>
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
