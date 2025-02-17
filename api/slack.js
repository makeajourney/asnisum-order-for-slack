const { App, LogLevel } = require('@slack/bolt');
const orderManager = require('../lib/orderSession');

// 로깅 함수
const logger = {
  error: (...args) => {
    console.error(new Date().toISOString(), ...args);
  },
  info: (...args) => {
    console.log(new Date().toISOString(), ...args);
  },
};

let app;

// 미리 앱 인스턴스 생성
const getApp = () => {
  if (!app) {
    app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      processBeforeResponse: true,
    });

    // 명령어 핸들러들을 설정
    setupHandlers(app);
  }
  return app;
};

// 핸들러 설정 함수
const setupHandlers = (app) => {
  // 주문시작 명령어
  app.command('/주문시작', async ({ command, client, respond }) => {
    logger.info('주문시작 command received:', command);
    try {
      // 토큰 검증
      if (!process.env.SLACK_BOT_TOKEN) {
        throw new Error('SLACK_BOT_TOKEN is not set');
      }

      // 이미 진행 중인 주문이 있는지 확인
      const isActive = await orderManager.isActiveSession(command.channel_id);
      logger.info('Active session check:', {
        isActive,
        channelId: command.channel_id,
      });

      if (isActive) {
        await respond({
          text: '이미 진행 중인 주문이 있습니다. 먼저 `/마감` 명령어로 현재 주문을 마감해주세요.',
          response_type: 'ephemeral',
        });
        return;
      }

      logger.info('Sending initial message');
      const result = await client.chat.postMessage({
        channel: command.channel_id,
        text: '오늘의 주문을 받습니다! 🍱',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*오늘의 주문*\n주문하실 분들은 아래 버튼을 눌러주세요.',
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '주문하기',
                  emoji: true,
                },
                action_id: 'order_button',
              },
            ],
          },
        ],
      });
      logger.info('Message sent successfully:', result);

      // 새 세션 시작
      await orderManager.startSession(command.channel_id, result.ts);
      logger.info('New session started');
    } catch (error) {
      logger.error('주문시작 error:', {
        error: error.message,
        stack: error.stack,
        command: command,
      });

      await respond({
        text: `주문 시작 중 오류가 발생했습니다. (${error.message})`,
        response_type: 'ephemeral',
      });
    }
  });

  // 마감 명령어
  app.command('/마감', async ({ command, client, respond }) => {
    try {
      const session = await orderManager.getSession(command.channel_id);

      if (
        !session ||
        !(await orderManager.isActiveSession(command.channel_id))
      ) {
        await respond({
          text: '현재 진행 중인 주문이 없습니다.',
          response_type: 'ephemeral',
        });
        return;
      }

      if (session.orders.length === 0) {
        await respond({
          text: '아직 접수된 주문이 없습니다.',
          response_type: 'ephemeral',
        });
        return;
      }

      // 주문 내역 정리
      let summary = '*오늘의 주문 내역*\n\n';
      for (const order of session.orders) {
        summary += `• <@${order.userId}>\n`;
        summary += `  - 메뉴: ${order.menu}\n`;
        if (order.options) {
          summary += `  - 요청사항: ${order.options}\n`;
        }
        summary += '\n';
      }

      // 스레드에 정리 내용 추가
      await client.chat.postMessage({
        channel: command.channel_id,
        thread_ts: session.messageTs,
        text: summary,
      });

      // 채널에도 동일한 내용 표시
      await client.chat.postMessage({
        channel: command.channel_id,
        text: summary,
      });

      // 세션 종료 및 삭제
      await orderManager.clearSession(command.channel_id);
    } catch (error) {
      logger.error('마감 처리 실패:', error);
      await respond({
        text: '주문 마감 처리 중 오류가 발생했습니다.',
        response_type: 'ephemeral',
      });
    }
  });

  // 주문하기 버튼 액션
  app.action('order_button', async ({ body, ack, client, respond }) => {
    await ack();

    try {
      // 활성 세션 확인
      if (!(await orderManager.isActiveSession(body.channel.id))) {
        await respond({
          text: '현재 진행 중인 주문이 없습니다. `/주문시작` 명령어로 새로운 주문을 시작해주세요.',
          response_type: 'ephemeral',
        });
        return;
      }

      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'order_submission',
          title: {
            type: 'plain_text',
            text: '주문하기',
          },
          submit: {
            type: 'plain_text',
            text: '주문',
          },
          blocks: [
            {
              type: 'input',
              block_id: 'menu',
              element: {
                type: 'plain_text_input',
                action_id: 'menu_input',
              },
              label: {
                type: 'plain_text',
                text: '메뉴',
              },
            },
            {
              type: 'input',
              block_id: 'options',
              element: {
                type: 'plain_text_input',
                action_id: 'options_input',
                multiline: true,
              },
              label: {
                type: 'plain_text',
                text: '추가 요청사항',
              },
              optional: true,
            },
          ],
          private_metadata: body.channel.id,
        },
      });
    } catch (error) {
      logger.error('모달 열기 실패:', error);
    }
  });

  // 주문 모달 제출
  app.view('order_submission', async ({ ack, body, view, client }) => {
    await ack();

    try {
      const channelId = view.private_metadata;
      const session = await orderManager.getSession(channelId);

      if (!session || !(await orderManager.isActiveSession(channelId))) {
        logger.error('주문 세션이 유효하지 않습니다');
        return;
      }

      const userId = body.user.id;
      const menu = view.state.values.menu.menu_input.value;
      const options = view.state.values.options.options_input.value;

      // 스레드에 주문 내용 추가
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: session.messageTs,
        text: `<@${userId}>님의 주문:\n*메뉴*: ${menu}\n*요청사항*: ${options || '없음'}`,
      });

      // 주문 데이터 저장
      await orderManager.addOrder(channelId, {
        userId,
        menu,
        options,
      });
    } catch (error) {
      logger.error('주문 처리 실패:', error);
    }
  });
};

// Vercel 함수 핸들러
module.exports = async (req, res) => {
  // 기본 요청 로깅
  logger.info('Request received:', {
    method: req.method,
    url: req.url,
    body: req.body,
    headers: req.headers,
    type: req.body?.type,
    action: req.body?.action_id,
  });

  // Health check
  if (req.method === 'GET') {
    return res
      .status(200)
      .json({ status: 'ok', time: new Date().toISOString() });
  }

  try {
    const app = getApp();

    // 요청 처리
    await app.processEvent({
      body: req.body,
      headers: req.headers,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('Handler error:', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
};
