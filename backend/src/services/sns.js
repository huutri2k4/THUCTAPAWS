const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

async function publish(subject, message) {
  if (!process.env.AWS_SNS_TOPIC_ARN) {
    throw new Error('AWS_SNS_TOPIC_ARN is not configured in .env');
  }

  const params = {
    TopicArn: process.env.AWS_SNS_TOPIC_ARN,
    Subject: subject || 'Notification',
    Message: typeof message === 'string' ? message : JSON.stringify(message)
  };

  const cmd = new PublishCommand(params);
  const res = await snsClient.send(cmd);
  return res;
}

module.exports = { publish };
