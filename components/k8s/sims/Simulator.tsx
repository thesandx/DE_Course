import { AutoscaleSim } from '@/components/k8s/sims/AutoscaleSim';
import { LoopSim } from '@/components/k8s/sims/LoopSim';
import { NetpolSim } from '@/components/k8s/sims/NetpolSim';
import { ProbesSim } from '@/components/k8s/sims/ProbesSim';
import { RbacSim } from '@/components/k8s/sims/RbacSim';
import { ResourcesSim } from '@/components/k8s/sims/ResourcesSim';
import { RolloutSim } from '@/components/k8s/sims/RolloutSim';
import { SelectorSim } from '@/components/k8s/sims/SelectorSim';
import type { SimId } from '@/types/k8s';

const SIMULATORS: Readonly<Record<SimId, () => React.ReactNode>> = {
  loop: LoopSim,
  rollout: RolloutSim,
  selector: SelectorSim,
  probes: ProbesSim,
  resources: ResourcesSim,
  autoscale: AutoscaleSim,
  rbac: RbacSim,
  netpol: NetpolSim,
};

export interface SimulatorProps {
  id: SimId;
}

/** The interactive model of a lesson, picked by the `sim` field of the lesson. */
export function Simulator({ id }: SimulatorProps) {
  const Component = SIMULATORS[id];
  return <Component />;
}
