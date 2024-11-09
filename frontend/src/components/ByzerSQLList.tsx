import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Table, Button, message, Card, Typography, Space, Tag, Tooltip, Modal } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import CreateByzerSQL from './CreateByzerSQL';
import EditByzerSQL from './EditByzerSQL';
import { PoweroffOutlined, PauseCircleOutlined, SyncOutlined, ThunderboltOutlined, FileOutlined, EditOutlined, ExclamationCircleOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { confirm } = Modal;

interface ByzerSQL {
  name: string;
  status: 'stopped' | 'running';
  install_dir: string;
  process_id?: number;
  is_alive?: boolean;
}

interface ByzerSQLListProps {
  refreshTrigger: number;
}

const ByzerSQLList: React.FC<ByzerSQLListProps> = ({ refreshTrigger }) => {
  const [services, setServices] = useState<ByzerSQL[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState<{ [key: string]: boolean }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingService, setEditingService] = useState<ByzerSQL | null>(null);
  const [logModal, setLogModal] = useState<{
    visible: boolean;
    content: string;
    title: string;
  }>({
    visible: false,
    content: '',
    title: '',
  });
  const [logPolling, setLogPolling] = useState<NodeJS.Timeout | null>(null);
  const [startingServices, setStartingServices] = useState<{ [key: string]: boolean }>({});
  const logContentRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    fetchServices();
  }, [refreshTrigger]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/byzer-sql');
      setServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
      message.error('获取Byzer SQL列表失败');
    } finally {
      setLoading(false);
    }
  };

  const showLogModal = async (serviceName: string, logType: string) => {
    setLogModal({
      visible: true,
      content: '',
      title: `${serviceName} ${logType === 'out' ? 'Standard Output' : 'Standard Error'}`,
    });

    const fetchLogs = async () => {
      try {
        const response = await axios.get(`/byzer-sql/${serviceName}/logs/${logType}/-10000`);
        if (response.data.content) {
          setLogModal(prev => ({
            ...prev,
            content: response.data.content
          }));
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
        message.error('Failed to fetch logs');
      }
    };

    await fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    setLogPolling(interval);
  };

  const handleCloseLogModal = () => {
    if (logPolling) {
      clearInterval(logPolling);
      setLogPolling(null);
    }
    setLogModal(prev => ({ ...prev, visible: false }));
  };

  const scrollToBottom = () => {
    if (logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (logModal.visible) {
      scrollToBottom();
    }
  }, [logModal.content]);

  const handleAction = async (serviceName: string, action: 'start' | 'stop' | 'delete') => {
    try {
      if (action === 'delete') {
        const response = await axios.delete(`/byzer-sql/${serviceName}`);
        if (response.data.message) {
          message.success(response.data.message);
          await fetchServices();
        }
      } else {
        if (action === 'start') {
          setStartingServices(prev => ({ ...prev, [serviceName]: true }));
        }

        const response = await axios.post(`/byzer-sql/${serviceName}/${action}`);
        if (response.data.message) {
          message.success(response.data.message);
          await fetchServices();
        }
      }
    } catch (error) {
      if (action === 'start') {
        setStartingServices(prev => ({ ...prev, [serviceName]: false }));
      }
      console.error(`Error ${action}ing service:`, error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '删除'}Byzer SQL失败: ${error.response.data.detail}`);
      } else {
        message.error(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '删除'}Byzer SQL失败`);
      }
    }
  };

  const refreshStatus = async (serviceName: string) => {
    setRefreshing(prev => ({ ...prev, [serviceName]: true }));
    try {
      const response = await axios.get(`/byzer-sql/${serviceName}/status`);
      if (response.data.success) {
        setServices(prevServices =>
          prevServices.map(service =>
            service.name === serviceName ? { ...service, status: response.data.status } : service
          )
        );
        message.success(`刷新状态成功: ${response.data.status}`);
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
      message.error('刷新状态失败');
    } finally {
      setRefreshing(prev => ({ ...prev, [serviceName]: false }));
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: '安装目录',
      dataIndex: 'install_dir',
      key: 'install_dir',
      render: (text: string) => (
        <Tooltip title={text}>
          <Paragraph ellipsis={{ rows: 1 }}>{text}</Paragraph>
        </Tooltip>
      ),
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: ByzerSQL) => (
        <Space direction="vertical">
          <Tag color={status === 'running' ? 'green' : 'red'}>
            {status === 'running' ? '运行中' : '已停止'}
          </Tag>
          {record.process_id && <span>PID: {record.process_id}</span>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ByzerSQL) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Space size="small">
            <Button
              type={record.status === 'stopped' ? 'primary' : 'default'}
              icon={record.status === 'stopped' ? <PoweroffOutlined /> : <PauseCircleOutlined />}
              onClick={() => handleAction(record.name, record.status === 'stopped' ? 'start' : 'stop')}
              disabled={record.status === 'stopped' ? startingServices[record.name] : false}
            >
              {record.status === 'stopped' ? '启动' : '停止'}
            </Button>
            <Button
              icon={<SyncOutlined spin={refreshing[record.name]} />}
              onClick={() => refreshStatus(record.name)}
              disabled={refreshing[record.name]}
            >
              刷新状态
            </Button>
            <Button
              icon={<FileOutlined />}
              onClick={() => showLogModal(record.name, 'out')}
            >
              标准输出
            </Button>
            <Button
              icon={<ExclamationCircleOutlined />}
              onClick={() => showLogModal(record.name, 'err')}
            >
              标准错误
            </Button>
          </Space>
          <Space size="small">
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                confirm({
                  title: '确认删除',
                  content: '你确定要删除这个Byzer SQL服务吗？',
                  onOk: () => handleAction(record.name, 'delete'),
                });
              }}
              disabled={record.status !== 'stopped'}
            >
              删除
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => setEditingService(record)}
              disabled={record.status === 'running'}
            >
              编辑
            </Button>
          </Space>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <Title level={2}>
          <Space>
            <ThunderboltOutlined />
            Byzer SQL列表
          </Space>
        </Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          style={{ marginBottom: 16 }}
          onClick={() => setShowCreateForm(true)}
        >
          添加Byzer SQL
        </Button>
        
        <CreateByzerSQL 
          visible={showCreateForm}
          onCancel={() => setShowCreateForm(false)}
          onServiceAdded={() => {
            setShowCreateForm(false);
            fetchServices();
          }}
        />

        <EditByzerSQL
          visible={!!editingService}
          onCancel={() => setEditingService(null)}
          service={editingService}
          onServiceUpdated={() => {
            setEditingService(null);
            fetchServices();
          }}
        />
        
        <Table
          columns={columns}
          dataSource={services}
          rowKey="name"
          loading={loading}
          pagination={false}
          bordered
        />
      </Card>

      <Modal
        title={logModal.title}
        visible={logModal.visible}
        onCancel={handleCloseLogModal}
        footer={null}
        width={800}
        bodyStyle={{ maxHeight: '500px', overflow: 'auto' }}
      >
        <pre
          ref={logContentRef}
          style={{
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            maxHeight: '450px',
            overflowY: 'auto',
            backgroundColor: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            fontSize: '12px',
            lineHeight: '1.5',
            fontFamily: 'monospace'
          }}
        >
          {logModal.content || 'No logs available'}
        </pre>
      </Modal>
    </>
  );
};

export default ByzerSQLList;