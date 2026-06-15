import { Button, Input, Spin, Table, message } from 'antd';
import { useEffect, useState } from 'react';
import { trpc } from '../lib/trpc';

export default function ScanCenterPage() {
  const [workspacePath, setWorkspacePath] = useState('');
  const [ignoreDirsText, setIgnoreDirsText] = useState('');
  const utils = trpc.useUtils();
  const settingsQuery = trpc.settings.getWorkspacePath.useQuery();
  const ignoreDirsQuery = trpc.settings.getIgnoreDirs.useQuery();
  const latestScanQuery = trpc.repositories.latestScan.useQuery();

  useEffect(() => {
    if (settingsQuery.data) {
      setWorkspacePath(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (ignoreDirsQuery.data) {
      setIgnoreDirsText(ignoreDirsQuery.data.join('\n'));
    }
  }, [ignoreDirsQuery.data]);

  const savePathMutation = trpc.settings.setWorkspacePath.useMutation({
    onSuccess: async (result) => {
      message.success('工作区路径已保存');
      setWorkspacePath(result.workspacePath);
      await utils.settings.getWorkspacePath.invalidate();
    },
    onError: () => {
      message.error('保存失败，请检查路径格式');
    },
  });

  const saveIgnoreDirsMutation = trpc.settings.setIgnoreDirs.useMutation({
    onSuccess: async (result) => {
      message.success('忽略目录已保存');
      setIgnoreDirsText(result.dirs.join('\n'));
      await utils.settings.getIgnoreDirs.invalidate();
    },
    onError: () => {
      message.error('保存失败');
    },
  });

  const scanMutation = trpc.repositories.scanWorkspace.useMutation({
    onSuccess: async (result) => {
      const failureHint =
        result.failures.length > 0 ? `，${result.failures.length} 个异常仓库` : '';
      message.success(`扫描完成，共识别 ${result.repositoryCount} 个仓库${failureHint}`);
      await utils.repositories.list.invalidate();
      await utils.repositories.latestScan.invalidate();
      await utils.workbench.summary.invalidate();
    },
    onError: () => {
      message.error('扫描失败，请检查工作区路径');
    },
  });

  const saveIgnoreDirs = () => {
    const dirs = ignoreDirsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    saveIgnoreDirsMutation.mutate({ dirs });
  };

  const runScan = () => {
    const path = workspacePath.trim();
    if (!path) {
      message.warning('请先填写工作区路径');
      return;
    }
    scanMutation.mutate({ workspacePath: path });
  };

  if (settingsQuery.isLoading || ignoreDirsQuery.isLoading) {
    return (
      <div className="workbench-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="page-title">工作区扫描</h2>
      <p className="page-desc">
        配置 CodeLab 工作区路径与忽略目录，扫描并同步本地 Git 仓库状态。
      </p>

      <div className="content-card">
        <h3 className="section-title">工作区配置</h3>
        <div className="list-row">
          <div style={{ flex: 1, marginRight: 16 }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>
              工作区路径
            </div>
            <Input
              value={workspacePath}
              onChange={(event) => setWorkspacePath(event.target.value)}
              placeholder="/Users/ningliu/Documents/CodeLab"
            />
          </div>
          <Button
            type="primary"
            loading={savePathMutation.isPending}
            onClick={() => savePathMutation.mutate({ workspacePath: workspacePath.trim() })}
            disabled={!workspacePath.trim()}
          >
            保存路径
          </Button>
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>
            扫描忽略目录（每行一个，匹配工作区一级子目录名）
          </div>
          <Input.TextArea
            rows={4}
            value={ignoreDirsText}
            onChange={(event) => setIgnoreDirsText(event.target.value)}
            placeholder={'node_modules\n.cursor\n.Trash'}
          />
          <div style={{ marginTop: 12 }}>
            <Button
              loading={saveIgnoreDirsMutation.isPending}
              onClick={saveIgnoreDirs}
            >
              保存忽略目录
            </Button>
          </div>
        </div>
      </div>

      <div className="content-card">
        <h3 className="section-title">执行扫描</h3>
        <div className="list-row">
          <div className="empty-hint" style={{ flex: 1, marginRight: 16, padding: 0 }}>
            将扫描路径：<span className="mono">{workspacePath.trim() || '（未配置）'}</span>
          </div>
          <Button type="primary" loading={scanMutation.isPending} onClick={runScan}>
            扫描工作区
          </Button>
        </div>
      </div>

      {latestScanQuery.isLoading ? (
        <Spin />
      ) : latestScanQuery.data ? (
        <>
          <div className="content-card">
            <h3 className="section-title">最近扫描结果</h3>
            <div className="list-row">
              <span>扫描时间</span>
              <span className="mono">{latestScanQuery.data.scannedAt}</span>
            </div>
            <div className="list-row">
              <span>仓库数量</span>
              <span>{latestScanQuery.data.repositoryCount}</span>
            </div>
            <div className="list-row">
              <span>异常仓库</span>
              <span>{latestScanQuery.data.failures.length}</span>
            </div>
          </div>

          {latestScanQuery.data.failures.length > 0 ? (
            <div className="content-card">
              <h3 className="section-title">异常仓库列表</h3>
              <Table
                rowKey="path"
                pagination={false}
                dataSource={latestScanQuery.data.failures}
                columns={[
                  { title: '目录名', dataIndex: 'name' },
                  { title: '路径', dataIndex: 'path', className: 'mono' },
                  { title: '原因', dataIndex: 'reason' },
                ]}
              />
            </div>
          ) : null}
        </>
      ) : (
        <div className="content-card empty-hint">还没有扫描记录，配置路径后执行一次扫描。</div>
      )}
    </div>
  );
}
