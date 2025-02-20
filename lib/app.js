const { App, LogLevel } = require('@slack/bolt');
const orderManager = require('../lib/orderSession');
const menuConfig = require('../lib/menuConfig');
const orderModalView = require('../lib/orderModalView');
const { getTutorialBlocks, errorMessages } = require('../blocks/tutorial');
const { orderMessages } = require('../blocks/orderMessages');

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

function createOrderModal(trigger_id, channel_id) {
  return {
    trigger_id,
    view: orderModalView(channel_id),
  };
}

// 주문 텍스트 생성 함수
function createOrderText(orderData) {
  const { userId, menu, temperature, beanOption, extraOptions, options } =
    orderData;
  const selectedMenu = menuConfig.menus.find((m) => m.value === menu);
  const needsBeanOption = menuConfig.categoriesNeedingBeanOption.includes(
    selectedMenu.category
  );

  const orderParts = [
    `<@${userId}>`,
    temperature === 'hot' ? '따뜻한' : '아이스',
    menu,
  ];

  if (needsBeanOption) {
    const beanOptionText =
      menuConfig.beanOptions.find((b) => b.value === beanOption)?.text ||
      '다크(기본)';
    orderParts.push(beanOptionText);
  }

  if (extraOptions && extraOptions.length > 0) {
    const extraOptionsText = extraOptions
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

  if (options) {
    orderParts.push(`(${options})`);
  }

  return orderParts.join(' ');
}

// 주문하기 버튼 클릭 핸들러
async function handleOrderButton({ body, client, respond }) {
  logger.info('Order button clicked:', { body });

  try {
    const isActive = await orderManager.isActiveSession(body.channel.id);

    if (!isActive) {
      await respond({
        text: errorMessages.noActiveSession,
        response_type: 'ephemeral',
      });
      return;
    }

    logger.info('Opening modal with trigger_id:', body.trigger_id);
    const result = await client.views.open(
      createOrderModal(body.trigger_id, body.channel.id)
    );
    logger.info('Modal opened successfully:', result);
  } catch (error) {
    logger.error('모달 열기 실패:', error);
    await respond({
      text: '주문 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      response_type: 'ephemeral',
    });
  }
}

// 주문 제출 핸들러
async function handleOrderSubmission({ body, view, client }) {
  try {
    const channelId = view.private_metadata;
    const session = await orderManager.getSession(channelId);

    if (!session || !(await orderManager.isActiveSession(channelId))) {
      logger.error('주문 세션이 유효하지 않습니다');
      return {
        response_action: 'errors',
        errors: {
          menu: '주문 세션이 만료되었습니다. 새로운 주문을 시작해주세요.',
        },
      };
    }

    const orderData = {
      userId: body.user.id,
      menu: view.state.values.menu.menu_input.selected_option.value,
      temperature:
        view.state.values.temperature.temperature_input.selected_option.value,
      beanOption:
        view.state.values.bean_option.bean_option_input.selected_option
          ?.value || 'dark',
      extraOptions: (
        view.state.values.extra_options.extra_options_input.selected_options ||
        []
      ).map((opt) => opt.value),
      options: view.state.values.options.options_input.value,
    };

    const orderText = createOrderText(orderData);

    // 스레드에 주문 내용 추가
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: session.messageTs,
      text: orderText,
    });

    // 주문 데이터 저장
    await orderManager.addOrder(channelId, orderData);
  } catch (error) {
    logger.error('Order submission error:', error);
    return {
      response_action: 'errors',
      errors: {
        menu: '주문 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
      },
    };
  }
}

async function handleOrderStart({ command, client, respond }) {
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

  // 명령어에서 사용자 그룹 ID 추출
  const args = command.text.split(' ');
  const userGroupId = args[1]?.startsWith('<!subteam^') 
    ? args[1].match(/<!subteam\^([^|]+)/)?.[1]
    : null;

  const messageConfig = userGroupId 
    ? {
        text: orderMessages.withUserGroup.text(userGroupId),
        blocks: orderMessages.withUserGroup.blocks(userGroupId)
      }
    : orderMessages.start;

  logger.info('Sending initial message');
  const result = await client.chat.postMessage({
    channel: command.channel_id,
    ...messageConfig,
  });
  logger.info('Message sent successfully:', result);

  // 새 세션 시작
  await orderManager.startSession(command.channel_id, result.ts);
  logger.info('New session started');
}

