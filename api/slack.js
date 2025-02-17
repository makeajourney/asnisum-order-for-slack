const { App } = require('@slack/bolt');
const orderManager = require('../lib/orderSession');

// 로깅 함수
const logger = {
  error: (...args) => {
    console.error(new Date().toISOString(), ...args);
  },
  info: (...args) => {
    console.log(new Date().toISOString(), ...args);
  }
};

// Vercel 함수 핸들러
module.exports = async (req, res) => {
  // 기본 요청 로깅
  logger.info('Request received:', {
    method: req.method,
    url: req.url,
    body: req.body
  });

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  }

  try {
    // 앱 초기화
    logger.info('Initializing Slack app');
    const app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      processBeforeResponse: true
    });

    // 미들웨어로 모든 요청 로깅
    app.use(async ({ payload, context, next }) => {
      logger.info('Incoming request:', {
        type: payload.type,
        user: payload.user,
        channel: payload.channel,
        command: payload.command
      });
      await next();
    });

    // 주문 시작 명령어 처리
    app.command('/주문시작', async ({ command, ack, client, respond }) => {
      logger.info('주문시작 command received:', command);
      try {
        await ack();
        logger.info('주문시작 acknowledged');

        // 토큰 검증
        if (!process.env.SLACK_BOT_TOKEN) {
          throw new Error('SLACK_BOT_TOKEN is not set');
        }

        // 이미 진행 중인 주문이 있는지 확인
        const isActive = await orderManager.isActiveSession(command.channel_id);
        logger.info('Active session check:', { isActive, channelId: command.channel_id });

        if (isActive) {
          await respond({
            text: "이미 진행 중인 주문이 있습니다. 먼저 `/마감` 명령어로 현재 주문을 마감해주세요.",
            response_type: 'ephemeral'
          });
          return;
        }

        logger.info('Sending initial message');
        const result = await client.chat.postMessage({
          channel: command.channel_id,
          text: "오늘의 주문을 받습니다! 🍱",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*오늘의 주문*\n주문하실 분들은 아래 버튼을 눌러주세요."
              }
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "주문하기",
                    emoji: true
                  },
                  action_id: "order_button"
                }
              ]
            }
          ]
        });
        logger.info('Message sent successfully:', result);

        // 새 세션 시작
        await orderManager.startSession(command.channel_id, result.ts);
        logger.info('New session started');

      } catch (error) {
        logger.error('주문시작 error:', {
          error: error.message,
          stack: error.stack,
          command: command
        });
        
        try {
          await respond({
            text: `주문 시작 중 오류가 발생했습니다. (${error.message})`,
            response_type: 'ephemeral'
          });
        } catch (respondError) {
          logger.error('Failed to send error response:', respondError);
        }
      }
    });

    // 2. 주문 모달 표시
    app.action('order_button', async ({ body, ack, client, respond }) => {
      await ack();

      // 활성 세션 확인
      if (!await orderManager.isActiveSession(body.channel.id)) {
        await respond({
          text: "현재 진행 중인 주문이 없습니다. `/주문시작` 명령어로 새로운 주문을 시작해주세요.",
          response_type: 'ephemeral'
        });
        return;
      }

      try {
        await client.views.open({
          trigger_id: body.trigger_id,
          view: {
            type: "modal",
            callback_id: "order_submission",
            title: {
              type: "plain_text",
              text: "주문하기"
            },
            submit: {
              type: "plain_text",
              text: "주문"
            },
            blocks: [
              {
                type: "input",
                block_id: "menu",
                element: {
                  type: "plain_text_input",
                  action_id: "menu_input"
                },
                label: {
                  type: "plain_text",
                  text: "메뉴"
                }
              },
              {
                type: "input",
                block_id: "options",
                element: {
                  type: "plain_text_input",
                  action_id: "options_input",
                  multiline: true
                },
                label: {
                  type: "plain_text",
                  text: "추가 요청사항"
                },
                optional: true
              }
            ],
            private_metadata: body.channel.id
          }
        });
      } catch (error) {
        logger.error('모달 열기 실패:', error);
      }
    });

    // 3. 주문 접수 및 스레드 응답
    app.view('order_submission', async ({ ack, body, view, client }) => {
      await ack();

      const channelId = view.private_metadata;
      const session = await orderManager.getSession(channelId);

      if (!session || !await orderManager.isActiveSession(channelId)) {
        logger.error('주문 세션이 유효하지 않습니다');
        return;
      }

      const userId = body.user.id;
      const menu = view.state.values.menu.menu_input.value;
      const options = view.state.values.options.options_input.value;

      try {
        // 스레드에 주문 내용 추가
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: session.messageTs,
          text: `<@${userId}>님의 주문:\n*메뉴*: ${menu}\n*요청사항*: ${options || '없음'}`
        });

        // 주문 데이터 저장
        await orderManager.addOrder(channelId, {
          userId,
          menu,
          options
        });

      } catch (error) {
        logger.error('주문 처리 실패:', error);
      }
    });

    // 4. 주문 마감 명령어 처리
    app.command('/마감', async ({ command, ack, client, respond }) => {
      await ack();

      try {
        const session = await orderManager.getSession(command.channel_id);
        
        if (!session || !await orderManager.isActiveSession(command.channel_id)) {
          await respond({
            text: "현재 진행 중인 주문이 없습니다.",
            response_type: 'ephemeral'
          });
          return;
        }

        if (session.orders.length === 0) {
          await respond({
            text: "아직 접수된 주문이 없습니다.",
            response_type: 'ephemeral'
          });
          return;
        }

        // 주문 내역 정리
        let summary = "*오늘의 주문 내역*\n\n";
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
          text: summary
        });

        // 채널에도 동일한 내용 표시
        await client.chat.postMessage({
          channel: command.channel_id,
          text: summary
        });

        // 세션 종료 및 삭제
        await orderManager.clearSession(command.channel_id);

      } catch (error) {
        logger.error('마감 처리 실패:', error);
        await respond({
          text: "주문 마감 처리 중 오류가 발생했습니다.",
          response_type: 'ephemeral'
        });
      }
    });

    // 에러 핸들러
    app.error(async (error) => {
      logger.error('Global error handler:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
    });

    // 요청 처리
    const payload = req.body;
    let result;

    // 슬래시 커맨드 처리
    if (payload.command) {
      if (payload.command === '/주문시작') {
        result = await app.handleCommand(payload);
      } else if (payload.command === '/마감') {
        result = await app.handleCommand(payload);
      }
    }
    // 상호작용 처리
    else if (payload.type === 'block_actions') {
      result = await app.handleIncomingInteraction(payload);
    }
    // 모달 제출 처리
    else if (payload.type === 'view_submission') {
      result = await app.handleViewSubmission(payload);
    }

    if (!result) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(result);

  } catch (error) {
    logger.error('Handler error:', error);
    return res.status(500).json({ error: error.message });
  }
};