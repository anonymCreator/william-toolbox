import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Modal, Form, Input, InputNumber, Checkbox, Select, message, AutoComplete, Tooltip, Divider } from 'antd';
import { MinusCircleOutlined, QuestionCircleOutlined, PlusOutlined } from '@ant-design/icons';

const { Option } = Select;

enum InferBackend {
  Transformers = "transformers",
  VLLM = "ray/vllm",
  LLAMA_CPP = "llama_cpp",
  DeepSpeed = "ray/deepspeed",
  SaaS = "saas"
}

interface InferParam {
  key: string;
  value: string;
}

enum ProductType {
  Pro = "pro",
  Lite = "lite"
}

interface EditModelProps {
  visible: boolean;
  modelData: any;
  onClose: () => void;
  onUpdate: () => void;
}

const EditModel: React.FC<EditModelProps> = ({ visible, modelData, onClose, onUpdate }) => {
  const [form] = Form.useForm();
  const [selectedBackend, setSelectedBackend] = useState<InferBackend>(InferBackend.SaaS);
  const [selectedBaseUrl, setSelectedBaseUrl] = useState<string>('');
  const [saasBaseUrls, setSaasBaseUrls] = useState<Array<{value: string, label: string}>>([]);
  const [pretrainedModelTypes, setPretrainedModelTypes] = useState<Array<{value: string, label: string}>>([]);
  const [productType, setProductType] = useState<ProductType>(ProductType.Lite);

  // Check if the model is running
  const isModelRunning = modelData?.status === 'running';

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchModelDetails = async (modelName: string) => {
    try {
      const response = await axios.get(`/models/${modelName}`);
      const fullModelData = response.data;
      const deployCommand = fullModelData.deploy_command || {};

      // Set base form values
      form.setFieldsValue({
        pretrained_model_type: deployCommand.pretrained_model_type,
        cpus_per_worker: deployCommand.cpus_per_worker,
        gpus_per_worker: deployCommand.gpus_per_worker,
        num_workers: deployCommand.num_workers,
        worker_concurrency: deployCommand.worker_concurrency,
        model_path: deployCommand.model_path,
        infer_backend: deployCommand.infer_backend,
        product_type: fullModelData.product_type || ProductType.Lite,
        is_reasoning: fullModelData.is_reasoning,
        input_price: fullModelData.input_price,
        output_price: fullModelData.output_price
      });

      // Set product type state
      setProductType(fullModelData.product_type || ProductType.Lite);

      // Handle infer_params
      if (deployCommand.infer_params) {
        const params = [];
        for (const [key, value] of Object.entries(deployCommand.infer_params)) {
          if (key.startsWith('saas.')) {
            form.setFieldValue(key, value);
            if (key === 'saas.base_url') {
              setSelectedBaseUrl(value as string);
            }
          } else {
            params.push({ key, value });
          }
        }
        form.setFieldValue('infer_params', params);
      }

      // Determine and set the backend type
      let backend = deployCommand.infer_backend;
      
      // If no backend is specified but we have saas parameters, default to SaaS
      if (!backend && deployCommand.infer_params && Object.keys(deployCommand.infer_params).some(key => key.startsWith('saas.'))) {
        backend = InferBackend.SaaS;
      }
      
      // Default to SaaS if no backend is specified
      backend = backend || InferBackend.SaaS;
      
      // Update form and state
      form.setFieldValue('infer_backend', backend);
      setSelectedBackend(backend as InferBackend);
      
      // If it's a SaaS backend, ensure the SaaS fields are visible
      if (backend === InferBackend.SaaS) {
        form.setFieldsValue({
          'saas.base_url': deployCommand.infer_params?.['saas.base_url'],
          'saas.api_key': deployCommand.infer_params?.['saas.api_key'],
          'saas.model': deployCommand.infer_params?.['saas.model'],
        });
      }
    } catch (error) {
      console.error('Error fetching model details:', error);
      message.error('获取模型详情失败');
    }
  };

  useEffect(() => {    
    if (visible && modelData?.name) {
      fetchModelDetails(modelData.name);
    }
  }, [visible, modelData?.name]);

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/config');
      setSaasBaseUrls(response.data.saasBaseUrls);
      setPretrainedModelTypes(response.data.pretrainedModelTypes);
    } catch (error) {
      console.error('Error fetching config:', error);
      message.error('Failed to fetch configuration');
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const infer_params: Record<string, string> = {};
      
      // Collect all infer_params
      if (values.infer_params) {
        values.infer_params.forEach((param: any) => {
          infer_params[param.key] = param.value;
        });
      }

      if (values["saas.base_url"]) {
        infer_params["saas.base_url"] = values["saas.base_url"];
      }
      if (values["saas.api_key"]) {
        infer_params["saas.api_key"] = values["saas.api_key"];
      }
      if (values["saas.model"]) {
        infer_params["saas.model"] = values["saas.model"];
      }
  
      // Replace infer_params in values
      values.infer_params = infer_params;
      values.name = modelData.name;

      await axios.put(`/models/${modelData.name}`, values);
      message.success('模型更新成功');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating model:', error);
      message.error('更新模型失败');
    }
  };

  const handleInferBackendChange = (value: string) => {
    setSelectedBackend(value as InferBackend);
    form.setFieldsValue({ infer_params: [] });
  };

  const handleBaseUrlChange = (value: string) => {
    setSelectedBaseUrl(value);
    if (value === 'https://api.deepseek.com/beta') {
      form.setFieldsValue({ 'saas.model': 'deepseek-chat' });
    }
  };

  const handleProductTypeChange = (value: ProductType) => {
    setProductType(value);
    // 如果从Pro切换到Lite，重置一些Pro专有的字段
    if (value === ProductType.Lite) {
      form.setFieldsValue({
        cpus_per_worker: 0.001,
        gpus_per_worker: 0,
        num_workers: 1,
        worker_concurrency: 1000,
        infer_backend: InferBackend.SaaS,
      });
    }
  };

  const handlePretrainedModelTypeChange = (value: string) => {
    form.setFieldsValue({ pretrained_model_type: value });
  };

  return (
    <Modal
      title="编辑模型"
      visible={visible}
      onOk={handleOk}
      onCancel={onClose}
      width={700}
      okButtonProps={{ disabled: isModelRunning && productType !== "lite" }}
      okText={isModelRunning && productType !== "lite" ? "运行中无法编辑" : "确认"}
    >
      {isModelRunning && productType !== "lite" && (
        <div style={{ marginBottom: 16, padding: 8, backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4 }}>
          <span style={{ color: '#faad14' }}><strong>提示：</strong>模型正在运行中，请先停止模型后再进行编辑。</span>
        </div>
      )}
      {isModelRunning && productType === "lite" && (
        <div style={{ marginBottom: 16, padding: 8, backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>
          <span style={{ color: '#1890ff' }}><strong>提示：</strong>轻量版模式下，可以在模型运行时进行编辑。</span>
        </div>
      )}
      
      <Form form={form} layout="vertical">
        <Form.Item name="product_type" label="产品模式" initialValue={ProductType.Lite}>
          <Select onChange={(value) => handleProductTypeChange(value as ProductType)}>
            <Option value={ProductType.Pro}>专业版 (Pro)</Option>
            <Option value={ProductType.Lite}>轻量版 (Lite)</Option>
          </Select>
        </Form.Item>

        {productType === ProductType.Pro && (
          <>
            <Divider orientation="left">Pro 专有配置</Divider>
            <Form.Item
              name="pretrained_model_type"
              label={
                <span>
                  预训练模型类型&nbsp;
                  <Tooltip title="如果你需要部署私有模型，可以选择 custom/模型名称 并且合理配置推理后端以及 GPU 数">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </span>
              }
              initialValue="saas/openai"
              rules={[{ required: true }]}
            >
              <AutoComplete
                options={pretrainedModelTypes}
                onChange={handlePretrainedModelTypeChange}
                placeholder="选择或输入预训练模型类型"
              >
                <Input />
              </AutoComplete>
            </Form.Item>
            <Form.Item name="cpus_per_worker" label="每个 Worker CPU" initialValue={0.001}>
              <InputNumber min={0} step={0.001} />
            </Form.Item>
            <Form.Item name="gpus_per_worker" label="每个 Worker GPU" initialValue={0}>
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="num_workers" label="Worker 数量" initialValue={1}>
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="worker_concurrency" label="Worker 并发数" initialValue={1000}>
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="infer_backend" label="推理后端" initialValue={InferBackend.SaaS} rules={[{ required: true }]}>
              <Select onChange={handleInferBackendChange}>
                {Object.values(InferBackend).map((backend) => (
                  <Option key={backend} value={backend}>{backend}</Option>
                ))}
              </Select>
            </Form.Item>
            {selectedBackend && selectedBackend !== InferBackend.SaaS && (
              <Form.Item name="model_path" label="模型路径">
                <Input />
              </Form.Item>
            )}
          </>
        )}

        <Divider orientation="left">通用配置</Divider>
        
        {/* SaaS配置部分对两种模式都显示 */}
        <Form.Item name="saas.base_url" label="SaaS Base URL">
          <AutoComplete
            options={saasBaseUrls}
            onChange={handleBaseUrlChange}
            placeholder="选择或输入 Base URL"
          >
            <Input />
          </AutoComplete>
        </Form.Item>
        <Form.Item name="saas.api_key" label="SaaS API Key" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item name="saas.model" label="SaaS Model" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        
        <Form.Item name="is_reasoning" label="是否为推理模型" valuePropName="checked">
          <Checkbox />
        </Form.Item>
        <Form.Item name="input_price" label="输入价格 (元/百万token)">
          <InputNumber min={0} precision={4} />
        </Form.Item>
        <Form.Item name="output_price" label="输出价格 (元/百万token)">
          <InputNumber min={0} precision={4} />
        </Form.Item>
        
        {productType === ProductType.Pro && (
          <Form.List name="infer_params">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Form.Item
                    key={key}
                    label={name === 0 ? "额外参数" : ""}
                    required={false}
                    style={{ marginBottom: 8 }}
                  >
                    <Form.Item
                      {...restField}
                      name={[name, 'key']}
                      validateTrigger={['onChange', 'onBlur']}
                      rules={[
                        {
                          required: true,
                          whitespace: true,
                          message: "请输入参数名称或删除此字段",
                        },
                      ]}
                      noStyle
                    >
                      <Input placeholder="参数名称" style={{ width: '45%' }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'value']}
                      validateTrigger={['onChange', 'onBlur']}
                      rules={[
                        {
                          required: true,
                          whitespace: true,
                          message: "请输入参数值或删除此字段",
                        },
                      ]}
                      noStyle
                    >
                      <Input style={{ width: '45%', marginLeft: 8 }} placeholder="参数值" />
                    </Form.Item>
                    <MinusCircleOutlined
                      className="dynamic-delete-button"
                      onClick={() => remove(name)}
                      style={{ margin: '0 8px' }}
                    />
                  </Form.Item>
                ))}
                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加参数
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        )}
      </Form>
    </Modal>
  );
};

export default EditModel;