// 주문 현황 처리 함수
async function handleOrderStatus({ command, client, respond }) {
  const session = await orderManager.getSession(command.channel_id);

  if (!session || !(await orderManager.isActiveSession(command.channel_id))) {
    await respond({
      text: errorMessages.noActiveSession,
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

  // 주문 현황 집계
  const orderSummary = session.orders.reduce((acc, order) => {
    const key = [
      order.menu,
      order.temperature,
      order.beanOption,
      (order.extraOptions || []).sort().join('+'),
      order.options
    ].filter(Boolean).join(' | ');
    
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  // 메시지 생성
  let summaryText = '*현재 주문 현황*\n';
  summaryText += `총 ${session.orders.length}건의 주문이 있습니다.\n\n`;

  Object.entries(orderSummary).forEach(([orderKey, count]) => {
    summaryText += `• ${orderKey} (${count}건)\n`;
  });

  await client.chat.postMessage({
    channel: command.channel_id,
    thread_ts: session.messageTs,
    text: summaryText,
  });
}

// 핸들러 설정 함수
const setupHandlers = (app) => {
  // 주문마감 명령어 처리
  async function handleOrderEnd({ command, client, respond }) {
    const session = await orderManager.getSession(command.channel_id);

    if (!session || !(await orderManager.isActiveSession(command.channel_id))) {
      await respond({
        text: '현재 진행 중인 주문이 없습니다.',
        response_type: 'ephemeral',
      });
      return;
    }

    if (session.orders.length === 0) {
      await respond({
        text: errorMessages.noOrders,
        response_type: 'in_channel',
      });
      await orderManager.clearSession(command.channel_id);
      return;
    }

    // 주문 내역 정리
    let summary = '*주문 내역 정리*\n';
    summary += `총 ${session.orders.length}건의 주문이 있습니다.\n\n`;

    for (const order of session.orders) {
      summary += createOrderText(order) + '\n';
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
  }

  // 도움말 명령어 처리
  async function handleHelp({ command, client }) {
    await client.chat.postMessage({
      channel: command.channel_id,
      blocks: getTutorialBlocks(),
    });
    logger.info('Help message sent successfully');
  }

  // 메인 command 핸들러
  app.command('/아즈니섬', async ({ command, client, respond }) => {
    // 주문시작 명령어에 대해서는 전체 텍스트가 아닌 첫 단어만 체크
    const subcommand = command.text.split(' ')[0].trim().toLowerCase();

    logger.info('Command received:', { command: '/아즈니섬', subcommand });

    try {
      switch (subcommand) {
        case '주문시작':
          await handleOrderStart({ command, client, respond });
          break;
        
        case '주문현황':
          await handleOrderStatus({ command, client, respond });
          break;

        case '주문마감':
          await handleOrderEnd({ command, client, respond });
          break;

        case '도움말':
          await handleHelp({ command, client });
          break;

        default:
          await respond({
            text: '알 수 없는 명령어입니다. `/아즈니섬 도움말`을 입력하여 사용 가능한 명령어를 확인하세요.',
            response_type: 'ephemeral',
          });
      }
    } catch (error) {
      logger.error('Command handler error:', {
        error: error.message,
        stack: error.stack,
        command,
        subcommand,
      });

      if (error.message.includes('channel_not_found')) {
        await respond({
          text: errorMessages.channelNotFound,
          response_type: 'ephemeral',
        });
      } else {
        await respond({
          text: `명령어 처리 중 오류가 발생했습니다. (${error.message})`,
          response_type: 'ephemeral',
        });
      }
    }
  });

  // 주문하기 버튼 액션
  app.action('order_button', handleOrderButton);

  // 주문 제출 처리
  app.view('order_submission', handleOrderSubmission);
};

module.exports = {
  getApp,
  handleOrderStart,
  logger,
};
