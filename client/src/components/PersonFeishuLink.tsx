import type { Person } from '@project-manager/shared';
import { Tooltip } from 'antd';
import { openFeishuChat, resolveFeishuOpenId } from '../utils/feishu';

interface PersonFeishuLinkProps {
  person: Pick<Person, 'name' | 'feishuOpenId' | 'contact'>;
  className?: string;
}

export function PersonFeishuLink({ person, className }: PersonFeishuLinkProps) {
  const openId = resolveFeishuOpenId(person);
  const canOpen = Boolean(openId);

  if (!canOpen) {
    return <span className={className}>{person.name}</span>;
  }

  return (
    <Tooltip title="在飞书中打开对话">
      <button
        type="button"
        className={`content-link person-feishu-link${className ? ` ${className}` : ''}`}
        onClick={() => openFeishuChat(person)}
      >
        {person.name}
      </button>
    </Tooltip>
  );
}
