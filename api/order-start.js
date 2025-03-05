const { getApp, handleOrderStart } = require('../lib/app');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const app = getApp();
    logger.info('Cron job triggered: order-start');

    await handleOrderStart({
      command: {
        channel_id: 'C05UUE7SK7Y',
        text: '주문시작 <!subteam^S046PTK85RV>',
      },
      client: app.client,
      respond: async (message) => {
        await app.client.chat.postMessage({
          channel: 'C05UUE7SK7Y',
          ...message,
        });
      },
    });

    return res.status(200).json({
      ok: true,
      message: '주문시작 명령이 실행되었습니다.',
    });
  } catch (error) {
    console.error('주문시작 실행 중 오류:', error);
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
};
