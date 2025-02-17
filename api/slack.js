const { App, LogLevel } = require('@slack/bolt');
const orderManager = require('../lib/orderSession');
const menuConfig = require('../lib/menuConfig');
const { getTutorialBlocks, errorMessages } = require('./blocks/tutorial');

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
      socketMode: false,
    });

    // 핸들러 설정 전에 토큰 확인
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
      throw new Error('Required Slack credentials are missing');
    }

    // 명령어 핸들러들을 설정
    setupHandlers(app);
  }
  return app;
};

// 핸들러 설정 함수
const setupHandlers = (app) => {
  // 주문시작 명령어
  app.command('/아즈니섬 주문시작', async ({ command, client, respond }) => {
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
          text: errorMessages.activeSession,
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
  app.command('/아즈니섬 주문마감', async ({ command, client, respond }) => {
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
          text: '접수된 주문이 없습니다. 주문 세션을 종료합니다.',
          response_type: 'in_channel',
        });
        await orderManager.clearSession(command.channel_id);
        return;
      }

      // 주문 내역 정리
      let summary = '*주문 내역 정리*\n\n';
      for (const order of session.orders) {
        const selectedMenu = menuConfig.menus.find(
          (m) => m.value === order.menu
        );
        const needsBeanOption = menuConfig.categoriesNeedingBeanOption.includes(
          selectedMenu.category
        );

        // 주문 내역 부분 조합
        let orderParts = [
          `<@${order.userId}>`,
          order.temperature === 'hot' ? 'HOT' : 'ICE',
          order.menu,
        ];

        // 원두 옵션 (필요한 경우만)
        if (needsBeanOption) {
          const beanOptionText =
            menuConfig.beanOptions.find((b) => b.value === order.beanOption)
              ?.text || '다크(기본)';
          orderParts.push(beanOptionText);
        }

        // 기타 옵션
        if (order.extraOptions && order.extraOptions.length > 0) {
          const extraOptionsText = order.extraOptions
            .map(
              (optValue) =>
                menuConfig.extraOptions.find((o) => o.value === optValue)?.text
            )
            .filter(Boolean)
            .join('+');
          if (extraOptionsText) {
            orderParts.push(extraOptionsText);
          }
        }

        // 요청사항
        if (order.options) {
          orderParts.push(`(${order.options})`);
        }

        summary += orderParts.join(' ') + '\n';
      }

      // 스레드에 정리 내용 추가
      await client.chat.postMessage({
        channel: command.channel_id,
        thread_ts: session.messageTs,
        text: summary,
        reply_broadcast: true,
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

  app.command('/아즈니섬 도움말', async ({ command, ack, client }) => {
    await ack();
    try {
      await client.chat.postMessage({
        channel: command.channel_id,
        blocks: getTutorialBlocks(),
      });
    } catch (error) {
      logger.error('도움말 표시 실패:', error);
    }
  });

  // 주문하기 버튼 액션
  app.action('order_button', async ({ body, ack, client, respond }) => {
    logger.info('Order button clicked:', { body });

    try {
      // Check active session first
      const isActive = await orderManager.isActiveSession(body.channel.id);

      if (!isActive) {
        await respond({
          text: errorMessages.noActiveSession,
          response_type: 'ephemeral',
        });
        return;
      }

      logger.info('Opening modal with trigger_id:', body.trigger_id);

      const result = await client.views.open({
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
                type: 'static_select',
                action_id: 'menu_input',
                placeholder: {
                  type: 'plain_text',
                  text: '메뉴를 선택해주세요',
                },
                options: menuConfig.menus.map((menu) => ({
                  text: { type: 'plain_text', text: menu.text },
                  value: menu.value,
                })),
              },
              label: {
                type: 'plain_text',
                text: '메뉴',
              },
            },
            {
              type: 'input',
              block_id: 'temperature',
              element: {
                type: 'radio_buttons',
                action_id: 'temperature_input',
                options: menuConfig.temperatureOptions.map((temp) => ({
                  text: { type: 'plain_text', text: temp.text },
                  value: temp.value,
                })),
              },
              label: {
                type: 'plain_text',
                text: '온도',
              },
            },
            {
              type: 'input',
              block_id: 'bean_option',
              element: {
                type: 'radio_buttons',
                action_id: 'bean_option_input',
                options: menuConfig.beanOptions.map((bean) => ({
                  text: { type: 'plain_text', text: bean.text },
                  value: bean.value,
                })),
              },
              label: {
                type: 'plain_text',
                text: '원두 옵션',
              },
              optional: true,
            },
            {
              type: 'input',
              block_id: 'extra_options',
              element: {
                type: 'checkboxes',
                action_id: 'extra_options_input',
                options: menuConfig.extraOptions.map((option) => ({
                  text: { type: 'plain_text', text: option.text },
                  value: option.value,
                })),
              },
              label: {
                type: 'plain_text',
                text: '기타 옵션',
              },
              optional: true,
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

      logger.info('Modal opened successfully:', result);
    } catch (error) {
      logger.error('모달 열기 실패:', {
        error: error.message,
        stack: error.stack,
        body: body,
      });

      // 사용자에게 에러 메시지 전송
      await respond({
        text: '주문 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        response_type: 'ephemeral',
      });
    }
  });

  // 주문 제출 처리
  app.view('order_submission', async ({ ack, body, view, client }) => {
    try {
      await ack();

      const channelId = view.private_metadata;
      const session = await orderManager.getSession(channelId);

      if (!session || !(await orderManager.isActiveSession(channelId))) {
        logger.error('주문 세션이 유효하지 않습니다');
        return;
      }

      const userId = body.user.id;
      const menu = view.state.values.menu.menu_input.selected_option.value;
      const temperature =
        view.state.values.temperature.temperature_input.selected_option.value;
      const beanOption =
        view.state.values.bean_option.bean_option_input.selected_option
          ?.value || 'dark';
      const extraOptions =
        view.state.values.extra_options.extra_options_input.selected_options ||
        [];
      const options = view.state.values.options.options_input.value;

      // 선택된 메뉴의 카테고리 찾기
      const selectedMenu = menuConfig.menus.find((m) => m.value === menu);
      const needsBeanOption = menuConfig.categoriesNeedingBeanOption.includes(
        selectedMenu.category
      );

      // 온도 텍스트
      const temperatureKorean = temperature === 'hot' ? '따뜻한' : '아이스';

      // 주문 내역 텍스트 생성
      let orderParts = [`<@${userId}>`, temperatureKorean, menu];

      // 원두 옵션이 필요한 메뉴인 경우에만 원두 옵션 추가
      if (needsBeanOption) {
        const beanOptionText =
          menuConfig.beanOptions.find((b) => b.value === beanOption)?.text ||
          '다크(기본)';
        orderParts.push(beanOptionText);
      }

      // 기타 옵션이 있는 경우 추가
      if (extraOptions.length > 0) {
        const extraOptionsText = extraOptions
          .map(
            (opt) =>
              menuConfig.extraOptions.find((o) => o.value === opt.value)?.text
          )
          .filter(Boolean)
          .join('+');
        if (extraOptionsText) {
          orderParts.push(extraOptionsText);
        }
      }

      // 요청사항이 있는 경우 추가
      if (options) {
        orderParts.push(`(${options})`);
      }

      // 주문 텍스트 생성 (공백으로 구분)
      const orderText = orderParts.join(' ');

      // 스레드에 주문 내용 추가
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: session.messageTs,
        text: orderText,
      });

      // 주문 데이터 저장
      await orderManager.addOrder(channelId, {
        userId,
        menu,
        temperature,
        beanOption,
        extraOptions: extraOptions.map((opt) => opt.value),
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

    // Slack의 인터랙티브 컴포넌트(버튼 등) 처리
    if (req.body?.payload) {
      const payload = JSON.parse(req.body.payload);
      logger.info('Interactive payload received:', payload);

      // Manual acknowledge for interactive components
      const ack = async () => {
        logger.info('Acknowledging interactive action');
        return Promise.resolve();
      };

      // Process the event with modified payload
      await app.processEvent({
        body: {
          ...payload,
          ack,
        },
        headers: req.headers,
      });
    } else {
      await app.processEvent({
        body: req.body,
        headers: req.headers,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('Handler error:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });

    // 500 에러 대신 200으로 응답 (Slack은 3초 이내 200 응답을 기대함)
    return res.status(200).json({
      ok: false,
      error: error.message,
    });
  }
};
