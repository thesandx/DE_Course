'use client';

import { useState } from 'react';

import { InlineText } from '@/components/course/InlineText';
import { CodeBlock } from '@/components/gcp/CodeBlock';
import { Segmented } from '@/components/k8s/sims/SimControls';
import { SIM_TONE, SimFrame, SimVerdict } from '@/components/k8s/sims/SimFrame';
import { Select } from '@/components/ui/Select';
import {
  API_GROUPS,
  type ApiGroup,
  type BindingKind,
  isSetupValid,
  missionRows,
  RBAC_MISSIONS,
  RBAC_RESOURCES,
  RBAC_VERBS,
  type RbacRule,
  rbacYaml,
  type RoleKind,
  START_RBAC,
  toggled,
} from '@/lib/course/k8s/sims/rbac';
import { cn } from '@/lib/utils';

const MISSIONS = RBAC_MISSIONS.map((mission, index) => ({
  value: String(index),
  label: `${index + 1}. ${mission.name}`,
}));

const KINDS = [
  { value: 'Role', label: 'Role (team-a)' },
  { value: 'ClusterRole', label: 'ClusterRole' },
] as const;

const BINDINGS = [
  { value: 'RoleBinding', label: 'RoleBinding (team-a)' },
  { value: 'ClusterRoleBinding', label: 'ClusterRoleBinding' },
] as const;

interface TogglesProps<T extends string> {
  label: string;
  all: readonly T[];
  on: readonly T[];
  onToggle: (value: T) => void;
}

function Toggles<T extends string>({ label, all, on, onToggle }: TogglesProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-micro text-ink-soft font-semibold">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {all.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={on.includes(value)}
            onClick={() => onToggle(value)}
            className={cn(
              'rounded-pill text-small min-h-11 border px-3 font-mono',
              on.includes(value)
                ? 'bg-ink text-on-ink border-ink'
                : 'bg-surface border-line text-ink-soft hover:text-ink',
            )}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The RBAC puzzle: three missions. The learner builds a role and a binding
 * until every «kubectl auth can-i» check gives the answer the mission needs,
 * and no more than that.
 */
export function RbacSim() {
  const [missionIndex, setMissionIndex] = useState('0');
  const [setup, setSetup] = useState(START_RBAC);
  const mission = RBAC_MISSIONS[Number(missionIndex)] ?? RBAC_MISSIONS[0];
  if (mission === undefined) return null;

  const rows = missionRows(setup, mission);
  const passed = rows.filter((row) => row.expected === row.actual).length;
  const valid = isSetupValid(setup);
  const solved = valid && passed === rows.length;

  const setRule = (index: number, change: Partial<RbacRule>): void =>
    setSetup({
      ...setup,
      rules: setup.rules.map((rule, at) => (at === index ? { ...rule, ...change } : rule)),
    });

  return (
    <SimFrame
      title="RBAC puzzle"
      intro="Build a role and a binding that give each identity exactly what it needs."
    >
      <Segmented
        label="Mission"
        options={MISSIONS}
        value={missionIndex}
        onChange={setMissionIndex}
      />
      <p className="text-body">
        <InlineText text={mission.brief} />
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented<RoleKind>
          label="Role kind"
          options={KINDS}
          value={setup.kind}
          onChange={(kind) => setSetup({ ...setup, kind })}
        />
        <Segmented<BindingKind>
          label="Binding"
          options={BINDINGS}
          value={setup.binding}
          onChange={(binding) => setSetup({ ...setup, binding })}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {setup.rules.map((rule, index) => (
          <fieldset
            key={index}
            className="border-line rounded-input flex min-w-0 flex-col gap-3 border p-3"
          >
            <legend className="text-small px-1 font-semibold">Rule {index + 1}</legend>
            <Select
              label="apiGroups"
              value={rule.group}
              options={API_GROUPS}
              onChange={(event) => setRule(index, { group: event.target.value as ApiGroup })}
            />
            <Toggles
              label="resources"
              all={RBAC_RESOURCES}
              on={rule.resources}
              onToggle={(value) =>
                setRule(index, { resources: toggled(rule.resources, value, RBAC_RESOURCES) })
              }
            />
            <Toggles
              label="verbs"
              all={RBAC_VERBS}
              on={rule.verbs}
              onToggle={(value) =>
                setRule(index, { verbs: toggled(rule.verbs, value, RBAC_VERBS) })
              }
            />
          </fieldset>
        ))}
      </div>

      <CodeBlock label="rbac.yaml" code={rbacYaml(setup)} />

      <div className="border-line rounded-input overflow-x-auto border">
        <table className="text-small w-full text-left">
          <thead className="bg-sunken text-ink-soft">
            <tr>
              <th scope="col" className="p-2.5 font-semibold">
                kubectl auth can-i
              </th>
              <th scope="col" className="p-2.5 font-semibold">
                Must be
              </th>
              <th scope="col" className="p-2.5 font-semibold">
                Is
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {rows.map(({ check: [verb, resource, namespace], expected, actual }) => (
              <tr key={`${verb}-${resource}-${namespace}`}>
                <td className="p-2.5 font-mono">
                  {verb} {resource} -n {namespace}
                </td>
                <td className="p-2.5">{expected ? 'yes' : 'no'}</td>
                <td className="p-2.5">
                  <span
                    className={cn(
                      'rounded-pill px-2.5 py-0.5 font-semibold',
                      SIM_TONE[expected === actual ? 'ok' : 'no'],
                    )}
                  >
                    {actual ? 'yes' : 'no'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {valid ? (
        <SimVerdict
          tone={solved ? 'ok' : 'meh'}
          headline={`${passed} of ${rows.length} checks`}
          text={
            solved
              ? 'Exactly the access the mission needs: least privilege.'
              : 'Change the rules or the binding until each row has the answer it must have.'
          }
        />
      ) : (
        <SimVerdict
          tone="no"
          headline="Not valid"
          text="A **ClusterRoleBinding** can name only a **ClusterRole**."
        />
      )}
    </SimFrame>
  );
}
