import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Button, Space, Tag, Steps } from 'antd';
import { FileOutlined, MessageOutlined, CodeOutlined } from '@ant-design/icons';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import './AnimatedWorkflowView.css';

const { Text, Title } = Typography;

interface Query {
  query: string;
  timestamp?: string;
  response?: string;
  urls?: string[];
  file_number: number;
}

interface AnimatedWorkflowViewProps {
  queries: Query[];
  onShowDiff: (response: string | undefined) => Promise<string>;
}

const AnimatedWorkflowView: React.FC<AnimatedWorkflowViewProps> = ({ queries, onShowDiff }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSubStep, setCurrentSubStep] = useState(0);
  const [currentDiff, setCurrentDiff] = useState('');
  const [sortedQueries, setSortedQueries] = useState<Query[]>([]);

  useEffect(() => {
    // 按 file_number 从小到大排序
    const sorted = [...queries].sort((a, b) => a.file_number - b.file_number);
    setSortedQueries(sorted);
  }, [queries]);

  useEffect(() => {
    if (isPlaying) {
      const timer = setInterval(async () => {
        if (currentSubStep < 2) {
          setCurrentSubStep(prev => prev + 1);
        } else {
          if (currentStep < sortedQueries.length - 1) {
            setCurrentStep(prev => prev + 1);
            setCurrentSubStep(0);
          } else {
            setIsPlaying(false);
          }
        }
      }, 3000); // 3秒切换一个子步骤

      return () => clearInterval(timer);
    }
  }, [isPlaying, currentStep, currentSubStep, sortedQueries.length]);

  useEffect(() => {
    const loadDiff = async () => {
      if (currentSubStep === 2 && sortedQueries[currentStep]?.response) {
        const diff = await onShowDiff(sortedQueries[currentStep].response);
        setCurrentDiff(diff);
      }
    };
    loadDiff();
  }, [currentSubStep, currentStep, sortedQueries]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setCurrentSubStep(0);
    setIsPlaying(false);
    setCurrentDiff('');
  };

  const renderContent = () => {
    const currentQuery = sortedQueries[currentStep];
    if (!currentQuery) return null;

    switch (currentSubStep) {
      case 0: // 展示相关文件
        return (
          <div className="animated-content">
            <Title level={4}>相关文件</Title>
            {currentQuery.urls?.map((url, index) => (
              <Card key={index} size="small" className="file-card">
                <FileOutlined /> {url}
              </Card>
            ))}
          </div>
        );
      case 1: // 展示查询内容
        return (
          <div className="animated-content">
            <Title level={4}>查询内容</Title>
            <Card className="query-card">
              <pre>{currentQuery.query}</pre>
            </Card>
          </div>
        );
      case 2: // 展示Diff
        return (
          <div className="animated-content">
            <Title level={4}>代码变更</Title>
            <SyntaxHighlighter
              language="diff"
              style={vscDarkPlus}
              className="diff-highlighter"
            >
              {currentDiff}
            </SyntaxHighlighter>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="animated-workflow-view">
      <Space style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          onClick={handlePlayPause}
        >
          {isPlaying ? '暂停' : '播放'}
        </Button>
        <Button onClick={handleReset}>重置</Button>
        <Text>当前: {`${sortedQueries[currentStep]?.file_number}_chat_action.yml`}</Text>
      </Space>

      <Steps
        current={currentSubStep}
        items={[
          {
            title: '相关文件',
            icon: <FileOutlined />,
          },
          {
            title: '查询内容',
            icon: <MessageOutlined />,
          },
          {
            title: '代码变更',
            icon: <CodeOutlined />,
          },
        ]}
      />

      <div className="content-container">
        {renderContent()}
      </div>

      <div className="progress-indicator">
        {sortedQueries.map((query, index) => (
          <Tag 
            key={query.file_number}
            color={currentStep === index ? 'blue' : 'default'}
          >
            #{query.file_number}
          </Tag>
        ))}
      </div>
    </div>
  );
};

export default AnimatedWorkflowView;