import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TERRITORIES } from '@bloomlab/content-schema';
import { EXERCISE_TYPES } from '@bloomlab/exercise-engine';
import { ASSISTANCE_LEVELS, MASTERY_STATES } from '@bloomlab/mastery-engine';

import { CallParticipant } from './CallParticipant';
import { ContactRow } from './ContactRow';
import {
  ASSISTANCE_LABELS,
  EXERCISE_LABELS,
  hashString,
  MASTERY_LABELS,
  TERRITORY_LABELS,
} from './domain';
import { ExercisePrompt } from './ExercisePrompt';
import { IdentityMark } from './IdentityMark';
import { MasteryBadge } from './MasteryBadge';
import { PricingScopeItem } from './PricingScopeItem';
import { SkillCard } from './SkillCard';
import { WorkflowNode } from './WorkflowNode';

describe('domain vocabulary stays in sync with the engines', () => {
  it('mastery states', () => {
    expect(Object.keys(MASTERY_LABELS).sort()).toEqual([...MASTERY_STATES].sort());
  });
  it('territories', () => {
    expect(Object.keys(TERRITORY_LABELS).sort()).toEqual([...TERRITORIES].sort());
  });
  it('exercise families', () => {
    expect(Object.keys(EXERCISE_LABELS).sort()).toEqual([...EXERCISE_TYPES].sort());
  });
  it('assistance levels', () => {
    expect(Object.keys(ASSISTANCE_LABELS).sort()).toEqual([...ASSISTANCE_LEVELS].sort());
  });
});

describe('MasteryBadge', () => {
  it('spells out every state in text (A11Y-005) using spec §159 words', () => {
    for (const state of MASTERY_STATES) {
      const { unmount } = render(<MasteryBadge state={state} />);
      expect(screen.getByText(MASTERY_LABELS[state])).toBeInTheDocument();
      unmount();
    }
    expect(MASTERY_LABELS.NEEDS_REFRESH).toBe('Needs refresh');
  });
});

describe('SkillCard', () => {
  it('escalates material with mastery (spec §75)', () => {
    const material = () =>
      screen.getByRole('button', { name: /Wait/ }).querySelector('[data-variant]');
    const { rerender } = render(<SkillCard title="Wait" territory="AUTOMATE" state="LEARNING" />);
    expect(material()).toBeNull();
    rerender(<SkillCard title="Wait" territory="AUTOMATE" state="INDEPENDENT" />);
    expect(material()).toHaveAttribute('data-variant', 'soft');
    rerender(<SkillCard title="Wait" territory="AUTOMATE" state="MASTERED" />);
    expect(material()).toHaveAttribute('data-variant', 'mastery');
  });

  it('is keyboard operable', async () => {
    const onClick = vi.fn();
    render(<SkillCard title="Wait" territory="AUTOMATE" state="PRACTICED" onClick={onClick} />);
    screen.getByRole('button', { name: /Wait/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalled();
  });
});

describe('WorkflowNode', () => {
  it('shows status as text and labels approximations', () => {
    render(
      <WorkflowNode
        kind="wait"
        name="Wait"
        config="1 day before appointment"
        status="waiting"
        approximation
      />,
    );
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('Training approximation')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('ContactRow', () => {
  it('spells out missing channels and truncates tags with a count', () => {
    render(
      <ContactRow
        name="Maria Alvarez"
        hasPhone={false}
        hasEmail
        tags={['Lead', 'Booked', 'VIP', 'Referral']}
      />,
    );
    expect(screen.getByText('No phone')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByLabelText('Tags: Lead, Booked, VIP, Referral')).toBeInTheDocument();
  });
});

describe('PricingScopeItem', () => {
  it('toggles inclusion through a labelled checkbox and shows consequences when excluded', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PricingScopeItem
        name="No-show recovery"
        priceImpact={450}
        included
        onIncludedChange={onChange}
        dependency="reminders stop escalating"
      />,
    );
    await userEvent.click(screen.getByLabelText(/No-show recovery/));
    expect(onChange).toHaveBeenCalledWith(false);
    expect(screen.getByText('$450')).toBeInTheDocument();
    rerender(
      <PricingScopeItem
        name="No-show recovery"
        priceImpact={450}
        included={false}
        dependency="reminders stop escalating"
      />,
    );
    expect(screen.getByText(/Removing this: reminders stop escalating/)).toBeInTheDocument();
    expect(screen.getByText('Excluded')).toBeInTheDocument();
  });

  it('hides economics until submit when priceImpact is null', () => {
    render(<PricingScopeItem name="Calendar" priceImpact={null} included locked />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByLabelText(/Calendar/)).toBeDisabled();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});

describe('ExercisePrompt', () => {
  it('uses the spec family name and the no-hints line', () => {
    render(
      <ExercisePrompt family="FIX_IT" title="Two reminders" noHints skills={['Wait', 'If/Else']}>
        <p>Maria received two reminders. She should have received one.</p>
      </ExercisePrompt>,
    );
    expect(screen.getByText('Fix It')).toBeInTheDocument();
    expect(screen.getByText('No hints this time.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Fix It: Two reminders' })).toBeInTheDocument();
  });
});

describe('CallParticipant', () => {
  it('conveys audio state in text', () => {
    render(
      <CallParticipant
        name="Dana Whitfield"
        company="GlowHaus Med Spa"
        audio="muted"
        elapsed="04:12"
      />,
    );
    expect(screen.getByText('Muted')).toBeInTheDocument();
    expect(screen.getByText('04:12')).toBeInTheDocument();
  });
});

describe('IdentityMark', () => {
  it('is deterministic per seed and hidden from assistive tech', () => {
    expect(hashString('GlowHaus')).toBe(hashString('GlowHaus'));
    expect(hashString('GlowHaus')).not.toBe(hashString('Glowhaus'));
    const { container } = render(<IdentityMark seed="GlowHaus" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
