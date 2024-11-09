import React from 'react';
import { Form, Input, Button, message, Modal, Typography, Space, Select } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;

interface CreateByzerSQLProps {
  onServiceAdded: () => void;
  visible: boolean;
  onCancel: () => void;
}

const DOWNLOAD_OPTIONS = [
  {
    name: 'MacOS',
    url: 'https://download.byzer.org/byzer-lang/2.3.9/byzer-lang-all-in-one-darwin-amd64-3.3.0-2.3.9.tar.gz'
  },
  {
    name: 'Linux',
    url: 'https://download.byzer.org/byzer-lang/2.3.9/byzer-lang-all-in-one-linux-amd64-3.3.0-2.3.9.tar.gz'
  },
  {
    name: 'Windows',
    url: 'https://download.byzer.org/byzer-lang/2.3.9/byzer-lang-all-in-one-win-amd64-3.3.0-2.3.9.tar.gz'
  }
];

const CreateByzerSQL: React.FC<CreateByzerSQLProps> = ({ onServiceAdded, visible, onCancel }) => {
  const [form] = Form.useForm();

  const handleSubmit = async (values: any) => {
    try {
      const response = await axios.post('/byzer-sql/add', values);
      
      if (!values.install_dir.includes('bin')) {
        Modal.confirm({
          title: '选择下载版本',
          content: (
            <Select
              style={{ width: '100%' }}
              placeholder="选择适合您操作系统的版本"
              onChange={async (value) => {
                try {
                  Modal.confirm({
                    title: '确认下载',
                    content: '这可能需要几分钟时间，请耐心等待',
                    onOk: async () => {
                      message.loading('正在下载并解压...', 0);
                      await axios.post('/byzer-sql/download', {
                        download_url: value,
                        install_dir: values.install_dir
                      });
                      message.destroy();
                      message.success('下载并解压完成');
                      onServiceAdded();
                    }
                  });
                } catch (error) {
                  message.destroy();
                  console.error('Error downloading Byzer SQL:', error);
                  if (axios.isAxiosError(error) && error.response) {
                    message.error(`下载失败: ${error.response.data.detail}`);
                  } else {
                    message.error('下载失败');
                  }
                }
              }}
            >
              {DOWNLOAD_OPTIONS.map(option => (
                <Select.Option key={option.url} value={option.url}>
                  {option.name}
                </Select.Option>
              ))}
            </Select>
          ),
          okText: '关闭',
          cancelText: null
        });
      }
      
      message.success('Byzer SQL添加成功');
      form.resetFields();
      onServiceAdded();
    } catch (error) {
      console.error('Error adding Byzer SQL:', error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`添加失败: ${error.response.data.detail}`);
      } else {
        message.error('添加失败');
      }
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined />
          添加 Byzer SQL
        </Space>
      }
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="name"
          label="服务名称"
          rules={[{ required: true, message: '请输入服务名称' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="install_dir"
          label="安装目录"
          rules={[{ required: true, message: '请输入安装目录' }]}
          help="如果目录不包含bin/byzer.sh，系统将提示您下载"
        >
          <Input />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit">
            添加
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateByzerSQL;