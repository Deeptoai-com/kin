import { mastra } from './src/mastra/index.ts';

async function testWorkflow() {
  console.log('Starting workflow test...');

  const input = {
    brief: {
      client: '测试公司',
      project: '测试项目',
      objective: 'awareness',
      targetMedia: ['科技媒体'],
      targetAudience: '科技爱好者',
    },
    facts: {
      rawContent: '这是一个测试项目，主要测试多语言生成功能。',
    },
    outputConfig: {
      wordCountRange: '800-1200',
      languages: ['zh', 'en'],
    },
  };

  console.log('Input:', JSON.stringify(input, null, 2));

  try {
    const workflow = mastra.getWorkflow('pr-creator');
    console.log('Workflow found:', !!workflow);

    const result = await workflow.execute({
      triggerData: input,
    });

    console.log('Result status:', result.status);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
    console.error('Stack:', error.stack);
  }
}

testWorkflow().then(() => {
  console.log('Test complete');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
