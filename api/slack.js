const { getApp, logger } = require('../lib/app');

// Vercel 함수 핸들러
module.exports = async (req, res) => {
  // 기본 요청 로깅
  logger.info('Request received:', {
    method: req.method,
    url: req.url,
    type: req.body?.type,
    action: req.body?.payload
      ? JSON.parse(req.body.payload).action_id
      : req.body?.action_id,
    body: req.body,
  });

  // Health check
  if (req.method === 'GET') {
    return res
      .status(200)
      .json({ status: 'ok', time: new Date().toISOString() });
  }

  try {
    const app = getApp();

    if (req.body?.payload) {
      const payload = JSON.parse(req.body.payload);
      logger.info('Interactive payload received:', payload);

      if (payload.type === 'view_submission') {
        try {
          // 이벤트 처리
          await app.processEvent({
            body: {
              ...payload,
            },
            headers: req.headers,
          });
        } catch (error) {
          logger.error('View submission error:', {
            error: error.message,
            stack: error.stack,
          });
          return res.status(200).json({
            response_action: 'errors',
            errors: {
              menu: '처리 중 오류가 발생했습니다. 다시 시도해주세요.',
            },
          });
        }
        return res.status(200).send({ response_action: 'clear' });
      } else {
        await app.processEvent({
          body: {
            ...payload,
          },
          headers: req.headers,
        });
      }
    } else {
      await app.processEvent({
        body: req.body,
        headers: req.headers,
      });
    }
    return res.status(200).json();
  } catch (error) {
    logger.error('Handler error:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });

    return res.status(200).json({
      ok: false,
      error: error.message,
    });
  }
};
