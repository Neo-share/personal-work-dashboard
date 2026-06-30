import type { SalesPipelineStage } from '@project-manager/shared';
import { Tag } from 'antd';
import { getSalesPipelineStageLabel } from '../../utils/labels';

const STAGE_COLORS: Partial<Record<SalesPipelineStage, string>> = {
  lead: 'default',
  qualifying: 'processing',
  kyc: 'cyan',
  suitability: 'blue',
  proposal: 'geekblue',
  application: 'purple',
  review: 'orange',
  signing: 'gold',
  closed_won: 'success',
  servicing: 'green',
  closed_lost: 'error',
};

export default function PipelineStageTag({ stage }: { stage: SalesPipelineStage }) {
  return <Tag color={STAGE_COLORS[stage] ?? 'default'}>{getSalesPipelineStageLabel(stage)}</Tag>;
}
